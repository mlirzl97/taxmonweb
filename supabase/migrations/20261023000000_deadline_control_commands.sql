-- Governed deadline repository commands.
--
-- The tax-knowledge foundation already owns the tables. This migration adds
-- the restricted read/write boundary used by Tax Team, HOD, and Super Admin.
-- Deadline rows are never physically deleted: released or historical rows are
-- superseded and every transition is appended to deadline_publication_events
-- and audit_events.

insert into public.capabilities (key, description)
values ('MaintainDeadlineControl', 'Maintain governed deadline rules and calendar publication control.')
on conflict (key) do nothing;

create or replace function public.has_deadline_control_access()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select auth.uid() is not null
    and public.is_active_app_user()
    and (
      public.has_active_capability('MaintainDeadlineControl')
      or public.has_active_capability('MaintainRulesLibrary')
      or public.has_active_capability('ValidateTaxProfile')
    );
$$;

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
      'notes', entry.notes
    ) as row_data,
    entry.adjusted_statutory_deadline as adjusted_date,
    coalesce(requirement.requirement_name, entry.external_requirement_label) as requirement_label,
    entry.period_or_event
    from public.monthly_calendar_entries entry
    join public.monthly_calendar_versions version on version.id = entry.calendar_version_id
    left join public.bir_requirements requirement on requirement.id = entry.requirement_id
    left join lateral (
      select form_record.form_number
      from public.requirement_version_forms relation
      join public.bir_forms form_record on form_record.id = relation.form_id
      where relation.requirement_version_id = entry.requirement_version_id
        and relation.relationship_type = 'primary_form'
      order by form_record.form_number
      limit 1
    ) form on true
    left join public.regulatory_issuances source on source.id = entry.source_issuance_id
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

create or replace function public.save_deadline_control_entry(
  p_entry_id uuid,
  p_calendar_month date,
  p_requirement_code text,
  p_requirement_name text,
  p_form_number text,
  p_operating_category text,
  p_frequency_label text,
  p_period_or_event text,
  p_period_start date,
  p_period_end date,
  p_base_statutory_deadline date,
  p_adjusted_statutory_deadline date,
  p_tmf_package_target date,
  p_source_code text,
  p_source_locator text,
  p_notes text,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing_entry public.monthly_calendar_entries;
  calendar_version public.monthly_calendar_versions;
  requirement public.bir_requirements;
  requirement_version public.bir_requirement_versions;
  form_record public.bir_forms;
  source_record public.regulatory_issuances;
  before_status text;
  before_state jsonb;
  normalized_month date := date_trunc('month', coalesce(p_calendar_month, p_period_start, current_date))::date;
  normalized_category text := lower(trim(coalesce(p_operating_category, '')));
  normalized_frequency text := lower(trim(coalesce(p_frequency_label, '')));
  version_label text;
begin
  if not public.has_deadline_control_access() then
    raise exception using errcode = '42501', message = 'Deadline control is not authorized.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required for a deadline change.';
  end if;
  if nullif(trim(p_requirement_code), '') is null or nullif(trim(p_requirement_name), '') is null then
    raise exception using errcode = '22023', message = 'Requirement code and name are required.';
  end if;
  if normalized_category not in ('cit', 'vat_percentage', 'wht', 'others') then
    raise exception using errcode = '22023', message = 'Operating category must be CIT, VAT / Percentage Tax, WHT, or Others.';
  end if;
  if normalized_frequency not in ('monthly', 'quarterly', 'annual', 'as_needed') then
    raise exception using errcode = '22023', message = 'Frequency must be monthly, quarterly, annual, or as-needed.';
  end if;
  if nullif(trim(p_source_code), '') is null then
    raise exception using errcode = '22023', message = 'An authoritative source is required.';
  end if;

  select * into source_record from public.regulatory_issuances where code = trim(p_source_code) and status <> 'retired';
  if source_record.id is null then
    raise exception using errcode = '22023', message = 'The selected regulatory source does not exist in the source master.';
  end if;

  if p_entry_id is not null then
    select * into existing_entry from public.monthly_calendar_entries where id = p_entry_id for update;
    if existing_entry.id is null then
      raise exception using errcode = 'P0002', message = 'The deadline entry no longer exists.';
    end if;
    if existing_entry.publication_status in ('published', 'superseded') then
      raise exception using errcode = '22023', message = 'Released or superseded entries cannot be edited; create a governed successor instead.';
    end if;
    before_status := existing_entry.publication_status;
    before_state := to_jsonb(existing_entry);
    update public.monthly_calendar_entries
    set external_requirement_label = trim(p_requirement_name),
        period_or_event = nullif(trim(p_period_or_event), ''),
        period_start = p_period_start,
        period_end = p_period_end,
        base_statutory_deadline = p_base_statutory_deadline,
        adjusted_statutory_deadline = p_adjusted_statutory_deadline,
        tmf_package_target = p_tmf_package_target,
        source_issuance_id = source_record.id,
        source_locator = nullif(trim(p_source_locator), ''),
        notes = nullif(trim(p_notes), ''),
        publication_status = case when existing_entry.publication_status = 'confirmed' then 'needs_review' else existing_entry.publication_status end,
        comparison_status = 'unresolved',
        confirmed_by = null,
        confirmed_at = null,
        adjustment_reason = case when p_adjusted_statutory_deadline is distinct from p_base_statutory_deadline then 'Adjusted date recorded by authorized Tax Team control.' else null end,
        deadline_explanation = jsonb_build_object('text', 'Edited by authorized deadline control; source and reason retained in audit history.')
    where id = existing_entry.id;
  else
    select * into requirement from public.bir_requirements where requirement_code = trim(p_requirement_code);
    if requirement.id is null then
      raise exception using errcode = '22023', message = 'The requirement must already exist in the BIR Requirement Master.';
    end if;
    if requirement.status in ('retired', 'superseded') then
      raise exception using errcode = '22023', message = 'A retired or superseded requirement cannot receive new deadline rows.';
    end if;

    if nullif(trim(p_form_number), '') is not null then
      select * into form_record from public.bir_forms where form_number = trim(p_form_number) and status <> 'retired' order by effective_from nulls last limit 1;
      if form_record.id is null then
        raise exception using errcode = '22023', message = 'The form must already exist in the BIR Form Master.';
      end if;
    end if;

    version_label := 'deadline-control-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
    insert into public.bir_requirement_versions (
      requirement_id, version_label, effective_from, status, verification_status,
      applicability_strategy, period_strategy, metadata
    ) values (
      requirement.id, version_label, normalized_month, 'draft', requirement.verification_status,
      'human_review_required', normalized_frequency, jsonb_build_object('createdBy', 'deadline_control')
    ) returning * into requirement_version;

    if form_record.id is not null then
      insert into public.requirement_version_forms (requirement_version_id, form_id, relationship_type)
      values (requirement_version.id, form_record.id, 'primary_form');
    end if;

    select * into calendar_version
    from public.monthly_calendar_versions
    where calendar_month = normalized_month and status in ('draft', 'under_review')
    order by version_number desc limit 1;
    if calendar_version.id is null then
      insert into public.monthly_calendar_versions (calendar_month, version_number, status, prepared_by, prepared_at, release_note)
      select normalized_month,
             coalesce(max(version_number), 0) + 1,
             'draft', auth.uid(), now(), 'Deadline Control draft created from governed repository command.'
      from public.monthly_calendar_versions where calendar_month = normalized_month
      returning * into calendar_version;
    end if;

    insert into public.monthly_calendar_entries (
      calendar_version_id, requirement_id, requirement_version_id, external_requirement_label,
      period_or_event, period_start, period_end, base_statutory_deadline,
      adjusted_statutory_deadline, tmf_package_target, comparison_status,
      source_issuance_id, source_locator, notes, publication_status,
      adjustment_reason, deadline_explanation
    ) values (
      calendar_version.id, requirement.id, requirement_version.id, trim(p_requirement_name),
      nullif(trim(p_period_or_event), ''), p_period_start, p_period_end, p_base_statutory_deadline,
      p_adjusted_statutory_deadline, p_tmf_package_target, 'unresolved',
      source_record.id, nullif(trim(p_source_locator), ''), nullif(trim(p_notes), ''), 'needs_review',
      case when p_adjusted_statutory_deadline is distinct from p_base_statutory_deadline then 'Adjusted date recorded by authorized Tax Team control.' else null end,
      jsonb_build_object('text', 'New deadline row requires review before release.')
    ) returning * into existing_entry;
  end if;

  insert into public.deadline_publication_events (monthly_calendar_entry_id, from_status, to_status, actor_id, reason, source_context)
  values (existing_entry.id, before_status, existing_entry.publication_status, auth.uid(), trim(p_reason), jsonb_build_object('sourceCode', source_record.code));

  perform public.append_audit_event(
    case when p_entry_id is null then 'deadline_control.created' else 'deadline_control.edited' end,
    'monthly_calendar_entry', existing_entry.id::text,
    case when p_entry_id is null then 'Created a deadline control row.' else 'Edited an unreleased deadline control row.' end,
    before_state, to_jsonb(existing_entry), trim(p_reason), now(), null
  );

  return jsonb_build_object('id', existing_entry.id, 'publicationStatus', existing_entry.publication_status);
end;
$$;

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

  if entry.publication_status = 'published' and p_to_status not in ('published', 'superseded') then
    raise exception using errcode = '22023', message = 'A released deadline can only remain published or be superseded.';
  end if;
  if p_to_status = 'published' and coalesce(p_published_operational_deadline, entry.adjusted_statutory_deadline) is null then
    raise exception using errcode = '22023', message = 'A published deadline requires an adjusted statutory date or explicit operational date.';
  end if;
  if p_to_status = 'published' and coalesce(entry.comparison_status, '') <> 'match' then
    raise exception using errcode = '22023', message = 'A deadline must be source-reconciled before it can be published.';
  end if;
  if p_to_status = 'published'
    and entry.adjusted_statutory_deadline is not null
    and coalesce(p_published_operational_deadline, entry.adjusted_statutory_deadline) > entry.adjusted_statutory_deadline then
    raise exception using errcode = '22023', message = 'The operational due date cannot be later than the earliest applicable statutory deadline.';
  end if;

  update public.monthly_calendar_entries
  set publication_status = p_to_status,
      published_operational_deadline = case when p_to_status = 'published' then coalesce(p_published_operational_deadline, adjusted_statutory_deadline) else published_operational_deadline end,
      confirmed_by = case when p_to_status = 'confirmed' then auth.uid() else confirmed_by end,
      confirmed_at = case when p_to_status = 'confirmed' then now() else confirmed_at end,
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

revoke execute on function public.has_deadline_control_access() from public;
revoke execute on function public.get_deadline_control_repository(integer) from public;
revoke execute on function public.save_deadline_control_entry(uuid, date, text, text, text, text, text, text, date, date, date, date, date, text, text, text, text) from public;
revoke execute on function public.transition_deadline_control_entry(uuid, text, date, text) from public;
grant execute on function public.has_deadline_control_access() to authenticated;
grant execute on function public.get_deadline_control_repository(integer) to authenticated;
grant execute on function public.save_deadline_control_entry(uuid, date, text, text, text, text, text, text, date, date, date, date, date, text, text, text, text) to authenticated;
grant execute on function public.transition_deadline_control_entry(uuid, text, date, text) to authenticated;

comment on function public.save_deadline_control_entry(uuid, date, text, text, text, text, text, text, date, date, date, date, date, text, text, text, text) is
  'Version-aware deadline repository command. It never edits released rows and requires source-backed reasoned changes.';
