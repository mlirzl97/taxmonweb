import { describe, expect, it } from "vitest";

import { resolveTowerScope } from "./authorized-scope";

const units = [
  { id: "tower-a", code: "FIXTURE-TOWER-A", name: "Tower A", unit_kind: "tower" },
  { id: "tower-b", code: "FIXTURE-TOWER-B", name: "Tower B", unit_kind: "tower" },
];

describe("authorized control-tower scope", () => {
  it("returns an explicit global scope only for a global assignment", () => {
    expect(resolveTowerScope([{ scope_kind: "all_a_and_t", organization_unit_id: null }], [])).toBe("all");
  });

  it("resolves one unambiguous tower", () => {
    expect(resolveTowerScope([{ scope_kind: "team_tower", organization_unit_id: "tower-a" }], units)).toBe("tower-a");
  });

  it("fails closed when scope is missing, ambiguous, or unrecognized", () => {
    expect(resolveTowerScope([], units)).toBeNull();
    expect(resolveTowerScope([{ scope_kind: "team_tower", organization_unit_id: "tower-a" }, { scope_kind: "team_tower", organization_unit_id: "tower-b" }], units)).toBeNull();
    expect(resolveTowerScope([{ scope_kind: "team_tower", organization_unit_id: "missing" }], units)).toBeNull();
  });

  it("does not infer a scope from a partial or renamed organization code", () => {
    expect(resolveTowerScope([{ scope_kind: "team_tower", organization_unit_id: "renamed" }], [
      { id: "renamed", code: "FIXTURE-TOWER-A-ARCHIVED", name: "Tower A", unit_kind: "tower" },
    ])).toBeNull();
  });
});
