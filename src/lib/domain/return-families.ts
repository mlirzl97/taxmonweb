import type { FixtureClient } from "@/lib/fixtures";

import type { DeadlineControlRow } from "./deadline-control";
import { calculateInternalTarget } from "./tax-foundation";

/**
 * Return families as the HOD set them on 2026-10-22. Each family is read by
 * month of the quarter: payment forms in months 1–2, the full quarterly return
 * covering the quarter, then any annual return.
 *
 * - VAT: 2550M (optional, client-elected) · 2550Q.
 * - Expanded withholding: 0619-E · 1601-EQ · 1604-E.
 * - Final withholding: 0619-F · 1601-FQ · 1604-F.
 * - Compensation withholding: 1601-C every month · 1604-C.
 * - Percentage tax: 2551M (optional, client-elected) · 2551Q.
 * - Corporate income tax: 1702Q for quarters 1–3 · the annual 1702.
 *
 * Withholding, VAT and percentage tax run on calendar quarters. Corporate
 * income tax follows the client's own fiscal year.
 */
export type ReturnFamily = {
  id: "vat" | "expanded_withholding" | "final_withholding" | "compensation_withholding" | "percentage_tax" | "corporate_income_tax";
  label: string;
  monthly?: { form: string; months: "first_two_of_quarter" | "every_month"; optional?: boolean };
  quarterly?: string;
  annual?: readonly string[];
  yearBasis: "calendar" | "fiscal";
};

export const returnFamilies: readonly ReturnFamily[] = [
  { id: "vat", label: "VAT", monthly: { form: "2550M", months: "first_two_of_quarter", optional: true }, quarterly: "2550Q", yearBasis: "calendar" },
  { id: "expanded_withholding", label: "Expanded withholding", monthly: { form: "0619-E", months: "first_two_of_quarter" }, quarterly: "1601-EQ", annual: ["1604-E"], yearBasis: "calendar" },
  { id: "final_withholding", label: "Final withholding", monthly: { form: "0619-F", months: "first_two_of_quarter" }, quarterly: "1601-FQ", annual: ["1604-F"], yearBasis: "calendar" },
  { id: "compensation_withholding", label: "Compensation withholding", monthly: { form: "1601-C", months: "every_month" }, annual: ["1604-C"], yearBasis: "calendar" },
  { id: "percentage_tax", label: "Percentage tax", monthly: { form: "2551M", months: "first_two_of_quarter", optional: true }, quarterly: "2551Q", yearBasis: "calendar" },
  { id: "corporate_income_tax", label: "Corporate income tax", quarterly: "1702Q", annual: ["1702-RT", "1702-EX", "1702-MX"], yearBasis: "fiscal" },
];

/** The TMF due day for an elected optional monthly return; the BIR sets none. */
export const optionalMonthlyTmfDueDay = 20;

const familyForms = returnFamilies.flatMap((family) => [family.monthly?.form, family.quarterly, ...(family.annual ?? [])].filter((form): form is string => Boolean(form)));

export function familyForForm(form: string): ReturnFamily | undefined {
  return returnFamilies.find((family) => family.monthly?.form === form || family.quarterly === form || family.annual?.includes(form));
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The family forms a BIR calendar label names, e.g. the combined "1601-C and/or 0619-E and/or 0619-F" rows. */
export function formsNamedInLabel(label: string): string[] {
  const text = label.toUpperCase().replace(/\s+/g, " ");
  const named = familyForms.filter((form) => {
    if (form.startsWith("1702-")) return false;
    const pattern = form.replace("-", "[- ]?");
    return new RegExp(`(?<![0-9A-Z])${pattern}(?![0-9A-Z])`).test(text);
  });
  // The annual 1702 is printed as "1702 - RT/EX/MX"; keep the client's own variant later.
  if (/(?<![0-9])1702 ?- ?(?:RT|EX|MX)/.test(text)) named.push("1702-RT", "1702-EX", "1702-MX");
  return [...new Set(named)];
}

function monthIndexOf(name: string): number {
  return monthNames.findIndex((month) => month.toLowerCase() === name.toLowerCase());
}

/** The fiscal year-end month (0–11) of a fiscal-year client, or null for a calendar-year client. */
export function fiscalYearEndMonth(client: FixtureClient): number | null {
  const profile = client.entities[0]?.profile;
  if (profile?.taxYearBasis !== "Fiscal year") return null;
  const match = /^([A-Za-z]+)/.exec(profile.fiscalYearEnd?.trim() ?? "");
  const index = match ? monthIndexOf(match[1]) : -1;
  return index >= 0 ? index : null;
}

function labelEndMonth(label: string, kind: "Quarter" | "Year"): number | null {
  const match = new RegExp(`${kind} ending (${monthNames.join("|")})`, "i").exec(label);
  return match ? monthIndexOf(match[1]) : null;
}

/** Strip filing-channel and eFPS-group wording so variants of one return and period read the same. */
function periodText(label: string): string {
  const text = label.replace(/\s+/g, " ");
  const period = /(Month of [A-Za-z]+ \d{4}|(?:Fiscal )?Quarter ending [A-Za-z]+ \d{1,2}, \d{4}|(?:Fiscal |Taxable )?Year ending [A-Za-z]+ \d{1,2}, \d{4}|(?:Calendar|Taxable) Year \d{4}|Fiscal Year beginning [A-Za-z]+ \d{1,2}, \d{4})/i.exec(text);
  return period ? period[1] : text;
}

export type ReturnFamilyProjection = { rows: DeadlineControlRow[]; notices: string[] };

/**
 * Turns the published BIR calendar rows into one row per return and period for
 * this client:
 * - combined rows are split into the forms they name;
 * - eFPS-group and filing-channel variants collapse to the earliest date;
 * - payment forms appear only in months 1–2 of a quarter;
 * - calendar-basis families ignore fiscal-quarter rows;
 * - corporate income tax follows the client's fiscal year;
 * - elected 2550M/2551M get the TMF due date.
 *
 * Rows that name no family form pass through unchanged.
 */
export function projectReturnFamilyCalendar(client: FixtureClient, candidateForms: readonly string[], rows: readonly DeadlineControlRow[], year: number): ReturnFamilyProjection {
  const candidates = new Set(candidateForms);
  const yearEndMonth = fiscalYearEndMonth(client);
  const notices: string[] = [];
  // VAT and percentage-tax quarters follow the calendar only when the fiscal
  // year ends on a calendar quarter; any other year-end goes to the Tax Team.
  const quarterAligned = yearEndMonth === null || yearEndMonth % 3 === 2;
  if (!quarterAligned && [...candidates].some((form) => {
    const family = familyForForm(form);
    return family?.id === "vat" || family?.id === "percentage_tax";
  })) {
    notices.push(`The fiscal year ends in ${monthNames[yearEndMonth ?? 0]}, which is not a calendar quarter-end. VAT and percentage-tax dates are held for Tax Team review.`);
  }

  const kept = new Map<string, DeadlineControlRow>();
  const passThrough: DeadlineControlRow[] = [];
  for (const row of rows) {
    const label = `${row.activityPeriod} ${row.taxablePeriod}`;
    const named = formsNamedInLabel(label);
    if (named.length === 0) {
      passThrough.push(row);
      continue;
    }
    const fiscalLabel = /fiscal/i.test(label);
    for (const form of named.filter((candidate) => candidates.has(candidate))) {
      const family = familyForForm(form);
      if (!family) continue;
      if ((family.id === "vat" || family.id === "percentage_tax") && !quarterAligned) continue;
      if (family.yearBasis === "calendar" || yearEndMonth === null) {
        if (fiscalLabel) continue;
      } else {
        // A fiscal-year client keeps only its own fiscal quarters and year-end.
        if (!fiscalLabel) continue;
        const quarterEnd = labelEndMonth(label, "Quarter");
        const yearEnd = labelEndMonth(label, "Year");
        if (quarterEnd !== null && (quarterEnd === yearEndMonth || (yearEndMonth - quarterEnd + 12) % 3 !== 0)) continue;
        if (quarterEnd === null && yearEnd !== null && yearEnd !== yearEndMonth) continue;
      }
      if (family.monthly?.form === form && family.monthly.months === "first_two_of_quarter" && row.periodStartDate) {
        const monthIndex = Number(row.periodStartDate.slice(5, 7)) - 1;
        if (monthIndex % 3 === 2) continue;
      }
      const due = row.publishedOperationalDeadline ?? row.earliestApplicableDeadline;
      const period = periodText(label);
      // Submitting proof of filing with attachments (e.g. AFS via eAFS) is its
      // own deadline, distinct from filing the return for the same period.
      const proofOfFiling = /^\s*proof of e-?filed/i.test(row.activityPeriod);
      const key = `${form}|${proofOfFiling ? "proof" : "return"}|${row.periodStartDate || period}|${fiscalLabel ? "fiscal" : "calendar"}`;
      const existing = kept.get(key);
      const existingDue = existing?.publishedOperationalDeadline ?? existing?.earliestApplicableDeadline;
      // The earliest date across filing channels and eFPS groups governs.
      if (existing && existingDue && (!due || existingDue <= due)) continue;
      kept.set(key, {
        ...row,
        id: `${row.id}:${form}`,
        formNumber: form,
        activityPeriod: `${proofOfFiling ? `${form} proof of filing and attachments` : form} · ${period}`,
        taxablePeriod: period,
        earliestApplicableDeadline: due,
        publishedOperationalDeadline: row.publishedOperationalDeadline ? due : null,
        tmfPackageTarget: due ? calculateInternalTarget(due) : row.tmfPackageTarget,
        explanation: `${family.label} · earliest published date across filing channels and eFPS groups.`,
      });
    }
  }

  const elected = returnFamilies
    .filter((family) => family.monthly?.optional && candidates.has(family.monthly.form) && (quarterAligned || (family.id !== "vat" && family.id !== "percentage_tax")))
    .flatMap((family) => optionalMonthlyRows(family, year));
  return { rows: [...kept.values(), ...elected, ...passThrough], notices };
}

function optionalMonthlyRows(family: ReturnFamily, year: number): DeadlineControlRow[] {
  const form = family.monthly?.form ?? "";
  return [0, 1, 3, 4, 6, 7, 9, 10].map((monthIndex) => {
    const periodStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
    const dueMonth = monthIndex + 1;
    const due = `${year}-${String(dueMonth + 1).padStart(2, "0")}-${String(optionalMonthlyTmfDueDay).padStart(2, "0")}`;
    const period = `Month of ${monthNames[monthIndex]} ${year}`;
    return {
      id: `tmf-${form}-${periodStart.slice(0, 7)}`,
      calendarYear: year,
      requirementCode: `TMF-${form}`,
      requirementLabel: `${form} · optional, client-elected`,
      formNumber: form,
      taxCategory: "vat_percentage",
      cadence: "Monthly",
      component: "Return / filing",
      activityMonth: monthNames[dueMonth],
      activityPeriod: `${form} · ${period}`,
      periodStartDate: periodStart,
      taxablePeriod: period,
      baseStatutoryDeadline: null,
      adjustedStatutoryDeadline: null,
      officialPublishedDeadline: null,
      officialCalendarReference: null,
      earliestApplicableDeadline: due,
      publishedOperationalDeadline: due,
      tmfPackageTarget: calculateInternalTarget(due),
      publicationStatus: "published",
      verificationStatus: "unresolved",
      ruleVersionId: "hod-policy-2026-10-22-optional-monthly",
      sourceCode: "hod-policy",
      sourceLabel: "TMF due date (no BIR deadline)",
      adjustmentReason: "",
      explanation: `${family.label} · ${form} is filed only when the client elects it. TMF due date is the ${optionalMonthlyTmfDueDay}th of the following month (HOD policy, 2026-10-22); the BIR sets no deadline.`,
    } satisfies DeadlineControlRow;
  });
}
