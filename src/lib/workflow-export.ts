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
  const headers = ["work_id", "client", "return", "period", "registration_unit", "work_status", "step", "status", "evidence_reference", "completion_date", "acknowledged_date", "validated_date", "attachment_name", "sharepoint_url", "recorded_by", "recorded_at", "amount_to_pay"];
  const rows: unknown[][] = [];
  for (const { work, record } of returns) {
    const evidence = record.processHistory.filter((update) => update.evidenceReference || update.completedOn || update.acknowledgedOn || update.validatedOn || update.attachmentName);
    if (evidence.length === 0) rows.push([...returnFields(work), "", "", "", "", "", "", "", "", "", work.paymentAmount ?? ""]);
    for (const update of evidence) {
      rows.push([...returnFields(work), update.stepId, update.status, update.evidenceReference ?? "", update.completedOn ?? "", update.acknowledgedOn ?? "", update.validatedOn ?? "", update.attachmentName ?? "", update.sharepointUrl ?? "", update.actor, update.recordedAt, work.paymentAmount ?? ""]);
    }
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
