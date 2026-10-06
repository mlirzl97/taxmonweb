import { describe, expect, it } from "vitest";

import { buildControlTowerPath, parseControlTowerSearch } from "./control-tower-state";

describe("Control Tower URL state", () => {
  it("round-trips meaningful view, scope, signal, and date context", () => {
    const state = parseControlTowerSearch("?view=calendar&scope=central&signal=attention&date=2026-10-09");
    expect(state).toEqual({ view: "calendar", scope: "central", preset: "attention", date: "2026-10-09" });
    expect(buildControlTowerPath(state)).toBe("/app/control-tower?view=calendar&scope=central&signal=attention&date=2026-10-09");
  });

  it("rejects unsupported or malformed state instead of creating a misleading view", () => {
    expect(parseControlTowerSearch("?view=unknown&scope=global&date=tomorrow")).toEqual({ view: "overview", scope: "all", preset: "all", date: null });
  });
});
