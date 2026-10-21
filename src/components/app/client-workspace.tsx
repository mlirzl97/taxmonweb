"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  fixtureExceptions,
  fixtureFilingHistory,
  fixtureHistory,
  fixtureOrgDirectoryMembers,
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
import { formatTin, normalizeTinDigits } from "@/lib/domain/client-onboarding";
import type { BirOfficeOption } from "@/lib/domain/bir-office-reference";
import { applyPersistedTaxProfileSnapshot, buildTaxProfilePersistencePayload, calibrationProfileStorageKey, getClientDisplayWeight, getClientDisplayWeightLabel, hasCredibleTaxProfileValidation, profileActivationGaps, prototypeClientProfileUpdatedEvent, reconcileClientAttention, type PersistedTaxProfileSnapshot } from "@/lib/domain/client-profile-persistence";
import { hasCalibrationEditAccess } from "@/lib/domain/access";
import { governedReturnForms } from "@/lib/domain/client-return-selection";
import { useWorkflow } from "@/lib/workflow-state";
import { birOfficeCode, birOfficeLabel, clientAccountingSystemOptions, clientAuthorityOptions, clientBooksOptions, clientEfpsGroupOptions, clientEntityTypeOptions, clientFilingChannelOptions, clientInvoicingOptions, clientRegistrationStatusOptions, controlledOptionLabel, controlledOptionValue, isIsoDate, prototypeBirOfficeOptions } from "@/lib/domain/client-profile-options";
import { DetailDrawer, SectionHeading } from "./workspace-components";
import { ClientServiceCalendarView } from "./client-service-calendar";
import { ReturnTaxSelector } from "./return-tax-selector";

type DrawerMode = "identity" | "setup" | "authority" | "audit" | "validate" | null;
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
  const { canEditTaxProfile, canValidateTaxProfile, isClientVisible, prototypeMode } = useWorkflow();
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [savedVersionId, setSavedVersionId] = useState<string | null>(null);
  const [profileReload, setProfileReload] = useState(0);
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
  const setupGaps = selectedUnit ? profileActivationGaps(profile, assignment, selectedUnit) : ["Registration Unit identity"];
  const attention = reconcileClientAttention(profile.attention, profile, assignment);
  const openAuditCount = profile.auditExposures.filter((item) => item.status !== "Closed").length;
  const closedAuditCount = profile.auditExposures.filter((item) => item.status === "Closed").length;
  const profileHistory = prototypeMode ? fixtureHistory.filter((item) => item.clientId === client.id) : [];
  const clientWork = prototypeMode ? fixtureWork.filter((item) => item.clientId === client.id) : [];
  const clientExceptions = prototypeMode ? fixtureExceptions.filter((item) => item.clientId === client.id) : [];
  const openWorkCount = clientWork.filter((item) => item.status !== "GREEN").length;
  const nextWork = clientWork.find((item) => item.status !== "GREEN") ?? clientWork[0];

  useEffect(() => {
    if (demoMode) {
      const stored = window.localStorage.getItem(calibrationProfileStorageKey(client.id));
      if (!stored) return;
      try {
        const snapshot = JSON.parse(stored) as PersistedTaxProfileSnapshot;
        const restored = applyPersistedTaxProfileSnapshot(initialProfileRef.current, initialAssignmentRef.current, snapshot);
        setProfile(restored.profile);
        setAssignment(restored.assignment);
        setSavedMessage("Saved calibration version loaded.");
      } catch {
        window.localStorage.removeItem(calibrationProfileStorageKey(client.id));
      }
      return;
    }
    let cancelled = false;
    async function loadSavedProfile() {
      setSavedVersionId(null);
      try {
        const response = await fetch(`/api/clients/${client.id}/profile`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { clientFound?: boolean; data?: PersistedTaxProfileSnapshot | null };
        if (cancelled) return;
        setPersistenceState(result.clientFound ? "available" : "unavailable");
        if (!result.data) return;
        setSavedVersionId(result.data.id ?? null);
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
  }, [client.id, demoMode, profileReload]);

  async function validateSavedProfile(reason: string) {
    if (!savedVersionId) {
      setSavedMessage("Save the profile before validating it.");
      return false;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${client.id}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", versionId: savedVersionId, reason }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The Tax Profile could not be validated.");
      setSavedMessage("Tax Profile validated.");
      setProfileReload((current) => current + 1);
      return true;
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : "The Tax Profile could not be validated.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  const calibrationEditMode = hasCalibrationEditAccess(demoMode, calibrationEditModeEnabled);
  const canEditProfile = canEditTaxProfile;
  const editDisabled = !canEditProfile || (!calibrationEditMode && persistenceState !== "available");
  const editTitle = !canEditProfile ? "You have read-only access to taxpayer setup" : persistenceState === "checking" ? "Checking the saved profile" : persistenceState === "unavailable" ? "This profile is read-only until it is linked to the client repository" : undefined;


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

  function openAttention(item: string) {
    const tab = clientAttentionTab(item);
    selectTab(tab);
    if (!editDisabled && tab === "team") setDrawer("setup");
    if (!editDisabled && tab === "registration") setDrawer("identity");
    if (tab === "activity") window.setTimeout(() => document.getElementById("client-audit-history")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
      window.localStorage.setItem(calibrationProfileStorageKey(client.id), JSON.stringify(snapshot));
      window.dispatchEvent(new CustomEvent(prototypeClientProfileUpdatedEvent, { detail: { clientId: client.id } }));
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
      const result = await response.json() as { error?: string; state?: string; data?: { id?: string } };
      if (!response.ok) throw new Error(result.error ?? "The profile change could not be saved.");
      if (result.data?.id) setSavedVersionId(result.data.id);
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
          <ClientOverview attention={attention} client={client} auditCount={openAuditCount} history={profileHistory} nextWork={nextWork} onOpenAttention={openAttention} openWorkCount={openWorkCount} profile={profile} onSelectTab={selectTab} setupGaps={setupGaps} />
        </>}

        {activeTab === "registration" && <div className="client-registration-layout" id="client-registration">
          <section className="dossier-section dossier-section--identity">
            <SectionHeading detail="The taxpayer’s legal identity, BIR registration, filing context, and returns." title="Identity / BIR registration" />
            <div className="dossier-facts">
              <Fact label="Registered name" value={profile.registeredTaxpayerName} wide />
              <Fact label="Client reference" value={client.id} />
              <Fact label="TIN" value={formatTin(profile.tinDisplay) || profile.tinDisplay} />
              <Fact label="Head Office / Branch" value={selectedUnit.type} />
              <Fact label="RDO" value={birOfficeLabel(profile.rdoOrLts, prototypeBirOfficeOptions)} />
              <Fact label="Entity type" value={controlledOptionLabel(profile.entityType, clientEntityTypeOptions)} />
              <Fact label="Registration status" value={controlledOptionLabel(profile.registrationStatus, clientRegistrationStatusOptions)} />
              <Fact label="Registered address" value={profile.registeredAddress} wide />
              <Fact label="Nature / line of business" value={profile.lineOfBusiness} />
              <Fact label="Registration date" value={profile.registrationEffective} />
              <Fact label="Tax year basis" value={profile.taxYearBasis ?? "Not configured"} />
              <Fact label="Fiscal year-end" value={profile.taxYearBasis === "Calendar year" ? "December 31" : profile.fiscalYearEnd ?? "Not configured"} />
              <Fact label="First period to file" value={profile.firstPeriodToFile ?? "Not configured"} />
              <Fact label="Filing channel" value={controlledOptionLabel(profile.filingChannel, clientFilingChannelOptions)} />
              {profile.filingChannel === "eFPS" && <Fact label="eFPS group" value={controlledOptionLabel(profile.eFPSGroup, ["", ...clientEfpsGroupOptions, "Not applicable", "Needs review"])} />}
              <Fact label="Returns to be filed" value={profile.registeredReturnCodes?.join(" · ") || "Not configured"} wide />
              <Fact label="Go-live date" value={profile.goLiveDate ?? "Not configured"} />
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
                <Fact label="Accounting system" value={controlledOptionLabel(profile.accountingSystem, clientAccountingSystemOptions)} />
                <Fact label="Books type" value={controlledOptionLabel(profile.booksType, clientBooksOptions)} />
                <Fact label="Invoicing / permit" value={controlledOptionLabel(profile.invoicing, clientInvoicingOptions)} />
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
            <Fact label="Client Weight" value={getClientDisplayWeight(profile) === null ? "Not assessed" : `${getClientDisplayWeight(profile)} · ${getClientDisplayWeightLabel(profile)}`} />
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
          {demoMode ? <div className="dossier-section__footer"><div><span className="meta-label">Controlled action</span><strong>Source review belongs in onboarding</strong><small>Use Start client setup to capture the source pack, correct extracted facts, and validate before activation.</small></div><Link className="text-button" href="/app/clients">Open client onboarding</Link></div>
            : <div className="dossier-section__footer"><div><span className="meta-label">Controlled action</span><strong>{profile.profileState === "Active" ? "Tax Profile validated" : setupGaps.length > 0 ? `Complete setup before validation · ${setupGaps.length} missing` : "Ready for human validation"}</strong><small>{profile.profileState === "Active" ? "Later changes are saved as new dated versions and need validation again." : setupGaps.length > 0 ? `Missing: ${setupGaps.join(", ")}.` : "A person with Tax Profile validation authority confirms the facts against the source before activation."}</small></div>{profile.profileState !== "Active" && <div className="dossier-section__actions">{setupGaps.length > 0 && canEditTaxProfile && <><button className="text-button" onClick={() => setDrawer("identity")} type="button">Edit registration facts</button><button className="text-button" onClick={() => setDrawer("setup")} type="button">Edit assignment &amp; setup</button></>}{canValidateTaxProfile && <button className="button button--primary button--small" disabled={setupGaps.length > 0} onClick={() => setDrawer("validate")} title={setupGaps.length > 0 ? "Complete the missing setup first" : undefined} type="button">Validate Tax Profile</button>}</div>}</div>}
        </section>
      </div>}

      </div>

      {drawer === "identity" && <IdentityDrawer isSaving={isSaving} live={!demoMode} profile={profile} onClose={closeDrawer} onSave={(next, reason) => { void persistProfile(next, assignment, reason, "Registration facts saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "validate" && <ValidateDrawer gaps={setupGaps} isSaving={isSaving} onClose={closeDrawer} onValidate={(reason) => { void (demoMode ? persistProfile(profile, assignment, reason, "Tax Profile validated.", "save-and-validate") : validateSavedProfile(reason)).then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "setup" && <SetupDrawer assignment={assignment} isSaving={isSaving} live={!demoMode} profile={profile} onClose={closeDrawer} onSave={(nextAssignment, nextProfile, reason) => { void persistProfile(nextProfile, nextAssignment, reason, "Operating setup saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "authority" && <AuthorityDrawer isSaving={isSaving} onClose={closeDrawer} onSave={(authority, reason) => { const next = { ...profile, authorities: [...profile.authorities, authority] }; void persistProfile(next, assignment, reason, "Authority record saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
      {drawer === "audit" && <AuditDrawer isSaving={isSaving} onClose={closeDrawer} onSave={(audit, reason) => { const next = { ...profile, auditExposures: [...profile.auditExposures, audit] }; void persistProfile(next, assignment, reason, "Audit record saved.").then((saved) => { if (saved) closeDrawer(); }); }} />}
    </>
  );
}

function cloneProfile(profile: FixtureTaxProfile): FixtureTaxProfile {
  return { ...profile, fiscalYearEnd: profile.taxYearBasis === "Calendar year" ? "December 31" : profile.fiscalYearEnd, entityType: controlledOptionValue(profile.entityType, clientEntityTypeOptions), registrationStatus: controlledOptionValue(profile.registrationStatus, clientRegistrationStatusOptions), accountingSystem: controlledOptionValue(profile.accountingSystem, clientAccountingSystemOptions, "Needs review"), booksType: controlledOptionValue(profile.booksType, clientBooksOptions, "Not configured"), invoicing: controlledOptionValue(profile.invoicing, clientInvoicingOptions, "Not configured"), filingChannel: controlledOptionValue(profile.filingChannel, ["Not configured", "eFPS", "eBIRForms", "Needs review"], "Needs review"), eFPSGroup: profile.filingChannel === "eFPS" ? controlledOptionValue(profile.eFPSGroup, ["Group A", "Group B", "Group C", "Group D", "Group E", "Needs review"], "Needs review") : profile.eFPSGroup, registrationEffective: isIsoDate(profile.registrationEffective) ? profile.registrationEffective : "", authorities: [...profile.authorities], auditExposures: [...profile.auditExposures], attention: [...profile.attention], extractionFields: profile.extractionFields ? [...profile.extractionFields] : undefined, registeredTaxTypeCodes: profile.registeredTaxTypeCodes ? [...profile.registeredTaxTypeCodes] : undefined, registeredReturnCodes: profile.registeredReturnCodes ? [...profile.registeredReturnCodes] : undefined };
}

function ClientOverview({ attention, client, auditCount, history, nextWork, onOpenAttention, openWorkCount, profile, onSelectTab, setupGaps }: { attention: readonly string[]; client: FixtureClient; auditCount: number; history: ReadonlyArray<{ id: string; label: string; detail: string; date: string }>; nextWork?: (typeof fixtureWork)[number]; onOpenAttention: (item: string) => void; openWorkCount: number; profile: FixtureTaxProfile; onSelectTab: (tab: ClientWorkspaceTab) => void; setupGaps: readonly string[] }) {
  // A profile is not "ready for validation" while required setup is still missing.
  const setupLabel = profile.profileState === "Ready for validation" && setupGaps.length > 0 ? "Setup incomplete" : profile.profileState;
  const setupDetail = profile.lastValidated ? `Validated ${profile.lastValidated}` : setupGaps.length > 0 ? `Missing: ${setupGaps.slice(0, 3).join(", ")}${setupGaps.length > 3 ? ` +${setupGaps.length - 3} more` : ""}` : "Validation pending";
  const attentionCount = attention.length;
  return <section className="client-overview" id="client-overview">
      <div className="client-overview__header"><div><p className="eyebrow">Overview</p><h2>At a glance</h2></div></div>
    <div className="client-overview__metrics">
      <div className="client-overview__metric"><span>Setup</span><strong>{setupLabel}</strong><small>{setupDetail}</small></div>
      <button aria-label={attentionCount > 0 ? `Attention: ${attentionCount} items requiring action` : "Attention: none"} className={attentionCount > 0 ? "client-overview__metric client-overview__metric--attention" : "client-overview__metric"} onClick={() => attention.length > 0 ? onOpenAttention(attention[0]) : onSelectTab("registration")} type="button"><span>Attention</span><strong>{attentionCount || "None"}</strong><small>{attentionCount > 0 ? `Resolve: ${clientAttentionSummary(attention[0])}` : "Nothing flagged"}</small></button>
      <button className={openWorkCount > 0 ? "client-overview__metric client-overview__metric--attention" : "client-overview__metric"} onClick={() => onSelectTab("activity")} type="button"><span>Open work</span><strong>{openWorkCount || "None"}</strong><small>{openWorkCount > 0 ? "View next action" : "No open activity"}</small></button>
      <div className="client-overview__metric"><span>Owner</span><strong>{client.assignment.preparer === "Unassigned" ? "Gap" : client.assignment.preparer}</strong><small>{client.assignment.cluster} · checker {client.assignment.checker}</small></div>
    </div>
    <div aria-label="Current client context" className="client-overview__context">
      <div><span className="meta-label">Current stage</span><strong>{nextWork ? clientStageLabel(nextWork.stage) : "No active work"}</strong><small>{nextWork?.detail ?? "No generated compliance work is linked to this client."}</small></div>
      <div><span className="meta-label">Accountability</span><strong>{client.assignment.preparer === "Unassigned" ? "Assignment gap" : "Preparer · Checker · Reviewer"}</strong><small>{client.assignment.preparer} · {client.assignment.checker} · {client.assignment.reviewer}</small></div>
      <div><span className="meta-label">Latest activity</span><strong>{history[0]?.label ?? "No activity recorded"}</strong><small>{history[0] ? `${history[0].detail} · ${history[0].date}` : "History will appear when a record is available."}</small></div>
    </div>
    <div className="client-overview__next"><div><span className="meta-label">Next client action</span><strong>{nextWork?.nextAction ?? "No upcoming client action"}</strong><small>{nextWork ? `${nextWork.title} · ${nextWork.period} · ${nextWork.deadline}` : "No upcoming task is linked to this client."}</small>{nextWork && <small>Owner · {nextWork.owner}</small>}</div>{nextWork ? <Link className="button button--quiet button--small" href={`/app/work/${nextWork.id}`}>Open return</Link> : <button className="text-link" onClick={() => onSelectTab("activity")} type="button">View operations</button>}</div>
    <div className="client-overview__meta"><span>{auditCount ? `${auditCount} open BIR audit${auditCount === 1 ? "" : "s"}` : "No open BIR audit"}</span><button className="text-link" onClick={() => { onSelectTab("activity"); window.setTimeout(() => document.getElementById("client-audit-history")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} type="button">View audit history</button></div>
  </section>;
}

function clientAttentionTab(item: string): ClientWorkspaceTab {
  const normalized = item.toLowerCase();
  if (normalized.includes("assignment") || normalized.includes("checker") || normalized.includes("reviewer")) return "team";
  if (normalized.includes("source") || normalized.includes("validation")) return "sources";
  return "registration";
}

function clientStageLabel(stage: (typeof fixtureWork)[number]["stage"]) {
  return { PREPARE: "Preparation", REVIEW: "Checking", CLIENT: "Client approval", FILE: "Filing / submission", "POST-FILING": "Evidence / post-filing" }[stage];
}

function clientAttentionSummary(item: string): string {
  const normalized = item.toLowerCase();
  if (normalized.includes("assignment incomplete")) return "Assignment required";
  if (normalized.includes("checker and reviewer conflict")) return "Separate Checker and Reviewer";
  if (normalized.includes("preparer assignment missing")) return "Preparer required";
  if (normalized.includes("checker assignment missing")) return "Checker required";
  if (normalized.includes("reviewer assignment missing")) return "Reviewer required";
  if (normalized.includes("rdo")) return "RDO needs review";
  if (normalized.includes("tax year basis")) return "Tax year basis missing";
  if (normalized.includes("fiscal year-end")) return "Fiscal year-end missing";
  if (normalized.includes("filing channel")) return "Filing channel missing";
  if (normalized.includes("accounting system")) return "Accounting system missing";
  if (normalized.includes("efps")) return "eFPS group needs review";
  if (normalized.includes("enate")) return "eNATE setup missing";
  if (normalized.includes("payment route")) return "Payment route missing";
  if (normalized.includes("audit")) return "BIR audit needs review";
  if (normalized.includes("source") || normalized.includes("validation")) return "Source validation required";
  return item;
}

function ClientActivitySection({ auditExposures, client, closedAuditCount, exceptions, openAuditCount, work }: { auditExposures: readonly FixtureAuditExposure[]; client: FixtureClient; closedAuditCount: number; exceptions: FixtureException[]; openAuditCount: number; work: typeof fixtureWork }) {
  return <section className="dossier-section client-activity" id="client-activity">
    <SectionHeading detail="Current service operations only. Service Calendar is maintained in its own yearly Clients view." title="Operations" />
    <div className="client-activity__summary"><span><strong>{work.length}</strong> current work item{work.length === 1 ? "" : "s"}</span><span><strong>{exceptions.length}</strong> current exception{exceptions.length === 1 ? "" : "s"}</span></div>
    <section className="client-operations-block" aria-labelledby="client-current-work-title"><div className="client-operations-block__header"><div><p className="eyebrow">Live operational state</p><h3 id="client-current-work-title">Current work and next action</h3></div><Link className="text-button" href="/app/work">Open Work</Link></div>{work.length === 0 ? <div className="dossier-empty">No current work is linked to this client.</div> : <div className="client-work-list">{work.map((item) => <Link aria-label={`Open ${item.title} for ${item.period}`} className="client-work-list__row" href={`/app/work/${item.id}`} key={item.id}><div><span className="meta-label">{item.stage} · {item.period}</span><strong>{item.title}</strong><small>Next action · {item.nextAction}</small></div><div><span className={`client-activity__state client-activity__state--${item.status.toLowerCase()}`}>{item.status}</span><small>{item.owner} · {item.deadline}</small></div></Link>)}</div>}</section>
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

const profileFiscalYearMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const profileFiscalYearDays = Array.from({ length: 31 }, (_, index) => String(index + 1));
const profileFiscalYearDayCount: Record<string, number> = { April: 30, June: 30, September: 30, November: 30, February: 29 };

function profileFiscalYearEndParts(value?: string) {
  const [month, day] = (value ?? "").trim().split(/\s+/);
  return { month: profileFiscalYearMonths.includes(month as (typeof profileFiscalYearMonths)[number]) ? month : "", day: /^\d{1,2}$/.test(day ?? "") ? day : "" };
}

function profileReturnCodes(profile: FixtureTaxProfile) {
  return profile.registeredReturnCodes?.length ? [...profile.registeredReturnCodes] : governedReturnForms.filter((form) => profile.registeredTaxTypes.includes(form.formNumber)).map((form) => form.formNumber);
}

function IdentityDrawer({ live, profile, isSaving, onClose, onSave }: { live: boolean; profile: FixtureTaxProfile; isSaving: boolean; onClose: () => void; onSave: (profile: FixtureTaxProfile, reason: string) => void }) {
  const [draft, setDraft] = useState(() => cloneProfile(profile));
  const [reason, setReason] = useState("");
  const initialFiscalYearEnd = profile.taxYearBasis === "Calendar year" ? { month: "December", day: "31" } : profileFiscalYearEndParts(profile.fiscalYearEnd);
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(initialFiscalYearEnd.month);
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState(initialFiscalYearEnd.day);
  const [returnCodes, setReturnCodes] = useState(() => profileReturnCodes(profile));
  const [birOfficeOptions, setBirOfficeOptions] = useState<BirOfficeOption[]>([]);
  const [birOfficesState, setBirOfficesState] = useState<"loading" | "loaded" | "unavailable">("loading");
  // A live profile only ever offers the governed office master; the sanitized prototype list is demo-only.
  const referenceBirOffices = birOfficeOptions.length > 0 ? birOfficeOptions : live ? [] : prototypeBirOfficeOptions;
  const efpsGroupOptions = Array.from(new Set(["", ...clientEfpsGroupOptions, "Not applicable", "Needs review"]));
  useEffect(() => {
    let cancelled = false;
    fetch("/api/bir-offices", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("BIR offices unavailable");
        const result = await response.json() as { data?: BirOfficeOption[] };
        if (cancelled) return;
        if (Array.isArray(result.data)) setBirOfficeOptions(result.data);
        setBirOfficesState("loaded");
      })
      .catch(() => { if (!cancelled) setBirOfficesState("unavailable"); });
    return () => { cancelled = true; };
  }, []);
  const selectedRdoCode = birOfficeCode(draft.rdoOrLts, referenceBirOffices);
  return <DetailDrawer eyebrow="Profile setup" title="Edit registration facts" subtitle="Changes are saved as a dated profile version." onClose={onClose}><div className="form-stack"><Field label="Registered taxpayer name"><input value={draft.registeredTaxpayerName} onChange={(event) => setDraft({ ...draft, registeredTaxpayerName: event.target.value })} /></Field><Field label="TIN"><input inputMode="numeric" maxLength={17} value={formatTin(draft.tinDisplay)} onChange={(event) => setDraft({ ...draft, tinDisplay: normalizeTinDigits(event.target.value) })} /></Field><div className="form-grid"><Field label="RDO"><select disabled={live && birOfficesState === "loading"} value={selectedRdoCode} onChange={(event) => setDraft({ ...draft, rdoOrLts: event.target.value })}>{live && birOfficesState === "loading" && <option value={selectedRdoCode}>Loading BIR offices…</option>}{live && birOfficesState === "unavailable" && selectedRdoCode !== "Needs review" && <option value={selectedRdoCode}>{draft.rdoOrLts}</option>}{referenceBirOffices.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}<option value="Needs review">Needs review</option></select></Field><Field label="Entity type"><select value={clientEntityTypeOptions.includes(draft.entityType as typeof clientEntityTypeOptions[number]) ? draft.entityType : "Needs review"} onChange={(event) => setDraft({ ...draft, entityType: event.target.value })}>{clientEntityTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></Field></div><Field label="Registered address"><textarea value={draft.registeredAddress} onChange={(event) => setDraft({ ...draft, registeredAddress: event.target.value })} /></Field><div className="form-grid"><Field label="Registration date"><input type="date" value={isIsoDate(draft.registrationEffective) ? draft.registrationEffective : ""} onChange={(event) => setDraft({ ...draft, registrationEffective: event.target.value })} /></Field><Field label="Registration status"><select value={clientRegistrationStatusOptions.includes(draft.registrationStatus as typeof clientRegistrationStatusOptions[number]) ? draft.registrationStatus : "Needs review"} onChange={(event) => setDraft({ ...draft, registrationStatus: event.target.value })}>{clientRegistrationStatusOptions.map((option) => <option key={option}>{option}</option>)}</select></Field></div><Field label="Nature / line of business"><textarea value={draft.lineOfBusiness} onChange={(event) => setDraft({ ...draft, lineOfBusiness: event.target.value })} /></Field><div className="form-grid"><Field label="Tax year basis"><select value={draft.taxYearBasis ?? ""} onChange={(event) => { const taxYearBasis = (event.target.value || undefined) as FixtureTaxProfile["taxYearBasis"]; setDraft({ ...draft, taxYearBasis, fiscalYearEnd: taxYearBasis === "Calendar year" ? "December 31" : undefined }); if (taxYearBasis === "Calendar year") { setFiscalYearEndMonth("December"); setFiscalYearEndDay("31"); } else { setFiscalYearEndMonth(""); setFiscalYearEndDay(""); } }}><option value="">Not configured</option><option>Calendar year</option><option>Fiscal year</option></select></Field><div className="form-field"><span>Fiscal year-end</span><div className="form-grid form-grid--compact"><select aria-label="Fiscal year-end month" disabled={draft.taxYearBasis !== "Fiscal year"} value={fiscalYearEndMonth} onChange={(event) => { setFiscalYearEndMonth(event.target.value); setFiscalYearEndDay(""); }}><option value="">Month</option>{profileFiscalYearMonths.map((month) => <option key={month}>{month}</option>)}</select><select aria-label="Fiscal year-end day" disabled={draft.taxYearBasis !== "Fiscal year" || !fiscalYearEndMonth} value={fiscalYearEndDay} onChange={(event) => setFiscalYearEndDay(event.target.value)}><option value="">Day</option>{profileFiscalYearDays.slice(0, profileFiscalYearDayCount[fiscalYearEndMonth] ?? 31).map((day) => <option key={day}>{day}</option>)}</select></div></div></div><ReturnTaxSelector selectedCodes={returnCodes} onChange={setReturnCodes} /><div className="form-grid"><Field label="Go-live date"><input value={draft.goLiveDate ?? ""} onChange={(event) => setDraft({ ...draft, goLiveDate: event.target.value })} type="date" /></Field><Field label="First period to file"><input min={draft.goLiveDate?.slice(0, 7)} onChange={(event) => setDraft({ ...draft, firstPeriodToFile: event.target.value })} type="month" value={draft.firstPeriodToFile ?? ""} /></Field></div><Field label="Permanent file location"><input maxLength={240} placeholder="SharePoint link or shared-drive path" value={draft.permanentFileLink ?? ""} onChange={(event) => setDraft({ ...draft, permanentFileLink: event.target.value })} type="text" /></Field><div className="form-grid"><Field label="Accounting system"><select value={clientAccountingSystemOptions.includes(draft.accountingSystem as typeof clientAccountingSystemOptions[number]) ? draft.accountingSystem : "Needs review"} onChange={(event) => setDraft({ ...draft, accountingSystem: event.target.value })}>{clientAccountingSystemOptions.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Books"><select value={clientBooksOptions.includes(draft.booksType as typeof clientBooksOptions[number]) ? draft.booksType : "Needs review"} onChange={(event) => setDraft({ ...draft, booksType: event.target.value })}>{clientBooksOptions.map((option) => <option key={option}>{option}</option>)}</select></Field></div><div className="form-grid"><Field label="Receipts / invoicing"><select value={clientInvoicingOptions.includes(draft.invoicing as typeof clientInvoicingOptions[number]) ? draft.invoicing : "Needs review"} onChange={(event) => setDraft({ ...draft, invoicing: event.target.value })}>{clientInvoicingOptions.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Filing channel"><select value={draft.filingChannel} onChange={(event) => { const filingChannel = event.target.value; setDraft({ ...draft, filingChannel, eFPSGroup: filingChannel === "eFPS" ? draft.eFPSGroup : "Not applicable" }); }}>{clientFilingChannelOptions.map((option) => <option key={option}>{option}</option>)}</select></Field></div><Field label="eFPS group"><select disabled={draft.filingChannel !== "eFPS"} value={draft.filingChannel === "eFPS" ? (efpsGroupOptions.includes(draft.eFPSGroup ?? "") ? draft.eFPSGroup : "Needs review") : "Not applicable"} onChange={(event) => setDraft({ ...draft, eFPSGroup: event.target.value })}><option value="">Not configured</option>{efpsGroupOptions.filter(Boolean).map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={isSaving || !reason.trim()} onClick={() => onSave({ ...draft, tinDisplay: normalizeTinDigits(draft.tinDisplay), fiscalYearEnd: draft.taxYearBasis === "Calendar year" ? "December 31" : draft.taxYearBasis === "Fiscal year" && fiscalYearEndMonth && fiscalYearEndDay ? `${fiscalYearEndMonth} ${fiscalYearEndDay}` : undefined, registeredReturnCodes: returnCodes }, reason)} type="button">{isSaving ? "Saving…" : "Save registration facts"}</button></div></DetailDrawer>;
}

type LiveAssignmentOptions = { preparers: string[]; checkers: string[]; reviewers: string[]; clusters: string[]; towers: Array<{ name: string; cluster: string | null }>; error: string | null };

/** Live people and units for operating setup; the fixture directory is never shown for a live client. */
function useLiveAssignmentOptions(live: boolean): LiveAssignmentOptions | null {
  const [options, setOptions] = useState<LiveAssignmentOptions | null>(null);
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/team", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Unable to load the live team."); return response.json() as Promise<{ data?: Array<{ name: string; active: boolean; roleKey: string | null; operatingModel: string; effectiveTo: string | null }> }>; }),
      fetch("/api/organization/units", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Unable to load clusters and towers."); return response.json() as Promise<{ data?: Array<{ id: string; name: string; unit_kind: string; parent_id: string | null }> }>; }),
    ]).then(([team, units]) => {
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const engagementStaff = (team.data ?? []).filter((member) => member.active && member.operatingModel !== "tax_team" && (!member.effectiveTo || member.effectiveTo >= today));
      const names = (keys: readonly string[]) => engagementStaff.filter((member) => member.roleKey && keys.includes(member.roleKey)).map((member) => member.name).sort((left, right) => left.localeCompare(right));
      setOptions({
        preparers: names(["team_member"]),
        checkers: names(["team_member", "leader", "reviewer"]),
        reviewers: names(["leader", "reviewer"]),
        clusters: (units.data ?? []).filter((unit) => unit.unit_kind === "cluster").map((unit) => unit.name),
        towers: (units.data ?? []).filter((unit) => unit.unit_kind === "tower").map((unit) => ({ name: unit.name, cluster: (units.data ?? []).find((parent) => parent.id === unit.parent_id && parent.unit_kind === "cluster")?.name ?? null })),
        error: null,
      });
    }).catch((error: unknown) => {
      if (!cancelled) setOptions({ preparers: [], checkers: [], reviewers: [], clusters: [], towers: [], error: error instanceof Error ? error.message : "Unable to load the live team." });
    });
    return () => { cancelled = true; };
  }, [live]);
  return live ? options : null;
}

function SetupDrawer({ assignment, live, profile, isSaving, onClose, onSave }: { assignment: FixtureClient["assignment"]; live: boolean; profile: FixtureTaxProfile; isSaving: boolean; onClose: () => void; onSave: (assignment: FixtureClient["assignment"], profile: FixtureTaxProfile, reason: string) => void }) {
  const [draftAssignment, setDraftAssignment] = useState({ ...assignment });
  const liveOptions = useLiveAssignmentOptions(live);
  const [draftProfile, setDraftProfile] = useState(() => cloneProfile(profile));
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  function save() {
    if (!reason.trim()) return setError("Enter a reason for this setup change.");
    onSave(draftAssignment, draftProfile, reason);
  }
  const activeMembers = fixtureOrgDirectoryMembers.filter((member) => member.active && member.tower !== "All A&T" && member.operatingModel !== "TAX_TEAM");
  const roleOptions = (role: "preparer" | "checker" | "reviewer") => {
    if (live) return liveOptions ? (role === "preparer" ? liveOptions.preparers : role === "checker" ? liveOptions.checkers : liveOptions.reviewers) : [];
    const eligible = role === "preparer" ? activeMembers.filter((member) => member.role === "Team Member") : role === "checker" ? activeMembers.filter((member) => member.role === "Team Member" || member.role === "HOD / Leader") : activeMembers.filter((member) => member.role === "HOD / Leader");
    return Array.from(new Set([draftAssignment[role], ...eligible.map((member) => member.name)].filter(Boolean)));
  };
  const clusterOptions = live ? liveOptions?.clusters ?? [] : Array.from(new Set([draftAssignment.cluster, ...activeMembers.map((member) => member.cluster)].filter(Boolean)));
  // A tower always belongs to the selected cluster; scope follows the tower.
  const towerOptions = live ? (liveOptions?.towers ?? []).filter((tower) => !draftAssignment.cluster || draftAssignment.cluster === "Unassigned" || draftAssignment.cluster === "Unresolved" || tower.cluster === draftAssignment.cluster).map((tower) => tower.name) : [];
  const selectCluster = (cluster: string) => setDraftAssignment((current) => ({ ...current, cluster, tower: live && !(liveOptions?.towers ?? []).some((tower) => tower.name === current.tower && tower.cluster === cluster) ? "Unassigned" : current.tower }));
  const selectTower = (tower: string) => setDraftAssignment((current) => ({ ...current, tower, cluster: (liveOptions?.towers ?? []).find((option) => option.name === tower)?.cluster ?? current.cluster }));
  return <DetailDrawer eyebrow="TMF setup" title="Edit operating setup" subtitle="Changes are saved as a dated setup version." onClose={onClose}><div className="form-stack">{error && <div className="form-error" role="alert">{error}</div>}{liveOptions?.error && <div className="form-error" role="alert">{liveOptions.error}</div>}{live && !liveOptions && <p className="form-field__hint" role="status">Loading the live team…</p>}<div className="form-grid"><AssignmentSelect label="Preparer" value={draftAssignment.preparer} options={roleOptions("preparer")} onChange={(value) => setDraftAssignment({ ...draftAssignment, preparer: value })} /><AssignmentSelect label="Checker" value={draftAssignment.checker} options={roleOptions("checker")} onChange={(value) => setDraftAssignment({ ...draftAssignment, checker: value })} /><AssignmentSelect label="Reviewer" value={draftAssignment.reviewer} options={roleOptions("reviewer")} onChange={(value) => setDraftAssignment({ ...draftAssignment, reviewer: value })} /><AssignmentSelect label="Cluster" value={draftAssignment.cluster} options={clusterOptions} onChange={selectCluster} />{live && <AssignmentSelect label="Tower" value={draftAssignment.tower} options={towerOptions} onChange={selectTower} />}</div><Field label="Client Weight"><select value={draftProfile.weight} onChange={(event) => { const weight = Number(event.target.value) as FixtureTaxProfile["weight"]; setDraftProfile({ ...draftProfile, weight, weightLabel: weightLabels[weight] }); }}><option value="0">Select client weight</option><option value="1">1 · Super Light</option><option value="2">2 · Light</option><option value="3">3 · Medium</option><option value="4">4 · Heavy</option><option value="5">5 · Super Heavy</option></select></Field><Field label="eNATE Setup"><select value={draftProfile.enateSetup} onChange={(event) => setDraftProfile({ ...draftProfile, enateSetup: event.target.value as FixtureTaxProfile["enateSetup"] })}><option>Yes</option><option>No</option><option>Unknown</option></select></Field><Field label="Payment Route"><select value={draftProfile.paymentRoute} onChange={(event) => setDraftProfile({ ...draftProfile, paymentRoute: event.target.value as FixtureTaxProfile["paymentRoute"] })}><option>Client Pays</option><option>TMF Pays</option><option>Not configured</option></select></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={isSaving} onClick={save} type="button">{isSaving ? "Saving…" : "Save operating setup"}</button></div></DetailDrawer>;
}

function ValidateDrawer({ gaps, isSaving, onClose, onValidate }: { gaps: readonly string[]; isSaving: boolean; onClose: () => void; onValidate: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <DetailDrawer eyebrow="Human validation" title="Validate Tax Profile" subtitle="Confirms the current facts against the approved source and activates this profile version." onClose={onClose}><div className="form-stack">{gaps.length > 0 ? <div className="form-error" role="alert">Complete the missing setup first: {gaps.join(", ")}.</div> : <p className="drawer-form-note">You confirm that the registration facts, returns, and operating setup match the approved source. Generated work and the service calendar follow this validated version.</p>}<Field label="Validation note"><input onChange={(event) => setReason(event.target.value)} placeholder="Required, e.g. checked against the 2303 on file" value={reason} /></Field><button className="button button--primary" disabled={isSaving || gaps.length > 0 || !reason.trim()} onClick={() => onValidate(reason.trim())} type="button">{isSaving ? "Validating…" : "Validate Tax Profile"}</button></div></DetailDrawer>;
}

function AssignmentSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)}><option value="Unassigned">Unassigned</option>{options.filter((option) => option !== "Unassigned").map((option) => <option key={option}>{option}</option>)}</select></Field>;
}

function AuthorityDrawer({ isSaving, onClose, onSave }: { isSaving: boolean; onClose: () => void; onSave: (authority: FixtureAuthority, reason: string) => void }) {
  const [authority, setAuthority] = useState<FixtureAuthority>({ id: "authority-review", authority: "", reference: "Review reference", status: "Active", effectiveFrom: "Current review", entitlement: "Context recorded; tax treatment is not inferred.", source: "Approved review source" });
  const [reason, setReason] = useState("");
  return <DetailDrawer eyebrow="Standing context" title="Add authority record" subtitle="The record is saved with source and effective-date history." onClose={onClose}><div className="form-stack"><Field label="Authority / scheme"><select autoFocus value={authority.authority} onChange={(event) => setAuthority({ ...authority, authority: event.target.value })}><option value="">Select authority</option>{clientAuthorityOptions.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Reference"><input value={authority.reference} onChange={(event) => setAuthority({ ...authority, reference: event.target.value })} /></Field><Field label="Status"><select value={authority.status} onChange={(event) => setAuthority({ ...authority, status: event.target.value as FixtureAuthority["status"] })}><option>Active</option><option>Review due</option><option>Not configured</option></select></Field><Field label="Entitlement / exemption context"><textarea value={authority.entitlement} onChange={(event) => setAuthority({ ...authority, entitlement: event.target.value })} /></Field><Field label="Reason for change"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required" /></Field><button className="button button--primary" disabled={!authority.authority.trim() || !reason.trim() || isSaving} onClick={() => onSave(authority, reason)} type="button">{isSaving ? "Saving…" : "Add authority"}</button></div></DetailDrawer>;
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

function Field({ label, children, invalid = false, required = false }: { label: string; children: React.ReactNode; invalid?: boolean; required?: boolean }) {
  return <label className={invalid ? "form-field form-field--invalid" : "form-field"}><span>{label}{required ? " *" : ""}</span>{children}{invalid && <small className="form-field__error">Required</small>}</label>;
}

const weightLabels: Record<number, string> = { 0: "No numeric source weight", 1: "Super Light", 2: "Light", 3: "Medium", 4: "Heavy", 5: "Super Heavy" };
