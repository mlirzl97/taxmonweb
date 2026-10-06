"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fixtureClients, getClientWorkloadWeight, type FixtureClient, type FixtureSourceWeightClassification } from "@/lib/fixtures";
import { FixturePageFrame, isInScope, ScopeSwitcher, SectionHeading, type ScopeFilter } from "@/components/app/workspace-components";

type AttentionFilter = "all" | "attention" | "clear";
type AuditFilter = "all" | "open" | "clear";
type SortKey = "taxpayer" | "weight" | "attention" | "team" | "audit";

const sourceWeightClassOptions: readonly FixtureSourceWeightClassification[] = ["Extremely Heavy", "Heavy", "Moderate", "Light", "Super Light"];
const scopeFilterOptions = ["all", "north", "central", "south"] as const;
const attentionFilterOptions = ["all", "attention", "clear"] as const;
const auditFilterOptions = ["all", "open", "clear"] as const;
const sortOptions = ["taxpayer", "weight", "attention", "team", "audit"] as const;

export default function ClientsPage() {
  const [scope, setScope] = useState<ScopeFilter>(() => readEnumParam("scope", "all", scopeFilterOptions));
  const [query, setQuery] = useState(() => readStringParam("q", ""));
  const [tower, setTower] = useState(() => readStringParam("tower"));
  const [rdo, setRdo] = useState(() => readStringParam("rdo"));
  const [owner, setOwner] = useState(() => readStringParam("owner"));
  const [group, setGroup] = useState(() => readStringParam("group"));
  const [weightClass, setWeightClass] = useState(() => readStringParam("weight"));
  const [filingChannel, setFilingChannel] = useState(() => readStringParam("filing"));
  const [paymentRoute, setPaymentRoute] = useState(() => readStringParam("payment"));
  const [setupState, setSetupState] = useState(() => readStringParam("setup"));
  const [attention, setAttention] = useState<AttentionFilter>(() => readEnumParam("attention", "all", attentionFilterOptions));
  const [audit, setAudit] = useState<AuditFilter>(() => readEnumParam("audit", "all", auditFilterOptions));
  const [sort, setSort] = useState<SortKey>(() => readEnumParam("sort", "taxpayer", sortOptions));

  useEffect(() => {
    const params = new URLSearchParams();
    if (scope !== "all") params.set("scope", scope);
    if (query) params.set("q", query);
    if (tower !== "all") params.set("tower", tower);
    if (rdo !== "all") params.set("rdo", rdo);
    if (owner !== "all") params.set("owner", owner);
    if (group !== "all") params.set("group", group);
    if (weightClass !== "all") params.set("weight", weightClass);
    if (filingChannel !== "all") params.set("filing", filingChannel);
    if (paymentRoute !== "all") params.set("payment", paymentRoute);
    if (setupState !== "all") params.set("setup", setupState);
    if (attention !== "all") params.set("attention", attention);
    if (audit !== "all") params.set("audit", audit);
    if (sort !== "taxpayer") params.set("sort", sort);
    const queryString = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}`);
  }, [attention, audit, filingChannel, group, owner, paymentRoute, query, rdo, scope, setupState, sort, tower, weightClass]);

  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = fixtureClients.filter((client) => {
      const profile = client.entities[0]?.profile;
      const searchable = [client.name, profile?.registeredTaxpayerName, profile?.tinDisplay, client.clientGroup, profile?.rdoOrLts]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      const hasClientAttention = hasAttention(client);
      const hasOpenAudit = Boolean(profile?.auditExposures.length);
      const clientWeightClass = profile?.sourceWeightClassification ?? "Unweighted test";

      return isInScope(client.scope, scope)
        && (!normalizedQuery || searchable.some((value) => value.includes(normalizedQuery)))
        && (tower === "all" || client.assignment.tower === tower)
        && (rdo === "all" || profile?.rdoOrLts === rdo)
        && (owner === "all" || [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer].includes(owner))
        && (group === "all" || client.clientGroup === group)
        && (weightClass === "all" || clientWeightClass === weightClass)
        && (filingChannel === "all" || profile?.filingChannel === filingChannel)
        && (paymentRoute === "all" || profile?.paymentRoute === paymentRoute)
        && (setupState === "all" || profile?.profileState === setupState)
        && (attention === "all" || (attention === "attention" ? hasClientAttention : !hasClientAttention))
        && (audit === "all" || (audit === "open" ? hasOpenAudit : !hasOpenAudit));
    });

    return [...filtered].sort((left, right) => compareClients(left, right, sort));
  }, [attention, audit, filingChannel, group, owner, paymentRoute, query, rdo, scope, setupState, sort, tower, weightClass]);

  const towers = unique(fixtureClients.map((client) => client.assignment.tower));
  const rdos = unique(fixtureClients.map((client) => client.entities[0]?.profile.rdoOrLts));
  const owners = unique(fixtureClients.flatMap((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]));
  const groups = unique(fixtureClients.map((client) => client.clientGroup));
  const filingChannels = unique(fixtureClients.map((client) => client.entities[0]?.profile.filingChannel));
  const setupStates = unique(fixtureClients.map((client) => client.entities[0]?.profile.profileState));
  const syntheticFixtureCount = fixtureClients.filter((client) => client.entities[0]?.profile.fixtureSource === "synthetic_portfolio_test").length;
  const visibleKnownWeight = visibleClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0);
  const resultCount = visibleClients.length === fixtureClients.length ? `${fixtureClients.length} taxpayers` : `${visibleClients.length} of ${fixtureClients.length} taxpayers`;

  return (
    <FixturePageFrame>
      <header className="module-header">
        <div><h1>Clients</h1></div>
        <div className="module-count"><strong>{resultCount}</strong><small>{visibleKnownWeight} assessed weight{visibleClients.length === fixtureClients.length ? ` · ${syntheticFixtureCount} not assessed` : " in result"}</small></div>
      </header>

      <section className="registry-toolbar" aria-label="Taxpayer register controls">
        <div className="registry-toolbar__primary">
          <ScopeSwitcher onChange={setScope} value={scope} />
          <label className="search-control search-control--wide"><span className="sr-only">Search taxpayers</span><input aria-label="Search taxpayers" onChange={(event) => setQuery(event.target.value)} placeholder="Search taxpayer, TIN, or client group" type="search" value={query} /></label>
        </div>
        <div className="registry-toolbar__filters">
          <FilterSelect label="Tower" onChange={setTower} options={towers} value={tower} />
          <FilterSelect label="Attention" onChange={(value) => setAttention(value as AttentionFilter)} options={["attention", "clear"]} value={attention} />
          <details className="filter-popover">
            <summary>More filters</summary>
            <div className="filter-popover__body">
              <FilterSelect label="Weight class" onChange={setWeightClass} options={[...sourceWeightClassOptions, "Unweighted test"]} value={weightClass} />
              <FilterSelect label="Filing channel" onChange={setFilingChannel} options={filingChannels} value={filingChannel} />
              <FilterSelect label="Payment route" onChange={setPaymentRoute} options={["Client Pays", "TMF Pays", "Not configured"]} value={paymentRoute} />
              <FilterSelect label="Setup state" onChange={setSetupState} options={setupStates} value={setupState} />
              <FilterSelect label="Audit exposure" onChange={(value) => setAudit(value as AuditFilter)} options={["open", "clear"]} value={audit} />
              <FilterSelect label="RDO / LTS" onChange={setRdo} options={rdos} value={rdo} />
              <FilterSelect label="Team member" onChange={setOwner} options={owners} value={owner} />
              <FilterSelect label="Client Group" onChange={setGroup} options={groups} value={group} />
              <FilterSelect label="Sort by" onChange={(value) => setSort(value as SortKey)} options={["taxpayer", "weight", "attention", "team", "audit"]} value={sort} />
            </div>
          </details>
        </div>
      </section>

      <section aria-labelledby="taxpayer-register-title" className="panel panel--table registry-panel">
        <SectionHeading title="All taxpayers" />
        <div className="taxpayer-register" role="region" aria-label="Taxpayer register table" tabIndex={0}>
          <table className="taxpayer-table">
            <thead><tr><th scope="col">Taxpayer</th><th scope="col">TIN</th><th scope="col">RDO / LTS</th><th scope="col">Filing</th><th scope="col">Team</th><th scope="col">Weight</th><th scope="col">Payment</th><th scope="col">Audit</th><th scope="col">Attention</th></tr></thead>
            <tbody>{visibleClients.map((client) => <TaxpayerRow client={client} key={client.id} />)}</tbody>
          </table>
          {visibleClients.length === 0 && <div className="inline-empty">No taxpayers match these filters. Try clearing a filter or searching a different identifier.</div>}
        </div>
      </section>
    </FixturePageFrame>
  );
}

function unique(values: readonly (string | undefined)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function readStringParam(name: string, fallback = "all") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) ?? fallback;
}

function readEnumParam<T extends string>(name: string, fallback: T, options: readonly T[]): T {
  const candidate = readStringParam(name) as T;
  return options.includes(candidate) ? candidate : fallback;
}

function hasAttention(client: FixtureClient) {
  const profile = client.entities[0]?.profile;
  const assignment = client.assignment;
  return Boolean(profile && (profile.attention.length > 0 || profile.profileState !== "Active" || new Set([assignment.preparer, assignment.checker, assignment.reviewer]).size < 3 || [assignment.preparer, assignment.checker, assignment.reviewer].some((member) => member === "Unassigned")));
}

function compareClients(left: FixtureClient, right: FixtureClient, sort: SortKey) {
  const leftProfile = left.entities[0]?.profile;
  const rightProfile = right.entities[0]?.profile;
  if (sort === "weight") return (rightProfile?.sourceFinalWeight ?? -1) - (leftProfile?.sourceFinalWeight ?? -1) || left.name.localeCompare(right.name);
  if (sort === "attention") return Number(hasAttention(right)) - Number(hasAttention(left)) || left.name.localeCompare(right.name);
  if (sort === "team") return left.assignment.tower.localeCompare(right.assignment.tower) || left.assignment.preparer.localeCompare(right.assignment.preparer) || left.name.localeCompare(right.name);
  if (sort === "audit") return Number(Boolean(rightProfile?.auditExposures.length)) - Number(Boolean(leftProfile?.auditExposures.length)) || left.name.localeCompare(right.name);
  return left.name.localeCompare(right.name);
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <label className="register-filter"><span>{label}</span><select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TaxpayerRow({ client }: { client: FixtureClient }) {
  const profile = client.entities[0].profile;
  const clientHasAttention = hasAttention(client);
  const auditLabel = profile.auditExposures.length > 0 ? `${profile.auditExposures.length} open year${profile.auditExposures.length === 1 ? "" : "s"}` : "No open audit";
  const weightLabel = profile.sourceWeightClassification ?? "Not assessed";
  const numericWeight = profile.sourceFinalWeight === null ? "—" : profile.sourceFinalWeight;

  return (
    <tr>
      <td data-label="Taxpayer"><Link className="taxpayer-link" href={`/app/clients/${client.id}`}><span className="client-avatar" aria-hidden="true">{profile.registeredTaxpayerName.charAt(0)}</span><span><strong>{profile.registeredTaxpayerName}</strong><small>{client.clientGroup ?? "Independent client relationship"} · {client.entities[0].units.length} unit{client.entities[0].units.length === 1 ? "" : "s"}</small></span></Link></td>
      <td data-label="TIN"><span className="table-value"><strong>{profile.tinDisplay}</strong><small>{profile.branchCode}</small></span></td>
      <td data-label="RDO / LTS"><span className="table-value">{profile.rdoOrLts}</span></td>
      <td data-label="Filing"><span className="table-value"><strong>{profile.filingChannel}</strong><small>{profile.eFPSGroup ?? profile.filingContext}</small></span></td>
      <td data-label="Team"><span className="table-value"><strong>{client.assignment.tower}</strong><small>{client.assignment.preparer} · {client.assignment.checker} · {client.assignment.reviewer}</small></span></td>
      <td data-label="Weight"><span className="weight-mark">{numericWeight}</span><span className="table-value"><strong>{weightLabel}</strong><small>{profile.sourceFinalWeight === null ? "No assessment recorded" : "Assessed client weight"}</small></span></td>
      <td data-label="Payment"><span className="table-value"><strong>{profile.paymentRoute}</strong><small>{profile.enateSetup === "Yes" ? "eNATE setup" : profile.enateSetup === "No" ? "No eNATE" : "eNATE unknown"}</small></span></td>
      <td data-label="Audit"><span className={profile.auditExposures.length > 0 ? "attention-open" : "attention-clear"}>{auditLabel}</span></td>
      <td data-label="Attention"><span className={clientHasAttention ? "attention-open" : "attention-clear"}>{clientHasAttention ? `${profile.attention.length || 1} to review` : "Clear"}</span></td>
    </tr>
  );
}
