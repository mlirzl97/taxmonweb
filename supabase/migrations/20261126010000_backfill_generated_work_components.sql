-- Backfill the same parent/component relationship for work created before the
-- materialization trigger. Existing work remains the same work object; this
-- only restores its governed package context.

insert into public.generated_compliance_work_components (
  generated_work_id,
  component_code,
  label,
  component_type,
  requiredness,
  status,
  evidence_state,
  independent_requirement_id,
  sort_order
)
select
  work.id,
  component.component_code,
  component.label,
  component.component_type,
  component.requiredness,
  case when component.status = 'approved' and component.verification_status = 'verified' then 'not_started' else 'unresolved' end,
  'not_recorded',
  component.independent_requirement_id,
  row_number() over (partition by work.id order by component.component_code)
from public.generated_compliance_work work
join public.requirement_components component on component.requirement_version_id = work.requirement_version_id
where component.status in ('draft', 'approved')
on conflict (generated_work_id, component_code) do nothing;

insert into public.generated_compliance_work_components (
  generated_work_id,
  component_code,
  label,
  component_type,
  requiredness,
  status,
  evidence_state,
  sort_order
)
select work.id, 'PAYMENT', 'Payment', 'payment', 'mandatory', 'not_started', 'not_recorded', 900
from public.generated_compliance_work work
where lower(coalesce(work.payment_applicability, 'unresolved')) = 'required'
  and not exists (
    select 1
      from public.generated_compliance_work_components existing
     where existing.generated_work_id = work.id
       and existing.component_type = 'payment'
  );
