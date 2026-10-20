import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import type { FixtureWorkItem } from "@/lib/fixtures/types";
import type { WorkflowRecord } from "@/lib/workflow-state";

export type WorkflowReportStage = {
  bundle: string;
  label: string;
  owner: string;
  stepId?: string;
  status: string;
  evidenceReference?: string;
  completedOn?: string;
  acknowledgedOn?: string;
  validatedOn?: string;
  attachmentName?: string;
  recordedBy?: string;
  recordedAt?: string;
};

export type WorkflowReportInput = {
  work: FixtureWorkItem;
  record: WorkflowRecord;
  clientName: string;
  tinLabel: string;
  rdoLabel: string;
  returnLabel: string;
  periodLabel: string;
  dueDateLabel: string;
  stages: readonly WorkflowReportStage[];
  roles: readonly { label: string; person: string }[];
  paymentAmountLabel: string | null;
};

export function workflowClientApprovalDates(record: Pick<WorkflowRecord, "processHistory">) {
  const updates = record.processHistory.filter((update) => update.stepId === "client-approval");
  const sent = [...updates].reverse().find((update) => update.status === "IN_PROGRESS");
  const approved = [...updates].reverse().find((update) => update.status === "DONE");
  return { sentToClientOn: sent?.recordedAt, clientApprovedOn: approved?.completedOn };
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function valueOr(value: string | null | undefined, fallback = "Not recorded") {
  return value && value.trim() ? value : fallback;
}

function dateLabel(value: string | undefined) {
  if (!value) return "Not recorded";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "long", timeZone: "Asia/Manila", year: "numeric" }).format(new Date(`${value}T00:00:00+08:00`));
}

function eventDateLabel(value: string | undefined) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return dateLabel(value.slice(0, 10));
  return value.split(" at ")[0];
}

function archiveAttachmentName(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/^Naming convention:\s*(.*?)(?:\s+·\s+Contents:|$)/);
  return match?.[1]?.trim() || value;
}

export async function generateWorkflowReportPdf(input: WorkflowReportInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28;
  const height = 841.89;
  const margin = 30;
  const frameWidth = width - margin * 2;
  const contentX = margin + 12;
  const contentWidth = frameWidth - 24;
  const ink = rgb(0.08, 0.1, 0.13);
  const slate = rgb(0.34, 0.38, 0.43);
  const muted = rgb(0.48, 0.5, 0.48);
  const red = rgb(0.89, 0.12, 0.14);
  const soft = rgb(0.96, 0.96, 0.94);
  const green = rgb(0.1, 0.42, 0.29);
  const blue = rgb(0.13, 0.36, 0.56);
  const rule = rgb(0.82, 0.82, 0.8);
  let cursorY = height - margin;
  const page = pdf.addPage([width, height]);

  function drawWrapped(value: string, x: number, size: number, font: PDFFont = regular, color = ink, maxWidth = contentWidth, lineHeight = size + 2) {
    const lines = wrapText(value, font, size, maxWidth);
    lines.forEach((line, index) => page.drawText(line, { x, y: cursorY - size - index * lineHeight, size, font, color }));
    cursorY -= lines.length * lineHeight;
  }

  function section(title: string) {
    page.drawRectangle({ x: margin, y: cursorY - 18, width: frameWidth, height: 18, color: soft });
    page.drawRectangle({ x: margin, y: cursorY - 18, width: 3, height: 18, color: red });
    page.drawText(title.toUpperCase(), { x: margin + 9, y: cursorY - 12, size: 7.2, font: bold, color: ink });
    cursorY -= 27;
  }

  function keyValue(label: string, value: string, labelWidth = 142) {
    const lines = wrapText(value, regular, 7.4, contentWidth - labelWidth - 6).slice(0, 2);
    page.drawText(label, { x: contentX, y: cursorY - 8, size: 6.9, font: bold, color: muted });
    lines.forEach((line, index) => page.drawText(line, { x: contentX + labelWidth, y: cursorY - 8 - index * 9, size: 7.4, font: regular, color: ink }));
    cursorY -= Math.max(14, lines.length * 9 + 4);
  }

  function journeyRow(step: string, status: string, whoWhen: string) {
    const stepLines = wrapText(step, regular, 6.9, 240).slice(0, 2);
    const whoWhenLines = wrapText(whoWhen, regular, 6.9, 145).slice(0, 2);
    const rowHeight = Math.max(19, Math.max(stepLines.length, whoWhenLines.length) * 9 + 6);
    page.drawLine({ start: { x: contentX, y: cursorY }, end: { x: contentX + contentWidth, y: cursorY }, thickness: 0.35, color: rule });
    stepLines.forEach((line, index) => page.drawText(line, { x: contentX + 4, y: cursorY - 9 - index * 9, size: 6.9, font: index === 0 ? bold : regular, color: ink }));
    page.drawText(status, { x: contentX + 250, y: cursorY - 9, size: 6.9, font: regular, color: status === "Complete" || status === "Not applicable" ? green : blue });
    whoWhenLines.forEach((line, index) => page.drawText(line, { x: contentX + 345, y: cursorY - 9 - index * 9, size: 6.9, font: regular, color: slate }));
    cursorY -= rowHeight;
  }

  function stage(stepId: string) {
    return input.stages.find((item) => item.stepId === stepId);
  }

  const filing = stage("filing");
  const paymentApproval = stage("payment-client-approval") ?? stage("payment");
  const paymentConfirmation = stage("payment-confirmation");
  const esubmission = stage("esubmission");
  const archive = stage("evidence");
  const clientApprovalDates = workflowClientApprovalDates(input.record);
  const paymentNotApplicable = input.work.paymentApplicability === "NOT_APPLICABLE";
  const roleCertifications = input.record.attempts.map((attempt) => `${input.roles.find((role) => role.label.toUpperCase() === attempt.role)?.label ?? attempt.role} · ${attempt.actor} · ${attempt.recordedAt}`);
  if (input.record.finalCertification) roleCertifications.push(`Final closure · ${input.record.finalCertification.actor} · ${input.record.finalCertification.recordedAt}`);

  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: red });
  page.drawText("TaxMonWeb", { x: margin, y: height - margin - 8, size: 13, font: bold, color: ink });
  page.drawText("RETURN JOURNEY REPORT", { x: width - margin - bold.widthOfTextAtSize("RETURN JOURNEY REPORT", 8), y: height - margin - 7, size: 8, font: bold, color: red });
  page.drawLine({ start: { x: margin, y: height - margin - 22 }, end: { x: width - margin, y: height - margin - 22 }, thickness: 0.6, color: red });
  cursorY = height - margin - 38;
  drawWrapped(input.clientName, contentX, 13, bold, red, contentWidth, 15);
  drawWrapped(`${input.periodLabel} · ${input.returnLabel} · Due ${input.dueDateLabel}`, contentX, 8.2, bold, slate, contentWidth, 10);
  drawWrapped(`TIN ${valueOr(input.tinLabel, "TIN not recorded")} · RDO / LTS ${valueOr(input.rdoLabel, "RDO / LTS not recorded")}`, contentX, 7, regular, muted, contentWidth, 9);
  cursorY -= 5;

  section("Client approval, filing, payment, and eSubmission");
  keyValue("Date sent to client", valueOr(eventDateLabel(clientApprovalDates.sentToClientOn)));
  keyValue("Date client approved", valueOr(eventDateLabel(clientApprovalDates.clientApprovedOn)));
  keyValue("Filing date", valueOr(filing?.completedOn ? dateLabel(filing.completedOn) : undefined));
  keyValue("Filing reference number", valueOr(filing?.evidenceReference));
  keyValue("Amount to pay", paymentNotApplicable ? "Not applicable" : valueOr(input.paymentAmountLabel));
  keyValue("Proceed to pay / equivalent", paymentNotApplicable ? "Not applicable" : valueOr(paymentApproval?.evidenceReference));
  keyValue("Payment acknowledgement date", paymentNotApplicable ? "Not applicable" : valueOr(paymentConfirmation?.completedOn ? dateLabel(paymentConfirmation.completedOn) : undefined));
  keyValue("Payment acknowledgement", paymentNotApplicable ? "Not applicable" : valueOr(paymentConfirmation?.evidenceReference));
  keyValue("eSubmission submission", valueOr(esubmission?.evidenceReference));
  keyValue("eSubmission submission date", valueOr(esubmission?.completedOn ? dateLabel(esubmission.completedOn) : undefined));
  keyValue("Date acknowledged by BIR", valueOr(esubmission?.acknowledgedOn ? dateLabel(esubmission.acknowledgedOn) : undefined));
  keyValue("Date validated by BIR", valueOr(esubmission?.validatedOn ? dateLabel(esubmission.validatedOn) : undefined));
  keyValue("Attachment / evidence name", valueOr(esubmission?.attachmentName ?? archive?.attachmentName ?? archiveAttachmentName(archive?.evidenceReference)));

  section("End-to-end journey");
  page.drawText("STEP", { x: contentX + 4, y: cursorY - 7, size: 6.4, font: bold, color: muted });
  page.drawText("STATUS", { x: contentX + 250, y: cursorY - 7, size: 6.4, font: bold, color: muted });
  page.drawText("ACTOR · EVIDENCE DATE", { x: contentX + 345, y: cursorY - 7, size: 6.4, font: bold, color: muted });
  cursorY -= 13;
  for (const item of input.stages) {
    const whoWhen = item.recordedBy || item.completedOn || item.recordedAt ? `${valueOr(item.recordedBy)} · ${dateLabel(item.completedOn ?? item.recordedAt)}` : "Not separately recorded";
    journeyRow(`${item.bundle} · ${item.label}`, item.status, whoWhen);
  }

  section("Role certification");
  if (roleCertifications.length === 0) keyValue("Certification", "Not recorded");
  else roleCertifications.slice(-4).forEach((certification, index) => keyValue(index === roleCertifications.length - 1 ? "Latest" : "Certification", certification));

  page.drawLine({ start: { x: margin, y: 27 }, end: { x: width - margin, y: 27 }, thickness: 0.4, color: rule });
  page.drawText("TaxMonWeb · One-page journey and evidence reference · Files remain in the approved archive location", { x: margin, y: 16, size: 5.6, font: regular, color: muted });
  const pageLabel = "Page 1 of 1";
  page.drawText(pageLabel, { x: width - margin - regular.widthOfTextAtSize(pageLabel, 5.6), y: 16, size: 5.6, font: regular, color: muted });

  return pdf.save();
}
