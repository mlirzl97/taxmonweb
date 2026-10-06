"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { fixtureClients, fixtureOrgChartNodes, fixtureOrgDirectoryMembers, fixtureSpecialistCases, fixtureWork, getClientWorkloadWeight } from "@/lib/fixtures";
import { deriveTeamMemberLoad, deriveTeamSpecialistSummary, deriveTeamTowerSummary, hasCoverageGap, operatingModelLabels, overlayOrgChartLoad, type OrgChartNode } from "@/lib/domain/team";
import { DetailDrawer, FixturePageFrame, isInScope, ScopeSwitcher, SectionHeading, StatusLabel, type ScopeFilter } from "@/components/app/workspace-components";
import { OrgChart } from "@/components/app/org-chart";

type AssignmentLens = "all" | "portfolio" | "specialist";

export default function TeamPage() {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [assignmentLens, setAssignmentLens] = useState<AssignmentLens>("all");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const load = useMemo(() => deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork, fixtureSpecialistCases), []);
  const summaries = useMemo(() => deriveTeamTowerSummary(load, fixtureClients, fixtureWork), [load]);
  const specialistSummary = useMemo(() => deriveTeamSpecialistSummary(load, fixtureSpecialistCases), [load]);
  const orgChartNodes = useMemo(() => overlayOrgChartLoad(fixtureOrgChartNodes, load), [load]);
  const scopedMembers = load.filter((member) => member.tower === "All A&T" || isInScope(member.tower, scope));
  const visibleMembers = scopedMembers.filter((member) => {
    const inLens = assignmentLens === "all"
      || (assignmentLens === "portfolio" && member.operatingModel === "DELIVERY")
      || (assignmentLens === "specialist" && member.operatingModel === "SPECIALIST_CASE");
    return inLens;
  });
  const visibleClients = fixtureClients.filter((client) => scope === "all" || isInScope(client.scope, scope));
  const visibleClientIds = new Set(visibleClients.map((client) => client.id));
  const visibleSpecialistCases = fixtureSpecialistCases.filter((specialistCase) => visibleClientIds.has(specialistCase.taxpayerClientId));
  const selected = load.find((member) => member.name === selectedMember);
  const selectedOrgNode = orgChartNodes.find((node) => node.name === selectedMember);
  const totalWeight = visibleClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0);
  const coverageGaps = visibleClients.filter(hasCoverageGap).length;
  const specialistAffectedTaxpayers = new Set(visibleSpecialistCases.map((specialistCase) => specialistCase.taxpayerClientId)).size;
  const specialistAttention = visibleSpecialistCases.filter((specialistCase) => specialistCase.attention === "AMBER" || specialistCase.attention === "RED" || specialistCase.attention === "UNRESOLVED").length;

  return (
    <FixturePageFrame>
      <header className="module-header">
        <div><h1>Team</h1></div>
        <span className="module-count">{load.filter((member) => member.active).length} active members · {visibleClients.length} taxpayers</span>
      </header>

      <div className="page-toolbar page-toolbar--stackable">
        <ScopeSwitcher onChange={setScope} value={scope} />
        <span className="toolbar-context">One canonical team workspace · two workload models</span>
      </div>

      <section aria-labelledby="team-overview-title" className="team-overview">
        <SectionHeading detail="Common organization signals stay together; workload semantics stay model-specific" title="Overview" />
        <div className="team-signal-grid">
          <Signal label="Active members" value={String(scopedMembers.filter((member) => member.active).length)} detail="Current internal team" />
          <Signal label="Delivery taxpayers" value={String(visibleClients.length)} detail="Recurring portfolio scope" />
          <Signal label="Delivery weight" value={String(totalWeight)} detail="Portfolio metric · delivery only" />
          <Signal label="Coverage gaps" value={String(coverageGaps)} detail="Needs assignment review" tone={coverageGaps > 0 ? "amber" : "green"} />
          <Signal label="Specialist cases" value={String(visibleSpecialistCases.length)} detail={`Tax Audit · ${specialistAffectedTaxpayers} affected taxpayer${specialistAffectedTaxpayers === 1 ? "" : "s"}`} />
          <Signal label="Case attention" value={String(specialistAttention)} detail="Specialist-case signal" tone={specialistAttention > 0 ? "amber" : "green"} />
        </div>
      </section>

      <section aria-labelledby="team-org-chart-title" className="panel team-panel team-org-panel">
        <SectionHeading detail="One shared reporting hierarchy; operating model determines the relevant workload signal" title="Organization" />
        <OrgChart nodes={orgChartNodes} onSelect={(node) => setSelectedMember(node.name)} />
      </section>

      <section aria-labelledby="team-directory-title" className="panel panel--table team-panel">
        <SectionHeading detail="The canonical roster, with recurring portfolio and specialist case accountability kept distinct" title="Assignments" />
        <div aria-label="Assignment workload lens" className="team-model-switch" role="group">
          <button aria-pressed={assignmentLens === "all"} className={assignmentLens === "all" ? "is-active" : ""} onClick={() => setAssignmentLens("all")} type="button">All assignments</button>
          <button aria-pressed={assignmentLens === "portfolio"} className={assignmentLens === "portfolio" ? "is-active" : ""} onClick={() => setAssignmentLens("portfolio")} type="button">Recurring portfolio</button>
          <button aria-pressed={assignmentLens === "specialist"} className={assignmentLens === "specialist" ? "is-active" : ""} onClick={() => setAssignmentLens("specialist")} type="button">Specialist cases</button>
        </div>
        <div className="team-directory" role="region" aria-label="Team directory table" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Person</th><th scope="col">Organization</th><th scope="col">Band</th><th scope="col">Operating model</th><th scope="col">Recurring portfolio</th><th scope="col">Specialist cases</th><th scope="col">Signal</th></tr></thead>
            <tbody>
              {visibleMembers.map((member) => <tr key={member.id}>
                <td><button className="team-person-button" onClick={() => setSelectedMember(member.name)} type="button"><span className="client-avatar" aria-hidden="true">{member.name.replace(/[^A-Z]/g, "").slice(0, 2)}</span><span><strong>{member.name}</strong><small>{member.title}</small></span></button></td>
                <td><span className="table-value"><strong>{member.tower}</strong><small>{member.cluster}</small></span></td>
                <td><strong>{member.careerServiceLevel ?? "—"}</strong></td>
                <td><span className="table-value"><strong>{operatingModelLabels[member.operatingModel]}</strong><small>{member.role}</small></span></td>
                <td>{member.portfolioApplicable ? <span className="table-value"><strong>{member.assignedClients || "—"}</strong><small>{member.clientWeight > 0 ? `weight ${member.clientWeight}` : "No current assignment"}</small></span> : <span className="team-portfolio-value--na">Not applicable</span>}</td>
                <td>{member.operatingModel === "SPECIALIST_CASE" ? <span className="table-value"><strong>{member.activeSpecialistCases || "—"}</strong><small>{member.affectedTaxpayers ? `${member.affectedTaxpayers} affected taxpayer${member.affectedTaxpayers === 1 ? "" : "s"}` : "No active case"}</small></span> : <span className="table-subvalue">—</span>}</td>
                <td>{member.operatingModel === "SPECIALIST_CASE" ? <span className={member.specialistAttention > 0 ? "attention-open" : "attention-clear"}>{member.specialistAttention > 0 ? `${member.specialistAttention} case attention` : "No case attention"}</span> : <span className={member.coverageGaps > 0 ? "attention-open" : "attention-clear"}>{member.coverageGaps > 0 ? `${member.coverageGaps} coverage gap` : "Covered"}</span>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="team-note">Recurring portfolio weight is derived only for Delivery teams. Specialist case work is reported separately and is not converted into portfolio weight.</p>
      </section>

      <section aria-labelledby="team-structure-title" className="panel panel--table team-panel">
        <SectionHeading detail="The same organization projection, with operating-model-specific measures underneath" title="Organization coverage" />
        <div className="team-structure" role="table" aria-label="Organization structure">
          <div className="team-structure__header" role="row"><span>Area</span><span>Operating model</span><span>Members</span><span>Taxpayers / cases</span><span>Weight / affected</span><span>Attention</span></div>
          {summaries.filter((summary) => scope === "all" || summary.tower === ({ north: "Tower North", central: "Tower Central", south: "Tower South" }[scope] ?? "")).map((summary) => <div className="team-structure__row" key={summary.tower} role="row"><span><strong>{summary.tower}</strong><small>{summary.cluster}</small></span><span>Recurring portfolio</span><span>{summary.members}</span><span>{summary.clients}</span><span>{summary.clientWeight}</span><span className={summary.coverageGaps > 0 ? "attention-open" : "attention-clear"}>{summary.coverageGaps > 0 ? `${summary.coverageGaps} gap` : "Covered"}</span></div>)}
          {(scope === "all" || scope === "central") && <div className="team-structure__row team-structure__row--specialist" role="row"><span><strong>Tax Team</strong><small>Cross-portfolio specialist function</small></span><span>Specialist cases</span><span>{specialistSummary.memberCount} identified</span><span>{specialistSummary.caseCount} Tax Audit</span><span>{specialistSummary.affectedTaxpayerCount} affected</span><span className={specialistSummary.attentionCount > 0 ? "attention-open" : "attention-clear"}>{specialistSummary.attentionCount > 0 ? `${specialistSummary.attentionCount} case attention` : "No case attention"}</span></div>}
        </div>
        <p className="team-note">Tax Team stays in the same canonical organization. Its normal portfolio measures are not applicable; specialist-case measures are shown independently. The current fixture identifies two members; remaining Tax Team seats require roster confirmation.</p>
      </section>

      {selected && <TeamMemberDrawer member={selected} node={selectedOrgNode} specialistCases={fixtureSpecialistCases.filter((specialistCase) => specialistCase.assigneeMemberIds.includes(selected.id))} onClose={() => setSelectedMember(null)} />}
    </FixturePageFrame>
  );
}

function Signal({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "amber" | "green" }) {
  return <div className={`team-signal team-signal--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function TeamMemberDrawer({ member, node, specialistCases, onClose }: { member: ReturnType<typeof deriveTeamMemberLoad>[number]; node?: OrgChartNode; specialistCases: typeof fixtureSpecialistCases; onClose: () => void }) {
  const rag = node?.sourceStatus === "confirmed" ? node.rag : "UNRESOLVED";

  return (
    <DetailDrawer eyebrow="Team member" onClose={onClose} subtitle={`${member.title} · ${member.tower}`} title={member.name}>
      <div className="drawer-status-row">
        <StatusLabel detail={node?.statusReason} status={rag} />
        {node?.sourceStatus !== "confirmed" && <span className="concept-tag">Provisional structural role</span>}
      </div>
      <div className={`team-drawer-model team-drawer-model--${member.operatingModel.toLowerCase()}`}><span>Operating model</span><strong>{operatingModelLabels[member.operatingModel]}</strong></div>
      <dl className="detail-list">
        <div><dt>Career service level</dt><dd>{member.careerServiceLevel ?? "Not configured"}</dd></div>
        <div><dt>Operating role</dt><dd>{member.role}</dd></div>
        <div><dt>Reporting line</dt><dd>{member.reportsToOrgNodeId ? "Shown in hierarchy" : "Top-level role"}</dd></div>
        {member.portfolioApplicable ? <div><dt>Recurring portfolio</dt><dd>{member.assignedClients > 0 ? `${member.assignedClients} taxpayer${member.assignedClients === 1 ? "" : "s"} · weight ${member.clientWeight}` : "No current assignment"}</dd></div> : <div><dt>Recurring portfolio</dt><dd>Not applicable to this operating model</dd></div>}
        {member.portfolioApplicable && member.activeWork > 0 && <div><dt>Active portfolio work</dt><dd>{member.activeWork}</dd></div>}
        {member.portfolioApplicable && member.coverageGaps > 0 && <div><dt>Coverage</dt><dd>{member.coverageGaps} gap{member.coverageGaps === 1 ? "" : "s"}</dd></div>}
        {member.operatingModel === "SPECIALIST_CASE" && <div><dt>Specialist workload</dt><dd>{member.activeSpecialistCases} active case{member.activeSpecialistCases === 1 ? "" : "s"} · {member.affectedTaxpayers} affected taxpayer{member.affectedTaxpayers === 1 ? "" : "s"}</dd></div>}
      </dl>
      {member.assignedClientIds.length > 0 && <div className="team-client-list">{member.assignedClientIds.map((clientId) => { const client = fixtureClients.find((item) => item.id === clientId); return client ? <Link href={`/app/clients/${client.id}`} key={client.id}><strong>{client.name}</strong><span>{client.assignment.tower} · weight {client.entities[0]?.profile.weight ?? "—"}</span></Link> : null; })}</div>}
      {specialistCases.length > 0 && <div aria-label="Specialist case assignments" className="team-case-list">{specialistCases.map((specialistCase) => { const client = fixtureClients.find((item) => item.id === specialistCase.taxpayerClientId); return <div className="team-case-list__item" key={specialistCase.id}><span className="team-case-list__type">{specialistCase.caseType}</span><strong>{client?.name ?? "Taxpayer context unavailable"}</strong><small>{specialistCase.status} · {specialistCase.deadlineLabel}</small></div>; })}<p className="team-note">A specialist case does not change the taxpayer’s recurring portfolio owner, Preparer, Checker or Reviewer.</p></div>}
    </DetailDrawer>
  );
}
