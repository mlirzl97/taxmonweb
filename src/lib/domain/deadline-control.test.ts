import { describe, expect, it } from "vitest";

import { fixtureClients } from "@/lib/fixtures";
import { buildDeadlineControlRows, compliancePeriodLastMonth, compliancePeriodStartFromLabel, deadlineControlSummary, earliestApplicableDeadline, getClientServiceCalendarRows } from "./deadline-control";

describe("deadline control projection", () => {
  it("generates a deterministic annual set with separate statutory and TMF dates", () => {
    const first = buildDeadlineControlRows(2026);
    const second = buildDeadlineControlRows(2026);

    expect(first).toEqual(second);
    expect(first).toHaveLength(108);
    const cit = first.find((row) => row.formNumber === "1702-RT");
    const vatQ1 = first.find((row) => row.formNumber === "2550Q" && row.activityPeriod === "Q1 2026");
    expect(cit?.baseStatutoryDeadline).toBe("2027-04-15");
    expect(cit?.adjustedStatutoryDeadline).toBe("2027-04-15");
    expect(cit?.earliestApplicableDeadline).toBe("2027-04-15");
    expect(cit?.tmfPackageTarget).toBe("2027-04-14");
    expect(cit?.publishedOperationalDeadline).toBe("2027-04-15");
    expect(vatQ1?.adjustedStatutoryDeadline).toBe("2026-04-25");
    expect(vatQ1?.tmfPackageTarget).toBe("2026-04-24");
  });

  it("keeps source verification and publication status distinct", () => {
    const summary = deadlineControlSummary(buildDeadlineControlRows(2026));
    expect(summary).toEqual({ total: 108, published: 5, requiringReview: 4, unresolved: 99 });
    expect(buildDeadlineControlRows(2026).filter((row) => row.publicationStatus === "unresolved").every((row) => row.publishedOperationalDeadline === null)).toBe(true);
    expect(buildDeadlineControlRows(2026).filter((row) => row.publicationStatus === "needs_review").every((row) => row.adjustedStatutoryDeadline !== null)).toBe(true);
    expect(deadlineControlSummary(buildDeadlineControlRows(2027))).toEqual({ total: 108, published: 0, requiringReview: 9, unresolved: 99 });
  });

  it("shows the official BIR calendar as evidence without making it operational", () => {
    const row = buildDeadlineControlRows(2026).find((candidate) => candidate.formNumber === "0619-E");
    expect(row?.officialPublishedDeadline).toBeNull();
    expect(row?.officialCalendarReference).toContain("BIR 2026 Interactive Tax Calendar");
    expect(row?.publicationStatus).toBe("unresolved");
    expect(row?.publishedOperationalDeadline).toBeNull();
  });

  it("exposes every governed return to global Tax Team control", () => {
    const formNumbers = new Set(buildDeadlineControlRows(2026).map((row) => row.formNumber));
    expect(formNumbers).toEqual(new Set(["0619-E", "0619-F", "1600", "1600WP", "1601-C", "1601-EQ", "1601-FQ", "1604-C", "1604-E", "1604-F", "1702Q", "1702-RT", "2550M", "2550Q", "2551M", "2551Q"]));
  });

  it("keeps forms added without a governed deadline unresolved instead of inventing dates", () => {
    const added = buildDeadlineControlRows(2026).filter((row) => ["1601-FQ", "1604-F", "2550M"].includes(row.formNumber));
    expect(added).toHaveLength(17);
    expect(added.every((row) => row.publicationStatus === "unresolved" && row.baseStatutoryDeadline === null && row.earliestApplicableDeadline === null && row.publishedOperationalDeadline === null)).toBe(true);
  });

  it("derives a client's calendar from registered tax types and published rows", () => {
    const vatClient = fixtureClients.find((client) => client.id === "fixture-client-03");
    const whtClient = fixtureClients.find((client) => client.id === "fixture-client-05");
    expect(vatClient).toBeDefined();
    expect(whtClient).toBeDefined();

    const vatCalendar = getClientServiceCalendarRows(vatClient!, 2026);
    expect(vatCalendar.rows).toHaveLength(4);
    expect(vatCalendar.rows.every((row) => row.formNumber === "2550Q" && row.publishedOperationalDeadline)).toBe(true);

    const whtCalendar = getClientServiceCalendarRows(whtClient!, 2026);
    expect(whtCalendar.rows).toHaveLength(0);
    expect(whtCalendar.heldRows.some((row) => row.formNumber === "1601-C" && row.publicationStatus === "unresolved")).toBe(true);
  });

  it("projects the sanitized 2303-derived client into the published 2026 calendar", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();

    const calendar = getClientServiceCalendarRows(client!, 2026);

    expect(calendar.rows).toHaveLength(5);
    expect(calendar.rows.map((row) => row.formNumber)).toEqual(["1702-RT", "2550Q", "2550Q", "2550Q", "2550Q"]);
    expect(calendar.rows.every((row) => row.publishedOperationalDeadline)).toBe(true);
    expect(calendar.rows.map((row) => row.publishedOperationalDeadline)).toEqual([
      "2027-04-15",
      "2026-04-25",
      "2026-07-25",
      "2026-10-25",
      "2027-01-25",
    ]);
    expect(calendar.heldRows).toHaveLength(16);
    expect(calendar.heldRows.every((row) => row.publicationStatus === "unresolved")).toBe(true);
  });

  it("uses selected BIR returns and starts the service calendar at go-live", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();
    const configuredClient = { ...client!, entities: [{ ...client!.entities[0], profile: { ...client!.entities[0].profile, registeredReturnCodes: ["2550Q"], goLiveDate: "2026-07-01" } }] };
    const calendar = getClientServiceCalendarRows(configuredClient, 2026);
    expect(calendar.rows.map((row) => row.activityMonth)).toEqual(["April", "July", "October"]);
    expect(calendar.rows.every((row) => row.formNumber === "2550Q")).toBe(true);
  });

  it("keeps selected returns with missing rules visible and compares go-live with the filing date", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();
    const configuredClient = {
      ...client!,
      entities: [{
        ...client!.entities[0],
        profile: {
          ...client!.entities[0].profile,
          registeredReturnCodes: ["0619E", "0619-F", "1601-C", "2550Q", "1702-RT", "2551Q"],
          goLiveDate: "2026-04-01",
        },
      }],
    };
    const calendar = getClientServiceCalendarRows(configuredClient, 2026);

    expect(calendar.rows.some((row) => row.formNumber === "2550Q" && row.activityMonth === "January" && row.publishedOperationalDeadline === "2026-04-25")).toBe(true);
    expect(calendar.heldRows.some((row) => row.formNumber === "0619-E")).toBe(true);
    expect(calendar.heldRows.some((row) => row.formNumber === "0619-F")).toBe(true);
    expect(calendar.heldRows.some((row) => row.formNumber === "1601-C")).toBe(true);
    expect(calendar.heldRows.some((row) => row.formNumber === "2551Q")).toBe(true);
    expect([...calendar.rows, ...calendar.heldRows].every((row) => !row.publishedOperationalDeadline || row.publishedOperationalDeadline > "2026-04-01")).toBe(true);
  });

  it("does not hide an unresolved annual return based on its activity month", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();
    const configuredClient = {
      ...client!,
      entities: [{
        ...client!.entities[0],
        profile: {
          ...client!.entities[0].profile,
          registeredReturnCodes: ["1604-E"],
          goLiveDate: "2026-10-13",
        },
      }],
    };

    const calendar = getClientServiceCalendarRows(configuredClient, 2026);

    expect(calendar.rows).toHaveLength(0);
    expect(calendar.heldRows.map((row) => row.formNumber)).toEqual(["1604-E"]);
  });

  it("starts a client's generated period set at the first period to file", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-061");
    expect(client).toBeDefined();
    const configuredClient = { ...client!, entities: [{ ...client!.entities[0], profile: { ...client!.entities[0].profile, registeredReturnCodes: ["2550Q"], goLiveDate: "2026-01-01", firstPeriodToFile: "2026-07" } }] };
    const calendar = getClientServiceCalendarRows(configuredClient, 2026);
    expect(calendar.rows.map((row) => row.activityMonth)).toEqual(["July", "October"]);
    expect(calendar.rows.every((row) => row.periodStartDate >= "2026-07-01")).toBe(true);
  });

  it("allows a controlled publication override without changing the statutory calculation", () => {
    const base = buildDeadlineControlRows(2026).find((row) => row.formNumber === "2551Q");
    expect(base).toBeDefined();
    const client = fixtureClients.find((item) => item.id === "fixture-client-03");
    expect(client).toBeDefined();
    const percentageClient = { ...client!, entities: [{ ...client!.entities[0], profile: { ...client!.entities[0].profile, registeredTaxTypes: ["Percentage Tax · illustrative"] } }] };
    const before = getClientServiceCalendarRows(percentageClient, 2026);
    const after = getClientServiceCalendarRows(percentageClient, 2026, { [base!.id]: { status: "published", publishedOperationalDeadline: base!.adjustedStatutoryDeadline } });
    expect(before.rows).toHaveLength(0);
    expect(after.rows.some((row) => row.formNumber === "2551Q")).toBe(true);
    expect(after.rows.find((row) => row.formNumber === "2551Q")?.adjustedStatutoryDeadline).toBe(base!.adjustedStatutoryDeadline);
  });

  it("projects released repository rows without regenerating fixture deadlines", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-03");
    const released = buildDeadlineControlRows(2026).find((row) => row.formNumber === "2550Q" && row.activityPeriod === "Q1 2026");
    expect(client).toBeDefined();
    expect(released).toBeDefined();
    const projection = getClientServiceCalendarRows(client!, 2026, {}, [{ ...released!, id: "released-q1", publicationStatus: "published", publishedOperationalDeadline: "2026-04-25" }]);
    expect(projection.rows).toHaveLength(1);
    expect(projection.rows[0]?.id).toBe("released-q1");
    expect(projection.rows[0]?.publishedOperationalDeadline).toBe("2026-04-25");
  });

  it("applies the first period to file to the compliance period, not the due month", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-03");
    const template = buildDeadlineControlRows(2026).find((row) => row.formNumber === "2550Q" && row.activityPeriod === "Q1 2026");
    expect(client).toBeDefined();
    expect(template).toBeDefined();
    const julyStart = { ...client!, entities: [{ ...client!.entities[0], profile: { ...client!.entities[0].profile, goLiveDate: "2026-01-01", firstPeriodToFile: " 2026-07 " } }] };
    // Monthly periods: a June period due in July is before a July start.
    const released = (id: string, periodStartDate: string, deadline: string) => ({ ...template!, id, periodStartDate, cadence: "Monthly" as const, activityPeriod: periodStartDate ? `Month of ${periodStartDate}` : "Unknown", taxablePeriod: periodStartDate ? `Month of ${periodStartDate}` : "Unknown", publicationStatus: "published" as const, publishedOperationalDeadline: deadline, adjustedStatutoryDeadline: deadline });
    const projection = getClientServiceCalendarRows(julyStart, 2026, {}, [
      released("june-period-due-july", "2026-06-01", "2026-07-10"),
      released("july-period", "2026-07-01", "2026-08-10"),
      released("unknown-period", "", "2026-08-15"),
    ]);
    expect(projection.rows.map((row) => row.id)).toEqual(["july-period", "unknown-period"]);
  });

  it("files the whole quarter and year that cover the first period to file (H-014)", () => {
    const client = fixtureClients.find((item) => item.id === "fixture-client-03");
    const template = buildDeadlineControlRows(2026).find((row) => row.formNumber === "2550Q" && row.activityPeriod === "Q1 2026");
    expect(client).toBeDefined();
    expect(template).toBeDefined();
    const marchStart = { ...client!, entities: [{ ...client!.entities[0], profile: { ...client!.entities[0].profile, goLiveDate: "2026-03-01", firstPeriodToFile: "2026-03" } }] };
    const row = (id: string, label: string, periodStartDate: string, cadence: "Monthly" | "Quarterly" | "Annual", deadline: string) => ({ ...template!, id, activityPeriod: label, taxablePeriod: label, periodStartDate, cadence, publicationStatus: "published" as const, publishedOperationalDeadline: deadline, adjustedStatutoryDeadline: deadline });
    const projection = getClientServiceCalendarRows(marchStart, 2026, {}, [
      row("feb-month", "Month of February 2026", "2026-02-01", "Monthly", "2026-03-10"),
      row("mar-month", "Month of March 2026", "2026-03-01", "Monthly", "2026-04-10"),
      row("q1", "For the Quarter ending March 31, 2026", "2026-01-01", "Quarterly", "2026-04-25"),
      row("q4-2025", "For the Quarter ending December 31, 2025", "2025-10-01", "Quarterly", "2026-04-26"),
      row("year-2026", "Calendar Year 2026", "2026-01-01", "Annual", "2027-01-31"),
    ]);
    expect(projection.rows.map((candidate) => candidate.id).sort()).toEqual(["mar-month", "q1", "year-2026"]);
  });

  it("reads how long a compliance period is from its wording, else its cadence", () => {
    const base = { periodStartDate: "2026-01-01", cadence: "Monthly" as const };
    expect(compliancePeriodLastMonth({ ...base, activityPeriod: "1702Q", taxablePeriod: "For the Quarter ending March 31, 2026" })).toBe("2026-03-01");
    expect(compliancePeriodLastMonth({ ...base, activityPeriod: "1604-C", taxablePeriod: "Calendar Year 2026" })).toBe("2026-12-01");
    expect(compliancePeriodLastMonth({ ...base, activityPeriod: "Q1 2026", taxablePeriod: "Q1 2026" })).toBe("2026-03-01");
    expect(compliancePeriodLastMonth({ ...base, activityPeriod: "1601-C", taxablePeriod: "Month of January 2026" })).toBe("2026-01-01");
    expect(compliancePeriodLastMonth({ periodStartDate: "2025-06-01", cadence: "Annual", activityPeriod: "1702-RT", taxablePeriod: "2025" })).toBe("2026-05-01");
    // A row that says "Month of" is one month even under a quarterly requirement.
    expect(compliancePeriodLastMonth({ periodStartDate: "2026-01-01", cadence: "Quarterly", activityPeriod: "0619-E", taxablePeriod: "Month of January 2026" })).toBe("2026-01-01");
  });

  it("uses the earliest applicable component deadline as the master default", () => {
    expect(earliestApplicableDeadline(["2026-10-25", "2026-10-15", null])).toBe("2026-10-15");
    expect(earliestApplicableDeadline([null, undefined])).toBeNull();
  });

  it("reads the compliance period from the BIR calendar wording, never the due month", () => {
    expect(compliancePeriodStartFromLabel("BIR Form 1601-C (Monthly Remittance Return of Income Taxes Withheld on Compensation) - Non-eFPS Filers. Month of December 2025")).toBe("2025-12-01");
    expect(compliancePeriodStartFromLabel("BIR Form 1601-FQ (Quarterly Remittance Return of Final Income Taxes Withheld) and Quarterly Alphalist of Payees (QAP) - eFPS & Non-eFPS Filers. For the Quarter ending September 30, 2026")).toBe("2026-07-01");
    expect(compliancePeriodStartFromLabel("BIR Form 2550Q (Quarterly Value-Added Tax Return) - eFPS & Non-eFPS Filers. Fiscal Quarter ending July 31, 2026")).toBe("2026-05-01");
    expect(compliancePeriodStartFromLabel("BIR Form 2551Q (Quarterly Percentage Tax Return) - eFPS & Non-eFPS Filers - For the Quarter ending March 31, 2026")).toBe("2026-01-01");
    expect(compliancePeriodStartFromLabel("Proof of eFiled BIR Form 1702-RT/1702-EX/1702-MX with Audited Financial Statements (AFS) - Fiscal Year ending May 31, 2026")).toBe("2025-06-01");
    expect(compliancePeriodStartFromLabel("Sworn Declaration of Motels & Other Similar Establishments. Taxable Year 2025")).toBe("2025-01-01");
    expect(compliancePeriodStartFromLabel("BIR Form 1604-C (Annual Information Return of Income Taxes Withheld on Compensation) and/or BIR Form 1604-F (Annual Information Return of Income Payments Subjected to Final Withholding Taxes) and Related Alphalist. Calendar Year 2025")).toBe("2025-01-01");
    expect(compliancePeriodStartFromLabel("Engagement Letters and Renewals or Subsequent Agreements for Financial Audit by Independent CPAs. Fiscal Year beginning April 1, 2026")).toBe("2026-04-01");
    expect(compliancePeriodStartFromLabel("Contract of Lease and Lessee Information Statement and Other Attachments by Lessors/Sub-Lessors of Commercial Establishments, Buildings or Spaces for Tenants. 2nd Semester of 2025")).toBe("2025-07-01");
    expect(compliancePeriodStartFromLabel("Sworn Statement by every Lessee/Concessionaire/Owner or Operator of Mines & Quarry - 1 st Semester of 2026")).toBe("2026-01-01");
    expect(compliancePeriodStartFromLabel("Consolidated Return of All Transactions based on the Reconciled Data of Stockbrokers. March 16 - 31, 2026")).toBe("2026-03-01");
    expect(compliancePeriodStartFromLabel("Consolidated Return of All Transactions based on the Reconciled Data of Stockbrokers. December 16-31, 2025")).toBe("2025-12-01");
    expect(compliancePeriodStartFromLabel("eFILING & PAYMENT (Online/Manual)")).toBeNull();
    expect(compliancePeriodStartFromLabel(null)).toBeNull();
  });
});
