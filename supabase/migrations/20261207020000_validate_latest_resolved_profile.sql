-- Validate only the latest Tax Profile version, and only when every
-- accountable role resolves to one current active person.
--
-- A validator could activate a version another person had already replaced,
-- and a profile whose assignee labels matched no (or more than one) user could
-- become active with no accountable owner for generated work.
--
-- A superseded version keeps the validation that once made it active, so a
-- second validation no longer trips the validation-pair check. Superseded
-- versions only ever come from active ones.

alter table public.tax_profile_versions
  drop constraint if exists tax_profile_validation_pair_check;
alter table public.tax_profile_versions
  add constraint tax_profile_validation_pair_check
  check ((state in ('active', 'superseded')) = (validated_at is not null and validated_by is not null));

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
  -- Serialize with saves (the profile trigger takes the same lock), then
  -- re-read the candidate so the checks below see committed saves.
  perform 1 from public.registration_units unit where unit.id = candidate.registration_unit_id for update;
  select * into candidate from public.tax_profile_versions where id = p_tax_profile_version_id;
  -- Authority is rechecked under the lock: a concurrent save may have moved
  -- the Registration Unit out of the caller's scope.
  if not public.can_view_registration_unit(candidate.registration_unit_id) then
    raise exception using errcode = '42501', message = 'The Tax Profile is outside the caller''s authority.';
  end if;
  if candidate.state not in ('ready_for_validation', 'draft') then
    raise exception using errcode = '22023', message = 'Only a profile ready for validation can be activated.';
  end if;
  -- A future-dated version cannot replace the profile in force today.
  if candidate.effective_from > current_date then
    raise exception using errcode = '22023', message = 'This Tax Profile version takes effect on ' || candidate.effective_from || '; validate it on or after that date.';
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
    'firstPeriodToFile', 'cluster', 'tower', 'preparer', 'checker', 'reviewer'
  ] loop
    -- Placeholder values are the absence of a fact, not a fact.
    if lower(coalesce(nullif(trim(coalesce(candidate.profile_data ->> required_key, candidate.assignment_data ->> required_key, '')), ''), 'unassigned'))
       in ('unassigned', 'unresolved', 'needs review', 'not configured') then
      missing_keys := array_append(missing_keys, required_key);
    end if;
  end loop;

  -- The first period to file must be a real calendar month (YYYY-MM, 01-12).
  if nullif(trim(coalesce(candidate.profile_data ->> 'firstPeriodToFile', '')), '') is not null
     and trim(candidate.profile_data ->> 'firstPeriodToFile') !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    missing_keys := array_append(missing_keys, 'firstPeriodToFile (a calendar month, YYYY-MM)');
  end if;

  if jsonb_typeof(candidate.profile_data -> 'assignmentActors') = 'array'
     and jsonb_array_length(candidate.profile_data -> 'assignmentActors') <> 3 then
    missing_keys := array_append(missing_keys, 'distinct assignment actors');
  end if;

  -- Every accountable role needs one current, uniquely resolved active person
  -- whose engagement Team role may hold it, assigned from today or earlier,
  -- and the three people must differ; a label alone is not an owner.
  foreach required_key in array array['preparer', 'checker', 'reviewer'] loop
    select assignment.user_id into resolved_user_id
    from public.registration_unit_team_assignments assignment
    join public.app_users app_user on app_user.id = assignment.user_id and app_user.is_active
    join public.team_member_profiles member on member.user_id = assignment.user_id
      and member.active
      and member.effective_from <= current_date
      and (member.effective_to is null or member.effective_to >= current_date)
      and member.operating_model <> 'tax_team'
      and member.role_key = any (case required_key
        when 'preparer' then array['team_member']
        when 'checker' then array['team_member', 'leader', 'reviewer']
        else array['leader', 'reviewer'] end)
    where assignment.registration_unit_id = candidate.registration_unit_id
      and assignment.assignment_role = required_key
      and assignment.effective_from <= current_date
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

-- The editor and the validate route read "latest" the same way validation
-- does: the highest version number, not the latest effective date.
create or replace function public.get_latest_tax_profile_version(
  p_client_reference_code text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target_client_id uuid;
  latest_profile public.tax_profile_versions;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required to read a Tax Profile.';
  end if;

  select client.id into target_client_id
  from public.clients client
  join public.taxpayer_entities entity on entity.client_id = client.id
  join public.registration_units registration_unit on registration_unit.taxpayer_entity_id = entity.id
  where client.reference_code = p_client_reference_code
    and registration_unit.active = true
    and public.can_view_registration_unit(registration_unit.id)
  limit 1;

  if target_client_id is null then
    return jsonb_build_object('clientFound', false, 'data', null);
  end if;

  select profile.* into latest_profile
  from public.tax_profile_versions profile
  join public.registration_units registration_unit on registration_unit.id = profile.registration_unit_id
  join public.taxpayer_entities entity on entity.id = registration_unit.taxpayer_entity_id
  where entity.client_id = target_client_id
    and registration_unit.active = true
    and public.can_view_registration_unit(registration_unit.id)
  order by profile.version_number desc, profile.created_at desc
  limit 1;

  if latest_profile.id is null then
    return jsonb_build_object('clientFound', true, 'data', null);
  end if;

  return jsonb_build_object(
    'clientFound', true,
    'data', jsonb_build_object(
      'id', latest_profile.id,
      'state', latest_profile.state,
      'effectiveFrom', latest_profile.effective_from,
      'versionNumber', latest_profile.version_number,
      'profile', latest_profile.profile_data,
      'assignment', latest_profile.assignment_data,
      'createdAt', latest_profile.created_at,
      'validatedAt', latest_profile.validated_at,
      'validatedBy', latest_profile.validated_by,
      'changeReason', latest_profile.change_reason
    )
  );
end;
$$;

-- Separation is between people, not names: two staff may share a display
-- name. Each role is identified by its Team user id when the profile carries
-- one, and by its label only when it does not.
create or replace function public.enforce_tax_profile_assignment_separation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  preparer text;
  checker text;
  reviewer text;
  preparer_key text;
  checker_key text;
  reviewer_key text;
begin
  if new.state = 'active' then
    preparer := nullif(trim(new.assignment_data ->> 'preparer'), '');
    checker := nullif(trim(new.assignment_data ->> 'checker'), '');
    reviewer := nullif(trim(new.assignment_data ->> 'reviewer'), '');
    preparer_key := coalesce('id:' || nullif(trim(new.assignment_data ->> 'preparerUserId'), ''), 'label:' || lower(preparer));
    checker_key := coalesce('id:' || nullif(trim(new.assignment_data ->> 'checkerUserId'), ''), 'label:' || lower(checker));
    reviewer_key := coalesce('id:' || nullif(trim(new.assignment_data ->> 'reviewerUserId'), ''), 'label:' || lower(reviewer));
    if preparer is null or checker is null or reviewer is null
       or lower(preparer) in ('unassigned', 'not configured')
       or lower(checker) in ('unassigned', 'not configured')
       or lower(reviewer) in ('unassigned', 'not configured')
       or preparer_key = checker_key
       or preparer_key = reviewer_key
       or checker_key = reviewer_key then
      raise exception using errcode = '22023', message = 'An active Tax Profile requires distinct Preparer, Checker, and Reviewer actors.';
    end if;
  end if;
  return new;
end;
$$;
