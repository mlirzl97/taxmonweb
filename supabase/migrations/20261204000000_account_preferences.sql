-- Personal appearance preferences belong to the authenticated account.
-- Demo mode intentionally continues to use browser-local preferences.

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system'
    check (theme in ('system', 'light', 'dark')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self_read on public.user_preferences;
create policy user_preferences_self_read
  on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_preferences_self_insert on public.user_preferences;
create policy user_preferences_self_insert
  on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_preferences_self_update on public.user_preferences;
create policy user_preferences_self_update
  on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('taxmon-user-avatars', 'taxmon-user-avatars', false)
on conflict (id) do update set public = false;

drop policy if exists taxmon_user_avatars_self_read on storage.objects;
create policy taxmon_user_avatars_self_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'taxmon-user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists taxmon_user_avatars_self_insert on storage.objects;
create policy taxmon_user_avatars_self_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'taxmon-user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists taxmon_user_avatars_self_update on storage.objects;
create policy taxmon_user_avatars_self_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'taxmon-user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'taxmon-user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists taxmon_user_avatars_self_delete on storage.objects;
create policy taxmon_user_avatars_self_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'taxmon-user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
