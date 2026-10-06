# TaxMonWeb Technical Architecture

**Document:** 06-TECHNICAL-ARCHITECTURE.md  
**Product:** TaxMonWeb  
**Status:** Approved V1 technical architecture / amended core-domain freeze
**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS-CONTROLS.md`, `03-RULES-DEADLINES.md`, `04-RBAC.md`, `05-UX-DESIGN-SYSTEM.md`

This document translates the approved product, domain, workflow, rules, RBAC, and UX direction into a secure, maintainable, managed-service-first V1 architecture.

It is not implementation code, SQL, migrations, React components, production RLS policies, API documentation, or deployment commands.

## A. Architecture summary

### Recommended V1 architecture

Use a modular monolith deployed primarily on managed/serverless infrastructure:

```text
User browser
    ↓
Next.js application on Vercel
    ├── UI and role-aware projections
    ├── server-side command/query boundary
    ├── short-lived serverless functions
    └── scheduled invocations where justified
    ↓
Supabase
    ├── Auth
    ├── PostgreSQL
    ├── Row Level Security for data visibility
    ├── private temporary Storage
    └── managed database/backups/functions where justified
    ↓
Managed document-extraction provider
    ↓
SharePoint, BIR platforms, banking channels, and Excel remain external sources
```

### Architectural position

- One coherent application;
- one PostgreSQL operational database;
- explicit module boundaries inside the application;
- server-side authorization for every material action;
- RLS for appropriate data-visibility boundaries;
- no microservices by default;
- no self-hosted servers, VMs, Kubernetes, persistent AI inference, Redis, Kafka, Elasticsearch, or second database without a concrete V1 requirement.

The architecture should optimize for maintainability and control integrity rather than nominal infrastructure cost.

The implementation must preserve this canonical domain spine:

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA`

Generated Compliance Work is the control/work object created by TaxMonWeb. It is not a tax-return computation or preparation engine.

## B. Deployment topology

### B.1 Vercel

Vercel hosts:

- the Next.js application;
- the browser-delivered experience;
- server-side query and command boundaries;
- short-lived serverless work;
- preview deployments;
- scheduled invocations where appropriate.

The browser must never receive privileged database or storage credentials.

### B.2 Supabase

Supabase provides:

- Supabase Auth for V1 authentication;
- PostgreSQL as the operational source of truth;
- RLS for appropriate record visibility;
- private temporary object storage for 2303 processing copies;
- managed backups and PITR subject to selected plan and policy;
- Edge Functions only where they solve a concrete server-side or webhook need;
- optional managed scheduling where it is simpler and more reliable than a Vercel schedule.

### B.3 External systems

| System | V1 responsibility |
|---|---|
| SharePoint | Permanent authoritative document repository and authoritative 2303 reference. No full direct integration required in V1. |
| BIR systems | Filing/submission execution and external result source. |
| Banking channels | Payment execution and payment-result source. |
| Excel working papers | Detailed tax preparation, computation, reconciliation, and technical schedules. |
| Managed extraction provider | Document understanding and proposed structured extraction only. |

### B.4 Region candidate

`ap-southeast-1` / Singapore is a reasonable initial Supabase-region candidate for Philippine latency.

It is not finally approved. TMF InfoSec, privacy, contractual, data-residency, cross-border-transfer, and vendor-risk review must confirm the region and service plans.

## C. Modular monolith boundaries

Modules share one application and PostgreSQL database but retain explicit ownership of business behavior and data contracts.

### C.1 Identity and Access

Responsibilities:

- stable user identity association;
- capabilities;
- organizational scope;
- effective-dated capability assignments;
- session/user context;
- action authorization inputs.

It does not decide tax applicability or replace domain-control checks.

### C.2 Organization

Responsibilities:

- Client-facing organizational scope;
- teams, towers, clusters, and A&T hierarchy;
- user membership and scope relationships;
- effective-dated organizational changes.

### C.3 Client / Taxpayer Entity / Registration Unit

Responsibilities:

- commercial Client relationship;
- legal Taxpayer Entity;
- Registration Unit;
- contacts and POC location;
- effective-dated Service Scope relationships.

Compliance Obligations attach to Registration Units.

### C.4 Registration Setup / 2303

Responsibilities:

- temporary source-document metadata;
- upload and processing lifecycle;
- extraction job orchestration;
- normalized extracted fields;
- confidence/attention/provenance;
- manual correction history;
- validation handoff.

The binary temporary source is private object storage, not a permanent document repository.

### C.5 Tax Profile

Responsibilities:

- Tax Profile versions;
- source-derived versus professionally determined values;
- validation and activation;
- profile history and provenance;
- relationship to source information.

### C.6 Expected Compliance

Responsibilities:

- Proposed Compliance Universe;
- Universe Items;
- applicability and Service Scope decisions;
- Registration Unit-level approval;
- unresolved and discrepancy exceptions;
- generation eligibility.

### C.7 Rules and Deadlines

Responsibilities:

- Obligation Definitions;
- finite Rule/Rule Version strategies;
- Requirement Definitions;
- Control Templates;
- Deadline Policies;
- Holiday Master;
- rule approval/effective dating;
- calculation explanation.

It does not execute arbitrary user-provided formulas or scripts.

### C.8 Obligation Generation

Responsibilities:

- generation runs;
- period strategies;
- obligation identity/idempotence;
- context capture;
- generation exceptions;
- prospective rule/profile impact analysis.

### C.9 Compliance Operations

Responsibilities:

- Compliance Obligation operational facts;
- components and requirement instances;
- actions/attempts/results;
- assignments;
- blockers;
- lifecycle commands;
- derived status projections.

### C.10 Evidence and Control

Responsibilities:

- external references;
- evidence and verification;
- signoffs;
- client copy/transmittal facts;
- Compliance Complete and Control Complete projections;
- Elevated Override facts.

### C.11 Calendar projections

Responsibilities:

- annual and upcoming projections;
- statutory versus internal versus service dates;
- filters and drill-downs.

It must not become a duplicate task store.

### C.12 Control Tower and Exceptions

Responsibilities:

- role/scope-aware read models;
- exception queues;
- RAG and blocker explanations;
- expected-compliance gaps;
- management drill-down.

### C.13 Audit

Responsibilities:

- append-oriented material audit events;
- actor/context attribution;
- ordinary versus elevated action history;
- audit access projection.

### C.14 Governance and Administration

Responsibilities:

- controlled Rules Library and Holiday Master maintenance;
- Control Template governance;
- user/organization administration;
- technical administration.

System Administration and Tax Control authority remain separate capabilities.

## D. Data architecture

### D.1 PostgreSQL as the operational source of truth

Use one Supabase PostgreSQL database for V1 operational records, configuration, history, jobs, and projections.

The database should preserve the distinction between:

- durable master/configuration data;
- versioned setup/governance data;
- generated operational records;
- append-oriented audit facts;
- derived projections.

### D.2 Stable identities

Use immutable internal identifiers for domain records. Do not use email addresses, display names, or mutable business labels as identity.

Business identifiers remain separate from internal identifiers. Human-readable names and labels may change without changing historical identity.

### D.3 Effective dating and versioning

Versioned/effective-dated concepts include:

- assignments;
- Tax Profile versions;
- Compliance Universe revisions;
- Service Scope decisions;
- Rule Versions;
- Requirement Definitions and Control Templates;
- Deadline Policies;
- Holiday Master context;
- generation context.

Use explicit effective-from/effective-to or version relationships. Avoid relying on one mutable current row plus an opaque generic audit blob.

### D.4 Historical snapshots and references

Generated Compliance Obligations should retain or reference enough context to explain:

- Tax Profile version;
- Approved Compliance Universe revision;
- Rule and Control Template versions;
- Deadline Policy and Holiday Master context;
- original ownership snapshot;
- generation run;
- calculated dates and explanation.

References should be combined with snapshots where future changes could otherwise make historical explanation dependent on mutable configuration.

### D.5 Obligation identity and idempotence

The default generation identity is:

```text
Registration Unit
+ Obligation Definition
+ Compliance Period
+ governed Instance Type
```

Generation must use an immutable generation identity or equivalent uniqueness boundary so repeated runs cannot create duplicate normal obligations.

Cancelled or superseded records remain part of history. A later regeneration must require a governed new context or explicitly approved related instance rather than accidentally recreating the same identity.

### D.6 Attempts, results, evidence, and signoffs

The relational model should preserve multiple:

- submission attempts;
- payment/funding attempts;
- attachment attempts;
- external results;
- evidence references;
- evidence verifications;
- signoffs;
- blocker events.

The current result may be projected, but prior attempts and results must remain historically visible.

Concepts such as Component and Result do not automatically require separate top-level persistence objects. Use child records or structured fields when that preserves the required history without unnecessary fragmentation.

### D.6a Data Readiness and package targets

Persist or derive a small Data Readiness condition before Engagement execution:

- Not Ready;
- Ready;
- blocker reason where Not Ready.

The architecture must separately preserve component statutory deadlines and the TMF Package Target. The package target is the internal target for completing the entire applicable package one Philippine working day before the earliest applicable statutory deadline; it must never overwrite statutory dates.

Return Client Approval and Payment Client Approval are separate action facts.

### D.6b Independent QA

QA is a separate control lifecycle that may run after Engagement Completion or on a later/monthly cadence. It must not block filing or statutory completion.

Persist or project:

- QA selection state;
- QA Pending/Passed/Failed;
- finding and RCA/remediation references;
- Re-QA history;
- QA Completion %;
- QA Pass Rate %.

QA Failed automatically requires RCA/remediation owned by the Engagement Team. Tax Team records findings and rechecks.

### D.7 Assignments

Persist:

- original obligation ownership snapshot;
- current accountable owner;
- assignment/reassignment history;
- actual actor history;
- signoff actors.

Completed historical facts must not be updated when current assignment changes.

### D.8 Blockers, risks, and exceptions

Keep separate data/projection concepts:

- Blocker: why normal progression is impeded;
- Risk/RAG: timing exposure from approved deadline/control facts;
- Exception: unresolved, abnormal, conflicting, overridden, failed-generation, or other non-standard condition.

They may coexist and must not be represented by one overloaded status field.

### D.9 Conceptual PostgreSQL constraint patterns

The physical schema is deferred, but the design should consider:

- unique immutable identifiers for all durable records;
- unique generation identity for normal obligations;
- foreign-key relationships for Registration Unit, Universe, Rule, and assignment context;
- non-overlapping effective periods for active versions where required;
- constrained enumerations or reference data for governed state categories;
- required reason and actor fields for overrides, cancellations, reassignments, and exceptions;
- append-only audit semantics;
- indexes for Registration Unit, Client, current owner, organizational scope, deadline date, RAG, blocker, exception, and operational status;
- indexes supporting Expected Compliance unresolved items and generation exceptions;
- optimistic concurrency/version checks for concurrent updates.

### D.10 Projections and summaries

Start with indexed queries and ordinary database views/read models.

Potential later projections include:

- current obligation queue;
- upcoming deadline summary;
- Control Tower exception counts;
- Compliance Complete versus Control Complete gaps;
- Expected Compliance versus generated-obligation reconciliation.

Do not introduce materialized views, caches, or a search engine before measured query need exists.

## E. Authentication and authorization architecture

### E.1 Supabase Auth

Use Supabase Auth for V1 unless vendor, security, or deployment review identifies a stronger managed option.

The application should associate Supabase’s stable user identity with an internal user/profile record. Email is a contact/login attribute, not the historical identity key.

The model should remain SSO-ready by preserving:

- stable internal user identity;
- external identity/provider metadata;
- immutable actor references in audit/signoff history;
- capability and organization assignments independent of authentication method.

Corporate SSO implementation remains outside V1.

### E.2 Authorization layers

Authorization is enforced in layers:

1. **UI visibility** — reduces clutter and presents valid actions.
2. **Server-side action authorization** — validates capability, scope, action, and object state.
3. **RLS/data visibility** — constrains database reads and appropriate writes.
4. **Domain-control validation** — enforces Control Templates, actual-actor SoD, approvals, external-state strength, and lifecycle rules.
5. **Audit** — records material actions and elevated decisions.

RLS must not be expected to encode every multi-record business-control rule.

### E.3 RLS boundary

Use Supabase RLS for appropriate client-sensitive operational visibility, including:

- Client/Taxpayer Entity/Registration Unit scope;
- obligation visibility;
- Expected Compliance visibility;
- evidence-reference visibility;
- organization-scoped reads.

Complex business actions such as Universe approval, four-eye signoff, generation, reassignment, cancellation, and Elevated Override should pass through server-side domain commands that perform explicit checks.

### E.4 Privileged credentials

The Supabase service-role key must never be exposed to the browser.

If privileged server-side access is required, it must run only in protected Vercel/Supabase server contexts, with narrowly scoped code paths, secrets management, audit, and no client-controlled privilege parameters.

### E.5 Multiple capabilities

Authorization evaluates the intersection of:

- user identity;
- active capabilities;
- organizational scope;
- object scope;
- applicable Control Template;
- current record state;
- actual-actor conflict rules;
- elevated authority where applicable.

Capability union must not allow a user with both Preparer and Checker capability to check their own preparation.

### E.6 MFA and privileged access

MFA should be required or strongly enforced for privileged users and elevated capabilities, subject to Supabase Auth capability and TMF policy.

At minimum, Tax Team, HOD, System Administration, rule governance, and Elevated Override access should receive stronger authentication and monitoring than ordinary operational access.

## F. AI/document-extraction architecture

### F.1 Replaceable provider boundary

Implement a server-side conceptual `DocumentExtractionProvider` boundary.

The application owns:

- document job identity;
- source association;
- provider request lifecycle;
- normalized extraction output;
- confidence/attention mapping;
- provenance;
- human review state;
- provider failure/retry handling.

The provider owns document understanding, not TaxMonWeb tax judgment.

### F.2 Pipeline

```text
2303 PDF/image
  → private temporary storage
  → DocumentExtractionProvider
  → structured proposed JSON
  → normalized fields + confidence/attention/provenance
  → human correction/review
  → Tax Profile validation
  → Proposed Expected Compliance
```

### F.3 Two logical AI layers

#### Layer 1 — Document extraction

Read what is printed on the 2303 or supplied source document.

Output should include normalized fields, source references, page where available, confidence/attention signals, and provider metadata required for provenance.

#### Layer 2 — Control assistance

Compare extracted registration information with the proposed Tax Profile and Expected Compliance context.

It may flag:

- mismatches;
- missing information;
- inconsistent values;
- unresolved applicability questions;
- configuration gaps.

It must not autonomously decide uncertain tax treatment, activate a Tax Profile, approve Expected Compliance, or generate approved work.

### F.4 Provider-selection criteria

Managed/serverless-compatible candidates should be evaluated for:

- 2303 field-level extraction quality;
- structured JSON output;
- document/table/layout understanding;
- usable confidence or uncertainty signaling;
- security/privacy and no-training commitments;
- latency and operational reliability;
- cost at expected volume;
- PH/Singapore-region implications;
- data-retention controls;
- ease of provider replacement.

Do not reduce the design to Tesseract plus regular expressions. Do not commit to PaddleOCR-VL or another self-hosted model if it would require persistent inference infrastructure.

### F.5 Confidence thresholds

Confidence thresholds must not be hardcoded before benchmarking against representative sanitized 2303 samples.

Until benchmarked:

- preserve provider confidence and attention signals;
- surface low-confidence/ambiguous/conflicting fields;
- require human review for flagged fields;
- allow manual entry/correction;
- never use confidence alone to activate a Tax Profile.

### F.6 Provider failure and raw output

Provider responses should be normalized into the application’s provenance model. Raw provider payload retention should be minimized and governed because it may contain sensitive document content.

Provider-specific data must not leak into the domain model such that replacing the provider requires redesign.

## G. Temporary document storage

### G.1 Supabase private Storage

Supabase private Storage is an appropriate V1 candidate for temporary 2303 processing copies, subject to InfoSec and plan review.

Required properties:

- private bucket/object access;
- short-lived signed access for authorized review;
- server-side authorization before issuing access;
- least-privilege storage paths;
- upload size/type restrictions;
- lifecycle/purge support;
- no public URLs;
- no Git or application repository storage;
- structured provenance retained after purge.

### G.2 Upload controls

The upload boundary should validate:

- authenticated user;
- permitted setup context;
- file type and size;
- upload completion;
- source association;
- malware/content-security policy where required;
- extraction job creation.

Do not trust browser-provided MIME type alone.

### G.3 Lifecycle

```text
Upload
  → private temporary object
  → extraction
  → human review/correction
  → Tax Profile validation
  → Expected Compliance approval
  → authoritative SharePoint reference
  → approved retention condition
  → purge
```

The retention duration remains configurable and is not hardcoded in the domain.

The application retains source identity/version metadata, extraction history, values, confidence, corrections, validation, SharePoint reference, and purge event after deletion.

### G.4 SharePoint boundary

No full SharePoint integration is required in V1. The setup experience must capture an authoritative SharePoint reference through an approved human-controlled process before purging the temporary copy, unless an approved exception is recorded.

## H. Background and scheduled processing

Background execution should be used only where request/response processing is unsafe, slow, or operationally repetitive.

### H.1 Recommended execution approach

Use database-persisted job state plus managed invocation:

- Vercel Functions for short-lived server-side commands and provider webhooks;
- Vercel Cron or Supabase managed scheduling to invoke periodic work;
- Supabase Edge Functions only where a concrete webhook or server-side need justifies them;
- PostgreSQL job state for retry, idempotence, lease/claim, and audit context.

Do not add Redis, Kafka, a dedicated worker fleet, or a message broker for V1.

### H.2 Candidate asynchronous work

| Process | Default V1 approach |
|---|---|
| 2303 extraction | Asynchronous job/provider call; webhook or safe polling; human review waits for result. |
| Proposed Expected Compliance generation | Synchronous for small bounded work where safe; job-backed if rule evaluation or volume makes the request unreliable. |
| Annual obligation generation | Explicit idempotent command on approval plus scheduled sweep for missed/future work. |
| Deadline/RAG refresh | Read/write calculation where practical; scheduled refresh only for measured projection need. |
| Temporary-document purge | Scheduled job after retention and SharePoint-reference conditions. |
| Rule/profile impact analysis | Job-backed when identifying affected open obligations. |
| Integrity checks | Scheduled low-volume checks with visible exceptions. |

### H.3 Job requirements

Every job that affects compliance-control facts should be:

- idempotent;
- retry-safe;
- bounded;
- observable;
- attributable;
- auditable where it changes domain facts;
- safe to resume after browser or function interruption.

Use a durable job state such as pending, running, succeeded, failed, retryable, or permanently failed. Do not rely on in-memory serverless state.

## I. Rules engine and typed strategies

### I.1 No generic rules engine

Rules are governed data interpreted by application code.

Users cannot upload:

- scripts;
- arbitrary formulas;
- executable expressions;
- workflow graphs;
- provider-specific code.

### I.2 Strategy registry

Application code provides a finite registry of supported strategy types, for example:

- profile-attribute applicability;
- explicit human applicability decision;
- recurring calendar/fiscal period generation;
- approved annual/effective period generation;
- fixed or period-anchored deadline;
- approved offset deadline;
- approved non-working-day adjustment;
- no-adjustment policy;
- One-Day-Before internal target;
- service milestone relative to approved anchor.

Configuration stores the strategy type and validated parameters. The application interprets those parameters through known code paths.

### I.3 Publish-time validation

Before a Rule Version becomes active, validate:

- supported strategy type;
- required parameters;
- effective-date consistency;
- compatible Obligation Definition;
- compatible Control Template and component configuration;
- Holiday Master references where required;
- no conflicting active configuration within the same governed scope.

Invalid or incomplete configuration cannot silently become active.

### I.4 Runtime failure behavior

If required rule content is missing, incompatible, or unresolved:

- generation or calculation fails visibly for the affected item;
- an Exception is recorded;
- the Expected Compliance item remains visible;
- no fabricated obligation, deadline, or applicability decision is created;
- unrelated valid items may continue if the run is designed for item-level isolation;
- the failed item is retryable after correction.

## J. Obligation generation

### J.1 Generation command boundary

Generation should be an explicit server-side domain command, initiated by:

- Approved Compliance Universe activation;
- an approved future-period generation action;
- a scheduled sweep;
- an authorized controlled regeneration/impact action.

The browser does not directly insert generated obligation records.

### J.2 Idempotence

The generation command uses the approved identity:

```text
Registration Unit + Obligation Definition + Compliance Period + governed Instance Type
```

It must tolerate:

- browser retry;
- scheduled retry;
- duplicate job invocation;
- provider/network timeout after database commit;
- partial generation run.

### J.3 Context capture

Every generated obligation captures or references:

- Tax Profile version;
- Approved Compliance Universe revision;
- Rule/Requirement/Control Template versions;
- Deadline Policy and Holiday Master context;
- assignment snapshot;
- generation run;
- calculated deadlines and explanation.

### J.4 Partial generation

Generation should isolate item-level failures where practical:

- successful eligible items remain generated;
- failed items receive visible generation Exceptions;
- the run reports partial failure;
- retry processes only failed or unresolved items after correction;
- duplicate creation remains impossible.

Completed historical obligations are never silently rewritten by a new generation run.

## K. Workflow implementation

### K.1 Domain behavior instead of workflow engine

Implement workflow as domain commands and projections over:

- Generated Compliance Work represented by Compliance Obligation;
- requirement instances;
- components;
- actions/attempts;
- results;
- evidence;
- signoffs;
- blockers;
- assignments;
- derived completion/RAG/Exception projections.

Data Readiness is a prerequisite condition, not a mandatory Data Request stage. Ordinary V1 execution enforces Preparation → Checking → Review → Client Approval → Filing, followed by conditional Payment and Other Submission components.

Do not create arbitrary user-defined transitions.

### K.2 Command validation

Each server-side action should validate:

1. authenticated identity;
2. capability and organizational scope;
3. object visibility;
4. current object/version state;
5. applicable Control Template;
6. prerequisite requirements;
7. external-result/evidence strength;
8. actual-actor SoD conflicts;
9. whether the action is ordinary or Elevated Override;
10. required reason and audit context.

### K.3 Invalid transitions

Invalid actions should fail with a useful explanation and no partial mutation.

Examples:

- recording Review signoff before required Checking;
- self-checking preparation;
- marking Payment confirmed from initiation alone;
- marking Submission accepted from a sent assertion alone;
- closing an unresolved attachment requirement;
- using override to create an external fact;
- clearing a blocker without the required authority/evidence.

### K.4 Concurrent updates

Use optimistic concurrency/version checks for obligation and configuration updates.

If two users update the same obligation, the later command should detect stale context, preserve the earlier committed event, and ask the user to refresh/review rather than silently overwrite it.

## L. Auditability architecture

### L.1 Append-oriented audit events

Material events should capture:

- actor identity or system job identity;
- timestamp in a consistent canonical form and display timezone context;
- object type and object identity;
- action/event type;
- old/new material values where appropriate;
- reason where required;
- rule/profile/universe/assignment context;
- ordinary versus Elevated Override action;
- source/evidence references where relevant;
- request/job/correlation identifier;
- result or failure.

### L.2 Domain history versus audit

Audit events do not replace:

- effective-dated assignments;
- Tax Profile versions;
- universe revisions;
- rule versions;
- obligation attempts/results;
- evidence/signoff history;
- deadline calculation context.

Both domain history and cross-cutting audit are required.

### L.3 Audit protection

Ordinary application workflows must not edit or delete audit events.

Privileged maintenance, retention, export, and any legally required redaction process must be separately controlled, audited, and restricted.

Actions that change compliance-control facts should commit their domain change and corresponding audit event atomically where feasible.

## M. Security and privacy

### M.1 Least privilege

Apply least privilege across:

- browser sessions;
- Vercel server functions;
- Supabase database roles;
- Storage access;
- extraction-provider credentials;
- scheduled jobs;
- administrators;
- Tax Team/HOD elevated capabilities.

### M.2 RLS and server authorization

RLS protects appropriate data visibility. Server-side domain authorization protects business actions and cross-record controls.

Neither layer should be treated as sufficient alone.

### M.3 Data protection

Use managed-platform encryption in transit and at rest, private storage, secure cookies, and managed secrets.

Do not log:

- document contents;
- full 2303 payloads;
- TINs unless operationally necessary and appropriately protected;
- unnecessary client-sensitive fields;
- provider raw responses containing sensitive source data.

### M.4 Application protections

The architecture should include:

- secure headers and CSP appropriate to the application;
- XSS-safe rendering of extracted and user-supplied values;
- input validation at server boundaries;
- CSRF protection appropriate to the chosen session/action model;
- upload size/type validation;
- private signed access to temporary documents;
- rate limiting or abuse protection for upload and authentication actions;
- dependency vulnerability monitoring;
- secure error messages that do not disclose sensitive data.

### M.5 Admin and elevated protection

Protect Tax Team, HOD, rule governance, and System Administration capabilities with stronger authentication and monitoring, including MFA where supported and approved.

System Administration must not automatically obtain tax-control authority.

### M.6 Retention and deletion

Temporary 2303 binary retention is configurable and must be enforced by managed lifecycle/purge jobs.

Structured provenance and purge events remain after binary deletion. Audit and domain retention requirements must be approved by TMF policy and InfoSec.

## N. Environments and deployment controls

### N.1 Local development

Use:

- sanitized fixtures;
- local or isolated development configuration;
- no real client 2303s;
- no production credentials;
- no production SharePoint links or client identifiers.

### N.2 Development/Preview

Vercel preview deployments must not receive real client documents or unsanitized identifiers.

Prefer a separate Supabase project or isolated database/storage environment for preview. Preview URLs must not expose private temporary documents.

### N.3 Staging

Staging should use:

- separate Supabase project/database/storage;
- controlled sanitized or approved test data;
- production-like authorization and audit behavior;
- managed extraction provider test/sandbox mode where available;
- separate secrets and service credentials.

### N.4 Production

Production uses:

- production Vercel project/environment;
- production Supabase project/database/storage;
- production secrets;
- approved region and vendor agreements;
- backup/PITR policy;
- controlled deployment and rollback process;
- real client-data protections.

Environment identity must be explicit. A preview or staging function must not be able to access production storage or database by accident.

## O. Observability

### O.1 Questions the system must answer

Observability should identify:

- whether obligation generation ran;
- whether extraction failed or returned partial data;
- whether a scheduled job failed;
- whether temporary-file purge failed;
- whether authorization attempts failed;
- whether an exception is caused by business data or system failure;
- whether provider latency or rate limits are affecting setup.

### O.2 Minimal managed observability

Use Vercel and Supabase logs/metrics plus structured application events appropriate to V1.

Capture:

- correlation/request ID;
- job ID;
- module/action name;
- duration;
- outcome;
- retry count;
- safe error category;
- environment.

Redact document contents, TINs, source payloads, and unnecessary client data.

### O.3 Business versus system failure

The UI and operational records should distinguish:

- business/configuration Exception;
- provider/system failure;
- authorization failure;
- external result unknown;
- user-correctable validation error.

This prevents management from treating technical failure as client delay or tax non-compliance.

## P. Performance and scale

The expected scale is approximately:

- 70+ internal users;
- 100+ clients;
- multiple Taxpayer Entities and Registration Units;
- recurring annual obligations.

This is comfortably within a well-indexed PostgreSQL and serverless application design.

### P.1 Initial performance strategy

- use indexed PostgreSQL queries;
- keep primary list queries scoped and bounded;
- paginate operational tables;
- select only required columns for list views;
- use read-oriented projections for Control Tower and Calendar if query plans justify them;
- calculate simple RAG/status projections at read/write time;
- avoid loading full audit/event history into ordinary screens.

### P.2 Candidate projections

Measure before introducing them, but likely candidates include:

- current My Work queue;
- Control Tower exception summary;
- due-today/upcoming aggregation;
- Expected Compliance reconciliation summary;
- Compliance Complete versus Control Complete gap summary.

Do not add Redis, Elasticsearch, Kafka, or a second database for this scale without measured evidence.

## Q. Failure and recovery model

### Q.1 Extraction provider failure

- mark the extraction job retryable or failed;
- preserve source metadata and job history;
- show a visible Exception;
- allow retry or manual structured entry;
- do not activate the Tax Profile automatically.

### Q.2 Partial or malformed extraction

- preserve the extraction run;
- normalize valid fields where safe;
- flag missing/malformed/conflicting values;
- require human review;
- do not silently coerce uncertain tax content.

### Q.3 Storage unavailable

- do not claim upload completion until the object is safely stored;
- do not create an active extraction job without a valid source reference;
- provide a retryable error;
- preserve a safe failure/audit record without sensitive payload leakage.

### Q.4 Partial generation failure

- preserve successful item generation;
- record failed items as Exceptions;
- retry only failed/unresolved items;
- maintain idempotence;
- report partial run status to authorized users.

### Q.5 Scheduled retry

Use durable job state, attempt counts, bounded retries, and permanent-failure escalation. A retry must not duplicate obligations or audit events incorrectly.

### Q.6 Double submission or browser refresh

Use idempotency keys or equivalent command identity for user actions that create attempts, approvals, generation, or lifecycle events.

Refresh should show the committed result rather than create a second action.

### Q.7 Unknown external filing/payment result

Preserve the action as reported/initiated/unknown/unverified according to configured vocabulary. Do not promote it to accepted, confirmed, or verified without required result/evidence.

### Q.8 Unresolved rule

Record a visible Exception, leave Expected Compliance/generation unresolved as appropriate, and do not invent a rule or deadline.

### Q.9 Authorization changes while a screen is open

Re-check authorization at the server-side command boundary. A stale screen must not retain authority after capability/scope changes.

Return a safe refresh/review message rather than partially applying the action.

### Q.10 Concurrent obligation updates

Use optimistic concurrency. Preserve the first committed change and require the second user to refresh/reconcile rather than silently overwrite history.

### Q.11 Temporary purge failure

- retain the temporary object;
- record a retryable purge failure;
- surface an Exception to authorized control users;
- retry safely;
- record the final purge event only after successful deletion.

## R. Technical decision records

### TDR-001 — Vercel

**Decision:** Use Vercel for the Next.js application, deployments, preview environments, and short-lived server-side work.

**Why:** Managed deployment, low infrastructure administration, strong fit for a serverless-first modular monolith.

**Alternatives considered:** Self-hosted VM, container platform, Kubernetes, traditional application server.

**Trade-off:** Function duration, background-processing, and vendor/platform constraints require durable job state and careful async design.

**Reversibility:** High at the application boundary if domain modules and database contracts remain provider-neutral.

### TDR-002 — Supabase

**Decision:** Use Supabase for Auth, PostgreSQL, private temporary Storage, managed backups/PITR, and limited managed functions/scheduling where justified.

**Why:** One managed platform covers the core V1 data, identity, and temporary-document requirements.

**Alternatives considered:** Separate managed database, object storage, and identity providers; self-hosted PostgreSQL; custom auth.

**Trade-off:** Vendor coupling and plan limits, especially around storage, function duration, region, and operational features.

**Reversibility:** Moderate. Stable repository/application boundaries and provider-neutral domain code preserve migration options.

### TDR-003 — PostgreSQL

**Decision:** Use PostgreSQL as the single operational data source for V1.

**Why:** Strong relational constraints, effective dating, history, scoped queries, and sufficient scale.

**Alternatives considered:** NoSQL document store, multiple databases, event store as primary source.

**Trade-off:** Requires disciplined relational modeling and query/index design.

**Reversibility:** Moderate. Domain repositories/commands can later abstract storage, but migration remains material.

### TDR-004 — Supabase Auth

**Decision:** Use Supabase Auth for V1 while keeping internal identity independent of provider details.

**Why:** Managed authentication without building password/session infrastructure.

**Alternatives considered:** Custom auth, standalone identity provider, immediate corporate SSO.

**Trade-off:** SSO and enterprise identity integration are deferred and must later map to stable internal subjects.

**Reversibility:** High if email is not used as the actor identity key and provider metadata is isolated.

### TDR-005 — RLS boundary

**Decision:** Use RLS for appropriate data visibility, but enforce business actions and control rules in server-side domain commands.

**Why:** RLS is strong for row visibility but is not a suitable sole mechanism for multi-record SoD, approval, generation, or Elevated Override behavior.

**Alternatives considered:** RLS-only; application-only authorization; separate authorization service.

**Trade-off:** Two authorization layers must remain aligned and tested.

**Reversibility:** High at the business-policy layer; database policy migration still requires care.

### TDR-006 — Temporary document storage

**Decision:** Use a private Supabase Storage location for temporary 2303 processing copies, subject to security/plan approval.

**Why:** Managed, private, close to the database/authentication boundary, and sufficient for V1 temporary storage.

**Alternatives considered:** Permanent TaxMonWeb document repository, local filesystem, Git, public object storage, separate custom storage service.

**Trade-off:** Storage lifecycle, scanning, retention, region, and purge guarantees require explicit policy and testing.

**Reversibility:** High if the domain stores provider-neutral source metadata and object identity.

### TDR-007 — Document extraction provider boundary

**Decision:** Integrate through a replaceable server-side `DocumentExtractionProvider` abstraction and evaluate managed candidates before selecting one.

**Why:** Avoids self-hosted inference and prevents provider-specific extraction data from becoming the domain model.

**Alternatives considered:** Tesseract/regex; PaddleOCR-VL or another self-hosted model; hardcoded single-provider integration.

**Trade-off:** Adapter work and provider normalization are required; managed provider cost may exceed open-source hosting cost.

**Reversibility:** High if normalized output/provenance is stable and provider payloads are isolated.

### TDR-008 — Background jobs

**Decision:** Use durable PostgreSQL job state with managed Vercel/Supabase invocation, not a dedicated queue or worker fleet.

**Why:** Expected volume is modest and infrastructure simplicity is a priority.

**Alternatives considered:** Redis queue, Kafka, managed queue service, dedicated workers, container jobs.

**Trade-off:** Job orchestration must handle retries, leases, idempotence, timeouts, and observability carefully.

**Reversibility:** Moderate. A later queue can consume the same durable job contract if needed.

### TDR-009 — Modular monolith

**Decision:** Keep modules within one coherent application and database.

**Why:** Matches scale, lowers operations burden, and preserves transactionally coherent control behavior.

**Alternatives considered:** Microservices, separate workflow service, separate rules service, separate audit service.

**Trade-off:** Module boundaries and dependency direction must be disciplined.

**Reversibility:** Moderate. Clear module contracts allow later extraction if scale or ownership requires it.

### TDR-010 — Audit strategy

**Decision:** Use append-oriented audit events alongside proper versioned/effective-dated domain records.

**Why:** A generic log cannot explain historical configuration or replace immutable control facts.

**Alternatives considered:** Generic JSON audit blob only; full event sourcing; database logs only.

**Trade-off:** Material actions must consistently emit domain history and audit events.

**Reversibility:** Low-to-moderate after production adoption, so event fields and immutability should be designed carefully.

## S. Decisions requiring domain-owner, InfoSec, or vendor input

1. Supabase region, especially `ap-southeast-1`, including privacy, contractual, residency, and cross-border-transfer approval.
2. Supabase and Vercel plan limits, function duration, storage, backup/PITR, and cost envelope.
3. Managed document-extraction provider selection, including vendor security, data processing, retention, no-training terms, latency, cost, and region.
4. Whether Supabase private Storage satisfies TMF InfoSec requirements for temporary 2303 processing copies.
5. Temporary-document retention duration and purge policy.
6. Malware/file scanning requirements and approved provider/process.
7. MFA requirements for Tax Team, HOD, System Administration, and Elevated Override capability.
8. Audit retention, export, privileged access, and legally required redaction policy.
9. Whether manual SharePoint-reference capture is sufficient for V1 or whether a limited integration is required.
10. Preview/staging data policy and whether isolated Supabase projects are mandatory for every environment.
11. Backup restoration testing and disaster-recovery expectations.
12. Final production typography and brand-token validation from the UX baseline.

## T. Contradictions discovered

No contradiction requiring changes to the approved Domain Model, Workflow/Controls model, Rules/Deadlines model, RBAC model, or UX baseline was found.

Two operational constraints require explicit implementation discipline:

1. SharePoint is the permanent 2303 source while TaxMonWeb temporarily stores the processing copy. The architecture resolves this by requiring an authoritative SharePoint reference before purge, unless an approved exception retains the temporary copy longer.
2. Vercel/serverless execution is not suitable for unbounded extraction or batch work. The architecture therefore requires managed asynchronous provider behavior, durable PostgreSQL job state, bounded retries, and idempotent commands rather than introducing persistent workers by default.

These are implementation constraints, not domain contradictions.
