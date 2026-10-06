import {
  getClientWorkloadWeight,
  type FixtureClient,
  type FixtureSourceWeightClassification,
  type FixtureTeamMember,
} from "@/lib/fixtures";

export type PortfolioWeightReconciliation = {
  sourceWeightedProfiles: number;
  aggregateSourceFinalWeight: number;
  byClassification: Record<FixtureSourceWeightClassification, { count: number; aggregateFinalWeight: number }>;
  syntheticAdditionalProfiles: number;
  totalUiTestPopulation: number;
};

export type AssignmentRoleSummary = {
  clientCount: number;
  aggregateWeight: number;
};

export type AssignmentReconciliation = FixtureTeamMember & {
  preparer: AssignmentRoleSummary;
  checker: AssignmentRoleSummary;
  reviewer: AssignmentRoleSummary;
  assignmentControlGaps: number;
};

export type TowerAssignmentReconciliation = {
  tower: string;
  taxpayerCount: number;
  aggregateWeight: number;
  weightMix: Record<FixtureSourceWeightClassification, number>;
  attentionCount: number;
  assignmentGaps: number;
};

const sourceClassifications: readonly FixtureSourceWeightClassification[] = ["Extremely Heavy", "Heavy", "Moderate", "Light", "Super Light"];

export function reconcilePortfolioWeights(clients: readonly FixtureClient[]): PortfolioWeightReconciliation {
  const byClassification = Object.fromEntries(sourceClassifications.map((classification) => [classification, { count: 0, aggregateFinalWeight: 0 }])) as PortfolioWeightReconciliation["byClassification"];
  const sourceWeightedClients = clients.filter((client) => client.entities[0]?.profile.fixtureSource === "source_weighted_portfolio");
  const syntheticClients = clients.filter((client) => client.entities[0]?.profile.fixtureSource === "synthetic_portfolio_test");

  for (const client of sourceWeightedClients) {
    const profile = client.entities[0]?.profile;
    if (!profile?.sourceWeightClassification) continue;
    byClassification[profile.sourceWeightClassification].count += 1;
    byClassification[profile.sourceWeightClassification].aggregateFinalWeight += profile.sourceFinalWeight ?? 0;
  }

  return {
    sourceWeightedProfiles: sourceWeightedClients.length,
    aggregateSourceFinalWeight: sourceWeightedClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0),
    byClassification,
    syntheticAdditionalProfiles: syntheticClients.length,
    totalUiTestPopulation: clients.length,
  };
}

function emptyRoleSummary(): AssignmentRoleSummary {
  return { clientCount: 0, aggregateWeight: 0 };
}

export function reconcileAssignments(clients: readonly FixtureClient[], members: readonly FixtureTeamMember[]): AssignmentReconciliation[] {
  return members.map((member) => {
    const summary: Record<"preparer" | "checker" | "reviewer", AssignmentRoleSummary> = {
      preparer: emptyRoleSummary(),
      checker: emptyRoleSummary(),
      reviewer: emptyRoleSummary(),
    };
    let assignmentControlGaps = 0;

    for (const client of clients) {
      const weight = getClientWorkloadWeight(client);
      for (const role of ["preparer", "checker", "reviewer"] as const) {
        if (client.assignment[role] === member.name) {
          summary[role].clientCount += 1;
          summary[role].aggregateWeight += weight;
        }
      }

      const roles = [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer];
      if (roles.includes(member.name) && (roles.some((role) => role === "Unassigned") || new Set(roles).size < 3)) assignmentControlGaps += 1;
    }

    return { ...member, ...summary, assignmentControlGaps };
  });
}

export function reconcileAssignmentsByTower(clients: readonly FixtureClient[]): TowerAssignmentReconciliation[] {
  const towers = Array.from(new Set(clients.map((client) => client.assignment.tower))).sort();

  return towers.map((tower) => {
    const towerClients = clients.filter((client) => client.assignment.tower === tower);
    const weightMix = Object.fromEntries(sourceClassifications.map((classification) => [classification, 0])) as Record<FixtureSourceWeightClassification, number>;

    for (const client of towerClients) {
      const classification = client.entities[0]?.profile.sourceWeightClassification;
      if (classification) weightMix[classification] += 1;
    }

    return {
      tower,
      taxpayerCount: towerClients.length,
      aggregateWeight: towerClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0),
      weightMix,
      attentionCount: towerClients.filter((client) => {
        const profile = client.entities[0]?.profile;
        const roles = [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer];
        return Boolean(profile && (profile.attention.length > 0 || profile.profileState !== "Active" || roles.includes("Unassigned") || new Set(roles).size < 3));
      }).length,
      assignmentGaps: towerClients.filter((client) => {
        const roles = [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer];
        return roles.includes("Unassigned") || new Set(roles).size < 3;
      }).length,
    };
  });
}
