import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261207020000_validate_latest_resolved_profile.sql"), "utf8");

describe("validate latest resolved Tax Profile migration", () => {
  it("refuses to activate a version that a later save replaced", () => {
    expect(migration).toContain("newer.version_number > candidate.version_number");
    expect(migration).toMatch(/newer\.version_number > candidate\.version_number[\s\S]{0,200}and newer\.effective_from <= current_date/);
    expect(migration).toContain("A newer Tax Profile version exists; reload and validate the latest version.");
  });

  it("requires one current, active, distinct person for each accountable role", () => {
    expect(migration).toContain("join public.app_users app_user on app_user.id = assignment.user_id and app_user.is_active");
    expect(migration).toContain("(no uniquely resolved active person)");
    expect(migration).toContain("and member.effective_from <= current_date");
    expect(migration).toContain("and assignment.effective_from <= current_date");
    expect(migration).toContain("and (assignment.effective_to is null or assignment.effective_to >= current_date)");
    expect(migration).toContain("distinct Preparer, Checker, and Reviewer");
    expect(migration).toContain("and member.operating_model <> 'tax_team'");
    expect(migration).toContain("when 'checker' then array['team_member', 'leader', 'reviewer']");
  });

  it("serializes validation with saves for the same Registration Unit", () => {
    expect(migration).toContain("perform 1 from public.registration_units unit where unit.id = candidate.registration_unit_id for update;");
  });

  it("rechecks authority under the lock and refuses future-dated versions", () => {
    expect(migration).toMatch(/for update;\s*select \* into candidate[^;]*;\s*--[^\n]*\n[^\n]*\n\s*if not public\.can_view_registration_unit\(candidate\.registration_unit_id\)/);
    expect(migration).toContain("if candidate.effective_from > current_date then");
  });

  it("reads the latest version by version number, as validation does", () => {
    expect(migration).toContain("create or replace function public.get_latest_tax_profile_version(");
    expect(migration).toContain("order by (profile.effective_from <= current_date) desc, profile.version_number desc, profile.created_at desc");
  });

  it("separates owners by user id so two staff who share a name can both be assigned", () => {
    expect(migration).toContain("create or replace function public.enforce_tax_profile_assignment_separation()");
    expect(migration).toContain("preparer_key := coalesce('id:' || nullif(trim(new.assignment_data ->> 'preparerUserId'), ''), 'label:' || lower(preparer));");
    expect(migration).toContain("set search_path = public, pg_temp");
  });

  it("requires the first period to file before activation", () => {
    expect(migration).toContain("'goLiveDate', 'firstPeriodToFile', 'cluster', 'preparer', 'checker', 'reviewer'");
    expect(migration).not.toContain("'cluster', 'tower', 'preparer'");
    expect(migration).toContain("'firstPeriodToFile on or after the go-live month'");
    expect(migration).toContain("'goLiveDate (a calendar date, YYYY-MM-DD)'");
    expect(migration).toContain("!~ '^\\d{4}-(0[1-9]|1[0-2])$' then");
  });

  it("treats placeholder values as missing facts", () => {
    expect(migration).toContain("in ('unassigned', 'unresolved', 'needs review', 'not configured') then");
  });

  it("lets a superseded version keep the validation that activated it", () => {
    expect(migration).toContain("check ((state in ('active', 'superseded')) = (validated_at is not null and validated_by is not null))");
  });

  it("reads the latest version of the same Registration Unit that save_tax_profile_version writes", () => {
    expect(migration).toContain("order by registration_unit.unit_kind = 'head_office' desc, registration_unit.created_at");
    expect(migration).toContain("where profile.registration_unit_id = target_unit.id");
  });

  it("keeps validation authority and the reason requirement", () => {
    expect(migration).toContain("has_active_capability('ValidateTaxProfile')");
    expect(migration).toContain("A reason is required for validation.");
  });
});
