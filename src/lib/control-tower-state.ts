import { fixtureOrganizationScopes, fixtureScopeFilterOptions, towerForScopeFilter, type FixtureTower, type OrganizationScopeFilter } from "@/lib/domain/organization-catalog";

export type ScopeFilter = OrganizationScopeFilter;

export const scopeOptions = [
  { id: "all", label: "All A&T", scopeValue: null },
  ...fixtureOrganizationScopes.map((scope) => ({ id: scope.filterId, label: scope.cluster, scopeValue: scope.tower })),
] as const satisfies ReadonlyArray<{ id: ScopeFilter; label: string; scopeValue: string | null }>;

export function scopeValueForFilter(filter: ScopeFilter): FixtureTower | null {
  return towerForScopeFilter(filter);
}

export function scopeLabelForValue(value: string): string {
  return scopeOptions.find((option) => option.scopeValue === value)?.label ?? value;
}

export function scopeFilterForValue(value: string | null | undefined): ScopeFilter {
  return scopeOptions.find((option) => option.scopeValue === value)?.id ?? "all";
}

export type TowerView = "overview" | "due" | "calendar";
export type TowerPreset = "all" | "today" | "attention" | "blocked" | "statutory";
export type TowerScope = ScopeFilter;

const validViews: readonly TowerView[] = ["overview", "due", "calendar"];
const validPresets: readonly TowerPreset[] = ["all", "today", "attention", "blocked", "statutory"];
const validScopes: readonly TowerScope[] = fixtureScopeFilterOptions;

export type ControlTowerUrlState = { view: TowerView; preset: TowerPreset; scope: TowerScope; date: string | null };

export function parseControlTowerSearch(search: string): ControlTowerUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const view = params.get("view") as TowerView | null;
  const preset = params.get("signal") as TowerPreset | null;
  const scope = params.get("scope") as TowerScope | null;
  const date = params.get("date");
  return {
    view: view && validViews.includes(view) ? view : "overview",
    preset: preset && validPresets.includes(preset) ? preset : "all",
    scope: scope && validScopes.includes(scope) ? scope : "all",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

export function buildControlTowerPath(state: ControlTowerUrlState): string {
  const params = new URLSearchParams();
  if (state.view !== "overview") params.set("view", state.view);
  if (state.scope !== "all") params.set("scope", state.scope);
  if (state.preset !== "all") params.set("signal", state.preset);
  if (state.date) params.set("date", state.date);
  const query = params.toString();
  return query ? `/app/control-tower?${query}` : "/app/control-tower";
}
