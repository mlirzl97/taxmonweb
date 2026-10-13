import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261125000000_work_data_readiness_command.sql"), "utf8");

describe("Data Readiness persistence contract", () => {
  it("records the prerequisite with an audited, idempotent command", () => {
    expect(migration).toContain("record_generated_work_readiness");
    expect(migration).toContain("generated_compliance_work_events");
    expect(migration).toContain("CLIENT_RECORDS");
    expect(migration).toContain("TMF_BOOKS");
    expect(migration).toContain("p_idempotency_key");
    expect(migration).toContain("source_context");
  });
});
