# TaxMonWeb V1 Build Plan

**Status:** Approved V1 build baseline / amended core-domain freeze

**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS-CONTROLS.md`, `03-RULES-DEADLINES.md`, `04-RBAC.md`, `05-UX-DESIGN-SYSTEM.md`, `06-TECHNICAL-ARCHITECTURE.md`

**Scope:** Transition from approved product/domain/technical design into implementation. This document does not define SQL, routes, components, APIs, migrations, deployment commands, or production tax content.

## 1. Build purpose

TaxMonWeb will be built as a sequence of vertical slices. Each slice must produce working, reviewable behavior across the relevant domain, data, authorization, UI, and tests.

The operating loop is:

> Working slice → domain-owner review → correction → next slice

The build is successful when a real A&T team can understand what requires attention, perform the next valid action, and trust the resulting history without having to administer a generic workflow system.

The governing product tests remain:

- Set up once. Generate automatically. Manage by exception.
- Automate what is deterministic. Flag what requires judgment.
- Every click must advance work, evidence a control, resolve an exception, or provide useful information.
- Complexity may exist in the model; the accountant experience should remain simple.

The frozen implementation spine is:

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA`

Generated Compliance Work means the work/control object created by TaxMonWeb. It does not mean that TaxMonWeb prepares or computes the tax return.

## 1.1 Module-by-module development boundary

After the core-domain freeze, product development proceeds one module at a time:

1. People & Portfolio Foundation;
2. Client Registry & Tax Profile;
3. BIR Requirement Master, Rules & Calendar;
4. Compliance Setup;
5. Tax Run / Filing Execution;
6. Control Tower & My Work;
7. Tax Team QA;
8. Gamification & Management.

Each module follows:

`HOD operational interview → module requirements → UX/interaction design → pressure test → build → HOD testing → corrections → module freeze`

Downstream modules must not be elaborated or implemented merely because their eventual concepts are known.

## 2. Build guardrails

### 2.1 Prototype data safety

All local, preview, and demonstration environments use sanitized or synthetic data only.

No prototype fixture may contain a real client TIN, address, registration identifier, contact, SharePoint link, document, or other client-sensitive value.

The initial fixture set should contain approximately:

- 3–5 representative Clients;
- multiple Taxpayer Entities and Registration Units;
- materially different sanitized Tax Profile shapes;
- in-scope and out-of-scope Expected Compliance items;
- recurring and annual fixture obligations;
- payable and no-payment examples;
- attachment and no-attachment examples;
- different accountable owners and actual actors;
- clean, low-confidence, incomplete, ambiguous, and conflicting extraction results;
- GREEN, AMBER, RED, blocked, configuration-exception, and control-incomplete examples.

Representative 2303 samples supplied by the domain owner may inform fixture design, but the files used by the prototype must be sanitized/anonymized before entering the project data set.

### 2.2 No invented tax content

The prototype may use clearly labelled test fixture content, but it must not present invented Philippine deadlines, holiday treatment, forms, attachments, tax interpretations, or applicability decisions as approved tax rules.

Every tax-content fixture must identify its status, such as `illustrative test fixture — not approved tax content`.

### 2.3 Approved architecture remains binding

Implementation stays within the approved managed/serverless-first modular monolith:

- Vercel and Next.js for the application boundary;
- Supabase Auth, PostgreSQL, RLS, private temporary storage, and managed platform capabilities;
- external SharePoint, BIR, banking, Excel, and extraction-provider boundaries;
- no microservices, self-hosted AI, generic workflow engine, generic rules DSL, or unnecessary infrastructure.

### 2.4 Definition of done for every slice

No slice is complete until it has:

- working user-visible behavior;
- approved domain behavior preserved;
- server-side authorization and relevant RLS coverage;
- useful failure and empty states;
- required audit/history behavior;
- unit/integration tests appropriate to the slice;
- lint, typecheck, and baseline test suite passing;
- no sensitive fixture data;
- relevant responsive behavior;
- accessibility basics for the affected flow;
- no unresolved TODO that silently changes compliance behavior;
- implementation decisions recorded when they affect reversibility or domain interpretation.

## 3. Prototype milestones

### Prototype 0 — Product Shell

**Purpose:** Show the product direction early, before domain complexity or live extraction is available.

**Deliver:**

- approved ant/TaxMonWeb identity and semantic design tokens;
- login and authenticated application shell;
- Control Tower as the primary navigation label;
- My Work, Clients, Calendar, and Control/Exceptions entry points;
- responsive desktop/tablet/mobile shell behavior;
- sanitized fixture mechanism;
- representative leadership and staff views populated from fixtures.

**Review gate:** The domain owner can judge visual direction, navigation, density, Control Tower prioritization, My Work, Client workspace, and responsive behavior.

**Does not require:** live AI extraction, a complete Rules Library, production tax content, full operational workflow, or a production extraction provider.

### Prototype 1 — Golden Path

**Purpose:** Prove the central setup-to-operation chain with a deterministic mock extraction provider.

**Demonstrate:**

`Login → Control Tower/My Work → Client → Taxpayer Entity → Registration Unit → 2303 upload → extraction → human review/correction → Validate Tax Profile → Proposed Expected Compliance → authorized approval → generate obligations → progress obligation → management visibility`

Use only enough representative obligation definitions, Control Templates, and approved test fixtures to prove the architecture. The fixtures must cover recurring, annual, payable, no-payment, attachment, deadline, One-Day-Before, and unresolved-configuration behavior without claiming those fixtures are actual Philippine rules.

**Review gates:** 2303 setup, Tax Profile validation, Expected Compliance approval, generation, and the first obligation-management path.

### Prototype 2 — Operational Pressure Test

**Purpose:** Determine whether an A&T team could operate the product safely.

**Demonstrate:**

- multiple capabilities and organizational scopes;
- Preparer/Checker/Reviewer segregation of duties;
- reassignment without rewriting history;
- client approval delay;
- payment and no-payment obligations;
- multiple attachments;
- evidence and control completion;
- failed and retried external activity;
- separate Blocker, Risk/RAG, and Exception behavior;
- unresolved rule/deadline configuration;
- Compliance Complete versus Control Complete;
- HOD drill-down and cross-portfolio Tax Control views;
- optimistic concurrency protection;
- audit history and controlled reopening/override behavior.

**Review gate:** The domain owner can answer whether the system supports real daily work without becoming eNate, Planner, Excel-in-a-browser, or a generic ticketing system.

## 4. Ordered implementation slices

The slices below are ordered by dependency and review value. They are not separate services. A slice may touch several modules while remaining one coherent application change.

### Slice 01 — Product foundation and preview shell

**Complexity:** S

**Milestone:** Prototype 0

**Goal:** Get the smallest useful TaxMonWeb application running locally and deployable to a sanitized preview environment.

**User-visible outcome:** A user can log in, see the approved TaxMonWeb shell and ant identity, navigate the primary areas, and view clearly labelled sanitized fixture content.

**Domain behavior:** No complete domain schema. Establish only the application identity and fixture boundary needed to render the shell.

**Schema/data required:** Environment configuration, Supabase connection foundation, minimal authenticated identity reference if required, and a versioned sanitized fixture mechanism. Do not create the full Client, Tax Profile, Rules, or Obligation schema.

**Commands/queries:** Sign-in/sign-out/session query; fixture read query only.

**UI:** Login, authenticated shell, Control Tower, My Work, Clients, Calendar, Control/Exceptions placeholders with useful fixture states, responsive navigation, loading/error/empty states.

**Authorization/RLS:** Authentication foundation; deny unauthenticated application data access. No sensitive data. Hidden UI is not treated as security.

**Tests:** Bootstrap test, session test, protected-entry test, fixture isolation test, lint, typecheck, baseline accessibility and responsive smoke checks.

**Acceptance criteria:** Local start works; preview deployment works; login works; primary navigation is coherent; ant/wordmark usage follows the approved direction; no real client data is present; tests and typecheck pass.

**Dependencies:** Approved 05 and 06 documents; project accounts and environment secrets.

### Slice 02 — Internal identity, organization, and sanitized portfolio

**Complexity:** M

**Milestone:** Prototype 0

**Goal:** Introduce stable internal users, capabilities, organizational scope, and the Client → Taxpayer Entity → Registration Unit hierarchy.

**User-visible outcome:** Authorized users see a coherent sanitized portfolio and role-aware scope without separate dashboards per role.

**Domain behavior:** Stable identities are distinct from email; capability and organizational scope are effective-dated; the hierarchy follows the approved domain model.

**Schema/data required:** Internal user/profile reference, organization units, capability assignments, scope assignments, Client, Taxpayer Entity, Registration Unit, and sanitized seed data.

**Commands/queries:** Seed/read portfolio; read current user capabilities and scope; create/update only the minimum sanitized setup data needed for the prototype.

**UI:** Client list, Client overview, Taxpayer Entity and Registration Unit context, user scope-aware navigation and fixture switch/seed support where needed for development.

**Authorization/RLS:** Basic RLS for portfolio visibility; server-side scope checks for reads; deny by default; System Administration does not imply tax-control capability.

**Tests:** Visibility by scope, multiple capability assignments, expired assignment behavior, unauthorized direct access, System Admin without tax authority.

**Acceptance criteria:** The same operational truth can be viewed at appropriate scopes; a user cannot access an out-of-scope client by URL/API; seeded data is reproducible and sanitized.

**Dependencies:** Slice 01; approved RBAC vocabulary.

### Slice 02A — People & Portfolio Foundation

**Complexity:** S

**Milestone:** Prototype 0 / first usable Lego

**Goal:** Make the internal team, organization structure, client assignment, and derived portfolio load visible as one usable operational slice before completing Client Registry & Tax Profile.

**User-visible outcome:** An authorized user can see active team members, Tower/Cluster structure, assigned taxpayers, derived client weight, active work, and coverage gaps within the selected scope.

**Domain behavior:** Coarse role labels are a simple operating surface only. They do not replace capabilities, organizational scope, actual-actor history, SoD, approval authority, or Elevated Override rules. Client weight is derived workload information, not a performance score.

**Schema/data required:** Effective-dated team member profiles, career service level, reporting relationship, organization-unit relationship, effective-dated client/team assignments, and sanitized fixture data. No HR, payroll, ranking, or gamification data.

**Authorization/RLS:** Team visibility is constrained by authenticated user, active organization scope, and server-side/RLS checks. System Administration remains separate from tax-control authority. Writes remain command-only and audited.

**UI:** Team directory, interactive expandable organization chart, career-band labels, approved photo slots with RAG borders, derived workload bars, portfolio-load signals, coverage-gap state, scope filtering, and member-to-client drill-down.

**Tests:** Derived load counts each client once, scope filtering, missing/conflicting assignment detection, unauthorized direct access, active/effective-date behavior, and sanitized fixture isolation.

**Acceptance criteria:** The Team module is usable without requiring the full RBAC administration model; reporting lines and career bands are visible without granting authority; workload/RAG are explainable projections; unresolved chart labels remain visible; no team view implies tax approval or workflow authority; lint, typecheck, tests, and build pass.

### Slice 03 — Control Tower, My Work, and client navigation views

**Complexity:** M

**Milestone:** Prototype 0

**Goal:** Make the product useful for the first domain-owner review before operational records exist.

**User-visible outcome:** Leadership sees what requires attention; staff sees what they need to do; users can drill from All A&T or Cluster/Tower scope to Client and Registration Unit without feeling they are navigating database tables.

**Domain behavior:** Views consume one source of truth or clearly labelled fixture projections. Do not create a second tracker.

**Schema/data required:** Minimal fixture projection metadata; no separate dashboard/task database.

**Commands/queries:** Scope-aware Control Tower query, My Work query, client hierarchy query, calendar projection placeholder, Control/Exceptions fixture query.

**UI:** Control Tower, My Work, Clients, Calendar, Control/Exceptions; due/attention cards; filters; concise status language; responsive monitoring views.

**Authorization/RLS:** Query results constrained by visibility scope; actions shown only when the user may perform them, while server authorization remains authoritative.

**Tests:** Scope drill-down, empty/loading/error states, responsive layout smoke tests, keyboard navigation, color-independent status interpretation.

**Acceptance criteria:** Gate 1 can be conducted using sanitized fixtures; the Control Tower answers “what needs intervention?” within seconds; the screen does not become a vanity dashboard or dense database table.

**Dependencies:** Slices 01–02; UX baseline.

### Slice 04 — Temporary 2303 upload and processing boundary

**Complexity:** M

**Milestone:** Prototype 1

**Goal:** Establish the private temporary document lifecycle without committing to a real extraction provider.

**User-visible outcome:** An authorized user can upload a sanitized 2303, see processing state, and recover from validation or storage failure.

**Domain behavior:** Upload is temporary processing input, not TaxMonWeb permanent document storage. Source identity and provenance are retained; the file is not placed in Git or a public bucket.

**Schema/data required:** Temporary document identity, source metadata, processing status, purge eligibility/status, Registration Unit association, and private Storage object reference.

**Commands/queries:** Upload request, processing-start command, processing-status query, retry-safe failure/retry command, purge eligibility query.

**UI:** Upload, file validation, progress/processing state, failure/retry state, source metadata summary.

**Authorization/RLS:** Private storage policy; server-created signed access only; scope and capability checks before upload/review; file type/size/content validation.

**Tests:** Unauthorized upload, invalid file, storage failure, retry, duplicate request, private access, provenance association, no repository leakage.

**Acceptance criteria:** A sanitized file can be uploaded privately and represented as a durable processing run; failures are visible; no file is publicly accessible; no provider-specific extraction structure leaks into the domain model.

**Dependencies:** Slice 02; private Storage decision and environment configuration.

### Slice 05 — Normalized extraction contract and MockDocumentExtractionProvider

**Complexity:** M

**Milestone:** Prototype 1

**Goal:** Build the extraction experience against a provider-neutral contract.

**User-visible outcome:** A sanitized 2303 produces structured candidate fields with provenance and attention indicators that a user can review.

**Domain behavior:** The mock proposes extracted values; it cannot activate a Tax Profile, decide tax treatment, approve Expected Compliance, or generate approved obligations.

**Schema/data required:** Extraction run, extracted field/value, source/page provenance where available, confidence/attention information, missing/ambiguous/conflicting flags, normalized candidate output, and fixture reference.

**Commands/queries:** Start extraction, retrieve normalized result, retry failed run, acknowledge/resolve review attention, read source field context.

**UI:** Processing state, side-by-side Source 2303 / extracted structured profile, attention-first review, correction controls, manual entry fallback.

**Authorization/RLS:** Only authorized setup/review capabilities within scope may access the temporary source or candidate values. Actual provider credentials remain server-side.

**Tests:** Contract fixtures, clean extraction, low-confidence extraction, missing field, conflict, malformed provider response, retry, provider-independent downstream shape, accessibility of side-by-side review.

**Acceptance criteria:** The mock uses the same normalized contract required of a future provider; the clean path is fast; uncertain values are visible; users can correct manually; no arbitrary confidence threshold is treated as approved without benchmark evidence.

**Dependencies:** Slice 04; sanitized reviewed fixture set.

### Slice 06 — Human validation and Tax Profile activation

**Complexity:** M

**Milestone:** Prototype 1 / Gate 2

**Goal:** Convert reviewed candidate information into an explicitly validated, versioned Tax Profile.

**User-visible outcome:** An authorized human can correct extracted values, record provenance, validate the Tax Profile, and understand what remains unresolved.

**Domain behavior:** Source values, corrections, validator, timestamp, extraction run, and source reference remain explainable. Validation is explicit and required before activation.

**Schema/data required:** Tax Profile identity/version, structured fields, provenance references, correction history, validation event, effective dating, and source-document lifecycle reference.

**Commands/queries:** Save correction, validate profile, reject/return for correction, read current and historical profile versions, read provenance summary.

**UI:** Review/correction state, field attention, validation action, unresolved-field explanation, profile summary.

**Authorization/RLS:** Tax Profile correction and validation are separate capabilities; scope and actual actor checks apply; self-approval constraints follow RBAC.

**Tests:** Mandatory human validation, provenance preservation, correction history, unauthorized validation, stale version, incomplete/conflicting input, source purge blocked until lifecycle conditions are met.

**Acceptance criteria:** OCR/extraction alone cannot activate a Tax Profile; a validated profile is reproducible from its structured history; the user does not need to inspect every correctly extracted field unnecessarily.

**Dependencies:** Slice 05; approved field contract and domain-owner validation of the fixture experience.

### Slice 07 — Proposed and Approved Expected Compliance

**Complexity:** M

**Milestone:** Prototype 1 / Gate 3

**Goal:** Make “what should exist?” visible and approvable at Registration Unit level.

**User-visible outcome:** The user sees Expected Compliance as Applicable/In TMF Scope, Applicable/Out of TMF Scope, Not Applicable with reason, or Requires Review; an authorized approver can approve affected Registration Units.

**Domain behavior:** Tax Profile plus approved configuration produces a proposed universe. Approval is recorded per Registration Unit even when the UI groups review by Taxpayer Entity or Client.

**Schema/data required:** Obligation definition references, proposed/approved universe versions or snapshots, applicability/service-scope decisions, reasons, Registration Unit approval records, approver and timestamp, change set references.

**Commands/queries:** Propose universe, edit/correct decision, record reason, review, approve per Registration Unit, read unresolved and out-of-scope items.

**UI:** Expected Compliance workspace with grouped review and Registration Unit-level approval trace; discrepancy-first presentation; no user-facing version-management burden.

**Authorization/RLS:** Cluster Leader within scope, Tax Team cross-portfolio, and HOD global/elevated approval as defined by RBAC; independent self-approval avoided where practicable; server-side checks required.

**Tests:** Out-of-scope remains visible, Not Applicable requires reason, unresolved cannot approve as normal, grouped approval produces per-unit records, unauthorized approval, self-approval conflict.

**Acceptance criteria:** The approved universe is the authoritative answer to what should exist; unresolved items do not fabricate normal obligations; no second tracker is created.

**Dependencies:** Slice 06; minimum approved test definitions and Control Template references.

### Slice 08 — Finite rules, deadlines, and idempotent generation

**Complexity:** L

**Milestone:** Prototype 1 / Gate 3

**Goal:** Generate representative Compliance Obligations automatically from approved Expected Compliance using finite typed strategies.

**User-visible outcome:** An authorized generation action or scheduled run creates explainable obligations with statutory, internal, and service milestones where configured.

**Domain behavior:** Generation respects applicability, Service Scope, frequency/period strategy, component requirements, deadline strategy, holidays, One-Day-Before policy, and governed Instance Type. Unresolved content fails visibly.

**Schema/data required:** Obligation Definitions, Control Templates, rule versions, deadline strategies, Holiday Master fixtures, generation runs/items, obligation identity, captured configuration context, calculated deadline provenance, and assignment snapshot.

**Commands/queries:** Validate configuration, preview/propose generation where useful, generate period, retry failed items, read generation result and deadline explanation, identify expected-but-missing items.

**UI:** Small generation/status view, configuration exception display, obligation list, deadline explanation drawer or panel. Avoid a generic rules editor.

**Authorization/RLS:** Generation is a server-side authorized command; governance/configuration maintenance is separate from operational generation; scope applies.

**Tests:** Finite strategy tests, period generation, no-payment case, permitted/non-permitted holiday adjustment, One-Day-Before calculation, unresolved rule, duplicate generation, partial failure/retry, prospective rule context.

**Acceptance criteria:** Repeated generation does not duplicate an obligation; every generated deadline explains its inputs and versions; missing content never becomes GREEN or an invented date.

**Dependencies:** Slice 07; minimal domain-owner-approved representative test content; no complete BIR catalog required.

### Slice 09 — Obligation summary and preparation/internal control path

**Complexity:** M

**Milestone:** Prototype 1 / Gate 4

**Goal:** Allow a user to progress a generated obligation through the minimum required preparation, checking, and review controls.

**User-visible outcome:** An accountant can see where the obligation is, what remains, who must act, and the next valid action without operating a generic state machine.

**Domain behavior:** Data Readiness is evaluated as a prerequisite. Detailed status is derived from component facts, required gates, work steps, blockers, and signoffs. For ordinary V1 return/submission work, Preparation, Checking, Review, and Client Approval before Filing are mandatory.

**Schema/data required:** Obligation, current accountability, assignment snapshots, component requirements, work-step facts, signoffs, return/rework facts, derived status projection, and optimistic-concurrency version.

**Commands/queries:** Assign/reassign, start preparation, submit for checking, return for correction, check, return for rework, review, derive next action, read history.

**UI:** Obligation workspace with PREPARE → REVIEW → CLIENT → FILE → POST-FILING → COMPLETE summary; simple Submission/Payment/Attachments/Evidence cards; hidden detail until needed.

**Authorization/RLS:** Action permissions checked server-side; Preparer, Checker, and Reviewer must be distinct where required; capability union does not permit self-check.

**Tests:** Data Not Ready/Ready, normal recurring path, checker return, reviewer return, missing prerequisite, self-check conflict, mandatory client approval before filing, stale update, derived status accuracy.

**Acceptance criteria:** No free-form Complete action bypasses required gates; internal controls are real actor checks; the experience is simpler than the underlying model.

**Dependencies:** Slice 08; approved Control Template fixtures.

### Slice 10 — Client approval, filing, payment, attachments, and evidence

**Complexity:** L

**Milestone:** Prototype 2 / Gate 4

**Goal:** Prove the parallel component lifecycle after internal control.

**User-visible outcome:** Users can record client approval, filing attempts/results, payment route and result, multiple attachment outcomes, and evidence without conflating them.

**Domain behavior:** Filing does not imply payment; return Client Approval does not imply Payment Client Approval; payment does not imply completion; submission sent does not imply accepted; no-payment does not imply no filing or attachments; each attempt/result/evidence item preserves history.

**Schema/data required:** Client approval fact, submission attempts/results, payment route/funding/payment attempts/results, attachment requirements and attempts, evidence references, verification/signoff facts, configured client-copy/transmittal requirement.

**Commands/queries:** Record client approval, record filing attempt/result, record payment/funding event, record attachment attempt/result, add evidence, verify evidence, read component status and history.

**UI:** Four primary component cards, independent progress, attempt history on demand, evidence panel, blocker prompts, result-strength labels.

**Authorization/RLS:** Component-specific action authority; client approval recording according to service arrangement; evidence verification separate from upload; no banking integration.

**Tests:** Mandatory client approval before filing, separate payment approval, late client approval, filing fail then succeed, client-direct payment, TMF-funded route, payment pending after filing, no-payment, multiple attachments, rejected attachment retry, weak evidence cannot silently become confirmed.

**Acceptance criteria:** The user can tell what is complete and what remains without reading internal workflow terminology; retries never overwrite prior attempts.

**Dependencies:** Slice 09; approved component and evidence fixtures.

### Slice 11 — Blockers, RAG, Exceptions, and completion projections

**Complexity:** M

**Milestone:** Prototype 2

**Goal:** Make exception management the primary operating model.

**User-visible outcome:** Users can distinguish why work is blocked, how timing is exposed, and which abnormal condition requires attention.

**Domain behavior:** Blocker, Risk/RAG, and Exception are separate and may coexist. TMF Package Target exposure is distinct from statutory exposure. Compliance Complete, Control Complete, and overall Complete remain distinct derived facts.

**Schema/data required:** Blocker records and categories, exception records, RAG/deadline projection inputs, completion projections, configuration-exception records, expected-but-missing detection references.

**Commands/queries:** Create/resolve blocker, acknowledge/resolve exception, calculate/read RAG, read completion projections, query Control Tower intervention queues.

**UI:** Control Tower cards, My Work queues, exception detail, RAG explanation, unresolved-rule state, Control Complete gap view, HOD drill-down.

**Authorization/RLS:** Scope-aware visibility; create/resolve authority follows RBAC; governance exceptions require appropriate Tax Team/HOD authority.

**Tests:** Data Readiness blocker, client approval blocker, payment/funding blocker, internal blocker, BIR/system blocker, internal-target Amber versus statutory Red facts, overdue statutory deadline, unresolved deadline with RAG unavailable, legal complete/control incomplete, out-of-scope informational exposure.

**Acceptance criteria:** Users are not forced to inspect every obligation; unresolved configuration never receives misleading GREEN/AMBER/RED; management views use the same obligations as operational views.

**Dependencies:** Slices 08–10.

### Slice 12 — Assignments, SoD, reassignment, reopening, and Elevated Override

**Complexity:** M

**Milestone:** Prototype 2

**Goal:** Prove historical accountability and exceptional control behavior.

**User-visible outcome:** Authorized leadership can reassign open work; historical actors remain visible; exceptional bypass is clearly exceptional.

**Domain behavior:** Current accountable owner is separate from actual actors and historical snapshots. Ordinary reassignment/reopening is not an Elevated Override. Override cannot fabricate an external fact or bypass the actor’s own required control.

**Schema/data required:** Effective-dated assignment records, ownership snapshots, actor/signoff history, reopening/correction reasons, override records, override authority context, audit references.

**Commands/queries:** Reassign open obligation, reopen with reason, correct ordinary fact, request/perform elevated override, read assignment and actor history.

**UI:** Assignment action, history timeline, visible override marker, reason capture, conflict explanation, no routine shortcut around controls.

**Authorization/RLS:** Scope-aware leadership reassignment; Tax Team/HOD override capability only; actual-actor SoD checks independent of job title.

**Tests:** Reassignment before/after completed stages, preparer resignation, multiple roles self-check attempt, ordinary correction versus override, override external-fact prohibition, unauthorized override, mandatory reason.

**Acceptance criteria:** Reassignment never rewrites historical work; normal users are not burdened with transfer acceptance; overrides cannot turn unfiled into Filed, unconfirmed into Paid, or unresolved into Not Applicable.

**Dependencies:** Slices 09–11; RBAC capabilities and scope model.

### Slice 13 — Audit, concurrency, and recovery hardening

**Complexity:** M

**Milestone:** Prototype 2 / Gate 5

**Goal:** Make material behavior attributable, conflict-safe, and recoverable.

**User-visible outcome:** Authorized users can inspect relevant history and understand failed or competing actions without losing trust in the record.

**Domain behavior:** Material command and configuration changes emit append-oriented audit events; optimistic concurrency prevents silent overwrites; retries are idempotent.

**Schema/data required:** Audit event records, correlation/job references, command idempotency references where needed, concurrency/version fields, retry/error state.

**Commands/queries:** Read audit history, retry safe operation, resolve stale update, inspect generation/extraction/job outcomes.

**UI:** History/audit panel where authorized, conflict resolution prompt, retryable failure state, system-versus-business exception explanation.

**Authorization/RLS:** Audit visibility is separately controlled; audit modification is not available through normal application actions.

**Tests:** Audit attribution, duplicate command, browser refresh, scheduled retry, concurrent updates, authorization change while screen is open, provider/storage failure recovery.

**Acceptance criteria:** No material action silently disappears or overwrites another user’s update; failures remain visible and actionable; sensitive payloads are absent from logs.

**Dependencies:** Slices 04–12.

### Slice 14 — Managed-provider benchmark and replaceable real adapter

**Complexity:** L

**Milestone:** Post-Golden Path; required before real-client pilot if AI extraction is included in pilot scope

**Goal:** Evaluate and, if approved, connect a managed/serverless-compatible extraction provider without changing TaxMonWeb’s downstream contract.

**User-visible outcome:** The same review and validation experience works with a real provider and remains safe when confidence/attention is uncertain.

**Domain behavior:** `RealProviderAdapter implements DocumentExtractionProvider`; provider output is normalized before TaxMonWeb uses it. AI remains assistive only.

**Schema/data required:** Provider-neutral extraction run metadata, provider reference/version, benchmark results, retention/security metadata, and adapter error mapping. No provider payload becomes the Tax Profile model.

**Commands/queries:** Provider extraction request, normalized result retrieval, retry/fallback to manual entry, benchmark report query.

**UI:** No new architecture-specific workflow; preserve the validated mock experience and expose provider failure/attention appropriately.

**Authorization/RLS:** Server-only provider credentials; temporary document access and provider calls remain least-privilege and auditable.

**Tests:** Mock/real contract tests, sanitized field-level benchmark, malformed/partial provider response, timeout/rate limit, privacy and retention controls, no-autonomous-activation test.

**Acceptance criteria:** Provider can be replaced without changing Tax Profile or Expected Compliance behavior; selection is based on the approved sanitized benchmark and InfoSec review, not generic OCR claims alone.

**Dependencies:** Prototype 1 working; sanitized benchmark fixture set; provider, privacy, region, and security decisions.

## 5. Staged schema and migration sequence

Schema is added only when a vertical slice requires it. The following is a logical sequence, not SQL or a migration file plan.

### Migration group 0 — Platform foundation

Support environment configuration, authenticated identity references, fixture versioning, and safe seed/reset behavior. Do not create full tax-domain tables.

### Migration group 1 — Identity, organization, and portfolio

Add internal user/profile references, organization units, effective-dated capability/scope assignments, Client, Taxpayer Entity, and Registration Unit identities.

### Migration group 2 — Temporary registration setup

Add temporary source-document metadata, processing runs, private object references, lifecycle/purge state, extraction runs, normalized extracted values, attention/provenance, and correction history.

### Migration group 3 — Tax Profile

Add Tax Profile identity/version, effective dating, validation history, source/correction references, and association with Registration Unit.

### Migration group 4 — Expected Compliance

Add Obligation Definition references, applicability and Service Scope decisions, proposed/approved universe snapshots or versions, Registration Unit approval records, reasons, and change references.

### Migration group 5 — Rules and generation configuration

Add typed rule/version references, Control Templates, frequency/period strategies, deadline-policy versions, Holiday Master records, generation runs/items, and validation/error results.

### Migration group 6 — Generated operations

Add Generated Compliance Work represented by Compliance Obligation, with the uniqueness boundary:

> Registration Unit + Obligation Definition + Compliance Period + governed Instance Type

Add captured generation context, deadline provenance, assignment snapshot, current accountability, and concurrency version.

Add Data Readiness, component statutory deadlines, TMF Package Target, and separate return/payment approval facts when required by the relevant slice.

### Migration group 7 — Workflow components and control facts

Add requirements/components, work-step facts, signoffs, submission/payment/attachment attempts and results, evidence, client approval, blockers, and completion projections. Avoid one table per glossary noun unless history or integrity requires separate persistence.

### Migration group 8 — Audit and operational projections

Add append-oriented audit events, idempotency/correlation references, exception records, RAG/completion projections, and management query indexes.

When the Tax Team QA module is authorized for implementation, add QA selection, QA status, findings, RCA/remediation, Re-QA history, QA Completion %, and QA Pass Rate % without making QA a prerequisite for statutory completion.

### Migration group 9 — Governance and impact analysis

Add configuration approval history, open-obligation impact change sets, controlled reopening/supersession/cancellation references, and privileged governance records only when the corresponding slice is implemented.

### Data-integrity rules across groups

- Stable internal IDs are never re-keyed because a display name changes.
- Effective-dated records must not overlap where the business concept requires one active version.
- Completed obligations retain their generation, rule, profile, universe, assignment, deadline, and actor context.
- Re-running generation is idempotent at the approved obligation identity boundary.
- Attempts and results append rather than overwrite.
- Required reasons, actors, and evidence-strength facts are validated at command time.
- Optimistic concurrency applies to records that can be changed by multiple users.
- New configuration applies prospectively by default and does not silently rewrite completed obligations.

## 6. Authorization sequence

Authorization is delivered alongside the feature that needs it. The product must never rely on the later completion of a permission matrix to make early functionality safe.

1. **Authentication:** Supabase Auth session and protected application boundary.
2. **Internal identity:** Stable user/profile reference and active-user checks.
3. **Capabilities:** Minimum capability assignments required by each slice.
4. **Organizational scope:** Own assigned work, Tower, Cluster, Tax Control, or All A&T visibility as applicable.
5. **RLS:** Data visibility protection for client-sensitive records and private storage references.
6. **Server-side action authorization:** Commands validate capability, scope, object state, service arrangement, and required evidence.
7. **Actual-actor SoD:** Preparation, checking, review, approval, evidence verification, and override checks use actual actor history, not only job title or capability union.
8. **Elevated Override:** Separate Tax Team/HOD capability, mandatory reason, visible exceptional treatment, and full audit.

Every stage denies by default. A hidden button is only a usability choice; it is never the security boundary.

## 7. AI and 2303 extraction sequence

### Phase A — Normalized contract

Define a provider-neutral contract containing extracted field/value, source/page provenance where available, provider confidence/attention information where available, missing/ambiguous/conflicting indicators, extraction-run metadata, and normalized Tax Profile candidate values.

The contract must be designed around TaxMonWeb’s review needs, not around any one provider’s response payload.

### Phase B — MockDocumentExtractionProvider

Implement a deterministic mock provider using sanitized fixture cases. It must support clean, low-confidence, missing, ambiguous, and conflicting outputs through the same normalized contract expected from a future provider.

This is the critical-path provider for Prototype 1. It prevents vendor selection from blocking the Golden Path without creating a disposable fake architecture.

### Phase C — ChatGPT-assisted benchmark and fixture preparation

The domain owner may manually use existing ChatGPT access to analyze sanitized 2303 samples and review expected structured outputs. The result becomes a reviewed benchmark fixture for the mock provider.

This is a manual development/benchmarking activity, not a TaxMonWeb production integration. The build must not use personal credentials, browser sessions, cookies, tokens, or unsupported automation, and must not use real client-sensitive 2303s without an approved enterprise data-processing arrangement.

### Phase D — Managed-provider benchmark

After the Golden Path works with the mock, benchmark managed/serverless-compatible providers against sanitized fixtures for:

- field-level accuracy and 2303 layout understanding;
- registered-tax-type extraction;
- structured-output reliability;
- useful uncertainty signaling;
- latency and cost;
- security, privacy, retention, and no-training terms;
- regional/data-residency implications;
- operational burden and replaceability.

Confidence thresholds are not hardcoded before this benchmark and domain-owner review.

### Phase E — Real provider adapter

Implement a provider adapter only after selection and required InfoSec/vendor approval. Downstream Tax Profile, Expected Compliance, and validation behavior must remain unchanged.

### Phase F — Optional ChatGPT-plan investigation

Separately investigate whether an officially supported mechanism exists at implementation time for a custom application to use the domain owner’s ChatGPT-plan access. This is not a critical-path assumption. If it is unavailable or unsuitable, continue with managed-provider evaluation.

## 8. Rules and tax-content strategy

Prototype rules are the smallest representative, domain-owner-approved fixture set needed to prove behavior:

- recurring generation;
- annual generation;
- payment-required and no-payment;
- attachment-required and no-attachment;
- statutory/internal/service milestones;
- One-Day-Before target;
- permitted and non-permitted adjustment strategies;
- unresolved configuration;
- Expected Compliance approval;
- idempotent generation;
- prospective rule change and open-obligation impact review.

No complete Philippine Rules Library is required before the Golden Path. Every fixture must be clearly marked as approved test content or illustrative non-production content.

The application must reject missing or incompatible required tax content visibly. It must not invent deadlines, holidays, forms, attachments, or applicability to keep a demo moving.

## 9. Test strategy

Testing is built into each slice and expands with the domain.

### 9.1 Foundation and UI

- session and protected-entry tests;
- fixture isolation and sanitization checks;
- lint and typecheck;
- responsive smoke tests;
- keyboard navigation and accessible labels;
- loading, empty, error, and retry states.

### 9.2 Domain and rules

- finite-strategy tests;
- period-generation tests;
- deadline provenance and adjustment tests;
- unresolved-rule/configuration tests;
- domain-command validation;
- ordinary correction versus Elevated Override tests.

### 9.3 Authorization and control

- RLS visibility tests;
- direct URL/API denial tests;
- capability and organizational-scope tests;
- Preparer cannot self-check;
- multiple capabilities do not bypass SoD;
- System Admin cannot approve tax controls solely by being an administrator;
- Tax Team/Cluster Leader/HOD approval scopes;
- Elevated Override authority and prohibition tests.

### 9.4 Generation and history

- repeated generation does not duplicate obligations;
- partial generation isolates failed items;
- completed obligations retain historical context;
- reassignment preserves prior actors and signoffs;
- retries append rather than overwrite lifecycle facts;
- audit events are attributable and append-oriented.

### 9.5 External-result integrity

- Submitted does not become Accepted without configured result/evidence;
- payment initiated does not become Payment confirmed;
- weak human assertion cannot silently become verified;
- attachment rejection followed by resubmission preserves attempts;
- Elevated Override cannot fabricate filing, payment, acceptance, or applicability facts.

### 9.6 Extraction contract

- clean, low-confidence, missing, ambiguous, and conflicting fixtures;
- malformed/partial provider response;
- provider timeout/rate limit;
- mock-versus-real adapter contract;
- no extraction output can activate Tax Profile without human validation;
- provenance and correction history survive source-file purge.

### 9.7 Concurrency and recovery

- stale update is rejected or safely reconciled;
- browser refresh does not duplicate commands;
- duplicate submission is idempotent;
- scheduled retries are safe;
- storage/provider/generation/purge failure is visible and recoverable;
- authorization changes while a screen is open are rechecked at command time.

### 9.8 Critical end-to-end paths

At minimum:

1. Login → Control Tower → Client → Registration Unit.
2. Upload sanitized 2303 → mock extraction → correction → Tax Profile validation.
3. Proposed Expected Compliance → Registration Unit approval → generation.
4. Generated obligation → preparation → checking → review → client approval.
5. Filing attempt → failed attempt → successful retry.
6. Filing complete while payment remains pending.
7. Evidence outstanding after Compliance Complete.
8. Reassignment and historical audit.
9. Unresolved rule/deadline visible as configuration exception.
10. HOD/Tax Team intervention with ordinary users denied unauthorized actions.

## 10. Domain-owner review gates

### Gate 1 — Prototype 0

Review ant/TaxMonWeb identity, navigation, Control Tower, My Work, Client workspace, density, responsive behavior, fixture realism, and overall product feel.

### Gate 2 — 2303 setup

Review upload, processing state, side-by-side extraction, attention handling, manual correction, provenance, and Tax Profile validation. The first demonstration uses the MockDocumentExtractionProvider.

### Gate 3 — Expected Compliance and generation

Review proposed/approved Expected Compliance, Registration Unit approval evidence, out-of-scope visibility, unresolved configuration, deadline explanations, and generated obligations.

### Gate 4 — Obligation operations

Review preparation, checking, review, client approval, filing, payment, attachments, evidence, blockers, retries, and completion distinctions.

### Gate 5 — Management control

Review Control Tower, My Work, Exceptions, RAG, expected-but-missing visibility, HOD drill-down, Tax Control views, audit, reassignment, SoD, and concurrency behavior.

Review occurs after each gate, not after V1 is complete.

## 11. External decision blockers

### Blocks sanitized prototype

Only decisions that prevent the shell or mock-driven flow from running belong here:

- access to the approved development accounts/environments;
- agreement on the sanitized fixture format and minimum representative cases;
- confirmation of the initial prototype review participants.

Production AI vendor selection, production region, real-client retention, malware scanning, and disaster-recovery approval do not block Prototype 0 or the mock-driven Golden Path unless a concrete dependency emerges.

### Blocks real-client pilot

- InfoSec/privacy approval for real client data;
- approved Supabase/Vercel deployment region and contractual terms;
- temporary 2303 retention and purge policy;
- private storage and file-scanning controls;
- managed extraction provider selection or an approved pilot exception;
- SharePoint authoritative-reference operating procedure;
- backup/PITR and recovery expectations;
- privileged-user MFA and audit access policy;
- domain-owner approval of real pilot tax configuration and Control Templates.

### Blocks production

- production provider/vendor and data-processing approval;
- production region and data-residency approval;
- retention, deletion, export, and audit-retention policy;
- disaster recovery and restore validation;
- production monitoring, incident handling, and access-review process;
- final RBAC/control-owner signoff;
- production Rules Library and Holiday Master governance;
- security review, dependency/update process, and release controls.

## 12. Critical paths

### Critical path to Prototype 0

`Slice 01 → Slice 02 → Slice 03 → Gate 1`

The shell must not wait for live extraction, complete rules, or the full domain schema.

### Critical path to the Golden Path

`Prototype 0 → Slice 04 → Slice 05 → Slice 06 → Slice 07 → Slice 08 → Slice 09 → Gate 2/3/4`

The MockDocumentExtractionProvider is the critical-path extraction dependency. Production AI selection is not.

### Critical path to the Operational Pressure Test

`Golden Path → Slice 10 → Slice 11 → Slice 12 → Slice 13 → Gate 5`

The primary risk is not infrastructure scale; it is preserving actor history, evidence strength, component independence, and authorization under realistic exceptions.

### Major delivery risks

- trying to populate the full Rules Library before testing the model;
- letting provider-specific extraction data leak into the Tax Profile model;
- treating status as a single editable field;
- adding a second calendar/task tracker;
- implementing UI-only authorization;
- under-testing multiple roles and actual-actor SoD;
- using real client data for convenience;
- allowing mock fixtures to look like approved Philippine tax content;
- building management dashboards before the underlying projections are trustworthy.

## 13. Deployment progression

`Local → Preview → Staging → Production`

Prototype 0 should become preview-deployable early. Each environment has separate credentials, database/storage boundaries, and fixture/data policies.

- Local: synthetic fixtures and developer-controlled services.
- Preview: sanitized fixture data only; no real client documents or identifiers.
- Staging: production-like configuration with sanitized or explicitly approved test data.
- Production: approved region, secrets, storage, monitoring, backup/PITR, retention, and access controls.

No deployment step authorizes real client data by itself.

## 14. V1 exclusions and backlog

The following remain outside the V1 build plan unless a concrete approved requirement changes scope:

- direct BIR filing;
- bank or payment execution/integration;
- tax computation;
- replacement of detailed Excel working papers;
- replacement of SharePoint or a full DMS;
- full SharePoint integration;
- corporate SSO as a prerequisite;
- generic workflow engine or BPM platform;
- generic rules DSL;
- Planner migration;
- transfer-acceptance workflows or complex delegation chains;
- full Tax Audit case management;
- rich notification engine;
- drag-and-drop calendar;
- self-hosted AI inference;
- microservices;
- Redis, Kafka, Elasticsearch, dedicated workers, or other infrastructure without a measured V1 need;
- complete Philippine BIR obligation catalog before the model is validated.

## 15. Estimation convention

Complexity is relative implementation size, not a calendar estimate:

- **S:** bounded change with low domain risk and few dependencies;
- **M:** several modules or meaningful authorization/history behavior;
- **L:** cross-cutting domain behavior, multiple components, or high integrity risk.

No calendar dates are committed until actual implementation velocity is known. Slice completion and domain-owner review gates are the primary planning units.

## 16. Decisions requiring domain-owner input

The build can begin without reopening approved architecture, but the following inputs should be confirmed before the relevant slice reaches its gate:

1. The sanitized 2303 fixture set and reviewed expected extraction outputs.
2. Minimum representative test definitions and Control Template fixtures, clearly labelled as approved or illustrative.
3. Which service arrangements require client approval and client copy/transmittal in the prototype.
4. Which initial organizational scopes and user-capability combinations should appear in the fixtures.
5. Acceptance of the Expected Compliance grouped-review language and Registration Unit approval evidence.
6. Benchmark review criteria and acceptance of extraction confidence/attention behavior after testing.
7. Pilot tax-content governance owners for Rules Library, Holiday Master, and Control Templates.
8. Real-client pilot decisions listed in the blocking classification above.

These are content, acceptance, and governance inputs—not reasons to expand the architecture prematurely.

## 17. Contradictions discovered

No contradiction was found between the approved Domain Model, Workflows and Controls, Rules/Deadlines, RBAC, UX, and Technical Architecture.

The build plan makes two sequencing constraints explicit:

1. A mock extraction provider is required to demonstrate the approved 2303 setup flow before a production provider is selected.
2. The full domain schema and Rules Library are intentionally staged behind the vertical slices that need them; this does not weaken the approved model or the obligation identity constraint.

Both are implementation sequencing decisions consistent with the approved architecture.
