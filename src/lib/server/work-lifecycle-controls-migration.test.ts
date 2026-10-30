import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261212000000_work_lifecycle_controls.sql"), "utf8");

describe("work lifecycle controls migration", () => {
  it("certifies a gate only when every yes/no question is answered yes", () => {
    expect(migration).not.toContain("pair.value <> 'true')) then");
    expect(migration).toContain("where jsonb_typeof(pair.value) = 'boolean' and pair.value <> 'true'::jsonb");
    expect(migration).toContain("or not exists (select 1 from jsonb_each(coalesce(p_payload -> 'answers', '{}'::jsonb)) pair where jsonb_typeof(pair.value) = 'boolean')");
  });

  it("lets only a reasoned Elevated Override act outside an assigned role", () => {
    expect(migration).toContain("has_elevated_authority boolean := public.has_active_capability('PerformElevatedOverride') and nullif(trim(p_payload ->> 'overrideReason'), '') is not null;");
    expect(migration).not.toContain("or public.has_active_capability('MaintainGeneratedComplianceWork');");
  });

  it("keeps actual-actor segregation of duties, which no override erases", () => {
    expect(migration).toContain("if actor_id = prior_preparer or (role_value = 'reviewer' and actor_id = prior_checker) then");
    expect(migration).toContain("'The same person cannot prepare, check and review one return.'");
  });

  it("moves nothing after review until the Reviewer has approved", () => {
    expect(migration).toContain("step_code = 'reviewer' and status = 'complete'");
    expect(migration).toContain("'Preparation, checking and review must be complete first.'");
  });

  it("restores the guard that a completed step is reset only by a reasoned override", () => {
    expect(migration).toContain("'A completed process step requires an authorized override to correct.'");
    expect(migration).toContain("'An override reason is required to correct a completed process step.'");
  });

  it("keeps the client approval date, payment amount and eSubmission controls", () => {
    expect(migration).toContain("'Record the client approval date before completing client approval.'");
    expect(migration).toContain("'Record the amount to pay before certifying the Checker gate.'");
    expect(migration).toContain("'Record the BIR acknowledgment and validation dates before completing eSubmission.'");
  });

  it("keeps the command away from anonymous callers", () => {
    expect(migration).toContain("revoke execute on function public.record_generated_work_command(uuid, text, jsonb, text) from public, anon;");
    expect(migration).toContain("grant execute on function public.record_generated_work_command(uuid, text, jsonb, text) to authenticated;");
  });
});
