import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { fixtureWork } from "@/lib/fixtures";
import { generateWorkflowReportPdf, workflowClientApprovalDates } from "@/lib/workflow-report";
import type { WorkflowRecord } from "@/lib/workflow-state";

describe("workflow report", () => {
  it("uses the process history handoff and approval events", () => {
    expect(workflowClientApprovalDates({ processHistory: [
      { id: "sent", stepId: "client-approval", status: "IN_PROGRESS", actor: "Preparer", recordedAt: "October 19, 2026 at 9:00 AM (Asia/Manila)" },
      { id: "approved", stepId: "client-approval", status: "DONE", actor: "Preparer", recordedAt: "October 20, 2026 at 9:00 AM (Asia/Manila)", completedOn: "2026-10-20" },
    ] })).toEqual({ sentToClientOn: "October 19, 2026 at 9:00 AM (Asia/Manila)", clientApprovedOn: "2026-10-20" });
  });

  it("generates a PDF from the return journey record", async () => {
    const record: WorkflowRecord = {
      currentGate: null,
      attempts: [],
      checklistAnswers: {},
      checklistHistory: [],
      processStatuses: {},
      processHistory: [],
      changeHistory: [],
      periodLock: { locked: false },
      periodLockHistory: [],
    };
    const bytes = await generateWorkflowReportPdf({
      work: fixtureWork[0],
      record,
      clientName: fixtureWork[0].client,
      tinLabel: "TIN not recorded",
      rdoLabel: "RDO / LTS not recorded",
      returnLabel: "WHT · 1601EQ",
      periodLabel: fixtureWork[0].period,
      dueDateLabel: "October 20, 2026",
      stages: [{ bundle: "Filing", label: "Draft return", owner: "Preparer", status: "Complete", evidenceReference: "Working paper", recordedBy: "Synthetic Preparer", recordedAt: "October 12, 2026" }],
      roles: [{ label: "Preparer", person: "Synthetic Preparer" }],
      paymentAmountLabel: null,
    });

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(1000);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
