-- Allow authorized operators to create a real generated-work record from the
-- approved masters. This is a controlled command, not a second work store.

create or replace function public.create_manual_generated_work(
  p_client_reference text,
  p_requirement_code text,
  p_period_label text,
  p_tmf_package_target date default null,
  p_payment_applicability text default 'unresolved',
  p_payment_amount numeric default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_client_id uuid;
  target_unit_id uuid;
  target_requirement public.bir_requirements;
  target_version public.bir_requirement_versions;
  existing_work_id uuid;
  created_work public.generated_compliance_work;
  preparer_id uuid;
  checker_id uuid;
  reviewer_id uuid;
  audit_id uuid;
  generation_key_value text;
  actor_display text;
begin
  if actor_id is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required to create Work.';
  end if;
  if not public.has_active_capability('MaintainGeneratedComplianceWork') then
    raise exception using errcode = '42501', message = 'Work creation authority is not configured for the caller.';
  end if;
  if nullif(trim(p_client_reference), '') is null
     or nullif(trim(p_requirement_code), '') is null
     or nullif(trim(p_period_label), '') is null
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'Taxpayer, requirement, period, and idempotency key are required.';
  end if;
  if lower(trim(coalesce(p_payment_applicability, ''))) not in ('required', 'not_applicable', 'unresolved') then
    raise exception using errcode = '22023', message = 'Payment applicability is invalid.';
  end if;
  if p_payment_amount is not null and p_payment_amount < 0 then
    raise exception using errcode = '22023', message = 'Payment amount cannot be negative.';
  end if;

  select client.id, unit.id
    into target_client_id, target_unit_id
    from public.clients client
    join public.taxpayer_entities entity on entity.client_id = client.id and entity.active
    join public.registration_units unit on unit.taxpayer_entity_id = entity.id and unit.active
   where client.reference_code = trim(p_client_reference)
     and public.can_view_registration_unit(unit.id)
   order by case when unit.unit_kind = 'head_office' then 0 else 1 end, unit.created_at
   limit 1;
  if target_unit_id is null then
    raise exception using errcode = '22023', message = 'No accessible active Registration Unit was found for the taxpayer.';
  end if;

  select * into target_requirement
    from public.bir_requirements requirement
   where requirement.requirement_code = upper(trim(p_requirement_code))
     and requirement.status = 'active'
     and (requirement.effective_from is null or requirement.effective_from <= current_date)
     and (requirement.effective_to is null or requirement.effective_to >= current_date);
  if target_requirement.id is null then
    raise exception using errcode = '22023', message = 'The requirement is not an active approved master record.';
  end if;

  select * into target_version
    from public.bir_requirement_versions version
   where version.requirement_id = target_requirement.id
     and version.status = 'approved'
     and version.effective_from <= current_date
     and (version.effective_to is null or version.effective_to >= current_date)
   order by version.effective_from desc
   limit 1;
  if target_version.id is null then
    raise exception using errcode = '22023', message = 'The requirement has no effective approved version.';
  end if;

  generation_key_value := 'manual:' || target_unit_id::text || ':' || target_requirement.id::text || ':' || lower(trim(p_period_label));
  select id into existing_work_id
    from public.generated_compliance_work
   where generation_key = generation_key_value;
  if existing_work_id is not null then
    return existing_work_id;
  end if;

  select assignment.user_id into preparer_id
    from public.client_team_assignments assignment
   where assignment.client_id = target_client_id
     and assignment.assignment_role = 'preparer'
     and assignment.effective_from <= current_date
     and (assignment.effective_to is null or assignment.effective_to >= current_date)
   order by assignment.effective_from desc, assignment.assigned_at desc
   limit 1;
  select assignment.user_id into checker_id
    from public.client_team_assignments assignment
   where assignment.client_id = target_client_id
     and assignment.assignment_role = 'checker'
     and assignment.effective_from <= current_date
     and (assignment.effective_to is null or assignment.effective_to >= current_date)
   order by assignment.effective_from desc, assignment.assigned_at desc
   limit 1;
  select assignment.user_id into reviewer_id
    from public.client_team_assignments assignment
   where assignment.client_id = target_client_id
     and assignment.assignment_role = 'reviewer'
     and assignment.effective_from <= current_date
     and (assignment.effective_to is null or assignment.effective_to >= current_date)
   order by assignment.effective_from desc, assignment.assigned_at desc
   limit 1;

  insert into public.generated_compliance_work (
    registration_unit_id, requirement_id, requirement_version_id, generation_key,
    period_label, data_readiness, lifecycle_stage, engagement_status, rag_status,
    tmf_package_target, payment_applicability, payment_amount,
    preparer_user_id, checker_user_id, reviewer_user_id, current_owner_user_id,
    current_gate, source_context, created_by, updated_by
  ) values (
    target_unit_id, target_requirement.id, target_version.id, generation_key_value,
    trim(p_period_label), 'not_ready', 'preparation', 'open', 'unresolved',
    p_tmf_package_target, lower(trim(p_payment_applicability)),
    case when lower(trim(p_payment_applicability)) = 'not_applicable' then null else p_payment_amount end,
    preparer_id, checker_id, reviewer_id, preparer_id, 'preparer',
    jsonb_build_object('creationMode', 'authorized_manual', 'requirementCode', target_requirement.requirement_code, 'requirementVersion', target_version.version_label),
    actor_id, actor_id
  ) returning * into created_work;

  insert into public.generated_work_process_steps (
    generated_work_id, step_code, bundle, label, owner_role, step_order, status, started_at, updated_at
  ) values (
    created_work.id, 'preparer', 'filing', 'Preparation', 'preparer', 1, 'in_progress', now(), now()
  );

  select display_name into actor_display from public.app_users where id = actor_id;
  select public.append_audit_event(
    'work_created', 'generated_compliance_work', created_work.id::text,
    'Authorized Work record created', null, to_jsonb(created_work), null, now(), gen_random_uuid()
  ) into audit_id;
  insert into public.generated_compliance_work_events (
    generated_work_id, event_kind, actor_id, actor_display, idempotency_key,
    from_context, to_context, effective_at, correlation_id
  ) values (
    created_work.id, 'work_created', actor_id, coalesce(actor_display, 'Authenticated user'), trim(p_idempotency_key),
    null, to_jsonb(created_work), now(), audit_id
  );

  return created_work.id;
end;
$$;

revoke execute on function public.create_manual_generated_work(text, text, text, date, text, numeric, text) from public;
grant execute on function public.create_manual_generated_work(text, text, text, date, text, numeric, text) to authenticated;
