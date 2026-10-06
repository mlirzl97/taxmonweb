-- Public contact context for the BIR Center directory.
-- The source is an older official BIR directory reference; retain the
-- partially-verified state until the current directory is revalidated.

update public.bir_offices
set
  address = '30th Floor Export Bank Plaza Bldg cor. Chino Roces Ave. and Sen. Gil Puyat Ave.',
  city_or_area = 'Makati City',
  public_email = 'rdo_50css@bir.gov.ph',
  public_telephone = '(02) 8524-08-36; Compliance (02) 8556-62-05',
  verification_status = 'partially_verified',
  notes = 'Public contact context sourced from the official BIR 2025 Tax Calendar directory; revalidate before production reliance.'
where official_code = 'RDO-50'
  and effective_from = date '2025-12-09'
  and status = 'active';

update public.bir_offices
set
  address = '313 Sen. Gil J. Puyat Avenue',
  city_or_area = 'Makati City',
  public_email = 'rr_8bcsu@bir.gov.ph',
  public_telephone = '(02) 8856-67-86; (02) 8856-67-82',
  verification_status = 'partially_verified',
  notes = 'Public contact context sourced from the official BIR 2025 Tax Calendar directory; revalidate before production reliance.'
where official_code = 'RR8B'
  and effective_from = date '2025-12-09'
  and status = 'active';
