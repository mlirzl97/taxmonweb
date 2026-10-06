-- Reusable provenance links for supporting tax masters and published datasets.
-- Regulatory Issuance/Authority remains the reusable source object; these
-- joins prevent repeated URL-only provenance from becoming the source of truth.

create table if not exists public.tax_type_sources (
  tax_type_id uuid not null references public.tax_types(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (tax_type_id, issuance_id, source_role)
);

create table if not exists public.bir_form_sources (
  bir_form_id uuid not null references public.bir_forms(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (bir_form_id, issuance_id, source_role)
);

create table if not exists public.bir_office_sources (
  bir_office_id uuid not null references public.bir_offices(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (bir_office_id, issuance_id, source_role)
);

create table if not exists public.filing_channel_sources (
  filing_channel_id uuid not null references public.filing_channels(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (filing_channel_id, issuance_id, source_role)
);

create table if not exists public.efps_group_sources (
  efps_group_id uuid not null references public.efps_groups(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (efps_group_id, issuance_id, source_role)
);

create table if not exists public.holiday_master_sources (
  holiday_id uuid not null references public.holiday_master(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (holiday_id, issuance_id, source_role)
);

create table if not exists public.published_calendar_entry_sources (
  calendar_entry_id uuid not null references public.published_calendar_entries(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'published_calendar',
  created_at timestamptz not null default now(),
  primary key (calendar_entry_id, issuance_id, source_role)
);

create table if not exists public.monthly_calendar_entry_sources (
  calendar_entry_id uuid not null references public.monthly_calendar_entries(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'published_calendar',
  created_at timestamptz not null default now(),
  primary key (calendar_entry_id, issuance_id, source_role)
);

-- These tables are governance data, not ordinary accountant data. No broad
-- browser write policy is created; restricted configuration commands will be
-- added with the Tax Configuration module.
alter table public.tax_type_sources enable row level security;
alter table public.bir_form_sources enable row level security;
alter table public.bir_office_sources enable row level security;
alter table public.filing_channel_sources enable row level security;
alter table public.efps_group_sources enable row level security;
alter table public.holiday_master_sources enable row level security;
alter table public.published_calendar_entry_sources enable row level security;
alter table public.monthly_calendar_entry_sources enable row level security;
