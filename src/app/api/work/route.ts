import { NextResponse } from "next/server";

import { adaptLiveGeneratedWork } from "@/lib/domain/live-work-adapter";
import { getLiveOperationalRecords } from "@/lib/fixtures-read-model";
import { apiErrorResponse } from "@/lib/server/api-error";
import { createLiveGeneratedWork, listLiveGeneratedWork, listLivePublishedCalendarEntries } from "@/lib/server/generated-work-repository";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { asRecord, isNonEmptyString } from "@/lib/server/request-input";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const workReadCapabilities = ["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"] as const;

export async function GET() {
  if (isPrototypeDemoMode()) return NextResponse.json({ data: [], source: "prototype-disabled", fixtureSafe: true });

  const user = await getAuthenticatedUser();
  const client = await createSupabaseServerClient();
  if (!user || !client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const capabilityResults = await Promise.all(workReadCapabilities.map((capability) => client.rpc("has_active_capability", { required_capability: capability })));
  if (!capabilityResults.some((result) => !result.error && result.data === true)) {
    return NextResponse.json({ error: "Work access is not configured for this user." }, { status: 403 });
  }

  try {
    const records = await listLiveGeneratedWork();
    const userIds = [...new Set(records.flatMap((record) => [record.preparer_user_id, record.checker_user_id, record.reviewer_user_id, record.current_owner_user_id]).filter((id): id is string => Boolean(id)))];
    const { data: users, error: usersError } = userIds.length > 0
      ? await client.from("app_users").select("id, display_name").in("id", userIds)
      : { data: [], error: null };
    if (usersError) throw new Error("Unable to load work owners.");
    const names = new Map((users ?? []).map((record) => [record.id, record.display_name]));
    const data = records.map((record) => adaptLiveGeneratedWork(record, names));
    const calendarEntries = await listLivePublishedCalendarEntries([...new Set(records.map((record) => record.requirement_id))]);
    return NextResponse.json({ data, operationalRecords: getLiveOperationalRecords(data, calendarEntries), source: "generated_compliance_work+released_calendar", fixtureSafe: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load generated compliance work.", { status: 503, logContext: "load generated compliance work" });
  }
}

export async function POST(request: Request) {
  if (isPrototypeDemoMode()) return NextResponse.json({ error: "The prototype uses the in-browser sanitized Work fixture." }, { status: 409 });
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  const denied = await requireApiCapability(["MaintainGeneratedComplianceWork"]);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const input = asRecord(body);
  const paymentApplicability = typeof input?.paymentApplicability === "string" ? input.paymentApplicability.toLowerCase() : "";
  const paymentAmount = input?.paymentAmount === null || input?.paymentAmount === undefined || input?.paymentAmount === ""
    ? null
    : typeof input.paymentAmount === "number" ? input.paymentAmount : Number(input.paymentAmount);
  const tmfPackageTarget = typeof input?.deadline === "string" ? input.deadline.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? null : null;
  if (!input || !isNonEmptyString(input.clientId) || !isNonEmptyString(input.title) || !isNonEmptyString(input.period) || !isNonEmptyString(input.idempotencyKey)) {
    return NextResponse.json({ error: "Taxpayer, requirement code, period, and idempotency key are required." }, { status: 400 });
  }
  if (!["required", "not_applicable", "unresolved"].includes(paymentApplicability)) {
    return NextResponse.json({ error: "Choose a valid payment applicability." }, { status: 400 });
  }
  if (paymentAmount !== null && (!Number.isFinite(paymentAmount) || paymentAmount < 0)) {
    return NextResponse.json({ error: "Payment amount must be a non-negative number." }, { status: 400 });
  }

  try {
    const data = await createLiveGeneratedWork({
      clientReference: input.clientId.trim(),
      requirementCode: input.title.trim().toUpperCase(),
      periodLabel: input.period.trim(),
      tmfPackageTarget,
      paymentApplicability: paymentApplicability as "required" | "not_applicable" | "unresolved",
      paymentAmount: paymentApplicability === "not_applicable" ? null : paymentAmount,
      idempotencyKey: input.idempotencyKey.trim(),
    });
    return NextResponse.json({ data: { id: data }, fixtureSafe: false }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to create Work. Check that the taxpayer and requirement code are approved and available.", { status: 422, logContext: "create generated work" });
  }
}
