-- Contract Repository foundation.
-- Commercial contract records evidence the TMF relationship and service scope;
-- they do not replace Tax Profiles, Compliance Universes, or obligations.

create table if not exists public.contract_repositories (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  reference_code text not null unique,
  status text not null default 'setup_pending' check (status in ('active', 'setup_pending', 'closed')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.master_engagements (
  id uuid primary key default gen_random_uuid(),
  contract_repository_id uuid not null unique references public.contract_repositories(id) on delete cascade,
  reference_code text not null unique,
  title text not null,
  status text not null default 'pending_review' check (status in ('active', 'pending_review', 'closed')),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint master_engagement_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.master_engagement_documents (
  id uuid primary key default gen_random_uuid(),
  master_engagement_id uuid not null references public.master_engagements(id) on delete cascade,
  document_kind text not null check (document_kind in ('msa', 'lsa', 'addendum')),
  reference_code text not null unique,
  title text not null,
  status text not null default 'pending_review' check (status in ('active', 'pending_review', 'closed')),
  effective_from date not null,
  effective_to date,
  source_reference text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint master_engagement_document_dates_check check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.additional_engagements (
  id uuid primary key default gen_random_uuid(),
  contract_repository_id uuid not null references public.contract_repositories(id) on delete cascade,
  engagement_kind text not null check (engagement_kind in ('change_request_form')),
  reference_code text not null unique,
  title text not null,
  status text not null default 'pending_review' check (status in ('active', 'pending_review', 'closed')),
  effective_from date not null,
  effective_to date,
  source_reference text not null,
  scope_summary text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint additional_engagement_dates_check check (effective_to is null or effective_to >= effective_from)
);

create index if not exists master_engagement_documents_master_idx
  on public.master_engagement_documents(master_engagement_id, effective_from desc);
create index if not exists additional_engagements_repository_idx
  on public.additional_engagements(contract_repository_id, effective_from desc);

-- Existing clients receive an empty repository container without inventing a
-- master engagement or contract document.
insert into public.contract_repositories (client_id, reference_code, status)
select client.id, 'CONTRACT-REPO-' || client.reference_code,
  case when client.status = 'inactive' then 'closed' else 'setup_pending' end
from public.clients client
on conflict (client_id) do nothing;

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

  return jsonb_build_object(
    'clientId', created_client.id,
    'contractRepositoryId', created_repository.id,
    'taxpayerEntityId', created_entity.id,
    'registrationUnitId', created_unit.id,
    'setupStatus', 'setup_pending'
  );
end;
$$;

create or replace function public.can_view_contract_repository(target_repository uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.contract_repositories repository
    where repository.id = target_repository
      and public.can_view_client(repository.client_id)
  );
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
  return created_engagement;
end;
$$;

revoke execute on function public.can_view_contract_repository(uuid) from public;
revoke execute on function public.create_contract_repository(uuid, text) from public;
revoke execute on function public.create_additional_engagement(uuid, text, text, text, date, text, text) from public;
grant execute on function public.can_view_contract_repository(uuid) to authenticated;
grant execute on function public.create_contract_repository(uuid, text) to authenticated;
grant execute on function public.create_additional_engagement(uuid, text, text, text, date, text, text) to authenticated;

alter table public.contract_repositories enable row level security;
alter table public.master_engagements enable row level security;
alter table public.master_engagement_documents enable row level security;
alter table public.additional_engagements enable row level security;

create policy contract_repositories_scoped_read on public.contract_repositories
  for select to authenticated using (public.can_view_contract_repository(id));

create policy master_engagements_scoped_read on public.master_engagements
  for select to authenticated using (public.can_view_contract_repository(contract_repository_id));

create policy master_engagement_documents_scoped_read on public.master_engagement_documents
  for select to authenticated using (
    exists (
      select 1 from public.master_engagements master
      where master.id = master_engagement_id
        and public.can_view_contract_repository(master.contract_repository_id)
    )
  );

create policy additional_engagements_scoped_read on public.additional_engagements
  for select to authenticated using (public.can_view_contract_repository(contract_repository_id));

-- Direct writes remain absent. Contract mutations use capability-checked
-- commands so source references and actor history stay attributable.
