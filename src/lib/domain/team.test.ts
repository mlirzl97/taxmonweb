import { describe, expect, it } from "vitest";

import { fixtureClients, fixtureOrgChartNodes, fixtureOrgDirectoryMembers, fixtureTeamMembers, fixtureWork } from "@/lib/fixtures";
import { buildOrgChartTree, careerServiceLevelLabels, deriveTeamMemberLoad, deriveTeamTowerSummary, hasCoverageGap, overlayOrgChartLoad } from "./team";

describe("team and portfolio foundation", () => {
  it("derives a member's client load once per client, not once per assigned role", () => {
    const load = deriveTeamMemberLoad(fixtureTeamMembers, fixtureClients, fixtureWork);
    const santos = load.find((member) => member.name === "M. Santos");

    expect(santos).toBeDefined();
    expect(santos?.assignedClientIds).toHaveLength(santos?.assignedClients ?? 0);
    expect(new Set(santos?.assignedClientIds).size).toBe(santos?.assignedClients);
    expect(santos?.clientWeight).toBe(fixtureClients.filter((client) => santos?.assignedClientIds.includes(client.id)).reduce((total, client) => total + (client.entities[0]?.profile.sourceFinalWeight ?? 0), 0));
  });

  it("flags missing or conflicting coverage without changing assignment history", () => {
    const incompleteClient = fixtureClients.find((client) => client.id === "fixture-client-06");

    expect(incompleteClient).toBeDefined();
    expect(hasCoverageGap(incompleteClient!)).toBe(true);
  });

  it("summarizes operational load by tower", () => {
    const load = deriveTeamMemberLoad(fixtureTeamMembers, fixtureClients, fixtureWork);
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
    expect(lourdesReports.map((node) => [node.name, node.careerServiceLevel])).toEqual([["Minezka", "4.1"], ["April Roes", "4.1"]]);
    expect(evangelineReports.map((node) => [node.name, node.careerServiceLevel])).toEqual([["Mark Renzel", "4.1"], ["Viengeline", "4.1"]]);
    expect(fixtureOrgDirectoryMembers.some((member) => member.name === "Trinity" && member.careerServiceLevel === "3.2")).toBe(true);
  });

  it("overlays directory coverage onto the matching org-chart people", () => {
    const load = deriveTeamMemberLoad(fixtureOrgDirectoryMembers, fixtureClients, fixtureWork);
    const chart = overlayOrgChartLoad(fixtureOrgChartNodes, load);
    const reignerwin = chart.find((node) => node.name === "Reignerwin");
    const directoryMember = load.find((member) => member.name === "Reignerwin");

    expect(reignerwin).toMatchObject({ assignedClients: directoryMember?.assignedClients, activeWork: directoryMember?.activeWork, coverageGaps: directoryMember?.coverageGaps });
  });
});
