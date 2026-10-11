-- TaxMonWeb generated compliance work foundation.
--
-- This is the persistence boundary for the current Work/Due Register
-- capability. It is deliberately not a rules engine, obligation generator, or
-- QA model. Generation commands will reference a governed BIR requirement
-- version and must remain idempotent through generation_key.

insert into public.capabilities (key, description)
values ('MaintainGeneratedComplianceWork', 'Create and maintain generated compliance work through authorized commands.')
on conflict (key) do nothing;

create table if not exists public.generated_compliance_work (
  id uuid primary key default gen_random_uuid(),
  registration_unit_id uuid not null references public.registration_units(id) on delete restrict,
  requirement_id uuid not null references public.bir_requirements(id) on delete restrict,
  requirement_version_id uuid not null references public.bir_requirement_versions(id) on delete restrict,
  generation_key text not null unique,
  period_label text not null,
  instance_type text not null default 'recurring_period' check (instance_type in ('recurring_period', 'event', 'correction', 'reopened')),
  data_readiness text not null default 'not_ready' check (data_readiness in ('not_ready', 'ready')),
  lifecycle_stage text not null default 'preparation' check (lifecycle_stage in ('preparation', 'checking', 'review', 'client_approval', 'filing', 'payment', 'other_submissions', 'complete')),
  engagement_status text not null default 'open' check (engagement_status in ('open', 'complete', 'cancelled', 'superseded')),
  rag_status text not null default 'unresolved' check (rag_status in ('green', 'amber', 'red', 'unresolved')),
  base_statutory_deadline date,
  adjusted_statutory_deadline date,
  tmf_package_target date,
  internal_target_missed boolean not null default false,
  statutory_deadline_missed boolean not null default false,
  preparer_user_id uuid references public.app_users(id),
  checker_user_id uuid references public.app_users(id),
  reviewer_user_id uuid references public.app_users(id),
  current_owner_user_id uuid references public.app_users(id),
  components jsonb not null default '[]'::jsonb,
  source_context jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  period_locked boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint generated_work_deadline_order_check check (
    (base_statutory_deadline is null or adjusted_statutory_deadline is null or adjusted_statutory_deadline >= base_statutory_deadline)
    and (tmf_package_target is null or adjusted_statutory_deadline is null or tmf_package_target <= adjusted_statutory_deadline)
  ),
  constraint generated_work_distinct_control_actors_check check (
    preparer_user_id is null or checker_user_id is null or preparer_user_id <> checker_user_id
  ),
  constraint generated_work_distinct_reviewer_check check (
    reviewer_user_id is null or checker_user_id is null or reviewer_user_id <> checker_user_id
  )
);

create index if not exists generated_work_unit_target_idx
  on public.generated_compliance_work(registration_unit_id, tmf_package_target, engagement_status);

create index if not exists generated_work_owner_idx
  on public.generated_compliance_work(current_owner_user_id, lifecycle_stage, rag_status);

create index if not exists generated_work_requirement_period_idx
  on public.generated_compliance_work(requirement_id, period_label);

create table if not exists public.generated_compliance_work_components (
  id uuid primary key default gen_random_uuid(),
  generated_work_id uuid not null references public.generated_compliance_work(id) on delete cascade,
  component_code text not null,
  label text not null,
  component_type text not null check (component_type in ('return_filing', 'payment', 'attachment_schedule', 'electronic_submission', 'evidence', 'other')),
  requiredness text not null check (requiredness in ('mandatory', 'conditional', 'optional', 'event_driven', 'unresolved')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete', 'not_applicable', 'blocked', 'unresolved')),
  statutory_deadline date,
  evidence_state text not null default 'not_recorded' check (evidence_state in ('not_recorded', 'recorded', 'accepted', 'unresolved')),
  independent_requirement_id uuid references public.bir_requirements(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (generated_work_id, component_code)
);

create index if not exists generated_work_components_status_idx
  on public.generated_compliance_work_components(generated_work_id, status, statutory_deadline);

create table if not exists public.generated_compliance_work_events (
  id uuid primary key default gen_random_uuid(),
  generated_work_id uuid not null references public.generated_compliance_work(id) on delete restrict,
  event_kind text not null,
  actor_id uuid references auth.users(id),
  actor_display text not null,
  idempotency_key text not null unique,
  from_context jsonb,
  to_context jsonb not null,
  reason text,
  effective_at timestamptz,
  occurred_at timestamptz not null default now(),
  correlation_id uuid
);

create index if not exists generated_work_events_work_idx
  on public.generated_compliance_work_events(generated_work_id, occurred_at desc);

alter table public.generated_compliance_work enable row level security;
alter table public.generated_compliance_work_components enable row level security;
alter table public.generated_compliance_work_events enable row level security;

create policy generated_work_scoped_read on public.generated_compliance_work
  for select to authenticated
  using (
    public.can_view_registration_unit(registration_unit_id)
    or public.has_active_capability('ViewTaxControlHistory')
    or public.has_active_capability('MaintainGeneratedComplianceWork')
  );

create policy generated_work_components_scoped_read on public.generated_compliance_work_components
  for select to authenticated
  using (
    exists (
      select 1
      from public.generated_compliance_work work
      where work.id = generated_work_id
        and (
          public.can_view_registration_unit(work.registration_unit_id)
          or public.has_active_capability('ViewTaxControlHistory')
          or public.has_active_capability('MaintainGeneratedComplianceWork')
        )
    )
  );

create policy generated_work_events_scoped_read on public.generated_compliance_work_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.generated_compliance_work work
      where work.id = generated_work_id
        and (
          public.can_view_registration_unit(work.registration_unit_id)
          or public.has_active_capability('ViewTaxControlHistory')
          or public.has_active_capability('MaintainGeneratedComplianceWork')
        )
    )
  );

-- There are intentionally no direct table-write policies. Creation and
-- mutation must be added through idempotent, capability-aware server commands
-- that enforce actual-actor separation, effective dating, and audit events.
