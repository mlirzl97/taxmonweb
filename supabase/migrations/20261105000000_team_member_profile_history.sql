-- Preserve prior Team profile facts when the current operating row changes.
-- The current table remains the read-optimized current projection; this table
-- keeps the effective-dated snapshots needed for governance and audit review.

create table if not exists public.team_member_profile_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_key text not null,
  title text not null,
  organization_unit_id uuid not null references public.organization_units(id),
  effective_from date not null,
  effective_to date,
  active boolean not null,
  career_service_level text,
  reports_to_user_id uuid references public.app_users(id),
  operating_model text not null,
  reporting_line_exception_reason text,
  superseded_at timestamptz not null default now(),
  superseded_by uuid references auth.users(id),
  change_reason text not null,
  constraint team_member_profile_history_dates_check check (effective_to is null or effective_to >= effective_from)
);

create index if not exists team_member_profile_history_user_idx
  on public.team_member_profile_history(user_id, superseded_at desc);

alter table public.team_member_profile_history enable row level security;

create policy team_member_profile_history_scoped_read on public.team_member_profile_history
  for select to authenticated using (public.can_view_team_member(user_id));

create or replace function public.capture_team_member_profile_history()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if row(
    old.role_key, old.title, old.organization_unit_id, old.effective_from,
    old.effective_to, old.active, old.career_service_level,
    old.reports_to_user_id, old.operating_model,
    old.reporting_line_exception_reason
  ) is distinct from row(
    new.role_key, new.title, new.organization_unit_id, new.effective_from,
    new.effective_to, new.active, new.career_service_level,
    new.reports_to_user_id, new.operating_model,
    new.reporting_line_exception_reason
  ) then
    insert into public.team_member_profile_history (
      user_id, role_key, title, organization_unit_id, effective_from, effective_to,
      active, career_service_level, reports_to_user_id, operating_model,
      reporting_line_exception_reason, superseded_by, change_reason
    ) values (
      old.user_id, old.role_key, old.title, old.organization_unit_id, old.effective_from, old.effective_to,
      old.active, old.career_service_level, old.reports_to_user_id, old.operating_model,
      old.reporting_line_exception_reason, auth.uid(),
      coalesce(nullif(trim(new.reporting_line_exception_reason), ''), 'Superseded by an authorized Team profile update.')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists team_member_profile_history_capture on public.team_member_profiles;
create trigger team_member_profile_history_capture
  after update on public.team_member_profiles
  for each row execute function public.capture_team_member_profile_history();

revoke execute on function public.capture_team_member_profile_history() from public;

comment on table public.team_member_profile_history is
  'Append-only snapshots of superseded Team profile assignments and reporting context.';
