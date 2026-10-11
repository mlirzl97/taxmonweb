import { describe, expect, it } from "vitest";

import { fixtureClients, fixtureOrgDirectoryMembers } from "@/lib/fixtures";
import { reconcileAssignments, reconcileAssignmentsByTower, reconcilePortfolioWeights } from "./portfolio-pressure-test";

describe("client portfolio pressure-test fixture", () => {
  it("preserves the supplied 110-profile source reconciliation and adds exactly two excluded test records", () => {
    const reconciliation = reconcilePortfolioWeights(fixtureClients);

    expect(reconciliation).toMatchObject({
      sourceWeightedProfiles: 110,
      aggregateSourceFinalWeight: 225,
      syntheticAdditionalProfiles: 2,
      totalUiTestPopulation: 112,
    });
    expect(reconciliation.byClassification).toEqual({
      "Extremely Heavy": { count: 12, aggregateFinalWeight: 55 },
      Heavy: { count: 4, aggregateFinalWeight: 16 },
      Moderate: { count: 17, aggregateFinalWeight: 51 },
      Light: { count: 29, aggregateFinalWeight: 58 },
      "Super Light": { count: 48, aggregateFinalWeight: 45 },
    });
    expect(fixtureClients.filter((client) => client.entities[0]?.profile.fixtureSource === "synthetic_portfolio_test").every((client) => client.entities[0]?.profile.sourceFinalWeight === null)).toBe(true);
  });

  it("keeps source classification independent from numeric source weight", () => {
    const superLight = fixtureClients.filter((client) => client.entities[0]?.profile.sourceWeightClassification === "Super Light");
    expect(superLight).toHaveLength(48);
    expect(superLight.reduce((total, client) => total + (client.entities[0]?.profile.sourceFinalWeight ?? 0), 0)).toBe(45);
    expect(superLight.filter((client) => client.entities[0]?.profile.sourceFinalWeight === 0)).toHaveLength(3);
  });

  it("keeps the approved Contract Repository tree distinct from the Client", () => {
    expect(fixtureClients).toHaveLength(112);
    expect(fixtureClients.every((client) => client.contractRepository.id && client.contractRepository.referenceCode)).toBe(true);
    expect(fixtureClients.every((client) => client.contractRepository.masterEngagement?.title === "Master Agreement (MSA)" && client.contractRepository.masterEngagement.documents.some((document) => document.kind === "MSA") || !client.contractRepository.masterEngagement)).toBe(true);
    expect(fixtureClients.every((client) => client.contractRepository.masterEngagement?.documents.every((document) => ["MSA", "LSA", "Addendum"].includes(document.kind)) ?? true)).toBe(true);
    expect(fixtureClients.flatMap((client) => client.contractRepository.masterEngagement?.documents ?? []).find((document) => document.kind === "LSA")?.title).toBe("Local Service Agreement");
    expect(fixtureClients.flatMap((client) => client.contractRepository.masterEngagement?.documents ?? []).some((document) => document.title === "Letter of Service Agreement")).toBe(false);
    expect(fixtureClients.filter((client) => client.contractRepository.masterEngagement).every((client) => client.contractRepository.masterEngagement?.documents.filter((document) => document.isCurrent).length === 1)).toBe(true);
    expect(fixtureClients.flatMap((client) => client.contractRepository.additionalEngagements).every((engagement) => engagement.kind === "Change Request Form")).toBe(true);
    expect(fixtureClients.some((client) => client.contractRepository.additionalEngagements.some((engagement) => engagement.kind === "Change Request Form"))).toBe(true);
    expect(fixtureClients.flatMap((client) => client.contractRepository.additionalEngagements).every((engagement) => !engagement.referenceCode.startsWith("NOTE-"))).toBe(true);
  });

  it("produces a deterministic assignment reconciliation with controlled gaps", () => {
    const first = reconcileAssignments(fixtureClients, fixtureOrgDirectoryMembers);
    const second = reconcileAssignments(fixtureClients, fixtureOrgDirectoryMembers);
    const directoryNames = new Set(fixtureOrgDirectoryMembers.map((member) => member.name));

    expect(first).toEqual(second);
    expect(first.some((member) => member.preparer.aggregateWeight > 0)).toBe(true);
    expect(first.some((member) => member.checker.aggregateWeight > 0)).toBe(true);
    expect(first.some((member) => member.reviewer.aggregateWeight > 0)).toBe(true);
    expect(first.reduce((total, member) => total + member.assignmentControlGaps, 0)).toBeGreaterThan(0);
    expect(fixtureClients.filter((client) => client.assignment.preparer === client.assignment.checker || client.assignment.preparer === client.assignment.reviewer || client.assignment.checker === client.assignment.reviewer).length).toBeGreaterThan(0);
    expect(fixtureClients.flatMap((client) => [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]).filter((name) => name !== "Unassigned").every((name) => directoryNames.has(name))).toBe(true);
  });

  it("reconciles all three tower populations without counting synthetic weight", () => {
    const towers = reconcileAssignmentsByTower(fixtureClients);

    expect(towers).toHaveLength(3);
    expect(towers.reduce((total, tower) => total + tower.taxpayerCount, 0)).toBe(112);
    expect(towers.reduce((total, tower) => total + tower.aggregateWeight, 0)).toBe(225);
    expect(towers.every((tower) => Object.values(tower.weightMix).reduce((sum, count) => sum + count, 0) <= tower.taxpayerCount)).toBe(true);
  });

  it("uses the current Team directory as the tower population", () => {
    const towers = reconcileAssignmentsByTower(fixtureClients);
    expect(towers.map((tower) => [tower.tower, tower.taxpayerCount, tower.aggregateWeight])).toEqual([
      ["Tower A", 37, 74],
      ["Tower B", 37, 76],
      ["Tower C", 38, 75],
    ]);
    expect(fixtureOrgDirectoryMembers.filter((member) => member.tower === "Tower A")).toHaveLength(23);
    expect(fixtureOrgDirectoryMembers.filter((member) => member.tower === "Tower B")).toHaveLength(22);
    expect(fixtureOrgDirectoryMembers.filter((member) => member.tower === "Tower C")).toHaveLength(22);
  });
});
