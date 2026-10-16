# TaxMonWeb — Copilot Studio Migration Specification

**Purpose:** portable product, domain, UX, security, data, workflow, and build specification for rebuilding TaxMonWeb in Copilot Studio or an adjacent Microsoft application stack.

**Status:** migration handoff; preserve the locked decisions below unless the domain owner explicitly approves a change.

**Source project:** TaxMonWeb, Philippine tax-compliance monitoring and control system for TMF A&T.

**Important:** this document is a product and implementation specification. It is not authority to invent Philippine tax law, deadlines, filing rules, payment rules, forms, attachments, or legal interpretations. Where approved tax content is unavailable, the application must show an explicitly labelled unresolved or illustrative state.

---

## 1. How to use this document in Copilot Studio

Use this file as the master build brief when creating the replacement application.

Copilot Studio may provide the conversational assistant, guided actions, orchestration, and natural-language explanations. It must not become the only place where business facts live.

The replacement must have:

- a durable relational operational data store;
- authenticated users and server-side authorization;
- row/record-level organizational visibility;
- append-oriented history and actor attribution;
- durable evidence and filing facts;
- deterministic workflow commands and validation;
- views over one operational truth;
- exportable records that remain retrievable years later.

If the target Microsoft stack proposes Dataverse, use it as the durable relational source of truth. If it proposes SharePoint lists, agent variables, browser storage, conversation history, or local collections for core records, reject that design for TaxMonWeb’s operational data. SharePoint remains the permanent document repository, not the workflow database.

Do not build a generic chatbot that merely answers questions about spreadsheets. Build a role-aware compliance control application with an assistant layer.

### 1.1 First instruction to the builder

> Build TaxMonWeb as a Philippine tax-compliance monitoring and control application. Preserve the domain, workflow, RBAC, audit, history, evidence, and UX rules in this document. Use an assistant for guidance and orchestration, but store all material facts in durable relational records. Do not invent tax content. Do not infer authority from job title. Do not create duplicate trackers.

### 1.2 Decision precedence

If this handoff is shorter than the source documents, the source documents remain authoritative in this order:

1. `00-PRODUCT-BRIEF.md`
2. `00A-DECISION-REGISTER.md`
3. `00B-DOMAIN-GLOSSARY.md`
4. `01-DOMAIN-MODEL.md`
5. `03-RULES-DEADLINES.md`
6. `02-WORKFLOWS-CONTROLS.md`
7. `04-RBAC.md`
8. `05-UX-DESIGN-SYSTEM.md`
9. `06-TECHNICAL-ARCHITECTURE.md`
10. `07-V1-BUILD-PLAN.md`

When two approved requirements appear contradictory, stop and surface the contradiction. Do not silently choose the easier implementation.

---

## 2. Product identity and boundary

### 2.1 What TaxMonWeb is

TaxMonWeb is an internal Philippine tax-compliance monitoring and control system for TMF A&T.

It gives the Engagement Team a dependable operating view of what must be prepared, checked, reviewed, approved, filed, paid, evidenced, and completed. It gives leadership a dependable view of what requires intervention.

The product promise is:

> Set up once. Generate automatically. Manage by exception.

> Automate what is deterministic. Flag what requires judgment.

### 2.2 What TaxMonWeb is not

TaxMonWeb is not:

- tax computation software;
- a replacement for Excel working papers;
- a document-management system;
- a SharePoint replacement;
- a BIR/eFPS/eBIRForms/eSubmission filing platform;
- a bank or payment-execution platform;
- a generic workflow builder;
- a generic tax-rules programming language;
- a Planner or eNate clone;
- a full tax-audit case-management system;
- an autonomous tax decision-maker;
- a source of invented Philippine tax content.

External systems remain authoritative for computation, working papers, permanent documents, filing execution, payment execution, and external results. TaxMonWeb records controlled facts, references, evidence, accountability, and status.

### 2.3 Frozen product spine

```text
BIR Requirement Master + Rules/Calendar
  → Client Compliance Profile
  → Generated Compliance Work
  → Engagement Execution
  → Completion
  → Independent QA
```

Generated Compliance Work is the work/control object created by TaxMonWeb. It does not mean TaxMonWeb prepares or computes the tax return.

### 2.4 One operational truth

The same durable records power:

- Control Tower;
- Team;
- Clients;
- Work;
- My Work;
- Due Register;
- Calendar;
- BIR Center projections;
- Tax Team/QA views;
- management views;
- exports and archive reports.

There must not be a separate manual tracker for each screen.

---

## 3. Core non-negotiable rules

### 3.1 Domain safety

- Unknown tax content stays unknown or unresolved.
- Illustrative fixtures must be labelled as illustrative and synthetic.
- Never fabricate deadlines, forms, attachments, filing requirements, payment requirements, tax treatment, BIR results, TINs, or SharePoint links.
- A generated obligation is never deleted to hide a change.
- Cancellation, supersession, reopening, correction, and N/A decisions are controlled and historical.
- Completed historical context is not silently rewritten by later profile, rule, assignment, or organization changes.

### 3.2 Control safety

- Blocker, Risk/RAG, and Exception are separate dimensions.
- Compliance Complete, Control Complete, and overall operational completion are separate concepts.
- Filed is not Paid.
- Submitted is not Accepted.
- Payment initiated is not Payment confirmed.
- A URL is not automatically verified evidence.
- An override cannot fabricate an external fact.
- A normal user cannot bypass a required control by changing a status dropdown.
- Preparation, Checking, Review, and return Client Approval before Filing are mandatory for ordinary V1 return/submission work.
- Return Client Approval and Payment Client Approval are separate facts.
- Independent QA does not block statutory completion.

### 3.3 Actor and authorization safety

- Job title and career band do not grant access.
- Visibility does not grant edit, approval, governance, or override authority.
- Accountable owner, current assignee, original ownership snapshot, actual actor, signoff actor, and override actor are distinct.
- Segregation of duties is checked against actual actors and history.
- A user with multiple capabilities still cannot self-check or self-review when distinct actors are required.
- UI hiding is not security. Enforce authorization at the server/API/command boundary and data layer.

### 3.4 Interaction safety

Every click must do at least one of the following:

- advance valid work;
- evidence a control;
- resolve an exception;
- provide useful information.

Remove redundant confirmation gates, redundant “complete” checkboxes, and instructions that do not evidence a control. Put operational guidance behind contextual help when the user already knows the action.

---

## 4. Canonical domain model

### 4.1 Legal and service hierarchy

Preserve this hierarchy:

```text
Client
  → Taxpayer Entity
    → Registration Unit
      → Tax Profile
        → Expected Compliance / Compliance Universe
          → Compliance Obligation / Generated Compliance Work
```

Definitions:

- **Client:** commercial/service relationship managed by TMF.
- **Taxpayer Entity:** Philippine legal taxpayer with its own TIN.
- **Registration Unit:** relevant BIR-registered head office or branch under a Taxpayer Entity.
- **Service Scope:** whether TMF is responsible for handling or monitoring an otherwise applicable obligation.
- **Tax Profile:** validated, effective-dated profile of the Registration Unit’s relevant tax facts and configuration.
- **Expected Compliance:** what the taxpayer is expected to comply with, including applicability and TMF scope decisions.
- **Compliance Obligation:** a generated obligation for one Registration Unit, one governed requirement/configuration, one compliance period, and one governed instance type.

Do not collapse Client, Taxpayer Entity, and Registration Unit into one record.

### 4.2 Tax knowledge foundation

The legal source of truth is **BIR Requirement Master**.

Supporting governed masters include:

- BIR Form Master;
- Tax Type Master;
- BIR Jurisdiction/Office Master;
- Filing/Submission Channel Master;
- eFPS Group;
- Requirement Component;
- Regulatory Issuance/Authority;
- Holiday Master.

`Obligation Definition` is configuration for generation/execution only. It must not become a second legal catalog. If it adds no behavior beyond a requirement, rules, components, and control template, merge or remove it.

### 4.3 Compliance Universe lifecycle

```text
Tax Profile validated
  → Proposed Compliance Universe
  → Authorized review
  → Registration Unit approval
  → Approved Compliance Universe
  → Idempotent generation of Compliance Obligations
```

Approved + Out of TMF Scope remains visible for control and reconciliation but does not generate normal TMF delivery work.

Missing, conflicting, or uncertain applicability stays `Requires Review` or `Unresolved`.

### 4.4 Obligation identity

Default identity:

```text
Registration Unit
+ governed requirement/configuration
+ Compliance Period
+ governed Instance Type
```

Normal recurring obligations are the default. Amendment, correction, replacement, or related-instance types are added only when a real approved behavior needs them.

Generation must be idempotent. Re-running a generation command must not create duplicate normal obligations.

### 4.5 Effective dating and historical context

Effective-date and version concepts include:

- organization membership and reporting line;
- access/capability assignment;
- service scope;
- Tax Profile;
- Expected Compliance revision;
- Rule Version;
- Requirement Definition;
- Control Template;
- Deadline Policy;
- Holiday Master context;
- generation context;
- original ownership snapshot.

Open obligations may be affected by a new profile/rule version, but the system must create a reviewable impact set. Completed obligations retain their original context.

---

## 5. Durable data architecture

### 5.1 Required durable storage

Use one durable relational operational database for V1. It must persist:

- users, capabilities, and effective scopes;
- organization structure;
- clients, taxpayer entities, registration units, contacts, and POCs;
- source-document metadata and extraction runs;
- Tax Profiles and validation history;
- Expected Compliance and approval history;
- requirements, rules, control templates, and deadlines;
- generated obligations and generation runs;
- work components and requirement instances;
- attempts, results, evidence, signoffs, blockers, assignments, and lifecycle events;
- archive facts and filing/payment/eSubmission references;
- transaction/audit history;
- QA findings and remediation;
- durable exports or reproducible export queries.

Never rely on browser local storage, conversation memory, temporary agent variables, or demo fixture state for production facts.

### 5.2 Two logical outputs from Work

The user wants two simple tables/exports from the Work process. Preserve that simple experience without destroying normalized history.

#### Logical table 1 — Filing Evidence Register

One current evidence row per return/package, with fields such as:

| Field | Meaning |
|---|---|
| `return_id` | Stable obligation/package identifier. |
| `client_id` / `client_name` | Client relationship. |
| `taxpayer_entity_id` / `taxpayer_name` | Legal taxpayer. |
| `registration_unit_id` / `registration_unit_name` | Head office/branch context. |
| `tin` | Client setup fact; protected and access-controlled. |
| `rdo_or_bir_office` | Client/registration setup fact; never invented. |
| `tax_year_or_fiscal_period` | Compliance period. |
| `return_or_submission_type` | Approved requirement/form label. |
| `due_date` | Published/approved operational date, clearly labelled. |
| `filing_date` | Date the filing/submission was completed or reported. |
| `filing_reference_number` | External filing/FRN/reference. |
| `amount_to_pay` | Amount captured during Draft return completion; immutable/read-only after confirmation unless controlled correction. |
| `payment_required` | Required, Not Applicable, or Unresolved. |
| `proceed_to_pay_or_equivalent` | Payment route/reference. |
| `payment_amount` | Confirmed payment amount where applicable. |
| `payment_date` | Payment date where applicable. |
| `payment_acknowledgement_date` | Date acknowledged by BIR or external authority. |
| `payment_acknowledgement` | Reference/proof/result. |
| `esubmission_submission` | eSubmission reference/result. |
| `esubmission_submission_date` | eSubmission date. |
| `date_acknowledged_by_bir` | BIR acknowledgment date. |
| `date_validated_by_bir` | BIR validation date. |
| `attachment_names` | Names only in the summary/export; documents remain in SharePoint. |
| `sharepoint_reference` | Private/authorized permanent repository reference. |
| `compliance_complete` | Derived legal/external completion. |
| `control_complete` | Derived internal-control completion. |
| `archived_at` | Archive completion timestamp. |

Do not use `Not Applicable` or `Not Recorded` as a substitute when the process should have asked for a required fact. Required fields must be collected in the relevant work gate, especially Archive the return package.

#### Logical table 2 — Processing Log

Append-oriented history of who did what and when:

| Field | Meaning |
|---|---|
| `event_id` | Immutable event identifier. |
| `return_id` | Stable link to the obligation/package. |
| `event_type` | Preparation, checking, review, client approval, filing, payment, attachment, archive, reassignment, exception, etc. |
| `stage` / `component` | Filing, Payment, Attachments, Archiving, or detailed work component. |
| `from_status` / `to_status` | Material status transition when applicable. |
| `actor_id` / `actor_name_snapshot` | Actual person or system actor. |
| `accountable_owner_id` | Current accountable owner at event time. |
| `occurred_at` | Event timestamp. |
| `effective_date` | Date the change applies from, when different. |
| `reason` | Required for exceptions, overrides, reassignments, cancellations, reopening, and other governed actions. |
| `evidence_reference` | Link to relevant evidence fact, not necessarily the file itself. |
| `correlation_id` / `command_id` | Idempotence and support trace. |
| `ordinary_or_override` | Ordinary action or Elevated Override. |

The user-facing download can show these as two clean tables. The database may use normalized child tables and views underneath. Do not physically merge all event and evidence records into one overloaded table if doing so would destroy multiple attempts, results, signoffs, or history.

### 5.3 Database rules

- PostgreSQL/Dataverse relational records are the operational source of truth.
- Use stable immutable IDs, not display names or email addresses.
- Use foreign keys and constrained status values.
- Use effective dating/version relationships.
- Use unique generation identity for normal obligations.
- Preserve failed and retried attempts.
- Preserve old assignments and actors.
- Use optimistic concurrency/version checks.
- Record material domain change and audit event atomically where possible.
- Add indexes for client, registration unit, owner, scope, deadline, RAG, blocker, exception, component status, and unresolved universe items.
- Provide filtered, return-scoped exports; never expose all clients from a single-return download.

---

## 6. End-to-end product lifecycle

### 6.1 Setup and generation

```text
Client setup
  → Taxpayer Entity
  → Registration Unit
  → source information / 2303 metadata
  → extraction proposal
  → human review and correction
  → Tax Profile validation/activation
  → Proposed Expected Compliance
  → authorized Registration Unit approval
  → idempotent obligation generation
```

AI/OCR may propose fields. It cannot activate the Tax Profile, decide uncertain treatment, approve Expected Compliance, or generate approved operational work without the required human authority.

### 6.2 Normal return/submission work

The ordinary V1 journey is:

```text
Preparation
  → Checking
  → Review
  → Return Client Approval
  → Filing/Submission
  → conditional Payment / Attachments / Evidence
  → Archive/control completion
  → Independent QA later or separately
```

This is a summary journey, not proof that every component is strictly sequential. Payment, Attachments, and Evidence can have independent facts and attempts.

### 6.3 Detailed human-friendly states

Use concise derived summaries such as:

```text
Not Started
Waiting for Data / Not Ready
In Preparation
For Checking
For Review
For Client Approval
For Filing
For Payment
For Attachments
For Evidence / Archiving
Complete
```

These are projections, not a freely editable one-dimensional state machine.

### 6.4 Components

The primary operational component summaries are:

1. Submission/Filing;
2. Payment;
3. Attachments;
4. Evidence/Proof/Archiving.

Each component shows:

- plain-language status;
- what is complete;
- what remains;
- who needs to act;
- next valid action;
- blocker, RAG, or exception;
- evidence strength where relevant.

### 6.5 Payment logic

Payment is conditional and independent from Filing.

When payment applies:

```text
Draft return completion records amount to pay
  → Return Client Approval
  → Payment Client Approval where required
  → endorse/release/approve payment
  → payment initiated or paid through external route
  → payment proof/acknowledgment recorded
  → BIR acknowledgment/validation recorded where applicable
```

The amount to pay must be captured in Draft return completion, not repeated in a later gate. Once recorded, show it as a read-only value and append controlled corrections to history.

When payment does not apply:

- Payment is `Not Applicable`;
- it must not block completion;
- it must be displayed as a green/satisfied stage in the four-stage summary;
- it must count as satisfied for the overall stage count;
- no fake payment facts are created.

Payment initiation never means payment confirmed.

### 6.6 Filing and eSubmission facts

The archive/certification flow must collect, where applicable:

- filing date;
- filing reference number/FRN;
- eSubmission reference/result;
- eSubmission submission date;
- date acknowledged by BIR;
- date validated by BIR.

The system must distinguish sent/submitted, acknowledged, accepted, rejected, failed, and unverified according to the approved result vocabulary.

### 6.7 Attachments

Attachments may be multiple independent requirements. Track each required item, attempt, result, evidence, and verification. A summary report shows attachment names only; it does not embed or duplicate the files.

### 6.8 Archive the return package

Archive is the final durable evidence-capture step, not a redundant generic gate.

When the user opens Archive the return package, the form should show only the missing required facts and ask for:

- filing facts;
- payment facts if required;
- eSubmission facts;
- BIR acknowledgment/validation dates where applicable;
- attachment/evidence names;
- permanent SharePoint reference, if required by the arrangement;
- archive confirmation.

The archive dialog must not display `Not recorded` for a fact the process should collect. It should make the field required or explicitly explain why the field is not applicable.

### 6.9 Independent QA

QA is not an Engagement step and does not block filing/statutory completion.

```text
QA Pending → QA Passed
QA Pending → QA Failed → RCA/remediation → Re-QA
```

Tax Team records findings and rechecks. Engagement owns remediation. QA Completion % and QA Pass Rate % are separate measures.

---

## 7. Workflow command rules

Every material action must validate:

1. authenticated identity;
2. capability;
3. organizational scope;
4. record visibility;
5. current version/state;
6. applicable Control Template;
7. prerequisites;
8. external result/evidence strength;
9. actual-actor segregation-of-duties conflicts;
10. ordinary versus Elevated Override status;
11. reason and audit context where required;
12. idempotency/concurrency key.

Invalid actions fail without partial mutation and explain the next valid action.

Examples:

- cannot review before Checking;
- cannot self-check own preparation;
- cannot file before required review and Client Approval;
- cannot mark accepted from “sent” alone;
- cannot mark payment confirmed from payment initiation alone;
- cannot close an unresolved attachment requirement;
- cannot close Archive without required facts;
- cannot use an override to invent an external fact;
- cannot overwrite prior attempts or audit history.

---

## 8. Team, career levels, reporting, and access

### 8.1 Career level versus access

Career level is organizational/reporting metadata. Access profile is RBAC authority. Operating model is organizational context. Do not merge these concepts in the data model.

The user interface should not expose a redundant free-form Operating title field. Derive the display title from Career level:

| Career level | Derived display title |
|---|---|
| `5.2` | Senior Manager · HOD |
| `5.1` | Manager · Operations |
| `4.2` | Assistant Manager · Cluster Leader |
| `4.1` | Supervisor · Tower Leader |
| `3.2` | Team Leader |
| `3.1` | Senior Associate |
| `2.2` | Junior Associate |
| `2.1` | Associate |
| `1.1` | Intern |

`Cross-portfolio Tax Control` is an access/operating capability or scope concept, not a career band. Do not force it into the career-level ladder.

### 8.2 Reporting ladder

`Reports to` is a named person selector populated from the active roster in the next direct career band:

| Person’s band | Eligible manager band |
|---|---|
| `2.1` Associate | `3.1` Senior Associate |
| `2.2` Junior Associate | `3.1` Senior Associate |
| `3.1` Senior Associate | `3.2` Team Leader |
| `3.2` Team Leader | `4.1` Supervisor · Tower Leader |
| `4.1` Supervisor | `4.2` Assistant Manager · Cluster Leader |
| `4.2` Assistant Manager | `5.1` Manager · Operations |
| `5.1` Manager | `5.2` Senior Manager · HOD |
| `5.2` / `1.1` | No required higher band; top-level may be valid. |

The selector must:

- list names, not only titles or levels;
- include active people only;
- use effective-date validity;
- require a selection when eligible managers exist and no exception is selected;
- show an unresolved “No eligible next-band manager” state when none exists;
- allow a non-standard manager only through a reporting-line exception with a required reason;
- preserve the reporting line and exception history.

The server/database command must enforce the same ladder. UI filtering alone is insufficient.

### 8.3 RBAC dimensions

Evaluate separately:

- visibility;
- action authority;
- approval authority;
- governance authority;
- override authority;
- organizational scope.

Hierarchical POVs:

```text
Preparer → Checker → Reviewer → Tower Leader/Supervisor → Cluster Leader → HOD
```

Cross-functional Tax Team/Tax Control is not a seventh hierarchy level. System Administration is not tax-control authority. Super Admin is an explicit combined capability, remains audited, and cannot erase history or fabricate external facts.

### 8.4 Capability vocabulary

Operational capabilities include:

- `ViewAssignedWork`;
- `ViewScopedPortfolio`;
- `PrepareObligation`;
- `CheckObligation`;
- `ReviewObligation`;
- `RecordClientApproval`;
- `RecordSubmissionResult`;
- `RecordPaymentOrFundingResult`;
- `RecordAttachmentResult`;
- `AddEvidenceReference`;
- `CreateBlocker` / `ClearBlocker`;
- `ReassignOpenObligation`;
- `ReopenObligation`;
- `CancelOrSupersedeObligation`.

Setup/governance capabilities include:

- `ReviewTaxProfile`;
- `CorrectTaxProfile`;
- `ValidateTaxProfile`;
- `ProposeComplianceUniverse`;
- `ReviewComplianceUniverse`;
- `ApproveComplianceUniverse`;
- `ChangeServiceScope`;
- `MaintainRulesLibrary`;
- `ApproveRuleVersion`;
- `MaintainHolidayMaster`;
- `MaintainControlTemplate`;
- `EnterTaxAuditMode`;
- `PerformTaxTeamQA`;
- `PerformElevatedOverride`.

Administrative capabilities include:

- `AdministerUsers`;
- `AdministerOrganization`;
- `AdministerAuthentication`;
- `AdministerTechnicalConfiguration`.

---

## 9. Six workspaces and required behavior

### 9.1 Control Tower

Answers: “What requires intervention now?”

Prioritize:

- due today and due soon;
- AMBER and RED exposure;
- waiting for client/data/funding;
- failed filing/payment/attachment activity;
- unresolved configuration;
- Compliance Complete but not Control Complete;
- exceptions and expected-compliance gaps.

Every count drills to its underlying records.

### 9.2 Team

Answers: “Who is delivering the work?”

Provide:

- organization/cluster/tower views;
- roster and active/inactive status;
- career level and derived title;
- named next-band reporting line;
- operating model;
- workload/assignment context by authorized scope;
- effective dates and history;
- access profile only to authorized administrators.

Do not expose redundant Operating title/Operating role editor fields.

### 9.3 Clients

Answers: “Who are we servicing and what is their compliance context?”

Provide:

- client → taxpayer → registration-unit hierarchy;
- TIN/RDO/registration facts from setup;
- contacts and POCs;
- service scope;
- Tax Profile state;
- Expected Compliance;
- generated obligations;
- related team ownership.

### 9.4 Work

Answers: “What work needs to move?”

Provide:

- My Work;
- work queue;
- due register;
- calendar;
- filters by owner, scope, client, status, RAG, blocker, and exception;
- quick notification/pending-work indicator;
- focused detail view for each return/package.

The primary journey view should be compact and table-oriented. Avoid a tall repeated accordion that makes the user scroll through every completed instruction.

### 9.5 BIR Center

Read-only encyclopedia/reference projection over approved BIR masters and office data.

It must not:

- author rules;
- release calendars;
- generate obligations;
- replace restricted Tax Configuration/Admin;
- become a second source of truth.

### 9.6 Admin

Provide restricted:

- user/account provisioning;
- access profile and scope;
- authentication/configuration administration;
- audit/history access appropriate to the user;
- governed system controls.

System Admin does not automatically receive tax approval, evidence verification, review, or override authority.

---

## 10. Work detail UI specification

### 10.1 Header

Use a compact context header:

```text
Client name
FY/period · return type · Due [date]
TIN [authorized display] · RDO/BIR office [authorized display]
```

Do not repeat “Head Office” and unrelated RAG labels in the header if the same information is already obvious or belongs to the client setup context.

Use `·` as the separator consistently.

### 10.2 Return status summary

Use a horizontal four-stage progress indicator:

```text
Filing  →  Payment  →  Attachments  →  Archiving
```

Each stage shows:

- check mark for complete/satisfied;
- green check for Not Applicable/satisfied;
- current stage indicator;
- concise label;
- status text.

If Payment is Not Applicable, it still counts as satisfied. A completed return should not display “3 of 4” merely because one stage is N/A; show the overall result as complete and the Payment stage as `Not applicable`.

### 10.3 Next handoff

Display a concise banner:

```text
NEXT HANDOFF · Waiting for Reviewer · [person] · [what they must do]
```

The message must answer:

- who is pending;
- what action they need to take;
- which component/stage is affected.

Example: `Waiting for Reviewer · Evangeline De Vera · Review the prepared return before client approval.`

### 10.4 Journey table

Make the journey table the primary detail presentation:

| Step | Status |
|---|---|
| Filing section | section header |
| Get data | Complete / In progress / Waiting |
| Draft return | Complete · amount shown as a compact fact |
| Checker review | Complete / Waiting for Checker |
| Reviewer review | Complete / Waiting for Reviewer |
| Send to client for approval | Complete / Waiting for Client |
| File return and retain FRN | Complete / Filing reference required |
| Payment section | section header when applicable |
| Endorse payment | status |
| Release/approve payment | status |
| Process payment and retain proof | status / proof required |
| Attachments section | section header |
| Attachments | status |
| Archiving section | section header |
| Archive return package | status / evidence facts required |

Use short status pills. Do not repeat the full work instruction in every row.

### 10.5 Help text

Long descriptions such as “Send the approval package to the client and record the response before filing” should be contextual help behind an information icon or focused help disclosure. The primary table should show the action name and current state.

Help text should explain why a control exists only when that context is useful; it should not add visual noise to every completed row.

### 10.6 Final control / elevated controls

Final certification or Elevated Override must not sit inside the normal journey as an always-visible ordinary step.

Expose it as a separate controlled dialog/window, similar to other certification gates, only to authorized Reviewer, Tax Team/Tax Control, HOD, or approved Admin capability.

It must:

- show the affected control;
- require a reason where applicable;
- record who and when;
- preserve the prior state;
- be visibly exceptional;
- never manufacture a filing/payment/acceptance fact.

---

## 11. Archive report and exports

### 11.1 One-page archive report

The report is intentionally concise and one page where the content permits.

Order:

1. factual filing/payment/eSubmission summary;
2. end-to-end journey with dates and responsible people;
3. simple role certification;
4. attachment/evidence names only.

Do not include the internal transaction audit trail in the one-page client/archive summary.

### 11.2 Facts section

Use the heading:

```text
FILING, PAYMENT, AND ESUBMISSION
```

Place the facts at the top with generous spacing and left indentation from the page border. Include only actual captured values or explicit applicable states:

- filing date;
- filing reference number;
- amount to pay;
- payment required/not applicable;
- proceed to pay/equivalent;
- payment amount/date;
- payment acknowledgment date/reference;
- eSubmission submission/reference;
- eSubmission submission date;
- date acknowledged by BIR;
- date validated by BIR;
- attachment/evidence names;
- SharePoint reference where required.

### 11.3 Journey section

For each meaningful journey stage, show:

```text
Stage/action · status · date · person/role
```

Example:

```text
Draft return · Complete · 04 Oct 2026 · Berto Fajardo, Preparer
Checker review · Complete · 04 Oct 2026 · Arianne Galang, Checker
Reviewer review · Complete · 05 Oct 2026 · Evangeline De Vera, Reviewer
```

### 11.4 Certification section

Show simple role certification only:

- Preparer — name and date;
- Checker — name and date;
- Reviewer — name and date;
- archive/control certifier — name and date where applicable.

### 11.5 Evidence section

Show attachment/evidence names only. Do not embed documents in the one-page report.

### 11.6 Return-scoped exports

The work detail export controls should be subtle and aligned with Transaction History. Short labels are preferred:

- `Report`;
- `Facts`;
- `Log`.

Do not use large “Download one-page PDF” marketing-style controls.

Exports from a return detail page must be limited to that return/package. They must never include other clients.

Provide:

- one-page PDF report;
- Filing Evidence CSV for the selected return;
- Processing Log CSV for the selected return.

The CSVs must use durable database data, not browser-only state.

---

## 12. Visual and interaction design

### 12.1 Brand direction

Preserve the TaxMonWeb ant identity:

- minimal;
- geometric;
- flat/2D;
- professional rather than cute;
- recognizable at small sizes;
- restrained in the operating interface.

Use a calm corporate SaaS direction:

- white/off-white and neutral surfaces;
- dark readable typography;
- restrained TMF-inspired red accents;
- spacious but information-efficient layouts;
- strong hierarchy;
- red brand token separate from operational danger/overdue red.

Working tokens:

```text
brand.primary       #E31E24
text.primary        #1F1F1F
text.secondary      #6B6B6B
border.default      #E5E5E5
surface.page        #FAFAFA
```

Semantic status tokens must include success, warning, danger, info, exception, focus, and interactive states.

### 12.2 Density

- Control Tower and My Work can be dense.
- Setup review and client overview should breathe.
- Use consistent 4/8 spacing rhythm.
- Keep table rows concise.
- Use drawers/side panels for detail.
- Avoid full-screen modal sequences for ordinary work.
- Avoid huge forms and repeated completed instructions.

### 12.3 Accessibility

Require:

- keyboard navigation;
- visible focus states;
- logical heading hierarchy;
- labels for icons and ant-only marks;
- sufficient contrast;
- text/icon labels in addition to color;
- accessible tables and status announcements;
- reduced-motion behavior;
- clear validation/errors;
- touch targets suitable for tablet/mobile.

### 12.4 Responsive behavior

- Desktop: full shell, operational tables, side panels.
- Tablet: fewer table columns, focused detail views.
- Mobile: stacked summaries, prioritized actions, full-screen detail panels, simplified filters.

Do not shrink a desktop spreadsheet until it becomes unreadable.

### 12.5 Notification bell

Use a compact global notification/pending-work indicator in the upper-right utility area.

It should show role/scope-authorized pending items such as:

- work waiting for the current user;
- returned corrections;
- assigned review/check actions;
- unresolved exceptions relevant to the user.

It must be a projection of Work/Control Tower truth, not a second task database. Rich email/digest/escalation orchestration is out of V1 scope.

---

## 13. Authentication, security, and privacy

### 13.1 Authentication

Use a managed identity provider. Preserve stable internal user IDs independent of email/display name. Keep the design SSO-ready even if corporate SSO is deferred.

No password is created or shown to an administrator during staff provisioning. Activation and password setup happen through the managed identity flow.

### 13.2 Authorization layers

Enforce authorization in layers:

1. UI action visibility;
2. server/API command authorization;
3. row/record-level database visibility;
4. domain-control validation;
5. audit/history.

Never expose service-role or privileged database credentials to the browser or Copilot conversation.

### 13.3 Sensitive data

- Local, preview, and demo use sanitized/synthetic data only.
- Do not use real TINs, addresses, documents, contacts, or SharePoint links in public/preview environments.
- Store temporary 2303 files in private object storage.
- Do not commit uploads, secrets, or sensitive fixtures to source control.
- Redact document contents, TINs, and source payloads from logs unless strictly required and protected.
- Use signed/private access for temporary documents.
- Validate uploads, input size, types, and URLs at the server boundary.

### 13.4 Environments

```text
Local → Preview → Staging → Production
```

Each environment must have separate credentials, database/storage boundaries, and data policy.

Production must have approved access control, retention, backups/PITR, monitoring, secrets, and rollback procedures.

---

## 14. AI and document extraction

Use a provider abstraction:

```text
DocumentExtractionProvider
  → MockDocumentExtractionProvider for prototype/fixtures
  → managed provider adapter after benchmark and approval
```

The normalized extraction contract should include:

- source document metadata;
- extraction run ID/provider/version;
- normalized field name/value;
- confidence;
- page/location provenance where available;
- missing/malformed/ambiguous/conflicting flags;
- proposed versus human-corrected value;
- validator and validation timestamp.

AI may propose and normalize. AI may not:

- activate a Tax Profile;
- decide uncertain tax treatment;
- approve Expected Compliance;
- generate approved work without human authority;
- mark filing/payment/acceptance successful without required external result/evidence;
- bypass controls;
- fabricate external facts.

Temporary source documents must be private and purged according to approved retention policy only after authoritative references are preserved.

---

## 15. Rules and deadline logic

### 15.1 Distinct date concepts

Keep distinct:

- Base Statutory Deadline;
- Adjusted Statutory Deadline;
- Published Operational Deadline;
- TMF Package Target;
- component-level TMF Internal Target;
- Client Data Target;
- Client Approval Target;
- TMF Filing Target;
- component statutory deadlines;
- service milestones.

TMF Package Target is an internal package target. It never overwrites a statutory deadline.

### 15.2 Rules

Rules are finite, typed, versioned, effective-dated, approved, and explainable. Do not create a generic formula language or allow users to write arbitrary executable tax logic.

### 15.3 Monthly calendar governance

```text
Generate → Reconcile → Human Review → Approve → Release
```

Released calendar versions are immutable and maker-checker controlled. Partial releases must explicitly identify unresolved populations and must not be used as authoritative for excluded records.

### 15.4 Unresolved behavior

If applicability, requirement, holiday, deadline, or rule content is missing or contradictory:

- show a visible configuration exception;
- keep RAG unresolved/unavailable rather than green;
- do not invent a date or requirement;
- make the unresolved owner/action clear;
- preserve the decision when resolved.

---

## 16. Build plan for the migration

Build in vertical slices. Each slice includes UI, durable data, command/query logic, authorization, history/audit, tests, and review.

### Phase 0 — Shell and durable foundation

- authenticated shell;
- ant branding and navigation;
- six workspaces;
- durable environment/configuration;
- synthetic fixture loader;
- role/scope context;
- secure API/connector boundary.

### Phase 1 — Organization and access

- users and access profiles;
- career levels and derived titles;
- active roster;
- named next-band reporting lines;
- reporting exceptions with reasons;
- effective dates and history;
- server-side RBAC and organizational scope.

### Phase 2 — Client and registration setup

- Client/Taxpayer Entity/Registration Unit hierarchy;
- TIN/RDO setup facts;
- service scope;
- source information;
- temporary 2303 metadata and private storage;
- extraction proposal/review/validation.

### Phase 3 — Tax Profile and Expected Compliance

- Tax Profile versions;
- human validation/activation;
- Proposed Expected Compliance;
- Registration Unit approval;
- unresolved applicability;
- generation eligibility.

### Phase 4 — Rules, deadlines, and generation

- BIR Requirement Master and supporting masters;
- typed Rule Versions;
- Control Templates;
- Holiday Master;
- monthly calendar governance;
- idempotent obligation generation;
- generation exceptions and impact sets.

### Phase 5 — Work and execution

- Work/My Work queues;
- four-stage horizontal status summary;
- next handoff;
- journey table;
- Preparation → Checking → Review → Client Approval → Filing;
- conditional Payment/Attachments/Evidence;
- blockers/RAG/exceptions;
- amount capture during Draft return completion;
- payment proof persistence;
- durable archive facts.

### Phase 6 — Evidence, exports, and QA

- Filing Evidence Register projection;
- Processing Log projection;
- one-page archive PDF;
- return-scoped Facts CSV;
- return-scoped Log CSV;
- attachment-name summary;
- role certifications with names/dates;
- independent QA and RCA/remediation.

### Phase 7 — hardening

- optimistic concurrency;
- idempotency keys;
- retry/recovery behavior;
- authorization change while screen is open;
- audit protection;
- environment separation;
- backup/PITR and retention review;
- accessibility and responsive QA;
- production deployment controls.

Do not build future architecture early. Do not introduce microservices, Redis, Kafka, Elasticsearch, a second database, a generic workflow engine, or self-hosted AI without an approved demonstrated requirement.

---

## 17. Acceptance tests and pressure tests

### 17.1 Access and roster

- Operating title is not an editable field.
- Derived title matches Career level.
- Access profile remains independent from Career level.
- 2.1 and 2.2 show active 3.1 managers by name.
- 3.1 shows active 3.2 managers.
- An inactive manager cannot be selected.
- If no eligible manager exists, the UI shows an unresolved state and does not invent a person.
- A non-standard manager requires a reason and history.
- Direct API/database command rejects a wrong-band manager without an exception reason.

### 17.2 Work state

- Payment N/A is green/satisfied and counted in the four-stage completion.
- Filing complete does not make Payment or Attachments complete.
- Payment amount is captured in Draft return completion.
- Recorded amount is read-only in normal UI.
- Payment proof persists after refresh, a new session, and another user view with authority.
- Step status cannot remain “In progress” when its required proof and result are durably committed.
- Archive requires missing filing/payment/eSubmission facts before closing.
- “Not recorded” appears only when the field is genuinely not applicable or unresolved, not because the UI forgot to ask.

### 17.3 Data and audit

- A browser refresh does not lose a saved status or fact.
- A second device/session can retrieve the same saved record.
- The Filing Evidence export contains only the selected return.
- The Processing Log export contains only the selected return.
- Multiple filing/payment/attachment attempts remain in history.
- Reassignment changes current ownership but not prior actors.
- Completed obligations preserve historical profile/rule/assignment context.
- Audit events cannot be edited or deleted through ordinary UI.

### 17.4 Workflow and SoD

- Preparation, Checking, Review, and Client Approval are required before Filing for ordinary V1 work.
- A user cannot self-check or self-review when distinct actors are required.
- Return Client Approval and Payment Client Approval are separate.
- Submission “sent” is not “accepted.”
- Payment “initiated” is not “confirmed.”
- Attachment failure can be retried without erasing the failed attempt.
- QA Failure requires RCA/remediation but does not rewrite statutory completion.

### 17.5 Security

- Direct unauthorized API access is rejected even when the UI control is hidden.
- RLS/record visibility prevents cross-scope disclosure.
- Service-role credentials are never in the browser.
- Preview cannot access production database/storage.
- Exports respect the selected return and the caller’s scope.
- Elevated Override is limited, reason-required, visibly marked, and audited.

### 17.6 UX pressure test

Ask a preparer, checker, reviewer, and HOD:

1. What do I need to do now?
2. Who is waiting for what?
3. What is blocking this return?
4. Is Payment required, not applicable, or unresolved?
5. Where do I enter the amount to pay?
6. Where do I record the filing reference and BIR acknowledgment?
7. Can I retrieve this five years later?
8. Can I see only the return I am working on?

If the answer requires reading a technical audit log or navigating multiple duplicate trackers, simplify the UI without weakening the underlying data model.

---

## 18. Current TaxMonWeb implementation map

The source project currently has these major surfaces and boundaries. Recreate the behavior, not necessarily the framework-specific file structure:

### User-facing routes/workspaces

```text
/app/control-tower
/app/team
/app/clients
/app/work
/app/my-work
/app/calendar
/app/bir-center
/app/tax-team
/app/admin
/app/work/[workId]
/app/clients/[clientId]
```

### Server/API boundaries

```text
/api/me/access
/api/team
/api/admin/staff
/api/organization/units
/api/portfolio
/api/clients/[clientId]/profile
/api/requirements/approved
/api/deadline-control
/api/work
/api/work/[workId]
/api/temporary-2303/[documentId]
/api/temporary-2303/[documentId]/process
/api/registration-units/[registrationUnitId]/temporary-2303
/api/internal/purge-temporary-2303
/api/reports/tax-team
/api/tax-team/transaction-reviews
```

### Domain/service boundaries

- access and capability model;
- audit trail;
- client onboarding and manual setup;
- client profile persistence;
- deadline control and calendar;
- tax foundation/catalog;
- live adapters for clients, Team, Tax Team, and Work;
- generated-work repository;
- temporary document lifecycle;
- team/reporting model;
- workflow state and work outcomes.

### Migration shape

The source project uses explicit SQL migrations for identity, organization, client/profile, tax foundation, BIR reference, deadlines/calendar, generated work, work components, audit, Team reporting, staff lifecycle, payment amount control, evidence facts, manual work, data readiness, and period locks.

When rebuilding, preserve the behavior and constraints rather than copying names blindly. Every migration must be reviewable and reversible where practical.

---

## 19. Out of scope unless explicitly approved

- direct BIR filing integration;
- banking/payment execution;
- tax computation;
- replacement of Excel working papers;
- full SharePoint synchronization/DMS;
- corporate SSO as a prerequisite;
- Planner history migration;
- rich email/notification orchestration;
- complex delegation chains;
- full tax-audit case management;
- arbitrary workflow builder;
- generic tax rules DSL;
- autonomous tax interpretation;
- self-hosted AI;
- microservices or a second database;
- public/preview use of real client data.

---

## 20. Source documents in the original project

Keep these as the detailed source of truth alongside this migration handoff:

- `00-PRODUCT-BRIEF.md` — product boundary and promise;
- `00A-DECISION-REGISTER.md` — locked/configurable/deferred decisions;
- `00B-DOMAIN-GLOSSARY.md` — shared vocabulary;
- `01-DOMAIN-MODEL.md` — aggregates, lifecycles, historical context;
- `02-WORKFLOWS-CONTROLS.md` — control behavior and scenarios;
- `03-RULES-DEADLINES.md` — typed rules and dates;
- `04-RBAC.md` — capability, scope, authority, and SoD;
- `05-UX-DESIGN-SYSTEM.md` — information architecture and visual direction;
- `06-TECHNICAL-ARCHITECTURE.md` — persistence, security, hosting, failure model;
- `07-V1-BUILD-PLAN.md` — vertical slices, review gates, tests, deployment.

This file is the practical migration brief. The source documents remain the detailed approved record.

---

## 21. Final build instruction

Build the smallest complete TaxMonWeb capability that lets a real tax team:

1. maintain a client/registration context;
2. know what compliance work should exist;
3. see exactly what needs attention;
4. execute the mandatory preparation/checking/review/client-approval controls;
5. record filing, payment, eSubmission, acknowledgment, validation, and evidence facts;
6. know who is waiting for what;
7. preserve who did what and when;
8. retrieve a return’s evidence and processing history years later;
9. export one return’s facts and log without exposing other clients;
10. let independent Tax Team QA operate without rewriting Engagement history.

Keep the model controlled and durable, but keep the accountant-facing experience quiet, concise, and exception-first.
