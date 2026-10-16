-- Deadline Control now treats the authorized Tax Team's saved statutory date as
-- the verification event. Keep the separate reconciliation function removed so
-- old clients cannot call an obsolete publication gate.

drop function if exists public.reconcile_deadline_control_entry(uuid, text);

create or replace function public.transition_deadline_control_entry(
  p_entry_id uuid,
  p_to_status text,
  p_published_operational_deadline date,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  entry public.monthly_calendar_entries;
  before_state jsonb;
  control_deadline date;
begin
  if not public.has_deadline_control_access() then
    raise exception using errcode = '42501', message = 'Deadline control is not authorized.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required for a publication decision.';
  end if;
  if p_to_status not in ('generated', 'needs_review', 'confirmed', 'published', 'unresolved', 'superseded') then
    raise exception using errcode = '22023', message = 'Unsupported deadline publication status.';
  end if;

  select * into entry from public.monthly_calendar_entries where id = p_entry_id for update;
  if entry.id is null then raise exception using errcode = 'P0002', message = 'The deadline entry no longer exists.'; end if;
  before_state := to_jsonb(entry);
  control_deadline := coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline);

  if entry.publication_status = 'published' and p_to_status not in ('published', 'superseded') then
    raise exception using errcode = '22023', message = 'A released deadline can only remain published or be superseded.';
  end if;
  if p_to_status = 'published' and coalesce(p_published_operational_deadline, control_deadline) is null then
    raise exception using errcode = '22023', message = 'A published deadline requires an earliest statutory date or explicit operational date.';
  end if;
  if p_to_status = 'published'
    and control_deadline is not null
    and coalesce(p_published_operational_deadline, control_deadline) > control_deadline then
    raise exception using errcode = '22023', message = 'The operational due date cannot be later than the earliest applicable statutory deadline.';
  end if;

  update public.monthly_calendar_entries
  set publication_status = p_to_status,
      comparison_status = case when p_to_status = 'published' then 'match' else comparison_status end,
      unresolved_reason = case when p_to_status = 'published' then null else unresolved_reason end,
      published_operational_deadline = case when p_to_status = 'published' then coalesce(p_published_operational_deadline, control_deadline) else published_operational_deadline end,
      confirmed_by = case when p_to_status = 'published' then auth.uid() when p_to_status = 'confirmed' then auth.uid() else confirmed_by end,
      confirmed_at = case when p_to_status in ('published', 'confirmed') then now() else confirmed_at end,
      published_by = case when p_to_status = 'published' then auth.uid() else published_by end,
      published_at = case when p_to_status = 'published' then now() else published_at end
  where id = entry.id
  returning * into entry;

  insert into public.deadline_publication_events (monthly_calendar_entry_id, from_status, to_status, actor_id, reason, source_context)
  values (entry.id, before_state ->> 'publication_status', p_to_status, auth.uid(), trim(p_reason), jsonb_build_object('before', before_state, 'after', to_jsonb(entry)));

  perform public.append_audit_event(
    'deadline_control.status_changed', 'monthly_calendar_entry', entry.id::text,
    'Changed deadline publication status.', before_state, to_jsonb(entry), trim(p_reason), now(), null
  );

  return jsonb_build_object('id', entry.id, 'publicationStatus', entry.publication_status);
end;
$$;

revoke execute on function public.transition_deadline_control_entry(uuid, text, date, text) from public;
grant execute on function public.transition_deadline_control_entry(uuid, text, date, text) to authenticated;
