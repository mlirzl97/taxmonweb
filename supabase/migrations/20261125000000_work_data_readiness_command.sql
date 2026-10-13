-- Data Readiness is a prerequisite control, not an additional engagement stage.
-- It is recorded through an audited, idempotent command before Preparation can proceed.

create or replace function public.record_generated_work_readiness(
  p_work_id uuid,
  p_ready boolean,
  p_source text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_display text;
  work public.generated_compliance_work;
  before_state jsonb;
  after_state jsonb;
  event_id uuid;
  source_value text := upper(trim(coalesce(p_source, '')));
  reason_value text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if actor_id is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required to record data readiness.';
  end if;
  if not public.has_active_capability('ExecuteGeneratedComplianceWork')
     and not public.has_active_capability('MaintainGeneratedComplianceWork') then
    raise exception using errcode = '42501', message = 'Data readiness authority is not configured for the caller.';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception using errcode = '22023', message = 'A data readiness idempotency key is required.';
  end if;
  if source_value not in ('CLIENT_RECORDS', 'TMF_BOOKS') then
    raise exception using errcode = '22023', message = 'Choose the source basis for data readiness.';
  end if;
  if reason_value is null then
    raise exception using errcode = '22023', message = 'A data readiness note is required.';
  end if;
  if exists (
    select 1
      from public.generated_compliance_work_events
     where idempotency_key = trim(p_idempotency_key)
  ) then
    select to_jsonb(event) into after_state
      from public.generated_compliance_work_events event
     where event.idempotency_key = trim(p_idempotency_key);
    return jsonb_build_object('accepted', true, 'idempotent', true, 'state', after_state);
  end if;
  if not public.can_view_generated_work(p_work_id) then
    raise exception using errcode = '42501', message = 'Generated work is outside the caller''s scope.';
  end if;

  select * into work
    from public.generated_compliance_work
   where id = p_work_id
   for update;
  if work.id is null then
    raise exception using errcode = '22023', message = 'Generated work was not found.';
  end if;
  if work.period_locked then
    raise exception using errcode = '42501', message = 'This period is locked by Tax Team.';
  end if;

  select display_name into actor_display
    from public.app_users
   where id = actor_id;
  before_state := to_jsonb(work);

  update public.generated_compliance_work
     set data_readiness = case when p_ready then 'ready' else 'not_ready' end,
         source_context = coalesce(source_context, '{}'::jsonb) || jsonb_build_object(
           'dataReadiness', jsonb_build_object(
             'state', case when p_ready then 'ready' else 'not_ready' end,
             'source', source_value,
             'reason', reason_value,
             'recordedAt', now(),
             'recordedBy', actor_id
           )
         ),
         updated_at = now(),
         updated_by = actor_id
   where id = p_work_id;

  select to_jsonb(current_work) into after_state
    from public.generated_compliance_work current_work
   where current_work.id = p_work_id;
  select public.append_audit_event(
    'work_data_readiness',
    'generated_compliance_work',
    p_work_id::text,
    'Data readiness recorded',
    before_state,
    after_state,
    reason_value,
    now(),
    gen_random_uuid()
  ) into event_id;
  insert into public.generated_compliance_work_events (
    generated_work_id, event_kind, actor_id, actor_display, idempotency_key,
    from_context, to_context, reason, effective_at, correlation_id
  ) values (
    p_work_id,
    'work_data_readiness',
    actor_id,
    coalesce(actor_display, 'Authenticated user'),
    trim(p_idempotency_key),
    before_state,
    after_state,
    reason_value,
    now(),
    event_id
  );

  return jsonb_build_object('accepted', true, 'idempotent', false, 'eventId', event_id, 'workId', p_work_id, 'state', after_state);
end;
$$;

revoke execute on function public.record_generated_work_readiness(uuid, boolean, text, text, text) from public;
grant execute on function public.record_generated_work_readiness(uuid, boolean, text, text, text) to authenticated;
