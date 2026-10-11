-- Complete the audit boundary for existing state-changing commands.
-- This migration does not create new domain objects. It makes the existing
-- command functions append an actor-attributed, transactionally consistent
-- audit event after each real state change.

create or replace function public.append_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_summary text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_effective_at timestamptz default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  created_event_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required to append an audit event.';
  end if;

  if nullif(trim(p_action), '') is null
     or nullif(trim(p_entity_type), '') is null
     or nullif(trim(p_entity_id), '') is null
     or nullif(trim(p_summary), '') is null then
    raise exception using errcode = '22023', message = 'Audit event identity and summary are required.';
  end if;

  insert into public.audit_events (
    actor_id,
    actor_display,
    actor_type,
    action,
    entity_type,
    entity_id,
    summary,
    before_state,
    after_state,
    reason,
    effective_at,
    correlation_id
  ) values (
    auth.uid(),
    coalesce((select display_name from public.app_users where id = auth.uid()), 'Authenticated user'),
    'user',
    trim(p_action),
    trim(p_entity_type),
    trim(p_entity_id),
    trim(p_summary),
    p_before_state,
    p_after_state,
    nullif(trim(p_reason), ''),
    p_effective_at,
    p_correlation_id
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

revoke execute on function public.append_audit_event(text, text, text, text, jsonb, jsonb, text, timestamptz, uuid) from public;

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
  p_source_notes text
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

  if p_organization_unit_id is not null then
    insert into public.registration_unit_scope_assignments (registration_unit_id, organization_unit_id, assigned_by, reason)
    values (created_unit.id, p_organization_unit_id, auth.uid(), 'Manual client repository setup');
  end if;

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
  );

  perform public.append_audit_event(
    'client_setup_created',
    'client',
    created_client.id::text,
    'Client, taxpayer, registration unit, and contract repository created',
    null,
    jsonb_build_object(
      'clientId', created_client.id,
      'taxpayerEntityId', created_entity.id,
      'registrationUnitId', created_unit.id,
      'contractRepositoryId', created_repository.id,
      'setupStatus', created_client.status
    ),
    'Manual client repository setup'
  );

  return jsonb_build_object(
    'clientId', created_client.id,
    'contractRepositoryId', created_repository.id,
    'taxpayerEntityId', created_entity.id,
    'registrationUnitId', created_unit.id,
    'setupStatus', 'setup_pending'
  );
end;
$$;

create or replace function public.create_contract_repository(
  p_client_id uuid,
  p_reference_code text
)
returns public.contract_repositories
language plpgsql
security definer set search_path = public
as $$
declare
  created_repository public.contract_repositories;
begin
  if auth.uid() is null or not public.has_active_capability('MaintainClientRepository') then
    raise exception using errcode = '42501', message = 'Contract repository maintenance is not authorized.';
  end if;
  if not public.can_view_client(p_client_id) then
    raise exception using errcode = '42501', message = 'The client is outside the caller''s authority.';
  end if;
  insert into public.contract_repositories (client_id, reference_code, created_by, updated_by)
  values (p_client_id, trim(p_reference_code), auth.uid(), auth.uid())
  returning * into created_repository;

  perform public.append_audit_event(
    'contract_repository_created',
    'contract_repository',
    created_repository.id::text,
    'Contract repository created',
    null,
    jsonb_build_object('clientId', p_client_id, 'status', created_repository.status),
    'Contract repository setup'
  );

  return created_repository;
end;
$$;

create or replace function public.create_additional_engagement(
  p_contract_repository_id uuid,
  p_engagement_kind text,
  p_reference_code text,
  p_title text,
  p_effective_from date,
  p_source_reference text,
  p_scope_summary text
)
returns public.additional_engagements
language plpgsql
security definer set search_path = public
as $$
declare
  created_engagement public.additional_engagements;
begin
  if auth.uid() is null or not public.has_active_capability('MaintainClientRepository') then
    raise exception using errcode = '42501', message = 'Contract repository maintenance is not authorized.';
  end if;
  if not public.can_view_contract_repository(p_contract_repository_id) then
    raise exception using errcode = '42501', message = 'The contract repository is outside the caller''s authority.';
  end if;
  insert into public.additional_engagements (
    contract_repository_id, engagement_kind, reference_code, title,
    effective_from, source_reference, scope_summary, created_by, updated_by
  ) values (
    p_contract_repository_id, p_engagement_kind, trim(p_reference_code), trim(p_title),
    coalesce(p_effective_from, current_date), trim(p_source_reference), trim(p_scope_summary), auth.uid(), auth.uid()
  ) returning * into created_engagement;

  perform public.append_audit_event(
    'additional_engagement_created',
    'additional_engagement',
    created_engagement.id::text,
    'Additional engagement created',
    null,
    jsonb_build_object(
      'contractRepositoryId', p_contract_repository_id,
      'engagementKind', created_engagement.engagement_kind,
      'effectiveFrom', created_engagement.effective_from,
      'status', created_engagement.status
    ),
    'Additional engagement setup',
    created_engagement.effective_from::timestamptz
  );

  return created_engagement;
end;
$$;

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

  perform public.append_audit_event(
    'tax_profile_version_saved',
    'tax_profile_version',
    saved_profile.id::text,
    'Tax Profile version saved for validation',
    null,
    jsonb_build_object(
      'registrationUnitId', saved_profile.registration_unit_id,
      'versionNumber', saved_profile.version_number,
      'state', saved_profile.state,
      'effectiveFrom', saved_profile.effective_from
    ),
    p_reason,
    saved_profile.effective_from::timestamptz
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

  perform public.append_audit_event(
    'tax_profile_validated',
    'tax_profile_version',
    activated_profile.id::text,
    'Tax Profile validated and activated',
    jsonb_build_object('state', candidate.state, 'versionNumber', candidate.version_number),
    jsonb_build_object('state', activated_profile.state, 'versionNumber', activated_profile.version_number),
    p_reason,
    activated_profile.effective_from::timestamptz
  );

  return activated_profile;
end;
$$;

create or replace function public.create_temporary_2303_document(
  p_registration_unit_id uuid,
  p_source_system text,
  p_source_reference text,
  p_original_filename text,
  p_content_type text,
  p_byte_size integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing_document public.temporary_source_documents;
  created_document public.temporary_source_documents;
begin
  if auth.uid() is null or not public.can_manage_temporary_document(p_registration_unit_id) then
    raise exception using errcode = '42501', message = 'Temporary document upload is not authorized.';
  end if;

  if p_source_system not in ('sharepoint', 'synthetic_fixture', 'manual_reference')
    or p_content_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/tiff')
    or p_byte_size is null or p_byte_size <= 0 or p_byte_size > 15728640
    or nullif(trim(p_source_reference), '') is null
    or nullif(trim(p_original_filename), '') is null
    or length(p_idempotency_key) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'Temporary document metadata is invalid.';
  end if;

  select * into existing_document
  from public.temporary_source_documents
  where created_by = auth.uid() and idempotency_key = p_idempotency_key;

  if existing_document.id is not null then
    if existing_document.registration_unit_id <> p_registration_unit_id then
      raise exception using errcode = '23505', message = 'The idempotency key is already associated with another registration unit.';
    end if;
    if existing_document.status in ('purge_eligible', 'purged') then
      raise exception using errcode = '40901', message = 'The temporary document is no longer available for retry.';
    end if;

    return jsonb_build_object(
      'id', existing_document.id,
      'registrationUnitId', existing_document.registration_unit_id,
      'storageBucket', existing_document.storage_bucket,
      'storagePath', existing_document.storage_path,
      'status', existing_document.status,
      'reused', true
    );
  end if;

  insert into public.temporary_source_documents (
    registration_unit_id,
    source_system,
    source_reference,
    original_filename,
    content_type,
    byte_size,
    storage_path,
    idempotency_key,
    created_by,
    updated_by
  ) values (
    p_registration_unit_id,
    p_source_system,
    trim(p_source_reference),
    trim(p_original_filename),
    p_content_type,
    p_byte_size,
    p_registration_unit_id::text || '/' || gen_random_uuid()::text || '/source',
    p_idempotency_key,
    auth.uid(),
    auth.uid()
  ) returning * into created_document;

  perform public.append_audit_event(
    'temporary_document_created',
    'temporary_source_document',
    created_document.id::text,
    'Temporary 2303 source document record created',
    null,
    jsonb_build_object(
      'registrationUnitId', created_document.registration_unit_id,
      'sourceSystem', created_document.source_system,
      'contentType', created_document.content_type,
      'byteSize', created_document.byte_size,
      'status', created_document.status
    )
  );

  return jsonb_build_object(
    'id', created_document.id,
    'registrationUnitId', created_document.registration_unit_id,
    'storageBucket', created_document.storage_bucket,
    'storagePath', created_document.storage_path,
    'status', created_document.status,
    'reused', false
  );
end;
$$;

create or replace function public.complete_temporary_2303_upload(target_document uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  document_record public.temporary_source_documents;
  was_already_uploaded boolean;
begin
  select * into document_record
  from public.temporary_source_documents
  where id = target_document;

  if document_record.id is null or not public.can_manage_temporary_document(document_record.registration_unit_id) then
    raise exception using errcode = '42501', message = 'Temporary document upload is not authorized.';
  end if;

  was_already_uploaded := document_record.status in ('uploaded', 'processing_queued');

  update public.temporary_source_documents
  set status = case when status in ('uploaded', 'processing_queued') then status else 'uploaded' end,
      failure_code = null,
      uploaded_at = coalesce(uploaded_at, now()),
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_document;

  select * into document_record from public.temporary_source_documents where id = target_document;

  if not was_already_uploaded then
    perform public.append_audit_event(
      'temporary_document_uploaded',
      'temporary_source_document',
      document_record.id::text,
      'Temporary 2303 upload completed',
      jsonb_build_object('status', 'upload_pending'),
      jsonb_build_object('status', document_record.status),
      null,
      document_record.uploaded_at
    );
  end if;

  return jsonb_build_object('id', document_record.id, 'status', document_record.status, 'reused', was_already_uploaded);
end;
$$;

create or replace function public.fail_temporary_2303_upload(target_document uuid, p_failure_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  document_record public.temporary_source_documents;
  previous_status text;
begin
  select * into document_record
  from public.temporary_source_documents
  where id = target_document;

  if document_record.id is null or document_record.created_by <> auth.uid()
    or not public.can_manage_temporary_document(document_record.registration_unit_id) then
    raise exception using errcode = '42501', message = 'Temporary document update is not authorized.';
  end if;

  previous_status := document_record.status;

  update public.temporary_source_documents
  set status = 'failed',
      failure_code = left(coalesce(nullif(trim(p_failure_code), ''), 'upload_failed'), 80),
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_document and status not in ('processing_queued', 'purge_eligible', 'purged');

  select * into document_record from public.temporary_source_documents where id = target_document;

  if previous_status <> document_record.status then
    perform public.append_audit_event(
      'temporary_document_upload_failed',
      'temporary_source_document',
      document_record.id::text,
      'Temporary 2303 upload marked failed',
      jsonb_build_object('status', previous_status),
      jsonb_build_object('status', document_record.status, 'failureCode', document_record.failure_code)
    );
  end if;

  return jsonb_build_object('id', target_document, 'status', document_record.status);
end;
$$;

create or replace function public.queue_temporary_2303_processing(target_document uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  document_record public.temporary_source_documents;
  was_already_queued boolean;
begin
  select * into document_record
  from public.temporary_source_documents
  where id = target_document;

  if document_record.id is null or not public.can_manage_temporary_document(document_record.registration_unit_id) then
    raise exception using errcode = '42501', message = 'Temporary document processing is not authorized.';
  end if;

  if document_record.status not in ('uploaded', 'processing_queued') then
    raise exception using errcode = '22023', message = 'Only an uploaded temporary document can be queued for processing.';
  end if;

  was_already_queued := document_record.status = 'processing_queued';

  update public.temporary_source_documents
  set status = 'processing_queued',
      processing_attempts = processing_attempts + case when document_record.status = 'processing_queued' then 0 else 1 end,
      processing_queued_at = coalesce(processing_queued_at, now()),
      failure_code = null,
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_document;

  select * into document_record from public.temporary_source_documents where id = target_document;

  if not was_already_queued then
    perform public.append_audit_event(
      'temporary_document_processing_queued',
      'temporary_source_document',
      document_record.id::text,
      'Temporary 2303 processing queued',
      jsonb_build_object('status', 'uploaded'),
      jsonb_build_object('status', document_record.status, 'processingAttempts', document_record.processing_attempts),
      null,
      document_record.processing_queued_at
    );
  end if;

  return jsonb_build_object('id', target_document, 'status', document_record.status);
end;
$$;

revoke execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text) from public;
revoke execute on function public.create_contract_repository(uuid, text) from public;
revoke execute on function public.create_additional_engagement(uuid, text, text, text, date, text, text) from public;
revoke execute on function public.save_tax_profile_version(text, jsonb, jsonb, date, text) from public;
revoke execute on function public.validate_tax_profile_version(uuid, text) from public;
revoke execute on function public.create_temporary_2303_document(uuid, text, text, text, text, integer, text) from public;
revoke execute on function public.complete_temporary_2303_upload(uuid) from public;
revoke execute on function public.fail_temporary_2303_upload(uuid, text) from public;
revoke execute on function public.queue_temporary_2303_processing(uuid) from public;

grant execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text) to authenticated;
grant execute on function public.create_contract_repository(uuid, text) to authenticated;
grant execute on function public.create_additional_engagement(uuid, text, text, text, date, text, text) to authenticated;
grant execute on function public.save_tax_profile_version(text, jsonb, jsonb, date, text) to authenticated;
grant execute on function public.validate_tax_profile_version(uuid, text) to authenticated;
grant execute on function public.create_temporary_2303_document(uuid, text, text, text, text, integer, text) to authenticated;
grant execute on function public.complete_temporary_2303_upload(uuid) to authenticated;
grant execute on function public.fail_temporary_2303_upload(uuid, text) to authenticated;
grant execute on function public.queue_temporary_2303_processing(uuid) to authenticated;
