# TaxMonWeb issue tracker

This is the working backlog for the sanitized pilot. Issues are ordered by the
next risk they remove, not by the workspace where they appear.

## Status vocabulary

- **Open** — confirmed issue, not started.
- **Next** — the next item to execute.
- **In progress** — actively being worked.
- **Blocked** — needs an external decision, credential, or source.
- **Verified** — tested against the stated acceptance criteria.

## Priority backlog

| ID | Priority | Issue | Current state | Exit criteria |
|---|---|---|---|---|
| TM-001 | P0 | Establish an empty, recoverable pilot dataset | **Verified** | Supabase client/work/profile records are empty; BIR masters, auth, migrations and audit history remain intact; reset counts are recorded below. |
| TM-002 | P0 | Run a five-taxpayer onboarding pilot through the real profile path | **Next** | Five sanitized taxpayers are created, validated, assigned, and visible through the same client read path; no fixture-only shortcut is required. |
| TM-003 | P0 | Reconcile local and Vercel data modes | Open | Local production-mode and Vercel use the same server-backed path; demo-only fixture behavior is isolated and documented. |
| TM-004 | P0 | Verify authenticated writes and authorization end to end | Open | Sign-in, profile save, assignment change, work creation, and direct unauthorized access are tested against the real server boundary. |
| TM-005 | P1 | Prove one operational truth across Clients, Work, Due Register and Calendar | Open | The same five taxpayers and their work resolve consistently in every projection; no duplicate tracker or stale fixture collection remains. |
| TM-006 | P1 | Prove return-package correlation | Open | A parent return can expose required components/attachments and completion state without creating duplicate peer work rows. |
| TM-007 | P1 | Validate profile activation and history controls | Open | Identity, source, assignments, payment route, effective dates and actor history survive edits and cannot be silently overwritten. |
| TM-008 | P1 | Complete the minimum governed BIR content needed for pilot work | Open | Pilot requirements and deadlines have authoritative source/provenance, effective dates and explicit unresolved states; no invented rule drives work. |
| TM-009 | P1 | Harden Supabase policies and server functions | Open | Advisor findings are reviewed and resolved or explicitly accepted; sensitive tables have intentional policies and privileged functions have least-privilege execution. |
| TM-010 | P1 | Test the monthly operating cycle by role | Open | Preparer, Checker, Reviewer, Master Admin and Tax Team scenarios complete with correct ownership, SoD and control states. |
| TM-011 | P2 | Exercise evidence, QA and coverage integrity | Open | Filed/paid/submitted/accepted distinctions, evidence, QA and Expected → Generated → Executed → Evidenced are observable in the pilot. |
| TM-012 | P2 | Promote the verified local build to the single Vercel production app | Blocked by TM-001–TM-004 | Commit, verify, deploy once, then test the live authenticated path. |

## Five-taxpayer pilot

The pilot should use five sanitized taxpayers selected to expose different
operating conditions:

1. ordinary Client Pays taxpayer;
2. TMF Pays taxpayer with funding not yet confirmed;
3. PEZA or other standing-authority taxpayer;
4. taxpayer with an open audit context;
5. incomplete or low-confidence registration profile.

For each taxpayer, record:

- setup draft → validated → active;
- source/provenance and validation actor;
- registration unit and jurisdiction;
- Cluster/Tower and Preparer/Checker/Reviewer;
- payment route and any funding blocker;
- one approved return/work object only after its governing requirement is available;
- lifecycle progression and required components;
- RAG, blocker, exception and evidence separately;
- what changed after each action.

## Reset boundary

The pilot reset is intentionally narrower than “drop the database.” It may
remove only records explicitly marked as sanitized pilot fixtures, including
fixture clients, taxpayer entities, registration units, profile snapshots,
fixture assignments, fixture contracts, generated pilot work and derived pilot
events where the dependency chain permits it.

It must preserve:

- schema and migrations;
- canonical BIR masters and regulatory sources;
- authenticated users and capabilities;
- organizational configuration needed for access;
- audit history required to explain the reset;
- no real or unverified taxpayer data.

The reset command must produce a before/after count report and refuse to run
against rows without an explicit sanitized-fixture marker.

## Evidence log

| Date | Issue | Evidence | Decision |
|---|---|---|---|
| 2026-10-13 | TM-001 | Browser reset only clears local storage; importer is additive/upsert-only; Supabase contains existing sanitized records. | Define a scoped, recoverable pilot reset before onboarding. |
| 2026-10-13 | TM-001 | Guarded dependency-ordered Supabase reset: clients 6→0, taxpayer entities 6→0, registration units 6→0, generated work 2→0, work events 8→0, profiles 28→0, authorities 6→0. Preserved BIR requirements 93, published calendar entries 476, audit events 24. | **Verified**. Local fixture source remains untouched; live/server-backed mode is required for the pilot. |
| 2026-10-18 | TM-003/TM-004/TM-009/TM-012 | Read-only live inspection confirms `taxmonweb-dev` is healthy but its 61-entry migration ledger ends at `20261024000000`; released-calendar policies are absent, the live deadline save RPC still enforces the removed source-code gate, and the trigger search path is still mutable. Supabase advisors report 24 RLS-enabled tables without policies, 3 anon and 42 authenticated executable `SECURITY DEFINER` functions. Vercel production is READY at commit `4adbd62`, behind the current worktree. | Keep production promotion gated; reconcile the migration history and pending local migrations, remediate security findings, then run the authenticated five-taxpayer pilot. |
| 2026-10-18 | TM-008/TM-012 | Deadline Control source-gate removal is implemented locally in `20261202000000_remove_deadline_source_gate.sql`; manual Tax Team verification is auditable, and the local release gate passes at 53 files / 256 tests. | Keep the migration pending external reconciliation; do not claim production readiness until it is applied and an authenticated save/publish pilot succeeds. |
| 2026-10-18 | TM-012 | `20261203000000_harden_internal_trigger_functions.sql` fixes the mutable search path on four trigger-only functions and revokes their anonymous/authenticated RPC grants without changing trigger execution; local release gate passes at 53 files / 257 tests and 60 Playwright passes with 2 intentional skips. | Apply only during reviewed Supabase migration reconciliation; verify advisor counts and an authenticated work/payment regression afterward. |
| 2026-10-18 | TM-003/TM-009 | `MIGRATION-RECONCILIATION.md` records the read-only comparison: 66 local migration files, 61 remote rows, 10 local-only names, and 4 historical remote-only names. It identifies the missing release policies, source-gate removal, trigger hardening, and return-lock behavior confirmed by live SQL inspection. | Use this artifact for an authorized migration repair/apply review; do not replay the full local directory. |
| 2026-10-18 | TM-003/TM-009 | `20261204000000_account_preferences.sql` adds authenticated account preferences with RLS and private avatar storage; the API and live-mode settings client are implemented locally. Migration check reports 67 local versions, Vitest passes 54 files / 258 tests, and the settings Playwright slice passes 4 tests. | Review the migration against the live Supabase storage/RLS boundary before enabling account-backed settings outside the local worktree. |
| 2026-10-18 | TM-004/TM-008/TM-012 | Read-only live data snapshot: 476 calendar entries exist, all are `unresolved` / `not_comparable`, none are published, and the project has 1 client. The local release gate now also verifies that published deadline rows are read-only and retain transaction history. Full browser gate passes 60 tests with 2 intentional skips. | Do not promote the live client calendar yet; reconcile the governed calendar and run an authenticated save/publish pilot before deployment. |
