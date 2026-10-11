-- Relational profile/reference foundation.
--
-- This migration closes the current Module 01 data-integrity gap without
-- prebuilding Compliance Setup, Generated Compliance Work, Tax Run, or QA.
-- Tax Profile versions remain the immutable setup snapshots; these child
-- records make canonical references and important standing context queryable.

create table if not exists public.client_groups (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  effective_from date not null default current_date,
  effective_to date,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.client_group_memberships (
  id uuid primary key default gen_random_uuid(),
  client_group_id uuid not null references public.client_groups(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  reason text not null,
  check (effective_to is null or effective_to >= effective_from),
  unique (client_group_id, client_id, effective_from)
);

alter table public.client_groups
  add column if not exists reason text not null default 'Relationship context recorded';

create index if not exists client_group_memberships_client_idx
  on public.client_group_memberships(client_id, effective_from desc, effective_to);
create index if not exists client_group_memberships_group_idx
  on public.client_group_memberships(client_group_id, effective_from desc, effective_to);

-- Canonical references for a Tax Profile version. A null canonical ID with an
-- unresolved status is intentional: it keeps an unknown value visible rather
-- than inventing a jurisdiction/channel/tax type.
create table if not exists public.tax_profile_office_context (
  id uuid primary key default gen_random_uuid(),
  tax_profile_version_id uuid not null unique references public.tax_profile_versions(id) on delete restrict,
  bir_office_id uuid references public.bir_offices(id) on delete restrict,
  source_label text,
  resolution_status text not null check (resolution_status in ('resolved', 'unresolved')),
  resolution_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_profile_filing_context (
  id uuid primary key default gen_random_uuid(),
  tax_profile_version_id uuid not null unique references public.tax_profile_versions(id) on delete restrict,
  filing_channel_id uuid references public.filing_channels(id) on delete restrict,
  efps_group_id uuid references public.efps_groups(id) on delete restrict,
  filing_channel_source_label text,
  efps_group_source_label text,
  channel_resolution_status text not null check (channel_resolution_status in ('resolved', 'unresolved')),
  efps_group_resolution_status text not null check (efps_group_resolution_status in ('resolved', 'unresolved', 'not_applicable')),
  resolution_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_profile_registered_tax_types (
  id uuid primary key default gen_random_uuid(),
  tax_profile_version_id uuid not null references public.tax_profile_versions(id) on delete restrict,
  tax_type_id uuid references public.tax_types(id) on delete restrict,
  source_label text not null,
  resolution_status text not null check (resolution_status in ('resolved', 'unresolved')),
  resolution_note text,
  created_at timestamptz not null default now(),
  unique (tax_profile_version_id, source_label)
);

-- Current taxpayer/Registration Unit accountability is separate from the
-- client-level portfolio projection. Labels remain available for sanitized
-- fixtures or pending user mapping; user_id is the durable actor reference
-- when an internal user has been matched.
create table if not exists public.registration_unit_team_assignments (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  tax_profile_version_id uuid references public.tax_profile_versions(id) on delete restrict,
  assignment_role text not null check (assignment_role in ('preparer', 'checker', 'reviewer', 'portfolio_owner')),
  user_id uuid references public.app_users(id) on delete restrict,
  assignee_label text not null,
  effective_from date not null,
  effective_to date,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  reason text not null,
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists registration_unit_team_assignments_unit_idx
  on public.registration_unit_team_assignments(registration_unit_id, assignment_role, effective_from desc, effective_to);
create index if not exists registration_unit_team_assignments_user_idx
  on public.registration_unit_team_assignments(user_id, effective_from desc, effective_to);

-- Lightweight standing tax-audit context. This is not a Tax Audit case
-- management schema. Each row is a profile-version snapshot so changing the
-- current profile cannot rewrite what was known at an earlier effective date.
create table if not exists public.tax_audit_exposure_snapshots (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  tax_profile_version_id uuid not null references public.tax_profile_versions(id) on delete restrict,
  taxable_year text not null,
  matter text not null,
  status text not null check (status in ('open', 'under_review', 'closed', 'unresolved')),
  as_of_date date,
  context text,
  source_reference text,
  bir_officer_id uuid references public.bir_officers(id) on delete restrict,
  officer_source_label text,
  officer_role text,
  officer_contact text,
  created_at timestamptz not null default now(),
  unique (tax_profile_version_id, taxable_year, matter)
);

create index if not exists tax_audit_exposure_snapshots_unit_year_idx
  on public.tax_audit_exposure_snapshots(registration_unit_id, taxable_year desc, status);

create or replace function public.normalized_rdo_lookup_key(value text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(value, ''))) ~ '^rdo' then
      'rdo' || coalesce(
        nullif(
          ltrim(
            regexp_replace(lower(trim(value)), '[^0-9]', '', 'g'),
            '0'
          ),
          ''
        ),
        '0'
      )
    else lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]', '', 'g'))
  end;
$$;

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
    foreach assignment_role in array array['preparer', 'checker', 'reviewer'] loop
      assignee_label := nullif(trim(coalesce(new.assignment_data ->> assignment_role, '')), '');
      if assignee_label is not null then
        select app_user.id into resolved_user_id
        from public.app_users app_user
        where lower(app_user.display_name) = lower(assignee_label)
        limit 1;
        insert into public.registration_unit_team_assignments (
          registration_unit_id, tax_profile_version_id, assignment_role, user_id,
          assignee_label, effective_from, assigned_by, reason
        ) values (
          new.registration_unit_id, new.id, assignment_role, resolved_user_id,
          assignee_label, new.effective_from, new.created_by, new.change_reason
        );
      end if;
    end loop;
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

drop trigger if exists tax_profile_relational_context_after_write on public.tax_profile_versions;
create trigger tax_profile_relational_context_after_write
  after insert or update of profile_data, assignment_data on public.tax_profile_versions
  for each row execute procedure public.sync_tax_profile_relational_context();

-- A direct SQL update must not activate a profile with a missing or duplicate
-- maker/checker/reviewer assignment. The command RPC performs the same domain
-- validation; this trigger protects the table boundary as well.
create or replace function public.enforce_tax_profile_assignment_separation()
returns trigger
language plpgsql
as $$
declare
  preparer text;
  checker text;
  reviewer text;
begin
  if new.state = 'active' then
    preparer := nullif(trim(new.assignment_data ->> 'preparer'), '');
    checker := nullif(trim(new.assignment_data ->> 'checker'), '');
    reviewer := nullif(trim(new.assignment_data ->> 'reviewer'), '');
    if preparer is null or checker is null or reviewer is null
       or lower(preparer) in ('unassigned', 'not configured')
       or lower(checker) in ('unassigned', 'not configured')
       or lower(reviewer) in ('unassigned', 'not configured')
       or lower(preparer) = lower(checker)
       or lower(preparer) = lower(reviewer)
       or lower(checker) = lower(reviewer) then
      raise exception using errcode = '22023', message = 'An active Tax Profile requires distinct Preparer, Checker, and Reviewer actors.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tax_profile_assignment_separation_before_write on public.tax_profile_versions;
create trigger tax_profile_assignment_separation_before_write
  before insert or update on public.tax_profile_versions
  for each row execute procedure public.enforce_tax_profile_assignment_separation();

-- Reference masters are readable to authenticated users through the shared BIR
-- Center. Draft, retired, superseded, and unresolved rows remain restricted.
drop policy if exists regulatory_issuances_verified_reference_read on public.regulatory_issuances;
create policy regulatory_issuances_verified_reference_read
  on public.regulatory_issuances for select to authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

drop policy if exists regulatory_issuance_citations_verified_reference_read on public.regulatory_issuance_citations;
create policy regulatory_issuance_citations_verified_reference_read
  on public.regulatory_issuance_citations for select to authenticated
  using (exists (
    select 1 from public.regulatory_issuances issuance
    where issuance.id = issuance_id
      and issuance.status = 'active'
      and issuance.verification_status in ('verified', 'partially_verified')
  ));

drop policy if exists tax_types_verified_reference_read on public.tax_types;
create policy tax_types_verified_reference_read
  on public.tax_types for select to authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

drop policy if exists bir_forms_verified_reference_read on public.bir_forms;
create policy bir_forms_verified_reference_read
  on public.bir_forms for select to authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

drop policy if exists filing_channels_verified_reference_read on public.filing_channels;
create policy filing_channels_verified_reference_read
  on public.filing_channels for select to authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

drop policy if exists efps_groups_verified_reference_read on public.efps_groups;
create policy efps_groups_verified_reference_read
  on public.efps_groups for select to authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

drop policy if exists requirements_verified_reference_read on public.bir_requirements;
create policy requirements_verified_reference_read
  on public.bir_requirements for select to authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

drop policy if exists requirement_versions_verified_reference_read on public.bir_requirement_versions;
create policy requirement_versions_verified_reference_read
  on public.bir_requirement_versions for select to authenticated
  using (status = 'approved' and verification_status in ('verified', 'partially_verified'));

drop policy if exists requirement_version_forms_verified_reference_read on public.requirement_version_forms;
create policy requirement_version_forms_verified_reference_read
  on public.requirement_version_forms for select to authenticated
  using (exists (
    select 1 from public.bir_requirement_versions version
    where version.id = requirement_version_id
      and version.status = 'approved'
      and version.verification_status in ('verified', 'partially_verified')
  ));

drop policy if exists requirement_components_verified_reference_read on public.requirement_components;
create policy requirement_components_verified_reference_read
  on public.requirement_components for select to authenticated
  using (status = 'approved' and verification_status in ('verified', 'partially_verified'));

drop policy if exists holiday_master_verified_reference_read on public.holiday_master;
create policy holiday_master_verified_reference_read
  on public.holiday_master for select to authenticated
  using (status = 'approved' and verification_status in ('verified', 'partially_verified'));

drop policy if exists published_calendar_verified_reference_read on public.published_calendar_entries;
create policy published_calendar_verified_reference_read
  on public.published_calendar_entries for select to authenticated
  using (validation_status in ('match', 'not_comparable'));

drop policy if exists bir_office_sources_verified_reference_read on public.bir_office_sources;
create policy bir_office_sources_verified_reference_read
  on public.bir_office_sources for select to authenticated
  using (exists (
    select 1 from public.bir_offices office
    where office.id = bir_office_id
      and office.status = 'active'
      and office.verification_status in ('verified', 'partially_verified')
  ));

alter table public.client_groups enable row level security;
alter table public.client_group_memberships enable row level security;
alter table public.tax_profile_office_context enable row level security;
alter table public.tax_profile_filing_context enable row level security;
alter table public.tax_profile_registered_tax_types enable row level security;
alter table public.registration_unit_team_assignments enable row level security;
alter table public.tax_audit_exposure_snapshots enable row level security;

create policy client_groups_scoped_read on public.client_groups
  for select to authenticated using (
    exists (
      select 1 from public.client_group_memberships membership
      where membership.client_group_id = id and public.can_view_client(membership.client_id)
    )
  );

create policy client_group_memberships_scoped_read on public.client_group_memberships
  for select to authenticated using (public.can_view_client(client_id));

create policy tax_profile_office_context_scoped_read on public.tax_profile_office_context
  for select to authenticated using (exists (
    select 1 from public.tax_profile_versions profile
    where profile.id = tax_profile_version_id and public.can_view_registration_unit(profile.registration_unit_id)
  ));

create policy tax_profile_filing_context_scoped_read on public.tax_profile_filing_context
  for select to authenticated using (exists (
    select 1 from public.tax_profile_versions profile
    where profile.id = tax_profile_version_id and public.can_view_registration_unit(profile.registration_unit_id)
  ));

create policy tax_profile_registered_tax_types_scoped_read on public.tax_profile_registered_tax_types
  for select to authenticated using (exists (
    select 1 from public.tax_profile_versions profile
    where profile.id = tax_profile_version_id and public.can_view_registration_unit(profile.registration_unit_id)
  ));

create policy registration_unit_team_assignments_scoped_read on public.registration_unit_team_assignments
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));

create policy tax_audit_exposure_snapshots_scoped_read on public.tax_audit_exposure_snapshots
  for select to authenticated using (public.can_view_registration_unit(registration_unit_id));

revoke execute on function public.normalized_rdo_lookup_key(text) from public;
grant execute on function public.normalized_rdo_lookup_key(text) to authenticated;

comment on table public.client_groups is 'Optional commercial relationship context; never the taxpayer or filing entity.';
comment on table public.tax_profile_office_context is 'Canonical BIR office resolution for a Tax Profile version; unresolved values remain explicit.';
comment on table public.tax_profile_filing_context is 'Canonical filing-channel/eFPS context for a Tax Profile version.';
comment on table public.tax_audit_exposure_snapshots is 'Lightweight standing audit context only; not Tax Audit case management.';
comment on table public.registration_unit_team_assignments is 'Effective-dated accountability history at the Registration Unit operating context.';
