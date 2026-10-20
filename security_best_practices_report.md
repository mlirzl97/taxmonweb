# TaxMonWeb Security Review

## Executive summary

TaxMonWeb has a solid prototype security foundation: Supabase session lookup, server-side capability checks, RLS migrations, sanitized prototype mode, upload signature/size validation, safe API error responses, explicit mutation origin checks, baseline security headers, a server-only temporary-document purge executor, and zero production dependency vulnerabilities. The local code-level gate passes, but live migration parity, authenticated negative testing, and deployment promotion remain release gates.

## Scope and assumptions

- Scope: Next.js/TypeScript runtime, API route handlers, Supabase access layer, temporary 2303 upload boundary, configuration, and dependency tree.
- Deployment assumption: Vercel application with Supabase Auth/Postgres/Storage.
- Data assumption: structured client text is retained; 2303 files are temporary onboarding inputs only.
- Cloudflare assumption: no Cloudflare configuration or deployment binding was found in this repository. This is therefore an application security review, not a Cloudflare edge configuration audit.
- Live Supabase project state was inspected read-only on 18 October 2026. No external migration or deployment was applied during this audit.
- Vercel deployment metadata was inspected read-only. The current production deployment still points to the older `4adbd624` commit, not this worktree.

## Findings

### SEC-001 — Explicit CSRF/origin protection on state-changing APIs

- Severity: High before production; Medium if the deployed cookie policy and trusted-origin edge controls are independently verified.
- Location: `src/app/api/*/route.ts` POST handlers; shared auth boundary in `src/lib/server/api-authorization.ts`.
- Evidence: all state-changing application API handlers call the shared `requireSameOrigin` guard after authentication/capability checks. Unauthenticated requests still return 401 before origin evaluation; missing or foreign origins return 403.
- Impact: a cross-site request could attempt a state-changing action using a user’s authenticated browser session if browser cookie policy or deployment configuration permits it.
- Fix: implemented in `src/lib/server/request-origin.ts` and covered by unit tests. `TAXMON_TRUSTED_ORIGINS` supports explicitly governed additional origins; no permissive wildcard is used.
- Status: resolved in local code; live deployment verification remains.

### SEC-002 — Security response headers

- Severity: Medium.
- Location: `next.config.ts`.
- Impact: clickjacking, MIME-sniffing, referrer leakage, and browser capability exposure depend on undocumented platform defaults.
- Fix: baseline headers implemented: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and restrictive `Permissions-Policy`. CSP is deliberately deferred until the actual third-party origin inventory is verified.
- Status: resolved for the baseline set; live response-header verification and CSP decision remain.

### SEC-003 — Temporary 2303 purge executor

- Severity: High for real client documents; Low for the sanitized prototype while uploads are restricted.
- Location: `supabase/migrations/*temporary*` and `src/lib/server/temporary-document-repository.ts`.
- Evidence: `temporary_source_documents` contains `purge_eligible_at` and `purged_at`; the new server-only executor removes the private Storage object first and then marks the row `purged`. The Vercel cron route is authenticated by `CRON_SECRET` and processes only rows explicitly marked `purge_eligible` whose time has arrived.
- Impact: onboarding documents could remain in private Storage longer than intended, increasing confidentiality and retention risk.
- Fix: implemented in `src/lib/server/temporary-document-purge.ts` and `/api/internal/purge-temporary-2303`; `vercel.json` schedules it daily. The code does not invent a retention period: an upstream governed lifecycle decision must set `purge_eligible_at`.
- Status: resolved in local code; production env/cron invocation and the approved retention policy remain operational gates.

### SEC-004 — Input validation is partly manual and partly type-asserted

- Severity: Medium.
- Location: API handlers and repository boundaries, including `src/app/api/registration-units/[registrationUnitId]/temporary-2303/route.ts` and `src/lib/server/*repository.ts`.
- Impact: future endpoint changes could accept malformed values or rely on TypeScript assertions that do not validate runtime data.
- Fix: use small runtime schemas at request boundaries and explicit repository adapters for high-risk commands/queries. Keep the existing upload byte-signature and size checks.
- Status: partially mitigated; follow-up hardening remains recommended for broader schema validation.

## Controls that passed static review

- Dependency audit: `npm audit --omit=dev` reports 0 vulnerabilities.
- Secrets: `.env.local` is ignored; only `.env.example` is tracked; no privileged Supabase service-role key is referenced in browser code.
- Authentication: protected `/app` routes pass through `src/proxy.ts`; application API routes use server-side Supabase context/capability checks, while activation/password-reset routes use same-origin protection and their governed RPC boundary.
- Authorization: RLS is enabled across the tax/client/reference tables and Storage policies are scoped to authenticated users and registration-unit permissions.
- Error handling: API responses use safe fallback messages instead of returning repository/database messages.
- Upload boundary: temporary 2303 uploads restrict MIME type, size, filename length, idempotency key, and file signature; prototype mode rejects non-synthetic sources.
- XSS/dynamic code scan: no `dangerouslySetInnerHTML`, raw DOM HTML sinks, `eval`, `new Function`, or untrusted outbound URL fetch pattern was found.

## Current live release audit

- Supabase `taxmonweb-dev` is `ACTIVE_HEALTHY` with 61 applied migrations; the latest remote migration is `20261024000000`.
- The local worktree has 67 unique migration versions, including the released-calendar read boundary, deadline source-gate removal, trigger-function hardening, and account-backed preferences. These are not yet proven against the live database.
- Read-only function/policy inspection confirms the live database still lacks the released-calendar read policies, still rejects a deadline save without an authoritative source code, and still leaves `capture_checker_tax_due_amount` without an explicit search path. These are concrete schema-drift findings, not merely version-number differences.
- Live data inspection found 476 calendar entries, all `unresolved` / `not_comparable`, with zero published operational dates. The empty live service calendar is therefore an expected safe state until the governed release data is reconciled; it is not a client-side projection failure.
- Live account-preference inspection found no `user_preferences` table and no `taxmon-user-avatars` bucket. The local authenticated preferences boundary remains unapplied remotely.
- Live inspection reports 80 RLS-enabled public tables, 24 without direct policies, and 56 policy definitions. Policyless tables may be intentional RPC-only boundaries, but they require explicit review before real data onboarding.
- The live database still exposes 3 trigger-related `SECURITY DEFINER` functions to `anon` and 42 `SECURITY DEFINER` functions to `authenticated` according to the current advisor snapshot. The local `20261203000000_harden_internal_trigger_functions.sql` migration removes the four trigger-only grants and fixes their search paths; it has not been applied remotely.
- Vercel production is `READY`, but the latest deployment is commit `4adbd624` (`Remove Copilot handoff documents`), behind the verified worktree.

## Production gate

**Result: CONDITIONAL — code-level controls pass; live production gates remain.**

Required before real client-data onboarding:

1. Reconcile and review the pending local migrations against the live migration ledger; do not apply them blindly because the version names differ.
2. Ensure the approved lifecycle marks documents `purge_eligible` with an approved `purge_eligible_at`; no retention duration is invented in this code pass.
3. Run authenticated negative tests against the live Supabase/Vercel environment: cross-client access, staff/upline/downline scope, unauthorized mutations, and Storage object access.
4. Promote the verified build only after the five-taxpayer sanitized pilot and live migration checks pass.

## Verification performed

- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- Secret-shaped artifact scan: passed; no tracked private keys, tokens, service-role values, or real 2303 artifacts were found.
- Repository scans for secrets, raw API error leakage, unsafe HTML/eval, service workers, and untrusted navigation: no critical match found.
- Latest local verification: `npm run verify` passed; migration check reported 67 unique local versions, lint and typecheck passed, Vitest passed 54 files / 258 tests, and the production build completed successfully. The full sanitized Playwright gate ran 62 tests: 60 passed with 2 intentional project-specific skips across desktop and mobile. These results are local evidence only; they do not prove the current Vercel deployment or live Supabase schema.
- Non-demo runtime smoke check: a production build with `TAXMON_DEMO_MODE=false` passed; local `next start` redirected `/app/control-tower` to `/login`, returned `401` for unauthenticated `/api/work`, and emitted the baseline security headers.
