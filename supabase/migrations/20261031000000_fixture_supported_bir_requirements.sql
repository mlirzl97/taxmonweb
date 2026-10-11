-- Source-backed requirement slice for the sanitized fixture conversion.
--
-- This is deliberately not the complete Philippine BIR universe. The rows
-- remain draft/partially_verified until the wider requirement, applicability,
-- component, and deadline reconciliation is completed. Draft rows cannot be
-- selected into a Client Compliance Universe or used to generate work.

insert into public.regulatory_issuances
  (code, issuance_type, title, issuing_body, source_url, retrieval_date,
   verification_status, status, notes)
values
  (
    'BIR-FORM-1601C-2018-EFPS',
    'bir_form_instruction',
    'BIR Form 1601-C — Monthly Remittance Return of Income Taxes Withheld on Compensation',
    'Bureau of Internal Revenue',
    'https://efps.bir.gov.ph/efps-war/EFPSWeb_war/forms/1601C/1601c_v3.xhtml',
    date '2026-10-09',
    'verified',
    'active',
    'Official BIR eFPS form page. Requirement applicability and deadline rule remain separately governed.'
  ),
  (
    'BIR-FORM-1601EQ-2019-GUIDE',
    'bir_form_instruction',
    'Guidelines and Instructions for BIR Form 1601-EQ — January 2019 ENCS',
    'Bureau of Internal Revenue',
    'https://bir-cdn.bir.gov.ph/local/pdf/1601-EQ%20Guide%20January%202019%20ENCS%20rev.pdf',
    date '2026-10-09',
    'verified',
    'active',
    'Official BIR form instruction. The guide identifies the quarterly return and QAP attachment; applicability and current rule versions remain separately governed.'
  ),
  (
    'BIR-FORM-2550Q-2024',
    'bir_form_instruction',
    'BIR Form 2550Q — Quarterly Value-Added Tax Return',
    'Bureau of Internal Revenue',
    'https://bir-cdn.bir.gov.ph/BIR/pdf/2550Q%20%20April%202024%20ENCS_Final.pdf',
    date '2026-10-09',
    'verified',
    'active',
    'Official BIR form PDF. Taxpayer applicability and deadline rules remain separately governed.'
  ),
  (
    'BIR-FORM-1702RT-2018',
    'bir_form_instruction',
    'BIR Form 1702-RT — Annual Income Tax Return for Corporation, Partnership and Other Non-Individual Taxpayer Subject Only to Regular Income Tax Rate',
    'Bureau of Internal Revenue',
    'https://www.bir.gov.ph/bir-forms?tab=Income+Tax+Return',
    date '2026-10-09',
    'verified',
    'active',
    'Official BIR forms catalog and eFPS form reference. Taxpayer applicability and deadline rules remain separately governed.'
  )
on conflict (code) do update set
  title = excluded.title,
  source_url = excluded.source_url,
  retrieval_date = excluded.retrieval_date,
  verification_status = excluded.verification_status,
  status = excluded.status,
  notes = excluded.notes;

insert into public.regulatory_issuance_citations
  (issuance_id, locator, page_reference, section_reference, quote_or_summary)
select source.id, citation.locator, citation.page_reference,
       citation.section_reference, citation.quote_or_summary
from (
  values
    ('BIR-FORM-1601C-2018-EFPS', 'form-page', 'Page 1', 'Form title', 'Monthly Remittance Return of Income Taxes Withheld on Compensation'),
    ('BIR-FORM-1601EQ-2019-GUIDE', 'guidelines', 'Guide', 'Who Shall File', 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)'),
    ('BIR-FORM-1601EQ-2019-GUIDE', 'guidelines', 'Guide', 'Required Attachments', 'Quarterly Alphalist of Payees (QAP) and submission acknowledgement/validation proof are identified in the guide.'),
    ('BIR-FORM-2550Q-2024', 'form-pdf', 'Form', 'Form title', 'Quarterly Value-Added Tax Return'),
    ('BIR-FORM-1702RT-2018', 'forms-catalog', 'Catalog', 'Form description', 'Annual Income Tax Return for Corporation, Partnership and Other Non-Individual Taxpayer Subject Only to REGULAR Income Tax Rate')
) as citation(code, locator, page_reference, section_reference, quote_or_summary)
join public.regulatory_issuances source on source.code = citation.code
where not exists (
  select 1
  from public.regulatory_issuance_citations existing
  where existing.issuance_id = source.id
    and existing.locator = citation.locator
    and existing.page_reference = citation.page_reference
    and existing.section_reference = citation.section_reference
);

insert into public.bir_forms
  (form_number, title, revision_label, status, verification_status, notes)
values
  ('1601-C', 'Monthly Remittance Return of Income Taxes Withheld on Compensation', 'January 2018 ENCS', 'active', 'verified', 'Fixture-supported source record; applicability and deadlines are not implied by this form row.'),
  ('1601-EQ', 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)', 'January 2019 ENCS', 'active', 'verified', 'Fixture-supported source record; applicability and deadlines are not implied by this form row.'),
  ('2550Q', 'Quarterly Value-Added Tax Return', 'April 2024 ENCS', 'active', 'verified', 'Fixture-supported source record; applicability and deadlines are not implied by this form row.'),
  ('1702-RT', 'Annual Income Tax Return for Corporation, Partnership and Other Non-Individual Taxpayer Subject Only to Regular Income Tax Rate', 'January 2018 ENCS', 'active', 'verified', 'Fixture-supported source record; applicability and deadlines are not implied by this form row.')
on conflict (form_number, revision_label) do update set
  title = excluded.title,
  status = excluded.status,
  verification_status = excluded.verification_status,
  notes = excluded.notes;

insert into public.bir_form_sources (bir_form_id, issuance_id, source_role)
select form.id, source.id, 'official_form'
from (
  values
    ('1601-C', 'January 2018 ENCS', 'BIR-FORM-1601C-2018-EFPS'),
    ('1601-EQ', 'January 2019 ENCS', 'BIR-FORM-1601EQ-2019-GUIDE'),
    ('2550Q', 'April 2024 ENCS', 'BIR-FORM-2550Q-2024'),
    ('1702-RT', 'January 2018 ENCS', 'BIR-FORM-1702RT-2018')
) as source_map(form_number, revision_label, issuance_code)
join public.bir_forms form
  on form.form_number = source_map.form_number
 and form.revision_label = source_map.revision_label
join public.regulatory_issuances source on source.code = source_map.issuance_code
on conflict (bir_form_id, issuance_id, source_role) do nothing;

insert into public.bir_requirements
  (requirement_code, requirement_name, requirement_type, operating_category,
   frequency_label, legal_cadence_code, applicability_class, status,
   verification_status, effective_from, notes)
values
  ('BIR-1601-C', 'Monthly remittance of income taxes withheld on compensation', 'primary', 'wht', 'monthly', 'monthly', 'conditional', 'draft', 'partially_verified', date '2018-01-01', 'Fixture-supported catalog candidate. Withholding-agent applicability and current deadline rule require separate governed reconciliation.'),
  ('BIR-1601-EQ', 'Quarterly remittance of creditable income taxes withheld (expanded)', 'primary', 'wht', 'quarterly', 'quarterly', 'conditional', 'draft', 'partially_verified', date '2019-01-01', 'Fixture-supported catalog candidate. Withholding-agent applicability, QAP relationship, and current deadline rule require separate governed reconciliation.'),
  ('BIR-2550Q', 'Quarterly value-added tax return', 'primary', 'vat_percentage', 'quarterly', 'quarterly', 'conditional', 'draft', 'partially_verified', date '2024-04-01', 'Fixture-supported catalog candidate. VAT applicability and current deadline rule require separate governed reconciliation.'),
  ('BIR-1702-RT', 'Annual income tax return for corporation, partnership and other non-individual taxpayer subject only to regular income tax rate', 'primary', 'cit', 'annual', 'annual_taxable_year', 'conditional', 'draft', 'partially_verified', date '2018-01-01', 'Fixture-supported catalog candidate. Taxpayer/regime applicability and current deadline rule require separate governed reconciliation.')
on conflict (requirement_code) do update set
  requirement_name = excluded.requirement_name,
  frequency_label = excluded.frequency_label,
  legal_cadence_code = excluded.legal_cadence_code,
  applicability_class = excluded.applicability_class,
  status = excluded.status,
  verification_status = excluded.verification_status,
  effective_from = excluded.effective_from,
  notes = excluded.notes;

insert into public.bir_requirement_versions
  (requirement_id, version_label, effective_from, status, verification_status,
   applicability_strategy, period_strategy, metadata)
select requirement.id, version.version_label, version.effective_from,
       'draft', 'partially_verified', version.applicability_strategy,
       version.period_strategy,
       jsonb_build_object('fixtureSupported', true, 'deadlineStatus', 'unresolved')
from (
  values
    ('BIR-1601-C', '2018-ENCS', date '2018-01-01', 'withholding_agent_profile', 'monthly_period'),
    ('BIR-1601-EQ', '2019-ENCS', date '2019-01-01', 'withholding_agent_profile', 'quarter_period'),
    ('BIR-2550Q', '2024-ENCS', date '2024-04-01', 'vat_registration_profile', 'quarter_period'),
    ('BIR-1702-RT', '2018-ENCS', date '2018-01-01', 'corporate_tax_profile_and_regime', 'taxable_year')
) as version(requirement_code, version_label, effective_from, applicability_strategy, period_strategy)
join public.bir_requirements requirement on requirement.requirement_code = version.requirement_code
on conflict (requirement_id, version_label) do update set
  status = excluded.status,
  verification_status = excluded.verification_status,
  applicability_strategy = excluded.applicability_strategy,
  period_strategy = excluded.period_strategy,
  metadata = excluded.metadata;

insert into public.requirement_version_forms
  (requirement_version_id, form_id, relationship_type)
select version.id, form.id, 'primary_form'
from (
  values
    ('BIR-1601-C', '2018-ENCS', '1601-C', 'January 2018 ENCS'),
    ('BIR-1601-EQ', '2019-ENCS', '1601-EQ', 'January 2019 ENCS'),
    ('BIR-2550Q', '2024-ENCS', '2550Q', 'April 2024 ENCS'),
    ('BIR-1702-RT', '2018-ENCS', '1702-RT', 'January 2018 ENCS')
) as relation(requirement_code, version_label, form_number, revision_label)
join public.bir_requirements requirement on requirement.requirement_code = relation.requirement_code
join public.bir_requirement_versions version
  on version.requirement_id = requirement.id
 and version.version_label = relation.version_label
join public.bir_forms form
  on form.form_number = relation.form_number
 and form.revision_label = relation.revision_label
on conflict (requirement_version_id, form_id) do nothing;

insert into public.requirement_version_sources
  (requirement_version_id, issuance_id, citation_id)
select version.id, source.id, citation.id
from (
  values
    ('BIR-1601-C', '2018-ENCS', 'BIR-FORM-1601C-2018-EFPS', 'form-page', 'Page 1', 'Form title'),
    ('BIR-1601-EQ', '2019-ENCS', 'BIR-FORM-1601EQ-2019-GUIDE', 'guidelines', 'Guide', 'Who Shall File'),
    ('BIR-2550Q', '2024-ENCS', 'BIR-FORM-2550Q-2024', 'form-pdf', 'Form', 'Form title'),
    ('BIR-1702-RT', '2018-ENCS', 'BIR-FORM-1702RT-2018', 'forms-catalog', 'Catalog', 'Form description')
) as relation(requirement_code, version_label, issuance_code, locator, page_reference, section_reference)
join public.bir_requirements requirement on requirement.requirement_code = relation.requirement_code
join public.bir_requirement_versions version
  on version.requirement_id = requirement.id
 and version.version_label = relation.version_label
join public.regulatory_issuances source on source.code = relation.issuance_code
join public.regulatory_issuance_citations citation
  on citation.issuance_id = source.id
 and citation.locator = relation.locator
 and citation.page_reference = relation.page_reference
 and citation.section_reference = relation.section_reference
on conflict (requirement_version_id, issuance_id, citation_id) do nothing;

comment on table public.bir_requirements is
  'The source of legal/control truth. Fixture-supported rows remain draft until complete BIR reconciliation and approval.';
