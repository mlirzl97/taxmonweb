import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ExpectedComplianceItem = {
  id: string;
  formNumber: string;
  status: "candidate" | "approved" | "excluded" | "unresolved" | "superseded";
  serviceScope: "in_scope" | "out_of_scope" | null;
  reason: string | null;
  decidedAt: string | null;
  pendingDecision: "in_scope" | "out_of_scope" | "not_applicable" | "unresolved" | null;
  pendingReason: string | null;
  /** Open generated work for a return that is no longer approved In TMF Scope. */
  openWorkOutOfScope: number;
};

export type ExpectedComplianceApproval = {
  approvedAt: string;
  approvedBy: string;
  reason: string;
  /** Calendar-driving fields of the Tax Profile version the approval came from. */
  profile: { firstPeriodToFile: string | null; taxYearBasis: string | null; fiscalYearEnd: string | null; goLiveDate: string | null };
};

export type GenerationItem = {
  form: string;
  kind: "return" | "proof";
  periodStart: string;
  periodLabel: string;
  dueDate: string;
  calendarEntryId: string | null;
};

export type GenerationResult = { created: number; existing: number; skipped: { item: GenerationItem; reason: string }[] };

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured for this environment.");
  return supabase;
}

export async function listExpectedCompliance(registrationUnitId: string) {
  const supabase = await client();
  const [{ data: items, error: itemsError }, { data: approvals, error: approvalsError }] = await Promise.all([
    supabase.from("client_compliance_universe_items")
      .select("id, form_number, selection_status, service_scope, decision_reason, decided_at, pending_decision, pending_reason")
      .eq("registration_unit_id", registrationUnitId)
      .neq("selection_status", "superseded")
      .order("form_number"),
    supabase.from("expected_compliance_approvals")
      .select("approved_at, reason, app_users!expected_compliance_approvals_approved_by_fkey(display_name), tax_profile_versions!expected_compliance_approvals_tax_profile_version_id_fkey(profile_data)")
      .eq("registration_unit_id", registrationUnitId)
      .order("approved_at", { ascending: false })
      .limit(1),
  ]);
  if (itemsError) throw new Error(`Unable to load Expected Compliance: ${itemsError.message}`);
  if (approvalsError) throw new Error(`Unable to load Expected Compliance approvals: ${approvalsError.message}`);
  type ProfileData = { profile_data?: { firstPeriodToFile?: unknown; taxYearBasis?: unknown; fiscalYearEnd?: unknown; goLiveDate?: unknown } | null };
  const latest = approvals?.[0] as { approved_at: string; reason: string; app_users?: { display_name?: string } | { display_name?: string }[] | null; tax_profile_versions?: ProfileData | ProfileData[] | null } | undefined;
  const approver = Array.isArray(latest?.app_users) ? latest?.app_users[0] : latest?.app_users;
  const approvedProfile = Array.isArray(latest?.tax_profile_versions) ? latest?.tax_profile_versions[0] : latest?.tax_profile_versions;
  const approvedField = (key: "firstPeriodToFile" | "taxYearBasis" | "fiscalYearEnd" | "goLiveDate") => {
    const value = approvedProfile?.profile_data?.[key];
    return typeof value === "string" && value ? value : null;
  };
  // Open work still running for a return that approval has since taken out of scope.
  const { data: openWork, error: openWorkError } = await supabase.from("generated_compliance_work")
    .select("source_context")
    .eq("registration_unit_id", registrationUnitId)
    .eq("engagement_status", "open");
  if (openWorkError) throw new Error(`Unable to load open Compliance Work: ${openWorkError.message}`);
  const openByForm = new Map<string, number>();
  for (const work of openWork ?? []) {
    const form = (work.source_context as { formNumber?: unknown } | null)?.formNumber;
    if (typeof form === "string") openByForm.set(form, (openByForm.get(form) ?? 0) + 1);
  }
  return {
    items: (items ?? []).map((item) => ({
      id: String(item.id),
      formNumber: String(item.form_number ?? ""),
      status: item.selection_status as ExpectedComplianceItem["status"],
      serviceScope: (item.service_scope ?? null) as ExpectedComplianceItem["serviceScope"],
      reason: (item.decision_reason ?? null) as string | null,
      decidedAt: (item.decided_at ?? null) as string | null,
      pendingDecision: (item.pending_decision ?? null) as ExpectedComplianceItem["pendingDecision"],
      pendingReason: (item.pending_reason ?? null) as string | null,
      openWorkOutOfScope: item.selection_status === "approved" && item.service_scope === "in_scope" ? 0 : openByForm.get(String(item.form_number ?? "")) ?? 0,
    })) satisfies ExpectedComplianceItem[],
    latestApproval: latest ? {
      approvedAt: latest.approved_at,
      reason: latest.reason,
      approvedBy: approver?.display_name ?? "Recorded approver",
      profile: { firstPeriodToFile: approvedField("firstPeriodToFile"), taxYearBasis: approvedField("taxYearBasis"), fiscalYearEnd: approvedField("fiscalYearEnd"), goLiveDate: approvedField("goLiveDate") },
    } satisfies ExpectedComplianceApproval : null,
  };
}

export async function proposeExpectedCompliance(registrationUnitId: string) {
  const { data, error } = await (await client()).rpc("propose_expected_compliance", { p_registration_unit_id: registrationUnitId });
  if (error) throw new Error(`Unable to propose Expected Compliance: ${error.message}`);
  return Number(data ?? 0);
}

export async function decideExpectedComplianceItem(registrationUnitId: string, itemId: string, decision: string, reason: string | null) {
  const { error } = await (await client()).rpc("decide_expected_compliance_item", { p_registration_unit_id: registrationUnitId, p_item_id: itemId, p_decision: decision, p_reason: reason });
  if (error) throw new Error(`Unable to record the Expected Compliance decision: ${error.message}`);
}

export async function approveExpectedCompliance(registrationUnitId: string, reason: string, elevatedOverride = false) {
  const { data, error } = await (await client()).rpc("approve_expected_compliance", { p_registration_unit_id: registrationUnitId, p_reason: reason, p_elevated_override: elevatedOverride });
  if (error) throw new Error(`Unable to approve Expected Compliance: ${error.message}`);
  return Number(data ?? 0);
}

export async function recordGeneratedComplianceWork(registrationUnitId: string, items: readonly GenerationItem[]): Promise<GenerationResult> {
  const { data, error } = await (await client()).rpc("record_generated_compliance_work", { p_registration_unit_id: registrationUnitId, p_items: items });
  if (error) throw new Error(`Unable to generate Compliance Work: ${error.message}`);
  const result = (data ?? {}) as Partial<GenerationResult>;
  return { created: Number(result.created ?? 0), existing: Number(result.existing ?? 0), skipped: Array.isArray(result.skipped) ? result.skipped : [] };
}

export async function expectedCompliancePermissions() {
  const supabase = await client();
  const check = async (capability: string) => {
    const { data, error } = await supabase.rpc("has_active_capability", { required_capability: capability });
    return !error && data === true;
  };
  const [propose, approve, maintainWork] = await Promise.all([check("ProposeComplianceUniverse"), check("ApproveComplianceUniverse"), check("MaintainGeneratedComplianceWork")]);
  return { canPropose: propose || approve, canApprove: approve, canGenerate: approve || maintainWork };
}
