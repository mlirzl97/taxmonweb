"use client";

import { useMemo, useState } from "react";

import { filingChannels, forms, regulatorySources, taxTypes } from "@/lib/domain/tax-foundation-catalog";
import type { BirOfficeReference } from "@/lib/server/bir-center-repository";
import { EmptyState, FixturePageFrame, SectionHeading } from "@/components/app/workspace-components";

type CatalogKey = "all" | "requirements" | "forms" | "tax_types" | "offices" | "channels" | "sources";

const tabs: Array<{ id: CatalogKey; label: string }> = [
  { id: "all", label: "All" },
  { id: "requirements", label: "Requirements" },
  { id: "forms", label: "Forms" },
  { id: "tax_types", label: "Tax types" },
  { id: "offices", label: "RDO / LTS" },
  { id: "channels", label: "Channels" },
  { id: "sources", label: "Sources" },
];

export function BirCenter({ offices }: { offices: BirOfficeReference[] }) {
  const [activeTab, setActiveTab] = useState<CatalogKey>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matchingOffices = useMemo(() => offices.filter((office) => matches(normalizedQuery, [office.code, office.name, office.parentCode ?? "", office.parentName ?? ""])), [normalizedQuery, offices]);
  const matchingForms = useMemo(() => forms.filter((form) => matches(normalizedQuery, [form.formNumber, form.title, form.sourceCode])), [normalizedQuery]);
  const matchingTaxTypes = useMemo(() => taxTypes.filter((taxType) => matches(normalizedQuery, [taxType.code, taxType.label, taxType.operatingCategory, taxType.sourceCode])), [normalizedQuery]);
  const matchingChannels = useMemo(() => filingChannels.filter((channel) => matches(normalizedQuery, [channel.code, channel.label, channel.sourceCode])), [normalizedQuery]);
  const matchingSources = useMemo(() => regulatorySources.filter((source) => matches(normalizedQuery, [source.code, source.title, source.type, source.note])), [normalizedQuery]);
  const show = (key: CatalogKey) => activeTab === "all" || activeTab === key;

  return (
    <FixturePageFrame>
      <header className="module-header bir-center-header">
        <div><p className="eyebrow">Reference</p><h1>BIR Center</h1></div>
        <span className="module-count">Governed tax reference</span>
      </header>

      <div className="bir-center-toolbar">
        <nav aria-label="BIR reference categories" className="bir-center-tabs">
          {tabs.map((tab) => <button aria-pressed={activeTab === tab.id} className={activeTab === tab.id ? "bir-center-tab is-active" : "bir-center-tab"} key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">{tab.label}</button>)}
        </nav>
        <label className="search-control bir-center-search"><span className="sr-only">Search BIR reference</span><input aria-label="Search BIR reference" onChange={(event) => setQuery(event.target.value)} placeholder="Search code, name, or source" type="search" value={query} /></label>
      </div>

      {show("requirements") && <section className="panel bir-center-panel" aria-labelledby="bir-requirements-title"><SectionHeading title="Requirements" /><EmptyState title="Requirement Master is not populated" description="No requirement is displayed until its legal identity, applicability and source are reconciled." /></section>}

      {show("forms") && <CatalogSection title="Forms" count={matchingForms.length} hidden={activeTab !== "all" && activeTab !== "forms"}>
        <div className="bir-reference-list">{matchingForms.map((form) => <ReferenceRow key={form.formNumber} title={`BIR Form ${form.formNumber}`} detail={form.title} status={form.verificationStatus} source={form.sourceCode} note={form.note} />)}</div>
        {matchingForms.length === 0 && <InlineNoMatch />}
      </CatalogSection>}

      {show("tax_types") && <CatalogSection title="Tax types" count={matchingTaxTypes.length} hidden={activeTab !== "all" && activeTab !== "tax_types"}>
        <div className="bir-reference-list">{matchingTaxTypes.map((taxType) => <ReferenceRow key={taxType.code} title={taxType.label} detail={taxType.code} status={taxType.verificationStatus} source={taxType.sourceCode} />)}</div>
        {matchingTaxTypes.length === 0 && <InlineNoMatch />}
      </CatalogSection>}

      {show("offices") && <CatalogSection title="RDO / LTS" count={matchingOffices.length} hidden={activeTab !== "all" && activeTab !== "offices"}>
        {matchingOffices.length > 0 ? <div className="bir-office-list" role="region" aria-label="BIR office directory"><div className="bir-office-row bir-office-row--header"><span>Code</span><span>Office</span><span>Parent Region</span></div>{matchingOffices.map((office) => <div className="bir-office-row" key={`${office.code}-${office.parentCode ?? "root"}`}><span><strong>{office.code}</strong></span><span>{office.name}</span><span>{office.officeType === "revenue_region" ? "Revenue Region" : office.parentName ?? office.officeType}</span></div>)}</div> : <EmptyState title="Office reference unavailable" description="The live canonical office master is not available in this environment." />}
      </CatalogSection>}

      {show("channels") && <CatalogSection title="Filing and submission channels" count={matchingChannels.length} hidden={activeTab !== "all" && activeTab !== "channels"}>
        <div className="bir-reference-list">{matchingChannels.map((channel) => <ReferenceRow key={channel.code} title={channel.label} detail={channel.code} status={channel.verificationStatus} source={channel.sourceCode} />)}</div>
        {matchingChannels.length === 0 && <InlineNoMatch />}
      </CatalogSection>}

      {show("sources") && <CatalogSection title="Regulatory sources" count={matchingSources.length} hidden={activeTab !== "all" && activeTab !== "sources"}>
        <div className="bir-reference-list">{matchingSources.map((source) => <ReferenceRow key={source.code} title={source.title} detail={source.code} status={source.verificationStatus} source={source.type} note={source.note} href={source.sourceUrl} />)}</div>
        {matchingSources.length === 0 && <InlineNoMatch />}
      </CatalogSection>}
    </FixturePageFrame>
  );
}

function CatalogSection({ title, count, hidden, children }: { title: string; count: number; hidden: boolean; children: React.ReactNode }) {
  if (hidden) return null;
  return <section aria-label={title} className="panel bir-center-panel"><SectionHeading title={title} /><span className="bir-center-count">{count} shown</span>{children}</section>;
}

function ReferenceRow({ title, detail, status, source, note, href }: { title: string; detail: string; status: string; source: string; note?: string; href?: string }) {
  return <details className="bir-reference-row"><summary><span><strong>{title}</strong><small>{detail}</small></span><span className={`bir-reference-status bir-reference-status--${status}`}>{formatStatus(status)}</span></summary><div className="bir-reference-detail"><span>Source · {source}</span>{note && <p>{note}</p>}{href && <a href={href} rel="noreferrer" target="_blank">Open source ↗</a>}</div></details>;
}

function InlineNoMatch() { return <p className="bir-center-no-match">No matching reference rows.</p>; }

function formatStatus(status: string) { return status.replaceAll("_", " "); }
function matches(query: string, values: string[]) { return !query || values.some((value) => value.toLowerCase().includes(query)); }
