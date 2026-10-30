-- Behavioural test for the work lifecycle controls (migration 20261212000000).
--
-- Run against a migrated database that has at least one Registration Unit and
-- one BIR requirement version, for example a local copy:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/work_lifecycle_controls_test.sql
-- Everything runs in one transaction and is rolled back: it creates its own
-- synthetic users and one work item, acts as each of them through
-- record_generated_work_command, and raises an error on the first broken
-- expectation. Refused commands are also checked to leave no trace.

begin;

-- Synthetic actors: Preparer, Checker, Reviewer, an outsider with work
-- authority, a maintainer (MaintainGeneratedComplianceWork only) and the HOD
-- (PerformElevatedOverride).
create temporary table lifecycle_actors (role text primary key, user_id uuid not null) on commit drop;
insert into lifecycle_actors values
  ('preparer', gen_random_uuid()), ('checker', gen_random_uuid()), ('reviewer', gen_random_uuid()),
  ('outsider', gen_random_uuid()), ('maintainer', gen_random_uuid()), ('hod', gen_random_uuid());
insert into auth.users (id) select user_id from lifecycle_actors;
-- A sign-up trigger may already have created the app user; make each active.
insert into public.app_users (id, display_name, is_active, account_status)
  select user_id, 'Lifecycle test ' || role, true, 'active' from lifecycle_actors
  on conflict (id) do update set display_name = excluded.display_name, is_active = true, account_status = 'active';
insert into public.user_capability_assignments (user_id, capability_key, effective_from, reason)
  select actor.user_id, capability, current_date, 'lifecycle test'
  from lifecycle_actors actor
  cross join lateral unnest(case actor.role
    when 'maintainer' then array['ViewAssignedWork', 'MaintainGeneratedComplianceWork']
    when 'hod' then array['ViewAssignedWork', 'ExecuteGeneratedComplianceWork', 'PerformElevatedOverride', 'MaintainGeneratedComplianceWork']
    else array['ViewAssignedWork', 'ExecuteGeneratedComplianceWork'] end) capability;

-- One work item owned by the three assigned actors.
create temporary table lifecycle_work (id uuid primary key) on commit drop;
with unit as (select id from public.registration_units order by id limit 1),
     version as (select id, requirement_id from public.bir_requirement_versions order by id limit 1),
     inserted as (
       insert into public.generated_compliance_work (registration_unit_id, requirement_id, requirement_version_id, generation_key, period_label,
         preparer_user_id, checker_user_id, reviewer_user_id, current_owner_user_id, current_gate, lifecycle_stage, payment_applicability)
       select unit.id, version.requirement_id, version.id, 'lifecycle-test:' || gen_random_uuid(), 'Lifecycle test period',
         (select user_id from lifecycle_actors where role = 'preparer'), (select user_id from lifecycle_actors where role = 'checker'),
         (select user_id from lifecycle_actors where role = 'reviewer'), (select user_id from lifecycle_actors where role = 'preparer'),
         'preparer', 'preparation', 'unresolved'
       from unit, version
       returning id)
insert into lifecycle_work select id from inserted;
do $$ begin
  if not exists (select 1 from lifecycle_work) then
    raise exception 'The database needs at least one Registration Unit and one BIR requirement version to run this test.';
  end if;
end $$;

create function pg_temp.act_as(p_role text) returns void language plpgsql as $$
declare actor uuid := (select user_id from lifecycle_actors where role = p_role);
begin
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.work_id() returns uuid language sql as $$ select id from lifecycle_work limit 1 $$;

create function pg_temp.answers(p_role text, p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(question, true), '{}'::jsonb) || p_extra from unnest(public.gate_required_questions(p_role)) question
$$;

-- Run a command as an actor and require it to succeed.
create function pg_temp.ok(p_label text, p_role text, p_command text, p_payload jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(p_role);
  perform public.record_generated_work_command(pg_temp.work_id(), p_command, p_payload, p_label || ':' || gen_random_uuid());
exception when others then
  raise exception 'FAIL %: expected success, got "%"', p_label, sqlerrm;
end $$;

-- Run a command as an actor and require it to be refused with the given
-- message, leaving the work row, its gates and its steps unchanged.
create function pg_temp.refused(p_label text, p_role text, p_command text, p_payload jsonb, p_message text) returns void language plpgsql as $$
declare
  before_state text;
  after_state text;
  snapshot text := 'select row_to_json(w)::text || coalesce((select string_agg(row_to_json(s)::text, '','' order by s.step_code) from public.generated_work_process_steps s where s.generated_work_id = w.id), '''')
                   || (select count(*)::text from public.generated_work_gate_attempts a where a.generated_work_id = w.id)
                   from public.generated_compliance_work w where w.id = $1';
begin
  execute snapshot into before_state using pg_temp.work_id();
  perform pg_temp.act_as(p_role);
  begin
    perform public.record_generated_work_command(pg_temp.work_id(), p_command, p_payload, p_label || ':' || gen_random_uuid());
  exception when others then
    if position(p_message in sqlerrm) = 0 then
      raise exception 'FAIL %: refused with "%", expected "%"', p_label, sqlerrm, p_message;
    end if;
    execute snapshot into after_state using pg_temp.work_id();
    if after_state is distinct from before_state then
      raise exception 'FAIL %: refused but changed the work', p_label;
    end if;
    raise notice 'ok   % (refused)', p_label;
    return;
  end;
  raise exception 'FAIL %: expected refusal "%", but it succeeded', p_label, p_message;
end $$;

do $$
begin
  -- Certification needs every question present and answered yes.
  perform pg_temp.refused('preparer one answer', 'preparer', 'gate_decision', jsonb_build_object('role', 'preparer', 'decision', 'certify', 'note', 'n', 'answers', '{"correct-context": true}'::jsonb), 'Every applicable gate question must be certified.');
  perform pg_temp.refused('preparer a no', 'preparer', 'gate_decision', jsonb_build_object('role', 'preparer', 'decision', 'certify', 'note', 'n', 'answers', pg_temp.answers('preparer', '{"reconciled": false}')), 'Every applicable gate question must be certified.');
  perform pg_temp.refused('preparer string yes', 'preparer', 'gate_decision', jsonb_build_object('role', 'preparer', 'decision', 'certify', 'note', 'n', 'answers', pg_temp.answers('preparer', '{"reconciled": "yes"}')), 'Every applicable gate question must be certified.');
  -- Nothing after review moves first; no gate out of order, even by override.
  perform pg_temp.refused('client approval before review', 'preparer', 'process_status', '{"stepCode": "client-approval", "status": "complete", "evidenceReference": "e", "externalDate": "2026-05-08"}', 'Preparation, checking and review must be complete first.');
  perform pg_temp.refused('override reviewer skips gates', 'hod', 'gate_decision', jsonb_build_object('role', 'reviewer', 'decision', 'approve', 'note', 'n', 'answers', pg_temp.answers('reviewer'), 'overrideReason', 'skip'), 'The Preparer must certify first.');
  -- Maintaining work is not an override; an override needs a reason.
  perform pg_temp.refused('maintainer acts as preparer', 'maintainer', 'gate_decision', jsonb_build_object('role', 'preparer', 'decision', 'certify', 'note', 'n', 'answers', pg_temp.answers('preparer')), 'The actual actor is not the assigned control role or fails segregation of duties.');
  perform pg_temp.refused('override without reason', 'hod', 'gate_decision', jsonb_build_object('role', 'preparer', 'decision', 'certify', 'note', 'n', 'answers', pg_temp.answers('preparer')), 'The actual actor is not the assigned control role or fails segregation of duties.');
  -- Payment profile: assigned Preparer or Checker only.
  perform pg_temp.refused('reviewer sets payment', 'reviewer', 'payment_profile', '{"paymentApplicability": "required"}', 'Only the assigned Preparer or Checker sets the payment profile.');
  perform pg_temp.ok('preparer sets payment required', 'preparer', 'payment_profile', '{"paymentApplicability": "required"}');

  -- Preparer certifies; the Preparer may not check their own work.
  perform pg_temp.ok('preparer certifies', 'preparer', 'gate_decision', jsonb_build_object('role', 'preparer', 'decision', 'certify', 'note', 'prepared', 'answers', pg_temp.answers('preparer')));
  perform pg_temp.refused('preparer checks own work', 'preparer', 'gate_decision', jsonb_build_object('role', 'checker', 'decision', 'certify', 'note', 'n', 'answers', pg_temp.answers('checker', '{"taxDueAmount": 100}'), 'paymentAmount', 100), 'The actual actor is not the assigned control role or fails segregation of duties.');
  perform pg_temp.refused('checker with a no', 'checker', 'gate_decision', jsonb_build_object('role', 'checker', 'decision', 'certify', 'note', 'n', 'answers', pg_temp.answers('checker', '{"taxDueAmount": 100, "ready-for-review": false}'), 'paymentAmount', 100), 'Every applicable gate question must be certified.');
  perform pg_temp.ok('checker certifies', 'checker', 'gate_decision', jsonb_build_object('role', 'checker', 'decision', 'certify', 'note', 'checked', 'answers', pg_temp.answers('checker', '{"taxDueAmount": 100}'), 'paymentAmount', 100));
  perform pg_temp.refused('payment changed after checker', 'preparer', 'payment_profile', '{"paymentApplicability": "not_applicable"}', 'The payment profile is fixed once the Checker has certified.');
  perform pg_temp.refused('filing before reviewer', 'preparer', 'process_status', '{"stepCode": "client-approval", "status": "complete", "evidenceReference": "e", "externalDate": "2026-05-08"}', 'Preparation, checking and review must be complete first.');
  perform pg_temp.ok('reviewer approves', 'reviewer', 'gate_decision', jsonb_build_object('role', 'reviewer', 'decision', 'approve', 'note', 'reviewed', 'answers', pg_temp.answers('reviewer')));

  -- Filing follows client approval; completed steps reset only by reasoned override.
  perform pg_temp.refused('filing before client approval', 'preparer', 'process_status', '{"stepCode": "filing", "status": "complete", "evidenceReference": "FRN"}', 'Client approval must be complete before filing.');
  perform pg_temp.ok('client approval', 'preparer', 'process_status', '{"stepCode": "client-approval", "status": "complete", "evidenceReference": "client email", "externalDate": "2026-05-08"}');
  perform pg_temp.ok('filing', 'preparer', 'process_status', '{"stepCode": "filing", "status": "complete", "evidenceReference": "FRN-1"}');
  perform pg_temp.refused('reset filing without override', 'preparer', 'process_status', '{"stepCode": "filing", "status": "not_started"}', 'A completed process step requires an authorized override to correct.');
  perform pg_temp.ok('payment endorsed', 'preparer', 'process_status', '{"stepCode": "payment", "status": "complete", "evidenceReference": "endorsed"}');
  perform pg_temp.ok('payment released', 'preparer', 'process_status', '{"stepCode": "payment-client-approval", "status": "complete", "evidenceReference": "released"}');
  perform pg_temp.ok('payment confirmed', 'preparer', 'process_status', '{"stepCode": "payment-confirmation", "status": "complete", "evidenceReference": "PRN-1"}');
  perform pg_temp.ok('attachments not applicable', 'preparer', 'process_status', '{"stepCode": "esubmission", "status": "not_applicable", "evidenceReference": "none required"}');
  perform pg_temp.ok('archived', 'preparer', 'process_status', '{"stepCode": "evidence", "status": "complete", "evidenceReference": "archive folder"}');

  -- Closure: the assigned Reviewer only, never whoever prepared or checked.
  perform pg_temp.refused('preparer closes', 'preparer', 'final_certification', '{"note": "n"}', 'Only the assigned Reviewer or an authorized elevated actor can certify closure.');
  perform pg_temp.ok('reviewer closes', 'reviewer', 'final_certification', '{"note": "closed"}');
  if (select lifecycle_stage || '/' || engagement_status from public.generated_compliance_work where id = pg_temp.work_id()) <> 'complete/complete' then
    raise exception 'FAIL closure: work is not complete';
  end if;
  raise notice 'ALL LIFECYCLE CONTROL TESTS PASSED';
end $$;

rollback;
