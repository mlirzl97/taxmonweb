-- HOD-approved sanitized staffing fixture for the four live onboarding clients.
-- Names are labels until real authenticated staff accounts are created and
-- linked. This does not create fake auth identities or grant permissions.

do $$
declare
  root_id uuid;
  cluster_id uuid;
  tower_id uuid;
  hod_id uuid := '03aef39f-be2e-4936-a8f5-42f9c6b078a6';
  item record;
  unit_id uuid;
  latest_profile public.tax_profile_versions;
  previous_profile_id uuid;
  new_profile_id uuid;
  next_version integer;
begin
  select id into root_id from public.organization_units where code = 'AT-ROOT' limit 1;

  insert into public.organization_units (code, name, unit_kind, parent_id, active, effective_from, created_by)
  values ('CL-MARICEL', 'Maricel''s Cluster', 'cluster', root_id, true, date '2026-10-10', hod_id)
  on conflict (code) do update set name = excluded.name, parent_id = excluded.parent_id, active = true;
  select id into cluster_id from public.organization_units where code = 'CL-MARICEL';

  insert into public.organization_units (code, name, unit_kind, parent_id, active, effective_from, created_by)
  values ('TOWER-A', 'Tower A', 'tower', cluster_id, true, date '2026-10-10', hod_id)
  on conflict (code) do update set name = excluded.name, parent_id = excluded.parent_id, active = true;
  select id into tower_id from public.organization_units where code = 'TOWER-A';

  for item in
    select * from (values
      ('CLIENT-CH-MEDIA', 'MK', 'Lowell', 'Maricel'),
      ('CLIENT-SISTEMA-ELECTRIC', 'Jaja', 'Lowell', 'Maricel'),
      ('CLIENT-SQUARE-ONE', 'Christine', 'Chrissia', 'Reign'),
      ('CLIENT-EC-PAY', 'Webster', 'Chrissia', 'Reign')
    ) as assignments(client_reference_code, preparer, checker, reviewer)
  loop
    select ru.id into unit_id
    from public.clients client
    join public.taxpayer_entities entity on entity.client_id = client.id
    join public.registration_units ru on ru.taxpayer_entity_id = entity.id
    where client.reference_code = item.client_reference_code
      and ru.active = true
    order by ru.unit_kind = 'head_office' desc, ru.created_at
    limit 1;

    if unit_id is null then continue; end if;

    insert into public.registration_unit_scope_assignments (
      registration_unit_id, organization_unit_id, effective_from, assigned_by, reason
    )
    select unit_id, tower_id, date '2026-10-10', hod_id, 'HOD-approved sanitized client staffing fixture'
    where not exists (
      select 1 from public.registration_unit_scope_assignments existing
      where existing.registration_unit_id = unit_id
        and existing.organization_unit_id = tower_id
        and existing.effective_from = date '2026-10-10'
    );

    select * into latest_profile
    from public.tax_profile_versions profile
    where profile.registration_unit_id = unit_id
    order by profile.version_number desc
    limit 1;
    previous_profile_id := latest_profile.id;

    next_version := latest_profile.version_number + 1;
    insert into public.tax_profile_versions (
      registration_unit_id, version_number, state, effective_from,
      profile_data, assignment_data, source_reference_id, created_by, change_reason
    ) values (
      unit_id,
      next_version,
      'ready_for_validation',
      date '2026-10-10',
      latest_profile.profile_data || jsonb_build_object(
        'assignmentActors', jsonb_build_array(item.preparer, item.checker, item.reviewer)
      ),
      jsonb_build_object(
        'preparer', item.preparer,
        'checker', item.checker,
        'reviewer', item.reviewer,
        'tower', 'Tower A',
        'cluster', 'Maricel''s Cluster',
        'effectiveFrom', '2026-10-10'
      ),
      latest_profile.source_reference_id,
      hod_id,
      'HOD-approved sanitized staffing fixture assignment; authenticated staff linking remains pending'
    );

    select id into new_profile_id
    from public.tax_profile_versions profile
    where profile.registration_unit_id = unit_id
    order by profile.version_number desc
    limit 1;

    insert into public.registration_unit_team_assignments (
      registration_unit_id, tax_profile_version_id, assignment_role,
      user_id, assignee_label, effective_from, assigned_by, reason
    ) values
      (unit_id, new_profile_id, 'preparer', null, item.preparer, date '2026-10-10', hod_id, 'HOD-approved sanitized staffing fixture'),
      (unit_id, new_profile_id, 'checker', null, item.checker, date '2026-10-10', hod_id, 'HOD-approved sanitized staffing fixture'),
      (unit_id, new_profile_id, 'reviewer', null, item.reviewer, date '2026-10-10', hod_id, 'HOD-approved sanitized staffing fixture');
  end loop;
end $$;
