import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261101000000_team_operating_model_commands.sql"), "utf8");

describe("Team operating model migration contract", () => {
  it("persists the three operating models and reasoned reporting exceptions", () => {
    expect(migration).toContain("operating_model");
    expect(migration).toContain("engagement_agile");
    expect(migration).toContain("engagement_dedicated");
    expect(migration).toContain("tax_team");
    expect(migration).toContain("reporting_line_exception_reason");
    expect(migration).toContain("save_team_member_profile");
    expect(migration).toContain("expected_manager_level");
    expect(migration).toContain("append_audit_event");
  });

  it("keeps the command behind authenticated organization/user administration", () => {
    expect(migration).toContain("AdministerUsers");
    expect(migration).toContain("AdministerOrganization");
    expect(migration).toContain("can_manage_organization_unit");
    expect(migration).toContain("revoke execute on function public.save_team_member_profile");
  });
});
