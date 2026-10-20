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
    tax_due_amount: number | null;
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
    amount?: number | null;
    external_date: string | null;
    acknowledged_on: string | null;
    validated_on: string | null;
    attachment_name: string | null;
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

export type LiveClientCalendarEntry = LivePublishedCalendarEntry & {
  calendar_year: number;
  calendar_month: string;
  requirement_code: string;
  requirement_name: string;
  operating_category: string;
  frequency_label: string;
  form_number: string;
};

export type CreateLiveGeneratedWorkInput = {
  clientReference: string;
  requirementCode: string;
  periodLabel: string;
  tmfPackageTarget: string | null;
  paymentApplicability: "required" | "not_applicable" | "unresolved";
  paymentAmount: number | null;
  idempotencyKey: string;
};

export async function createLiveGeneratedWork(input: CreateLiveGeneratedWorkInput) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  const { data, error } = await client.rpc("create_manual_generated_work", {
    p_client_reference: input.clientReference,
    p_requirement_code: input.requirementCode,
    p_period_label: input.periodLabel,
    p_tmf_package_target: input.tmfPackageTarget,
    p_payment_applicability: input.paymentApplicability,
    p_payment_amount: input.paymentAmount,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(`Unable to create generated compliance work: ${error.message}`);
  return String(data);
}

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
        tax_due_amount,
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
        acknowledged_on,
        validated_on,
        attachment_name,
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

export async function listLiveClientCalendarEntries(requirementIds: readonly string[], year: number): Promise<LiveClientCalendarEntry[]> {
  if (requirementIds.length === 0) return [];
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client
    .from("monthly_calendar_entries")
    .select(`
      id,
      requirement_id,
      requirement_version_id,
      external_requirement_label,
      period_or_event,
      period_start,
      period_end,
      base_statutory_deadline,
      adjusted_statutory_deadline,
      tmf_package_target,
      published_operational_deadline,
      publication_status,
      monthly_calendar_versions!inner(calendar_month, status),
      bir_requirements!inner(requirement_code, requirement_name, operating_category, frequency_label),
      requirement_version_forms(
        relationship_type,
        bir_forms(form_number)
      )
    `)
    .in("requirement_id", [...requirementIds])
    .eq("publication_status", "published")
    .eq("monthly_calendar_versions.status", "released")
    .gte("monthly_calendar_versions.calendar_month", `${year}-01-01`)
    .lt("monthly_calendar_versions.calendar_month", `${year + 1}-01-01`)
    .order("published_operational_deadline", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Unable to load released client calendar entries: ${error.message}`);

  return (data ?? []).flatMap((value) => {
    const row = value as unknown as Record<string, unknown>;
    const calendarVersion = Array.isArray(row.monthly_calendar_versions) ? row.monthly_calendar_versions[0] : row.monthly_calendar_versions;
    const requirement = Array.isArray(row.bir_requirements) ? row.bir_requirements[0] : row.bir_requirements;
    const forms = Array.isArray(row.requirement_version_forms) ? row.requirement_version_forms : [];
    const formNumbers = forms.flatMap((relation) => {
      if (!relation || typeof relation !== "object") return [];
      const form = (relation as { bir_forms?: unknown }).bir_forms;
      const record = Array.isArray(form) ? form[0] : form;
      return record && typeof record === "object" && typeof (record as { form_number?: unknown }).form_number === "string" ? [(record as { form_number: string }).form_number] : [];
    });
    if (!calendarVersion || typeof calendarVersion !== "object" || !requirement || typeof requirement !== "object" || formNumbers.length === 0) return [];
    const calendarMonth = (calendarVersion as { calendar_month?: unknown }).calendar_month;
    const requirementCode = (requirement as { requirement_code?: unknown }).requirement_code;
    const requirementName = (requirement as { requirement_name?: unknown }).requirement_name;
    if (typeof calendarMonth !== "string" || typeof requirementCode !== "string" || typeof requirementName !== "string") return [];
    return [{
      id: String(row.id),
      requirement_id: String(row.requirement_id),
      requirement_version_id: typeof row.requirement_version_id === "string" ? row.requirement_version_id : null,
      external_requirement_label: String(row.external_requirement_label ?? requirementName),
      period_or_event: typeof row.period_or_event === "string" ? row.period_or_event : null,
      period_start: typeof row.period_start === "string" ? row.period_start : null,
      period_end: typeof row.period_end === "string" ? row.period_end : null,
      base_statutory_deadline: typeof row.base_statutory_deadline === "string" ? row.base_statutory_deadline : null,
      adjusted_statutory_deadline: typeof row.adjusted_statutory_deadline === "string" ? row.adjusted_statutory_deadline : null,
      tmf_package_target: typeof row.tmf_package_target === "string" ? row.tmf_package_target : null,
      published_operational_deadline: typeof row.published_operational_deadline === "string" ? row.published_operational_deadline : null,
      publication_status: "published" as const,
      calendar_year: year,
      calendar_month: calendarMonth,
      requirement_code: requirementCode,
      requirement_name: requirementName,
      operating_category: typeof (requirement as { operating_category?: unknown }).operating_category === "string" ? (requirement as { operating_category: string }).operating_category : "others",
      frequency_label: typeof (requirement as { frequency_label?: unknown }).frequency_label === "string" ? (requirement as { frequency_label: string }).frequency_label : "as_needed",
      form_number: [...new Set(formNumbers)].join(" · "),
    } satisfies LiveClientCalendarEntry];
  });
}

export async function listRequirementIdsForFormNumbers(formNumbers: readonly string[]) {
  const normalized = [...new Set(formNumbers.map((value) => value.trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0) return [];
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data: forms, error: formsError } = await client.from("bir_forms").select("id, form_number").in("form_number", normalized);
  if (formsError) throw new Error(`Unable to resolve governed return forms: ${formsError.message}`);
  const formIds = (forms ?? []).map((form) => form.id as string);
  if (formIds.length === 0) return [];

  const { data: relations, error: relationsError } = await client.from("requirement_version_forms").select("requirement_version_id, form_id").in("form_id", formIds);
  if (relationsError) throw new Error(`Unable to resolve governed return requirements: ${relationsError.message}`);
  const versionIds = [...new Set((relations ?? []).map((relation) => relation.requirement_version_id as string))];
  if (versionIds.length === 0) return [];

  const { data: versions, error: versionsError } = await client.from("bir_requirement_versions").select("id, requirement_id").in("id", versionIds);
  if (versionsError) throw new Error(`Unable to resolve governed requirement versions: ${versionsError.message}`);
  return [...new Set((versions ?? []).map((version) => version.requirement_id as string))];
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
  if (command === "data_readiness") {
    const { data, error } = await client.rpc("record_generated_work_readiness", {
      p_work_id: workId,
      p_ready: Boolean(payload.ready),
      p_source: typeof payload.source === "string" ? payload.source : "",
      p_reason: typeof payload.reason === "string" ? payload.reason : "",
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(`Unable to record data readiness: ${error.message}`);
    return data as Record<string, unknown>;
  }
  if (command === "period_lock") {
    const { data, error } = await client.rpc("record_generated_return_lock", {
      p_work_id: workId,
      p_locked: Boolean(payload.locked),
      p_reason: typeof payload.reason === "string" ? payload.reason : "",
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(`Unable to record return lock: ${error.message}`);
    return data as Record<string, unknown>;
  }
  const { data, error } = await client.rpc("record_generated_work_command", {
    p_work_id: workId,
    p_command: command,
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(`Unable to record generated compliance work command: ${error.message}`);
  return data as Record<string, unknown>;
}
