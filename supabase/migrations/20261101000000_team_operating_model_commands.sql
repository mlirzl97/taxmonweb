-- Team operating model and structure command boundary.
-- Operating model is organizational data, not an RBAC capability. Reporting
-- exceptions require a reason and remain visible in the audit trail.

alter table public.team_member_profiles
  add column if not exists operating_model text not null default 'engagement_agile',
  add column if not exists reporting_line_exception_reason text;

do $$
begin
  alter table public.team_member_profiles
    add constraint team_member_profiles_operating_model_check
    check (operating_model in ('engagement_agile', 'engagement_dedicated', 'tax_team'));
exception
  when duplicate_object then null;
end $$;

create index if not exists team_member_profiles_operating_model_idx
  on public.team_member_profiles(operating_model, active, effective_from, effective_to);

comment on column public.team_member_profiles.operating_model is
  'Effective operating model: engagement_agile, engagement_dedicated, or tax_team; separate from RBAC capability.';
comment on column public.team_member_profiles.reporting_line_exception_reason is
  'Required when the person reports outside the standard career-level ladder; retained for accountable review.';

create or replace function public.save_team_member_profile(
  p_user_id uuid,
  p_role_key text,
  p_title text,
  p_organization_unit_id uuid,
  p_effective_from date,
  p_active boolean,
  p_career_service_level text,
  p_reports_to_user_id uuid,
  p_operating_model text,
  p_reporting_line_exception_reason text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  before_profile public.team_member_profiles;
  after_profile public.team_member_profiles;
  parent_level text;
  expected_manager_level text;
  normalized_exception_reason text;
begin
  if auth.uid() is null
     or not (public.has_active_capability('AdministerUsers') or public.has_active_capability('AdministerOrganization')) then
    raise exception using errcode = '42501', message = 'Team structure maintenance is not authorized.';
  end if;

  if not exists (select 1 from public.app_users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'The selected Team member does not exist.';
  end if;

  if p_reports_to_user_id = p_user_id then
    raise exception using errcode = '22023', message = 'A Team member cannot report to themselves.';
  end if;

  if not public.can_manage_organization_unit(p_organization_unit_id) then
    raise exception using errcode = '42501', message = 'The selected organizational scope is outside the caller''s authority.';
  end if;

  if p_reports_to_user_id is not null then
    select profile.career_service_level
      into parent_level
      from public.team_member_profiles profile
     where profile.user_id = p_reports_to_user_id
       and profile.active = true
       and profile.effective_from <= p_effective_from
       and (profile.effective_to is null or profile.effective_to >= p_effective_from);
    if not found then
      raise exception using errcode = '22023', message = 'The selected reporting manager is not active for the effective date.';
    end if;
  end if;

  expected_manager_level := case p_career_service_level
    when '5.1' then '5.2'
    when '4.2' then '5.1'
    when '4.1' then '4.2'
    when '3.2' then '4.1'
    when '3.1' then '3.2'
    when '2.2' then '3.1'
    when '2.1' then '3.1'
    else null
  end;

  if expected_manager_level is not null
     and parent_level is distinct from expected_manager_level then
    normalized_exception_reason := nullif(trim(coalesce(p_reporting_line_exception_reason, '')), '');
    if normalized_exception_reason is null then
      raise exception using errcode = '22023', message = format('%s people must report to a %s manager or provide a reporting-line exception reason.', p_career_service_level, expected_manager_level);
    end if;
  else
    normalized_exception_reason := null;
  end if;

  select * into before_profile
    from public.team_member_profiles
   where user_id = p_user_id;

  insert into public.team_member_profiles (
    user_id, role_key, title, organization_unit_id, effective_from, active,
    career_service_level, reports_to_user_id, operating_model,
    reporting_line_exception_reason, created_by, updated_by
  ) values (
    p_user_id, p_role_key, trim(p_title), p_organization_unit_id, p_effective_from, p_active,
    p_career_service_level, p_reports_to_user_id, p_operating_model,
    normalized_exception_reason, coalesce(before_profile.created_by, auth.uid()), auth.uid()
  )
  on conflict (user_id) do update set
    role_key = excluded.role_key,
    title = excluded.title,
    organization_unit_id = excluded.organization_unit_id,
    effective_from = excluded.effective_from,
    active = excluded.active,
    career_service_level = excluded.career_service_level,
    reports_to_user_id = excluded.reports_to_user_id,
    operating_model = excluded.operating_model,
    reporting_line_exception_reason = excluded.reporting_line_exception_reason,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into after_profile;

  perform public.append_audit_event(
    'team_member_profile.updated',
    'team_member_profile',
    p_user_id::text,
    'Team member structure and operating model updated.',
    case when before_profile.user_id is null then null else to_jsonb(before_profile) end,
    to_jsonb(after_profile),
    normalized_exception_reason,
    p_effective_from::timestamptz,
    null
  );

  return jsonb_build_object(
    'userId', after_profile.user_id,
    'roleKey', after_profile.role_key,
    'title', after_profile.title,
    'organizationUnitId', after_profile.organization_unit_id,
    'effectiveFrom', after_profile.effective_from,
    'active', after_profile.active,
    'careerServiceLevel', after_profile.career_service_level,
    'reportsToUserId', after_profile.reports_to_user_id,
    'operatingModel', after_profile.operating_model,
    'reportingLineExceptionReason', after_profile.reporting_line_exception_reason
  );
end;
$$;

revoke execute on function public.save_team_member_profile(uuid, text, text, uuid, date, boolean, text, uuid, text, text) from public;
grant execute on function public.save_team_member_profile(uuid, text, text, uuid, date, boolean, text, uuid, text, text) to authenticated;

comment on function public.save_team_member_profile(uuid, text, text, uuid, date, boolean, text, uuid, text, text) is
  'Authorized Team command for people structure and operating model; standard reporting ladder is enforced unless a reasoned exception is supplied and audited.';
