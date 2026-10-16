-- The official BIR 2026 calendar publishes combined withholding rows whose
-- labels include 1601-C, 0619-E, and 0619-F. Keep one canonical requirement,
-- but retain all referenced forms so BIR Center and Tax Team can explain it.

insert into public.bir_forms
  (form_number, title, revision_label, status, verification_status, notes)
values
  ('0619-E', 'BIR Form 0619-E · Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)', '2026 calendar reference', 'active', 'partially_verified', 'Form appears in the official 2026 BIR calendar as part of the combined 1601-C/0619-E/0619-F withholding requirement. The underlying form source and applicability remain separately governed.'),
  ('0619-F', 'BIR Form 0619-F · Monthly Remittance Form of Final Income Taxes Withheld', '2026 calendar reference', 'active', 'partially_verified', 'Form appears in the official 2026 BIR calendar as part of the combined 1601-C/0619-E/0619-F withholding requirement. The underlying form source and applicability remain separately governed.')
on conflict (form_number, revision_label) do update set
  title = excluded.title,
  status = excluded.status,
  verification_status = excluded.verification_status,
  notes = excluded.notes;

insert into public.requirement_version_forms (requirement_version_id, form_id, relationship_type)
select version.id, form.id, 'supporting_form'
from public.bir_requirement_versions version
join public.bir_requirements requirement on requirement.id = version.requirement_id
join public.bir_forms form on form.form_number in ('0619-E', '0619-F')
  and form.revision_label = '2026 calendar reference'
where requirement.requirement_code = 'BIR-1601-C'
  and version.version_label = '2026-calendar-reference'
on conflict (requirement_version_id, form_id) do nothing;

create or replace function public.get_deadline_control_repository(p_calendar_year integer)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_deadline_control_access() then
    raise exception using errcode = '42501', message = 'Deadline control is not authorized.';
  end if;

  select coalesce(jsonb_agg(row_data order by adjusted_date nulls last, requirement_label, period_or_event), '[]'::jsonb)
    into result
  from (
    select jsonb_build_object(
      'id', entry.id,
      'calendarYear', extract(year from version.calendar_month)::integer,
      'calendarMonth', version.calendar_month,
      'requirementId', entry.requirement_id,
      'requirementVersionId', entry.requirement_version_id,
      'requirementCode', requirement.requirement_code,
      'requirementLabel', coalesce(requirement.requirement_name, entry.external_requirement_label),
      'formNumber', form.form_number,
      'taxCategory', coalesce(requirement.operating_category, 'others'),
      'cadence', coalesce(requirement.frequency_label, 'as_needed'),
      'periodOrEvent', entry.period_or_event,
      'periodStart', entry.period_start,
      'periodEnd', entry.period_end,
      'baseStatutoryDeadline', entry.base_statutory_deadline,
      'adjustedStatutoryDeadline', entry.adjusted_statutory_deadline,
      'officialPublishedDeadline', nullif(entry.deadline_explanation ->> 'officialPublishedDate', ''),
      'officialCalendarReference', case when source.code = 'BIR-2026-INTERACTIVE-TAX-CALENDAR' then entry.notes else null end,
      'publishedOperationalDeadline', entry.published_operational_deadline,
      'tmfPackageTarget', entry.tmf_package_target,
      'publicationStatus', entry.publication_status,
      'comparisonStatus', entry.comparison_status,
      'ruleVersionId', entry.rule_version_id,
      'sourceCode', source.code,
      'sourceLabel', source.title,
      'sourceLocator', entry.source_locator,
      'adjustmentReason', coalesce(entry.adjustment_reason, ''),
      'explanation', coalesce(entry.deadline_explanation ->> 'text', entry.notes, 'No explanation recorded.'),
      'unresolvedReason', entry.unresolved_reason,
      'notes', entry.notes,
      'history', coalesce(history.events, '[]'::jsonb)
    ) as row_data,
    entry.adjusted_statutory_deadline as adjusted_date,
    coalesce(requirement.requirement_name, entry.external_requirement_label) as requirement_label,
    entry.period_or_event
    from public.monthly_calendar_entries entry
    join public.monthly_calendar_versions version on version.id = entry.calendar_version_id
    left join public.bir_requirements requirement on requirement.id = entry.requirement_id
    left join lateral (
      select string_agg(form_record.form_number, ' · ' order by case when relation.relationship_type = 'primary_form' then 0 else 1 end, form_record.form_number) as form_number
      from public.requirement_version_forms relation
      join public.bir_forms form_record on form_record.id = relation.form_id
      where relation.requirement_version_id = entry.requirement_version_id
    ) form on true
    left join public.regulatory_issuances source on source.id = entry.source_issuance_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'label', case
            when event.from_status is null then 'Deadline recorded'
            when event.from_status = event.to_status then 'Deadline saved'
            else 'Status changed · ' || replace(event.to_status, '_', ' ')
          end,
          'detail', concat_ws(' · ', coalesce(actor.display_name, 'Authenticated user'), nullif(event.reason, '')),
          'recordedAt', event.recorded_at
        ) order by event.recorded_at desc
      ) as events
      from public.deadline_publication_events event
      left join public.app_users actor on actor.id = event.actor_id
      where event.monthly_calendar_entry_id = entry.id
    ) history on true
    where extract(year from version.calendar_month)::integer = p_calendar_year
      and version.status <> 'superseded'
      and version.id = (
        select latest.id
        from public.monthly_calendar_versions latest
        where latest.calendar_month = version.calendar_month
          and latest.status <> 'superseded'
        order by latest.version_number desc
        limit 1
      )
  ) rows;

  return result;
end;
$$;
