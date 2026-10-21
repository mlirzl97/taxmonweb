import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261207020000_validate_latest_resolved_profile.sql"), "utf8");

describe("validate latest resolved Tax Profile migration", () => {
  it("refuses to activate a version that a later save replaced", () => {
    expect(migration).toContain("newer.version_number > candidate.version_number");
    expect(migration).toContain("A newer Tax Profile version exists; reload and validate the latest version.");
  });

  it("requires one current, active, distinct person for each accountable role", () => {
    expect(migration).toContain("join public.app_users app_user on app_user.id = assignment.user_id and app_user.is_active");
    expect(migration).toContain("(no uniquely resolved active person)");
    expect(migration).toContain("and member.effective_from <= current_date");
    expect(migration).toContain("and assignment.effective_from <= current_date");
    expect(migration).toContain("distinct Preparer, Checker, and Reviewer");
    expect(migration).toContain("and member.operating_model <> 'tax_team'");
    expect(migration).toContain("when 'checker' then array['team_member', 'leader', 'reviewer']");
  });

  it("serializes validation with saves for the same Registration Unit", () => {
    expect(migration).toContain("perform 1 from public.registration_units unit where unit.id = candidate.registration_unit_id for update;");
  });

  it("treats placeholder values as missing facts", () => {
    expect(migration).toContain("in ('unassigned', 'unresolved', 'needs review', 'not configured') then");
  });

  it("lets a superseded version keep the validation that activated it", () => {
    expect(migration).toContain("check ((state in ('active', 'superseded')) = (validated_at is not null and validated_by is not null))");
  });

  it("keeps validation authority and the reason requirement", () => {
    expect(migration).toContain("has_active_capability('ValidateTaxProfile')");
    expect(migration).toContain("A reason is required for validation.");
  });
});
