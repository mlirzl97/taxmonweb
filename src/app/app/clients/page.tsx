"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getClientContractSummary, getClientWorkloadWeight, type FixtureClient, type FixtureSourceWeightClassification } from "@/lib/fixtures";
import { clientDeadlineModes, clientDeadlinePolicyErrors, type ClientDeadlineMode, type ClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";
import { clientOnboardingContractTypes, clientOnboardingDocumentTypes, formatTin, generatedEntityReference, getClientOnboardingReadiness, normalizeTinDigits, type ClientOnboardingContract, type ClientOnboardingDocument, type ClientOnboardingIdentity } from "@/lib/domain/client-onboarding";
import { canManageModuleRecords } from "@/lib/domain/access";
import { hasCredibleTaxProfileValidation } from "@/lib/domain/client-profile-persistence";
import { fixtureScopeFilterOptions } from "@/lib/domain/organization-catalog";
import { governedReturnForms, returnMatchesSearch, returnsSuggestedFromSource, sourceTaxTypeCodesFromWording } from "@/lib/domain/client-return-selection";
import { taxTypes } from "@/lib/domain/tax-foundation-catalog";
import { useWorkflow } from "@/lib/workflow-state";
import { DetailDrawer, FixturePageFrame, isInScope, ScopeSwitcher, SectionHeading, type ScopeFilter } from "@/components/app/workspace-components";
import { CrfRepositoryView } from "@/components/app/crf-repository";
import { ClientCsvImportDrawer } from "@/components/app/client-csv-import";

type AttentionFilter = "all" | "attention" | "clear";
type AuditFilter = "all" | "open" | "clear";
type ContractFilter = "all" | "Main contract" | "Additional engagement" | "CRF/CRN";
type SortKey = "taxpayer" | "weight" | "attention" | "team" | "audit";
type ClientsView = "registry" | "crfs";
type DeadlinePolicyDraft = {
  mode: ClientDeadlineMode;
  sourceReference: string;
  clientProvideLeadDays: string;
  clientApprovalLeadDays: string;
  tmfPackageLeadDays: string;
  estimatedFilingLeadDays: string;
  estimatedPaymentLeadDays: string;
};

const sourceWeightClassOptions: readonly FixtureSourceWeightClassification[] = ["Extremely Heavy", "Heavy", "Moderate", "Light", "Super Light"];
const contractFilterOptions: readonly Exclude<ContractFilter, "all">[] = ["Main contract", "Additional engagement", "CRF/CRN"];
const scopeFilterOptions = fixtureScopeFilterOptions;
const attentionFilterOptions = ["all", "attention", "clear"] as const;
const auditFilterOptions = ["all", "open", "clear"] as const;
const sortOptions = ["taxpayer", "weight", "attention", "team", "audit"] as const;
const fiscalYearMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const fiscalYearDays = Array.from({ length: 31 }, (_, index) => String(index + 1));
const fiscalYearDayCount: Record<string, number> = { April: 30, June: 30, September: 30, November: 30, February: 29 };

export default function ClientsPage() {
  const { accessMatrix, clientRegistry, clientRegistryState, isClientVisible, prototypeMode, refreshClientRegistry, workPerspective } = useWorkflow();
  // System Admin is technical administration only; client records stay with Tax Control/HOD or the explicit Super Admin authority.
  const canManageClientRecords = canManageModuleRecords(workPerspective, "clients", accessMatrix);
  const [view, setView] = useState<ClientsView>("registry");
  const [hydrated, setHydrated] = useState(false);
  const [scope, setScope] = useState<ScopeFilter>(() => readEnumParam("scope", "all", scopeFilterOptions));
  const [query, setQuery] = useState(() => readStringParam("q", ""));
  const [cluster, setCluster] = useState(() => readStringParam("cluster"));
  const [rdo, setRdo] = useState(() => readStringParam("rdo"));
  const [owner, setOwner] = useState(() => readStringParam("owner"));
  const [group, setGroup] = useState(() => readStringParam("group"));
  const [contractFilter, setContractFilter] = useState<ContractFilter>(() => readEnumParam("contract", "all", ["all", ...contractFilterOptions]));
  const [weightClass, setWeightClass] = useState(() => readStringParam("weight"));
  const [filingChannel, setFilingChannel] = useState(() => readStringParam("filing"));
  const [paymentRoute, setPaymentRoute] = useState(() => readStringParam("payment"));
  const [setupState, setSetupState] = useState(() => readStringParam("setup"));
  const [attention, setAttention] = useState<AttentionFilter>(() => readEnumParam("attention", "all", attentionFilterOptions));
  const [audit, setAudit] = useState<AuditFilter>(() => readEnumParam("audit", "all", auditFilterOptions));
  const [sort, setSort] = useState<SortKey>(() => readEnumParam("sort", "taxpayer", sortOptions));
  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const showCrfs = hydrated && view === "crfs";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setView(readEnumParam<ClientsView>("view", "registry", ["registry", "crfs"]));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      setView(readEnumParam<ClientsView>("view", "registry", ["registry", "crfs"]));
      setScope(readEnumParam("scope", "all", scopeFilterOptions));
      setQuery(readStringParam("q", ""));
      setCluster(readStringParam("cluster"));
      setRdo(readStringParam("rdo"));
      setOwner(readStringParam("owner"));
      setGroup(readStringParam("group"));
      setContractFilter(readEnumParam<ContractFilter>("contract", "all", ["all", ...contractFilterOptions]));
      setWeightClass(readStringParam("weight"));
      setFilingChannel(readStringParam("filing"));
      setPaymentRoute(readStringParam("payment"));
      setSetupState(readStringParam("setup"));
      setAttention(readEnumParam("attention", "all", attentionFilterOptions));
      setAudit(readEnumParam("audit", "all", auditFilterOptions));
      setSort(readEnumParam("sort", "taxpayer", sortOptions));
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    if (view !== "registry") params.set("view", view);
    if (scope !== "all") params.set("scope", scope);
    if (query) params.set("q", query);
    if (cluster !== "all") params.set("cluster", cluster);
    if (rdo !== "all") params.set("rdo", rdo);
    if (owner !== "all") params.set("owner", owner);
    if (group !== "all") params.set("group", group);
    if (contractFilter !== "all") params.set("contract", contractFilter);
    if (weightClass !== "all") params.set("weight", weightClass);
    if (filingChannel !== "all") params.set("filing", filingChannel);
    if (paymentRoute !== "all") params.set("payment", paymentRoute);
    if (setupState !== "all") params.set("setup", setupState);
    if (attention !== "all") params.set("attention", attention);
    if (audit !== "all") params.set("audit", audit);
    if (sort !== "taxpayer") params.set("sort", sort);
    const queryString = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}`);
  }, [attention, audit, cluster, contractFilter, filingChannel, group, hydrated, owner, paymentRoute, query, rdo, scope, setupState, sort, view, weightClass]);

  const sourceClients = useMemo(() => clientRegistryState === "connected" || clientRegistryState === "empty" ? clientRegistry : [], [clientRegistry, clientRegistryState]);
  const perspectiveClients = useMemo(() => prototypeMode ? sourceClients.filter(isClientVisible) : sourceClients, [isClientVisible, prototypeMode, sourceClients]);
  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = perspectiveClients.filter((client) => {
      const profile = client.entities[0]?.profile;
      const searchable = [client.name, profile?.registeredTaxpayerName, profile?.tinDisplay, client.clientGroup, getClientContractSummary(client), client.contractRepository.referenceCode, profile?.rdoOrLts]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      const hasClientAttention = hasAttention(client);
      const hasOpenAudit = Boolean(profile?.auditExposures.some((item) => item.status !== "Closed"));
      const clientWeightClass = profile?.sourceWeightClassification ?? "Unweighted test";

      return isInScope(client.scope, scope)
        && (!normalizedQuery || searchable.some((value) => value.includes(normalizedQuery)))
        && (cluster === "all" || client.assignment.cluster === cluster)
        && (rdo === "all" || profile?.rdoOrLts === rdo)
        && (owner === "all" || [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer].includes(owner))
        && (group === "all" || client.clientGroup === group)
        && matchesContractFilter(client, contractFilter)
        && (weightClass === "all" || clientWeightClass === weightClass)
        && (filingChannel === "all" || profile?.filingChannel === filingChannel)
        && (paymentRoute === "all" || profile?.paymentRoute === paymentRoute)
        && (setupState === "all" || profile?.profileState === setupState)
        && (attention === "all" || (attention === "attention" ? hasClientAttention : !hasClientAttention))
        && (audit === "all" || (audit === "open" ? hasOpenAudit : !hasOpenAudit));
    });

    return [...filtered].sort((left, right) => compareClients(left, right, sort));
  }, [attention, audit, cluster, contractFilter, filingChannel, group, owner, paymentRoute, perspectiveClients, query, rdo, scope, setupState, sort, weightClass]);

  const clusters = unique(perspectiveClients.map((client) => client.assignment.cluster));
  const rdos = unique(perspectiveClients.map((client) => client.entities[0]?.profile.rdoOrLts));
  const owners = unique(perspectiveClients.flatMap((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]));
  const groups = unique(perspectiveClients.map((client) => client.clientGroup));
  const filingChannels = unique(perspectiveClients.map((client) => client.entities[0]?.profile.filingChannel));
  const setupStates = unique(perspectiveClients.map((client) => client.entities[0]?.profile.profileState));
  const visibleKnownWeight = visibleClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0);
  const resultCount = visibleClients.length === perspectiveClients.length ? `${perspectiveClients.length} taxpayers` : `${visibleClients.length} of ${perspectiveClients.length} taxpayers`;

  return (
    <FixturePageFrame>
      <header className="module-header">
        <div><h1>Clients</h1><p className="module-header__description">Taxpayers, registration, and servicing context.</p></div>
        <div className="module-header__right"><div className="module-count"><strong>{clientRegistryState === "loading" ? "Loading client repository…" : resultCount}</strong><small>{clientRegistryState === "error" ? "Repository unavailable" : `${visibleKnownWeight} assessed weight · ${prototypeMode ? "sanitized fixtures" : "live repository"}`}</small></div><div className="module-actions">{canManageClientRecords && <>{prototypeMode && <button className="button button--quiet button--small" onClick={() => { setSetupMessage(null); setCsvImportOpen(true); }} type="button">Import CSV</button>}<button className="button button--primary button--small" onClick={() => { setSetupMessage(null); setSetupDrawerOpen(true); }} type="button">Start client setup</button></>}<Link className="button button--quiet button--small" href="/app/team">Manage people in Team</Link></div></div>
      </header>

      {setupMessage && <div className="saved-notice" role="status">{setupMessage}</div>}

      <nav aria-label="Clients views" className="tower-tabs module-tabs">
        <button aria-pressed={!showCrfs} className={!showCrfs ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => setView("registry")} type="button">All Clients</button>
        <button aria-pressed={showCrfs} className={showCrfs ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => setView("crfs")} type="button">CRF repository</button>
      </nav>

      {showCrfs ? <CrfRepositoryView /> : <>
      <section className="registry-toolbar" aria-label="Taxpayer register controls">
        <div className="registry-toolbar__primary">
          <ScopeSwitcher onChange={setScope} value={scope} />
          <label className="search-control search-control--wide"><span className="sr-only">Search taxpayers</span><input aria-label="Search taxpayers" onChange={(event) => setQuery(event.target.value)} placeholder="Search taxpayer, TIN, or client group" type="search" value={query} /></label>
        </div>
        <div className="registry-toolbar__filters">
          <FilterSelect label="Cluster" onChange={setCluster} options={clusters} value={cluster} />
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
              <FilterSelect label="Contract record" onChange={(value) => setContractFilter(value as ContractFilter)} options={contractFilterOptions} value={contractFilter} />
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
          {visibleClients.length === 0 && <div className="inline-empty">{clientRegistryState === "empty" ? "No taxpayers are configured yet. Start client setup to add the first record." : clientRegistryState === "error" ? "The client repository could not be loaded. Refresh or contact an administrator." : "No taxpayers match these filters. Try clearing a filter or searching a different identifier."}</div>}
        </div>
      </section>
      {setupDrawerOpen && <ClientSetupDrawer onClose={() => setSetupDrawerOpen(false)} onSaved={(referenceCode) => { setSetupDrawerOpen(false); setSetupMessage(`Setup draft ${referenceCode} saved. Complete source review and assignment before activation.`); void refreshClientRegistry(); }} />}
      {csvImportOpen && <ClientCsvImportDrawer onClose={() => setCsvImportOpen(false)} onImported={(message) => { setCsvImportOpen(false); setSetupMessage(message); }} />}
      </>}
    </FixturePageFrame>
  );
}

function ClientSetupDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (referenceCode: string) => void }) {
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<ClientOnboardingIdentity>({ clientReferenceCode: "", clientDisplayName: "", entityReferenceCode: "", entityDisplayName: "", tin: "", unitReferenceCode: "", unitDisplayName: "", unitKind: "head_office", sourceReference: "" });
  const [contract, setContract] = useState<ClientOnboardingContract>({ recordType: "not_confirmed", referenceCode: "", sourceReference: "" });
  const [registrationFacts, setRegistrationFacts] = useState({ rdoOrLts: "", registeredAddress: "", registrationReference: "", taxYearBasis: "", fiscalYearEnd: "", accountingSystem: "", booksType: "", invoicing: "", registeredTaxTypes: "", filingChannel: "Not configured", eFPSGroup: "", sourceSystem: "manual_reference", sourceNotes: "" });
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState("");
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState("");
  const [proposedReturnCodes, setProposedReturnCodes] = useState<string[]>([]);
  const [registeredTaxTypeCodes, setRegisteredTaxTypeCodes] = useState<string[]>([]);
  const [operatingSetup, setOperatingSetup] = useState({ enateSetup: "Unknown" as "Yes" | "No" | "Unknown", paymentRoute: "Not configured" as "Client Pays" | "TMF Pays" | "Not configured" });
  const [deadlinePolicy, setDeadlinePolicy] = useState<DeadlinePolicyDraft>({ mode: "follow_group", sourceReference: "", clientProvideLeadDays: "", clientApprovalLeadDays: "", tmfPackageLeadDays: "", estimatedFilingLeadDays: "", estimatedPaymentLeadDays: "" });
  const [documents, setDocuments] = useState<ClientOnboardingDocument[]>(() => clientOnboardingDocumentTypes.map(({ id }) => ({ type: id, status: "not_captured", sourceReference: "", notes: "" })));
  const [error, setError] = useState<string | null>(null);
  const [organizationUnitId, setOrganizationUnitId] = useState("");
  const readiness = getClientOnboardingReadiness(identity, documents);
  const steps = ["Identity", "Registration facts", "Deadline policy", "Source pack", "Handoff"];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organization/units")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load operating scopes.");
        return response.json() as Promise<{ data?: Array<{ id: string; name: string; unit_kind: string }> }>;
      })
      .then((result) => {
        if (cancelled) return;
        const units = result.data ?? [];
        if (units.length === 0) throw new Error("No active operating scope is available to receive this client.");
        if (units[0]) setOrganizationUnitId(units[0].id);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load operating scopes.");
      });
    return () => { cancelled = true; };
  }, []);

  function updateIdentity(field: keyof ClientOnboardingIdentity, value: string) {
    setIdentity((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function updateDocument(index: number, patch: Partial<ClientOnboardingDocument>) {
    setDocuments((current) => current.map((document, documentIndex) => documentIndex === index ? { ...document, ...patch } : document));
    setError(null);
  }

  function nextStep() {
    if (step === 0 && readiness.identityGaps.length > 0) {
      setError(readiness.identityGaps[0]);
      return;
    }
    if (step === 2) {
      const parsedPolicy = deadlinePolicyFromDraft(deadlinePolicy);
      const policyErrors = parsedPolicy ? clientDeadlinePolicyErrors(parsedPolicy) : ["Deadline offsets must be whole numbers from 0 to 365."];
      if (policyErrors.length > 0) {
        setError(policyErrors[0]);
        return;
      }
    }
    setError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function saveDraft(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedReference = identity.clientReferenceCode.trim().toUpperCase();
    const normalizedName = identity.clientDisplayName.trim();
    if (!normalizedReference || !normalizedName || !identity.sourceReference.trim() || !organizationUnitId) {
      setError("Client reference code, client name, operating scope, and initial source reference are required to save an intake draft.");
      setStep(0);
      return;
    }
    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientReferenceCode: normalizedReference,
          clientDisplayName: normalizedName,
          entityReferenceCode: generatedEntityReference(normalizedReference),
          entityDisplayName: identity.entityDisplayName.trim(),
          tin: identity.tin.trim() || undefined,
          unitReferenceCode: identity.unitReferenceCode.trim().toUpperCase(),
          unitDisplayName: identity.unitDisplayName.trim(),
          unitKind: identity.unitKind,
          registrationReference: registrationFacts.registrationReference.trim() || undefined,
          organizationUnitId,
          sourceReference: identity.sourceReference.trim(),
          sourceSystem: registrationFacts.sourceSystem,
          sourceNotes: [registrationFacts.sourceNotes, readiness.sourcePackGaps.join(" ")].filter(Boolean).join(" ") || undefined,
          profileData: {
            ...registrationFacts,
            fiscalYearEnd: registrationFacts.taxYearBasis === "Fiscal year" && fiscalYearEndMonth && fiscalYearEndDay ? `${fiscalYearEndMonth} ${fiscalYearEndDay}` : undefined,
            registeredTaxTypeCodes,
            registeredTaxTypes: taxTypes.filter((taxType) => registeredTaxTypeCodes.includes(taxType.code)).map((taxType) => taxType.label),
            registeredTaxTypesRaw: registrationFacts.registeredTaxTypes,
            proposedReturnCodes,
            enateSetup: operatingSetup.enateSetup,
            paymentRoute: operatingSetup.paymentRoute,
            deadlinePolicy: deadlinePolicyFromDraft(deadlinePolicy),
          },
          contractData: contract,
          sourcePack: documents,
        }),
      });
      const result = await response.json() as { error?: string; details?: string[] };
      if (!response.ok) throw new Error([result.error, ...(result.details ?? [])].filter(Boolean).join(" ") || "Unable to save the client setup.");
      onSaved(normalizedReference);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the client setup.");
    }
  }

  const currentStep = steps[step];
  return <DetailDrawer eyebrow="Client registry · onboarding intake" title="Start client setup" subtitle="Capture the registration pack first. Activation, assignment, and generated compliance work remain separate controlled steps." onClose={onClose}>
    <form className="form-stack onboarding-drawer" data-usage-form="client_setup" onSubmit={saveDraft}>
      <div className="onboarding-steps" aria-label="Client onboarding steps">{steps.map((label, index) => <button aria-current={step === index ? "step" : undefined} className={step === index ? "onboarding-step onboarding-step--active" : "onboarding-step"} key={label} onClick={() => { setError(null); setStep(index); }} type="button"><span>{index + 1}</span>{label}</button>)}</div>
      <div className="onboarding-status"><strong>{currentStep}</strong><span>{readiness.status === "intake_incomplete" ? "Minimum identity is incomplete" : readiness.status === "source_pack_incomplete" ? `${readiness.sourcePackGaps.length} source item${readiness.sourcePackGaps.length === 1 ? "" : "s"} need a recorded status` : "Ready for human source review"}</span></div>

      {step === 0 && <div className="form-stack"><div className="drawer-section-intro"><strong>Who is being onboarded?</strong><span>Start with the commercial client, legal taxpayer, and one BIR registration unit. The internal entity reference is generated from the client reference; record the taxpayer identifier from the registration source.</span></div><div className="form-grid"><Field label="Client reference code"><input autoFocus onChange={(event) => updateIdentity("clientReferenceCode", event.target.value)} placeholder="e.g. CLIENT-2026-001" value={identity.clientReferenceCode} /></Field><Field label="Client display name"><input onChange={(event) => updateIdentity("clientDisplayName", event.target.value)} placeholder="Approved client name" value={identity.clientDisplayName} /></Field><Field label="Registered taxpayer name"><input onChange={(event) => updateIdentity("entityDisplayName", event.target.value)} placeholder="Name from registration source" value={identity.entityDisplayName} /></Field><Field label="TIN (optional until sourced)"><input inputMode="numeric" maxLength={17} onChange={(event) => updateIdentity("tin", normalizeTinDigits(event.target.value))} placeholder="000-000-000-00000" value={formatTin(identity.tin)} /><small className="form-field__hint">Numbers only. The formatted TIN includes the source branch code when provided; leave blank when the source does not provide it.</small></Field><Field label="Registration unit code"><input onChange={(event) => updateIdentity("unitReferenceCode", event.target.value)} placeholder="e.g. RU-2026-001" value={identity.unitReferenceCode} /></Field></div><Field label="Registration unit name"><input onChange={(event) => updateIdentity("unitDisplayName", event.target.value)} placeholder="Head Office or branch name" value={identity.unitDisplayName} /></Field><Field label="Registration unit type"><select onChange={(event) => updateIdentity("unitKind", event.target.value)} value={identity.unitKind}><option value="head_office">Head Office</option><option value="branch">Branch</option><option value="other">Other registration unit</option></select></Field><Field label="Initial source reference"><input onChange={(event) => updateIdentity("sourceReference", event.target.value)} placeholder="SharePoint reference, 2303 reference, or migration source" value={identity.sourceReference} /></Field><div className="drawer-section-intro"><strong>What contract record is this?</strong><span>Choose the type from the contract source. Do not assume MSA or LSA; CRF/CRN is an additional engagement outside the main contract.</span></div><div className="form-grid"><Field label="Contract record type"><select onChange={(event) => setContract((current) => ({ ...current, recordType: event.target.value as ClientOnboardingContract["recordType"] }))} value={contract.recordType}>{clientOnboardingContractTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></Field><Field label="Contract reference (optional)"><input onChange={(event) => setContract((current) => ({ ...current, referenceCode: event.target.value }))} placeholder="Reference from contract source" value={contract.referenceCode} /></Field></div><Field label="Contract source reference (optional)"><input onChange={(event) => setContract((current) => ({ ...current, sourceReference: event.target.value }))} placeholder="Private source pointer or document reference" value={contract.sourceReference} /></Field></div>}

      {step === 1 && <div className="form-stack"><div className="drawer-section-intro"><strong>What does the registration source say?</strong><span>Record facts and leave unresolved values blank. This is not a tax-treatment decision or a substitute for the BIR Requirement Master.</span></div><div className="form-grid"><Field label="RDO / LTS"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, rdoOrLts: event.target.value })} placeholder="Canonical office value or unresolved" value={registrationFacts.rdoOrLts} /></Field><Field label="Registration reference"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, registrationReference: event.target.value })} placeholder="Reference or certificate number" value={registrationFacts.registrationReference} /></Field><Field label="Tax year basis"><select onChange={(event) => { const taxYearBasis = event.target.value; setRegistrationFacts({ ...registrationFacts, taxYearBasis, fiscalYearEnd: "" }); if (taxYearBasis !== "Fiscal year") { setFiscalYearEndMonth(""); setFiscalYearEndDay(""); } }} value={registrationFacts.taxYearBasis}><option value="">Not configured</option><option>Calendar year</option><option>Fiscal year</option></select></Field><div className="form-field"><span>Fiscal year-end</span><div className="form-grid form-grid--compact"><select aria-label="Fiscal year-end month" disabled={registrationFacts.taxYearBasis !== "Fiscal year"} onChange={(event) => { const month = event.target.value; setFiscalYearEndMonth(month); setFiscalYearEndDay(""); }} value={fiscalYearEndMonth}><option value="">Month</option>{fiscalYearMonths.map((month) => <option key={month}>{month}</option>)}</select><select aria-label="Fiscal year-end day" disabled={registrationFacts.taxYearBasis !== "Fiscal year" || !fiscalYearEndMonth} onChange={(event) => { const day = event.target.value; setFiscalYearEndDay(day); }} value={fiscalYearEndDay}><option value="">Day</option>{fiscalYearDays.slice(0, fiscalYearDayCount[fiscalYearEndMonth] ?? 31).map((day) => <option key={day}>{day}</option>)}</select></div><small className="form-field__hint">Select only when the source confirms a fiscal year. The day remains a source fact; the deadline engine validates applicable rules later.</small></div><Field label="Accounting system"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, accountingSystem: event.target.value })} placeholder="System or source wording" value={registrationFacts.accountingSystem} /></Field><Field label="Books type (source wording)"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, booksType: event.target.value })} placeholder="Record the wording from the source" value={registrationFacts.booksType} /></Field><Field label="Invoicing / permit (source wording)"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, invoicing: event.target.value })} placeholder="Record the wording from the source" value={registrationFacts.invoicing} /></Field><Field label="Filing channel"><select onChange={(event) => setRegistrationFacts({ ...registrationFacts, filingChannel: event.target.value })} value={registrationFacts.filingChannel}><option>Not configured</option><option>eFPS</option><option>eBIRForms</option><option>Other approved channel</option><option>Needs review</option></select></Field><Field label="eFPS group (if sourced)"><select onChange={(event) => setRegistrationFacts({ ...registrationFacts, eFPSGroup: event.target.value })} value={registrationFacts.eFPSGroup}><option value="">Not configured</option><option>Not applicable</option><option>Needs review</option></select><small className="form-field__hint">Governed eFPS group values will appear here after Tax Team reconciles the eFPS Group master. Do not type an unverified group.</small></Field><Field label="Source system"><select onChange={(event) => setRegistrationFacts({ ...registrationFacts, sourceSystem: event.target.value })} value={registrationFacts.sourceSystem}><option value="manual_reference">Manual reference</option><option value="sharepoint">SharePoint reference</option><option value="synthetic_fixture">Synthetic fixture</option></select></Field></div><Field label="Registered address"><textarea onChange={(event) => setRegistrationFacts({ ...registrationFacts, registeredAddress: event.target.value })} placeholder="Record from source; do not invent an address" value={registrationFacts.registeredAddress} /><small className="form-field__hint">Registration source remains authoritative. {registrationFacts.registeredAddress.trim() && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(registrationFacts.registeredAddress.trim())}`} rel="noreferrer" target="_blank">Open this address in Google Maps</a>}</small></Field><Field label="2303 tax-type wording (source)"><textarea onChange={(event) => setRegistrationFacts({ ...registrationFacts, registeredTaxTypes: event.target.value })} placeholder="Copy the tax type or form wording from the 2303" value={registrationFacts.registeredTaxTypes} /></Field><TaxTypeSelector sourceWording={registrationFacts.registeredTaxTypes} selectedCodes={registeredTaxTypeCodes} onChange={setRegisteredTaxTypeCodes} /><ReturnTaxSelector sourceWording={registrationFacts.registeredTaxTypes} selectedCodes={proposedReturnCodes} onChange={setProposedReturnCodes} /><Field label="Source notes"><textarea onChange={(event) => setRegistrationFacts({ ...registrationFacts, sourceNotes: event.target.value })} placeholder="Conflicts, missing pages, or review questions" value={registrationFacts.sourceNotes} /></Field></div>}

      {step === 2 && <DeadlinePolicyStep operatingSetup={operatingSetup} policy={deadlinePolicy} onChangeOperatingSetup={setOperatingSetup} onChange={setDeadlinePolicy} />}
      {step === 3 && <div className="form-stack"><div className="drawer-section-intro"><strong>Which registration documents are available?</strong><span>Every item needs a status. “Not applicable” and “Unknown” require a rationale. This is a source-pack control, not an invented legal checklist.</span></div><div className="onboarding-document-list">{documents.map((document, index) => { const definition = clientOnboardingDocumentTypes.find((candidate) => candidate.id === document.type); if (!definition) return null; return <div className="onboarding-document" key={document.type}><div className="onboarding-document__header"><div><strong>{definition.label}</strong><span>{definition.detail}</span></div><select aria-label={`${definition.label} status`} onChange={(event) => updateDocument(index, { status: event.target.value as ClientOnboardingDocument["status"] })} value={document.status}><option value="not_captured">Not captured</option><option value="received">Received</option><option value="not_applicable">Not applicable</option><option value="unknown">Unknown</option></select></div>{document.status === "received" && <Field label="Source reference"><input aria-label={`${definition.label} source reference`} onChange={(event) => updateDocument(index, { sourceReference: event.target.value })} placeholder="Document reference or private storage pointer" value={document.sourceReference} /></Field>}{(document.status === "unknown" || document.status === "not_applicable") && <Field label="Rationale"><input aria-label={`${definition.label} rationale`} onChange={(event) => updateDocument(index, { notes: event.target.value })} placeholder="Why is this unknown or not applicable?" value={document.notes} /></Field>}</div>; })}</div><div className="drawer-form-note">The prototype records document metadata only. A real 2303 is handled through private temporary storage, extraction, human correction, validation, and source-reference retention; it is not embedded in this client-list draft.</div></div>}

      {step === 4 && <div className="form-stack"><div className="drawer-section-intro"><strong>Handoff readiness</strong><span>Save the intake draft, then continue with source review and assignment. No Tax Profile is activated from this screen.</span></div><div className="onboarding-review-grid"><div><span>Client / entity / unit</span><strong>{identity.clientDisplayName || "Not entered"}</strong><small>{identity.entityDisplayName || "Taxpayer entity not entered"} · {identity.unitDisplayName || "Registration unit not entered"}</small></div><div><span>Contract record</span><strong>{clientOnboardingContractTypes.find((type) => type.id === contract.recordType)?.label}</strong><small>{contract.referenceCode || "Reference not recorded"} · source {contract.sourceReference || "not recorded"}</small></div><div><span>Deadline policy</span><strong>{deadlinePolicy.mode === "follow_group" ? "Follow group schedule" : "Client-specific timing"}</strong><small>{deadlinePolicyOffsetSummary(deadlinePolicy)}</small></div><div><span>Source pack</span><strong>{documents.filter((document) => document.status === "received").length} received · {readiness.sourcePackGaps.length} unresolved</strong><small>2303, ATP, registration updates, authority context, and other sources are tracked separately.</small></div><div><span>Next controlled steps</span><strong>Source review → Tax Profile validation → assignment</strong><small>Generated compliance work follows approved setup; it is not created here.</small></div></div>{readiness.identityGaps.length > 0 && <div className="form-error" role="alert">{readiness.identityGaps.join(" ")}</div>}{readiness.sourcePackGaps.length > 0 && <div className="onboarding-gap-list"><strong>Still unresolved</strong>{readiness.sourcePackGaps.map((gap) => <span key={gap}>{gap}</span>)}</div>}<div className="drawer-form-note">Saving is allowed as an intake draft. Activation remains blocked until human source review resolves the applicable registration facts and required controls.</div></div>}

      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="onboarding-actions"><button className="button button--quiet" disabled={step === 0} onClick={() => { setError(null); setStep((current) => Math.max(current - 1, 0)); }} type="button">Back</button>{step < steps.length - 1 ? <button className="button button--quiet" onClick={nextStep} type="button">Next</button> : <button className="button button--primary" type="submit">Save intake draft</button>}</div>
    </form>
  </DetailDrawer>;
}

function deadlinePolicyFromDraft(draft: DeadlinePolicyDraft): ClientDeadlinePolicy {
  const numberValue = (value: string) => value.trim() === "" ? undefined : Number(value);
  return {
    mode: draft.mode,
    sourceReference: draft.sourceReference.trim() || undefined,
    clientProvideLeadDays: numberValue(draft.clientProvideLeadDays),
    clientApprovalLeadDays: numberValue(draft.clientApprovalLeadDays),
    tmfPackageLeadDays: numberValue(draft.tmfPackageLeadDays),
    estimatedFilingLeadDays: numberValue(draft.estimatedFilingLeadDays),
    estimatedPaymentLeadDays: numberValue(draft.estimatedPaymentLeadDays),
  };
}

function deadlinePolicyOffsetSummary(policy: DeadlinePolicyDraft) {
  const offsets = [
    policy.clientProvideLeadDays !== "" && `client provide ${policy.clientProvideLeadDays} working days`,
    policy.clientApprovalLeadDays !== "" && `approval ${policy.clientApprovalLeadDays} working days`,
    policy.tmfPackageLeadDays !== "" && `TMF package ${policy.tmfPackageLeadDays} working days`,
    policy.estimatedFilingLeadDays !== "" && `filing ${policy.estimatedFilingLeadDays} working days`,
    policy.estimatedPaymentLeadDays !== "" && `payment ${policy.estimatedPaymentLeadDays} working days`,
  ].filter(Boolean);
  return offsets.length > 0 ? offsets.join(" · ") : "No client-specific offsets configured yet.";
}

function DeadlinePolicyStep({ operatingSetup, policy, onChangeOperatingSetup, onChange }: { operatingSetup: { enateSetup: "Yes" | "No" | "Unknown"; paymentRoute: "Client Pays" | "TMF Pays" | "Not configured" }; policy: DeadlinePolicyDraft; onChangeOperatingSetup: (setup: { enateSetup: "Yes" | "No" | "Unknown"; paymentRoute: "Client Pays" | "TMF Pays" | "Not configured" }) => void; onChange: (policy: DeadlinePolicyDraft) => void }) {
  const update = (field: keyof DeadlinePolicyDraft, value: string) => onChange({ ...policy, [field]: value });
  return <div className="form-stack"><div className="drawer-section-intro"><strong>Operating setup</strong><span>Record the client-specific servicing controls. These do not change the governed statutory deadline.</span></div><div className="form-grid"><Field label="eNATE setup"><select onChange={(event) => onChangeOperatingSetup({ ...operatingSetup, enateSetup: event.target.value as typeof operatingSetup.enateSetup })} value={operatingSetup.enateSetup}><option>Unknown</option><option>Yes</option><option>No</option></select></Field><Field label="Payment route"><select onChange={(event) => onChangeOperatingSetup({ ...operatingSetup, paymentRoute: event.target.value as typeof operatingSetup.paymentRoute })} value={operatingSetup.paymentRoute}><option>Not configured</option><option>Client Pays</option><option>TMF Pays</option></select></Field></div><div className="drawer-section-intro"><strong>How should this client be timed?</strong><span>The Tax Team-published deadline remains the statutory/operational anchor. Choose whether this client follows the group schedule or has its own working-day offsets.</span></div><Field label="Deadline basis"><select aria-label="Deadline basis" onChange={(event) => update("mode", event.target.value)} value={policy.mode}>{clientDeadlineModes.map((mode) => <option key={mode} value={mode}>{mode === "follow_group" ? "Follow group published deadline" : "Define client operating dates"}</option>)}</select></Field>{policy.mode === "client_defined" && <><div className="drawer-section-intro"><strong>Client service milestones</strong><span>Enter working days before the published deadline. These dates recalculate for every activity period; they do not change the statutory deadline.</span></div><div className="form-grid"><OffsetField label="Client provides information" value={policy.clientProvideLeadDays} onChange={(value) => update("clientProvideLeadDays", value)} /><OffsetField label="Client approval due" value={policy.clientApprovalLeadDays} onChange={(value) => update("clientApprovalLeadDays", value)} /><OffsetField label="TMF package target" value={policy.tmfPackageLeadDays} onChange={(value) => update("tmfPackageLeadDays", value)} /><OffsetField label="Estimated filing" value={policy.estimatedFilingLeadDays} onChange={(value) => update("estimatedFilingLeadDays", value)} /><OffsetField label="Estimated payment" value={policy.estimatedPaymentLeadDays} onChange={(value) => update("estimatedPaymentLeadDays", value)} /></div><Field label="Policy source / reference"><input onChange={(event) => update("sourceReference", event.target.value)} placeholder="Approved client instruction or engagement reference" value={policy.sourceReference} /></Field></>}{policy.mode === "follow_group" && <div className="drawer-form-note">Group-published dates will flow into the client calendar automatically. Client approval and other service milestones remain visibly unconfigured until a group or client-specific operating policy supplies them.</div>}</div>;
}

function OffsetField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={`${label} · working days before due`}><input aria-label={label} inputMode="numeric" max="365" min="0" onChange={(event) => onChange(event.target.value)} placeholder="e.g. 5" type="number" value={value} /></Field>;
}

function TaxTypeSelector({ sourceWording, selectedCodes, onChange }: { sourceWording: string; selectedCodes: string[]; onChange: (codes: string[]) => void }) {
  const sourceSuggestedCodes = sourceTaxTypeCodesFromWording(sourceWording);
  const selected = taxTypes.filter((taxType) => selectedCodes.includes(taxType.code));
  const add = (code: string) => { if (code && !selectedCodes.includes(code)) onChange([...selectedCodes, code]); };
  const remove = (code: string) => onChange(selectedCodes.filter((selectedCode) => selectedCode !== code));

  return <section aria-labelledby="tax-code-title" className="onboarding-tax-selector"><div className="drawer-section-intro"><strong id="tax-code-title">Tax codes</strong><span>Select the tax types confirmed by the registration source from the governed Tax Type Master. Source wording can suggest a match, but does not select it automatically.</span></div><div className="onboarding-tax-selector__selected" aria-live="polite">{selected.length > 0 ? selected.map((taxType) => <span className="onboarding-tax-chip" key={taxType.code}><strong>{taxType.code}</strong><small>{taxType.label}</small><button aria-label={`Remove ${taxType.code}`} onClick={() => remove(taxType.code)} type="button">×</button></span>) : <span className="onboarding-tax-selector__empty">No governed tax codes selected yet</span>}</div><Field label="Add tax code"><select aria-label="Add tax code" onChange={(event) => { add(event.target.value); event.target.value = ""; }} value=""><option value="">Select a governed tax code</option>{taxTypes.filter((taxType) => !selectedCodes.includes(taxType.code)).map((taxType) => <option key={taxType.code} value={taxType.code}>{taxType.code} · {taxType.label}</option>)}</select></Field>{sourceSuggestedCodes.length > 0 && <div className="drawer-form-note">Source wording suggests: {sourceSuggestedCodes.join(" · ")}. Confirm the applicable code above.</div>}</section>;
}

function ReturnTaxSelector({ sourceWording, selectedCodes, onChange }: { sourceWording: string; selectedCodes: string[]; onChange: (codes: string[]) => void }) {
  const [query, setQuery] = useState("");
  const selected = governedReturnForms.filter((form) => selectedCodes.includes(form.formNumber));
  const sourceSuggested = returnsSuggestedFromSource(sourceWording);
  const suggestions = governedReturnForms
    .filter((form) => !selectedCodes.includes(form.formNumber) && returnMatchesSearch(form, query))
    .sort((left, right) => Number(sourceSuggested.some((form) => form.formNumber === right.formNumber)) - Number(sourceSuggested.some((form) => form.formNumber === left.formNumber)));
  const add = (formNumber: string) => onChange([...selectedCodes, formNumber]);
  const remove = (code: string) => onChange(selectedCodes.filter((selectedCode) => selectedCode !== code));

  return <section aria-labelledby="returns-to-file-title" className="onboarding-tax-selector"><div className="drawer-section-intro"><strong id="returns-to-file-title">Returns to be filed</strong><span>Choose return forms from the current governed BIR form catalog. Source-matched suggestions are proposals only; Tax Team still approves the client Compliance Universe.</span></div><div className="onboarding-tax-selector__selected" aria-live="polite">{selected.length > 0 ? selected.map((form) => <span className="onboarding-tax-chip" key={form.formNumber}><strong>{form.formNumber}</strong><button aria-label={`Remove ${form.formNumber}`} onClick={() => remove(form.formNumber)} type="button">×</button></span>) : <span className="onboarding-tax-selector__empty">No return forms selected yet</span>}</div><Field label="Find a BIR return"><input aria-label="Find a BIR return" onChange={(event) => setQuery(event.target.value)} placeholder="e.g. 0619E or 1601EQ" value={query} /></Field><div aria-label="Suggested governed BIR returns" className="onboarding-tax-selector__suggestions">{suggestions.map((form) => { const sourceMatch = sourceSuggested.some((candidate) => candidate.formNumber === form.formNumber); return <button className="onboarding-tax-suggestion" key={form.formNumber} onClick={() => add(form.formNumber)} type="button"><span><strong>{form.formNumber}</strong><small>{sourceMatch ? "Source match · " : ""}{form.title}</small></span><span aria-hidden="true">＋</span></button>; })}{suggestions.length === 0 && <span className="onboarding-tax-selector__empty">No governed BIR returns match this search.</span>}</div><div className="drawer-form-note">The selector uses the current governed form catalog. A selected form is not an approved obligation and will not generate work until Tax Team validates applicability.</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function unique(values: readonly (string | undefined)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function matchesContractFilter(client: FixtureClient, filter: ContractFilter) {
  if (filter === "all") return true;
  if (filter === "Main contract") return Boolean(client.contractRepository.masterEngagement);
  if (filter === "Additional engagement") return client.contractRepository.additionalEngagements.length > 0;
  return client.contractRepository.additionalEngagements.some((engagement) => engagement.kind === "Change Request Form");
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
  if (sort === "team") return left.assignment.cluster.localeCompare(right.assignment.cluster) || left.assignment.preparer.localeCompare(right.assignment.preparer) || left.name.localeCompare(right.name);
  if (sort === "audit") return Number(Boolean(rightProfile?.auditExposures.some((item) => item.status !== "Closed"))) - Number(Boolean(leftProfile?.auditExposures.some((item) => item.status !== "Closed"))) || left.name.localeCompare(right.name);
  return left.name.localeCompare(right.name);
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <label className="register-filter"><span>{label}</span><select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TaxpayerRow({ client }: { client: FixtureClient }) {
  const profile = client.entities[0].profile;
  const clientHasAttention = hasAttention(client);
  const openAuditCount = profile.auditExposures.filter((item) => item.status !== "Closed").length;
  const auditLabel = openAuditCount > 0 ? `${openAuditCount} open` : profile.auditExposures.length > 0 ? `${profile.auditExposures.length} closed` : "No open audit";
  const weightLabel = profile.sourceWeightClassification ?? "Not assessed";
  const numericWeight = profile.sourceFinalWeight === null ? "—" : profile.sourceFinalWeight;

  return (
    <tr>
      <td data-label="Taxpayer"><Link className="taxpayer-link" href={`/app/clients/${client.id}`}><span><strong>{profile.registeredTaxpayerName}{hasCredibleTaxProfileValidation(profile) && <span aria-label={`Tax Profile validated by ${profile.validator}`} className="profile-verification profile-verification--inline" role="img" title={`Validated by ${profile.validator} on ${profile.lastValidated}`}>✓</span>}</strong><small>{getClientContractSummary(client)} · {client.clientGroup ?? "Independent client relationship"} · {client.entities[0].units.length} unit{client.entities[0].units.length === 1 ? "" : "s"}</small></span></Link></td>
      <td data-label="TIN"><span className="table-value"><strong>{profile.tinDisplay}</strong></span></td>
      <td data-label="RDO / LTS"><span className="table-value">{profile.rdoOrLts}</span></td>
      <td data-label="Filing"><span className="table-value"><strong>{profile.filingChannel}</strong><small>{profile.eFPSGroup ?? profile.filingContext}</small></span></td>
      <td data-label="Team"><span className="table-value"><strong>{client.assignment.cluster}</strong><small>{client.assignment.preparer} · {client.assignment.checker} · {client.assignment.reviewer}</small></span></td>
      <td data-label="Weight"><span className="weight-mark">{numericWeight}</span><span className="table-value"><strong>{weightLabel}</strong><small>{profile.sourceFinalWeight === null ? "No assessment recorded" : "Assessed client weight"}</small></span></td>
      <td data-label="Payment"><span className="table-value"><strong>{profile.paymentRoute}</strong><small>{profile.enateSetup === "Yes" ? "eNATE setup" : profile.enateSetup === "No" ? "No eNATE" : "eNATE unknown"}</small></span></td>
      <td data-label="Audit"><span className={openAuditCount > 0 ? "attention-open" : "attention-clear"}>{auditLabel}</span></td>
      <td data-label="Attention"><span className={clientHasAttention ? "attention-open" : "attention-clear"}>{clientHasAttention ? `${profile.attention.length || 1} to review` : "Clear"}</span></td>
    </tr>
  );
}
