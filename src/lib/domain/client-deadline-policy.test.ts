import { describe, expect, it } from "vitest";

import { fixtureClients } from "@/lib/fixtures";
import { getClientServiceCalendarRows } from "./deadline-control";
import { defaultGroupScheduleLeadDays, workingDaysBefore } from "./client-deadline-policy";

describe("client deadline policy", () => {
  it("defines concrete dates when a client follows the group schedule", () => {
    expect(defaultGroupScheduleLeadDays).toEqual({
      clientProvideLeadDays: 5,
      clientApprovalLeadDays: 2,
      tmfPackageLeadDays: 1,
      estimatedFilingLeadDays: 1,
      estimatedPaymentLeadDays: 2,
    });

    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();
    const calendar = getClientServiceCalendarRows(client!, 2026);
    const cit = calendar.rows.find((row) => row.formNumber === "1702-RT");
    expect(cit?.clientProvideDate).toBe(workingDaysBefore("2027-04-15", 5));
    expect(cit?.clientApprovalDate).toBe(workingDaysBefore("2027-04-15", 2));
    expect(cit?.tmfPackageTarget).toBe(workingDaysBefore("2027-04-15", 1));
    expect(cit?.estimatedFilingDate).toBe(workingDaysBefore("2027-04-15", 1));
    expect(cit?.estimatedPaymentDate).toBe(workingDaysBefore("2027-04-15", 2));
  });

  it("derives working-day milestones without changing the published deadline", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();
    const clientWithTiming = {
      ...client!,
      entities: [{
        ...client!.entities[0],
        profile: {
          ...client!.entities[0].profile,
          deadlinePolicy: {
            mode: "client_defined" as const,
            sourceReference: "Sanitized client service instruction",
            clientProvideLeadDays: 5,
            clientApprovalLeadDays: 2,
            tmfPackageLeadDays: 1,
            estimatedFilingLeadDays: 1,
            estimatedPaymentLeadDays: 2,
          },
        },
      }],
    };

    const calendar = getClientServiceCalendarRows(clientWithTiming, 2026);
    const cit = calendar.rows.find((row) => row.formNumber === "1702-RT");
    expect(cit?.publishedOperationalDeadline).toBe("2027-04-15");
    expect(cit?.clientProvideDate).toBe(workingDaysBefore("2027-04-15", 5));
    expect(cit?.clientApprovalDate).toBe(workingDaysBefore("2027-04-15", 2));
    expect(cit?.tmfPackageTarget).toBe(workingDaysBefore("2027-04-15", 1));
    expect(cit?.estimatedFilingDate).toBe(workingDaysBefore("2027-04-15", 1));
    expect(cit?.estimatedPaymentDate).toBe(workingDaysBefore("2027-04-15", 2));
  });

  it("skips weekends when deriving a client milestone", () => {
    expect(workingDaysBefore("2026-10-25", 1)).toBe("2026-10-23");
    expect(workingDaysBefore("2026-10-25", 0)).toBe("2026-10-25");
  });
});
