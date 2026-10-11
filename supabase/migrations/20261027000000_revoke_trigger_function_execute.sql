-- Trigger functions are invoked by PostgreSQL, not by PostgREST clients.
-- They must not be exposed as anonymous RPCs.

revoke execute on function public.handle_new_auth_user() from anon;
revoke execute on function public.sync_tax_profile_relational_context() from anon;
