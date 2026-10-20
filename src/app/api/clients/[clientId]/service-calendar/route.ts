import { NextResponse } from "next/server";

import { clientCandidateFormNumbers, getClientServiceCalendarRows, type DeadlineControlRow } from "@/lib/domain/deadline-control";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { calculateInternalTarget } from "@/lib/domain/tax-foundation";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { getPortfolioClient } from "@/lib/server/client-repository";
import { listLiveClientCalendarEntries, listRequirementIdsForFormNumbers } from "@/lib/server/generated-work-repository";

function requestedYear(value: string | null) {
  const year = Number(value ?? new Date().getUTCFullYear());
  return Number.isInteger(year) && year >= 2020 && year <= 2200 ? year : null;
}

function cadence(value: string): DeadlineControlRow["cadence"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("annual")) return "Annual";
  if (normalized.includes("quarter")) return "Quarterly";
  if (normalized.includes("month")) return "Monthly";
  return "As needed";
}

function calendarMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00Z`));
}

function toDeadlineRow(entry: Awaited<ReturnType<typeof listLiveClientCalendarEntries>>[number]): DeadlineControlRow {
  const earliestApplicableDeadline = entry.adjusted_statutory_deadline ?? entry.base_statutory_deadline;
  return {
    id: entry.id,
    calendarYear: entry.calendar_year,
    requirementCode: entry.requirement_code,
    requirementLabel: entry.requirement_name,
    formNumber: entry.form_number,
    taxCategory: entry.operating_category,
    cadence: cadence(entry.frequency_label),
    component: "Return / filing",
    activityMonth: calendarMonthLabel(entry.calendar_month),
    activityPeriod: entry.period_or_event ?? entry.period_start ?? entry.calendar_month,
    periodStartDate: entry.period_start ?? entry.calendar_month,
    taxablePeriod: entry.period_or_event ?? entry.period_start ?? entry.calendar_month,
    baseStatutoryDeadline: entry.base_statutory_deadline,
    adjustedStatutoryDeadline: entry.adjusted_statutory_deadline,
    officialPublishedDeadline: null,
    officialCalendarReference: null,
    earliestApplicableDeadline,
    publishedOperationalDeadline: entry.published_operational_deadline,
    tmfPackageTarget: entry.tmf_package_target ?? (earliestApplicableDeadline ? calculateInternalTarget(earliestApplicableDeadline) : null),
    publicationStatus: "published",
    verificationStatus: "unresolved",
    ruleVersionId: entry.requirement_version_id ?? "unresolved",
    sourceCode: "published-calendar",
    sourceLabel: "Tax Team published calendar",
    adjustmentReason: "",
    explanation: "Published operational deadline from the governed monthly calendar.",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const denied = await requireApiCapability(["ReviewTaxProfile", "ViewScopedPortfolio", "ViewTaxControlHistory"]);
  if (denied) return denied;

  const year = requestedYear(new URL(request.url).searchParams.get("year"));
  if (year === null) return NextResponse.json({ error: "A valid calendar year is required." }, { status: 400 });

  try {
    const { clientId } = await params;
    const portfolioClient = await getPortfolioClient(clientId);
    if (!portfolioClient) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const client = portfolioClientToFixtureClient(portfolioClient);
    const candidateForms = clientCandidateFormNumbers(client);
    const requirementIds = await listRequirementIdsForFormNumbers(candidateForms);
    const governedRows = (await listLiveClientCalendarEntries(requirementIds, year)).map(toDeadlineRow);
    const projection = getClientServiceCalendarRows(client, year, {}, governedRows);
    return NextResponse.json({ data: projection.rows, heldRows: projection.heldRows, source: "published-calendar", fixtureSafe: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the client service calendar.", { status: 503, logContext: "load client service calendar" });
  }
}
