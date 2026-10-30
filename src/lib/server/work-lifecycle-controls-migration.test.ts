import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { roleQuestions } from "@/lib/workflow-rules";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261212000000_work_lifecycle_controls.sql"), "utf8");

describe("work lifecycle controls migration", () => {
  it("certifies a gate only when every question it asks is present and answered yes", () => {
    expect(migration).not.toContain("pair.value <> 'true')) then");
    expect(migration).toContain("or exists (select 1 from unnest(public.gate_required_questions(role_value)) question");
    expect(migration).toContain("where coalesce(p_payload -> 'answers' -> question, 'null'::jsonb) <> 'true'::jsonb)) then");
    expect(migration).toContain("revoke execute on function public.gate_required_questions(text) from public, anon, authenticated;");
  });

  it("asks on the server exactly the questions the workflow screen asks", () => {
    for (const [role, sqlRole] of [["PREPARER", "preparer"], ["CHECKER", "checker"], ["REVIEWER", "reviewer"]] as const) {
      const line = migration.split("\n").find((candidate) => candidate.trim().startsWith(`when '${sqlRole}' then array[`));
      expect(line, sqlRole).toBeDefined();
      const sqlIds = [...(line ?? "").matchAll(/'([a-z-]+)'/g)].map((match) => match[1]).filter((id) => id !== sqlRole);
      expect(sqlIds).toEqual(roleQuestions[role].map((question) => question.id));
    }
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
    expect(migration).toContain("step_code in ('preparer', 'checker', 'reviewer') and status = 'complete') < 3");
    expect(migration).toContain("'Preparation, checking and review must be complete first.'");
  });

  it("restores the guard that a completed step is reset only by a reasoned override", () => {
    expect(migration).toContain("'A completed process step requires an authorized override to correct.'");
    expect(migration).toContain("'An override reason is required to correct a completed process step.'");
  });

  it("keeps the gates in order even under override, and needs all three before any process step", () => {
    expect(migration).toContain("'The Preparer must certify first.'");
    expect(migration).toContain("'The Checker must certify first.'");
    expect(migration).toContain("step_code in ('preparer', 'checker', 'reviewer') and status = 'complete') < 3");
  });

  it("closes work only by the assigned Reviewer, null-safely, never by whoever prepared or checked it", () => {
    expect(migration).toContain("(not has_elevated_authority and (work.reviewer_user_id is null or actor_id is distinct from work.reviewer_user_id))");
    expect(migration).toContain("attempt.role in ('preparer', 'checker') and attempt.decision <> 'return' and attempt.actor_id = auth.uid()");
  });

  it("lets only the assigned Preparer or Checker set the payment profile, before the Checker certifies", () => {
    expect(migration).toContain("'Only the assigned Preparer or Checker sets the payment profile.'");
    expect(migration).toContain("'The payment profile is fixed once the Checker has certified.'");
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
