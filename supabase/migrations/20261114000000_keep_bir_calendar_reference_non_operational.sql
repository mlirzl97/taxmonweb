-- Official calendar rows are reference data until base-rule and applicability
-- reconciliation is complete. They must not feed client work or service dates.

update public.monthly_calendar_entries
set publication_status = 'unresolved',
    published_operational_deadline = null,
    tmf_package_target = null,
    notes = 'Official BIR calendar reference only. Operational publication requires reconciled rule, applicability, and Tax Team release control.'
where source_issuance_id = (
  select id from public.regulatory_issuances
  where code = 'BIR-2026-INTERACTIVE-TAX-CALENDAR'
)
  and source_locator like 'dataset:1135/record:%';
