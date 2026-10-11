import { describe, expect, it } from "vitest";

import { staffAccessProfileDefinition, staffAccessProfiles, staffScopeKindLabel } from "@/lib/domain/staff-access";

describe("staff access profiles", () => {
  it("keeps the user-facing catalog small and capability-backed", () => {
    expect(staffAccessProfiles.map((profile) => profile.id)).toEqual([
      "VIEWER",
      "STAFF",
      "TEAM_LEAD",
      "SYSTEM_USER_ADMIN",
      "HOD_MASTER_ADMIN",
    ]);
    expect(staffAccessProfileDefinition("HOD_MASTER_ADMIN").capabilities).toContain("AdministerUsers");
    expect(staffAccessProfileDefinition("SYSTEM_USER_ADMIN").capabilities).not.toContain("ValidateTaxProfile");
  });

  it("keeps scope terminology explicit", () => {
    expect(staffScopeKindLabel("own_assigned_work")).toBe("Own assigned work");
    expect(staffScopeKindLabel("all_a_and_t")).toBe("All A&T");
  });
});
