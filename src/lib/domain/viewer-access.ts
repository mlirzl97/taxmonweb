import type { AccessLevel, ModuleKey, TeamAction } from "@/lib/domain/access";

/**
 * Authenticated access for the signed-in person. Every answer here mirrors a
 * server or database rule (requireModuleAccess, API capability guards, and
 * record_generated_work_command); it only decides what the UI offers. The
 * server still authorizes every request.
 */
export type ViewerAccess = {
  userId: string;
  capabilities: ReadonlySet<string>;
  /** Effective organizational scope kinds, e.g. own_assigned_work, team_tower, cluster. */
  scopeKinds?: ReadonlySet<string>;
};

const leadershipScopes = ["team_tower", "cluster", "cross_portfolio_tax_control", "all_a_and_t"] as const;

/** Leaders hold a unit-wide or wider scope; everyone else works their own assigned returns. */
export function isViewerLeader(viewer: ViewerAccess): boolean {
  return leadershipScopes.some((scope) => viewer.scopeKinds?.has(scope));
}

export type WorkRoleOwner = "PREPARER" | "CHECKER" | "REVIEWER" | "TAX_CONTROL";

/** Matches the database: either capability lets a caller act outside the assigned role. */
const elevatedCapabilities = ["PerformElevatedOverride", "MaintainGeneratedComplianceWork"] as const;

/** Same alternatives as the server-side module guard in src/lib/server/module-access.ts. */
export const moduleViewCapabilities: Readonly<Record<Exclude<ModuleKey, "bir_center">, readonly string[]>> = {
  control_tower: ["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"],
  work: ["ViewAssignedWork", "ViewScopedPortfolio", "ViewTaxControlHistory"],
  clients: ["ReviewTaxProfile", "ViewScopedPortfolio", "MaintainClientRepository"],
  team: ["ViewScopedPortfolio", "AdministerUsers", "AdministerOrganization"],
  tax_team: ["ViewTaxControlHistory"],
  admin: ["AdministerUsers", "AdministerOrganization"],
};

const moduleManageCapabilities: Readonly<Record<ModuleKey, readonly string[]>> = {
  control_tower: [],
  work: ["MaintainGeneratedComplianceWork"],
  clients: ["MaintainClientRepository"],
  team: ["AdministerOrganization"],
  tax_team: ["MaintainDeadlineControl", "ManageWorkPeriodLock", "PerformWorkQA"],
  bir_center: [],
  admin: ["AdministerUsers", "AdministerOrganization"],
};

function hasAny(viewer: ViewerAccess, capabilities: readonly string[]) {
  return capabilities.some((capability) => viewer.capabilities.has(capability));
}

export function canViewerOverride(viewer: ViewerAccess): boolean {
  return hasAny(viewer, elevatedCapabilities);
}

export function canViewerViewModule(viewer: ViewerAccess, module: ModuleKey): boolean {
  // BIR Center is the shared reference projection; every authenticated user may read it.
  if (module === "bir_center") return true;
  return hasAny(viewer, moduleViewCapabilities[module]);
}

export function canViewerManageModule(viewer: ViewerAccess, module: ModuleKey): boolean {
  return canViewerViewModule(viewer, module) && hasAny(viewer, moduleManageCapabilities[module]);
}

/** Coarse level for existing level-based checks; capabilities stay the source of truth. */
export function viewerModuleLevel(viewer: ViewerAccess, module: ModuleKey): AccessLevel {
  if (!canViewerViewModule(viewer, module)) return "NONE";
  if ((module === "work" || module === "control_tower") && viewer.capabilities.has("PerformElevatedOverride")) return "OVERRIDE";
  if (canViewerManageModule(viewer, module)) return "GOVERN";
  if (module === "work" && viewer.capabilities.has("ExecuteGeneratedComplianceWork")) return "ACT";
  return "VIEW";
}

export function canViewerPerformTeamAction(viewer: ViewerAccess, action: TeamAction): boolean {
  if (!canViewerViewModule(viewer, "team")) return false;
  switch (action) {
    case "VIEW_PERSON":
    case "VIEW_ASSIGNMENTS":
      return true;
    case "ADD_PERSON":
      // The staff provisioning API requires both capabilities.
      return viewer.capabilities.has("AdministerUsers") && viewer.capabilities.has("AdministerOrganization");
    case "EDIT_STRUCTURE":
    case "DEACTIVATE_PERSON":
      return hasAny(viewer, ["AdministerUsers", "AdministerOrganization"]);
    case "MANAGE_ASSIGNMENTS":
      return viewer.capabilities.has("MaintainClientRepository");
  }
}

/**
 * The actual actor must be the person assigned to the role, unless they hold
 * elevated authority (which the command still requires a reason for).
 */
export function canViewerActOnWorkRole(
  viewer: ViewerAccess,
  assignedUserIds: Partial<Record<"PREPARER" | "CHECKER" | "REVIEWER", string>> | undefined,
  role: WorkRoleOwner,
): boolean {
  if (role === "TAX_CONTROL") return hasAny(viewer, ["ManageWorkPeriodLock", "PerformElevatedOverride"]);
  if (canViewerOverride(viewer)) return true;
  return viewer.capabilities.has("ExecuteGeneratedComplianceWork") && assignedUserIds?.[role] === viewer.userId;
}
