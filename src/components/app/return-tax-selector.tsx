"use client";

import { useState } from "react";

import { governedReturnForms, returnMatchesSearch } from "@/lib/domain/client-return-selection";

export function ReturnTaxSelector({ selectedCodes, onChange, invalid = false }: { selectedCodes: string[]; onChange: (codes: string[]) => void; invalid?: boolean }) {
  const [query, setQuery] = useState("");
  const selected = governedReturnForms.filter((form) => selectedCodes.includes(form.formNumber));
  const suggestions = governedReturnForms
    .filter((form) => !selectedCodes.includes(form.formNumber) && returnMatchesSearch(form, query))
    .sort((left, right) => left.formNumber.localeCompare(right.formNumber));
  const add = (formNumber: string) => onChange([...selectedCodes, formNumber]);
  const remove = (code: string) => onChange(selectedCodes.filter((selectedCode) => selectedCode !== code));
  return <section className="onboarding-tax-selector"><div className={invalid ? "form-field form-field--invalid" : "form-field"}><span>Returns to be filed *</span><div className="onboarding-tax-selector__box"><div className="onboarding-tax-selector__selected" aria-live="polite">{selected.length > 0 ? selected.map((form) => <span className="onboarding-tax-chip" key={form.formNumber}><strong>{form.formNumber}</strong><button aria-label={`Remove ${form.formNumber}`} onClick={() => remove(form.formNumber)} type="button">×</button></span>) : <span className="onboarding-tax-selector__empty">Type a return to add</span>}<div className="onboarding-tax-search"><input aria-label="Type a return to add" list="governed-return-forms" onChange={(event) => { const value = event.target.value; const match = governedReturnForms.find((form) => form.formNumber.toLowerCase() === value.trim().toLowerCase()); if (match && !selectedCodes.includes(match.formNumber)) { add(match.formNumber); setQuery(""); } else { setQuery(value); } }} onKeyDown={(event) => { if (event.key === "Backspace" && !query && selectedCodes.length > 0) { event.preventDefault(); onChange(selectedCodes.slice(0, -1)); } }} placeholder="Type a return" value={query} /><datalist id="governed-return-forms">{suggestions.map((form) => <option key={form.formNumber} value={form.formNumber}>{form.title}</option>)}</datalist></div></div></div>{invalid && <small className="form-field__error">Add at least one return</small>}</div></section>;
}
