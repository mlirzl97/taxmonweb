"use client";

import { useState } from "react";

import { forms } from "@/lib/domain/tax-foundation-catalog";
import type { BirOfficeReference } from "@/lib/server/bir-center-repository";
import { EmptyState, FixturePageFrame, SectionHeading } from "@/components/app/workspace-components";

type BirTaxpayerLink = { id: string; name: string; group: string; rdoOrLts: string };

const taxTypeGroups: Array<{ code: string; label: string; taxTypeCodes: readonly string[]; cadence: string }> = [
  { code: "CIT", label: "CIT", taxTypeCodes: ["CIT"], cadence: "Annual" },
  { code: "VAT_PERCENTAGE", label: "VAT / Percentage Tax", taxTypeCodes: ["VAT", "PERCENTAGE_TAX"], cadence: "Monthly / Quarterly" },
  { code: "WHT", label: "WHT", taxTypeCodes: ["WHT"], cadence: "Monthly / Quarterly" },
  { code: "OTHERS", label: "Others", taxTypeCodes: ["OTHERS"], cadence: "As-needed" },
] as const;

export function BirCenter({ offices, taxpayers }: { offices: BirOfficeReference[]; taxpayers: BirTaxpayerLink[] }) {
  const [activeTab, setActiveTab] = useState<"tax_map" | "directory">("tax_map");
  const [taxQuery, setTaxQuery] = useState("");
  const [officeQuery, setOfficeQuery] = useState("");
  const [selectedOfficeCode, setSelectedOfficeCode] = useState(() => offices.find((office) => office.code === "RDO-50")?.code ?? offices[0]?.code ?? "");
  const normalizedTaxQuery = taxQuery.trim().toLowerCase();
  const normalizedOfficeQuery = officeQuery.trim().toLowerCase();
  const visibleGroups = taxTypeGroups.filter((group) => {
    const relatedForms = relatedFormsFor(group.taxTypeCodes);
    return matches(normalizedTaxQuery, [group.label, group.code, group.cadence, ...relatedForms.flatMap((form) => [form.formNumber, form.title])]);
  });
  const visibleOffices = offices.filter((office) => matches(normalizedOfficeQuery, [office.code, office.name, office.parentName ?? "", office.cityOrArea ?? ""]));
  const selectedOffice = offices.find((office) => office.code === selectedOfficeCode) ?? visibleOffices[0] ?? offices[0];
  const linkedTaxpayers = selectedOffice ? taxpayers.filter((taxpayer) => officeMatches(taxpayer.rdoOrLts, selectedOffice)) : [];

  return (
    <FixturePageFrame>
      <header className="module-header bir-center-header">
        <div><p className="eyebrow">Reference</p><h1>BIR Center</h1><p className="bir-center-purpose">A quick map of tax types and the BIR offices TaxMonWeb deals with.</p></div>
        <span className="module-count">Read-only reference</span>
      </header>

      <nav aria-label="BIR Center views" className="bir-center-tabs bir-center-tabs--primary">
        <button aria-pressed={activeTab === "tax_map"} className={activeTab === "tax_map" ? "bir-center-tab is-active" : "bir-center-tab"} onClick={() => setActiveTab("tax_map")} type="button">Tax map</button>
        <button aria-pressed={activeTab === "directory"} className={activeTab === "directory" ? "bir-center-tab is-active" : "bir-center-tab"} onClick={() => setActiveTab("directory")} type="button">BIR directory</button>
      </nav>

      {activeTab === "tax_map" ? <TaxMap groups={visibleGroups} query={taxQuery} onQueryChange={setTaxQuery} /> : <BirDirectory offices={visibleOffices} selectedOffice={selectedOffice} selectedOfficeCode={selectedOfficeCode} linkedTaxpayers={linkedTaxpayers} query={officeQuery} onQueryChange={setOfficeQuery} onSelect={setSelectedOfficeCode} />}
    </FixturePageFrame>
  );
}

function TaxMap({ groups, query, onQueryChange }: { groups: readonly (typeof taxTypeGroups[number])[]; query: string; onQueryChange: (value: string) => void }) {
  return <section className="panel bir-center-panel bir-tax-map" aria-labelledby="tax-map-title">
    <div className="bir-center-section-head"><div><SectionHeading title="Tax types" /><p id="tax-map-title" className="bir-center-section-note">Forms and usual filing cadence. Use Calendar for dates.</p></div><label className="search-control bir-center-search"><span className="sr-only">Search tax types and forms</span><input aria-label="Search tax types and forms" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search tax type or form" type="search" value={query} /></label></div>
    <div className="bir-tax-map__header"><span>Tax type</span><span>Forms</span><span>Typical timing</span></div>
    <div className="bir-tax-map__rows">{groups.map((group) => {
      const relatedForms = relatedFormsFor(group.taxTypeCodes);
      return <details className="bir-tax-map__row" key={group.code}><summary><span className="bir-tax-map__tax"><strong>{group.label}</strong><small>{relatedForms.length} mapped {relatedForms.length === 1 ? "form" : "forms"}</small></span><span className="bir-tax-map__forms">{relatedForms.length > 0 ? relatedForms.map((form) => form.formNumber).join(" · ") : "No form mapped"}</span><span>{group.cadence}</span></summary><div className="bir-tax-map__detail"><strong>Related forms</strong>{relatedForms.length > 0 ? <ul className="bir-linked-forms">{relatedForms.map((form) => <li key={form.formNumber}><span><b>{form.formNumber}</b> · {form.title}</span></li>)}</ul> : <p>No form mapped yet.</p>}<span>Specific due dates appear in the calendar.</span></div></details>;
    })}</div>
    <p className="bir-center-cross-category"><strong>Cross-category</strong> · BIR Form 0605 is a payment form and is not assigned to one tax type.</p>
    {groups.length === 0 && <InlineNoMatch />}
  </section>;
}

function BirDirectory({ offices, selectedOffice, selectedOfficeCode, linkedTaxpayers, query, onQueryChange, onSelect }: { offices: BirOfficeReference[]; selectedOffice?: BirOfficeReference; selectedOfficeCode: string; linkedTaxpayers: BirTaxpayerLink[]; query: string; onQueryChange: (value: string) => void; onSelect: (code: string) => void }) {
  return <section className="panel bir-center-panel bir-directory" aria-labelledby="bir-directory-title">
    <div className="bir-center-section-head"><div><SectionHeading title="BIR directory" /><p id="bir-directory-title" className="bir-center-section-note">Find an office, see how to contact it, and see TaxMonWeb taxpayers linked to it.</p></div><label className="search-control bir-center-search"><span className="sr-only">Search BIR offices</span><input aria-label="Search BIR offices" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search office code or name" type="search" value={query} /></label></div>
    <div className="bir-directory__layout">
      <div className="bir-directory__list" role="listbox" aria-label="BIR offices">{offices.map((office) => <button aria-selected={selectedOfficeCode === office.code} className={selectedOfficeCode === office.code ? "bir-directory__office is-selected" : "bir-directory__office"} key={office.code} onClick={() => onSelect(office.code)} role="option" type="button"><strong>{office.code}</strong><span>{office.name}</span><small>{office.officeType === "revenue_region" ? "Revenue Region" : office.parentName ?? office.officeType}</small></button>)}{offices.length === 0 && <InlineNoMatch />}</div>
      {selectedOffice ? <OfficeDetail office={selectedOffice} linkedTaxpayers={linkedTaxpayers} /> : <EmptyState title="Select a BIR office" description="Search by code or name to view the directory record." />}
    </div>
  </section>;
}

function OfficeDetail({ office, linkedTaxpayers }: { office: BirOfficeReference; linkedTaxpayers: BirTaxpayerLink[] }) {
  return <aside className="bir-directory__detail" aria-label={`${office.code} details`}><div className="bir-directory__detail-head"><div><p className="eyebrow">{office.officeType === "revenue_region" ? "Revenue Region" : "Revenue District Office"}</p><h2>{office.code} · {office.name}</h2></div><span className={`bir-reference-status bir-reference-status--${office.notes ? "partially_verified" : "unresolved"}`}>{office.notes ? "Contact context" : "Contact pending"}</span></div><dl className="bir-directory__facts"><div><dt>Location</dt><dd>{office.address ?? "Not recorded"}{office.cityOrArea ? ` · ${office.cityOrArea}` : ""}</dd></div><div><dt>Email</dt><dd>{office.publicEmail ? <a href={`mailto:${office.publicEmail}`}>{office.publicEmail}</a> : "Not recorded"}</dd></div><div><dt>Telephone</dt><dd>{office.publicTelephone ?? "Not recorded"}</dd></div></dl><div className="bir-directory__block"><SectionHeading title="Named contacts" /><p>{"No source-backed officer names are recorded for this office."}</p></div><div className="bir-directory__block"><SectionHeading title="TaxMonWeb taxpayers" /><strong className="bir-directory__client-count">{linkedTaxpayers.length}</strong><span>{linkedTaxpayers.length === 1 ? "linked taxpayer" : "linked taxpayers"}</span>{linkedTaxpayers.length > 0 && <ul className="bir-directory__clients">{linkedTaxpayers.map((taxpayer) => <li key={taxpayer.id}><strong>{taxpayer.name}</strong><small>{taxpayer.group}</small></li>)}</ul>}{linkedTaxpayers.length === 0 && <p>No taxpayer is currently linked to this canonical office in the available data.</p>}</div>{office.notes && <p className="bir-directory__note">{office.notes}</p>}</aside>;
}

function relatedFormsFor(codes: readonly string[]) { return forms.filter((form) => form.taxTypeCodes.some((code) => codes.includes(code))); }
function officeMatches(value: string, office: BirOfficeReference) { const normalized = value.toLowerCase(); return normalized.includes(office.code.toLowerCase()) || normalized.includes(office.name.toLowerCase()); }
function matches(query: string, values: string[]) { return !query || values.some((value) => value.toLowerCase().includes(query)); }
function InlineNoMatch() { return <p className="bir-center-no-match">No matching records.</p>; }
