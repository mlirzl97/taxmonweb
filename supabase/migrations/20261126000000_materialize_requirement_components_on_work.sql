-- Keep one generated compliance work object per return/period while materializing
-- its governed completion components under that parent.

create or replace function public.materialize_generated_work_components()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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
    new.id,
    component.component_code,
    component.label,
    component.component_type,
    component.requiredness,
    case when component.status = 'approved' and component.verification_status = 'verified' then 'not_started' else 'unresolved' end,
    'not_recorded',
    component.independent_requirement_id,
    row_number() over (order by component.component_code)
  from public.requirement_components component
  where component.requirement_version_id = new.requirement_version_id
    and component.status in ('draft', 'approved')
  on conflict (generated_work_id, component_code) do nothing;

  if lower(coalesce(new.payment_applicability, 'unresolved')) = 'required' then
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
    select new.id, 'PAYMENT', 'Payment', 'payment', 'mandatory', 'not_started', 'not_recorded', 900
    where not exists (
      select 1
        from public.generated_compliance_work_components existing
       where existing.generated_work_id = new.id
         and existing.component_type = 'payment'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists materialize_generated_work_components on public.generated_compliance_work;
create trigger materialize_generated_work_components
after insert on public.generated_compliance_work
for each row execute function public.materialize_generated_work_components();
