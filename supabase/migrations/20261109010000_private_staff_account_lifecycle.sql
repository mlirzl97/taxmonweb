-- Private-app identity lifecycle.
-- Auth identity creation and TaxMonWeb workspace activation are deliberately
-- separate: a new Auth user starts pending until an authorized staff setup is
-- complete and the user activates their own password.

alter table public.app_users
  add column if not exists account_status text not null default 'pending',
  add column if not exists activation_sent_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists last_password_reset_at timestamptz;

do $$
begin
  alter table public.app_users
    add constraint app_users_account_status_check
    check (account_status in ('pending', 'active', 'suspended', 'retired'));
exception
  when duplicate_object then null;
end $$;

create index if not exists app_users_account_status_idx
  on public.app_users(account_status, is_active);

comment on column public.app_users.account_status is
  'TaxMonWeb access lifecycle; Auth identity existence alone never grants workspace access.';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.app_users (
    id, display_name, is_active, account_status, activation_sent_at
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.email, 'TaxMonWeb user'),
    false,
    'pending',
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where id = auth.uid()
      and is_active = true
      and account_status = 'active'
  );
$$;

create or replace function public.activate_staff_account()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  activated_user public.app_users;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required to activate the account.';
  end if;

  if not exists (
    select 1 from public.team_member_profiles profile
    where profile.user_id = auth.uid()
      and profile.active = true
      and profile.effective_from <= current_date
      and (profile.effective_to is null or profile.effective_to >= current_date)
  ) then
    raise exception using errcode = '42501', message = 'Staff setup is incomplete. Ask an authorized administrator to finish the setup.';
  end if;

  if not exists (
    select 1 from public.user_capability_assignments assignment
    where assignment.user_id = auth.uid()
      and assignment.effective_from <= current_date
      and (assignment.effective_to is null or assignment.effective_to >= current_date)
  ) then
    raise exception using errcode = '42501', message = 'Access rights are not configured. Ask an authorized administrator to finish the setup.';
  end if;

  if not exists (
    select 1 from public.user_scope_assignments scope
    where scope.user_id = auth.uid()
      and scope.effective_from <= current_date
      and (scope.effective_to is null or scope.effective_to >= current_date)
  ) then
    raise exception using errcode = '42501', message = 'Access scope is not configured. Ask an authorized administrator to finish the setup.';
  end if;

  update public.app_users
     set is_active = true,
         account_status = 'active',
         activated_at = coalesce(activated_at, now()),
         updated_at = now()
   where id = auth.uid()
     and account_status = 'pending'
  returning * into activated_user;

  if not found then
    if exists (select 1 from public.app_users where id = auth.uid() and account_status = 'active') then
      return jsonb_build_object('status', 'active', 'userId', auth.uid());
    end if;
    raise exception using errcode = '42501', message = 'This account is not eligible for activation.';
  end if;

  perform public.append_audit_event(
    'staff_account.activated',
    'app_user',
    activated_user.id::text,
    'Staff account activated after controlled setup and password creation.',
    jsonb_build_object('status', 'pending', 'isActive', false),
    jsonb_build_object('status', 'active', 'isActive', true),
    'Employee completed the controlled account activation flow.',
    now(),
    null
  );

  return jsonb_build_object('status', 'active', 'userId', activated_user.id);
end;
$$;

create or replace function public.record_password_reset()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required to record a password reset.';
  end if;

  update public.app_users
     set last_password_reset_at = now(), updated_at = now()
   where id = auth.uid()
     and is_active = true
     and account_status = 'active';

  if not found then
    raise exception using errcode = '42501', message = 'This account is not active.';
  end if;

  perform public.append_audit_event(
    'staff_account.password_reset',
    'app_user',
    auth.uid()::text,
    'Staff member completed a password reset.',
    null,
    jsonb_build_object('passwordResetAt', now()),
    'Password value is never recorded.',
    now(),
    null
  );
end;
$$;

revoke execute on function public.activate_staff_account() from public;
revoke execute on function public.record_password_reset() from public;
grant execute on function public.activate_staff_account() to authenticated;
grant execute on function public.record_password_reset() to authenticated;

drop policy if exists app_users_self_read on public.app_users;
create policy app_users_scoped_read on public.app_users
  for select to authenticated
  using (id = (select auth.uid()) or public.can_view_team_member(id));
