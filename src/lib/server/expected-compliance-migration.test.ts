import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261209000000_expected_compliance_and_generation.sql"), "utf8");

describe("Expected Compliance and generation migration", () => {
  it("proposes, decides and approves per Registration Unit with server-side authority and scope", () => {
    expect(migration).toContain("create or replace function public.propose_expected_compliance(p_registration_unit_id uuid)");
    expect(migration).toContain("public.has_active_capability('ApproveComplianceUniverse')");
    expect(migration).toContain("public.can_view_registration_unit(p_registration_unit_id)");
    expect(migration).toContain("'Expected Compliance needs a validated, active Tax Profile.'");
    expect(migration).toContain("A reason is required for Out of TMF Scope or Not Applicable.");
    expect(migration).toContain("insert into public.expected_compliance_approvals");
  });

  it("generates only for approved In TMF Scope returns, from governed facts, idempotently", () => {
    expect(migration).toMatch(/candidate\.selection_status = 'approved'\s+and candidate\.service_scope = 'in_scope'/);
    expect(migration).toContain("calendar_version.status = 'released'");
    expect(migration).toContain("calendar_entry.published_operational_deadline = due_date");
    expect(migration).toContain("'The period is before the first period to file.'");
    expect(migration).toContain("on conflict (generation_key) do nothing");
  });

  it("limits TMF-only dates to elected optional monthly returns in months 1–2, due on the 20th", () => {
    expect(migration).toContain("form_code not in ('2550M', '2551M')");
    expect(migration).toContain("(extract(month from period_start)::integer - 1) % 3 = 2");
    expect(migration).toContain("due_date <> (period_start + interval '1 month')::date + 19");
  });

  it("keeps the helper functions out of reach of API callers", () => {
    expect(migration).toContain("revoke execute on function public.requirement_for_form(text) from public, anon, authenticated;");
    expect(migration).toContain("revoke execute on function public.active_tax_profile_for_unit(uuid) from public, anon, authenticated;");
  });
});
