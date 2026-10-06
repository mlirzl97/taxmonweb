import { fixtureClients, fixtureTeamMembers } from "@/lib/fixtures";

import { reconcileAssignments, reconcileAssignmentsByTower, reconcilePortfolioWeights } from "./portfolio-pressure-test";

/** Development-only inspection surface for the 112-record pressure test. */
export function buildPortfolioPressureTestReport() {
  return {
    population: reconcilePortfolioWeights(fixtureClients),
    assignments: reconcileAssignments(fixtureClients, fixtureTeamMembers).map((member) => ({
      person: member.name,
      role: member.role,
      tower: member.tower,
      cluster: member.cluster,
      preparerClientCount: member.preparer.clientCount,
      preparerAggregateWeight: member.preparer.aggregateWeight,
      checkerClientCount: member.checker.clientCount,
      checkerAggregateWeight: member.checker.aggregateWeight,
      reviewerClientCount: member.reviewer.clientCount,
      reviewerAggregateWeight: member.reviewer.aggregateWeight,
      assignmentControlGaps: member.assignmentControlGaps,
    })),
    towers: reconcileAssignmentsByTower(fixtureClients),
  };
}
