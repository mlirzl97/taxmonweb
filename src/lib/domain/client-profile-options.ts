import type { BirOfficeOption } from "./bir-office-reference";
import { filingChannels } from "./tax-foundation-catalog";

/**
 * The live client flow loads these references from the governed BIR Center
 * tables. These are the small source-backed fallback values used by the
 * sanitized preview when Supabase is intentionally unavailable.
 */
export const prototypeBirOfficeOptions: readonly BirOfficeOption[] = [
  { code: "RDO-47", name: "East Makati City", label: "RDO 047 - East Makati City" },
  { code: "RDO-48", name: "West Makati City", label: "RDO 048 - West Makati City" },
  { code: "RDO-49", name: "North Makati City", label: "RDO 049 - North Makati City" },
  { code: "RDO-50", name: "South Makati City", label: "RDO 050 - South Makati City" },
];

/** Current source-backed eFPS group labels exposed by the annual BIR reference. */
export const clientEfpsGroupOptions = ["Group A", "Group B", "Group C", "Group D", "Group E"] as const;

export const clientEntityTypeOptions = [
  "Corporation",
  "Partnership",
  "Sole proprietorship",
  "Non-stock corporation",
  "Other approved entity",
  "Needs review",
] as const;

export const clientRegistrationStatusOptions = [
  "Active",
  "Pending validation",
  "Suspended",
  "Closed",
  "Needs review",
] as const;

export const clientAccountingSystemOptions = [
  "Not configured",
  "Manual",
  "CAS / CBA",
  "ERP",
  "Other approved system",
  "Needs review",
] as const;

export const clientBooksOptions = [
  "Not configured",
  "Manual books",
  "Loose-leaf books",
  "Computerized books",
  "Not applicable",
  "Needs review",
] as const;

export const clientInvoicingOptions = [
  "Not configured",
  "ATP receipts / invoices",
  "BIR Printed Receipts / Invoices",
  "CAS / POS / CRM",
  "Not applicable",
  "Needs review",
] as const;

export const clientAuthorityOptions = ["PEZA", "BOI", "DOE", "SEC", "Other approved authority", "Needs review"] as const;

export const clientFilingChannelOptions = ["Not configured", ...filingChannels.map((channel) => channel.label === "Unresolved channel" ? "Needs review" : channel.label)] as const;

export function controlledOptionLabel(value: string | undefined, options: readonly string[], fallback = "Needs review"): string {
  const normalized = value?.trim() ?? "";
  return normalized && options.includes(normalized) ? normalized : normalized ? fallback : "Not configured";
}

export function controlledOptionValue(value: string | undefined, options: readonly string[], fallback = "Needs review"): string {
  const normalized = value?.trim() ?? "";
  return normalized && options.includes(normalized) ? normalized : fallback;
}

export function birOfficeLabel(value: string | undefined, options: readonly BirOfficeOption[] = prototypeBirOfficeOptions): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "Not configured";
  if (/^needs?\s*(review|validation)$/i.test(normalized) || /requires?\s+approved/i.test(normalized) || /rdo\s*\/?\s*lts/i.test(normalized)) return "Needs review";
  const match = options.find((option) => option.code === normalized || option.label === normalized);
  if (match) return match.label;
  const codeMatch = normalized.match(/^RDO[-\s]?([0-9]{1,3})$/i);
  return codeMatch ? `RDO ${codeMatch[1].padStart(3, "0")}` : "Needs review";
}

export function birOfficeCode(value: string | undefined, options: readonly BirOfficeOption[]): string {
  const normalized = value?.trim() ?? "";
  return options.find((option) => option.code === normalized || option.label === normalized)?.code ?? "Needs review";
}

export function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function clientProfileControlErrors(profile: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const check = (key: string, options: readonly string[]) => {
    const value = profile[key];
    if (value !== undefined && value !== null && value !== "" && (typeof value !== "string" || !options.includes(value.trim()))) {
      errors.push(`profileData.${key} must use an approved option.`);
    }
  };
  check("entityType", clientEntityTypeOptions);
  check("registrationStatus", clientRegistrationStatusOptions);
  check("accountingSystem", clientAccountingSystemOptions);
  check("booksType", clientBooksOptions);
  check("invoicing", clientInvoicingOptions);
  check("filingChannel", clientFilingChannelOptions);
  check("eFPSGroup", ["Not configured", "Group A", "Group B", "Group C", "Group D", "Group E", "Not applicable", "Needs review"]);
  check("taxYearBasis", ["Calendar year", "Fiscal year"]);
  const rdo = profile.rdoOrLts;
  if (rdo !== undefined && rdo !== null && rdo !== "" && typeof rdo === "string" && rdo !== "Needs review" && !/^RDO[-\s]?\d{1,3}[A-Z]*$/i.test(rdo.trim())) {
    errors.push("profileData.rdoOrLts must use the approved BIR office code or Needs review.");
  }
  const dates = ["goLiveDate", "registrationEffective"];
  for (const key of dates) {
    const value = profile[key];
    if (value !== undefined && value !== null && value !== "" && (typeof value !== "string" || !isIsoDate(value.trim()))) errors.push(`profileData.${key} must use YYYY-MM-DD.`);
  }
  return errors;
}
