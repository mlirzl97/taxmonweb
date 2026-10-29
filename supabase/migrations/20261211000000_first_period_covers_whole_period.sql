-- A client that starts mid-quarter or mid-year files the whole period's
-- return (HOD decision H-014, 2026-10-24).
--
-- Generation used to skip any period that starts before the first period to
-- file. A client whose first period is March 2026 therefore got no Q1
-- quarterly returns (1601-EQ, 2550Q, 1702Q, covering January to March) and no
-- 2026 annual returns (1604-C, 1604-E, 1702-RT), although each covers March.
-- A period is now skipped only when it ends before the first period to file.

-- How many months a calendar row's compliance period covers, read from its
-- own wording: "Quarter ending ..." is three months, a calendar, taxable or
-- fiscal year is twelve; anything else is one month.
create or replace function public.compliance_period_months(p_label text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_label, '') ~* 'quarter ending' then 3
    when coalesce(p_label, '') ~* '(year ending|calendar year|taxable year|fiscal year)' then 12
    else 1
  end;
$$;
revoke execute on function public.compliance_period_months(text) from public, anon, authenticated;

create or replace function public.record_generated_compliance_work(p_registration_unit_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  profile public.tax_profile_versions;
  approved_profile public.tax_profile_versions;
  tmf_target date;
  first_period date;
  go_live date;
  fy_end_month integer;
  period_end_month integer;
  item jsonb;
  form_code text;
  item_kind text;
  item_period_start date;
  due_date date;
  entry_id uuid;
  entry record;
  approved_item public.client_compliance_universe_items;
  governed record;
  governed_requirement_id uuid;
  governed_version_id uuid;
  key text;
  preparer_id uuid;
  checker_id uuid;
  reviewer_id uuid;
  created_work public.generated_compliance_work;
  created integer := 0;
  existing integer := 0;
  skipped jsonb := '[]'::jsonb;
  audit_id uuid;
  actor_display text;
begin
  if actor_id is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not (public.has_active_capability('MaintainGeneratedComplianceWork') or public.has_active_capability('ApproveComplianceUniverse')) then
    raise exception using errcode = '42501', message = 'Generating Compliance Work is not authorized for the caller.';
  end if;
  if not public.can_view_registration_unit(p_registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Registration Unit is outside the caller''s scope.';
  end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Generation items must be an array.';
  end if;
  perform 1 from public.registration_units where id = p_registration_unit_id for update;
  -- Only an active Registration Unit carries Expected Compliance and work.
  if not exists (select 1 from public.registration_units unit where unit.id = p_registration_unit_id and unit.active) then
    raise exception using errcode = '22023', message = 'The Registration Unit is not active.';
  end if;
  profile := public.active_tax_profile_for_unit(p_registration_unit_id);
  if profile.id is null then
    raise exception using errcode = '22023', message = 'Compliance Work needs a validated, active Tax Profile.';
  end if;
  -- Generation follows the profile the approved universe was proposed from,
  -- not a newer one whose changes have not been approved yet.
  select profile_version.* into approved_profile
    from public.expected_compliance_approvals approval
    join public.tax_profile_versions profile_version on profile_version.id = approval.tax_profile_version_id
   where approval.registration_unit_id = p_registration_unit_id
   order by approval.approved_at desc, approval.id desc
   limit 1;
  if approved_profile.id is null then
    raise exception using errcode = '22023', message = 'Compliance Work needs an approved Expected Compliance.';
  end if;
  if coalesce(approved_profile.profile_data ->> 'firstPeriodToFile', '') ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    first_period := (approved_profile.profile_data ->> 'firstPeriodToFile' || '-01')::date;
  end if;
  if coalesce(approved_profile.profile_data ->> 'goLiveDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    go_live := (approved_profile.profile_data ->> 'goLiveDate')::date;
  end if;
  -- A fiscal-year client's year-end month (1-12), as the Service Calendar reads it.
  if approved_profile.profile_data ->> 'taxYearBasis' = 'Fiscal year' then
    fy_end_month := array_position(
      array['january','february','march','april','may','june','july','august','september','october','november','december'],
      lower(substring(coalesce(approved_profile.profile_data ->> 'fiscalYearEnd', '') from '^\s*([A-Za-z]+)')));
  end if;

  -- Owners in force today are the accountability snapshot.
  select assignment.user_id into preparer_id from public.registration_unit_team_assignments assignment
   where assignment.registration_unit_id = p_registration_unit_id and assignment.assignment_role = 'preparer' and assignment.user_id is not null
     and assignment.effective_from <= current_date and (assignment.effective_to is null or assignment.effective_to >= current_date)
   order by assignment.effective_from desc, assignment.assigned_at desc limit 1;
  select assignment.user_id into checker_id from public.registration_unit_team_assignments assignment
   where assignment.registration_unit_id = p_registration_unit_id and assignment.assignment_role = 'checker' and assignment.user_id is not null
     and assignment.effective_from <= current_date and (assignment.effective_to is null or assignment.effective_to >= current_date)
   order by assignment.effective_from desc, assignment.assigned_at desc limit 1;
  select assignment.user_id into reviewer_id from public.registration_unit_team_assignments assignment
   where assignment.registration_unit_id = p_registration_unit_id and assignment.assignment_role = 'reviewer' and assignment.user_id is not null
     and assignment.effective_from <= current_date and (assignment.effective_to is null or assignment.effective_to >= current_date)
   order by assignment.effective_from desc, assignment.assigned_at desc limit 1;
  select display_name into actor_display from public.app_users where id = actor_id;

  for item in select value from jsonb_array_elements(p_items) loop
    form_code := upper(trim(coalesce(item ->> 'form', '')));
    item_kind := coalesce(nullif(item ->> 'kind', ''), 'return');
    begin
      item_period_start := (item ->> 'periodStart')::date;
      due_date := (item ->> 'dueDate')::date;
    exception when others then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'Period or due date is not a date.'));
      continue;
    end;
    approved_item := null;
    entry := null;
    governed_requirement_id := null;
    governed_version_id := null;
    entry_id := case when coalesce(item ->> 'calendarEntryId', '') ~* '^[0-9a-f-]{36}$' then (item ->> 'calendarEntryId')::uuid else null end;

    if item_kind not in ('return', 'proof') or item_period_start is null or due_date is null or extract(day from item_period_start) <> 1 then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The item is incomplete.'));
      continue;
    end if;
    -- The approved profile's calendar rules hold here too, mirroring the
    -- Service Calendar projection (return-families.ts): nothing due on or
    -- before go-live, and the year basis decides which periods apply.
    if go_live is not null and due_date <= go_live then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The due date is on or before the go-live date.'));
      continue;
    end if;
    if fy_end_month is not null and form_code in ('2550M', '2550Q', '2551M', '2551Q') and fy_end_month % 3 <> 0 then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The fiscal year does not end on a calendar quarter-end; VAT and percentage-tax dates need Tax Team review.'));
      continue;
    end if;
    if fy_end_month is not null and form_code in ('1702Q', '1702-RT', '1702-EX', '1702-MX') then
      period_end_month := extract(month from item_period_start + case when form_code = '1702Q' then interval '2 months' else interval '11 months' end)::integer;
      if (form_code = '1702Q' and (period_end_month = fy_end_month or (fy_end_month - period_end_month + 12) % 3 <> 0))
         or (form_code <> '1702Q' and period_end_month <> fy_end_month) then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The period is not one of the client''s fiscal quarters or its fiscal year.'));
        continue;
      end if;
    end if;

    select * into approved_item from public.client_compliance_universe_items candidate
     where candidate.registration_unit_id = p_registration_unit_id
       and candidate.form_number = form_code
       and candidate.selection_status = 'approved'
       and candidate.service_scope = 'in_scope'
       and candidate.effective_from <= current_date
       and (candidate.effective_to is null or candidate.effective_to >= current_date)
     order by candidate.effective_from desc limit 1;
    if approved_item.id is null then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The return is not approved In TMF Scope.'));
      continue;
    end if;
    -- The approved requirement and version must still be in force.
    if not exists (
      select 1 from public.bir_requirements requirement
      join public.bir_requirement_versions version on version.requirement_id = requirement.id
      where requirement.id = approved_item.requirement_id
        and version.id = approved_item.requirement_version_id
        and requirement.status = 'active' and version.status = 'approved'
        and (requirement.effective_to is null or requirement.effective_to >= current_date)
        and version.effective_from <= current_date
        and (version.effective_to is null or version.effective_to >= current_date)
    ) then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The approved BIR requirement is no longer in force; propose again for Tax Team review.'));
      continue;
    end if;

    if entry_id is not null then
      -- A BIR deadline must be a published row in a released calendar, on the
      -- date cited, for a requirement that carries this return.
      -- The row must also cover the period being generated, by its own
      -- wording, and a supporting form (e.g. 0619-E on a 1601-C row) must be
      -- named on that row.
      select calendar_entry.id, calendar_entry.requirement_id, calendar_entry.requirement_version_id,
             calendar_entry.published_operational_deadline, calendar_entry.period_or_event,
             calendar_entry.base_statutory_deadline, calendar_entry.adjusted_statutory_deadline,
             calendar_entry.tmf_package_target
        into entry
        from public.monthly_calendar_entries calendar_entry
        join public.monthly_calendar_versions calendar_version on calendar_version.id = calendar_entry.calendar_version_id
       where calendar_entry.id = entry_id
         and calendar_entry.publication_status = 'published'
         and calendar_version.status = 'released'
         and calendar_entry.published_operational_deadline = due_date
         and coalesce(date_trunc('month', calendar_entry.period_start)::date, public.compliance_period_start_from_label(calendar_entry.period_or_event)) = item_period_start
         and (calendar_entry.period_or_event ~* '^\s*proof of e-?filed') = (item_kind = 'proof')
         and exists (
           select 1 from public.requirement_version_forms relation
           join public.bir_forms form on form.id = relation.form_id
           join public.bir_requirement_versions version on version.id = relation.requirement_version_id
           where version.requirement_id = calendar_entry.requirement_id
             -- The form must be carried by the version the row itself cites.
             and (calendar_entry.requirement_version_id is null or version.id = calendar_entry.requirement_version_id)
             and upper(form.form_number) = form_code
             and (relation.relationship_type = 'primary_form'
                  or position(form_code in upper(coalesce(calendar_entry.period_or_event, ''))) > 0)
         );
      if entry.id is null then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'No published calendar row supports this return, period and date.'));
        continue;
      end if;
      governed_requirement_id := entry.requirement_id;
      governed_version_id := entry.requirement_version_id;
    else
      -- Every date, including an elected optional return's TMF due date, comes
      -- from a row the Tax Team has released; none is computed here.
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'This return needs a published calendar row.'));
      continue;
    end if;
    -- A return is filed when its period covers the first period to file,
    -- even when the period starts earlier (HOD decision H-014): a client
    -- starting in March files the Q1 quarterly return and that year's annual
    -- return. The period's length comes from the cited row's own wording.
    if first_period is not null
       and (item_period_start + make_interval(months => public.compliance_period_months(entry.period_or_event) - 1))::date < first_period then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The period ends before the first period to file.'));
      continue;
    end if;
    -- A fiscal-period row applies only to a fiscal-year client's income tax.
    if entry.period_or_event ~* 'fiscal'
       and (fy_end_month is null or form_code not in ('1702Q', '1702-RT', '1702-EX', '1702-MX')) then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'A fiscal-period calendar row does not apply to this client''s year basis.'));
      continue;
    end if;
    -- The TMF package target follows the approved profile: a client with its
    -- own operating dates counts its working days back from the published
    -- date; otherwise the released row's target applies, or the day before.
    if approved_profile.profile_data -> 'deadlinePolicy' ->> 'mode' = 'client_defined'
       and coalesce(approved_profile.profile_data -> 'deadlinePolicy' ->> 'tmfPackageLeadDays', '') ~ '^\d{1,3}$'
       and (approved_profile.profile_data -> 'deadlinePolicy' ->> 'tmfPackageLeadDays')::integer <= 365 then
      tmf_target := public.working_days_before(due_date, (approved_profile.profile_data -> 'deadlinePolicy' ->> 'tmfPackageLeadDays')::integer);
    elsif approved_profile.profile_data -> 'deadlinePolicy' ->> 'mode' = 'client_defined' then
      -- The client keeps its own operating dates but set no TMF package
      -- target: none is invented for it.
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The client''s operating dates set no TMF package target; set one on the Tax Profile.'));
      continue;
    else
      tmf_target := coalesce(entry.tmf_package_target, due_date - 1);
    end if;
    -- The internal target may never fall after the legal deadline.
    if coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline) is not null
       and tmf_target > coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline) then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The published operational date is after the BIR deadline; the Tax Team must review it.'));
      continue;
    end if;
    -- Work follows the requirement version Expected Compliance approved. A
    -- newer version of that requirement is a universe change: it needs an
    -- impact decision and a new approval, never a silent rebase.
    if governed_requirement_id is distinct from approved_item.requirement_id then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The calendar row belongs to a different BIR requirement than the one approved for this return.'));
      continue;
    end if;
    if approved_item.requirement_version_id is not null then
      -- A backlog period may cite the earlier version that governed it: an
      -- approved version of the same requirement that took effect before the
      -- approved one and covers the period. A newer version still needs an
      -- authorized move.
      if governed_version_id is not null and governed_version_id <> approved_item.requirement_version_id
         and not exists (
           select 1 from public.bir_requirement_versions earlier
           join public.bir_requirement_versions approved_version on approved_version.id = approved_item.requirement_version_id
           where earlier.id = governed_version_id
             and earlier.requirement_id = approved_item.requirement_id
             and earlier.status in ('approved', 'superseded')
             and earlier.effective_from < approved_version.effective_from
             and earlier.effective_from <= item_period_start
             and (earlier.effective_to is null or earlier.effective_to >= item_period_start)
         ) then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The calendar row is on a newer requirement version than the one approved; it needs an authorized impact decision before work moves to it.'));
        continue;
      end if;
      -- A row that cites no version lands on the approved version, or on the
      -- earlier one that governed a backlog period.
      if governed_version_id is null then
        select version.id into governed_version_id
          from public.bir_requirement_versions version
          join public.bir_requirement_versions approved_version on approved_version.id = approved_item.requirement_version_id
         where version.requirement_id = approved_item.requirement_id
           and (version.id = approved_version.id
                or (version.status in ('approved', 'superseded') and version.effective_from < approved_version.effective_from))
           and version.effective_from <= item_period_start
           and (version.effective_to is null or version.effective_to >= item_period_start)
         order by version.effective_from desc
         limit 1;
        if governed_version_id is null then
          skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'No BIR requirement version on record governed this period; the Tax Team must review it.'));
          continue;
        end if;
      end if;
    end if;
    if governed_version_id is null then
      select version.id into governed_version_id from public.bir_requirement_versions version
       where version.requirement_id = governed_requirement_id and version.status = 'approved'
         and version.effective_from <= current_date
         and (version.effective_to is null or version.effective_to >= current_date)
       order by version.effective_from desc limit 1;
    end if;
    -- Whichever version the work lands on, it must have governed the period
    -- and carried this form.
    if governed_version_id is null or not exists (
      select 1 from public.bir_requirement_versions version
       where version.id = governed_version_id
         and version.effective_from <= item_period_start
         and (version.effective_to is null or version.effective_to >= item_period_start)
         and exists (
           select 1 from public.requirement_version_forms relation
           join public.bir_forms form on form.id = relation.form_id
           where relation.requirement_version_id = version.id
             and upper(form.form_number) = form_code
             and (relation.relationship_type = 'primary_form'
                  or position(form_code in upper(coalesce(entry.period_or_event, ''))) > 0)
         )
    ) then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'No BIR requirement version on record governed this period and carried this return; the Tax Team must review it.'));
      continue;
    end if;

    key := 'generated:' || p_registration_unit_id::text || ':' || form_code || ':' || item_kind || ':' || to_char(item_period_start, 'YYYY-MM');
    if exists (select 1 from public.generated_compliance_work where generation_key = key) then
      -- Work already generated for this period under another requirement
      -- version is not an idempotent match: it needs a governed keep, rebase
      -- or supersede decision, which is surfaced rather than made here.
      if exists (
        select 1 from public.generated_compliance_work work
         where work.generation_key = key
           and (work.requirement_id, work.requirement_version_id) is distinct from (governed_requirement_id, governed_version_id)
      ) then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'Work for this period already exists under an earlier requirement version; it needs a keep, rebase or supersede decision.'));
        continue;
      end if;
      -- Likewise when the released dates changed since the work was created.
      if exists (
        select 1 from public.generated_compliance_work work
         where work.generation_key = key
           and (work.base_statutory_deadline is distinct from entry.base_statutory_deadline
                or work.adjusted_statutory_deadline is distinct from entry.adjusted_statutory_deadline
                or work.tmf_package_target is distinct from tmf_target
                or (work.source_context ->> 'dueDate') is distinct from due_date::text)
      ) then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'Work for this period already exists with earlier published dates; it needs a keep, rebase or supersede decision.'));
        continue;
      end if;
      existing := existing + 1;
      continue;
    end if;

    insert into public.generated_compliance_work (
      registration_unit_id, requirement_id, requirement_version_id, generation_key,
      period_label, instance_type, data_readiness, lifecycle_stage, engagement_status, rag_status,
      base_statutory_deadline, adjusted_statutory_deadline, tmf_package_target, payment_applicability,
      preparer_user_id, checker_user_id, reviewer_user_id, current_owner_user_id,
      current_gate, source_context, created_by, updated_by
    ) values (
      p_registration_unit_id, governed_requirement_id, governed_version_id, key,
      -- The label comes from the governed row's own period wording.
      left(form_code || case when item_kind = 'proof' then ' proof of filing and attachments' else '' end || ' · '
        || coalesce((regexp_match(regexp_replace(coalesce(entry.period_or_event, ''), '\s+', ' ', 'g'),
             '(Month of [A-Za-z]+ \d{4}|(?:Fiscal )?Quarter ending [A-Za-z]+ \d{1,2}, \d{4}|(?:Fiscal |Taxable |Calendar )?Year ending [A-Za-z]+ \d{1,2}, \d{4}|(?:Calendar|Taxable) Year \d{4})', 'i'))[1],
             to_char(item_period_start, 'FMMonth YYYY')), 240),
      'recurring_period', 'not_ready', 'preparation', 'open', 'unresolved',
      -- The legal deadline stays the calendar row's own statutory date; the
      -- published operational due date is kept separately in source_context.
      entry.base_statutory_deadline,
      entry.adjusted_statutory_deadline,
      -- The approved profile's client-defined target, else the released one.
      tmf_target,
      'unresolved',
      preparer_id, checker_id, reviewer_id, preparer_id,
      'preparer',
      jsonb_build_object(
        'creationMode', 'generated',
        'formNumber', form_code,
        'kind', item_kind,
        'periodStart', item_period_start,
        'dueDate', due_date,
        'dueDateBasis', 'Published operational calendar',
        'calendarEntryId', entry_id,
        'expectedComplianceItemId', approved_item.id,
        'taxProfileVersionId', approved_profile.id
      ),
      actor_id, actor_id
    )
    on conflict (generation_key) do nothing
    returning * into created_work;
    if created_work.id is null then
      existing := existing + 1;
      continue;
    end if;

    insert into public.generated_work_process_steps (
      generated_work_id, step_code, bundle, label, owner_role, step_order, status, started_at, updated_at
    ) values (
      created_work.id, 'preparer', 'filing', 'Preparation', 'preparer', 1, 'in_progress', now(), now()
    );
    select public.append_audit_event(
      'work_generated', 'generated_compliance_work', created_work.id::text,
      'Compliance Work generated from approved Expected Compliance', null, to_jsonb(created_work), null, now(), gen_random_uuid()
    ) into audit_id;
    insert into public.generated_compliance_work_events (
      generated_work_id, event_kind, actor_id, actor_display, idempotency_key,
      from_context, to_context, effective_at, correlation_id
    ) values (
      created_work.id, 'work_created', actor_id, coalesce(actor_display, 'Authenticated user'), key,
      null, to_jsonb(created_work), now(), audit_id
    );
    created := created + 1;
    created_work := null;
  end loop;

  return jsonb_build_object('created', created, 'existing', existing, 'skipped', skipped);
end;
$$;
revoke execute on function public.record_generated_compliance_work(uuid, jsonb) from public, anon;
grant execute on function public.record_generated_compliance_work(uuid, jsonb) to authenticated;
