-- Read-only reference access for the BIR Center.
-- Office codes and names are public BIR directory data. Writes remain
-- restricted; this policy does not expose draft/superseded rows.

drop policy if exists bir_offices_active_reference_read on public.bir_offices;

create policy bir_offices_active_reference_read
  on public.bir_offices
  for select
  to anon, authenticated
  using (
    status = 'active'
    and verification_status in ('verified', 'partially_verified')
  );
