"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { TeamRosterEditor, type TeamRosterDraft } from "@/components/app/team-roster-editor";
import { OrgChart } from "@/components/app/org-chart";
import { DetailDrawer, FixturePageFrame, SectionHeading, StatusLabel, scopeLabelForValue } from "@/components/app/workspace-components";
import { accessLevelLabel, accessLevelRank, canPerformTeamAction } from "@/lib/domain/access";
import { buildEditableOrgChartNodes, deriveTeamControlPulses, deriveTeamMemberLoad, deriveTeamSpecialistSummary, deriveTeamTowerSummary, hasCoverageGap, isEngagementOperatingModel, isTaxTeamOperatingModel, operatingModelLabels, overlayOrgChartLoad, reportingManagerLevelFor, teamMemberIdsForPerspective, type OrgChartNode } from "@/lib/domain/team";
import { scopeOptions } from "@/lib/control-tower-state";
import { fixtureClients, fixtureOrgChartNodes, fixtureOrgDirectoryMembers, fixtureSpecialistCases, fixtureWork, getClientWorkloadWeight, type FixtureClient, type FixtureTeamMember } from "@/lib/fixtures";
import { adaptLiveTeamMember } from "@/lib/domain/live-team-adapter";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { adaptLiveGeneratedWork } from "@/lib/domain/live-work-adapter";
import { useWorkflow } from "@/lib/workflow-state";

type AssignmentLens = "all" | "engagement" | "tax-team";
type TeamView = "overview" | "organization" | "directory" | "coverage";
type RosterEvent = { id: string; memberId: string; action: "Added" | "Updated" | "Deactivated"; summary: string; effectiveFrom: string; remarks?: string };

const rosterStorageKey = "taxmonweb.team.roster.v2";
const rosterEventStorageKey = "taxmonweb.team.roster-events.v2";
const teamViews: ReadonlyArray<{ id: TeamView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "organization", label: "Organization" },
  { id: "directory", label: "Directory" },
  { id: "coverage", label: "Coverage" },
];

function isTeamView(value: string | null): value is TeamView {
  return Boolean(value && teamViews.some((view) => view.id === value));
}

export default function TeamPage() {
  const { accessMatrix, canAccessModule, getModuleAccess, isClientVisible, isWorkVisible, prototypeMode, workPerspective } = useWorkflow();
  const canViewClients = canAccessModule("clients");
  const teamAccessLevel = getModuleAccess("team");
  const canAddPerson = prototypeMode && canPerformTeamAction(workPerspective, "ADD_PERSON", accessMatrix);
  const canEditStructure = canPerformTeamAction(workPerspective, "EDIT_STRUCTURE", accessMatrix);
  const canDeactivatePerson = canPerformTeamAction(workPerspective, "DEACTIVATE_PERSON", accessMatrix);
  const canManageAssignments = canPerformTeamAction(workPerspective, "MANAGE_ASSIGNMENTS", accessMatrix) && canViewClients;
  const [assignmentLens, setAssignmentLens] = useState<AssignmentLens>("all");
  const [activeView, setActiveView] = useState<TeamView>("overview");
  const [viewHydrated, setViewHydrated] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<FixtureTeamMember[]>(() => prototypeMode ? [...fixtureOrgDirectoryMembers] : []);
  const [liveTeamLoading, setLiveTeamLoading] = useState(() => !prototypeMode);
  const [liveTeamError, setLiveTeamError] = useState<string | null>(null);
  const [liveClients, setLiveClients] = useState<FixtureClient[]>([]);
  const [liveWork, setLiveWork] = useState<typeof fixtureWork>([]);
  const [rosterEvents, setRosterEvents] = useState<RosterEvent[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deactivationIntent, setDeactivationIntent] = useState(false);
  const [rosterHydrated, setRosterHydrated] = useState(() => !prototypeMode);
  const roleScopedPerspective = workPerspective === "PREPARER" || workPerspective === "CHECKER" || workPerspective === "REVIEWER";
  const canViewLeadershipRollups = ["TOWER_LEADER", "CLUSTER_LEADER", "MASTER_ADMIN", "SUPER_ADMIN"].includes(workPerspective) && accessLevelRank(teamAccessLevel) >= accessLevelRank("ACT");
  const canViewSpecialistCases = ["TAX_CONTROL", "MASTER_ADMIN", "SUPER_ADMIN"].includes(workPerspective) && canAccessModule("tax_team");
  const canViewChangeHistory = canPerformTeamAction(workPerspective, "EDIT_STRUCTURE", accessMatrix);

  useEffect(() => {
    if (!prototypeMode) return;
    try {
      const storedRoster = window.localStorage.getItem(rosterStorageKey);
      const parsedRoster = storedRoster ? JSON.parse(storedRoster) as FixtureTeamMember[] : null;
      // Hydrate the browser-local prototype only after SSR; this is intentionally a state sync from external storage.
      if (Array.isArray(parsedRoster) && parsedRoster.every((member) => typeof member.id === "string" && typeof member.name === "string" && typeof member.operatingModel === "string")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTeamMembers(parsedRoster);
      }
      const storedEvents = window.localStorage.getItem(rosterEventStorageKey);
      const parsedEvents = storedEvents ? JSON.parse(storedEvents) as RosterEvent[] : null;
      if (Array.isArray(parsedEvents)) {
        setRosterEvents(parsedEvents);
      }
    } catch {
      // Keep the approved sanitized fixture roster if local prototype state is malformed.
    }
    setRosterHydrated(true);
  }, [prototypeMode]);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/team", { headers: { accept: "application/json" } }),
      fetch("/api/portfolio", { headers: { accept: "application/json" } }),
      fetch("/api/work", { headers: { accept: "application/json" }, cache: "no-store" }),
    ])
      .then(async ([teamResponse, portfolioResponse, workResponse]) => {
        const teamPayload = await teamResponse.json() as { data?: Parameters<typeof adaptLiveTeamMember>[0][]; error?: string };
        const portfolioPayload = await portfolioResponse.json() as { data?: Parameters<typeof portfolioClientToFixtureClient>[0][]; error?: string };
        const workPayload = await workResponse.json() as { data?: Parameters<typeof adaptLiveGeneratedWork>[0][]; error?: string };
        if (!teamResponse.ok) throw new Error(teamPayload.error ?? "Unable to load Team.");
        if (!portfolioResponse.ok) throw new Error(portfolioPayload.error ?? "Unable to load the assigned portfolio.");
        if (!workResponse.ok) throw new Error(workPayload.error ?? "Unable to load generated work.");
        if (!cancelled) {
          setTeamMembers((teamPayload.data ?? []).map(adaptLiveTeamMember));
          setLiveClients((portfolioPayload.data ?? []).map(portfolioClientToFixtureClient));
          setLiveWork((workPayload.data ?? []).map((item) => adaptLiveGeneratedWork(item)));
          setLiveTeamError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLiveTeamError(error instanceof Error ? error.message : "Unable to load Team.");
      })
      .finally(() => {
        if (!cancelled) setLiveTeamLoading(false);
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  useEffect(() => {
    const syncViewFromUrl = () => {
      const view = new URLSearchParams(window.location.search).get("view");
      if (isTeamView(view)) setActiveView(view);
      setViewHydrated(true);
    };
    window.addEventListener("popstate", syncViewFromUrl);
    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, []);

  useEffect(() => {
    if (!prototypeMode || !rosterHydrated) return;
    window.localStorage.setItem(rosterStorageKey, JSON.stringify(teamMembers));
    window.localStorage.setItem(rosterEventStorageKey, JSON.stringify(rosterEvents));
  }, [prototypeMode, rosterEvents, rosterHydrated, teamMembers]);

  const perspectiveClients = useMemo(() => prototypeMode ? (canViewClients ? fixtureClients.filter(isClientVisible) : []) : liveClients, [canViewClients, isClientVisible, liveClients, prototypeMode]);
  const perspectiveWork = useMemo(() => prototypeMode ? fixtureWork.filter(isWorkVisible) : liveWork, [isWorkVisible, liveWork, prototypeMode]);
  const load = useMemo(() => deriveTeamMemberLoad(teamMembers, perspectiveClients, perspectiveWork, prototypeMode ? fixtureSpecialistCases : []), [perspectiveClients, perspectiveWork, prototypeMode, teamMembers]);
  const summaries = useMemo(() => deriveTeamTowerSummary(load, perspectiveClients, perspectiveWork), [load, perspectiveClients, perspectiveWork]);
  const specialistSummary = useMemo(() => canViewSpecialistCases && prototypeMode ? deriveTeamSpecialistSummary(load, fixtureSpecialistCases) : { memberCount: 0, caseCount: 0, affectedTaxpayerCount: 0, attentionCount: 0 }, [canViewSpecialistCases, load, prototypeMode]);
  const controlPulses = useMemo(() => canViewLeadershipRollups ? deriveTeamControlPulses(perspectiveWork) : [], [canViewLeadershipRollups, perspectiveWork]);
  const orgChartSourceNodes = useMemo(() => {
    if (prototypeMode) return buildEditableOrgChartNodes(teamMembers, fixtureOrgChartNodes);
    // A live org chart may only project an effective service level from the
    // authenticated team profile. Do not invent hierarchy metadata for users
    // who have not completed Team setup yet.
    return buildEditableOrgChartNodes(teamMembers.filter((member) => Boolean(member.careerServiceLevel)), []);
  }, [prototypeMode, teamMembers]);
  const perspectiveMemberIds = useMemo(() => teamMemberIdsForPerspective(teamMembers, perspectiveClients, workPerspective), [perspectiveClients, teamMembers, workPerspective]);
  const orgChartNodes = useMemo(() => {
    const scopedNodes = overlayOrgChartLoad(orgChartSourceNodes, load).filter((node) => perspectiveMemberIds.has(node.id));
    if (canViewLeadershipRollups && canViewSpecialistCases) return scopedNodes;
    return scopedNodes.map((node) => ({ ...node, assignedClients: canViewLeadershipRollups ? node.assignedClients : undefined, clientWeight: canViewLeadershipRollups ? node.clientWeight : undefined, activeWork: canViewLeadershipRollups ? node.activeWork : undefined, coverageGaps: canViewLeadershipRollups ? node.coverageGaps : undefined, specialistCaseCount: canViewSpecialistCases ? node.specialistCaseCount : undefined, affectedTaxpayers: canViewSpecialistCases ? node.affectedTaxpayers : undefined, specialistAttention: canViewSpecialistCases ? node.specialistAttention : undefined, workloadPercent: canViewLeadershipRollups ? node.workloadPercent : 0 }));
  }, [canViewLeadershipRollups, canViewSpecialistCases, load, orgChartSourceNodes, perspectiveMemberIds]);
  const scopedMembers = load.filter((member) => perspectiveMemberIds.has(member.id));
  const visibleMembers = scopedMembers.filter((member) => assignmentLens === "all"
    || (assignmentLens === "engagement" && isEngagementOperatingModel(member.operatingModel))
    || (assignmentLens === "tax-team" && isTaxTeamOperatingModel(member.operatingModel)));
  const visibleClients = perspectiveClients;
  const visibleClientIds = new Set(visibleClients.map((client) => client.id));
  const visibleSpecialistCases = canViewSpecialistCases && prototypeMode ? fixtureSpecialistCases.filter((item) => visibleClientIds.has(item.taxpayerClientId)) : [];
  const selected = load.find((member) => member.id === selectedMemberId && perspectiveMemberIds.has(member.id));
  const selectedOrgNode = orgChartNodes.find((node) => node.id === selectedMemberId);
  const totalWeight = visibleClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0);
  const coverageGaps = visibleClients.filter(hasCoverageGap).length;
  const specialistAffectedTaxpayers = new Set(visibleSpecialistCases.map((item) => item.taxpayerClientId)).size;
  const specialistAttention = visibleSpecialistCases.filter((item) => ["AMBER", "RED", "UNRESOLVED"].includes(item.attention)).length;

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    // The URL is the shareable source for the selected Team submodule. Read it
    // before the URL-sync effect can normalize the initial overview state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveView(isTeamView(view) ? view : "overview");
    setViewHydrated(true);
  }, []);

  useEffect(() => {
    if (!viewHydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (activeView === "overview") params.delete("view");
    else params.set("view", activeView);
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [activeView, viewHydrated]);

  function openEditor(memberId: string | null, intent: "edit" | "deactivate" = "edit") {
    setEditingMemberId(memberId);
    setSelectedMemberId(memberId);
    setDeactivationIntent(intent === "deactivate");
    setEditorOpen(true);
  }

  function wouldCreateCycle(memberId: string, parentId: string | null): boolean {
    let cursor = parentId;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor)) {
      if (cursor === memberId) return true;
      visited.add(cursor);
      cursor = teamMembers.find((member) => member.id === cursor)?.reportsToOrgNodeId ?? null;
    }
    return false;
  }

  async function saveRosterChange(draft: TeamRosterDraft): Promise<string | undefined> {
    const existing = teamMembers.find((member) => member.id === draft.id);
    const existingLoad = existing ? load.find((member) => member.id === existing.id) : undefined;
    const hasCurrentWork = (existingLoad?.assignedClients ?? 0) > 0 || (existingLoad?.activeSpecialistCases ?? 0) > 0;
    if (existing && existing.operatingModel !== draft.operatingModel && hasCurrentWork) return "Resolve this person’s current engagement clients or tax ad hoc cases before changing the operating model. The Team editor will not silently change workload semantics.";
    const requiredManagerLevel = reportingManagerLevelFor(draft.careerServiceLevel);
    const manager = draft.reportsToOrgNodeId ? teamMembers.find((member) => member.id === draft.reportsToOrgNodeId) : undefined;
    const standardReportingLine = !requiredManagerLevel || manager?.careerServiceLevel === requiredManagerLevel;
    if (!standardReportingLine && !draft.reportingLineExceptionReason.trim()) return `${draft.careerServiceLevel} people must report to a ${requiredManagerLevel} manager or provide a reporting-line exception reason.`;
    if (existing && wouldCreateCycle(existing.id, draft.reportsToOrgNodeId)) return "That reporting line would create a cycle. Choose a manager outside this person’s downline.";

    if (!prototypeMode) {
      if (!existing) return "Create the user in Admin first, then configure the Team profile here.";
      if (!draft.organizationUnitId) return "The live Team profile needs an organizational unit before it can be saved.";
      try {
        const response = await fetch("/api/team", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ action: "save", payload: {
            userId: existing.id,
            roleKey: roleKeyFor(draft.role),
            title: draft.title,
            organizationUnitId: draft.organizationUnitId,
            effectiveFrom: draft.effectiveFrom,
            active: draft.active,
            careerServiceLevel: draft.careerServiceLevel,
            reportsToUserId: draft.reportsToOrgNodeId,
            operatingModel: operatingModelForLive(draft.operatingModel),
            reportingLineExceptionReason: standardReportingLine ? null : draft.reportingLineExceptionReason.trim(),
          } }),
        });
        const payload = await response.json() as { error?: string };
        if (!response.ok) return payload.error ?? "Unable to save the Team profile.";
      } catch {
        return "Unable to reach the Team profile command.";
      }
    }

    const id = existing?.id ?? makeLocalMemberId(draft.name, teamMembers);
    const assignmentAliases = existing
      ? [...(existing.assignmentAliases ?? []), ...(existing.name !== draft.name ? [existing.name] : [])].filter((name, index, all) => all.indexOf(name) === index)
      : [];
    const nextMember: FixtureTeamMember = {
      id,
      name: draft.name,
      title: draft.title,
      role: draft.role,
      tower: draft.tower,
      cluster: draft.cluster,
      active: draft.active,
      email: existing?.email ?? `${id}@example.invalid`,
      organizationUnitId: draft.organizationUnitId,
      operatingModel: draft.operatingModel,
      ...(draft.operatingModel === "TAX_TEAM" ? { specialistTeam: "Tax Team" as const } : {}),
      careerServiceLevel: draft.careerServiceLevel,
      reportsToOrgNodeId: draft.reportsToOrgNodeId,
      ...(standardReportingLine ? {} : { reportingLineExceptionReason: draft.reportingLineExceptionReason.trim() }),
      assignmentAliases,
      effectiveFrom: draft.effectiveFrom,
      remarks: draft.remarks.trim() || undefined,
    };
    setTeamMembers(existing ? teamMembers.map((member) => member.id === id ? nextMember : member) : [...teamMembers, nextMember]);
    const action: RosterEvent["action"] = existing ? (draft.active ? "Updated" : "Deactivated") : "Added";
    const summary = `${existing?.name ?? draft.name} · ${draft.title} · ${draft.operatingModel === "TAX_TEAM" ? "Tax Team" : draft.cluster}`;
    if (prototypeMode) setRosterEvents((events) => [...events, { id: `${action.toLowerCase()}-${id}-${draft.effectiveFrom}-${events.length}`, memberId: id, action, summary, effectiveFrom: draft.effectiveFrom, remarks: draft.remarks.trim() || undefined }]);
    setSelectedMemberId(id);
    setEditorOpen(false);
    return undefined;
  }

  function resetPrototypeRoster() {
    if (!window.confirm("Reset local Team roster edits and restore the approved fixture roster?")) return;
    setTeamMembers([...fixtureOrgDirectoryMembers]);
    setRosterEvents([]);
    setEditorOpen(false);
    setEditingMemberId(null);
    setDeactivationIntent(false);
  }

  return (
    <FixturePageFrame>
      <header className="module-header">
        <div><h1>Team</h1></div>
        <div className="module-header__right"><div className="module-actions">{canAddPerson && <button className="button button--primary button--small" onClick={() => openEditor(null)} type="button">Add employee</button>}</div></div>
      </header>

      <nav aria-label="Team views" className="tower-tabs module-tabs team-module-tabs" data-testid="team-module-tabs">
        {teamViews.map((view) => <button aria-pressed={activeView === view.id} className={activeView === view.id ? "tower-tab tower-tab--active" : "tower-tab"} key={view.id} onClick={() => setActiveView(view.id)} type="button"><span>{view.label}</span></button>)}
      </nav>
      {!prototypeMode && liveTeamLoading && <p className="team-note" role="status">Loading current people…</p>}
      {!prototypeMode && liveTeamError && <p className="team-note" role="alert">{liveTeamError}</p>}

      {activeView === "overview" && <section aria-labelledby="team-overview-title" className="team-overview" id="team-overview">
        <SectionHeading title="Overview" />
        {roleScopedPerspective ? <>
        <div className="team-signal-grid">
          <Signal label="People in role scope" value={String(scopedMembers.filter((member) => member.active).length)} detail="Assigned people and reporting context" />
          <Signal label="Assigned work" value={String(perspectiveWork.length)} detail="Open My Work for work-level detail" />
          <Signal label="Structure access" value="View" detail="People and reporting context only" />
        </div>
        <div className="team-digest-grid">
          <DigestItem label="Assigned work" value={String(perspectiveWork.length)} detail="Client ownership and workflow action stay in the assigned work surface." action={<Link className="button button--quiet button--small" href="/app/work">Open My Work</Link>} />
          <DigestItem label="Roster changes" value="—" detail="People and structure are read-only for this access view." action={<span className="team-note">View only</span>} />
          <DigestItem label="Leadership signals" value="Restricted" detail="Cluster and cross-portfolio workload roll-ups are reserved for leaders." action={<span className="team-note">Leader view</span>} />
        </div>
        </> : !canViewLeadershipRollups ? <>
        <div className="team-signal-grid">
          <Signal label="People in scope" value={String(scopedMembers.filter((member) => member.active).length)} detail="Canonical organization view" />
          <Signal label="Team access" value={accessLevelLabel(teamAccessLevel)} detail="Operational detail is governed separately" />
          <Signal label="Tax ad hocs" value={String(visibleSpecialistCases.length)} detail={canViewSpecialistCases ? "Tax team signal" : "Not in this access view"} />
        </div>
        <div className="team-digest-grid">
          <DigestItem label="Engagement workload" value="Restricted" detail="Agile and dedicated engagement load remains in the appropriate delivery-leader view." action={<span className="team-note">Restricted</span>} />
          <DigestItem label="Tax team work" value={canViewSpecialistCases ? String(visibleSpecialistCases.length) : "Restricted"} detail={canViewSpecialistCases ? "Tax ad hoc cases remain separate from engagement ownership." : "Tax-team case signals are restricted."} action={canViewSpecialistCases ? <button className="button button--quiet button--small" onClick={() => { setActiveView("directory"); setAssignmentLens("tax-team"); }} type="button">View cases</button> : <span className="team-note">Restricted</span>} />
          <DigestItem label="Structure changes" value="View only" detail="Use the governed role capability for people and structure changes." action={<span className="team-note">No edit</span>} />
        </div>
        </> : <>
        <div className="team-signal-grid">
          <Signal label="Active members" value={String(scopedMembers.filter((member) => member.active).length)} detail="Current internal team" />
          <Signal label="Engagement clients" value={String(visibleClients.length)} detail="Agile and dedicated scope" />
          <Signal label="Engagement weight" value={String(totalWeight)} detail="Portfolio metric · engagement only" />
          <Signal label="Coverage gaps" value={String(coverageGaps)} detail="Needs assignment review" tone={coverageGaps > 0 ? "amber" : "green"} />
          <Signal label="Tax ad hocs" value={String(visibleSpecialistCases.length)} detail={`Tax team · ${specialistAffectedTaxpayers} affected taxpayer${specialistAffectedTaxpayers === 1 ? "" : "s"}`} />
          <Signal label="Tax-team attention" value={String(specialistAttention)} detail="Ad hoc case signal" tone={specialistAttention > 0 ? "amber" : "green"} />
        </div>
        <div className="team-digest-grid">
          <DigestItem label="Coverage to review" value={String(coverageGaps)} detail="Engagement coverage gaps are resolved from Clients." action={<Link className="button button--quiet button--small" href="/app/clients">Open Clients</Link>} />
          <DigestItem label="Roster changes" value={String(rosterEvents.length)} detail={rosterEvents.length > 0 ? "Local prototype changes retained with effective dates." : "No local roster changes in this browser."} action={canAddPerson ? <button className="button button--quiet button--small" onClick={() => openEditor(null)} type="button">Add employee</button> : <span className="team-note">View only</span>} />
          <DigestItem label="Tax-team attention" value={String(specialistAttention)} detail="Tax ad hocs are separate from engagement weight." action={<button className="button button--quiet button--small" onClick={() => { setActiveView("directory"); setAssignmentLens("tax-team"); }} type="button">View cases</button>} />
        </div>
        </>}
      </section>}

      {activeView === "overview" && !roleScopedPerspective && <section aria-labelledby="team-control-pulse-title" className="team-control-pulse">
        <SectionHeading title="Race to All Clear" />
        <div className="team-control-pulse__rows">
          {controlPulses.map((pulse) => {
            const scopeId = scopeOptions.find((option) => option.scopeValue === pulse.scope)?.id ?? "all";
            const stateLabel = pulse.state === "ALL_CLEAR" ? "All clear" : pulse.state === "NEEDS_ATTENTION" ? "Needs attention" : "In progress";
            return <Link className="team-control-pulse__row" href={`/app/control-tower?scope=${scopeId}`} key={pulse.scope}>
              <span className="team-control-pulse__name"><strong>{scopeLabelForValue(pulse.scope)}</strong><small>{pulse.clearWork} of {pulse.totalWork} clear</small></span>
              <span aria-label={`${pulse.clearPercent}% clear`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={pulse.clearPercent} className="team-control-pulse__bar" role="progressbar"><span style={{ width: `${pulse.clearPercent}%` }} /></span>
              <span className={`team-control-pulse__state team-control-pulse__state--${pulse.state.toLowerCase()}`}><strong>{stateLabel}</strong><small>{pulse.blockedWork > 0 ? `${pulse.blockedWork} blocked` : `${pulse.attentionWork} needing attention`}</small></span>
              <span aria-hidden="true" className="row-arrow">→</span>
            </Link>;
          })}
        </div>
      </section>}

      {activeView === "organization" && <section aria-labelledby="team-organization-title" className="panel team-panel team-people-panel" id="team-organization">
        <SectionHeading title="Organization" />
        <div className="team-people-toolbar"><div className="team-admin-actions">{canAddPerson && <button className="button button--primary button--small" onClick={() => openEditor(null)} type="button">Add employee</button>}{canEditStructure && selected && !editorOpen && <button className="button button--quiet button--small" onClick={() => openEditor(selected.id)} type="button">Edit selected person</button>}{canManageAssignments && <Link className="button button--quiet button--small" href="/app/clients">Manage client ownership in Clients</Link>}{canEditStructure && rosterEvents.length > 0 && <button className="button button--quiet button--small" onClick={resetPrototypeRoster} type="button">Reset prototype roster</button>}{!canEditStructure && <span className="team-note">This access view is read-only for people and structure.</span>}</div></div>
        <OrgChart nodes={orgChartNodes} onSelect={(node) => setSelectedMemberId(node.id)} />
      </section>}

      {activeView === "directory" && <section aria-labelledby="team-directory-title" className="panel team-panel team-people-panel" id="team-directory">
        <SectionHeading title="Directory" />
        <div className="team-people-toolbar"><div className="team-admin-actions">{canAddPerson && <button className="button button--primary button--small" onClick={() => openEditor(null)} type="button">Add employee</button>}{canEditStructure && selected && !editorOpen && <button className="button button--quiet button--small" onClick={() => openEditor(selected.id)} type="button">Edit selected person</button>}{canManageAssignments && <Link className="button button--quiet button--small" href="/app/clients">Manage client ownership in Clients</Link>}{canEditStructure && rosterEvents.length > 0 && <button className="button button--quiet button--small" onClick={resetPrototypeRoster} type="button">Reset prototype roster</button>}{!canEditStructure && <span className="team-note">This access view is read-only for people and structure.</span>}</div></div>
        <div aria-label="Team directory table" className="team-directory" role="region" tabIndex={0}>
          <div className="team-directory__intro"><strong>{visibleMembers.length} people in view</strong></div>
          <div aria-label="Assignment workload lens" className="team-model-switch" role="group"><button aria-pressed={assignmentLens === "all"} className={assignmentLens === "all" ? "is-active" : ""} onClick={() => setAssignmentLens("all")} type="button">All people</button><button aria-pressed={assignmentLens === "engagement"} className={assignmentLens === "engagement" ? "is-active" : ""} onClick={() => setAssignmentLens("engagement")} type="button">Engagement teams</button><button aria-pressed={assignmentLens === "tax-team"} className={assignmentLens === "tax-team" ? "is-active" : ""} onClick={() => setAssignmentLens("tax-team")} type="button">Tax team</button></div>
          <table><thead><tr><th scope="col">Person</th><th scope="col">Organization</th><th scope="col">Band</th><th scope="col">Operating model</th><th scope="col">Engagement clients</th><th scope="col">Tax ad hocs</th><th scope="col">Signal</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleMembers.map((member) => <tr key={member.id}><td><button className="team-person-button" onClick={() => setSelectedMemberId(member.id)} type="button"><span aria-hidden="true" className="client-avatar">{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.title}</small></span></button></td><td><span className="table-value"><strong>{member.cluster}</strong><small>{member.tower === "All A&T" ? "Cross-portfolio" : "Engagement"}</small></span></td><td><strong>{member.careerServiceLevel ?? "—"}</strong></td><td><span className="table-value"><strong>{operatingModelLabels[member.operatingModel]}</strong><small>{member.role}</small></span></td><td>{!canViewLeadershipRollups ? <span className="team-portfolio-value--na">Scoped to authorized work</span> : member.portfolioApplicable ? <span className="table-value"><strong>{member.assignedClients || "—"}</strong><small>{member.clientWeight > 0 ? `weight ${member.clientWeight}` : "No current assignment"}</small></span> : <span className="team-portfolio-value--na">Not applicable</span>}</td><td>{!canViewSpecialistCases ? <span className="team-portfolio-value--na">Restricted</span> : isTaxTeamOperatingModel(member.operatingModel) ? <span className="table-value"><strong>{member.activeSpecialistCases || "—"}</strong><small>{member.affectedTaxpayers ? `${member.affectedTaxpayers} affected taxpayer${member.affectedTaxpayers === 1 ? "" : "s"}` : "No active ad hoc"}</small></span> : <span className="table-subvalue">—</span>}</td><td>{!canViewLeadershipRollups && !canViewSpecialistCases ? <span className="team-portfolio-value--na">Restricted</span> : isTaxTeamOperatingModel(member.operatingModel) && canViewSpecialistCases ? <span className={member.specialistAttention > 0 ? "attention-open" : "attention-clear"}>{member.specialistAttention > 0 ? `${member.specialistAttention} ad hoc attention` : "No ad hoc attention"}</span> : canViewLeadershipRollups ? <span className={member.coverageGaps > 0 ? "attention-open" : "attention-clear"}>{member.coverageGaps > 0 ? `${member.coverageGaps} coverage gap` : "Covered"}</span> : <span className="team-portfolio-value--na">Use authorized work</span>}</td><td><span className={member.active ? "team-member-status" : "team-member-status team-member-status--inactive"}>{member.active ? "Active" : "Inactive"}</span></td><td><TeamRowActions canDeactivate={canDeactivatePerson} canEdit={canEditStructure} canManageAssignments={canManageAssignments} member={member} onEdit={() => openEditor(member.id)} onSelect={() => setSelectedMemberId(member.id)} onDeactivate={() => openEditor(member.id, "deactivate")} /></td></tr>)}</tbody></table>
          <p className="team-note">Engagement client weight is derived for both agile and dedicated teams. Tax ad hoc work is reported separately and is not converted into engagement weight.</p>
        </div>
      </section>}

      {activeView === "coverage" && <section aria-labelledby="team-workload-title" className="panel panel--table team-panel" id="team-coverage">{!canViewLeadershipRollups ? <><SectionHeading title="Coverage" /><p className="team-note">Leadership roll-ups are restricted for this access view.</p></> : <><SectionHeading title="Coverage" /><div aria-label="Organization coverage" className="team-structure" tabIndex={0}><div className="team-structure__header"><span>Cluster</span><span>Operating model</span><span>Members</span><span>Clients / cases</span><span>Weight / affected</span><span>Attention</span></div>{summaries.map((summary) => <div className="team-structure__row" key={summary.tower}><span><strong>{summary.cluster}</strong><small>Engagement teams</small></span><span>Agile / dedicated</span><span>{summary.members}</span><span>{summary.clients}</span><span>{summary.clientWeight}</span><span className={summary.coverageGaps > 0 ? "attention-open" : "attention-clear"}>{summary.coverageGaps > 0 ? `${summary.coverageGaps} gap` : "Covered"}</span></div>)}<div className="team-structure__row team-structure__row--specialist"><span><strong>Tax team</strong><small>Cross-portfolio ad hoc function</small></span><span>Tax ad hoc</span><span>{specialistSummary.memberCount} active</span><span>{specialistSummary.caseCount} cases</span><span>{specialistSummary.affectedTaxpayerCount} affected</span><span className={specialistSummary.attentionCount > 0 ? "attention-open" : "attention-clear"}>{specialistSummary.attentionCount > 0 ? `${specialistSummary.attentionCount} ad hoc attention` : "No ad hoc attention"}</span></div></div></>}</section>}

      {selected && !editorOpen && <TeamMemberDrawer clients={visibleClients} canDeactivate={canDeactivatePerson} canEdit={canEditStructure} canManageAssignments={canManageAssignments} canViewChangeHistory={canViewChangeHistory} canViewOperationalDetail={canViewLeadershipRollups} changeEvents={canViewChangeHistory ? rosterEvents.filter((event) => event.memberId === selected.id) : []} member={selected} node={selectedOrgNode} onClose={() => setSelectedMemberId(null)} onDeactivate={() => openEditor(selected.id, "deactivate")} onEdit={() => openEditor(selected.id)} specialistCases={prototypeMode && canViewSpecialistCases ? fixtureSpecialistCases.filter((item) => item.assigneeMemberIds.includes(selected.id)) : []} />}
      {editorOpen && <TeamRosterDrawer deactivationIntent={deactivationIntent} editingMemberId={editingMemberId} key={`${editingMemberId ?? "new"}-${deactivationIntent ? "deactivate" : "edit"}`} load={load} members={teamMembers} onClose={() => { setEditorOpen(false); setDeactivationIntent(false); }} onSave={saveRosterChange} />}
    </FixturePageFrame>
  );
}

function roleKeyFor(role: FixtureTeamMember["role"]): "system_admin" | "leader" | "team_member" | "reviewer" {
  if (role === "System Admin") return "system_admin";
  if (role === "HOD / Leader") return "leader";
  if (role === "Reviewer") return "reviewer";
  return "team_member";
}

function operatingModelForLive(model: FixtureTeamMember["operatingModel"]): "engagement_agile" | "engagement_dedicated" | "tax_team" {
  if (model === "ENGAGEMENT_DEDICATED") return "engagement_dedicated";
  if (model === "TAX_TEAM") return "tax_team";
  return "engagement_agile";
}

function makeLocalMemberId(name: string, members: readonly FixtureTeamMember[]): string {
  const base = `local-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team-member"}`;
  let id = base;
  let suffix = 2;
  while (members.some((member) => member.id === id)) id = `${base}-${suffix++}`;
  return id;
}

function Signal({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "amber" | "green" }) {
  return <div className={`team-signal team-signal--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function DigestItem({ label, value, detail, action }: { label: string; value: string; detail: string; action: ReactNode }) {
  return <div className="team-digest-item"><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>{action}</div>;
}

function TeamRowActions({ member, canEdit, canDeactivate, canManageAssignments, onSelect, onEdit, onDeactivate }: { member: ReturnType<typeof deriveTeamMemberLoad>[number]; canEdit: boolean; canDeactivate: boolean; canManageAssignments: boolean; onSelect: () => void; onEdit: () => void; onDeactivate: () => void }) {
  return <div aria-label={`Actions for ${member.name}`} className="team-row-actions">
    <button className="team-row-action" onClick={onSelect} type="button">View</button>
    {canEdit && <button className="team-row-action" onClick={onEdit} type="button">Edit</button>}
    {canDeactivate && member.active && <button className="team-row-action team-row-action--quiet" onClick={onDeactivate} type="button">Retire</button>}
    {canManageAssignments && <Link className="team-row-action team-row-action--link" href="/app/clients">Clients</Link>}
  </div>;
}

function TeamRosterDrawer({ members, load, editingMemberId, deactivationIntent, onClose, onSave }: { members: readonly FixtureTeamMember[]; load: ReturnType<typeof deriveTeamMemberLoad>; editingMemberId: string | null; deactivationIntent: boolean; onClose: () => void; onSave: (draft: TeamRosterDraft) => string | undefined | Promise<string | undefined> }) {
  const member = members.find((item) => item.id === editingMemberId);
  const isNew = !editingMemberId;
  return <DetailDrawer eyebrow="People & structure" onClose={onClose} subtitle={isNew ? "Add a person to the canonical roster." : deactivationIntent ? "Record a departure without deleting the person or their history." : "Update structure without deleting the person or their history."} title={isNew ? "Add employee" : deactivationIntent ? `Deactivate ${member?.name ?? "team member"}` : `Edit ${member?.name ?? "team member"}`}><TeamRosterEditor deactivationIntent={deactivationIntent} editingMemberId={editingMemberId} initialActive={deactivationIntent ? false : undefined} load={load} members={members} onClose={onClose} onSave={onSave} /></DetailDrawer>;
}

function TeamMemberDrawer({ member, clients, node, specialistCases, changeEvents, onClose, onEdit, onDeactivate, canEdit, canDeactivate, canManageAssignments, canViewChangeHistory, canViewOperationalDetail }: { member: ReturnType<typeof deriveTeamMemberLoad>[number]; clients: readonly FixtureClient[]; node?: OrgChartNode; specialistCases: typeof fixtureSpecialistCases; changeEvents: RosterEvent[]; onClose: () => void; onEdit: () => void; onDeactivate: () => void; canEdit: boolean; canDeactivate: boolean; canManageAssignments: boolean; canViewChangeHistory: boolean; canViewOperationalDetail: boolean }) {
  const rag = node?.sourceStatus === "confirmed" ? node.rag : "UNRESOLVED";
  return <DetailDrawer eyebrow="Team member" onClose={onClose} subtitle={`${member.title} · ${member.cluster}`} title={member.name}>
    <div className="drawer-status-row"><StatusLabel detail={node?.statusReason} status={rag} />{!member.active && <span className="concept-tag">Inactive / history retained</span>}{node?.sourceStatus !== "confirmed" && <span className="concept-tag">Provisional structural role</span>}</div>
    <div className={`team-drawer-model team-drawer-model--${member.operatingModel.toLowerCase()}`}><span>Operating model</span><strong>{operatingModelLabels[member.operatingModel]}</strong></div>
    <div className="team-drawer-actions">{canEdit && <button className="button button--primary button--small" onClick={onEdit} type="button">Edit structure</button>}{canDeactivate && member.active && <button className="button button--danger-quiet button--small" onClick={onDeactivate} type="button">Deactivate / retain history</button>}{canManageAssignments ? <Link className="button button--quiet button--small" href="/app/clients">Manage assignments in Clients</Link> : <Link className="button button--quiet button--small" href="/app/clients">View assignments</Link>}{!canEdit && <span className="team-note">Read-only people access</span>}</div>
    <dl className="detail-list"><div><dt>Career service level</dt><dd>{member.careerServiceLevel ?? "Not configured"}</dd></div><div><dt>Operating role</dt><dd>{member.role}</dd></div><div><dt>Reporting line</dt><dd>{member.reportsToOrgNodeId ? "Shown in hierarchy" : "Top-level / cross-functional"}</dd></div><div><dt>Effective from</dt><dd>{member.effectiveFrom ?? "Not recorded"}</dd></div>{canViewOperationalDetail ? member.portfolioApplicable ? <div><dt>Engagement clients</dt><dd>{member.assignedClients > 0 ? `${member.assignedClients} client${member.assignedClients === 1 ? "" : "s"} · weight ${member.clientWeight}` : "No current assignment"}</dd></div> : <div><dt>Engagement clients</dt><dd>Not applicable to this operating model</dd></div> : <div><dt>Operational detail</dt><dd>Scoped to assigned work for this access view</dd></div>}{canViewOperationalDetail && member.portfolioApplicable && member.activeWork > 0 && <div><dt>Active engagement work</dt><dd>{member.activeWork}</dd></div>}{canViewOperationalDetail && member.portfolioApplicable && member.coverageGaps > 0 && <div><dt>Coverage</dt><dd>{member.coverageGaps} gap{member.coverageGaps === 1 ? "" : "s"}</dd></div>}{canViewOperationalDetail && isTaxTeamOperatingModel(member.operatingModel) && <div><dt>Tax ad hoc workload</dt><dd>{member.activeSpecialistCases} active case{member.activeSpecialistCases === 1 ? "" : "s"} · {member.affectedTaxpayers} affected taxpayer{member.affectedTaxpayers === 1 ? "" : "s"}</dd></div>}</dl>
    {canViewOperationalDetail && member.assignedClientIds.length > 0 && <div className="team-client-list">{member.assignedClientIds.map((clientId) => { const client = clients.find((item) => item.id === clientId); return client ? <Link href={`/app/clients/${client.id}`} key={client.id}><strong>{client.name}</strong><span>{client.assignment.cluster} · weight {client.entities[0]?.profile.weight ?? "—"}</span></Link> : null; })}</div>}
    {specialistCases.length > 0 && <div aria-label="Tax ad hoc assignments" className="team-case-list">{specialistCases.map((specialistCase) => { const client = fixtureClients.find((item) => item.id === specialistCase.taxpayerClientId); return <div className="team-case-list__item" key={specialistCase.id}><span className="team-case-list__type">{specialistCase.caseType}</span><strong>{client?.name ?? "Taxpayer context unavailable"}</strong><small>{specialistCase.status} · {specialistCase.deadlineLabel}</small></div>; })}<p className="team-note">A tax ad hoc does not change the taxpayer’s engagement owner, Preparer, Checker or Reviewer.</p></div>}
    {canViewChangeHistory && member.remarks && <section aria-labelledby="team-member-remarks-title" className="team-change-history"><p className="eyebrow" id="team-member-remarks-title">Remarks</p><p className="team-note">{member.remarks}</p></section>}
    {canViewChangeHistory && changeEvents.length > 0 && <section aria-labelledby="team-member-history-title" className="team-change-history"><p className="eyebrow" id="team-member-history-title">Local change history</p>{changeEvents.slice().reverse().map((event) => <div className="team-change-history__item" key={event.id}><strong>{event.action}</strong><span>{event.summary}</span><small>Effective {event.effectiveFrom}{event.remarks ? ` · ${event.remarks}` : ""}</small></div>)}</section>}
  </DetailDrawer>;
}
