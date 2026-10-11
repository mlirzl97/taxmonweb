import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LiveGeneratedWork = {
  id: string;
  registration_unit_id: string;
  requirement_id: string;
  requirement_version_id: string;
  period_label: string;
  period_locked?: boolean;
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
  period_key?: string | null;
  payment_applicability?: "required" | "not_applicable" | "unresolved" | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  payment_route?: string | null;
  current_gate?: "preparer" | "checker" | "reviewer" | null;
  final_certified_by?: string | null;
  final_certified_at?: string | null;
  final_certification_note?: string | null;
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
  generated_work_process_steps?: Array<{
    step_code: string;
    bundle: "filing" | "payment" | "attachments" | "archiving";
    label: string;
    owner_role: "preparer" | "checker" | "reviewer" | "tax_control";
    step_order: number;
    status: "not_started" | "in_progress" | "needs_attention" | "complete" | "not_applicable";
    started_at: string | null;
    completed_at: string | null;
    updated_at: string;
  }>;
  generated_work_gate_attempts?: Array<{
    role: "preparer" | "checker" | "reviewer";
    decision: "certify" | "approve" | "return";
    note: string;
    answers: Record<string, boolean>;
    actor_id: string;
    override_reason: string | null;
    recorded_at: string;
  }>;
  generated_work_checklist_updates?: Array<{
    role: "preparer" | "checker" | "reviewer";
    question_id: string;
    completed: boolean;
    actor_id: string;
    recorded_at: string;
  }>;
  generated_work_evidence?: Array<{
    step_code: string;
    evidence_kind: "result" | "filing" | "payment" | "attachment" | "archive" | "client_approval" | "other";
    reference: string;
    external_date: string | null;
    external_reference: string | null;
    external_channel: string | null;
    sharepoint_url: string | null;
    result_status: "reported" | "validated" | "accepted" | "rejected" | "resent" | "verified" | null;
    note: string | null;
    actor_id: string;
    recorded_at: string;
  }>;
  generated_work_qa_findings?: Array<Record<string, unknown>>;
  generated_work_period_lock_events?: Array<{
    locked: boolean;
    reason: string;
    actor_id: string;
    recorded_at: string;
  }>;
};

export type LivePublishedCalendarEntry = {
  id: string;
  requirement_id: string;
  requirement_version_id: string | null;
  external_requirement_label: string;
  period_or_event: string | null;
  period_start: string | null;
  period_end: string | null;
  base_statutory_deadline: string | null;
  adjusted_statutory_deadline: string | null;
  tmf_package_target: string | null;
  published_operational_deadline: string | null;
  publication_status: "published";
};

export async function listLiveGeneratedWork(): Promise<LiveGeneratedWork[]> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client
    .from("generated_compliance_work")
    .select(`
      id,
      registration_unit_id,
      requirement_id,
      requirement_version_id,
      period_label,
      period_locked,
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
      period_key,
      payment_applicability,
      payment_amount,
      payment_currency,
      payment_route,
      current_gate,
      final_certified_by,
      final_certified_at,
      final_certification_note,
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
      ),
      generated_work_process_steps (
        step_code,
        bundle,
        label,
        owner_role,
        step_order,
        status,
        started_at,
        completed_at,
        updated_at
      ),
      generated_work_gate_attempts (
        role,
        decision,
        note,
        answers,
        actor_id,
        override_reason,
        recorded_at
      ),
      generated_work_checklist_updates (
        role,
        question_id,
        completed,
        actor_id,
        recorded_at
      ),
      generated_work_evidence (
        step_code,
        evidence_kind,
        reference,
        external_date,
        external_reference,
        external_channel,
        sharepoint_url,
        result_status,
        note,
        actor_id,
        recorded_at
      ),
      generated_work_qa_findings (*),
      generated_work_period_lock_events (
        locked,
        reason,
        actor_id,
        recorded_at
      )
    `)
    .order("tmf_package_target", { ascending: true, nullsFirst: false })
    .order("period_label", { ascending: true });

  if (error) throw new Error(`Unable to load generated compliance work: ${error.message}`);
  return (data ?? []) as unknown as LiveGeneratedWork[];
}

export async function listLivePublishedCalendarEntries(requirementIds: readonly string[]): Promise<LivePublishedCalendarEntry[]> {
  if (requirementIds.length === 0) return [];
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client
    .from("monthly_calendar_entries")
    .select("id, requirement_id, requirement_version_id, external_requirement_label, period_or_event, period_start, period_end, base_statutory_deadline, adjusted_statutory_deadline, tmf_package_target, published_operational_deadline, publication_status")
    .in("requirement_id", [...requirementIds])
    .eq("publication_status", "published")
    .order("published_operational_deadline", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Unable to load released calendar entries: ${error.message}`);
  return (data ?? []) as LivePublishedCalendarEntry[];
}

export async function getLiveGeneratedWorkDetail(workId: string) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  const { data, error } = await client.rpc("get_generated_work_detail", { p_work_id: workId });
  if (error) throw new Error(`Unable to load generated compliance work detail: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function recordLiveGeneratedWorkCommand(workId: string, command: string, payload: Record<string, unknown>, idempotencyKey: string) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  const { data, error } = await client.rpc("record_generated_work_command", {
    p_work_id: workId,
    p_command: command,
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(`Unable to record generated compliance work command: ${error.message}`);
  return data as Record<string, unknown>;
}
