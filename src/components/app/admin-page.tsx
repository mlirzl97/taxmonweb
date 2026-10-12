"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DetailDrawer, EmptyState, FixturePageFrame, PageHeader, SectionHeading } from "@/components/app/workspace-components";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { adaptLiveTeamMember } from "@/lib/domain/live-team-adapter";
import { accessLevelLabel, moduleAccessMapForPersona, rbacPersonaOptions, type AccessLevel, type AccessMatrix, type ModuleKey, type RbacPersona } from "@/lib/domain/access";
import { fixtureCalendar, fixtureClients, fixtureOrgDirectoryMembers, fixtureSpecialistCases, fixtureWork, type FixtureClient, type FixtureTeamMember } from "@/lib/fixtures";
import { clearPrototypeSeedData } from "@/lib/prototype-storage";
import { useWorkflow, workflowPerspectiveLabel } from "@/lib/workflow-state";
import { StaffProvisioningForm } from "@/components/app/staff-provisioning-form";

type AdminView = "overview" | "access" | "organization" | "audit" | "settings";

const adminViews: ReadonlyArray<{ id: AdminView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "access", label: "Users & access" },
  { id: "organization", label: "Organization" },
  { id: "audit", label: "Audit trail" },
  { id: "settings", label: "Settings" },
];

const moduleLabels: ReadonlyArray<[ModuleKey, string]> = [["control_tower", "Control Tower"], ["team", "Team"], ["tax_team", "Tax Team"], ["clients", "Clients"], ["work", "Work"], ["bir_center", "BIR Center"], ["admin", "Admin"]];
const accessLevelOptions: readonly AccessLevel[] = ["NONE", "VIEW", "ACT", "APPROVE", "GOVERN", "OVERRIDE"];

export default function AdminPage() {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const initialView: AdminView = requestedView === "access" || requestedView === "organization" || requestedView === "audit" || requestedView === "settings" ? requestedView : "overview";
  const [view, setView] = useState<AdminView>(initialView);

  return (
    <FixturePageFrame>
      <PageHeader description="Govern access, structure and history." title="Admin" />
      <nav aria-label="Admin views" className="tower-tabs module-tabs" role="tablist">
        {adminViews.map((item) => <button aria-selected={view === item.id} className={view === item.id ? "tower-tab tower-tab--active" : "tower-tab"} key={item.id} onClick={() => setView(item.id)} role="tab" tabIndex={view === item.id ? 0 : -1} type="button">{item.label}</button>)}
      </nav>

      {view === "overview" && <AdminOverview />}
      {view === "access" && <AccessMatrixEditor />}
      {view === "organization" && <AdminPlaceholder title="Organization" description="Organization units and effective-dated structure are managed here. Team remains the operational projection." />}
      {view === "audit" && <AuditTrailOverview />}
      {view === "settings" && <PrototypeDataSettings />}
    </FixturePageFrame>
  );
}

function AdminOverview() {
  const { accessMatrix, workPerspective } = useWorkflow();
  const accessMap = moduleAccessMapForPersona(workPerspective, accessMatrix);

  return <>
    <section className="admin-summary-grid" aria-label="Administration summary">
      <div className="panel admin-summary-card"><span className="meta-label">Access</span><strong>Governed</strong><small>Capabilities and scope are separate from job title.</small></div>
      <div className="panel admin-summary-card"><span className="meta-label">History</span><strong>Append-only</strong><small>Material changes retain actor, time and reason.</small></div>
      <div className="panel admin-summary-card"><span className="meta-label">Prototype mode</span><strong>Sanitized</strong><small>Calibration edits are not production authority.</small></div>
    </section>
    <section className="panel admin-boundary-panel" aria-labelledby="admin-boundary-title">
      <SectionHeading detail="Use the tabs to inspect the governed administration boundaries." title="System boundaries" />
      <ul className="admin-boundary-list" id="admin-boundary-title">
        <li><strong>System administration</strong><span>Users, access, organization and technical configuration.</span></li>
        <li><strong>Tax control</strong><span>Profile validation, compliance control, rules and QA authority.</span></li>
        <li><strong>Operational ownership</strong><span>Engagement accountability remains with the assigned team.</span></li>
      </ul>
    </section>
    <section className="panel admin-access-panel" aria-labelledby="admin-access-title">
      <SectionHeading detail="The lens changes visibility and action boundaries in this prototype." title={`Current access · ${workflowPerspectiveLabel(workPerspective)}`} />
      <div className="admin-access-grid" id="admin-access-title">{moduleLabels.map(([module, label]) => <div className="admin-access-row" key={module}><strong>{label}</strong><span className={`admin-access-level admin-access-level--${accessMap[module].toLowerCase()}`}>{accessLevelLabel(accessMap[module])}</span></div>)}</div>
      <p className="admin-placeholder-note">RACI describes accountability; this access view only simulates capability and scope. Server-side authorization remains authoritative.</p>
    </section>
    <AdminDataOverview />
  </>;
}

function AccessMatrixEditor() {
  const { accessMatrix, accessPolicyHistory, canManageAccess, commitAccessMatrix, workPerspective } = useWorkflow();
  const { prototypeMode } = useWorkflow();
  const [liveCapabilities, setLiveCapabilities] = useState<readonly string[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<RbacPersona>(workPerspective);
  const [draft, setDraft] = useState<Record<ModuleKey, AccessLevel>>(() => ({ ...moduleAccessMapForPersona(workPerspective, accessMatrix) }));
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [staffMembers, setStaffMembers] = useState<FixtureTeamMember[]>(() => prototypeMode ? [...fixtureOrgDirectoryMembers] : []);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffDrawerOpen, setStaffDrawerOpen] = useState(false);
  const [accessDrawerOpen, setAccessDrawerOpen] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [reasonDrawerOpen, setReasonDrawerOpen] = useState(false);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/me/access", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { capabilities?: Array<{ capability_key?: string }> }) => {
        if (!cancelled) setLiveCapabilities((payload.capabilities ?? []).map((item) => item.capability_key).filter((value): value is string => Boolean(value)));
      })
      .catch(() => { if (!cancelled) setLiveCapabilities([]); });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/team", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: Parameters<typeof adaptLiveTeamMember>[0][] };
        if (!response.ok) throw new Error("Unable to load users.");
        if (!cancelled) setStaffMembers((payload.data ?? []).map(adaptLiveTeamMember));
      })
      .catch(() => { if (!cancelled) setStaffMembers([]); });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  const canProvisionStaff = prototypeMode ? canManageAccess : liveCapabilities.includes("AdministerUsers");

  function selectPersona(next: RbacPersona) {
    setSelectedPersona(next);
    setDraft({ ...moduleAccessMapForPersona(next, accessMatrix) });
    setReason("");
    setFeedback("");
  }

  function updateLevel(module: ModuleKey, level: AccessLevel) {
    setDraft((current) => ({ ...current, [module]: level }));
    setFeedback("");
  }

  function saveTemplate() {
    const nextMatrix: AccessMatrix = { ...accessMatrix, [selectedPersona]: { ...draft } };
    const result = commitAccessMatrix(nextMatrix, reason);
    setFeedback(result.ok ? `${rbacPersonaOptions.find((option) => option.id === selectedPersona)?.label ?? selectedPersona} access template saved.` : result.error ?? "Access template could not be saved.");
    if (result.ok) {
      setReason("");
      setReasonDrawerOpen(false);
    }
  }

  return <>
    <div className="admin-access-launchers">
      <section className="panel admin-access-launcher" aria-labelledby="admin-access-launcher-title">
        <div><span className="meta-label">Administration</span><h2 id="admin-access-launcher-title">Users & access</h2><p>{staffMembers.length} people with access</p></div>
        <button className="button button--primary" onClick={() => setAccessDrawerOpen(true)} type="button">Open Users & access</button>
      </section>
      <section className="panel admin-access-launcher" aria-labelledby="admin-template-launcher-title">
        <div><span className="meta-label">Administration</span><h2 id="admin-template-launcher-title">Access templates</h2><p>{rbacPersonaOptions.length} governed role templates</p></div>
        <button className="button button--primary" onClick={() => setTemplateDrawerOpen(true)} type="button">Open Access templates</button>
      </section>
    </div>
    {accessDrawerOpen && <DetailDrawer eyebrow="Administration" title="Users & access" subtitle="People, scope and role templates" onClose={() => { setAccessDrawerOpen(false); setStaffDrawerOpen(false); setSelectedStaffId(null); setReasonDrawerOpen(false); }}>
    <StaffAccessRoster members={staffMembers} canManage={canProvisionStaff} onAdd={() => setStaffDrawerOpen(true)} onSelect={(id) => { setSelectedStaffId(id); setStaffDrawerOpen(false); }} />
    {staffDrawerOpen && <DetailDrawer eyebrow="Users & access" title="Add staff member" subtitle="Create the identity, access bundle and scope in one audited step." onClose={() => setStaffDrawerOpen(false)}><StaffProvisioningForm canManage={canProvisionStaff} onClose={() => setStaffDrawerOpen(false)} /></DetailDrawer>}
    {selectedStaffId && <StaffAccessDrawer member={staffMembers.find((member) => member.id === selectedStaffId)} onClose={() => setSelectedStaffId(null)} />}
    </DetailDrawer>}
    {templateDrawerOpen && <DetailDrawer eyebrow="Administration" title="Access templates" subtitle="Role-level capability defaults" onClose={() => { setTemplateDrawerOpen(false); setReasonDrawerOpen(false); }}>
    <section className="panel admin-access-editor" aria-labelledby="access-editor-title">
    <SectionHeading detail="Role-level defaults. Individual scope and segregation controls still apply." title="Access templates" />
    <div className="admin-access-editor__toolbar">
      <label className="admin-access-editor__role" htmlFor="access-role-template">
        <span>Role template</span>
        <select id="access-role-template" onChange={(event) => selectPersona(event.target.value as RbacPersona)} value={selectedPersona}>
          {rbacPersonaOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <p className="admin-access-editor__note">{rbacPersonaOptions.find((option) => option.id === selectedPersona)?.description}</p>
    </div>

    <div className="admin-access-editor__table" id="access-editor-title">
      <div className="admin-access-editor__table-head"><span>Module</span><span>Effective access</span></div>
      {moduleLabels.map(([module, label]) => <div className="admin-access-editor__row" key={module}>
        <div><strong>{label}</strong><span className="admin-access-editor__level">{accessLevelLabel(draft[module])}</span></div>
        <select aria-label={`${label} access level`} disabled={!canManageAccess} onChange={(event) => updateLevel(module, event.target.value as AccessLevel)} value={draft[module]}>
          {accessLevelOptions.map((level) => <option key={level} value={level}>{accessLevelLabel(level)}</option>)}
        </select>
      </div>)}
    </div>

    <div className="admin-access-editor__footer"><span className="admin-access-editor__note">A reason is required and recorded with the change.</span><button className="button button--primary" disabled={!canManageAccess} onClick={() => setReasonDrawerOpen(true)} type="button">Review and save</button></div>
    <p aria-live="polite" className="inline-feedback">{feedback || (canManageAccess ? "Changes are staged until you save with a reason." : "Read-only access view. HOD, Tax Control and Super Admin manage access templates.")}</p>

    <div className="admin-access-editor__history">
      <strong>Recent access changes</strong>
      {accessPolicyHistory.length === 0 ? <span className="admin-access-editor__note">No local access changes recorded.</span> : [...accessPolicyHistory].reverse().slice(0, 5).map((event) => <div className="admin-access-editor__history-item" key={event.id}><strong>{event.actor} · {event.recordedAt}</strong><span>{event.reason}</span></div>)}
    </div>
    <p className="admin-placeholder-note">Technical administration does not grant tax-control authority. Production enforcement belongs to authenticated server commands, RLS and audited actor history.</p>
    </section>
    {reasonDrawerOpen && <DetailDrawer eyebrow="Access template" title="Reason for change" subtitle="Required for the audit trail" onClose={() => setReasonDrawerOpen(false)}>
      <div className="admin-reason-drawer">
        <label className="form-field" htmlFor="access-change-reason"><span>Reason</span><textarea id="access-change-reason" autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Explain why this access template is changing." rows={5} value={reason} /></label>
        <div className="admin-reason-drawer__actions"><button className="button button--quiet" onClick={() => setReasonDrawerOpen(false)} type="button">Cancel</button><button className="button button--primary" disabled={!reason.trim()} onClick={saveTemplate} type="button">Save access template</button></div>
      </div>
    </DetailDrawer>}
    </DetailDrawer>}
  </>;
}

function StaffAccessRoster({ members, canManage, onAdd, onSelect }: { members: readonly FixtureTeamMember[]; canManage: boolean; onAdd: () => void; onSelect: (id: string) => void }) {
  return <section className="panel admin-users-panel" aria-labelledby="admin-users-title">
    <div className="admin-users-panel__header"><div><span className="meta-label">People with access</span><h2 id="admin-users-title">Users & access</h2></div>{canManage && <button className="button button--primary" onClick={onAdd} type="button">Add staff member</button>}</div>
    <div className="admin-users-table" role="table" aria-label="Users with access">
      <div className="admin-users-table__head" role="row"><span role="columnheader">Name</span><span role="columnheader">Role</span><span role="columnheader">Scope</span><span role="columnheader">Status</span></div>
      {members.length === 0 ? <EmptyState title="No users found" description="People with an active Team profile will appear here." /> : members.map((member) => <button className="admin-user-row" key={member.id} onClick={() => onSelect(member.id)} role="row" type="button">
        <span><strong>{member.name}</strong><small>{member.email}</small></span>
        <span>{member.title}</span>
        <span>{member.tower}{member.cluster && member.cluster !== "Organization not configured" ? ` · ${member.cluster}` : ""}</span>
        <span className={member.active ? "admin-user-status admin-user-status--active" : "admin-user-status"}>{member.active ? "Active" : "Inactive"}</span>
      </button>)}
    </div>
  </section>;
}

function StaffAccessDrawer({ member, onClose }: { member?: FixtureTeamMember; onClose: () => void }) {
  if (!member) return null;
  return <DetailDrawer eyebrow="User access" title={member.name} subtitle={member.email} onClose={onClose}>
    <div className="admin-user-detail">
      <div><span>Role</span><strong>{member.title}</strong></div>
      <div><span>Access scope</span><strong>{member.tower}{member.cluster && member.cluster !== "Organization not configured" ? ` · ${member.cluster}` : ""}</strong></div>
      <div><span>Status</span><strong className={member.active ? "admin-user-status--active" : ""}>{member.active ? "Active" : "Inactive"}</strong></div>
      <div><span>Operating model</span><strong>{member.operatingModel.replaceAll("_", " ")}</strong></div>
      <div><span>Effective from</span><strong>{member.effectiveFrom ?? "Not configured"}</strong></div>
      {member.reportsToOrgNodeId && <div><span>Reports to</span><strong>Configured in Team</strong></div>}
    </div>
  </DetailDrawer>;
}

function AdminDataOverview() {
  const { prototypeMode } = useWorkflow();
  type LivePortfolioRecord = Parameters<typeof portfolioClientToFixtureClient>[0];
  type LiveCounts = { taxpayers: number; people: number; openAudits: number };
  const [liveCounts, setLiveCounts] = useState<LiveCounts | null>(null);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    Promise.all([fetch("/api/portfolio").then((response) => response.json()), fetch("/api/team").then((response) => response.json())])
      .then(([portfolio, team]) => {
        if (cancelled) return;
        const liveClients: FixtureClient[] = Array.isArray(portfolio.data) ? (portfolio.data as LivePortfolioRecord[]).map((client) => portfolioClientToFixtureClient(client)) : [];
        setLiveCounts({
          taxpayers: liveClients.length,
          people: Array.isArray(team.data) ? team.data.length : 0,
          openAudits: liveClients.reduce((total, client) => total + (client.entities[0]?.profile.auditExposures.filter((audit) => audit.status !== "Closed").length ?? 0), 0),
        });
      })
      .catch(() => {
        if (!cancelled) setLiveCounts({ taxpayers: 0, people: 0, openAudits: 0 });
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  const dataSets = prototypeMode
    ? (() => {
      const openWork = fixtureWork.filter((item) => item.status !== "GREEN").length;
      const openAudits = fixtureClients.reduce((total, client) => total + (client.entities[0]?.profile.auditExposures.filter((item) => item.status !== "Closed").length ?? 0), 0);
      return [
        { label: "Taxpayers", value: fixtureClients.length, href: "/app/clients", detail: "Client Registry" },
        { label: "People", value: fixtureOrgDirectoryMembers.length, href: "/app/team", detail: "Team roster" },
        { label: "Open work", value: openWork, href: "/app/work", detail: "Generated work projection" },
        { label: "Calendar items", value: fixtureCalendar.length, href: "/app/work", detail: "Due and service projection" },
        { label: "Specialist cases", value: fixtureSpecialistCases.length, href: "/app/team", detail: "Tax Team context" },
        { label: "Open audit years", value: openAudits, href: "/app/clients", detail: "Standing client context" },
      ];
    })()
    : [
      { label: "Taxpayers", value: liveCounts?.taxpayers ?? "—", href: "/app/clients", detail: "Live Client Registry" },
      { label: "People", value: liveCounts?.people ?? "—", href: "/app/team", detail: "Live Team records" },
      { label: "Open work", value: "—", href: "/app/work", detail: "No governed work records" },
      { label: "Calendar items", value: "—", href: "/app/work", detail: "No released calendar" },
      { label: "Specialist cases", value: "—", href: "/app/team", detail: "Not persisted" },
      { label: "Open audit years", value: liveCounts?.openAudits ?? "—", href: "/app/clients", detail: "Standing client context" },
    ];

  return <section className="panel admin-data-panel" aria-labelledby="admin-data-title">
    <SectionHeading detail="Read-only cross-module picture for the Super Admin lens." title="All A&T data" />
    <div className="admin-data-grid" id="admin-data-title">{dataSets.map((item) => <Link className="admin-data-row" href={item.href} key={item.label}><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{item.value}</b><span aria-hidden="true">→</span></Link>)}</div>
    <p className="admin-placeholder-note">This is a consolidated view, not a second source of truth. Open a module to act on its governed records.</p>
  </section>;
}

function AuditTrailOverview() {
  return <section className="panel admin-placeholder-panel" aria-labelledby="audit-trail-title">
    <SectionHeading title="Audit trail" />
    <EmptyState title="History is being consolidated" description="The audit trail will show who changed what, when, why, and under which authority. Record history remains append-only and is shown on the affected record." />
    <p className="admin-placeholder-note" id="audit-trail-title">The shared audit-event foundation is in place; module commands will append events as their governed write paths are implemented.</p>
  </section>;
}

function AdminPlaceholder({ title, description }: { title: string; description: string }) {
  return <section className="panel admin-placeholder-panel" aria-labelledby="admin-placeholder-title">
    <SectionHeading title={title} />
    <EmptyState title="Restricted administration surface" description={description} />
    <p className="admin-placeholder-note" id="admin-placeholder-title">No production mutation is exposed from this prototype view.</p>
  </section>;
}

function PrototypeDataSettings() {
  const { prototypeMode } = useWorkflow();
  const [feedback, setFeedback] = useState<string | null>(null);

  function removeSeedData() {
    const confirmed = window.confirm("Remove browser-local prototype data and restore the sanitized baseline? This does not delete Supabase records or audit history.");
    if (!confirmed) return;
    const result = clearPrototypeSeedData(window.localStorage, window.sessionStorage);
    setFeedback(`Removed ${result.local + result.session} local prototype record${result.local + result.session === 1 ? "" : "s"}. Reloading the sanitized baseline.`);
    window.setTimeout(() => window.location.reload(), 250);
  }

  return <section className="panel admin-settings-panel" aria-labelledby="prototype-settings-title">
    <SectionHeading detail="Calibration controls for this browser only." title="Settings" />
    <div className="admin-settings-row" id="prototype-settings-title">
      <div>
        <strong>Remove seed data</strong>
        <p>Clears local prototype edits, drafts, access-view changes, roster changes, and reference proposals. The built-in sanitized baseline remains available.</p>
      </div>
      {prototypeMode ? <button className="button button--quiet" onClick={removeSeedData} type="button">Remove seed data</button> : <span className="admin-placeholder-note">Unavailable outside sanitized calibration mode.</span>}
    </div>
    <p className="admin-placeholder-note">This does not delete Supabase records, migrations, source-backed history, or audit events. Production data removal is not available from the browser.</p>
    {feedback && <p aria-live="polite" className="inline-feedback">{feedback}</p>}
  </section>;
}
