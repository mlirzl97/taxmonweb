import { describe, expect, it } from "vitest";

import { fixtureWork } from "@/lib/fixtures";
import { recordForWork } from "@/lib/workflow-rules";
import { deriveWorkReturnOutcome, taxTeamStatusFromOutcome } from "./work-outcome";

function recordWithStatuses(workId: string, processStatuses: Record<string, "DONE" | "NOT_APPLICABLE">, completedOn?: string) {
  const work = fixtureWork.find((item) => item.id === workId)!;
  const base = recordForWork(work);
  return {
    ...base,
    processStatuses: { ...base.processStatuses, ...processStatuses },
    processHistory: Object.entries(processStatuses).map(([stepId, status], index) => ({ id: `update-${index}`, stepId, status, actor: "Preparer", recordedAt: "2026-10-01T09:00:00+08:00", evidenceReference: "fixture-evidence", ...(completedOn && stepId !== "payment-confirmation" ? { completedOn } : {}) })),
  };
}

describe("work outcome projection", () => {
  it("requires actual dates before calling a completed return on time", () => {
    const work = fixtureWork.find((item) => item.id === "work-02")!;
    const record = recordWithStatuses(work.id, { filing: "DONE", "payment-confirmation": "NOT_APPLICABLE", esubmission: "DONE" });

    expect(deriveWorkReturnOutcome(work, record, "2026-10-05").overall).toBe("unverified");
    expect(taxTeamStatusFromOutcome(deriveWorkReturnOutcome(work, record, "2026-10-05"))).toBe("unresolved");
  });

  it("classifies filing, payment, and attachments from their recorded dates", () => {
    const work = fixtureWork.find((item) => item.id === "work-02")!;
    const onTime = deriveWorkReturnOutcome(work, recordWithStatuses(work.id, { filing: "DONE", "payment-confirmation": "NOT_APPLICABLE", esubmission: "DONE" }, "2026-09-30"), "2026-10-05");
    const late = deriveWorkReturnOutcome(work, recordWithStatuses(work.id, { filing: "DONE", "payment-confirmation": "NOT_APPLICABLE", esubmission: "DONE" }, "2026-10-01"), "2026-10-05");

    expect(onTime.overall).toBe("on_time");
    expect(late.overall).toBe("late");
  });
});
