export type StaffAccessProfile = "VIEWER" | "STAFF" | "TEAM_LEAD" | "SYSTEM_USER_ADMIN" | "HOD_MASTER_ADMIN";
export type StaffScopeKind = "own_assigned_work" | "team_tower" | "cluster" | "cross_portfolio_tax_control" | "all_a_and_t";

export type StaffAccessProfileDefinition = {
  id: StaffAccessProfile;
  label: string;
  description: string;
  roleKey: "system_admin" | "leader" | "team_member" | "reviewer";
  defaultScope: StaffScopeKind;
  capabilities: readonly string[];
};

const staffCapabilities = ["ViewAssignedWork", "ViewScopedPortfolio", "ExecuteGeneratedComplianceWork"] as const;

export const staffAccessProfiles: readonly StaffAccessProfileDefinition[] = [
  {
    id: "VIEWER",
    label: "Viewer",
    description: "Read-only access to the authorized operating scope.",
    roleKey: "team_member",
    defaultScope: "own_assigned_work",
    capabilities: ["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"],
  },
  {
    id: "STAFF",
    label: "Staff",
    description: "Assigned work execution and scoped Team/Client visibility.",
    roleKey: "team_member",
    defaultScope: "own_assigned_work",
    capabilities: staffCapabilities,
  },
  {
    id: "TEAM_LEAD",
    label: "Team Lead",
    description: "Manage people and structure within the assigned tower or cluster.",
    roleKey: "leader",
    defaultScope: "team_tower",
    capabilities: [...staffCapabilities, "AdministerOrganization"],
  },
  {
    id: "SYSTEM_USER_ADMIN",
    label: "System & User Admin",
    description: "Manage users, access, and organization configuration; no tax-control authority.",
    roleKey: "system_admin",
    defaultScope: "own_assigned_work",
    capabilities: ["AdministerUsers", "AdministerOrganization"],
  },
  {
    id: "HOD_MASTER_ADMIN",
    label: "HOD / Master Admin",
    description: "Global business governance and authorized operational intervention.",
    roleKey: "leader",
    defaultScope: "all_a_and_t",
    capabilities: [
      "ViewAssignedWork",
      "ViewScopedPortfolio",
      "ExecuteGeneratedComplianceWork",
      "ReviewTaxProfile",
      "CorrectTaxProfile",
      "ValidateTaxProfile",
      "ViewTaxControlHistory",
      "MaintainClientRepository",
      "AdministerUsers",
      "AdministerOrganization",
      "MaintainGeneratedComplianceWork",
      "MaintainDeadlineControl",
      "ManageWorkPeriodLock",
      "PerformWorkQA",
    ],
  },
] as const;

export function staffAccessProfileDefinition(id: StaffAccessProfile): StaffAccessProfileDefinition {
  return staffAccessProfiles.find((profile) => profile.id === id) ?? staffAccessProfiles[1];
}

export function isStaffAccessProfile(value: unknown): value is StaffAccessProfile {
  return typeof value === "string" && staffAccessProfiles.some((profile) => profile.id === value);
}

export function staffScopeKindLabel(scope: StaffScopeKind): string {
  return {
    own_assigned_work: "Own assigned work",
    team_tower: "Assigned tower",
    cluster: "Assigned cluster",
    cross_portfolio_tax_control: "Cross-portfolio Tax Control",
    all_a_and_t: "All A&T",
  }[scope];
}
