import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261022000000_staff_reporting_line_visibility.sql"), "utf8");

describe("staff visibility migration contract", () => {
  it("uses own assigned work and reporting-line boundaries", () => {
    expect(migration).toContain("scope_kind = 'own_assigned_work'");
    expect(migration).toContain("reports_to_user_id");
    expect(migration).toContain("client_team_assignments");
    expect(migration).toContain("registration_unit_team_assignments");
    expect(migration).toContain("target_user in (select user_id from reporting_line)");
    expect(migration).not.toContain("descendants(");
  });
});
