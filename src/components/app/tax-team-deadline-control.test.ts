import { describe, expect, it } from "vitest";
import { buildDeadlineControlRows } from "@/lib/domain/deadline-control";
import { toEditable } from "./tax-team-deadline-control";

describe("Deadline Control editor", () => {
  const row = buildDeadlineControlRows(2027)[0];

  it("saves back the period dates exactly as stored, including unset ones", () => {
    // An Override must still match its original's period when it is saved again.
    const unset = toEditable({ ...row, periodStartDate: "2027-01-01", storedPeriodStart: null, storedPeriodEnd: null });
    expect(unset.periodStart).toBe("");
    expect(unset.periodEnd).toBe("");
    const stored = toEditable({ ...row, storedPeriodStart: "2027-01-01", storedPeriodEnd: "2027-03-31" });
    expect(stored.periodStart).toBe("2027-01-01");
    expect(stored.periodEnd).toBe("2027-03-31");
  });

  it("keeps the derived start for rows that never came from the repository", () => {
    const local = toEditable({ ...row, periodStartDate: "2027-02-01" });
    expect(local.periodStart).toBe("2027-02-01");
  });
});
