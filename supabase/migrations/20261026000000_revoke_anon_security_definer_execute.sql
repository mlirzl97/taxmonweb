-- Database boundary hardening.
--
-- Supabase/PostgREST grants EXECUTE on newly exposed functions broadly by
-- default. SECURITY DEFINER functions must never be callable by anon: every
-- application command/query is expected to arrive through an authenticated,
-- server-authorized boundary or an authenticated RLS context.

alter default privileges in schema public
  revoke execute on functions from anon;

do $$
declare
  function_record record;
begin
  for function_record in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from anon',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
  end loop;
end;
$$;

alter function public.normalized_rdo_lookup_key(text)
  set search_path = public, pg_temp;

alter function public.enforce_tax_profile_assignment_separation()
  set search_path = public, pg_temp;
