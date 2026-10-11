import { describe, expect, it } from "vitest";

import { defaultTaxTeamReportFilters, filterTaxTeamReportRows, filterTaxTeamTransactionReviews, getTaxTeamReportRows, getTaxTeamTransactionReviews, summarizeTaxTeamReport, taxTeamMonthlyStatusOptions, taxTeamReportTypes } from "./tax-team-reports";

describe("Tax Team report read model", () => {
  it("keeps report rows grounded in the shared work register", () => {
    const rows = getTaxTeamReportRows();
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.id === "work-02")?.filing).toBe("Reported sent");
    expect(rows.find((row) => row.id === "work-02")?.acceptance).toBe("Not verified");
    expect(rows.find((row) => row.id === "work-02")?.control).toBe("Incomplete");
    expect(rows.find((row) => row.id === "work-02")?.monthlyStatus).toBe("unresolved");
  });

  it("supports inclusive calendar date and tower filters", () => {
    const rows = filterTaxTeamReportRows(getTaxTeamReportRows(), { ...defaultTaxTeamReportFilters, from: "2026-10-06", to: "2026-10-09", scope: "Tower B" });
    expect(rows.map((row) => row.id)).toEqual(["work-02", "work-04"]);
  });

  it("does not infer acceptance or payment from a reported filing", () => {
    const summary = summarizeTaxTeamReport(getTaxTeamReportRows());
    expect(summary.reportedSent).toBe(1);
    expect(summary.accepted).toBe(0);
    expect(summary.paid).toBe(0);
  });

  it("keeps the monthly report status column aligned to the Tax Team operating categories", () => {
    expect(taxTeamMonthlyStatusOptions.slice(0, 6).map((option) => option.label)).toEqual([
      "Filed and paid on time",
      "Filed and paid beyond the deadline",
      "Not applicable",
      "Filed and paid c/o HRP",
      "Filed and paid c/o client",
      "Prepared but not yet due",
    ]);
    expect(taxTeamMonthlyStatusOptions.at(-1)?.id).toBe("unresolved");
  });

  it("keeps QA checking separate from exception-driven RCA", () => {
    expect(taxTeamReportTypes.map((option) => option.id)).toContain("qa");
    expect(taxTeamReportTypes.map((option) => option.id)).toContain("rca");

    const rows = getTaxTeamReportRows();
    expect(rows.every((row) => row.qaStatus === "not_configured")).toBe(true);
    expect(rows.every((row) => row.rcaStatus === "not_configured")).toBe(true);
  });

  it("models QA as completeness and awareness review of pulled transaction populations", () => {
    const reviews = getTaxTeamTransactionReviews();
    expect(reviews).toHaveLength(4);
    expect(reviews.every((review) => review.source === "Transaction pull")).toBe(true);
    expect(reviews.every((review) => review.reviewStatus === "awaiting_review")).toBe(true);
    expect(filterTaxTeamTransactionReviews(reviews, { from: "2026-10-06", to: "2026-10-09", scope: "Tower B" }).map((review) => review.id)).toEqual(["transaction-review-work-02", "transaction-review-work-04"]);
  });
});
