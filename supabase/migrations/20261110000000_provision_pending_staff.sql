-- Controlled staff setup command.
-- Auth user creation happens server-side; this command atomically attaches the
-- pending TaxMonWeb profile, capability bundle, and effective scope.

create or replace function public.provision_pending_staff(
  p_user_id uuid,
  p_display_name text,
  p_access_profile text,
  p_role_key text,
  p_title text,
  p_organization_unit_id uuid,
  p_effective_from date,
  p_career_service_level text,
  p_reports_to_user_id uuid,
  p_operating_model text,
  p_reporting_line_exception_reason text,
  p_capability_keys text[],
  p_scope_kind text,
  p_scope_organization_unit_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  existing_user public.app_users;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  capability_key text;
begin
  if auth.uid() is null or not public.has_active_capability('AdministerUsers') then
    raise exception using errcode = '42501', message = 'Staff provisioning is not authorized.';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'A reason is required for staff provisioning.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'The Auth identity does not exist.';
  end if;

  select * into existing_user from public.app_users where id = p_user_id for update;
  if found and existing_user.account_status <> 'pending' then
    raise exception using errcode = '23505', message = 'This Auth identity already has a non-pending TaxMonWeb account.';
  end if;

  if p_access_profile not in ('VIEWER', 'STAFF', 'TEAM_LEAD', 'SYSTEM_USER_ADMIN', 'HOD_MASTER_ADMIN') then
    raise exception using errcode = '22023', message = 'The selected access profile is not supported.';
  end if;

  if p_role_key not in ('system_admin', 'leader', 'team_member', 'reviewer') then
    raise exception using errcode = '22023', message = 'The selected operating role is not supported.';
  end if;

  if p_operating_model not in ('engagement_agile', 'engagement_dedicated', 'tax_team') then
    raise exception using errcode = '22023', message = 'The selected operating model is not supported.';
  end if;

  if p_scope_kind not in ('own_assigned_work', 'team_tower', 'cluster', 'cross_portfolio_tax_control', 'all_a_and_t') then
    raise exception using errcode = '22023', message = 'The selected access scope is not supported.';
  end if;

  if p_scope_kind in ('team_tower', 'cluster') and p_scope_organization_unit_id is null then
    raise exception using errcode = '22023', message = 'A tower or cluster scope requires an organization unit.';
  end if;

  if p_scope_kind not in ('team_tower', 'cluster') and p_scope_organization_unit_id is not null then
    raise exception using errcode = '22023', message = 'This access scope must not include an organization unit.';
  end if;

  if p_scope_kind in ('cross_portfolio_tax_control', 'all_a_and_t')
     and not public.has_active_capability('ValidateTaxProfile') then
    raise exception using errcode = '42501', message = 'Cross-portfolio access requires approved Tax Control authority.';
  end if;

  if p_scope_organization_unit_id is not null and not public.can_manage_organization_unit(p_scope_organization_unit_id) then
    raise exception using errcode = '42501', message = 'The selected access scope is outside the caller''s authority.';
  end if;

  insert into public.app_users (id, display_name, is_active, account_status, activation_sent_at)
  values (p_user_id, trim(p_display_name), false, 'pending', now())
  on conflict (id) do update set
    display_name = excluded.display_name,
    is_active = false,
    account_status = 'pending',
    activation_sent_at = coalesce(public.app_users.activation_sent_at, excluded.activation_sent_at),
    updated_at = now();

  perform public.save_team_member_profile(
    p_user_id,
    p_role_key,
    p_title,
    p_organization_unit_id,
    p_effective_from,
    false,
    p_career_service_level,
    p_reports_to_user_id,
    p_operating_model,
    p_reporting_line_exception_reason
  );

  if p_capability_keys is null or coalesce(array_length(p_capability_keys, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'At least one access capability is required.';
  end if;

  foreach capability_key in array p_capability_keys loop
    if not exists (select 1 from public.capabilities where key = capability_key and active = true) then
      raise exception using errcode = '22023', message = 'The selected access profile contains an unsupported capability.';
    end if;
    insert into public.user_capability_assignments (
      user_id, capability_key, effective_from, assigned_by, reason
    ) values (
      p_user_id, capability_key, p_effective_from, auth.uid(), normalized_reason
    ) on conflict (user_id, capability_key, effective_from) do nothing;
  end loop;

  insert into public.user_scope_assignments (
    user_id, scope_kind, organization_unit_id, effective_from, assigned_by, reason
  ) values (
    p_user_id, p_scope_kind, p_scope_organization_unit_id, p_effective_from, auth.uid(), normalized_reason
  );

  perform public.append_audit_event(
    'staff_account.provisioned',
    'app_user',
    p_user_id::text,
    'Pending staff account, Team profile, access bundle, and scope provisioned.',
    null,
    jsonb_build_object(
      'displayName', trim(p_display_name),
      'accessProfile', p_access_profile,
      'roleKey', p_role_key,
      'scopeKind', p_scope_kind,
      'scopeOrganizationUnitId', p_scope_organization_unit_id,
      'effectiveFrom', p_effective_from
    ),
    normalized_reason,
    p_effective_from::timestamptz,
    null
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'status', 'pending',
    'accessProfile', p_access_profile,
    'scopeKind', p_scope_kind
  );
end;
$$;

revoke execute on function public.provision_pending_staff(uuid, text, text, text, text, uuid, date, text, uuid, text, text, text[], text, uuid, text) from public;
grant execute on function public.provision_pending_staff(uuid, text, text, text, text, uuid, date, text, uuid, text, text, text[], text, uuid, text) to authenticated;

comment on function public.provision_pending_staff(uuid, text, text, text, text, uuid, date, text, uuid, text, text, text[], text, uuid, text) is
  'Authorized pending staff setup. Authentication activation remains a separate employee-controlled step.';
