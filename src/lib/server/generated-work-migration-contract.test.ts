// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20261024000000_generated_work_foundation.sql");
const migration = readFileSync(migrationPath, "utf8");
const executionMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261108000000_work_execution_commands.sql"), "utf8");

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

  it("keeps Work mutations behind one idempotent command and the existing event table", () => {
    expect(executionMigration).toContain("record_generated_work_command");
    expect(executionMigration).toContain("p_idempotency_key text");
    expect(executionMigration).toContain("generated_compliance_work_events");
    expect(executionMigration).not.toContain("public.generated_work_events");
    expect(executionMigration).toContain("generated_work_period_lock_events");
    expect(executionMigration).toContain("generated_work_qa_findings");
    expect(executionMigration).toContain("current_owner_user_id = actor_id");
    expect(executionMigration).toContain("Payment is required for this return and cannot be skipped.");
    expect(executionMigration).toContain("Archiving and Reviewer closure certification must be complete before locking the period.");
  });
});
