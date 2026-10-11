import { forms, type FormSeed } from "./tax-foundation-catalog";

/**
 * The intake selector is deliberately limited to forms with a governed tax
 * category. Cross-category payment forms such as 0605 stay in the catalog,
 * but are not proposed as a return selection.
 */
export const governedReturnForms = forms.filter((form) => form.taxTypeCodes.length > 0);

export function normalizeReturnSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function sourceTaxTypeCodesFromWording(sourceWording: string): string[] {
  const source = sourceWording.toLowerCase();
  const codes = new Set<string>();
  if (source.includes("income tax") || /\bcit\b/.test(source)) codes.add("CIT");
  if (source.includes("value added tax") || /\bvat\b/.test(source)) codes.add("VAT");
  if (source.includes("percentage tax")) codes.add("PERCENTAGE_TAX");
  if (source.includes("withholding")) codes.add("WHT");
  return [...codes];
}

export function returnsSuggestedFromSource(sourceWording: string): FormSeed[] {
  const sourceTaxTypes = sourceTaxTypeCodesFromWording(sourceWording);
  const normalizedSource = normalizeReturnSearchText(sourceWording);
  return governedReturnForms.filter((form) => form.taxTypeCodes.some((code) => sourceTaxTypes.includes(code)) || normalizedSource.includes(normalizeReturnSearchText(form.formNumber)));
}

export function returnMatchesSearch(form: FormSeed, query: string) {
  const normalizedQuery = normalizeReturnSearchText(query.trim());
  if (!normalizedQuery) return true;
  return normalizeReturnSearchText(`${form.formNumber} ${form.title}`).includes(normalizedQuery);
}
