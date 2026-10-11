import { describe, expect, it } from "vitest";

import { accessLevelLabel, canAccessModule, canManageModuleRecords, canPerformTeamAction, cloneAccessMatrix, firstAllowedRoute, hasCalibrationEditAccess, hasCapability, highestAccessLevel, isAccessMatrix, isMasterAdminPersona, moduleAccessForPersona, organizationalScopes, priorityCapabilities, personaNavigation } from "./access";

describe("priority access foundation", () => {
  it("keeps Preparer, Tax Team, and HOD capabilities explicit", () => {
    expect(priorityCapabilities.preparer).toContain("ViewAssignedWork");
    expect(priorityCapabilities.preparer).not.toContain("ValidateTaxProfile");
    expect(priorityCapabilities.taxTeam).toContain("ViewScopedPortfolio");
    expect(priorityCapabilities.taxTeam).toContain("MaintainClientRepository");
    expect(priorityCapabilities.taxTeam).toContain("MaintainDeadlineControl");
    expect(priorityCapabilities.hod).toContain("ViewTaxControlHistory");
    expect(priorityCapabilities.hod).toContain("MaintainDeadlineControl");
    expect(priorityCapabilities.masterAdmin).toContain("PerformElevatedOverride");
    expect(priorityCapabilities.masterAdmin).toContain("MaintainRulesLibrary");
  });

  it("does not treat scope as capability", () => {
    expect(hasCapability(organizationalScopes, "ValidateTaxProfile")).toBe(false);
  });

  it("keeps Master Admin as a tax-governance bundle, not a system-admin role", () => {
    expect(isMasterAdminPersona("Master Admin")).toBe(true);
    expect(priorityCapabilities.masterAdmin).not.toContain("AdministerUsers");
  });

  it("limits open edit access to the explicit sanitized calibration mode", () => {
    expect(hasCalibrationEditAccess(true, true)).toBe(true);
    expect(hasCalibrationEditAccess(true, false)).toBe(false);
    expect(hasCalibrationEditAccess(false, true)).toBe(false);
  });

  it("keeps visibility, action, governance, and override levels distinct", () => {
    expect(moduleAccessForPersona("PREPARER", "clients")).toBe("VIEW");
    expect(moduleAccessForPersona("REVIEWER", "team")).toBe("VIEW");
    expect(moduleAccessForPersona("PREPARER", "bir_center")).toBe("VIEW");
    expect(moduleAccessForPersona("CHECKER", "bir_center")).toBe("VIEW");
    expect(moduleAccessForPersona("REVIEWER", "bir_center")).toBe("VIEW");
    expect(moduleAccessForPersona("PREPARER", "work")).toBe("ACT");
    expect(moduleAccessForPersona("TAX_CONTROL", "bir_center")).toBe("GOVERN");
    expect(moduleAccessForPersona("MASTER_ADMIN", "work")).toBe("OVERRIDE");
    expect(moduleAccessForPersona("SYSTEM_ADMIN", "clients")).toBe("NONE");
    expect(accessLevelLabel("APPROVE")).toBe("Approve");
  });

  it("keeps Team row actions narrower than Team module visibility", () => {
    expect(canPerformTeamAction("REVIEWER", "VIEW_PERSON")).toBe(true);
    expect(canPerformTeamAction("REVIEWER", "EDIT_STRUCTURE")).toBe(false);
    expect(canPerformTeamAction("CHECKER", "EDIT_STRUCTURE")).toBe(false);
    expect(canPerformTeamAction("TOWER_LEADER", "EDIT_STRUCTURE")).toBe(false);
    expect(canPerformTeamAction("TOWER_LEADER", "MANAGE_ASSIGNMENTS")).toBe(false);
    expect(canPerformTeamAction("TAX_CONTROL", "EDIT_STRUCTURE")).toBe(true);
    expect(canPerformTeamAction("SYSTEM_ADMIN", "MANAGE_ASSIGNMENTS")).toBe(false);
    expect(canPerformTeamAction("MASTER_ADMIN", "DEACTIVATE_PERSON")).toBe(true);
  });

  it("keeps System Admin separate from tax-control authority", () => {
    expect(canAccessModule("SYSTEM_ADMIN", "admin", ["GOVERN"])).toBe(false);
    expect(canAccessModule("SYSTEM_ADMIN", "bir_center", ["GOVERN", "OVERRIDE"])).toBe(false);
    expect(canAccessModule("SYSTEM_ADMIN", "bir_center", ["VIEW"])).toBe(true);
    expect(canAccessModule("SYSTEM_ADMIN", "work", ["APPROVE", "OVERRIDE"])).toBe(false);
  });

  it("gives Super Admin explicit combined module authority", () => {
    expect(canAccessModule("SUPER_ADMIN", "admin", ["OVERRIDE"])).toBe(true);
    expect(canAccessModule("SUPER_ADMIN", "bir_center", ["OVERRIDE"])).toBe(true);
    expect(canAccessModule("SUPER_ADMIN", "work", ["OVERRIDE"])).toBe(true);
    expect(highestAccessLevel("SUPER_ADMIN")).toBe("OVERRIDE");
  });

  it("routes each access lens to a workspace it can actually view", () => {
    expect(firstAllowedRoute("PREPARER")).toBe("/app/control-tower");
    expect(firstAllowedRoute("SYSTEM_ADMIN")).toBe("/app/team");
    expect(personaNavigation("SYSTEM_ADMIN", "/app/admin")).toBe(false);
    expect(personaNavigation("SYSTEM_ADMIN", "/app/clients")).toBe(false);
    expect(highestAccessLevel("SYSTEM_ADMIN")).toBe("VIEW");
  });

  it("centralizes record mutation with HOD, Tax Control, and Super Admin", () => {
    expect(canManageModuleRecords("MASTER_ADMIN", "clients")).toBe(true);
    expect(canManageModuleRecords("TAX_CONTROL", "clients")).toBe(true);
    expect(canManageModuleRecords("SUPER_ADMIN", "clients")).toBe(true);
    expect(canManageModuleRecords("TAX_CONTROL", "work")).toBe(true);
    expect(canManageModuleRecords("SUPER_ADMIN", "team")).toBe(true);
    expect(canManageModuleRecords("PREPARER", "clients")).toBe(false);
    expect(canManageModuleRecords("CHECKER", "clients")).toBe(false);
    expect(canManageModuleRecords("REVIEWER", "clients")).toBe(false);
    expect(canManageModuleRecords("TOWER_LEADER", "clients")).toBe(false);
    expect(canManageModuleRecords("CLUSTER_LEADER", "clients")).toBe(false);
    expect(canManageModuleRecords("SYSTEM_ADMIN", "admin")).toBe(false);
  });

  it("supports a validated one-level-per-module policy override", () => {
    const matrix = cloneAccessMatrix();
    matrix.REVIEWER.team = "ACT";
    expect(isAccessMatrix(matrix)).toBe(true);
    expect(moduleAccessForPersona("REVIEWER", "team", matrix)).toBe("ACT");
    expect(personaNavigation("REVIEWER", "/app/team", matrix)).toBe(true);
    expect(isAccessMatrix({ REVIEWER: { team: "ACT" } })).toBe(false);
  });

  it("keeps Team actions reconciled with the module access level", () => {
    const matrix = cloneAccessMatrix();
    matrix.TOWER_LEADER.team = "VIEW";
    expect(canPerformTeamAction("TOWER_LEADER", "VIEW_PERSON", matrix)).toBe(true);
    expect(canPerformTeamAction("TOWER_LEADER", "EDIT_STRUCTURE", matrix)).toBe(false);
    matrix.TOWER_LEADER.team = "ACT";
    expect(canPerformTeamAction("TOWER_LEADER", "EDIT_STRUCTURE", matrix)).toBe(false);
  });
});
