export const priorityCapabilities = {
  preparer: ["ViewAssignedWork"],
  taxTeam: [
    "ViewScopedPortfolio",
    "ReviewTaxProfile",
    "CorrectTaxProfile",
    "ValidateTaxProfile",
    "ViewTaxControlHistory",
    "MaintainClientRepository",
  ],
  hod: [
    "ViewScopedPortfolio",
    "ValidateTaxProfile",
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
    "MaintainHolidayMaster",
    "MaintainControlTemplate",
    "ChangeServiceScope",
    "ReassignWork",
    "ReopenWork",
    "CancelOrSupersedeWork",
    "PerformElevatedOverride",
  ],
} as const;

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

/** Calibration only: all sanitized prototype users may edit Module 01 setup. */
export function hasCalibrationEditAccess(demoMode: boolean, openEditMode: boolean): boolean {
  return demoMode && openEditMode;
}
