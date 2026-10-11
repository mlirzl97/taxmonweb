-- Deadline publication boundary and client applicability projection.
-- This extends the existing Requirement/Rule/Monthly Calendar foundation. It
-- does not create a second Tax Team or Service Calendar deadline database.

alter table public.monthly_calendar_entries
  add column if not exists activity_month date,
  add column if not exists taxable_period text,
  add column if not exists filing_period text,
  add column if not exists rule_version_id uuid references public.rule_versions(id),
  add column if not exists published_operational_deadline date,
  add column if not exists publication_status text not null default 'generated'
    check (publication_status in ('generated', 'needs_review', 'confirmed', 'published', 'unresolved', 'superseded')),
  add column if not exists confirmed_by uuid,
  add column if not exists confirmed_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists published_at timestamptz,
  add column if not exists adjustment_reason text,
  add column if not exists deadline_explanation jsonb not null default '{}'::jsonb;

comment on column public.monthly_calendar_entries.base_statutory_deadline is 'Rule-derived statutory date before approved weekend/holiday/regulatory adjustment.';
comment on column public.monthly_calendar_entries.adjusted_statutory_deadline is 'Statutory date after an approved adjustment; it is not the TMF internal target.';
comment on column public.monthly_calendar_entries.published_operational_deadline is 'Tax Team-confirmed operational date released for downstream projections.';
comment on column public.monthly_calendar_entries.tmf_package_target is 'Internal TMF target, normally one Philippine working day before the earliest applicable statutory component deadline.';

create index if not exists idx_monthly_calendar_entries_publication
  on public.monthly_calendar_entries (publication_status, published_operational_deadline);

create table if not exists public.client_compliance_universe_items (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id),
  requirement_id uuid not null references public.bir_requirements(id),
  requirement_version_id uuid references public.bir_requirement_versions(id),
  selection_status text not null default 'candidate'
    check (selection_status in ('candidate', 'approved', 'excluded', 'unresolved', 'superseded')),
  effective_from date not null,
  effective_to date,
  selection_source text not null default 'profile-derived-candidate',
  decision_reason text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (registration_unit_id, requirement_id, effective_from)
);

comment on table public.client_compliance_universe_items is 'Client-specific applicability projection. It selects governed requirements; it does not store deadline truth or generated work.';

create index if not exists idx_client_compliance_universe_items_lookup
  on public.client_compliance_universe_items (registration_unit_id, selection_status, effective_from);

create table if not exists public.deadline_publication_events (
  id uuid primary key default gen_random_uuid(),
  monthly_calendar_entry_id uuid not null references public.monthly_calendar_entries(id),
  from_status text,
  to_status text not null check (to_status in ('generated', 'needs_review', 'confirmed', 'published', 'unresolved', 'superseded')),
  actor_id uuid,
  recorded_at timestamptz not null default now(),
  reason text not null,
  source_context jsonb not null default '{}'::jsonb
);

comment on table public.deadline_publication_events is 'Append-only history for deadline review, confirmation, publication, amendment, and supersession decisions.';

create index if not exists idx_deadline_publication_events_entry_time
  on public.deadline_publication_events (monthly_calendar_entry_id, recorded_at desc);

alter table public.client_compliance_universe_items enable row level security;
alter table public.deadline_publication_events enable row level security;
