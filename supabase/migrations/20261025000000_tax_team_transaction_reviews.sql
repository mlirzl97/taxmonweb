-- Persist the Tax Team's transaction-population completeness/awareness review.
-- This is a control record, not a tax-computation or filing result.

create table if not exists public.tax_team_transaction_reviews (
  review_key text primary key,
  review_date date not null,
  client_label text not null,
  requirement_label text not null,
  period_label text not null,
  tower_label text not null,
  cluster_label text not null,
  source_label text not null,
  records_pulled integer not null check (records_pulled >= 0),
  review_status text not null check (review_status in ('awaiting_review', 'in_review', 'certified', 'follow_up')),
  completeness_checked boolean not null default false,
  awareness_checked boolean not null default false,
  certified_by uuid references auth.users(id),
  certified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint tax_team_review_certification_check check (
    review_status <> 'certified'
    or (completeness_checked and awareness_checked and certified_by is not null and certified_at is not null)
  )
);

create index if not exists tax_team_transaction_reviews_date_idx
  on public.tax_team_transaction_reviews(review_date, review_status);

alter table public.tax_team_transaction_reviews enable row level security;

create policy tax_team_transaction_reviews_read on public.tax_team_transaction_reviews
  for select to authenticated
  using (
    public.has_active_capability('ViewTaxControlHistory')
    or public.has_active_capability('ValidateTaxProfile')
  );

create or replace function public.get_tax_team_transaction_reviews()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(review) order by review.review_date, review.review_key), '[]'::jsonb)
  from public.tax_team_transaction_reviews review
  where public.is_active_app_user()
    and (
      public.has_active_capability('ViewTaxControlHistory')
      or public.has_active_capability('ValidateTaxProfile')
    );
$$;

create or replace function public.save_tax_team_transaction_review(
  p_review_key text,
  p_review_date date,
  p_client_label text,
  p_requirement_label text,
  p_period_label text,
  p_tower_label text,
  p_cluster_label text,
  p_source_label text,
  p_records_pulled integer,
  p_completeness_checked boolean,
  p_awareness_checked boolean,
  p_review_status text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  saved public.tax_team_transaction_reviews;
  before_state jsonb;
begin
  if not public.is_active_app_user()
     or not (public.has_active_capability('ViewTaxControlHistory') or public.has_active_capability('ValidateTaxProfile')) then
    raise exception using errcode = '42501', message = 'Tax Team transaction review is not authorized.';
  end if;
  if nullif(trim(p_review_key), '') is null then
    raise exception using errcode = '22023', message = 'A review key is required.';
  end if;
  if p_review_status not in ('awaiting_review', 'in_review', 'certified', 'follow_up') then
    raise exception using errcode = '22023', message = 'The transaction review status is invalid.';
  end if;
  if p_review_status = 'certified' and not (p_completeness_checked and p_awareness_checked) then
    raise exception using errcode = '22023', message = 'Both Tax Team checks are required before certification.';
  end if;

  select to_jsonb(review) into before_state
  from public.tax_team_transaction_reviews review
  where review.review_key = trim(p_review_key);

  insert into public.tax_team_transaction_reviews (
    review_key, review_date, client_label, requirement_label, period_label,
    tower_label, cluster_label, source_label, records_pulled, review_status,
    completeness_checked, awareness_checked, certified_by, certified_at
  ) values (
    trim(p_review_key), p_review_date, trim(p_client_label), trim(p_requirement_label), trim(p_period_label),
    trim(p_tower_label), trim(p_cluster_label), trim(p_source_label), greatest(coalesce(p_records_pulled, 0), 0), p_review_status,
    coalesce(p_completeness_checked, false), coalesce(p_awareness_checked, false),
    case when p_review_status = 'certified' then auth.uid() else null end,
    case when p_review_status = 'certified' then now() else null end
  )
  on conflict (review_key) do update set
    review_date = excluded.review_date,
    client_label = excluded.client_label,
    requirement_label = excluded.requirement_label,
    period_label = excluded.period_label,
    tower_label = excluded.tower_label,
    cluster_label = excluded.cluster_label,
    source_label = excluded.source_label,
    records_pulled = excluded.records_pulled,
    review_status = excluded.review_status,
    completeness_checked = excluded.completeness_checked,
    awareness_checked = excluded.awareness_checked,
    certified_by = case when excluded.review_status = 'certified' then auth.uid() else null end,
    certified_at = case when excluded.review_status = 'certified' then now() else null end,
    updated_at = now()
  returning * into saved;

  perform public.append_audit_event(
    case when saved.review_status = 'certified' then 'tax_team_transaction_review_certified' else 'tax_team_transaction_review_updated' end,
    'tax_team_transaction_review', saved.review_key,
    case when saved.review_status = 'certified' then 'Tax Team transaction population certified' else 'Tax Team transaction population review updated' end,
    before_state, to_jsonb(saved),
    'Tax Team completeness and records-awareness control'
  );

  return to_jsonb(saved);
end;
$$;

revoke execute on function public.get_tax_team_transaction_reviews() from public;
revoke execute on function public.save_tax_team_transaction_review(text, date, text, text, text, text, text, text, integer, boolean, boolean, text) from public;
grant execute on function public.get_tax_team_transaction_reviews() to authenticated;
grant execute on function public.save_tax_team_transaction_review(text, date, text, text, text, text, text, text, integer, boolean, boolean, text) to authenticated;
