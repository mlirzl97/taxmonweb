-- Published operational calendar rows are downstream read-model input.
-- Unreleased, draft, and superseded rows remain restricted to Tax Control.

drop policy if exists monthly_calendar_released_read on public.monthly_calendar_entries;
create policy monthly_calendar_released_read
  on public.monthly_calendar_entries for select to authenticated
  using (
    publication_status = 'published'
    and exists (
      select 1
      from public.monthly_calendar_versions version
      where version.id = calendar_version_id
        and version.status = 'released'
    )
  );

drop policy if exists monthly_calendar_released_version_read on public.monthly_calendar_versions;
create policy monthly_calendar_released_version_read
  on public.monthly_calendar_versions for select to authenticated
  using (status = 'released');
