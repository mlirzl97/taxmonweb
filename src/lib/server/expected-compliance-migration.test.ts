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
    expect(migration).toContain("values (p_registration_unit_id, auth.uid(), trim(p_reason), snapshot, elevated, ");
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
    expect(migration).toContain("and item.pending_source in ('tax_profile', 'requirement_version');");
  });

  it("refuses a proposal made from a profile that is no longer active", () => {
    expect(migration).toContain("item.proposed_from_profile_id is distinct from (public.active_tax_profile_for_unit(p_registration_unit_id)).id");
    expect(migration).toContain("'A BIR requirement version changed since Expected Compliance was proposed; propose again before approving.'");
  });

  it("proposes moving an approved return to a newer requirement version, applied only on approval", () => {
    expect(migration).toContain("pending_source = 'requirement_version',");
    expect(migration).toContain("requirement_version_id = coalesce(item.pending_requirement_version_id, item.requirement_version_id),");
    // A person's decision never carries a move, and the snapshot records the version approved.
    expect(migration).toContain("'requirementVersionId', item.requirement_version_id");
    expect(migration).toContain("snapshot, elevated, (public.active_tax_profile_for_unit(p_registration_unit_id)).id);");
  });

  it("surfaces work already generated under another requirement version instead of counting it as existing", () => {
    expect(migration).toContain("'Work for this period already exists under an earlier requirement version; it needs a keep, rebase or supersede decision.'");
    expect(migration).toContain("'Work for this period already exists with earlier published dates; it needs a keep, rebase or supersede decision.'");
    // Generation follows the profile the approved universe came from.
    expect(migration).toContain("join public.tax_profile_versions profile_version on profile_version.id = approval.tax_profile_version_id");
  });

  it("withdraws a person's decision recorded against an earlier profile, and restores returns onto the current version", () => {
    expect(migration).toMatch(/and item\.pending_source = 'manual'\s+and item\.proposed_from_profile_id is distinct from profile\.id;/);
    expect(migration).toContain("pending_requirement_version_id = (select governed_now.requirement_version_id from public.requirement_for_form(item.form_number) governed_now)");
  });

  it("lets a requirement-less return be excluded, and lands a scope decision on the version in force", () => {
    expect(migration).toContain("and (requirement_id is not null or selection_status in ('unresolved', 'excluded', 'superseded'))");
    expect(migration).toContain("is distinct from (governed_now.requirement_id, governed_now.requirement_version_id)");
  });

  it("flags approvals whose governing requirement is retired, and restores requirement-less exclusions once governed", () => {
    expect(migration).toContain("'The governing BIR requirement is no longer in force; the Tax Team must review it.'");
    expect(migration).toContain("'The approved BIR requirement is no longer in force; propose again for Tax Team review.'");
    expect(migration).toContain("and (select governed_now.requirement_id from public.requirement_for_form(item.form_number) governed_now) is not null");
  });

  it("recovers returns held on a retired requirement once a new one is in force", () => {
    expect(migration).toContain("-- No requirement, or one that is no longer in force (retired).");
    expect(migration).toContain("'No active, approved BIR requirement carries this return any more; the Tax Team must review it.'");
  });

  it("accepts a backlog period on the earlier version that governed it, and replaces scope decisions when governance retires", () => {
    expect(migration).toContain("and earlier.effective_from < approved_version.effective_from");
    expect(migration).toContain("or (item.pending_source = 'manual' and item.pending_decision in ('in_scope', 'out_of_scope')));");
  });

  it("requires an active Registration Unit in every command and binds a row's form to the version it cites", () => {
    expect(migration.match(/message = 'The Registration Unit is not active\.'/g)?.length).toBe(4);
    expect(migration).toContain("and (calendar_entry.requirement_version_id is null or version.id = calendar_entry.requirement_version_id)");
  });

  it("turns an unresolved return into a candidate once a governed requirement is active", () => {
    expect(migration).toMatch(/and item\.selection_status = 'unresolved'\s+and item\.pending_decision is null\s+-- No requirement, or one that is no longer in force/);
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
