# TaxMonWeb Domain Model

**Document:** 01-DOMAIN-MODEL.md  
**Product:** TaxMonWeb  
**Status:** Approved core-domain freeze / amended baseline  
**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`

This document describes business concepts, relationships, lifecycle boundaries, historical facts, and control invariants. It is not a database schema, SQL design, ORM model, API specification, screen design, or implementation plan.

No Philippine tax rules, forms, deadlines, filing interpretations, or applicability decisions are invented here. Those are approved configuration or domain-owner decisions represented by the model.

## 1. Domain purpose

TaxMonWeb controls whether expected tax-compliance work is visible, assigned, progressing, evidenced, and historically explainable.

The domain is organized around this principle:

> Set up once. Generate automatically. Manage by exception.

The system must be sophisticated enough to preserve history and control integrity, but simple enough that accountants experience ordinary work as straightforward component progress:

- Filing — Filed
- Payment — Awaiting confirmation
- Attachments — Submitted
- Evidence — Verified

Internal versions, requirements, actions, results, signoffs, snapshots, and audit events should be progressively disclosed rather than required as conscious workflow administration.

The canonical domain spine is:

```text
BIR Requirement Master + Rules/Calendar
  → Client Compliance Profile
  → Generated Compliance Work
  → Engagement Execution
  → Completion
  → Independent QA
```

Generated Compliance Work is the work/control object TaxMonWeb creates for an activated requirement and applicable period/event. TaxMonWeb does not calculate or prepare the underlying tax return.

## 2. Domain invariants

1. A Client is not the same as a Taxpayer Entity or Registration Unit.
2. Compliance Obligations belong to Registration Units.
3. Applicable and In TMF Scope are separate decisions.
4. Applicable + Out of TMF Scope remains visible in the Compliance Universe but does not create normal TMF delivery workflow.
5. OCR proposes information; human validation activates the Tax Profile.
6. A Validated Tax Profile is required before proposing a Compliance Universe.
7. An Approved Compliance Universe is required before normal operational generation.
8. Generated obligations are idempotent for their approved business identity.
9. Historical facts are not rewritten to reflect current configuration or ownership.
10. Current accountability may change for open obligations without changing prior actors or completed actions.
11. Compliance Complete and Control Complete are derived from applicable requirements and gates.
12. An Elevated Override may bypass an authorized internal control where policy permits, but cannot fabricate an external compliance fact.
13. A calendar view is not a second task database.
14. Visibility and authority are separate. Seeing a record does not grant permission to change it.
15. No unapproved tax rule is invented to complete a workflow or fill a field.
16. Data Readiness is a prerequisite/control condition, not necessarily an execution stage.
17. For ordinary V1 return/submission work, Preparation → Checking → Review → Client Approval before Filing is mandatory.
18. Return Client Approval and Payment Client Approval are separate control facts.
19. Independent QA may occur after Engagement Completion and does not block statutory completion.

## 3. Core domain hierarchy

The primary business hierarchy is:

```text
Client
├── Contract Repository
│   ├── Master Engagement
│   │   ├── MSA
│   │   ├── LSA
│   │   └── Addendum
│   └── Additional Engagement
│       └── Change Request Form
└── Taxpayer Entity (one Client may have many)
    └── Registration Unit (one Taxpayer Entity may have many)
        ├── Tax Profile versions
        ├── Compliance Universe revisions
        │   └── Universe Items
        │       └── Generated Compliance Work / Compliance Obligations, where applicable and in TMF Scope
        └── effective-dated assignments
```

The nesting expresses the operational relationship, not necessarily ownership in a physical database.

### 3.1 Client

The commercial/service relationship managed by TMF.

A Client may be associated with multiple Taxpayer Entities. TaxMonWeb must not use Client as a substitute for the legal obligation anchor.

Each Client has one Contract Repository. The Contract Repository is the commercial relationship container and does not replace the Taxpayer Entity, Registration Unit, Tax Profile, Compliance Universe, or Compliance Obligation hierarchy.

The Contract Repository has two branches: Master Engagement for MSA/LSA/addendum records, and Additional Engagement for engagements outside the master engagement, represented by Change Request Forms. A Client may have multiple Additional Engagement records without creating duplicate Client or Taxpayer Entity records.

### 3.2 Taxpayer Entity

The Philippine legal taxpayer represented in TaxMonWeb and identified by its own TIN as recorded and validated through approved source information.

### 3.3 Registration Unit

The relevant BIR-registered head office or branch under a Taxpayer Entity.

Registration Unit is the legal/operational anchor for:

- registration information;
- Tax Profile applicability context;
- Compliance Universe approval;
- Service Scope decisions;
- Compliance Obligations;
- assignment and control scope.

No separate Branch entity is introduced in V1.

### 3.4 Relationship cardinalities

| Relationship | Baseline cardinality/meaning |
|---|---|
| Client → Taxpayer Entity | One Client may relate to many Taxpayer Entities. |
| Taxpayer Entity → Registration Unit | One Taxpayer Entity may have many Registration Units. |
| Registration Unit → Tax Profile | Many historical versions; one currently active validated context at a relevant point in time. |
| Registration Unit → Compliance Universe | Many proposed/approved historical revisions; one applicable approved context for a given effective context. |
| Compliance Universe → Universe Item | Many expected compliance items. |
| Universe Item → Compliance Obligation | Zero or many generated obligations across approved periods; Out of TMF Scope, Not Applicable, and unresolved items do not generate normal in-scope TMF workflow. |
| Registration Unit → Compliance Obligation | Many obligations over time. |

The model does not assume that every taxpayer obligation is within TMF Service Scope.

## 4. Aggregate boundaries

These are business consistency boundaries, not a prescription for separate services or tables.

### 4.1 Registration Setup aggregate

Represents the controlled process of turning a temporary 2303/source document into a validated Tax Profile.

It coordinates:

- source-document metadata;
- temporary processing-copy lifecycle;
- OCR extraction runs;
- extracted field values and confidence;
- manual corrections;
- validation history;
- Tax Profile activation;
- authoritative SharePoint reference;
- temporary-copy purge event.

The binary document itself is an external/private storage concern. The domain retains its identity and lifecycle facts.

### 4.2 Registration Unit / Tax Profile aggregate

Represents the validated registration and compliance-relevant profile for a Registration Unit.

The aggregate preserves profile versions and activation/validation history. Professionally determined values and source-derived values remain distinguishable through provenance.

### 4.3 Compliance Universe aggregate

Represents the expected compliance set for a Registration Unit.

It contains proposed or approved Universe Items and their applicability/scope decisions. Approval is recorded per Registration Unit even when the UI groups review at Client or Taxpayer Entity level.

An approved universe revision is historically preserved. A change is proposed as a revision or delta rather than silently mutating the approved historical record.

### 4.4 Generated Compliance Work / Compliance Obligation aggregate

Represents one generated operational compliance instance and is the domain representation of Generated Compliance Work. It is not the tax return, tax computation, or external filing system.

It owns or references:

- stable obligation identity;
- Compliance Period;
- generation context;
- original ownership snapshot;
- current accountability;
- component requirements;
- actions/attempts and results;
- evidence references;
- signoffs;
- blockers;
- derived completion state;
- controlled lifecycle transitions;
- audit history.

### 4.5 Governed configuration aggregates

Approved configuration is maintained separately from generated operational records. Relevant governed concepts include:

- BIR Requirement Master;
- optional Obligation Definition generation/execution configuration referencing a Requirement Master version;
- BIR Form Master;
- Tax Type Master;
- BIR Jurisdiction / Office Master;
- Filing / Submission Channel Master;
- governed eFPS Group values where applicable;
- Requirement Components;
- Regulatory Issuance / Authority;
- Rule and Rule Version;
- published/normalized BIR Calendar records;
- Monthly Calendar Versions and row-level reconciliation results;
- Requirement Definition;
- Control Template;
- Deadline Policy;
- Holiday Master;
- Service Scope configuration;
- organizational scope configuration;
- BIR Officer Master and effective-dated Officer Office Assignments;
- future BIR Center projections over the canonical masters, available as a shared read-only reference surface rather than a configuration or release console.

These concepts are versioned or effective-dated where they affect historical interpretation.

These masters are not interchangeable. The BIR Requirement Master is the sole legal/control catalog. Forms, tax types, offices, channels, eFPS groups, and components support that catalog. Regulatory Issuance / Authority is reusable provenance that may be cited by multiple governed records.

### 4.6 Canonical tax-foundation relationships

The minimum controlled relationship is:

```text
Regulatory Issuance / Authority
        ↓ citations
BIR Requirement Master version ← BIR Form Master version
        ↓ references
Rule Version → Requirement Components → Deadline Policy / Holiday Master
        ↓
Client Compliance Profile / Approved Compliance Universe
        ↓
Generated Compliance Work
```

Every effective-dated or versioned record carries its validity and verification state. Tax Profiles reference canonical BIR office, tax type, filing channel, and eFPS group records rather than uncontrolled legal-value text.

Monthly calendar release is a governed control over published deadline rows. The system may calculate provisional future dates, but authoritative operational use requires a human-approved and released monthly version. Partial release is allowed only when the affected unresolved population is explicit and excluded from authoritative use.

### 4.7 Cross-cutting audit history

Audit events are append-only history associated with material domain objects and actions. Audit history is not a substitute for effective-dated domain records or snapshots.

### 4.8 Data Readiness

Data Readiness is a prerequisite/control condition for Generated Compliance Work. It answers whether required client-provided records or TMF-maintained accounting/books are ready for preparation.

Its deliberately small V1 vocabulary is `Not Ready` or `Ready`. Not Ready may carry a blocker reason such as Client Data, Accounting Close, or Internal Dependency. It does not require a separate workflow engine or a mandatory Data Request stage.

## 5. Master/configuration data versus generated operations

### 5.1 Master and configuration concepts

These describe the available business context or approved behavior:

- Client;
- Taxpayer Entity;
- Registration Unit;
- Organization Units;
- users and identity subjects;
- Obligation Definitions;
- Rules and Rule Versions;
- Requirement Definitions;
- Control Templates;
- Deadline Policies;
- Holiday Master records;
- approved Service Scope configuration.

They are not operational compliance instances.

### 5.2 Versioned setup and governance concepts

These preserve how a profile or expected universe was established:

- Source Document metadata;
- temporary processing-copy metadata;
- OCR Extraction Runs;
- extracted values and confidence;
- correction and validation history;
- Tax Profile Versions;
- Proposed and Approved Compliance Universe revisions;
- universe approval records;
- generation context and rule references.

### 5.3 Generated operational concepts

These describe Generated Compliance Work for a specific Registration Unit and Compliance Period:

- Compliance Obligations representing Generated Compliance Work;
- requirement instances;
- component action/attempt history;
- external results;
- evidence references and verification;
- signoffs;
- blockers;
- assignment history and current accountability;
- deadline snapshots and explanations;
- cancellation, supersession, reopening, and override events.

Engagement Execution follows the ordinary V1 sequence:

`Preparation → Checking → Review → Client Approval → Filing → Payment if applicable → Other Submissions if applicable → Complete`

Payment and Other Submission are conditional components inside the Generated Compliance Work object. Independent QA is not part of this Engagement sequence.

### 5.4 Projections

These are calculated views over the same facts:

- My Work;
- Review/Control Queue;
- Tower, Cluster, and All A&T views;
- annual Tax Service Calendar;
- RAG;
- dashboard counts;
- exception queues;
- component summaries;
- Compliance Complete and Control Complete indicators.

Projections must not become competing sources of operational truth.

## 6. 2303 and Tax Profile lifecycle

### 6.1 Processing flow

```text
Upload 2303
  → Private temporary processing copy
  → OCR/document extraction
  → Extracted fields + confidence + flags
  → Side-by-side human review and correction
  → Explicit human validation
  → Validated Tax Profile activation
  → Proposed Compliance Universe
```

### 6.2 Source and extraction facts

The domain preserves:

- source-document identity and version metadata;
- upload actor and timestamp;
- relationship to Taxpayer Entity and Registration Unit;
- temporary-copy lifecycle state;
- OCR Extraction Run;
- extracted field values;
- confidence;
- ambiguity, missing, or conflict flags;
- page reference where available;
- manual corrections;
- validator and validation timestamp;
- Tax Profile version created from the review;
- authoritative SharePoint reference;
- purge/deletion event.

Exact OCR bounding boxes are not required for V1.

### 6.3 Activation controls

OCR cannot activate a Tax Profile. Human validation must explicitly confirm the structured profile.

Low-confidence, missing, ambiguous, or conflicting values remain visible until resolved, accepted through an approved exception, or otherwise handled by domain-approved configuration.

Manual entry and correction remain available.

### 6.4 Temporary-copy lifecycle

The temporary processing copy remains available while setup, correction, validation, or Compliance Universe approval is in progress.

After the approved retention condition is met, it may be purged only while retaining the structured provenance, authoritative SharePoint reference, and purge event required to explain what happened.

If a permanent authoritative SharePoint reference is not yet available, the temporary copy must not be purged in a way that leaves TaxMonWeb without an authoritative source reference, except through an explicitly approved exception.

The storage provider, encryption, access control, purge mechanism, and retention duration belong in later technical/security documentation.

## 7. Compliance Universe lifecycle

### 7.1 Proposed universe

A Validated Tax Profile is evaluated against approved applicability configuration to produce a Proposed Compliance Universe.

The proposed result may contain:

- Applicable — In TMF Scope;
- Applicable — Out of TMF Scope;
- Not Applicable — documented reason required;
- Requires Review / Unresolved.

The proposed universe is not yet authoritative for normal operational generation.

### 7.2 Approval

Approval occurs at Registration Unit level.

The UI may support grouped review or approval at Taxpayer Entity or Client level, but each affected Registration Unit retains its own approval record.

Approved authority is:

- Cluster Leader within organizational scope;
- Tax Team as cross-portfolio tax-control authority;
- HOD with global/elevated authority;
- other capabilities later defined in `04-RBAC.md`.

Where practicable, a person should not independently approve their own proposed universe change. V1 does not require a universal two-person approval workflow.

### 7.3 Universe item behavior

| Universe decision | Operational consequence |
|---|---|
| Applicable — In TMF Scope | Eligible for normal obligation generation using approved definitions, rules, periods, and controls. |
| Applicable — Out of TMF Scope | Remains visible for control/reconciliation and exposure awareness; does not create normal TMF delivery workflow. |
| Not Applicable | Remains recorded with documented reason; does not generate normal operational obligation. |
| Requires Review / Unresolved | Remains visible as an exception; does not silently generate or disappear. |

### 7.4 Universe changes

An approved universe is historically preserved. A change creates a proposed revision or delta. Approval creates a new approved internal snapshot.

By default:

- future generation uses the new approved context;
- completed obligations retain their original context;
- open obligations do not silently recalculate;
- affected open obligations may be controlled through supersession, cancellation, reopening, or adjustment.

The accountant-facing experience may show a simple “Review changes” action while the domain preserves the underlying revision history.

## 8. From Compliance Universe to generated obligations

### 8.1 Generation inputs

Generation evaluates:

- Approved Compliance Universe;
- Universe Items marked Applicable — In TMF Scope;
- governed BIR Requirement Master versions;
- meaningful Obligation Definition generation/execution configuration, where present;
- approved Rule Versions;
- approved period configuration;
- approved Deadline Policies;
- Holiday Master context;
- approved Service Scope;
- effective-dated assignment context;
- applicable Control Template and requirements.

No specific tax form, frequency, deadline, or payment rule is assumed here.

### 8.2 Generation behavior

For each eligible item and approved Compliance Period, the system should:

1. determine the governed obligation identity;
2. prevent duplicate generation for the same approved identity;
3. snapshot the relevant profile, universe, rule, deadline, calendar, and assignment context;
4. calculate or determine approved deadlines and milestones;
5. instantiate applicable component requirements and controls;
6. create the Generated Compliance Work represented by the Compliance Obligation;
7. record the generation event and context.

Out-of-scope, Not Applicable, and unresolved items remain visible in the Compliance Universe but do not create normal in-scope TMF delivery obligations.

### 8.3 Obligation identity

The default identity is:

```text
Registration Unit
+ governed BIR Requirement Master version
+ meaningful generation/execution configuration, where present
+ Compliance Period
+ narrowly governed Instance Type
```

Normal recurring obligations are the default.

Amendment, correction, replacement, or related-instance types may be used only where approved domain behavior requires them. The model does not create a generic catch-all instance type.

Attempts, retries, acknowledgments, and evidence are normally history under the obligation.

## 9. Compliance Obligation structure

### 9.1 Stored operational facts

A Compliance Obligation stores or references:

- Registration Unit;
- Obligation Definition;
- Compliance Period;
- Instance Type where approved;
- generation context;
- original ownership snapshot;
- current accountable owner;
- Data Readiness condition and blocker reason where not ready;
- deadline set and calculation explanation;
- component statutory deadlines and TMF Package Target;
- component requirements;
- actions/attempts and results;
- evidence references;
- signoffs and verification;
- return Client Approval and Payment Client Approval as separate facts where applicable;
- blockers;
- lifecycle events;
- independent QA selection/status, findings, RCA/remediation, and Re-QA history where QA applies;
- audit history.

### 9.2 User-facing component model

The user-facing model remains:

| Component | Simple user-facing question |
|---|---|
| Submission | Has the primary compliance deliverable been submitted or otherwise completed according to the approved external result? |
| Payment | Has the applicable payment been handled and confirmed? |
| Attachments | Have required supplementary materials been handled? |
| Evidence/Proof | Is the required evidence captured and verified? |

The exact labels and completion conditions are configured by approved Control Templates and requirements.

### 9.3 Underlying component facts

Where history or integrity requires it, the domain distinguishes:

1. **Requirement** — what is expected;
2. **Action/Attempt** — what a person or external process tried to do;
3. **Result** — what outcome was reported or observed;
4. **Evidence** — what supports the action or result;
5. **Signoff/Verification** — who reviewed or attested to it.

These are conceptual distinctions first. They do not automatically require separate persistence objects.

### 9.4 External facts and internal control facts

The model keeps external outcomes separate from internal control outcomes.

Examples:

- a user may record that a submission was reported as sent;
- an external acknowledgment may be recorded separately;
- evidence verification may remain incomplete;
- a checker signoff may be missing;
- an internal control may be overridden where policy permits.

An internal override cannot convert an unfiled return into Filed, an unconfirmed payment into Paid, an unaccepted submission into Accepted, or an unresolved legal requirement into Not Applicable.

## 10. Deadlines and service milestones

An obligation may contain a deadline set with, where applicable:

- Base Statutory Deadline;
- Adjusted Statutory Deadline;
- TMF Package Target;
- TMF Internal Target;
- Client Data Target;
- Draft/Submission-to-Client Target;
- Client Approval Target;
- TMF Filing Target;
- component-level deadlines where genuinely required.

Each calculated deadline should retain enough explanation to identify:

- input period;
- applied Rule/Deadline Policy version;
- Holiday Master context where relevant;
- adjustment outcome;
- whether the value was calculated, approved as an exception, or overridden.

The model does not assume that every holiday or weekend adjusts every deadline.

The TMF Package Target is an internal control-policy target for completing the entire applicable package one Philippine working day before the earliest applicable statutory deadline. It never overwrites a component statutory deadline. Missing the package target remains distinguishable from missing the statutory deadline.

The Tax Service Calendar is a projection of these dates and milestones. Approved manual planning exceptions are retained against the relevant operational context rather than in a duplicate task database.

## 11. Completion, status, and lifecycle

### 11.1 Stored facts versus derived states

Stored facts include:

- requirement applicability;
- action and result records;
- evidence and verification;
- signoffs;
- blockers;
- assignment events;
- deadlines;
- cancellation, supersession, reopening, and override events.

Derived states include:

- current component summary;
- current operational stage;
- Compliance Complete;
- Control Complete;
- RAG;
- overdue/at-risk condition;
- queue membership;
- dashboard counts.

### 11.3 Independent QA

After Engagement Completion, Generated Compliance Work may enter an independent Tax Team QA cycle. QA may run later or on a monthly or selected cadence and does not make the Engagement work legally incomplete.

QA states include:

`QA Pending → QA Passed`

or:

`QA Pending → QA Failed → Returned to Engagement → RCA + Remediation → Re-QA`

QA Failed automatically requires RCA and remediation owned by the Engagement Team. QA Completion % and QA Pass Rate % are distinct derived measures.

### 11.2 Compliance Complete

Derived when all applicable legally required actions/components satisfy the approved requirements and external-result conditions.

An internal override cannot fabricate an external compliance fact.

### 11.3 Control Complete

Derived when required internal evidence, archiving, signoffs, attestations, and control gates are complete.

Where policy permits an Elevated Override to bypass an internal gate, the result must remain visibly exceptional and must not be represented as an ordinary control completion.

### 11.4 Lifecycle transitions

The model supports controlled transitions such as:

- generated;
- in progress;
- awaiting data, approval, funding, or evidence;
- submitted or reported as submitted;
- confirmed or accepted where supported by evidence;
- complete;
- cancelled;
- superseded;
- reopened;
- completed by approved exceptional override for an internal control only.

Exact user-facing labels remain configurable and should be simpler than this underlying vocabulary.

## 12. Assignments, ownership, and actors

### 12.1 Original ownership snapshot

When an obligation is generated, the relevant effective-dated assignment is captured as an original ownership/accountability snapshot.

The snapshot preserves historical accountability even if the current assignment later changes.

### 12.2 Current accountability

Open obligations have a current accountable owner. Authorized leadership may reassign an open obligation.

Reassignment:

- changes current accountability;
- records actor, timestamp, reason, and prior/new owner;
- preserves previous ownership snapshots;
- preserves completed actions, signoffs, and actual actors;
- does not create a transfer-acceptance workflow in V1.

Completed obligations retain their historical accountability and actor history.

### 12.3 Actual actors

Actual actors are recorded for preparation, checking, review, client approval where applicable, filing-related actions, evidence verification, and overrides.

An actual actor is not automatically the current accountable owner.

### 12.4 Segregation of duties

Control Templates determine required stages.

Where all three internal stages apply:

```text
Preparer ≠ Checker ≠ Reviewer
```

The model supports different templates for different obligation characteristics. It does not hardcode identical stages for all future obligations.

An actor cannot use an Elevated Override to bypass their own required control.

## 13. Effective dating and historical explanation

Effective dating or version references are required for:

- assignments;
- Tax Profile versions;
- Service Scope decisions;
- Compliance Universe revisions;
- Rule Versions;
- Requirement Definitions and Control Templates where historical behavior depends on them;
- Deadline Policies;
- Holiday Master context;
- generated obligation context.

Generated obligations retain references or snapshots sufficient to explain:

- which profile was validated;
- which universe was approved;
- which rules and requirements applied;
- how deadlines were determined;
- which holiday context was used;
- who was accountable at generation;
- who actually acted;
- what evidence and signoffs existed;
- whether an override occurred.

Historical facts that must not be rewritten include:

- original extracted values;
- manual corrections and validation events;
- activated Tax Profile versions;
- approved universe decisions;
- generated obligation identity and generation context;
- completed actions and results;
- signoffs and evidence verification;
- original assignment snapshots;
- override and lifecycle events;
- purge/deletion events for temporary source copies.

Current owner, current component summary, current RAG, and dashboard projections may change because they are derived or current-state views.

## 14. Elevated Overrides

An Elevated Override is not a general correction mechanism.

Ordinary corrections, reassignments, reopening, applicability changes, scope changes, and rule corrections use their appropriate domain process.

An Elevated Override:

- is available only to Tax Team or HOD subject to RBAC;
- applies to exceptional bypass of an internal control or gate;
- requires a reason;
- records original state, resulting state, actor, timestamp, authority, and target control;
- cannot bypass the actor’s own required control;
- does not create a universal second-approver workflow in V1;
- remains visibly exceptional;
- cannot fabricate an external compliance fact;
- cannot mark an unresolved legal requirement Not Applicable.

## 15. Access and RBAC attachment points

This document does not define the final permission matrix. It identifies where access boundaries attach.

### 15.1 Visibility scopes

Visibility may attach to:

- Client;
- Taxpayer Entity;
- Registration Unit;
- Compliance Universe;
- Compliance Obligation;
- organization unit;
- cross-portfolio control mode.

The six hierarchical business POVs are views over one application:

```text
My Work → Review/Control Queue → Tower → Cluster → All A&T
```

The POVs are Preparer, Checker, Reviewer, Tower Leader/Supervisor, Cluster Leader, and HOD.

### 15.2 Authority scopes

Authority attaches to operations/capabilities, including:

- review and correct extracted profile data;
- validate and activate a Tax Profile;
- propose or approve a Compliance Universe;
- maintain approved Rules Library and Holiday Master data;
- generate or regenerate approved work;
- perform obligation actions;
- verify evidence;
- reassign open obligations;
- perform elevated overrides;
- administer users, organizations, authentication, or technical configuration.

Visibility does not automatically grant any of these authorities.

Tax Team/Tax Control is a cross-functional control mode, not a seventh hierarchy level. System Administration is not a compliance POV and does not automatically grant compliance authority.

Exact role/capability combinations and organizational scopes belong in `04-RBAC.md`.

## 16. Conceptual versus likely persistence

The following is a persistence discussion, not a physical schema.

| Concept | Domain role | Likely persistence treatment | Reason |
|---|---|---|---|
| Client | Commercial relationship | Likely durable record | Required for portfolio and scope context. |
| Taxpayer Entity | Legal taxpayer | Likely durable record | Required to separate legal identity from Client. |
| Registration Unit | Obligation anchor | Likely durable record | Central scope for profiles, universes, obligations, and assignments. |
| Organization Unit | Access/reporting context | Likely durable record | Needed for hierarchical visibility and accountability. |
| Source Document metadata | Setup provenance | Likely durable record | Needed after temporary file purge. |
| Temporary processing copy | OCR input artifact | Private object/blob plus lifecycle metadata | The binary is temporary; identity, retention, and purge history remain durable. |
| OCR Extraction Run | Extraction history | Likely durable record | Multiple runs and outcomes must remain explainable. |
| Extracted Field Value | Provenance-bearing value | Likely durable record or structured child data | Confidence, source, correction, and validation history matter. |
| Tax Profile Version | Validated setup state | Likely durable versioned record | Downstream obligations need historical context. |
| Compliance Universe revision | Expected-compliance state | Likely durable versioned record | Approval, reconciliation, and what-should-exist analysis require history. |
| Universe Item | Applicability/scope decision | Likely durable record or structured child data | Out-of-scope, N/A, unresolved, and in-scope states must remain visible. |
| Obligation Definition | Optional generation/execution configuration | Likely durable versioned record only if it adds behavior | It must not become a second legal master. |
| Regulatory Issuance / Authority | Reusable provenance master | Likely durable versioned record | One inspectable source record can support many masters and rules. |
| BIR Requirement Master | Legal/control catalog | Likely durable versioned record | Stable requirement identity and effective content. |
| BIR Form Master | Supporting artifact catalog | Likely durable versioned record | Form revisions do not become separate legal requirements by default. |
| Tax Type Master | Controlled taxonomy | Likely durable versioned record | Rich legal values map to simple operating categories. |
| BIR Jurisdiction / Office Master | Controlled jurisdiction master | Likely durable versioned record | RDO/LTS and future office classifications are sourced and effective-dated. |
| Filing / Submission Channel Master | Controlled channel master | Likely durable versioned record | Filing channel is not free text or application logic. |
| Requirement Component | Requirement/package configuration | Likely durable versioned record or child data | Components remain inside the parent unless the independent-identity test is met. |
| eFPS Group | Controlled channel/rule value | Likely durable versioned record | Group classifications are sourced and effective-dated. |
| Rule Version | Master/configuration | Likely durable versioned record | Historical deadline/applicability explanation. |
| Control Template | Master/configuration | Likely durable versioned record | Determines required stages and SoD. |
| Holiday Master | Master/configuration | Likely durable record | Shared calendar context without client duplication. |
| Compliance Period | Value/object within obligation identity | Likely embedded structured value or small durable record | Supports identity and deadline calculation without a complex period engine. |
| Compliance Obligation | Generated operational root | Likely durable record | Main operational object. |
| Requirement instance | Obligation-specific expected control | Likely durable child data | Captures the approved snapshot of what is required. |
| Component | User-facing grouping | Likely enum/category or configuration reference | Does not automatically need its own aggregate. |
| Action/Attempt | Operational history | Likely durable child data | Required for retries, rejected submissions, and payment attempts. |
| Result | Outcome of an action | Likely fields or child data under an attempt | Separate persistence only if result history needs independent lifecycle. |
| Evidence/Proof | External reference or attestation | Likely durable child data | Required for multiple evidence items and verification history. |
| Signoff/Verification | Human control fact | Likely durable child data | Actor and timestamp must remain attributable. |
| Assignment history | Accountability history | Likely append-only child data or event record | Current owner alone cannot explain historical accountability. |
| Blocker | Operational exception | Likely durable child data or event | Blocker history and current blocker state may both matter. |
| Deadline calculation context | Historical explanation | Likely durable snapshot/structured data | Prevents future rule changes from obscuring past deadlines. |
| Audit Event | Cross-cutting immutable history | Likely append-only durable record | Material changes must be attributable and tamper-resistant. |
| RAG/status summary | Derived projection | Recomputed or cached projection | Must not become a competing source of truth. |
| Tax Service Calendar | View/projection | Query/read model or generated view | Must not become a duplicate task store. |
| Dashboard/queue | View/projection | Query/read model or calculated view | Presents the same obligations through different scopes. |
| Coverage Integrity | Derived control projection | Recomputed or cached projection | Expected → Generated → Executed → Evidenced is not a second task store. |
| Impact Analysis / Change Decision | Governed change-control record | Likely durable append-only record | Material changes cannot silently rewrite open or completed work. |
| Monthly Calendar Version | Governed release/version record | Likely durable versioned record | Human approval is required before operational use; releases are immutable. |
| Monthly Calendar Row Reconciliation | Source comparison result | Likely durable child data | Match, explained difference, mismatch, unresolved, and not-comparable states remain inspectable. |
| BIR Officer | Organizational reference master | Likely durable versioned record | Factual identity is separated from office assignment and case history. |
| BIR Officer Office Assignment | Effective-dated relationship | Likely durable child/history data | Transfers do not rewrite historical office-at-time context. |

## 17. Representative golden scenarios

These scenarios validate model behavior. They do not supply or imply Philippine tax rules.

### Scenario 1 — Clean 2303 extraction

An uploaded 2303 produces clear extracted fields with acceptable confidence.

The model must show the extraction provenance, allow human review, require explicit validation, activate a Tax Profile only after validation, and retain the resulting profile version.

### Scenario 2 — Low-confidence OCR requiring correction

One or more fields are low-confidence, missing, ambiguous, or conflicting.

The model must keep the issue visible, support manual correction, retain the original extraction and correction history, and prevent silent Tax Profile activation.

### Scenario 3 — Profile validation and universe approval

A validated Tax Profile produces a Proposed Compliance Universe.

An authorized human reviews the Expected Compliance items. Approval is recorded per Registration Unit even if the UI groups the review at Client or Taxpayer Entity level.

### Scenario 4 — Normal recurring compliance

An Approved Compliance Universe item is applicable and within TMF Scope.

The generator creates one idempotent obligation for the approved period, snapshots context and ownership, and creates the configured component requirements.

### Scenario 5 — Applicable but out of TMF Scope

An item is legally applicable but outside TMF Service Scope.

The item remains visible in the Compliance Universe for reconciliation and exposure awareness. It does not create normal TMF delivery work.

### Scenario 6 — No-payment obligation

An approved obligation has no applicable Payment requirement.

The Payment component is absent or marked not required according to configuration. The obligation is not blocked waiting for a payment that does not apply.

### Scenario 7 — Multiple attachments

An obligation has more than one configured attachment requirement.

The model can track each requirement and its actions/evidence without making the accountant manage an underlying workflow engine.

### Scenario 8 — Late client approval

Client approval remains outstanding after an internal target but before or around the statutory deadline.

The model records the blocker and milestone state, derives the appropriate exception/RAG projection, and does not falsely mark the obligation complete.

### Scenario 9 — Filing complete while payment remains outstanding

The Submission component has a supported completion result, but Payment remains applicable and unconfirmed.

Submission and Payment show different states. Compliance Complete remains governed by the applicable requirements rather than by the filing state alone.

### Scenario 10 — Missing or unverified evidence

The external action is reported, but required evidence is missing, inaccessible, or not verified.

The model preserves the reported action while keeping Evidence/Proof and Control Complete unresolved.

### Scenario 11 — Reassignment before completion

An open obligation is reassigned by authorized leadership.

Current accountability changes, the reassignment is audited, and original ownership context remains preserved.

### Scenario 12 — Reassignment after some stages were performed

Preparation or checking was performed by one person before reassignment.

The new owner becomes accountable for progression, but the previous actor, completed stage, signoff, and history remain unchanged.

### Scenario 13 — Completed historical obligation after current assignment changes

The client portfolio changes after an obligation is complete.

The historical obligation continues to show its original accountability and actual actors. Current ownership views do not rewrite completed history.

### Scenario 14 — Future rule change

An approved rule version changes for future applicability or deadlines.

Future generation uses the new approved context. Historical obligations retain their original rule references. Open obligations do not silently recalculate.

### Scenario 15 — Generated obligation later determined N/A or cancelled

An obligation was generated and later a controlled review determines that it should not proceed.

The record is not deleted. It receives a controlled N/A, cancellation, or supersession outcome with reason, authority, and audit history.

### Scenario 16 — Rejected submission followed by another attempt

An external submission attempt is rejected and another attempt occurs.

The original attempt and result remain visible. The later attempt does not overwrite the prior result.

### Scenario 17 — Elevated internal-control override

An exceptional internal control or gate cannot be completed through the ordinary path.

Tax Team or HOD may use an Elevated Override subject to RBAC, with mandatory reason and full audit history. The override remains exceptional and cannot fabricate a filing, payment, acceptance, or legal applicability fact.

## 18. Model review and remaining implementation boundaries

The pre-domain decision phase is complete. No model-shaping decision remains open based on the approved Decision Register.

The following remain intentionally outside this document:

- exact Philippine tax rules and deadlines;
- exact obligation catalog content;
- final RBAC matrix;
- physical database schema and indexes;
- APIs and integrations;
- UI screens and design system;
- OCR provider and storage provider;
- production retention, backup, and security implementation;
- notification orchestration;
- future tax-audit case management.

These are not gaps in the business domain model. They are governed configuration, later specifications, or implementation decisions.
