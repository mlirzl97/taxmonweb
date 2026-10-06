# TaxMonWeb Workflows and Controls

**Document:** 02-WORKFLOWS-CONTROLS.md  
**Product:** TaxMonWeb  
**Status:** Approved workflow and control baseline / amended core-domain freeze  
**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`, `01-DOMAIN-MODEL.md`, `03-RULES-DEADLINES.md`

This document defines the operational compliance lifecycle and control behavior for TaxMonWeb.

It is not a generic workflow engine, BPM platform, ticketing system, eNate replacement, RBAC matrix, database schema, API specification, or implementation plan.

No Philippine tax rules, forms, deadlines, filing interpretations, or control requirements are invented here. Obligation-specific behavior comes from approved Rules, Control Templates, Tax Profiles, Compliance Universes, and Service Scope configuration.

## 1. Workflow purpose and design tests

TaxMonWeb exists to make expected compliance work visible, controlled, attributable, and difficult to miss.

The operating principle is:

> Set up once. Generate automatically. Manage by exception.

The workflow model also applies:

> Automate what is deterministic. Flag what requires judgment.

And the interaction test is:

> Every click must either advance work, evidence a control, resolve an exception, or provide useful information. Otherwise question why the click exists.

The model must preserve sophisticated history underneath a simple accountant-facing experience.

## 2. Data Readiness and normal operational lifecycle

Data Readiness is a prerequisite/control condition, not necessarily a workflow stage. Records may come from the client or from TMF-maintained accounting/books.

```text
Data Readiness: Not Ready / Ready
```

Not Ready may carry a CLIENT DATA, ACCOUNTING CLOSE, INTERNAL, or OTHER blocker. Once readiness is sufficient, the normal operating journey is:

```text
Preparation and reconciliation
  → Internal checking
  → Internal review
  → Client approval
  → Filing / submission
  → Payment where applicable
  → Other submissions / attachments where applicable
  → Complete
```

Preparation, Checking, Review, and Client Approval before Filing are mandatory for ordinary V1 return/submission work. Internal approval occurs before client approval.

Evidence is captured within the relevant action/component. It is not a universal sequential stage.

QA occurs independently after Engagement work is complete or otherwise eligible; it is not part of the statutory execution sequence.

The intended internal control model is:

```text
Preparer → Checker → Reviewer → Client
```

Control Templates retain future extensibility for approved work types, but V1 ordinary return/submission work does not make Checker, Reviewer, or pre-filing Client Approval optional.

## 3. Workflow concepts

The following concepts must remain distinct.

| Concept | Meaning | Typical result |
|---|---|---|
| Milestone | Management timing/control point. | Client Approval Target reached or missed. |
| Work step | Operational activity required to progress work. | Prepare reconciliation, review source records, prepare submission. |
| Control/signoff | Required human quality or control gate. | Checker signoff, reviewer approval, evidence verification. |
| External action/result | Action performed in an external channel and its reported or observed outcome. | Submission attempt, payment initiated, acknowledgment, acceptance, rejection, confirmation. |
| Evidence | Support proving or documenting an action, result, or control. | Filing acknowledgment, payment confirmation, SharePoint reference, client approval evidence. |
| Blocker | Reason progress cannot continue normally. | Missing client data, funding not received, internal review returned, BIR/system failure. |

These are facts or projections associated with the Compliance Obligation aggregate. They are not generic workflow nodes.

## 4. Detailed statuses versus component facts

### 4.1 Accountant-facing detailed status direction

The approved detailed status vocabulary remains:

```text
Not Started
→ Waiting for Data / Not Ready
→ In Preparation
→ For Checking
→ For Review
→ For Client Approval
→ For Filing
→ For Payment
→ For Attachments
→ For Evidence / Archiving
→ Complete
```

These are human-friendly summaries, not a mandatory one-dimensional state machine. `Waiting for Data / Not Ready` summarizes the separate Data Readiness condition; it does not make Data Request a required execution stage.

### 4.2 Why a single linear state machine is insufficient

Payment and Attachments may be independent or conditional. Evidence may remain incomplete after an external action is legally complete. A filing can succeed while payment is pending. A rejected attachment can be resubmitted without moving the entire obligation back to preparation.

Therefore, the underlying obligation has parallel component/control facts. The detailed status is a derived primary summary selected from those facts and the applicable Control Template.

### 4.3 Primary journey summary

The primary UI may summarize the journey as:

```text
PREPARE → REVIEW → CLIENT → FILE → POST-FILING → COMPLETE
```

Component badges and exception reasons remain visible alongside the summary.

For example:

```text
POST-FILING
Submission — Accepted
Payment — Awaiting confirmation
Attachments — 2 of 3 verified
Evidence — Missing
RAG — AMBER
```

The product should not require accountants to understand the internal state derivation.

## 5. Control Template behavior

A Control Template defines the applicable stages and gates for an obligation type or configured obligation scenario.

For ordinary V1 return/submission work, the following are mandatory:

- preparation;
- checking;
- review;
- client approval before filing.

Control Templates may specify future variations for approved work types and may additionally define:

- whether preparation is required;
- stage-specific control details;
- whether Submission is required;
- whether Payment is required or conditional;
- whether Attachments are required or conditional;
- whether Evidence/Proof is required;
- which signoffs are required;
- which actors must be distinct;
- which milestones apply;
- which conditions produce Compliance Complete;
- which conditions produce Control Complete;
- which internal gate may be bypassed only by Elevated Override.

Control Templates are configuration, not user-created workflows.

## 6. Work-step and control classification

When existing Excel checklists or operating practices are assessed, classify each item as follows.

| Classification | Meaning | TaxMonWeb treatment |
|---|---|---|
| System-controlled | TaxMonWeb can determine it reliably from its own facts. | Calculate, derive, or enforce it automatically. Do not ask for a redundant checkbox. |
| Required human control | A person must exercise judgment, inspect work, verify evidence, or sign off. | Capture the minimum required action, actor, timestamp, result, and reason where relevant. |
| Work instruction | Guidance for how a person performs work. | Keep in working instructions or contextual help unless a control gate is genuinely required. |
| Redundant/low-value | Adds a click without preventing an omission or proving a control. | Remove from the TaxMonWeb control flow. |

Examples of system-controlled facts include generated due dates, assigned scope, required component presence, duplicate-generation prevention, actor conflict detection, and whether a required evidence reference exists.

Examples of required human controls include reviewing preparation, confirming reconciliation was performed in the working paper, approving client-facing output, verifying evidence, and resolving an unresolved rule or applicability issue.

## 7. Preparation and internal control lifecycle

### 7.1 Data/source records received

The obligation can enter preparation when required source records or client data are available according to the applicable Control Template.

The system should distinguish:

- data not yet received;
- data received but incomplete;
- data ready for preparation;
- data accepted for the relevant work step.

Missing or incomplete data creates a CLIENT DATA blocker. It does not require a generic ticket.

### 7.2 Preparation and reconciliation

TaxMonWeb does not reproduce the detailed tax computation or reconciliation workbook.

Excel remains the detailed preparation/computation source. TaxMonWeb captures only the minimum facts needed to establish that the required preparation and reconciliation control occurred, such as:

- preparation work started or completed;
- relevant working-paper or SharePoint reference where required;
- preparer actor;
- preparation signoff or attestation where required;
- unresolved preparation issue or blocker.

TaxMonWeb must not pretend that a preparation checkbox is equivalent to validating the underlying tax computation.

### 7.3 Internal checking

For ordinary V1 return/submission work, the Checker reviews the prepared work using the working paper and other approved source materials. Checking is mandatory.

The Checker may:

- approve the checking stage;
- return the work to the Preparer with a reason;
- identify a blocker or unresolved issue;
- record a required correction.

A return to the Preparer preserves the prior checking attempt and reason. It does not erase the earlier preparation or checker history.

### 7.4 Internal review

For ordinary V1 return/submission work, the Reviewer performs the review before client approval. Review is mandatory.

The Reviewer may:

- approve the review stage;
- return the work to the Preparer or Checker with a reason;
- identify an internal blocker;
- require resolution before client approval or filing.

Internal review is not a generic approval node. Its required evidence and signoff come from the Control Template.

### 7.5 Four-eye behavior

Where Preparer, Checker, and Reviewer are all required:

```text
Preparer ≠ Checker ≠ Reviewer
```

The actual actors must be distinct people. A person’s current job title is not enough to establish a permitted control action.

The system should identify actor conflicts before accepting a required signoff. Any exceptional bypass uses the Elevated Override rules in Section 17.

## 8. Client approval lifecycle

### 8.1 Client approval as a mandatory V1 gate

Client approval before Filing is mandatory for ordinary V1 return/submission work. It is not a configurable omission in the normal path.

Internal Checking and Review must be complete before client approval is requested.

Future approved work types may define a different Control Template, but a normal bypass requires Elevated Override governance.

### 8.2 Client approval facts

The model may record:

- approval requested;
- submission/transmittal reference;
- client approver or POC where relevant;
- approval received;
- rejection or requested changes;
- approval evidence;
- approval timestamp;
- late approval relative to the approved Client Approval Target.

### 8.3 Client approval blocker

When required approval has not been received, the obligation may remain operationally blocked by CLIENT APPROVAL.

The blocker does not change the statutory deadline or fabricate an approval. Once approval arrives, the blocker is cleared with its history preserved.

If approval arrives late, the system records the lateness, recalculates no statutory date, and derives risk from the approved deadline model.

## 9. Submission and filing lifecycle

### 9.1 Readiness for filing

An obligation reaches For Filing only when Preparation, Checking, Review, and Client Approval are satisfied, or an authorized Elevated Override is active.

The system must not present filing readiness when a required internal gate is unresolved.

### 9.2 Submission action and result

Submission is represented through one or more attempts and their results.

A submission attempt may have a result such as:

- initiated;
- reported as sent;
- acknowledged;
- accepted;
- rejected;
- failed;
- unverified.

The approved result vocabulary remains configurable. TaxMonWeb must not treat “sent” as “accepted” without the required external result or evidence.

### 9.3 Failed submission and retry

When a submission attempt fails or is rejected:

- the attempt remains in history;
- the failure/rejection reason is preserved;
- the obligation remains incomplete for the affected requirement;
- a subsequent attempt may be recorded;
- the later result does not overwrite the earlier attempt.

A successful later attempt may satisfy the Submission requirement while the failed attempt remains visible for audit.

### 9.4 Filing does not complete the obligation

A successful filing/submission does not automatically complete:

- Payment;
- Attachments;
- Evidence/Proof;
- internal archiving;
- Control Complete.

The component summary must show these independently.

## 10. Payment lifecycle

Payment is an independent, conditional component. Filing and payment may have different states and evidence.

Where payment applies, the payment control sequence is separately evaluated:

```text
Payment Prepared/Uploaded
  → Client Payment Approval
  → Payment Completion
```

Return Client Approval does not imply Payment Client Approval, Payment Initiated, or Payment Confirmed.

### 10.1 No-payment outcome

Where approved configuration determines that Payment is not required, the Payment component is not a blocker.

Nil or no-payment does not automatically imply:

- no filing;
- no attachment;
- no supplementary submission;
- no evidence requirement.

Those requirements are independently determined by the applicable Rules and Control Template.

### 10.2 Client-direct payment

The client executes payment through its own approved channel.

TaxMonWeb records control facts such as:

```text
Payment required
  → Awaiting client payment
  → Payment reported/initiated by client
  → Payment evidence received
  → Payment confirmed or unresolved
```

The exact external result vocabulary is configurable. TaxMonWeb does not execute or verify banking transactions directly in V1.

### 10.3 TMF-funded/payment route

The controlled route is:

```text
Funding requested
  → Awaiting funds
  → Funds received
  → Payment originated
  → Payment confirmed
```

Each stage is a control fact or external result, not a banking integration.

Funding may create a FUNDING blocker. Payment confirmation remains unresolved until the configured evidence/result requirement is satisfied.

### 10.4 Payment attempts and failures

Payment attempts and failures are retained as history. A later successful attempt does not overwrite an earlier failed or rejected attempt.

Payment confirmation cannot be inferred from payment initiation.

### 10.5 Payment pending after filing

An obligation may have:

```text
Submission — Accepted
Payment — Awaiting confirmation
Evidence — Incomplete
```

The obligation remains operationally open until the applicable requirements and gates are satisfied.

## 11. Attachments and supplementary submissions

Attachments are potentially multiple requirements under one Compliance Obligation.

For each configured attachment requirement, TaxMonWeb may track:

- required/not required state;
- preparation or compilation action;
- submission/upload attempt;
- acceptance, rejection, or failure result;
- evidence/reference;
- verification/signoff;
- separate deadline where approved.

### 11.1 Independent attachment progress

Attachments may proceed independently from Payment where the applicable Control Template allows it.

One rejected attachment does not erase other successful attachment submissions.

### 11.2 Failed attachment and resubmission

If an attachment submission fails or is rejected:

- the original attempt remains visible;
- the reason is preserved;
- the requirement remains unresolved;
- a later attempt may be added;
- the later success does not overwrite the failure history.

### 11.3 Attachment completion

The Attachments component is complete only when all applicable attachment requirements satisfy their configured action/result/evidence gates.

No generic “Attachments complete” checkbox should bypass unresolved requirement instances.

## 12. Evidence, proof, and archiving

### 12.1 Evidence is separate from the external action

An action/result may exist without verified evidence.

Examples include:

- submission reported as sent but acknowledgment not verified;
- payment initiated but confirmation missing;
- attachment uploaded but SharePoint reference not verified;
- client approval stated verbally but approval evidence not captured.

The relevant evidence requirement remains unresolved until satisfied or handled through an approved internal control exception.

### 12.2 SharePoint boundary

SharePoint remains the document source of truth.

TaxMonWeb stores references, attestations, and verification facts rather than duplicating tax files. A URL alone is not automatically proof that the correct document exists or is accessible.

### 12.3 Archiving/control completion

Archiving is a control activity where required. It may include:

- preparer attestation that required records were placed in the standard SharePoint location;
- checker verification where required;
- Tax Team sampling or audit review;
- evidence reference and verification timestamp.

Legal Compliance Complete may occur before Evidence/Archiving and Control Complete.

### 12.4 Client copy/transmittal

Where the applicable service arrangement or Control Template requires a client copy or transmittal after filing/submission, TaxMonWeb may record:

- copy/transmittal prepared;
- sent or reported as sent;
- recipient/reference;
- acknowledgment where required;
- evidence and verification;
- failure or resend attempt.

Client transmittal is a service/control fact. It does not prove that the underlying filing was accepted, payment was confirmed, or the legal obligation was completed.

## 13. Completion model

### 13.1 Compliance Complete

Compliance Complete is derived when all applicable legally required actions and external-result requirements are satisfied according to the approved Rules and Control Template.

It does not imply that all internal evidence or archiving controls are complete.

### 13.2 Control Complete

Control Complete is derived when required internal signoffs, evidence, archiving, attestations, and control gates are complete.

### 13.3 Exceptional control outcome

Where an approved Elevated Override bypasses an internal control, the outcome must remain visibly exceptional. It must not be displayed as ordinary control completion.

The exception cannot make an unfiled return Filed, an unconfirmed payment Paid, an unaccepted submission Accepted, or an unresolved legal requirement Not Applicable.

### 13.4 User-facing completion summary

Approved simple convention:

- show Compliance Complete as a distinct legal/external completion indicator;
- show Control Complete as a distinct internal-control indicator;
- show the overall operational item as Complete only when the applicable final control gates are satisfied;
- otherwise show the next actionable component or exception.

This keeps “filed” from being mistaken for “fully controlled.”

## 14. Blockers and dependencies

### 14.1 Required blocker categories

The minimum categories are:

```text
CLIENT DATA
CLIENT APPROVAL
FUNDING
INTERNAL
BIR/SYSTEM
OTHER
```

### 14.2 Blocker facts

A blocker should preserve:

- category;
- concise reason;
- affected component or gate;
- opened-by and opened-at;
- current owner or responsible party where known;
- expected next action where useful;
- cleared-by and cleared-at;
- related evidence or external reference where applicable.

Multiple blockers may exist at the same time.

### 14.3 Blockers do not replace status

A blocker explains why progression is not normal. It does not replace the underlying component/action/result facts.

For example:

```text
Primary summary: For Client Approval
Blocker: CLIENT APPROVAL
RAG: AMBER
```

After the statutory deadline passes, the same blocker may coexist with RED risk. Client delay must not hide statutory exposure.

### 14.4 Blocker resolution

Clearing a blocker does not erase its history. A cleared blocker may remain relevant to audit, lateness analysis, and management reporting.

### 14.5 Blocker, Risk/RAG, and Exception are separate

These are three distinct dimensions:

| Dimension | Meaning |
|---|---|
| Blocker | Why normal progression is impeded. |
| Risk/RAG | Timing exposure derived from approved deadline and control facts. |
| Exception | An unresolved, abnormal, conflicting, overridden, failed-generation, or otherwise non-standard condition requiring attention. |

They may coexist and must not be collapsed into one status. For example, an obligation may have a CLIENT APPROVAL blocker, AMBER RAG, and no Exception; or it may have an unresolved rule Exception with RAG unavailable and no operational blocker.

## 15. RAG and workflow interaction

RAG remains governed by `03-RULES-DEADLINES.md`.

Workflow facts provide the completion and blocker inputs; deadline architecture provides the temporal anchor.

The basic interpretation remains subject to separate internal-target and statutory exposure:

- GREEN — progressing within approved package and statutory timing, or complete as appropriate;
- AMBER — internal TMF Package Target exposure or other approved control/timing risk exists;
- RED — the Adjusted Statutory Deadline has been reached/passed and required statutory compliance remains incomplete/overdue.

Missing a TMF Package Target does not by itself mean that a BIR statutory deadline has been missed. The exact visual treatment of internal Amber versus statutory Red remains a UX decision; the underlying facts must remain separate.

### 15.1 Component-aware explanation

An obligation-level RAG should be accompanied by component and blocker reasons, such as:

- Payment pending;
- Client approval late;
- Attachment rejected;
- Evidence unverified;
- Funding outstanding;
- Internal review returned;
- BIR/System failure.

The worst applicable risk may drive the obligation-level RAG, but the user must be able to see which component caused it.

The TMF Package Target is the default internal target for completing the entire applicable package one Philippine working day before the earliest applicable statutory deadline. Component statutory deadlines remain individually visible and unchanged. A governed package-target exception changes the internal target only.

### 15.2 Unresolved deadline/configuration

If a required deadline is unresolved because approved rule content is missing, TaxMonWeb must not display GREEN merely because it has no date to compare.

It should display a visible configuration exception or “RAG unavailable — rule unresolved” state rather than introducing an opaque fourth risk color or inventing a deadline.

## 16. Independent Tax Team QA

QA is separate from Engagement execution and may occur after Engagement Completion, including in a later monthly QA cycle or under a future selected/risk-based policy.

The V1 QA sequence is:

```text
QA Pending → QA Passed
```

or:

```text
QA Pending → QA Failed → Returned to Engagement → RCA + Remediation → Re-QA
```

QA Failed automatically requires RCA. The Engagement Team owns RCA and remediation. Tax Team records findings and performs re-QA; it does not ordinarily complete or repair the Engagement Team’s work.

QA does not block Filing, statutory completion, or historical Tax Run Completion.

The following measures remain separate:

- QA Completion % = reviewed selected population / selected population;
- QA Pass Rate % = passed QA reviews / completed QA reviews.

QA Completion primarily measures Tax Team execution. QA Pass Rate is an Engagement Team quality signal.

## 17. Ordinary corrections, reopening, reassignment, and Elevated Override

### 17.1 Ordinary correction

An ordinary correction changes an operational fact through its normal control path and preserves the prior value/history where material.

It is not an Elevated Override.

### 17.2 Controlled reopening

Reopening is used when an approved reason requires a completed or closed obligation to be revisited.

Reopening preserves:

- prior completion state;
- prior actors and signoffs;
- reason;
- authorizing actor;
- timestamp;
- new required work.

Reopening does not fabricate an external result.

### 17.3 Reassignment

Authorized leadership may reassign an open obligation.

Reassignment changes current accountability but does not rewrite:

- original ownership snapshot;
- completed work;
- prior actions/attempts;
- signoffs;
- evidence verification;
- blocker history.

### 17.4 Elevated Override

An Elevated Override is an exceptional bypass of an internal control or gate.

It:

- is available to Tax Team or HOD subject to RBAC;
- requires a reason;
- records original and resulting states;
- records actor, timestamp, authority, and affected control;
- cannot bypass the actor’s own required control;
- does not require a universal second approver in V1;
- remains visibly exceptional;
- cannot fabricate filing, payment, acceptance, acknowledgment, or legal applicability.

If the underlying requirement must change, use the applicable Rule, Tax Profile, Compliance Universe, Service Scope, correction, or approved exception process.

## 18. Cancellation and supersession

### 18.1 Cancellation

Cancellation is a controlled lifecycle outcome when an approved profile, universe, rule, scope, or operational decision means the obligation should no longer proceed.

The obligation is not deleted. Cancellation preserves reason, actor, timestamp, authority, and preceding history.

### 18.2 Supersession

Supersession links a newer approved obligation or context to an earlier one.

The prior obligation remains historically visible. The new obligation or context must explain what changed and why.

### 18.3 Rule/profile changes

Rule and profile changes follow the prospective-impact model in `03-RULES-DEADLINES.md`:

- completed obligations are not silently changed;
- open obligations are identified for impact review;
- approved action may retain, supersede, cancel, reopen, or adjust them;
- ordinary lifecycle action remains distinct from Elevated Override.

## 19. Payment, Attachments, and Evidence independence

The Compliance Obligation is the shared operational root, but its components may progress independently.

```text
Compliance Obligation
├── Submission requirement
│   └── attempts/results/evidence/signoffs
├── Payment requirement, if applicable
│   └── funding/payment attempts/results/evidence
├── Attachment requirement 1
│   └── attempts/results/evidence/signoffs
├── Attachment requirement 2
│   └── attempts/results/evidence/signoffs
└── Evidence/Archiving controls
    └── references/attestations/verifications
```

The diagram is conceptual. It does not mandate a separate table or aggregate for every line.

No component may declare the entire obligation complete unless the applicable completion gates allow it.

## 20. Management views and one operational truth

The same Compliance Obligations, components, blockers, evidence, assignments, and derived states power all management views.

```text
My Work → Review/Control Queue → Tower → Cluster → All A&T
```

### My Work

Shows obligations and required actions for which the user is accountable or an assigned actor, subject to visibility and authority.

### Review/Control Queue

Shows checking, review, approval, evidence verification, and other authorized control actions requiring attention.

### Tower

Shows the authorized Tower/Team portfolio.

### Cluster

Shows the authorized Cluster portfolio.

### All A&T

Shows the broad authorized portfolio view.

Tax Team/Tax Control may have cross-portfolio control views according to RBAC. It is not a seventh hierarchical level.

These views are filtered projections, not separate trackers or management records.

## 21. Workflow scenarios

The following scenarios pressure-test the model without asserting tax content.

### 21.1 Normal recurring obligation

An approved in-scope Universe Item generates one obligation for an approved Compliance Period.

The obligation receives its configured requirements, deadlines, original ownership snapshot, and current accountable owner. Repeated generation does not duplicate it.

### 21.2 Waiting for client data

Required source records have not arrived or remain incomplete.

The obligation shows Waiting for Data with a CLIENT DATA blocker. No redundant task is created solely to represent the blocker.

### 21.3 Preparation complete and sent for checking

The Preparer completes the required preparation/reconciliation control and submits the work for checking.

The model records the preparer action/signoff, relevant working-paper/reference fact, and transition to the checking gate.

### 21.4 Checker returns work to preparer

The Checker identifies a correction.

The work returns to preparation with a reason. The prior checking action remains historical; the new preparation/checking attempt is separate.

### 21.5 Reviewer returns work

The Reviewer identifies an unresolved issue.

The return preserves reviewer history and identifies the required next action. It does not erase prior preparation or checking facts.

### 21.6 Awaiting client approval

Internal required gates are complete, but client approval is outstanding.

The obligation shows For Client Approval with a CLIENT APPROVAL blocker. The statutory deadline remains unchanged.

### 21.7 Client approval received late

Approval arrives after the Client Approval Target.

The approval timestamp and lateness remain visible. The blocker clears, while RAG is derived from the approved deadlines and remaining work.

### 21.8 Successful filing

An external submission receives the approved successful result/evidence.

Submission becomes satisfied, but Payment, Attachments, Evidence/Proof, and Control Complete remain independently evaluated.

### 21.9 Filing attempt fails then succeeds

The first attempt fails. A later attempt succeeds.

Both attempts remain in history. The later success may satisfy Submission; it does not erase the first failure.

### 21.10 No-payment obligation

The approved component policy says Payment is not required.

Payment does not block completion. Filing, attachments, and evidence remain independently evaluated.

### 21.11 Client-direct payment

The client executes payment through its approved channel.

TaxMonWeb records the required client-reported result and evidence/confirmation state. It does not integrate with the bank.

### 21.12 TMF-funded payment

The obligation follows Funding requested → Awaiting funds → Funds received → Payment originated → Payment confirmed.

Funding and payment history remain separate from submission history.

### 21.13 Payment pending after filing

Submission is accepted or otherwise complete according to approved external-result rules, but payment confirmation is outstanding.

The obligation remains open for the applicable payment/control gates.

### 21.14 Multiple supplementary attachments

The obligation has multiple attachment requirements.

Each requirement can be complete, pending, rejected, failed, or verified independently. One generic checkbox cannot close all requirements.

### 21.15 Attachment rejected then resubmitted

One attachment attempt is rejected. A later attempt succeeds.

Both attempts and results remain visible. The later success satisfies only the relevant requirement.

### 21.16 Legal Compliance Complete, Control Complete outstanding

All required external compliance actions are complete, but evidence verification or archiving remains incomplete.

Compliance Complete is true; Control Complete remains false. The primary summary remains in a post-filing/control state rather than ordinary Complete.

### 21.17 Reassignment while open

Authorized leadership reassigns an open obligation.

Current accountability changes. Prior ownership snapshot, actors, signoffs, and completed work remain unchanged.

### 21.18 Preparer resignation/reassignment

The Preparer leaves or is reassigned while work is open.

The replacement owner continues the obligation. No historical action is attributed to the replacement retroactively.

### 21.19 Controlled reopening

An approved reason requires a completed obligation to be revisited.

The prior completion state remains in history. New required work and actors are recorded separately.

### 21.20 Cancellation/supersession after approved profile/rule change

An approved change means an open obligation should no longer proceed as originally generated.

The obligation is cancelled or superseded with reason and authority. It is not deleted and not silently rewritten.

### 21.21 Authorized Elevated Override

An exceptional internal gate cannot be satisfied through the ordinary path.

Tax Team or HOD performs an Elevated Override subject to RBAC. The reason and exceptional result are visible. The override cannot create a filing, payment, acceptance, or legal applicability fact.

### 21.22 Overdue statutory obligation

The Adjusted Statutory Deadline has passed and required compliance action remains incomplete.

RAG becomes RED according to the approved deadline model. The underlying blocker and incomplete component remain visible.

### 21.23 Applicable obligation outside TMF Scope

The obligation is applicable but outside TMF responsibility.

It remains visible in the Compliance Universe for reconciliation and exposure awareness. It does not generate normal TMF delivery workflow.

### 21.24 Unresolved Compliance Universe item

Required applicability or rule information is unresolved.

The item remains Requires Review / Unresolved and visible to authorized control users. It does not become a fabricated normal obligation.

## 22. Pressure test against approved models

### 22.1 Domain Model compatibility

The workflow model is supported by the approved Domain Model because:

- the Compliance Obligation aggregate can contain or reference components, requirements, actions, results, evidence, signoffs, blockers, assignments, and lifecycle events;
- Data Readiness is a prerequisite condition distinct from Engagement execution;
- Generated Compliance Work is the work/control object, not the tax return itself;
- actual actors remain distinct from accountable owners;
- ownership snapshots and reassignment history are preserved;
- derived completion and RAG states remain separate from stored facts;
- cancellation, supersession, reopening, and Elevated Override are controlled history;
- independent QA can occur after Engagement Completion without blocking statutory completion;
- the working-paper and SharePoint boundaries are explicit;
- the same obligations power all management projections.

### 22.2 Rules/Deadlines compatibility

The workflow model is supported by `03-RULES-DEADLINES.md` because:

- workflow does not redefine statutory deadlines;
- milestones, internal targets, and statutory dates remain distinct;
- the TMF Package Target remains separate from component statutory deadlines;
- blockers and late approvals do not silently move dates;
- component-level deadlines remain optional and rule-driven;
- missing rules create visible exceptions rather than fabricated work or dates;
- open-obligation rule impacts require review rather than silent recalculation.

### 22.3 No contradiction discovered

No genuine contradiction requiring modification of `01-DOMAIN-MODEL.md` or `03-RULES-DEADLINES.md` was found.

One boundary is intentionally explicit: the detailed status vocabulary is a derived accountant-facing summary, while the underlying component/action/result/evidence model is parallel. This is a clarification of the approved Domain Model, not a redesign.
