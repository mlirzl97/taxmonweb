import type { FixtureWorkItem } from "@/lib/fixtures";
import type { WorkflowProcessStatus, WorkflowRecord } from "@/lib/workflow-state";

export type WorkOutcomeState = "on_time" | "late" | "not_due" | "not_started" | "in_progress" | "needs_attention" | "not_applicable" | "unverified";
export type WorkOutcomeComponent = { state: WorkOutcomeState; processStatus: WorkflowProcessStatus; actualDate: string | null; deadline: string | null; evidenceReference: string | null };
export type WorkReturnOutcome = { filing: WorkOutcomeComponent; payment: WorkOutcomeComponent; attachments: WorkOutcomeComponent; overall: WorkOutcomeState };

const componentStepIds = { filing: "filing", payment: "payment-confirmation", attachments: "esubmission" } as const;
const componentLabels = { filing: "Submission", payment: "Payment", attachments: "Attachments" } as const;

function validDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()));
}

function latestProcessUpdate(record: WorkflowRecord, stepId: string) {
  return [...record.processHistory].reverse().find((update) => update.stepId === stepId);
}

function deadlineFor(work: FixtureWorkItem, label: string) {
  // Fallback: current fixture work exposes one governed operational target; live component deadlines take precedence.
  return work.components.find((component) => component.label === label)?.deadline ?? work.dueDate ?? null;
}

function componentOutcome(work: FixtureWorkItem, record: WorkflowRecord, kind: keyof typeof componentStepIds, today: string): WorkOutcomeComponent {
  const stepId = componentStepIds[kind];
  const processStatus = record.processStatuses[stepId] ?? "NOT_STARTED";
  const update = latestProcessUpdate(record, stepId);
  const actualDate = update?.completedOn ?? null;
  const deadline = deadlineFor(work, componentLabels[kind]);
  if (processStatus === "NOT_APPLICABLE") return { state: "not_applicable", processStatus, actualDate, deadline, evidenceReference: update?.evidenceReference ?? null };
  if (processStatus === "NEEDS_ATTENTION") return { state: "needs_attention", processStatus, actualDate, deadline, evidenceReference: update?.evidenceReference ?? null };
  if (processStatus === "NOT_STARTED") return { state: validDate(deadline) && deadline > today ? "not_due" : "not_started", processStatus, actualDate, deadline, evidenceReference: update?.evidenceReference ?? null };
  if (processStatus === "IN_PROGRESS") return { state: "in_progress", processStatus, actualDate, deadline, evidenceReference: update?.evidenceReference ?? null };
  if (processStatus !== "DONE" || !validDate(actualDate) || !validDate(deadline)) return { state: "unverified", processStatus, actualDate, deadline, evidenceReference: update?.evidenceReference ?? null };
  return { state: actualDate <= deadline ? "on_time" : "late", processStatus, actualDate, deadline, evidenceReference: update?.evidenceReference ?? null };
}

export function deriveWorkReturnOutcome(work: FixtureWorkItem, record: WorkflowRecord, today: string): WorkReturnOutcome {
  const filing = componentOutcome(work, record, "filing", today);
  const payment = work.paymentApplicability === "NOT_APPLICABLE" ? { ...componentOutcome(work, record, "payment", today), state: "not_applicable" as const, processStatus: "NOT_APPLICABLE" as const } : componentOutcome(work, record, "payment", today);
  const attachments = componentOutcome(work, record, "attachments", today);
  const components = [filing, payment, attachments];
  const overall: WorkOutcomeState = components.some((component) => component.state === "needs_attention") ? "needs_attention"
    : components.some((component) => component.state === "late") ? "late"
      : components.some((component) => component.state === "unverified") ? "unverified"
        : components.every((component) => component.state === "on_time" || component.state === "not_applicable") ? "on_time"
          : components.some((component) => component.state === "in_progress") ? "in_progress"
            : components.every((component) => component.state === "not_due" || component.state === "not_started") ? "not_due"
              : "not_started";
  return { filing, payment, attachments, overall };
}

export function taxTeamStatusFromOutcome(outcome: WorkReturnOutcome) {
  if (outcome.overall === "on_time") return "filed_paid_on_time" as const;
  if (outcome.overall === "late") return "filed_paid_beyond_deadline" as const;
  if (outcome.overall === "not_due") return "prepared_not_yet_due" as const;
  return "unresolved" as const;
}
