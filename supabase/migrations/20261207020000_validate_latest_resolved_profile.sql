-- Validate only the latest Tax Profile version, and only when every
-- accountable role resolves to one current active person.
--
-- A validator could activate a version another person had already replaced,
-- and a profile whose assignee labels matched no (or more than one) user could
-- become active with no accountable owner for generated work.

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
  resolved_user_id uuid;
  resolved_user_ids uuid[] := '{}';
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
  -- Only the latest saved version may become active; a stale page cannot
  -- activate facts that a later save already replaced.
  if exists (
    select 1 from public.tax_profile_versions newer
    where newer.registration_unit_id = candidate.registration_unit_id
      and newer.version_number > candidate.version_number
  ) then
    raise exception using errcode = '40001', message = 'A newer Tax Profile version exists; reload and validate the latest version.';
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

  -- Every accountable role needs one current, uniquely resolved active person,
  -- and the three people must differ; a label alone is not an owner.
  foreach required_key in array array['preparer', 'checker', 'reviewer'] loop
    select assignment.user_id into resolved_user_id
    from public.registration_unit_team_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id and app_user.is_active
    join public.team_member_profiles member on member.user_id = assignment.user_id
      and member.active
      and member.effective_from <= current_date
      and (member.effective_to is null or member.effective_to >= current_date)
    where assignment.registration_unit_id = candidate.registration_unit_id
      and assignment.assignment_role = required_key
      and assignment.effective_to is null
    order by assignment.effective_from desc, assignment.assigned_at desc
    limit 1;
    if resolved_user_id is null then
      missing_keys := array_append(missing_keys, required_key || ' (no uniquely resolved active person)');
    else
      resolved_user_ids := array_append(resolved_user_ids, resolved_user_id);
    end if;
    resolved_user_id := null;
  end loop;
  if cardinality(resolved_user_ids) = 3
     and (select count(distinct person) from unnest(resolved_user_ids) person) <> 3 then
    missing_keys := array_append(missing_keys, 'distinct Preparer, Checker, and Reviewer');
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
