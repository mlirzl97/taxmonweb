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
    expect(migration).toContain("The selected Tower does not belong to the selected Cluster.");
  });

  it("prefers the submitted Team user id and only links a unique, in-effect name", () => {
    expect(migration).toContain("new.assignment_data ->> (team_role || 'UserId')");
    expect(migration).toContain("is not an active Team member eligible for this role on this date.");
    expect(migration).toMatch(/member\.effective_from <= new\.effective_from[\s\S]*having count\(\*\) = 1;/);
  });

  it("records the chosen person's own name and only accepts role-eligible engagement staff", () => {
    expect(migration).toContain("assignee_label := (select display_name from public.app_users where id = resolved_user_id);");
    expect(migration).not.toContain("assignee_label := coalesce(assignee_label, (select display_name");
    expect(migration).toContain("member.operating_model <> 'tax_team'");
    expect(migration).toContain("when 'preparer' then array['team_member']");
    expect(migration).toContain("when 'checker' then array['team_member', 'leader', 'reviewer']");
    expect(migration).toContain("else array['leader', 'reviewer'] end)");
  });

  it("locks the Registration Unit on every profile save", () => {
    expect(migration).toContain("perform 1 from public.registration_units unit where unit.id = new.registration_unit_id for update;");
  });

  it("lets an earlier correction cancel a scheduled change that has not started", () => {
    expect(migration).toContain("while found and current_assignment.effective_from > new.effective_from\n            and current_assignment.effective_from > current_date loop");
    expect(migration).toContain("while found and current_scope.effective_from > new.effective_from\n            and current_scope.effective_from > current_date loop");
    expect(migration).toContain("Cancelling this scheduled move is outside the caller''s authority.");
  });

  it("stores each id-linked owner under that person's own name in the profile snapshot", () => {
    expect(migration).toContain("create or replace function public.canonicalize_tax_profile_assignment_labels()");
    expect(migration).toContain("before insert or update of assignment_data on public.tax_profile_versions");
    expect(migration).toContain("new.assignment_data := jsonb_set(new.assignment_data, array[role_key], to_jsonb(canonical_name));");
  });

  it("refuses an unknown tower instead of widening scope to its cluster", () => {
    expect(migration).toContain("The selected Tower is not a single active tower.");
    expect(migration).toContain("The selected Cluster is not a single active cluster.");
  });

  it("repairs piled-up open rows once by closing them, never deleting", () => {
    expect(migration).toContain("set effective_to = placeholder.effective_from - 1");
    expect(migration).toContain("set effective_to = ranked.newest_from - 1");
    expect(migration).not.toMatch(/delete from public\.registration_unit_(team|scope)_assignments/);
  });

  it("keeps the trigger function private", () => {
    expect(migration).toContain("revoke execute on function public.sync_tax_profile_relational_context() from public, anon, authenticated;");
  });
});
