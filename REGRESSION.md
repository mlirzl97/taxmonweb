# TaxMonWeb module regression ledger

This ledger records the cross-module surfaces that must be checked when a source, rule, profile, deadline, assignment, or work record changes. It is intentionally small: it names the propagation paths that can break rather than duplicating every test case.

## Propagation rules

| Change | Must propagate to | Must not create |
| --- | --- | --- |
| Requirement/form/rule/deadline change | BIR Center reference as applicable, Tax Team deadline control, released client calendar, generated-work dates on the next governed generation/rebase path | A second deadline table or silent rewrite of historical work |
| Tax Profile version change | profile history, canonical context, applicability/universe decision, future generated work | An edit to the active historical snapshot |
| Applicability decision | Client profile projection, generated-work coverage, Control Tower coverage/attention | A manual work item that bypasses the governed requirement/version |
| Deadline publication | Tax Team history, client service calendar, Work due register for affected generated work | A client-visible date before publication |
| Assignment change | Team coverage, Client accountability, Work owner/gate authorization | A second owner field with independent truth |
| Work command | Work detail, My Work, Control Tower, Tax Team reports/QA, audit history | A report-only status that disagrees with `generated_compliance_work` |
| Period close | every work item in the period and every execution child | Reopening or partial mutation of a closed period |
| Capability/scope change | route access, server command authorization, RLS-visible data, Admin audit | UI-only access control |

## Module ledger

| Module | Canonical data | Main consumers | Status | Highest-value regression check |
| --- | --- | --- | --- | --- |
| Control Tower | generated work + assignments + scope | overview, attention, team progress | Partial live projection | empty/live scope must remain honest; no “All Clear” when work data is unavailable |
| Team | app users, profiles, org units, effective assignments | Team views, Client accountability, Work authorization | Mixed live/prototype | effective-dated assignment changes must affect visibility and ownership without changing history |
| Clients / Registry | client → entity → registration unit | registry, client workspace, contracts | Live repository plus prototype onboarding | unknown client must not resolve to a fixture outside the explicit prototype gate |
| Clients / Tax Profile | tax profile versions + relational context | profile, service calendar basis, applicability | Versioned persistence present; downstream generation incomplete | active profile is immutable in history; validation requires the approved source facts and distinct actors |
| Clients / Service Calendar | released monthly calendar entries | client calendar, PDF/print view | Published repository read boundary wired; live pilot verification pending | only published operational dates appear; held/unresolved rows never appear as due dates |
| Work / Due Register | generated compliance work | My Work, Control Tower, reports | Strongest live slice | list/detail must agree on dates, lifecycle, RAG, owner, and completion |
| Work / Execution | work child tables + command RPC | detail drawer and process controls | Live command path present | command idempotency, SoD, period lock, evidence/result distinctions |
| BIR Center | governed masters + reference calendar | read-only encyclopedia | Read-only foundation | only verified reference rows are visible; no operational deadline mutation from this workspace |
| Tax Team / Deadline Control | monthly calendar entries + publication events | deadline table, edit drawer, client release | Direct publish present; released rows are inspectable but immutable | save/publish and supersede retain actor/time/reason and never delete old entries; published rows never expose a broken save action |
| Tax Team / Reports and QA | generated work, evidence, QA, transaction review | Tax Team tabs | Mixed live/fixture | report counts derive from work truth and do not create a second tracker |
| Admin | capabilities, scopes, org, audit | access and control screens | Persistence stronger than some UI screens | direct API/RLS denial must hold when UI controls are bypassed |
| Admin / Account preferences | `user_preferences`, private avatar objects | authenticated theme and avatar preference commands | Account-owned presentation choices, separate from client and tax-control truth | Local live-mode API and RLS/storage boundary are implemented; remote migration remains pending |

## Current verification evidence

The current repository has already passed in this workspace after the previous implementation slice:

- lint;
- TypeScript typecheck;
- Vitest: 54 files / 258 tests;
- production build;
- Playwright: 62 tests, 60 passed with 2 intentional project-specific skips;
- manual Control Tower/Work desktop and 390px mobile inspection;
- route navigation and mobile overflow inspection.

The sanitized prototype currently runs under one Super Admin operating mode;
the access matrix remains in the domain layer but is not exposed as a browser
persona switcher or editable Users & access screen until the production access
model is approved.

The schema audit added here is static and migration-backed. It does not claim that a live Supabase instance has been migrated or seeded in this turn.

## Live release audit · 18 October 2026

- Local release gate: `npm run verify` passed; migration check reports 67 unique local versions, Vitest is 54 files / 258 tests, and the production build completed successfully.
- Sanitized browser gate: 62 Playwright tests ran; 60 passed with 2 intentional project-specific skips across desktop and mobile.
- Non-demo production-mode build passed with `TAXMON_DEMO_MODE=false` and calibration edit mode disabled; a local `next start` smoke check redirected `/app/control-tower` to `/login`, returned `401` for unauthenticated `/api/work`, and emitted the baseline security headers.
- Local prototype configuration now uses seeded sanitized data (`TAXMON_EMPTY_MODE=false`); no real client data is enabled.
- Supabase `taxmonweb-dev` is `ACTIVE_HEALTHY`, with 61 applied migrations and latest remote version `20261024000000`. Read-only live inspection confirms the core generated-work command RPCs exist, but the released-calendar read policies are absent, the live `save_deadline_control_entry` still requires an authoritative source code, and `capture_checker_tax_due_amount` still has no explicit search path. The local released-calendar, source-gate-removal, and trigger-hardening migrations therefore remain pending reconciliation.
- Supabase advisors previously reported 3 anonymous and 42 authenticated executable `SECURITY DEFINER` functions, 24 RLS-enabled tables without policies, 1 mutable function search path, and leaked-password protection disabled. A local migration now hardens the four trigger-only functions by fixing their search paths and revoking their exposed RPC execute grants; the remaining advisor findings still require review/remediation before production release.
- Vercel `taxmonweb` has a READY production deployment, but it is still commit `4adbd624` (`Remove Copilot handoff documents`); the current worktree changes are not deployed.
- Deadline Control no longer requires a hidden source code to save or publish a manually verified date; existing provenance is retained and the decision is recorded in the append-only publication/audit history.
- Published and superseded deadline rows now open as read-only history views; only unreleased rows expose Save or Save and publish.
- Account preferences now use an authenticated `user_preferences` record and private `taxmon-user-avatars` storage in live mode; sanitized demo mode remains browser-local by design. The migration is local-only until reviewed remote reconciliation.

## Simplification acceptance criteria

The module is simpler when all of these are true:

- Deadline Control has one operational row model and three user-facing states: published, unresolved, superseded.
- BIR Center reference rows cannot silently become client operational dates.
- Client service calendar reads released operational rows from the live repository instead of deriving dates locally.
- Tax Profile, applicability, calendar, and generated work lineage can be followed without parsing opaque JSON alone.
- Client-level accountability and registration-unit SoD remain separate in data but are composed into one UI projection.
- Control Tower, Work, Tax Team reports, and Client Calendar reconcile to the same generated-work/calendar sources.
- Every mutation has an authorized command, effective/history behavior, and actor/time/reason audit evidence.

## Known residual risks

- The live service-calendar query and released-row RLS boundary are implemented locally, but the connected Supabase project has not been reconciled to the current migration set or exercised with an authenticated pilot.
- The full Expected Compliance generation slice is not yet complete, so automatic setup-to-work coverage cannot be claimed.
- Migration version prefixes are unique locally and checked by `npm run migration:check`; the remote ledger still needs a reviewed reconciliation because its applied versions/names differ from the workspace.
- Supabase security advisor findings remain open and must not be waived silently.
- The current Vercel production deployment is behind the verified local worktree.
- Calendar lineage is currently partly carried in JSON context instead of a direct relational link.
- The live project currently has 476 calendar entries but zero published operational dates; the empty live service-calendar projection is therefore expected until the governed calendar is reconciled and published.
