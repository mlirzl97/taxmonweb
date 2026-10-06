-- TaxMonWeb Tax Knowledge Foundation
-- Forward-only, source-backed foundation. This migration creates governed
-- master/configuration structures; it does not assert an unresearched tax rule
-- or seed a complete Philippine requirement universe.

create table if not exists public.regulatory_issuances (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  issuance_type text not null check (issuance_type in (
    'revenue_regulation', 'revenue_memorandum_circular', 'revenue_memorandum_order',
    'revenue_administrative_order', 'bir_calendar', 'bir_form_instruction',
    'official_advisory', 'holiday_authority', 'other_authority'
  )),
  title text not null,
  issuing_body text not null,
  source_url text,
  publication_date date,
  effectivity_date date,
  retrieval_date date,
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'retired')),
  supersedes_id uuid references public.regulatory_issuances(id),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regulatory_issuance_citations (
  id uuid primary key default gen_random_uuid(),
  issuance_id uuid not null references public.regulatory_issuances(id),
  locator text,
  page_reference text,
  section_reference text,
  quote_or_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  operating_category text not null check (operating_category in ('cit', 'vat_percentage', 'wht', 'others')),
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  notes text,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.bir_forms (
  id uuid primary key default gen_random_uuid(),
  form_number text not null,
  title text not null,
  revision_label text not null default 'unresolved',
  effective_from date,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  notes text,
  created_at timestamptz not null default now(),
  unique (form_number, revision_label)
);

create table if not exists public.bir_offices (
  id uuid primary key default gen_random_uuid(),
  official_code text not null,
  official_name text not null,
  office_type text not null check (office_type in ('rdo', 'lts', 'lt_office', 'revenue_region', 'other')),
  parent_office_id uuid references public.bir_offices(id),
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  notes text,
  unique (official_code, effective_from),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.filing_channels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  notes text,
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.efps_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  filing_channel_id uuid not null references public.filing_channels(id),
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  notes text,
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.bir_requirements (
  id uuid primary key default gen_random_uuid(),
  requirement_code text not null unique,
  requirement_name text not null,
  requirement_type text not null check (requirement_type in ('primary', 'independent_recurring', 'event_driven', 'external_result', 'other')),
  operating_category text not null check (operating_category in ('cit', 'vat_percentage', 'wht', 'others')),
  frequency_label text not null check (frequency_label in ('monthly', 'quarterly', 'annual', 'as_needed')),
  legal_cadence_code text,
  applicability_class text not null default 'unresolved' check (applicability_class in ('mandatory', 'conditional', 'optional', 'event_driven', 'superseded', 'unresolved')),
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  effective_from date,
  effective_to date,
  notes text,
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.bir_requirement_versions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.bir_requirements(id),
  version_label text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  applicability_strategy text,
  period_strategy text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (requirement_id, version_label),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.requirement_version_forms (
  requirement_version_id uuid not null references public.bir_requirement_versions(id),
  form_id uuid not null references public.bir_forms(id),
  relationship_type text not null check (relationship_type in ('primary_form', 'supporting_form', 'reference_form')),
  primary key (requirement_version_id, form_id)
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rule_kind text not null check (rule_kind in ('applicability', 'generation', 'component', 'deadline', 'adjustment', 'control')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded', 'retired')),
  created_at timestamptz not null default now()
);

create table if not exists public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules(id),
  version_label text not null,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  strategy_code text not null,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (rule_id, version_label),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.rule_version_sources (
  id uuid primary key default gen_random_uuid(),
  rule_version_id uuid not null references public.rule_versions(id),
  issuance_id uuid not null references public.regulatory_issuances(id),
  citation_id uuid references public.regulatory_issuance_citations(id),
  unique (rule_version_id, issuance_id, citation_id)
);

create table if not exists public.deadline_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  strategy_code text not null check (strategy_code in ('fixed_date', 'fixed_day_of_month', 'days_after_period_end', 'working_day_adjustment', 'one_working_day_before')),
  adjustment_code text not null default 'none' check (adjustment_code in ('none', 'next_working_day', 'previous_working_day')),
  parameters jsonb not null default '{}'::jsonb,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.deadline_policy_sources (
  id uuid primary key default gen_random_uuid(),
  deadline_policy_id uuid not null references public.deadline_policies(id),
  issuance_id uuid not null references public.regulatory_issuances(id),
  citation_id uuid references public.regulatory_issuance_citations(id),
  unique (deadline_policy_id, issuance_id, citation_id)
);

create table if not exists public.requirement_components (
  id uuid primary key default gen_random_uuid(),
  requirement_version_id uuid not null references public.bir_requirement_versions(id),
  component_code text not null,
  label text not null,
  component_type text not null check (component_type in ('return_filing', 'payment', 'attachment_schedule', 'electronic_submission', 'evidence', 'other')),
  requiredness text not null check (requiredness in ('mandatory', 'conditional', 'optional', 'event_driven', 'unresolved')),
  deadline_policy_id uuid references public.deadline_policies(id),
  independent_requirement_id uuid references public.bir_requirements(id),
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  unique (requirement_version_id, component_code)
);

create table if not exists public.holiday_master (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  holiday_name text not null,
  holiday_kind text not null check (holiday_kind in ('regular', 'special_non_working', 'local', 'other')),
  jurisdiction_code text,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  source_issuance_id uuid references public.regulatory_issuances(id),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.published_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  calendar_year integer not null,
  requirement_id uuid references public.bir_requirements(id),
  requirement_version_id uuid references public.bir_requirement_versions(id),
  external_requirement_label text not null,
  period_or_event text,
  period_start date,
  period_end date,
  filing_channel_id uuid references public.filing_channels(id),
  efps_group_id uuid references public.efps_groups(id),
  base_statutory_deadline date,
  adjusted_statutory_deadline date,
  official_published_date date,
  validation_status text not null default 'unresolved' check (validation_status in ('match', 'mismatch_review_required', 'unresolved', 'unmapped_review_required')),
  source_issuance_id uuid references public.regulatory_issuances(id),
  source_locator text,
  notes text,
  check (requirement_id is not null or validation_status = 'unmapped_review_required')
);

create table if not exists public.coverage_integrity_observations (
  id uuid primary key default gen_random_uuid(),
  expected_object_type text not null,
  expected_object_id uuid not null,
  generated_object_id uuid,
  expected boolean not null default false,
  generated boolean not null default false,
  executed boolean not null default false,
  evidenced boolean not null default false,
  severity text not null check (severity in ('normal', 'attention', 'exception', 'statutory_exposure')),
  reason text not null,
  observed_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb
);

create table if not exists public.impact_analysis_cases (
  id uuid primary key default gen_random_uuid(),
  change_type text not null check (change_type in ('rule', 'profile', 'compliance_universe', 'deadline', 'service_scope')),
  changed_object_id uuid not null,
  old_context jsonb not null,
  proposed_context jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'decided', 'cancelled')),
  decision text check (decision in ('keep_existing', 'rebase', 'regenerate', 'cancel', 'supersede')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  check ((status = 'decided' and decision is not null and decided_by is not null and decided_at is not null and decision_reason is not null) or status <> 'decided')
);

create index if not exists idx_requirement_versions_effective on public.bir_requirement_versions (requirement_id, effective_from, effective_to);
create index if not exists idx_rule_versions_effective on public.rule_versions (rule_id, effective_from, effective_to);
create index if not exists idx_deadline_policies_effective on public.deadline_policies (effective_from, effective_to);
create index if not exists idx_calendar_entries_year_date on public.published_calendar_entries (calendar_year, adjusted_statutory_deadline);
create index if not exists idx_coverage_integrity_object on public.coverage_integrity_observations (expected_object_type, expected_object_id, observed_at desc);
create index if not exists idx_impact_cases_status on public.impact_analysis_cases (status, created_at desc);

alter table public.regulatory_issuances enable row level security;
alter table public.regulatory_issuance_citations enable row level security;
alter table public.tax_types enable row level security;
alter table public.bir_forms enable row level security;
alter table public.bir_offices enable row level security;
alter table public.filing_channels enable row level security;
alter table public.efps_groups enable row level security;
alter table public.bir_requirements enable row level security;
alter table public.bir_requirement_versions enable row level security;
alter table public.requirement_version_forms enable row level security;
alter table public.rules enable row level security;
alter table public.rule_versions enable row level security;
alter table public.rule_version_sources enable row level security;
alter table public.deadline_policies enable row level security;
alter table public.deadline_policy_sources enable row level security;
alter table public.requirement_components enable row level security;
alter table public.holiday_master enable row level security;
alter table public.published_calendar_entries enable row level security;
alter table public.coverage_integrity_observations enable row level security;
alter table public.impact_analysis_cases enable row level security;

-- Tax masters are not exposed through broad table grants. Later Tax
-- Configuration actions must use capability- and scope-aware server commands.
