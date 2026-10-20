-- Reconcile an edited deadline against its recorded authoritative source.
-- Publication remains a separate explicit transition after reconciliation.

create or replace function public.reconcile_deadline_control_entry(
  p_entry_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  entry public.monthly_calendar_entries;
  before_state jsonb;
begin
  if not public.has_deadline_control_access() then
    raise exception using errcode = '42501', message = 'Deadline control is not authorized.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required for source reconciliation.';
  end if;

  select * into entry
  from public.monthly_calendar_entries
  where id = p_entry_id
  for update;

  if entry.id is null then
    raise exception using errcode = 'P0002', message = 'The deadline entry no longer exists.';
  end if;
  if entry.publication_status in ('published', 'superseded') then
    raise exception using errcode = '22023', message = 'Released or superseded entries cannot be reconciled.';
  end if;
  if coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline) is null then
    raise exception using errcode = '22023', message = 'A statutory due date is required before source reconciliation.';
  end if;
  if entry.source_issuance_id is null then
    raise exception using errcode = '22023', message = 'An authoritative source is required before source reconciliation.';
  end if;

  before_state := to_jsonb(entry);

  update public.monthly_calendar_entries
  set comparison_status = 'match',
      unresolved_reason = null,
      publication_status = case when publication_status in ('generated', 'needs_review', 'unresolved') then 'confirmed' else publication_status end,
      confirmed_by = auth.uid(),
      confirmed_at = now()
  where id = entry.id
  returning * into entry;

  insert into public.deadline_publication_events (monthly_calendar_entry_id, from_status, to_status, actor_id, reason, source_context)
  values (entry.id, before_state ->> 'publication_status', entry.publication_status, auth.uid(), trim(p_reason), jsonb_build_object('before', before_state, 'after', to_jsonb(entry), 'action', 'source_reconciled'));

  perform public.append_audit_event(
    'deadline_control.source_reconciled', 'monthly_calendar_entry', entry.id::text,
    'Reconciled an edited deadline against its recorded authoritative source.', before_state, to_jsonb(entry), trim(p_reason), now(), null
  );

  return jsonb_build_object('id', entry.id, 'publicationStatus', entry.publication_status);
end;
$$;

revoke execute on function public.reconcile_deadline_control_entry(uuid, text) from public;
grant execute on function public.reconcile_deadline_control_entry(uuid, text) to authenticated;
