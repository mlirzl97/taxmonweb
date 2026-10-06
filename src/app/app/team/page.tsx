"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { fixtureClients, fixtureOrgChartNodes, fixtureOrgDirectoryMembers, fixtureWork, getClientWorkloadWeight } from "@/lib/fixtures";
import { deriveTeamMemberLoad, deriveTeamTowerSummary, overlayOrgChartLoad } from "@/lib/domain/team";
import { DetailDrawer, FixturePageFrame, isInScope, ScopeSwitcher, SectionHeading, StatusLabel, type ScopeFilter } from "@/components/app/workspace-components";
import { OrgChart } from "@/components/app/org-chart";

export default function TeamPage() {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const load = useMemo(() => deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork), []);
  const summaries = useMemo(() => deriveTeamTowerSummary(load, fixtureClients, fixtureWork), [load]);
  const orgChartNodes = useMemo(() => overlayOrgChartLoad(fixtureOrgChartNodes, load), [load]);
  const visibleMembers = load.filter((member) => member.tower === "All A&T" || isInScope(member.tower, scope));
  const visibleClients = fixtureClients.filter((client) => scope === "all" || isInScope(client.scope, scope));
  const selected = load.find((member) => member.name === selectedMember);
  const selectedOrgNode = orgChartNodes.find((node) => node.name === selectedMember);
  const totalWeight = visibleClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0);
  const coverageGaps = visibleClients.filter((client) => client.assignment.preparer === "Unassigned" || new Set([client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]).size < 3).length;

  return (
    <FixturePageFrame>
      <header className="module-header">
        <div><h1>Team</h1></div>
        <span className="module-count">{visibleMembers.length} active members · {visibleClients.length} taxpayers</span>
      </header>

      <div className="page-toolbar page-toolbar--stackable">
        <ScopeSwitcher onChange={setScope} value={scope} />
        <span className="toolbar-context">People, organization, and portfolio coverage</span>
      </div>

      <section aria-label="Team portfolio signals" className="team-signal-grid">
        <Signal label="Active members" value={String(visibleMembers.filter((member) => member.active).length)} detail="Current internal team" />
        <Signal label="Taxpayers" value={String(visibleClients.length)} detail="Within selected scope" />
        <Signal label="Portfolio load" value={String(totalWeight)} detail="Derived client weight" />
        <Signal label="Coverage gaps" value={String(coverageGaps)} detail="Needs assignment review" tone={coverageGaps > 0 ? "amber" : "green"} />
      </section>

      <section aria-labelledby="team-org-chart-title" className="panel team-panel team-org-panel">
        <SectionHeading detail="One shared reporting visualization for the Team workspace" title="Organization chart" />
        <OrgChart nodes={orgChartNodes} onSelect={(node) => setSelectedMember(node.name)} />
      </section>

      <section aria-labelledby="team-directory-title" className="panel panel--table team-panel">
        <SectionHeading detail="Operational identities and current accountability" title="Team directory" />
        <div className="team-directory" role="region" aria-label="Team directory table" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Person</th><th scope="col">Organization</th><th scope="col">Band</th><th scope="col">Role</th><th scope="col">Clients</th><th scope="col">Weight</th><th scope="col">Active work</th><th scope="col">Coverage</th></tr></thead>
            <tbody>
              {visibleMembers.map((member) => <tr key={member.id}>
                <td><button className="team-person-button" onClick={() => setSelectedMember(member.name)} type="button"><span className="client-avatar" aria-hidden="true">{member.name.replace(/[^A-Z]/g, "").slice(0, 2)}</span><span><strong>{member.name}</strong><small>{member.title}</small></span></button></td>
                <td><span className="table-value"><strong>{member.tower}</strong><small>{member.cluster}</small></span></td>
                <td><strong>{member.careerServiceLevel ?? "—"}</strong></td>
                <td><span className="table-value"><strong>{member.role}</strong><small>{member.active ? "Active" : "Inactive"}</small></span></td>
                <td>{member.assignedClients}</td>
                <td><strong>{member.clientWeight}</strong><small className="table-subvalue">derived</small></td>
                <td>{member.activeWork}</td>
                <td><span className={member.coverageGaps > 0 ? "attention-open" : "attention-clear"}>{member.coverageGaps > 0 ? `${member.coverageGaps} gap` : "Covered"}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="team-note">Load is a derived operational view. It is not a performance score or individual leaderboard.</p>
      </section>

      <section aria-labelledby="team-structure-title" className="panel panel--table team-panel">
        <SectionHeading detail="The same organization and assignments power portfolio views" title="Organization structure" />
        <div className="team-structure" role="table" aria-label="Organization structure">
          <div className="team-structure__header" role="row"><span>Tower / cluster</span><span>Members</span><span>Taxpayers</span><span>Portfolio weight</span><span>Active work</span><span>Attention</span></div>
          {summaries.filter((summary) => scope === "all" || summary.tower === ({ north: "Tower North", central: "Tower Central", south: "Tower South" }[scope] ?? "")).map((summary) => <div className="team-structure__row" key={summary.tower} role="row"><span><strong>{summary.tower}</strong><small>{summary.cluster}</small></span><span>{summary.members}</span><span>{summary.clients}</span><span>{summary.clientWeight}</span><span>{summary.activeWork}</span><span className={summary.coverageGaps > 0 ? "attention-open" : "attention-clear"}>{summary.coverageGaps > 0 ? `${summary.coverageGaps} gap` : "Covered"}</span></div>)}
        </div>
      </section>

      {selected && <TeamMemberDrawer member={selected} node={selectedOrgNode} onClose={() => setSelectedMember(null)} />}
    </FixturePageFrame>
  );
}

function Signal({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "amber" | "green" }) {
  return <div className={`team-signal team-signal--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function TeamMemberDrawer({ member, node, onClose }: { member: ReturnType<typeof deriveTeamMemberLoad>[number]; node?: (typeof fixtureOrgChartNodes)[number]; onClose: () => void }) {
  const rag = node?.sourceStatus === "confirmed" ? node.rag : "UNRESOLVED";

  return (
    <DetailDrawer eyebrow="Team member" onClose={onClose} subtitle={`${member.title} · ${member.tower}`} title={member.name}>
      <div className="drawer-status-row">
        <StatusLabel detail={node?.statusReason} status={rag} />
        {node?.sourceStatus !== "confirmed" && <span className="concept-tag">Provisional structural role</span>}
      </div>
      <dl className="detail-list">
        <div><dt>Career service level</dt><dd>{member.careerServiceLevel ?? "Not configured"}</dd></div>
        <div><dt>Operating role</dt><dd>{member.role}</dd></div>
        <div><dt>Reporting line</dt><dd>{member.reportsToOrgNodeId ? "Shown in hierarchy" : "Top-level role"}</dd></div>
        {member.assignedClients > 0 && <div><dt>Clients</dt><dd>{member.assignedClients}</dd></div>}
        {member.activeWork > 0 && <div><dt>Active work</dt><dd>{member.activeWork}</dd></div>}
        {member.coverageGaps > 0 && <div><dt>Coverage</dt><dd>{member.coverageGaps} gap{member.coverageGaps === 1 ? "" : "s"}</dd></div>}
      </dl>
      {member.assignedClientIds.length > 0 && <div className="team-client-list">{member.assignedClientIds.map((clientId) => { const client = fixtureClients.find((item) => item.id === clientId); return client ? <Link href={`/app/clients/${client.id}`} key={client.id}><strong>{client.name}</strong><span>{client.assignment.tower} · weight {client.entities[0]?.profile.weight ?? "—"}</span></Link> : null; })}</div>}
    </DetailDrawer>
  );
}
