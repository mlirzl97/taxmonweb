-- Persist the registration facts collected by the manual onboarding intake.
-- This extends the existing command without changing the activation boundary:
-- the saved Tax Profile remains ready_for_validation until a human validates it.

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
  p_profile_data jsonb
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
begin
  if auth.uid() is null or not public.has_active_capability('MaintainClientRepository') then
    raise exception using errcode = '42501', message = 'Client repository maintenance is not authorized.';
  end if;

  if not public.can_manage_organization_unit(p_organization_unit_id) then
    raise exception using errcode = '42501', message = 'The selected organizational scope is outside the caller''s authority.';
  end if;

  insert into public.clients (reference_code, display_name, status, created_by, updated_by)
  values (p_client_reference_code, p_client_display_name, 'setup_pending', auth.uid(), auth.uid())
  returning * into created_client;

  insert into public.contract_repositories (client_id, reference_code, status, created_by, updated_by)
  values (created_client.id, 'CONTRACT-REPO-' || created_client.reference_code, 'setup_pending', auth.uid(), auth.uid())
  returning * into created_repository;

  insert into public.taxpayer_entities (client_id, reference_code, display_name, tin, tin_status, created_by, updated_by)
  values (
    created_client.id,
    p_entity_reference_code,
    p_entity_display_name,
    nullif(p_tin, ''),
    case when nullif(p_tin, '') is null then 'unresolved' else 'provided' end,
    auth.uid(),
    auth.uid()
  )
  returning * into created_entity;

  insert into public.registration_units (taxpayer_entity_id, reference_code, display_name, unit_kind, registration_reference, created_by, updated_by)
  values (
    created_entity.id,
    p_unit_reference_code,
    p_unit_display_name,
    p_unit_kind,
    nullif(p_registration_reference, ''),
    auth.uid(),
    auth.uid()
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
    'Client, taxpayer, registration unit, contract repository, and Tax Profile intake created',
    null,
    jsonb_build_object(
      'clientId', created_client.id,
      'taxpayerEntityId', created_entity.id,
      'registrationUnitId', created_unit.id,
      'contractRepositoryId', created_repository.id,
      'taxProfileVersionId', created_profile.id,
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

revoke execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb) from public;
grant execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text, jsonb) to authenticated;
