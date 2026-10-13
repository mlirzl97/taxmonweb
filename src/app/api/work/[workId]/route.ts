import { NextResponse } from "next/server";

import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { asRecord, isNonEmptyString } from "@/lib/server/request-input";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { getLiveGeneratedWorkDetail, recordLiveGeneratedWorkCommand } from "@/lib/server/generated-work-repository";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const commandCapabilities: Record<string, readonly string[]> = {
  checklist: ["ExecuteGeneratedComplianceWork"],
  gate_decision: ["ExecuteGeneratedComplianceWork"],
  payment_profile: ["ExecuteGeneratedComplianceWork"],
  process_status: ["ExecuteGeneratedComplianceWork"],
  final_certification: ["ExecuteGeneratedComplianceWork"],
  data_readiness: ["ExecuteGeneratedComplianceWork", "MaintainGeneratedComplianceWork"],
  qa_finding: ["PerformWorkQA", "ValidateTaxProfile", "ViewTaxControlHistory"],
  period_lock: ["ManageWorkPeriodLock", "PerformElevatedOverride"],
};

function workIdFromParams(params: { workId: string }) {
  return isNonEmptyString(params.workId) ? params.workId : null;
}

export async function GET(_request: Request, context: { params: Promise<{ workId: string }> }) {
  if (isPrototypeDemoMode()) return NextResponse.json({ error: "The prototype uses the in-browser sanitized Work fixture." }, { status: 409 });
  const denied = await requireApiCapability(["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"]);
  if (denied) return denied;
  const workId = workIdFromParams(await context.params);
  if (!workId) return NextResponse.json({ error: "A work ID is required." }, { status: 400 });
  try {
    return NextResponse.json({ data: await getLiveGeneratedWorkDetail(workId) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load generated compliance work detail.", { status: inferredApiErrorStatus(error, 503), logContext: "load generated work detail" });
  }
}

export async function POST(request: Request, context: { params: Promise<{ workId: string }> }) {
  if (isPrototypeDemoMode()) return NextResponse.json({ error: "The prototype uses the in-browser sanitized Work fixture." }, { status: 409 });
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const input = asRecord(body);
  const workId = workIdFromParams(await context.params);
  if (!workId || !input || !isNonEmptyString(input.command) || !isNonEmptyString(input.idempotencyKey)) {
    return NextResponse.json({ error: "Work ID, command, and idempotency key are required." }, { status: 400 });
  }
  const capabilities = commandCapabilities[input.command];
  if (!capabilities) return NextResponse.json({ error: "Unsupported Work command." }, { status: 400 });
  const denied = await requireApiCapability(capabilities);
  if (denied) return denied;
  const payload = asRecord(input.payload) ?? {};
  try {
    const data = await recordLiveGeneratedWorkCommand(workId, input.command, payload, input.idempotencyKey);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error, "Unable to record Work command.", { status: inferredApiErrorStatus(error, 422), logContext: "record Work command" });
  }
}
