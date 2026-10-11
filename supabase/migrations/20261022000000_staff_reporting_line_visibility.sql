-- Staff visibility boundary.
--
-- own_assigned_work means the signed-in staff member's assigned taxpayers and
-- work. Team visibility is limited to the member and effective management
-- context above them. Downline people are not implicitly visible: reporting
-- context is not authority to inspect subordinate personnel. HOD/Tax Control/
-- Super Admin continue to use their existing broader effective scopes.

create or replace function public.can_view_team_member(target_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  with recursive
  visible_units as (
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
  ),
  ancestors(user_id) as (
    select auth.uid()
    union
    select profile.reports_to_user_id
    from public.team_member_profiles profile
    join ancestors line on line.user_id = profile.user_id
    where profile.reports_to_user_id is not null
      and profile.effective_from <= current_date
      and (profile.effective_to is null or profile.effective_to >= current_date)
  ),
  reporting_line(user_id) as (
    select user_id from ancestors
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
      or (
        exists (
          select 1
          from public.user_scope_assignments own_scope
          where own_scope.user_id = auth.uid()
            and own_scope.scope_kind = 'own_assigned_work'
            and own_scope.effective_from <= current_date
            and (own_scope.effective_to is null or own_scope.effective_to >= current_date)
        )
        and target_user in (select user_id from reporting_line)
      )
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
      exists (
        select 1
        from public.registration_unit_scope_assignments registration_scope
        where registration_scope.registration_unit_id = target_registration_unit
          and registration_scope.effective_from <= current_date
          and (registration_scope.effective_to is null or registration_scope.effective_to >= current_date)
          and (
            registration_scope.organization_unit_id in (select id from visible_units)
            or exists (
              select 1
              from public.user_scope_assignments scope
              where scope.user_id = auth.uid()
                and scope.scope_kind in ('cross_portfolio_tax_control', 'all_a_and_t')
                and scope.effective_from <= current_date
                and (scope.effective_to is null or scope.effective_to >= current_date)
            )
          )
      )
      or exists (
        select 1
        from public.registration_unit_team_assignments assignment
        where assignment.registration_unit_id = target_registration_unit
          and assignment.user_id = auth.uid()
          and assignment.effective_from <= current_date
          and (assignment.effective_to is null or assignment.effective_to >= current_date)
      )
      or exists (
        select 1
        from public.registration_units unit
        join public.taxpayer_entities entity on entity.id = unit.taxpayer_entity_id
        join public.client_team_assignments assignment on assignment.client_id = entity.client_id
        where unit.id = target_registration_unit
          and assignment.user_id = auth.uid()
          and assignment.effective_from <= current_date
          and (assignment.effective_to is null or assignment.effective_to >= current_date)
      )
    );
$$;

revoke execute on function public.can_view_team_member(uuid) from public;
revoke execute on function public.can_view_registration_unit(uuid) from public;
grant execute on function public.can_view_team_member(uuid) to authenticated;
grant execute on function public.can_view_registration_unit(uuid) to authenticated;

comment on function public.can_view_team_member(uuid) is
  'Staff see their own seat and effective management context only; broader visibility requires effective organizational scope/capability.';
comment on function public.can_view_registration_unit(uuid) is
  'Staff see registration units for their own effective client or registration-unit assignments; broader scope remains capability-controlled.';
