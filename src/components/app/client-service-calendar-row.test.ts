import { describe, expect, it } from "vitest";

import type { ClientServiceCalendarRow } from "@/lib/domain/deadline-control";

import { serviceCalendarRow } from "./client-service-calendar";

function row(overrides: Partial<ClientServiceCalendarRow>): ClientServiceCalendarRow {
  return {
    formNumber: "1601-C",
    taxCategory: "wht",
    activityMonth: "April",
    activityPeriod: "1601-C · Month of March 2026",
    taxablePeriod: "Month of March 2026",
    clientProvideDate: "2026-04-03",
    clientApprovalDate: "2026-04-08",
    estimatedFilingDate: "2026-04-09",
    estimatedPaymentDate: "2026-04-08",
    tmfPackageTarget: "2026-04-09",
    publishedOperationalDeadline: "2026-04-10",
    ...overrides,
  } as ClientServiceCalendarRow;
}

describe("service calendar line", () => {
  it("shows the filing month, the period covered and one return with its family", () => {
    const line = serviceCalendarRow(row({}));
    expect([line.activityMonth, line.taxableMonth, line.taxReturn]).toEqual(["April", "March 2026", "1601-C · Compensation withholding"]);
  });

  it("names proof of filing as its own line", () => {
    const line = serviceCalendarRow(row({ formNumber: "1702-RT", activityPeriod: "1702-RT proof of filing and attachments · Calendar Year 2025", taxablePeriod: "Calendar Year 2025" }));
    expect(line.taxReturn).toBe("1702-RT proof of filing · Corporate income tax");
  });
});
