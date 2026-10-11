-- Trigger helpers are not application RPCs. Keep them callable by PostgreSQL
-- triggers only, not by anon/authenticated clients through PostgREST.

revoke execute on function public.block_closed_generated_work_change() from public, anon, authenticated;
revoke execute on function public.block_closed_generated_work_row_change() from public, anon, authenticated;
revoke execute on function public.prevent_period_reopen() from public, anon, authenticated;
revoke execute on function public.close_generated_work_period() from public, anon, authenticated;

create or replace function public.generated_work_accounting_period_key(target_work public.generated_compliance_work)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(trim(target_work.period_key), ''), lower(regexp_replace(trim(target_work.period_label), '\s+', '-', 'g')));
$$;
