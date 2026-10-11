// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261018000000_audit_event_command_wiring.sql",
);

const migration = readFileSync(migrationPath, "utf8");

describe("audit event migration contract", () => {
  it("keeps the append helper private to authenticated command boundaries", () => {
    expect(migration).toContain("create or replace function public.append_audit_event(");
    expect(migration).toContain(
      "revoke execute on function public.append_audit_event(text, text, text, text, jsonb, jsonb, text, timestamptz, uuid) from public;",
    );
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("auth.uid()");
  });

  it.each([
    "client_setup_created",
    "contract_repository_created",
    "additional_engagement_created",
    "tax_profile_version_saved",
    "tax_profile_validated",
    "temporary_document_created",
    "temporary_document_uploaded",
    "temporary_document_upload_failed",
    "temporary_document_processing_queued",
  ])("wires %s to the audit ledger", (action) => {
    expect(migration).toContain(`'${action}'`);
  });

  it("does not audit idempotent temporary-document retries as new lifecycle events", () => {
    expect(migration).toContain("if not was_already_uploaded then");
    expect(migration).toContain("if not was_already_queued then");
    expect(migration).toContain("if previous_status <> document_record.status then");
  });
});
