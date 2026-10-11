-- Accounting-style period close.
-- A close is one-way and applies to every generated work item in the period.

insert into public.capabilities (key, description)
values ('ManageWorkPeriodLock', 'Close an accounting period once through Tax Team control; closed work is read-only.')
on conflict (key) do update set description = excluded.description;

create table if not exists public.generated_compliance_period_locks (
  period_key text primary key,
  period_label text not null,
  reason text not null,
  actor_id uuid not null references auth.users(id),
  locked_at timestamptz not null default now()
);

alter table public.generated_compliance_period_locks enable row level security;

drop policy if exists generated_compliance_period_locks_scoped_read on public.generated_compliance_period_locks;
create policy generated_compliance_period_locks_scoped_read on public.generated_compliance_period_locks
  for select to authenticated
  using (public.is_active_app_user() and (
    public.has_active_capability('ViewTaxControlHistory')
    or public.has_active_capability('ManageWorkPeriodLock')
    or public.has_active_capability('MaintainGeneratedComplianceWork')
  ));

create or replace function public.generated_work_accounting_period_key(target_work public.generated_compliance_work)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(trim(target_work.period_key), ''), lower(regexp_replace(trim(target_work.period_label), '\s+', '-', 'g')));
$$;

-- Carry forward any already-locked work into the new period-level source.
insert into public.generated_compliance_period_locks (period_key, period_label, reason, actor_id, locked_at)
select distinct on (public.generated_work_accounting_period_key(work))
  public.generated_work_accounting_period_key(work),
  work.period_label,
  coalesce(lock_event.reason, 'Migrated from the former work-level period lock.'),
  lock_event.actor_id,
  coalesce(lock_event.recorded_at, work.updated_at)
from public.generated_compliance_work work
left join lateral (
  select event.reason, event.actor_id, event.recorded_at
  from public.generated_work_period_lock_events event
  where event.generated_work_id = work.id and event.locked
  order by event.recorded_at desc
  limit 1
) lock_event on true
where work.period_locked
order by public.generated_work_accounting_period_key(work), coalesce(lock_event.recorded_at, work.updated_at) desc
on conflict (period_key) do nothing;

create or replace function public.block_closed_generated_work_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- The close trigger updates all sibling work rows in one transaction.
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  if (tg_op = 'DELETE' and exists (
    select 1 from public.generated_compliance_period_locks period_lock
    where period_lock.period_key = public.generated_work_accounting_period_key(old)
  )) or (tg_op <> 'DELETE' and exists (
    select 1 from public.generated_compliance_period_locks period_lock
    where period_lock.period_key = public.generated_work_accounting_period_key(new)
  )) then
    raise exception using errcode = '42501', message = 'This accounting period is closed by Tax Team.';
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
  if target_work.id is not null and (target_work.period_locked or exists (
    select 1 from public.generated_compliance_period_locks period_lock
    where period_lock.period_key = public.generated_work_accounting_period_key(target_work)
  )) then
    raise exception using errcode = '42501', message = 'This accounting period is closed by Tax Team.';
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
  if not new.locked then
    raise exception using errcode = '42501', message = 'A closed accounting period cannot be reopened.';
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
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if not new.locked then return new; end if;
  select * into target_work from public.generated_compliance_work where id = new.generated_work_id;
  if target_work.id is null then return new; end if;
  target_key := public.generated_work_accounting_period_key(target_work);

  if exists (
    select 1
    from public.generated_compliance_work candidate
    where public.generated_work_accounting_period_key(candidate) = target_key
      and candidate.engagement_status not in ('cancelled', 'superseded')
      and (candidate.final_certified_at is null or not exists (
        select 1 from public.generated_work_process_steps step
        where step.generated_work_id = candidate.id
          and step.step_code = 'evidence'
          and step.status = 'complete'
      ))
  ) then
    raise exception using errcode = '22023', message = 'Every active work item in the accounting period must be archived and closure-certified before close.';
  end if;

  if exists (select 1 from public.generated_compliance_period_locks where period_key = target_key) then
    raise exception using errcode = '42501', message = 'This accounting period is already closed and cannot be reopened.';
  end if;

  insert into public.generated_compliance_period_locks (period_key, period_label, reason, actor_id, locked_at)
  values (target_key, target_work.period_label, new.reason, new.actor_id, new.recorded_at);

  update public.generated_compliance_work candidate
  set period_locked = true, updated_at = now(), updated_by = new.actor_id
  where public.generated_work_accounting_period_key(candidate) = target_key;

  insert into public.generated_work_period_lock_events (generated_work_id, locked, reason, actor_id, recorded_at)
  select candidate.id, true, new.reason, new.actor_id, new.recorded_at
  from public.generated_compliance_work candidate
  where public.generated_work_accounting_period_key(candidate) = target_key
    and candidate.id <> new.generated_work_id;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_period_close_guard') then
    create trigger generated_work_period_close_guard
      before insert or update or delete on public.generated_compliance_work
      for each row execute function public.block_closed_generated_work_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_period_reopen_guard') then
    create trigger generated_work_period_reopen_guard
      before update on public.generated_compliance_work
      for each row when (old.period_locked and not new.period_locked)
      execute function public.prevent_period_reopen();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_process_period_guard') then
    create trigger generated_work_process_period_guard
      before insert or update or delete on public.generated_work_process_steps
      for each row execute function public.block_closed_generated_work_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_gate_period_guard') then
    create trigger generated_work_gate_period_guard
      before insert or update or delete on public.generated_work_gate_attempts
      for each row execute function public.block_closed_generated_work_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_checklist_period_guard') then
    create trigger generated_work_checklist_period_guard
      before insert or update or delete on public.generated_work_checklist_updates
      for each row execute function public.block_closed_generated_work_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_evidence_period_guard') then
    create trigger generated_work_evidence_period_guard
      before insert or update or delete on public.generated_work_evidence
      for each row execute function public.block_closed_generated_work_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_qa_period_guard') then
    create trigger generated_work_qa_period_guard
      before insert or update or delete on public.generated_work_qa_findings
      for each row execute function public.block_closed_generated_work_row_change();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_lock_one_way_guard') then
    create trigger generated_work_lock_one_way_guard
      before insert on public.generated_work_period_lock_events
      for each row execute function public.prevent_period_reopen();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'generated_work_close_period_after_event') then
    create trigger generated_work_close_period_after_event
      after insert on public.generated_work_period_lock_events
      for each row execute function public.close_generated_work_period();
  end if;
end;
$$;
