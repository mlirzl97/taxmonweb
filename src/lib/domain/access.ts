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
