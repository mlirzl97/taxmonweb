import { fixtureClients, fixtureClock, type FixtureStatus } from "@/lib/fixtures";
import type { FixtureTower } from "@/lib/domain/organization-catalog";
import { getFixtureWorkRegisterRecords, dateValue } from "@/lib/fixtures-read-model";

export type TaxTeamReportType = "monthly" | "qa" | "rca" | "audit";
export type TaxTeamDateBasis = "milestone" | "compliance_period";
export type TaxTeamGroupBy = "tower" | "cluster" | "owner" | "client" | "requirement";
export type TaxTeamScope = "all" | FixtureTower;
export type TaxTeamQAStatus = "not_configured" | "not_started" | "in_progress" | "passed" | "failed";
export type TaxTeamTransactionReviewStatus = "awaiting_review" | "in_review" | "certified" | "follow_up";
export type TaxTeamRCAStatus = "not_configured" | "no_case_required" | "candidate" | "open" | "closed";
export type TaxTeamMonthlyStatus =
  | "filed_paid_on_time"
  | "filed_paid_beyond_deadline"
  | "not_applicable"
  | "filed_paid_co_hrp"
  | "filed_paid_co_client"
  | "prepared_not_yet_due"
  | "unresolved";

export const taxTeamMonthlyStatusLabels: Record<TaxTeamMonthlyStatus, string> = {
  filed_paid_on_time: "Filed and paid on time",
  filed_paid_beyond_deadline: "Filed and paid beyond the deadline",
  not_applicable: "Not applicable",
  filed_paid_co_hrp: "Filed and paid c/o HRP",
  filed_paid_co_client: "Filed and paid c/o client",
  prepared_not_yet_due: "Prepared but not yet due",
  unresolved: "Status not evidenced",
};

export const taxTeamMonthlyStatusOptions: readonly { id: TaxTeamMonthlyStatus; label: string; description: string }[] = [
  { id: "filed_paid_on_time", label: taxTeamMonthlyStatusLabels.filed_paid_on_time, description: "Both filing and payment are evidenced on or before the governed deadline." },
  { id: "filed_paid_beyond_deadline", label: taxTeamMonthlyStatusLabels.filed_paid_beyond_deadline, description: "Both filing and payment are evidenced after the governed deadline." },
  { id: "not_applicable", label: taxTeamMonthlyStatusLabels.not_applicable, description: "The approved compliance setup says filing and payment do not apply." },
  { id: "filed_paid_co_hrp", label: taxTeamMonthlyStatusLabels.filed_paid_co_hrp, description: "Filing and payment were evidenced as handled by HRP for an applicable 1601C item." },
  { id: "filed_paid_co_client", label: taxTeamMonthlyStatusLabels.filed_paid_co_client, description: "Filing and payment were evidenced as handled by the client." },
  { id: "prepared_not_yet_due", label: taxTeamMonthlyStatusLabels.prepared_not_yet_due, description: "Preparation is evidenced and the governed deadline has not yet passed." },
  { id: "unresolved", label: taxTeamMonthlyStatusLabels.unresolved, description: "Required approved filing, payment, or deadline facts are not available." },
];

export const taxTeamQAStatusLabels: Record<TaxTeamQAStatus, string> = {
  not_configured: "Not configured",
  not_started: "Not started",
  in_progress: "In progress",
  passed: "Passed",
  failed: "Finding recorded",
};

export const taxTeamTransactionReviewStatusLabels: Record<TaxTeamTransactionReviewStatus, string> = {
  awaiting_review: "Awaiting review",
  in_review: "In review",
  certified: "Certified",
  follow_up: "Follow-up required",
};

export const taxTeamRCAStatusLabels: Record<TaxTeamRCAStatus, string> = {
  not_configured: "Not configured",
  no_case_required: "No RCA case required",
  candidate: "RCA candidate",
  open: "RCA open",
  closed: "RCA closed",
};

export type TaxTeamReportRow = {
  id: string;
  date: string;
  dateLabel: string;
  period: string;
  client: string;
  entity: string;
  registrationUnit: string;
  requirement: string;
  tower: string;
  cluster: string;
  owner: string;
  status: FixtureStatus;
  monthlyStatus: TaxTeamMonthlyStatus;
  lifecycle: string;
  filing: string;
  acceptance: string;
  payment: string;
  evidence: string;
  control: string;
  qa: string;
  qaStatus: TaxTeamQAStatus;
  supportCheck: TaxTeamQAStatus;
  qaFinding: string;
  rca: string;
  rcaStatus: TaxTeamRCAStatus;
  attention: string;
};

export type TaxTeamTransactionReview = {
  id: string;
  date: string;
  client: string;
  requirement: string;
  period: string;
  tower: string;
  cluster: string;
  source: string;
  recordsPulled: number;
  reviewStatus: TaxTeamTransactionReviewStatus;
  completenessChecked: boolean;
  awarenessChecked: boolean;
  certifiedBy?: string;
  certifiedAt?: string;
};

export type TaxTeamReportFilters = {
  reportType: TaxTeamReportType;
  from: string;
  to: string;
  dateBasis: TaxTeamDateBasis;
  scope: TaxTeamScope;
  groupBy: TaxTeamGroupBy;
};

export const taxTeamReportTypes: readonly { id: TaxTeamReportType; label: string; description: string }[] = [
  { id: "monthly", label: "Monthly compliance", description: "Expected work and recorded control position for the selected window." },
  { id: "qa", label: "QA", description: "Review pulled transactions for completeness and record awareness." },
  { id: "rca", label: "RCA", description: "Exception-driven root-cause tracking for material or repeated control failures." },
  { id: "audit", label: "Audit detail", description: "Traceable obligation context, control facts, and historical accountability." },
];

export const taxTeamDateBasisOptions: readonly { id: TaxTeamDateBasis; label: string; description: string }[] = [
  { id: "milestone", label: "Calendar / control date", description: "Uses the governed fixture calendar milestone date." },
  { id: "compliance_period", label: "Compliance period", description: "Uses the stated compliance period where it is available." },
];

export const taxTeamGroupOptions: readonly { id: TaxTeamGroupBy; label: string }[] = [
  { id: "tower", label: "Tower" },
  { id: "cluster", label: "Cluster" },
  { id: "owner", label: "Person / owner" },
  { id: "client", label: "Client" },
  { id: "requirement", label: "Requirement" },
];

const lifecycleLabels: Record<string, string> = {
  PREPARE: "Preparation",
  REVIEW: "Checking",
  CLIENT: "Client approval",
  FILE: "Filing / submission",
  "POST-FILING": "Evidence / post-filing",
};

function componentState(work: ReturnType<typeof getFixtureWorkRegisterRecords>[number]["work"], label: "Submission" | "Payment" | "Evidence") {
  return work.components.find((component) => component.label === label)?.state ?? "Unknown";
}

function filingState(work: ReturnType<typeof getFixtureWorkRegisterRecords>[number]["work"]) {
  const filingStep = work.steps.find((step) => step.id === "filing");
  return filingStep?.state === "complete" ? "Reported sent" : filingStep?.state === "not-started" ? "Not reached" : "Unknown";
}

function acceptanceState(work: ReturnType<typeof getFixtureWorkRegisterRecords>[number]["work"]) {
  return filingState(work) === "Reported sent" ? "Not verified" : "Not reached";
}

function clusterForClient(clientId: string) {
  return fixtureClients.find((client) => client.id === clientId)?.assignment.cluster ?? "Unresolved";
}

export function getTaxTeamReportRows(): TaxTeamReportRow[] {
  return getFixtureWorkRegisterRecords().map(({ work, calendar }) => {
    const evidence = componentState(work, "Evidence");
    const payment = componentState(work, "Payment");
    const filing = filingState(work);
    return {
      id: work.id,
      date: calendar.calendarDate,
      dateLabel: calendar.date,
      period: work.period,
      client: work.client,
      entity: work.entity,
      registrationUnit: work.registrationUnit,
      requirement: calendar.returnLabel,
      tower: work.scope,
      cluster: clusterForClient(work.clientId),
      owner: work.owner,
      status: work.status,
      // The current sanitized fixture has no approved filing-date, payment-date,
      // and governed deadline triplet, so the monthly report category must remain
      // visibly unresolved instead of manufacturing one of the operational labels.
      monthlyStatus: "unresolved",
      lifecycle: lifecycleLabels[work.stage] ?? work.stage,
      filing,
      acceptance: acceptanceState(work),
      payment,
      evidence,
      control: /verified|complete/i.test(evidence) ? "Complete" : "Incomplete",
      qa: "Not configured",
      qaStatus: "not_configured",
      supportCheck: "not_configured",
      qaFinding: "No approved independent QA result is present in this fixture.",
      rca: "Not configured",
      rcaStatus: "not_configured",
      attention: work.blocker?.reason ?? work.statusReason,
    };
  });
}

export function getTaxTeamTransactionReviews(): TaxTeamTransactionReview[] {
  const recordCounts = [128, 84, 56, 143];
  return getTaxTeamReportRows().map((row, index) => ({
    id: `transaction-review-${row.id}`,
    date: row.date,
    client: row.client,
    requirement: row.requirement,
    period: row.period,
    tower: row.tower,
    cluster: row.cluster,
    source: "Transaction pull",
    recordsPulled: recordCounts[index] ?? 0,
    reviewStatus: "awaiting_review",
    completenessChecked: false,
    awarenessChecked: false,
  }));
}

function compliancePeriodDate(period: string): number | null {
  const match = period.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  if (!match) return null;
  const month = new Date(`${match[1]} 1, ${match[2]}`).getTime();
  return Number.isNaN(month) ? null : month;
}

function rowDate(row: TaxTeamReportRow, basis: TaxTeamDateBasis): number | null {
  return basis === "milestone" ? dateValue(row.date) : compliancePeriodDate(row.period);
}

export function filterTaxTeamReportRows(rows: readonly TaxTeamReportRow[], filters: Pick<TaxTeamReportFilters, "from" | "to" | "dateBasis" | "scope">): TaxTeamReportRow[] {
  const from = dateValue(filters.from);
  const to = dateValue(filters.to);
  return rows.filter((row) => {
    const date = rowDate(row, filters.dateBasis);
    if (date === null || date < from || date > to) return false;
    return filters.scope === "all" || row.tower === filters.scope;
  });
}

export function filterTaxTeamTransactionReviews(reviews: readonly TaxTeamTransactionReview[], filters: Pick<TaxTeamReportFilters, "from" | "to" | "scope">): TaxTeamTransactionReview[] {
  const from = dateValue(filters.from);
  const to = dateValue(filters.to);
  return reviews.filter((review) => {
    const date = dateValue(review.date);
    return date >= from && date <= to && (filters.scope === "all" || review.tower === filters.scope);
  });
}

export function reportGroupValue(row: TaxTeamReportRow, groupBy: TaxTeamGroupBy): string {
  return row[groupBy === "owner" ? "owner" : groupBy];
}

export type TaxTeamReportSummary = {
  expected: number;
  generated: number;
  reportedSent: number;
  accepted: number;
  paid: number;
  controlComplete: number;
  openAttention: number;
  unresolved: number;
};

export function summarizeTaxTeamReport(rows: readonly TaxTeamReportRow[]): TaxTeamReportSummary {
  return {
    expected: rows.length,
    generated: rows.length,
    reportedSent: rows.filter((row) => row.filing === "Reported sent").length,
    accepted: rows.filter((row) => row.acceptance === "Accepted").length,
    paid: rows.filter((row) => /paid|confirmed/i.test(row.payment)).length,
    controlComplete: rows.filter((row) => row.control === "Complete").length,
    openAttention: rows.filter((row) => row.status === "AMBER" || row.status === "RED").length,
    unresolved: rows.filter((row) => row.monthlyStatus === "unresolved").length,
  };
}

export function formatReportDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export const defaultTaxTeamReportFilters: TaxTeamReportFilters = {
  reportType: "monthly",
  from: `${fixtureClock.year}-${String(fixtureClock.month + 1).padStart(2, "0")}-01`,
  to: `${fixtureClock.year}-${String(fixtureClock.month + 1).padStart(2, "0")}-31`,
  dateBasis: "milestone",
  scope: "all",
  groupBy: "tower",
};
