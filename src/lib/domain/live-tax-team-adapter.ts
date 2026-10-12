import type { FixtureWorkItem } from "@/lib/fixtures";
import type { TaxTeamReportRow } from "./tax-team-reports";
import { deriveWorkReturnOutcome, taxTeamStatusFromOutcome } from "./work-outcome";
import type { WorkflowRecord } from "@/lib/workflow-state";

function componentState(work: FixtureWorkItem, label: "Submission" | "Payment" | "Attachments" | "Evidence") {
  return work.components.find((component) => component.label === label)?.state ?? "Unknown";
}

function workflowRecordFor(work: FixtureWorkItem): WorkflowRecord | null {
  const snapshot = work.workflowSnapshot;
  if (!snapshot) return null;
  return {
    currentGate: snapshot.currentGate,
    attempts: snapshot.attempts,
    checklistAnswers: snapshot.checklistAnswers,
    checklistHistory: snapshot.checklistHistory,
    processStatuses: snapshot.processStatuses,
    processHistory: snapshot.processHistory,
    changeHistory: snapshot.changeHistory,
    periodLock: snapshot.periodLock,
    periodLockHistory: snapshot.periodLockHistory,
    ...(snapshot.finalCertification ? { finalCertification: snapshot.finalCertification } : {}),
  };
}

export function liveWorkToTaxTeamReportRow(work: FixtureWorkItem): TaxTeamReportRow {
  const filingStep = work.steps.find((step) => step.id === "filing");
  const filing = filingStep?.state === "complete" ? "Reported sent" : filingStep?.state === "not-started" ? "Not reached" : "Unknown";
  const evidence = componentState(work, "Evidence");
  const payment = componentState(work, "Payment");
  const attachments = componentState(work, "Attachments");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(work.deadline) ? work.deadline : "1970-01-01";
  const workflowRecord = workflowRecordFor(work);
  const monthlyStatus = workflowRecord ? taxTeamStatusFromOutcome(deriveWorkReturnOutcome(work, workflowRecord, new Date().toISOString().slice(0, 10))) : "unresolved";
  return {
    id: work.id,
    date,
    dateLabel: work.deadline,
    period: work.period,
    client: work.client,
    entity: work.entity,
    registrationUnit: work.registrationUnit,
    requirement: work.title,
    tower: work.scope,
    cluster: work.cluster ?? "Unresolved",
    owner: work.owner,
    status: work.status,
    monthlyStatus,
    lifecycle: work.stage,
    filing,
    acceptance: filing === "Reported sent" ? "Not verified" : "Not reached",
    payment,
    attachments,
    evidence,
    control: /verified|complete/i.test(evidence) ? "Complete" : "Incomplete",
    qa: "Not configured",
    qaStatus: "not_configured",
    supportCheck: "not_configured",
    qaFinding: "No approved independent QA result is present.",
    rca: "Not configured",
    rcaStatus: "not_configured",
    attention: work.blocker?.reason ?? work.statusReason,
  };
}
