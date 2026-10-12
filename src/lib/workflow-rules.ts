import { fixtureClients, fixtureClock, fixtureOrgDirectoryMembers, type FixtureWorkItem } from "@/lib/fixtures";
import { workMatchesStaffPerspective } from "@/lib/domain/team";
import { towerForScopeFilter } from "@/lib/domain/organization-catalog";
import type {
  WorkflowDecision,
  WorkflowPatch,
  WorkflowPerspective,
  WorkflowProcessOwner,
  WorkflowProcessStatus,
  WorkflowQuestion,
  WorkflowRecord,
  WorkflowRole,
  StoredWorkflowRecord,
} from "@/lib/workflow-state";

export const roleQuestions: Record<WorkflowRole, readonly WorkflowQuestion[]> = {
  PREPARER: [
    { id: "correct-context", label: "Client profile, period, assigned team, and return context confirmed." },
    { id: "data-reviewed", label: "Prior returns, TB, GL, schedules, listings, and supporting documents received or limitations recorded." },
    { id: "mapping-complete", label: "Transaction listing, supplier status, nature of payment, and applicable tax code mapping completed." },
    { id: "documents-vouched", label: "Vouching and documentary support checked for the relevant transactions." },
    { id: "reconciled", label: "Books, schedules, expense analysis, and return reconciled; differences explained." },
    { id: "working-paper-agrees", label: "Alphalist/QAP, working papers, and prepared return agree, including relevant prior-period or amendment context." },
    { id: "self-check-complete", label: "Completeness and accuracy self-check completed; filing and archiving convention followed." },
    { id: "issues-recorded", label: "Exceptions, assumptions, and review notes recorded." },
  ],
  CHECKER: [
    { id: "preparation-traceable", label: "Preparation is complete and traceable to the source work." },
    { id: "source-supports-return", label: "Books, AP/EWT schedules, listings, and supporting documents support the return." },
    { id: "mapping-reasonable", label: "Transaction testing, rates, tax codes, supplier status, and documentary support are reasonable." },
    { id: "vouching-sufficient", label: "Vouching and documentary requirements are sufficient for the work performed." },
    { id: "tie-outs-satisfactory", label: "Books-to-schedule, expense-to-return, and return-to-books tie-outs are satisfactory." },
    { id: "exceptions-documented", label: "Differences, exceptions, and review notes are resolved or properly documented." },
    { id: "tax-due-recorded", label: "Tax due amount is recorded from the approved return or working papers, including a documented zero amount where applicable." },
    { id: "ready-for-review", label: "Return, QAP/alphalist, and working papers agree and are ready for Reviewer." },
  ],
  REVIEWER: [
    { id: "independent-review", label: "Independent review completed." },
    { id: "material-items-considered", label: "Material accuracy, completeness, and reconciliations considered." },
    { id: "judgments-addressed", label: "Significant judgments, unusual items, and tax-risk questions addressed." },
    { id: "risks-documented", label: "Exceptions, assumptions, and review notes are properly documented." },
    { id: "client-output-complete", label: "Client-facing output and approval request are complete." },
    { id: "ready-for-client", label: "Work is ready for client approval." },
  ],
};

export const roleLabels: Record<WorkflowRole, string> = { PREPARER: "Preparer", CHECKER: "Checker", REVIEWER: "Reviewer" };
const processOwnerLabels: Record<WorkflowProcessOwner, string> = { ...roleLabels, TAX_CONTROL: "Tax Control" };

export function isValidTaxDueAmount(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

export function workflowProcessRole(stepId: string): WorkflowProcessOwner {
  if (stepId === "check") return "CHECKER";
  if (stepId === "review") return "REVIEWER";
  return "PREPARER";
}

export function workflowProcessRoleLabel(role: WorkflowProcessOwner): string {
  return processOwnerLabels[role];
}

export const paymentProcessStepIds = new Set(["payment", "payment-client-approval", "payment-confirmation"]);

export function orderedProcessStatuses(work: FixtureWorkItem, statuses: Readonly<Record<string, WorkflowProcessStatus>>): Record<string, WorkflowProcessStatus> {
  const projected: Record<string, WorkflowProcessStatus> = {};
  if (work.blocker?.category === "CLIENT DATA") {
    for (const step of work.steps) projected[step.id] = paymentProcessStepIds.has(step.id) && work.paymentApplicability === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "NOT_STARTED";
    return projected;
  }
  let priorStepsComplete = true;
  for (const step of work.steps) {
    const paymentNotApplicable = paymentProcessStepIds.has(step.id) && work.paymentApplicability === "NOT_APPLICABLE";
    const status = paymentNotApplicable ? "NOT_APPLICABLE" : statuses[step.id] ?? "NOT_STARTED";
    projected[step.id] = priorStepsComplete ? status : "NOT_STARTED";
    priorStepsComplete = projected[step.id] === "DONE" || projected[step.id] === "NOT_APPLICABLE";
  }
  return projected;
}

export function initialProcessStatuses(work: FixtureWorkItem): Readonly<Record<string, WorkflowProcessStatus>> {
  const statuses: Record<string, WorkflowProcessStatus> = {};
  for (const step of work.steps) {
    statuses[step.id] = step.state === "complete"
      ? "DONE"
      : paymentProcessStepIds.has(step.id) && work.paymentApplicability === "NOT_APPLICABLE"
        ? "NOT_APPLICABLE"
        : "NOT_STARTED";
  }

  const orderedStatuses = orderedProcessStatuses(work, statuses);
  const firstIncomplete = work.steps.find((step) => orderedStatuses[step.id] === "NOT_STARTED");
  if (firstIncomplete) orderedStatuses[firstIncomplete.id] = "IN_PROGRESS";
  return orderedStatuses;
}

export function initialGate(work: FixtureWorkItem): WorkflowRole | null {
  const currentStep = work.steps.find((step) => step.state === "current");
  if (currentStep?.id === "check") return "CHECKER";
  if (currentStep?.id === "review") return "REVIEWER";
  if (currentStep?.id === "prepare") return "PREPARER";
  return null;
}

export function initialRecord(work: FixtureWorkItem): WorkflowRecord {
  return { currentGate: initialGate(work), attempts: [], checklistAnswers: {}, checklistHistory: [], processStatuses: initialProcessStatuses(work), processHistory: [], changeHistory: [], periodLock: { locked: false }, periodLockHistory: [] };
}

export function recordForWork(work: FixtureWorkItem, stored?: StoredWorkflowRecord): StoredWorkflowRecord {
  const seed = initialRecord(work);
  const persisted = stored ?? (work.workflowSnapshot ? { ...work.workflowSnapshot, patch: {} } : undefined);
  if (!persisted) return { ...seed, patch: {} };
  const processHistory = Array.isArray(persisted.processHistory) ? persisted.processHistory : [];
  const recordedStepIds = new Set(processHistory.map((update) => update.stepId));
  const processStatuses = { ...seed.processStatuses, ...(persisted.processStatuses ?? {}) };
  for (const step of work.steps) {
    if (!recordedStepIds.has(step.id)) processStatuses[step.id] = seed.processStatuses[step.id];
  }
  const orderedStatuses = orderedProcessStatuses(work, processStatuses);
  const firstIncomplete = work.steps.find((step) => orderedStatuses[step.id] === "NOT_STARTED");
  if (firstIncomplete && !Object.values(orderedStatuses).some((status) => status === "IN_PROGRESS" || status === "NEEDS_ATTENTION")) orderedStatuses[firstIncomplete.id] = "IN_PROGRESS";
  return { ...persisted, processStatuses: orderedStatuses, processHistory, checklistAnswers: persisted.checklistAnswers ?? seed.checklistAnswers, checklistHistory: persisted.checklistHistory ?? seed.checklistHistory, changeHistory: persisted.changeHistory ?? seed.changeHistory, periodLock: persisted.periodLock ?? seed.periodLock, periodLockHistory: persisted.periodLockHistory ?? seed.periodLockHistory };
}

export function stageForProcessStep(stepId: string): FixtureWorkItem["stage"] {
  if (stepId === "prepare") return "PREPARE";
  if (stepId === "check" || stepId === "review") return "REVIEW";
  if (stepId === "client-approval") return "CLIENT";
  if (["filing", "esubmission", "payment", "payment-client-approval", "payment-confirmation"].includes(stepId)) return "FILE";
  return "POST-FILING";
}

export function nextApplicableProcessStep(work: FixtureWorkItem, currentIndex: number, processStatuses: Readonly<Record<string, WorkflowProcessStatus>>) {
  return work.steps.slice(currentIndex + 1).find((step) => {
    if (work.paymentApplicability === "NOT_APPLICABLE" && paymentProcessStepIds.has(step.id)) return false;
    const status = processStatuses[step.id];
    return status !== "DONE" && status !== "NOT_APPLICABLE";
  });
}

export function actionForProcessStep(stepId: string, status: WorkflowProcessStatus): string | undefined {
  const labels: Record<string, string> = { prepare: "preparation", check: "checking", review: "review", "client-approval": "client approval", filing: "filing", esubmission: "attachments", payment: "payment endorsement", "payment-client-approval": "payment client approval", "payment-confirmation": "payment confirmation", evidence: "archiving" };
  const label = labels[stepId];
  if (!label) return undefined;
  if (status === "DONE") return stepId === "client-approval" ? "File the approved return" : `Continue with the next ${label} control`;
  if (status === "NEEDS_ATTENTION") return `Resolve the ${label} attention item`;
  if (status === "NOT_APPLICABLE") return "Continue with the next applicable process step";
  return status === "IN_PROGRESS" ? `Complete ${label}` : `Start ${label}`;
}

export function workflowTimestamp(sequence: number) {
  const base = Date.parse(`${fixtureClock.today}T09:00:00+08:00`);
  const value = new Date(base + Math.max(0, sequence) * 60_000);
  return `${new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(value)} (Asia/Manila)`;
}

export function workMatchesPerspective(work: FixtureWorkItem, perspective: WorkflowPerspective): boolean {
  if (perspective === "MASTER_ADMIN" || perspective === "TAX_CONTROL" || perspective === "SUPER_ADMIN") return true;
  if (perspective === "TOWER_LEADER") return work.scope === towerForScopeFilter("tower-b");
  if (perspective === "CLUSTER_LEADER") return work.scope === towerForScopeFilter("tower-c");
  if (perspective === "SYSTEM_ADMIN") return false;
  return workMatchesStaffPerspective(work, perspective, fixtureClients, fixtureOrgDirectoryMembers);
}

export function transition(role: WorkflowRole, decision: WorkflowDecision, note: string): { currentGate: WorkflowRole | null; patch: WorkflowPatch } {
  if (decision === "RETURN") return { currentGate: "PREPARER", patch: { stage: "PREPARE", status: "AMBER", statusReason: `${roleLabels[role]} returned this work for correction.`, nextAction: "Address the returned correction notes", returnedFrom: roleLabels[role], blocker: { category: "INTERNAL", reason: note } } };
  if (role === "PREPARER") return { currentGate: "CHECKER", patch: { stage: "REVIEW", statusReason: "Preparer certification recorded; independent checking is now required.", nextAction: "Complete Checker review", returnedFrom: undefined, blocker: null } };
  if (role === "CHECKER") return { currentGate: "REVIEWER", patch: { stage: "REVIEW", statusReason: "Checker approval recorded; independent Reviewer review is now required.", nextAction: "Complete Reviewer review", blocker: null } };
  return { currentGate: null, patch: { stage: "CLIENT", statusReason: "Reviewer approval recorded; client approval is now required.", nextAction: "Send return to client for approval", blocker: null } };
}

export function applyWorkflowStepState(work: FixtureWorkItem, currentGate: WorkflowRole | null, stage: FixtureWorkItem["stage"], processStatuses?: Readonly<Record<string, WorkflowProcessStatus>>): FixtureWorkItem["steps"] {
  const activeProcessStep = processStatuses && work.steps.find((step) => paymentProcessStepIds.has(step.id) && work.paymentApplicability === "NOT_APPLICABLE" ? false : processStatuses[step.id] === "IN_PROGRESS" || processStatuses[step.id] === "NEEDS_ATTENTION");
  const firstIncomplete = processStatuses && work.steps.find((step) => {
    if (work.paymentApplicability === "NOT_APPLICABLE" && paymentProcessStepIds.has(step.id)) return false;
    const status = processStatuses[step.id];
    return status !== "DONE" && status !== "NOT_APPLICABLE";
  });
  const currentStepId = activeProcessStep?.id ?? firstIncomplete?.id ?? (currentGate === "PREPARER" ? "prepare" : currentGate === "CHECKER" ? "check" : currentGate === "REVIEWER" ? "review" : stage === "CLIENT" ? "client-approval" : stage === "FILE" ? "filing" : stage === "POST-FILING" ? "evidence" : null);
  const completeBefore = currentStepId === "check" ? new Set(["prepare"]) : currentStepId === "review" ? new Set(["prepare", "check"]) : currentStepId === "client-approval" ? new Set(["prepare", "check", "review"]) : new Set<string>();
  return work.steps.map((step) => {
    const processStatus = processStatuses?.[step.id];
    const notApplicable = paymentProcessStepIds.has(step.id) && work.paymentApplicability === "NOT_APPLICABLE";
    const state = notApplicable || processStatus === "DONE" || processStatus === "NOT_APPLICABLE" ? "complete" : processStatus === "NEEDS_ATTENTION" ? "unresolved" : step.state === "blocked" && step.id === currentStepId ? "blocked" : step.id === currentStepId ? "current" : processStatus === "IN_PROGRESS" ? "current" : processStatuses ? "not-started" : completeBefore.has(step.id) ? "complete" : "not-started";
    return { ...step, state };
  });
}
