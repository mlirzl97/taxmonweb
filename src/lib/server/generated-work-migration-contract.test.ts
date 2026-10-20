// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20261024000000_generated_work_foundation.sql");
const migration = readFileSync(migrationPath, "utf8");
const executionMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261108000000_work_execution_commands.sql"), "utf8");
const periodCloseMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261118000000_accounting_period_close.sql"), "utf8");
const periodCloseHardeningMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261118010000_harden_period_close_triggers.sql"), "utf8");
const returnPeriodLockMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261119000000_return_period_locks.sql"), "utf8");
const checkerPaymentAmountMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261205000000_checker_payment_amount_control.sql"), "utf8");
const manualWorkMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261123000000_enable_authorized_manual_work.sql"), "utf8");
const manualWorkAssignmentMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261124000000_manual_work_uses_effective_unit_assignments.sql"), "utf8");
const triggerHardeningMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261203000000_harden_internal_trigger_functions.sql"), "utf8");

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

  it("makes period close accounting-period scoped and one-way", () => {
    expect(periodCloseMigration).toContain("generated_compliance_period_locks");
    expect(periodCloseMigration).toContain("A closed accounting period cannot be reopened.");
    expect(periodCloseMigration).toContain("Every active work item in the accounting period must be archived and closure-certified before close.");
    expect(periodCloseMigration).toContain("generated_work_close_period_after_event");
    expect(periodCloseMigration).toContain("generated_work_process_period_guard");
    expect(periodCloseHardeningMigration).toContain("revoke execute on function public.block_closed_generated_work_change()");
    expect(periodCloseHardeningMigration).toContain("set search_path = public");
  });

  it("moves the operational lock boundary to one return within one compliance period", () => {
    expect(returnPeriodLockMigration).toContain("lock_key text");
    expect(returnPeriodLockMigration).toContain("generated_work_return_lock_key");
    expect(returnPeriodLockMigration).toContain("A return cannot be locked before its governed due date.");
    expect(returnPeriodLockMigration).toContain("Only authorized Tax Team or HOD users can reopen a return lock.");
    expect(returnPeriodLockMigration).toContain("record_generated_return_lock");
    expect(returnPeriodLockMigration).toContain("Return lock changes must be made through centralized Tax Team control.");
    expect(returnPeriodLockMigration).not.toContain("Every active work item in the accounting period must be archived and closure-certified before close.");
  });

  it("locks the payment amount to the Checker certification", () => {
    expect(checkerPaymentAmountMigration).toContain("guard_checker_payment_amount");
    expect(checkerPaymentAmountMigration).toContain("Only the assigned Checker can record the amount to pay.");
    expect(checkerPaymentAmountMigration).toContain("already recorded and cannot be edited");
    expect(checkerPaymentAmountMigration).toContain("record_payment_amount_evidence");
    expect(checkerPaymentAmountMigration).toContain("Amount to pay captured at Checker certification");
    expect(checkerPaymentAmountMigration).toContain("Record the amount to pay before certifying the Checker gate.");
  });

  it("keeps manual Work creation behind approved masters and an audited command", () => {
    expect(manualWorkMigration).toContain("create or replace function public.create_manual_generated_work");
    expect(manualWorkMigration).toContain("MaintainGeneratedComplianceWork");
    expect(manualWorkMigration).toContain("requirement.status = 'active'");
    expect(manualWorkMigration).toContain("version.status = 'approved'");
    expect(manualWorkMigration).toContain("generation_key_value");
    expect(manualWorkMigration).toContain("public.append_audit_event");
    expect(manualWorkMigration).toContain("generated_compliance_work_events");
    expect(manualWorkMigration).toContain("'not_ready'");
    expect(manualWorkMigration).toContain("'preparer'");
  });

  it("snapshots effective Registration Unit assignments when manual Work is created", () => {
    expect(manualWorkAssignmentMigration).toContain("registration_unit_team_assignments");
    expect(manualWorkAssignmentMigration).toContain("client_team_assignments");
    expect(manualWorkAssignmentMigration).toContain("source_priority");
    expect(manualWorkAssignmentMigration).toContain("current_owner_user_id");
  });

  it("keeps trigger-only functions out of the RPC surface", () => {
    expect(triggerHardeningMigration).toContain("alter function public.capture_checker_tax_due_amount() set search_path = public;");
    expect(triggerHardeningMigration).toContain("revoke execute on function public.materialize_generated_work_components() from public, anon, authenticated;");
  });
});
