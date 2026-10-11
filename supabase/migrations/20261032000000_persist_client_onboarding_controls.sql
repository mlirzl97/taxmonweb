-- Persist the controls collected by the Client Registry onboarding intake.
-- This does not activate a Tax Profile or create compliance work.

alter table public.contract_repositories
  add column if not exists intake_record_type text not null default 'not_confirmed',
  add column if not exists intake_record_reference text,
  add column if not exists intake_source_reference text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contract_repositories_intake_record_type_check'
      and conrelid = 'public.contract_repositories'::regclass
  ) then
    alter table public.contract_repositories
      add constraint contract_repositories_intake_record_type_check
      check (intake_record_type in ('msa', 'lsa', 'addendum', 'crf_crn', 'not_confirmed'));
  end if;
end $$;

create table if not exists public.client_onboarding_source_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  registration_unit_id uuid not null references public.registration_units(id) on delete cascade,
  item_type text not null,
  status text not null check (status in ('not_captured', 'received', 'not_applicable', 'unknown')),
  source_reference text,
  rationale text,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  constraint client_onboarding_source_item_received_check
    check (status <> 'received' or nullif(trim(source_reference), '') is not null),
  constraint client_onboarding_source_item_unresolved_check
    check (status not in ('unknown', 'not_applicable') or nullif(trim(rationale), '') is not null),
  constraint client_onboarding_source_item_key unique (registration_unit_id, item_type)
);

create index if not exists client_onboarding_source_items_client_idx
  on public.client_onboarding_source_items(client_id, recorded_at desc);

alter table public.client_onboarding_source_items enable row level security;

drop policy if exists client_onboarding_source_items_scoped_read on public.client_onboarding_source_items;
create policy client_onboarding_source_items_scoped_read on public.client_onboarding_source_items
  for select to authenticated
  using (public.can_view_client(client_id));

create or replace function public.create_manual_client_setup(
  p_client_reference_code text,
  p_client_display_name text,
  p_entity_reference_code text,
  p_entity_display_name text,
  p_tin text,
  p_unit_reference_code text,
  p_unit_display_name text,
  p_unit_kind text,
  p_registration_reference text,
  p_organization_unit_id uuid,
  p_source_reference text,
  p_source_system text,
  p_source_notes text,
  p_profile_data jsonb,
  p_contract_data jsonb,
  p_source_pack jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  created_client public.clients;
  created_entity public.taxpayer_entities;
  created_unit public.registration_units;
  created_repository public.contract_repositories;
  source_reference_id uuid;
  created_profile public.tax_profile_versions;
  normalized_profile jsonb;
  source_item jsonb;
  source_item_type text;
  source_item_status text;
  source_item_reference text;
  source_item_rationale text;
begin
  if auth.uid() is null or not public.has_active_capability('MaintainClientRepository') then
    raise exception using errcode = '42501', message = 'Client repository maintenance is not authorized.';
  end if;

  if not public.can_manage_organization_unit(p_organization_unit_id) then
    raise exception using errcode = '42501', message = 'The selected organizational scope is outside the caller''s authority.';
  end if;

  if jsonb_typeof(coalesce(p_source_pack, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Source pack must be an array of source-control items.';
  end if;

  insert into public.clients (reference_code, display_name, status, created_by, updated_by)
  values (p_client_reference_code, p_client_display_name, 'setup_pending', auth.uid(), auth.uid())
  returning * into created_client;

  insert into public.contract_repositories (
    client_id, reference_code, status, intake_record_type,
    intake_record_reference, intake_source_reference, created_by, updated_by
  ) values (
    created_client.id,
    'CONTRACT-REPO-' || created_client.reference_code,
    'setup_pending',
    coalesce(nullif(p_contract_data ->> 'recordType', ''), 'not_confirmed'),
    nullif(p_contract_data ->> 'referenceCode', ''),
    nullif(p_contract_data ->> 'sourceReference', ''),
    auth.uid(), auth.uid()
  )
  returning * into created_repository;

  insert into public.taxpayer_entities (client_id, reference_code, display_name, tin, tin_status, created_by, updated_by)
  values (
    created_client.id,
    p_entity_reference_code,
    p_entity_display_name,
    nullif(p_tin, ''),
    case when nullif(p_tin, '') is null then 'unresolved' else 'provided' end,
    auth.uid(), auth.uid()
  )
  returning * into created_entity;

  insert into public.registration_units (taxpayer_entity_id, reference_code, display_name, unit_kind, registration_reference, created_by, updated_by)
  values (
    created_entity.id,
    p_unit_reference_code,
    p_unit_display_name,
    p_unit_kind,
    nullif(p_registration_reference, ''),
    auth.uid(), auth.uid()
  )
  returning * into created_unit;

  insert into public.registration_unit_scope_assignments (registration_unit_id, organization_unit_id, assigned_by, reason)
  values (created_unit.id, p_organization_unit_id, auth.uid(), 'Manual client repository setup');

  insert into public.registration_source_references (
    registration_unit_id, source_kind, source_system, source_reference,
    status, notes, created_by
  ) values (
    created_unit.id,
    case when p_source_system = 'manual_reference' then 'other_registration_source' else 'bir_form_2303' end,
    p_source_system,
    p_source_reference,
    case when p_source_system = 'synthetic_fixture' then 'needs_review' else 'reference_only' end,
    p_source_notes,
    auth.uid()
  )
  returning id into source_reference_id;

  for source_item in select value from jsonb_array_elements(coalesce(p_source_pack, '[]'::jsonb)) loop
    source_item_type := nullif(trim(source_item ->> 'type'), '');
    source_item_status := nullif(trim(source_item ->> 'status'), '');
    source_item_reference := nullif(trim(source_item ->> 'sourceReference'), '');
    source_item_rationale := nullif(trim(source_item ->> 'notes'), '');
    if source_item_type is null or source_item_status is null then
      raise exception using errcode = '22023', message = 'Every source-pack item requires a type and status.';
    end if;
    if source_item_status = 'received' and source_item_reference is null then
      raise exception using errcode = '22023', message = source_item_type || ' requires a source reference when received.';
    end if;
    if source_item_status in ('unknown', 'not_applicable') and source_item_rationale is null then
      raise exception using errcode = '22023', message = source_item_type || ' requires a rationale.';
    end if;
    insert into public.client_onboarding_source_items (
      client_id, registration_unit_id, item_type, status,
      source_reference, rationale, recorded_by
    ) values (
      created_client.id, created_unit.id, source_item_type, source_item_status,
      source_item_reference, source_item_rationale, auth.uid()
    );
  end loop;

  normalized_profile := jsonb_build_object(
    'registeredTaxpayerName', coalesce(nullif(p_profile_data ->> 'registeredTaxpayerName', ''), p_entity_display_name),
    'tinDisplay', coalesce(nullif(p_profile_data ->> 'tinDisplay', ''), p_tin),
    'registrationUnitIdentity', p_unit_display_name,
    'sourceReference', p_source_reference,
    'rdoOrLts', p_profile_data ->> 'rdoOrLts',
    'registeredAddress', p_profile_data ->> 'registeredAddress',
    'taxYearBasis', p_profile_data ->> 'taxYearBasis',
    'fiscalYearEnd', p_profile_data ->> 'fiscalYearEnd',
    'accountingSystem', p_profile_data ->> 'accountingSystem',
    'filingChannel', p_profile_data ->> 'filingChannel',
    'eFPSGroup', p_profile_data ->> 'eFPSGroup',
    'registeredTaxTypes', coalesce(p_profile_data -> 'registeredTaxTypes', '[]'::jsonb),
    'registeredTaxTypesRaw', p_profile_data ->> 'registeredTaxTypesRaw',
    'sourceNotes', coalesce(p_profile_data ->> 'sourceNotes', p_source_notes)
  );

  insert into public.tax_profile_versions (
    registration_unit_id, version_number, state, effective_from,
    profile_data, assignment_data, source_reference_id, created_by, change_reason
  ) values (
    created_unit.id, 1, 'ready_for_validation', current_date,
    normalized_profile, '{}'::jsonb, source_reference_id, auth.uid(), 'Manual onboarding intake captured from approved registration source'
  )
  returning * into created_profile;

  perform public.append_audit_event(
    'client_setup_created',
    'client',
    created_client.id::text,
    'Client onboarding intake created with source-pack and contract controls',
    null,
    jsonb_build_object(
      'clientId', created_client.id,
      'taxpayerEntityId', created_entity.id,
      'registrationUnitId', created_unit.id,
      'contractRepositoryId', created_repository.id,
      'taxProfileVersionId', created_profile.id,
      'contractData', coalesce(p_contract_data, '{}'::jsonb),
      'sourcePack', coalesce(p_source_pack, '[]'::jsonb),
      'setupStatus', created_client.status
    ),
    'Manual client repository setup'
  );

  return jsonb_build_object(
    'clientId', created_client.id,
    'contractRepositoryId', created_repository.id,
    'taxpayerEntityId', created_entity.id,
    'registrationUnitId', created_unit.id,
    'taxProfileVersionId', created_profile.id,
    'setupStatus', 'setup_pending'
  );
end;
$$;

revoke execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb, jsonb, jsonb) to authenticated;

-- Existing live drafts predate structured source-pack persistence. Record only
-- the primary source already present; do not infer the missing controls.
insert into public.client_onboarding_source_items (
  client_id, registration_unit_id, item_type, status, source_reference, recorded_by
)
select c.id, ru.id, 'bir_form_2303', 'received', source.source_reference, source.created_by
from public.clients c
join public.taxpayer_entities e on e.client_id = c.id
join public.registration_units ru on ru.taxpayer_entity_id = e.id
join lateral (
  select s.source_reference, s.created_by
  from public.registration_source_references s
  where s.registration_unit_id = ru.id
  order by s.created_at desc
  limit 1
) source on true
where c.reference_code in ('CLIENT-CH-MEDIA', 'CLIENT-SISTEMA-ELECTRIC', 'CLIENT-SQUARE-ONE', 'CLIENT-EC-PAY')
on conflict (registration_unit_id, item_type) do nothing;
