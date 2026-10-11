-- Clients workspace persistence boundary: versioned Tax Profile/setup snapshots,
-- effective-dated assignment context, and governed validation history.
-- No tax rules, obligations, filing, payment execution, or generated work are
-- introduced here.

create table if not exists public.tax_profile_versions (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  state text not null check (state in ('draft', 'ready_for_validation', 'active', 'superseded')),
  effective_from date not null,
  effective_to date,
  profile_data jsonb not null,
  assignment_data jsonb not null,
  source_reference_id uuid references public.registration_source_references(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  validated_at timestamptz,
  validated_by uuid references auth.users(id),
  change_reason text not null,
  constraint tax_profile_version_key unique (registration_unit_id, version_number),
  constraint tax_profile_version_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint tax_profile_validation_pair_check check ((state = 'active') = (validated_at is not null and validated_by is not null))
);

create unique index if not exists tax_profile_versions_one_active_idx
  on public.tax_profile_versions(registration_unit_id)
  where state = 'active';

create index if not exists tax_profile_versions_unit_effective_idx
  on public.tax_profile_versions(registration_unit_id, effective_from desc, version_number desc);

create table if not exists public.registration_authorities (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  authority text not null,
  reference text not null,
  status text not null check (status in ('active', 'review_due', 'not_configured', 'superseded')),
  effective_from date not null,
  effective_to date,
  entitlement_context text,
  source_reference_id uuid references public.registration_source_references(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  constraint registration_authority_dates_check check (effective_to is null or effective_to >= effective_from)
);

create index if not exists registration_authorities_unit_effective_idx
  on public.registration_authorities(registration_unit_id, effective_from desc);

create table if not exists public.tax_profile_change_events (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  tax_profile_version_id uuid references public.tax_profile_versions(id),
  event_kind text not null check (event_kind in ('draft_saved', 'validated', 'authority_added', 'authority_changed', 'authority_superseded')),
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  effective_from date not null,
  reason text not null,
  before_context jsonb,
  after_context jsonb
);

create index if not exists tax_profile_change_events_unit_time_idx
  on public.tax_profile_change_events(registration_unit_id, occurred_at desc);

create or replace function public.save_tax_profile_version(
  p_client_reference_code text,
  p_profile_data jsonb,
  p_assignment_data jsonb,
  p_effective_from date,
  p_reason text
)
returns public.tax_profile_versions
language plpgsql
security definer set search_path = public
as $$
declare
  target_unit public.registration_units;
  next_version integer;
  source_reference_id uuid;
  saved_profile public.tax_profile_versions;
begin
  if auth.uid() is null or not (public.has_active_capability('CorrectTaxProfile') or public.has_active_capability('MaintainClientRepository')) then
    raise exception using errcode = '42501', message = 'Tax Profile correction is not authorized.';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required for a Tax Profile change.';
  end if;

  select * into target_unit
  from public.registration_units registration_unit
  join public.taxpayer_entities entity on entity.id = registration_unit.taxpayer_entity_id
  join public.clients client on client.id = entity.client_id
  where client.reference_code = p_client_reference_code and registration_unit.active = true
  order by registration_unit.unit_kind = 'head_office' desc, registration_unit.created_at
  limit 1;

  if target_unit.id is null or not public.can_view_registration_unit(target_unit.id) then
    raise exception using errcode = '42501', message = 'The registration unit is outside the caller''s authority.';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.tax_profile_versions
  where registration_unit_id = target_unit.id;

  select source.id into source_reference_id
  from public.registration_source_references source
  where source.registration_unit_id = target_unit.id
    and source.source_reference = nullif(trim(p_profile_data ->> 'sourceReference'), '')
  order by source.created_at desc
  limit 1;

  insert into public.tax_profile_versions (
    registration_unit_id, version_number, state, effective_from,
    profile_data, assignment_data, source_reference_id, created_by, change_reason
  ) values (
    target_unit.id, next_version, 'ready_for_validation', coalesce(p_effective_from, current_date),
    coalesce(p_profile_data, '{}'::jsonb), coalesce(p_assignment_data, '{}'::jsonb), source_reference_id, auth.uid(), trim(p_reason)
  ) returning * into saved_profile;

  insert into public.tax_profile_change_events (
    registration_unit_id, tax_profile_version_id, event_kind, actor_id, effective_from, reason, after_context
  ) values (
    target_unit.id, saved_profile.id, 'draft_saved', auth.uid(), saved_profile.effective_from, trim(p_reason),
    jsonb_build_object('profile', p_profile_data, 'assignment', p_assignment_data, 'version', next_version)
  );

  return saved_profile;
end;
$$;

create or replace function public.validate_tax_profile_version(
  p_tax_profile_version_id uuid,
  p_reason text
)
returns public.tax_profile_versions
language plpgsql
security definer set search_path = public
as $$
declare
  candidate public.tax_profile_versions;
  required_key text;
  missing_keys text[] := '{}';
  activated_profile public.tax_profile_versions;
begin
  if auth.uid() is null or not public.has_active_capability('ValidateTaxProfile') then
    raise exception using errcode = '42501', message = 'Tax Profile validation is not authorized.';
  end if;

  select * into candidate from public.tax_profile_versions where id = p_tax_profile_version_id;
  if candidate.id is null or not public.can_view_registration_unit(candidate.registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Tax Profile is outside the caller''s authority.';
  end if;
  if candidate.state not in ('ready_for_validation', 'draft') then
    raise exception using errcode = '22023', message = 'Only a profile ready for validation can be activated.';
  end if;

  foreach required_key in array array[
    'registeredTaxpayerName', 'tinDisplay', 'registrationUnitIdentity', 'sourceReference',
    'filingChannel', 'fiscalYearEnd', 'clientWeight', 'enateSetup', 'paymentRoute',
    'cluster', 'tower', 'preparer', 'checker', 'reviewer'
  ] loop
    if nullif(trim(coalesce(candidate.profile_data ->> required_key, candidate.assignment_data ->> required_key, '')), '') is null then
      missing_keys := array_append(missing_keys, required_key);
    end if;
  end loop;

  if jsonb_typeof(candidate.profile_data -> 'assignmentActors') = 'array'
     and jsonb_array_length(candidate.profile_data -> 'assignmentActors') <> 3 then
    missing_keys := array_append(missing_keys, 'distinct assignment actors');
  end if;

  if cardinality(missing_keys) > 0 then
    raise exception using errcode = '22023', message = 'Tax Profile cannot be activated; unresolved required facts: ' || array_to_string(missing_keys, ', ');
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A reason is required for validation.';
  end if;

  update public.tax_profile_versions
  set state = 'superseded'
  where registration_unit_id = candidate.registration_unit_id and state = 'active' and id <> candidate.id;

  update public.tax_profile_versions
  set state = 'active', validated_at = now(), validated_by = auth.uid(), change_reason = trim(p_reason)
  where id = candidate.id
  returning * into activated_profile;

  insert into public.tax_profile_change_events (
    registration_unit_id, tax_profile_version_id, event_kind, actor_id, effective_from, reason,
    before_context, after_context
  ) values (
    activated_profile.registration_unit_id, activated_profile.id, 'validated', auth.uid(), activated_profile.effective_from,
    trim(p_reason), jsonb_build_object('state', candidate.state), jsonb_build_object('state', 'active', 'version', activated_profile.version_number)
  );

  return activated_profile;
end;
$$;

-- Rehydrate the latest governed snapshot for an authorized client. The UI may
-- start from a sanitized read model, but authenticated edits must read back the
-- server-owned version rather than trusting browser state after a refresh.
create or replace function public.get_latest_tax_profile_version(
  p_client_reference_code text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target_client_id uuid;
  latest_profile public.tax_profile_versions;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required to read a Tax Profile.';
  end if;

  select client.id into target_client_id
  from public.clients client
  join public.taxpayer_entities entity on entity.client_id = client.id
  join public.registration_units registration_unit on registration_unit.taxpayer_entity_id = entity.id
  where client.reference_code = p_client_reference_code
    and registration_unit.active = true
    and public.can_view_registration_unit(registration_unit.id)
  limit 1;

  if target_client_id is null then
    return jsonb_build_object('clientFound', false, 'data', null);
  end if;

  select profile.* into latest_profile
  from public.tax_profile_versions profile
  join public.registration_units registration_unit on registration_unit.id = profile.registration_unit_id
  join public.taxpayer_entities entity on entity.id = registration_unit.taxpayer_entity_id
  where entity.client_id = target_client_id
    and registration_unit.active = true
    and public.can_view_registration_unit(registration_unit.id)
  order by profile.effective_from desc, profile.version_number desc
  limit 1;

  if latest_profile.id is null then
    return jsonb_build_object('clientFound', true, 'data', null);
  end if;

  return jsonb_build_object(
    'clientFound', true,
    'data', jsonb_build_object(
      'id', latest_profile.id,
      'state', latest_profile.state,
      'effectiveFrom', latest_profile.effective_from,
      'versionNumber', latest_profile.version_number,
      'profile', latest_profile.profile_data,
      'assignment', latest_profile.assignment_data,
      'createdAt', latest_profile.created_at,
      'validatedAt', latest_profile.validated_at,
      'validatedBy', latest_profile.validated_by,
      'changeReason', latest_profile.change_reason
    )
  );
end;
$$;

revoke execute on function public.save_tax_profile_version(text, jsonb, jsonb, date, text) from public;
revoke execute on function public.validate_tax_profile_version(uuid, text) from public;
revoke execute on function public.get_latest_tax_profile_version(text) from public;
grant execute on function public.save_tax_profile_version(text, jsonb, jsonb, date, text) to authenticated;
grant execute on function public.validate_tax_profile_version(uuid, text) to authenticated;
grant execute on function public.get_latest_tax_profile_version(text) to authenticated;

alter table public.tax_profile_versions enable row level security;
alter table public.registration_authorities enable row level security;
alter table public.tax_profile_change_events enable row level security;

create policy tax_profile_versions_scoped_read on public.tax_profile_versions
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));

create policy registration_authorities_scoped_read on public.registration_authorities
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));

create policy tax_profile_change_events_scoped_read on public.tax_profile_change_events
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));

-- Direct writes are intentionally absent. Changes and validation use the
-- audited security-definer commands above.
