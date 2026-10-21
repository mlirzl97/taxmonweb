-- Keep the onboarding dates and permanent file location in the initial Tax
-- Profile snapshot. The intake already validated and sent go-live date, first
-- period to file, permanent file location, registration date and the selected
-- returns, but the stored profile dropped them. The service calendar starts
-- from the first period to file, so losing it widened the calendar silently.
-- These remain setup context; they do not activate a Tax Profile or create work.

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
  -- A client's operating scope is a Cluster or a Tower; other unit kinds
  -- cannot be resolved as client scope.
  if not exists (
    select 1 from public.organization_units unit
    where unit.id = p_organization_unit_id and unit.active and unit.unit_kind in ('cluster', 'tower')
      and unit.effective_from <= current_date and (unit.effective_to is null or unit.effective_to >= current_date)
      -- A Tower counts only while its parent Cluster is also in effect.
      and (unit.unit_kind = 'cluster' or exists (
        select 1 from public.organization_units cluster_unit
        where cluster_unit.id = unit.parent_id and cluster_unit.unit_kind = 'cluster' and cluster_unit.active
          and cluster_unit.effective_from <= current_date and (cluster_unit.effective_to is null or cluster_unit.effective_to >= current_date)
      ))
  ) then
    raise exception using errcode = '22023', message = 'A client must be placed in a Cluster or Tower that is active and in effect today.';
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
    'booksType', p_profile_data ->> 'booksType',
    'invoicing', p_profile_data ->> 'invoicing',
    'filingChannel', p_profile_data ->> 'filingChannel',
    'eFPSGroup', p_profile_data ->> 'eFPSGroup',
    'enateSetup', p_profile_data ->> 'enateSetup',
    'paymentRoute', p_profile_data ->> 'paymentRoute',
    'registeredTaxTypeCodes', coalesce(p_profile_data -> 'registeredTaxTypeCodes', '[]'::jsonb),
    'registeredTaxTypes', coalesce(p_profile_data -> 'registeredTaxTypes', '[]'::jsonb),
    'registeredTaxTypesRaw', p_profile_data ->> 'registeredTaxTypesRaw',
    'proposedReturnCodes', coalesce(p_profile_data -> 'proposedReturnCodes', '[]'::jsonb),
    'registeredReturnCodes', coalesce(p_profile_data -> 'registeredReturnCodes', p_profile_data -> 'proposedReturnCodes', '[]'::jsonb),
    'registrationEffective', p_profile_data ->> 'registrationEffective',
    'goLiveDate', p_profile_data ->> 'goLiveDate',
    'firstPeriodToFile', p_profile_data ->> 'firstPeriodToFile',
    -- Only a location the caller supplied (and the parser checked) is kept;
    -- the registration source reference is never promoted to the file location.
    'permanentFileLink', nullif(p_profile_data ->> 'permanentFileLink', ''),
    'deadlinePolicy', coalesce(p_profile_data -> 'deadlinePolicy', '{}'::jsonb),
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
      'proposedReturnCodes', coalesce(p_profile_data -> 'proposedReturnCodes', '[]'::jsonb),
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
