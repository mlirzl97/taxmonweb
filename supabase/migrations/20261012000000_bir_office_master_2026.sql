-- Current BIR jurisdiction/office master snapshot.
--
-- Sources:
--   * BIR Citizen's Charter 2026, Revenue Regional and District Offices Directory
--   * RAO No. 6-2025, List of Revenue Regions and Revenue District Offices
--   * RAO No. 1-2026, renaming RDO 17A/17B
--   * RAO No. 2-2026, renaming RDO 107/108/110/111
--
-- This is a governed office directory, not a tax-applicability rule. The
-- 2025-12-09 anchor reflects the RAO 6-2025 issuance date; the source record
-- explicitly records that its legal effectivity needs confirmation where the
-- source does not state it independently.

-- Keep this migration independently replayable when the reusable provenance
-- migration has not yet been applied in a fresh environment.
create table if not exists public.bir_office_sources (
  bir_office_id uuid not null references public.bir_offices(id) on delete restrict,
  issuance_id uuid not null references public.regulatory_issuances(id) on delete restrict,
  citation_id uuid references public.regulatory_issuance_citations(id) on delete restrict,
  source_role text not null default 'authority',
  created_at timestamptz not null default now(),
  primary key (bir_office_id, issuance_id, source_role)
);

alter table public.bir_office_sources enable row level security;

create index if not exists idx_bir_offices_type_code
  on public.bir_offices (office_type, official_code, effective_from);

insert into public.regulatory_issuances (
  code, issuance_type, title, issuing_body, source_url, publication_date,
  effectivity_date, retrieval_date, verification_status, status, notes, metadata
)
values
  (
    'BIR-CHARTER-RR-RDO-DIRECTORY-2026',
    'other_authority',
    'BIR Citizen''s Charter 2026 — Revenue Regional and District Offices Directory',
    'Bureau of Internal Revenue',
    'https://bir-cdn.bir.gov.ph/BIR/pdf/BIR%20Citizen%27s%20Charter%20(2026%20Edition)%20final.pdf',
    '2026-01-01',
    null,
    current_date,
    'verified',
    'active',
    'Official 2026 directory snapshot for office names, codes, parent regions and published contact context. It is not a substitute for legal tax rules.',
    jsonb_build_object('edition', '2026 1st edition', 'directory_pages', '489-496')
  ),
  (
    'BIR-RAO-6-2025-RR-RDO-LIST',
    'revenue_administrative_order',
    'Revenue Administrative Order No. 6-2025 — List of Revenue Regions and Revenue District Offices',
    'Bureau of Internal Revenue',
    'https://bir-cdn.bir.gov.ph/BIR/pdf/RAO%20No.%206-2025.pdf',
    '2025-12-09',
    null,
    current_date,
    'partially_verified',
    'active',
    'Baseline office list. The issuance date is known; the database does not assume a separate legal effectivity date where the source text has not been reconciled.',
    '{}'::jsonb
  ),
  (
    'BIR-RAO-1-2026-RDO-17A-17B',
    'revenue_administrative_order',
    'Revenue Administrative Order No. 1-2026 — Renaming of RDO 17A and RDO 17B',
    'Bureau of Internal Revenue',
    'https://bir-cdn.bir.gov.ph/BIR/pdf/RAO%20No.%201-2026.pdf',
    '2026-02-24',
    '2026-02-24',
    current_date,
    'verified',
    'active',
    'RDO 17A North Tarlac became South Tarlac; RDO 17B South Tarlac became North Tarlac. The order states immediate effectivity.',
    '{}'::jsonb
  ),
  (
    'BIR-RAO-2-2026-RDO-107-108-110-111',
    'revenue_administrative_order',
    'Revenue Administrative Order No. 2-2026 — Amendment of RAO No. 6-2025',
    'Bureau of Internal Revenue',
    'https://bir-cdn.bir.gov.ph/BIR/pdf/RAO%20No.%202-2026.pdf',
    '2026-04-14',
    '2026-04-14',
    current_date,
    'verified',
    'active',
    'Renames RDO 107, 108, 110 and 111. The order states immediate effectivity.',
    '{}'::jsonb
  )
on conflict (code) do update set
  title = excluded.title,
  source_url = excluded.source_url,
  publication_date = excluded.publication_date,
  effectivity_date = excluded.effectivity_date,
  retrieval_date = excluded.retrieval_date,
  verification_status = excluded.verification_status,
  status = excluded.status,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.regulatory_issuance_citations (
  issuance_id, locator, page_reference, section_reference, quote_or_summary
)
select id, 'directory', '489-496', 'Revenue Regional and District Offices Directory',
       'Official 2026 office directory used for current region/RDO code and name rows.'
from public.regulatory_issuances
where code = 'BIR-CHARTER-RR-RDO-DIRECTORY-2026'
  and not exists (
    select 1 from public.regulatory_issuance_citations c
    where c.issuance_id = public.regulatory_issuances.id
      and c.locator = 'directory'
  );

insert into public.regulatory_issuance_citations (
  issuance_id, locator, page_reference, section_reference, quote_or_summary
)
select id, 'list', '1-4', 'List of Revenue Regions and Revenue District Offices',
       'Baseline governed office list used for historical office context.'
from public.regulatory_issuances
where code = 'BIR-RAO-6-2025-RR-RDO-LIST'
  and not exists (
    select 1 from public.regulatory_issuance_citations c
    where c.issuance_id = public.regulatory_issuances.id
      and c.locator = 'list'
  );

insert into public.regulatory_issuance_citations (
  issuance_id, locator, page_reference, section_reference, quote_or_summary
)
select id, 'renaming', '1', 'II. Renaming of BIR Revenue District Offices',
       'RDO 17A North Tarlac is renamed South Tarlac; RDO 17B South Tarlac is renamed North Tarlac.'
from public.regulatory_issuances
where code = 'BIR-RAO-1-2026-RDO-17A-17B'
  and not exists (
    select 1 from public.regulatory_issuance_citations c
    where c.issuance_id = public.regulatory_issuances.id
      and c.locator = 'renaming'
  );

insert into public.regulatory_issuance_citations (
  issuance_id, locator, page_reference, section_reference, quote_or_summary
)
select id, 'renaming', '1', 'II. Renaming of BIR RDOs',
       'RDO 107, 108, 110 and 111 receive the amended names recorded in the current master.'
from public.regulatory_issuances
where code = 'BIR-RAO-2-2026-RDO-107-108-110-111'
  and not exists (
    select 1 from public.regulatory_issuance_citations c
    where c.issuance_id = public.regulatory_issuances.id
      and c.locator = 'renaming'
  );

update public.regulatory_issuances
set status = 'superseded',
    verification_status = 'superseded',
    notes = 'Superseded as the current directory by the 2026 office master; retained for historical provenance.',
    updated_at = now()
where code = 'BIR-RR-RDO-DIRECTORY-2024';

do $$
declare
  row_data text;
  parts text[];
  office_id uuid;
  region_source_id uuid;
  directory_source_id uuid;
begin
  select id into region_source_id
  from public.regulatory_issuances
  where code = 'BIR-RAO-6-2025-RR-RDO-LIST';

  select id into directory_source_id
  from public.regulatory_issuances
  where code = 'BIR-CHARTER-RR-RDO-DIRECTORY-2026';

  for row_data in
    select trim(value)
    from regexp_split_to_table($regions$
RR1|Ilocos Region
RR2|Cordillera Administrative Region
RR3|Cagayan Valley
RR4|Central Luzon
RR5|Camanava and Bulacan
RR6|City of Manila and Palawan
RR7A|Quezon City
RR7B|East NCR
RR8A|Makati City
RR8B|South NCR
RR9A|CABAMIRO
RR9B|LAQUEMAR
RR10|Bicol Region
RR11|Western Visayas Region
RR12|Negros Island Region
RR13|Central Visayas Region
RR14|Eastern Visayas Region
RR15|Zamboanga Peninsula and Tawi-Tawi
RR16|Northern Mindanao
RR17|Caraga Region
RR18|South Central Mindanao
RR19|Davao Region
$regions$, E'\n') as value
    where trim(value) <> ''
  loop
    parts := string_to_array(row_data, '|');
    insert into public.bir_offices (
      official_code, official_name, office_type, effective_from, status,
      verification_status, notes
    ) values (
      parts[1], parts[2], 'revenue_region', date '2025-12-09', 'active',
      'verified', '2026 BIR directory row; office-level jurisdiction detail is maintained by BIR and is not inferred here.'
    )
    on conflict (official_code, effective_from) do update set
      official_name = excluded.official_name,
      office_type = excluded.office_type,
      status = excluded.status,
      verification_status = excluded.verification_status,
      notes = excluded.notes;

    select id into office_id
    from public.bir_offices
    where official_code = parts[1] and effective_from = date '2025-12-09';

    insert into public.bir_office_sources (bir_office_id, issuance_id, source_role)
    values (office_id, region_source_id, 'baseline_directory_authority')
    on conflict do nothing;
    insert into public.bir_office_sources (bir_office_id, issuance_id, source_role)
    values (office_id, directory_source_id, 'current_directory_snapshot')
    on conflict do nothing;
  end loop;

  for row_data in
    select trim(value)
    from regexp_split_to_table($offices$
1|Ilocos Norte|RR1
2|Ilocos Sur|RR1
3|La Union|RR1
4|Central Pangasinan|RR1
5|West Pangasinan|RR1
6|East Pangasinan|RR1
7|Abra|RR2
8|Baguio City|RR2
9|Benguet|RR2
10|Mountain Province|RR2
11|Kalinga and Apayao|RR2
12|Ifugao|RR2
13|Cagayan and Batanes|RR3
14|Nueva Vizcaya|RR3
15|Isabela|RR3
16|Quirino|RR3
17A|South Tarlac|RR4
17B|North Tarlac|RR4
18|Zambales|RR4
19|Subic Bay Freeport Zone|RR4
20|Bataan|RR4
21A|North Pampanga|RR4
21B|South Pampanga|RR4
21C|Clark Freeport and Special Economic Zone (CFEZ)|RR4
22|Aurora|RR4
23A|North Nueva Ecija|RR4
23B|South Nueva Ecija|RR4
24|Valenzuela City|RR5
25A|West Bulacan|RR5
25B|East Bulacan|RR5
26|Malabon City and Navotas City|RR5
27|Caloocan City|RR5
29|Tondo - San Nicolas|RR6
30|Binondo|RR6
31|Sta. Cruz|RR6
32|Quiapo-Sampaloc-San Miguel-Sta. Mesa|RR6
33|Intramuros-Ermita-Malate|RR6
34|Paco-Pandacan-Sta. Ana-San Andres|RR6
36|Palawan|RR6
28|Novaliches|RR7A
38|North Quezon City|RR7A
39|South Quezon City|RR7A
40|Cubao|RR7A
41|Mandaluyong City|RR7B
42|San Juan City|RR7B
43|Pasig City|RR7B
45|North Rizal and Marikina City|RR7B
46|South Rizal|RR7B
47|East Makati City|RR8A
48|West Makati City|RR8A
49|North Makati City|RR8A
50|South Makati City|RR8A
44|Taguig City and Pateros|RR8B
51|Pasay City|RR8B
52|Parañaque City|RR8B
53A|Las Piñas City|RR8B
53B|Muntinlupa City|RR8B
35|Romblon|RR9A
37|Occidental Mindoro|RR9A
54A|East Cavite|RR9A
54B|West Cavite|RR9A
58|West Batangas|RR9A
59|East Batangas|RR9A
63|Oriental Mindoro|RR9A
55|East Laguna|RR9B
56|Central Laguna|RR9B
57|West Laguna|RR9B
60|North Quezon|RR9B
61|South Quezon|RR9B
62|Marinduque|RR9B
64|Camarines Norte|RR10
65|West Camarines Sur|RR10
66|East Camarines Sur|RR10
67|Albay|RR10
68|Sorsogon|RR10
69|Catanduanes|RR10
70|Masbate|RR10
71|Aklan|RR11
72|Capiz|RR11
73|Antique|RR11
74|South Iloilo and Guimaras|RR11
75|North Iloilo|RR11
76|North Negros Occidental|RR12
77|Central Negros Occidental|RR12
78|South Negros Occidental|RR12
79|Negros Oriental and Siquijor|RR12
80|North Cebu|RR13
81|Cebu City North|RR13
82|Cebu City South|RR13
83|South Cebu|RR13
84|Bohol|RR13
85|Northern Samar|RR14
86|Eastern Samar|RR14
87|Western Samar|RR14
88|Eastern Leyte and Biliran|RR14
89|Western Leyte|RR14
90|Southern Leyte|RR14
91|Zamboanga del Norte|RR15
92|Zamboanga del Sur|RR15
93A|Zamboanga City|RR15
93B|Zamboanga Sibugay|RR15
94|Isabela City (Non-BARMM)/Basilan (BARMM)|RR15
95|Sulu|RR15
96|Tawi-Tawi (BARMM)|RR15
97|East Misamis Oriental and Camiguin|RR16
98|West Misamis Oriental|RR16
99|Bukidnon|RR16
100|Misamis Occidental|RR16
101|Lanao del Norte|RR16
102|Lanao del Sur (BARMM)|RR16
103|Agusan del Norte|RR17
104|Agusan del Sur|RR17
105|Surigao del Norte and Dinagat Islands|RR17
106|Surigao del Sur|RR17
107|Cotabato City and Maguindanao Provinces (BARMM)|RR18
108|Cotabato Province and BARMM Special Geographic Area (SGA)|RR18
109|Sultan Kudarat|RR18
110|General Santos City and Sarangani|RR18
111|South Cotabato|RR18
112|Davao del Norte and Davao de Oro|RR19
113A|West Davao City|RR19
113B|East Davao City|RR19
114|Davao Oriental|RR19
115|Davao del Sur and Davao Occidental|RR19
$offices$, E'\n') as value
    where trim(value) <> ''
  loop
    parts := string_to_array(row_data, '|');
    insert into public.bir_offices (
      official_code, official_name, office_type, parent_office_id,
      effective_from, status, verification_status, notes
    ) values (
      'RDO-' || parts[1], parts[2], 'rdo',
      (select id from public.bir_offices where official_code = parts[3] and effective_from = date '2025-12-09'),
      date '2025-12-09', 'active', 'verified',
      'Current office name from the 2026 BIR directory; jurisdiction boundaries are not inferred from the display name.'
    )
    on conflict (official_code, effective_from) do update set
      official_name = excluded.official_name,
      office_type = excluded.office_type,
      parent_office_id = excluded.parent_office_id,
      status = excluded.status,
      verification_status = excluded.verification_status,
      notes = excluded.notes;

    select id into office_id
    from public.bir_offices
    where official_code = 'RDO-' || parts[1] and effective_from = date '2025-12-09';

    insert into public.bir_office_sources (bir_office_id, issuance_id, source_role)
    values (office_id, region_source_id, 'baseline_directory_authority')
    on conflict do nothing;
    insert into public.bir_office_sources (bir_office_id, issuance_id, source_role)
    values (office_id, directory_source_id, 'current_directory_snapshot')
    on conflict do nothing;
  end loop;
end $$;

-- Preserve the pre-2026-rename names as superseded history, then overlay the
-- immediately effective amended names from RAO 1-2026 and RAO 2-2026.
do $$
declare
  old_id uuid;
  current_id uuid;
  baseline_source_id uuid;
  amendment_1_source_id uuid;
  amendment_2_source_id uuid;
begin
  select id into baseline_source_id from public.regulatory_issuances where code = 'BIR-RAO-6-2025-RR-RDO-LIST';
  select id into amendment_1_source_id from public.regulatory_issuances where code = 'BIR-RAO-1-2026-RDO-17A-17B';
  select id into amendment_2_source_id from public.regulatory_issuances where code = 'BIR-RAO-2-2026-RDO-107-108-110-111';

  update public.bir_offices
  set official_name = case official_code
    when 'RDO-17A' then 'North Tarlac'
    when 'RDO-17B' then 'South Tarlac'
    when 'RDO-107' then 'Maguindanao del Norte and Maguindanao del Sur (BARMM)'
    when 'RDO-108' then 'North Cotabato (Non-BARMM)/Special Geographic Area (BARMM)'
    when 'RDO-110' then 'South Cotabato and Sarangani'
    when 'RDO-111' then 'Koronadal City'
  end
  where official_code in ('RDO-17A', 'RDO-17B', 'RDO-107', 'RDO-108', 'RDO-110', 'RDO-111')
    and effective_from = date '2025-12-09';

  foreach old_id in array array[
    (select id from public.bir_offices where official_code = 'RDO-17A' and effective_from = date '2025-12-09'),
    (select id from public.bir_offices where official_code = 'RDO-17B' and effective_from = date '2025-12-09'),
    (select id from public.bir_offices where official_code = 'RDO-107' and effective_from = date '2025-12-09'),
    (select id from public.bir_offices where official_code = 'RDO-108' and effective_from = date '2025-12-09'),
    (select id from public.bir_offices where official_code = 'RDO-110' and effective_from = date '2025-12-09'),
    (select id from public.bir_offices where official_code = 'RDO-111' and effective_from = date '2025-12-09')
  ] loop
    if old_id is not null then
      update public.bir_offices
      set effective_to = case
        when official_code in ('RDO-17A', 'RDO-17B') then date '2026-02-23'
        else date '2026-04-13'
      end,
      status = 'superseded',
      verification_status = 'superseded',
      notes = coalesce(notes, '') || ' Superseded by an immediate-effect 2026 renaming order.'
      where id = old_id;
    end if;
  end loop;

  insert into public.bir_offices (
    official_code, official_name, office_type, parent_office_id,
    effective_from, status, verification_status, notes
  )
  select 'RDO-17A', 'South Tarlac', 'rdo', parent_office_id,
         date '2026-02-24', 'active', 'verified',
         'Current name under RAO No. 1-2026; immediate effectivity.'
  from public.bir_offices where official_code = 'RDO-17A' and effective_from = date '2025-12-09'
  on conflict (official_code, effective_from) do update set official_name = excluded.official_name, status = excluded.status, verification_status = excluded.verification_status, effective_to = null, notes = excluded.notes;

  insert into public.bir_offices (
    official_code, official_name, office_type, parent_office_id,
    effective_from, status, verification_status, notes
  )
  select 'RDO-17B', 'North Tarlac', 'rdo', parent_office_id,
         date '2026-02-24', 'active', 'verified',
         'Current name under RAO No. 1-2026; immediate effectivity.'
  from public.bir_offices where official_code = 'RDO-17B' and effective_from = date '2025-12-09'
  on conflict (official_code, effective_from) do update set official_name = excluded.official_name, status = excluded.status, verification_status = excluded.verification_status, effective_to = null, notes = excluded.notes;

  insert into public.bir_offices (official_code, official_name, office_type, parent_office_id, effective_from, status, verification_status, notes)
  select v.code, v.name, 'rdo', base.parent_office_id, date '2026-04-14', 'active', 'verified', 'Current name under RAO No. 2-2026; immediate effectivity.'
  from (values
    ('RDO-107', 'Cotabato City and Maguindanao Provinces (BARMM)'),
    ('RDO-108', 'Cotabato Province and BARMM Special Geographic Area (SGA)'),
    ('RDO-110', 'General Santos City and Sarangani'),
    ('RDO-111', 'South Cotabato')
  ) v(code, name)
  join public.bir_offices base on base.official_code = v.code and base.effective_from = date '2025-12-09'
  on conflict (official_code, effective_from) do update set official_name = excluded.official_name, status = excluded.status, verification_status = excluded.verification_status, effective_to = null, notes = excluded.notes;

  insert into public.bir_office_sources (bir_office_id, issuance_id, source_role)
  select id, amendment_1_source_id, 'amending_authority'
  from public.bir_offices
  where official_code in ('RDO-17A', 'RDO-17B') and effective_from = date '2026-02-24'
  on conflict do nothing;

  insert into public.bir_office_sources (bir_office_id, issuance_id, source_role)
  select id, amendment_2_source_id, 'amending_authority'
  from public.bir_offices
  where official_code in ('RDO-107', 'RDO-108', 'RDO-110', 'RDO-111') and effective_from = date '2026-04-14'
  on conflict do nothing;
end $$;
