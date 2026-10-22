import { clientCandidateFormNumbers, compliancePeriodStartFromLabel, getClientServiceCalendarRows, type DeadlineControlRow } from "@/lib/domain/deadline-control";
import type { FixtureClient } from "@/lib/fixtures";
import { projectReturnFamilyCalendar } from "@/lib/domain/return-families";
import { calculateInternalTarget } from "@/lib/domain/tax-foundation";
import { listLiveClientCalendarEntries, listRequirementIdsForFormNumbers } from "@/lib/server/generated-work-repository";

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
    // The compliance period, not the month the deadline falls in.
    periodStartDate: entry.period_start ?? compliancePeriodStartFromLabel(entry.period_or_event) ?? "",
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

/** The client's service calendar for one year, one row per return and period by return family. */
export async function loadClientServiceCalendar(client: FixtureClient, year: number) {
  const candidateForms = clientCandidateFormNumbers(client);
  const requirementIds = await listRequirementIdsForFormNumbers(candidateForms);
  const publishedRows = (await listLiveClientCalendarEntries(requirementIds, year)).map(toDeadlineRow);
  // One row per return and period, by return family (HOD rules of 2026-10-22).
  const families = projectReturnFamilyCalendar(client, candidateForms, publishedRows, year);
  const projection = getClientServiceCalendarRows(client, year, {}, families.rows);
  return { ...projection, notices: families.notices };
}
