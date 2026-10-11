-- PostgreSQL's PUBLIC role can otherwise reintroduce anonymous execution even
-- after a direct revoke from anon. Keep the existing authenticated RPC surface
-- while making the boundary explicit for every public SECURITY DEFINER function.

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
      'revoke execute on function %I.%I(%s) from public, anon',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
  end loop;
end;
$$;
