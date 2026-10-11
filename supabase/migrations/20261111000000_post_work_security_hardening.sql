-- Keep helper functions out of the public RPC surface after later migrations
-- recreate them; RLS and server-side commands call them internally.

alter function public.normalized_rdo_lookup_key(text)
  set search_path = public, pg_temp;

revoke execute on function public.normalized_rdo_lookup_key(text)
  from public, anon;

revoke execute on function public.can_view_generated_work(uuid)
  from public, anon;

grant execute on function public.can_view_generated_work(uuid)
  to authenticated;
