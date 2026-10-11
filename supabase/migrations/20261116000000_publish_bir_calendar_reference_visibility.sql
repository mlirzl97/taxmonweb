-- The annual table is a published-source projection, not an operational
-- deadline release. "not_comparable" keeps it visible to authenticated users
-- while stating that base-rule reconciliation has not been asserted.

update public.published_calendar_entries
set notes = 'Official BIR published calendar reference. Base statutory rule, adjustment basis, and taxpayer applicability remain separately governed.'
where source_issuance_id = (
  select id from public.regulatory_issuances
  where code = 'BIR-2026-INTERACTIVE-TAX-CALENDAR'
)
  and source_locator like 'dataset:1135/record:%';

drop policy if exists published_calendar_verified_reference_read on public.published_calendar_entries;
create policy published_calendar_verified_reference_read
  on public.published_calendar_entries for select to authenticated
  using (validation_status in ('match', 'not_comparable', 'unresolved'));
