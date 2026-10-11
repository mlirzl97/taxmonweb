import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LiveGeneratedWork = {
  id: string;
  registration_unit_id: string;
  period_label: string;
  data_readiness: "not_ready" | "ready";
  lifecycle_stage: "preparation" | "checking" | "review" | "client_approval" | "filing" | "payment" | "other_submissions" | "complete";
  engagement_status: "open" | "complete" | "cancelled" | "superseded";
  rag_status: "green" | "amber" | "red" | "unresolved";
  base_statutory_deadline: string | null;
  adjusted_statutory_deadline: string | null;
  tmf_package_target: string | null;
  internal_target_missed: boolean;
  statutory_deadline_missed: boolean;
  preparer_user_id: string | null;
  checker_user_id: string | null;
  reviewer_user_id: string | null;
  current_owner_user_id: string | null;
  registration_units: {
    id: string;
    display_name: string;
    unit_kind: string;
    taxpayer_entities: {
      display_name: string;
      clients: { reference_code: string; display_name: string } | Array<{ reference_code: string; display_name: string }> | null;
    } | Array<{
      display_name: string;
      clients: { reference_code: string; display_name: string } | Array<{ reference_code: string; display_name: string }> | null;
    }>;
    registration_unit_scope_assignments: Array<{
      organization_units: { code: string; name: string; unit_kind: string } | Array<{ code: string; name: string; unit_kind: string }> | null;
    }>;
  } | null;
  bir_requirements: { requirement_code: string; requirement_name: string } | Array<{ requirement_code: string; requirement_name: string }> | null;
  generated_compliance_work_components: Array<{
    component_code: string;
    label: string;
    component_type: "return_filing" | "payment" | "attachment_schedule" | "electronic_submission" | "evidence" | "other";
    requiredness: "mandatory" | "conditional" | "optional" | "event_driven" | "unresolved";
    status: "not_started" | "in_progress" | "complete" | "not_applicable" | "blocked" | "unresolved";
    statutory_deadline: string | null;
    evidence_state: "not_recorded" | "recorded" | "accepted" | "unresolved";
  }>;
};

export async function listLiveGeneratedWork(): Promise<LiveGeneratedWork[]> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client
    .from("generated_compliance_work")
    .select(`
      id,
      registration_unit_id,
      period_label,
      data_readiness,
      lifecycle_stage,
      engagement_status,
      rag_status,
      base_statutory_deadline,
      adjusted_statutory_deadline,
      tmf_package_target,
      internal_target_missed,
      statutory_deadline_missed,
      preparer_user_id,
      checker_user_id,
      reviewer_user_id,
      current_owner_user_id,
      registration_units (
        id,
        display_name,
        unit_kind,
        taxpayer_entities (
          display_name,
          clients (reference_code, display_name)
        ),
        registration_unit_scope_assignments (
          organization_units (code, name, unit_kind)
        )
      ),
      bir_requirements (requirement_code, requirement_name),
      generated_compliance_work_components (
        component_code,
        label,
        component_type,
        requiredness,
        status,
        statutory_deadline,
        evidence_state
      )
    `)
    .order("tmf_package_target", { ascending: true, nullsFirst: false })
    .order("period_label", { ascending: true });

  if (error) throw new Error(`Unable to load generated compliance work: ${error.message}`);
  return (data ?? []) as unknown as LiveGeneratedWork[];
}
