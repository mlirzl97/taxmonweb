import { describe, expect, it } from "vitest";

import { scopeFilterForValue, scopeOptions, scopeValueForFilter } from "@/lib/control-tower-state";
import { fixtureClients, fixtureOrgDirectoryMembers, fixtureWork } from "@/lib/fixtures";
import { fixtureOrganizationScopes } from "./organization-catalog";

describe("organization catalog projections", () => {
  it("uses one controlled scope vocabulary for dropdowns and cross-module records", () => {
    const towers = new Set(fixtureOrganizationScopes.map((scope) => scope.tower));
    const clusters = new Set<string>(fixtureOrganizationScopes.map((scope) => scope.cluster));

    expect(scopeOptions.filter((option) => option.scopeValue)).toHaveLength(fixtureOrganizationScopes.length);
    expect(fixtureOrganizationScopes.every((scope) => scopeValueForFilter(scope.filterId) === scope.tower)).toBe(true);
    expect(fixtureOrganizationScopes.every((scope) => scopeFilterForValue(scope.tower) === scope.filterId)).toBe(true);
    expect(fixtureClients.every((client) => towers.has(client.scope) && clusters.has(client.assignment.cluster))).toBe(true);
    expect(fixtureWork.every((work) => towers.has(work.scope))).toBe(true);
    expect(fixtureOrgDirectoryMembers.every((member) => member.tower === "All A&T" || towers.has(member.tower))).toBe(true);
  });

  it("does not expose the retired placeholder fixture vocabulary", () => {
    const serialized = JSON.stringify({ fixtureClients, fixtureWork, fixtureOrgDirectoryMembers, scopeOptions });
    expect(serialized).not.toMatch(/Tower North|Tower Central|Tower South|Barangay Atilano|Barangay Beato|Barangay de Vera/);
  });
});
