import { createSupabaseServerClient } from "@/lib/supabase/server";
import { earliestApplicableDeadline, type DeadlineControlRow, type DeadlinePublicationStatus } from "@/lib/domain/deadline-control";

export type DeadlineControlEntryInput = {
  entryId: string | null;
  calendarMonth: string;
  requirementCode: string;
  requirementName: string;
  formNumber: string;
  operatingCategory: "cit" | "vat_percentage" | "wht" | "others";
  frequencyLabel: "monthly" | "quarterly" | "annual" | "as_needed";
  periodOrEvent: string;
  periodStart: string | null;
  periodEnd: string | null;
  baseStatutoryDeadline: string | null;
  adjustedStatutoryDeadline: string | null;
  tmfPackageTarget: string | null;
  sourceCode: string;
  sourceLocator: string;
  notes: string;
  reason: string;
};

export type DeadlineControlTransitionInput = {
  entryId: string;
  toStatus: DeadlinePublicationStatus;
  publishedOperationalDeadline: string | null;
  reason: string;
};

function cadenceLabel(value: unknown): DeadlineControlRow["cadence"] {
  if (value === "annual") return "Annual";
  if (value === "quarterly") return "Quarterly";
  if (value === "as_needed") return "As needed";
  return "Monthly";
}

function mapRepositoryRow(value: unknown): DeadlineControlRow {
  const row = value as Record<string, unknown>;
  const sourceCode = typeof row.sourceCode === "string" ? row.sourceCode : "unresolved";
  const sourceLabel = typeof row.sourceLabel === "string" ? row.sourceLabel : sourceCode;
  const publicationStatus = (typeof row.publicationStatus === "string" ? row.publicationStatus : "unresolved") as DeadlinePublicationStatus;

  return {
    id: String(row.id),
    calendarYear: Number(row.calendarYear),
    requirementCode: String(row.requirementCode ?? "UNMAPPED"),
    requirementLabel: String(row.requirementLabel ?? "Unmapped requirement"),
    formNumber: String(row.formNumber ?? "Not mapped"),
    taxCategory: String(row.taxCategory ?? "others"),
    cadence: cadenceLabel(row.cadence),
    component: "Return / filing",
    activityMonth: row.calendarMonth ? new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "Asia/Manila" }).format(new Date(`${String(row.calendarMonth)}T00:00:00Z`)) : "Unresolved",
    activityPeriod: String(row.periodOrEvent ?? "Unresolved"),
    taxablePeriod: String(row.periodOrEvent ?? "Unresolved"),
    baseStatutoryDeadline: typeof row.baseStatutoryDeadline === "string" ? row.baseStatutoryDeadline : null,
    adjustedStatutoryDeadline: typeof row.adjustedStatutoryDeadline === "string" ? row.adjustedStatutoryDeadline : null,
    officialPublishedDeadline: typeof row.officialPublishedDeadline === "string" ? row.officialPublishedDeadline : null,
    officialCalendarReference: typeof row.officialCalendarReference === "string" ? row.officialCalendarReference : null,
    earliestApplicableDeadline: earliestApplicableDeadline([typeof row.adjustedStatutoryDeadline === "string" ? row.adjustedStatutoryDeadline : null]),
    publishedOperationalDeadline: typeof row.publishedOperationalDeadline === "string" ? row.publishedOperationalDeadline : null,
    tmfPackageTarget: typeof row.tmfPackageTarget === "string" ? row.tmfPackageTarget : null,
    publicationStatus,
    verificationStatus: row.comparisonStatus === "match" ? "verified" : "unresolved",
    ruleVersionId: String(row.ruleVersionId ?? "unresolved"),
    sourceCode,
    sourceLabel,
    adjustmentReason: String(row.adjustmentReason ?? ""),
    explanation: String(row.explanation ?? "No explanation recorded."),
    unresolvedReason: typeof row.unresolvedReason === "string" ? row.unresolvedReason : undefined,
  };
}

function requireClient() {
  return createSupabaseServerClient().then((client) => {
    if (!client) throw new Error("Supabase is not configured for this environment.");
    return client;
  });
}

export async function listDeadlineControlRows(calendarYear: number) {
  const client = await requireClient();
  const { data, error } = await client.rpc("get_deadline_control_repository", { p_calendar_year: calendarYear });
  if (error) throw new Error(`Unable to load the deadline repository: ${error.message}`);
  return (Array.isArray(data) ? data : []).map(mapRepositoryRow);
}

export async function saveDeadlineControlEntry(input: DeadlineControlEntryInput) {
  const client = await requireClient();
  const { data, error } = await client.rpc("save_deadline_control_entry", {
    p_entry_id: input.entryId,
    p_calendar_month: input.calendarMonth,
    p_requirement_code: input.requirementCode,
    p_requirement_name: input.requirementName,
    p_form_number: input.formNumber || null,
    p_operating_category: input.operatingCategory,
    p_frequency_label: input.frequencyLabel,
    p_period_or_event: input.periodOrEvent || null,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_base_statutory_deadline: input.baseStatutoryDeadline,
    p_adjusted_statutory_deadline: input.adjustedStatutoryDeadline,
    p_tmf_package_target: input.tmfPackageTarget,
    p_source_code: input.sourceCode,
    p_source_locator: input.sourceLocator || null,
    p_notes: input.notes || null,
    p_reason: input.reason,
  });
  if (error) throw new Error(`Unable to save the deadline repository entry: ${error.message}`);
  return data as { id: string; publicationStatus: DeadlinePublicationStatus };
}

export async function transitionDeadlineControlEntry(input: DeadlineControlTransitionInput) {
  const client = await requireClient();
  const { data, error } = await client.rpc("transition_deadline_control_entry", {
    p_entry_id: input.entryId,
    p_to_status: input.toStatus,
    p_published_operational_deadline: input.publishedOperationalDeadline,
    p_reason: input.reason,
  });
  if (error) throw new Error(`Unable to update the deadline repository status: ${error.message}`);
  return data as { id: string; publicationStatus: DeadlinePublicationStatus };
}
