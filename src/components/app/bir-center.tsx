"use client";

import { useState } from "react";

import type { BirOfficeReference } from "@/lib/server/bir-center-repository";
import type { TaxFoundationForm, TaxFoundationTaxType } from "@/lib/server/tax-foundation-repository";
import { DetailDrawer, EmptyState, FixturePageFrame, SectionHeading } from "@/components/app/workspace-components";

type BirAuditLink = { taxpayerName: string; taxableYear: string; matter: string; status: string; officerName?: string; officerRole?: string; officerContact?: string };
type BirTaxpayerLink = { id: string; name: string; group: string; rdoOrLts: string; audits: readonly BirAuditLink[] };
type OfficeGroup = "rdo" | "rr" | "national_office";

type TaxTypeGroup = { code: string; label: string; taxTypeCodes: readonly string[]; forms: readonly TaxFoundationForm[]; cadence: string };

export function BirCenter({ offices, taxpayers, taxTypes, forms }: { offices: BirOfficeReference[]; taxpayers: BirTaxpayerLink[]; taxTypes: TaxFoundationTaxType[]; forms: TaxFoundationForm[] }) {
  const [activeTab, setActiveTab] = useState<"tax_map" | "directory" | "regulatory_updates">("tax_map");
  const [taxQuery, setTaxQuery] = useState("");
  const [officeQuery, setOfficeQuery] = useState("");
  const [officeDetailOpen, setOfficeDetailOpen] = useState(false);
  const [selectedOfficeCode, setSelectedOfficeCode] = useState(() => offices.find((office) => office.code === "RDO-50")?.code ?? offices[0]?.code ?? "");
  const normalizedTaxQuery = taxQuery.trim().toLowerCase();
  const normalizedOfficeQuery = officeQuery.trim().toLowerCase();
  const taxTypeGroups = buildTaxTypeGroups(taxTypes);
  const visibleGroups = taxTypeGroups.filter((group) => {
    return matches(normalizedTaxQuery, [group.label, group.code, group.cadence, ...group.forms.flatMap((form) => [form.formNumber, form.title])]);
  });
  const visibleOffices = offices.filter((office) => matches(normalizedOfficeQuery, [office.code, office.name, office.parentName ?? "", office.cityOrArea ?? ""]));
  const selectedOffice = offices.find((office) => office.code === selectedOfficeCode) ?? visibleOffices[0] ?? offices[0];
  const linkedTaxpayers = selectedOffice ? taxpayers.filter((taxpayer) => officeMatches(taxpayer.rdoOrLts, selectedOffice)) : [];

  return (
    <FixturePageFrame>
      <header className="module-header bir-center-header">
        <div><p className="eyebrow">Reference</p><h1>BIR Center</h1><p className="bir-center-purpose">A shared reference for tax types, forms, and BIR offices.</p></div>
        <div className="module-header__right"><span className="module-count">Governed reference</span></div>
      </header>

      <nav aria-label="BIR Center views" className="bir-center-tabs bir-center-tabs--primary module-tabs">
        <button aria-pressed={activeTab === "tax_map"} className={activeTab === "tax_map" ? "bir-center-tab is-active" : "bir-center-tab"} onClick={() => setActiveTab("tax_map")} type="button">Tax map</button>
        <button aria-pressed={activeTab === "directory"} className={activeTab === "directory" ? "bir-center-tab is-active" : "bir-center-tab"} onClick={() => setActiveTab("directory")} type="button">BIR directory</button>
        <button aria-pressed={activeTab === "regulatory_updates"} className={activeTab === "regulatory_updates" ? "bir-center-tab is-active" : "bir-center-tab"} onClick={() => setActiveTab("regulatory_updates")} type="button">Regulatory updates</button>
      </nav>

      {activeTab === "tax_map" ? <TaxMap groups={visibleGroups} forms={forms} query={taxQuery} onQueryChange={setTaxQuery} /> : activeTab === "directory" ? <BirDirectory offices={visibleOffices} selectedOffice={selectedOffice} selectedOfficeCode={selectedOfficeCode} linkedTaxpayers={linkedTaxpayers} query={officeQuery} onQueryChange={setOfficeQuery} onSelect={(code) => { setSelectedOfficeCode(code); setOfficeDetailOpen(true); }} onCloseDetails={() => setOfficeDetailOpen(false)} detailOpen={officeDetailOpen} /> : <RegulatoryUpdates />}
  </FixturePageFrame>
  );
}

function RegulatoryUpdates() {
  return <section className="panel bir-center-panel bir-regulatory-updates" aria-labelledby="regulatory-updates-title">
    <div className="bir-center-section-head">
      <div><SectionHeading title="Regulatory updates" /><p id="regulatory-updates-title" className="bir-center-section-note">Published, source-backed notices that may require a controlled impact review.</p></div>
      <span className="module-count">Read-only</span>
    </div>
    <div className="bir-regulatory-updates__empty">
      <span className="eyebrow">No published updates</span>
      <h2>New RR and RMC notices will appear here after review.</h2>
      <p>The Tax Team or an authorized administrator will record the official source, explain the relevance, and complete the required impact assessment before publication.</p>
      <p className="bir-center-section-note">A published notice can inform Control Tower attention, but it will not change deadlines, profiles, obligations, or work automatically.</p>
    </div>
  </section>;
}

function TaxMap({ groups, forms, query, onQueryChange }: { groups: readonly TaxTypeGroup[]; forms: readonly TaxFoundationForm[]; query: string; onQueryChange: (value: string) => void }) {
  return <section className="panel bir-center-panel bir-tax-map" aria-labelledby="tax-map-title">
    <div className="bir-center-section-head"><div><SectionHeading title="Tax types" /><p id="tax-map-title" className="bir-center-section-note">Tax types and forms. Timing is unresolved until requirements are approved.</p></div><label className="search-control bir-center-search"><span className="sr-only">Search tax types and forms</span><input aria-label="Search tax types and forms" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search tax type or form" type="search" value={query} /></label></div>
    <div className="bir-tax-map__header"><span>Tax type</span><span>Forms</span><span>Typical timing</span></div>
    <div className="bir-tax-map__rows">{groups.map((group) => {
      const relatedForms = group.forms;
      return <details className="bir-tax-map__row" key={group.code}><summary><span className="bir-tax-map__tax"><strong>{group.label}</strong><small>{relatedForms.length} mapped {relatedForms.length === 1 ? "form" : "forms"}</small></span><span className="bir-tax-map__forms">{relatedForms.length > 0 ? relatedForms.map((form) => form.formNumber).join(" · ") : "No approved mapping"}</span><span>{group.cadence}</span></summary><div className="bir-tax-map__detail"><strong>Related forms</strong>{relatedForms.length > 0 ? <ul className="bir-linked-forms">{relatedForms.map((form) => <li key={form.formNumber}><span><b>{form.formNumber}</b> · {form.title}</span><small className={`bir-form-timing bir-form-timing--${form.verificationStatus}`}>Cadence unresolved</small></li>)}</ul> : <p>No approved form mapping yet.</p>}<span>Form relationships and timing appear after an approved Requirement Master version is linked.</span></div></details>;
    })}</div>
    <div className="bir-center-cross-category"><strong>Forms awaiting mapping</strong>{forms.length > 0 ? <ul className="bir-linked-forms">{forms.map((form) => <li key={`${form.formNumber}-${form.revisionLabel}`}><span><b>{form.formNumber}</b> · {form.title}</span><small>Requirement mapping unresolved</small></li>)}</ul> : <p>No form records are currently available in the governed master.</p>}</div>
    {groups.length === 0 && <InlineNoMatch />}
  </section>;
}

function BirDirectory({ offices, selectedOffice, selectedOfficeCode, linkedTaxpayers, query, onQueryChange, onSelect, onCloseDetails, detailOpen }: { offices: BirOfficeReference[]; selectedOffice?: BirOfficeReference; selectedOfficeCode: string; linkedTaxpayers: BirTaxpayerLink[]; query: string; onQueryChange: (value: string) => void; onSelect: (code: string) => void; onCloseDetails: () => void; detailOpen: boolean }) {
  const groupedOffices = groupOffices(offices);

  return <section className="panel bir-center-panel bir-directory" aria-labelledby="bir-directory-title">
    <div className="bir-center-section-head"><div><SectionHeading title="BIR directory" /><p id="bir-directory-title" className="bir-center-section-note">Find an office, its contact details, and the taxpayers linked to it.</p></div><div className="bir-directory__controls"><label className="search-control bir-center-search"><span className="sr-only">Search BIR offices</span><input aria-label="Search BIR offices" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search office code or name" type="search" value={query} /></label></div></div>
    <div className="bir-directory__layout">
      <div className="bir-directory__list" role="listbox" aria-label="BIR offices">{groupedOffices.map((group) => <OfficeGroupSection group={group} key={group.code} selectedOfficeCode={selectedOfficeCode} onSelect={onSelect} />)}</div>
      <EmptyState title="Select an office" description="Choose an RDO, RR, or National Office record to open its details." />
    </div>
    {detailOpen && selectedOffice && <OfficeDetailDrawer office={selectedOffice} linkedTaxpayers={linkedTaxpayers} onClose={onCloseDetails} />}
  </section>;
}

function OfficeGroupSection({ group, selectedOfficeCode, onSelect }: { group: { code: OfficeGroup; label: string; offices: readonly BirOfficeReference[] }; selectedOfficeCode: string; onSelect: (code: string) => void }) {
  const [open, setOpen] = useState(group.code === "rdo");

  return <details className="bir-directory__group" open={open}><summary className="bir-directory__group-head" onClick={(event) => { event.preventDefault(); setOpen((current) => !current); }}><strong>{group.label}</strong><span>{group.offices.length}</span></summary>{group.offices.length > 0 ? group.offices.map((office) => <button aria-selected={selectedOfficeCode === office.code} className={selectedOfficeCode === office.code ? "bir-directory__office is-selected" : "bir-directory__office"} key={office.code} onClick={() => onSelect(office.code)} role="option" type="button"><strong>{displayOfficeCode(office.code)}</strong><span>{office.name}</span><small>{office.parentName ?? office.officeType}</small></button>) : <p className="bir-directory__group-empty">No office records in this group.</p>}</details>;
}

function OfficeDetailDrawer({ office, linkedTaxpayers, onClose }: { office: BirOfficeReference; linkedTaxpayers: BirTaxpayerLink[]; onClose: () => void }) {
  const auditCount = linkedTaxpayers.reduce((count, taxpayer) => count + taxpayer.audits.filter((audit) => audit.status !== "Closed").length, 0);
  const officerContacts = Array.from(new Map(linkedTaxpayers.flatMap((taxpayer) => taxpayer.audits.filter((audit) => audit.officerName).map((audit) => [audit.officerName, audit] as const))).values());

  return <DetailDrawer eyebrow={officeGroupLabel(office)} title={`${displayOfficeCode(office.code)} · ${office.name}`} subtitle="Office reference and TaxMonWeb audit context." onClose={onClose}>
    <div className="bir-directory__detail" aria-label={office.code + " details"}>
      <p className={`bir-directory__drawer-status bir-reference-status bir-reference-status--${office.notes ? "partially_verified" : "unresolved"}`}>{office.notes ? "Contact context" : "Contact pending"}</p>
      {office.notes && <p className="bir-directory__note">{office.notes}</p>}
      <div aria-label={office.code + " summary"} className="bir-office-pulse">
        <div><strong>{linkedTaxpayers.length}</strong><span>Taxpayers</span></div>
        <div><strong>{auditCount}</strong><span>Open audits</span></div>
        <div><strong>{office.publicTelephone ? "On file" : "—"}</strong><span>Telephone</span></div>
        <div><strong>Not recorded</strong><span>Officers</span></div>
      </div>
      <div className="bir-directory__block"><SectionHeading title="Tax audit" />{linkedTaxpayers.length > 0 ? <ul className="bir-directory__audit-list">{linkedTaxpayers.flatMap((taxpayer) => taxpayer.audits.length > 0 ? taxpayer.audits.map((audit, index) => <li key={taxpayer.id + "-" + audit.taxableYear + "-" + index}><strong>{taxpayer.name}</strong><div className="bir-directory__audit-detail"><span>{audit.matter} · {audit.taxableYear}</span><small><b className={`bir-audit-status bir-audit-status--${audit.status.toLowerCase().replace(/\s+/g, "-")}`}>{audit.status}</b> · {audit.officerName ?? "Officer not recorded"}{audit.officerRole ? ` · ${audit.officerRole}` : ""}</small></div></li>) : [<li className="bir-directory__audit-list--clear" key={taxpayer.id}><strong>{taxpayer.name}</strong><div className="bir-directory__audit-detail"><span>No audit recorded</span><small>TaxMonWeb taxpayer · Officer not recorded</small></div></li>])}</ul> : <p>No TaxMonWeb taxpayer is currently linked to this office.</p>}</div>
      <div className="bir-directory__block"><SectionHeading title="Office contact" /><dl className="bir-directory__facts"><div><dt>Location</dt><dd>{office.address ?? "Not recorded"}{office.cityOrArea ? ` · ${office.cityOrArea}` : ""}</dd></div><div><dt>Email</dt><dd>{office.publicEmail ? <a href={`mailto:${office.publicEmail}`}>{office.publicEmail}</a> : "Not recorded"}</dd></div><div><dt>Telephone</dt><dd>{office.publicTelephone ?? "Not recorded"}</dd></div></dl></div>
      {office.contacts.length > 0 && <div className="bir-directory__block"><SectionHeading title={office.officeType === "national_office" ? "National Office contacts" : "Contact directory"} /><ul className="bir-directory__audit-list bir-directory__contact-list">{office.contacts.map((contact) => <li key={`${contact.group}-${contact.room ?? ""}`}><strong>{contact.group}</strong><div className="bir-directory__audit-detail"><span>{contact.room ?? "Contact"}</span><small>{contact.telephone ?? "Telephone not recorded"}{contact.email ? ` · ${contact.email}` : ""}</small></div></li>)}</ul><p className="bir-directory__source-note">{office.contacts[0]?.notes ?? "Source-backed contact reference."}</p></div>}
      <div className="bir-directory__block"><SectionHeading title="Officer contacts" />{officerContacts.length > 0 ? <ul className="bir-directory__audit-list bir-directory__officer-list">{officerContacts.map((audit) => <li key={audit.officerName}><strong>{audit.officerName}</strong><span>{audit.officerRole ?? "BIR officer"}</span><small>{audit.officerContact ?? "Contact not recorded"}</small></li>)}</ul> : <p>No source-backed officer names or officer-specific contact details are recorded for this office.</p>}</div>
    </div>
  </DetailDrawer>;
}

function buildTaxTypeGroups(taxTypes: readonly TaxFoundationTaxType[]): TaxTypeGroup[] {
  const definitions: Array<{ code: string; label: string; codes: readonly string[]; cadence: string }> = [
    { code: "CIT", label: "CIT", codes: ["CIT"], cadence: "Unresolved" },
    { code: "VAT_PERCENTAGE", label: "VAT / Percentage Tax", codes: ["VAT", "PERCENTAGE_TAX"], cadence: "Unresolved" },
    { code: "WHT", label: "WHT", codes: ["WHT"], cadence: "Unresolved" },
    { code: "OTHERS", label: "Others", codes: ["OTHERS"], cadence: "Unresolved" },
  ];
  return definitions.map((definition) => ({
    code: definition.code,
    label: definition.label,
    taxTypeCodes: taxTypes.filter((taxType) => definition.codes.includes(taxType.code)).map((taxType) => taxType.code),
    forms: [],
    cadence: definition.cadence,
  }));
}
function officeGroupFor(office?: BirOfficeReference): OfficeGroup {
  if (office?.officeType === "revenue_region") return "rr";
  if (office?.officeType === "rdo") return "rdo";
  return "national_office";
}
function officeGroupLabel(office: BirOfficeReference): string {
  if (office.officeType === "revenue_region") return "RR";
  if (office.officeType === "rdo") return "RDO";
  return "National Office";
}
function groupOffices(offices: readonly BirOfficeReference[]) {
  const labels: Record<OfficeGroup, string> = { rdo: "RDO", rr: "RR", national_office: "National Office" };
  return (Object.keys(labels) as OfficeGroup[]).map((code) => ({ code, label: labels[code], offices: offices.filter((office) => officeGroupFor(office) === code).toSorted((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true, sensitivity: "base" })) }));
}
function displayOfficeCode(code: string): string {
  const match = code.match(/^RDO-(\d+)([A-Z]+)?$/i);
  return match ? `RDO-${match[1].padStart(3, "0")}${match[2] ?? ""}` : code;
}
function officeMatches(value: string, office: BirOfficeReference) { const normalized = value.toLowerCase(); return normalized.includes(office.code.toLowerCase()) || normalized.includes(office.name.toLowerCase()); }
function matches(query: string, values: string[]) { return !query || values.some((value) => value.toLowerCase().includes(query)); }
function InlineNoMatch() { return <p className="bir-center-no-match">No matching records.</p>; }
