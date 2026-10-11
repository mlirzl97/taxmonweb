// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261020000000_relational_profile_reference_foundation.sql",
);

const migration = readFileSync(migrationPath, "utf8");

describe("relational profile foundation migration contract", () => {
  it("keeps commercial groups separate from taxpayer identity", () => {
    expect(migration).toContain("create table if not exists public.client_groups");
    expect(migration).toContain("create table if not exists public.client_group_memberships");
    expect(migration).toContain("Optional commercial relationship context; never the taxpayer");
  });

  it("resolves profile facts to canonical BIR references without inventing unknown values", () => {
    expect(migration).toContain("public.tax_profile_office_context");
    expect(migration).toContain("public.tax_profile_filing_context");
    expect(migration).toContain("public.tax_profile_registered_tax_types");
    expect(migration).toContain("resolution_status in ('resolved', 'unresolved')");
    expect(migration).toContain("Profile label did not resolve to an effective canonical tax type");
  });

  it("preserves effective-dated accountability and lightweight audit context", () => {
    expect(migration).toContain("public.registration_unit_team_assignments");
    expect(migration).toContain("public.tax_audit_exposure_snapshots");
    expect(migration).toContain("effective_from date not null");
    expect(migration).toContain("tax_profile_version_id uuid not null");
  });

  it("protects maker-checker-reviewer separation at the database boundary", () => {
    expect(migration).toContain("enforce_tax_profile_assignment_separation");
    expect(migration).toContain("distinct Preparer, Checker, and Reviewer actors");
    expect(migration).toContain("tax_profile_assignment_separation_before_write");
  });

  it("does not create a duplicate obligation table or QA model", () => {
    expect(migration).not.toContain("create table if not exists public.compliance_obligations");
    expect(migration).not.toContain("create table if not exists public.qa_reviews");
  });
});
