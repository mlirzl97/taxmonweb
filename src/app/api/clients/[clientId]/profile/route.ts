import { NextResponse } from "next/server";

import type { TaxProfilePersistencePayload } from "@/lib/domain/client-profile-persistence";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { asRecord, isNonEmptyString } from "@/lib/server/request-input";
import { getLatestTaxProfileVersion, saveTaxProfileVersion, validateTaxProfileVersion } from "@/lib/server/tax-profile-repository";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireApiCapability(["ReviewTaxProfile", "ViewScopedPortfolio", "MaintainClientRepository"]);
  if (denied) return denied;

  try {
    const result = await getLatestTaxProfileVersion((await context.params).clientId);
    return NextResponse.json({ clientFound: result?.clientFound ?? false, data: result?.data ?? null });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the saved Tax Profile.", { status: inferredApiErrorStatus(error), logContext: "load Tax Profile" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const denied = await requireApiCapability(["CorrectTaxProfile", "MaintainClientRepository"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const command = asRecord(body);
  if (!command) return NextResponse.json({ error: "Profile command is invalid." }, { status: 400 });
  const action = command.action;
  const reason = typeof command.reason === "string" ? command.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "A reason is required for a profile change." }, { status: 400 });

  try {
    if (action === "validate") {
      if (typeof command.versionId !== "string") return NextResponse.json({ error: "A saved profile version is required before validation." }, { status: 400 });
      const data = await validateTaxProfileVersion(command.versionId, reason);
      return NextResponse.json({ data, state: "active" });
    }

    const rawPayload = asRecord(command.payload);
    if (!rawPayload || !asRecord(rawPayload.profile) || !asRecord(rawPayload.assignment) || !isNonEmptyString(rawPayload.effectiveFrom) || !isNonEmptyString(rawPayload.reason)) {
      return NextResponse.json({ error: "A complete profile payload is required." }, { status: 400 });
    }
    const payload: TaxProfilePersistencePayload = {
      profile: asRecord(rawPayload.profile) ?? {},
      assignment: asRecord(rawPayload.assignment) ?? {},
      effectiveFrom: rawPayload.effectiveFrom,
      reason: rawPayload.reason,
    };
    const data = await saveTaxProfileVersion((await context.params).clientId, { ...payload, reason });
    if (action === "save-and-validate") {
      const validated = await validateTaxProfileVersion(data.id, reason);
      return NextResponse.json({ data: validated, state: "active" });
    }
    return NextResponse.json({ data, state: "ready_for_validation" });
  } catch (error) {
    return apiErrorResponse(error, "Unable to apply the Tax Profile command.", { status: inferredApiErrorStatus(error), logContext: "apply Tax Profile command" });
  }
}
