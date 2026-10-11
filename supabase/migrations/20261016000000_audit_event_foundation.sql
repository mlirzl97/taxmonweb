-- Shared append-oriented audit foundation.
-- Module commands remain the only permitted write path; direct table writes are
-- intentionally not granted by this migration.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_display text not null,
  actor_type text not null check (actor_type in ('user', 'system', 'integration')),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  effective_at timestamptz,
  occurred_at timestamptz not null default now(),
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_entity_idx
  on public.audit_events(entity_type, entity_id, occurred_at desc);

create index if not exists audit_events_actor_idx
  on public.audit_events(actor_id, occurred_at desc);

create index if not exists audit_events_correlation_idx
  on public.audit_events(correlation_id)
  where correlation_id is not null;

alter table public.audit_events enable row level security;

create policy audit_events_active_user_read on public.audit_events
  for select to authenticated
  using (public.is_active_app_user());

-- No direct INSERT, UPDATE or DELETE policies are granted. Future commands
-- must validate capability, scope, SoD and idempotency before appending.
