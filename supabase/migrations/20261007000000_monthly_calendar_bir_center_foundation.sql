-- Monthly calendar governance and minimal BIR Center reference foundations.
-- No polished UI or Tax Audit workflow is created here.

alter table public.bir_offices
  add column if not exists jurisdiction_description text,
  add column if not exists address text,
  add column if not exists city_or_area text,
  add column if not exists public_telephone text,
  add column if not exists public_email text,
  add column if not exists last_verified_at timestamptz;

alter table public.bir_requirement_versions
  add column if not exists deadline_policy_id uuid references public.deadline_policies(id),
  add column if not exists normal_deadline_expression text;

create table if not exists public.requirement_version_sources (
  id uuid primary key default gen_random_uuid(),
  requirement_version_id uuid not null references public.bir_requirement_versions(id),
  issuance_id uuid not null references public.regulatory_issuances(id),
  citation_id uuid references public.regulatory_issuance_citations(id),
  unique (requirement_version_id, issuance_id, citation_id)
);

create table if not exists public.monthly_calendar_versions (
  id uuid primary key default gen_random_uuid(),
  calendar_month date not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'under_review', 'approved', 'released', 'superseded')),
  prepared_by uuid,
  prepared_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  released_at timestamptz,
  supersedes_id uuid references public.monthly_calendar_versions(id),
  partial_release boolean not null default false,
  source_set jsonb not null default '[]'::jsonb,
  reconciliation_summary jsonb not null default '{}'::jsonb,
  release_note text,
  created_at timestamptz not null default now(),
  unique (calendar_month, version_number),
  check (calendar_month = date_trunc('month', calendar_month)::date),
  check (status <> 'approved' or approved_by is not null),
  check (status <> 'released' or (approved_by is not null and released_at is not null))
);

create table if not exists public.monthly_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  calendar_version_id uuid not null references public.monthly_calendar_versions(id),
  requirement_id uuid references public.bir_requirements(id),
  requirement_version_id uuid references public.bir_requirement_versions(id),
  external_requirement_label text not null,
  period_or_event text,
  period_start date,
  period_end date,
  base_statutory_deadline date,
  adjusted_statutory_deadline date,
  tmf_package_target date,
  comparison_status text not null default 'unresolved' check (comparison_status in ('match', 'explained_difference', 'unresolved_mismatch', 'not_comparable', 'unmapped_review_required')),
  unresolved_reason text,
  source_issuance_id uuid references public.regulatory_issuances(id),
  source_locator text,
  affected_population jsonb not null default '{}'::jsonb,
  notes text,
  check (requirement_id is not null or comparison_status = 'unmapped_review_required')
);

create index if not exists idx_monthly_calendar_versions_month_status
  on public.monthly_calendar_versions (calendar_month, status);
create index if not exists idx_monthly_calendar_entries_version_date
  on public.monthly_calendar_entries (calendar_version_id, adjusted_statutory_deadline);

create table if not exists public.bir_facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  facility_kind text not null check (facility_kind in ('efps', 'ebirforms', 'eafs', 'orus', 'electronic_submission', 'other')),
  public_url text,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  source_issuance_id uuid references public.regulatory_issuances(id),
  last_verified_at timestamptz,
  notes text
);

create table if not exists public.facility_filing_channels (
  facility_id uuid not null references public.bir_facilities(id),
  filing_channel_id uuid not null references public.filing_channels(id),
  effective_from date not null,
  effective_to date,
  primary key (facility_id, filing_channel_id, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.bir_officers (
  id uuid primary key default gen_random_uuid(),
  stable_reference text not null unique,
  full_name text not null,
  official_role_title text,
  status text not null default 'unknown' check (status in ('active', 'inactive', 'unknown')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  source_issuance_id uuid references public.regulatory_issuances(id),
  source_reference text,
  public_telephone text,
  public_email text,
  last_verified_at timestamptz,
  notes text,
  check (length(trim(full_name)) > 0)
);

create table if not exists public.bir_officer_office_assignments (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.bir_officers(id),
  office_id uuid not null references public.bir_offices(id),
  role_title text,
  effective_from date,
  effective_to date,
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  source_issuance_id uuid references public.regulatory_issuances(id),
  source_reference text,
  notes text,
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.tax_audit_officer_assignments (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null,
  registration_unit_id uuid references public.registration_units(id),
  officer_id uuid not null references public.bir_officers(id),
  office_id uuid references public.bir_offices(id),
  case_role text not null,
  effective_from date,
  effective_to date,
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  source_reference text,
  notes text,
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

alter table public.requirement_version_sources enable row level security;
alter table public.monthly_calendar_versions enable row level security;
alter table public.monthly_calendar_entries enable row level security;
alter table public.bir_facilities enable row level security;
alter table public.facility_filing_channels enable row level security;
alter table public.bir_officers enable row level security;
alter table public.bir_officer_office_assignments enable row level security;
alter table public.tax_audit_officer_assignments enable row level security;
