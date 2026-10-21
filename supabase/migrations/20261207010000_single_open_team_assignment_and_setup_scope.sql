-- Keep one open team assignment per role and let operating setup move the
-- Registration Unit scope.
--
-- Every saved Tax Profile version used to append three assignment rows, even
-- when nothing changed, and never closed the previous ones. "Unassigned" was
-- stored as if it were an assignee. Now unchanged roles are skipped, the
-- previous row is closed before a new assignee is recorded, and the Tower (or
-- Cluster) chosen in operating setup becomes the unit's visibility scope when
-- the caller may manage it. History is closed, never deleted.
--
-- End dates are inclusive. A row replaced on the day it started is closed the
-- day before it began: it stays in history as superseded the same day and is
-- never current, so one owner and one scope are current at a time.

alter table public.registration_unit_team_assignments
  drop constraint if exists registration_unit_team_assignments_check;
alter table public.registration_unit_team_assignments
  add constraint registration_unit_team_assignments_check
  check (effective_to is null or effective_to >= effective_from - 1);

alter table public.registration_unit_scope_assignments
  drop constraint if exists registration_unit_scope_dates_check;
alter table public.registration_unit_scope_assignments
  add constraint registration_unit_scope_dates_check
  check (effective_to is null or effective_to >= effective_from - 1);

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
  scope_label text;
  resolved_scope_unit_id uuid;
  current_scope_unit_id uuid;
  current_scope public.registration_unit_scope_assignments;
  audit_item jsonb;
  audit_status text;
  audit_year text;
  audit_matter text;
begin
  if tg_op = 'UPDATE' and new.profile_data is not distinct from old.profile_data
     and new.assignment_data is not distinct from old.assignment_data then
    return new;
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
      resolved_user_id := null;
      if assignee_label is not null then
        select app_user.id into resolved_user_id
        from public.app_users app_user
        where lower(app_user.display_name) = lower(assignee_label)
        order by app_user.is_active desc
        limit 1;
      end if;

      select existing.* into current_assignment
      from public.registration_unit_team_assignments existing
      where existing.registration_unit_id = new.registration_unit_id
        and existing.assignment_role = team_role
        and existing.effective_to is null
      order by existing.effective_from desc, existing.assigned_at desc
      limit 1;

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
    if scope_label is not null then
      select min(unit.id::text)::uuid into resolved_scope_unit_id
      from public.organization_units unit
      where unit.unit_kind = 'tower' and unit.active and lower(unit.name) = lower(scope_label)
      having count(*) = 1;
    end if;
    if resolved_scope_unit_id is null then
      scope_label := nullif(trim(coalesce(new.assignment_data ->> 'cluster', '')), '');
      if scope_label is not null then
        select min(unit.id::text)::uuid into resolved_scope_unit_id
        from public.organization_units unit
        where unit.unit_kind = 'cluster' and unit.active and lower(unit.name) = lower(scope_label)
        having count(*) = 1;
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
