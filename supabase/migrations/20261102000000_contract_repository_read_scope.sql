-- Keep the signed-client contract projection visible to authorized client
-- repository maintainers while preserving scoped visibility for other users.
-- This mirrors the live policy correction applied during client-profile
-- reconciliation; it does not grant anonymous access or change write paths.

drop policy if exists contract_repositories_scoped_read on public.contract_repositories;
create policy contract_repositories_scoped_read on public.contract_repositories
  for select to authenticated
  using (
    public.has_active_capability('MaintainClientRepository')
    or public.can_view_client(client_id)
  );

drop policy if exists master_engagements_scoped_read on public.master_engagements;
create policy master_engagements_scoped_read on public.master_engagements
  for select to authenticated
  using (
    public.has_active_capability('MaintainClientRepository')
    or exists (
      select 1
      from public.contract_repositories repository
      where repository.id = master_engagements.contract_repository_id
        and public.can_view_client(repository.client_id)
    )
  );

drop policy if exists master_engagement_documents_scoped_read on public.master_engagement_documents;
create policy master_engagement_documents_scoped_read on public.master_engagement_documents
  for select to authenticated
  using (
    public.has_active_capability('MaintainClientRepository')
    or exists (
      select 1
      from public.master_engagements engagement
      join public.contract_repositories repository
        on repository.id = engagement.contract_repository_id
      where engagement.id = master_engagement_documents.master_engagement_id
        and public.can_view_client(repository.client_id)
    )
  );

drop policy if exists additional_engagements_scoped_read on public.additional_engagements;
create policy additional_engagements_scoped_read on public.additional_engagements
  for select to authenticated
  using (
    public.has_active_capability('MaintainClientRepository')
    or exists (
      select 1
      from public.contract_repositories repository
      where repository.id = additional_engagements.contract_repository_id
        and public.can_view_client(repository.client_id)
    )
  );
