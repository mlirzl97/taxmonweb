import { describe, expect, it } from "vitest";

import { fixtureClients, type FixtureClient } from "@/lib/fixtures";

import { compliancePeriodStartFromLabel, type DeadlineControlRow } from "./deadline-control";
import { formsNamedInLabel, projectReturnFamilyCalendar } from "./return-families";

function row(id: string, label: string, due: string): DeadlineControlRow {
  return {
    id,
    calendarYear: 2026,
    requirementCode: "BIR-TEST",
    requirementLabel: label,
    formNumber: "",
    taxCategory: "wht",
    cadence: "Monthly",
    component: "Return / filing",
    activityMonth: "",
    activityPeriod: label,
    periodStartDate: compliancePeriodStartFromLabel(label) ?? "",
    taxablePeriod: label,
    baseStatutoryDeadline: null,
    adjustedStatutoryDeadline: due,
    officialPublishedDeadline: null,
    officialCalendarReference: null,
    earliestApplicableDeadline: due,
    publishedOperationalDeadline: due,
    tmfPackageTarget: null,
    publicationStatus: "published",
    verificationStatus: "unresolved",
    ruleVersionId: "test",
    sourceCode: "published-calendar",
    sourceLabel: "Tax Team published calendar",
    adjustmentReason: "",
    explanation: "",
  };
}

function client(overrides: Partial<FixtureClient["entities"][number]["profile"]> = {}): FixtureClient {
  const base = fixtureClients[0];
  return { ...base, entities: [{ ...base.entities[0], profile: { ...base.entities[0].profile, taxYearBasis: "Calendar year", fiscalYearEnd: "December 31", ...overrides } }] };
}

const combinedApril = "BIR Forms 1601-C (Monthly Remittance Return of Income Taxes Withheld on Compensation) and/or 0619-E (Monthly Remittance Form of Creditable Income Taxes Withheld-Expanded) and/or 0619-F (Monthly Remittance Form of Final Income Taxes Withheld)";
const april = [
  row("a-non-efps", `${combinedApril}. Non-eFPS Filers. Month of April 2026`, "2026-05-10"),
  row("a-group-e", `${combinedApril} - eFPS Filers under Group E. Month of April 2026`, "2026-05-11"),
  row("a-group-a", `${combinedApril}. eFPS Filers under Group A. Month of April 2026`, "2026-05-15"),
];
const march = [
  row("m-non-efps", "BIR Form 1601-C (Monthly Remittance Return of Income Taxes Withheld on Compensation) - Non-eFPS Filers. Month of March 2026", "2026-04-10"),
  row("m-group-a", "BIR Form 1601-C (Monthly Remittance Return of Income Taxes Withheld on Compensation) - eFPS Filers under Group A. Month of March 2026", "2026-04-15"),
];

describe("return families", () => {
  it("reads the forms a combined BIR calendar row names", () => {
    expect(formsNamedInLabel(`${combinedApril}. Non-eFPS Filers. Month of April 2026`).sort()).toEqual(["0619-E", "0619-F", "1601-C"]);
    expect(formsNamedInLabel("Proof of eFiled BIR Form 1702 - RT/EX/MX with Audited Financial Statements. Calendar Year 2025")).toEqual(["1702-RT", "1702-EX", "1702-MX"]);
    expect(formsNamedInLabel("BIR Form 1702Q (Quarterly Income Tax Return) - For the Quarter ending March 31, 2026")).toEqual(["1702Q"]);
  });

  it("gives one row per return and period at the earliest date across filing channels and eFPS groups", () => {
    const { rows } = projectReturnFamilyCalendar(client(), ["1601-C", "0619-E"], [...april, ...march], 2026);
    const byForm = (form: string) => rows.filter((candidate) => candidate.formNumber === form);
    expect(byForm("1601-C").map((candidate) => [candidate.periodStartDate, candidate.publishedOperationalDeadline])).toEqual([["2026-04-01", "2026-05-10"], ["2026-03-01", "2026-04-10"]]);
    expect(byForm("0619-E").map((candidate) => candidate.publishedOperationalDeadline)).toEqual(["2026-05-10"]);
    expect(byForm("1601-C")[0].tmfPackageTarget).toBe("2026-05-09");
    // A form the client does not file is not projected.
    expect(byForm("0619-F")).toHaveLength(0);
  });

  it("projects one row per candidate form for a multi-form requirement outside the families", () => {
    const joined = { ...row("vt-pt", "Withholding of VAT and Percentage Tax. Month of May 2026", "2026-06-10"), formNumber: "1600-VT · 1600-PT" };
    const { rows } = projectReturnFamilyCalendar(client(), ["1600-PT"], [joined], 2026);
    expect(rows.map((candidate) => [candidate.id, candidate.formNumber])).toEqual([["vt-pt:1600-PT", "1600-PT"]]);
    // A row for a form the client does not file passes through unchanged.
    const other = { ...joined, id: "other" };
    expect(projectReturnFamilyCalendar(client(), ["1601-C"], [other], 2026).rows.map((candidate) => candidate.formNumber)).toEqual(["1600-VT · 1600-PT"]);
  });

  it("keeps a released TMF target, such as a Tax Team override, instead of recalculating it", () => {
    const overridden = { ...april[0], tmfPackageTarget: "2026-05-07" };
    const { rows } = projectReturnFamilyCalendar(client(), ["1601-C"], [overridden, april[1]], 2026);
    expect(rows.find((candidate) => candidate.formNumber === "1601-C")?.tmfPackageTarget).toBe("2026-05-07");
  });

  it("keeps payment forms to months 1 and 2 of a quarter", () => {
    const juneCombined = row("j", `${combinedApril}. Non-eFPS Filers. Month of June 2026`, "2026-07-10");
    const { rows } = projectReturnFamilyCalendar(client(), ["0619-E"], [juneCombined], 2026);
    expect(rows).toHaveLength(0);
  });

  it("ignores fiscal-quarter rows for calendar-basis families", () => {
    const calendarQuarter = row("q", "BIR Form 2550Q (Quarterly Value-Added Tax Return) - eFPS & Non-eFPS Filers. For the Quarter ending March 31, 2026", "2026-04-25");
    const fiscalQuarter = row("fq", "BIR Form 2550Q (Quarterly Value-Added Tax Return). eFPS & Non-eFPS Filers - Fiscal Quarter ending April 30, 2026", "2026-05-25");
    const { rows } = projectReturnFamilyCalendar(client({ taxYearBasis: "Fiscal year", fiscalYearEnd: "June 30" }), ["2550Q"], [calendarQuarter, fiscalQuarter], 2026);
    expect(rows.map((candidate) => candidate.publishedOperationalDeadline)).toEqual(["2026-04-25"]);
  });

  it("keeps a fiscal client's own quarters from rows entered in Deadline Control, by their structured period", () => {
    const entered = (id: string, form: string, period: string, start: string, due: string) => ({ ...row(id, period, due), formNumber: form, periodStartDate: start });
    const rows = [
      entered("q1", "1702Q", "Q1 2026", "2026-01-01", "2026-05-30"),
      entered("q2", "1702Q", "Q2 2026", "2026-04-01", "2026-08-29"),
    ];
    // June year-end: the quarter ending March is a fiscal 1702Q; the one ending June is the annual return's.
    const fiscal = projectReturnFamilyCalendar(client({ taxYearBasis: "Fiscal year", fiscalYearEnd: "June 30" }), ["1702Q"], rows, 2026);
    expect(fiscal.rows.map((candidate) => candidate.id)).toEqual(["q1:1702Q"]);
  });

  it("follows a fiscal-year client's own quarters for corporate income tax", () => {
    const calendarQuarter = row("c", "BIR Form 1702Q (Quarterly Income Tax Return For Corporations) and SAWT - For the Quarter ending March 31, 2026", "2026-05-30");
    const fiscalJanuary = row("fj", "BIR Form 1702Q (Quarterly Income Tax Return For Corporations) and SAWT. Fiscal Quarter ending January 31, 2026", "2026-04-01");
    const fiscalMarch = row("fm", "BIR Form 1702Q (Quarterly Income Tax Return For Corporations) and SAWT. Fiscal Quarter ending March 31, 2026", "2026-05-30");
    const fiscalJune = row("fju", "BIR Form 1702Q (Quarterly Income Tax Return For Corporations) and SAWT. Fiscal Quarter ending June 30, 2026", "2026-08-29");
    const all = [calendarQuarter, fiscalJanuary, fiscalMarch, fiscalJune];
    // June year-end: fiscal quarters end Sep, Dec, Mar; June is the annual return, not a 1702Q.
    const fiscal = projectReturnFamilyCalendar(client({ taxYearBasis: "Fiscal year", fiscalYearEnd: "June 30" }), ["1702Q"], all, 2026);
    expect(fiscal.rows.map((candidate) => candidate.id)).toEqual(["fm:1702Q"]);
    const calendar = projectReturnFamilyCalendar(client(), ["1702Q"], all, 2026);
    expect(calendar.rows.map((candidate) => candidate.id)).toEqual(["c:1702Q"]);
  });

  it("proposes elected 2550M and 2551M for months 1 and 2 on the 20th, held until the Tax Team releases them", () => {
    const { rows } = projectReturnFamilyCalendar(client(), ["2550M", "2551M"], [], 2026);
    const vat = rows.filter((candidate) => candidate.formNumber === "2550M");
    expect(vat.map((candidate) => candidate.periodStartDate)).toEqual(["2026-01-01", "2026-02-01", "2026-04-01", "2026-05-01", "2026-07-01", "2026-08-01", "2026-10-01", "2026-11-01"]);
    expect(vat[0].earliestApplicableDeadline).toBe("2026-02-20");
    expect(vat[0].tmfPackageTarget).toBe("2026-02-19");
    expect(vat[7].earliestApplicableDeadline).toBe("2026-12-20");
    // Never published by projection: no operational date until release.
    expect(vat.every((candidate) => candidate.publicationStatus === "needs_review" && candidate.publishedOperationalDeadline === null)).toBe(true);
    expect(rows.filter((candidate) => candidate.formNumber === "2551M")).toHaveLength(8);
    // A month whose date the Tax Team released shows once, as released.
    const released = row("vat-apr", "BIR Form 2550M. Month of April 2026", "2026-05-20");
    const withRelease = projectReturnFamilyCalendar(client(), ["2550M"], [{ ...released, formNumber: "2550M", periodStartDate: "2026-04-01" }], 2026).rows.filter((candidate) => candidate.periodStartDate === "2026-04-01");
    expect(withRelease.map((candidate) => candidate.publicationStatus)).toEqual(["published"]);
    // Not elected: no optional rows.
    expect(projectReturnFamilyCalendar(client(), ["2550Q"], [], 2026).rows).toHaveLength(0);
  });

  it("holds VAT for Tax Team review when the fiscal year does not end on a calendar quarter-end", () => {
    const vatQuarter = row("q", "BIR Form 2550Q (Quarterly Value-Added Tax Return) - eFPS & Non-eFPS Filers. For the Quarter ending March 31, 2026", "2026-04-25");
    const result = projectReturnFamilyCalendar(client({ taxYearBasis: "Fiscal year", fiscalYearEnd: "May 31" }), ["2550Q", "2550M"], [vatQuarter], 2026);
    expect(result.rows).toHaveLength(0);
    expect(result.notices[0]).toContain("May");
  });

  it("keeps proof of filing with attachments as its own deadline beside the return", () => {
    const annual = row("r", "BIR Form 1702-RT/1702-EX/1702-MX- Fiscal Year ending March 31, 2026", "2026-07-15");
    const proof = row("p", "Proof of eFiled BIR Form 1702-RT/1702-EX/1702-MX with Audited Financial Statements (AFS), 1709 (if applicable), and Other Attachments through Electronic Audited Financial Statements (eAFS)- Fiscal Year ending March 31, 2026", "2026-07-30");
    const { rows } = projectReturnFamilyCalendar(client({ taxYearBasis: "Fiscal year", fiscalYearEnd: "March 31" }), ["1702-RT"], [annual, proof], 2026);
    expect(rows.map((candidate) => [candidate.activityPeriod, candidate.publishedOperationalDeadline])).toEqual([
      ["1702-RT · Fiscal Year ending March 31, 2026", "2026-07-15"],
      ["1702-RT proof of filing and attachments · Fiscal Year ending March 31, 2026", "2026-07-30"],
    ]);
  });

  it("applies the family rules to rows entered in Deadline Control, which carry the form in its own field", () => {
    const entered = (id: string, form: string, period: string, start: string, due: string) => ({ ...row(id, period, due), formNumber: form, periodStartDate: start });
    const rows = [
      entered("e-apr", "0619-E", "April 2026", "2026-04-01", "2026-05-10"),
      entered("e-jun", "0619-E", "June 2026", "2026-06-01", "2026-07-10"),
      entered("vat-apr", "2550M", "April 2026", "2026-04-01", "2026-05-20"),
    ];
    const projected = projectReturnFamilyCalendar(client(), ["0619-E", "2550M"], rows, 2026).rows;
    // A payment form never in month 3 of a quarter.
    expect(projected.filter((candidate) => candidate.formNumber === "0619-E").map((candidate) => candidate.periodStartDate)).toEqual(["2026-04-01"]);
    expect(projected.find((candidate) => candidate.id.startsWith("e-apr"))?.activityPeriod).toBe("0619-E · April 2026");
    // The released 2550M month shows once, as released.
    expect(projected.filter((candidate) => candidate.formNumber === "2550M" && candidate.periodStartDate === "2026-04-01").map((candidate) => candidate.publicationStatus)).toEqual(["published"]);
  });

  it("passes through rows that name no family form", () => {
    const other = row("o", "BIR Form 2000 (Documentary Stamp Tax Declaration/Return). Month of April 2026", "2026-05-05");
    expect(projectReturnFamilyCalendar(client(), ["1601-C"], [other], 2026).rows).toEqual([other]);
  });
});
