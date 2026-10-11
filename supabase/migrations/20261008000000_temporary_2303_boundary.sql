-- TaxMonWeb Slice 04: temporary 2303 upload and processing boundary.
-- Binary content is temporary and private. Structured source/provenance facts
-- remain after purge; extraction/provider records belong to the next slice.

create table if not exists public.temporary_source_documents (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  source_kind text not null default 'bir_form_2303' check (source_kind = 'bir_form_2303'),
  source_system text not null check (source_system in ('sharepoint', 'synthetic_fixture', 'manual_reference')),
  source_reference text not null,
  original_filename text not null,
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/tiff')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 15728640),
  storage_bucket text not null default 'taxmon-temporary-2303',
  storage_path text not null unique,
  status text not null default 'upload_pending' check (status in ('upload_pending', 'uploaded', 'processing_queued', 'failed', 'purge_eligible', 'purged')),
  idempotency_key text not null,
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  failure_code text,
  uploaded_at timestamptz,
  processing_queued_at timestamptz,
  purge_eligible_at timestamptz,
  purged_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint temporary_source_documents_idempotency_key_check check (length(idempotency_key) between 8 and 128),
  constraint temporary_source_documents_purge_state_check check (
    (status <> 'purged' or purged_at is not null)
    and (status <> 'purge_eligible' or purge_eligible_at is not null)
  ),
  constraint temporary_source_documents_upload_state_check check (
    (status not in ('uploaded', 'processing_queued') or uploaded_at is not null)
  )
);

create unique index if not exists temporary_source_documents_idempotency_idx
  on public.temporary_source_documents(created_by, idempotency_key);

create index if not exists temporary_source_documents_unit_idx
  on public.temporary_source_documents(registration_unit_id, created_at desc);

create index if not exists temporary_source_documents_lifecycle_idx
  on public.temporary_source_documents(status, purge_eligible_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taxmon-temporary-2303',
  'taxmon-temporary-2303',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_temporary_document(target_registration_unit uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.can_view_registration_unit(target_registration_unit)
    and (
      public.has_active_capability('ReviewTaxProfile')
      or public.has_active_capability('CorrectTaxProfile')
      or public.has_active_capability('MaintainClientRepository')
    );
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
  )
  values (
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
  )
  returning * into created_document;

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
begin
  select * into document_record
  from public.temporary_source_documents
  where id = target_document;

  if document_record.id is null or document_record.created_by <> auth.uid()
    or not public.can_manage_temporary_document(document_record.registration_unit_id) then
    raise exception using errcode = '42501', message = 'Temporary document update is not authorized.';
  end if;

  update public.temporary_source_documents
  set status = 'failed',
      failure_code = left(coalesce(nullif(trim(p_failure_code), ''), 'upload_failed'), 80),
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_document and status not in ('processing_queued', 'purge_eligible', 'purged');

  return jsonb_build_object('id', target_document, 'status', 'failed');
end;
$$;

create or replace function public.queue_temporary_2303_processing(target_document uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  document_record public.temporary_source_documents;
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

  update public.temporary_source_documents
  set status = 'processing_queued',
      processing_attempts = processing_attempts + case when document_record.status = 'processing_queued' then 0 else 1 end,
      processing_queued_at = coalesce(processing_queued_at, now()),
      failure_code = null,
      updated_at = now(),
      updated_by = auth.uid()
  where id = target_document;

  return jsonb_build_object('id', target_document, 'status', 'processing_queued');
end;
$$;

create or replace function public.can_view_temporary_document_path(target_path text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  registration_unit uuid;
begin
  begin
    registration_unit := split_part(target_path, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.can_view_registration_unit(registration_unit);
end;
$$;

create or replace function public.can_manage_temporary_document_path(target_path text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  registration_unit uuid;
begin
  begin
    registration_unit := split_part(target_path, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.can_manage_temporary_document(registration_unit);
end;
$$;

revoke execute on function public.can_manage_temporary_document(uuid) from public;
revoke execute on function public.create_temporary_2303_document(uuid, text, text, text, text, integer, text) from public;
revoke execute on function public.complete_temporary_2303_upload(uuid) from public;
revoke execute on function public.fail_temporary_2303_upload(uuid, text) from public;
revoke execute on function public.queue_temporary_2303_processing(uuid) from public;
revoke execute on function public.can_view_temporary_document_path(text) from public;
revoke execute on function public.can_manage_temporary_document_path(text) from public;
grant execute on function public.can_manage_temporary_document(uuid) to authenticated;
grant execute on function public.create_temporary_2303_document(uuid, text, text, text, text, integer, text) to authenticated;
grant execute on function public.complete_temporary_2303_upload(uuid) to authenticated;
grant execute on function public.fail_temporary_2303_upload(uuid, text) to authenticated;
grant execute on function public.queue_temporary_2303_processing(uuid) to authenticated;
grant execute on function public.can_view_temporary_document_path(text) to authenticated;
grant execute on function public.can_manage_temporary_document_path(text) to authenticated;

alter table public.temporary_source_documents enable row level security;

create policy temporary_documents_scoped_read on public.temporary_source_documents
  for select to authenticated
  using (public.can_view_registration_unit(registration_unit_id));

-- No direct table writes. The command functions above enforce capability,
-- registration-unit visibility, actor identity, and lifecycle transitions.

create policy taxmon_temporary_2303_read on storage.objects
  for select to authenticated
  using (bucket_id = 'taxmon-temporary-2303' and public.can_view_temporary_document_path(name));

create policy taxmon_temporary_2303_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'taxmon-temporary-2303' and public.can_manage_temporary_document_path(name));

create policy taxmon_temporary_2303_update on storage.objects
  for update to authenticated
  using (bucket_id = 'taxmon-temporary-2303' and public.can_manage_temporary_document_path(name))
  with check (bucket_id = 'taxmon-temporary-2303' and public.can_manage_temporary_document_path(name));

create policy taxmon_temporary_2303_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'taxmon-temporary-2303' and public.can_manage_temporary_document_path(name));
