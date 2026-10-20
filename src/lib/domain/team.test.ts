import { describe, expect, it } from "vitest";

import { fixtureClients, fixtureOrgChartNodes, fixtureOrgDirectoryMembers, fixtureSpecialistCases, fixtureWork } from "@/lib/fixtures";
import { fixtureOrganizationScopes } from "./organization-catalog";
import { buildEditableOrgChartNodes, buildOrgChartTree, careerServiceLevelLabels, careerServiceLevelTitle, clientMatchesPerspective, derivePersonalControlPulse, deriveTeamControlPulses, deriveTeamMemberLoad, deriveTeamSpecialistSummary, deriveTeamTowerSummary, deriveTeamWorkloadGuide, hasCoverageGap, overlayOrgChartLoad, reportingLineMemberIds, reportingManagerLevelFor, summarizeTeamWorkloadGuide, teamMemberIdsForPerspective, workMatchesStaffPerspective } from "./team";

describe("team and portfolio foundation", () => {
  it("derives a member's client load once per client, not once per assigned role", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork);
    const reignerwin = load.find((member) => member.id === "org-c1-senior-supervisor");

    expect(reignerwin).toBeDefined();
    expect(reignerwin?.assignmentAliases).toEqual([]);
    expect(reignerwin?.assignedClientIds).toHaveLength(reignerwin?.assignedClients ?? 0);
    expect(new Set(reignerwin?.assignedClientIds).size).toBe(reignerwin?.assignedClients);
    expect(reignerwin?.clientWeight).toBe(fixtureClients.filter((client) => reignerwin?.assignedClientIds.includes(client.id)).reduce((total, client) => total + (client.entities[0]?.profile.sourceFinalWeight ?? 0), 0));
  });

  it("flags missing or conflicting coverage without changing assignment history", () => {
    const incompleteClient = fixtureClients.find((client) => client.id === "fixture-client-06");

    expect(incompleteClient).toBeDefined();
    expect(hasCoverageGap(incompleteClient!)).toBe(true);
  });

  it("summarizes operational load by tower", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork);
    const summaries = deriveTeamTowerSummary(load, fixtureClients, fixtureWork);
    const north = summaries.find((summary) => summary.tower === "Tower A");

    expect(north).toMatchObject({ clients: 37, clientWeight: 74, activeWork: 1, coverageGaps: 0 });
  });

  it("derives the all-clear pulse from existing work without inventing a team score", () => {
    const pulses = deriveTeamControlPulses(fixtureWork);
    expect(pulses).toEqual([
      expect.objectContaining({ scope: "Tower A", totalWork: 1, clearWork: 0, attentionWork: 1, blockedWork: 1, clearPercent: 0, state: "NEEDS_ATTENTION" }),
      expect.objectContaining({ scope: "Tower B", totalWork: 2, clearWork: 0, attentionWork: 2, blockedWork: 1, clearPercent: 0, state: "NEEDS_ATTENTION" }),
      expect.objectContaining({ scope: "Tower C", totalWork: 1, clearWork: 1, attentionWork: 0, blockedWork: 0, clearPercent: 100, state: "ALL_CLEAR" }),
    ]);
  });

  it("keeps staff progress private and points the next move at attention-first work", () => {
    const pulse = derivePersonalControlPulse(fixtureWork.filter((item) => item.scope === "Tower A"));

    expect(pulse).toMatchObject({ totalWork: 1, clearWork: 0, attentionWork: 1, blockedWork: 1, clearPercent: 0 });
    expect(pulse.nextWork).toMatchObject({ id: "work-01", nextAction: "Follow up on client approval" });
  });

  it("keeps career service level descriptive and builds the reporting tree", () => {
    expect(careerServiceLevelLabels["5.2"]).toBe("Senior Manager");
    expect(careerServiceLevelLabels["2.1"]).toBe("Associate");
    expect(careerServiceLevelTitle("5.2")).toBe("Senior Manager · HOD");
    expect(careerServiceLevelTitle("3.2")).toBe("Team Leader");

    const [root] = buildOrgChartTree(fixtureOrgChartNodes);
    expect(root).toMatchObject({ id: "org-liezl", careerServiceLevel: "5.2" });
    expect(root.children[0]).toMatchObject({ id: "org-luiza", careerServiceLevel: "5.1" });
    expect(root.children[0].children.map((node) => node.cluster)).toEqual(["Cluster A", "Cluster B", "Cluster C"]);
    expect(reportingManagerLevelFor("2.1")).toBe("3.1");
    expect(reportingManagerLevelFor("2.2")).toBe("3.1");
    expect(reportingManagerLevelFor("3.1")).toBe("3.2");
    expect(reportingManagerLevelFor("3.2")).toBe("4.1");
    expect(reportingManagerLevelFor("4.1")).toBe("4.2");
  });

  it("preserves the approved reporting ladder in each illustrated cluster", () => {
    const [root] = buildOrgChartTree(fixtureOrgChartNodes);
    const luiza = root.children[0];

    expect(luiza.children).toHaveLength(3);
    for (const clusterLeader of luiza.children) {
      expect(clusterLeader.children).toHaveLength(1);
      expect(clusterLeader.children[0].careerServiceLevel).toBe("4.1");
      expect(clusterLeader.children[0].children.some((node) => node.careerServiceLevel === "3.2")).toBe(true);
    }

    expect(fixtureOrgChartNodes).toHaveLength(69);
    expect(fixtureOrgDirectoryMembers).toHaveLength(70);
    expect(fixtureOrgChartNodes.filter((node) => node.parentId === "org-c1-senior-supervisor").map((node) => node.careerServiceLevel)).toEqual(["3.2", "4.1"]);
    expect(fixtureOrgChartNodes.filter((node) => node.parentId === "org-c1-team-lead").map((node) => node.careerServiceLevel)).toEqual(["3.1", "3.1"]);
  });

  it("keeps the corrected barangay names and named direct reports in the shared roster", () => {
    const maricel = fixtureOrgChartNodes.find((node) => node.id === "org-c1-leader");
    const lourdesReports = fixtureOrgChartNodes.filter((node) => node.parentId === "org-c2-leader");
    const evangelineReports = fixtureOrgChartNodes.filter((node) => node.parentId === "org-c3-leader");

    expect(maricel).toMatchObject({ cluster: "Cluster A", title: "Assistant Manager · Cluster A" });
    expect(lourdesReports.map((node) => [node.id, node.careerServiceLevel])).toEqual([["org-c2-senior-supervisor", "4.1"]]);
    expect(evangelineReports.map((node) => [node.id, node.careerServiceLevel])).toEqual([["org-c3-senior-supervisor", "4.1"]]);
    expect(fixtureOrgDirectoryMembers.some((member) => member.id === "org-c1-team-lead" && member.careerServiceLevel === "3.2")).toBe(true);
    expect(new Set(fixtureOrgDirectoryMembers.map((member) => member.name)).size).toBe(fixtureOrgDirectoryMembers.length);
  });

  it("reconciles named staff, reporting lines, towers, clusters, and client assignments", () => {
    const membersById = new Map(fixtureOrgDirectoryMembers.map((member) => [member.id, member]));
    const membersByName = new Map(fixtureOrgDirectoryMembers.map((member) => [member.name, member]));
    const expectedStructure = [
      ["org-liezl", "Liezl Maigue", "All A&T", "All A&T", null],
      ["org-luiza", "Luiza Jimenez", "All A&T", "All A&T", "org-liezl"],
      ["org-c1-leader", "Maricel Marcelo Atilano", "Tower A", "Cluster A", "org-luiza"],
      ["org-c2-leader", "Lourdes Ann Mandigma Eleato", "Tower B", "Cluster B", "org-luiza"],
      ["org-c3-leader", "Evangeline De Vera", "Tower C", "Cluster C", "org-luiza"],
      ["org-c1-senior-supervisor", "Reignerwin", "Tower A", "Cluster A", "org-c1-leader"],
      ["org-c1-team-lead", "Trinity", "Tower A", "Cluster A", "org-c1-senior-supervisor"],
      ["org-c2-senior-supervisor", "Minezka", "Tower B", "Cluster B", "org-c2-leader"],
      ["org-c2-team-lead", "April Roes", "Tower B", "Cluster B", "org-c2-senior-supervisor"],
      ["org-c3-senior-supervisor", "Mark Renzel", "Tower C", "Cluster C", "org-c3-leader"],
      ["org-c3-team-lead", "Viengeline", "Tower C", "Cluster C", "org-c3-senior-supervisor"],
    ] as const;

    for (const [id, name, tower, cluster, reportsToOrgNodeId] of expectedStructure) {
      expect(membersById.get(id)).toMatchObject({ name, tower, cluster, reportsToOrgNodeId });
    }

    const scopeByTower = new Map(fixtureOrganizationScopes.map((scope) => [scope.tower, scope.cluster]));
    expect(fixtureClients.every((client) => scopeByTower.get(client.scope) === client.assignment.cluster)).toBe(true);
    expect(fixtureClients.every((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]
      .filter((name) => name !== "Unassigned")
      .every((name) => membersByName.get(name)?.operatingModel === "ENGAGEMENT_AGILE" && membersByName.get(name)?.tower === client.scope))).toBe(true);
  });

  it("overlays directory coverage onto the matching org-chart people", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork);
    const chart = overlayOrgChartLoad(fixtureOrgChartNodes, load);
    const reignerwin = chart.find((node) => node.id === "org-c1-senior-supervisor");
    const directoryMember = load.find((member) => member.id === "org-c1-senior-supervisor");

    expect(reignerwin).toMatchObject({ assignedClients: directoryMember?.assignedClients, activeWork: directoryMember?.activeWork, coverageGaps: directoryMember?.coverageGaps });
  });

  it("keeps specialist-case workload separate from recurring portfolio workload", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork, fixtureSpecialistCases);
    const april = load.find((member) => member.id === "org-c2-team-lead");
    const taxControl = load.find((member) => member.id === "member-tax-control");

    expect(april).toMatchObject({ operatingModel: "TAX_TEAM", portfolioApplicable: false, assignedClients: 0, clientWeight: 0, activeSpecialistCases: 2, affectedTaxpayers: 2, specialistAttention: 1 });
    expect(taxControl).toMatchObject({ operatingModel: "TAX_TEAM", portfolioApplicable: false, assignedClients: 0, clientWeight: 0, activeSpecialistCases: 1, affectedTaxpayers: 1, specialistAttention: 1 });
    const specialistNames = new Set(load.filter((member) => member.operatingModel === "TAX_TEAM").map((member) => member.name));
    expect(fixtureClients.some((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer].some((assignee) => specialistNames.has(assignee)))).toBe(false);
    expect(fixtureSpecialistCases.every((specialistCase) => specialistCase.assigneeMemberIds.every((memberId) => {
      const member = fixtureOrgDirectoryMembers.find((item) => item.id === memberId);
      return member?.operatingModel === "TAX_TEAM";
    }))).toBe(true);
  });

  it("uses a simple capacity guide without converting Tax Team cases into portfolio weight", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork, fixtureSpecialistCases);
    const guide = deriveTeamWorkloadGuide(load, fixtureClients);
    const teamLeader = guide.find((member) => member.id === "org-c1-team-lead");
    const supervisor = guide.find((member) => member.id === "org-c1-senior-supervisor");
    const hod = guide.find((member) => member.id === "org-liezl");
    const april = guide.find((member) => member.id === "org-c2-team-lead");

    expect(teamLeader?.capacityTier).toBe(5);
    expect(supervisor?.capacityTier).toBe(6);
    expect(teamLeader?.capacityLabel).toBe("Training toward 4.1");
    expect(hod).toMatchObject({ capacityApplicable: false, capacityTier: null, capacityLabel: "HOD oversight; explicit assignments only" });
    expect(april).toMatchObject({ capacityApplicable: false, knownPortfolioWeight: 0, capacityLabel: "Specialist cases; portfolio weight not applicable" });
    expect(summarizeTeamWorkloadGuide(guide, fixtureClients).unresolvedWeightClients).toBeGreaterThan(0);
  });

  it("narrows staff Team views to one person's reporting line, not peer branches", () => {
    const preparerIds = teamMemberIdsForPerspective(fixtureOrgDirectoryMembers, fixtureClients, "PREPARER");
    expect(preparerIds).toEqual(reportingLineMemberIds(fixtureOrgDirectoryMembers, "org-c1-extra-senior-associate-child-1"));
    expect(preparerIds.has("org-c1-extra-senior-associate-child-1")).toBe(true);
    expect(preparerIds.has("org-c1-leader")).toBe(true);
    expect(preparerIds.has("org-c1-senior-supervisor")).toBe(true);
    expect([...preparerIds].some((id) => fixtureOrgDirectoryMembers.find((member) => member.id === id)?.reportsToOrgNodeId === "org-c1-extra-senior-associate-child-1")).toBe(false);
    expect(preparerIds.has("org-c2-leader")).toBe(false);
    expect(teamMemberIdsForPerspective(fixtureOrgDirectoryMembers, fixtureClients, "MASTER_ADMIN").size).toBe(fixtureOrgDirectoryMembers.length);
  });

  it("limits staff client and work visibility to the selected person's assignments", () => {
    const preparer = fixtureOrgDirectoryMembers.find((member) => member.id === "org-c1-extra-senior-associate-child-1");
    expect(preparer).toBeDefined();
    const assignedClients = fixtureClients.filter((client) => clientMatchesPerspective(client, "PREPARER", fixtureOrgDirectoryMembers));
    expect(assignedClients.length).toBeGreaterThan(0);
    expect(assignedClients.every((client) => preparer && client.assignment.preparer === preparer.name)).toBe(true);
    expect(clientMatchesPerspective(fixtureClients.find((client) => client.id === "fixture-client-02")!, "PREPARER", fixtureOrgDirectoryMembers)).toBe(false);
    expect(fixtureWork.filter((work) => workMatchesStaffPerspective(work, "PREPARER", fixtureClients, fixtureOrgDirectoryMembers)).every((work) => assignedClients.some((client) => client.id === work.clientId))).toBe(true);

    const crossRoleAssignment = { ...fixtureClients[0], id: "security-cross-role-fixture", assignment: { ...fixtureClients[0].assignment, preparer: "Another sanitized person", checker: preparer!.name, reviewer: "Another sanitized reviewer" } };
    expect(clientMatchesPerspective(crossRoleAssignment, "PREPARER", fixtureOrgDirectoryMembers)).toBe(false);
  });

  it("keeps staff reporting context above the person without exposing a subordinate branch", () => {
    const manager = fixtureOrgDirectoryMembers.find((member) => member.id === "org-c1-senior-supervisor");
    const staff = fixtureOrgDirectoryMembers.find((member) => member.id === "org-c1-extra-senior-associate-child-1");
    expect(manager).toBeDefined();
    expect(staff).toBeDefined();

    const testMembers = fixtureOrgDirectoryMembers.map((member) => member.id === staff!.id
      ? { ...member, reportsToOrgNodeId: manager!.id }
      : member.id === "org-c1-associate-a"
        ? { ...member, reportsToOrgNodeId: staff!.id }
        : member);
    const visible = reportingLineMemberIds(testMembers, staff!.id);

    expect(visible).toEqual(new Set([staff!.id, manager!.id, "org-c1-leader", "org-luiza", "org-liezl"]));
    expect(visible.has("org-c1-associate-a")).toBe(false);
  });

  it("narrows leader hierarchy context to the clients in the visible scope", () => {
    const northClients = fixtureClients.filter((client) => client.scope === "Tower A");
    const northIds = teamMemberIdsForPerspective(fixtureOrgDirectoryMembers, northClients, "TOWER_LEADER");
    const southClients = fixtureClients.filter((client) => client.scope === "Tower C");
    const southIds = teamMemberIdsForPerspective(fixtureOrgDirectoryMembers, southClients, "CLUSTER_LEADER");

    expect(northIds.size).toBeLessThan(fixtureOrgDirectoryMembers.length);
    expect(southIds.size).toBeLessThan(fixtureOrgDirectoryMembers.length);
    expect(northIds.has("org-c3-leader")).toBe(false);
    expect(southIds.has("org-c1-leader")).toBe(false);
  });

  it("summarizes specialist cases without manufacturing a common workload score", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork, fixtureSpecialistCases);
    expect(deriveTeamSpecialistSummary(load, fixtureSpecialistCases)).toEqual({ memberCount: 2, caseCount: 2, affectedTaxpayerCount: 2, attentionCount: 1 });
  });

  it("projects roster edits into the same chart and preserves inactive history", () => {
    const editedMembers = [
      ...fixtureOrgDirectoryMembers.map((member) => member.id === "org-c1-leader" ? { ...member, name: "Promoted Leader", title: "Senior Manager · Cluster A", careerServiceLevel: "5.2" } : member),
      { id: "local-new-person", name: "New Associate", title: "Associate · Cluster A", role: "Team Member" as const, tower: "Tower A" as const, cluster: "Cluster A", active: false, email: "local-new-person@example.invalid", operatingModel: "ENGAGEMENT_AGILE" as const, careerServiceLevel: "2.1", reportsToOrgNodeId: "org-c1-leader", effectiveFrom: "2026-10-06" },
    ];
    const chart = buildEditableOrgChartNodes(editedMembers, fixtureOrgChartNodes);
    expect(chart.find((node) => node.id === "org-c1-leader")).toMatchObject({ name: "Promoted Leader", careerServiceLevel: "5.2" });
    expect(chart.find((node) => node.id === "local-new-person")).toMatchObject({ parentId: "org-c1-leader", active: false, statusReason: "Inactive from 2026-10-06." });
  });

  it("does not count inactive delivery members as current tower capacity", () => {
    const members = fixtureOrgDirectoryMembers.map((member) => member.id === "org-c1-leader" ? { ...member, active: false } : member);
    const load = deriveTeamMemberLoad(members, fixtureClients, fixtureWork);
    const north = deriveTeamTowerSummary(load, fixtureClients, fixtureWork).find((summary) => summary.tower === "Tower A");
    expect(north?.members).toBe(22);
  });
});
