// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20261024000000_generated_work_foundation.sql");
const migration = readFileSync(migrationPath, "utf8");

describe("generated work persistence contract", () => {
  it("uses one generated-work source with idempotent identity", () => {
    expect(migration).toContain("create table if not exists public.generated_compliance_work");
    expect(migration).toContain("generation_key text not null unique");
    expect(migration).not.toContain("create table if not exists public.compliance_obligations");
  });

  it("keeps component and event state subordinate to the work object", () => {
    expect(migration).toContain("generated_compliance_work_components");
    expect(migration).toContain("generated_compliance_work_events");
    expect(migration).toContain("generated_work_id uuid not null references public.generated_compliance_work(id)");
    expect(migration).toContain("idempotency_key text not null unique");
  });

  it("preserves the deadline distinction and maker-checker controls", () => {
    expect(migration).toContain("base_statutory_deadline date");
    expect(migration).toContain("adjusted_statutory_deadline date");
    expect(migration).toContain("tmf_package_target date");
    expect(migration).toContain("generated_work_distinct_control_actors_check");
    expect(migration).toContain("There are intentionally no direct table-write policies");
  });
});
