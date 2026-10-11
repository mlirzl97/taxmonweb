-- Audit history is not a tenant-wide public feed. Staff may inspect their own
-- actor history; governed control roles may inspect the wider audit ledger.

drop policy if exists audit_events_active_user_read on public.audit_events;
create policy audit_events_scoped_read on public.audit_events
  for select to authenticated
  using (
    public.is_active_app_user()
    and (
      actor_id = auth.uid()
      or public.has_active_capability('ViewTaxControlHistory')
    )
  );
