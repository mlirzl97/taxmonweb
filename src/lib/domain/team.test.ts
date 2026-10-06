import { describe, expect, it } from "vitest";

import { fixtureClients, fixtureOrgChartNodes, fixtureOrgDirectoryMembers, fixtureSpecialistCases, fixtureWork } from "@/lib/fixtures";
import { buildOrgChartTree, careerServiceLevelLabels, deriveTeamMemberLoad, deriveTeamSpecialistSummary, deriveTeamTowerSummary, hasCoverageGap, overlayOrgChartLoad } from "./team";

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
    const north = summaries.find((summary) => summary.tower === "Tower North");

    expect(north).toMatchObject({ clients: 37, clientWeight: 74, activeWork: 1, coverageGaps: 0 });
  });

  it("keeps career service level descriptive and builds the reporting tree", () => {
    expect(careerServiceLevelLabels["5.2"]).toBe("Senior Manager");
    expect(careerServiceLevelLabels["2.1"]).toBe("Associate");

    const [root] = buildOrgChartTree(fixtureOrgChartNodes);
    expect(root).toMatchObject({ id: "org-liezl", careerServiceLevel: "5.2" });
    expect(root.children[0]).toMatchObject({ id: "org-luiza", careerServiceLevel: "5.1" });
    expect(root.children[0].children.map((node) => node.cluster)).toEqual(["Barangay Atilano", "Barangay Beato", "Barangay de Vera"]);
  });

  it("preserves the usual two-direct-subordinate shape in each illustrated layer", () => {
    const [root] = buildOrgChartTree(fixtureOrgChartNodes);
    const luiza = root.children[0];

    expect(luiza.children).toHaveLength(3);
    for (const clusterLeader of luiza.children) {
      expect(clusterLeader.children).toHaveLength(2);
    }

    expect(fixtureOrgChartNodes).toHaveLength(69);
    expect(fixtureOrgDirectoryMembers).toHaveLength(70);
    expect(fixtureOrgChartNodes.filter((node) => node.parentId === "org-c1-senior-supervisor")).toHaveLength(2);
    expect(fixtureOrgChartNodes.filter((node) => node.parentId === "org-c1-team-lead")).toHaveLength(2);
  });

  it("keeps the corrected barangay names and named direct reports in the shared roster", () => {
    const maricel = fixtureOrgChartNodes.find((node) => node.id === "org-c1-leader");
    const lourdesReports = fixtureOrgChartNodes.filter((node) => node.parentId === "org-c2-leader");
    const evangelineReports = fixtureOrgChartNodes.filter((node) => node.parentId === "org-c3-leader");

    expect(maricel).toMatchObject({ cluster: "Barangay Atilano", title: "Assistant Manager · Barangay Atilano" });
    expect(lourdesReports.map((node) => [node.id, node.careerServiceLevel])).toEqual([["org-c2-senior-supervisor", "4.1"], ["org-c2-team-lead", "4.1"]]);
    expect(evangelineReports.map((node) => [node.id, node.careerServiceLevel])).toEqual([["org-c3-senior-supervisor", "4.1"], ["org-c3-team-lead", "4.1"]]);
    expect(fixtureOrgDirectoryMembers.some((member) => member.id === "org-c1-team-lead" && member.careerServiceLevel === "3.2")).toBe(true);
    expect(new Set(fixtureOrgDirectoryMembers.map((member) => member.name)).size).toBe(fixtureOrgDirectoryMembers.length);
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

    expect(april).toMatchObject({ operatingModel: "SPECIALIST_CASE", portfolioApplicable: false, assignedClients: 0, clientWeight: 0, activeSpecialistCases: 2, affectedTaxpayers: 2, specialistAttention: 1 });
    expect(taxControl).toMatchObject({ operatingModel: "SPECIALIST_CASE", portfolioApplicable: false, assignedClients: 0, clientWeight: 0, activeSpecialistCases: 1, affectedTaxpayers: 1, specialistAttention: 1 });
    const specialistNames = new Set(load.filter((member) => member.operatingModel === "SPECIALIST_CASE").map((member) => member.name));
    expect(fixtureClients.some((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer].some((assignee) => specialistNames.has(assignee)))).toBe(false);
    expect(fixtureSpecialistCases.every((specialistCase) => specialistCase.assigneeMemberIds.every((memberId) => {
      const member = fixtureOrgDirectoryMembers.find((item) => item.id === memberId);
      return member?.operatingModel === "SPECIALIST_CASE";
    }))).toBe(true);
  });

  it("summarizes specialist cases without manufacturing a common workload score", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork, fixtureSpecialistCases);
    expect(deriveTeamSpecialistSummary(load, fixtureSpecialistCases)).toEqual({ memberCount: 2, caseCount: 2, affectedTaxpayerCount: 2, attentionCount: 1 });
  });
});
