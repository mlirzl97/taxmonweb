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
--    returns, only from released calendar rows. The server computes the periods from the published calendar;
--    this command re-checks every item against the governed facts it cites
--    (published calendar row and date, approved item, active profile, first
--    period to file) and is idempotent through generation_key.
--
-- 2550M and 2551M are optional, client-elected returns with a TMF due date
-- and no BIR deadline (HOD decisions H-005, H-006). They get governed master
-- records so the Tax Team can release their dates like any other deadline
-- (H-010); until then they generate no work.

insert into public.capabilities (key, description) values
  ('ProposeComplianceUniverse', 'Propose Expected Compliance for a validated Tax Profile.'),
  ('ApproveComplianceUniverse', 'Approve Expected Compliance per Registration Unit within scope.'),
  -- Already checked by work and lock commands; registered here so it can be granted.
  ('PerformElevatedOverride', 'Exceptional, reason-required, audited override of an internal control where policy permits; never of an external fact.')
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
  add column if not exists proposed_at timestamptz,
  -- A decision is a proposal until the Registration Unit is approved.
  add column if not exists pending_decision text check (pending_decision in ('in_scope', 'out_of_scope', 'not_applicable', 'unresolved')),
  add column if not exists pending_reason text,
  add column if not exists pending_by uuid references public.app_users(id),
  add column if not exists pending_at timestamptz,
  -- 'tax_profile' when proposing reconciled the validated profile;
  -- 'requirement_version' when a newer governed requirement version is in
  -- force; 'manual' when a person recorded the decision (subject to the
  -- self-approval check).
  add column if not exists pending_source text check (pending_source in ('tax_profile', 'requirement_version', 'manual')),
  -- The requirement and version a pending change moves the return to.
  add column if not exists pending_requirement_id uuid references public.bir_requirements(id),
  add column if not exists pending_requirement_version_id uuid references public.bir_requirement_versions(id),
  -- The Tax Profile version the item was last proposed from; approval
  -- refuses a proposal made from a profile that is no longer active.
  add column if not exists proposed_from_profile_id uuid references public.tax_profile_versions(id);
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
  items_snapshot jsonb not null,
  elevated_override boolean not null default false
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
    -- Only what is in force today: no future-dated or expired requirement or version.
    and (requirement.effective_from is null or requirement.effective_from <= current_date)
    and (requirement.effective_to is null or requirement.effective_to >= current_date)
    and version.effective_from <= current_date
    and (version.effective_to is null or version.effective_to >= current_date)
  -- When a form is primary on several requirements, the one named for the
  -- form itself (BIR-1601-C for 1601-C) wins; then a stable order.
  order by (relation.relationship_type = 'primary_form') desc,
           (upper(requirement.requirement_code) = 'BIR-' || upper(trim(p_form_number))) desc,
           version.effective_from desc nulls last,
           requirement.requirement_code
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
  removed integer := 0;
  restored integer := 0;
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

  -- Changes proposed from an earlier profile are recomputed from this one,
  -- so a return removed and re-added (or the reverse) before approval never
  -- carries a stale proposal. A person's own pending decisions stay.
  update public.client_compliance_universe_items item
     set pending_decision = null, pending_reason = null, pending_by = null, pending_at = null, pending_source = null,
         pending_requirement_id = null, pending_requirement_version_id = null
   where item.registration_unit_id = p_registration_unit_id
     and item.pending_source in ('tax_profile', 'requirement_version');

  for return_code in
    select distinct upper(trim(value)) from jsonb_array_elements_text(coalesce(profile.profile_data -> 'registeredReturnCodes', '[]'::jsonb)) as value
    where nullif(trim(value), '') is not null
  loop
    form_code := return_code;
    select * into governed from public.requirement_for_form(form_code);
    -- A return held unresolved for want of a governed requirement becomes a
    -- candidate again once the Tax Team activates one.
    if governed.requirement_id is not null then
      update public.client_compliance_universe_items item
         set requirement_id = governed.requirement_id,
             requirement_version_id = governed.requirement_version_id,
             selection_status = 'candidate',
             decision_reason = null,
             proposed_by = auth.uid(),
             proposed_at = now()
       where item.registration_unit_id = p_registration_unit_id
         and item.form_number = form_code
         and item.selection_status = 'unresolved'
         and item.requirement_id is null
         and item.pending_decision is null;
      if found then
        proposed := proposed + 1;
        continue;
      end if;
      -- A candidate not yet approved simply follows the governed requirement.
      update public.client_compliance_universe_items item
         set requirement_id = governed.requirement_id,
             requirement_version_id = governed.requirement_version_id
       where item.registration_unit_id = p_registration_unit_id
         and item.form_number = form_code
         and item.selection_status = 'candidate'
         and (item.requirement_id, item.requirement_version_id) is distinct from (governed.requirement_id, governed.requirement_version_id);
      -- An approved return whose governed requirement or version has changed
      -- is proposed for the move; it takes effect only on approval, the
      -- authorized impact decision, and the old version governs until then.
      update public.client_compliance_universe_items item
         set pending_decision = coalesce(item.service_scope, 'in_scope'),
             pending_reason = 'A newer BIR requirement version is in force; approval moves this return to it.',
             pending_by = auth.uid(),
             pending_at = now(),
             pending_source = 'requirement_version',
             pending_requirement_id = governed.requirement_id,
             pending_requirement_version_id = governed.requirement_version_id
       where item.registration_unit_id = p_registration_unit_id
         and item.form_number = form_code
         and item.selection_status = 'approved'
         and item.pending_decision is null
         and (item.requirement_id, item.requirement_version_id) is distinct from (governed.requirement_id, governed.requirement_version_id);
      if found then
        proposed := proposed + 1;
      end if;
    end if;
    if exists (
      select 1 from public.client_compliance_universe_items item
      where item.registration_unit_id = p_registration_unit_id
        and item.form_number = form_code
        and item.selection_status <> 'superseded'
        and (item.effective_to is null or item.effective_to >= current_date)
    ) then
      continue;
    end if;
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

  -- A return no longer on the validated profile is proposed for removal,
  -- and one that comes back is proposed again; both apply only on approval.
  update public.client_compliance_universe_items item
     set pending_decision = 'not_applicable',
         pending_reason = 'Removed from the validated Tax Profile.',
         pending_by = auth.uid(),
         pending_at = now(),
         pending_source = 'tax_profile'
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status not in ('superseded', 'excluded')
     and item.pending_decision is null
     and item.form_number is not null
     and item.form_number <> all (
       select upper(trim(value)) from jsonb_array_elements_text(coalesce(profile.profile_data -> 'registeredReturnCodes', '[]'::jsonb)) as value
     );
  get diagnostics removed = row_count;
  update public.client_compliance_universe_items item
     set pending_decision = 'in_scope',
         pending_reason = 'Back on the validated Tax Profile.',
         pending_by = auth.uid(),
         pending_at = now(),
         pending_source = 'tax_profile'
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status = 'excluded'
     and item.decision_reason = 'Removed from the validated Tax Profile.'
     and item.pending_decision is null
     and item.requirement_id is not null
     and item.form_number = any (
       select upper(trim(value)) from jsonb_array_elements_text(coalesce(profile.profile_data -> 'registeredReturnCodes', '[]'::jsonb)) as value
     );
  get diagnostics restored = row_count;
  proposed := proposed + removed + restored;
  update public.client_compliance_universe_items item
     set proposed_from_profile_id = profile.id
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status <> 'superseded';

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

create or replace function public.decide_expected_compliance_item(p_registration_unit_id uuid, p_item_id uuid, p_decision text, p_reason text default null)
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
  -- Same lock as approval, so a decision cannot land between approval's
  -- self-approval check and its update.
  perform 1 from public.registration_units where id = p_registration_unit_id for update;
  select * into item from public.client_compliance_universe_items where id = p_item_id for update;
  -- The item must belong to the Registration Unit the caller is looking at.
  if item.id is null or item.registration_unit_id is distinct from p_registration_unit_id
     or not public.can_view_registration_unit(item.registration_unit_id) then
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
  if item.selection_status = 'superseded' then
    raise exception using errcode = '22023', message = 'A superseded Expected Compliance item cannot be decided.';
  end if;
  -- A decision is only a proposal: what is approved keeps governing work
  -- until approve_expected_compliance applies it.
  update public.client_compliance_universe_items
     set pending_decision = decision,
         pending_reason = reason,
         pending_by = auth.uid(),
         pending_at = now(),
         pending_source = 'manual'
   where id = item.id;
  perform public.append_audit_event(
    'expected_compliance_item_decided', 'client_compliance_universe_item', item.id::text,
    'Expected Compliance decision recorded', to_jsonb(item),
    jsonb_build_object('decision', decision, 'reason', reason), reason, now(), gen_random_uuid()
  );
end;
$$;
revoke execute on function public.decide_expected_compliance_item(uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_expected_compliance_item(uuid, uuid, text, text) to authenticated;

create or replace function public.approve_expected_compliance(p_registration_unit_id uuid, p_reason text, p_elevated_override boolean default false)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  approved_count integer;
  candidate_count integer;
  own_decisions integer;
  elevated boolean := false;
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
  -- No one independently approves a decision they recorded themselves (L-047).
  -- Reconciliations proposed from the validated profile are not a person's
  -- judgment. Elevated Override is the exception: reasoned, marked, audited.
  select count(*) into own_decisions
    from public.client_compliance_universe_items item
   where item.registration_unit_id = p_registration_unit_id
     and item.pending_decision is not null
     and item.pending_source = 'manual'
     and item.pending_by = auth.uid();
  if own_decisions > 0 then
    if not (coalesce(p_elevated_override, false) and public.has_active_capability('PerformElevatedOverride')) then
      raise exception using errcode = '42501', message = format('You recorded %s of the proposed decisions; another approver must approve them.', own_decisions);
    end if;
    elevated := true;
  end if;

  -- A proposal made from a Tax Profile that is no longer the active one is
  -- stale: it must be proposed again from the profile in force.
  if exists (
    select 1 from public.client_compliance_universe_items item
     where item.registration_unit_id = p_registration_unit_id
       and item.selection_status <> 'superseded'
       and item.proposed_from_profile_id is distinct from (public.active_tax_profile_for_unit(p_registration_unit_id)).id
  ) then
    raise exception using errcode = '22023', message = 'The Tax Profile changed since Expected Compliance was proposed; propose again before approving.';
  end if;

  -- Proposed decisions take effect now, with their reasons.
  update public.client_compliance_universe_items item
     set selection_status = case item.pending_decision when 'not_applicable' then 'excluded' when 'unresolved' then 'unresolved' else 'approved' end,
         service_scope = case when item.pending_decision in ('in_scope', 'out_of_scope') then item.pending_decision else null end,
         decision_reason = item.pending_reason,
         decided_by = item.pending_by,
         decided_at = item.pending_at,
         requirement_id = coalesce(item.pending_requirement_id, item.requirement_id),
         requirement_version_id = coalesce(item.pending_requirement_version_id, item.requirement_version_id),
         pending_decision = null, pending_reason = null, pending_by = null, pending_at = null, pending_source = null,
         pending_requirement_id = null, pending_requirement_version_id = null
   where item.registration_unit_id = p_registration_unit_id
     and item.pending_decision is not null
     and item.selection_status <> 'superseded'
     and (item.requirement_id is not null or item.pending_decision in ('not_applicable', 'unresolved'));
  get diagnostics approved_count = row_count;
  -- A candidate without a proposed decision is the ordinary case: In TMF Scope.
  update public.client_compliance_universe_items item
     set selection_status = 'approved',
         service_scope = 'in_scope',
         decided_by = auth.uid(),
         decided_at = now()
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status = 'candidate'
     and item.pending_decision is null
     and item.requirement_id is not null;
  get diagnostics candidate_count = row_count;
  approved_count := approved_count + candidate_count;
  -- A retry or a duplicate submission finds nothing left to approve and
  -- records no second approval.
  if approved_count = 0 and exists (select 1 from public.expected_compliance_approvals where registration_unit_id = p_registration_unit_id) then
    raise exception using errcode = '22023', message = 'Nothing is waiting for approval.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'itemId', item.id, 'form', item.form_number, 'status', item.selection_status,
           'scope', item.service_scope, 'reason', item.decision_reason) order by item.form_number), '[]'::jsonb)
    into snapshot
    from public.client_compliance_universe_items item
   where item.registration_unit_id = p_registration_unit_id
     and item.selection_status <> 'superseded';
  insert into public.expected_compliance_approvals (registration_unit_id, approved_by, reason, items_snapshot, elevated_override)
  values (p_registration_unit_id, auth.uid(), trim(p_reason), snapshot, elevated);
  perform public.append_audit_event(
    'expected_compliance_approved', 'registration_unit', p_registration_unit_id::text,
    case when elevated then 'Expected Compliance approved by Elevated Override (approver recorded some decisions)' else 'Expected Compliance approved for the Registration Unit' end,
    null, jsonb_build_object('items', snapshot, 'elevatedOverride', elevated), trim(p_reason), now(), gen_random_uuid()
  );
  return approved_count;
end;
$$;
revoke execute on function public.approve_expected_compliance(uuid, text, boolean) from public, anon;
grant execute on function public.approve_expected_compliance(uuid, text, boolean) to authenticated;

-- The first month a BIR calendar row's own wording says it covers, mirroring
-- compliancePeriodStartFromLabel in the app: "Month of June 2026",
-- "(Fiscal) Quarter ending September 30, 2026", "Fiscal Year ending May 31,
-- 2026", "Calendar Year 2025". Null when the wording states no period.
create or replace function public.compliance_period_start_from_label(p_label text)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  text_value text := regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g');
  parts text[];
begin
  parts := regexp_match(text_value, 'Month of (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})', 'i');
  if parts is not null then
    return to_date(parts[1] || ' ' || parts[2], 'FMMonth YYYY');
  end if;
  parts := regexp_match(text_value, 'Quarter ending (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, (\d{4})', 'i');
  if parts is not null then
    return (to_date(parts[1] || ' ' || parts[2], 'FMMonth YYYY') - interval '2 months')::date;
  end if;
  parts := regexp_match(text_value, 'Year ending (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, (\d{4})', 'i');
  if parts is not null then
    return (to_date(parts[1] || ' ' || parts[2], 'FMMonth YYYY') - interval '11 months')::date;
  end if;
  parts := regexp_match(text_value, '(?:Taxable|Calendar) Year (\d{4})', 'i');
  if parts is not null then
    return to_date(parts[1] || '-01-01', 'YYYY-MM-DD');
  end if;
  return null;
end;
$$;

-- Creates Compliance Work for approved, in-scope returns. Each item is
-- {form, kind ('return'|'proof'), periodStart (YYYY-MM-01), periodLabel,
-- dueDate, calendarEntryId}.
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
    if first_period is not null and item_period_start < first_period then
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
    -- The internal target may never fall after the legal deadline.
    if coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline) is not null
       and coalesce(entry.tmf_package_target, due_date - 1) > coalesce(entry.adjusted_statutory_deadline, entry.base_statutory_deadline) then
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
      if governed_version_id is not null and governed_version_id <> approved_item.requirement_version_id then
        skipped := skipped || jsonb_build_array(jsonb_build_object('item', item, 'reason', 'The calendar row is on a newer requirement version than the one approved; it needs an authorized impact decision before work moves to it.'));
        continue;
      end if;
      governed_version_id := approved_item.requirement_version_id;
    end if;
    if governed_version_id is null then
      select version.id into governed_version_id from public.bir_requirement_versions version
       where version.requirement_id = governed_requirement_id and version.status = 'approved'
         and version.effective_from <= current_date
         and (version.effective_to is null or version.effective_to >= current_date)
       order by version.effective_from desc limit 1;
    end if;

    key := 'generated:' || p_registration_unit_id::text || ':' || form_code || ':' || item_kind || ':' || to_char(item_period_start, 'YYYY-MM');
    if exists (select 1 from public.generated_compliance_work where generation_key = key) then
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
      -- The released target stands (e.g. a Tax Team override); one day before
      -- the due date only when the row carries none.
      coalesce(entry.tmf_package_target, due_date - 1),
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
