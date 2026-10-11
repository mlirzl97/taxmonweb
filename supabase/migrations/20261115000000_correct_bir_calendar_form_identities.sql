-- Correct calendar-derived form identities where the BIR source writes a form
-- suffix without a hyphen (for example, 1702Q). Preserve the original rows as
-- superseded reference data; repoint only the imported calendar references.

do $migration$
declare
  mapping record;
  old_requirement_id uuid;
  target_requirement_id uuid;
  target_version_id uuid;
  old_form_id uuid;
  target_form_id uuid;
  source_id uuid;
  v_citation_id uuid;
  deadline_policy_id uuid;
begin
  select id into source_id
  from public.regulatory_issuances
  where code = 'BIR-2026-INTERACTIVE-TAX-CALENDAR';

  select id into v_citation_id
  from public.regulatory_issuance_citations
  where issuance_id = source_id
    and locator = 'official-calendar-page'
    and section_reference = 'Calendar Schedule';

  select id into deadline_policy_id
  from public.deadline_policies
  where code = 'BIR-2026-PUBLISHED-CALENDAR-DATE';

  for mapping in
    select * from (values
      ('BIR-1600', 'BIR-1600-WP', '1600', '1600-WP'),
      ('BIR-2200', 'BIR-2200-M', '2200', '2200-M'),
      ('BIR-1602', 'BIR-1602Q', '1602', '1602Q'),
      ('BIR-1603', 'BIR-1603Q', '1603', '1603Q'),
      ('BIR-1701', 'BIR-1701Q', '1701', '1701Q'),
      ('BIR-1702', 'BIR-1702Q', '1702', '1702Q'),
      ('BIR-2550', 'BIR-2550Q', '2550', '2550Q'),
      ('BIR-2551', 'BIR-2551Q', '2551', '2551Q')
    ) as m(old_code, target_code, old_form, target_form)
  loop
    select id into old_requirement_id
    from public.bir_requirements
    where requirement_code = mapping.old_code;

    if old_requirement_id is null then
      continue;
    end if;

    select id into target_requirement_id
    from public.bir_requirements
    where requirement_code = mapping.target_code;

    if target_requirement_id is null then
      update public.bir_requirements
      set requirement_code = mapping.target_code,
          requirement_name = replace(requirement_name, mapping.old_form, mapping.target_form),
          notes = 'Corrected form identity from the official 2026 BIR calendar source.'
      where id = old_requirement_id;
      target_requirement_id := old_requirement_id;
    else
      select id into target_version_id
      from public.bir_requirement_versions
      where requirement_id = target_requirement_id
        and version_label = '2026-calendar-reference';

      if target_version_id is null then
        insert into public.bir_requirement_versions
          (requirement_id, version_label, effective_from, status, verification_status,
           applicability_strategy, period_strategy, deadline_policy_id, metadata)
        select target_requirement_id, '2026-calendar-reference', date '2026-01-01',
          'approved', 'partially_verified', 'profile_and_rule_review_required',
          requirement.frequency_label, deadline_policy_id,
          jsonb_build_object('sourceCode', 'BIR-2026-INTERACTIVE-TAX-CALENDAR', 'datasetTemplateId', 1135)
        from public.bir_requirements requirement
        where requirement.id = target_requirement_id
        returning id into target_version_id;

        insert into public.requirement_version_sources
          (requirement_version_id, issuance_id, citation_id)
        values (target_version_id, source_id, v_citation_id)
        on conflict (requirement_version_id, issuance_id, citation_id) do nothing;
      end if;

      update public.monthly_calendar_entries
      set requirement_id = target_requirement_id,
          requirement_version_id = target_version_id
      where requirement_id = old_requirement_id
        and source_locator like 'dataset:1135/record:%';

      update public.published_calendar_entries
      set requirement_id = target_requirement_id,
          requirement_version_id = target_version_id
      where requirement_id = old_requirement_id
        and source_locator like 'dataset:1135/record:%';

      update public.bir_requirements
      set status = 'superseded',
          verification_status = 'superseded',
          notes = 'Superseded by the corrected canonical form identity.'
      where id = old_requirement_id;

      update public.bir_requirement_versions
      set status = 'superseded', verification_status = 'superseded'
      where requirement_id = old_requirement_id
        and version_label = '2026-calendar-reference';
    end if;

    select id into target_form_id
    from public.bir_forms
    where form_number = mapping.target_form
      and revision_label = '2026 calendar reference';

    if target_form_id is null then
      update public.bir_forms
      set form_number = mapping.target_form,
          title = 'BIR Form ' || mapping.target_form || ' — referenced by the 2026 BIR Tax Calendar'
      where form_number = mapping.old_form
        and revision_label = '2026 calendar reference';
      select id into target_form_id
      from public.bir_forms
      where form_number = mapping.target_form
        and revision_label = '2026 calendar reference';
    else
      select id into old_form_id
      from public.bir_forms
      where form_number = mapping.old_form
        and revision_label = '2026 calendar reference';

      if old_form_id is not null and old_form_id <> target_form_id then
        delete from public.requirement_version_forms
        where form_id = old_form_id
          and requirement_version_id in (
            select id from public.bir_requirement_versions
            where requirement_id = target_requirement_id
              and version_label = '2026-calendar-reference'
          );
        update public.bir_forms
        set status = 'superseded', verification_status = 'superseded',
            notes = 'Superseded after correcting the official form suffix.'
        where id = old_form_id;
      end if;
    end if;

    insert into public.requirement_version_forms
      (requirement_version_id, form_id, relationship_type)
    select version.id, target_form_id, 'primary_form'
    from public.bir_requirement_versions version
    where version.requirement_id = target_requirement_id
      and version.version_label = '2026-calendar-reference'
    on conflict (requirement_version_id, form_id) do nothing;
  end loop;
end
$migration$;
