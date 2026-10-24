-- Return periods waiting on the Tax Team calendar.
--
-- A released calendar version can hold rows the Tax Team has not published
-- yet (generated, needs_review, confirmed or unresolved). Ordinary users read
-- only published rows (monthly_calendar_released_read), so a client's return
-- whose row is not published was simply missing: no work, and no sign that
-- anything was waiting. Unknown must stay visible.
--
-- This function reports only that such a period exists and why it is held.
-- It returns no unpublished date: those are not authoritative and stay behind
-- the read boundary.

create or replace function public.held_calendar_periods(
  p_registration_unit_id uuid,
  p_requirement_ids uuid[],
  p_year integer
)
returns table (
  entry_id uuid,
  requirement_id uuid,
  requirement_code text,
  requirement_name text,
  frequency_label text,
  operating_category text,
  period_or_event text,
  period_start date,
  calendar_month date,
  publication_status text,
  form_numbers text[]
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not public.can_view_registration_unit(p_registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Registration Unit is outside the caller''s scope.';
  end if;

  return query
  select entry.id,
         entry.requirement_id,
         requirement.requirement_code,
         requirement.requirement_name,
         requirement.frequency_label,
         requirement.operating_category,
         entry.period_or_event,
         entry.period_start,
         calendar_version.calendar_month,
         entry.publication_status,
         -- The forms of the version the row cites, else of the requirement's
         -- approved or superseded versions.
         coalesce(
           (select array_agg(distinct upper(form.form_number))
              from public.requirement_version_forms relation
              join public.bir_forms form on form.id = relation.form_id
             where relation.requirement_version_id = entry.requirement_version_id),
           (select array_agg(distinct upper(form.form_number))
              from public.bir_requirement_versions version
              join public.requirement_version_forms relation on relation.requirement_version_id = version.id
              join public.bir_forms form on form.id = relation.form_id
             where version.requirement_id = entry.requirement_id
               and version.status in ('approved', 'superseded')),
           array[]::text[])
    from public.monthly_calendar_entries entry
    join public.monthly_calendar_versions calendar_version on calendar_version.id = entry.calendar_version_id
    join public.bir_requirements requirement on requirement.id = entry.requirement_id
   where calendar_version.status = 'released'
     and entry.publication_status in ('generated', 'needs_review', 'confirmed', 'unresolved')
     and entry.requirement_id = any(p_requirement_ids)
     and calendar_version.calendar_month >= make_date(p_year, 1, 1)
     and calendar_version.calendar_month < make_date(p_year + 1, 1, 1);
end;
$$;
revoke execute on function public.held_calendar_periods(uuid, uuid[], integer) from public, anon;
grant execute on function public.held_calendar_periods(uuid, uuid[], integer) to authenticated;
