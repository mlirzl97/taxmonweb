/**
 * One controlled organization vocabulary for the sanitized prototype.
 * Production names must come from governed organization-unit records before
 * live use; these labels are deliberately neutral fixture values.
 */
export const fixtureOrganizationScopes = [
  { filterId: "tower-a", tower: "Tower A", cluster: "Cluster A", code: "FIXTURE-TOWER-A" },
  { filterId: "tower-b", tower: "Tower B", cluster: "Cluster B", code: "FIXTURE-TOWER-B" },
  { filterId: "tower-c", tower: "Tower C", cluster: "Cluster C", code: "FIXTURE-TOWER-C" },
] as const;

export type FixtureTower = (typeof fixtureOrganizationScopes)[number]["tower"];
export type FixtureCluster = (typeof fixtureOrganizationScopes)[number]["cluster"];
export type OrganizationScopeFilter = "all" | (typeof fixtureOrganizationScopes)[number]["filterId"];
export const fixtureScopeFilterOptions: readonly OrganizationScopeFilter[] = ["all", ...fixtureOrganizationScopes.map((scope) => scope.filterId)];

export function towerForScopeFilter(filter: OrganizationScopeFilter): FixtureTower | null {
  return fixtureOrganizationScopes.find((scope) => scope.filterId === filter)?.tower ?? null;
}

export function clusterForTower(tower: FixtureTower): FixtureCluster {
  return fixtureOrganizationScopes.find((scope) => scope.tower === tower)?.cluster ?? "Cluster A";
}

/** True when an organization unit's effective window includes the given ISO date. */
export function isOrganizationUnitInEffect(unit: { effective_from?: string | null; effective_to?: string | null }, onDate: string): boolean {
  return (!unit.effective_from || unit.effective_from <= onDate) && (!unit.effective_to || unit.effective_to >= onDate);
}
