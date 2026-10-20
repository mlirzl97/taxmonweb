# Supabase migration reconciliation

This is a read-only release artifact for project `taxmonweb-dev`
(`kgkdzjanwbhwkhwcjcnc`). It must be reviewed before any remote migration
repair or application. It is not an instruction to mutate Supabase.

## Snapshot

| Surface | Evidence captured 18 October 2026 |
| --- | --- |
| Remote project | `ACTIVE_HEALTHY` |
| Remote migration rows | 61 |
| Latest remote version | `20261024000000` |
| Local migration files | 67 unique versions |
| Remote schema state | Core generated-work tables and command RPCs exist; later release-boundary behavior is not complete |
| Remote calendar state | 476 entries exist across released monthly versions; 0 are published and 0 have an operational deadline |
| Remote client state | 1 client record; the live service-calendar projection is therefore empty until a governed deadline is published |

## Name-set differences

These are differences in migration names, not proof that every item is
unapplied. The remote project contains historical timestamp aliases and some
changes that were later consolidated in the worktree.

Local names with no exact remote name:

- `capture_manual_onboarding_profile_facts`
- `deadline_control_direct_publish`
- `deadline_control_reconciliation`
- `harden_internal_trigger_functions`
- `harden_staff_provisioning`
- `preserve_onboarding_operating_setup`
- `reclassify_existing_app_users`
- `release_calendar_read_boundary`
- `remove_deadline_source_gate`
- `return_period_locks`
- `account_preferences`

Remote names with no exact local name:

- `reconcile_tax_team_transaction_review_policy`
- `harden_staff_provisioning_function`
- `harden_staff_provisioning_grants`
- `work_command_structured_evidence`

## Behaviorally confirmed pending work

Read-only inspection of the live database confirmed these local behaviors are
not yet present remotely:

1. `20261201000000_release_calendar_read_boundary.sql`: no read policies were
   present for `monthly_calendar_entries` or `monthly_calendar_versions`.
2. `20261202000000_remove_deadline_source_gate.sql`: the live
   `save_deadline_control_entry` still rejects an empty source code with
   `An authoritative source is required.`
3. `20261203000000_harden_internal_trigger_functions.sql`: the live
   `capture_checker_tax_due_amount` function has no explicit search path, and
   the three trigger-only security-definer functions still have exposed
   `anon` execution grants.
4. `20261119000000_return_period_locks.sql`: the selected live routine set did
   not contain `record_generated_return_lock`.

5. A live data snapshot shows every current calendar entry is
   `publication_status = 'unresolved'` and `comparison_status = 'not_comparable'`.
   The empty live client service calendar is therefore an expected safe state,
   not evidence that the read projection is broken.

6. The live `save_deadline_control_entry` still contains the removed
   `An authoritative source is required.` check, while the local replacement
   allows Tax Team verification to stand on its own and preserves optional
   provenance. The live trigger functions still grant `EXECUTE` to `PUBLIC`
   and `authenticated`, and `capture_checker_tax_due_amount()` has no explicit
   `search_path`. The live project also has no `user_preferences` table and no
   `taxmon-user-avatars` bucket; these are all covered by local migrations but
   remain unapplied remotely.

`deadline_control_direct_publish` and `deadline_control_reconciliation` also
require SQL-level comparison with the remote `deadline_control_commands`
history before they are classified as new, merged, or already applied.

The `account_preferences` migration is a new authenticated-account boundary
and has no safe remote classification without reviewing the live storage and
RLS state.

## Safe next operation

An authorized operator should compare the SQL and schema effects of the
historical remote aliases first, then use the Supabase migration repair/apply
workflow deliberately. Do not replay the entire local directory and do not
delete remote migration rows. After reconciliation, verify:

- released calendar policies and client-calendar reads;
- source-free manual deadline save with preserved provenance/history;
- trigger-only function grants and search paths;
- return-period lock command and its RLS/SoD behavior;
- the authenticated five-taxpayer pilot before Vercel promotion.
