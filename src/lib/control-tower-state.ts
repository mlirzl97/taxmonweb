export type TowerView = "overview" | "due" | "calendar";
export type TowerPreset = "all" | "today" | "attention" | "blocked" | "statutory";
export type TowerScope = "all" | "north" | "central" | "south";

const validViews: readonly TowerView[] = ["overview", "due", "calendar"];
const validPresets: readonly TowerPreset[] = ["all", "today", "attention", "blocked", "statutory"];
const validScopes: readonly TowerScope[] = ["all", "north", "central", "south"];

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
