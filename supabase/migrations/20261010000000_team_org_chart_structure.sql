-- TaxMonWeb Team Lego: effective-dated career band and reporting structure.
-- Career service level is descriptive organizational data. It does not grant
-- RBAC capability, approval authority, or SoD exemption.

alter table public.team_member_profiles
  add column if not exists career_service_level text,
  add column if not exists reports_to_user_id uuid references public.app_users(id) on delete restrict;

do $$
begin
  alter table public.team_member_profiles
    add constraint team_member_profiles_career_service_level_check
    check (career_service_level is null or career_service_level in ('5.2', '5.1', '4.2', '4.1', '3.2', '3.1', '2.2', '2.1', '1.1'));
exception
  when duplicate_object then null;
end $$;

alter table public.team_member_profiles
  add constraint team_member_profiles_reports_to_self_check
  check (reports_to_user_id is null or reports_to_user_id <> user_id);

create index if not exists team_member_profiles_reports_to_idx
  on public.team_member_profiles(reports_to_user_id, effective_from, effective_to);

comment on column public.team_member_profiles.career_service_level is
  'Effective-dated career band; separate from operational role, organizational scope, and RBAC capability.';
comment on column public.team_member_profiles.reports_to_user_id is
  'Effective-dated reporting relationship for the Team org chart; not an authorization grant.';
