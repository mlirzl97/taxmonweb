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

  it("keeps every decision a proposal until the Registration Unit is approved", () => {
    expect(migration).toMatch(/set pending_decision = decision,\s+pending_reason = reason/);
    expect(migration).toContain("'A superseded Expected Compliance item cannot be decided.'");
    expect(migration).toContain("-- Proposed decisions take effect now, with their reasons.");
  });

  it("generates only for approved In TMF Scope returns, from governed facts, idempotently", () => {
    expect(migration).toMatch(/candidate\.selection_status = 'approved'\s+and candidate\.service_scope = 'in_scope'/);
    expect(migration).toContain("calendar_version.status = 'released'");
    expect(migration).toContain("calendar_entry.published_operational_deadline = due_date");
    // The cited row must cover the period, kind and (for a supporting form) name the return.
    expect(migration).toContain("public.compliance_period_start_from_label(calendar_entry.period_or_event)) = item_period_start");
    expect(migration).toContain("= (item_kind = 'proof')");
    expect(migration).toContain("position(form_code in upper(coalesce(calendar_entry.period_or_event, ''))) > 0");
    expect(migration).toContain("'The period is before the first period to file.'");
    expect(migration).toContain("on conflict (generation_key) do nothing");
  });

  it("takes every date, an optional return's TMF date included, from a released calendar row", () => {
    expect(migration).toContain("'This return needs a published calendar row.'");
    expect(migration).not.toContain("form_code not in ('2550M', '2551M')");
  });

  it("proposes removal of a return dropped from the validated profile, and proposes it again when it returns", () => {
    expect(migration).toContain("pending_reason = 'Removed from the validated Tax Profile.'");
    expect(migration).toContain("pending_reason = 'Back on the validated Tax Profile.'");
  });

  it("keeps the calendar row's statutory dates as the legal deadline, apart from the operational due date", () => {
    expect(migration).toMatch(/entry\.base_statutory_deadline,\s+entry\.adjusted_statutory_deadline,[\s\S]{0,200}coalesce\(entry\.tmf_package_target, due_date - 1\)/);
    expect(migration).toContain("'The published operational date is after the BIR deadline; the Tax Team must review it.'");
  });

  it("records a decision only for an item of the Registration Unit being addressed", () => {
    expect(migration).toContain("item.registration_unit_id is distinct from p_registration_unit_id");
  });

  it("refuses approval of one's own recorded decisions unless by marked Elevated Override", () => {
    expect(migration).toContain("and item.pending_source = 'manual'\n     and item.pending_by = auth.uid();");
    expect(migration).toContain("coalesce(p_elevated_override, false) and public.has_active_capability('PerformElevatedOverride')");
    expect(migration).toContain("values (p_registration_unit_id, auth.uid(), trim(p_reason), snapshot, elevated);");
    // Decisions and approval serialize on the Registration Unit.
    expect(migration.match(/perform 1 from public\.registration_units where id = p_registration_unit_id for update;/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps generated work on the approved requirement version and checks the base deadline when none is adjusted", () => {
    expect(migration).toContain("governed_version_id <> approved_item.requirement_version_id");
    expect(migration).toContain("coalesce(entry.tmf_package_target, due_date - 1) > coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline)");
  });

  it("generates only from the approved requirement and records no second approval on a retry", () => {
    expect(migration).toContain("if governed_requirement_id is distinct from approved_item.requirement_id then");
    expect(migration).toContain("message = 'Nothing is waiting for approval.'");
    expect(migration).toContain("(upper(requirement.requirement_code) = 'BIR-' || upper(trim(p_form_number))) desc");
  });

  it("recomputes changes proposed from an earlier profile on every proposal", () => {
    expect(migration).toMatch(/set pending_decision = null, pending_reason = null, pending_by = null, pending_at = null, pending_source = null\s+where item\.registration_unit_id = p_registration_unit_id\s+and item\.pending_source = 'tax_profile';/);
  });

  it("turns an unresolved return into a candidate once a governed requirement is active", () => {
    expect(migration).toMatch(/and item\.selection_status = 'unresolved'\s+and item\.requirement_id is null/);
  });

  it("takes only requirement versions in force today", () => {
    expect(migration).toContain("and version.effective_from <= current_date");
    expect(migration).toContain("and (requirement.effective_to is null or requirement.effective_to >= current_date)");
  });

  it("keeps the helper functions out of reach of API callers", () => {
    expect(migration).toContain("revoke execute on function public.requirement_for_form(text) from public, anon, authenticated;");
    expect(migration).toContain("revoke execute on function public.active_tax_profile_for_unit(uuid) from public, anon, authenticated;");
  });
});
