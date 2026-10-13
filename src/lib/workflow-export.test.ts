import { describe, expect, it } from "vitest";

import { buildWorkflowFactsCsv, buildWorkflowProcessingLogCsv } from "@/lib/workflow-export";
import type { FixtureWorkItem } from "@/lib/fixtures/types";
import type { WorkflowRecord } from "@/lib/workflow-state";

const work = { id: "w-1", client: "Client, Inc.", title: "WHT 1601EQ", requirementCode: "1601EQ", period: "September 2026", registrationUnit: "Head Office", status: "GREEN" } as FixtureWorkItem;
const record = {
  currentGate: null,
  attempts: [],
  checklistAnswers: {},
  checklistHistory: [],
  processStatuses: {},
  processHistory: [{ id: "p-1", stepId: "payment-confirmation", status: "DONE", actor: "Preparer", recordedAt: "2026-10-13 10:00", evidenceReference: "OR-123, proof.pdf", completedOn: "2026-10-13" }],
  changeHistory: [],
  periodLock: { locked: false },
  periodLockHistory: [],
} as WorkflowRecord;

describe("workflow exports", () => {
  it("exports saved facts with escaped references", () => {
    const csv = buildWorkflowFactsCsv([{ work: { ...work, paymentAmount: 100 } as FixtureWorkItem, record }]);
    expect(csv).toContain('"Client, Inc."');
    expect(csv).toContain('"OR-123, proof.pdf"');
    expect(csv).toContain("100");
  });

  it("exports processing events separately from facts", () => {
    const csv = buildWorkflowProcessingLogCsv([{ work, record }]);
    expect(csv).toContain("process");
    expect(csv).toContain("payment-confirmation");
    expect(csv).toContain("OR-123, proof.pdf");
  });
});
