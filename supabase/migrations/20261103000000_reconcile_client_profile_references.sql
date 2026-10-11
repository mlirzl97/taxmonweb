-- Reconcile the live client setup projection without rewriting profile history.
-- This fixes canonical reference resolution only; source labels and profile
-- versions remain the historical record supplied during onboarding.

create or replace function public.normalized_rdo_lookup_key(value text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(value, ''))) ~ '^rdo' then
      'rdo' || coalesce(
        nullif(
          ltrim(
            regexp_replace(lower(trim(value)), '[^0-9]', '', 'g'),
            '0'
          ),
          ''
        ),
        '0'
      )
    else lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]', '', 'g'))
  end;
$$;

update public.tax_profile_office_context context
set bir_office_id = office.id,
    resolution_status = 'resolved',
    resolution_note = null
from public.tax_profile_versions profile,
     public.bir_offices office
where context.tax_profile_version_id = profile.id
  and context.source_label is not null
  and public.normalized_rdo_lookup_key(office.official_code) = public.normalized_rdo_lookup_key(context.source_label)
  and office.status = 'active'
  and office.effective_from <= profile.effective_from
  and (office.effective_to is null or office.effective_to >= profile.effective_from)
  and context.resolution_status <> 'resolved';

-- eFPS group is a governed value. A blank value is unresolved when eFPS is
-- selected; it is not equivalent to “not applicable”.
update public.tax_profile_filing_context
set efps_group_resolution_status = 'unresolved',
    resolution_note = coalesce(resolution_note, 'eFPS group was not supplied in the registration source; governed group review remains required.')
where lower(filing_channel_source_label) = 'efps'
  and nullif(trim(efps_group_source_label), '') is null;

-- The source references were entered from BIR registration certificates. Keep
-- their manual-reference provenance, but classify the document kind correctly
-- so the profile does not lose its 2303 relationship.
update public.registration_source_references
set source_kind = 'bir_form_2303'
where source_reference ilike '%BIR Form 2303%'
   or source_reference ilike '%Certificate of Registration%';
