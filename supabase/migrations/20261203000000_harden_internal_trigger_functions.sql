-- These functions are trigger implementations, not application RPC commands.
-- Keep trigger behavior while removing their exposed RPC surface.

alter function public.capture_checker_tax_due_amount() set search_path = public;
alter function public.guard_preparer_payment_amount() set search_path = public;
alter function public.record_payment_amount_evidence() set search_path = public;
alter function public.materialize_generated_work_components() set search_path = public;

revoke execute on function public.capture_checker_tax_due_amount() from public, anon, authenticated;
revoke execute on function public.guard_preparer_payment_amount() from public, anon, authenticated;
revoke execute on function public.record_payment_amount_evidence() from public, anon, authenticated;
revoke execute on function public.materialize_generated_work_components() from public, anon, authenticated;
