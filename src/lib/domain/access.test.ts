import { describe, expect, it } from "vitest";

import { hasCalibrationEditAccess, hasCapability, isMasterAdminPersona, organizationalScopes, priorityCapabilities } from "./access";

describe("priority access foundation", () => {
  it("keeps Preparer, Tax Team, and HOD capabilities explicit", () => {
    expect(priorityCapabilities.preparer).toContain("ViewAssignedWork");
    expect(priorityCapabilities.preparer).not.toContain("ValidateTaxProfile");
    expect(priorityCapabilities.taxTeam).toContain("ViewScopedPortfolio");
    expect(priorityCapabilities.taxTeam).toContain("MaintainClientRepository");
    expect(priorityCapabilities.hod).toContain("ViewTaxControlHistory");
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
});
