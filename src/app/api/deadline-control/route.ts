import { NextResponse } from "next/server";

import { buildDeadlineControlRows, type DeadlinePublicationStatus } from "@/lib/domain/deadline-control";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { listDeadlineControlRows, saveDeadlineControlEntry, transitionDeadlineControlEntry, type DeadlineControlEntryInput } from "@/lib/server/deadline-control-repository";

function requestedYear(value: string | null) {
  const year = Number(value ?? "2026");
  return Number.isInteger(year) && year >= 2020 && year <= 2200 ? year : null;
}

function responseError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = /authorized|authentication|configured/i.test(message) ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const year = requestedYear(new URL(request.url).searchParams.get("year"));
  if (year === null) return NextResponse.json({ error: "A valid calendar year is required." }, { status: 400 });

  if (isPrototypeDemoMode()) {
    return NextResponse.json({ data: buildDeadlineControlRows(year), source: "sanitized-fixture" });
  }

  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ data: await listDeadlineControlRows(year), source: "repository" });
  } catch (error) {
    return responseError(error, "Unable to load the deadline repository.");
  }
}

export async function POST(request: Request) {
  if (isPrototypeDemoMode()) {
    return NextResponse.json({ error: "Prototype mode uses an in-browser sanitized fixture. Apply the Supabase migration to enable governed persistence." }, { status: 409 });
  }
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  try {
    if (input.action === "transition") {
      if (typeof input.entryId !== "string" || typeof input.toStatus !== "string" || typeof input.reason !== "string") {
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
    const payload = input.payload as Record<string, unknown>;
    const requiredStrings = ["calendarMonth", "requirementCode", "requirementName", "operatingCategory", "frequencyLabel", "sourceCode", "reason"];
    if (requiredStrings.some((key) => typeof payload[key] !== "string" || !String(payload[key]).trim())) {
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
