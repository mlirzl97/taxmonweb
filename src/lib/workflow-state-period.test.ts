// @vitest-environment node

import { describe, expect, it } from "vitest";

import { workPeriodKey, workReturnCode, workReturnLockKey } from "@/lib/workflow-state";

describe("accounting period keys", () => {
  it("normalizes monthly labels to one shared close key", () => {
    expect(workPeriodKey({ period: "January 2026" })).toBe("2026-01");
    expect(workPeriodKey({ period: "Jan 2026" })).toBe("2026-01");
    expect(workPeriodKey({ period: "September 2026", periodKey: "2026-09" })).toBe("2026-09");
  });

  it("keeps annual periods distinct from monthly periods", () => {
    expect(workPeriodKey({ period: "FY 2026" })).toBe("FY-2026");
  });

  it("keys a centralized lock by compliance period and governed return", () => {
    const work = { period: "October 2026", requirementCode: "0619-E", title: "0619-E return package" };
    expect(workReturnCode(work)).toBe("0619-E");
    expect(workReturnLockKey(work)).toBe("2026-10::0619-E");
  });
});
