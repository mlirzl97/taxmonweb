import {
  getClientWorkloadWeight,
  type FixtureClient,
  type FixtureOperatingModel,
  type FixtureSpecialistCase,
  type FixtureTeamMember,
  type FixtureWorkItem,
} from "@/lib/fixtures";
import type { RbacPersona } from "@/lib/domain/access";
import { isWorkAttention } from "@/lib/fixtures-read-model";

export const careerServiceLevelLabels = {
  "5.2": "Senior Manager",
  "5.1": "Manager",
  "4.2": "Assistant Manager",
  "4.1": "Supervisor",
  "3.2": "Team Leader",
  "3.1": "Senior Associate",
  "2.2": "Junior Associate",
  "2.1": "Associate",
  "1.1": "Intern",
} as const;

export const careerServiceLevelTitleLabels: Record<keyof typeof careerServiceLevelLabels, string> = {
  "5.2": "Senior Manager · HOD",
  "5.1": "Manager · Operations",
  "4.2": "Assistant Manager · Cluster Leader",
  "4.1": "Supervisor · Tower Leader",
  "3.2": "Team Leader",
  "3.1": "Senior Associate",
  "2.2": "Junior Associate",
  "2.1": "Associate",
  "1.1": "Intern",
};

export type CareerServiceLevel = keyof typeof careerServiceLevelLabels;
export type OrgChartRag = "GREEN" | "AMBER" | "RED" | "UNRESOLVED";

export type OrgChartNode = {
  id: string;
  name: string;
  careerServiceLevel: CareerServiceLevel;
  title: string;
  role: string;
  parentId: string | null;
  cluster: string;
  workloadPercent: number;
  rag: OrgChartRag;
  statusReason: string;
  photoUrl?: string | null;
  sourceStatus: "confirmed" | "chart-label-pending" | "illustrative";
  operatingModel?: FixtureOperatingModel;
  assignedClients?: number;
  clientWeight?: number;
  activeWork?: number;
  coverageGaps?: number;
  specialistCaseCount?: number;
  affectedTaxpayers?: number;
  specialistAttention?: number;
  active?: boolean;
};

export type OrgChartTreeNode = OrgChartNode & { children: OrgChartTreeNode[] };

export const orgChartRagLabels: Record<OrgChartRag, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
  UNRESOLVED: "Unresolved",
};

export const operatingModelLabels: Record<FixtureOperatingModel, string> = {
  ENGAGEMENT_AGILE: "Engagement team · agile",
  ENGAGEMENT_DEDICATED: "Engagement team · dedicated",
  TAX_TEAM: "Tax team",
};

export const reportingManagerLevelByCareerLevel: Partial<Record<CareerServiceLevel, CareerServiceLevel>> = {
  "5.1": "5.2",
  "4.2": "5.1",
  "4.1": "4.2",
  "3.2": "4.1",
  "3.1": "3.2",
  "2.2": "3.1",
  "2.1": "3.1",
};

export function isEngagementOperatingModel(model: FixtureOperatingModel): boolean {
  return model === "ENGAGEMENT_AGILE" || model === "ENGAGEMENT_DEDICATED";
}

export function isTaxTeamOperatingModel(model: FixtureOperatingModel): boolean {
  return model === "TAX_TEAM";
}

export function reportingManagerLevelFor(level: CareerServiceLevel): CareerServiceLevel | null {
  return reportingManagerLevelByCareerLevel[level] ?? null;
}

export function careerServiceLevelTitle(level: CareerServiceLevel): string {
  return careerServiceLevelTitleLabels[level];
}

/**
 * The prototype access selector represents a role and a named sanitized seat.
 * Production will resolve the seat from auth.uid() and effective assignments;
 * these IDs make the demo exercise the same boundary instead of showing every
 * person who happens to hold the selected role.
 */
export const demoStaffMemberIds: Readonly<Partial<Record<RbacPersona, string>>> = {
  PREPARER: "org-c1-extra-senior-associate-child-1",
  CHECKER: "org-c1-extra-senior-associate",
  REVIEWER: "org-c1-junior-supervisor",
};

export function staffMemberIdForPerspective(perspective: RbacPersona): string | null {
  return demoStaffMemberIds[perspective] ?? null;
}

const assignmentFieldForPersona: Partial<Record<RbacPersona, "preparer" | "checker" | "reviewer">> = {
  PREPARER: "preparer",
  CHECKER: "checker",
  REVIEWER: "reviewer",
};

/**
 * Returns the roster slice for a role-scoped staff lens. The prototype access
 * selector represents a POV rather than a named authenticated employee, so a
 * staff lens resolves to that seat and its effective management context.
 * Leadership/control lenses retain the full roster and are
 * still constrained by the selected organizational scope in the UI.
 */
export function teamMemberIdsForPerspective(
  members: readonly FixtureTeamMember[],
  clients: readonly FixtureClient[],
  perspective: RbacPersona,
): Set<string> {
  const staffMemberId = staffMemberIdForPerspective(perspective);
  if (staffMemberId) return reportingLineMemberIds(members, staffMemberId);

  const assignmentField = assignmentFieldForPersona[perspective];
  if (!assignmentField && perspective !== "TOWER_LEADER" && perspective !== "CLUSTER_LEADER") return new Set(members.map((member) => member.id));

  const assignedNames = new Set(clients.flatMap((client) => assignmentField ? [client.assignment[assignmentField]] : [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]).filter((name) => name !== "Unassigned"));
  const visibleIds = new Set(members.filter((member) => assignedNames.has(member.name) || (member.assignmentAliases ?? []).some((alias) => assignedNames.has(alias))).map((member) => member.id));

  const queue = [...visibleIds];
  while (queue.length > 0) {
    const memberId = queue.shift();
    if (!memberId) continue;
    const member = members.find((candidate) => candidate.id === memberId);
    const parentId = member?.reportsToOrgNodeId ?? null;
    if (parentId && !visibleIds.has(parentId)) {
      visibleIds.add(parentId);
      queue.push(parentId);
    }
  }

  return visibleIds;
}

/**
 * A staff member sees their own seat and effective management context only.
 * Downline people are intentionally excluded: reporting context is useful for
 * navigation, but it is not authority to inspect subordinate personnel.
 */
export function reportingLineMemberIds(members: readonly FixtureTeamMember[], memberId: string): Set<string> {
  const byId = new Map(members.map((member) => [member.id, member]));
  if (!byId.has(memberId)) return new Set();

  const visibleIds = new Set<string>([memberId]);
  let cursor = byId.get(memberId)?.reportsToOrgNodeId ?? null;
  while (cursor && !visibleIds.has(cursor)) {
    visibleIds.add(cursor);
    cursor = byId.get(cursor)?.reportsToOrgNodeId ?? null;
  }

  return visibleIds;
}

export function clientIsAssignedToMember(client: FixtureClient, member: FixtureTeamMember): boolean {
  const names = new Set([member.name, ...(member.assignmentAliases ?? [])]);
  return [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer].some((assignee) => names.has(assignee));
}

/**
 * Assignment visibility is role-specific. Being a Checker must not grant the
 * Preparer view (or action) for the same taxpayer.
 */
export function clientIsAssignedForRole(
  client: FixtureClient,
  member: FixtureTeamMember,
  role: "PREPARER" | "CHECKER" | "REVIEWER",
): boolean {
  const assignmentField = role === "PREPARER" ? "preparer" : role === "CHECKER" ? "checker" : "reviewer";
  const names = new Set([member.name, ...(member.assignmentAliases ?? [])]);
  return names.has(client.assignment[assignmentField]);
}

export function clientMatchesPerspective(client: FixtureClient, perspective: RbacPersona, members: readonly FixtureTeamMember[]): boolean {
  const staffMemberId = staffMemberIdForPerspective(perspective);
  if (!staffMemberId) return false;
  const member = members.find((candidate) => candidate.id === staffMemberId);
  return Boolean(member && (perspective === "PREPARER" || perspective === "CHECKER" || perspective === "REVIEWER") && clientIsAssignedForRole(client, member, perspective));
}

export function workMatchesStaffPerspective(
  work: FixtureWorkItem,
  perspective: RbacPersona,
  clients: readonly FixtureClient[],
  members: readonly FixtureTeamMember[],
): boolean {
  const client = clients.find((candidate) => candidate.id === work.clientId);
  return Boolean(client && clientMatchesPerspective(client, perspective, members));
}

const careerLevels = new Set<CareerServiceLevel>(Object.keys(careerServiceLevelLabels) as CareerServiceLevel[]);

function careerLevelFor(member: FixtureTeamMember, fallback: OrgChartNode["careerServiceLevel"] = "1.1"): CareerServiceLevel {
  return member.careerServiceLevel && careerLevels.has(member.careerServiceLevel as CareerServiceLevel)
    ? member.careerServiceLevel as CareerServiceLevel
    : fallback;
}

/**
 * Projects the editable canonical roster into the existing org-chart shape.
 * This deliberately does not create a second hierarchy: the roster is the source,
 * while baseline chart metadata remains a sanitized fixture fallback.
 */
export function buildEditableOrgChartNodes(
  members: readonly FixtureTeamMember[],
  baselineNodes: readonly OrgChartNode[],
): OrgChartNode[] {
  const baselineById = new Map(baselineNodes.map((node) => [node.id, node]));

  return members
    .filter((member) => member.id !== "member-tax-control")
    .map((member) => {
      const baseline = baselineById.get(member.id);
      const careerServiceLevel = careerLevelFor(member, baseline?.careerServiceLevel);
      return {
        id: member.id,
        name: member.name,
        careerServiceLevel,
        title: member.title,
        role: member.role,
        parentId: member.reportsToOrgNodeId ?? null,
        cluster: member.cluster,
        workloadPercent: baseline?.workloadPercent ?? 0,
        rag: baseline?.rag ?? "UNRESOLVED",
        statusReason: member.active ? baseline?.statusReason ?? "New roster member; operating status pending confirmation." : `Inactive from ${member.effectiveFrom ?? "effective date not recorded"}.`,
        sourceStatus: baseline?.sourceStatus ?? "illustrative",
        photoUrl: baseline?.photoUrl,
        operatingModel: member.operatingModel,
        active: member.active,
      };
    });
}

export function clampWorkloadPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function buildOrgChartTree(nodes: readonly OrgChartNode[]): OrgChartTreeNode[] {
  const byId = new Map(nodes.map((node) => [node.id, { ...node, children: [] as OrgChartTreeNode[] }]));
  const roots: OrgChartTreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export type TeamMemberLoad = FixtureTeamMember & {
  portfolioApplicable: boolean;
  assignedClients: number;
  clientWeight: number;
  unresolvedWeightClients: number;
  activeWork: number;
  coverageGaps: number;
  assignedClientIds: string[];
  specialistCaseIds: string[];
  activeSpecialistCases: number;
  affectedTaxpayers: number;
  specialistAttention: number;
};

export type TeamTowerSummary = {
  tower: string;
  cluster: string;
  members: number;
  clients: number;
  clientWeight: number;
  unresolvedWeightClients: number;
  activeWork: number;
  coverageGaps: number;
};

export type TeamSpecialistSummary = {
  memberCount: number;
  caseCount: number;
  affectedTaxpayerCount: number;
  attentionCount: number;
};

export type TeamWorkloadGuide = TeamMemberLoad & {
  capacityApplicable: boolean;
  capacityTier: number | null;
  capacityLabel: string;
  knownPortfolioWeight: number;
  unresolvedWeightClients: number;
  adjustedLoad: number | null;
  cohortAverageAdjustedLoad: number | null;
  relativeToCohortAveragePercent: number | null;
};

export type TeamWorkloadSummary = {
  knownPortfolioWeight: number;
  capacityUnits: number;
  averageWeightPerCapacityUnit: number | null;
  unresolvedWeightClients: number;
};

export type TeamControlPulse = {
  scope: FixtureWorkItem["scope"];
  totalWork: number;
  clearWork: number;
  attentionWork: number;
  blockedWork: number;
  clearPercent: number;
  state: "ALL_CLEAR" | "IN_PROGRESS" | "NEEDS_ATTENTION" | "NO_WORK";
};

export type PersonalControlPulse = {
  totalWork: number;
  clearWork: number;
  attentionWork: number;
  blockedWork: number;
  clearPercent: number;
  nextWork?: Pick<FixtureWorkItem, "id" | "client" | "title" | "nextAction" | "status">;
};

/**
 * Gives a staff member a private progress view without introducing a score,
 * rank, or second source of truth. The next work item is attention-first so
 * the visual reward points to a safe operational action, not speed.
 */
export function derivePersonalControlPulse(work: readonly FixtureWorkItem[]): PersonalControlPulse {
  const clearWork = work.filter((item) => !isWorkAttention(item)).length;
  const blockedWork = work.filter((item) => Boolean(item.blocker)).length;
  const attentionWork = work.filter((item) => isWorkAttention(item)).length;
  const rankedWork = [...work].sort((left, right) => {
    const rank = (item: FixtureWorkItem) => item.blocker ? 0 : item.status === "RED" ? 1 : item.status === "AMBER" ? 2 : item.status === "UNRESOLVED" ? 3 : 4;
    return rank(left) - rank(right);
  });

  return {
    totalWork: work.length,
    clearWork,
    attentionWork,
    blockedWork,
    clearPercent: work.length ? Math.round((clearWork / work.length) * 100) : 0,
    nextWork: rankedWork[0] ? {
      id: rankedWork[0].id,
      client: rankedWork[0].client,
      title: rankedWork[0].title,
      nextAction: rankedWork[0].nextAction,
      status: rankedWork[0].status,
    } : undefined,
  };
}

/**
 * A team-level operating signal derived from the canonical work projection.
 * This is deliberately not a points score or a second status system: it tells
 * the team how close its visible work is to an all-clear position.
 */
export function deriveTeamControlPulses(work: readonly FixtureWorkItem[]): TeamControlPulse[] {
  const scopes = Array.from(new Set(work.map((item) => item.scope)));

  return scopes.map((scope) => {
    const scopedWork = work.filter((item) => item.scope === scope);
    const clearWork = scopedWork.filter((item) => !isWorkAttention(item)).length;
    const blockedWork = scopedWork.filter((item) => Boolean(item.blocker)).length;
    const attentionWork = scopedWork.filter((item) => isWorkAttention(item)).length;
    const totalWork = scopedWork.length;

    return {
      scope,
      totalWork,
      clearWork,
      attentionWork,
      blockedWork,
      clearPercent: totalWork ? Math.round((clearWork / totalWork) * 100) : 0,
      state: totalWork === 0
        ? "NO_WORK"
        : attentionWork === 0
          ? "ALL_CLEAR"
          : blockedWork > 0
            ? "NEEDS_ATTENTION"
            : "IN_PROGRESS",
    };
  });
}

export function deriveTeamMemberLoad(
  members: readonly FixtureTeamMember[],
  clients: readonly FixtureClient[],
  work: readonly FixtureWorkItem[],
  specialistCases: readonly FixtureSpecialistCase[] = [],
): TeamMemberLoad[] {
  return members.map((member) => {
    const assignmentNames = [member.name, ...(member.assignmentAliases ?? [])];
    const portfolioApplicable = isEngagementOperatingModel(member.operatingModel);
    const assignedClients = portfolioApplicable
      ? clients.filter((client) => assignmentNames.some((name) => isAssignedToMember(client, name)))
      : [];
    const assignedClientIds = assignedClients.map((client) => client.id);
    const unresolvedWeightClients = assignedClients.filter((client) => typeof client.entities[0]?.profile.sourceFinalWeight !== "number").length;
    const assignedSpecialistCases = specialistCases.filter((specialistCase) => specialistCase.assigneeMemberIds.includes(member.id));
    const affectedTaxpayerIds = new Set(assignedSpecialistCases.map((specialistCase) => specialistCase.taxpayerClientId));

    return {
      ...member,
      portfolioApplicable,
      assignedClients: assignedClients.length,
      clientWeight: assignedClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0),
      unresolvedWeightClients,
      activeWork: portfolioApplicable ? work.filter((item) => assignmentNames.includes(item.owner)).length : 0,
      coverageGaps: assignedClients.filter((client) => hasCoverageGap(client)).length,
      assignedClientIds,
      specialistCaseIds: assignedSpecialistCases.map((specialistCase) => specialistCase.id),
      activeSpecialistCases: assignedSpecialistCases.length,
      affectedTaxpayers: affectedTaxpayerIds.size,
      specialistAttention: assignedSpecialistCases.filter((specialistCase) => specialistCase.attention === "AMBER" || specialistCase.attention === "RED" || specialistCase.attention === "UNRESOLVED").length,
    };
  });
}

/**
 * A deliberately ordinal planning guide, not a performance score. `.2` levels
 * sit one tier below the next `.1` level while they are in training.
 */
const capacityTierByCareerLevel: Partial<Record<CareerServiceLevel, number>> = {
  "1.1": 1,
  "2.1": 2,
  "2.2": 3,
  "3.1": 4,
  "3.2": 5,
  "4.1": 6,
  "4.2": 7,
  "5.1": 8,
};

function capacityLabelFor(level: string | undefined): string {
  if (!level) return "Capacity not configured";
  if (level.endsWith(".2")) {
    const nextLevel = `${Number(level[0]) + 1}.1`;
    return `Training toward ${nextLevel}`;
  }
  return "Relative capacity guide";
}

function isHodOversight(member: TeamMemberLoad): boolean {
  return member.tower === "All A&T" && member.careerServiceLevel === "5.2";
}

export function deriveTeamWorkloadGuide(load: readonly TeamMemberLoad[], clients: readonly FixtureClient[]): TeamWorkloadGuide[] {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const preliminary = load.map((member) => {
    const assignedClients = member.assignedClientIds.map((id) => clientsById.get(id)).filter((client): client is FixtureClient => Boolean(client));
    const knownPortfolioWeight = assignedClients.reduce((total, client) => {
      const weight = client.entities[0]?.profile.sourceFinalWeight;
      return typeof weight === "number" ? total + weight : total;
    }, 0);
    const unresolvedWeightClients = assignedClients.filter((client) => typeof client.entities[0]?.profile.sourceFinalWeight !== "number").length;
    const capacityApplicable = member.active && member.portfolioApplicable && !isHodOversight(member) && Boolean(member.careerServiceLevel && capacityTierByCareerLevel[member.careerServiceLevel as CareerServiceLevel]);
    const capacityTier = capacityApplicable ? capacityTierByCareerLevel[member.careerServiceLevel as CareerServiceLevel] ?? null : null;

    return {
      ...member,
      capacityApplicable,
      capacityTier,
      capacityLabel: isHodOversight(member) ? "HOD oversight; explicit assignments only" : member.portfolioApplicable ? capacityLabelFor(member.careerServiceLevel) : "Specialist cases; portfolio weight not applicable",
      knownPortfolioWeight,
      unresolvedWeightClients,
      adjustedLoad: capacityApplicable && capacityTier && unresolvedWeightClients === 0 ? knownPortfolioWeight / capacityTier : null,
      cohortAverageAdjustedLoad: null,
      relativeToCohortAveragePercent: null,
    };
  });
  const capacityRows = preliminary.filter((row) => row.capacityApplicable && row.adjustedLoad !== null);
  const cohortAverageAdjustedLoad = capacityRows.length ? capacityRows.reduce((total, row) => total + (row.adjustedLoad ?? 0), 0) / capacityRows.length : null;

  return preliminary.map((row) => ({
    ...row,
    cohortAverageAdjustedLoad,
    relativeToCohortAveragePercent: row.adjustedLoad !== null && cohortAverageAdjustedLoad && cohortAverageAdjustedLoad > 0
      ? Math.round((row.adjustedLoad / cohortAverageAdjustedLoad) * 100)
      : null,
  }));
}

export function summarizeTeamWorkloadGuide(guide: readonly TeamWorkloadGuide[], clients: readonly FixtureClient[]): TeamWorkloadSummary {
  const capacityRows = guide.filter((row) => row.capacityApplicable && row.capacityTier !== null);
  const assignedClientIds = new Set(guide.filter((row) => row.portfolioApplicable).flatMap((row) => row.assignedClientIds));
  const uniquePortfolioClients = clients.filter((client) => assignedClientIds.has(client.id));
  const knownPortfolioWeight = uniquePortfolioClients.reduce((total, client) => {
    const weight = client.entities[0]?.profile.sourceFinalWeight;
    return typeof weight === "number" ? total + weight : total;
  }, 0);
  const unresolvedWeightClients = uniquePortfolioClients.filter((client) => typeof client.entities[0]?.profile.sourceFinalWeight !== "number").length;
  const capacityUnits = capacityRows.reduce((total, row) => total + (row.capacityTier ?? 0), 0);
  return {
    knownPortfolioWeight,
    capacityUnits,
    averageWeightPerCapacityUnit: capacityRows.length && unresolvedWeightClients === 0 ? knownPortfolioWeight / Math.max(1, capacityUnits) : null,
    unresolvedWeightClients,
  };
}

export function overlayOrgChartLoad(nodes: readonly OrgChartNode[], load: readonly TeamMemberLoad[], guide: readonly TeamWorkloadGuide[] = []): OrgChartNode[] {
  const maxClientWeight = Math.max(...load.filter((member) => member.portfolioApplicable).map((member) => member.clientWeight), 0);
  const byName = new Map(load.map((member) => [member.name, member]));
  const guideById = new Map(guide.map((member) => [member.id, member]));

  return nodes.map((node) => {
    const member = byName.get(node.name);
    if (!member) return node;

    return {
      ...node,
      operatingModel: member.operatingModel,
      workloadPercent: guideById.has(member.id) ? guideById.get(member.id)?.relativeToCohortAveragePercent ?? 0 : (member.portfolioApplicable && maxClientWeight > 0 ? Math.round((member.clientWeight / maxClientWeight) * 100) : 0),
      assignedClients: member.assignedClients,
      clientWeight: member.clientWeight,
      activeWork: member.activeWork,
      coverageGaps: member.coverageGaps,
      specialistCaseCount: member.activeSpecialistCases,
      affectedTaxpayers: member.affectedTaxpayers,
      specialistAttention: member.specialistAttention,
    };
  });
}

export function deriveTeamTowerSummary(load: readonly TeamMemberLoad[], clients: readonly FixtureClient[], work: readonly FixtureWorkItem[]): TeamTowerSummary[] {
  const towers = Array.from(new Set(clients.map((client) => client.assignment.tower)));

  return towers.map((tower) => {
    const towerClients = clients.filter((client) => client.assignment.tower === tower);
    const towerMembers = load.filter((member) => member.active && member.tower === tower && isEngagementOperatingModel(member.operatingModel));

    return {
      tower,
      cluster: towerClients[0]?.assignment.cluster ?? "—",
      members: towerMembers.length,
      clients: towerClients.length,
      clientWeight: towerClients.reduce((total, client) => {
        const weight = client.entities[0]?.profile.sourceFinalWeight;
        return typeof weight === "number" ? total + weight : total;
      }, 0),
      unresolvedWeightClients: towerClients.filter((client) => typeof client.entities[0]?.profile.sourceFinalWeight !== "number").length,
      activeWork: work.filter((item) => item.scope === tower).length,
      coverageGaps: towerClients.filter(hasCoverageGap).length,
    };
  });
}

export function deriveTeamSpecialistSummary(
  load: readonly TeamMemberLoad[],
  specialistCases: readonly FixtureSpecialistCase[],
): TeamSpecialistSummary {
  return {
    memberCount: load.filter((member) => member.active && isTaxTeamOperatingModel(member.operatingModel)).length,
    caseCount: specialistCases.length,
    affectedTaxpayerCount: new Set(specialistCases.map((specialistCase) => specialistCase.taxpayerClientId)).size,
    attentionCount: specialistCases.filter((specialistCase) => specialistCase.attention === "AMBER" || specialistCase.attention === "RED" || specialistCase.attention === "UNRESOLVED").length,
  };
}

export function isAssignedToMember(client: FixtureClient, memberName: string): boolean {
  return [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer].includes(memberName);
}

export function hasCoverageGap(client: FixtureClient): boolean {
  const assignment = client.assignment;
  return [assignment.preparer, assignment.checker, assignment.reviewer].some((member) => member === "Unassigned")
    || new Set([assignment.preparer, assignment.checker, assignment.reviewer]).size < 3;
}
