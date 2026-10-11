import { type FixtureClient } from "@/lib/fixtures";
import { forms } from "@/lib/domain/tax-foundation-catalog";
import { normalizeReturnSearchText } from "@/lib/domain/client-return-selection";
import { calculateDeadline, calculateInternalTarget, type DeadlinePolicyVersion, type VerificationStatus } from "@/lib/domain/tax-foundation";
import { defaultGroupScheduleLeadDays, normalizeClientDeadlinePolicy, workingDaysBefore, type ClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";

/**
 * Prototype projection over the canonical Requirement/Rule/Calendar concepts.
 *
 * This module deliberately does not create a second deadline truth. The rows
 * are deterministic candidates for the Tax Team control surface. Only rows
 * with a published operational deadline are exposed to a client service
 * calendar. Unresolved or unverified tax content remains visible as a gate.
 */

export type DeadlinePublicationStatus = "generated" | "needs_review" | "confirmed" | "published" | "unresolved" | "superseded";

export type DeadlineControlRow = {
  id: string;
  calendarYear: number;
  requirementCode: string;
  requirementLabel: string;
  formNumber: string;
  taxCategory: string;
  cadence: "Monthly" | "Quarterly" | "Annual" | "As needed";
  component: "Return / filing";
  activityMonth: string;
  activityPeriod: string;
  taxablePeriod: string;
  baseStatutoryDeadline: string | null;
  adjustedStatutoryDeadline: string | null;
  /**
   * The earliest applicable adjusted statutory component deadline. This is
   * the default master-control date; it is kept distinct from the internal
   * TMF package target and the Tax Team-published operational date.
   */
  earliestApplicableDeadline: string | null;
  publishedOperationalDeadline: string | null;
  tmfPackageTarget: string | null;
  publicationStatus: DeadlinePublicationStatus;
  verificationStatus: VerificationStatus;
  ruleVersionId: string;
  sourceCode: string;
  sourceLabel: string;
  adjustmentReason: string;
  explanation: string;
  unresolvedReason?: string;
};

export type ClientServiceCalendarRow = DeadlineControlRow & {
  clientId: string;
  clientName: string;
  clientProvideDate: string;
  clientApprovalDate: string;
  estimatedFilingDate: string;
  estimatedPaymentDate: string;
};

export type DeadlinePublicationOverride = {
  status: DeadlinePublicationStatus;
  publishedOperationalDeadline?: string | null;
};

export const deadlinePublicationStorageKey = "taxmonweb.prototype.deadline-publications";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const quarterlyMonths = ["January", "April", "July", "October"] as const;

const sourceLabels: Record<string, string> = {
  "BIR-EFPS-FAQ-DEADLINES": "BIR eFPS FAQ · source-backed timing pattern",
  "BIR-TAX-REMINDER-2026": "BIR Tax Reminder 2026 · row-level reconciliation required",
  "BIR-FORMS-CATALOG": "BIR Forms catalog · form identity only",
};

type RuleSeed = {
  ruleVersionId: string;
  verificationStatus: VerificationStatus;
  policy?: DeadlinePolicyVersion;
  sourceCode: string;
  adjustmentReason: string;
};

const ruleSeeds: Record<string, RuleSeed> = {
  "1702-RT": {
    ruleVersionId: "rule-version-1702-rt-fiscal-year-end-v1",
    verificationStatus: "verified",
    policy: {
      id: "deadline-policy-1702-rt-fiscal-year-end-v1",
      strategy: "fixed_day_of_month",
      effectiveFrom: "2026-01-01",
      adjustment: "none",
      parameters: { day_of_month: 15, months_after_period_end: 3 },
      verificationStatus: "verified",
      sources: [{ sourceId: "BIR-EFPS-FAQ-DEADLINES" }],
    },
    sourceCode: "BIR-EFPS-FAQ-DEADLINES",
    adjustmentReason: "No approved statutory adjustment applied in this prototype rule version.",
  },
  "2550Q": {
    ruleVersionId: "rule-version-2550q-quarter-end-v1",
    verificationStatus: "verified",
    policy: {
      id: "deadline-policy-2550q-quarter-end-v1",
      strategy: "days_after_period_end",
      effectiveFrom: "2026-01-01",
      adjustment: "none",
      parameters: { days_after_period_end: 25 },
      verificationStatus: "verified",
      sources: [{ sourceId: "BIR-EFPS-FAQ-DEADLINES" }],
    },
    sourceCode: "BIR-EFPS-FAQ-DEADLINES",
    adjustmentReason: "No approved statutory adjustment applied in this prototype rule version.",
  },
  "1601-C": {
    ruleVersionId: "rule-version-1601-c-channel-group-v1",
    verificationStatus: "unresolved",
    sourceCode: "BIR-TAX-REMINDER-2026",
    adjustmentReason: "The supplied source indicates channel/eFPS-group variation; no row-level rule is asserted here.",
  },
  "1601-EQ": {
    ruleVersionId: "rule-version-1601-eq-quarterly-v1",
    verificationStatus: "unresolved",
    sourceCode: "BIR-TAX-REMINDER-2026",
    adjustmentReason: "Requirement applicability and deadline context remain under reconciliation.",
  },
  "2551Q": {
    ruleVersionId: "rule-version-2551q-quarterly-v1",
    verificationStatus: "partially_verified",
    policy: {
      id: "deadline-policy-2551q-quarter-end-v1",
      strategy: "days_after_period_end",
      effectiveFrom: "2026-01-01",
      adjustment: "none",
      parameters: { days_after_period_end: 25 },
      verificationStatus: "partially_verified",
      sources: [{ sourceId: "BIR-TAX-REMINDER-2026" }],
    },
    sourceCode: "BIR-TAX-REMINDER-2026",
    adjustmentReason: "Published reminder evidence exists, but exact requirement context and adjustment treatment still require Tax Team review.",
  },
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function earliestApplicableDeadline(deadlines: readonly (string | null | undefined)[]) {
  return deadlines.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return formatDate(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

function rowPeriods(formNumber: string, year: number) {
  const form = forms.find((candidate) => candidate.formNumber === formNumber);
  if (!form) return [];
  if (form.usualTiming.startsWith("Annual")) {
    return [{ activityMonth: "January", activityPeriod: `FY ${year}`, taxablePeriod: `January 1–December 31, ${year}`, periodEnd: `${year}-12-31` }];
  }
  if (form.usualTiming.startsWith("Quarterly")) {
    return quarterlyMonths.map((activityMonth, index) => {
      const quarter = index + 1;
      return {
        activityMonth,
        activityPeriod: `Q${quarter} ${year}`,
        taxablePeriod: `Q${quarter} ${year}`,
        periodEnd: lastDayOfMonth(year, quarter * 3 - 1),
      };
    });
  }
  return monthNames.map((activityMonth, index) => ({
    activityMonth,
    activityPeriod: `${activityMonth} ${year}`,
    taxablePeriod: `${activityMonth} ${year}`,
    periodEnd: lastDayOfMonth(year, index),
  }));
}

// These rows are an explicit sanitized 2026 release snapshot so the prototype
// can demonstrate a client calendar. They are not a runtime auto-publication
// rule; future years begin as generated/pending review.
const prototypeReleasedFormNumbers = new Set(["1702-RT", "2550Q"]);

function candidateStatus(seed: RuleSeed, formNumber: string, year: number): DeadlinePublicationStatus {
  if (!seed.policy || seed.verificationStatus === "unresolved") return "unresolved";
  if (seed.verificationStatus !== "verified") return "needs_review";
  return year === 2026 && prototypeReleasedFormNumbers.has(formNumber) ? "published" : "generated";
}

function calculateRow(formNumber: string, year: number, period: ReturnType<typeof rowPeriods>[number]): DeadlineControlRow {
  const form = forms.find((candidate) => candidate.formNumber === formNumber);
  if (!form) throw new Error(`Unknown form ${formNumber}`);
  const seed = ruleSeeds[formNumber] ?? { ruleVersionId: `rule-version-${formNumber}-unresolved`, verificationStatus: "unresolved", sourceCode: "BIR-FORMS-CATALOG", adjustmentReason: "No approved deadline rule is mapped." } satisfies RuleSeed;
  const calculation = seed.policy ? calculateDeadline({ policy: seed.policy, periodEnd: period.periodEnd, holidayDates: new Set(), weekendDays: new Set([0, 6]) }) : null;
  const status = candidateStatus(seed, formNumber, year);
  const adjusted = calculation?.adjustedStatutoryDeadline ?? null;
  const earliest = earliestApplicableDeadline([adjusted]);
  const packageTarget = adjusted ? calculateInternalTarget(adjusted) : null;
  const requirementCode = `REQ-${formNumber}`;

  return {
    id: `${year}-${formNumber}-${period.activityPeriod.toLowerCase().replaceAll(" ", "-")}`,
    calendarYear: year,
    requirementCode,
    requirementLabel: form.title,
    formNumber,
    taxCategory: form.taxTypeCodes.join(" / ") || "Cross-category",
    cadence: form.usualTiming.startsWith("Annual") ? "Annual" : form.usualTiming.startsWith("Quarterly") ? "Quarterly" : "Monthly",
    component: "Return / filing",
    activityMonth: period.activityMonth,
    activityPeriod: period.activityPeriod,
    taxablePeriod: period.taxablePeriod,
    baseStatutoryDeadline: calculation?.baseStatutoryDeadline ?? null,
    adjustedStatutoryDeadline: adjusted,
    earliestApplicableDeadline: earliest,
    publishedOperationalDeadline: status === "published" ? adjusted : null,
    tmfPackageTarget: packageTarget,
    publicationStatus: status,
    verificationStatus: seed.verificationStatus,
    ruleVersionId: seed.ruleVersionId,
    sourceCode: seed.sourceCode,
    sourceLabel: sourceLabels[seed.sourceCode] ?? seed.sourceCode,
    adjustmentReason: seed.adjustmentReason,
    explanation: calculation?.explanation ?? "Deadline unresolved: no approved rule version is mapped for this requirement context.",
    unresolvedReason: status === "unresolved" ? "required_deadline_configuration_missing_or_unresolved" : status === "needs_review" ? "source_or_rule_context_requires_tax_team_review" : undefined,
  };
}

export function buildDeadlineControlRows(year: number, requestedFormNumbers?: readonly string[]): DeadlineControlRow[] {
  const requested = requestedFormNumbers ? new Set(requestedFormNumbers) : undefined;
  return forms
    // Global control must expose every governed return so missing rules are actionable.
    .filter((form) => requested ? requested.has(form.formNumber) : form.taxTypeCodes.length > 0)
    .flatMap((form) => rowPeriods(form.formNumber, year).map((period) => calculateRow(form.formNumber, year, period)));
}

function taxTypeMatches(formNumber: string, taxTypes: readonly string[]) {
  const normalized = taxTypes.join(" ").toLowerCase();
  if (formNumber === "1702-RT") return normalized.includes("income tax");
  if (formNumber === "2550Q") return normalized.includes("value added tax");
  if (formNumber === "1601-C" || formNumber === "1601-EQ") return normalized.includes("withholding tax");
  if (formNumber === "2551Q") return normalized.includes("percentage tax");
  return false;
}

export function clientCandidateFormNumbers(client: FixtureClient) {
  const configuredReturns = client.entities[0]?.profile.registeredReturnCodes ?? [];
  if (configuredReturns.length > 0) {
    return [...new Set(configuredReturns.flatMap((configuredReturn) => {
      const normalized = normalizeReturnSearchText(configuredReturn);
      return forms.find((form) => form.taxTypeCodes.length > 0 && normalizeReturnSearchText(form.formNumber) === normalized)?.formNumber ?? [];
    }))];
  }
  const taxTypes = client.entities[0]?.profile.registeredTaxTypes ?? [];
  return [...new Set(forms.filter((form) => form.taxTypeCodes.length > 0 && form.formNumber in ruleSeeds && taxTypeMatches(form.formNumber, taxTypes)).map((form) => form.formNumber))];
}

export function getClientServiceCalendarRows(client: FixtureClient, year: number, overrides: Readonly<Record<string, DeadlinePublicationOverride>> = {}): { rows: ClientServiceCalendarRow[]; heldRows: DeadlineControlRow[] } {
  const candidateForms = clientCandidateFormNumbers(client);
  const clientDeadlinePolicy = normalizeClientDeadlinePolicy(client.entities[0]?.profile.deadlinePolicy);
  const goLiveDate = client.entities[0]?.profile.goLiveDate;
  const goLiveYear = goLiveDate ? Number(goLiveDate.slice(0, 4)) : undefined;
  const goLiveMonth = goLiveDate ? new Date(`${goLiveDate}T00:00:00Z`).getUTCMonth() : undefined;
  const candidateRows = buildDeadlineControlRows(year, candidateForms)
    .map((row) => {
      const override = overrides[row.id];
      if (!override) return row;
      return { ...row, publicationStatus: override.status, publishedOperationalDeadline: override.status === "published" ? override.publishedOperationalDeadline ?? row.adjustedStatutoryDeadline : null };
    })
    .filter((row) => {
      if (goLiveYear === undefined || !Number.isFinite(goLiveYear) || !goLiveDate) return true;
      const effectiveDeadline = row.publishedOperationalDeadline ?? row.adjustedStatutoryDeadline;
      if (effectiveDeadline) return effectiveDeadline > goLiveDate;
      // An unresolved rule has no date to compare. Keep only periods that are
      // not definitely before go-live so the missing rule remains visible as a gate.
      return row.calendarYear > goLiveYear || (row.calendarYear === goLiveYear && (goLiveMonth === undefined || !Number.isFinite(goLiveMonth) || monthNames.indexOf(row.activityMonth as typeof monthNames[number]) >= goLiveMonth));
    });
  const rows = candidateRows.filter((row) => row.publicationStatus === "published" && row.publishedOperationalDeadline).map((row) => ({
    ...row,
    clientId: client.id,
    clientName: client.name,
    clientProvideDate: clientTimingDate(clientDeadlinePolicy, row.publishedOperationalDeadline, "clientProvideLeadDays"),
    clientApprovalDate: clientTimingDate(clientDeadlinePolicy, row.publishedOperationalDeadline, "clientApprovalLeadDays"),
    estimatedFilingDate: clientTimingDate(clientDeadlinePolicy, row.publishedOperationalDeadline, "estimatedFilingLeadDays"),
    estimatedPaymentDate: clientTimingDate(clientDeadlinePolicy, row.publishedOperationalDeadline, "estimatedPaymentLeadDays"),
    tmfPackageTarget: clientTimingDate(clientDeadlinePolicy, row.publishedOperationalDeadline, "tmfPackageLeadDays", row.tmfPackageTarget),
  }));
  return { rows, heldRows: candidateRows.filter((row) => row.publicationStatus !== "published") };
}

function clientTimingDate(policy: ClientDeadlinePolicy, publishedDate: string | null, key: keyof Omit<ClientDeadlinePolicy, "mode" | "sourceReference">, groupValue: string | null = "Follow group schedule") {
  if (!publishedDate) return "Not configured";
  const leadDays = policy[key];
  if (policy.mode === "follow_group") {
    if (key === "tmfPackageLeadDays" && groupValue && groupValue !== "Follow group schedule") return groupValue;
    return workingDaysBefore(publishedDate, defaultGroupScheduleLeadDays[key]) ?? "Not configured";
  }
  return leadDays === undefined ? "Not configured" : workingDaysBefore(publishedDate, leadDays) ?? "Not configured";
}

export function readDeadlinePublicationOverrides(storage: Storage | undefined): Record<string, DeadlinePublicationOverride> {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(deadlinePublicationStorageKey) ?? "{}") as Record<string, DeadlinePublicationOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeDeadlinePublicationOverrides(storage: Storage | undefined, overrides: Record<string, DeadlinePublicationOverride>) {
  if (!storage) return;
  storage.setItem(deadlinePublicationStorageKey, JSON.stringify(overrides));
}

export function deadlineControlSummary(rows: readonly DeadlineControlRow[]) {
  return {
    total: rows.length,
    published: rows.filter((row) => row.publicationStatus === "published").length,
    requiringReview: rows.filter((row) => row.publicationStatus === "needs_review" || row.publicationStatus === "generated" || row.publicationStatus === "confirmed").length,
    unresolved: rows.filter((row) => row.publicationStatus === "unresolved").length,
  };
}
