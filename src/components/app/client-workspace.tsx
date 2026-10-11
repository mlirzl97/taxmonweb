"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  fixtureExceptions,
  fixtureFilingHistory,
  fixtureHistory,
  fixtureTeamHistory,
  fixtureWork,
  getClientContractSummary,
  type FixtureAuthority,
  type FixtureAuditExposure,
  type FixtureClient,
  type FixtureContractDocument,
  type FixtureAdditionalEngagement,
  type FixtureException,
  type FixtureTaxProfile,
} from "@/lib/fixtures";
import { fixtureClock } from "@/lib/fixtures";
import { applyPersistedTaxProfileSnapshot, buildTaxProfilePersistencePayload, hasCredibleTaxProfileValidation, profileActivationGaps, type PersistedTaxProfileSnapshot } from "@/lib/domain/client-profile-persistence";
import { canManageModuleRecords, hasCalibrationEditAccess } from "@/lib/domain/access";
import { useWorkflow } from "@/lib/workflow-state";
import { DetailDrawer, SectionHeading } from "./workspace-components";
import { ClientServiceCalendarView } from "./client-service-calendar";

type DrawerMode = "identity" | "setup" | "authority" | "audit" | null;
type ClientWorkspaceTab = "overview" | "registration" | "activity" | "contracts" | "team" | "sources" | "service-calendar";

const clientWorkspaceTabs: ReadonlyArray<{ id: ClientWorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "registration", label: "Registration" },
  { id: "activity", label: "Operations" },
  { id: "contracts", label: "Contracts" },
  { id: "team", label: "Team" },
  { id: "sources", label: "Sources" },
  { id: "service-calendar", label: "Service calendar" },
];

function clientTabFromHash(hash: string): ClientWorkspaceTab {
  const tab = hash.replace("#client-", "");
  if (tab === "details") return "registration";
  if (tab === "history") return "activity";
  return clientWorkspaceTabs.some((item) => item.id === tab) ? tab as ClientWorkspaceTab : "overview";
}

export function ClientWorkspace({ client, demoMode = false, calibrationEditMode: calibrationEditModeEnabled = false, serverAuthorized = false }: { client: FixtureClient; demoMode?: boolean; calibrationEditMode?: boolean; serverAuthorized?: boolean }) {
  const { accessMatrix, isClientVisible, prototypeMode, workPerspective } = useWorkflow();
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<FixtureTaxProfile>(() => cloneProfile(client.entities[0].profile));
  const [assignment, setAssignment] = useState(client.assignment);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientWorkspaceTab>("overview");
  const [persistenceState, setPersistenceState] = useState<"checking" | "available" | "unavailable">(() => demoMode ? "available" : "checking");
  const initialProfileRef = useRef(profile);
  const initialAssignmentRef = useRef(assignment);

  const units = client.entities[0].units;
  const selectedUnit = units[0];
  const attention = profile.attention;
  const openAuditCount = profile.auditExposures.filter((item) => item.status !== "Closed").length;
  const closedAuditCount = profile.auditExposures.filter((item) => item.status === "Closed").length;
  const profileHistory = prototypeMode ? fixtureHistory.filter((item) => item.clientId === client.id) : [];
  const clientWork = prototypeMode ? fixtureWork.filter((item) => item.clientId === client.id) : [];
  const clientExceptions = prototypeMode ? fixtureExceptions.filter((item) => item.clientId === client.id) : [];
  const openWorkCount = clientWork.filter((item) => item.status !== "GREEN").length;
  const nextWork = clientWork.find((item) => item.status !== "GREEN") ?? clientWork[0];

  useEffect(() => {
    if (demoMode) {
      const stored = window.localStorage.getItem(demoProfileStorageKey(client.id));
      if (!stored) return;
      try {
        const snapshot = JSON.parse(stored) as PersistedTaxProfileSnapshot;
        const restored = applyPersistedTaxProfileSnapshot(initialProfileRef.current, initialAssignmentRef.current, snapshot);
        setProfile(restored.profile);
        setAssignment(restored.assignment);
        setSavedMessage("Saved calibration version loaded.");
      } catch {
        window.localStorage.removeItem(demoProfileStorageKey(client.id));
      }
      return;
    }
    let cancelled = false;
    async function loadSavedProfile() {
      try {
        const response = await fetch(`/api/clients/${client.id}/profile`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { clientFound?: boolean; data?: PersistedTaxProfileSnapshot | null };
        if (cancelled) return;
        setPersistenceState(result.clientFound ? "available" : "unavailable");
        if (!result.data) return;
        const restored = applyPersistedTaxProfileSnapshot(initialProfileRef.current, initialAssignmentRef.current, result.data);
        setProfile(restored.profile);
        setAssignment(restored.assignment);
        setSavedMessage("Saved Tax Profile version loaded.");
      } catch {
        // The fixture read model remains usable when the optional persistence
        // boundary is unavailable; a failed read must not erase local context.
        if (!cancelled) setPersistenceState("unavailable");
      }
    }
    void loadSavedProfile();
    return () => { cancelled = true; };
  }, [client.id, demoMode]);

  const calibrationEditMode = hasCalibrationEditAccess(demoMode, calibrationEditModeEnabled);
  const canEditProfile = canManageModuleRecords(workPerspective, "clients", accessMatrix);
  const editDisabled = !canEditProfile || (!calibrationEditMode && persistenceState !== "available");
  const editTitle = !canEditProfile ? "This access view is read-only for taxpayer setup" : persistenceState === "checking" ? "Checking the saved profile" : persistenceState === "unavailable" ? "This profile is read-only until it is linked to the client repository" : undefined;

  useEffect(() => {
    const syncTabFromHash = () => setActiveTab(clientTabFromHash(window.location.hash));
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  if (!serverAuthorized && !isClientVisible(client)) {
    return <section aria-labelledby="client-access-title" className="persona-access-state"><p className="eyebrow">Client access</p><h1 id="client-access-title">This taxpayer is outside your assigned view</h1><p>Open a taxpayer assigned to your current work or reporting scope.</p><Link className="button button--quiet" href="/app/clients">Back to Clients</Link></section>;
  }

  function selectTab(tab: ClientWorkspaceTab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#client-${tab}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeDrawer() {
    setDrawer(null);
  }

  async function persistProfile(next: FixtureTaxProfile, nextAssignment: FixtureClient["assignment"], reason: string, message: string, action: "save" | "save-and-validate" = "save") {
    if (persistenceState !== "available") {
      setSavedMessage("This fixture is read-only until it is linked to the client repository.");
      return false;
    }
    const gaps = action === "save-and-validate" ? profileActivationGaps(next, nextAssignment, selectedUnit) : [];
    if (gaps.length > 0) {
      setSavedMessage(`Cannot validate yet: ${gaps.join(", ")}.`);
      return false;
    }

    if (calibrationEditMode) {
      const payload = buildTaxProfilePersistencePayload(next, nextAssignment, selectedUnit, reason, fixtureClock.today);
      const snapshot: PersistedTaxProfileSnapshot = {
        state: action === "save-and-validate" ? "active" : "ready_for_validation",
        effectiveFrom: fixtureClock.today,
        profile: payload.profile,
        assignment: payload.assignment,
        validatedAt: action === "save-and-validate" ? fixtureClock.today : null,
        validatedBy: action === "save-and-validate" ? "Master Admin · calibration" : null,
      };
      window.localStorage.setItem(demoProfileStorageKey(client.id), JSON.stringify(snapshot));
      setAssignment(nextAssignment);
      setProfile(applyPersistedTaxProfileSnapshot(next, nextAssignment, snapshot).profile);
      setSavedMessage(`${message} Saved for this sanitized calibration browser.`);
      return true;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${client.id}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
          payload: buildTaxProfilePersistencePayload(next, nextAssignment, selectedUnit, reason),
        }),
      });
      const result = await response.json() as { error?: string; state?: string };
      if (!response.ok) throw new Error(result.error ?? "The profile change could not be saved.");
      setAssignment(nextAssignment);
      setProfile(next);
      setSavedMessage(message);
      setIsSaving(false);
      return true;
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : "The profile change could not be saved.");
      setIsSaving(false);
      return false;
    }
  }

  return (
    <>
      <div className="client-context-bar">
        <div><Link className="breadcrumb-link" href="/app/clients">All Clients</Link><span aria-hidden="true"> / </span><strong>{profile.registeredTaxpayerName}</strong></div>
        <div className="client-context-bar__right"><Link className="breadcrumb-link" href="#client-service-calendar">Service Calendar</Link><span className="context-group">{getClientContractSummary(client)}</span>{client.clientGroup && <span className="context-group">{client.clientGroup}</span>}</div>
      </div>

      <header className="dossier-header">
        <div>
          <h1>{profile.registeredTaxpayerName}</h1>
          <div className="dossier-header__meta"><span>Client reference</span><strong>{client.id}</strong></div>
          {hasCredibleTaxProfileValidation(profile) && <span aria-label={`Tax Profile validated by ${profile.validator}`} className="profile-verification" role="status" title={`Validated by ${profile.validator} on ${profile.lastValidated}`}><span aria-hidden="true">✓</span><span className="sr-only">Tax Profile validated by {profile.validator}</span></span>}
        </div>
      </header>

      {savedMessage && <div className="saved-notice" role="status">{savedMessage}</div>}

      <nav aria-label="Client workspace views" className="tower-tabs client-workspace-tabs" role="tablist">
        {clientWorkspaceTabs.map((tab) => <button aria-controls={`client-panel-${tab.id}`} aria-current={activeTab === tab.id ? "page" : undefined} aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "tower-tab tower-tab--active" : "tower-tab"} id={`client-tab-${tab.id}`} key={tab.id} onClick={() => selectTab(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </nav>

      <div aria-labelledby={`client-tab-${activeTab}`} className="client-tab-panel" id={`client-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
        {activeTab === "overview" && <>
          <ClientOverview attention={attention} client={client} auditCount={openAuditCount} nextWork={nextWork} openWorkCount={openWorkCount} profile={profile} onSelectTab={selectTab} />
        </>}

        {activeTab === "registration" && <div className="client-registration-layout" id="client-registration">
          <section className="dossier-section dossier-section--identity">
            <SectionHeading detail="The taxpayer’s legal identity, BIR registration, filing context, and registered tax types." title="Identity / BIR registration" />
            <div className="dossier-facts">
              <Fact label="Registered name" value={profile.registeredTaxpayerName} wide />
              <Fact label="Client reference" value={client.id} />
              <Fact label="TIN" value={profile.tinDisplay} />
              <Fact label="Head Office / Branch" value={selectedUnit.type} />
              <Fact label="RDO / LTS" value={profile.rdoOrLts} />
              <Fact label="Entity type" value={profile.entityType} />
              <Fact label="Registration status" value={profile.registrationStatus} />
              <Fact label="Registered address" value={profile.registeredAddress} wide />
              <Fact label="Nature / line of business" value={profile.lineOfBusiness} />
              <Fact label="Registration date" value={profile.registrationEffective} />
              <Fact label="Tax year basis" value={profile.taxYearBasis ?? "Not configured"} />
              <Fact label="Fiscal year-end" value={profile.fiscalYearEnd ?? "Not configured"} />
              <Fact label="Filing channel" value={profile.filingChannel} />
              <Fact label="eFPS / eBIRForms context" value={profile.filingContext} />
              {profile.eFPSGroup && <Fact label="eFPS group" value={profile.eFPSGroup} />}
              <Fact label="BIR registered tax types" value={profile.registeredTaxTypes.join(" · ")} wide />
            </div>
            <div className="dossier-section__footer">
              <div><span className="meta-label">Registration record</span><strong>Current effective profile</strong><small>Update the facts here; source provenance and validation remain in Sources.</small></div>
              <button className="text-button" disabled={editDisabled} onClick={() => setDrawer("identity")} title={editTitle} type="button">Edit registration facts</button>
            </div>
          </section>

          <section className="dossier-section dossier-section--history-wide">
            <SectionHeading detail="Effective-dated registration and validation changes." title="Profile history" />
            <div className="history-list">{profileHistory.length > 0 ? profileHistory.slice(0, 3).map((item) => <div className="history-row" key={item.id}><span className="history-row__mark" aria-hidden="true" /><div><strong>{item.label}</strong><small>{item.detail}</small></div><time>{item.date}</time></div>) : <div className="dossier-empty">No material profile changes recorded.</div>}</div>
          </section>

          <div className="dossier-grid dossier-grid--secondary client-registration-context">
            <section className="dossier-section">
              <SectionHeading detail="Standing registrations and authority context only." title="Authorities" />
              {profile.authorities.length === 0 ? <div className="dossier-empty">No authority records configured.</div> : <div className="authority-list">{profile.authorities.map((authority) => <AuthorityRow authority={authority} key={authority.id} />)}</div>}
              <button className="button button--quiet button--small" disabled={editDisabled} onClick={() => setDrawer("authority")} title={editTitle} type="button">Add authority record</button>
            </section>

            <section className="dossier-section">
              <SectionHeading detail="Registration-side books and invoicing context." title="Books & invoicing" />
              <div className="dossier-facts dossier-facts--compact">
                <Fact label="Accounting system" value={profile.accountingSystem ?? "Not configured"} />
                <Fact label="Books type" value={profile.booksType ?? "Not configured"} />
                <Fact label="Invoicing / permit" value={profile.invoicing ?? "Not configured"} />
              </div>
            </section>

          </div>
        </div>}

        {activeTab === "team" && <div className="dossier-grid dossier-grid--secondary" id="client-team">
        <section className="dossier-section dossier-section--setup">
          <SectionHeading detail="Who is accountable for preparing, checking, and reviewing this client." title="Current accountability" />
          <div className="assignment-grid assignment-grid--dossier">
            <Fact label="Cluster" value={assignment.cluster} />
            <Fact label="Preparer" value={assignment.preparer} />
            <Fact label="Checker" value={assignment.checker} />
            <Fact label="Reviewer" value={assignment.reviewer} />
            <Fact label="Effective from" value={assignment.effectiveFrom} />
          </div>
          <div className="dossier-section__footer"><div><span className="meta-label">Accountability record</span><strong>Current assignment</strong><small>Assignment history is shown below.</small></div></div>
        </section>
        <section className="dossier-section dossier-section--setup">
          <SectionHeading detail="Client-specific operating controls used by delivery work." title="TMF operating setup" />
          <div className="setup-summary">
            <Fact label="Client Weight" value={profile.sourceFinalWeight === null ? "Excluded from source reconciliation" : `${profile.sourceFinalWeight} · ${profile.sourceWeightClassification ?? profile.weightLabel}`} />
            <Fact label="eNATE Setup" value={profile.enateSetup} />
            <Fact label="Payment Route" value={profile.paymentRoute} />
          </div>
          {profile.paymentRoute === "TMF Pays" && <div className="policy-note"><strong>Funding control</strong><span>Funding must be confirmed before TMF executes payment. This profile stores the route; Tax Run owns the downstream block.</span></div>}
          <div className="dossier-section__footer"><div><span className="meta-label">Setup record</span><strong>Current effective setup</strong><small>Weight is a workload signal, not a capacity limit.</small></div><button className="text-button" disabled={editDisabled} onClick={() => setDrawer("setup")} title={editTitle} type="button">Edit assignment &amp; setup</button></div>
        </section>
        <section className="dossier-section dossier-section--history-wide" aria-labelledby="team-history-title"><SectionHeading detail="Effective-dated preparer, checker, reviewer, and team changes." title="Assignment history" /><TeamHistoryTable client={client} /></section>
        </div>}

        {activeTab === "contracts" && <div className="dossier-grid dossier-grid--secondary" id="client-contracts"><ContractRepositorySection client={client} /></div>}

        {activeTab === "activity" && <ClientActivitySection auditExposures={profile.auditExposures} closedAuditCount={closedAuditCount} exceptions={clientExceptions} openAuditCount={openAuditCount} work={clientWork} client={client} />}

        {activeTab === "service-calendar" && <div className="dossier-grid dossier-grid--secondary dossier-grid--wide" id="client-service-calendar"><section className="dossier-section"><ClientServiceCalendarView client={client} clientName={profile.registeredTaxpayerName} profile={profile} /></section></div>}

      {activeTab === "sources" && <div className="dossier-grid dossier-grid--secondary" id="client-sources">
        <section className="dossier-section dossier-section--source-record">
          <SectionHeading detail="The source, provenance, and human-validation state behind the current profile." title="Source record" />
          <div className="dossier-facts">
            <Fact label="Primary source" value={profile.sourceLabel} wide />
            <Fact label="Source type" value={profile.sourceKind} />
            <Fact label="Validation state" value={profile.lastValidated ? `Validated · ${profile.lastValidated}` : "Human validation pending"} />
            <Fact label="Validator" value={profile.validator ?? "Not recorded"} />
            <Fact label="Extracted fields" value={profile.extractionFields ? `${profile.extractionFields.length} recorded · ${profile.extractionFields.filter((field) => field.confidence !== "High" && field.reviewState !== "corrected").length} need attention` : "No extracted fields attached"} />
            <Fact label="Storage" value={profile.sourceKind === "2303-derived" ? "Temporary review fixture · no binary stored" : "Structured source context · no document stored"} />
          </div>
          <div className="dossier-section__footer"><div><span className="meta-label">Controlled action</span><strong>Source review belongs in onboarding</strong><small>Use Start client setup to capture the source pack, correct extracted facts, and validate before activation.</small></div><Link className="text-button" href="/app/clients">Open client onboarding</Link></div>
        </section>
      </div>}

      </div>

      {drawer === "identity" && <IdentityDrawer isSaving={isSaving} profile={profile} onClose={closeDrawer} onSave={(next, reason) => { void persistProfile(next, assignment, reason, "Registration facts saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "setup" && <SetupDrawer assignment={assignment} isSaving={isSaving} profile={profile} onClose={closeDrawer} onSave={(nextAssignment, nextProfile, reason) => { void persistProfile(nextProfile, nextAssignment, reason, "Operating setup saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "authority" && <AuthorityDrawer isSaving={isSaving} onClose={closeDrawer} onSave={(authority, reason) => { const next = { ...profile, authorities: [...profile.authorities, authority] }; void persistProfile(next, assignment, reason, "Authority record saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "audit" && <AuditDrawer isSaving={isSaving} onClose={closeDrawer} onSave={(audit, reason) => { const next = { ...profile, auditExposures: [...profile.auditExposures, audit] }; void persistProfile(next, assignment, reason, "Audit record saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
    </>
  );
}

function demoProfileStorageKey(clientId: string) {
  return `taxmonweb.calibration.tax-profile.${clientId}`;
}

function cloneProfile(profile: FixtureTaxProfile): FixtureTaxProfile {
  return { ...profile, authorities: [...profile.authorities], auditExposures: [...profile.auditExposures], attention: [...profile.attention], extractionFields: profile.extractionFields ? [...profile.extractionFields] : undefined };
}

function ClientOverview({ attention, client, auditCount, nextWork, openWorkCount, profile, onSelectTab }: { attention: readonly string[]; client: FixtureClient; auditCount: number; nextWork?: (typeof fixtureWork)[number]; openWorkCount: number; profile: FixtureTaxProfile; onSelectTab: (tab: ClientWorkspaceTab) => void }) {
  const attentionCount = attention.length;
  return <section className="client-overview" id="client-overview">
      <div className="client-overview__header"><div><p className="eyebrow">Overview</p><h2>At a glance</h2></div></div>
    <div className="client-overview__metrics">
      <div className="client-overview__metric"><span>Setup</span><strong>{profile.profileState}</strong><small>{profile.lastValidated ? `Validated ${profile.lastValidated}` : "Validation pending"}</small></div>
      <button className={attentionCount > 0 ? "client-overview__metric client-overview__metric--attention" : "client-overview__metric"} onClick={() => onSelectTab(attention.length > 0 ? clientAttentionTab(attention[0]) : "registration")} type="button"><span>Attention</span><strong>{attentionCount || "None"}</strong><small>{attentionCount > 0 ? "Review profile controls" : "Nothing flagged"}</small></button>
      <button className={openWorkCount > 0 ? "client-overview__metric client-overview__metric--attention" : "client-overview__metric"} onClick={() => onSelectTab("activity")} type="button"><span>Open work</span><strong>{openWorkCount || "None"}</strong><small>{openWorkCount > 0 ? "View next action" : "No open activity"}</small></button>
      <div className="client-overview__metric"><span>Owner</span><strong>{client.assignment.preparer === "Unassigned" ? "Gap" : "Assigned"}</strong><small>{client.assignment.cluster}</small></div>
    </div>
    <div className="client-overview__next"><div><span className="meta-label">Next client action</span><strong>{nextWork?.nextAction ?? "No upcoming client action"}</strong><small>{nextWork ? `${nextWork.title} · ${nextWork.period} · ${nextWork.deadline}` : "No upcoming task is linked to this client."}</small>{nextWork && <small>Owner · {nextWork.owner}</small>}</div><button className="text-link" onClick={() => onSelectTab("activity")} type="button">View operations</button></div>
    <div className="client-overview__meta"><span>{auditCount ? `${auditCount} open BIR audit${auditCount === 1 ? "" : "s"}` : "No open BIR audit"}</span><button className="text-link" onClick={() => { onSelectTab("activity"); window.setTimeout(() => document.getElementById("client-audit-history")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} type="button">View audit history</button></div>
  </section>;
}

function clientAttentionTab(item: string): ClientWorkspaceTab {
  const normalized = item.toLowerCase();
  if (normalized.includes("assignment") || normalized.includes("checker") || normalized.includes("reviewer")) return "team";
  if (normalized.includes("source") || normalized.includes("validation")) return "sources";
  return "registration";
}

function ClientActivitySection({ auditExposures, client, closedAuditCount, exceptions, openAuditCount, work }: { auditExposures: readonly FixtureAuditExposure[]; client: FixtureClient; closedAuditCount: number; exceptions: FixtureException[]; openAuditCount: number; work: typeof fixtureWork }) {
  return <section className="dossier-section client-activity" id="client-activity">
    <SectionHeading detail="Current service operations only. Service Calendar is maintained in its own yearly Clients view." title="Operations" />
    <div className="client-activity__summary"><span><strong>{work.length}</strong> current work item{work.length === 1 ? "" : "s"}</span><span><strong>{exceptions.length}</strong> current exception{exceptions.length === 1 ? "" : "s"}</span></div>
    <section className="client-operations-block" aria-labelledby="client-current-work-title"><div className="client-operations-block__header"><div><p className="eyebrow">Live operational state</p><h3 id="client-current-work-title">Current work and next action</h3></div><Link className="text-button" href="/app/work">Open Work</Link></div>{work.length === 0 ? <div className="dossier-empty">No current work is linked to this client.</div> : <div className="client-work-list">{work.map((item) => <div className="client-work-list__row" key={item.id}><div><span className="meta-label">{item.stage} · {item.period}</span><strong>{item.title}</strong><small>Next action · {item.nextAction}</small></div><div><span className={`client-activity__state client-activity__state--${item.status.toLowerCase()}`}>{item.status}</span><small>{item.owner} · {item.deadline}</small></div></div>)}</div>}</section>
    {exceptions.length > 0 && <section className="client-operations-block" aria-labelledby="client-exceptions-title"><div className="client-operations-block__header"><div><p className="eyebrow">Intervention queue</p><h3 id="client-exceptions-title">Current exceptions</h3></div></div><div className="client-activity__list">{exceptions.map((item) => <div className="client-activity__row" key={item.id}><div><span className="meta-label">{item.kind} · {item.category}</span><strong>{item.title}</strong><small>{item.nextAction} · {item.owner}</small></div><span className={`client-activity__state client-activity__state--${item.severity.toLowerCase()}`}>{item.severity}</span></div>)}</div></section>}
    <section className="client-operations-block" aria-labelledby="client-audit-history"><div className="client-operations-block__header"><div><p className="eyebrow">Source-backed standing exposure</p><h3 id="client-audit-history">Audit history</h3></div><Link className="text-button" href="/app/clients?view=crfs">Record through CRF repository</Link></div><div className="audit-summary"><strong>{openAuditCount ? `${openAuditCount} open · ${closedAuditCount} closed` : closedAuditCount ? `No open audit · ${closedAuditCount} closed` : "No audit recorded"}</strong><span>{auditExposures.length ? "Status is shown per record; source context remains attached." : "No exposure is recorded in this profile."}</span></div><AuditHistorySection exposures={auditExposures} /></section>
    <section className="client-operations-block" aria-labelledby="client-filing-history-title"><div className="client-operations-block__header"><div><p className="eyebrow">Completed service record</p><h3 id="client-filing-history-title">Filing history</h3></div></div><FilingHistoryTable client={client} /></section>
    <div className="dossier-section__footer"><div><span className="meta-label">Source of truth</span><strong>Work and Control Tower projections</strong><small>Operations combines current work with the client’s audit and filing record.</small></div><Link className="text-button" href="#client-service-calendar">Open Service Calendar</Link></div>
  </section>;
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "dossier-fact dossier-fact--wide" : "dossier-fact"}><span>{label}</span><strong>{value}</strong></div>;
}

function AuthorityRow({ authority }: { authority: FixtureAuthority }) {
  return <div className="authority-row"><div><strong>{authority.authority}</strong><span>{authority.reference}</span></div><span className="authority-status">{authority.status}</span><small>{authority.entitlement}</small></div>;
}

function AuditHistorySection({ exposures }: { exposures: readonly FixtureAuditExposure[] }) {
  if (exposures.length === 0) return <div className="dossier-empty">No audit exposure is recorded.</div>;
  return <div className="audit-history">{exposures.map((exposure) => <div className="audit-history__row" key={exposure.id}>
    <div><strong>{exposure.taxableYear} · {exposure.matter}</strong><small>{exposure.officerName ? `${exposure.officerName}${exposure.officerRole ? ` · ${exposure.officerRole}` : ""}` : "Officer not recorded"}</small><small>{exposure.context} · {exposure.source}</small></div>
    <span className={`audit-history__status audit-history__status--${exposure.status.toLowerCase().replaceAll(" ", "-")}`}>{exposure.status}</span>
  </div>)}</div>;
}

function ContractRepositorySection({ client }: { client: FixtureClient }) {
  const repository = client.contractRepository;
  const master = repository.masterEngagement;
  const currentDocument = master?.documents.find((document) => document.isCurrent) ?? master?.documents[0];
  const historicalDocuments = master?.documents.filter((document) => document.id !== currentDocument?.id) ?? [];
  return (
    <section className="dossier-section dossier-section--contracts">
      <SectionHeading detail={`${repository.referenceCode} · ${getClientContractSummary(client)}`} title="Contract repository" />
      <div className="contract-tree">
        <div className="contract-tree__branch">
          <div className="contract-tree__branch-head"><div><span className="meta-label">Main contract</span><strong>{master ? "Configured" : "Not configured"}</strong><small>{master?.referenceCode ?? "No main contract record"}</small></div><span className={currentDocument?.status === "Active" ? "contract-status contract-status--active" : "contract-status"}>{currentDocument?.status ?? master?.status ?? "Not configured"}</span></div>
          {currentDocument ? <div className="contract-tree__documents"><ContractDocumentRow document={currentDocument} /></div> : <div className="dossier-empty">No main contract record is attached.</div>}
          {historicalDocuments.length > 0 && <details className="contract-history"><summary>Contract history · {historicalDocuments.length}</summary><div className="contract-tree__documents">{historicalDocuments.map((document) => <ContractDocumentRow document={document} key={document.id} />)}</div></details>}
        </div>
        <div className="contract-tree__branch">
          <div className="contract-tree__branch-head"><div><span className="meta-label">Additional engagement</span><strong>{repository.additionalEngagements.length ? `${repository.additionalEngagements.length} CRF/CRN record${repository.additionalEngagements.length === 1 ? "" : "s"}` : "None recorded"}</strong></div><span className="contract-status">CRF/CRN</span></div>
          {repository.additionalEngagements.length ? <div className="contract-tree__documents">{repository.additionalEngagements.map((engagement) => <AdditionalEngagementRow engagement={engagement} key={engagement.id} />)}</div> : <div className="dossier-empty">No additional engagement is recorded outside the master engagement.</div>}
        </div>
      </div>
      <div className="dossier-section__footer"><div><span className="meta-label">Contract evidence</span><strong>Sanitized repository context</strong><small>Contract records evidence commercial scope; Tax Profile and Compliance Universe controls remain separate.</small></div><Link className="text-button" href="/app/clients?view=crfs">Open CRF repository</Link></div>
    </section>
  );
}

function ContractDocumentRow({ document }: { document: FixtureContractDocument }) {
  return <div className="contract-row"><div><strong>{document.kind}</strong></div><span className={document.status === "Active" ? "contract-status contract-status--active" : "contract-status"}>{document.status}</span><small>{document.referenceCode} · {document.sourceReference}</small></div>;
}

function AdditionalEngagementRow({ engagement }: { engagement: FixtureAdditionalEngagement }) {
  return <div className="contract-row"><div><strong>CRF/CRN</strong><span>{engagement.title}</span></div><span className={engagement.status === "Active" ? "contract-status contract-status--active" : "contract-status"}>{engagement.status}</span><small>{engagement.referenceCode} · {engagement.scopeSummary}</small></div>;
}

function TeamHistoryTable({ client }: { client: FixtureClient }) {
  const records = client.teamHistory ?? fixtureTeamHistory.filter((item) => item.clientId === client.id);
  return <div aria-label="Team assignment history" className="team-history-table team-history-table--dossier" role="table" tabIndex={0}><div className="team-history-table__header" role="row"><span role="columnheader">Effective</span><span role="columnheader">Preparer</span><span role="columnheader">Checker</span><span role="columnheader">Reviewer</span><span role="columnheader">Cluster</span><span role="columnheader">Reason</span></div>{records.map((item) => <div className="team-history-row" key={item.id} role="row"><span role="cell"><strong>{item.effectivePeriod}</strong></span><span role="cell">{item.preparer}</span><span role="cell">{item.checker}</span><span role="cell">{item.reviewer}</span><span role="cell">{item.cluster}</span><span role="cell">{item.reason}</span></div>)}</div>;
}

function FilingHistoryTable({ client }: { client: FixtureClient }) {
  const records = fixtureFilingHistory.filter((item) => item.clientId === client.id);
  return records.length === 0 ? <div className="dossier-empty">No filing history is recorded for this client.</div> : <div className="history-list">{records.map((item) => <div className="history-row" key={item.id}><div><strong>{item.formLabel} · {item.period}</strong><small>{item.filingResult} · payment {item.paymentState} · evidence {item.evidenceState}</small></div><time>{item.filingDate}</time></div>)}</div>;
}

function IdentityDrawer({ profile, isSaving, onClose, onSave }: { profile: FixtureTaxProfile; isSaving: boolean; onClose: () => void; onSave: (profile: FixtureTaxProfile, reason: string) => void }) {
  const [draft, setDraft] = useState(() => cloneProfile(profile));
  const [reason, setReason] = useState("");
  return <DetailDrawer eyebrow="Profile setup" title="Edit registration facts" subtitle="Changes are saved as a dated profile version." onClose={onClose}><div className="form-stack"><Field label="Registered taxpayer name"><input value={draft.registeredTaxpayerName} onChange={(event) => setDraft({ ...draft, registeredTaxpayerName: event.target.value })} /></Field><Field label="TIN"><input value={draft.tinDisplay} onChange={(event) => setDraft({ ...draft, tinDisplay: event.target.value })} /></Field><div className="form-grid"><Field label="RDO / LTS"><input value={draft.rdoOrLts} onChange={(event) => setDraft({ ...draft, rdoOrLts: event.target.value })} /></Field><Field label="Entity type"><input value={draft.entityType} onChange={(event) => setDraft({ ...draft, entityType: event.target.value })} /></Field></div><Field label="Registered address"><textarea value={draft.registeredAddress} onChange={(event) => setDraft({ ...draft, registeredAddress: event.target.value })} /></Field><div className="form-grid"><Field label="Registration date"><input value={draft.registrationEffective} onChange={(event) => setDraft({ ...draft, registrationEffective: event.target.value })} /></Field><Field label="Registration status"><input value={draft.registrationStatus} onChange={(event) => setDraft({ ...draft, registrationStatus: event.target.value })} /></Field></div><Field label="Nature / line of business"><textarea value={draft.lineOfBusiness} onChange={(event) => setDraft({ ...draft, lineOfBusiness: event.target.value })} /></Field><div className="form-grid"><Field label="Tax year basis"><select value={draft.taxYearBasis ?? ""} onChange={(event) => setDraft({ ...draft, taxYearBasis: (event.target.value || undefined) as FixtureTaxProfile["taxYearBasis"] })}><option value="">Not configured</option><option>Calendar year</option><option>Fiscal year</option></select></Field><Field label="Fiscal year-end"><input value={draft.fiscalYearEnd ?? ""} onChange={(event) => setDraft({ ...draft, fiscalYearEnd: event.target.value })} placeholder="Source wording or unresolved" /></Field></div><Field label="BIR registered tax types / forms"><textarea value={draft.registeredTaxTypes.join("\n")} onChange={(event) => setDraft({ ...draft, registeredTaxTypes: event.target.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean) })} placeholder="One governed tax code or form per line" /></Field><div className="form-grid"><Field label="Accounting system"><input value={draft.accountingSystem ?? ""} onChange={(event) => setDraft({ ...draft, accountingSystem: event.target.value })} placeholder="System or source wording; leave unresolved when unknown" /></Field><Field label="Books type"><input value={draft.booksType ?? ""} onChange={(event) => setDraft({ ...draft, booksType: event.target.value })} placeholder="Source wording" /></Field></div><Field label="Invoicing / permit"><input value={draft.invoicing ?? ""} onChange={(event) => setDraft({ ...draft, invoicing: event.target.value })} placeholder="Source wording" /></Field><Field label="Filing channel"><select value={draft.filingChannel} onChange={(event) => setDraft({ ...draft, filingChannel: event.target.value })}><option>Not configured</option><option>eFPS</option><option>eBIRForms</option><option>Other approved channel</option><option>Needs review</option></select></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={isSaving || !reason.trim()} onClick={() => onSave(draft, reason)} type="button">{isSaving ? "Saving…" : "Save registration facts"}</button></div></DetailDrawer>;
}

function SetupDrawer({ assignment, profile, isSaving, onClose, onSave }: { assignment: FixtureClient["assignment"]; profile: FixtureTaxProfile; isSaving: boolean; onClose: () => void; onSave: (assignment: FixtureClient["assignment"], profile: FixtureTaxProfile, reason: string) => void }) {
  const [draftAssignment, setDraftAssignment] = useState({ ...assignment });
  const [draftProfile, setDraftProfile] = useState(() => cloneProfile(profile));
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  function save() {
    if (!draftAssignment.preparer || draftAssignment.preparer === "Unassigned" || !draftAssignment.checker || !draftAssignment.reviewer) return setError("Preparer, Checker, and Reviewer are required before Active setup.");
    if (new Set([draftAssignment.preparer, draftAssignment.checker, draftAssignment.reviewer]).size !== 3) return setError("Preparer, Checker, and Reviewer must be distinct.");
    if (draftProfile.enateSetup === "Unknown") return setError("Choose Yes or No for eNATE Setup.");
    if (draftProfile.paymentRoute === "Not configured") return setError("Choose Client Pays or TMF Pays.");
    if (!reason.trim()) return setError("Enter a reason for this setup change.");
    onSave(draftAssignment, draftProfile, reason);
  }
  return <DetailDrawer eyebrow="TMF setup" title="Edit operating setup" subtitle="Changes are saved as a dated setup version." onClose={onClose}><div className="form-stack">{error && <div className="form-error" role="alert">{error}</div>}<div className="form-grid"><Field label="Preparer"><input value={draftAssignment.preparer} onChange={(event) => setDraftAssignment({ ...draftAssignment, preparer: event.target.value })} /></Field><Field label="Checker"><input value={draftAssignment.checker} onChange={(event) => setDraftAssignment({ ...draftAssignment, checker: event.target.value })} /></Field><Field label="Reviewer"><input value={draftAssignment.reviewer} onChange={(event) => setDraftAssignment({ ...draftAssignment, reviewer: event.target.value })} /></Field><Field label="Cluster"><input value={draftAssignment.cluster} onChange={(event) => setDraftAssignment({ ...draftAssignment, cluster: event.target.value })} /></Field></div><Field label="Client Weight"><select value={draftProfile.weight} onChange={(event) => { const weight = Number(event.target.value) as FixtureTaxProfile["weight"]; setDraftProfile({ ...draftProfile, weight, weightLabel: weightLabels[weight] }); }}><option value="1">1 · Super Light</option><option value="2">2 · Light</option><option value="3">3 · Medium</option><option value="4">4 · Heavy</option><option value="5">5 · Super Heavy</option></select></Field><Field label="eNATE Setup"><select value={draftProfile.enateSetup} onChange={(event) => setDraftProfile({ ...draftProfile, enateSetup: event.target.value as FixtureTaxProfile["enateSetup"] })}><option>Yes</option><option>No</option><option>Unknown</option></select></Field><Field label="Payment Route"><select value={draftProfile.paymentRoute} onChange={(event) => setDraftProfile({ ...draftProfile, paymentRoute: event.target.value as FixtureTaxProfile["paymentRoute"] })}><option>Client Pays</option><option>TMF Pays</option><option>Not configured</option></select></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={isSaving} onClick={save} type="button">{isSaving ? "Saving…" : "Save operating setup"}</button></div></DetailDrawer>;
}

function AuthorityDrawer({ isSaving, onClose, onSave }: { isSaving: boolean; onClose: () => void; onSave: (authority: FixtureAuthority, reason: string) => void }) {
  const [authority, setAuthority] = useState<FixtureAuthority>({ id: "authority-review", authority: "", reference: "Review reference", status: "Active", effectiveFrom: "Current review", entitlement: "Context recorded; tax treatment is not inferred.", source: "Approved review source" });
  const [reason, setReason] = useState("");
  return <DetailDrawer eyebrow="Standing context" title="Add authority record" subtitle="The record is saved with source and effective-date history." onClose={onClose}><div className="form-stack"><Field label="Authority / scheme"><input autoFocus value={authority.authority} onChange={(event) => setAuthority({ ...authority, authority: event.target.value })} placeholder="PEZA, SEC, BOI, DOE or other" /></Field><Field label="Reference"><input value={authority.reference} onChange={(event) => setAuthority({ ...authority, reference: event.target.value })} /></Field><Field label="Status"><select value={authority.status} onChange={(event) => setAuthority({ ...authority, status: event.target.value as FixtureAuthority["status"] })}><option>Active</option><option>Review due</option><option>Not configured</option></select></Field><Field label="Entitlement / exemption context"><textarea value={authority.entitlement} onChange={(event) => setAuthority({ ...authority, entitlement: event.target.value })} /></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={!authority.authority.trim() || !reason.trim() || isSaving} onClick={() => onSave(authority, reason)} type="button">{isSaving ? "Saving…" : "Add authority"}</button></div></DetailDrawer>;
}

function AuditDrawer({ isSaving, onClose, onSave }: { isSaving: boolean; onClose: () => void; onSave: (audit: FixtureAuditExposure, reason: string) => void }) {
  const [audit, setAudit] = useState<FixtureAuditExposure>({ id: "audit-new", taxableYear: "", matter: "", status: "Open", asOf: fixtureClock.today, context: "", source: "", officerName: "", officerRole: "", officerContact: "" });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!audit.taxableYear.trim() || !audit.matter.trim() || !audit.officerName?.trim() || !audit.source.trim() || !reason.trim()) {
      setError("Taxable year, matter, officer, source, and reason are required.");
      return;
    }
    onSave({ ...audit, taxableYear: audit.taxableYear.trim(), matter: audit.matter.trim(), officerName: audit.officerName.trim(), officerRole: audit.officerRole?.trim() || undefined, officerContact: audit.officerContact?.trim() || undefined, source: audit.source.trim(), context: audit.context.trim() || "High-level exposure context recorded." }, reason.trim());
  }

  return <DetailDrawer eyebrow="Tax audit" title="Add audit record" subtitle="Record standing year-level context without creating a tax-audit case file." onClose={onClose}><div className="form-stack">{error && <div className="form-error" role="alert">{error}</div>}<div className="form-grid"><Field label="Taxable year"><input autoFocus value={audit.taxableYear} onChange={(event) => setAudit({ ...audit, taxableYear: event.target.value })} placeholder="e.g. FY 2024" /></Field><Field label="As of"><input value={audit.asOf} onChange={(event) => setAudit({ ...audit, asOf: event.target.value })} /></Field></div><Field label="Matter / scope"><input value={audit.matter} onChange={(event) => setAudit({ ...audit, matter: event.target.value })} placeholder="BIR audit exposure or assessment context" /></Field><Field label="Status"><select value={audit.status} onChange={(event) => setAudit({ ...audit, status: event.target.value as FixtureAuditExposure["status"] })}><option>Open</option><option>Under review</option><option>Closed</option></select></Field><div className="form-grid"><Field label="BIR officer"><input value={audit.officerName ?? ""} onChange={(event) => setAudit({ ...audit, officerName: event.target.value })} placeholder="Name as recorded" /></Field><Field label="Officer role"><input value={audit.officerRole ?? ""} onChange={(event) => setAudit({ ...audit, officerRole: event.target.value })} placeholder="Optional" /></Field></div><Field label="Officer contact"><input value={audit.officerContact ?? ""} onChange={(event) => setAudit({ ...audit, officerContact: event.target.value })} placeholder="Optional phone or email" /></Field><Field label="Context"><textarea value={audit.context} onChange={(event) => setAudit({ ...audit, context: event.target.value })} placeholder="High-level context only" /></Field><Field label="Source / reference"><input value={audit.source} onChange={(event) => setAudit({ ...audit, source: event.target.value })} placeholder="Approved source or reference" /></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={isSaving} onClick={save} type="button">{isSaving ? "Saving…" : "Save audit record"}</button></div></DetailDrawer>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

const weightLabels: Record<number, string> = { 0: "No numeric source weight", 1: "Super Light", 2: "Light", 3: "Medium", 4: "Heavy", 5: "Super Heavy" };
