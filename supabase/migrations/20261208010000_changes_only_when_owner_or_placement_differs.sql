-- A save that names the owner or placement already in force is no change.
--
-- Codex review of 20261208000000 found two gaps, and a third followed from them:
-- 1. The placeholder fill read the open row. When a handover or scope move was
--    scheduled for a later date, the open row is the future one, so a
--    placeholder save brought the change forward.
-- 2. A label-only owner (no linked account) was not carried over and could
--    still be cleared.
-- 3. The dossier resends the current owners on every save. A save dated before
--    a scheduled handover was treated as a correction and cancelled it, so an
--    unrelated profile edit could silently undo a planned handover.
--
-- Now:
-- - Placeholders are filled from the owner and placement in force on the
--   version's own date, including label-only owners.
-- - A save naming no one, or the person or unit already in force on that date,
--   changes nothing: scheduled changes stay scheduled.
-- - Naming a different person or unit still corrects, schedules or replaces as
--   before.

create or replace function public.canonicalize_tax_profile_assignment_labels()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  role_key text;
  submitted_id text;
  submitted_label text;
  canonical_name text;
  in_force record;
  in_force_unit record;
  placeholders constant text[] := array['', 'unassigned', 'unresolved', 'needs review', 'not configured'];
begin
  if new.assignment_data is null or jsonb_typeof(new.assignment_data) <> 'object' then
    return new;
  end if;
  foreach role_key in array array['preparer', 'checker', 'reviewer'] loop
    submitted_id := new.assignment_data ->> (role_key || 'UserId');
    submitted_label := lower(trim(coalesce(new.assignment_data ->> role_key, '')));
    canonical_name := null;
    if coalesce(submitted_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select app_user.display_name into canonical_name from public.app_users app_user where app_user.id = submitted_id::uuid;
      if canonical_name is not null then
        new.assignment_data := jsonb_set(new.assignment_data, array[role_key], to_jsonb(canonical_name));
      end if;
    elsif submitted_label = any (placeholders) then
      -- A placeholder means "no change": record the owner in force on this
      -- version's date, linked account or label-only.
      select assignment.user_id, coalesce(app_user.display_name, assignment.assignee_label) as label into in_force
      from public.registration_unit_team_assignments assignment
      left join public.app_users app_user on app_user.id = assignment.user_id
      where assignment.registration_unit_id = new.registration_unit_id
        and assignment.assignment_role = role_key
        and assignment.effective_from <= new.effective_from
        and (assignment.effective_to is null or assignment.effective_to >= new.effective_from)
      order by assignment.effective_from desc, assignment.assigned_at desc
      limit 1;
      if found and lower(trim(coalesce(in_force.label, ''))) <> all (placeholders) then
        new.assignment_data := new.assignment_data - (role_key || 'UserId') || jsonb_build_object(role_key, in_force.label);
        if in_force.user_id is not null then
          new.assignment_data := new.assignment_data || jsonb_build_object(role_key || 'UserId', in_force.user_id::text);
        end if;
      end if;
    end if;
  end loop;

  -- Likewise, a placeholder Cluster and Tower keep the placement in force.
  if lower(trim(coalesce(new.assignment_data ->> 'tower', ''))) = any (placeholders)
     and lower(trim(coalesce(new.assignment_data ->> 'cluster', ''))) = any (placeholders) then
    select unit.name, unit.unit_kind, parent_unit.name as parent_name, parent_unit.unit_kind as parent_kind into in_force_unit
    from public.registration_unit_scope_assignments scope
    join public.organization_units unit on unit.id = scope.organization_unit_id
    left join public.organization_units parent_unit on parent_unit.id = unit.parent_id
    where scope.registration_unit_id = new.registration_unit_id
      and scope.effective_from <= new.effective_from
      and (scope.effective_to is null or scope.effective_to >= new.effective_from)
      and unit.unit_kind in ('cluster', 'tower')
    order by scope.effective_from desc, scope.assigned_at desc
    limit 1;
    if found then
      if in_force_unit.unit_kind = 'tower' then
        new.assignment_data := new.assignment_data || jsonb_build_object('tower', in_force_unit.name);
        if in_force_unit.parent_kind = 'cluster' then
          new.assignment_data := new.assignment_data || jsonb_build_object('cluster', in_force_unit.parent_name);
        end if;
      else
        new.assignment_data := new.assignment_data || jsonb_build_object('cluster', in_force_unit.name);
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.canonicalize_tax_profile_assignment_labels() from public, anon, authenticated;

create or replace function public.sync_tax_profile_relational_context()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  office_source_label text;
  channel_source_label text;
  efps_source_label text;
  source_tax_type text;
  source_tax_type_key text;
  resolved_office_id uuid;
  resolved_channel_id uuid;
  resolved_efps_group_id uuid;
  resolved_tax_type_id uuid;
  assignment_role text;
  assignee_label text;
  resolved_user_id uuid;
  current_assignment public.registration_unit_team_assignments;
  team_role text;
  submitted_user_id uuid;
  scope_label text;
  cluster_label text;
  resolved_scope_unit_id uuid;
  current_scope_unit_id uuid;
  current_scope public.registration_unit_scope_assignments;
  in_force_assignment public.registration_unit_team_assignments;
  in_force_scope_unit_id uuid;
  audit_item jsonb;
  audit_status text;
  audit_year text;
  audit_matter text;
begin
  if tg_op = 'UPDATE' and new.profile_data is not distinct from old.profile_data
     and new.assignment_data is not distinct from old.assignment_data then
    return new;
  end if;
  -- Saves and validation for one Registration Unit take the same row lock,
  -- so a validation cannot activate a version that a concurrent save replaces.
  if tg_op = 'INSERT' then
    perform 1 from public.registration_units unit where unit.id = new.registration_unit_id for update;
  end if;

  office_source_label := nullif(trim(coalesce(new.profile_data ->> 'birOfficeCode', new.profile_data ->> 'rdoOrLts', '')), '');
  select office.id into resolved_office_id
  from public.bir_offices office
  where public.normalized_rdo_lookup_key(office.official_code) = public.normalized_rdo_lookup_key(office_source_label)
    and office.status = 'active'
    and office.effective_from <= new.effective_from
    and (office.effective_to is null or office.effective_to >= new.effective_from)
  order by office.effective_from desc
  limit 1;

  insert into public.tax_profile_office_context (
    tax_profile_version_id, bir_office_id, source_label, resolution_status, resolution_note
  ) values (
    new.id, resolved_office_id, office_source_label,
    case when resolved_office_id is null then 'unresolved' else 'resolved' end,
    case when office_source_label is null then 'No BIR office value was supplied.'
         when resolved_office_id is null then 'Profile value did not resolve to an effective canonical BIR office.'
         else null end
  )
  on conflict (tax_profile_version_id) do update set
    bir_office_id = excluded.bir_office_id,
    source_label = excluded.source_label,
    resolution_status = excluded.resolution_status,
    resolution_note = excluded.resolution_note;

  channel_source_label := nullif(trim(coalesce(new.profile_data ->> 'filingChannel', '')), '');
  select channel.id into resolved_channel_id
  from public.filing_channels channel
  where channel.status = 'active'
    and (lower(channel.code) = lower(channel_source_label) or lower(channel.label) = lower(channel_source_label))
    and channel.effective_from <= new.effective_from
    and (channel.effective_to is null or channel.effective_to >= new.effective_from)
  order by channel.effective_from desc
  limit 1;

  efps_source_label := nullif(trim(coalesce(new.profile_data ->> 'efpsGroupCode', new.profile_data ->> 'eFPSGroup', '')), '');
  select group_record.id into resolved_efps_group_id
  from public.efps_groups group_record
  where resolved_channel_id is not null
    and group_record.filing_channel_id = resolved_channel_id
    and group_record.status = 'active'
    and (lower(group_record.code) = lower(efps_source_label) or lower(group_record.label) = lower(efps_source_label))
    and group_record.effective_from <= new.effective_from
    and (group_record.effective_to is null or group_record.effective_to >= new.effective_from)
  order by group_record.effective_from desc
  limit 1;

  insert into public.tax_profile_filing_context (
    tax_profile_version_id, filing_channel_id, efps_group_id,
    filing_channel_source_label, efps_group_source_label,
    channel_resolution_status, efps_group_resolution_status, resolution_note
  ) values (
    new.id, resolved_channel_id, resolved_efps_group_id,
    channel_source_label, efps_source_label,
    case when resolved_channel_id is null then 'unresolved' else 'resolved' end,
    case when efps_source_label is null or lower(channel_source_label) <> 'efps' then 'not_applicable'
         when resolved_efps_group_id is null then 'unresolved' else 'resolved' end,
    case when channel_source_label is not null and resolved_channel_id is null then 'Filing channel did not resolve to an effective canonical channel.'
         when efps_source_label is not null and lower(channel_source_label) = 'efps' and resolved_efps_group_id is null then 'eFPS group did not resolve to a governed effective group.'
         else null end
  )
  on conflict (tax_profile_version_id) do update set
    filing_channel_id = excluded.filing_channel_id,
    efps_group_id = excluded.efps_group_id,
    filing_channel_source_label = excluded.filing_channel_source_label,
    efps_group_source_label = excluded.efps_group_source_label,
    channel_resolution_status = excluded.channel_resolution_status,
    efps_group_resolution_status = excluded.efps_group_resolution_status,
    resolution_note = excluded.resolution_note;

  delete from public.tax_profile_registered_tax_types where tax_profile_version_id = new.id;
  if jsonb_typeof(new.profile_data -> 'registeredTaxTypeCodes') = 'array' then
    for source_tax_type in select jsonb_array_elements_text(new.profile_data -> 'registeredTaxTypeCodes') loop
      source_tax_type_key := upper(trim(source_tax_type));
      select type_record.id into resolved_tax_type_id
      from public.tax_types type_record
      where upper(type_record.code) = source_tax_type_key
        and type_record.status = 'active'
        and type_record.effective_from <= new.effective_from
        and (type_record.effective_to is null or type_record.effective_to >= new.effective_from)
      order by type_record.effective_from desc limit 1;
      insert into public.tax_profile_registered_tax_types (tax_profile_version_id, tax_type_id, source_label, resolution_status, resolution_note)
      values (new.id, resolved_tax_type_id, trim(source_tax_type), case when resolved_tax_type_id is null then 'unresolved' else 'resolved' end,
        case when resolved_tax_type_id is null then 'Tax type code did not resolve to an effective canonical tax type.' else null end);
    end loop;
  elsif jsonb_typeof(new.profile_data -> 'registeredTaxTypes') = 'array' then
    for source_tax_type in select jsonb_array_elements_text(new.profile_data -> 'registeredTaxTypes') loop
      source_tax_type_key := lower(trim(source_tax_type));
      resolved_tax_type_id := null;
      select type_record.id into resolved_tax_type_id
      from public.tax_types type_record
      where type_record.status = 'active'
        and type_record.effective_from <= new.effective_from
        and (type_record.effective_to is null or type_record.effective_to >= new.effective_from)
        and (
          lower(type_record.code) = source_tax_type_key
          or (source_tax_type_key like '%income tax%' and type_record.code = 'CIT')
          or (source_tax_type_key like '%value added%' and type_record.code = 'VAT')
          or (source_tax_type_key like '%percentage tax%' and type_record.code = 'PERCENTAGE_TAX')
          or (source_tax_type_key like '%withholding%' and type_record.code = 'WHT')
        )
      order by type_record.effective_from desc limit 1;
      insert into public.tax_profile_registered_tax_types (tax_profile_version_id, tax_type_id, source_label, resolution_status, resolution_note)
      values (new.id, resolved_tax_type_id, trim(source_tax_type), case when resolved_tax_type_id is null then 'unresolved' else 'resolved' end,
        case when resolved_tax_type_id is null then 'Profile label did not resolve to an effective canonical tax type; human review remains required.' else null end);
    end loop;
  end if;

  if tg_op = 'INSERT' then
    -- One open assignment per role: skip roles that did not change, and close
    -- the previous row before recording a new assignee. "Unassigned" is the
    -- absence of an assignee, not a person.
    foreach assignment_role in array array['preparer', 'checker', 'reviewer'] loop
      team_role := assignment_role;
      assignee_label := nullif(trim(coalesce(new.assignment_data ->> team_role, '')), '');
      if lower(coalesce(assignee_label, '')) in ('unassigned', 'unresolved') then
        assignee_label := null;
      end if;
      -- The submitted Team user id wins. Without one, a label links to a
      -- person only when exactly one eligible user carries it, so an ambiguous
      -- name stays unresolved instead of picking someone. Eligible means an
      -- active account whose engagement Team profile is in effect on the change
      -- date and whose role may hold this assignment (same rule as the picker).
      resolved_user_id := null;
      submitted_user_id := case
        when coalesce(new.assignment_data ->> (team_role || 'UserId'), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (new.assignment_data ->> (team_role || 'UserId'))::uuid
        else null end;
      -- A save names no one, or the person already in the role on the
      -- version's date: nothing changes, and a change scheduled for a later
      -- date stays scheduled. This is decided before eligibility, so an
      -- unrelated edit never fails because the current owner has since
      -- changed role or left the caller's view. Only a different person is a
      -- change, and only a change is checked for eligibility.
      if assignee_label is null and submitted_user_id is null then
        continue;
      end if;
      select existing.* into in_force_assignment
      from public.registration_unit_team_assignments existing
      where existing.registration_unit_id = new.registration_unit_id
        and existing.assignment_role = team_role
        and existing.effective_from <= new.effective_from
        and (existing.effective_to is null or existing.effective_to >= new.effective_from)
      order by existing.effective_from desc, existing.assigned_at desc
      limit 1;
      if found and (
        (submitted_user_id is not null and in_force_assignment.user_id = submitted_user_id)
        or (submitted_user_id is null and in_force_assignment.user_id is null
            and lower(in_force_assignment.assignee_label) = lower(assignee_label))
        or (submitted_user_id is null and in_force_assignment.user_id is not null
            and lower(assignee_label) = lower((select app_user.display_name from public.app_users app_user where app_user.id = in_force_assignment.user_id)))
      ) then
        continue;
      end if;

      if submitted_user_id is not null then
        select app_user.id into resolved_user_id
        from public.app_users app_user
        join public.team_member_profiles member on member.user_id = app_user.id
        where app_user.id = submitted_user_id
          and app_user.is_active
          and member.active
          and member.effective_from <= new.effective_from
          and (member.effective_to is null or member.effective_to >= new.effective_from)
          and member.operating_model <> 'tax_team'
          -- A signed-in caller may assign only staff within their own Team scope.
          and (auth.uid() is null or public.can_view_team_member(app_user.id))
          and member.role_key = any (case team_role
            when 'preparer' then array['team_member']
            when 'checker' then array['team_member', 'leader', 'reviewer']
            else array['leader', 'reviewer'] end);
        if resolved_user_id is null then
          raise exception using errcode = '22023', message = 'The selected ' || team_role || ' is not an active Team member eligible for this role, within your Team scope, on this date.';
        end if;
        -- The recorded label is the person's own name, never the submitted text.
        assignee_label := (select display_name from public.app_users where id = resolved_user_id);
      elsif assignee_label is not null then
        select min(app_user.id::text)::uuid into resolved_user_id
        from public.app_users app_user
        join public.team_member_profiles member on member.user_id = app_user.id
        where lower(app_user.display_name) = lower(assignee_label)
          and app_user.is_active
          and member.active
          and member.effective_from <= new.effective_from
          and (member.effective_to is null or member.effective_to >= new.effective_from)
          and member.operating_model <> 'tax_team'
          -- A signed-in caller may assign only staff within their own Team scope.
          and (auth.uid() is null or public.can_view_team_member(app_user.id))
          and member.role_key = any (case team_role
            when 'preparer' then array['team_member']
            when 'checker' then array['team_member', 'leader', 'reviewer']
            else array['leader', 'reviewer'] end)
        having count(*) = 1;
      end if;

      if assignee_label is null then
        continue;
      end if;

      select existing.* into current_assignment
      from public.registration_unit_team_assignments existing
      where existing.registration_unit_id = new.registration_unit_id
        and existing.assignment_role = team_role
        and existing.effective_to is null
      order by existing.effective_from desc, existing.assigned_at desc
      limit 1;
      -- A change scheduled for a later date has not happened yet. An earlier
      -- correction cancels it (kept as a zero-length row) and reopens the
      -- assignment it was going to end, instead of being refused.
      while found and current_assignment.effective_from > new.effective_from
            and current_assignment.effective_from > current_date loop
        update public.registration_unit_team_assignments
           set effective_to = current_assignment.effective_from - 1
         where id = current_assignment.id;
        update public.registration_unit_team_assignments previous
           set effective_to = null
         where previous.id = (
           select earlier.id
           from public.registration_unit_team_assignments earlier
           where earlier.registration_unit_id = new.registration_unit_id
             and earlier.assignment_role = team_role
             and earlier.effective_to = current_assignment.effective_from - 1
             and earlier.effective_from < current_assignment.effective_from
           order by earlier.effective_from desc, earlier.assigned_at desc
           limit 1
         );
        select existing.* into current_assignment
        from public.registration_unit_team_assignments existing
        where existing.registration_unit_id = new.registration_unit_id
          and existing.assignment_role = team_role
          and existing.effective_to is null
        order by existing.effective_from desc, existing.assigned_at desc
        limit 1;
      end loop;

      if not found and assignee_label is null then
        continue;
      end if;
      if found and (
        (current_assignment.user_id is not null and current_assignment.user_id = resolved_user_id)
        or (current_assignment.user_id is null and resolved_user_id is null
            and lower(coalesce(nullif(current_assignment.assignee_label, 'Unassigned'), '')) = lower(coalesce(assignee_label, '')))
      ) then
        continue;
      end if;

      -- History is append-only: a change may not start before the open row.
      if found and new.effective_from < current_assignment.effective_from then
        raise exception using errcode = '22023', message = 'An assignment change cannot be dated before the current assignment.';
      end if;
      update public.registration_unit_team_assignments existing
         set effective_to = new.effective_from - 1
       where existing.registration_unit_id = new.registration_unit_id
         and existing.assignment_role = team_role
         and existing.effective_to is null;

      if assignee_label is not null then
        insert into public.registration_unit_team_assignments (
          registration_unit_id, tax_profile_version_id, assignment_role, user_id,
          assignee_label, effective_from, assigned_by, reason
        ) values (
          new.registration_unit_id, new.id, assignment_role, resolved_user_id,
          assignee_label, new.effective_from, new.created_by, new.change_reason
        );
      end if;
    end loop;

    -- The Tower (or, failing that, the Cluster) chosen in operating setup is
    -- the Registration Unit's visibility scope. Only an authorized caller may
    -- move it, and an unknown label leaves the current scope untouched.
    -- A label resolves only when exactly one active unit carries it; an
    -- ambiguous or unknown label never guesses and leaves the scope untouched.
    resolved_scope_unit_id := null;
    scope_label := nullif(trim(coalesce(new.assignment_data ->> 'tower', '')), '');
    if lower(coalesce(scope_label, '')) in ('unassigned', 'unresolved') then
      scope_label := null;
    end if;
    cluster_label := nullif(trim(coalesce(new.assignment_data ->> 'cluster', '')), '');
    if lower(coalesce(cluster_label, '')) in ('unassigned', 'unresolved') then
      cluster_label := null;
    end if;
    -- Tower names repeat across clusters, so a tower resolves within the
    -- cluster submitted with it, and only while that parent Cluster is
    -- itself active and in effect on the change date.
    if scope_label is not null then
      select min(unit.id::text)::uuid into resolved_scope_unit_id
      from public.organization_units unit
      where unit.unit_kind = 'tower' and unit.active and lower(unit.name) = lower(scope_label)
        and unit.effective_from <= new.effective_from and (unit.effective_to is null or unit.effective_to >= new.effective_from)
        and exists (
          select 1 from public.organization_units cluster_unit
          where cluster_unit.id = unit.parent_id
            and cluster_unit.unit_kind = 'cluster'
            and cluster_unit.active
            and cluster_unit.effective_from <= new.effective_from
            and (cluster_unit.effective_to is null or cluster_unit.effective_to >= new.effective_from)
            and (cluster_label is null or lower(cluster_unit.name) = lower(cluster_label))
        )
      having count(*) = 1;
      -- A named tower that does not resolve is refused, never widened to its cluster.
      if resolved_scope_unit_id is null then
        if cluster_label is not null and exists (
          select 1 from public.organization_units unit
          where unit.unit_kind = 'tower' and unit.active and lower(unit.name) = lower(scope_label)
            and unit.effective_from <= new.effective_from and (unit.effective_to is null or unit.effective_to >= new.effective_from)
        ) then
          raise exception using errcode = '22023', message = 'The selected Tower does not belong to the selected Cluster.';
        end if;
        raise exception using errcode = '22023', message = 'The selected Tower is not a single active tower.';
      end if;
    end if;
    if resolved_scope_unit_id is null then
      scope_label := nullif(trim(coalesce(new.assignment_data ->> 'cluster', '')), '');
      if lower(coalesce(scope_label, '')) in ('unassigned', 'unresolved') then
        scope_label := null;
      end if;
      if scope_label is not null then
        select min(unit.id::text)::uuid into resolved_scope_unit_id
        from public.organization_units unit
        where unit.unit_kind = 'cluster' and unit.active and lower(unit.name) = lower(scope_label)
        and unit.effective_from <= new.effective_from and (unit.effective_to is null or unit.effective_to >= new.effective_from)
        having count(*) = 1;
        if resolved_scope_unit_id is null then
          raise exception using errcode = '22023', message = 'The selected Cluster is not a single active cluster.';
        end if;
      end if;
    end if;
    -- The placement already in force on the version's date is no change, so
    -- a move scheduled for a later date stays scheduled.
    if resolved_scope_unit_id is not null then
      select scope.organization_unit_id into in_force_scope_unit_id
      from public.registration_unit_scope_assignments scope
      where scope.registration_unit_id = new.registration_unit_id
        and scope.effective_from <= new.effective_from
        and (scope.effective_to is null or scope.effective_to >= new.effective_from)
      order by scope.effective_from desc, scope.assigned_at desc
      limit 1;
      if found and in_force_scope_unit_id = resolved_scope_unit_id then
        resolved_scope_unit_id := null;
      end if;
    end if;
    -- Only a signed-in caller moves scope; a direct database write never does.
    if resolved_scope_unit_id is not null and auth.uid() is not null then
      select scope.* into current_scope
      from public.registration_unit_scope_assignments scope
      where scope.registration_unit_id = new.registration_unit_id
        and scope.effective_to is null
      order by scope.effective_from desc, scope.assigned_at desc
      limit 1;
      -- Likewise, an earlier correction cancels a scheduled move that has not
      -- started, if the caller has authority over the unit it was moving to.
      while found and current_scope.effective_from > new.effective_from
            and current_scope.effective_from > current_date loop
        if not public.can_manage_organization_unit(current_scope.organization_unit_id) then
          raise exception using errcode = '42501', message = 'Cancelling this scheduled move is outside the caller''s authority.';
        end if;
        update public.registration_unit_scope_assignments
           set effective_to = current_scope.effective_from - 1
         where id = current_scope.id;
        update public.registration_unit_scope_assignments previous
           set effective_to = null
         where previous.id = (
           select earlier.id
           from public.registration_unit_scope_assignments earlier
           where earlier.registration_unit_id = new.registration_unit_id
             and earlier.effective_to = current_scope.effective_from - 1
             and earlier.effective_from < current_scope.effective_from
           order by earlier.effective_from desc, earlier.assigned_at desc
           limit 1
         );
        select scope.* into current_scope
        from public.registration_unit_scope_assignments scope
        where scope.registration_unit_id = new.registration_unit_id
          and scope.effective_to is null
        order by scope.effective_from desc, scope.assigned_at desc
        limit 1;
      end loop;
      current_scope_unit_id := case when found then current_scope.organization_unit_id else null end;
      if current_scope_unit_id is distinct from resolved_scope_unit_id then
        -- Moving a client needs authority over where it is and where it goes;
        -- saving a profile only needs read access to the unit.
        if not public.can_manage_organization_unit(resolved_scope_unit_id)
           or (current_scope_unit_id is not null and not public.can_manage_organization_unit(current_scope_unit_id)) then
          raise exception using errcode = '42501', message = 'Moving this client between Clusters or Towers is outside the caller''s authority.';
        end if;
        if current_scope_unit_id is not null and new.effective_from < current_scope.effective_from then
          raise exception using errcode = '22023', message = 'A scope change cannot be dated before the current scope.';
        end if;
        update public.registration_unit_scope_assignments scope
           set effective_to = new.effective_from - 1
         where scope.registration_unit_id = new.registration_unit_id
           and scope.effective_to is null;
        insert into public.registration_unit_scope_assignments (registration_unit_id, organization_unit_id, effective_from, assigned_by, reason)
        values (new.registration_unit_id, resolved_scope_unit_id, new.effective_from, new.created_by, new.change_reason);
      end if;
    end if;
  end if;

  if jsonb_typeof(new.profile_data -> 'auditExposures') = 'array' then
    delete from public.tax_audit_exposure_snapshots where tax_profile_version_id = new.id;
    for audit_item in select value from jsonb_array_elements(new.profile_data -> 'auditExposures') loop
      audit_year := nullif(trim(audit_item ->> 'taxableYear'), '');
      audit_matter := nullif(trim(audit_item ->> 'matter'), '');
      if audit_year is not null and audit_matter is not null then
        audit_status := case lower(trim(coalesce(audit_item ->> 'status', 'unresolved')))
          when 'open' then 'open'
          when 'under review' then 'under_review'
          when 'closed' then 'closed'
          else 'unresolved'
        end;
        insert into public.tax_audit_exposure_snapshots (
          registration_unit_id, tax_profile_version_id, taxable_year, matter, status,
          context, source_reference, officer_source_label, officer_role, officer_contact
        ) values (
          new.registration_unit_id, new.id, audit_year, audit_matter, audit_status,
          nullif(trim(audit_item ->> 'context'), ''), nullif(trim(audit_item ->> 'source'), ''),
          nullif(trim(audit_item ->> 'officerName'), ''), nullif(trim(audit_item ->> 'officerRole'), ''),
          nullif(trim(audit_item ->> 'officerContact'), '')
        ) on conflict (tax_profile_version_id, taxable_year, matter) do update set
          status = excluded.status,
          context = excluded.context,
          source_reference = excluded.source_reference,
          officer_source_label = excluded.officer_source_label,
          officer_role = excluded.officer_role,
          officer_contact = excluded.officer_contact;
      end if;
    end loop;
  end if;

  return new;
end;
$$;


revoke execute on function public.sync_tax_profile_relational_context() from public, anon, authenticated;
