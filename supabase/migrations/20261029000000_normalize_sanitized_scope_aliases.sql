-- Normalize the first sanitized portfolio import without rewriting history.
-- The legacy North/Central/South names were fixture aliases for A/B/C. Keep
-- their old assignments as historical facts, close them, and create the
-- canonical successor assignments effective 2026-10-09.

with legacy_map(legacy_code, canonical_code) as (
  values
    ('FIXTURE-TOWER-NORTH', 'FIXTURE-TOWER-A'),
    ('FIXTURE-TOWER-CENTRAL', 'FIXTURE-TOWER-B'),
    ('FIXTURE-TOWER-SOUTH', 'FIXTURE-TOWER-C')
), closed as (
  update public.registration_unit_scope_assignments assignment
     set effective_to = date '2026-10-08'
    from public.organization_units legacy,
         legacy_map
   where assignment.organization_unit_id = legacy.id
     and legacy.code = legacy_map.legacy_code
     and assignment.effective_from < date '2026-10-09'
     and assignment.effective_to is null
  returning assignment.registration_unit_id, legacy_map.canonical_code
)
insert into public.registration_unit_scope_assignments (
  registration_unit_id,
  organization_unit_id,
  effective_from,
  reason
)
select
  closed.registration_unit_id,
  canonical.id,
  date '2026-10-09',
  'Normalize legacy sanitized tower alias to canonical fixture scope'
from closed
join public.organization_units canonical
  on canonical.code = closed.canonical_code
where not exists (
  select 1
  from public.registration_unit_scope_assignments existing
  where existing.registration_unit_id = closed.registration_unit_id
    and existing.organization_unit_id = canonical.id
    and existing.effective_from = date '2026-10-09'
);

update public.organization_units
   set active = false,
       effective_to = date '2026-10-08'
 where code in ('FIXTURE-TOWER-NORTH', 'FIXTURE-TOWER-CENTRAL', 'FIXTURE-TOWER-SOUTH')
   and active = true;
