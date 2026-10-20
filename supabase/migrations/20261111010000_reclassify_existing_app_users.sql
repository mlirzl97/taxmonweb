-- Data backfill for the private account lifecycle.
-- Existing Auth identities are trusted only when the prior schema already
-- contains a current Team profile, effective capability, and effective scope.
-- Everything else must go through controlled staff setup.

update public.app_users app_user
   set account_status = case when exists (
         select 1
         from public.team_member_profiles profile
         where profile.user_id = app_user.id
           and profile.active = true
           and profile.effective_from <= current_date
           and (profile.effective_to is null or profile.effective_to >= current_date)
       ) and exists (
         select 1
         from public.user_capability_assignments capability
         where capability.user_id = app_user.id
           and capability.effective_from <= current_date
           and (capability.effective_to is null or capability.effective_to >= current_date)
       ) and exists (
         select 1
         from public.user_scope_assignments scope
         where scope.user_id = app_user.id
           and scope.effective_from <= current_date
           and (scope.effective_to is null or scope.effective_to >= current_date)
       ) then 'active' else 'pending' end,
       is_active = exists (
         select 1
         from public.team_member_profiles profile
         where profile.user_id = app_user.id
           and profile.active = true
           and profile.effective_from <= current_date
           and (profile.effective_to is null or profile.effective_to >= current_date)
       ) and exists (
         select 1
         from public.user_capability_assignments capability
         where capability.user_id = app_user.id
           and capability.effective_from <= current_date
           and (capability.effective_to is null or capability.effective_to >= current_date)
       ) and exists (
         select 1
         from public.user_scope_assignments scope
         where scope.user_id = app_user.id
           and scope.effective_from <= current_date
           and (scope.effective_to is null or scope.effective_to >= current_date)
       ),
       updated_at = now();
