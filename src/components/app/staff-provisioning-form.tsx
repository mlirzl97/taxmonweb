"use client";

import { useEffect, useMemo, useState } from "react";

import { careerServiceLevelLabels, type CareerServiceLevel } from "@/lib/domain/team";
import { staffAccessProfileDefinition, staffAccessProfiles, staffScopeKindLabel, type StaffAccessProfile, type StaffScopeKind } from "@/lib/domain/staff-access";

type OrganizationUnit = { id: string; code: string; name: string; unit_kind: "team" | "tower" | "cluster" | "a_and_t" };
type TeamMemberOption = { id: string; name: string; title: string | null; careerServiceLevel: string | null; active: boolean };

const titles = ["Senior Manager · HOD", "Manager · Operations", "Assistant Manager", "Supervisor", "Team Lead", "Senior Associate", "Junior Associate", "Associate", "Intern", "Cross-portfolio Tax Control"];
const operatingModels = [
  ["engagement_agile", "Engagement team · agile"],
  ["engagement_dedicated", "Engagement team · dedicated"],
  ["tax_team", "Tax Team · specialist cases"],
] as const;

function scopeOptions(profile: StaffAccessProfile): readonly StaffScopeKind[] {
  if (profile === "HOD_MASTER_ADMIN") return ["all_a_and_t", "cross_portfolio_tax_control"];
  if (profile === "TEAM_LEAD") return ["team_tower", "cluster"];
  return ["own_assigned_work"];
}

export function StaffProvisioningForm({ canManage }: { canManage: boolean }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessProfile, setAccessProfile] = useState<StaffAccessProfile>("STAFF");
  const [title, setTitle] = useState("Associate");
  const [careerServiceLevel, setCareerServiceLevel] = useState<CareerServiceLevel>("2.1");
  const [operatingModel, setOperatingModel] = useState("engagement_agile");
  const [organizationUnitId, setOrganizationUnitId] = useState("");
  const [scopeKind, setScopeKind] = useState<StaffScopeKind>("own_assigned_work");
  const [scopeOrganizationUnitId, setScopeOrganizationUnitId] = useState("");
  const [reportsToUserId, setReportsToUserId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportingLineExceptionReason, setReportingLineExceptionReason] = useState("");
  const [reason, setReason] = useState("");
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const availableScopes = useMemo(() => scopeOptions(accessProfile), [accessProfile]);
  const profile = staffAccessProfileDefinition(accessProfile);
  const requiresScopeUnit = scopeKind === "team_tower" || scopeKind === "cluster";

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/organization/units", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/team", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([unitPayload, teamPayload]) => {
      if (cancelled) return;
      const nextUnits = Array.isArray(unitPayload.data) ? unitPayload.data as OrganizationUnit[] : [];
      setUnits(nextUnits);
      setOrganizationUnitId((current) => current || nextUnits[0]?.id || "");
      setScopeOrganizationUnitId((current) => current || nextUnits[0]?.id || "");
      setMembers(Array.isArray(teamPayload.data) ? teamPayload.data as TeamMemberOption[] : []);
    }).catch(() => {
      if (!cancelled) setFeedback({ kind: "error", text: "Reference data could not be loaded. Refresh and try again." });
    }).finally(() => {
      if (!cancelled) setLoadingReferenceData(false);
    });
    return () => { cancelled = true; };
  }, [canManage]);

  function selectProfile(next: StaffAccessProfile) {
    const nextDefinition = staffAccessProfileDefinition(next);
    const nextScopes = scopeOptions(next);
    setAccessProfile(next);
    setScopeKind(nextScopes[0]);
    setScopeOrganizationUnitId(nextScopes[0] === "team_tower" || nextScopes[0] === "cluster" ? units[0]?.id ?? "" : "");
    setFeedback(null);
    if (nextDefinition.roleKey === "system_admin") setOperatingModel("engagement_agile");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!canManage) return;
    if (requiresScopeUnit && !scopeOrganizationUnitId) {
      setFeedback({ kind: "error", text: "Select the tower or cluster that this person may manage." });
      return;
    }
    setIsSubmitting(true);
    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        displayName,
        accessProfile,
        title,
        organizationUnitId,
        effectiveFrom,
        careerServiceLevel,
        reportsToUserId: reportsToUserId || null,
        operatingModel,
        reportingLineExceptionReason: reportingLineExceptionReason || null,
        scopeKind,
        scopeOrganizationUnitId: requiresScopeUnit ? scopeOrganizationUnitId : null,
        reason,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { data?: { status?: string }; error?: string; activationSent?: boolean };
    setIsSubmitting(false);
    if (!response.ok) {
      setFeedback({ kind: "error", text: payload.error ?? "Staff account could not be provisioned." });
      return;
    }
    setFeedback({ kind: "success", text: `Pending account created for ${displayName}. The activation notice was sent to the approved work email.` });
    setEmail("");
    setDisplayName("");
    setReason("");
  }

  if (!canManage) return <section className="panel admin-provisioning-panel"><strong>Staff onboarding</strong><p className="admin-placeholder-note">Only an authorized System & User Admin or HOD can provision staff accounts.</p></section>;

  return <section className="panel admin-provisioning-panel" aria-labelledby="staff-provisioning-title">
    <div className="admin-provisioning-panel__header"><div><span className="meta-label">Controlled setup</span><h3 id="staff-provisioning-title">Add staff member</h3><p>Create the staff identity, Team profile, access bundle, and scope in one audited step. The account stays pending until the employee activates it.</p></div><span className="admin-provisioning-status">Pending until activated</span></div>
    {feedback && <div className={feedback.kind === "success" ? "callout callout--success" : "callout callout--error"} role="status">{feedback.text}</div>}
    <form className="admin-provisioning-form" onSubmit={submit}>
      <div className="admin-provisioning-section"><strong>Identity</strong><div className="admin-provisioning-grid"><label className="form-field"><span>Approved work email</span><input autoComplete="off" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label className="form-field"><span>Display name</span><input autoComplete="off" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label></div></div>
      <div className="admin-provisioning-section"><strong>Access and scope</strong><div className="admin-provisioning-grid"><label className="form-field"><span>Access profile</span><select onChange={(event) => selectProfile(event.target.value as StaffAccessProfile)} value={accessProfile}>{staffAccessProfiles.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><small className="form-field__hint">{profile.description}</small></label><label className="form-field"><span>Access scope</span><select onChange={(event) => { const next = event.target.value as StaffScopeKind; setScopeKind(next); setScopeOrganizationUnitId(next === "team_tower" || next === "cluster" ? units[0]?.id ?? "" : ""); }} value={scopeKind}>{availableScopes.map((scope) => <option key={scope} value={scope}>{staffScopeKindLabel(scope)}</option>)}</select></label>{requiresScopeUnit && <label className="form-field"><span>Scope organization unit</span><select onChange={(event) => setScopeOrganizationUnitId(event.target.value)} required value={scopeOrganizationUnitId}><option value="">Select an organization unit</option>{units.filter((unit) => unit.unit_kind === "tower" || unit.unit_kind === "cluster").map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unit_kind}</option>)}</select></label>}</div></div>
      <div className="admin-provisioning-section"><strong>Team profile</strong><div className="admin-provisioning-grid"><label className="form-field"><span>Operating title</span><select onChange={(event) => setTitle(event.target.value)} value={title}>{titles.map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-field"><span>Career service level</span><select onChange={(event) => setCareerServiceLevel(event.target.value as CareerServiceLevel)} value={careerServiceLevel}>{Object.entries(careerServiceLevelLabels).map(([level, label]) => <option key={level} value={level}>{level} · {label}</option>)}</select></label><label className="form-field"><span>Operating model</span><select onChange={(event) => setOperatingModel(event.target.value)} value={operatingModel}>{operatingModels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="form-field"><span>Team organization unit</span><select disabled={loadingReferenceData} onChange={(event) => setOrganizationUnitId(event.target.value)} required value={organizationUnitId}><option value="">{loadingReferenceData ? "Loading units…" : "Select an organization unit"}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · {unit.unit_kind}</option>)}</select></label><label className="form-field"><span>Reports to</span><select onChange={(event) => setReportsToUserId(event.target.value)} value={reportsToUserId}><option value="">Top-level / cross-functional</option>{members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}{member.title ? ` · ${member.title}` : ""}</option>)}</select></label><label className="form-field"><span>Effective from</span><input onChange={(event) => setEffectiveFrom(event.target.value)} required type="date" value={effectiveFrom} /></label></div></div>
      <div className="admin-provisioning-section"><strong>Control notes</strong><div className="admin-provisioning-grid"><label className="form-field"><span>Reporting exception reason</span><textarea onChange={(event) => setReportingLineExceptionReason(event.target.value)} placeholder="Only when the standard career-level ladder does not apply" rows={2} value={reportingLineExceptionReason} /></label><label className="form-field"><span>Reason for setup</span><textarea onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit trail" required rows={2} value={reason} /></label></div></div>
      <div className="admin-provisioning-actions"><span className="admin-placeholder-note">No password is created or visible to the administrator.</span><button className="button button--primary" disabled={isSubmitting || loadingReferenceData} type="submit">{isSubmitting ? "Provisioning…" : "Create pending account"}</button></div>
    </form>
  </section>;
}
