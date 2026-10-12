import { describe, expect, it } from "vitest";

import { fixtureWork } from "./fixtures";
import { applyWorkflowStepState, initialProcessStatuses, isValidTaxDueAmount, orderedProcessStatuses, roleQuestions, transition, workflowProcessRole } from "./workflow-rules";

describe("workflow rules", () => {
  it("keeps the ordered process state deterministic", () => {
    const work = fixtureWork[0]!;
    const statuses = initialProcessStatuses(work);
    const firstStep = work.steps.find((step) => statuses[step.id] === "IN_PROGRESS") ?? work.steps[0]!;

    expect(statuses[firstStep.id]).toBe("IN_PROGRESS");
    const projectedSteps = applyWorkflowStepState(work, "PREPARER", work.stage, statuses);
    expect(projectedSteps.find((step) => step.id === firstStep.id)?.state).toBe(firstStep.state === "blocked" ? "blocked" : "current");
    expect(workflowProcessRole("check")).toBe("CHECKER");
  });

  it("records the next gate without changing the approved sequence", () => {
    const result = transition("PREPARER", "CERTIFY", "Ready for independent checking.");

    expect(result.currentGate).toBe("CHECKER");
    expect(result.patch.nextAction).toBe("Complete Checker review");
  });

  it("requires a recorded non-negative tax due amount for Checker certification", () => {
    expect(roleQuestions.CHECKER.some((question) => question.id === "tax-due-recorded")).toBe(true);
    expect(isValidTaxDueAmount(0)).toBe(true);
    expect(isValidTaxDueAmount(1250.5)).toBe(true);
    expect(isValidTaxDueAmount(null)).toBe(false);
    expect(isValidTaxDueAmount(-1)).toBe(false);
  });

  it("skips stale payment work after payment becomes not applicable", () => {
    const source = fixtureWork.find((work) => work.id === "work-03")!;
    const work = { ...source, paymentApplicability: "NOT_APPLICABLE" as const };
    const statuses = { ...initialProcessStatuses(work), prepare: "DONE" as const, check: "DONE" as const, review: "DONE" as const, "client-approval": "DONE" as const, filing: "DONE" as const, payment: "IN_PROGRESS" as const, esubmission: "NOT_STARTED" as const };
    const projected = applyWorkflowStepState(work, null, "POST-FILING", statuses);

    expect(projected.find((step) => step.id === "payment")?.state).toBe("complete");
    expect(projected.find((step) => step.id === "esubmission")?.state).toBe("current");
  });

  it("does not project attachments or archiving before required payment", () => {
    const work = fixtureWork.find((item) => item.id === "work-02")!;
    const statuses = orderedProcessStatuses(work, {
      ...initialProcessStatuses(work),
      filing: "DONE",
      esubmission: "DONE",
      evidence: "DONE",
    });

    expect(statuses["payment"]).toBe("IN_PROGRESS");
    expect(statuses.esubmission).toBe("NOT_STARTED");
    expect(statuses.evidence).toBe("NOT_STARTED");
  });

  it("holds every downstream step when source data is blocked", () => {
    const work = fixtureWork.find((item) => item.id === "work-04")!;
    const statuses = orderedProcessStatuses(work, { prepare: "DONE", payment: "IN_PROGRESS", "payment-confirmation": "DONE", esubmission: "DONE", evidence: "DONE" });

    expect(statuses.prepare).toBe("NOT_STARTED");
    expect(statuses.payment).toBe("NOT_STARTED");
    expect(statuses.esubmission).toBe("NOT_STARTED");
    expect(statuses.evidence).toBe("NOT_STARTED");
  });
});
