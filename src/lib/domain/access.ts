export const priorityCapabilities = {
  preparer: ["ViewAssignedWork", "ExecuteGeneratedComplianceWork"],
  checker: ["ViewAssignedWork", "ExecuteGeneratedComplianceWork"],
  reviewer: ["ViewAssignedWork", "ExecuteGeneratedComplianceWork"],
  taxTeam: [
    "ViewScopedPortfolio",
    "ReviewTaxProfile",
    "CorrectTaxProfile",
    "ValidateTaxProfile",
    "MaintainDeadlineControl",
    "ViewTaxControlHistory",
    "MaintainClientRepository",
    "ManageWorkPeriodLock",
    "PerformWorkQA",
  ],
  hod: [
    "ViewScopedPortfolio",
    "ValidateTaxProfile",
    "MaintainDeadlineControl",
    "ViewTaxControlHistory",
    "MaintainClientRepository",
  ],
  masterAdmin: [
    "ViewScopedPortfolio",
    "ReviewTaxProfile",
    "CorrectTaxProfile",
    "ValidateTaxProfile",
    "ViewTaxControlHistory",
    "MaintainClientRepository",
    "ApproveComplianceUniverse",
    "MaintainRulesLibrary",
    "MaintainDeadlineControl",
    "MaintainHolidayMaster",
    "MaintainControlTemplate",
    "ChangeServiceScope",
    "ReassignWork",
    "ReopenWork",
    "CancelOrSupersedeWork",
    "PerformElevatedOverride",
  ],
} as const;

export type RbacPersona = "PREPARER" | "CHECKER" | "REVIEWER" | "TOWER_LEADER" | "CLUSTER_LEADER" | "TAX_CONTROL" | "MASTER_ADMIN" | "SYSTEM_ADMIN" | "SUPER_ADMIN";

/**
 * Prototype access levels are intentionally coarse. They describe the strongest
 * action available in a module; they do not replace capability, scope, stage,
 * SoD, RLS, or server-side command authorization.
 */
export type AccessLevel = "NONE" | "VIEW" | "ACT" | "APPROVE" | "GOVERN" | "OVERRIDE";

export type ModuleKey = "control_tower" | "team" | "tax_team" | "clients" | "work" | "bir_center" | "admin";

export type AccessMatrix = { [persona in RbacPersona]: Record<ModuleKey, AccessLevel> };

/**
 * Team row actions are deliberately narrower than module access. A person may
 * be visible in Team without being allowed to change the roster or client
 * ownership. These actions are a prototype policy seam; production must still
 * enforce capability, scope, actor history and RLS on the server.
 */
export type TeamAction =
  | "VIEW_PERSON"
  | "ADD_PERSON"
  | "EDIT_STRUCTURE"
  | "DEACTIVATE_PERSON"
  | "VIEW_ASSIGNMENTS"
  | "MANAGE_ASSIGNMENTS";

export type SubmoduleKey =
  | "control_tower.overview"
  | "control_tower.attention"
  | "team.overview"
  | "team.people"
  | "team.organization"
  | "team.coverage"
  | "clients.registry"
  | "clients.profile"
  | "clients.tax_profile"
  | "clients.authorities"
  | "clients.history"
  | "work.my_work"
  | "work.team_work"
  | "work.calendar"
  | "work.detail"
  | "bir_center.overview"
  | "bir_center.tax_types_forms"
  | "bir_center.directory"
  | "bir_center.sources"
  | "admin.overview"
  | "admin.users_access"
  | "admin.organization"
  | "admin.calendar_rules"
  | "admin.audit";

const accessRank: Record<AccessLevel, number> = { NONE: 0, VIEW: 1, ACT: 2, APPROVE: 3, GOVERN: 4, OVERRIDE: 5 };

const moduleAccess: AccessMatrix = {
  PREPARER: { control_tower: "VIEW", team: "VIEW", tax_team: "NONE", clients: "VIEW", work: "ACT", bir_center: "VIEW", admin: "NONE" },
  CHECKER: { control_tower: "VIEW", team: "VIEW", tax_team: "NONE", clients: "VIEW", work: "ACT", bir_center: "VIEW", admin: "NONE" },
  REVIEWER: { control_tower: "VIEW", team: "VIEW", tax_team: "NONE", clients: "VIEW", work: "ACT", bir_center: "VIEW", admin: "NONE" },
  TOWER_LEADER: { control_tower: "APPROVE", team: "ACT", tax_team: "NONE", clients: "ACT", work: "APPROVE", bir_center: "VIEW", admin: "NONE" },
  CLUSTER_LEADER: { control_tower: "APPROVE", team: "ACT", tax_team: "NONE", clients: "ACT", work: "APPROVE", bir_center: "VIEW", admin: "NONE" },
  TAX_CONTROL: { control_tower: "VIEW", team: "GOVERN", tax_team: "APPROVE", clients: "GOVERN", work: "GOVERN", bir_center: "GOVERN", admin: "GOVERN" },
  MASTER_ADMIN: { control_tower: "OVERRIDE", team: "GOVERN", tax_team: "GOVERN", clients: "GOVERN", work: "OVERRIDE", bir_center: "GOVERN", admin: "GOVERN" },
  SYSTEM_ADMIN: { control_tower: "NONE", team: "VIEW", tax_team: "NONE", clients: "NONE", work: "NONE", bir_center: "VIEW", admin: "NONE" },
  SUPER_ADMIN: { control_tower: "OVERRIDE", team: "OVERRIDE", tax_team: "OVERRIDE", clients: "OVERRIDE", work: "OVERRIDE", bir_center: "OVERRIDE", admin: "OVERRIDE" },
};

export function cloneAccessMatrix(): AccessMatrix {
  return Object.fromEntries(Object.entries(moduleAccess).map(([persona, access]) => [persona, { ...access }])) as AccessMatrix;
}

export function isAccessMatrix(value: unknown): value is AccessMatrix {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (Object.entries(moduleAccess) as [RbacPersona, Record<ModuleKey, AccessLevel>][]).every(([persona, template]) => {
    const row = candidate[persona];
    if (!row || typeof row !== "object") return false;
    const access = row as Record<string, unknown>;
    return (Object.keys(template) as ModuleKey[]).every((module) => typeof access[module] === "string" && access[module] in accessRank);
  });
}

const routeModules: Readonly<Record<string, ModuleKey>> = {
  "/app/control-tower": "control_tower",
  "/app/team": "team",
  "/app/tax-team": "tax_team",
  "/app/clients": "clients",
  "/app/work": "work",
  "/app/bir-center": "bir_center",
  "/app/admin": "admin",
};

export const rbacPersonaOptions: readonly { id: RbacPersona; label: string; description: string }[] = [
  { id: "PREPARER", label: "Preparer", description: "Assigned preparation work and preparation controls." },
  { id: "CHECKER", label: "Checker", description: "Assigned checking work and relevant review queue." },
  { id: "REVIEWER", label: "Reviewer", description: "Assigned review and control work." },
  { id: "TOWER_LEADER", label: "Tower Leader", description: "Authorized Tower portfolio, exceptions, and interventions." },
  { id: "CLUSTER_LEADER", label: "Cluster Leader", description: "Authorized Cluster portfolio and operational approvals." },
  { id: "TAX_CONTROL", label: "Tax Control", description: "Cross-portfolio tax-control and evidence visibility." },
  { id: "MASTER_ADMIN", label: "HOD", description: "Global tax-control visibility and approved intervention authority." },
  { id: "SYSTEM_ADMIN", label: "System Admin", description: "Technical user and organization administration only." },
  { id: "SUPER_ADMIN", label: "Super Admin", description: "All module and administration access; every action remains audited." },
] as const;

export function rbacPersonaLabel(persona: RbacPersona): string {
  return rbacPersonaOptions.find((option) => option.id === persona)?.label ?? persona;
}

export function rbacPersonaDescription(persona: RbacPersona): string {
  return rbacPersonaOptions.find((option) => option.id === persona)?.description ?? "Access is subject to effective capability and scope.";
}

export function accessLevelRank(level: AccessLevel): number {
  return accessRank[level];
}

export function accessLevelLabel(level: AccessLevel): string {
  return level === "NONE" ? "No access" : level === "VIEW" ? "View" : level === "ACT" ? "Act" : level === "APPROVE" ? "Approve" : level === "GOVERN" ? "Govern" : "Elevated override";
}

export function moduleAccessForPersona(persona: RbacPersona, module: ModuleKey, matrix: AccessMatrix = moduleAccess): AccessLevel {
  return matrix[persona][module];
}

export function moduleAccessMapForPersona(persona: RbacPersona, matrix: AccessMatrix = moduleAccess): Readonly<Record<ModuleKey, AccessLevel>> {
  return matrix[persona];
}

export function canAccessModule(persona: RbacPersona, module: ModuleKey, allowed: readonly AccessLevel[] = ["VIEW", "ACT", "APPROVE", "GOVERN", "OVERRIDE"], matrix: AccessMatrix = moduleAccess): boolean {
  return allowed.includes(moduleAccessForPersona(persona, module, matrix));
}

const teamActionPolicy: Readonly<Record<RbacPersona, readonly TeamAction[]>> = {
  PREPARER: ["VIEW_PERSON", "VIEW_ASSIGNMENTS"],
  CHECKER: ["VIEW_PERSON", "VIEW_ASSIGNMENTS"],
  REVIEWER: ["VIEW_PERSON", "VIEW_ASSIGNMENTS"],
  TOWER_LEADER: ["VIEW_PERSON", "VIEW_ASSIGNMENTS"],
  CLUSTER_LEADER: ["VIEW_PERSON", "VIEW_ASSIGNMENTS"],
  TAX_CONTROL: ["VIEW_PERSON", "ADD_PERSON", "EDIT_STRUCTURE", "DEACTIVATE_PERSON", "VIEW_ASSIGNMENTS", "MANAGE_ASSIGNMENTS"],
  MASTER_ADMIN: ["VIEW_PERSON", "ADD_PERSON", "EDIT_STRUCTURE", "DEACTIVATE_PERSON", "VIEW_ASSIGNMENTS", "MANAGE_ASSIGNMENTS"],
  SYSTEM_ADMIN: ["VIEW_PERSON", "VIEW_ASSIGNMENTS"],
  SUPER_ADMIN: ["VIEW_PERSON", "ADD_PERSON", "EDIT_STRUCTURE", "DEACTIVATE_PERSON", "VIEW_ASSIGNMENTS", "MANAGE_ASSIGNMENTS"],
};

const teamActionAccess: Readonly<Record<TeamAction, readonly AccessLevel[]>> = {
  VIEW_PERSON: ["VIEW", "ACT", "APPROVE", "GOVERN", "OVERRIDE"],
  VIEW_ASSIGNMENTS: ["VIEW", "ACT", "APPROVE", "GOVERN", "OVERRIDE"],
  ADD_PERSON: ["ACT", "APPROVE", "GOVERN", "OVERRIDE"],
  EDIT_STRUCTURE: ["ACT", "APPROVE", "GOVERN", "OVERRIDE"],
  DEACTIVATE_PERSON: ["ACT", "APPROVE", "GOVERN", "OVERRIDE"],
  MANAGE_ASSIGNMENTS: ["ACT", "APPROVE", "GOVERN", "OVERRIDE"],
};

export function canPerformTeamAction(persona: RbacPersona, action: TeamAction, matrix: AccessMatrix = moduleAccess): boolean {
  return teamActionPolicy[persona].includes(action) && canAccessModule(persona, "team", teamActionAccess[action], matrix);
}

/**
 * Record mutation is centralized to the tax-control administration personas.
 * Operational leaders may see their scope, but add/edit/delete belongs to HOD,
 * Tax Control, and Super Admin and remains subject to the module's authority.
 */
export function isCentralMutationPersona(persona: RbacPersona): boolean {
  return persona === "MASTER_ADMIN" || persona === "TAX_CONTROL" || persona === "SUPER_ADMIN";
}

export function canManageModuleRecords(persona: RbacPersona, module: ModuleKey, matrix: AccessMatrix = moduleAccess): boolean {
  return isCentralMutationPersona(persona) && canAccessModule(persona, module, ["APPROVE", "GOVERN", "OVERRIDE"], matrix);
}

export function teamActionLabel(action: TeamAction): string {
  return {
    VIEW_PERSON: "View",
    ADD_PERSON: "Add employee",
    EDIT_STRUCTURE: "Edit structure",
    DEACTIVATE_PERSON: "Deactivate / retain history",
    VIEW_ASSIGNMENTS: "View assignments",
    MANAGE_ASSIGNMENTS: "Manage assignments in Clients",
  }[action];
}

export function highestAccessLevel(persona: RbacPersona, matrix: AccessMatrix = moduleAccess): AccessLevel {
  return (Object.values(matrix[persona]) as AccessLevel[]).sort((left, right) => accessRank[right] - accessRank[left])[0] ?? "NONE";
}

export function visibleModuleKeys(persona: RbacPersona, matrix: AccessMatrix = moduleAccess): ModuleKey[] {
  return (Object.entries(matrix[persona]) as [ModuleKey, AccessLevel][]).filter(([, level]) => level !== "NONE").map(([module]) => module);
}

export function moduleForRoute(href: string): ModuleKey | undefined {
  const matched = Object.keys(routeModules).find((route) => href === route || href.startsWith(`${route}/`));
  return matched ? routeModules[matched] : undefined;
}

export function firstAllowedRoute(persona: RbacPersona, matrix: AccessMatrix = moduleAccess): string {
  const preferred = ["/app/control-tower", "/app/work", "/app/clients", "/app/team", "/app/bir-center", "/app/admin"];
  return preferred.find((href) => {
    const moduleKey = moduleForRoute(href);
    return moduleKey ? canAccessModule(persona, moduleKey, undefined, matrix) : false;
  }) ?? "/app/control-tower";
}

export function personaNavigation(persona: RbacPersona, href: string, matrix: AccessMatrix = moduleAccess): boolean {
  const moduleKey = moduleForRoute(href);
  return moduleKey ? canAccessModule(persona, moduleKey, undefined, matrix) : false;
}

export const organizationalScopes = [
  "own_assigned_work",
  "team_tower",
  "cluster",
  "cross_portfolio_tax_control",
  "all_a_and_t",
] as const;

export type OrganizationalScope = (typeof organizationalScopes)[number];

export function hasCapability(capabilities: readonly string[], required: string): boolean {
  return capabilities.includes(required);
}

/** HOD's master-admin bundle is tax governance authority, not System Administration. */
export function isMasterAdminPersona(persona: string): boolean {
  return persona === "Master Admin";
}

/** Calibration only: all sanitized prototype users may edit Client/Profile fixture setup. */
export function hasCalibrationEditAccess(demoMode: boolean, openEditMode: boolean): boolean {
  return demoMode && openEditMode;
}
