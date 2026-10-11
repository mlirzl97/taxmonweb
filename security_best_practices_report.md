# TaxMonWeb Security Review

## Executive summary

TaxMonWeb has a solid prototype security foundation: Supabase session lookup, server-side capability checks, RLS migrations, sanitized prototype mode, upload signature/size validation, safe API error responses, explicit mutation origin checks, baseline security headers, a server-only temporary-document purge executor, and zero production dependency vulnerabilities. The code-level gate now passes for these controls; live Vercel/Supabase configuration and authenticated negative testing remain deployment gates.

## Scope and assumptions

- Scope: Next.js/TypeScript runtime, API route handlers, Supabase access layer, temporary 2303 upload boundary, configuration, and dependency tree.
- Deployment assumption: Vercel application with Supabase Auth/Postgres/Storage.
- Data assumption: structured client text is retained; 2303 files are temporary onboarding inputs only.
- Cloudflare assumption: no Cloudflare configuration or deployment binding was found in this repository. This is therefore an application security review, not a Cloudflare edge configuration audit.
- Live Supabase RLS and billing settings were not directly inspected. The production deployment, public response headers, and authenticated purge route were verified after release. Server-only purge variables are now configured in Vercel Production.

## Findings

### SEC-001 — Explicit CSRF/origin protection on state-changing APIs

- Severity: High before production; Medium if the deployed cookie policy and trusted-origin edge controls are independently verified.
- Location: `src/app/api/*/route.ts` POST handlers; shared auth boundary in `src/lib/server/api-authorization.ts`.
- Evidence: all state-changing application API handlers call the shared `requireSameOrigin` guard after authentication/capability checks. Unauthenticated requests still return 401 before origin evaluation; missing or foreign origins return 403.
- Impact: a cross-site request could attempt a state-changing action using a user’s authenticated browser session if browser cookie policy or deployment configuration permits it.
- Fix: implemented in `src/lib/server/request-origin.ts` and covered by unit tests. `TAXMON_TRUSTED_ORIGINS` supports explicitly governed additional origins; no permissive wildcard is used.
- Status: resolved in code; live deployment verification remains.

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
- Status: resolved in code; production env/cron invocation and retention policy remain operational gates.

### SEC-004 — Input validation is partly manual and partly type-asserted

- Severity: Medium.
- Location: API handlers and repository boundaries, including `src/app/api/registration-units/[registrationUnitId]/temporary-2303/route.ts` and `src/lib/server/*repository.ts`.
- Impact: future endpoint changes could accept malformed values or rely on TypeScript assertions that do not validate runtime data.
- Fix: use small runtime schemas at request boundaries and explicit repository adapters for high-risk commands/queries. Keep the existing upload byte-signature and size checks.
- Status: partially mitigated; follow-up hardening remains recommended for broader schema validation.

## Controls that passed static review

- Dependency audit: `npm audit --omit=dev` reports 0 vulnerabilities.
- Secrets: `.env.local` is ignored; only `.env.example` is tracked; no privileged Supabase service-role key is referenced in browser code.
- Authentication: protected `/app` routes pass through `src/proxy.ts`; API routes use server-side Supabase context/capability checks.
- Authorization: RLS is enabled across the tax/client/reference tables and Storage policies are scoped to authenticated users and registration-unit permissions.
- Error handling: API responses use safe fallback messages instead of returning repository/database messages.
- Upload boundary: temporary 2303 uploads restrict MIME type, size, filename length, idempotency key, and file signature; prototype mode rejects non-synthetic sources.
- XSS/dynamic code scan: no `dangerouslySetInnerHTML`, raw DOM HTML sinks, `eval`, `new Function`, or untrusted outbound URL fetch pattern was found.

## Production gate

**Result: CONDITIONAL — code-level controls pass; live production gates remain.**

Required before real client-data onboarding:

1. Verify the scheduled purge invocation on its first scheduled run; the authenticated smoke test now returns 200 with `scanned: 0, purged: 0, failed: 0`.
3. Ensure the approved lifecycle marks documents `purge_eligible` with an approved `purge_eligible_at`; no retention duration is invented in this code pass.
4. Run authenticated negative tests against the live Supabase/Vercel environment: cross-client access, staff/upline/downline scope, unauthorized mutations, and Storage object access.

## Verification performed

- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- Repository scans for secrets, raw API error leakage, unsafe HTML/eval, service workers, and untrusted navigation: no critical match found.
- Latest verification: lint passed; typecheck passed; 37 test files / 180 tests passed; clean isolated production build passed (22 static pages). Latest production deployment is READY at `https://taxmonweb.vercel.app`. Live checks: `/` returned 200, `/app/control-tower` redirected to `/login`, unauthenticated `/api/work` returned 401, purge endpoint without its secret returned 401, authenticated purge returned 200 with zero eligible documents, and baseline security headers were present. The earlier complete E2E run passed 44 tests with 2 intentional skips; a post-change E2E rerun was not completed because the local `next dev` runner repeatedly orphaned on port 3110 and exited with 143.
