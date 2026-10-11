# Server boundary

TaxMonWeb server code follows one path:

`Route → authenticated command/query → repository or Supabase RPC → RLS/database constraint`

- Route handlers authenticate before reading or changing data.
- Repositories own Supabase queries and RPC calls; UI components do not query Supabase directly.
- Supabase RPCs are the transaction boundary for multi-record writes.
- RLS and server-side authorization are security boundaries; hidden UI is not.
- Effective dates, actor attribution, idempotency, and audit history are preserved by the command/database boundary.
- Missing or ambiguous authorization fails closed. It must never widen a fixture or database projection to `All A&T`.
- Prototype mode may read sanitized fixtures, but it does not weaken authenticated production commands or RLS.

## Fixture normalization boundary

`scripts/import-sanitized-fixtures.ts` is the only supported importer for the
sanitized client/profile fixture family. It writes deterministic references and
is safe to rerun; it is not a runtime fallback and must never receive a service
role key through browser or public environment configuration.

The importer deliberately stops at the boundary of authoritative data:

- Client, taxpayer, registration-unit, profile, source, group, contract, and
  audit-context fixtures are normalized into their owning tables.
- Assignment rows preserve the sanitized assignee label until a real
  authenticated `app_users` identity is onboarded and linked.
- Work, filing history, calendar, exceptions, and specialist-case fixtures are
  not promoted into legal/control tables without governed requirements, rules,
  compliance-universe decisions, ownership, and external evidence.
- Prototype-only fixture projections remain explicitly marked in code and are
  unavailable in production mode.

This is an intentional safety boundary, not a second source of truth. Unknown
tax content remains unresolved rather than being converted into a plausible
deadline or obligation.

## File ownership

- `client-repository.ts` — client portfolio reads and manual client setup commands.
- `tax-profile-repository.ts` — Tax Profile version and validation commands.
- `temporary-document-repository.ts` — temporary 2303 document commands and private-storage access.
- `bir-center-repository.ts` — read-only BIR office reference projection.
- `deadline-control-repository.ts` — restricted deadline repository reads and version-aware commands.
- `team-repository.ts` — effective-dated Team people, operating-model, and reporting-line reads and commands.
- `authorized-scope.ts` — server-side organizational-scope resolution for fixture projections.
- `supabase/server.ts` — server Supabase client and authenticated-user lookup.
- `supabase/config.ts` — environment and explicit prototype-mode flags.

Add a new repository only when a capability has a distinct persistence boundary; do not create parallel read models for the same operational truth.
