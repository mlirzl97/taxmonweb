import {
  getClientWorkloadWeight,
  type FixtureClient,
  type FixtureOperatingModel,
  type FixtureSpecialistCase,
  type FixtureTeamMember,
  type FixtureWorkItem,
} from "@/lib/fixtures";

export const careerServiceLevelLabels = {
  "5.2": "Senior Manager",
  "5.1": "Manager",
  "4.2": "Assistant Manager",
  "4.1": "Supervisor",
  "3.2": "Team Lead",
  "3.1": "Senior Associate",
  "2.2": "Junior Associate",
  "2.1": "Associate",
  "1.1": "Intern",
} as const;

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
};

export type OrgChartTreeNode = OrgChartNode & { children: OrgChartTreeNode[] };

export const orgChartRagLabels: Record<OrgChartRag, string> = {
  GREEN: "Green",
  AMBER: "Amber",
  RED: "Red",
  UNRESOLVED: "Unresolved",
};

export const operatingModelLabels: Record<FixtureOperatingModel, string> = {
  DELIVERY: "Recurring portfolio",
  SPECIALIST_CASE: "Specialist cases",
};

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
  activeWork: number;
  coverageGaps: number;
};

export type TeamSpecialistSummary = {
  memberCount: number;
  caseCount: number;
  affectedTaxpayerCount: number;
  attentionCount: number;
};

export function deriveTeamMemberLoad(
  members: readonly FixtureTeamMember[],
  clients: readonly FixtureClient[],
  work: readonly FixtureWorkItem[],
  specialistCases: readonly FixtureSpecialistCase[] = [],
): TeamMemberLoad[] {
  return members.map((member) => {
    const assignmentNames = [member.name, ...(member.assignmentAliases ?? [])];
    const portfolioApplicable = member.operatingModel === "DELIVERY";
    const assignedClients = portfolioApplicable
      ? clients.filter((client) => assignmentNames.some((name) => isAssignedToMember(client, name)))
      : [];
    const assignedClientIds = assignedClients.map((client) => client.id);
    const assignedSpecialistCases = specialistCases.filter((specialistCase) => specialistCase.assigneeMemberIds.includes(member.id));
    const affectedTaxpayerIds = new Set(assignedSpecialistCases.map((specialistCase) => specialistCase.taxpayerClientId));

    return {
      ...member,
      portfolioApplicable,
      assignedClients: assignedClients.length,
      clientWeight: assignedClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0),
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

export function overlayOrgChartLoad(nodes: readonly OrgChartNode[], load: readonly TeamMemberLoad[]): OrgChartNode[] {
  const maxClientWeight = Math.max(...load.filter((member) => member.portfolioApplicable).map((member) => member.clientWeight), 0);
  const byName = new Map(load.map((member) => [member.name, member]));

  return nodes.map((node) => {
    const member = byName.get(node.name);
    if (!member) return node;

    return {
      ...node,
      operatingModel: member.operatingModel,
      workloadPercent: member.portfolioApplicable && maxClientWeight > 0 ? Math.round((member.clientWeight / maxClientWeight) * 100) : 0,
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
    const towerMembers = load.filter((member) => member.tower === tower && member.operatingModel === "DELIVERY");

    return {
      tower,
      cluster: towerClients[0]?.assignment.cluster ?? "—",
      members: towerMembers.length,
      clients: towerClients.length,
      clientWeight: towerClients.reduce((total, client) => total + getClientWorkloadWeight(client), 0),
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
    memberCount: load.filter((member) => member.operatingModel === "SPECIALIST_CASE").length,
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
