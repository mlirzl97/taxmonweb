-- Behavioural test for deadline release controls (migration 20261213000000,
-- HOD decision H-010). Run against a migrated database that has at least one
-- BIR requirement, for example a local copy:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/deadline_release_controls_test.sql
-- One transaction, rolled back: synthetic Tax Team actors confirm, publish
-- and override one synthetic deadline row; the first broken expectation
-- raises an error, and refused commands are checked to leave no trace.

begin;

create temporary table release_actors (role text primary key, user_id uuid not null) on commit drop;
insert into release_actors values ('maker', gen_random_uuid()), ('checker', gen_random_uuid()), ('outsider', gen_random_uuid());
insert into auth.users (id) select user_id from release_actors;
insert into public.app_users (id, display_name, is_active, account_status)
  select user_id, 'Release test ' || role, true, 'active' from release_actors
  on conflict (id) do update set display_name = excluded.display_name, is_active = true, account_status = 'active';
insert into public.user_capability_assignments (user_id, capability_key, effective_from, reason)
  select user_id, 'MaintainDeadlineControl', current_date, 'release test' from release_actors where role in ('maker', 'checker');

-- A draft calendar month of its own, so the test touches no real version.
insert into public.monthly_calendar_versions (calendar_month, version_number, status)
  select '2099-04-01', coalesce(max(version_number), 0) + 1, 'draft' from public.monthly_calendar_versions where calendar_month = '2099-04-01';

create temporary table release_entry (id uuid primary key) on commit drop;
with version as (select id from public.monthly_calendar_versions where calendar_month = '2099-04-01' order by version_number desc limit 1),
     requirement as (select id from public.bir_requirements order by id limit 1),
     inserted as (
       insert into public.monthly_calendar_entries (calendar_version_id, requirement_id, external_requirement_label, period_or_event,
         comparison_status, publication_status, base_statutory_deadline, adjusted_statutory_deadline)
       select version.id, requirement.id, 'Release test', 'Release test. Month of March 2027', 'match', 'needs_review', '2027-04-10', '2027-04-12'
       from version, requirement
       returning id)
insert into release_entry select id from inserted;
do $$ begin
  if not exists (select 1 from release_entry) then
    raise exception 'The database needs at least one BIR requirement to run this test.';
  end if;
end $$;

create function pg_temp.act_as(p_role text) returns void language plpgsql as $$
declare actor uuid := (select user_id from release_actors where role = p_role);
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.entry() returns uuid language sql as $$ select id from release_entry limit 1 $$;

create function pg_temp.snapshot() returns text language sql as $$
  select string_agg(row_to_json(e)::text, ',' order by e.id::text) from public.monthly_calendar_entries e
   where e.id = pg_temp.entry() or e.supersedes_entry_id = pg_temp.entry()
$$;

create function pg_temp.refused(p_label text, p_role text, p_sql text, p_message text) returns void language plpgsql as $$
declare before_state text := pg_temp.snapshot();
begin
  perform pg_temp.act_as(p_role);
  begin
    execute p_sql;
  exception when others then
    if position(p_message in sqlerrm) = 0 then
      raise exception 'FAIL %: refused with "%", expected "%"', p_label, sqlerrm, p_message;
    end if;
    if pg_temp.snapshot() is distinct from before_state then
      raise exception 'FAIL %: refused but changed the deadline', p_label;
    end if;
    raise notice 'ok   % (refused)', p_label;
    return;
  end;
  raise exception 'FAIL %: expected refusal "%", but it succeeded', p_label, p_message;
end $$;

create function pg_temp.ok(p_label text, p_role text, p_sql text) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(p_role);
  execute p_sql;
  raise notice 'ok   %', p_label;
exception when others then
  raise exception 'FAIL %: expected success, got "%"', p_label, sqlerrm;
end $$;

do $$
declare
  e text := quote_literal(pg_temp.entry());
  successor uuid;
begin
  perform pg_temp.refused('outsider confirms', 'outsider', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'confirmed', 'r'), 'Deadline control is not authorized.');
  perform pg_temp.refused('publish without confirmation', 'maker', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'published', 'r'), 'A deadline is confirmed before it is published.');
  perform pg_temp.refused('confirm after the statutory date', 'maker', format('select public.transition_deadline_control_entry(%s, %L, %L, %L)', e, 'confirmed', '2027-04-13', 'r'), 'The operational due date cannot be later than the earliest applicable statutory deadline.');
  perform pg_temp.ok('maker confirms the 12th', 'maker', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'confirmed', 'checked against the BIR calendar'));
  perform pg_temp.refused('checker confirms again', 'checker', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'confirmed', 'r'), 'This deadline is already confirmed; send it back to review before confirming again.');
  perform pg_temp.refused('confirmer publishes', 'maker', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'published', 'r'), 'The person who confirmed a deadline cannot publish it.');
  perform pg_temp.refused('publisher changes the date', 'checker', format('select public.transition_deadline_control_entry(%s, %L, %L, %L)', e, 'published', '2027-04-11', 'r'), 'The publisher cannot change the confirmed date; confirm the new date first.');
  perform pg_temp.ok('checker publishes', 'checker', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'published', 'second check'));
  if (select publication_status || '/' || published_operational_deadline from public.monthly_calendar_entries where id = pg_temp.entry()) <> 'published/2027-04-12' then
    raise exception 'FAIL publish: expected published on 2027-04-12';
  end if;

  -- An edited statutory date is what a new confirmation confirms: on a scratch
  -- row, confirm the 12th, edit to the 15th (back to review), confirm again.
  declare
    scratch uuid;
  begin
    insert into public.monthly_calendar_entries (calendar_version_id, requirement_id, external_requirement_label, period_or_event, comparison_status, publication_status, adjusted_statutory_deadline)
      select calendar_version_id, requirement_id, 'Release test scratch', 'Release test scratch. Month of May 2027', 'match', 'needs_review', '2027-05-12'
      from public.monthly_calendar_entries where id = pg_temp.entry() returning id into scratch;
    perform pg_temp.ok('scratch confirmed', 'maker', format('select public.transition_deadline_control_entry(%L, %L, null, %L)', scratch, 'confirmed', 'r'));
    -- What saving an edit does to a confirmed row: back to review, confirmer cleared, date changed.
    update public.monthly_calendar_entries set publication_status = 'needs_review', confirmed_by = null, confirmed_at = null, adjusted_statutory_deadline = '2027-05-15' where id = scratch;
    perform pg_temp.ok('scratch reconfirmed after edit', 'checker', format('select public.transition_deadline_control_entry(%L, %L, null, %L)', scratch, 'confirmed', 'r'));
    if (select published_operational_deadline from public.monthly_calendar_entries where id = scratch) <> '2027-05-15' then
      raise exception 'FAIL reconfirm after edit: the old date carried over';
    end if;
  end;

  -- Published dates change only through Override.
  perform pg_temp.refused('re-publish with a new date', 'checker', format('select public.transition_deadline_control_entry(%s, %L, %L, %L)', e, 'published', '2027-04-11', 'r'), 'A published deadline changes only through Override.');
  perform pg_temp.refused('supersede directly', 'checker', format('select public.transition_deadline_control_entry(%s, %L, null, %L)', e, 'superseded', 'r'), 'A published deadline changes only through Override.');
  perform pg_temp.refused('override without reason', 'maker', format('select public.override_published_deadline(%s, %L, %L)', e, '2027-04-11', ''), 'A reason is required for an Override.');
  perform pg_temp.refused('override after the statutory date', 'maker', format('select public.override_published_deadline(%s, %L, %L)', e, '2027-04-14', 'r'), 'The operational due date cannot be later than the earliest applicable statutory deadline.');
  perform pg_temp.ok('maker proposes the 11th', 'maker', format('select public.override_published_deadline(%s, %L, %L)', e, '2027-04-11', 'Client closes early'));
  select id into successor from public.monthly_calendar_entries where supersedes_entry_id = pg_temp.entry();
  if (select publication_status from public.monthly_calendar_entries where id = pg_temp.entry()) <> 'published' then
    raise exception 'FAIL override: the original must stay published until the Override is published';
  end if;
  perform pg_temp.refused('second override while one waits', 'checker', format('select public.override_published_deadline(%s, %L, %L)', e, '2027-04-09', 'r'), 'An Override for this deadline is already waiting to be published.');
  -- Editing the waiting Override back to review cannot smuggle in a new
  -- statutory date, and no second Override starts meanwhile.
  update public.monthly_calendar_entries set publication_status = 'needs_review', confirmed_by = null, confirmed_at = null, adjusted_statutory_deadline = '2027-04-20' where id = successor;
  perform pg_temp.refused('second override while one is in review', 'checker', format('select public.override_published_deadline(%s, %L, %L)', e, '2027-04-09', 'r'), 'An Override for this deadline is already waiting to be published.');
  perform pg_temp.ok('maker re-confirms the edited override', 'maker', format('select public.transition_deadline_control_entry(%L, %L, %L, %L)', successor, 'confirmed', '2027-04-11', 'r'));
  perform pg_temp.refused('override changes the statutory date', 'checker', format('select public.transition_deadline_control_entry(%L, %L, null, %L)', successor, 'published', 'r'), 'An Override cannot change the BIR statutory date.');
  update public.monthly_calendar_entries set adjusted_statutory_deadline = '2027-04-12' where id = successor;
  perform pg_temp.refused('proposer publishes the override', 'maker', format('select public.transition_deadline_control_entry(%L, %L, null, %L)', successor, 'published', 'r'), 'The person who confirmed a deadline cannot publish it.');
  perform pg_temp.ok('checker publishes the override', 'checker', format('select public.transition_deadline_control_entry(%L, %L, null, %L)', successor, 'published', 'agreed'));
  if (select publication_status from public.monthly_calendar_entries where id = pg_temp.entry()) <> 'superseded'
     or (select publication_status || '/' || published_operational_deadline || '/' || tmf_package_target from public.monthly_calendar_entries where id = successor) <> 'published/2027-04-11/2027-04-10' then
    raise exception 'FAIL override publish: original superseded, successor published on the 11th with target the 10th';
  end if;
  if (select count(*) from public.deadline_publication_events where monthly_calendar_entry_id in (pg_temp.entry(), successor)) < 5 then
    raise exception 'FAIL history: every decision must be recorded';
  end if;
  -- A stale Override, of a deadline already superseded, can never publish.
  declare
    stale uuid;
  begin
    update public.monthly_calendar_entries set supersedes_entry_id = null where id = successor;
    insert into public.monthly_calendar_entries (calendar_version_id, requirement_id, external_requirement_label, period_or_event, comparison_status, publication_status,
      base_statutory_deadline, adjusted_statutory_deadline, published_operational_deadline, confirmed_by, confirmed_at, supersedes_entry_id)
    select calendar_version_id, requirement_id, external_requirement_label, period_or_event, comparison_status, 'confirmed',
      base_statutory_deadline, adjusted_statutory_deadline, '2027-04-10', (select user_id from release_actors where role = 'maker'), now(), id
    from public.monthly_calendar_entries where id = pg_temp.entry() returning id into stale;
    perform pg_temp.refused('stale override publishes', 'checker', format('select public.transition_deadline_control_entry(%L, %L, null, %L)', stale, 'published', 'r'), 'The deadline this Override replaces is no longer published.');
  end;
  raise notice 'ALL DEADLINE RELEASE CONTROL TESTS PASSED';
end $$;

rollback;
