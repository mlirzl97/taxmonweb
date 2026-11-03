-- Work lifecycle controls (pilot readiness).
--
-- An end-to-end run of one return through every step showed four gaps:
-- 1. Certifying a gate was inverted. Answering every question "yes" was
--    refused and any "no" was accepted, so a Preparer could not certify and a
--    Checker passed with unticked questions.
-- 2. Client approval, filing, payment, archiving and closure did not require
--    the Checker and Reviewer to have signed off.
-- 3. Holding MaintainGeneratedComplianceWork bypassed segregation of duties
--    silently, with no reason and no mark, so one person could prepare and
--    check the same return.
-- 4. The live definition had lost the guard that a completed step is reset
--    only by a reasoned override, after later migrations patched it by text.
--
-- This migration states the whole command again, from the repository
-- definition with every guard, and fixes all four. Acting outside an
-- assigned role now needs the HOD's Elevated Override (H-011) and a reason,
-- and is marked. Who actually prepared and checked a return can never
-- review or check it, override or not.

-- The questions each gate certifies, as the workflow screen asks them
-- (roleQuestions in src/lib/workflow-rules.ts; a contract test keeps the two
-- lists equal). Every one must be answered yes; none may be left out.
create or replace function public.gate_required_questions(p_role text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(p_role)
    when 'preparer' then array['correct-context', 'data-reviewed', 'mapping-complete', 'documents-vouched', 'reconciled', 'working-paper-agrees', 'self-check-complete', 'issues-recorded']
    when 'checker' then array['preparation-traceable', 'source-supports-return', 'mapping-reasonable', 'vouching-sufficient', 'tie-outs-satisfactory', 'exceptions-documented', 'tax-due-recorded', 'ready-for-review']
    when 'reviewer' then array['independent-review', 'material-items-considered', 'judgments-addressed', 'risks-documented', 'client-output-complete', 'ready-for-client']
    else array[]::text[]
  end;
$$;
revoke execute on function public.gate_required_questions(text) from public, anon, authenticated;

create or replace function public.record_generated_work_command(p_work_id uuid, p_command text, p_payload jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  work public.generated_compliance_work;
  step public.generated_work_process_steps;
  next_step public.generated_work_process_steps;
  actor_id uuid := auth.uid();
  actor_display text;
  role_value text := lower(trim(coalesce(p_payload ->> 'role', '')));
  decision_value text := lower(trim(coalesce(p_payload ->> 'decision', '')));
  step_code_value text := lower(trim(coalesce(p_payload ->> 'stepCode', '')));
  status_value text := lower(trim(coalesce(p_payload ->> 'status', '')));
  evidence_reference text := nullif(trim(p_payload ->> 'evidenceReference'), '');
  override_reason text := nullif(trim(p_payload ->> 'overrideReason'), '');
  note_value text := nullif(trim(p_payload ->> 'note'), '');
  reason_value text := nullif(trim(p_payload ->> 'reason'), '');
  event_id uuid;
  before_state jsonb;
  after_state jsonb;
  current_status text;
  -- Acting outside an assigned role is an Elevated Override: the
  -- PerformElevatedOverride authority (the HOD, H-011) with a stated reason,
  -- marked on the record. Maintaining work is not an override.
  has_elevated_authority boolean := public.has_active_capability('PerformElevatedOverride') and nullif(trim(p_payload ->> 'overrideReason'), '') is not null;
  is_elevated boolean := has_elevated_authority;
  payment_applicability_value text := lower(trim(coalesce(p_payload ->> 'paymentApplicability', '')));
  payment_amount_value numeric := nullif(trim(p_payload ->> 'paymentAmount'), '')::numeric;
  acknowledged_on_value date := nullif(trim(p_payload ->> 'acknowledgedOn'), '')::date;
  validated_on_value date := nullif(trim(p_payload ->> 'validatedOn'), '')::date;
  attachment_name_value text := nullif(trim(p_payload ->> 'attachmentName'), '');
begin
  if actor_id is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required for Work commands.';
  end if;
  if p_idempotency_key is null or nullif(trim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'A Work command idempotency key is required.';
  end if;
  if exists (select 1 from public.generated_compliance_work_events where idempotency_key = trim(p_idempotency_key)) then
    select id into event_id from public.generated_compliance_work_events where idempotency_key = trim(p_idempotency_key);
    return jsonb_build_object('accepted', true, 'idempotent', true, 'eventId', event_id, 'workId', p_work_id);
  end if;
  if not public.can_view_generated_work(p_work_id) then
    raise exception using errcode = '42501', message = 'Generated work is outside the caller''s scope.';
  end if;

  select * into work from public.generated_compliance_work where id = p_work_id for update;
  if work.id is null then raise exception using errcode = '22023', message = 'Generated work was not found.'; end if;
  select display_name into actor_display from public.app_users where id = actor_id;
  before_state := to_jsonb(work);

  if work.period_locked and p_command <> 'period_lock' then
    raise exception using errcode = '42501', message = 'This period is locked by Tax Team.';
  end if;

  if p_command = 'checklist' then
    if role_value not in ('preparer', 'checker', 'reviewer') or nullif(trim(p_payload ->> 'questionId'), '') is null then
      raise exception using errcode = '22023', message = 'Checklist role and question are required.';
    end if;
    if not (public.has_active_capability('ExecuteGeneratedComplianceWork') or public.has_active_capability('MaintainGeneratedComplianceWork')) then
      raise exception using errcode = '42501', message = 'Work checklist authority is not configured for the caller.';
    end if;
    if not has_elevated_authority and work.current_gate is distinct from role_value then
      raise exception using errcode = '42501', message = 'The checklist is not currently assigned to this role.';
    end if;
    if not has_elevated_authority and ((role_value = 'preparer' and work.preparer_user_id is null) or (role_value = 'checker' and work.checker_user_id is null) or (role_value = 'reviewer' and work.reviewer_user_id is null)) then
      raise exception using errcode = '42501', message = 'The assigned control actor is not configured for this work.';
    end if;
    insert into public.generated_work_checklist_updates (generated_work_id, role, question_id, completed, actor_id)
    values (p_work_id, role_value, trim(p_payload ->> 'questionId'), coalesce((p_payload ->> 'completed')::boolean, false), actor_id);
    after_state := jsonb_build_object('role', role_value, 'questionId', trim(p_payload ->> 'questionId'), 'completed', coalesce((p_payload ->> 'completed')::boolean, false));
  elsif p_command = 'gate_decision' then
    if role_value not in ('preparer', 'checker', 'reviewer') or decision_value not in ('certify', 'approve', 'return') or note_value is null then
      raise exception using errcode = '22023', message = 'Gate role, decision, and note are required.';
    end if;
    -- Certified only when every question this gate asks is present and
    -- answered yes (true). Other fields carried with the answers, such as the
    -- Checker's tax due amount, are not questions.
    if decision_value <> 'return' and (jsonb_typeof(coalesce(p_payload -> 'answers', '{}'::jsonb)) <> 'object'
       or exists (select 1 from unnest(public.gate_required_questions(role_value)) question
                   where coalesce(p_payload -> 'answers' -> question, 'null'::jsonb) <> 'true'::jsonb)) then
      raise exception using errcode = '22023', message = 'Every applicable gate question must be certified.';
    end if;
    if not has_elevated_authority and work.current_gate is distinct from role_value then
      raise exception using errcode = '42501', message = 'This work is not currently waiting for that control role.';
    end if;
    if decision_value <> 'return' and not has_elevated_authority then
      if (role_value = 'preparer' and work.preparer_user_id is not null and work.preparer_user_id <> actor_id)
        or (role_value = 'checker' and (work.checker_user_id is null or work.checker_user_id = work.preparer_user_id or work.checker_user_id <> actor_id))
        or (role_value = 'reviewer' and (work.reviewer_user_id is null or work.reviewer_user_id in (work.preparer_user_id, work.checker_user_id) or work.reviewer_user_id <> actor_id)) then
        raise exception using errcode = '42501', message = 'The actual actor is not the assigned control role or fails segregation of duties.';
      end if;
    end if;
    -- Gates are certified in order, even by override: no Checker sign-off
    -- without a Preparer's, no Reviewer sign-off without a Checker's.
    if decision_value <> 'return' and role_value in ('checker', 'reviewer')
       and not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'preparer' and status = 'complete') then
      raise exception using errcode = '22023', message = 'The Preparer must certify first.';
    end if;
    if decision_value <> 'return' and role_value = 'reviewer'
       and not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'checker' and status = 'complete') then
      raise exception using errcode = '22023', message = 'The Checker must certify first.';
    end if;
    -- Who actually certified the earlier gates governs segregation of duties,
    -- whatever roles are assigned, and no override erases it.
    if decision_value <> 'return' and role_value in ('checker', 'reviewer') and exists (
      select 1 from public.generated_work_gate_attempts attempt
       where attempt.generated_work_id = p_work_id
         and attempt.decision <> 'return'
         and attempt.actor_id = auth.uid()
         -- Anyone who ever certified Preparation cannot check or review;
         -- anyone who ever certified Checking cannot review.
         and (attempt.role = 'preparer' or (role_value = 'reviewer' and attempt.role = 'checker'))) then
      raise exception using errcode = '42501', message = 'The same person cannot prepare, check and review one return.';
    end if;
    if is_elevated and override_reason is null then raise exception using errcode = '22023', message = 'An elevated override reason is required.'; end if;
    if role_value = 'checker' and decision_value <> 'return' and work.payment_applicability = 'required' then
      if payment_amount_value is null or payment_amount_value < 0 then
        raise exception using errcode = '22023', message = 'Record the amount to pay before certifying the Checker gate.';
      end if;
      update public.generated_compliance_work
      set payment_amount = payment_amount_value, updated_at = now(), updated_by = actor_id
      where id = p_work_id;
    end if;

    insert into public.generated_work_gate_attempts (generated_work_id, role, decision, note, answers, actor_id, override_reason)
    values (p_work_id, role_value, decision_value, note_value, coalesce(p_payload -> 'answers', '{}'::jsonb), actor_id, case when is_elevated then override_reason else null end);
    if decision_value = 'return' then
      update public.generated_compliance_work set current_gate = 'preparer', lifecycle_stage = 'preparation', rag_status = 'amber', updated_at = now(), updated_by = actor_id where id = p_work_id;
      insert into public.generated_work_process_steps (generated_work_id, step_code, bundle, label, owner_role, step_order, status, updated_at)
      values (p_work_id, role_value, 'filing', initcap(role_value) || ' review', role_value, case role_value when 'preparer' then 1 when 'checker' then 2 else 3 end, 'needs_attention', now())
      on conflict (generated_work_id, step_code) do update set status = 'needs_attention', updated_at = now();
    else
      update public.generated_compliance_work
      set current_gate = case role_value when 'preparer' then 'checker' when 'checker' then 'reviewer' else null end,
          lifecycle_stage = case role_value when 'preparer' then 'checking' when 'checker' then 'review' else 'client_approval' end,
          updated_at = now(), updated_by = actor_id
      where id = p_work_id;
      insert into public.generated_work_process_steps (generated_work_id, step_code, bundle, label, owner_role, step_order, status, completed_at, updated_at)
      values (p_work_id, role_value, 'filing', initcap(role_value) || ' review', role_value, case role_value when 'preparer' then 1 when 'checker' then 2 else 3 end, 'complete', now(), now())
      on conflict (generated_work_id, step_code) do update set status = 'complete', completed_at = now(), updated_at = now();
    end if;
    after_state := jsonb_build_object('role', role_value, 'decision', decision_value, 'note', note_value);
  elsif p_command = 'payment_profile' then
    if not has_elevated_authority and not public.has_active_capability('ExecuteGeneratedComplianceWork') then raise exception using errcode = '42501', message = 'Payment profile authority is not configured for the caller.'; end if;
    -- Whether and how much to pay is set by the assigned Preparer or Checker
    -- while the return is with them; after the Checker certifies it changes
    -- only by reasoned override.
    if not has_elevated_authority and (actor_id is distinct from work.preparer_user_id and actor_id is distinct from work.checker_user_id) then
      raise exception using errcode = '42501', message = 'Only the assigned Preparer or Checker sets the payment profile.';
    end if;
    if not has_elevated_authority and work.current_gate is distinct from 'preparer' and work.current_gate is distinct from 'checker' then
      raise exception using errcode = '42501', message = 'The payment profile is fixed once the Checker has certified.';
    end if;
    if payment_applicability_value not in ('required', 'not_applicable', 'unresolved') then raise exception using errcode = '22023', message = 'Payment applicability is invalid.'; end if;
    if payment_applicability_value = 'not_applicable' then payment_amount_value := null; elsif payment_amount_value is not null and payment_amount_value < 0 then raise exception using errcode = '22023', message = 'Payment amount cannot be negative.'; end if;
    update public.generated_compliance_work
    set payment_applicability = payment_applicability_value, payment_amount = payment_amount_value, payment_route = nullif(trim(p_payload ->> 'paymentRoute'), ''), updated_at = now(), updated_by = actor_id
    where id = p_work_id;
    after_state := jsonb_build_object('paymentApplicability', payment_applicability_value, 'paymentAmount', payment_amount_value, 'paymentRoute', p_payload ->> 'paymentRoute');
  elsif p_command = 'process_status' then
    if step_code_value not in ('client-approval', 'filing', 'payment', 'payment-client-approval', 'payment-confirmation', 'esubmission', 'evidence') or status_value not in ('not_started', 'in_progress', 'needs_attention', 'complete', 'not_applicable') then
      raise exception using errcode = '22023', message = 'Process step or status is invalid.';
    end if;
    if not has_elevated_authority and not public.has_active_capability('ExecuteGeneratedComplianceWork') then
      raise exception using errcode = '42501', message = 'Work process authority is not configured for the caller.';
    end if;
    if not has_elevated_authority and (work.preparer_user_id is null or work.preparer_user_id <> actor_id) then
      raise exception using errcode = '42501', message = 'The Preparer is accountable for this process step.';
    end if;
    -- Preparation, checking and review come first (locked invariant):
    -- nothing after them moves until the Reviewer has approved.
    if status_value <> 'not_started' and (work.current_gate is not null
       or (select count(*) from public.generated_work_process_steps where generated_work_id = p_work_id and step_code in ('preparer', 'checker', 'reviewer') and status = 'complete') < 3) then
      raise exception using errcode = '22023', message = 'Preparation, checking and review must be complete first.';
    end if;
    select status into current_status
    from public.generated_work_process_steps
    where generated_work_id = p_work_id and step_code = step_code_value;
    if status_value = 'not_started' and current_status in ('complete', 'not_applicable') and not is_elevated then
      raise exception using errcode = '42501', message = 'A completed process step requires an authorized override to correct.';
    end if;
    if status_value = 'not_started' and current_status in ('complete', 'not_applicable') and override_reason is null then
      raise exception using errcode = '22023', message = 'An override reason is required to correct a completed process step.';
    end if;
    if step_code_value = 'filing' and status_value in ('complete', 'in_progress') and not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'client-approval' and status in ('complete', 'not_applicable')) then
      raise exception using errcode = '22023', message = 'Client approval must be complete before filing.';
    end if;
    if step_code_value in ('payment', 'payment-client-approval', 'payment-confirmation') and status_value in ('complete', 'in_progress') and not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'filing' and status = 'complete') then
      raise exception using errcode = '22023', message = 'Filing must be complete before payment.';
    end if;
    if step_code_value = 'evidence' and status_value in ('complete', 'in_progress') and (not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'filing' and status = 'complete') or (work.payment_applicability = 'required' and not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'payment-confirmation' and status = 'complete')) or not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'esubmission' and status in ('complete', 'not_applicable'))) then
      raise exception using errcode = '22023', message = 'Filing, applicable payment, and attachments must be complete before archiving.';
    end if;
    if status_value in ('complete', 'not_applicable') and evidence_reference is null then raise exception using errcode = '22023', message = 'A result or evidence reference is required.'; end if;
    if step_code_value in ('payment', 'payment-client-approval', 'payment-confirmation') and status_value = 'not_applicable' and work.payment_applicability = 'unresolved' then raise exception using errcode = '22023', message = 'Resolve payment applicability before skipping payment.'; end if;
    if step_code_value in ('payment', 'payment-client-approval', 'payment-confirmation') and status_value = 'not_applicable' and work.payment_applicability = 'required' then raise exception using errcode = '22023', message = 'Payment is required for this return and cannot be skipped.'; end if;
    if step_code_value = 'payment-confirmation' and status_value = 'complete' and work.payment_amount is null then raise exception using errcode = '22023', message = 'Record the payment amount before confirming payment.'; end if;
    if step_code_value = 'client-approval' and status_value = 'complete' and nullif(trim(p_payload ->> 'externalDate'), '') is null then raise exception using errcode = '22023', message = 'Record the client approval date before completing client approval.'; end if;
    if step_code_value = 'esubmission' and status_value = 'complete' and (acknowledged_on_value is null or validated_on_value is null) then raise exception using errcode = '22023', message = 'Record the BIR acknowledgment and validation dates before completing eSubmission.'; end if;
    if is_elevated and override_reason is null then raise exception using errcode = '22023', message = 'An elevated override reason is required.'; end if;
    insert into public.generated_work_process_steps (generated_work_id, step_code, bundle, label, owner_role, step_order, status, started_at, completed_at, updated_at)
    values (p_work_id, step_code_value, case when step_code_value in ('payment', 'payment-client-approval', 'payment-confirmation') then 'payment' when step_code_value = 'esubmission' then 'attachments' when step_code_value = 'evidence' then 'archiving' else 'filing' end,
      case step_code_value when 'client-approval' then 'Client approval' when 'filing' then 'File return and retain FRN' when 'payment' then 'Endorse payment' when 'payment-client-approval' then 'Release or approve payment' when 'payment-confirmation' then 'Process payment and retain proof' when 'esubmission' then 'Attachments' else 'Archive the return package' end,
      case when step_code_value in ('client-approval', 'filing', 'payment', 'payment-client-approval', 'payment-confirmation', 'esubmission', 'evidence') then 'preparer' else 'preparer' end,
      case step_code_value when 'client-approval' then 4 when 'filing' then 5 when 'payment' then 6 when 'payment-client-approval' then 7 when 'payment-confirmation' then 8 when 'esubmission' then 9 else 10 end,
      status_value, case when status_value = 'in_progress' then now() end, case when status_value in ('complete', 'not_applicable') then now() end, now())
    on conflict (generated_work_id, step_code) do update set status = excluded.status, started_at = coalesce(public.generated_work_process_steps.started_at, excluded.started_at), completed_at = excluded.completed_at, updated_at = now();
    if status_value in ('complete', 'not_applicable') then
      insert into public.generated_work_evidence (generated_work_id, step_code, evidence_kind, reference, external_date, acknowledged_on, validated_on, attachment_name, external_reference, external_channel, sharepoint_url, result_status, note, actor_id)
      values (p_work_id, step_code_value, case when step_code_value = 'filing' then 'filing' when step_code_value in ('payment', 'payment-client-approval', 'payment-confirmation') then 'payment' when step_code_value = 'esubmission' then 'attachment' when step_code_value = 'evidence' then 'archive' when step_code_value = 'client-approval' then 'client_approval' else 'result' end,
        evidence_reference, nullif(p_payload ->> 'externalDate', '')::date, acknowledged_on_value, validated_on_value, attachment_name_value, nullif(trim(p_payload ->> 'externalReference'), ''), nullif(trim(p_payload ->> 'externalChannel'), ''), nullif(trim(p_payload ->> 'sharepointUrl'), ''), case when status_value = 'not_applicable' then 'verified' else nullif(trim(p_payload ->> 'resultStatus'), '') end, note_value, actor_id);
    end if;
    update public.generated_compliance_work
    set lifecycle_stage = case
          when step_code_value = 'client-approval' then 'filing'
          when step_code_value = 'filing' and work.payment_applicability = 'required' then 'payment'
          when step_code_value in ('filing', 'payment-confirmation', 'esubmission') then 'other_submissions'
          when step_code_value in ('payment', 'payment-client-approval') then 'payment'
          when step_code_value = 'evidence' and status_value in ('complete', 'not_applicable') then 'complete'
          else lifecycle_stage
        end,
        engagement_status = case when step_code_value = 'evidence' and status_value in ('complete', 'not_applicable') then 'complete' else engagement_status end,
        current_owner_user_id = actor_id,
        updated_at = now(),
        updated_by = actor_id
    where id = p_work_id;
    after_state := jsonb_build_object('stepCode', step_code_value, 'status', status_value, 'evidenceReference', evidence_reference);
  elsif p_command = 'final_certification' then
    -- Only the assigned Reviewer (or a reasoned override) closes the work,
    -- and never whoever actually prepared or checked it.
    if note_value is null or (not has_elevated_authority and (work.reviewer_user_id is null or actor_id is distinct from work.reviewer_user_id)) then
      raise exception using errcode = '42501', message = 'Only the assigned Reviewer or an authorized elevated actor can certify closure.';
    end if;
    if exists (select 1 from public.generated_work_gate_attempts attempt
                where attempt.generated_work_id = p_work_id and attempt.role in ('preparer', 'checker') and attempt.decision <> 'return' and attempt.actor_id = auth.uid()) then
      raise exception using errcode = '42501', message = 'The same person cannot prepare, check and review one return.';
    end if;
    if work.period_locked then raise exception using errcode = '42501', message = 'This period is locked by Tax Team.'; end if;
    if not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'evidence' and status = 'complete') then raise exception using errcode = '22023', message = 'Archiving must be complete before final certification.'; end if;
    if is_elevated and override_reason is null then raise exception using errcode = '22023', message = 'An elevated override reason is required.'; end if;
    update public.generated_compliance_work set current_gate = null, lifecycle_stage = 'complete', engagement_status = 'complete', final_certified_by = actor_id, final_certified_at = now(), final_certification_note = note_value, updated_at = now(), updated_by = actor_id where id = p_work_id;
    after_state := jsonb_build_object('finalCertifiedBy', actor_id, 'note', note_value);
  elsif p_command = 'qa_finding' then
    if not public.has_active_capability('PerformWorkQA') and not public.has_active_capability('ValidateTaxProfile') and not public.has_active_capability('ViewTaxControlHistory') then raise exception using errcode = '42501', message = 'Independent Work QA is not authorized for the caller.'; end if;
    if nullif(trim(p_payload ->> 'finding'), '') is null or p_payload ->> 'status' not in ('sampled', 'cleared', 'follow_up', 'remediated', 'validated') or p_payload ->> 'severity' not in ('low', 'medium', 'high', 'material') then raise exception using errcode = '22023', message = 'QA status, severity, and finding are required.'; end if;
    insert into public.generated_work_qa_findings (generated_work_id, status, severity, finding, remediation_note, accountable_user_id, due_at, created_by, validated_by, validated_at)
    values (p_work_id, p_payload ->> 'status', p_payload ->> 'severity', trim(p_payload ->> 'finding'), nullif(trim(p_payload ->> 'remediationNote'), ''), nullif(p_payload ->> 'accountableUserId', '')::uuid, nullif(p_payload ->> 'dueAt', '')::date, actor_id, case when p_payload ->> 'status' = 'validated' then actor_id end, case when p_payload ->> 'status' = 'validated' then now() end);
    after_state := p_payload;
  elsif p_command = 'period_lock' then
    if not public.has_active_capability('ManageWorkPeriodLock') and not public.has_active_capability('ValidateTaxProfile') and not has_elevated_authority then raise exception using errcode = '42501', message = 'Only Tax Team can control period locks.'; end if;
    if reason_value is null then raise exception using errcode = '22023', message = 'A period lock reason is required.'; end if;
    if coalesce((p_payload ->> 'locked')::boolean, false) and (not exists (select 1 from public.generated_work_process_steps where generated_work_id = p_work_id and step_code = 'evidence' and status = 'complete') or work.final_certified_at is null) then raise exception using errcode = '22023', message = 'Archiving and Reviewer closure certification must be complete before locking the period.'; end if;
    update public.generated_compliance_work set period_locked = coalesce((p_payload ->> 'locked')::boolean, false), updated_at = now(), updated_by = actor_id where id = p_work_id;
    insert into public.generated_work_period_lock_events (generated_work_id, locked, reason, actor_id) values (p_work_id, coalesce((p_payload ->> 'locked')::boolean, false), reason_value, actor_id);
    after_state := jsonb_build_object('locked', coalesce((p_payload ->> 'locked')::boolean, false), 'reason', reason_value);
  else
    raise exception using errcode = '22023', message = 'Unknown Work command.';
  end if;

  select * into work from public.generated_compliance_work where id = p_work_id;
  select public.append_audit_event(
    'work_' || p_command,
    'generated_compliance_work',
    p_work_id::text,
    'Work command recorded: ' || p_command,
    before_state,
    coalesce(after_state, to_jsonb(work)),
    coalesce(reason_value, override_reason, note_value),
    now(),
    gen_random_uuid()
  ) into event_id;

  insert into public.generated_compliance_work_events (generated_work_id, event_kind, actor_id, actor_display, idempotency_key, from_context, to_context, reason, effective_at, correlation_id)
  values (p_work_id, 'work_' || p_command, actor_id, coalesce(actor_display, 'Authenticated user'), trim(p_idempotency_key), before_state, coalesce(after_state, to_jsonb(work)), coalesce(reason_value, override_reason, note_value), now(), event_id);

  return jsonb_build_object('accepted', true, 'idempotent', false, 'eventId', event_id, 'workId', p_work_id, 'state', coalesce(after_state, to_jsonb(work)));
end;
$function$;
revoke execute on function public.record_generated_work_command(uuid, text, jsonb, text) from public, anon;
grant execute on function public.record_generated_work_command(uuid, text, jsonb, text) to authenticated;
