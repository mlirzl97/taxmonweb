-- Centralized Tax Team control: one lock per compliance period and governed return.
-- A lock is reversible only through the authorized period_lock command.

insert into public.capabilities (key, description)
values ('ManageWorkPeriodLock', 'Lock or reopen a governed return for a compliance month through centralized Tax Team control.')
on conflict (key) do update set description = excluded.description;

alter table public.generated_compliance_period_locks
  add column if not exists lock_key text,
  add column if not exists requirement_id uuid references public.bir_requirements(id) on delete restrict,
  add column if not exists return_code text,
  add column if not exists due_date date,
  add column if not exists locked boolean not null default true,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references auth.users(id),
  add column if not exists unlock_reason text;

update public.generated_compliance_period_locks
set lock_key = period_key || '::legacy'
where lock_key is null;

alter table public.generated_compliance_period_locks
  alter column lock_key set not null;

alter table public.generated_compliance_period_locks
  drop constraint if exists generated_compliance_period_locks_pkey;

alter table public.generated_compliance_period_locks
  add constraint generated_compliance_period_locks_pkey primary key (lock_key);

create index if not exists generated_compliance_return_period_locks_idx
  on public.generated_compliance_period_locks(period_key, requirement_id, locked);

create or replace function public.generated_work_return_lock_key(target_work public.generated_compliance_work)
returns text
language sql
immutable
set search_path = public
as $$
  select public.generated_work_accounting_period_key(target_work) || '::' || target_work.requirement_id::text;
$$;

create or replace function public.generated_work_lock_due_date(target_work public.generated_compliance_work)
returns date
language sql
immutable
set search_path = public
as $$
  select coalesce(target_work.adjusted_statutory_deadline, target_work.base_statutory_deadline);
$$;

-- Preserve any previously closed period as return-level locks, while keeping
-- the former period row as historical migration evidence only.
insert into public.generated_compliance_period_locks (lock_key, period_key, period_label, requirement_id, return_code, due_date, reason, actor_id, locked_at, locked)
select distinct on (public.generated_work_return_lock_key(work))
  public.generated_work_return_lock_key(work),
  public.generated_work_accounting_period_key(work),
  work.period_label,
  work.requirement_id,
  requirement.requirement_code,
  public.generated_work_lock_due_date(work),
  legacy.reason,
  legacy.actor_id,
  legacy.locked_at,
  true
from public.generated_compliance_work work
join public.generated_compliance_period_locks legacy
  on legacy.lock_key = public.generated_work_accounting_period_key(work) || '::legacy'
 and legacy.locked
join public.bir_requirements requirement on requirement.id = work.requirement_id
order by public.generated_work_return_lock_key(work), legacy.locked_at desc
on conflict (lock_key) do nothing;

create or replace function public.block_closed_generated_work_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.period_locked is distinct from old.period_locked then
    raise exception using errcode = '42501', message = 'Return lock changes must be made through centralized Tax Team control.';
  end if;
  if (tg_op = 'DELETE' and exists (
    select 1 from public.generated_compliance_period_locks period_lock
    where period_lock.locked and (
      period_lock.lock_key = public.generated_work_return_lock_key(old)
    )
  )) or (tg_op <> 'DELETE' and exists (
    select 1 from public.generated_compliance_period_locks period_lock
    where period_lock.locked and (
      period_lock.lock_key = public.generated_work_return_lock_key(new)
    )
  )) then
    raise exception using errcode = '42501', message = 'This return and compliance period are locked by Tax Team.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.block_closed_generated_work_row_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_work public.generated_compliance_work;
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  select * into target_work from public.generated_compliance_work where id = coalesce(new.generated_work_id, old.generated_work_id);
  if target_work.id is not null and exists (
    select 1 from public.generated_compliance_period_locks period_lock
    where period_lock.locked and period_lock.lock_key = public.generated_work_return_lock_key(target_work)
  ) then
    raise exception using errcode = '42501', message = 'This return and compliance period are locked by Tax Team.';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_period_reopen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not new.locked and not (
    public.has_active_capability('ManageWorkPeriodLock')
    or public.has_active_capability('PerformElevatedOverride')
  ) then
    raise exception using errcode = '42501', message = 'Only authorized Tax Team or HOD users can reopen a return lock.';
  end if;
  return new;
end;
$$;

create or replace function public.close_generated_work_period()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_work public.generated_compliance_work;
  target_key text;
  target_period_key text;
  target_due_date date;
  target_return_code text;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  select * into target_work from public.generated_compliance_work where id = new.generated_work_id;
  if target_work.id is null then return new; end if;
  target_key := public.generated_work_return_lock_key(target_work);
  target_period_key := public.generated_work_accounting_period_key(target_work);
  target_due_date := public.generated_work_lock_due_date(target_work);
  select requirement_code into target_return_code from public.bir_requirements where id = target_work.requirement_id;

  if new.locked and (target_due_date is null or target_due_date > current_date) then
    raise exception using errcode = '22023', message = 'A return cannot be locked before its governed due date.';
  end if;

  if new.locked and exists (select 1 from public.generated_compliance_period_locks where lock_key = target_key and locked) then
    raise exception using errcode = '42501', message = 'This return is already locked for the compliance period.';
  end if;
  if not new.locked and not exists (select 1 from public.generated_compliance_period_locks where lock_key = target_key and locked) then
    raise exception using errcode = '42501', message = 'This return is not currently locked for the compliance period.';
  end if;

  insert into public.generated_compliance_period_locks (lock_key, period_key, period_label, requirement_id, return_code, due_date, reason, actor_id, locked_at, locked)
  values (target_key, target_period_key, target_work.period_label, target_work.requirement_id, target_return_code, target_due_date, new.reason, new.actor_id, case when new.locked then new.recorded_at else null end, new.locked)
  on conflict (lock_key) do update set
    reason = excluded.reason,
    actor_id = excluded.actor_id,
    locked = excluded.locked,
    due_date = excluded.due_date,
    locked_at = case when excluded.locked then excluded.locked_at else public.generated_compliance_period_locks.locked_at end,
    unlocked_at = case when excluded.locked then null else excluded.locked_at end,
    unlocked_by = case when excluded.locked then null else excluded.actor_id end,
    unlock_reason = case when excluded.locked then null else excluded.reason end;

  update public.generated_compliance_work candidate
  set period_locked = new.locked, updated_at = now(), updated_by = new.actor_id
  where public.generated_work_return_lock_key(candidate) = target_key;

  insert into public.generated_work_period_lock_events (generated_work_id, locked, reason, actor_id, recorded_at)
  select candidate.id, new.locked, new.reason, new.actor_id, new.recorded_at
  from public.generated_compliance_work candidate
  where public.generated_work_return_lock_key(candidate) = target_key
    and candidate.id <> new.generated_work_id;

  return new;
end;
$$;

create or replace function public.record_generated_return_lock(
  p_work_id uuid,
  p_locked boolean,
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
  reason_value text := nullif(trim(p_reason), '');
begin
  if actor_id is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required for return locks.';
  end if;
  if not public.has_active_capability('ManageWorkPeriodLock')
     and not public.has_active_capability('PerformElevatedOverride') then
    raise exception using errcode = '42501', message = 'Only authorized Tax Team or HOD users can control return locks.';
  end if;
  if p_idempotency_key is null or nullif(trim(p_idempotency_key), '') is null then
    raise exception using errcode = '22023', message = 'A return lock idempotency key is required.';
  end if;
  if reason_value is null then
    raise exception using errcode = '22023', message = 'A return lock reason is required.';
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
  if p_locked and (public.generated_work_lock_due_date(work) is null or public.generated_work_lock_due_date(work) > current_date) then
    raise exception using errcode = '22023', message = 'A return cannot be locked before its governed due date.';
  end if;
  if p_locked and exists (
    select 1 from public.generated_compliance_period_locks
    where lock_key = public.generated_work_return_lock_key(work) and locked
  ) then
    raise exception using errcode = '42501', message = 'This return is already locked for the compliance period.';
  end if;
  if not p_locked and not exists (
    select 1 from public.generated_compliance_period_locks
    where lock_key = public.generated_work_return_lock_key(work) and locked
  ) then
    raise exception using errcode = '42501', message = 'This return is not currently locked for the compliance period.';
  end if;

  select display_name into actor_display from public.app_users where id = actor_id;
  before_state := to_jsonb(work);
  insert into public.generated_work_period_lock_events (generated_work_id, locked, reason, actor_id)
  values (p_work_id, p_locked, reason_value, actor_id);
  select * into work from public.generated_compliance_work where id = p_work_id;
  after_state := jsonb_build_object(
    'locked', p_locked,
    'periodKey', public.generated_work_accounting_period_key(work),
    'returnCode', (select requirement_code from public.bir_requirements where id = work.requirement_id),
    'reason', reason_value
  );
  select public.append_audit_event(
    case when p_locked then 'work_return_lock' else 'work_return_unlock' end,
    'generated_compliance_work',
    p_work_id::text,
    case when p_locked then 'Return locked centrally by Tax Team.' else 'Return lock reopened centrally by Tax Team.' end,
    before_state,
    after_state,
    reason_value,
    now(),
    gen_random_uuid()
  ) into event_id;
  insert into public.generated_compliance_work_events (generated_work_id, event_kind, actor_id, actor_display, idempotency_key, from_context, to_context, reason, effective_at, correlation_id)
  values (p_work_id, case when p_locked then 'work_return_lock' else 'work_return_unlock' end, actor_id, coalesce(actor_display, 'Authenticated user'), trim(p_idempotency_key), before_state, after_state, reason_value, now(), event_id);
  return jsonb_build_object('accepted', true, 'idempotent', false, 'eventId', event_id, 'workId', p_work_id, 'state', after_state);
end;
$$;

revoke execute on function public.record_generated_return_lock(uuid, boolean, text, text) from public;
grant execute on function public.record_generated_return_lock(uuid, boolean, text, text) to authenticated;
