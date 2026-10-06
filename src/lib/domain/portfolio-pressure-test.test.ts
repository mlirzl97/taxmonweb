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

  it("marks every client with an explicit recurring or ad hoc service type", () => {
    const counts = fixtureClients.reduce<Record<"Engagement" | "Tax Ad Hoc", number>>((result, client) => {
      result[client.serviceType] += 1;
      return result;
    }, { Engagement: 0, "Tax Ad Hoc": 0 });

    expect(counts.Engagement).toBeGreaterThan(0);
    expect(counts["Tax Ad Hoc"]).toBeGreaterThan(0);
    expect(counts.Engagement + counts["Tax Ad Hoc"]).toBe(112);
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
      ["Tower Central", 37, 76],
      ["Tower North", 37, 74],
      ["Tower South", 38, 75],
    ]);
    expect(fixtureOrgDirectoryMembers.filter((member) => member.tower === "Tower North")).toHaveLength(23);
    expect(fixtureOrgDirectoryMembers.filter((member) => member.tower === "Tower Central")).toHaveLength(22);
    expect(fixtureOrgDirectoryMembers.filter((member) => member.tower === "Tower South")).toHaveLength(22);
  });
});
