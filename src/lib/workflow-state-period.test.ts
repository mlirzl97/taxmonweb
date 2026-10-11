// @vitest-environment node

import { describe, expect, it } from "vitest";

import { workPeriodKey } from "@/lib/workflow-state";

describe("accounting period keys", () => {
  it("normalizes monthly labels to one shared close key", () => {
    expect(workPeriodKey({ period: "January 2026" })).toBe("2026-01");
    expect(workPeriodKey({ period: "Jan 2026" })).toBe("2026-01");
    expect(workPeriodKey({ period: "September 2026", periodKey: "2026-09" })).toBe("2026-09");
  });

  it("keeps annual periods distinct from monthly periods", () => {
    expect(workPeriodKey({ period: "FY 2026" })).toBe("FY-2026");
  });
});
