// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261023000000_deadline_control_commands.sql"), "utf8");
const latestRepositoryMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261117000000_link_combined_withholding_calendar_forms.sql"), "utf8");
const directPublishMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261127000000_deadline_control_direct_publish.sql"), "utf8");
const sourceGateRemovalMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261202000000_remove_deadline_source_gate.sql"), "utf8");

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

  it("requires an accountable reason and prevents editing released rows", () => {
    expect(sourceGateRemovalMigration).toContain("A reason is required for a deadline change.");
    expect(sourceGateRemovalMigration).toContain("Released or superseded entries cannot be edited");
    expect(sourceGateRemovalMigration).not.toContain("An authoritative source is required.");
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

  it("publishes a saved statutory date without a second reconciliation gate", () => {
    expect(directPublishMigration).toContain("The operational due date cannot be later than the earliest applicable statutory deadline.");
    expect(directPublishMigration).toContain("comparison_status = case when p_to_status = 'published' then 'match'");
    expect(directPublishMigration).not.toContain("source-reconciled before it can be published");
  });

  it("keeps source provenance when available without making the hidden source field a save gate", () => {
    expect(sourceGateRemovalMigration).toContain("manual_tax_team_verification");
    expect(sourceGateRemovalMigration).toContain("resolved_source_id := coalesce(existing_entry.source_issuance_id, resolved_source_id);");
    expect(sourceGateRemovalMigration).not.toContain("An authoritative source is required.");
  });

  it("removes the obsolete source-reconciliation command", () => {
    expect(directPublishMigration).toContain("drop function if exists public.reconcile_deadline_control_entry(uuid, text);");
    expect(directPublishMigration).not.toMatch(/create or replace function public\.reconcile_deadline_control_entry/);
  });

  it("projects the append-only history into the repository read model", () => {
    expect(latestRepositoryMigration).toContain("'history', coalesce(history.events");
    expect(latestRepositoryMigration).toContain("from public.deadline_publication_events event");
  });
});
