import { describe, expect, it } from "vitest";

import { fixtureWork } from "./fixtures";
import { applyWorkflowStepState, initialProcessStatuses, transition, workflowProcessRole } from "./workflow-rules";

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
});
