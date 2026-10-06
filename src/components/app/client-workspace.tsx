"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  fixtureHistory,
  fixtureTeamHistory,
  type FixtureAuthority,
  type FixtureClient,
  type FixtureTaxProfile,
} from "@/lib/fixtures";
import { DetailDrawer, SectionHeading } from "./workspace-components";
import { Temporary2303Upload } from "./temporary-2303-upload";

type DrawerMode = "identity" | "setup" | "authority" | "source" | "upload" | null;

export function ClientWorkspace({ client, dataMode = "sanitized", demoMode = false }: { client: FixtureClient; dataMode?: string; demoMode?: boolean }) {
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<FixtureTaxProfile>(() => cloneProfile(client.entities[0].profile));
  const [assignment, setAssignment] = useState(client.assignment);

  const units = client.entities[0].units;
  const selectedUnit = units[selectedUnitIndex] ?? units[0];
  const attention = profile.attention;
  const auditCount = profile.auditExposures.length;
  const isMultipleUnit = units.length > 1;
  const profileHistory = fixtureHistory.filter((item) => item.clientId === client.id);

  function closeDrawer() {
    setDrawer(null);
    setSavedMessage(null);
  }

  function saveProfile(next: FixtureTaxProfile, message: string) {
    setProfile(next);
    setSavedMessage(message);
  }

  return (
    <>
      <div className="client-context-bar">
        <div><Link className="breadcrumb-link" href="/app/clients">All Clients</Link><span aria-hidden="true"> / </span><strong>{profile.registeredTaxpayerName}</strong></div>
        <div className="client-context-bar__right">{client.clientGroup && <span className="context-group">{client.clientGroup}</span>}</div>
      </div>

      <header className="dossier-header">
        <div>
          <h1>{profile.registeredTaxpayerName}</h1>
          <p className="dossier-header__meta"><strong>{profile.tinDisplay}</strong><span>·</span>{selectedUnit.name}<span>·</span>{client.assignment.tower} / {client.assignment.cluster}</p>
        </div>
        <div className="dossier-header__actions">
          <span className={profile.profileState === "Active" ? "profile-state profile-state--active" : "profile-state profile-state--review"}>{profile.profileState}</span>
          <button className="button button--quiet" onClick={() => setDrawer("upload")} type="button">Upload 2303</button>
          <button className="button button--quiet" onClick={() => setDrawer("source")} type="button">Review source</button>
        </div>
      </header>

      {isMultipleUnit && <div className="unit-switcher" aria-label="Registration Unit selector"><span>Registration context</span>{units.map((unit, index) => <button aria-pressed={index === selectedUnitIndex} className={index === selectedUnitIndex ? "unit-switcher__button unit-switcher__button--active" : "unit-switcher__button"} key={unit.name} onClick={() => { setSelectedUnitIndex(index); setProfile(cloneProfile(unit.profile)); }} type="button">{unit.name}<small>{unit.type} · {unit.profile.branchCode}</small></button>)}</div>}

      {savedMessage && <div className="saved-notice" role="status">{savedMessage}</div>}

      {attention.length > 0 && (
        <section className="profile-attention" aria-labelledby="profile-attention-title">
          <div><p className="eyebrow">Needs attention</p><h2 id="profile-attention-title">{attention.length} item{attention.length === 1 ? "" : "s"} to review</h2></div>
          <ul>{attention.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}

      <div className="dossier-grid dossier-grid--primary">
        <section className="dossier-section dossier-section--identity">
          <SectionHeading title="Identity / BIR registration" />
          <div className="dossier-facts">
            <Fact label="Registered name" value={profile.registeredTaxpayerName} wide />
            <Fact label="TIN / branch code" value={profile.tinDisplay + " · " + profile.branchCode} />
            <Fact label="Head Office / Branch" value={selectedUnit.type} />
            <Fact label="RDO / LTS" value={profile.rdoOrLts} />
            <Fact label="Entity type" value={profile.entityType} />
            <Fact label="Registration status" value={profile.registrationStatus} />
            <Fact label="Registered address" value={profile.registeredAddress} wide />
            <Fact label="Nature / line of business" value={profile.lineOfBusiness} />
            <Fact label="Registration date" value={profile.registrationEffective} />
            <Fact label="Fiscal year-end" value={profile.fiscalYearEnd ?? "Not configured"} />
            <Fact label="Filing channel" value={profile.filingChannel} />
            <Fact label="eFPS / eBIRForms context" value={profile.filingContext} />
            {profile.eFPSGroup && <Fact label="eFPS group" value={profile.eFPSGroup} />}
            <Fact label="BIR registered tax types" value={profile.registeredTaxTypes.join(" · ")} wide />
          </div>
          <div className="dossier-section__footer">
            <div><span className="meta-label">Source</span><strong>{profile.sourceLabel}</strong><small>{profile.sourceKind} · Last validated {profile.lastValidated ?? "not recorded"}{profile.validator ? " · " + profile.validator : ""}</small></div>
            <button className="text-button" onClick={() => setDrawer("identity")} type="button">Edit registration facts</button>
          </div>
        </section>

        <section className="dossier-section dossier-section--setup">
          <SectionHeading title="TMF operating setup" />
          <div className="assignment-grid assignment-grid--dossier">
            <Fact label="Cluster" value={assignment.cluster} />
            <Fact label="Tower / team" value={assignment.tower} />
            <Fact label="Preparer" value={assignment.preparer} />
            <Fact label="Checker" value={assignment.checker} />
            <Fact label="Reviewer" value={assignment.reviewer} />
            <Fact label="Effective from" value={assignment.effectiveFrom} />
          </div>
          <div className="setup-summary">
            <Fact label="Client Weight" value={profile.sourceFinalWeight === null ? "Excluded from source reconciliation" : `${profile.sourceFinalWeight} · ${profile.sourceWeightClassification ?? profile.weightLabel}`} />
            <Fact label="eNATE Setup" value={profile.enateSetup} />
            <Fact label="Payment Route" value={profile.paymentRoute} />
          </div>
          {profile.paymentRoute === "TMF Pays" && <div className="policy-note"><strong>Funding control</strong><span>Funding must be confirmed before TMF executes payment. This profile stores the route; Tax Run owns the downstream block.</span></div>}
          <div className="dossier-section__footer"><div><span className="meta-label">Assignment history</span><strong>Effective-dated changes preserved</strong></div><button className="text-button" onClick={() => setDrawer("setup")} type="button">Edit operating setup</button></div>
        </section>
      </div>

      <div className="dossier-grid dossier-grid--secondary">
        <section className="dossier-section">
          <SectionHeading title="Registrations & authorities" />
          {profile.authorities.length === 0 ? <div className="dossier-empty">No authority records configured.</div> : <div className="authority-list">{profile.authorities.map((authority) => <AuthorityRow authority={authority} key={authority.id} />)}</div>}
          <button className="button button--quiet button--small" onClick={() => setDrawer("authority")} type="button">Add authority record</button>
        </section>

        <section className="dossier-section">
          <SectionHeading title="Books & invoicing" />
          <div className="dossier-facts dossier-facts--compact">
            <Fact label="Books type" value={profile.booksType ?? "Not configured"} />
            <Fact label="Invoicing / permit" value={profile.invoicing ?? "Not configured"} />
          </div>
        </section>

        <section className="dossier-section dossier-section--audit">
          <SectionHeading title="BIR audit exposure" />
          <div className="audit-summary"><strong>{auditCount ? "BIR Audits — " + auditCount + " open year" + (auditCount === 1 ? "" : "s") : "No open BIR audit recorded"}</strong><span>{auditCount ? "Review the year-level context below." : "No exposure is recorded in this profile."}</span></div>
          {auditCount > 0 && <div className="audit-list">{profile.auditExposures.map((item) => <div className="audit-row" key={item.id}><div><strong>{item.taxableYear}</strong><span>{item.matter}</span></div><span className="audit-status">{item.status}</span><small>{item.context}</small></div>)}</div>}
        </section>
      </div>

      <div className="dossier-grid dossier-grid--secondary">
        <section className="dossier-section">
          <SectionHeading title="Team history" />
          <TeamHistoryTable client={client} />
        </section>
        <section className="dossier-section">
          <SectionHeading title="Profile history" />
          <div className="history-list">{profileHistory.length > 0 ? profileHistory.slice(0, 3).map((item) => <div className="history-row" key={item.id}><span className="history-row__mark" aria-hidden="true" /><div><strong>{item.label}</strong><small>{item.detail}</small></div><time>{item.date}</time></div>) : <div className="dossier-empty">No material profile changes recorded.</div>}</div>
        </section>
      </div>

      {drawer === "identity" && <IdentityDrawer profile={profile} onClose={closeDrawer} onSave={(next) => { saveProfile(next, "Registration facts updated for this review."); closeDrawer(); }} />}
      {drawer === "setup" && <SetupDrawer assignment={assignment} profile={profile} onClose={closeDrawer} onSave={(nextAssignment, nextProfile) => { setAssignment(nextAssignment); saveProfile(nextProfile, "Operating setup updated for this review."); closeDrawer(); }} />}
      {drawer === "authority" && <AuthorityDrawer onClose={closeDrawer} onSave={(authority) => { saveProfile({ ...profile, authorities: [...profile.authorities, authority] }, "Authority record added for this review."); closeDrawer(); }} />}
      {drawer === "upload" && <DetailDrawer eyebrow="Registration setup" title="Upload temporary 2303" subtitle="The file is private and temporary until the controlled processing lifecycle advances." onClose={closeDrawer}><Temporary2303Upload dataMode={dataMode} demoMode={demoMode} /></DetailDrawer>}
      {drawer === "source" && <SourceDrawer profile={profile} onClose={closeDrawer} onSave={(next) => { saveProfile(next, "Tax Profile validation recorded for this review."); closeDrawer(); }} />}
    </>
  );
}

function cloneProfile(profile: FixtureTaxProfile): FixtureTaxProfile {
  return { ...profile, authorities: [...profile.authorities], auditExposures: [...profile.auditExposures], attention: [...profile.attention], extractionFields: profile.extractionFields ? [...profile.extractionFields] : undefined };
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "dossier-fact dossier-fact--wide" : "dossier-fact"}><span>{label}</span><strong>{value}</strong></div>;
}

function AuthorityRow({ authority }: { authority: FixtureAuthority }) {
  return <div className="authority-row"><div><strong>{authority.authority}</strong><span>{authority.reference}</span></div><span className="authority-status">{authority.status}</span><small>{authority.entitlement}</small></div>;
}

function TeamHistoryTable({ client }: { client: FixtureClient }) {
  const records = fixtureTeamHistory.filter((item) => item.clientId === client.id);
  return <div className="team-history-table team-history-table--dossier" role="table"><div className="team-history-table__header" role="row"><span role="columnheader">Effective</span><span role="columnheader">Preparer</span><span role="columnheader">Checker</span><span role="columnheader">Reviewer</span><span role="columnheader">Tower / cluster</span><span role="columnheader">Reason</span></div>{records.map((item) => <div className="team-history-row" key={item.id} role="row"><span role="cell"><strong>{item.effectivePeriod}</strong></span><span role="cell">{item.preparer}</span><span role="cell">{item.checker}</span><span role="cell">{item.reviewer}</span><span role="cell">{item.tower}<small>{item.cluster}</small></span><span role="cell">{item.reason}</span></div>)}</div>;
}

function IdentityDrawer({ profile, onClose, onSave }: { profile: FixtureTaxProfile; onClose: () => void; onSave: (profile: FixtureTaxProfile) => void }) {
  const [draft, setDraft] = useState(() => cloneProfile(profile));
  return <DetailDrawer eyebrow="Profile setup" title="Edit registration facts" subtitle="Material changes require source and effective-date history." onClose={onClose}><div className="form-stack"><Field label="Registered taxpayer name"><input value={draft.registeredTaxpayerName} onChange={(event) => setDraft({ ...draft, registeredTaxpayerName: event.target.value })} /></Field><Field label="RDO / LTS"><input value={draft.rdoOrLts} onChange={(event) => setDraft({ ...draft, rdoOrLts: event.target.value })} /></Field><Field label="Registered address"><textarea value={draft.registeredAddress} onChange={(event) => setDraft({ ...draft, registeredAddress: event.target.value })} /></Field><Field label="Fiscal year-end"><input value={draft.fiscalYearEnd ?? ""} onChange={(event) => setDraft({ ...draft, fiscalYearEnd: event.target.value })} /></Field><Field label="Filing channel"><select value={draft.filingChannel} onChange={(event) => setDraft({ ...draft, filingChannel: event.target.value })}><option>eFPS</option><option>eBIRForms</option><option>Other approved channel</option><option>Needs review</option></select></Field><button className="button button--primary" onClick={() => onSave(draft)} type="button">Save registration facts</button></div></DetailDrawer>;
}

function SetupDrawer({ assignment, profile, onClose, onSave }: { assignment: FixtureClient["assignment"]; profile: FixtureTaxProfile; onClose: () => void; onSave: (assignment: FixtureClient["assignment"], profile: FixtureTaxProfile) => void }) {
  const [draftAssignment, setDraftAssignment] = useState({ ...assignment });
  const [draftProfile, setDraftProfile] = useState(() => cloneProfile(profile));
  const [error, setError] = useState<string | null>(null);
  function save() {
    if (!draftAssignment.preparer || draftAssignment.preparer === "Unassigned" || !draftAssignment.checker || !draftAssignment.reviewer) return setError("Preparer, Checker, and Reviewer are required before Active setup.");
    if (new Set([draftAssignment.preparer, draftAssignment.checker, draftAssignment.reviewer]).size !== 3) return setError("Preparer, Checker, and Reviewer must be distinct.");
    if (draftProfile.enateSetup === "Unknown") return setError("Choose Yes or No for eNATE Setup.");
    if (draftProfile.paymentRoute === "Not configured") return setError("Choose Client Pays or TMF Pays.");
    onSave(draftAssignment, draftProfile);
  }
  return <DetailDrawer eyebrow="TMF setup" title="Edit operating setup" subtitle="Current accountability is separate from historical work actors." onClose={onClose}><div className="form-stack">{error && <div className="form-error" role="alert">{error}</div>}<div className="form-grid"><Field label="Preparer"><input value={draftAssignment.preparer} onChange={(event) => setDraftAssignment({ ...draftAssignment, preparer: event.target.value })} /></Field><Field label="Checker"><input value={draftAssignment.checker} onChange={(event) => setDraftAssignment({ ...draftAssignment, checker: event.target.value })} /></Field><Field label="Reviewer"><input value={draftAssignment.reviewer} onChange={(event) => setDraftAssignment({ ...draftAssignment, reviewer: event.target.value })} /></Field><Field label="Tower"><input value={draftAssignment.tower} onChange={(event) => setDraftAssignment({ ...draftAssignment, tower: event.target.value })} /></Field><Field label="Cluster"><input value={draftAssignment.cluster} onChange={(event) => setDraftAssignment({ ...draftAssignment, cluster: event.target.value })} /></Field></div><Field label="Client Weight"><select value={draftProfile.weight} onChange={(event) => { const weight = Number(event.target.value) as FixtureTaxProfile["weight"]; setDraftProfile({ ...draftProfile, weight, weightLabel: weightLabels[weight] }); }}><option value="1">1 · Super Light</option><option value="2">2 · Light</option><option value="3">3 · Medium</option><option value="4">4 · Heavy</option><option value="5">5 · Super Heavy</option></select></Field><Field label="eNATE Setup"><select value={draftProfile.enateSetup} onChange={(event) => setDraftProfile({ ...draftProfile, enateSetup: event.target.value as FixtureTaxProfile["enateSetup"] })}><option>Yes</option><option>No</option><option>Unknown</option></select></Field><Field label="Payment Route"><select value={draftProfile.paymentRoute} onChange={(event) => setDraftProfile({ ...draftProfile, paymentRoute: event.target.value as FixtureTaxProfile["paymentRoute"] })}><option>Client Pays</option><option>TMF Pays</option><option>Not configured</option></select></Field><button className="button button--primary" onClick={save} type="button">Save operating setup</button></div></DetailDrawer>;
}

function AuthorityDrawer({ onClose, onSave }: { onClose: () => void; onSave: (authority: FixtureAuthority) => void }) {
  const [authority, setAuthority] = useState<FixtureAuthority>({ id: "authority-review", authority: "", reference: "Review reference", status: "Active", effectiveFrom: "Current review", entitlement: "Context recorded; tax treatment is not inferred.", source: "Approved review source" });
  return <DetailDrawer eyebrow="Standing context" title="Add authority record" subtitle="Extensible registration context · review session." onClose={onClose}><div className="form-stack"><Field label="Authority / scheme"><input autoFocus value={authority.authority} onChange={(event) => setAuthority({ ...authority, authority: event.target.value })} placeholder="PEZA, SEC, BOI, DOE or other" /></Field><Field label="Reference"><input value={authority.reference} onChange={(event) => setAuthority({ ...authority, reference: event.target.value })} /></Field><Field label="Status"><select value={authority.status} onChange={(event) => setAuthority({ ...authority, status: event.target.value as FixtureAuthority["status"] })}><option>Active</option><option>Review due</option><option>Not configured</option></select></Field><Field label="Entitlement / exemption context"><textarea value={authority.entitlement} onChange={(event) => setAuthority({ ...authority, entitlement: event.target.value })} /></Field><button className="button button--primary" disabled={!authority.authority.trim()} onClick={() => onSave(authority)} type="button">Add authority</button></div></DetailDrawer>;
}

function SourceDrawer({ profile, onClose, onSave }: { profile: FixtureTaxProfile; onClose: () => void; onSave: (profile: FixtureTaxProfile) => void }) {
  const fields = profile.extractionFields ?? [];
  const [validationError, setValidationError] = useState<string | null>(null);
  const attentionFields = fields.filter((field) => field.confidence !== "High");
  const firstAttentionRef = useRef<HTMLDivElement>(null);
  const is2303Source = profile.sourceKind === "2303-derived";
  function validate() {
    if (attentionFields.length > 0) return setValidationError("Resolve the highlighted source fields before validation. Unknown must remain unknown.");
    onSave({ ...profile, profileState: "Active", lastValidated: "Current review", validator: "HOD review persona" });
  }
  return <DetailDrawer eyebrow={is2303Source ? "2303 review" : "Registration source review"} title="Source review" subtitle={is2303Source ? "Sanitized structural fixture · no document is stored or uploaded by this interaction." : "Approved structured source context · no source document is stored in this prototype."} onClose={onClose}>
    <div className="source-review">
      <div className="source-review__intro"><strong>Human validation is required before profile activation.</strong><span>{is2303Source ? "The source pane mirrors the supplied three-page Form 2303 revised April 2019 structure. Values shown here are sanitized." : "Review the structured facts and provenance recorded for this taxpayer. This prototype does not store the source document."}</span></div>
      <div className="source-review__layout">
        {is2303Source ? <div className="source-preview" aria-label="BIR Form 2303 structural preview"><div className="source-preview__masthead"><strong>REPUBLIC OF THE PHILIPPINES</strong><span>Department of Finance · Bureau of Internal Revenue</span><b>BIR FORM 2303</b><small>REVISED: APRIL 2019 · CERTIFICATE OF REGISTRATION</small><em>OCN: DEMO</em></div><div className="source-preview__identity"><span>TIN &amp; BRANCH CODE</span><strong>000-000-000-000</strong><span>NAME OF TAXPAYER</span><strong>Lakeshore Apparel Manufacturing Inc.</strong><span>TIN ISSUANCE DATE</span><strong>Demo date · 2022</strong><span>REGISTERING OFFICE</span><strong>Head Office</strong><span>REGISTERED ADDRESS</span><strong>Demo industrial address · Laguna</strong></div><div className="source-preview__table"><div className="source-preview__table-head"><span>TAX TYPE</span><span>FORM TYPE</span><span>FREQUENCY</span><span>DUE DATE</span></div><div><strong>Income-tax row</strong><strong>Illustrative form</strong><strong>Illustrative cadence</strong><strong>Approved rule required</strong></div><div><strong>VAT row</strong><strong>Illustrative form</strong><strong>Illustrative cadence</strong><strong>Approved rule required</strong></div><div><strong>Withholding row</strong><strong>Illustrative form</strong><strong>Illustrative cadence</strong><strong>Approved rule required</strong></div></div><div className="source-preview__block"><span>PAGE 2 · TAXPAYER TYPE/S</span><strong>Domestic corporation</strong></div><div className="source-preview__split"><div><span>TRADE NAME 1 / PSIC</span><strong>Lakeshore Apparel · demo industry code</strong></div><div><span>LINE OF BUSINESS / CATEGORY</span><strong>Apparel manufacturing · primary</strong></div></div><div className="source-preview__block"><span>PAGE 3 · CERTIFICATION / REGISTERING AUTHORITY</span><strong>Certification block · no signature retained</strong></div><small className="source-preview__caption">Review copy · 3 pages · no source document stored</small></div> : <div className="source-fallback"><span className="meta-label">Source context</span><strong>{profile.sourceLabel}</strong><p>No source document is stored in this prototype. Review the structured profile facts and validate when ready.</p><small>{profile.sourceKind} · provenance retained as profile metadata</small></div>}
        <div className="source-review__fields"><div className="source-review__summary"><strong>{fields.length} fields</strong><span>{fields.filter((field) => field.confidence === "High").length} clear · {attentionFields.length} need attention</span></div>{fields.length === 0 && <p className="source-fallback__empty">No extracted fields are attached to this source. Manual structured validation is required.</p>}{fields.map((field, index) => <div className={field.confidence === "High" ? "extraction-row" : "extraction-row extraction-row--attention"} key={field.label} ref={index === 0 ? firstAttentionRef : undefined} tabIndex={index === 0 ? -1 : undefined}><div><strong>{field.label}</strong><small>{field.sourcePage} · {field.provenance}</small></div><span>{field.value}</span><em>{field.confidence}</em></div>)}</div>
      </div>
      {validationError && <div className="form-error" role="alert">{validationError}</div>}
      <div className="source-review__actions"><button className="button button--quiet" onClick={() => { setValidationError(null); firstAttentionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); firstAttentionRef.current?.focus(); }} type="button">Review attention items</button><button className="button button--primary" disabled={attentionFields.length > 0} onClick={validate} type="button">Validate Tax Profile</button></div>
    </div>
  </DetailDrawer>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

const weightLabels: Record<number, string> = { 0: "No numeric source weight", 1: "Super Light", 2: "Light", 3: "Medium", 4: "Heavy", 5: "Super Heavy" };
