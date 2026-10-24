import { clientCandidateFormNumbers, compliancePeriodStartFromLabel, getClientServiceCalendarRows, type DeadlineControlRow } from "@/lib/domain/deadline-control";
import type { FixtureClient } from "@/lib/fixtures";
import { projectReturnFamilyCalendar } from "@/lib/domain/return-families";
import { calculateInternalTarget } from "@/lib/domain/tax-foundation";
import { listHeldCalendarPeriods, listLiveClientCalendarEntries, listRequirementIdsForFormNumbers, type HeldCalendarPeriod } from "@/lib/server/generated-work-repository";

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

/** A period waiting on the Tax Team: no date is shown until it is published. */
function toHeldRow(period: HeldCalendarPeriod, year: number): DeadlineControlRow {
  const label = period.period_or_event ?? period.period_start ?? period.calendar_month;
  return {
    id: period.entry_id,
    calendarYear: year,
    requirementCode: period.requirement_code,
    requirementLabel: period.requirement_name,
    formNumber: [...new Set(period.form_numbers)].join(" · "),
    taxCategory: period.operating_category as DeadlineControlRow["taxCategory"],
    cadence: cadence(period.frequency_label),
    component: "Return / filing",
    activityMonth: calendarMonthLabel(period.calendar_month),
    activityPeriod: label,
    periodStartDate: period.period_start ?? compliancePeriodStartFromLabel(period.period_or_event) ?? "",
    taxablePeriod: label,
    baseStatutoryDeadline: null,
    adjustedStatutoryDeadline: null,
    officialPublishedDeadline: null,
    officialCalendarReference: null,
    earliestApplicableDeadline: null,
    publishedOperationalDeadline: null,
    tmfPackageTarget: null,
    publicationStatus: period.publication_status,
    verificationStatus: "unresolved",
    ruleVersionId: "unresolved",
    sourceCode: "published-calendar",
    sourceLabel: "Tax Team calendar (not yet published)",
    adjustmentReason: "",
    explanation: "Waiting for the Tax Team to publish this period's deadline.",
  };
}

function periodKey(row: DeadlineControlRow) {
  return `${row.formNumber}|${/proof of/i.test(row.activityPeriod) ? "proof" : "return"}|${row.periodStartDate || row.taxablePeriod}`;
}

/**
 * The client's service calendar for one year, one row per return and period by
 * return family. `forms` overrides the profile's returns, e.g. with the
 * approved Expected Compliance that generation must follow.
 */
export async function loadClientServiceCalendar(client: FixtureClient, year: number, forms?: readonly string[], approvedRequirementIds?: readonly string[], registrationUnitId?: string) {
  const candidateForms = forms ? [...forms] : clientCandidateFormNumbers(client);
  // Generation reads only the requirements Expected Compliance approved, so a
  // row of another requirement carrying the same form never displaces them.
  const requirementIds = approvedRequirementIds ? [...approvedRequirementIds] : await listRequirementIdsForFormNumbers(candidateForms);
  const publishedRows = (await listLiveClientCalendarEntries(requirementIds, year)).map(toDeadlineRow);
  // One row per return and period, by return family (HOD rules of 2026-10-22).
  const families = projectReturnFamilyCalendar(client, candidateForms, publishedRows, year);
  // A return period the Tax Team has not published stays visible as held,
  // unless a published row already covers the same return and period.
  const unitId = registrationUnitId ?? client.entities[0]?.units[0]?.id;
  const heldPeriods = unitId ? await listHeldCalendarPeriods(unitId, requirementIds, year) : [];
  const notices = [...families.notices];
  let heldRows: DeadlineControlRow[] = [];
  if (heldPeriods === null) {
    notices.push("Return periods waiting on the Tax Team calendar cannot be listed until the latest database update is applied.");
  } else if (heldPeriods.length > 0) {
    const covered = new Set(families.rows.map(periodKey));
    heldRows = projectReturnFamilyCalendar(client, candidateForms, heldPeriods.map((period) => toHeldRow(period, year)), year).rows
      .filter((row) => row.publicationStatus !== "published" && !covered.has(periodKey(row)))
      // One held row per return and period, whichever filing channel it came from.
      .filter((row, index, all) => all.findIndex((other) => periodKey(other) === periodKey(row)) === index);
  }
  const projection = getClientServiceCalendarRows(client, year, {}, [...families.rows, ...heldRows]);
  return { ...projection, notices };
}
