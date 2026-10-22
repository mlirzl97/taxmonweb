import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261208010000_changes_only_when_owner_or_placement_differs.sql"), "utf8");

describe("owner and placement in force migration", () => {
  it("fills a placeholder from the owner in force on the version's date, including label-only owners", () => {
    expect(migration).toContain("coalesce(app_user.display_name, assignment.assignee_label) as label");
    expect(migration).toContain("left join public.app_users app_user on app_user.id = assignment.user_id");
    expect(migration).toMatch(/assignment\.effective_from <= new\.effective_from\s+and \(assignment\.effective_to is null or assignment\.effective_to >= new\.effective_from\)/);
  });

  it("treats naming no one, or the person already in force, as no change so a scheduled handover stays scheduled", () => {
    expect(migration).toMatch(/if assignee_label is null then\s+continue;/);
    expect(migration).toMatch(/select existing\.\* into in_force_assignment[\s\S]{0,400}existing\.effective_from <= new\.effective_from/);
    // The no-change check runs before the loop that cancels scheduled changes.
    expect(migration.indexOf("into in_force_assignment")).toBeLessThan(migration.indexOf("A change scheduled for a later date has not happened yet."));
  });

  it("keeps a scheduled scope move when the save names the placement already in force", () => {
    expect(migration).toMatch(/into in_force_scope_unit_id[\s\S]{0,400}if found and in_force_scope_unit_id = resolved_scope_unit_id then\s+resolved_scope_unit_id := null;/);
  });

  it("keeps both trigger functions out of reach of API callers", () => {
    expect(migration).toContain("revoke execute on function public.canonicalize_tax_profile_assignment_labels() from public, anon, authenticated;");
    expect(migration).toContain("revoke execute on function public.sync_tax_profile_relational_context() from public, anon, authenticated;");
  });
});
