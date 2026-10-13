import type { FixtureWorkItem } from "@/lib/fixtures/types";
import type { WorkflowRecord } from "@/lib/workflow-state";

type ExportReturn = { work: FixtureWorkItem; record: WorkflowRecord };

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

function returnFields(work: FixtureWorkItem) {
  return [work.id, work.client, work.requirementCode ?? work.title, work.period, work.registrationUnit, work.status];
}

export function buildWorkflowFactsCsv(returns: readonly ExportReturn[]) {
  const headers = ["work_id", "client", "return", "period", "registration_unit", "work_status", "filing_date", "filing_reference_number", "amount_to_pay", "proceed_to_pay", "payment_acknowledgement_date", "payment_acknowledgement", "esubmission_submission", "esubmission_submission_date", "date_acknowledged_by_bir", "date_validated_by_bir", "attachment_evidence_name", "sharepoint_url"];
  const rows: unknown[][] = [];
  for (const { work, record } of returns) {
    const latest = (stepId: string) => [...record.processHistory].reverse().find((update) => update.stepId === stepId && update.evidenceReference);
    const facts = record.archiveFacts ?? {};
    const filing = latest("filing");
    const paymentApproval = latest("payment-client-approval") ?? latest("payment");
    const paymentConfirmation = latest("payment-confirmation");
    const esubmission = latest("esubmission");
    const archive = latest("evidence");
    const paymentNotApplicable = work.paymentApplicability === "NOT_APPLICABLE";
    rows.push([
      ...returnFields(work),
      facts.filingDate ?? filing?.completedOn ?? "",
      facts.filingReferenceNumber ?? filing?.evidenceReference ?? "",
      paymentNotApplicable ? "Not applicable" : work.paymentAmount ?? "",
      paymentNotApplicable ? "Not applicable" : facts.proceedToPay ?? paymentApproval?.evidenceReference ?? "",
      paymentNotApplicable ? "Not applicable" : facts.paymentAcknowledgementDate ?? paymentConfirmation?.completedOn ?? "",
      paymentNotApplicable ? "Not applicable" : facts.paymentAcknowledgement ?? paymentConfirmation?.evidenceReference ?? "",
      facts.eSubmissionSubmission ?? esubmission?.evidenceReference ?? "",
      facts.eSubmissionSubmissionDate ?? esubmission?.completedOn ?? "",
      facts.birAcknowledgedDate ?? esubmission?.acknowledgedOn ?? "",
      facts.birValidatedDate ?? esubmission?.validatedOn ?? "",
      facts.attachmentName ?? archive?.attachmentName ?? "",
      archive?.sharepointUrl ?? "",
    ]);
  }
  return csv(headers, rows);
}

export function buildWorkflowProcessingLogCsv(returns: readonly ExportReturn[]) {
  const headers = ["work_id", "client", "return", "period", "log_type", "step_or_role", "action", "detail", "actor", "recorded_at"];
  const rows: unknown[][] = [];
  for (const { work, record } of returns) {
    for (const event of record.processHistory) rows.push([...returnFields(work).slice(0, 4), "process", event.stepId, event.status, event.evidenceReference ?? "", event.actor, event.recordedAt]);
    for (const event of record.checklistHistory) rows.push([...returnFields(work).slice(0, 4), "checklist", event.role, event.completed ? "completed" : "reopened", event.questionId, event.actor, event.recordedAt]);
    for (const event of record.attempts) rows.push([...returnFields(work).slice(0, 4), "gate", event.role, event.decision, event.note, event.actor, event.recordedAt]);
    for (const event of record.changeHistory) rows.push([...returnFields(work).slice(0, 4), "payment profile", event.kind, "recorded", event.detail, event.actor, event.recordedAt]);
    for (const event of record.periodLockHistory) rows.push([...returnFields(work).slice(0, 4), "period lock", "period", event.locked ? "locked" : "reopened", event.reason ?? "", event.actor ?? "", event.recordedAt ?? ""]);
    if (record.finalCertification) rows.push([...returnFields(work).slice(0, 4), "final certification", "reviewer closure", "certified", record.finalCertification.note, record.finalCertification.actor, record.finalCertification.recordedAt]);
  }
  return csv(headers, rows);
}
