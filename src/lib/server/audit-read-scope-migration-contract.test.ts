// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261106000000_scope_audit_event_reads.sql"), "utf8");

describe("audit read scope migration contract", () => {
  it("does not expose the whole audit ledger to every active user", () => {
    expect(migration).toContain("drop policy if exists audit_events_active_user_read");
    expect(migration).toContain("actor_id = auth.uid()");
    expect(migration).toContain("ViewTaxControlHistory");
    expect(migration).not.toContain("using (public.is_active_app_user())");
  });
});
