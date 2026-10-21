import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261207010000_single_open_team_assignment_and_setup_scope.sql"), "utf8");

describe("single open team assignment migration", () => {
  it("treats Unassigned as no assignee and skips roles that did not change", () => {
    expect(migration).toContain("in ('unassigned', 'unresolved')");
    expect(migration).toMatch(/current_assignment\.user_id = resolved_user_id\)[\s\S]*continue;/);
  });

  it("closes only the open assignment, refuses back-dating, and never deletes history", () => {
    expect(migration).toContain("set effective_to = new.effective_from - 1");
    expect(migration).toContain("check (effective_to is null or effective_to >= effective_from - 1)");
    expect(migration).toMatch(/and existing\.assignment_role = team_role\s+and existing\.effective_to is null;/);
    expect(migration).toContain("An assignment change cannot be dated before the current assignment.");
    expect(migration).not.toMatch(/delete from public\.registration_unit_team_assignments/);
  });

  it("moves the Registration Unit scope only for a signed-in caller with authority over both ends", () => {
    expect(migration).toContain("unit.unit_kind = 'tower'");
    expect(migration).toContain("having count(*) = 1");
    expect(migration).toContain("if resolved_scope_unit_id is not null and auth.uid() is not null then");
    expect(migration).toContain("not public.can_manage_organization_unit(resolved_scope_unit_id)");
    expect(migration).toContain("not public.can_manage_organization_unit(current_scope_unit_id)");
    expect(migration).toContain("A scope change cannot be dated before the current scope.");
  });

  it("keeps the trigger function private", () => {
    expect(migration).toContain("revoke execute on function public.sync_tax_profile_relational_context() from public, anon, authenticated;");
  });
});
