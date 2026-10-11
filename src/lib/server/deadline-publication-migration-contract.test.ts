// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261021000000_deadline_publication_client_projection.sql"), "utf8");

describe("deadline publication migration contract", () => {
  it("extends the existing calendar entry with the distinct date chain", () => {
    expect(migration).toContain("base_statutory_deadline");
    expect(migration).toContain("adjusted_statutory_deadline");
    expect(migration).toContain("published_operational_deadline");
    expect(migration).toContain("tmf_package_target");
    expect(migration).toContain("publication_status");
    expect(migration).toContain("rule_version_id");
  });

  it("links client applicability to the requirement master without storing a second deadline", () => {
    expect(migration).toContain("create table if not exists public.client_compliance_universe_items");
    expect(migration).toContain("references public.bir_requirements(id)");
    expect(migration).toContain("does not store deadline truth or generated work");
    expect(migration).not.toContain("create table if not exists public.tax_team_deadlines");
  });

  it("preserves publication history as append-only events", () => {
    expect(migration).toContain("create table if not exists public.deadline_publication_events");
    expect(migration).toContain("Append-only history");
    expect(migration).toContain("recorded_at timestamptz not null default now()");
  });
});
