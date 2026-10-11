-- Trigger functions are invoked by PostgreSQL, not by PostgREST clients.
-- Keep them out of the authenticated RPC surface as well as anon.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.sync_tax_profile_relational_context() from public, anon, authenticated;
