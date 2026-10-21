import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261207010000_single_open_team_assignment_and_setup_scope.sql"), "utf8");

describe("single open team assignment migration", () => {
  it("treats Unassigned as no assignee and skips roles that did not change", () => {
    expect(migration).toContain("in ('unassigned', 'unresolved')");
    expect(migration).toMatch(/current_assignment\.user_id = resolved_user_id\)[\s\S]*continue;/);
  });

  it("closes the previous assignment instead of deleting history", () => {
    expect(migration).toContain("set effective_to = greatest(existing.effective_from, new.effective_from - 1)");
    expect(migration).not.toMatch(/delete from public\.registration_unit_team_assignments/);
  });

  it("moves the Registration Unit scope only within the caller's authority", () => {
    expect(migration).toContain("unit.unit_kind = 'tower'");
    expect(migration).toContain("public.can_manage_organization_unit(resolved_scope_unit_id)");
    expect(migration).toContain("set effective_to = greatest(scope.effective_from, new.effective_from - 1)");
  });

  it("keeps the trigger function private", () => {
    expect(migration).toContain("revoke execute on function public.sync_tax_profile_relational_context() from public, anon, authenticated;");
  });
});
