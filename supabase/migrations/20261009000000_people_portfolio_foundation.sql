-- TaxMonWeb People & Portfolio Foundation.
-- Coarse operational roles and client assignments are a simple first layer;
-- capabilities, scope, actor history, and SoD remain authoritative controls.

create table if not exists public.team_member_profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  role_key text not null check (role_key in ('system_admin', 'leader', 'team_member', 'reviewer')),
  title text not null,
  organization_unit_id uuid not null references public.organization_units(id),
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint team_member_profile_dates_check check (effective_to is null or effective_to >= effective_from)
);

create index if not exists team_member_profiles_org_idx
  on public.team_member_profiles(organization_unit_id, effective_from, effective_to);

create table if not exists public.client_team_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  assignment_role text not null check (assignment_role in ('portfolio_owner', 'preparer', 'checker', 'reviewer')),
  effective_from date not null default current_date,
  effective_to date,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  reason text not null,
  constraint client_team_assignment_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint client_team_assignment_key unique (client_id, user_id, assignment_role, effective_from)
);

create index if not exists client_team_assignments_client_idx
  on public.client_team_assignments(client_id, effective_from, effective_to);
create index if not exists client_team_assignments_user_idx
  on public.client_team_assignments(user_id, effective_from, effective_to);

create or replace function public.can_view_team_member(target_user uuid)
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
    and (
      target_user = auth.uid()
      or public.has_active_capability('AdministerUsers')
      or exists (
        select 1
        from public.team_member_profiles profile
          where profile.user_id = target_user
          and profile.organization_unit_id in (select id from visible_units)
          and profile.effective_from <= current_date
          and (profile.effective_to is null or profile.effective_to >= current_date)
      )
    );
$$;

create or replace function public.can_view_client_team_assignment(target_client uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.can_view_client(target_client)
    and (
      public.has_active_capability('ViewScopedPortfolio')
      or public.has_active_capability('AdministerOrganization')
      or exists (
        select 1
        from public.client_team_assignments assignment
        where assignment.client_id = target_client
          and assignment.user_id = auth.uid()
          and assignment.effective_from <= current_date
          and (assignment.effective_to is null or assignment.effective_to >= current_date)
      )
    );
$$;

revoke execute on function public.can_view_team_member(uuid) from public;
revoke execute on function public.can_view_client_team_assignment(uuid) from public;
grant execute on function public.can_view_team_member(uuid) to authenticated;
grant execute on function public.can_view_client_team_assignment(uuid) to authenticated;

alter table public.team_member_profiles enable row level security;
alter table public.client_team_assignments enable row level security;

create policy team_member_profiles_scoped_read on public.team_member_profiles
  for select to authenticated using (public.can_view_team_member(user_id));

create policy client_team_assignments_scoped_read on public.client_team_assignments
  for select to authenticated using (public.can_view_client_team_assignment(client_id));

-- Writes remain command-only. The first usable slice is read-oriented; a later
-- setup command will require AdministerUsers/AdministerOrganization and audit
-- the effective-dated change.
