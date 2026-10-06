import { describe, expect, it } from "vitest";

import { hasCapability, organizationalScopes, priorityCapabilities } from "./access";

describe("priority access foundation", () => {
  it("keeps Preparer, Tax Team, and HOD capabilities explicit", () => {
    expect(priorityCapabilities.preparer).toContain("ViewAssignedWork");
    expect(priorityCapabilities.preparer).not.toContain("ValidateTaxProfile");
    expect(priorityCapabilities.taxTeam).toContain("ViewScopedPortfolio");
    expect(priorityCapabilities.taxTeam).toContain("MaintainClientRepository");
    expect(priorityCapabilities.hod).toContain("ViewTaxControlHistory");
  });

  it("does not treat scope as capability", () => {
    expect(hasCapability(organizationalScopes, "ValidateTaxProfile")).toBe(false);
  });
});
