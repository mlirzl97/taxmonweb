"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getClientContractSummary, type FixtureClient, type FixtureSourceWeightClassification } from "@/lib/fixtures";
import { clientDeadlineModes, clientDeadlinePolicyErrors, type ClientDeadlineMode, type ClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";
import { clientOnboardingContractTypes, clientOnboardingDocumentStatusOptions, clientOnboardingDocumentTypes, clientOnboardingMainContractTypes, formatTin, generatedEntityReference, getClientOnboardingReadiness, normalizeTinDigits, type ClientOnboardingContract, type ClientOnboardingDocument, type ClientOnboardingIdentity } from "@/lib/domain/client-onboarding";
import { prototypeClientSetupUpdatedEvent, submittedSetupToFixtureClient } from "@/lib/domain/submitted-client-projection";
import { applySavedCalibrationToClient, getClientDisplayWeight, getClientDisplayWeightLabel, hasCredibleTaxProfileValidation, prototypeClientProfileUpdatedEvent } from "@/lib/domain/client-profile-persistence";
import { fixtureScopeFilterOptions } from "@/lib/domain/organization-catalog";
import type { BirOfficeOption } from "@/lib/domain/bir-office-reference";
import { filingChannels } from "@/lib/domain/tax-foundation-catalog";
import { birOfficeLabel, clientAccountingSystemOptions, clientBooksOptions, clientEfpsGroupOptions, clientFilingChannelOptions, clientInvoicingOptions, controlledOptionLabel, prototypeBirOfficeOptions } from "@/lib/domain/client-profile-options";
import { fixtureClock } from "@/lib/fixtures";
import { useWorkflow } from "@/lib/workflow-state";
import { DetailDrawer, FixturePageFrame, isInScope, ScopeSwitcher, SectionHeading, type ScopeFilter } from "@/components/app/workspace-components";
import { CrfRepositoryView } from "@/components/app/crf-repository";
import { ClientCsvImportDrawer } from "@/components/app/client-csv-import";
import { ReturnTaxSelector } from "@/components/app/return-tax-selector";

type AttentionFilter = "all" | "attention" | "clear";
type AuditFilter = "all" | "open" | "clear";
type ContractFilter = "all" | "Main contract" | "Additional engagement" | "CRF/CRN";
type SortKey = "taxpayer" | "weight" | "attention" | "team" | "audit";
type ClientsView = "registry" | "crfs";
type ClientSetupRegistrationFacts = {
  rdoOrLts: string;
  registeredAddress: string;
  registrationReference: string;
  registrationDate: string;
  taxYearBasis: string;
  fiscalYearEnd?: string;
  firstPeriodToFile?: string;
  accountingSystem: string;
  booksType: string;
  invoicing: string;
  filingChannel: string;
  eFPSGroup: string;
  proposedReturnCodes?: string[];
  registeredReturnCodes?: string[];
  permanentFileLink?: string;
  goLiveDate?: string;
  enateSetup?: "Yes" | "No" | "Unknown";
  paymentRoute?: "Client Pays" | "TMF Pays" | "Not configured";
  deadlinePolicy?: ClientDeadlinePolicy;
};
type ClientSetupDraft = {
  version: number;
  client: ClientOnboardingIdentity;
  contract: ClientOnboardingContract;
  registrationFacts: ClientSetupRegistrationFacts;
  documents: ClientOnboardingDocument[];
  readiness: unknown;
  status: string;
  createdAt: string;
};
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
  const { canManageModule, clientRegistry, clientRegistryState, isClientVisible, prototypeMode, refreshClientRegistry } = useWorkflow();
  // System Admin is technical administration only; client records stay with Tax Control/HOD or the explicit Super Admin authority.
  const canManageClientRecords = canManageModule("clients");
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
  const [draftToEdit, setDraftToEdit] = useState<ClientSetupDraft | null>(null);
  const [setupDrafts, setSetupDrafts] = useState<ClientSetupDraft[]>([]);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [birRdoOptions, setBirRdoOptions] = useState<BirOfficeOption[]>([]);
  const showCrfs = hydrated && view === "crfs";

  useEffect(() => {
    if (prototypeMode || !canManageClientRecords) return;
    let cancelled = false;
    fetch("/api/bir-offices", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { data?: BirOfficeOption[] };
        if (!cancelled && Array.isArray(result.data)) setBirRdoOptions(result.data);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [canManageClientRecords, prototypeMode]);

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

  useEffect(() => {
    if (!prototypeMode) return;
    const syncDrafts = () => setSetupDrafts(readSetupDrafts());
    syncDrafts();
    window.addEventListener("storage", syncDrafts);
    window.addEventListener(prototypeClientProfileUpdatedEvent, syncDrafts);
    return () => {
      window.removeEventListener("storage", syncDrafts);
      window.removeEventListener(prototypeClientProfileUpdatedEvent, syncDrafts);
    };
  }, [prototypeMode]);

  const submittedClients = useMemo(() => prototypeMode ? setupDrafts.filter((draft) => draft.status === "submitted").map((draft) => applySavedCalibrationToClient(submittedSetupToFixtureClient(draft))) : [], [prototypeMode, setupDrafts]);
  const sourceClients = useMemo(() => { const base = clientRegistryState === "connected" || clientRegistryState === "empty" ? clientRegistry : []; if (!prototypeMode) return base; const submittedIds = new Set(submittedClients.map((client) => client.id)); return [...base.filter((client) => !submittedIds.has(client.id)), ...submittedClients]; }, [clientRegistry, clientRegistryState, prototypeMode, submittedClients]);
  const perspectiveClients = useMemo(() => prototypeMode ? sourceClients.filter(isClientVisible) : sourceClients, [isClientVisible, prototypeMode, sourceClients]);
  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = perspectiveClients.filter((client) => {
      const profile = client.entities[0]?.profile;
      const searchable = [client.name, profile?.registeredTaxpayerName, profile?.tinDisplay, client.clientGroup, getClientContractSummary(client), client.contractRepository.referenceCode, birOfficeLabel(profile?.rdoOrLts, birRdoOptions.length > 0 ? birRdoOptions : prototypeBirOfficeOptions)]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      const hasClientAttention = hasAttention(client);
      const hasOpenAudit = Boolean(profile?.auditExposures.some((item) => item.status !== "Closed"));
      const clientWeightClass = profile ? getClientDisplayWeightLabel(profile) : "Unweighted test";

      return isInScope(client.scope, scope)
        && (!normalizedQuery || searchable.some((value) => value.includes(normalizedQuery)))
        && (cluster === "all" || client.assignment.cluster === cluster)
        && (rdo === "all" || birOfficeLabel(profile?.rdoOrLts, birRdoOptions.length > 0 || !prototypeMode ? birRdoOptions : prototypeBirOfficeOptions) === rdo)
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
  }, [attention, audit, birRdoOptions, cluster, contractFilter, filingChannel, group, owner, paymentRoute, perspectiveClients, prototypeMode, query, rdo, scope, setupState, sort, weightClass]);

  const clusters = unique(perspectiveClients.map((client) => client.assignment.cluster));
  // Live screens only use the governed office master; the sanitized list is prototype-only.
  const rdoReference = birRdoOptions.length > 0 || !prototypeMode ? birRdoOptions : prototypeBirOfficeOptions;
  const rdos = unique(perspectiveClients.map((client) => birOfficeLabel(client.entities[0]?.profile.rdoOrLts, rdoReference)));
  const owners = unique(perspectiveClients.flatMap((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]));
  const groups = unique(perspectiveClients.map((client) => client.clientGroup));
  const filingChannels = unique(perspectiveClients.map((client) => client.entities[0]?.profile.filingChannel));
  const setupStates = unique(perspectiveClients.map((client) => client.entities[0]?.profile.profileState));
  const visibleKnownWeight = visibleClients.reduce((total, client) => total + (getClientDisplayWeight(client.entities[0]?.profile ?? { sourceFinalWeight: null, weight: 0 }) ?? 0), 0);
  const rdoOptions = rdoReference;
  const resultCount = visibleClients.length === perspectiveClients.length ? `${perspectiveClients.length} taxpayers` : `${visibleClients.length} of ${perspectiveClients.length} taxpayers`;

  return (
    <FixturePageFrame>
      <header className="module-header">
        <div><h1>Clients</h1><p className="module-header__description">Taxpayers, registration, and servicing context.</p></div>
        <div className="module-header__right"><div className="module-count"><strong>{clientRegistryState === "loading" ? "Loading client repository…" : resultCount}</strong><small>{clientRegistryState === "error" ? "Repository unavailable" : `${visibleKnownWeight} assessed weight · ${prototypeMode ? "sanitized fixtures" : "live repository"}`}</small></div><div className="module-actions"><button aria-label="Export current client list as CSV" className="button button--quiet button--small" disabled={clientRegistryState === "loading" || visibleClients.length === 0} onClick={() => downloadClientRegistryCsv(visibleClients, rdoReference)} type="button">Export CSV</button>{canManageClientRecords && <>{prototypeMode && <button className="button button--quiet button--small" onClick={() => { setSetupMessage(null); setCsvImportOpen(true); }} type="button">Import CSV</button>}<button className="button button--primary button--small" onClick={() => { setSetupMessage(null); setDraftToEdit(null); setSetupDrawerOpen(true); }} type="button">Start client setup</button></>}<Link className="button button--quiet button--small" href="/app/team">Manage people in Team</Link></div></div>
      </header>

      {setupMessage && <div className="saved-notice" role="status">{setupMessage}</div>}

      <nav aria-label="Clients views" className="tower-tabs module-tabs" role="tablist">
        <button aria-selected={!showCrfs} className={!showCrfs ? "tower-tab tower-tab--active" : "tower-tab"} id="clients-registry-tab" onClick={() => setView("registry")} role="tab" tabIndex={!showCrfs ? 0 : -1} type="button">All Clients</button>
        <button aria-selected={showCrfs} className={showCrfs ? "tower-tab tower-tab--active" : "tower-tab"} id="clients-crf-tab" onClick={() => setView("crfs")} role="tab" tabIndex={showCrfs ? 0 : -1} type="button">CRF repository</button>
      </nav>

      <div aria-labelledby="clients-registry-tab" className="clients-tab-panel" hidden={showCrfs} id="clients-registry-panel" role="tabpanel" tabIndex={0}><>
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
              <FilterSelect label="RDO" onChange={setRdo} options={rdos} value={rdo} />
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
            <thead><tr><th scope="col">Taxpayer</th><th scope="col">TIN</th><th scope="col">RDO</th><th scope="col">Filing</th><th scope="col">Team</th><th scope="col">Weight</th><th scope="col">Payment</th><th scope="col">Audit</th><th scope="col">Attention</th></tr></thead>
            <tbody>{visibleClients.map((client) => <TaxpayerRow client={client} key={client.id} rdoOptions={rdoReference} />)}</tbody>
          </table>
          {visibleClients.length === 0 && <div className="inline-empty">{clientRegistryState === "empty" ? "No taxpayers are configured yet. Start client setup to add the first record." : clientRegistryState === "error" ? "The client repository could not be loaded. Refresh or contact an administrator." : "No taxpayers match these filters. Try clearing a filter or searching a different identifier."}</div>}
        </div>
      </section>

      {prototypeMode && setupDrafts.some((draft) => draft.status !== "submitted") && <section aria-label="Setup drafts" className="panel panel--table registry-panel setup-drafts-panel"><SectionHeading title="Setup drafts" /><div aria-label="Client setup drafts" className="setup-draft-list">{setupDrafts.filter((draft) => draft.status !== "submitted").map((draft) => <button aria-label={`Resume setup for ${draft.client.clientDisplayName}`} className="setup-draft-row" key={draft.client.clientReferenceCode} onClick={() => { setSetupMessage(null); setDraftToEdit(draft); setSetupDrawerOpen(true); }} type="button"><span><strong>{draft.client.clientDisplayName}</strong><small>Last saved · {draft.createdAt}</small></span><span className="setup-draft-row__action">Resume →</span></button>)}</div></section>}

      {setupDrawerOpen && <ClientSetupDrawer initialDraft={draftToEdit} onClose={() => { setSetupDrawerOpen(false); setDraftToEdit(null); }} onSaved={(referenceCode, mode) => { setSetupDrawerOpen(false); setDraftToEdit(null); setSetupDrafts(readSetupDrafts()); setSetupMessage(mode === "submitted" ? `Setup ${referenceCode} submitted.` : `Setup draft ${referenceCode} saved.`); refreshClientRegistry().catch(() => undefined); }} prototypeMode={prototypeMode} rdoOptions={rdoOptions} />}
      {csvImportOpen && <ClientCsvImportDrawer onClose={() => setCsvImportOpen(false)} onImported={(message) => { setCsvImportOpen(false); setSetupMessage(message); }} />}
      </></div>
      <div aria-labelledby="clients-crf-tab" className="clients-tab-panel" hidden={!showCrfs} id="clients-crf-panel" role="tabpanel" tabIndex={0}><CrfRepositoryView /></div>
    </FixturePageFrame>
  );
}

function ClientSetupDrawer({ initialDraft, onClose, onSaved, prototypeMode, rdoOptions }: { initialDraft?: ClientSetupDraft | null; onClose: () => void; onSaved: (referenceCode: string, mode: "draft" | "submitted") => void; prototypeMode: boolean; rdoOptions: readonly BirOfficeOption[] }) {
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<ClientOnboardingIdentity>(() => initialDraft?.client ?? { clientReferenceCode: "", clientDisplayName: "", entityReferenceCode: "", entityDisplayName: "", tin: "", unitReferenceCode: "RU-NEW-HO", unitDisplayName: "Head Office", unitKind: "head_office", sourceReference: "" });
  const [contract, setContract] = useState<ClientOnboardingContract>(() => initialDraft?.contract ?? { recordType: "not_confirmed", referenceCode: "", sourceReference: "" });
  const [registrationFacts, setRegistrationFacts] = useState(() => initialDraft ? { ...initialDraft.registrationFacts, accountingSystem: normalizedAccountingSystem(initialDraft.registrationFacts.accountingSystem) } : { rdoOrLts: "", registeredAddress: "", registrationReference: "", registrationDate: "", taxYearBasis: "", fiscalYearEnd: "", firstPeriodToFile: "", accountingSystem: "", booksType: "", invoicing: "", filingChannel: "", eFPSGroup: "" });
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(() => initialDraft?.registrationFacts.taxYearBasis === "Calendar year" ? "December" : initialDraft?.registrationFacts.fiscalYearEnd?.split(" ")[0] ?? "");
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState(() => initialDraft?.registrationFacts.taxYearBasis === "Calendar year" ? "31" : initialDraft?.registrationFacts.fiscalYearEnd?.split(" ")[1] ?? "");
  const [proposedReturnCodes, setProposedReturnCodes] = useState<string[]>(() => initialDraft?.registrationFacts.proposedReturnCodes ?? initialDraft?.registrationFacts.registeredReturnCodes ?? []);
  const [operatingSetup, setOperatingSetup] = useState(() => ({ enateSetup: initialDraft?.registrationFacts.enateSetup ?? "Unknown" as "Yes" | "No" | "Unknown", paymentRoute: initialDraft?.registrationFacts.paymentRoute ?? "Not configured" as "Client Pays" | "TMF Pays" | "Not configured" }));
  const [deadlinePolicy, setDeadlinePolicy] = useState<DeadlinePolicyDraft>(() => deadlineDraftFromPolicy(initialDraft?.registrationFacts.deadlinePolicy));
  const [documents, setDocuments] = useState<ClientOnboardingDocument[]>(() => initialDraft?.documents ?? clientOnboardingDocumentTypes.map(({ id }) => ({ type: id, status: "not_captured", sourceReference: "", notes: "" })));
  const [error, setError] = useState<string | null>(null);
  const [organizationUnitId, setOrganizationUnitId] = useState("");
  const [scopeOptions, setScopeOptions] = useState<Array<{ id: string; name: string; unit_kind: string }>>([]);
  const readiness = getClientOnboardingReadiness(identity, documents);
  const [permanentFileLink, setPermanentFileLink] = useState(() => initialDraft?.registrationFacts.permanentFileLink ?? initialDraft?.client.sourceReference ?? "");
  const steps = ["Client & contract", "BIR registration", "Operating setup", "Sources", "Review"];
  const returnsNeedReview = proposedReturnCodes.length === 0;

  useEffect(() => {
    if (prototypeMode) return;
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
        setScopeOptions(units);
        // Choose for the person only when there is nothing to choose.
        if (units.length === 1 && units[0]) setOrganizationUnitId(units[0].id);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load operating scopes.");
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  function updateIdentity(field: keyof ClientOnboardingIdentity, value: string) {
    setIdentity((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function updateDocument(index: number, patch: Partial<ClientOnboardingDocument>) {
    setDocuments((current) => current.map((document, documentIndex) => documentIndex === index ? { ...document, ...patch } : document));
    setError(null);
  }

  function nextStep() {
    if (step === 0 && (readiness.identityGaps.length > 0 || !identity.goLiveDate)) {
      setError(readiness.identityGaps[0] ?? "Go-live date is required.");
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

  async function saveDraft(event?: React.FormEvent<HTMLFormElement>, mode: "draft" | "submitted" = "draft") {
    event?.preventDefault();
    const normalizedReference = identity.clientReferenceCode.trim().toUpperCase();
    const normalizedName = identity.clientDisplayName.trim();
    if (!normalizedReference || !normalizedName || !identity.goLiveDate || (!prototypeMode && !organizationUnitId)) {
      setError("CRM number, client name, go-live date, and operating scope are required to save an intake draft.");
      setStep(0);
      return;
    }
    if (!permanentFileLink.trim()) {
      setError("Record the permanent file location before saving the intake draft.");
      setStep(3);
      return;
    }
    if (registrationFacts.firstPeriodToFile && identity.goLiveDate && registrationFacts.firstPeriodToFile < identity.goLiveDate.slice(0, 7)) {
      setError("The first period to file cannot be before the go-live month.");
      setStep(0);
      return;
    }
    if (mode === "submitted" && !registrationFacts.firstPeriodToFile) {
      setError("First period to file is required before submitting setup.");
      setStep(0);
      return;
    }
    const draftIdentity = {
      ...identity,
      clientReferenceCode: normalizedReference,
      clientDisplayName: normalizedName,
      entityReferenceCode: generatedEntityReference(normalizedReference),
      entityDisplayName: identity.entityDisplayName.trim(),
      tin: normalizeTinDigits(identity.tin),
      unitReferenceCode: normalizedUnitReference(normalizedReference, identity.unitKind),
      unitDisplayName: identity.unitKind === "head_office" ? "Head Office" : identity.unitKind === "branch" ? "Branch" : "Other registration unit",
      sourceReference: permanentFileLink.trim(),
      goLiveDate: identity.goLiveDate,
    };
    const draftRegistrationFacts = {
      ...registrationFacts,
      registrationEffective: registrationFacts.registrationDate,
      fiscalYearEnd: registrationFacts.taxYearBasis === "Calendar year" ? "December 31" : registrationFacts.taxYearBasis === "Fiscal year" && fiscalYearEndMonth && fiscalYearEndDay ? `${fiscalYearEndMonth} ${fiscalYearEndDay}` : undefined,
      proposedReturnCodes,
      registeredReturnCodes: proposedReturnCodes,
      goLiveDate: identity.goLiveDate,
      firstPeriodToFile: registrationFacts.firstPeriodToFile || undefined,
      permanentFileLink: permanentFileLink.trim(),
      enateSetup: operatingSetup.enateSetup,
      paymentRoute: operatingSetup.paymentRoute,
      deadlinePolicy: { ...deadlinePolicyFromDraft(deadlinePolicy), sourceReference: permanentFileLink.trim() },
    };
    if (prototypeMode) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem("taxmon.client.setup.drafts") ?? "[]") as unknown;
        const existing = Array.isArray(parsed) ? parsed : [];
        const duplicate = !initialDraft && existing.some((item) => {
          if (!item || typeof item !== "object") return false;
          const client = (item as { client?: { clientReferenceCode?: unknown } }).client;
          return typeof client?.clientReferenceCode === "string" && client.clientReferenceCode.toUpperCase() === normalizedReference;
        });
        if (duplicate) throw new Error(`An intake draft already uses reference ${normalizedReference}.`);
        const nextDraft = {
          version: 3,
          importSource: "manual_setup",
          client: draftIdentity,
          contract: { ...contract, referenceCode: normalizedReference, sourceReference: permanentFileLink.trim() },
          registrationFacts: draftRegistrationFacts,
          documents,
          readiness,
          status: mode === "submitted" ? "submitted" : "intake_pending",
          createdAt: fixtureClock.label,
        };
        const nextDrafts = initialDraft ? existing.map((item) => {
          if (!item || typeof item !== "object") return item;
          const client = (item as { client?: { clientReferenceCode?: unknown } }).client;
          return typeof client?.clientReferenceCode === "string" && client.clientReferenceCode.toUpperCase() === normalizedReference ? nextDraft : item;
        }) : [...existing, nextDraft];
        window.localStorage.setItem("taxmon.client.setup.drafts", JSON.stringify(nextDrafts));
        window.dispatchEvent(new Event(prototypeClientSetupUpdatedEvent));
        onSaved(normalizedReference, mode);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save the local intake draft.");
      }
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
          unitReferenceCode: normalizedUnitReference(normalizedReference, identity.unitKind),
          unitDisplayName: identity.unitKind === "head_office" ? "Head Office" : identity.unitKind === "branch" ? "Branch" : "Other registration unit",
          unitKind: identity.unitKind,
          registrationReference: registrationFacts.registrationReference.trim() || undefined,
          organizationUnitId,
          sourceReference: permanentFileLink.trim(),
          sourceSystem: prototypeMode ? "synthetic_fixture" : "sharepoint",
          sourceNotes: readiness.sourcePackGaps.join(" ") || undefined,
          profileData: {
            ...draftRegistrationFacts,
          },
          contractData: { ...contract, referenceCode: normalizedReference, sourceReference: permanentFileLink.trim() },
          sourcePack: documents,
        }),
      });
      const result = await response.json() as { error?: string; details?: string[] };
      if (!response.ok) throw new Error([result.error, ...(result.details ?? [])].filter(Boolean).join(" ") || "Unable to save the client setup.");
      onSaved(normalizedReference, mode);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the client setup.");
    }
  }

  const currentStep = steps[step];
  return <DetailDrawer eyebrow="Client registry · onboarding intake" title="Start client setup" subtitle="Capture the registration pack first. Activation, assignment, and generated compliance work remain separate controlled steps." onClose={onClose}>
    <form className="form-stack onboarding-drawer" data-usage-form="client_setup" onSubmit={saveDraft}>
      <div className="onboarding-steps" aria-label="Client onboarding steps">{steps.map((label, index) => <button aria-current={step === index ? "step" : undefined} className={step === index ? "onboarding-step onboarding-step--active" : "onboarding-step"} key={label} onClick={() => { setError(null); setStep(index); }} type="button"><span>{index + 1}</span>{label}</button>)}</div>
      <div className="onboarding-status"><strong>{currentStep}</strong><span>{readiness.status === "intake_incomplete" || !identity.goLiveDate ? "Minimum client setup is incomplete" : readiness.status === "source_pack_incomplete" ? `${readiness.sourcePackGaps.length} source item${readiness.sourcePackGaps.length === 1 ? "" : "s"} need a recorded status` : "Ready for human source review"}</span></div>
      {step === 0 && <div className="form-stack"><div className="drawer-section-intro"><strong>Start with the client record</strong><span>The CRM number is the unique client code and contract record. Keep the client account and registered taxpayer distinct because one client can have more than one taxpayer or registration unit.</span></div><div className="form-grid"><Field label="CRM no. / client code"><input autoFocus onChange={(event) => updateIdentity("clientReferenceCode", event.target.value)} placeholder="e.g. CRM-2026-001" required value={identity.clientReferenceCode} /></Field><Field label="Client / account name"><input onChange={(event) => updateIdentity("clientDisplayName", event.target.value)} placeholder="Approved client name" required value={identity.clientDisplayName} /></Field><Field label="Registered taxpayer name"><input onChange={(event) => updateIdentity("entityDisplayName", event.target.value)} placeholder="Name from 2303" required value={identity.entityDisplayName} /></Field><Field label="TIN"><input inputMode="numeric" maxLength={17} onChange={(event) => updateIdentity("tin", normalizeTinDigits(event.target.value))} placeholder="000-000-000-00000" value={formatTin(identity.tin)} /><small className="form-field__hint">Numbers only. Branch code is included when supplied by the registration source.</small></Field><Field label="Registration unit"><select onChange={(event) => { const unitKind = event.target.value as ClientOnboardingIdentity["unitKind"]; updateIdentity("unitKind", unitKind); updateIdentity("unitDisplayName", unitKind === "head_office" ? "Head Office" : unitKind === "branch" ? "Branch" : "Other registration unit"); updateIdentity("unitReferenceCode", `${normalizedUnitReference(identity.clientReferenceCode, unitKind)}`); }} value={identity.unitKind}><option value="head_office">Head Office</option><option value="branch">Branch</option><option value="other">Other registration unit</option></select></Field><Field label="Go-live date"><input required onChange={(event) => updateIdentity("goLiveDate", event.target.value)} type="date" value={identity.goLiveDate ?? ""} /></Field><Field label="First period to file"><input aria-describedby="first-period-to-file-hint" min={identity.goLiveDate?.slice(0, 7)} onChange={(event) => setRegistrationFacts({ ...registrationFacts, firstPeriodToFile: event.target.value })} type="month" value={registrationFacts.firstPeriodToFile ?? ""} /><small className="form-field__hint" id="first-period-to-file-hint">The first tax period included in this engagement.</small></Field>{!prototypeMode && <Field label="Cluster / tower"><select onChange={(event) => { setOrganizationUnitId(event.target.value); setError(null); }} required value={organizationUnitId}><option value="">Select the team that will own this client</option>{scopeOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.unit_kind === "a_and_t" ? " (whole A&T)" : ""}</option>)}</select></Field>}</div><div className="drawer-section-intro"><strong>Main contract record</strong><span>Select MSA or LSA. Addenda and CRF/CRN records belong in the additional-engagement repository.</span></div><Field label="Main contract type"><select onChange={(event) => setContract((current) => ({ ...current, recordType: event.target.value as ClientOnboardingContract["recordType"] }))} value={contract.recordType}>{clientOnboardingMainContractTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></Field></div>}

      {step === 1 && <div className="form-stack"><div className="drawer-section-intro"><strong>Record the BIR registration facts</strong><span>Use the values from the 2303 or approved source.</span></div><div className="form-grid"><Field label="RDO"><select required onChange={(event) => setRegistrationFacts({ ...registrationFacts, rdoOrLts: event.target.value })} value={registrationFacts.rdoOrLts}><option value="">Select RDO</option>{rdoOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}<option value="Needs review">Needs review</option></select></Field><Field label="Registration reference / OCN"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, registrationReference: event.target.value })} placeholder="Certificate or OCN reference" required value={registrationFacts.registrationReference} /></Field><Field label="Registration date"><input onChange={(event) => setRegistrationFacts({ ...registrationFacts, registrationDate: event.target.value })} required type="date" value={registrationFacts.registrationDate} /></Field><Field label="Tax year basis"><select onChange={(event) => { const taxYearBasis = event.target.value; setRegistrationFacts({ ...registrationFacts, taxYearBasis, fiscalYearEnd: taxYearBasis === "Calendar year" ? "December 31" : "" }); if (taxYearBasis === "Calendar year") { setFiscalYearEndMonth("December"); setFiscalYearEndDay("31"); } else { setFiscalYearEndMonth(""); setFiscalYearEndDay(""); } }} required value={registrationFacts.taxYearBasis}><option value="">Not configured</option><option>Calendar year</option><option>Fiscal year</option></select></Field><div className="form-field"><span>Fiscal year-end</span><div className="form-grid form-grid--compact"><select aria-label="Fiscal year-end month" disabled={registrationFacts.taxYearBasis !== "Fiscal year"} onChange={(event) => { const month = event.target.value; setFiscalYearEndMonth(month); setFiscalYearEndDay(""); }} required={registrationFacts.taxYearBasis === "Fiscal year"} value={fiscalYearEndMonth}><option value="">Month</option>{fiscalYearMonths.map((month) => <option key={month}>{month}</option>)}</select><select aria-label="Fiscal year-end day" disabled={registrationFacts.taxYearBasis !== "Fiscal year" || !fiscalYearEndMonth} onChange={(event) => setFiscalYearEndDay(event.target.value)} required={registrationFacts.taxYearBasis === "Fiscal year"} value={fiscalYearEndDay}><option value="">Day</option>{fiscalYearDays.slice(0, fiscalYearDayCount[fiscalYearEndMonth] ?? 31).map((day) => <option key={day}>{day}</option>)}</select></div></div><Field label="Accounting system"><select onChange={(event) => setRegistrationFacts({ ...registrationFacts, accountingSystem: event.target.value })} required value={registrationFacts.accountingSystem}><option value="">Not configured</option>{clientAccountingSystemOptions.filter((option) => option !== "Not configured").map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Books"><select onChange={(event) => setRegistrationFacts({ ...registrationFacts, booksType: event.target.value })} required value={registrationFacts.booksType}><option value="">Not configured</option>{clientBooksOptions.filter((option) => option !== "Not configured").map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Receipts / invoicing"><select onChange={(event) => setRegistrationFacts({ ...registrationFacts, invoicing: event.target.value })} required value={registrationFacts.invoicing}><option value="">Not configured</option>{clientInvoicingOptions.filter((option) => option !== "Not configured").map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Filing channel"><select onChange={(event) => { const filingChannel = event.target.value; setRegistrationFacts({ ...registrationFacts, filingChannel, eFPSGroup: filingChannel === "eFPS" ? registrationFacts.eFPSGroup : "Not applicable" }); }} required value={registrationFacts.filingChannel}><option value="">Not configured</option>{filingChannels.map((channel) => <option key={channel.code} value={channel.label}>{channel.label}</option>)}</select></Field><Field label="eFPS group"><select disabled={registrationFacts.filingChannel !== "eFPS"} onChange={(event) => setRegistrationFacts({ ...registrationFacts, eFPSGroup: event.target.value })} required={registrationFacts.filingChannel === "eFPS"} value={registrationFacts.filingChannel === "eFPS" ? registrationFacts.eFPSGroup : "Not applicable"}><option value="">Not configured</option>{clientEfpsGroupOptions.map((option) => <option key={option}>{option}</option>)}<option>Not applicable</option><option>Needs review</option></select></Field></div><Field label="Registered address"><textarea onChange={(event) => setRegistrationFacts({ ...registrationFacts, registeredAddress: event.target.value })} placeholder="Address from 2303" required value={registrationFacts.registeredAddress} /></Field><ReturnTaxSelector invalid={returnsNeedReview} selectedCodes={proposedReturnCodes} onChange={setProposedReturnCodes} /></div>}

      {step === 2 && <DeadlinePolicyStep operatingSetup={operatingSetup} policy={deadlinePolicy} onChangeOperatingSetup={setOperatingSetup} onChange={setDeadlinePolicy} />}
      {step === 3 && <div className="form-stack"><div className="drawer-section-intro"><strong>Record the source pack</strong><span>Use one permanent file location for the client record, a SharePoint link or a shared-drive path. Each source is explicitly marked so “not applicable” is not confused with “missing”.</span></div><Field label="Permanent file location"><input maxLength={240} required onChange={(event) => { const value = event.target.value; setPermanentFileLink(value); setDocuments((current) => current.map((document) => document.status === "received" ? { ...document, sourceReference: value } : document)); }} placeholder={prototypeMode ? "synthetic://permanent-file/CRM-2026-001" : "SharePoint link or shared-drive path"} type="text" value={permanentFileLink} /></Field><div className="onboarding-document-list">{documents.map((document, index) => { const definition = clientOnboardingDocumentTypes.find((candidate) => candidate.id === document.type); if (!definition) return null; return <div className={document.status === "not_captured" ? "onboarding-document onboarding-document--invalid" : "onboarding-document"} key={document.type}><div><strong>{definition.label}</strong><small>{definition.detail}</small></div><select aria-label={`${definition.label} status`} onChange={(event) => updateDocument(index, { status: event.target.value as ClientOnboardingDocument["status"], sourceReference: event.target.value === "received" ? permanentFileLink : "" })} value={document.status}>{clientOnboardingDocumentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{(document.status === "not_applicable" || document.status === "unknown") && <input aria-label={`${definition.label} rationale`} required onChange={(event) => updateDocument(index, { notes: event.target.value })} placeholder="Reason or follow-up" value={document.notes} />}</div>; })}</div><div className="drawer-form-note">Source review, extraction, correction, and validation remain separate controlled steps after this intake draft. This checklist does not activate a Tax Profile or generate work.</div></div>}

      {step === 4 && <div className="form-stack"><div className="drawer-section-intro"><strong>Ready to submit</strong><span>Save for later, or submit this setup when the onboarding record is complete.</span></div><div className="onboarding-review-grid"><div><span>CRM / taxpayer</span><strong>{identity.clientReferenceCode || "Not entered"}</strong><small>{identity.entityDisplayName || "Taxpayer name not entered"} · go-live {identity.goLiveDate || "not set"}</small></div><div><span>First period to file</span><strong>{registrationFacts.firstPeriodToFile || "Not set"}</strong><small>Periods before this are excluded from the client calendar.</small></div><div><span>Contract record</span><strong>{clientOnboardingContractTypes.find((type) => type.id === contract.recordType)?.label}</strong><small>Uses CRM no. as the contract reference</small></div><div><span>Returns</span><strong>{proposedReturnCodes.length > 0 ? proposedReturnCodes.join(" · ") : "None selected"}</strong><small>Tax Team approval still controls work generation</small></div><div><span>Deadline policy</span><strong>{deadlinePolicy.mode === "follow_group" ? "Follow group schedule" : "Client-specific timing"}</strong><small>{deadlinePolicyOffsetSummary(deadlinePolicy)} · flows into the service calendar after publication</small></div><div><span>Source pack</span><strong>{documents.filter((document) => document.status === "received").length} checked · {readiness.sourcePackGaps.length} unresolved</strong><small>{permanentFileLink || "Permanent file location not recorded"}</small></div></div>{(readiness.identityGaps.length > 0 || !identity.goLiveDate) && <div className="form-error" role="alert">{[...readiness.identityGaps, ...(!identity.goLiveDate ? ["Go-live date is required."] : [])].join(" ")}</div>}{readiness.sourcePackGaps.length > 0 && <div className="onboarding-gap-list"><strong>Still unresolved</strong>{readiness.sourcePackGaps.map((gap) => <span key={gap}>{gap}</span>)}</div>}<div className="drawer-form-note">The service calendar begins with the first period to file and uses only the selected returns after their governed deadlines are published.</div></div>}

      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="onboarding-actions"><button className="button button--quiet" disabled={step === 0} onClick={() => { setError(null); setStep((current) => Math.max(current - 1, 0)); }} type="button">Back</button><div className="onboarding-actions__submit"><button className="button button--quiet" formNoValidate type="submit">Save draft</button>{step < steps.length - 1 ? <button className="button button--primary" onClick={nextStep} type="button">Next</button> : <button className="button button--primary" onClick={() => { void saveDraft(undefined, "submitted"); }} type="button">Submit setup</button>}</div></div>
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

function deadlineDraftFromPolicy(policy?: ClientDeadlinePolicy): DeadlinePolicyDraft {
  return {
    mode: policy?.mode ?? "follow_group",
    sourceReference: policy?.sourceReference ?? "",
    clientProvideLeadDays: policy?.clientProvideLeadDays === undefined ? "" : String(policy.clientProvideLeadDays),
    clientApprovalLeadDays: policy?.clientApprovalLeadDays === undefined ? "" : String(policy.clientApprovalLeadDays),
    tmfPackageLeadDays: policy?.tmfPackageLeadDays === undefined ? "" : String(policy.tmfPackageLeadDays),
    estimatedFilingLeadDays: policy?.estimatedFilingLeadDays === undefined ? "" : String(policy.estimatedFilingLeadDays),
    estimatedPaymentLeadDays: policy?.estimatedPaymentLeadDays === undefined ? "" : String(policy.estimatedPaymentLeadDays),
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
  return <div className="form-stack"><div className="drawer-section-intro"><strong>Operating setup</strong><span>Record the client-specific servicing controls. These do not change the governed statutory deadline.</span></div><div className="form-grid"><Field invalid={operatingSetup.enateSetup === "Unknown"} label="eNATE setup" required><select onChange={(event) => onChangeOperatingSetup({ ...operatingSetup, enateSetup: event.target.value as typeof operatingSetup.enateSetup })} value={operatingSetup.enateSetup}><option>Unknown</option><option>Yes</option><option>No</option></select></Field><Field invalid={operatingSetup.paymentRoute === "Not configured"} label="Payment route" required><select onChange={(event) => onChangeOperatingSetup({ ...operatingSetup, paymentRoute: event.target.value as typeof operatingSetup.paymentRoute })} value={operatingSetup.paymentRoute}><option>Not configured</option><option>Client Pays</option><option>TMF Pays</option></select></Field></div><div className="drawer-section-intro"><strong>How should this client be timed?</strong><span>The Tax Team-published deadline remains the statutory/operational anchor. Choose whether this client follows the group schedule or has its own working-day offsets.</span></div><Field label="Deadline basis"><select aria-label="Deadline basis" onChange={(event) => update("mode", event.target.value)} value={policy.mode}>{clientDeadlineModes.map((mode) => <option key={mode} value={mode}>{mode === "follow_group" ? "Follow group published deadline" : "Define client operating dates"}</option>)}</select></Field>{policy.mode === "client_defined" && <><div className="drawer-section-intro"><strong>Client service milestones</strong><span>Enter working days before the published deadline. These dates recalculate for every activity period; they do not change the statutory deadline.</span></div><div className="form-grid"><OffsetField label="Client provides information" value={policy.clientProvideLeadDays} onChange={(value) => update("clientProvideLeadDays", value)} /><OffsetField label="Client approval due" value={policy.clientApprovalLeadDays} onChange={(value) => update("clientApprovalLeadDays", value)} /><OffsetField label="TMF package target" value={policy.tmfPackageLeadDays} onChange={(value) => update("tmfPackageLeadDays", value)} /><OffsetField label="Estimated filing" value={policy.estimatedFilingLeadDays} onChange={(value) => update("estimatedFilingLeadDays", value)} /><OffsetField label="Estimated payment" value={policy.estimatedPaymentLeadDays} onChange={(value) => update("estimatedPaymentLeadDays", value)} /></div><div className="drawer-form-note">The client’s permanent source file is the policy provenance. No second free-text source field is needed here.</div></>}{policy.mode === "follow_group" && <div className="drawer-form-note">Group-published dates will flow into the client calendar automatically. Client approval and other service milestones remain visibly unconfigured until a group or client-specific operating policy supplies them.</div>}</div>;
}

function OffsetField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={`${label} · working days before due`}><input aria-label={label} inputMode="numeric" max="365" min="0" onChange={(event) => onChange(event.target.value)} placeholder="e.g. 5" type="number" value={value} /></Field>;
}

function normalizedAccountingSystem(value: string | undefined) {
  if (!value) return "";
  if (clientAccountingSystemOptions.includes(value as (typeof clientAccountingSystemOptions)[number])) return value;
  if (/xero/i.test(value)) return "TMF · Xero";
  if (/qne/i.test(value)) return "TMF · QNE";
  if (/quickbooks/i.test(value)) return "Client · QuickBooks (legacy)";
  return "Needs review";
}

function normalizedUnitReference(clientReferenceCode: string, unitKind: ClientOnboardingIdentity["unitKind"]) {
  const suffix = unitKind === "head_office" ? "HO" : unitKind === "branch" ? "BR" : "UNIT";
  return `RU-${clientReferenceCode.trim().toUpperCase() || "NEW"}-${suffix}`.slice(0, 64);
}

function readSetupDrafts(): ClientSetupDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem("taxmon.client.setup.drafts") ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ClientSetupDraft => {
      if (!item || typeof item !== "object") return false;
      const draft = item as Partial<ClientSetupDraft>;
      return Boolean(draft.client && typeof draft.client === "object" && typeof draft.client.clientReferenceCode === "string" && draft.registrationFacts && typeof draft.registrationFacts === "object" && Array.isArray(draft.documents));
    });
  } catch {
    return [];
  }
}

function Field({ label, children, invalid = false, required = false }: { label: string; children: React.ReactNode; invalid?: boolean; required?: boolean }) {
  return <label className={invalid ? "form-field form-field--invalid" : "form-field"}><span>{label}{required ? " *" : ""}</span>{children}{invalid && <small className="form-field__error">Required</small>}</label>;
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
  if (sort === "weight") return (rightProfile ? getClientDisplayWeight(rightProfile) ?? -1 : -1) - (leftProfile ? getClientDisplayWeight(leftProfile) ?? -1 : -1) || left.name.localeCompare(right.name);
  if (sort === "attention") return Number(hasAttention(right)) - Number(hasAttention(left)) || left.name.localeCompare(right.name);
  if (sort === "team") return left.assignment.cluster.localeCompare(right.assignment.cluster) || left.assignment.preparer.localeCompare(right.assignment.preparer) || left.name.localeCompare(right.name);
  if (sort === "audit") return Number(Boolean(rightProfile?.auditExposures.some((item) => item.status !== "Closed"))) - Number(Boolean(leftProfile?.auditExposures.some((item) => item.status !== "Closed"))) || left.name.localeCompare(right.name);
  return left.name.localeCompare(right.name);
}

function downloadClientRegistryCsv(clients: readonly FixtureClient[], rdoOptions: readonly BirOfficeOption[]) {
  const headers = ["client_id", "client_name", "taxpayer_name", "tin", "registration_unit", "rdo", "filing_channel", "team", "cluster", "preparer", "checker", "reviewer", "source_weight_classification", "source_final_weight", "profile_state", "payment_route", "open_audit_count", "attention_count", "contract_repository"];
  const rows = clients.map((client) => {
    const profile = client.entities[0]?.profile;
    const openAuditCount = profile?.auditExposures.filter((item) => item.status !== "Closed").length ?? 0;
    return [
      client.id,
      client.name,
      profile?.registeredTaxpayerName ?? "",
      profile?.tinDisplay ?? "",
      client.entities[0]?.units.map((unit) => unit.name).join(" · ") ?? "",
      birOfficeLabel(profile?.rdoOrLts, rdoOptions),
      profile?.filingChannel ?? "",
      client.assignment.tower,
      client.assignment.cluster,
      client.assignment.preparer,
      client.assignment.checker,
      client.assignment.reviewer,
      profile?.sourceWeightClassification ?? "Unweighted test",
      profile?.sourceFinalWeight ?? "",
      profile?.profileState ?? "",
      profile?.paymentRoute ?? "",
      openAuditCount,
      hasAttention(client) ? profile?.attention.length || 1 : 0,
      client.contractRepository.referenceCode,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `taxmon-client-register-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function FilterSelect({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <label className="register-filter"><span>{label}</span><select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}><option value="all">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TaxpayerRow({ client, rdoOptions }: { client: FixtureClient; rdoOptions: readonly BirOfficeOption[] }) {
  const profile = client.entities[0].profile;
  const clientHasAttention = hasAttention(client);
  const openAuditCount = profile.auditExposures.filter((item) => item.status !== "Closed").length;
  const auditLabel = openAuditCount > 0 ? `${openAuditCount} open` : profile.auditExposures.length > 0 ? `${profile.auditExposures.length} closed` : "No open audit";
  const weightLabel = getClientDisplayWeightLabel(profile);
  const displayWeight = getClientDisplayWeight(profile);
  const numericWeight = displayWeight === null ? "—" : displayWeight;
  const filingLabel = controlledOptionLabel(profile.filingChannel, clientFilingChannelOptions);
  const filingDetail = filingLabel === "eFPS" ? controlledOptionLabel(profile.eFPSGroup, ["", ...clientEfpsGroupOptions, "Not applicable", "Needs review"]) : undefined;

  return (
    <tr>
      <td data-label="Taxpayer"><Link className="taxpayer-link" href={`/app/clients/${client.id}`}><span><strong>{profile.registeredTaxpayerName}{hasCredibleTaxProfileValidation(profile) && <span aria-label={`Tax Profile validated by ${profile.validator}`} className="profile-verification profile-verification--inline" role="img" title={`Validated by ${profile.validator} on ${profile.lastValidated}`}>✓</span>}</strong><small>{getClientContractSummary(client)} · {client.clientGroup ?? "Independent client relationship"} · {client.entities[0].units.length} unit{client.entities[0].units.length === 1 ? "" : "s"}</small></span></Link></td>
      <td data-label="TIN"><span className="table-value"><strong>{formatTin(profile.tinDisplay) || profile.tinDisplay}</strong></span></td>
      <td data-label="RDO"><span className="table-value">{birOfficeLabel(profile.rdoOrLts, rdoOptions)}</span></td>
      <td data-label="Filing"><span className="table-value"><strong>{filingLabel}</strong>{filingDetail && <small>{filingDetail}</small>}</span></td>
      <td data-label="Team"><span className="table-value"><strong>{client.assignment.cluster}</strong><small>{client.assignment.preparer} · {client.assignment.checker} · {client.assignment.reviewer}</small></span></td>
      <td data-label="Weight"><span className="weight-summary"><span className="weight-mark">{numericWeight}</span><span className="table-value"><strong>{weightLabel}</strong><small>{displayWeight === null ? "No weight recorded" : "Assigned client weight"}</small></span></span></td>
      <td data-label="Payment"><span className="table-value"><strong>{profile.paymentRoute}</strong><small>{profile.enateSetup === "Yes" ? "eNATE setup" : profile.enateSetup === "No" ? "No eNATE" : "eNATE unknown"}</small></span></td>
      <td data-label="Audit"><span className={openAuditCount > 0 ? "attention-open" : "attention-clear"}>{auditLabel}</span></td>
      <td data-label="Attention"><span className={clientHasAttention ? "attention-open" : "attention-clear"}>{clientHasAttention ? `${profile.attention.length || 1} to review` : "Clear"}</span></td>
    </tr>
  );
}
