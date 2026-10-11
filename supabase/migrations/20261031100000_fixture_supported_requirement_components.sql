-- Fixture-supported component relationship.
-- QAP is retained as a completion component of 1601-EQ in normal UX. It is
-- not promoted to an independent work object by this migration.

insert into public.requirement_components
  (requirement_version_id, component_code, label, component_type,
   requiredness, status, verification_status)
select version.id,
       'QAP',
       'Quarterly Alphalist of Payees (QAP)',
       'attachment_schedule',
       'mandatory',
       'draft',
       'partially_verified'
from public.bir_requirement_versions version
join public.bir_requirements requirement on requirement.id = version.requirement_id
where requirement.requirement_code = 'BIR-1601-EQ'
  and version.version_label = '2019-ENCS'
on conflict (requirement_version_id, component_code) do update set
  label = excluded.label,
  component_type = excluded.component_type,
  requiredness = excluded.requiredness,
  status = excluded.status,
  verification_status = excluded.verification_status;
