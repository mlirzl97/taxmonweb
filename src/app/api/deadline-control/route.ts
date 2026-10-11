import { NextResponse } from "next/server";

import { buildDeadlineControlRows, type DeadlinePublicationStatus } from "@/lib/domain/deadline-control";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { asRecord, isNonEmptyString } from "@/lib/server/request-input";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { listDeadlineControlRows, saveDeadlineControlEntry, transitionDeadlineControlEntry, type DeadlineControlEntryInput } from "@/lib/server/deadline-control-repository";

function requestedYear(value: string | null) {
  const year = Number(value ?? "2026");
  return Number.isInteger(year) && year >= 2020 && year <= 2200 ? year : null;
}

function responseError(error: unknown, fallback: string) {
  return apiErrorResponse(error, fallback, { status: inferredApiErrorStatus(error), logContext: fallback });
}

export async function GET(request: Request) {
  const year = requestedYear(new URL(request.url).searchParams.get("year"));
  if (year === null) return NextResponse.json({ error: "A valid calendar year is required." }, { status: 400 });

  if (isPrototypeDemoMode()) {
    return NextResponse.json({ data: buildDeadlineControlRows(year), source: "sanitized-fixture" });
  }

  const denied = await requireApiCapability(["ViewTaxControlHistory", "MaintainDeadlineControl", "MaintainRulesLibrary", "ValidateTaxProfile"]);
  if (denied) return denied;

  try {
    return NextResponse.json({ data: await listDeadlineControlRows(year), source: "repository" });
  } catch (error) {
    return responseError(error, "Unable to load the deadline repository.");
  }
}

export async function POST(request: Request) {
  const denied = await requireApiCapability(["MaintainDeadlineControl", "MaintainRulesLibrary", "ValidateTaxProfile"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;
  if (isPrototypeDemoMode()) {
    return NextResponse.json({ error: "Prototype mode uses an in-browser sanitized fixture. Apply the Supabase migration to enable governed persistence." }, { status: 409 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = asRecord(body);
  if (!input) return NextResponse.json({ error: "Unsupported deadline control action." }, { status: 400 });
  try {
    if (input.action === "transition") {
      if (!isNonEmptyString(input.entryId) || !isNonEmptyString(input.toStatus) || !isNonEmptyString(input.reason)) {
        return NextResponse.json({ error: "Entry ID, status, and reason are required." }, { status: 400 });
      }
      const data = await transitionDeadlineControlEntry({
        entryId: input.entryId,
        toStatus: input.toStatus as DeadlinePublicationStatus,
        publishedOperationalDeadline: typeof input.publishedOperationalDeadline === "string" ? input.publishedOperationalDeadline : null,
        reason: input.reason,
      });
      return NextResponse.json({ data });
    }

    if (input.action !== "save" || !input.payload || typeof input.payload !== "object") {
      return NextResponse.json({ error: "Unsupported deadline control action." }, { status: 400 });
    }
    const payload = asRecord(input.payload);
    if (!payload) return NextResponse.json({ error: "Unsupported deadline control action." }, { status: 400 });
    const requiredStrings = ["calendarMonth", "requirementCode", "requirementName", "operatingCategory", "frequencyLabel", "sourceCode", "reason"];
    if (requiredStrings.some((key) => !isNonEmptyString(payload[key]))) {
      return NextResponse.json({ error: "Calendar month, requirement identity, category, frequency, source, and reason are required." }, { status: 400 });
    }
    const data = await saveDeadlineControlEntry({
      entryId: typeof payload.entryId === "string" ? payload.entryId : null,
      calendarMonth: String(payload.calendarMonth),
      requirementCode: String(payload.requirementCode),
      requirementName: String(payload.requirementName),
      formNumber: typeof payload.formNumber === "string" ? payload.formNumber : "",
      operatingCategory: String(payload.operatingCategory) as DeadlineControlEntryInput["operatingCategory"],
      frequencyLabel: String(payload.frequencyLabel) as DeadlineControlEntryInput["frequencyLabel"],
      periodOrEvent: typeof payload.periodOrEvent === "string" ? payload.periodOrEvent : "",
      periodStart: typeof payload.periodStart === "string" ? payload.periodStart : null,
      periodEnd: typeof payload.periodEnd === "string" ? payload.periodEnd : null,
      baseStatutoryDeadline: typeof payload.baseStatutoryDeadline === "string" ? payload.baseStatutoryDeadline : null,
      adjustedStatutoryDeadline: typeof payload.adjustedStatutoryDeadline === "string" ? payload.adjustedStatutoryDeadline : null,
      tmfPackageTarget: typeof payload.tmfPackageTarget === "string" ? payload.tmfPackageTarget : null,
      sourceCode: String(payload.sourceCode),
      sourceLocator: typeof payload.sourceLocator === "string" ? payload.sourceLocator : "",
      notes: typeof payload.notes === "string" ? payload.notes : "",
      reason: String(payload.reason),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return responseError(error, "Unable to save the deadline repository entry.");
  }
}
