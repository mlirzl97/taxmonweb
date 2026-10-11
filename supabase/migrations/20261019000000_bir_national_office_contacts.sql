-- Source-backed National Office directory contacts for the public BIR Center.
-- The 2023 Citizen's Charter is retained as a partially verified snapshot;
-- contact data must be revalidated before production reliance.

alter table public.bir_offices
  drop constraint if exists bir_offices_office_type_check;

alter table public.bir_offices
  add constraint bir_offices_office_type_check check (office_type in (
    'rdo', 'lts', 'lt_office', 'revenue_region', 'national_office', 'other'
  ));

create table if not exists public.bir_office_contacts (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.bir_offices(id) on delete restrict,
  contact_group text not null,
  room text,
  telephone text,
  email text,
  contact_kind text not null default 'division' check (contact_kind in ('general', 'division', 'service', 'data_center', 'other')),
  effective_from date,
  effective_to date,
  status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'retired')),
  verification_status text not null default 'unresolved' check (verification_status in ('verified', 'partially_verified', 'unresolved', 'superseded')),
  source_issuance_id uuid references public.regulatory_issuances(id) on delete restrict,
  source_citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  unique (office_id, contact_group, room, effective_from)
);

create index if not exists idx_bir_office_contacts_office_status
  on public.bir_office_contacts (office_id, status, contact_group);

alter table public.bir_office_contacts enable row level security;

drop policy if exists bir_office_contacts_active_reference_read on public.bir_office_contacts;
create policy bir_office_contacts_active_reference_read
  on public.bir_office_contacts
  for select to anon, authenticated
  using (status = 'active' and verification_status in ('verified', 'partially_verified'));

insert into public.regulatory_issuances (
  code, issuance_type, title, issuing_body, source_url, retrieval_date,
  verification_status, status, notes
)
values
(
  'BIR-CONTACT-US-GENERAL', 'official_advisory',
  'BIR Contact Us — general taxpayer contact',
  'Bureau of Internal Revenue', 'https://www.bir.gov.ph/contactus', current_date,
  'verified', 'active',
  'Official BIR contact page used for the general taxpayer hotline and email.'
),
(
  'BIR-CITIZENS-CHARTER-2023-NATIONAL-OFFICE-CONTACTS', 'official_advisory',
  'BIR Updated Citizen''s Charter 2023 — National Office contacts',
  'Bureau of Internal Revenue',
  'https://bir-cdn.bir.gov.ph/BIR/pdf/Citizens-Charter-2023-v2.pdf', current_date,
  'partially_verified', 'active',
  'Official 2023 Citizen''s Charter snapshot. Contact numbers are not represented as current without revalidation.'
)
on conflict (code) do update set
  source_url = excluded.source_url,
  retrieval_date = excluded.retrieval_date,
  verification_status = excluded.verification_status,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.regulatory_issuance_citations (issuance_id, locator, page_reference, quote_or_summary)
select id, source_url, null,
  'The official BIR contact page lists the taxpayer hotline (02) 8538-3200 and contact_us@bir.gov.ph.'
from public.regulatory_issuances
where code = 'BIR-CONTACT-US-GENERAL'
  and not exists (
    select 1 from public.regulatory_issuance_citations c
    where c.issuance_id = public.regulatory_issuances.id
      and c.locator = 'https://www.bir.gov.ph/contactus'
  );

insert into public.regulatory_issuance_citations (issuance_id, locator, page_reference, quote_or_summary)
select id, source_url, 'pp. 987–992 / PDF pp. 1009–1014',
  'National Office address, division names, room references, telephone numbers, and Revenue Data Center contacts.'
from public.regulatory_issuances
where code = 'BIR-CITIZENS-CHARTER-2023-NATIONAL-OFFICE-CONTACTS'
  and not exists (
    select 1 from public.regulatory_issuance_citations c
    where c.issuance_id = public.regulatory_issuances.id
      and c.page_reference = 'pp. 987–992 / PDF pp. 1009–1014'
  );

insert into public.bir_offices (
  official_code, official_name, office_type, effective_from, status,
  verification_status, address, city_or_area, public_email, public_telephone, notes
)
values (
  'NATIONAL-OFFICE', 'BIR National Office', 'national_office', date '2023-01-01', 'active',
  'partially_verified', 'BIR Road, Diliman', 'Quezon City',
  'contact_us@bir.gov.ph', '(02) 8538-3200',
  'General contact is from the official BIR Contact Us page. Division contacts are a 2023 Citizen''s Charter snapshot and should be revalidated before production reliance.'
)
on conflict (official_code, effective_from) do update set
  office_type = excluded.office_type,
  status = excluded.status,
  verification_status = excluded.verification_status,
  address = excluded.address,
  city_or_area = excluded.city_or_area,
  public_email = excluded.public_email,
  public_telephone = excluded.public_telephone,
  notes = excluded.notes;

insert into public.bir_office_sources (bir_office_id, issuance_id, citation_id, source_role)
select office.id, issuance.id, citation.id,
  case when issuance.code = 'BIR-CONTACT-US-GENERAL' then 'general_contact' else 'directory_snapshot' end
from public.bir_offices office
join public.regulatory_issuances issuance on issuance.code in (
  'BIR-CONTACT-US-GENERAL', 'BIR-CITIZENS-CHARTER-2023-NATIONAL-OFFICE-CONTACTS'
)
join public.regulatory_issuance_citations citation on citation.issuance_id = issuance.id
  and (issuance.code = 'BIR-CONTACT-US-GENERAL' or citation.page_reference = 'pp. 987–992 / PDF pp. 1009–1014')
where office.official_code = 'NATIONAL-OFFICE'
  and office.effective_from = date '2023-01-01'
on conflict (bir_office_id, issuance_id, source_role) do nothing;

with office as (
  select id from public.bir_offices where official_code = 'NATIONAL-OFFICE' and effective_from = date '2023-01-01'
), charter as (
  select issuance.id, citation.id as citation_id
  from public.regulatory_issuances issuance
  join public.regulatory_issuance_citations citation on citation.issuance_id = issuance.id
  where issuance.code = 'BIR-CITIZENS-CHARTER-2023-NATIONAL-OFFICE-CONTACTS'
    and citation.page_reference = 'pp. 987–992 / PDF pp. 1009–1014'
), contacts(contact_group, room, telephone, contact_kind) as (values
  ('Commissioner of Internal Revenue', 'NOB 511', '8925-1789 / 8922-3293', 'general'),
  ('Extension Office', 'NOB 503', '8925-1506', 'general'),
  ('DCIR - Legal Group', 'NOB 504', '8928-0480 / 8926-5717', 'service'),
  ('DCIR - Resource Management Group', 'NOB 410', '8928-7946 / 8928-5833', 'service'),
  ('DCIR - Information Systems Group', 'NOB 409', '8922-4817 / 8924-7309', 'service'),
  ('DCIR - Operations Group', 'NOB 404', '8928-3562 / 8929-7602 / 8926-3803', 'service'),
  ('Accountable Forms Division', 'NOB B4/B7', '8922-4880', 'division'),
  ('Accounting Division', 'NOB 1005', '8926-5515 / 8426-2168', 'division'),
  ('Client Support Service', 'NOB 611', '8928-8522 / 8921-4324', 'service'),
  ('Assessment Service', 'NOB 509', '8926-3822 / 8926-5706', 'service'),
  ('Assessment Programs Division', 'NOB 907', '8922-4899 / 8922-4835', 'division'),
  ('Audit Information, Tax Exemption and Incentives Division', 'NOB 910', '8928-8117 / 8926-5416', 'division'),
  ('Collection Service', 'NOB 507', '8426-2191 / 8926-5797', 'service'),
  ('Collection Programs Division', 'NOB 810', '8928-3488 / 8926-3815', 'division'),
  ('Enforcement and Advocacy Service', 'NOB 309', '8922-4751 / 8925-2693', 'service'),
  ('Excise LT Audit Division I', 'NOB 209', '8928-3091 / 8922-4824 / 8928-8517', 'division'),
  ('Excise LT Audit Division II', 'NOB 211A', '8926-5686 / 8928-7960', 'division'),
  ('Excise LT Regulatory Division', 'NOB 102', '8925-2696 / 8925-1798', 'division'),
  ('Finance Service', 'NOB 505', '8926-5637 / 8926-5789', 'service'),
  ('International Tax Affairs Division', 'NOB 811', '8926-5729 / 8926-3420', 'division'),
  ('Large Taxpayer Service - ACIR', 'NOB 307', '8922-1926 / 8926-5502', 'service'),
  ('Legal Service', 'NOB 510', '8922-4897 / 8926-5702', 'service'),
  ('LT Assistance Division', 'NOB 114', '8928-1096 / 8924-3245 / 8922-4894', 'division'),
  ('LT Document Processing and Quality Assurance Division', 'NOB 214A', '8920-7549 / 8920-7514 / 8924-2839', 'division'),
  ('LT VAT Audit Unit', 'NOB 213', '8928-8519', 'service'),
  ('National Investigation Division', 'NOB 211B', '8922-4829 / 8926-5449', 'division'),
  ('Planning and Management Service', 'NOB 403', '8921-9427 / 8925-5276 / 8926-5753', 'service'),
  ('Public Information and Education Division', 'NOB 101', '8926-3820', 'division'),
  ('Regular LT Audit Division I', 'NOB 216', '8920-7530 / 8924-7311', 'division'),
  ('Regular LT Audit Division II', 'NOB 216', '78924-2920 / 8924-7317', 'division'),
  ('Regular LT Audit Division III', 'NOB 216', '8922-5815 / 8920-7525', 'division'),
  ('Research and Statistics Division', 'NOB 1105', '8927-0994 / 8926-5565', 'division'),
  ('Revenue Accounting Division', 'NOB 911', '8925-5279 / 8925-5280 / 8927-0979 / 8925-5283 / 8925-5281 / 8925-2699 / 8925-5282', 'division'),
  ('Tax Audit Review Division', 'NOB 809', '8922-5816 / 8922-4870', 'division'),
  ('Taxpayer Service Programs and Monitoring Division', 'NOB 610', '8926-3711 / 8922-5813', 'division'),
  ('Taxpayer Service Systems Division', 'RCC 310G', '8925-2050 / 8925-2051 / 8925-2052 / 8925-2053', 'division'),
  ('Training Delivery Division', 'NOB 1010', '8926-5598 / 8928-2294 / 8928-0058', 'division'),
  ('Training Management Division', 'NOB 1107', '8920-7545 / 8926-5450 / 8928-3093', 'division'),
  ('VAT Credit Audit Division', 'NOB 803', '8925-1795', 'division'),
  ('National Office Data Center', 'Rm 203 Revenue Computer Center', '(02) 8926-5572', 'data_center')
)
insert into public.bir_office_contacts (
  office_id, contact_group, room, telephone, contact_kind,
  status, verification_status, source_issuance_id, source_citation_id,
  source_reference, notes
)
select office.id, contacts.contact_group, contacts.room, contacts.telephone,
  contacts.contact_kind, 'active', 'partially_verified', charter.id,
  charter.citation_id, 'BIR Updated Citizen''s Charter 2023, National Office directory',
  'Official source snapshot; verify current contact before relying on it operationally.'
from office cross join contacts cross join charter
on conflict (office_id, contact_group, room, effective_from) do update set
  telephone = excluded.telephone,
  contact_kind = excluded.contact_kind,
  status = excluded.status,
  verification_status = excluded.verification_status,
  source_issuance_id = excluded.source_issuance_id,
  source_citation_id = excluded.source_citation_id,
  source_reference = excluded.source_reference,
  notes = excluded.notes,
  updated_at = now();

with office as (
  select id from public.bir_offices where official_code = 'NATIONAL-OFFICE' and effective_from = date '2023-01-01'
), contact_source as (
  select issuance.id, citation.id as citation_id
  from public.regulatory_issuances issuance
  join public.regulatory_issuance_citations citation on citation.issuance_id = issuance.id
  where issuance.code = 'BIR-CONTACT-US-GENERAL' and citation.locator = 'https://www.bir.gov.ph/contactus'
)
insert into public.bir_office_contacts (
  office_id, contact_group, telephone, email, contact_kind,
  status, verification_status, source_issuance_id, source_citation_id,
  source_reference, notes
)
select office.id, 'General taxpayer inquiries', '(02) 8538-3200', 'contact_us@bir.gov.ph',
  'general', 'active', 'verified', contact_source.id, contact_source.citation_id,
  'BIR Contact Us', 'Official BIR general taxpayer contact.'
from office cross join contact_source
on conflict (office_id, contact_group, room, effective_from) do update set
  telephone = excluded.telephone,
  email = excluded.email,
  status = excluded.status,
  verification_status = excluded.verification_status,
  source_issuance_id = excluded.source_issuance_id,
  source_citation_id = excluded.source_citation_id,
  source_reference = excluded.source_reference,
  notes = excluded.notes,
  updated_at = now();
