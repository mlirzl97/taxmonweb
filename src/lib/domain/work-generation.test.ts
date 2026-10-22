import { describe, expect, it } from "vitest";

import type { DeadlineControlRow } from "./deadline-control";
import { workGenerationItems } from "./work-generation";

function row(patch: Partial<DeadlineControlRow>): DeadlineControlRow {
  return {
    id: "11111111-1111-4111-8111-111111111111:1601-C",
    calendarYear: 2026,
    requirementCode: "BIR-1601-C",
    requirementLabel: "",
    formNumber: "1601-C",
    taxCategory: "wht",
    cadence: "Monthly",
    component: "Return / filing",
    activityMonth: "May",
    activityPeriod: "1601-C · Month of April 2026",
    periodStartDate: "2026-04-01",
    taxablePeriod: "Month of April 2026",
    baseStatutoryDeadline: null,
    adjustedStatutoryDeadline: "2026-05-10",
    officialPublishedDeadline: null,
    officialCalendarReference: null,
    earliestApplicableDeadline: "2026-05-10",
    publishedOperationalDeadline: "2026-05-10",
    tmfPackageTarget: "2026-05-09",
    publicationStatus: "published",
    verificationStatus: "unresolved",
    ruleVersionId: "x",
    sourceCode: "published-calendar",
    sourceLabel: "",
    adjustmentReason: "",
    explanation: "",
    ...patch,
  };
}

describe("work generation items", () => {
  it("cites the published calendar entry and date for an approved return", () => {
    expect(workGenerationItems([row({})], ["1601-C"])).toEqual([{ form: "1601-C", kind: "return", periodStart: "2026-04-01", periodLabel: "1601-C · Month of April 2026", dueDate: "2026-05-10", calendarEntryId: "11111111-1111-4111-8111-111111111111" }]);
  });

  it("leaves out returns not approved In TMF Scope, unpublished rows and rows without a known period", () => {
    expect(workGenerationItems([row({})], ["0619-E"])).toEqual([]);
    expect(workGenerationItems([row({ publicationStatus: "needs_review" })], ["1601-C"])).toEqual([]);
    expect(workGenerationItems([row({ periodStartDate: "" })], ["1601-C"])).toEqual([]);
    expect(workGenerationItems([row({ publishedOperationalDeadline: null })], ["1601-C"])).toEqual([]);
  });

  it("gives a TMF-only optional return no calendar entry, and keeps proof of filing as its own item", () => {
    const optional = workGenerationItems([row({ id: "tmf-2550M-2026-04", formNumber: "2550M", activityPeriod: "2550M · Month of April 2026", publishedOperationalDeadline: "2026-05-20" })], ["2550M"]);
    expect(optional[0].calendarEntryId).toBeNull();
    const proof = workGenerationItems([
      row({ formNumber: "1702-RT", activityPeriod: "1702-RT · Calendar Year 2026", periodStartDate: "2026-01-01" }),
      row({ formNumber: "1702-RT", activityPeriod: "1702-RT proof of filing and attachments · Calendar Year 2026", periodStartDate: "2026-01-01", publishedOperationalDeadline: "2027-04-30" }),
    ], ["1702-RT"]);
    expect(proof.map((item) => item.kind)).toEqual(["return", "proof"]);
  });

  it("never sends the same return, kind and period twice", () => {
    expect(workGenerationItems([row({}), row({ id: "22222222-2222-4222-8222-222222222222:1601-C" })], ["1601-C"])).toHaveLength(1);
  });
});
