-- Expected Compliance and automatic generation of Compliance Work.
--
-- The approved spine is: validated Tax Profile → proposed Expected Compliance
-- → approval per Registration Unit → generated Compliance Work. This slice adds
-- the smallest complete version of it:
--
-- 1. Expected Compliance is held per Registration Unit and per return (form),
--    because one BIR calendar requirement can carry more than one return
--    (e.g. the combined 1601-C / 0619-E / 0619-F rows).
-- 2. propose_expected_compliance proposes items from the active Tax Profile's
--    selected returns; decide_expected_compliance_item records a decision;
--    approve_expected_compliance records the per-Registration-Unit approval.
-- 3. record_generated_compliance_work creates work for approved, in-scope
--    returns. The server computes the periods from the published calendar;
--    this command re-checks every item against the governed facts it cites
--    (published calendar row and date, approved item, active profile, first
--    period to file) and is idempotent through generation_key.
--
-- 2550M and 2551M are optional, client-elected returns with a TMF due date
-- and no BIR deadline (HOD decisions H-005, H-006). They get governed master
-- records so their work has a requirement like every other return.

insert into public.capabilities (key, description) values
  ('ProposeComplianceUniverse', 'Propose Expected Compliance for a validated Tax Profile.'),
  ('ApproveComplianceUniverse', 'Approve Expected Compliance per Registration Unit within scope.')
on conflict (key) do nothing;

-- Optional monthly returns as governed masters.
insert into public.bir_forms (form_number, title, revision_label, status, verification_status, notes)
values
  ('2550M', 'BIR Form 2550M · Monthly Value-Added Tax Declaration', 'optional monthly', 'active', 'partially_verified',
   'Optional since RMC 52-2023 (no BIR deadline). Filed only when the client elects it; TMF due date is the 20th of the following month (HOD decision H-006).'),
  ('2551M', 'BIR Form 2551M · Monthly Percentage Tax Return', 'optional monthly', 'active', 'partially_verified',
   'Treated as optional and client-elected (HOD decision H-006); secondary sources report it was discontinued from 2018 under TRAIN. TMF due date is the 20th of the following month; no BIR deadline.')
on conflict (form_number, revision_label) do nothing;

insert into public.bir_requirements (requirement_code, requirement_name, requirement_type, operating_category, frequency_label, status)
values
  ('BIR-2550M', 'Monthly Value-Added Tax Declaration (optional, client-elected)', 'independent_recurring', 'vat_percentage', 'monthly', 'active'),
  ('BIR-2551M', 'Monthly Percentage Tax Return (optional, client-elected)', 'independent_recurring', 'vat_percentage', 'monthly', 'active')
on conflict (requirement_code) do nothing;

insert into public.bir_requirement_versions (requirement_id, version_label, status, effective_from)
select requirement.id, 'hod-optional-monthly-2026', 'approved', date '2026-01-01'
from public.bir_requirements requirement
where requirement.requirement_code in ('BIR-2550M', 'BIR-2551M')
on conflict (requirement_id, version_label) do nothing;

insert into public.requirement_version_forms (requirement_version_id, form_id, relationship_type)
select version.id, form.id, 'primary_form'
from public.bir_requirement_versions version
join public.bir_requirements requirement on requirement.id = version.requirement_id
join public.bir_forms form on form.form_number = substring(requirement.requirement_code from 5) and form.revision_label = 'optional monthly'
where requirement.requirement_code in ('BIR-2550M', 'BIR-2551M')
  and version.version_label = 'hod-optional-monthly-2026'
on conflict do nothing;

-- Expected Compliance per Registration Unit and return.
alter table public.client_compliance_universe_items
  add column if not exists form_number text,
  add column if not exists service_scope text,
  add column if not exists proposed_by uuid references public.app_users(id),
  add column if not exists proposed_at timestamptz;
alter table public.client_compliance_universe_items alter column requirement_id drop not null;
alter table public.client_compliance_universe_items
  drop constraint if exists client_compliance_universe_it_registration_unit_id_requirem_key;
alter table public.client_compliance_universe_items
  drop constraint if exists client_compliance_universe_items_service_scope_check;
alter table public.client_compliance_universe_items
  add constraint client_compliance_universe_items_service_scope_check
  check (service_scope is null or service_scope in ('in_scope', 'out_of_scope'));
alter table public.client_compliance_universe_items
  drop constraint if exists client_compliance_universe_items_decision_check;
-- Approved items carry a scope; Not Applicable and Out of Scope carry a reason;
-- an item without a governed requirement can only be unresolved.
alter table public.client_compliance_universe_items
  add constraint client_compliance_universe_items_decision_check check (
    (selection_status <> 'approved' or service_scope is not null)
    and (selection_status <> 'excluded' or nullif(trim(coalesce(decision_reason, '')), '') is not null)
    and (service_scope is distinct from 'out_of_scope' or nullif(trim(coalesce(decision_reason, '')), '') is not null)
    and (requirement_id is not null or selection_status in ('unresolved', 'superseded'))
  );
create unique index if not exists client_compliance_universe_items_unit_form_from_key
  on public.client_compliance_universe_items (registration_unit_id, form_number, effective_from)
  where form_number is not null;

create table if not exists public.expected_compliance_approvals (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id),
  approved_by uuid not null references public.app_users(id),
  approved_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) > 0),
  items_snapshot jsonb not null
);
comment on table public.expected_compliance_approvals is 'Append-only record of each Expected Compliance approval, per Registration Unit, with the decisions approved.';
alter table public.expected_compliance_approvals enable row level security;

drop policy if exists expected_compliance_items_read on public.client_compliance_universe_items;
create policy expected_compliance_items_read on public.client_compliance_universe_items
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));
drop policy if exists expected_compliance_approvals_read on public.expected_compliance_approvals;
create policy expected_compliance_approvals_read on public.expected_compliance_approvals
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));
grant select on public.client_compliance_universe_items, public.expected_compliance_approvals to authenticated;

-- The requirement that carries a return form, preferring the return's own
-- primary requirement over one that lists it as a supporting form.
create or replace function public.requirement_for_form(p_form_number text)
returns table (requirement_id uuid, requirement_version_id uuid)
language sql
stable
security definer set search_path = public
as $$
  select version.requirement_id, version.id
  from public.bir_forms form
  join public.requirement_version_forms relation on relation.form_id = form.id
  join public.bir_requirement_versions version on version.id = relation.requirement_version_id
  join public.bir_requirements requirement on requirement.id = version.requirement_id
  where upper(form.form_number) = upper(trim(p_form_number))
    and requirement.status = 'active'
    and version.status = 'approved'
  order by (relation.relationship_type = 'primary_form') desc, version.effective_from desc nulls last
  limit 1;
$$;
revoke execute on function public.requirement_for_form(text) from public, anon, authenticated;

-- The active Tax Profile version of a Registration Unit, or null.
create or replace function public.active_tax_profile_for_unit(p_registration_unit_id uuid)
returns public.tax_profile_versions
language sql
stable
security definer set search_path = public
as $$
  select profile.*
  from public.tax_profile_versions profile
  where profile.registration_unit_id = p_registration_unit_id
    and profile.state = 'active'
    and profile.effective_from <= current_date
  order by profile.effective_from desc, profile.version_number desc
  limit 1;
$$;
revoke execute on function public.active_tax_profile_for_unit(uuid) from public, anon, authenticated;

create or replace function public.propose_expected_compliance(p_registration_unit_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  profile public.tax_profile_versions;
  return_code text;
  form_code text;
  governed record;
  proposed integer := 0;
begin
  if auth.uid() is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not (public.has_active_capability('ProposeComplianceUniverse') or public.has_active_capability('ApproveComplianceUniverse')) then
    raise exception using errcode = '42501', message = 'Proposing Expected Compliance is not authorized for the caller.';
  end if;
  if not public.can_view_registration_unit(p_registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Registration Unit is outside the caller''s scope.';
  end if;
  perform 1 from public.registration_units where id = p_registration_unit_id for update;
  profile := public.active_tax_profile_for_unit(p_registration_unit_id);
  if profile.id is null then
    raise exception using errcode = '22023', message = 'Expected Compliance needs a validated, active Tax Profile.';
  end if;

  for return_code in
    select distinct upper(trim(value)) from jsonb_array_elements_text(coalesce(profile.profile_data -> 'registeredReturnCodes', '[]'::jsonb)) as value
    where nullif(trim(value), '') is not null
  loop
    form_code := return_code;
    if exists (
      select 1 from public.client_compliance_universe_items item
      where item.registration_unit_id = p_registration_unit_id
        and item.form_number = form_code
        and item.selection_status <> 'superseded'
        and (item.effective_to is null or item.effective_to >= current_date)
    ) then
      continue;
    end if;
    select * into governed from public.requirement_for_form(form_code);
    insert into public.client_compliance_universe_items (
      registration_unit_id, requirement_id, requirement_version_id, form_number, selection_status,
      effective_from, selection_source, decision_reason, proposed_by, proposed_at
    ) values (
      p_registration_unit_id, governed.requirement_id, governed.requirement_version_id, form_code,
      case when governed.requirement_id is null then 'unresolved' else 'candidate' end,
      current_date,
      'tax-profile-selected-return',
      case when governed.requirement_id is null then 'No active, approved BIR requirement carries this return yet; the Tax Team must activate it before work can generate.' else null end,
      auth.uid(), now()
    );
    proposed := proposed + 1;
  end loop;

  perform public.append_audit_event(
    'expected_compliance_proposed', 'registration_unit', p_registration_unit_id::text,
    'Expected Compliance proposed from the active Tax Profile', null,
    jsonb_build_object('proposedItems', proposed, 'taxProfileVersionId', profile.id), null, now(), gen_random_uuid()
  );
  return proposed;
end;
$$;
revoke execute on function public.propose_expected_compliance(uuid) from public, anon;
grant execute on function public.propose_expected_compliance(uuid) to authenticated;

create or replace function public.decide_expected_compliance_item(p_item_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  item public.client_compliance_universe_items;
  decision text := lower(trim(coalesce(p_decision, '')));
  reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not (public.has_active_capability('ProposeComplianceUniverse') or public.has_active_capability('ApproveComplianceUniverse')) then
    raise exception using errcode = '42501', message = 'Deciding Expected Compliance is not authorized for the caller.';
  end if;
  select * into item from public.client_compliance_universe_items where id = p_item_id for update;
  if item.id is null or not public.can_view_registration_unit(item.registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Expected Compliance item is outside the caller''s scope.';
  end if;
  if decision not in ('in_scope', 'out_of_scope', 'not_applicable', 'unresolved') then
    raise exception using errcode = '22023', message = 'Decision must be in_scope, out_of_scope, not_applicable or unresolved.';
  end if;
  if decision in ('out_of_scope', 'not_applicable') and reason is null then
    raise exception using errcode = '22023', message = 'A reason is required for Out of TMF Scope or Not Applicable.';
  end if;
  if decision in ('in_scope', 'out_of_scope') and item.requirement_id is null then
    raise exception using errcode = '22023', message = 'This return has no governed BIR requirement yet; it stays unresolved.';
  end if;
  -- A decision is a proposal until the Registration Unit is approved again.
  update public.client_compliance_universe_items
     set selection_status = case decision when 'not_applicable' then 'excluded' when 'unresolved' then 'unresolved' else 'candidate' end,
         service_scope = case when decision in ('in_scope', 'out_of_scope') then decision else null end,
         decision_reason = reason,
         decided_by = auth.uid(),
         decided_at = now()
   where id = item.id;
  perform public.append_audit_event(
    'expected_compliance_item_decided', 'client_compliance_universe_item', item.id::text,
    'Expected Compliance decision recorded', to_jsonb(item),
    jsonb_build_object('decision', decision, 'reason', reason), reason, now(), gen_random_uuid()
  );
end;
$$;
revoke execute on function public.decide_expected_compliance_item(uuid, text, text) from public, anon;
grant execute on function public.decide_expected_compliance_item(uuid, text, text) to authenticated;

create or replace function public.approve_expected_compliance(p_registration_unit_id uuid, p_reason text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  approved_count integer;
  snapshot jsonb;
begin
  if auth.uid() is null or not public.is_active_app_user() then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if not public.has_active_capability('ApproveComplianceUniverse') then
    raise exception using errcode = '42501', message = 'Approving Expected Compliance is not authorized for the caller.';
  end if;
  if not public.can_view_registration_unit(p_registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Registration Unit is outside the caller''s scope.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required to approve Expected Compliance.';
  end if;
  perform 1 from public.registration_units where id = p_registration_unit_id for update;
  if (public.active_tax_profile_for_unit(p_registration_unit_id)).id is null then
    raise exception using errcode = '22023', message = 'Expected Compliance needs a validated, active Tax Profile.';
  end if;

  -- A candidate without an explicit scope is the ordinary case: In TMF Scope.
  update public.client_compliance_universe_items item
     set selection_status = 'approved',
         service_scope = coalesce(item.service_scope, 'in_scope'),
         decided_by = coalesce(item.decided_by, auth.uid()),
         decided_at = coalesce(item.decided_at, now())
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status = 'candidate'
     and item.requirement_id is not null;
  get diagnostics approved_count = row_count;

  select coalesce(jsonb_agg(jsonb_build_object(
           'itemId', item.id, 'form', item.form_number, 'status', item.selection_status,
           'scope', item.service_scope, 'reason', item.decision_reason) order by item.form_number), '[]'::jsonb)
    into snapshot
    from public.client_compliance_universe_items item
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status <> 'superseded';
  insert into public.expected_compliance_approvals (registration_unit_id, approved_by, reason, items_snapshot)
  values (p_registration_unit_id, auth.uid(), trim(p_reason), snapshot);
  perform public.append_audit_event(
    'expected_compliance_approved', 'registration_unit', p_registration_unit_id::text,
    'Expected Compliance approved for the Registration Unit', null, snapshot, trim(p_reason), now(), gen_random_uuid()
  );
  return approved_count;
end;
$$;
revoke execute on function public.approve_expected_compliance(uuid, text) from public, anon;
grant execute on function public.approve_expected_compliance(uuid, text) to authenticated;

-- Creates Compliance Work for approved, in-scope returns. Each item is
-- {form, kind ('return'|'proof'), periodStart (YYYY-MM-01), periodLabel,
-- dueDate, calendarEntryId (null only for an elected optional monthly return)}.
-- Every item is checked against the governed facts it cites; an item that
-- does not hold is skipped and reported, never invented.
create or replace function public.record_generated_compliance_work(p_registration_unit_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  profile public.tax_profile_versions;
  first_period date;
  item jsonb;
  form_code text;
  item_kind text;
  period_start date;
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
  profile := public.active_tax_profile_for_unit(p_registration_unit_id);
  if profile.id is null then
    raise exception using errcode = '22023', message = 'Compliance Work needs a validated, active Tax Profile.';
  end if;
  if coalesce(profile.profile_data ->> 'firstPeriodToFile', '') ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    first_period := (profile.profile_data ->> 'firstPeriodToFile' || '-01')::date;
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
      period_start := (item ->> 'periodStart')::date;
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

    if item_kind not in ('return', 'proof') or period_start is null or due_date is null or extract(day from period_start) <> 1 then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The item is incomplete.'));
      continue;
    end if;
    if first_period is not null and period_start < first_period then
      skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The period is before the first period to file.'));
      continue;
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

    if entry_id is not null then
      -- A BIR deadline must be a published row in a released calendar, on the
      -- date cited, for a requirement that carries this return.
      select calendar_entry.id, calendar_entry.requirement_id, calendar_entry.requirement_version_id,
             calendar_entry.published_operational_deadline, calendar_entry.period_or_event
        into entry
        from public.monthly_calendar_entries calendar_entry
        join public.monthly_calendar_versions calendar_version on calendar_version.id = calendar_entry.calendar_version_id
       where calendar_entry.id = entry_id
         and calendar_entry.publication_status = 'published'
         and calendar_version.status = 'released'
         and calendar_entry.published_operational_deadline = due_date
         and exists (
           select 1 from public.requirement_version_forms relation
           join public.bir_forms form on form.id = relation.form_id
           join public.bir_requirement_versions version on version.id = relation.requirement_version_id
           where version.requirement_id = calendar_entry.requirement_id
             and upper(form.form_number) = form_code
         );
      if entry.id is null then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'No published calendar row supports this date.'));
        continue;
      end if;
      governed_requirement_id := entry.requirement_id;
      governed_version_id := entry.requirement_version_id;
    else
      -- Only an elected optional monthly return has a TMF date without a BIR
      -- row: months 1–2 of a quarter, due on the 20th of the next month.
      if form_code not in ('2550M', '2551M')
         or (extract(month from period_start)::integer - 1) % 3 = 2
         or due_date <> (period_start + interval '1 month')::date + 19 then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'This return needs a published calendar row.'));
        continue;
      end if;
      select * into governed from public.requirement_for_form(form_code);
      governed_requirement_id := governed.requirement_id;
      governed_version_id := governed.requirement_version_id;
      if governed_requirement_id is null then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'No governed requirement carries this return.'));
        continue;
      end if;
    end if;
    if governed_version_id is null then
      select version.id into governed_version_id from public.bir_requirement_versions version
       where version.requirement_id = governed_requirement_id and version.status = 'approved'
       order by version.effective_from desc limit 1;
    end if;

    key := 'generated:' || p_registration_unit_id::text || ':' || form_code || ':' || item_kind || ':' || to_char(period_start, 'YYYY-MM');
    if exists (select 1 from public.generated_compliance_work where generation_key = key) then
      existing := existing + 1;
      continue;
    end if;

    insert into public.generated_compliance_work (
      registration_unit_id, requirement_id, requirement_version_id, generation_key,
      period_label, instance_type, data_readiness, lifecycle_stage, engagement_status, rag_status,
      adjusted_statutory_deadline, tmf_package_target, payment_applicability,
      preparer_user_id, checker_user_id, reviewer_user_id, current_owner_user_id,
      current_gate, source_context, created_by, updated_by
    ) values (
      p_registration_unit_id, governed_requirement_id, governed_version_id, key,
      left(coalesce(nullif(trim(item ->> 'periodLabel'), ''), form_code || ' · ' || to_char(period_start, 'FMMonth YYYY')), 240),
      'recurring_period', 'not_ready', 'preparation', 'open', 'unresolved',
      case when entry_id is null then null else due_date end,
      (due_date - 1),
      'unresolved',
      preparer_id, checker_id, reviewer_id, preparer_id,
      'preparer',
      jsonb_build_object(
        'creationMode', 'generated',
        'formNumber', form_code,
        'kind', item_kind,
        'periodStart', period_start,
        'dueDate', due_date,
        'dueDateBasis', case when entry_id is null then 'TMF due date (no BIR deadline)' else 'Published BIR calendar' end,
        'calendarEntryId', entry_id,
        'expectedComplianceItemId', approved_item.id,
        'taxProfileVersionId', profile.id
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
