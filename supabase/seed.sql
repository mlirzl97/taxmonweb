-- Sanitized development fixtures only. Never run this against production.

insert into public.organization_units (code, name, unit_kind)
values
  ('FIXTURE-TOWER-NORTH', 'Tower North (synthetic)', 'tower'),
  ('FIXTURE-TOWER-CENTRAL', 'Tower Central (synthetic)', 'tower'),
  ('FIXTURE-TOWER-SOUTH', 'Tower South (synthetic)', 'tower')
on conflict (code) do nothing;

insert into public.clients (reference_code, display_name, status)
values
  ('FIXTURE-CLIENT-01', 'Northstar Components (synthetic)', 'active'),
  ('FIXTURE-CLIENT-02', 'Harborline Services (synthetic)', 'active'),
  ('FIXTURE-CLIENT-03', 'Cedarfield Holdings (synthetic)', 'active')
on conflict (reference_code) do nothing;

insert into public.taxpayer_entities (client_id, reference_code, display_name, tin_status)
select id, 'FIXTURE-ENTITY-01', 'Northstar Taxpayer (synthetic)', 'unresolved'
from public.clients where reference_code = 'FIXTURE-CLIENT-01'
on conflict (reference_code) do nothing;

insert into public.taxpayer_entities (client_id, reference_code, display_name, tin_status)
select id, 'FIXTURE-ENTITY-02', 'Harborline Taxpayer (synthetic)', 'unresolved'
from public.clients where reference_code = 'FIXTURE-CLIENT-02'
on conflict (reference_code) do nothing;

insert into public.taxpayer_entities (client_id, reference_code, display_name, tin_status)
select id, 'FIXTURE-ENTITY-03', 'Cedarfield Taxpayer (synthetic)', 'unresolved'
from public.clients where reference_code = 'FIXTURE-CLIENT-03'
on conflict (reference_code) do nothing;

insert into public.registration_units (taxpayer_entity_id, reference_code, display_name, unit_kind, registration_reference)
select id, 'FIXTURE-RU-01', 'Northstar Head Office (synthetic)', 'head_office', 'synthetic-registration-01'
from public.taxpayer_entities where reference_code = 'FIXTURE-ENTITY-01'
on conflict (reference_code) do nothing;

insert into public.registration_units (taxpayer_entity_id, reference_code, display_name, unit_kind, registration_reference)
select id, 'FIXTURE-RU-02', 'Harborline Head Office (synthetic)', 'head_office', 'synthetic-registration-02'
from public.taxpayer_entities where reference_code = 'FIXTURE-ENTITY-02'
on conflict (reference_code) do nothing;

insert into public.registration_units (taxpayer_entity_id, reference_code, display_name, unit_kind, registration_reference)
select id, 'FIXTURE-RU-03', 'Cedarfield Head Office (synthetic)', 'head_office', 'synthetic-registration-03'
from public.taxpayer_entities where reference_code = 'FIXTURE-ENTITY-03'
on conflict (reference_code) do nothing;

insert into public.registration_unit_scope_assignments (registration_unit_id, organization_unit_id, reason)
select ru.id, ou.id, 'Synthetic fixture portfolio assignment'
from public.registration_units ru
join public.organization_units ou on ou.code = case ru.reference_code
  when 'FIXTURE-RU-01' then 'FIXTURE-TOWER-NORTH'
  when 'FIXTURE-RU-02' then 'FIXTURE-TOWER-CENTRAL'
  when 'FIXTURE-RU-03' then 'FIXTURE-TOWER-SOUTH'
end
where ru.reference_code in ('FIXTURE-RU-01', 'FIXTURE-RU-02', 'FIXTURE-RU-03')
  and not exists (
    select 1 from public.registration_unit_scope_assignments existing
    where existing.registration_unit_id = ru.id
      and existing.organization_unit_id = ou.id
  );

insert into public.registration_source_references (registration_unit_id, source_kind, source_system, source_reference, document_version, status, notes)
select id, 'bir_form_2303', 'synthetic_fixture', 'synthetic-2303-01', 'fixture-v1', 'needs_review', 'Synthetic reference only; no binary document stored.'
from public.registration_units where reference_code = 'FIXTURE-RU-01'
and not exists (select 1 from public.registration_source_references where source_reference = 'synthetic-2303-01');

insert into public.registration_source_references (registration_unit_id, source_kind, source_system, source_reference, document_version, status, notes)
select id, 'bir_form_2303', 'synthetic_fixture', 'synthetic-2303-02', 'fixture-v1', 'needs_review', 'Synthetic reference only; no binary document stored.'
from public.registration_units where reference_code = 'FIXTURE-RU-02'
and not exists (select 1 from public.registration_source_references where source_reference = 'synthetic-2303-02');

insert into public.registration_source_references (registration_unit_id, source_kind, source_system, source_reference, document_version, status, notes)
select id, 'bir_form_2303', 'synthetic_fixture', 'synthetic-2303-03', 'fixture-v1', 'needs_review', 'Synthetic reference only; no binary document stored.'
from public.registration_units where reference_code = 'FIXTURE-RU-03'
and not exists (select 1 from public.registration_source_references where source_reference = 'synthetic-2303-03');

-- Source-backed tax foundation references. This is deliberately not a complete
-- Philippine requirement/calendar seed. Unreconciled legal content remains
-- unresolved until it is mapped to an authoritative row-level source.
insert into public.regulatory_issuances
  (code, issuance_type, title, issuing_body, source_url, publication_date, verification_status, status, notes)
values
  ('BIR-RMC-110-2025', 'revenue_memorandum_circular', 'Availability of the 2026 BIR Interactive Tax Calendar on the BIR Website', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%20110-2025.pdf', '2025-12-26', 'verified', 'active', 'Official announcement of the 2026 interactive calendar and linked forms, attachments/reports, directory, and payment references.'),
  ('BIR-FORMS-CATALOG', 'bir_form_instruction', 'BIR Forms catalog', 'Bureau of Internal Revenue', 'https://www.bir.gov.ph/bir-forms', null, 'verified', 'active', 'Official catalog endpoint; individual titles and revisions require row-level reconciliation.'),
  ('BIR-EFPS-JOBAIDS', 'bir_form_instruction', 'eFPS Jobaids', 'Bureau of Internal Revenue', 'https://efps.bir.gov.ph/efps-war/efpsJobaids.xhtml', null, 'partially_verified', 'active', 'Official eFPS reference exposing form job aids; channel applicability remains rule-level content.'),
  ('BIR-RR-RDO-DIRECTORY-2024', 'other_authority', 'Directory Revenue Regions and District Offices', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/citizens-charter-rr-rdo-2024-v3.pdf', '2024-01-01', 'partially_verified', 'active', 'Official directory reference; current office status/effective dating requires reconciliation.'),
  ('PH-OFFICIAL-GAZETTE', 'holiday_authority', 'Official Gazette of the Republic of the Philippines', 'Republic of the Philippines', 'https://officialgazette.gov.ph/', null, 'verified', 'active', 'Authoritative publication index for proclamations and holiday authorities.'),
  ('PH-PROC-1006-2025', 'holiday_authority', 'Proclamation No. 1006, s. 2025 — 2026 regular and special non-working days', 'Republic of the Philippines', 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/7/99678', '2025-09-03', 'verified', 'active', 'Government proclamation reproduced by the Supreme Court E-Library; holiday source only, not an automatic BIR adjustment rule.'),
  ('PH-PROC-1189-2026', 'holiday_authority', 'Proclamation No. 1189, s. 2026 — Eid’l Fitr', 'Republic of the Philippines', 'https://pco.gov.ph/news_releases/proclamation-no-1189-s-2026-declaring-friday-20-march-2026-a-regular-holiday-throughout-the-country-in-observance-of-eidl-fitr-feast-of-ramadhan/', '2026-03-12', 'verified', 'active', 'Government announcement of the 2026 national holiday date.'),
  ('PH-PROC-1264-2026', 'holiday_authority', 'Proclamation No. 1264, s. 2026 — Eid’l Adha', 'Republic of the Philippines', 'https://pco.gov.ph/news_releases/palace-declares-may-27-as-a-regular-holiday-for-eidl-adha-observance/', '2026-05-21', 'verified', 'active', 'Government announcement of the 2026 national holiday date.'),
  ('BIR-RMC-55-2026', 'revenue_memorandum_circular', 'Reminder on alphalist submission obligations for withholding agents', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2055-2026%20Digest.pdf', '2026-05-26', 'verified', 'active', 'Official 2026 circular; requirement identity and exceptions still require normalization.'),
  ('BIR-RMC-25-2024', 'revenue_memorandum_circular', 'Quarterly Alphalist of Payees file structure', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2025-2024%20Annex%20A.pdf', '2024-01-01', 'partially_verified', 'active', 'Official QAP file-structure reference.'),
  ('BIR-RMC-3-2006', 'revenue_memorandum_circular', 'SAWT and MAP electronic file structure and attachment guidance', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/27815rmc%2003-2006.pdf', '2006-01-18', 'partially_verified', 'active', 'Official SAWT/MAP attachment reference; current applicability requires reconciliation.'),
  ('BIR-RMC-34-2025', 'revenue_memorandum_circular', 'Submission of required attachments', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2034-2025%20Annex%20C.pdf', '2025-04-01', 'partially_verified', 'active', 'Official attachment/submission reference.'),
  ('BIR-RMC-46-2026', 'revenue_memorandum_circular', 'eAFS submission procedure and 2025 AFS extension', 'Bureau of Internal Revenue', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2046-2026%20Digest.pdf', '2026-05-18', 'verified', 'active', 'Official example of a specific eAFS extension and its boundary.'),
  ('BIR-TAX-REMINDER-2026', 'bir_calendar', 'BIR Tax Reminder / 2026 published reminder entries', 'Bureau of Internal Revenue', 'https://www.bir.gov.ph/Tax-Reminder?q=Orus', null, 'partially_verified', 'active', 'Official reminder surface used as a validation/reference dataset.')
on conflict (code) do nothing;

insert into public.tax_types (code, label, operating_category, effective_from, verification_status, status, notes)
values
  ('CIT', 'CIT', 'cit', '2026-01-01', 'verified', 'active', 'Operating category; detailed legal tax types may map here.'),
  ('VAT', 'VAT', 'vat_percentage', '2026-01-01', 'verified', 'active', 'Operating category mapping is intentionally simple.'),
  ('PERCENTAGE_TAX', 'Percentage Tax', 'vat_percentage', '2026-01-01', 'verified', 'active', 'Operating category mapping is intentionally simple.'),
  ('WHT', 'Withholding Tax', 'wht', '2026-01-01', 'verified', 'active', 'Operating category; detailed legal tax types may map here.'),
  ('OTHERS', 'Others', 'others', '2026-01-01', 'verified', 'active', 'Catch-all operating category for other sourced requirements.')
on conflict (code) do nothing;

insert into public.filing_channels (code, label, effective_from, verification_status, status, notes)
values
  ('EFPS', 'eFPS', '2026-01-01', 'verified', 'active', 'Referenced by official BIR eFPS job aids.'),
  ('EBIRFORMS', 'eBIRForms', '2026-01-01', 'partially_verified', 'active', 'Requires row-level applicability reconciliation.'),
  ('ESUBMISSION', 'eSubmission', '2026-01-01', 'partially_verified', 'active', 'Requires row-level requirement and channel reconciliation.'),
  ('EAFS', 'eAFS', '2026-01-01', 'partially_verified', 'active', 'Requires row-level requirement and channel reconciliation.'),
  ('UNRESOLVED', 'Unresolved channel', '2026-01-01', 'unresolved', 'active', 'Visible configuration value; not a legal conclusion.')
on conflict (code) do nothing;

insert into public.bir_forms (form_number, title, revision_label, verification_status, status, notes)
values
  ('0605', 'BIR Form 0605', 'unresolved', 'partially_verified', 'active', 'Form number exposed by official eFPS job-aids page; title/revision and requirement mapping remain under reconciliation.'),
  ('1600', 'BIR Form 1600', 'unresolved', 'partially_verified', 'active', 'Form number exposed by official eFPS job-aids page; title/revision and requirement mapping remain under reconciliation.'),
  ('1600WP', 'BIR Form 1600WP', 'unresolved', 'partially_verified', 'active', 'Form number exposed by official eFPS job-aids page; title/revision and requirement mapping remain under reconciliation.'),
  ('1601C', 'BIR Form 1601C', 'unresolved', 'partially_verified', 'active', 'Form number exposed by official eFPS job-aids page; title/revision and requirement mapping remain under reconciliation.')
on conflict (form_number, revision_label) do nothing;

insert into public.bir_facilities
  (code, name, facility_kind, public_url, status, verification_status, source_issuance_id, notes)
select facility.code, facility.name, facility.facility_kind, facility.public_url, 'active', facility.verification_status, source.id, facility.notes
from (
  values
    ('EFPS', 'Electronic Filing and Payment System', 'efps', 'https://efps.bir.gov.ph/', 'verified', 'Official eFPS facility reference.'),
    ('EAFS', 'Electronic Audited Financial Statements', 'eafs', 'https://www.bir.gov.ph/home', 'partially_verified', 'Official BIR site identifies eAFS; facility-to-requirement mapping remains under reconciliation.'),
    ('EBIRFORMS', 'eBIRForms', 'ebirforms', 'https://www.bir.gov.ph/home', 'partially_verified', 'Official BIR site identifies eBIRForms; facility-to-requirement mapping remains under reconciliation.'),
    ('ORUS', 'Online Registration and Update System', 'orus', 'https://www.bir.gov.ph/home', 'partially_verified', 'Official BIR site identifies ORUS; operational applicability remains under reconciliation.')
) as facility(code, name, facility_kind, public_url, verification_status, notes)
join public.regulatory_issuances source on source.code = case
  when facility.code = 'EFPS' then 'BIR-EFPS-JOBAIDS'
  else 'BIR-TAX-REMINDER-2026'
end
on conflict (code) do nothing;

insert into public.facility_filing_channels (facility_id, filing_channel_id, effective_from)
select facility.id, channel.id, '2026-01-01'
from public.bir_facilities facility
join public.filing_channels channel on channel.code = facility.code
where facility.code in ('EFPS', 'EAFS', 'EBIRFORMS')
on conflict do nothing;

insert into public.holiday_master
  (holiday_date, holiday_name, holiday_kind, effective_from, verification_status, status, source_issuance_id)
select holiday_date, holiday_name, holiday_kind, '2026-01-01', 'verified', 'approved', source.id
from (
  values
    ('2026-01-01'::date, 'New Year’s Day', 'regular'),
    ('2026-02-17'::date, 'Chinese New Year', 'special_non_working'),
    ('2026-03-20'::date, 'Eid’l Fitr', 'regular'),
    ('2026-04-02'::date, 'Maundy Thursday', 'regular'),
    ('2026-04-03'::date, 'Good Friday', 'regular'),
    ('2026-04-04'::date, 'Black Saturday', 'special_non_working'),
    ('2026-04-09'::date, 'Araw ng Kagitingan', 'regular'),
    ('2026-05-01'::date, 'Labor Day', 'regular'),
    ('2026-05-27'::date, 'Eid’l Adha', 'regular'),
    ('2026-06-12'::date, 'Independence Day', 'regular'),
    ('2026-08-21'::date, 'Ninoy Aquino Day', 'special_non_working'),
    ('2026-08-31'::date, 'National Heroes Day', 'regular'),
    ('2026-11-01'::date, 'All Saints’ Day', 'special_non_working'),
    ('2026-11-02'::date, 'All Souls’ Day', 'special_non_working'),
    ('2026-11-30'::date, 'Bonifacio Day', 'regular'),
    ('2026-12-08'::date, 'Feast of the Immaculate Conception of Mary', 'special_non_working'),
    ('2026-12-24'::date, 'Christmas Eve', 'special_non_working'),
    ('2026-12-25'::date, 'Christmas Day', 'regular'),
    ('2026-12-30'::date, 'Rizal Day', 'regular'),
    ('2026-12-31'::date, 'Last Day of the Year', 'special_non_working')
) as holiday(holiday_date, holiday_name, holiday_kind)
cross join public.regulatory_issuances source
where source.code = case
  when holiday.holiday_date in ('2026-03-20'::date) then 'PH-PROC-1189-2026'
  when holiday.holiday_date in ('2026-05-27'::date) then 'PH-PROC-1264-2026'
  else 'PH-PROC-1006-2025'
end
and not exists (
  select 1 from public.holiday_master existing
  where existing.holiday_date = holiday.holiday_date
    and existing.holiday_name = holiday.holiday_name
);
