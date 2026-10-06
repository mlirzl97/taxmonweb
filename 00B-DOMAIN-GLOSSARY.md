# TaxMonWeb Domain Glossary

**Document:** 00B-DOMAIN-GLOSSARY.md  
**Product:** TaxMonWeb  
**Status:** Approved core-domain freeze / amended baseline
**Purpose:** Establish consistent language for product, domain, UX, RBAC, technical, and test documentation.

## Usage principles

- Complexity may exist in the domain model where required for history, integrity, or control, but the accountant-facing experience should remain simple.
- A user-facing component summary should prefer language such as `Filed`, `Awaiting confirmation`, `Submitted`, `Verified`, or `Needs attention` over exposing internal lifecycle machinery.
- `Applicable` is not the same as `In TMF Scope`.
- `Not Applicable` requires a documented reason.
- `Out of TMF Scope` remains visible in the Compliance Universe.
- A requirement is not evidence.
- A user assertion is not automatically an external confirmation.
- An accountable owner is not necessarily the person who performed an action.
- Configuration that affects compliance control must be approved, versioned, and auditable.
- Absence of an obligation is not evidence that no obligation was expected.
- Completion is derived from applicable requirements and gates.
- No term in this glossary authorizes invention of Philippine tax rules, deadlines, forms, or filing interpretations.
- Generated Compliance Work means TaxMonWeb generates the work/control object and its controls; it does not prepare or compute the underlying tax return.
- Data Readiness is separate from the Engagement execution lifecycle.
- QA is independent from Engagement completion and does not make a legally completed return legally incomplete.

## Product and organization

### TaxMonWeb

The internal Philippine Tax Compliance Monitoring & Control System.

TaxMonWeb controls visibility, accountability, progress, exceptions, evidence references, and audit history across external tax-compliance activities. It does not replace the systems that perform computation, document storage, filing, or payment execution.

### Client

The commercial or service relationship managed by TMF.

A Client is not automatically the legal taxpayer, the Registration Unit, or the anchor of a particular compliance obligation.

One Client may relate to multiple Taxpayer Entities.

### Taxpayer Entity

The Philippine legal taxpayer represented in TaxMonWeb and identified by its own TIN as recorded and validated through approved source information.

One Taxpayer Entity may relate to multiple Registration Units.

### Registration Unit

The relevant BIR-registered head office or branch under a Taxpayer Entity, identified by its approved registration and branch information.

A separate Branch entity is not used in V1 unless a concrete requirement demonstrates that Registration Unit cannot represent the required information.

Compliance Obligations attach to the legally relevant Registration Unit.

### Service Scope

The effective-dated TMF responsibility boundary for an otherwise applicable compliance expectation.

Service Scope answers whether TMF is contracted or responsible to handle or monitor the item. It does not determine whether the item legally applies.

### Organization Unit

A cluster, tower, team, or other approved organizational grouping used for accountability, reporting, and access scope.

### Tax Team

The cross-portfolio tax-control and quality function responsible for approved rules maintenance, exception oversight, evidence review, and other authorized governance activities.

## Access, visibility, and authority

### Hierarchical Business POV

A role-, permission-, and organizational-scope-aware view of TaxMonWeb for a business user.

The six hierarchical POVs are:

1. Preparer;
2. Checker;
3. Reviewer;
4. Tower Leader / Supervisor;
5. Cluster Leader;
6. HOD.

These are not separate applications, separate data models, or six independently designed dashboards. They are views over the same underlying records.

### My Work

A view focused on obligations and control actions for which the current user is the accountable owner or assigned actor, subject to permission and organizational scope.

### Review/Control Queue

A view of records requiring review, checking, approval, evidence verification, or other authorized control action by the current user.

### Tower View

A view of the authorized Tower or Team portfolio.

### Cluster View

A view of the authorized Cluster portfolio.

### All A&T View

The broad hierarchical portfolio view available to an authorized HOD or other explicitly authorized capability. `A&T` refers to the relevant organizational portfolio, not a separate application.

### Visibility

The records or fields a user is allowed to see based on organizational scope, role, capability, and data-access policy.

Visibility does not by itself grant permission to edit, approve, reassign, verify, maintain rules, or override.

### Authority

The actions a user is permitted to perform on a record or configuration, such as edit, approve, reassign, verify, maintain, or override.

Authority is separate from visibility and must be defined by permission and organizational scope, not job title alone.

### Role or Capability

A permission-bearing assignment that contributes to what a user may see or do.

A user may hold more than one applicable role or capability. The domain model must not assume that one person has only one role.

### Tax Team / Tax Control Mode

A cross-functional control mode, not a seventh hierarchical level.

Subject to RBAC, it may provide cross-portfolio capabilities such as Tax Profile/2303 review, Compliance Universe control, Rules Library and Holiday Master maintenance, exception review, evidence/control review, and Tax Audit Mode.

### System Administration

Administrative access for users, organization structure, authentication, or technical configuration.

System Administration does not automatically grant tax approval, override, review, rule-maintenance, or other compliance-control authority.

## Source documents and profile

### Source Document

A document used as an input or evidence source, such as an uploaded BIR Form 2303 or an externally referenced SharePoint document.

An uploaded 2303 may be held temporarily by TaxMonWeb for OCR and setup. It is not permanent TaxMonWeb document storage.

### BIR Form 2303 Source

The source document used to inform registration and Tax Profile data.

It is an important registration baseline but does not automatically define every compliance obligation.

### Temporary Processing Copy

A private, time-limited copy of an uploaded Source Document retained only for OCR, review, correction, validation, and approval purposes.

The copy is not stored in Git or the application source repository. It is purged according to an approved retention policy after the relevant setup process and retention conditions are satisfied.

### OCR Extraction Run

One attributable attempt to extract structured fields from a Source Document.

An Extraction Run includes its processing time, outcome, extracted values, confidence, flags, and relationship to the source document.

### Extracted Field Value

A structured value produced from a Source Document by OCR or document extraction.

It may include:

- extracted value;
- confidence;
- source document identity/version;
- extraction run;
- page reference where available;
- ambiguity or conflict flags;
- later correction history.

Exact OCR bounding-box coordinates are not required for V1 unless the selected extraction technology provides them essentially for free and they materially improve validation.

### Manual Correction

A human change to an extracted or previously recorded value.

The prior value, corrected value, actor, timestamp, and reason where required remain attributable.

### Provenance

The history showing where a value came from and how it changed.

For V1, provenance should be sufficient to relate a value to the source-document identity/version, extraction run, extracted value, confidence, page where available, manual correction, validator, approver, timestamps, resulting Tax Profile version, and relevant audit events.

### Tax Profile

The structured registration and compliance-relevant profile for a Taxpayer Entity or Registration Unit.

It may contain source-derived values and professionally determined/configured values. Their provenance and validation state must remain distinguishable.

### Validated Tax Profile

A Tax Profile version that has passed explicit human review and validation.

OCR extraction alone cannot create a Validated Tax Profile.

### Tax Profile Version

A historically identifiable version of a Tax Profile associated with its source information, validation event, effective context, and downstream Compliance Universe.

## Compliance Universe

### Compliance Universe

The approved set of compliance expectations for a Taxpayer Entity or Registration Unit within a defined profile and configuration context.

Its primary purpose is to answer:

> What should exist?

It must remain simple for users while preserving internal history and version references underneath.

### Proposed Compliance Universe

A candidate Expected Compliance set generated from a Validated Tax Profile and approved configuration, awaiting authorized human review and approval.

It is not yet authoritative for normal operational generation.

### Approved Compliance Universe

The human-approved Expected Compliance set from which applicable, in-scope operational obligations may be generated.

Approval occurs at Registration Unit level. The user experience may support grouped review or approval at Taxpayer Entity or Client level, but each affected Registration Unit retains its own approval record. Cluster Leaders may approve within organizational scope, Tax Team may approve as a cross-portfolio tax-control authority, and HOD has global/elevated approval authority, subject to RBAC.

A person should not independently approve their own proposed universe change where practicable. V1 does not require a universal two-person approval workflow.

### Universe Item

One expected compliance item within a Compliance Universe.

Each Universe Item must support at least these user-facing decisions:

- Applicable — In TMF Scope;
- Applicable — Out of TMF Scope;
- Not Applicable — reason required;
- Requires Review.

### Applicability Decision

The recorded determination of whether a compliance expectation applies to the relevant Taxpayer Entity or Registration Unit.

The decision must be explainable through approved profile data, approved configuration, human review, or a documented exception.

### Scope Decision

The recorded determination of whether an applicable expectation is within TMF Service Scope.

Scope is separate from legal applicability.

### Requires Review / Unresolved

A state indicating that TaxMonWeb does not yet have an approved applicability or scope determination.

It must not be treated as Not Applicable, Complete, or silently excluded.

## Rules and calendar

### BIR Requirement Master

The governed catalog of BIR returns, reports, submissions, attachments, electronic files, certificates, registration requirements, and event-driven requirements that BIR may require.

The master is not a client work list. A requirement generates client work only when the Client Compliance Profile activates it for the applicable taxpayer, period/event, and TMF Service Scope.

Each requirement receives its own stable identity only when it has an independently meaningful compliance identity: it can independently become due, overdue, applicable/non-applicable, or evidenced, or BIR governs it as a distinct submission. A separate form, file, or channel alone is not sufficient.

### BIR Form Master

A governed catalog of BIR form artifacts and revisions. Forms support requirements but are not the primary legal/control identity. A requirement may reference zero, one, or several form versions.

### Regulatory Issuance / Authority

A reusable governed source record for an authoritative issuance or publication, such as a Revenue Regulation, Revenue Memorandum Circular/Order, Revenue Administrative Order, BIR calendar, BIR form or instruction, official advisory, or holiday proclamation. A source may be cited by multiple requirements/rules with publication, effectivity, retrieval, verification, and page/section metadata.

### Tax Type Master

A governed taxonomy of tax categories and detailed legal tax types. The default operating categories are CIT, VAT / Percentage Tax, WHT, and Others; detailed legal values may map upward to those categories.

### BIR Jurisdiction / Office Master

A canonical, effective-dated catalog of BIR offices and jurisdictions, including office type such as RDO or LTS/LT office and parent Revenue Region where applicable. Tax Profiles reference these records instead of storing jurisdiction as uncontrolled text.

### Filing / Submission Channel Master

A governed catalog of channels through which a requirement may be filed or submitted, such as eFPS, eBIRForms, eSubmission, eAFS, or other approved channels. Channel values are versioned and sourced; they are not free text.

### Requirement Component

A completion component of a parent BIR Requirement or compliance package, such as filing, payment, attachment/schedule, electronic submission, or evidence. A component remains inside the parent work object unless it meets the strict independent-identity test for its own Requirement ID.

### Coverage Integrity

A derived control projection across Expected → Generated → Executed → Evidenced. It identifies missing transitions without becoming a separate task or workflow status system. Severity depends on lifecycle state, timing, legal significance, and approved exceptions.

### Impact Analysis / Change Decision

The governed process for detecting and deciding how a material rule, profile, universe, or related configuration change affects future or open work. It preserves old and proposed context and records the authorized outcome, actor, timestamp, reason, and any rebase/regeneration/cancellation/supersession action.

### Rules/Calendar

The combined reference to the approved Rules Library and the published/normalized BIR Calendar used to determine applicability, components, and deadlines. Rules/Calendar content remains distinct from TMF internal control policy and service milestones.

### Monthly Calendar Version

An effective-dated, immutable monthly set of normalized BIR deadline entries with its source set, reconciliation result, preparer, approver, and release decision. States are Draft, Under Review, Approved, and Released. A released version may be superseded by a new version but is not silently overwritten.

### BIR Center

A future TaxMonWeb reference/control surface that projects canonical requirements, approved calendars, forms, channels, offices, holidays, and regulatory issuances. It is not a second source of truth and does not mirror the entire BIR website.

### BIR Officer

A governed factual identity for a BIR official used for organizational reference and documented Tax Audit relationships. It excludes subjective ratings, unsupported allegations, and speculative behavioral information.

### BIR Officer Office Assignment

An effective-dated relationship between a BIR Officer and a BIR Jurisdiction / Office Master record, including role/title, source, and verification state. Officer identity remains stable when the officer transfers.

### Obligation Definition

Optional generation/execution configuration that references a BIR Requirement Master version. It is not a second legal master. If it adds no meaningful behavior beyond Requirement + Rules + Components, it should be merged or removed.

### Rule

An approved, versioned, configurable policy used to determine applicability, requirements, deadlines, or other control behavior.

A Rule must not be invented merely because the software needs an answer.

### Rule Version

A historically identifiable version of a Rule with the effective, publication, activation, retirement, source, and review metadata required by governance.

### Requirement Definition

A configured statement of what must be performed, evidenced, or controlled for an obligation or component.

### Control Template

A configured set of required operational stages, signoffs, evidence checks, client approval requirements, and segregation-of-duties constraints for an obligation type or category.

For ordinary V1 return/submission work, Control Templates enforce Preparer, Checker, Reviewer, and Client Approval before Filing. Future approved work types may use governed variations; no identical stage sequence is assumed for every future obligation.

### Holiday Master

A separate approved dataset of relevant holidays or non-working days, including applicable source and verification metadata.

A Holiday Master record does not itself determine that a statutory deadline moves. The applicable approved Deadline Policy determines that behavior.

### Deadline Policy

An approved structured strategy for determining or calculating a deadline.

It may produce statutory, adjusted statutory, TMF internal target, service milestone, or component-level dates, subject to approved domain content.

### TMF Package Target

The default TMF control-policy target for completing the entire applicable compliance package one Philippine working day before the earliest applicable statutory deadline.

It does not replace or alter any component statutory deadline. A governed exception may change the internal target only.

### Base Statutory Deadline

The deadline before applying an approved adjustment or internal target calculation.

### Adjusted Statutory Deadline

The deadline after applying the approved Deadline Policy and relevant calendar information.

### TMF Internal Target

An internal operational target intended to support timely completion before the relevant statutory deadline.

Where the package-level policy applies, the TMF Internal Target is represented by the TMF Package Target. Component or milestone-specific internal targets remain distinguishable.

### Service Milestone

An operational planning date such as a client-data target, draft target, client-approval target, or TMF filing target.

### Tax Service Calendar

A user-facing annual or period-based projection of Compliance Obligations, deadlines, and Service Milestones.

It is not a separate task database or independent operational source of truth.

## Obligations and components

### Compliance Period

The period to which a Compliance Obligation relates.

The representation of monthly, quarterly, annual, fiscal, amended, corrected, or other periods remains subject to approved domain decisions and rules.

### Compliance Obligation

An operational compliance instance belonging to a legally relevant Registration Unit and generated from an Approved Compliance Universe, a governed BIR Requirement Master version, applicable rules, and a Compliance Period. An approved generation/execution configuration may participate only when it adds meaningful behavior.

Its default identity is Registration Unit + governed BIR Requirement Master version + any meaningful approved generation/execution configuration + Compliance Period + a narrowly governed Instance Type. If the configuration adds no behavior beyond Requirement + Rules + Components, the requirement version is used directly. Normal recurring obligations are the default. Amendment, correction, replacement, or related-instance types exist only where approved domain behavior requires them; the model does not provide a generic catch-all instance mechanism.

It contains or references operational deadlines, accountable ownership, components, blockers, execution history, evidence references, and audit history.

### Generated Compliance Work

The generated compliance work/control object created for an activated requirement and applicable period or event.

It represents the work TaxMonWeb expects the Engagement Team to perform and control. It may be represented in the domain by a Compliance Obligation and its components. TaxMonWeb does not calculate or prepare the tax return itself.

### Obligation Component

A user-facing part of a Compliance Obligation lifecycle:

1. Submission;
2. Payment;
3. Attachments;
4. Evidence/Proof.

The underlying model may preserve finer-grained requirements, actions, results, evidence, and signoffs without exposing them as separate workflow machinery to accountants.

### Data Readiness

A prerequisite/control condition indicating whether required source information or internally maintained accounting records are ready for Engagement execution.

Data Readiness is `Not Ready` or `Ready` and may carry a blocker reason such as Client Data, Accounting Close, or Internal Dependency. It is not automatically a sequential workflow stage.

### Submission

The primary compliance deliverable or externally submitted action represented by the obligation.

### Payment

The payment-related component, where applicable.

Payment state is distinct from submission state.

### Attachments

Required or conditional supplementary materials associated with an obligation.

An attachment requirement is not the same as an archived artifact or verified evidence reference.

### Evidence/Proof

A reference, record, acknowledgment, confirmation, attestation, or other support showing that a required action occurred or was controlled.

### Requirement

A configured expectation that a component, action, result, evidence item, or signoff is required.

### Action

A recorded operational activity performed by a user or external process.

### Attempt

A distinct effort to perform an action, such as a submission or payment attempt.

Attempts preserve prior results and do not silently overwrite one another.

### Result

The recorded outcome of an action, such as reported submission, acknowledgment, acceptance, rejection, failure, or confirmation.

The exact approved vocabulary remains configurable and must not imply a tax-system result that has not been confirmed.

### Signoff

A human approval, review, verification, or attestation attributable to a specific actor and time.

## Completion and lifecycle

### Engagement Execution

The operational lifecycle owned by the Engagement Team:

`Preparation → Checking → Review → Client Approval → Filing → Payment if applicable → Other Submissions if applicable → Complete`

For ordinary V1 return/submission work, Preparation, Checking, Review, and Client Approval before Filing are mandatory. Non-applicable payment and other-submission components are skipped.

### Payment Client Approval

A distinct client control for payment where payment applies. It follows Payment Prepared/Uploaded and is separate from approval of the return for filing.

### Compliance Complete

A derived state indicating that all applicable legally required actions and components have been completed according to approved requirements and gates.

It is not an ordinary free-text or freely editable status.

### Control Complete

A derived state indicating that required internal evidence, archiving, signoffs, attestations, and other control requirements are complete.

Compliance Complete and Control Complete are distinct states and may both be true when their respective requirements are satisfied.

The ordinary user-facing overall `Complete` state is reserved for satisfaction of applicable final control gates. Compliance Complete may be true before overall Complete.

### Blocker

A recorded reason why normal progression is prevented or delayed, such as client data, client approval, funding, internal action, BIR/system issue, or another approved category.

A Blocker is separate from Risk/RAG and Exception. Multiple dimensions may apply at the same time.

### Exception

An unresolved, abnormal, conflicting, overridden, failed-generation, or otherwise non-standard condition requiring attention.

An Exception is separate from a Blocker and from Risk/RAG. An item may have no current blocker but still have an unresolved Exception, or may have a blocker without being outside normal configured behavior.

### Not Applicable

A controlled determination that a requirement or Universe Item does not apply.

It requires a documented reason and must not be used as a substitute for unresolved analysis.

### Cancellation

A controlled decision that a generated obligation should no longer proceed.

The original record, reason, actor, timestamp, and authority remain preserved.

### Supersession

A controlled relationship in which a newer obligation, rule, profile, universe decision, or other approved record replaces an earlier one.

### Reopening

A controlled transition that reopens an otherwise completed or closed record.

The prior completion state and reason remain preserved.

### Elevated Override

An exceptional bypass of an internal control, completion gate, or segregation rule, performed by Tax Team or HOD subject to RBAC.

An Elevated Override requires a reason and preserves the original state, resulting state, actor, timestamp, authority, and visible exceptional treatment. The actor cannot use an override to bypass their own required control. V1 does not require a universal second-approver workflow.

An Elevated Override may bypass an authorized internal control where policy permits, but it must never fabricate an external compliance fact. It cannot make an unfiled return Filed, an unconfirmed payment Paid, an unaccepted submission Accepted, or an unresolved legal requirement Not Applicable. Where the underlying requirement itself must change, the appropriate applicability, scope, rule, or correction process must be used instead.

### RAG

A derived GREEN, AMBER, or RED risk indication expressing timing exposure from approved deadline and control facts, accompanied by explanatory reason and blocker context.

RAG is not an opaque risk score, is not an Exception classification, and is not equivalent to the TMF brand color palette. If required deadline configuration is unresolved, RAG must not be forced to GREEN, AMBER, or RED; the system shows a configuration exception such as `RAG unavailable — rule unresolved`.

RAG must also distinguish internal-target exposure from statutory exposure. Missing a TMF Package Target does not by itself mean that a statutory deadline has been missed.

### QA Status

The independent Tax Team quality-control state for a Generated Compliance Work object. V1 states are `QA Pending`, `QA Passed`, `QA Failed`, `Returned to Engagement`, `RCA + Remediation`, and `Re-QA`.

QA does not block statutory completion and may occur later, including through a monthly or selected/risk-based QA cadence.

### QA Completion %

The selected QA population reviewed divided by the selected QA population.

It primarily measures Tax Team execution and is separate from Engagement Team quality.

### QA Pass Rate %

QA Passed divided by completed QA reviews.

It is an Engagement Team quality signal and is separate from QA Completion %.

### Root Cause Analysis (RCA)

The required analysis initiated by a formal QA Failed result. The Engagement Team owns the RCA and remediation; Tax Team records the finding and performs re-QA.

### Tax Run Completion

A management-facing measure of completion of the applicable Engagement package. It is separate from RAG, QA Completion, QA Pass Rate, and RCA/remediation.

### Race to All Clear

The restrained V1 Team/Tower engagement concept. It emphasizes clean, timely, controlled completion without public individual leaderboards, raw-volume rewards, or speed-only competition.

## Assignment and control

### Assignment

An effective-dated relationship between an operational object and accountable people, roles, or organizational owners.

### Ownership Snapshot

The historical ownership/accountability context retained on a generated Compliance Obligation.

The snapshot explains who was accountable when the obligation was generated or otherwise assigned. Later current-owner changes do not rewrite completed history.

### Accountable Owner

The person currently accountable for progressing an open obligation or control.

### Actual Actor

The person who actually performed a preparation, checking, review, filing-related action, evidence verification, approval, or override.

### Preparer

The role responsible for preparation or operational execution where required by the applicable Control Template.

### Checker

The role responsible for checking where required by the applicable Control Template.

### Reviewer

The role responsible for review where required by the applicable Control Template.

### Segregation of Duties

A control requiring specified stages to be performed by distinct actors according to the applicable Control Template.

Where all three internal stages are required, the actors must satisfy Preparer ≠ Checker ≠ Reviewer.

### Reassignment

A controlled change to the current accountable owner of an open obligation.

Reassignment preserves prior actors, completed actions, signoffs, assignment history, and audit events. V1 does not include transfer acceptance or complex temporary delegation chains.

## Evidence, audit, and external systems

### Audit Event

An immutable or append-only record of a material change or control action, including actor, time, object, previous state where applicable, new state, reason, and relevant version references.

### External Reference

A pointer to a document, filing, payment, acknowledgment, approval, or other record held outside TaxMonWeb.

### Attestation

A human assertion that an external action or control condition occurred.

An attestation is not automatically equivalent to external confirmation.

### Verification

A recorded review of an external reference, evidence item, or attestation according to an approved control requirement.

### SharePoint Reference

An External Reference pointing to the permanent document source of truth in SharePoint.

A URL alone does not automatically prove that the correct document exists, is accessible, or satisfies the applicable evidence requirement.

### Tax Audit Mode

A cross-portfolio control and audit lens over existing TaxMonWeb records.

It is not a separate tax-assessment or tax-audit case-management system in V1.

## Deliberately avoided primary terms

### Task

Not the primary domain object. TaxMonWeb is organized around Compliance Obligations, components, controls, evidence, and exceptions.

### Generic Workflow

Not a V1 domain abstraction. TaxMonWeb uses explicit Compliance Obligation lifecycles and configured Control Templates rather than a user-defined workflow engine.

### Branch

Not a separate V1 entity. Branch information is represented through Registration Unit unless a concrete future requirement proves otherwise.

### Filed = Complete

Not a valid equivalence. Submission, payment, attachments, evidence, and internal controls may remain in different states.

### Out of Scope = Not Applicable

Not a valid equivalence. An obligation may apply legally while remaining outside TMF Service Scope.

### OCR-approved

Not a valid completion state. OCR can propose values; only explicit human validation and approval can activate downstream records.
