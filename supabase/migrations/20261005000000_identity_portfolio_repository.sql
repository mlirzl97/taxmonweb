-- TaxMonWeb backend foundation: identity, access scope, and client portfolio.
-- This migration does not create Tax Profiles, Expected Compliance, obligations,
-- operational assignments, OCR data, or workflow tables.

create extension if not exists pgcrypto;

create table if not exists public.organization_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit_kind text not null check (unit_kind in ('team', 'tower', 'cluster', 'a_and_t')),
  parent_id uuid references public.organization_units(id),
  active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint organization_units_effective_dates_check check (effective_to is null or effective_to >= effective_from)
);

create index if not exists organization_units_parent_idx on public.organization_units(parent_id);

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.app_users (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.email, 'TaxMonWeb user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create table if not exists public.capabilities (
  key text primary key,
  description text not null,
  active boolean not null default true
);

insert into public.capabilities (key, description)
values
  ('ViewAssignedWork', 'View work assigned to the signed-in actor.'),
  ('ViewScopedPortfolio', 'View portfolio records within authorized organizational scope.'),
  ('ReviewTaxProfile', 'Review registration information and source-derived profile candidates.'),
  ('CorrectTaxProfile', 'Correct registration information during controlled setup.'),
  ('ValidateTaxProfile', 'Validate a Tax Profile where the applicable control permits it.'),
  ('ViewTaxControlHistory', 'View authorized tax-control history and provenance.'),
  ('MaintainClientRepository', 'Create the approved client, taxpayer, and registration-unit setup records.'),
  ('AdministerUsers', 'Administer internal users and access assignments.'),
  ('AdministerOrganization', 'Administer organization structure and scope configuration.')
on conflict (key) do nothing;

create table if not exists public.user_capability_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  capability_key text not null references public.capabilities(key),
  effective_from date not null default current_date,
  effective_to date,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  reason text not null,
  constraint user_capability_assignment_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint user_capability_assignment_key unique (user_id, capability_key, effective_from)
);

create index if not exists user_capability_assignments_user_idx
  on public.user_capability_assignments(user_id, effective_from, effective_to);

create table if not exists public.user_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  scope_kind text not null check (scope_kind in ('own_assigned_work', 'team_tower', 'cluster', 'cross_portfolio_tax_control', 'all_a_and_t')),
  organization_unit_id uuid references public.organization_units(id),
  effective_from date not null default current_date,
  effective_to date,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  reason text not null,
  constraint user_scope_assignment_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint user_scope_assignment_unit_check check (
    (scope_kind in ('team_tower', 'cluster') and organization_unit_id is not null)
    or (scope_kind in ('own_assigned_work', 'cross_portfolio_tax_control', 'all_a_and_t') and organization_unit_id is null)
  )
);

create index if not exists user_scope_assignments_user_idx
  on public.user_scope_assignments(user_id, effective_from, effective_to);

create index if not exists user_scope_assignments_unit_idx
  on public.user_scope_assignments(organization_unit_id, effective_from, effective_to);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'setup_pending')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists clients_status_idx on public.clients(status);

create table if not exists public.taxpayer_entities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  reference_code text not null unique,
  display_name text not null,
  tin text,
  tin_status text not null default 'unresolved' check (tin_status in ('unresolved', 'provided', 'validated')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint taxpayer_entity_tin_status_check check (tin_status = 'unresolved' or nullif(tin, '') is not null)
);

comment on column public.taxpayer_entities.tin is 'Sensitive registration value. Never seed real values in local, preview, or demo environments.';

create index if not exists taxpayer_entities_client_idx on public.taxpayer_entities(client_id);

create table if not exists public.registration_units (
  id uuid primary key default gen_random_uuid(),
  taxpayer_entity_id uuid not null references public.taxpayer_entities(id) on delete restrict,
  reference_code text not null unique,
  display_name text not null,
  unit_kind text not null check (unit_kind in ('head_office', 'branch', 'other')),
  registration_reference text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists registration_units_entity_idx on public.registration_units(taxpayer_entity_id);

-- A taxpayer normally has one active Head Office; branches remain supported.
create unique index if not exists registration_units_one_active_head_office_idx
  on public.registration_units(taxpayer_entity_id)
  where unit_kind = 'head_office' and active = true;

create table if not exists public.registration_unit_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete cascade,
  organization_unit_id uuid not null references public.organization_units(id),
  effective_from date not null default current_date,
  effective_to date,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  reason text not null,
  constraint registration_unit_scope_dates_check check (effective_to is null or effective_to >= effective_from)
);

create index if not exists registration_unit_scope_assignments_unit_idx
  on public.registration_unit_scope_assignments(registration_unit_id, effective_from, effective_to);

create index if not exists registration_unit_scope_assignments_org_idx
  on public.registration_unit_scope_assignments(organization_unit_id, effective_from, effective_to);

create table if not exists public.registration_source_references (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete cascade,
  source_kind text not null check (source_kind in ('bir_form_2303', 'other_registration_source')),
  source_system text not null check (source_system in ('sharepoint', 'synthetic_fixture', 'manual_reference')),
  source_reference text not null,
  document_version text,
  source_recorded_at date,
  status text not null default 'reference_only' check (status in ('reference_only', 'needs_review', 'verified')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists registration_source_references_unit_idx
  on public.registration_source_references(registration_unit_id, source_kind);

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.has_active_capability(required_capability text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_capability_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id and app_user.is_active = true
    where assignment.user_id = auth.uid()
      and assignment.capability_key = required_capability
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
  );
$$;

create or replace function public.can_view_registration_unit(target_registration_unit uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  with recursive visible_units as (
    select organization_unit_id as id
    from public.user_scope_assignments
    where user_id = auth.uid()
      and scope_kind in ('team_tower', 'cluster')
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    union
    select id
    from public.organization_units
    where exists (
      select 1 from public.user_scope_assignments scope
      where scope.user_id = auth.uid()
        and scope.scope_kind in ('cross_portfolio_tax_control', 'all_a_and_t')
        and scope.effective_from <= current_date
        and (scope.effective_to is null or scope.effective_to >= current_date)
    )
    union all
    select child.id
    from public.organization_units child
    join visible_units parent on child.parent_id = parent.id
  )
  select public.is_active_app_user()
    and exists (
      select 1
      from public.registration_unit_scope_assignments registration_scope
      where registration_scope.registration_unit_id = target_registration_unit
        and registration_scope.effective_from <= current_date
        and (registration_scope.effective_to is null or registration_scope.effective_to >= current_date)
        and (
          registration_scope.organization_unit_id in (select id from visible_units)
          or exists (
            select 1 from public.user_scope_assignments scope
            where scope.user_id = auth.uid()
              and scope.scope_kind in ('cross_portfolio_tax_control', 'all_a_and_t')
              and scope.effective_from <= current_date
              and (scope.effective_to is null or scope.effective_to >= current_date)
          )
        )
    );
$$;

create or replace function public.can_manage_organization_unit(target_organization_unit uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  with recursive visible_units as (
    select organization_unit_id as id
    from public.user_scope_assignments
    where user_id = auth.uid()
      and scope_kind in ('team_tower', 'cluster')
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    union
    select id
    from public.organization_units
    where exists (
      select 1
      from public.user_scope_assignments scope
      where scope.user_id = auth.uid()
        and scope.scope_kind in ('cross_portfolio_tax_control', 'all_a_and_t')
        and scope.effective_from <= current_date
        and (scope.effective_to is null or scope.effective_to >= current_date)
    )
    union all
    select child.id
    from public.organization_units child
    join visible_units parent on child.parent_id = parent.id
  )
  select public.is_active_app_user()
    and target_organization_unit is not null
    and exists (
      select 1
      from public.organization_units target
      where target.id = target_organization_unit
        and target.active = true
        and target.id in (select id from visible_units)
    );
$$;

create or replace function public.can_view_client(target_client uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.taxpayer_entities entity
    join public.registration_units registration_unit on registration_unit.taxpayer_entity_id = entity.id
    where entity.client_id = target_client
      and public.can_view_registration_unit(registration_unit.id)
  );
$$;

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
    registration_unit_id,
    source_kind,
    source_system,
    source_reference,
    status,
    notes,
    created_by
  )
  values (
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
    'taxpayerEntityId', created_entity.id,
    'registrationUnitId', created_unit.id,
    'setupStatus', 'setup_pending'
  );
end;
$$;

revoke execute on function public.is_active_app_user() from public;
revoke execute on function public.has_active_capability(text) from public;
revoke execute on function public.can_view_registration_unit(uuid) from public;
revoke execute on function public.can_manage_organization_unit(uuid) from public;
revoke execute on function public.can_view_client(uuid) from public;
revoke execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text) from public;
grant execute on function public.is_active_app_user() to authenticated;
grant execute on function public.has_active_capability(text) to authenticated;
grant execute on function public.can_view_registration_unit(uuid) to authenticated;
grant execute on function public.can_manage_organization_unit(uuid) to authenticated;
grant execute on function public.can_view_client(uuid) to authenticated;
grant execute on function public.create_manual_client_setup(text, text, text, text, text, text, text, text, text, uuid, text, text, text) to authenticated;

alter table public.organization_units enable row level security;
alter table public.app_users enable row level security;
alter table public.capabilities enable row level security;
alter table public.user_capability_assignments enable row level security;
alter table public.user_scope_assignments enable row level security;
alter table public.clients enable row level security;
alter table public.taxpayer_entities enable row level security;
alter table public.registration_units enable row level security;
alter table public.registration_unit_scope_assignments enable row level security;
alter table public.registration_source_references enable row level security;

create policy app_users_self_read on public.app_users
  for select to authenticated using (id = (select auth.uid()) or public.has_active_capability('AdministerUsers'));

create policy organization_units_scoped_read on public.organization_units
  for select to authenticated using (public.is_active_app_user());

create policy capabilities_authenticated_read on public.capabilities
  for select to authenticated using (public.is_active_app_user());

create policy user_capabilities_self_read on public.user_capability_assignments
  for select to authenticated using (user_id = (select auth.uid()) or public.has_active_capability('AdministerUsers'));

create policy user_scopes_self_read on public.user_scope_assignments
  for select to authenticated using (user_id = (select auth.uid()) or public.has_active_capability('AdministerOrganization'));

create policy clients_scoped_read on public.clients
  for select to authenticated using (public.can_view_client(id));

create policy taxpayer_entities_scoped_read on public.taxpayer_entities
  for select to authenticated using (public.can_view_client(client_id));

create policy registration_units_scoped_read on public.registration_units
  for select to authenticated using (public.can_view_registration_unit(id));

create policy registration_unit_scopes_scoped_read on public.registration_unit_scope_assignments
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));

create policy registration_sources_scoped_read on public.registration_source_references
  for select to authenticated using (
    exists (
      select 1 from public.registration_units registration_unit
      where registration_unit.id = registration_unit_id
        and public.can_view_registration_unit(registration_unit.id)
    )
  );

-- Direct table INSERT/UPDATE/DELETE policies are intentionally absent. The
-- manual setup command above is the only V1 write path in this slice and it
-- checks the MaintainClientRepository capability server-side in one transaction.
