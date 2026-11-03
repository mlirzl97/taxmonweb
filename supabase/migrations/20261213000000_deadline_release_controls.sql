-- Deadline release controls (HOD decision H-010).
--
-- A deadline is confirmed by one person and published by a different person.
-- A published deadline changes only through Override: a superseding row with
-- a required reason, keeping the original in history. Until now one person
-- could publish directly, skipping confirmation; publishing again silently
-- re-dated a published row; and superseding only flipped a status without a
-- successor.
--
-- An Override proposes a new TMF operational date only. It never changes a
-- BIR statutory date, which changes only with its BIR issuance as source.
-- The proposed successor is itself confirmed by its proposer and published by
-- a different person; publishing it supersedes the original in the same
-- transaction.

alter table public.monthly_calendar_entries
  add column if not exists supersedes_entry_id uuid references public.monthly_calendar_entries(id);
create index if not exists monthly_calendar_entries_supersedes_idx
  on public.monthly_calendar_entries (supersedes_entry_id) where supersedes_entry_id is not null;
-- At most one successor stands for a row at a time, whatever its review state.
create unique index if not exists monthly_calendar_entries_one_open_successor_idx
  on public.monthly_calendar_entries (supersedes_entry_id)
  where supersedes_entry_id is not null and publication_status <> 'superseded';

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
  original public.monthly_calendar_entries;
  before_state jsonb;
  control_deadline date;
  proposed_date date;
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

  -- A published deadline changes only through Override.
  if entry.publication_status = 'published' then
    raise exception using errcode = '22023', message = 'A published deadline changes only through Override.';
  end if;
  if entry.publication_status = 'superseded' then
    raise exception using errcode = '22023', message = 'A superseded deadline cannot change.';
  end if;

  if p_to_status = 'confirmed' then
    -- One confirmation stands at a time: confirming again would hide the
    -- first confirmer from the publish check. Send it back to review first.
    if entry.publication_status = 'confirmed' then
      raise exception using errcode = '22023', message = 'This deadline is already confirmed; send it back to review before confirming again.';
    end if;
    -- A new confirmation is of the date as saved now: the statutory date, or
    -- for an Override its own proposed TMF date. An earlier confirmation's
    -- date never carries over.
    proposed_date := coalesce(p_published_operational_deadline,
                              case when entry.supersedes_entry_id is not null then entry.published_operational_deadline end,
                              control_deadline);
    if proposed_date is null then
      raise exception using errcode = '22023', message = 'A confirmed deadline requires an earliest statutory date or explicit operational date.';
    end if;
    if control_deadline is not null and proposed_date > control_deadline then
      raise exception using errcode = '22023', message = 'The operational due date cannot be later than the earliest applicable statutory deadline.';
    end if;
    update public.monthly_calendar_entries
       set publication_status = 'confirmed',
           published_operational_deadline = proposed_date,
           -- An Override's internal target follows its own TMF date (H-008),
           -- whatever an edit saved from the statutory date.
           tmf_package_target = case when entry.supersedes_entry_id is not null then proposed_date - 1 else entry.tmf_package_target end,
           confirmed_by = auth.uid(),
           confirmed_at = now()
     where id = entry.id
    returning * into entry;
  elsif p_to_status = 'published' then
    -- Confirmed by one person, published by a different person.
    if entry.publication_status <> 'confirmed' or entry.confirmed_by is null then
      raise exception using errcode = '22023', message = 'A deadline is confirmed before it is published.';
    end if;
    if entry.confirmed_by = auth.uid() then
      raise exception using errcode = '42501', message = 'The person who confirmed a deadline cannot publish it.';
    end if;
    if p_published_operational_deadline is not null and p_published_operational_deadline is distinct from entry.published_operational_deadline then
      raise exception using errcode = '22023', message = 'The publisher cannot change the confirmed date; confirm the new date first.';
    end if;
    if entry.published_operational_deadline is null then
      raise exception using errcode = '22023', message = 'A published deadline requires an earliest statutory date or explicit operational date.';
    end if;
    if control_deadline is not null and entry.published_operational_deadline > control_deadline then
      raise exception using errcode = '22023', message = 'The operational due date cannot be later than the earliest applicable statutory deadline.';
    end if;
    -- An Override replaces a deadline that is still published, never a stale one.
    if entry.supersedes_entry_id is not null and not exists (
      select 1 from public.monthly_calendar_entries replaced
       where replaced.id = entry.supersedes_entry_id and replaced.publication_status = 'published') then
      raise exception using errcode = '22023', message = 'The deadline this Override replaces is no longer published.';
    end if;
    -- An Override changes the TMF date only: its statutory dates must still be
    -- the original's, even if the waiting row was edited after it was proposed.
    if entry.supersedes_entry_id is not null and exists (
      select 1 from public.monthly_calendar_entries replaced
       where replaced.id = entry.supersedes_entry_id
         and (replaced.base_statutory_deadline is distinct from entry.base_statutory_deadline
              or replaced.adjusted_statutory_deadline is distinct from entry.adjusted_statutory_deadline)) then
      raise exception using errcode = '22023', message = 'An Override cannot change the BIR statutory date.';
    end if;
    -- It replaces the same return for the same period, which work generation
    -- matches on, so the original period never loses its published deadline.
    if entry.supersedes_entry_id is not null and exists (
      select 1 from public.monthly_calendar_entries replaced
       where replaced.id = entry.supersedes_entry_id
         and (replaced.calendar_version_id is distinct from entry.calendar_version_id
              or replaced.requirement_id is distinct from entry.requirement_id
              or replaced.requirement_version_id is distinct from entry.requirement_version_id
              or replaced.period_or_event is distinct from entry.period_or_event
              or replaced.period_start is distinct from entry.period_start
              or replaced.period_end is distinct from entry.period_end)) then
      raise exception using errcode = '22023', message = 'An Override cannot change the return or period it replaces.';
    end if;
    if entry.supersedes_entry_id is not null and entry.tmf_package_target is distinct from entry.published_operational_deadline - 1 then
      raise exception using errcode = '22023', message = 'An Override''s internal target must be one day before its TMF date; confirm it again.';
    end if;
    update public.monthly_calendar_entries
       set publication_status = 'published',
           comparison_status = 'match',
           unresolved_reason = null,
           published_by = auth.uid(),
           published_at = now()
     where id = entry.id
    returning * into entry;
    -- Publishing an Override supersedes the row it replaces, kept in history.
    if entry.supersedes_entry_id is not null then
      select * into original from public.monthly_calendar_entries where id = entry.supersedes_entry_id for update;
      if original.publication_status = 'published' then
        update public.monthly_calendar_entries set publication_status = 'superseded' where id = original.id;
        insert into public.deadline_publication_events (monthly_calendar_entry_id, from_status, to_status, actor_id, reason, source_context)
        values (original.id, 'published', 'superseded', auth.uid(), trim(p_reason),
                jsonb_build_object('supersededBy', entry.id, 'newOperationalDeadline', entry.published_operational_deadline));
      end if;
    end if;
  elsif p_to_status = 'superseded' then
    raise exception using errcode = '22023', message = 'A deadline is superseded only by publishing its Override.';
  else
    -- Back to review: any confirmation lapses.
    update public.monthly_calendar_entries
       set publication_status = p_to_status,
           confirmed_by = null,
           confirmed_at = null,
           published_operational_deadline = null
     where id = entry.id
    returning * into entry;
  end if;

  insert into public.deadline_publication_events (monthly_calendar_entry_id, from_status, to_status, actor_id, reason, source_context)
  values (entry.id, before_state ->> 'publication_status', entry.publication_status, auth.uid(), trim(p_reason), jsonb_build_object('before', before_state, 'after', to_jsonb(entry)));

  perform public.append_audit_event(
    'deadline_control.status_changed', 'monthly_calendar_entry', entry.id::text,
    'Changed deadline publication status.', before_state, to_jsonb(entry), trim(p_reason), now(), null
  );

  return jsonb_build_object('id', entry.id, 'publicationStatus', entry.publication_status);
end;
$$;
revoke execute on function public.transition_deadline_control_entry(uuid, text, date, text) from public, anon;
grant execute on function public.transition_deadline_control_entry(uuid, text, date, text) to authenticated;

-- Propose a new TMF operational date for a published deadline. The successor
-- is confirmed by its proposer and waits for a different person to publish it.
create or replace function public.override_published_deadline(
  p_entry_id uuid,
  p_operational_deadline date,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  entry public.monthly_calendar_entries;
  successor public.monthly_calendar_entries;
  control_deadline date;
begin
  if not public.has_deadline_control_access() then
    raise exception using errcode = '42501', message = 'Deadline control is not authorized.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required for an Override.';
  end if;
  if p_operational_deadline is null then
    raise exception using errcode = '22023', message = 'An Override needs the new operational date.';
  end if;

  select * into entry from public.monthly_calendar_entries where id = p_entry_id for update;
  if entry.id is null then raise exception using errcode = 'P0002', message = 'The deadline entry no longer exists.'; end if;
  if entry.publication_status <> 'published' then
    raise exception using errcode = '22023', message = 'Only a published deadline is overridden; edit and confirm an unpublished one.';
  end if;
  if p_operational_deadline = entry.published_operational_deadline then
    raise exception using errcode = '22023', message = 'The Override date is the same as the published date.';
  end if;
  control_deadline := coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline);
  if control_deadline is not null and p_operational_deadline > control_deadline then
    raise exception using errcode = '22023', message = 'The operational due date cannot be later than the earliest applicable statutory deadline.';
  end if;
  if exists (select 1 from public.monthly_calendar_entries pending
              where pending.supersedes_entry_id = entry.id and pending.publication_status <> 'superseded') then
    raise exception using errcode = '22023', message = 'An Override for this deadline is already waiting to be published.';
  end if;

  insert into public.monthly_calendar_entries (
    calendar_version_id, requirement_id, requirement_version_id, external_requirement_label, period_or_event,
    period_start, period_end, base_statutory_deadline, adjusted_statutory_deadline, tmf_package_target,
    comparison_status, unresolved_reason, source_issuance_id, source_locator, affected_population, notes,
    activity_month, taxable_period, filing_period, rule_version_id, adjustment_reason, deadline_explanation,
    published_operational_deadline, publication_status, confirmed_by, confirmed_at, supersedes_entry_id)
  values (
    entry.calendar_version_id, entry.requirement_id, entry.requirement_version_id, entry.external_requirement_label, entry.period_or_event,
    entry.period_start, entry.period_end, entry.base_statutory_deadline, entry.adjusted_statutory_deadline,
    -- The internal target is one day before the new operational date (H-008).
    p_operational_deadline - 1,
    entry.comparison_status, entry.unresolved_reason, entry.source_issuance_id, entry.source_locator, entry.affected_population, entry.notes,
    entry.activity_month, entry.taxable_period, entry.filing_period, entry.rule_version_id, trim(p_reason), entry.deadline_explanation,
    p_operational_deadline, 'confirmed', auth.uid(), now(), entry.id)
  returning * into successor;

  insert into public.deadline_publication_events (monthly_calendar_entry_id, from_status, to_status, actor_id, reason, source_context)
  values (successor.id, null, 'confirmed', auth.uid(), trim(p_reason),
          jsonb_build_object('override', true, 'supersedes', entry.id, 'fromOperationalDeadline', entry.published_operational_deadline, 'toOperationalDeadline', p_operational_deadline));
  perform public.append_audit_event(
    'deadline_control.override_proposed', 'monthly_calendar_entry', entry.id::text,
    'Proposed an Override of a published deadline; a different person publishes it.',
    to_jsonb(entry), to_jsonb(successor), trim(p_reason), now(), null
  );

  return jsonb_build_object('id', successor.id, 'supersedes', entry.id, 'publicationStatus', successor.publication_status);
end;
$$;
revoke execute on function public.override_published_deadline(uuid, date, text) from public, anon;
grant execute on function public.override_published_deadline(uuid, date, text) to authenticated;

-- Who confirmed each row and whether an Override waits, for the Deadline
-- Control screen, plus the viewer, so the confirmer's own Publish is disabled.
create or replace function public.get_deadline_release_state(p_calendar_year integer)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.has_deadline_control_access() then
    raise exception using errcode = '42501', message = 'Deadline control is not authorized.';
  end if;
  return jsonb_build_object(
    'viewerId', auth.uid(),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entry.id,
        'confirmedById', entry.confirmed_by,
        'confirmedBy', confirmer.display_name,
        'confirmedAt', entry.confirmed_at,
        'publishedBy', publisher.display_name,
        'supersedesEntryId', entry.supersedes_entry_id,
        'pendingOverrideId', pending.id))
      from public.monthly_calendar_entries entry
      join public.monthly_calendar_versions version on version.id = entry.calendar_version_id
      left join public.app_users confirmer on confirmer.id = entry.confirmed_by
      left join public.app_users publisher on publisher.id = entry.published_by
      left join public.monthly_calendar_entries pending on pending.supersedes_entry_id = entry.id and pending.publication_status <> 'superseded'
      where extract(year from version.calendar_month)::integer = p_calendar_year
        and version.status <> 'superseded'), '[]'::jsonb));
end;
$$;
revoke execute on function public.get_deadline_release_state(integer) from public, anon;
grant execute on function public.get_deadline_release_state(integer) to authenticated;
