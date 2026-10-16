"use client";

import { useMemo, useState } from "react";

import { fixtureClock, type FixtureOperatingModel, type FixtureTeamMember } from "@/lib/fixtures";
import { careerServiceLevelLabels, careerServiceLevelTitle, reportingManagerLevelFor, type CareerServiceLevel, type TeamMemberLoad } from "@/lib/domain/team";
import { fixtureOrganizationScopes } from "@/lib/domain/organization-catalog";

export type TeamRosterDraft = {
  id: string;
  name: string;
  title: string;
  role: FixtureTeamMember["role"];
  tower: FixtureTeamMember["tower"];
  cluster: string;
  organizationUnitId: string | null;
  operatingModel: FixtureOperatingModel;
  careerServiceLevel: CareerServiceLevel;
  reportsToOrgNodeId: string | null;
  reportingLineException: boolean;
  reportingLineExceptionReason: string;
  active: boolean;
  effectiveFrom: string;
  remarks: string;
};

type TeamRosterEditorProps = {
  members: readonly FixtureTeamMember[];
  clusters?: readonly string[];
  clusterTowers?: Readonly<Record<string, FixtureTeamMember["tower"]>>;
  load: readonly TeamMemberLoad[];
  editingMemberId: string | null;
  initialActive?: boolean;
  deactivationIntent?: boolean;
  onClose: () => void;
  onSave: (draft: TeamRosterDraft) => string | undefined | Promise<string | undefined>;
};

const defaultClusters = [...fixtureOrganizationScopes.map((scope) => scope.cluster), "Tax Control"] as const;
function isCareerLevel(value: string | undefined): value is CareerServiceLevel {
  return Boolean(value && value in careerServiceLevelLabels);
}

function towerForCluster(cluster: string): FixtureTeamMember["tower"] {
  const scope = fixtureOrganizationScopes.find((item) => item.cluster === cluster);
  if (scope) return scope.tower;
  return "All A&T";
}

function reportingOptions(members: readonly FixtureTeamMember[], editingMemberId: string | null, level: CareerServiceLevel): FixtureTeamMember[] {
  const targetLevel = reportingManagerLevelFor(level);
  const eligible = members.filter((member) => member.id !== editingMemberId && member.active);
  return targetLevel ? eligible.filter((member) => member.careerServiceLevel === targetLevel) : eligible;
}

function defaultDraft(members: readonly FixtureTeamMember[], editingMemberId: string | null, clusters: readonly string[]): TeamRosterDraft {
  const member = members.find((item) => item.id === editingMemberId);
  const careerServiceLevel = isCareerLevel(member?.careerServiceLevel) ? member!.careerServiceLevel as CareerServiceLevel : "2.1";
  const reports = member?.reportingLineExceptionReason ? members.filter((item) => item.id !== editingMemberId && item.active) : reportingOptions(members, editingMemberId, careerServiceLevel);
  const currentManager = member?.reportsToOrgNodeId ? members.find((item) => item.id === member.reportsToOrgNodeId) : undefined;
  const manager = currentManager && reports.some((item) => item.id === currentManager.id) ? currentManager : reports[0];
  return {
    id: member?.id ?? "",
    name: member?.name ?? "",
    title: member?.title ?? careerServiceLevelTitle(careerServiceLevel),
    role: member?.role ?? "Team Member",
    tower: member?.tower ?? "Tower A",
    cluster: member?.cluster ?? clusters[0] ?? "",
    organizationUnitId: member?.organizationUnitId ?? null,
    operatingModel: member?.operatingModel ?? "ENGAGEMENT_AGILE",
    careerServiceLevel,
    reportsToOrgNodeId: manager?.id ?? null,
    reportingLineException: Boolean(member?.reportingLineExceptionReason),
    reportingLineExceptionReason: member?.reportingLineExceptionReason ?? "",
    active: member?.active ?? true,
    effectiveFrom: member?.effectiveFrom ?? fixtureClock.today,
    remarks: member?.remarks ?? "",
  };
}

export function TeamRosterEditor({ members, clusters = defaultClusters, clusterTowers = {}, load, editingMemberId, initialActive, deactivationIntent = false, onClose, onSave }: TeamRosterEditorProps) {
  const [draft, setDraft] = useState<TeamRosterDraft>(() => ({ ...defaultDraft(members, editingMemberId, clusters), ...(initialActive === undefined ? {} : { active: initialActive }) }));
  const [error, setError] = useState("");
  const currentLoad = load.find((member) => member.id === editingMemberId);
  const reports = useMemo(() => draft.reportingLineException ? members.filter((member) => member.id !== editingMemberId && member.active) : reportingOptions(members, editingMemberId, draft.careerServiceLevel), [draft.careerServiceLevel, draft.reportingLineException, editingMemberId, members]);

  function update<K extends keyof TeamRosterDraft>(key: K, value: TeamRosterDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateReportingException(enabled: boolean) {
    const standardReports = reportingOptions(members, editingMemberId, draft.careerServiceLevel);
    setDraft((current) => ({
      ...current,
      reportingLineException: enabled,
      reportingLineExceptionReason: enabled ? current.reportingLineExceptionReason : "",
      reportsToOrgNodeId: enabled || standardReports.some((member) => member.id === current.reportsToOrgNodeId) ? current.reportsToOrgNodeId : standardReports[0]?.id ?? null,
    }));
    setError("");
  }

  function updateOperatingModel(value: FixtureOperatingModel) {
    if (value === "TAX_TEAM") {
      // Specialist work is portfolio-independent, but a Tax Team person may
      // still sit inside the canonical reporting structure. Preserve that
      // tower/cluster context; only the operating model changes.
      setDraft((current) => ({ ...current, operatingModel: value }));
      return;
    }
    setDraft((current) => ({ ...current, operatingModel: value, tower: current.tower === "All A&T" ? "Tower A" : current.tower, cluster: current.cluster === "Tax Control" ? "Cluster A" : current.cluster }));
  }

  function updateCareerLevel(value: CareerServiceLevel) {
    const managers = reportingOptions(members, editingMemberId, value);
    setDraft((current) => ({
      ...current,
      careerServiceLevel: value,
      reportsToOrgNodeId: current.reportingLineException || managers.some((member) => member.id === current.reportsToOrgNodeId) ? current.reportsToOrgNodeId : managers[0]?.id ?? null,
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Enter a person name before saving the roster change.");
      return;
    }
    if (!draft.effectiveFrom) {
      setError("Add the effective date so the roster change is explainable.");
      return;
    }
    const result = await onSave({ ...draft, name: draft.name.trim(), title: careerServiceLevelTitle(draft.careerServiceLevel) });
    if (result) setError(result);
  }

  const isNew = !editingMemberId;
  const hasPortfolio = (currentLoad?.assignedClients ?? 0) > 0;
  const hasCases = (currentLoad?.activeSpecialistCases ?? 0) > 0;

  return (
    <form aria-label={isNew ? "Add employee" : `Edit ${draft.name || "team member"}`} className="team-editor team-editor--drawer" data-usage-form="team_member_setup" onSubmit={submit}>
      <div className="team-editor__grid">
          <label className="form-field"><span>Name</span><input autoComplete="off" onChange={(event) => update("name", event.target.value)} value={draft.name} /></label>
          <label className="form-field"><span>Career level</span><select onChange={(event) => updateCareerLevel(event.target.value as CareerServiceLevel)} value={draft.careerServiceLevel}>{Object.entries(careerServiceLevelLabels).map(([level, label]) => <option key={level} value={level}>{level} · {label}</option>)}</select><small className="form-field__hint">Sets the standard reporting ladder; it does not grant access or approval authority.</small></label>
          <label className="form-field"><span>Operating model</span><select onChange={(event) => updateOperatingModel(event.target.value as FixtureOperatingModel)} value={draft.operatingModel}><option value="ENGAGEMENT_AGILE">Engagement team · agile</option><option value="ENGAGEMENT_DEDICATED">Engagement team · dedicated</option><option value="TAX_TEAM">Tax team</option></select></label>
          <label className="form-field"><span>Effective from</span><input onChange={(event) => update("effectiveFrom", event.target.value)} type="date" value={draft.effectiveFrom} /></label>
          <label className="form-field"><span>Cluster</span><select disabled={draft.operatingModel === "TAX_TEAM"} onChange={(event) => { const cluster = event.target.value; setDraft((current) => ({ ...current, cluster, tower: clusterTowers[cluster] ?? towerForCluster(cluster) })); }} value={draft.cluster}>{clusters.filter((cluster) => draft.operatingModel === "TAX_TEAM" ? cluster === "Tax Control" : cluster !== "Tax Control").map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}</select></label>
          <label className="form-field"><span>Reports to</span><select onChange={(event) => update("reportsToOrgNodeId", event.target.value || null)} required={reports.length > 0 && !draft.reportingLineException} value={draft.reportsToOrgNodeId ?? ""}><option value="">{draft.reportingLineException ? "Top-level / cross-functional" : reports.length > 0 ? "Select next-band manager" : "No eligible next-band manager"}</option>{reports.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>{reportingManagerLevelFor(draft.careerServiceLevel) ? <small className="form-field__hint">Eligible managers are active people in the next career band ({reportingManagerLevelFor(draft.careerServiceLevel)}).</small> : <small className="form-field__hint">No higher career band is required for this level.</small>}</label>
          <label className="form-field"><span>Reporting-line exception</span><span className="form-checkbox"><input checked={draft.reportingLineException} onChange={(event) => updateReportingException(event.target.checked)} type="checkbox" />Use a non-standard manager</span><small className="form-field__hint">Use only when the normal career-level reporting line does not apply. A reason is required and retained in roster history.</small></label>
          {draft.reportingLineException && <label className="form-field team-editor__remarks"><span>Why is the exception needed?</span><textarea onChange={(event) => update("reportingLineExceptionReason", event.target.value)} placeholder="Explain why the standard reporting line cannot be used" required rows={2} value={draft.reportingLineExceptionReason} /></label>}
          <label className="form-field"><span>Roster status</span><select onChange={(event) => update("active", event.target.value === "active")} value={draft.active ? "active" : "inactive"}><option value="active">Active</option><option value="inactive">Inactive / departed</option></select></label>
          <label className="form-field team-editor__remarks"><span>Comments / remarks</span><textarea onChange={(event) => update("remarks", event.target.value)} placeholder="Add context for this roster change (optional)" rows={3} value={draft.remarks} /></label>
      </div>

        {currentLoad && <div className="team-editor__context"><strong>Current operating context</strong><span>{currentLoad.portfolioApplicable ? `${currentLoad.assignedClients} engagement client${currentLoad.assignedClients === 1 ? "" : "s"} · weight ${currentLoad.clientWeight}` : `${currentLoad.activeSpecialistCases} active tax ad hoc${currentLoad.activeSpecialistCases === 1 ? "" : "s"} · ${currentLoad.affectedTaxpayers} affected taxpayer${currentLoad.affectedTaxpayers === 1 ? "" : "s"}`}</span></div>}
        {hasPortfolio && draft.active === false && <p className="team-editor__warning" role="note">This person still has engagement client assignments. Deactivation preserves them; reassign open ownership from Clients before treating the change as complete.</p>}
        {hasCases && draft.active === false && <p className="team-editor__warning" role="note">This person still has tax ad hoc cases. Deactivation preserves case history; resolve current case ownership from the tax-team case surface.</p>}
      {error && <p className="team-editor__error" role="alert">{error}</p>}
      <p className="team-editor__lifecycle-note">People are deactivated rather than deleted so reporting lines, assignments, and change history remain auditable.</p>
      <div className="team-editor__footer"><p className="team-note">Changes are effective-dated. Live changes require authorized Team administration and are audited; prototype changes remain local to this browser.</p><div className="team-editor__actions"><button className="button button--quiet" onClick={onClose} type="button">Cancel</button><button className="button button--primary" type="submit">{deactivationIntent ? "Deactivate and retain history" : "Save roster change"}</button></div></div>
    </form>
  );
}
