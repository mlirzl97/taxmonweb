// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261023000000_deadline_control_commands.sql"), "utf8");

describe("deadline control command migration contract", () => {
  it("adds a restricted repository boundary over the canonical calendar tables", () => {
    expect(migration).toContain("MaintainDeadlineControl");
    expect(migration).toContain("get_deadline_control_repository");
    expect(migration).toContain("save_deadline_control_entry");
    expect(migration).toContain("transition_deadline_control_entry");
    expect(migration).toContain("has_deadline_control_access");
  });

  it("keeps changes versioned and auditable instead of deleting tax history", () => {
    expect(migration).toContain("deadline_publication_events");
    expect(migration).toContain("append_audit_event");
    expect(migration).toContain("superseded");
    expect(migration).not.toMatch(/delete\s+from\s+public\.monthly_calendar_entries/i);
  });

  it("requires source-backed reasons and prevents editing released rows", () => {
    expect(migration).toContain("A reason is required for a deadline change.");
    expect(migration).toContain("Released or superseded entries cannot be edited");
    expect(migration).toContain("source_record.id is null");
  });

  it("does not create legal master records from deadline-control labels", () => {
    expect(migration).not.toContain("Created through restricted Deadline Control");
    expect(migration).not.toContain("Form identity requires Tax Team source reconciliation before release.");
  });

  it("keeps the deployed override aligned with the same master-record boundary", () => {
    const override = readFileSync(join(process.cwd(), "supabase/migrations/20261107000000_require_existing_deadline_masters.sql"), "utf8");
    expect(override).toContain("The requirement must already exist in the BIR Requirement Master.");
    expect(override).toContain("The form must already exist in the BIR Form Master.");
    expect(override).not.toContain("insert into public.bir_requirements");
    expect(override).not.toContain("insert into public.bir_forms");
  });

  it("keeps publication inside the earliest-deadline control rule", () => {
    expect(migration).toContain("A deadline must be source-reconciled before it can be published.");
    expect(migration).toContain("The operational due date cannot be later than the earliest applicable statutory deadline.");
  });
});
