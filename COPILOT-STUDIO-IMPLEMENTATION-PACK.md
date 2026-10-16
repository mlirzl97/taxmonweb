# TaxMonWeb — Copilot Studio Implementation Pack

**Purpose:** build-ready handoff for recreating TaxMonWeb on the Microsoft Power Platform.

**Status:** implementation contract. This file makes the migration brief explicit about data, security, screens, commands, exports, fixtures, migration, and tests.

**Important:** this is not a source of Philippine tax law. Do not invent filing rules, deadlines, forms, attachments, payment requirements, BIR outcomes, TINs, or external references. Unknown facts remain unresolved or explicitly illustrative.

## 0. Build instruction

Recreate the behavior and controls of TaxMonWeb, not merely its words or screenshots.

Use this target shape:

```
Power Apps                 primary user interface
Dataverse                 durable relational operational source of truth
Power Automate             deterministic scheduled jobs and controlled integrations
Copilot Studio             guided assistant, search, explanations, and authorized actions
SharePoint                 private document repository and permanent document reference
Microsoft Entra ID         identity and authentication
```

Copilot Studio is not the database, workflow history, permission boundary, or document repository. It may call tools and connectors, but material facts must be committed to durable records before the user is told that an action succeeded.

The application must preserve:

- one operational truth across every workspace;
- durable records retrievable years later;
- current accountable owner versus actual actor;
- effective dating and historical snapshots;
- append-oriented attempts, evidence, and processing history;
- server/data-layer authorization and scope filtering;
- segregation of duties;
- concise, exception-first screens;
- explicit unresolved states instead of guessed tax facts.

## 1. Authority and conflict handling

Use the original repository documents in this order:

1. 00-PRODUCT-BRIEF.md
2. 00A-DECISION-REGISTER.md
3. 00B-DOMAIN-GLOSSARY.md
4. 01-DOMAIN-MODEL.md
5. 03-RULES-DEADLINES.md
6. 02-WORKFLOWS-CONTROLS.md
7. 04-RBAC.md
8. 05-UX-DESIGN-SYSTEM.md
9. 06-TECHNICAL-ARCHITECTURE.md
10. 07-V1-BUILD-PLAN.md
11. COPILOT-STUDIO-MIGRATION-SPEC.md

If two approved requirements conflict, stop and show the conflict to the domain owner. Do not silently choose the easier implementation.

The frozen product spine is:

```
BIR Requirement Master + Rules/Calendar
  → Client Compliance Profile
  → Generated Compliance Work
  → Engagement Execution
  → Completion
  → Independent QA
```

TaxMonWeb monitors and controls compliance work. It does not calculate tax, replace working papers, file directly with BIR, execute payments, or replace SharePoint.

## 2. Platform mapping

| Concern | Microsoft implementation | Required behavior |
|---|---|---|
| Operational records | Dataverse tables | Durable, relational, scoped, historically safe |
| User-facing work screens | Power Apps model-driven app, with custom pages where the journey table needs a tailored layout | All workspaces read the same records |
| Natural-language assistance | Copilot Studio topics, knowledge, and tools | Guidance cannot bypass command validation |
| Commands | Dataverse custom actions or secured Power Automate flows/custom connectors | Validate identity, capability, scope, state, prerequisites, SoD, and idempotency |
| Scheduled generation/reconciliation | Power Automate or approved Dataverse automation | Idempotent; never silently overwrite history |
| Documents | Private SharePoint library | Store metadata/reference in Dataverse; show attachment names in reports |
| Identity | Microsoft Entra ID and environment users | Do not treat job title as permission |
| Audit | Dataverse platform audit plus custom append-only Processing Log | Platform audit alone is not the user-facing processing log |
| Exports | Secured flow/custom action | Selected-return scope only |

Do not store core records in agent variables, browser/local collections, conversation history, SharePoint lists, temporary collections, or spreadsheets. Do not expose service credentials to the browser or agent client.

Use standard Dataverse tables, relationships, choice columns, views, teams, and security roles. Use custom actions/flows for governed transitions. Do not create a generic workflow engine or tax-rules DSL.

## 3. Canonical domain model

Preserve this hierarchy exactly:

```
Client
  → Taxpayer Entity
    → Registration Unit
      → Tax Profile version
        → Expected Compliance item
          → Compliance Obligation / Generated Work
```

Definitions:

- Client: service relationship.
- Taxpayer Entity: legal taxpayer and TIN owner.
- Registration Unit: registered head office or branch context.
- Tax Profile version: effective-dated, human-validated facts for a registration unit.
- Expected Compliance: approved expectation and scope decision.
- Generated Work: one period-specific operational compliance package.
- Processing Log: append-only record of who did what and when.
- Filing Evidence: current or append-oriented external facts needed to evidence the return.

Obligation identity is:

```
Registration Unit + Requirement Definition/Version + Compliance Period + governed Instance Type
```

The legal source of truth is the governed BIR Requirement Master. Supporting tax types, forms, offices, channels, eFPS groups, components, issuances, citations, holidays, and deadlines are references or configuration; they are not a second legal catalogue.

## 4. Durable table contract

The target may rename Dataverse tables, but must preserve these semantics, relationships, and constraints. Existing Supabase names are mapping hints.

### 4.1 Identity, organization, and access

| Canonical table | Required fields | Constraints |
|---|---|---|
| OrganizationUnit | id, code, name, type, parent, active/effective dates | Unique code; effective hierarchy |
| AppUser | id, Entra object id, display name, email, account status, effective dates | Entra identity is stable; email is not the key |
| Capability | key, label, description | Controlled vocabulary |
| UserCapabilityAssignment | user, capability, effective dates, granted by, reason | Historical; no implicit authority from title |
| UserScopeAssignment | user, scope type/id, effective dates | Required for visibility |
| TeamMemberProfile | user, career level, access profile, active dates | Career level and access are separate |
| TeamMemberProfileHistory | user, prior/new values, effective dates, actor, reason | Append/history |
| ClientTeamAssignment | client, user, assignment role, effective dates | Historical |
| RegistrationUnitTeamAssignment | registration unit, user, assignment role, effective dates | Historical |

Current career mapping:

| Band | Career level | Derived operating label |
|---|---|---|
| 5.2 | Senior Manager | HOD |
| 5.1 | Manager | Operations |
| 4.2 | Assistant Manager | Cluster Leader |
| 4.1 | Supervisor | Tower Leader |
| 3.2 | Team Leader | Team Leader |
| 3.1 | Senior Associate | Senior Associate |
| 2.2 | Junior Associate | Junior Associate |
| 2.1 | Associate | Associate |

Do not create a separate editable Operating title field. Derive it from career level. Access profile remains independent.

Reports to is a named user lookup. By default it lists active users in the next succeeding job band, scoped to the permitted organization. A non-standard reporting line requires an authorized exception reason and Processing Log entry. The command must validate this server-side.

### 4.2 Client and registration context

| Canonical table | Required fields | Constraints |
|---|---|---|
| Client | id, reference code, legal/service name, status, scope, timestamps | Stable reference |
| TaxpayerEntity | id, client, legal name, TIN where authorized, status | Do not collapse into Client |
| RegistrationUnit | id, taxpayer entity, reference code, type, registered name, RDO/BIR office reference, active dates | Governed head-office uniqueness |
| RegistrationSourceReference | registration unit, source kind, private reference, observed date, verification state | No public real documents in preview |
| ClientGroupMembership | group, client, effective dates | Portfolio grouping |
| ContractRepository | client, private repository reference, engagement metadata | SharePoint reference, not report document bytes |

TIN, RDO/BIR office, client name, and registration details are setup facts. Show them in Work only where authorized and useful; never invent them.

### 4.3 Profile and expected compliance

| Canonical table | Required fields | Constraints |
|---|---|---|
| TaxProfileVersion | registration unit, version number, effective dates, status, source, validated by/at | One active version per unit |
| TaxProfileOfficeContext | profile, BIR office/RDO references, source/verification | Effective-dated |
| TaxProfileFilingContext | profile, filing channel, eFPS group, relevant configuration, source | No unsupported interpretation |
| TaxProfileRegisteredTaxType | profile, tax type/source label, applicability, source | Effective-dated |
| TaxProfileChangeEvent | profile, changed fields, actor, reason, timestamp | Append-oriented |
| ExpectedCompliance | registration unit, requirement version, applicability, TMF scope, status, approved by/at, reason | Authorized review/approval |
| ComplianceUniverseItem | registration unit, requirement, effective dates, expected state, coverage status | Gaps visible; completed history retained |
| ImpactAnalysisCase | rule/profile change, affected objects, status, decision, actor, reason | Required before material rebase/regeneration |

AI/extraction may propose values. A human must validate the profile and approve expected compliance before operational work is generated.

### 4.4 Tax knowledge and calendar

Use governed tables for:

- RegulatoryIssuance and RegulatoryCitation;
- TaxType;
- BIRForm;
- BIROffice and factual office assignments/contacts;
- FilingChannel;
- EFPSGroup;
- BIRRequirement and BIRRequirementVersion;
- RequirementVersionForm;
- Rule and RuleVersion;
- DeadlinePolicy;
- RequirementComponent;
- HolidayMaster;
- PublishedCalendarEntry;
- MonthlyCalendarVersion and entries;
- CoverageIntegrityObservation.

Rules must distinguish component deadlines from the TMF Package Target. Monthly calendars use:

```
Generate → Reconcile → Human Review → Approve → Release
```

Released versions are immutable. Partial release must identify unresolved populations and exclude them from authoritative use.

### 4.5 Generated Work and execution

| Canonical table | Required fields | Constraints |
|---|---|---|
| GeneratedWork | id, generation key, registration unit, requirement/version, period, instance type, due dates, lifecycle stage, current owner, payment applicability, payment amount/currency/route, lock state, timestamps | Generation key unique; applicability is required/not_applicable/unresolved; amount non-negative |
| GeneratedWorkComponent | work, component type, label, requirement, mandatory/conditional, status, evidence state, order | One current component per work/code |
| ProcessStep | work, step code, label, bundle, responsible role/capability, sequence, status, current owner, completed by/at | Controlled status; overall state derived |
| GateAttempt | work, gate/step, attempt number, status, actor, started/completed, reason, correlation | Failed attempts retained |
| ChecklistUpdate | work/step, field, old/new value, actor/time, source | Append-oriented |
| Evidence | work/step, evidence kind, reference, result strength, attachment name, captured by/at, verified by/at | Reference is not automatically verified |
| QAFinding | work, finding, severity, status, RCA/remediation, owner, due date, re-QA | QA separate from Engagement |
| PeriodLock | period, status, actor/time, reason | Prevents unauthorized change after close |

Required process step codes:

```
client-approval
filing
payment
payment-client-approval
payment-confirmation
esubmission
evidence
```

Concise display labels:

```
Client approval
File return and retain FRN
Endorse payment
Release or approve payment
Process payment and retain proof
Attachments
Archive the return package
```

### 4.6 Audit and processing log

ProcessingLog fields:

```
id
work
event_type
stage
component
from_status
to_status
actual_actor_id
actor_name_snapshot
actor_role_snapshot
accountable_owner_id
occurred_at
effective_date
reason
evidence_reference
command_id
ordinary_or_override
```

PlatformAuditEvent fields:

```
table/record
action
actor
timestamp
before/after summary
correlation id
scope
```

Processing Log is the business-facing who-edited-approved-what-when table. Platform audit is internal technical support. Neither belongs in the one-page client/archive summary.

### 4.7 Explicit relationship and retention map

Implement these relationships explicitly in Dataverse. Do not leave them to Copilot or Power Apps inference.

| Parent | Child | Cardinality | Delete/retention rule |
|---|---|---:|---|
| OrganizationUnit | OrganizationUnit child units | 1 → many | Restrict deletion when historical records depend on the unit; end-date instead |
| OrganizationUnit | UserScopeAssignment | 1 → many | Restrict deletion; preserve scope history |
| AppUser | UserCapabilityAssignment | 1 → many | Restrict deletion; end-date assignment |
| AppUser | UserScopeAssignment | 1 → many | Restrict deletion; preserve historical scope |
| AppUser | TeamMemberProfile | 1 → 1 current | Restrict deletion; retain profile history |
| AppUser | TeamMemberProfileHistory | 1 → many | Append-only; never update/delete history |
| AppUser | ClientTeamAssignment | 1 → many | End-date assignment; retain prior assignment |
| AppUser | RegistrationUnitTeamAssignment | 1 → many | End-date assignment; retain prior assignment |
| Client | TaxpayerEntity | 1 → many | Restrict deletion; deactivate/close instead |
| Client | ClientGroupMembership | 1 → many | End-date membership |
| Client | ContractRepository | 1 → 1 current | Restrict deletion; preserve repository reference history if changed |
| TaxpayerEntity | RegistrationUnit | 1 → many | Restrict deletion; deactivate/close instead |
| RegistrationUnit | RegistrationSourceReference | 1 → many | Retain source metadata and verification history |
| RegistrationUnit | TaxProfileVersion | 1 → many | Restrict deletion; one active version only |
| RegistrationUnit | ExpectedCompliance | 1 → many | Supersede/cancel with reason; never erase |
| RegistrationUnit | ComplianceUniverseItem | 1 → many | Preserve coverage history; do not hard-delete generated gaps |
| TaxProfileVersion | TaxProfileOfficeContext | 1 → 0/1 | Restrict deletion; version is historical |
| TaxProfileVersion | TaxProfileFilingContext | 1 → 0/1 | Restrict deletion; version is historical |
| TaxProfileVersion | TaxProfileRegisteredTaxType | 1 → many | Retain source and effective dates |
| TaxProfileVersion | TaxProfileChangeEvent | 1 → many | Append-only |
| BIRRequirement | BIRRequirementVersion | 1 → many | Restrict deletion; versions are immutable |
| BIRRequirementVersion | RequirementVersionForm | 1 → many | Restrict deletion; preserve governed version |
| BIRRequirementVersion | RequirementComponent | 1 → many | Restrict deletion; preserve governed version |
| Rule | RuleVersion | 1 → many | Restrict deletion; versions are immutable |
| GeneratedWork | GeneratedWorkComponent | 1 → many | Restrict deletion after execution begins; close/supersede instead |
| GeneratedWork | ProcessStep | 1 → many | Restrict deletion after execution begins |
| GeneratedWork | GateAttempt | 1 → many | Append-only; failed/retried attempts remain |
| GeneratedWork | ChecklistUpdate | 1 → many | Append-only |
| GeneratedWork | Evidence | 1 → many | Append-only; documents remain in private repository |
| GeneratedWork | QAFinding | 1 → many | Retain finding and remediation history |
| GeneratedWork | ProcessingLog | 1 → many | Append-only; never delete through ordinary UI |
| GeneratedWork | PlatformAuditEvent | 1 → many | Append-only platform audit |
| GeneratedWork | PeriodLockEvent | 1 → many | Append-only |
| GeneratedWork | FilingEvidenceRegister projection | 1 → 0/1 current view | Derived from durable facts; never independently edited |
| GeneratedWork | ProcessingLog projection | 1 → many view rows | Derived from ProcessingLog; never independently edited |
| GeneratedWork | Work export | 1 → many generated files | Export artifact may be regenerated; source facts remain authoritative |
| GeneratedWork | QA findings | 1 → many | QA does not rewrite Engagement history |
| ProcessStep | GateAttempt | 1 → many | Append-only |
| ProcessStep | Evidence | 1 → many | Append-only |
| ProcessStep | ChecklistUpdate | 1 → many | Append-only |
| ProcessStep | ProcessingLog | 1 → many | Append-only |
| RequirementVersion | ExpectedCompliance | 1 → many | Preserve approved requirement context |
| RequirementVersion | GeneratedWork | 1 → many | Preserve version snapshot on work |

Relationship implementation rules:

- Use immutable primary keys and explicit lookups/foreign keys for every row above.
- Store the governing version, effective dates, and relevant display-name snapshots on historical work/log rows so later master-data changes do not rewrite history.
- Use restrict/delete-protect behavior for Client, Taxpayer Entity, Registration Unit, profile versions, requirements, work, evidence, and logs. Prefer inactive, closed, cancelled, or superseded states.
- A current projection may be rebuilt from durable source rows; it is never a second source of truth.
- A failed command must not leave a child row without its parent or a Processing Log event without the committed state change it describes.
- All child queries must enforce the caller's organization and record scope through the parent relationship; a lookup control is not an authorization boundary.

## 5. Two logical outputs, not two physical tables

The user-facing Work exports are two clean projections. Do not flatten the normalized operational model into two tables if that loses attempts, results, history, effective dates, or actor separation.

### 5.1 Filing Evidence Register projection

One row per selected return/package:

```
return_id
client_name
taxpayer_name
registration_unit_name
tin
rdo_or_bir_office
period
return_type
due_date
filing_date
filing_reference_number
payment_applicability
amount_to_pay
proceed_to_pay_or_equivalent
payment_amount
payment_date
payment_acknowledgement_date
payment_acknowledgement_reference
esubmission_reference_or_result
esubmission_submission_date
date_acknowledged_by_bir
date_validated_by_bir
attachment_names
sharepoint_reference
compliance_status
control_status
archived_at
```

### 5.2 Processing Log projection

One row per selected-return event:

```
event_id
return_id
event_type
stage
component
from_status
to_status
actor_id
actor_name_snapshot
actor_role_snapshot
accountable_owner_id
occurred_at
effective_date
reason
evidence_reference
command_id
ordinary_or_override
```

The export must filter by return_id and caller scope before serialization. It must never include other clients.

## 6. Status and workflow contract

### 6.1 Separate status dimensions

Keep these separate:

- blocker;
- RAG/risk;
- exception;
- component/process status;
- compliance completion;
- internal control completion;
- QA status;
- external result strength.

Required distinctions:

```
Filed ≠ Paid
Submitted ≠ Accepted
Payment initiated ≠ Payment confirmed
Compliance Complete ≠ Control Complete
```

### 6.2 Derived four-stage summary

The Work summary is always horizontal:

```
Filing → Payment → Attachments → Archiving
```

Rules:

- complete/satisfied uses a green check;
- Payment Not applicable is green/satisfied;
- N/A counts as satisfied;
- a completed return must not say 3 of 4 when one stage is satisfied as N/A;
- current stage is derived from outstanding applicable work;
- summary is not independently editable.

### 6.3 Ordinary journey

```
Preparation
  → Checking
  → Review
  → Return Client Approval
  → Filing/Submission
  → conditional Payment and/or Attachments
  → Archive/control completion
  → independent QA
```

Return Client Approval and Payment Client Approval are separate controls. Independent QA does not block statutory completion.

### 6.4 Payment

Payment applicability is:

```
required | not_applicable | unresolved
```

When required:

1. Preparer records the amount to pay while completing Draft return.
2. The saved amount becomes read-only in ordinary UI.
3. Controlled correction requires an authorized command, reason, and Processing Log entry.
4. Filing must be complete before payment can be in progress or complete.
5. Payment Client Approval is separate where required.
6. Payment confirmation requires amount and proof/result fields.
7. Payment acknowledgement/validation remains separate from initiation.

When not applicable:

- payment steps resolve to Not applicable;
- the stage is green/satisfied;
- no payment amount or fake proof is created;
- archiving does not require payment facts.

When unresolved:

- payment cannot be skipped;
- the UI shows an explicit unresolved state;
- the authorized resolver is shown.

### 6.5 Archive

Archive the return package is the final evidence-capture command. It opens an independent dialog/window, not a permanent duplicate gate.

It asks only for missing required facts:

- filing date;
- filing reference/FRN;
- eSubmission reference/result and submission date;
- BIR acknowledgment date;
- BIR validation date;
- payment amount/date/acknowledgment/reference if payment applies;
- attachment/evidence names;
- private SharePoint reference where required;
- archive confirmation.

Never display Not recorded merely because the form failed to request a field. A field is captured, explicitly not applicable, or explicitly unresolved with a reason.

### 6.6 Final control and override

Final certification is a separate controlled dialog available only to authorized Reviewer, Tax Team/Tax Control, HOD, or approved Admin capability.

Elevated Override is exceptional, reason-required, visibly marked, audited, and unable to fabricate an external fact.

## 7. Command contract

Every command must run as one authorized transaction or fail without partial mutation.

Validation pipeline:

```
authenticate
→ capability
→ organization/record scope
→ optimistic version
→ current state
→ prerequisites
→ actual-actor SoD
→ external result/evidence strength
→ ordinary vs override
→ idempotency key
→ commit facts + ProcessingLog event
```

Required commands:

| Command | Inputs | Preconditions | Durable writes |
|---|---|---|---|
| CreateManualWork | registration unit, return type, period, due/package target, payment applicability, optional amount, owner | authorized manual-work capability; effective assignment; valid period; non-negative amount | Work, steps/components, log |
| GenerateWork | approved universe, period, generation key | approved expected compliance; published calendar; unique generation key | Work, components, event |
| AssignWork | work, accountable owner, version, reason if exception | scoped active user; valid assignment; SoD | owner + log |
| SavePaymentApplicability | work, applicability, amount if required, route, version | valid choice; non-negative amount; unresolved cannot be skipped | work fact + evidence + log |
| TransitionProcessStep | work, step, target status, evidence/result, version, command id | valid status; prerequisites; filing before payment; amount before payment confirmation | step, attempt/evidence, log |
| RecordArchiveFacts | work, filing/payment/eSubmission/BIR/attachment fields, version | required facts; applicable components complete; authorized actor | evidence facts, archive state, log |
| CertifyFinalControl | work, role, result, reason if required, version | certification capability; SoD; complete facts | certification + log |
| RecordOverride | work/step, proposed action, reason, version | elevated capability; policy permits; no external fact fabrication | controlled state + log |
| RecordQAFinding | work, finding, severity, remediation | Tax Team/QA capability | QA finding + log |
| ExportReturnFacts | work id, format | scoped read permission | selected-return file |
| ExportReturnLog | work id, format | scoped read permission | selected-return file |

All commands return a durable identifier, current version, resulting projection, and human-readable next action. Do not report success based only on a client-side update.

## 8. Authorization and segregation of duties

Capabilities include:

```
ViewWork
EditPreparation
CompletePreparation
CompleteChecking
CompleteReview
ApproveReturnClient
RecordFiling
ApprovePayment
RecordPayment
VerifyEvidence
ArchiveReturn
CertifyFinalControl
OverrideControl
ViewProcessingLog
ExportReturnData
ManageClientProfile
ManageExpectedCompliance
ManageCalendar
ManageTeam
ManageAccess
PerformQA
ManagePeriodLock
```

| Role | Typical permissions |
|---|---|
| Preparer | preparation, Draft return, amount to pay, assigned execution, permitted evidence capture |
| Checker | checking and return-back; not own self-check |
| Reviewer | review, return client-approval control, final certification where authorized |
| HOD | governance, scoped approval, exception/override authority where policy permits |
| Tax Team/Tax Control | monitoring, calendar/control governance, QA, transaction review, period control |
| Admin | identity/configuration administration; not automatically tax authority |
| Master Admin | prototype combined authority only; still audited and cannot fabricate facts or erase history |

Actual actor and historical assignment govern SoD. Holding multiple capabilities does not permit self-check/self-review where a distinct actor is required.

## 9. Screen and route contract

Primary navigation label: Control Tower.

Workspaces:

```
/app/control-tower
/app/team
/app/clients
/app/clients/[clientId]
/app/work
/app/work/[workId]
/app/my-work
/app/calendar
/app/bir-center
/app/tax-team
/app/admin
/app/control-exceptions
```

### 9.1 Control Tower

Exception-first view:

- overdue/at-risk work;
- blockers and unresolved applicability;
- unassigned work;
- waiting handoffs;
- QA/control exceptions;
- due calendar/reconciliation state;
- scoped counts and trends.

No duplicate tracker or independent status store.

### 9.2 Team

Show roster, clusters/towers, access, career level, derived title, reports-to, effective dates, and history. Remove editable Operating title. Reports-to is a user dropdown filtered by band/scope. A non-standard line requires a reason.

### 9.3 Clients

Support manual setup even if a return was not in an existing planner. Preserve Client → Taxpayer Entity → Registration Unit. Capture TIN/RDO/profile facts only from authorized setup fields or approved source evidence.

### 9.4 Work queue

Support:

- all scoped clients/returns;
- filter to Mine;
- due/status/owner/RAG/exception filters;
- concise next action;
- quick navigation to one return;
- no duplicate planner.

### 9.5 Work detail

Header:

```
Client name
FY/period · return type · Due [date]
TIN [authorized] · RDO/BIR office [authorized]
```

Use the middle-dot separator consistently. Do not add unnecessary Head Office/RAG text beside the same context.

Return status:

- horizontal four-stage summary;
- Filing, Payment, Attachments, Archiving;
- N/A is green/satisfied and counted;
- current stage derived, not manually edited.

Next handoff:

```
NEXT HANDOFF · Waiting for Reviewer · [name] · [action]
```

Journey:

- journey table is primary;
- section headers Filing, Payment when applicable, Attachments, Archiving;
- short step names and status pills;
- current row highlighted;
- dates/actors available on detail or expanded row;
- do not repeat role labels on every row when the stage owner is obvious;
- long instructions are contextual help behind an information icon.

Global expand/collapse is one compact + or − control whose icon changes with the overall state. Final control is a separate authorized dialog. Archive actions are subtle and aligned with Transaction History at the bottom.

### 9.6 Payment UI

Amount to pay is defined during Draft return completion. After save/confirmation:

- show it as a compact fact in the Draft return row/detail;
- remove editable field borders;
- do not repeat a second amount input in Payment;
- corrections use a controlled command with reason/history;
- proof of payment and acknowledgment belong to Payment and persist durably.

### 9.7 Export controls

Use short labels only:

```
Report   Facts   Log
```

Do not use Download wording. Place controls subtly at the bottom beside Transaction History. Every export is selected-return scoped.

## 10. Archive report contract

Generate a one-page PDF when content permits, in this order:

1. factual filing/payment/eSubmission summary;
2. end-to-end journey with dates and responsible people;
3. simple role certification;
4. attachment/evidence names only.

Heading:

```
FILING, PAYMENT, AND ESUBMISSION
```

Facts:

- filing date;
- filing reference number/FRN;
- amount to pay;
- payment applicability;
- proceed to pay/equivalent;
- payment amount/date;
- payment acknowledgment date/reference;
- eSubmission reference/result;
- eSubmission submission date;
- date acknowledged by BIR;
- date validated by BIR;
- attachment/evidence names only;
- SharePoint reference where applicable.

Use Not applicable only when the approved setup says the fact does not apply. Use Unresolved only with an explicit unresolved reason. Never silently use Not recorded because the UI forgot to ask.

Journey rows use:

```
action · status · date · person/role
```

Certification appears at the bottom:

```
Preparer — [name] — [date]
Checker — [name] — [date]
Reviewer — [name] — [date]
Archive/control certifier — [name] — [date]
```

Do not include the internal transaction audit trail. Show attachment/evidence names only; do not embed documents.

## 11. CSV export contract

### Facts CSV

One selected-return row using the Filing Evidence Register projection. Use stable column names and ISO dates/timestamps. A required field may be blank only when an explicit unresolved status/reason is also present.

### Log CSV

Append every Processing Log event for the selected return only. Preserve event order by timestamp plus stable event id. Include actual actor, owner at event time, status transition, reason, evidence reference, command id, and ordinary/override marker.

### Security

The command receives a work id, resolves the caller, authorizes scope, queries only that work id, then serializes. Never export the queue or all clients from a detail-page button.

## 12. AI and assistant behavior

Copilot Studio may:

- answer questions grounded in approved records/knowledge;
- explain who is waiting for what;
- guide a permitted command;
- find a return within the user’s scope;
- summarize facts and exceptions;
- launch a controlled action or export.

Copilot Studio may not:

- decide uncertain tax treatment;
- invent filing/payment facts;
- infer access from title;
- mark external success without evidence/result;
- bypass a gate;
- change historical facts silently;
- reveal another client’s data;
- store core facts only in conversation memory.

If a response is unsupported by a durable record or approved tax source, say that it is unresolved.

## 13. Migration from the current repository

The source is a Next.js/TypeScript modular monolith with Supabase PostgreSQL/Auth/RLS/private storage. Preserve behavior, not framework names.

Current user-facing routes:

```
/app/control-tower
/app/team
/app/clients
/app/clients/[clientId]
/app/work
/app/work/[workId]
/app/my-work
/app/calendar
/app/bir-center
/app/tax-team
/app/admin
/app/control-exceptions
```

Current server boundaries:

```
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
/api/reports/tax-team
/api/tax-team/transaction-reviews
/api/temporary-2303/[documentId]
/api/temporary-2303/[documentId]/process
/api/registration-units/[registrationUnitId]/temporary-2303
/api/internal/purge-temporary-2303
```

Map source migrations into:

1. identity, organization, capabilities, scopes;
2. clients, taxpayer entities, registration units, assignments;
3. tax profile versions, source references, history;
4. tax foundation, BIR references, provenance, calendar;
5. expected compliance, deadlines, coverage, impact analysis;
6. generated work and materialized components;
7. process steps, gates, attempts, checklist updates, evidence, QA;
8. payment applicability/amount controls;
9. archive facts and report/export projections;
10. audit events and period locks.

Do not migrate browser/local state as authoritative. Reconcile prototype seed data as synthetic fixtures and label it as such.

Cutover sequence:

```
1. Create the Dataverse solution and tables.
2. Create relationships, choices, views, indexes, and security roles.
3. Import governed reference data only from approved sources.
4. Import sanitized client/team/profile/work data through an idempotent mapping job.
5. Validate row counts, stable ids, projections, owners, and scope.
6. Validate exports against selected-return scope.
7. Run acceptance, SoD, and security tests.
8. Run parallel read-only comparison with the source app.
9. Obtain domain-owner cutover approval.
10. Enable commands and retain source history/read-only access as agreed.
```

Never move real TINs, documents, credentials, or private links into preview/demo environments.

## 14. Sanitized fixture contract

Fixtures must be synthetic and clearly labelled. Provide these status permutations:

| Fixture | Purpose |
|---|---|
| Filing in progress | Preparation/checking/review handoff |
| Payment required | Amount captured in Draft return; payment pending |
| Payment not applicable | Green satisfied payment stage; overall count includes N/A |
| Attachments pending | Filing complete, attachment evidence outstanding |
| Payment proof pending | Initiation/confirmation distinction; proof persists after refresh |
| Archive facts missing | Archive dialog requests missing facts |
| Fully complete | All applicable facts captured; role dates and attachment names present |
| QA failed | QA finding/remediation separate from statutory completion |
| Unresolved applicability | Cannot skip payment; routes to authorized resolver |
| Manual work | Return created outside planner using registration-unit setup |

Fixtures must exercise different owners, role handoffs, scopes, career bands, and inactive users. No fixture should rely on an invented deadline unless labelled as an illustrative test fixture.

## 15. Acceptance and pressure tests

### Persistence

- Save status, refresh, retrieve the same value.
- Save from one session and read from another authorized session.
- Restart browser; facts remain.
- Payment proof remains after refresh/new session.
- Archive facts remain after report generation.
- Queue changes based on durable data, not browser state.

### Workflow

- Preparation, Checking, Review, and Return Client Approval precede Filing.
- Filing is complete before Payment can be in progress or complete.
- Required payment cannot be N/A.
- Unresolved payment applicability cannot be skipped.
- Payment confirmation requires amount and proof/result.
- Archive requires filing, applicable payment, and attachment/eSubmission prerequisites.
- A valid completion cannot remain stuck at In progress.
- N/A Payment is green and satisfies the four-stage summary.

### Facts and reports

- Draft return captures amount to pay.
- Amount is read-only after confirmation.
- Archive asks for missing filing date/reference, payment facts, eSubmission facts, BIR acknowledgment/validation dates, and attachment names.
- Facts appear at the top of the PDF.
- Journey dates and actual actors appear in the middle.
- Role certification appears at the bottom.
- Internal audit history is excluded from the PDF.

### Authorization and SoD

- Hidden UI commands are rejected server-side when unauthorized.
- Wrong scope cannot read a return, journey, facts, log, or export.
- Preparer cannot self-check/self-review when separation is required.
- Final control is unavailable to unauthorized users.
- Override requires elevated capability and reason.
- Admin does not automatically receive tax-control authority.

### Export

- Report, Facts, and Log are visible only where authorized.
- Each output contains only the selected return.
- Facts export has no unexplained required blanks.
- Log export contains actual actor and event date/time.
- PDF is one page when content permits and contains no technical audit dump.

### Team

- Operating title is not editable.
- Derived title follows the career-band mapping.
- Access profile remains independent.
- Reports-to lists active eligible next-band people.
- Non-standard reporting requires reason/history.

### UX pressure test

Ask a Preparer, Checker, Reviewer, Tax Team user, and HOD:

1. What do I do now?
2. Who is waiting for what?
3. What is blocking this return?
4. Is payment required, not applicable, or unresolved?
5. Where is the amount to pay?
6. Where are filing and BIR facts recorded?
7. Can I retrieve this five years later?
8. Will this export show only this return?

If any answer requires a technical audit log or duplicate tracker, simplify the projection, not the durable controls.

## 16. Build sequence

1. Foundation — Dataverse solution, environment, identity, tables, relationships, choices, audit, teams, security roles, and scope.
2. Client/profile — Client, Taxpayer Entity, Registration Unit, profile versions, source references, validation, effective dates, history.
3. Tax knowledge/calendar — governed masters, provenance, rules, deadline policies, monthly calendar lifecycle, unresolved states.
4. Work generation — Expected Compliance, idempotent generation, Generated Work, component materialization, assignments, Work queue.
5. Work execution — journey table, handoffs, preparation/checking/review/client approval, filing, payment, attachments, Archive dialog.
6. Evidence/exports — Filing Evidence Register, Processing Log, one-page report, Facts CSV, Log CSV, selected-return scope.
7. Team/QA — career/reporting model, access separation, Tax Team monitoring, QA findings, period controls, final certification dialog.
8. Copilot — grounded summaries, who-is-waiting-for-what, permitted commands, export launch, unresolved explanations, connector authentication.

Every slice needs positive and negative tests before the next slice. Do not build the assistant first and retrofit persistence later.

## 17. Definition of done

The rebuild is not complete until:

- the product boundary is preserved;
- the six workspaces use one operational truth;
- durable records survive refresh, session change, and deployment;
- commands validate scope, capability, prerequisites, SoD, and idempotency;
- the four-stage summary handles N/A correctly;
- payment amount is captured in Draft return and cannot silently drift;
- payment proof persists and separates initiation from confirmation;
- archive captures all required filing/payment/eSubmission/BIR/attachment facts;
- journey dates and actual actors are retained;
- role certification is simple and separate from internal audit;
- final control/override is a separate authorized dialog;
- Facts and Log exports are selected-return scoped;
- the PDF contains facts first, journey second, certification last, attachment names only;
- reports do not expose internal audit history;
- Team reporting/title/access logic is preserved;
- synthetic fixtures cover all status permutations;
- unauthorized access, RLS/scope, SoD, duplicate commands, stale updates, and unresolved tax facts are tested;
- the domain owner signs off the final platform mapping and cutover.

## 18. Traceability and confidence gate

No document can honestly guarantee 99.96% parity before the target platform is built and tested. This pack makes parity measurable rather than assumed.

The builder must produce a traceability matrix with one row for every requirement:

```
requirement_id
source_document_or_current_behavior
Dataverse table/view/action
Power Apps screen/control
Copilot topic/tool, if applicable
Power Automate/custom connector, if applicable
positive test
negative/security test
owner
status
evidence
```

The target is ready for domain review only when every row is mapped and every high-risk row has passing evidence. Any unmapped row is a visible implementation gap, not an implicit default.

## 19. Explicit exclusions

Do not add without separate approval:

- direct BIR filing integration;
- banking/payment execution;
- tax computation;
- replacement of Excel working papers;
- full SharePoint synchronization/DMS;
- Planner migration;
- rich notification orchestration;
- generic workflow builder;
- generic tax rules DSL;
- full tax-audit case management;
- autonomous tax interpretation;
- self-hosted AI;
- microservices, Redis, Kafka, Elasticsearch, Kubernetes, or a second database.

## 20. Final Copilot instruction

Build a durable, role-aware compliance control application with a quiet accountant-facing experience. Use Copilot Studio as an assistant layer, not as the source of truth. Preserve the two clean Work outputs—Filing Evidence Register and Processing Log—over a normalized relational model. Never trade away history, scope, actual-actor SoD, evidence strength, or unresolved-state visibility for a shorter demo.

## 21. Exact status, choice, and projection dictionary

The following values are implementation values, not free text. Dataverse Choice columns or constrained reference tables must preserve their meaning.

### 21.1 Payment applicability

Allowed values: required, not_applicable, unresolved.

### 21.2 Process status

Allowed stored values: not_started, in_progress, needs_attention, complete, not_applicable.

The prototype display projection uses DONE, IN_PROGRESS, NEEDS_ATTENTION, NOT_STARTED, and NOT_APPLICABLE. The target must choose one canonical stored vocabulary and map it once at the UI boundary.

### 21.3 Outcome state

Allowed values: on_time, late, not_due, not_started, in_progress, needs_attention, not_applicable, unverified.

Projection precedence is: needs_attention, then late, then unverified, then all applicable on_time/not_applicable, then in_progress, then not_due, then not_started.

### 21.4 Temporary 2303 document status

Allowed values: upload_pending, uploaded, processing_queued, failed, purge_eligible, purged.

Accepted content types are PDF, JPEG, PNG, and TIFF. The technical upload limit is 15 MiB. Validate filename length, byte size, idempotency key, source reference, source system, and file signature before storing bytes. Supported source systems are SharePoint, synthetic_fixture, and manual_reference. Non-production environments accept only synthetic_fixture uploads.

### 21.5 Team choices

Role keys: system_admin, leader, team_member, reviewer.

Operating models: engagement_agile, engagement_dedicated, tax_team.

Staff scope kinds: own_assigned_work, team_tower, cluster, cross_portfolio_tax_control, all_a_and_t.

Career levels: 5.2, 5.1, 4.2, 4.1, 3.2, 3.1, 2.2, 2.1. An existing source compatibility value 1.1 may be accepted only if the target organization explicitly retains it; it is not part of the approved displayed ladder.

## 22. Exact current API and command contracts

The Microsoft target may use Dataverse actions or flows instead of HTTP routes, but these request/response semantics must remain.

### 22.1 Work list

GET /api/work requires any of ViewAssignedWork, ViewScopedPortfolio, or ViewTaxControlHistory. It returns scoped generated-work projections, scoped monitoring projections, source metadata, and fixture-safety metadata.

POST /api/work requires MaintainGeneratedComplianceWork. Request fields are:

- clientId: stable client reference;
- title: approved requirement code;
- period: period label;
- deadline: optional text containing YYYY-MM-DD;
- paymentApplicability: required, not_applicable, or unresolved;
- paymentAmount: null or non-negative number;
- idempotencyKey: 8–128 character retry-safe key.

Payment amount is cleared when applicability is not_applicable. Generation failure must not leave a partial work package.

### 22.2 Work detail and commands

GET and POST /api/work/{workId} require a valid work id.

POST fields are command, idempotencyKey, and payload. Supported commands are checklist, gate_decision, payment_profile, process_status, final_certification, data_readiness, qa_finding, and period_lock.

Capability mapping:

| Command | Required capability |
|---|---|
| checklist, gate_decision, payment_profile, process_status, final_certification | ExecuteGeneratedComplianceWork |
| data_readiness | ExecuteGeneratedComplianceWork or MaintainGeneratedComplianceWork |
| qa_finding | PerformWorkQA, ValidateTaxProfile, or ViewTaxControlHistory |
| period_lock | ManageWorkPeriodLock or PerformElevatedOverride |

The handler validates work id, command, payload, capability, record scope, current version, prerequisites, actual-actor SoD, and idempotency before writing the result and Processing Log event.

### 22.3 Tax Profile

GET and POST /api/clients/{clientId}/profile require ReviewTaxProfile, ViewScopedPortfolio, MaintainClientRepository, or CorrectTaxProfile as applicable.

POST requires same-origin protection and a non-empty reason. Actions are validate, save, and save-and-validate.

Save payload fields are profile, assignment, effectiveFrom in YYYY-MM-DD format, and reason. Validate requires a saved version id. Controlled profile values are rejected before persistence when not approved.

### 22.4 Team profile

GET and POST /api/team require scoped portfolio or administration capability. Save payload fields are userId, organizationUnitId, effectiveFrom, careerServiceLevel, roleKey, operatingModel, active, reportsToUserId, and optional reportingLineExceptionReason.

The server derives title from careerServiceLevel. The client cannot submit an independent Operating title.

### 22.5 Temporary 2303 upload

POST /api/registration-units/{registrationUnitId}/temporary-2303 uses multipart form data with file, sourceReference, sourceSystem, and idempotencyKey.

The upload is private, retry-safe, signature-validated, and never becomes the permanent 2303 source. Processing is queued through POST /api/temporary-2303/{documentId}/process. Authorized retrieval is GET /api/temporary-2303/{documentId}, which returns a short-lived signed URL. Failed storage operations mark the document failed and never report success.

## 23. Exact workflow transition matrix

| Current context | Allowed ordinary next action | Required result |
|---|---|---|
| Preparation current | Preparer completes checklist/gate | Checking becomes current |
| Checking current | Checker completes or returns | Reviewer current, or Preparer correction |
| Review current | Reviewer completes or returns | Client approval current, or Preparer correction |
| Client approval current | Record client approval | Filing current |
| Filing current | Record filing/submission result | Payment or Attachments/Archiving becomes current according to applicability |
| Filing incomplete | Start/complete payment | Reject; filing must be complete first |
| Payment required, amount missing | Confirm payment | Reject; amount must be recorded in Draft return |
| Payment required, proof missing | Complete payment confirmation | Reject; proof/result required |
| Payment not applicable | Mark payment actions N/A | Green satisfied; no payment facts invented |
| eSubmission incomplete | Archive | Reject; submission/attachment prerequisite unresolved |
| Applicable payment incomplete | Archive | Reject; payment confirmation unresolved |
| Filing, applicable payment, and attachments complete | Archive | Open archive facts dialog and permit completion when required facts are present |
| Archive complete | Final control | Separate authorized certification dialog |
| Any ordinary gate | Elevated Override | Reject unless capability, policy, reason, and audit requirements pass |

Return-to-correction records returning role, reason, blocker, actor, and time. It never erases completed history.

## 24. Exact report-generation behavior

The one-page PDF is A4 or Letter sized when content fits. It uses a compact header, top facts, journey rows, bottom role certification, and attachment names only.

Facts are derived from selected durable Work and evidence records, never browser state. Display policy:

- Not applicable: only when approved applicability says it does not apply;
- Unresolved: required but not known, with an explicit reason;
- Not recorded: only for a genuinely optional fact or legacy record.

Do not show filler such as Prototype filing result recorded or Evidence verified when the actual fact is absent. Show the captured fact or a controlled unresolved state.

## 25. Exact monitoring and notification behavior

Monitoring remains a view over Work, not a second source or full duplicate module:

Tax team updates/plans monthly returns → system generates or accepts manual Work → owners update durable status → Tax Team monitors on refresh or on an hourly operating loop → exceptions and handoffs are resolved → loop continues until applicable work is cleared.

The global notification bell is a compact utility control. It shows only durable, scoped, actionable notifications: waiting for the current user, returned work, failed or unresolved filing/payment/evidence, reassignment, overdue/imminent scoped exception, and QA finding. Opening a notification navigates to the source record and marks only the notification read; it does not change Work state. It is not a generic email center or duplicate queue.

## 26. Exact environment and deployment contract

### Local/development

- synthetic data only;
- local or approved development database;
- no real TINs, documents, private links, or credentials;
- prototype/demo browser fixtures visibly labelled;
- browser fixture mode never treated as production persistence.

### Preview

- separate database, storage, and authentication from production;
- sanitized seed data only;
- no production service-role key;
- no production table/storage access;
- separate test account and redirect configuration.

### Production

- durable database and private storage;
- real authentication and role assignment;
- RLS/record-scope enforcement;
- backups/PITR and restore test;
- audit-retention policy;
- controlled migrations;
- no demo-seed reset;
- deployment approval and rollback plan.

Required configuration categories are database connection, public client configuration, server-only credential, authentication redirect URLs, storage buckets, SharePoint references, scheduled-job authorization, environment/data mode, and origin allowlist. Server-only credentials must never enter browser code, Copilot prompts, or exports.

## 27. Exact test inventory

The source repository contains test families for access/staff capabilities, audit trail and audit-read scope, BIR office reference, client CSV import/onboarding, deadline control/calendar, fixture integrity/prototype storage, live client/Team/Tax Team/Work adapters, manual work, profile persistence, temporary-document upload/signature/purge/lifecycle, work outcomes, workflow rules, workflow export/PDF, server authorization/request origin/API errors, migration contracts, scope, team reporting, and end-to-end app/settings flows.

The target must recreate behavior covered by these families, not merely visible screens. Translate each test into a traceability row with Power Apps, Dataverse, flow, Copilot, and positive/negative evidence.

## 28. Source-artifact manifest

Approved authority files:

00-PRODUCT-BRIEF.md; 00A-DECISION-REGISTER.md; 00B-DOMAIN-GLOSSARY.md; 01-DOMAIN-MODEL.md; 02-WORKFLOWS-CONTROLS.md; 03-RULES-DEADLINES.md; 04-RBAC.md; 05-UX-DESIGN-SYSTEM.md; 06-TECHNICAL-ARCHITECTURE.md; 07-V1-BUILD-PLAN.md.

Current user-facing routes:

/app/control-tower; /app/team; /app/clients; /app/clients/[clientId]; /app/work; /app/work/[workId]; /app/my-work; /app/calendar; /app/bir-center; /app/tax-team; /app/admin; /app/control-exceptions.

Current implementation domains:

access/capability; audit trail; client CSV/manual onboarding; client profile persistence; deadline control/calendar; tax foundation/BIR reference; temporary 2303 lifecycle; generated Work; workflow rules/state; work outcomes; report/PDF export; Team reporting/staff lifecycle; Tax Team reports/transaction review; period locks; fixture integrity/sanitized read model.

Current SQL migration groups:

identity/portfolio/repository; tax knowledge; calendar/BIR Center; temporary 2303; people/portfolio; Team structure; client profile history; provenance; BIR offices/contacts; contract repository; audit events; relational profile references; deadline publication/control; generated Work/components; Tax Team reviews; security hardening; fixture-supported requirements/components; onboarding controls; staff operating model; calendar imports/publication; period close/locks; checker tax-due gate; Preparer payment amount; Work evidence facts; authorized manual Work; Data Readiness; materialized requirement components.

## 29. Final completeness audit

Before handing this file to Copilot, the builder must record evidence for every row:

| Area | Pass condition |
|---|---|
| Product boundary | No tax computation, filing, payment, DMS, or generic workflow expansion |
| Source authority | Approved decisions and glossary are embedded or attached |
| Tables | Every durable entity has fields, keys, relationships, cardinality, retention, and source-of-truth rule |
| Choices | Status, role, scope, payment, document, and result values are constrained |
| Commands | Every mutation has payload, capability, scope, prerequisites, SoD, concurrency, idempotency, and result |
| Workflow | Positive, negative, retry, return, N/A, unresolved, failure, reopen, cancel, supersede, and lock cases are mapped |
| Evidence | Filing, payment, eSubmission, BIR acknowledgment/validation, attachment names, and archive facts persist |
| Actors | Owner, assignment snapshot, actual actor, signoff actor, and override actor are distinct |
| RBAC | Visibility, action, approval, governance, and override are separately mapped |
| UI | Six workspaces, responsive/accessibility rules, notification bell, and Work journey are mapped |
| Exports | PDF, Facts CSV, and Log CSV are selected-return scoped and durable |
| AI | Extraction and Copilot cannot invent facts or bypass commands |
| Environments | Local, preview, and production are separated |
| Fixtures | Required status permutations and handoffs are synthetic and represented |
| Tests | High-risk rules have positive, negative, authorization, persistence, concurrency, and recovery evidence |
| Cutover | Migration, reconciliation, approval, rollback, and five-year retrieval have an owner and test |

If any row is not Pass, the state is implementation gap, not an invented default.

## 30. Embedded approved source documents

This appendix is included so the handoff is standalone. The documents below remain the approved product/domain authority. Their domain rules, controls, terminology, and decisions must be preserved when translating the implementation to Power Apps, Dataverse, Power Automate, Copilot Studio, Entra, and SharePoint. Platform-specific examples in the source documents are implementation context, not permission to change the product boundary.

### Source: 00-PRODUCT-BRIEF.md

# TaxMonWeb Product Brief

## Purpose

TaxMonWeb is a Philippine tax-compliance monitoring and control system for TMF A&T. It gives the Engagement Team a dependable operating view of what must be prepared, checked, reviewed, approved, filed, paid, evidenced, and completed; it gives leadership a dependable view of what requires intervention.

TaxMonWeb controls and explains tax-compliance work. It does not compute tax, replace working papers or document management, file directly with BIR, execute bank payments, or become a generic workflow platform.

## Product promise

Set up once. Generate automatically. Manage by exception.

Automate what is deterministic. Flag what requires judgment.

## Frozen product spine

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA`

Generated Compliance Work is the work/control object created by TaxMonWeb. It does not mean that TaxMonWeb prepares or computes the tax return.

## Operating truth

One operational truth powers My Work, Control Tower, Clients, Team, Due Register, Calendar, and management views. The product preserves the distinction between lifecycle, RAG/risk, blockers, exceptions, evidence/control state, and QA.

## Experience principles

- Make normal work quiet and intervention visible.
- Keep the surface simple while preserving legal, operational, and control detail underneath.
- Every interaction must advance work, evidence a control, resolve an exception, or provide useful information.
- Unknown tax content remains unresolved; approved sources and effective-dated history are required for governed decisions.

## V1 shape

V1 is a managed/serverless-first Next.js/TypeScript modular monolith deployed primarily through Vercel and Supabase. The user-facing product is organized as six coherent workspaces:

1. **Control Tower** — what is happening and what needs intervention;
2. **Team** — who is delivering it;
3. **Clients** — who TMF is servicing;
4. **Work** — what work needs to move;
5. **BIR Center** — which governed BIR reference data TaxMonWeb relies on;
6. **Admin** — who may access or change the system, and what happened.

Each workspace has a compact landing view and focused submodules/tabs. Due Register and Calendar belong inside Work; Tax Team/QA and Super Admin are restricted capability views over the same records, not additional ordinary top-level workspaces.

Development follows a Lego approach rather than a fixed numbered-module sequence: build the smallest complete capability, connect it to the owning workspace and shared projections, add the required CRUD, authorization, effective history, and audit trail, then review and extend it. “Module 02” and the earlier sequential module order are retired delivery labels, not product boundaries.

Locked decisions in the Decision Register and approved domain, workflow, RBAC, UX, technical architecture, and build-plan documents take precedence over this concise restatement and over implementation convenience.


### Source: 00A-DECISION-REGISTER.md

# TaxMonWeb Decision Register

**Document:** 00A-DECISION-REGISTER.md  
**Product:** TaxMonWeb  
**Status:** Approved core-domain freeze / current workspace-Lego direction
**Purpose:** Record the product, domain, control, and architectural decisions that constrain the TaxMonWeb domain model.

This register is used with `00-PRODUCT-BRIEF.md` and `00B-DOMAIN-GLOSSARY.md`. It distinguishes decisions that are already accepted from configurable content, genuine domain questions, and intentionally deferred scope.

## Status meanings

- **LOCKED** — Accepted product or architectural direction. Dependent design must respect it.
- **CONFIGURABLE** — The mechanism is part of the product, but its approved values may vary by obligation, client, service scope, organization, or policy. Configuration must be versioned, authorized, and auditable where it affects control behavior.
- **NEEDS DOMAIN DECISION** — Unresolved and capable of materially changing the domain model, lifecycle, or control behavior.
- **DEFERRED** — Intentionally outside the current design or implementation stage.

Configurable tax content is not permission to invent Philippine tax rules, forms, filing requirements, deadlines, or interpretations. Unapproved tax content remains unresolved until supplied and approved by the domain owner.

## Locked decisions

| ID | Area | Decision | Domain consequence |
|---|---|---|---|
| L-001 | Product purpose | TaxMonWeb is an internal Philippine tax-compliance monitoring and control system. | The primary operational object is the Compliance Obligation, not a generic task. |
| L-002 | Product boundary | TaxMonWeb does not perform tax computation, replace working papers, replace SharePoint, file through BIR platforms, execute payments, or make autonomous tax decisions. | External systems remain authoritative for computation, documents, filing execution, and payment execution. |
| L-003 | Source-of-truth boundaries | TaxMonWeb is the control/status source of truth. SharePoint is the permanent document source of truth. Working papers remain the preparation/computation source. BIR and banking systems remain execution sources. | TaxMonWeb records controlled status, references, attestations, and evidence; it does not pretend to replace external systems. |
| L-004 | V1 OCR | BIR Form 2303 OCR/document extraction is included in the V1 prototype. | The setup domain must support document upload, extraction runs, confidence, review, correction, validation, and provenance. |
| L-005 | OCR safety | OCR cannot silently activate a Tax Profile, determine uncertain tax treatment, approve a Compliance Universe, or generate approved operational work. | Explicit human validation and approval gates are mandatory. |
| L-006 | OCR review experience | The intended setup flow is Upload 2303 → OCR/extraction → structured fields and confidence → side-by-side human review/correction → explicit validation → Tax Profile activation → Proposed Compliance Universe → authorized approval. | Low-confidence, missing, ambiguous, and conflicting fields must remain visible and correctable. |
| L-007 | OCR provenance | The system preserves source-document metadata, extraction-run information, extracted values, confidence, page provenance where available, corrections, validators, approvers, timestamps, and purge history. | Historical explanation remains possible after the temporary processing copy is purged. |
| L-008 | Temporary 2303 storage | TaxMonWeb may temporarily store an uploaded 2303 for OCR, review, correction, validation, and approval. It must not become the permanent 2303 repository. | Temporary storage is private and controlled; the source file is not stored in Git or the application repository. |
| L-009 | Permanent 2303 source | SharePoint remains the permanent authoritative document source for the 2303. A temporary copy must not be purged in a way that leaves TaxMonWeb without an authoritative SharePoint reference, unless an approved exception is recorded. | Structured provenance and a SharePoint reference remain after purge. |
| L-010 | Setup and operating spine | The canonical product spine is **BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA**. Source Information, Validated Tax Profile, Expected Compliance approval, and generation remain the setup path underneath this spine. | Generated Compliance Work is a compliance work/control object for an applicable requirement and period/event. TaxMonWeb does not prepare or compute the tax return itself. |
| L-011 | Client | A Client is the commercial/service relationship managed by TMF. | A Client is not itself the legal obligation anchor. |
| L-012 | Taxpayer Entity | A Taxpayer Entity is the Philippine legal taxpayer with its own TIN. | One Client may relate to multiple Taxpayer Entities. |
| L-013 | Registration Unit | A Registration Unit is the relevant BIR-registered head office or branch under a Taxpayer Entity. | A Compliance Obligation belongs to the legally relevant Registration Unit. |
| L-014 | Branch modeling | No separate Branch entity is introduced unless a concrete requirement demonstrates that Registration Unit cannot represent the needed information. | Branch-specific information is modeled within Registration Unit for V1. |
| L-015 | Cardinality | One Client may have multiple Taxpayer Entities. One Taxpayer Entity may have multiple Registration Units. | The domain must not collapse Client, Taxpayer Entity, and Registration Unit into one record. |
| L-016 | Service Scope | Service Scope is separate from legal applicability and represents whether TMF is responsible for handling or monitoring an otherwise applicable obligation. | Applicability and TMF responsibility cannot be inferred from one another. |
| L-017 | Compliance Universe | The Compliance Universe represents what TaxMonWeb believes the taxpayer is expected to comply with and the approved applicability/scope decision for each item. | The system can identify what should exist, not only what someone manually created. |
| L-018 | Simple universe UX | Accountants should experience the universe as Expected Compliance, with straightforward decisions such as Applicable — In TMF Scope, Applicable — Out of TMF Scope, Not Applicable — reason required, and Requires Review. | Internal versioning and history remain underneath the simple operating experience. |
| L-019 | Out-of-scope visibility | Applicable + Out of TMF Scope remains visible in the Compliance Universe for control and reconciliation. It does not generate normal recurring TMF delivery workflow. | Out-of-scope exposure is visible without creating TMF work as though it were in scope. |
| L-020 | Historical assignments | Assignments are effective-dated and historical. | Current ownership changes must not erase past accountability. |
| L-021 | Ownership snapshots | Generated obligations retain an ownership/accountability snapshot from generation. | Historical obligations remain explainable after later assignment changes. |
| L-022 | Simple reassignment | Authorized leadership may reassign open obligations. Reassignment is controlled and audited, without transfer-acceptance workflows, temporary delegation chains, or complex handover workflows in V1. | Open obligations may receive a new current accountable owner while prior actions remain attributable. |
| L-023 | Accountability versus actors | Accountable owner, current assignee, actual actor, signoff actor, and override actor are distinct concepts. | Completed actions and historical actors are never rewritten by current ownership changes. |
| L-024 | Completion | Compliance Complete and Control Complete are derived from applicable requirements and configured gates. Ordinary users cannot freely click Complete to bypass unresolved mandatory requirements. | Completion is a projection of controlled facts, not an arbitrary editable field. |
| L-025 | Lifecycle integrity | Generated obligations are not deleted to hide changes. Cancellation, supersession, reopening, and N/A decisions are controlled and auditable. | Historical records remain interpretable. |
| L-026 | User-facing components | The primary user-facing concepts remain Submission, Payment, Attachments, and Evidence/Proof. | The UX remains simple even when the underlying model preserves finer history. |
| L-027 | Underlying component detail | The domain may distinguish requirement, action/attempt, result, evidence, and signoff/verification where needed for integrity or history. | Separate domain objects are created only when they solve a real history, control, or data-integrity need. |
| L-028 | Segregation of duties | Where a Control Template requires all three internal stages, Preparer, Checker, and Reviewer must be distinct people. | The model supports genuine actor separation without assuming every obligation has identical stages. |
| L-029 | V1 control stages | For ordinary V1 return/submission work, Preparation → Checking → Review and Client Approval before Filing are mandatory controls. Control Templates retain future extensibility for other approved work types, but V1 does not make Checker, Reviewer, or pre-filing Client Approval optional. | Filing cannot ordinarily proceed without the required internal signoffs and recorded Client Approval. Any bypass requires Elevated Override governance. |
| L-030 | Exceptional bypass | A segregation or completion bypass requires an approved elevated override, reason, audit history, and visible exceptional treatment. | Overrides cannot look like ordinary completion. |
| L-031 | Rules and deadlines | Rules are configurable and versioned. Approved deadline policies determine deadline calculation and adjustment. | No tax rule or deadline is invented in application code. |
| L-032 | Holiday Master | Holidays/non-working days are maintained separately from client calendars. A holiday does not automatically move every deadline. | Deadline adjustment is governed by the applicable approved policy. |
| L-033 | Historical explanation | Historical obligations retain sufficient profile, universe, rule, calendar, holiday, deadline, and assignment references or snapshots to explain their state. | Future changes do not silently rewrite history. |
| L-034 | Tax Service Calendar | The annual Tax Service Calendar is a projection of the same obligations, deadlines, and service milestones. It is not an independent task database. | Manual planning exceptions may be retained without creating a competing source of truth. |
| L-035 | Tax Audit Mode | Tax Audit Mode is a cross-portfolio control/audit lens over existing records, not tax-assessment case management. | V1 does not create a separate audit-case domain. |
| L-036 | Architecture style | V1 is a modular monolith/single coherent application appropriate to 70+ users and 100+ clients. | Modules are clear domain boundaries, not separate microservices. |
| L-037 | Workflow complexity | V1 has no generic workflow builder and no generic tax-rule programming language. | Use explicit control templates and manageable structured rule strategies. |
| L-038 | Notifications | Exception visibility and dashboards are the first priority. Detailed notification behavior is not a major V1 module. | The core domain must not be shaped around email or notification orchestration. |
| L-039 | UX principle | Complexity may exist in the model, but accountants should see simple component summaries such as Filing — Filed, Payment — Awaiting confirmation, QAP — Submitted, Evidence — Verified. | Internal state machines remain behind progressive disclosure. |
| L-040 | Brand semantics | TMF-inspired brand red and operational overdue/risk red are separate semantic concepts and design tokens. | Branding cannot obscure status meaning. |
| L-041 | Golden scenarios | Representative golden scenarios will pressure-test the model without inventing tax rules or hardcoding the architecture around specific forms. | Scenarios validate domain behavior, not tax content. |
| L-042 | Documentation | `00A-DECISION-REGISTER.md` and `00B-DOMAIN-GLOSSARY.md` precede `01-DOMAIN-MODEL.md`. | Shared decisions and terminology are established before modeling. |
| L-043 | Access and visibility model | TaxMonWeb is one application with role-, permission-, and organizational-scope-aware views. Its six hierarchical business POVs are Preparer, Checker, Reviewer, Tower Leader/Supervisor, Cluster Leader, and HOD. | The POVs are not separate applications or independently designed dashboards. The conceptual visibility progression is My Work → Review/Control Queue → Tower → Cluster → All A&T. |
| L-044 | Cross-functional control mode | Tax Team/Tax Control is a cross-functional control mode, not a seventh hierarchical level. | Authorized RBAC may provide cross-portfolio Tax Profile/2303 review, Compliance Universe control, Rules Library and Holiday Master maintenance, exception review, evidence/control review, and Tax Audit Mode. |
| L-045 | System administration separation | System Administration is not a compliance POV. Administrative access to users, organization structure, authentication, or technical configuration does not automatically grant tax approval, override, review, or compliance-control authority. | Administrative authority and compliance authority remain separate capabilities. |
| L-046 | Visibility versus authority | Being able to see a record does not automatically permit editing, approving, reassigning, verifying, maintaining rules, or overriding. A user may have more than one applicable role or capability. | Exact action permissions are defined later in `04-RBAC.md`; job title alone is not the permission model. |
| L-047 | Compliance Universe approval (resolved D-001) | Compliance Universe approval occurs at Registration Unit level. The UI may support grouped review/approval at Taxpayer Entity or Client level, but each affected Registration Unit retains its own approval record. Cluster Leader may approve within organizational scope; Tax Team may approve as cross-portfolio tax-control authority; HOD has global/elevated approval authority. | A person should not independently approve their own proposed universe change where practicable. Exact capability mapping remains for `04-RBAC.md`; V1 does not require a universal two-person approval workflow. |
| L-048 | Compliance Universe change lifecycle (resolved D-002) | Approved universes are historically preserved. Changes are proposed deltas; approval creates a new approved internal snapshot. Future generation uses the approved result by default. Existing obligations are not silently changed. | Affected open obligations require controlled supersession, cancellation, reopening, or adjustment; completed obligations retain their original context. |
| L-049 | Compliance Obligation identity (resolved D-003) | The default obligation identity is Registration Unit + governed BIR Requirement Master version, plus an approved generation/execution configuration only when it adds meaningful behavior, plus Compliance Period + a narrowly governed Instance Type. Normal recurring obligations are the default. Amendment, correction, replacement, or related-instance types exist only where approved domain behavior requires them. | Obligation Definition is not a second legal master. If it adds no behavior beyond Requirement + Rules + Components, the requirement version is used directly. No generic catch-all instance mechanism is created; attempts, retries, acknowledgments, and evidence remain history under the obligation unless approved behavior requires a related instance. |
| L-050 | Compliance Period model (resolved D-004) | A Compliance Period is a simple structured value supporting approved period shapes without embedding tax-form assumptions. | The model can support monthly, quarterly, annual, fiscal, amended, corrected, or other approved periods through configuration and domain decisions. |
| L-051 | Profile/rule impact (resolved D-005) | New profile and rule versions apply prospectively by default. Completed obligations never change automatically. Open obligations do not silently recalculate; potential impacts become a reviewable change set. | Approved action may supersede, cancel, reopen, or adjust affected obligations while preserving original context. |
| L-052 | Open-obligation reassignment (resolved D-006) | Authorized leadership may reassign open obligations. Reassignment updates current accountability and appends an audited assignment event. | Prior ownership snapshots, actors, signoffs, completed stages, and history remain unchanged. V1 has no transfer acceptance, temporary delegation chain, or stage-by-stage handover workflow. |
| L-053 | Elevated Override policy (resolved D-007) | An ordinary controlled correction, reassignment, or reopening is distinct from an Elevated Override. An Elevated Override is an exceptional bypass of an internal control or gate, performed by Tax Team or HOD subject to RBAC, with mandatory reason, visible exceptional treatment, and full audit history. | An actor cannot use an override to bypass their own required control. No universal second-approver workflow is required in V1. An override may never fabricate an external compliance fact or change an unresolved legal requirement to Not Applicable. |
| L-054 | Overall completion convention | Compliance Complete and Control Complete remain separately visible derived states. Ordinary overall Complete is reserved for satisfaction of the applicable final control gates. | Legal/external completion cannot be mistaken for fully controlled operational completion. |
| L-055 | External-state evidence strength | A human assertion may support a configured reported state, but it cannot silently become accepted, confirmed, or verified without the configured external result or evidence. | External action, result, evidence, and verification remain distinct facts. |
| L-056 | Blocker/Risk/Exception separation | Blocker, Risk/RAG, and Exception are separate dimensions that may coexist. | Blocker explains impeded progression; Risk/RAG expresses timing exposure; Exception identifies unresolved, abnormal, conflicting, overridden, failed-generation, or otherwise non-standard conditions. |
| L-057 | Primary UX navigation label | The primary navigation label is Control Tower, not Home. | Leadership and operational entry points use the control-tower concept consistently. |
| L-058 | Extraction confidence policy | AI/document-extraction confidence thresholds are not hardcoded before benchmarking against representative sanitized 2303 samples. | Thresholds remain configurable and evidence-based rather than arbitrary implementation constants. |
| L-059 | Responsive UX priority | Mobile/tablet experiences prioritize monitoring, intervention, review, and safe actions rather than reproducing every dense desktop workflow. | Responsive design remains useful without forcing desktop complexity onto small screens. |
| L-060 | Ant identity | The attached TaxMonWeb ant remains the approved canonical product identity direction. | Production refinements may improve legibility and lockups but must preserve the underlying ant concept. |
| L-073 | Requirement versus component boundary | BIR Requirement Master is the canonical legal/control catalog. A related filing or submission receives its own Requirement ID only when it has an independently meaningful compliance identity: it can independently become due, overdue, applicable/non-applicable, or evidenced, or BIR governs it as a distinct submission. A separate form, file, or channel alone is not sufficient. | The default is one primary requirement with completion components such as filing, payment, attachment/schedule, electronic submission, and evidence. Related requirements remain linkable and may be presented as one package without creating unrelated Due Register rows. |
| L-074 | Obligation Definition boundary | Obligation Definition is not a second legal master. If retained, it is only generation/execution configuration referencing a BIR Requirement Master version. | There is one legal source of truth. If an implementation adds no behavior beyond Requirement + Rules + Components, it must merge/remove Obligation Definition rather than preserve an unnecessary abstraction. |
| L-075 | Regulatory issuance / authority | Regulatory provenance is a reusable governed concept, not repeated URL fields. It may represent Revenue Regulations, Revenue Memorandum Circulars/Orders, Revenue Administrative Orders, BIR calendars, forms/instructions, official advisories, proclamations/holiday authorities, and other authoritative issuances. | Requirement, Rule Version, form, calendar, holiday, and other governed records may cite multiple issuances with publication/effectivity/retrieval/verification metadata and page/section citations. |
| L-076 | Canonical tax masters | BIR forms, tax types, BIR jurisdictions/offices, filing/submission channels, eFPS groups, and requirement components are governed master records with stable IDs, effective dates, status, and provenance. | Tax Profiles and generated work reference canonical records; they do not store uncontrolled legal values as free text. |
| L-077 | Rule/profile impact decisions | Material changes detect impact, show affected future/open work, compare old and proposed context, and require an authorized decision before rebase/regeneration. Supported outcomes include Keep Existing, Rebase, Regenerate, Cancel, or Supersede. | Completed history is immutable except through governed correction/reopening. Every impact decision records actor, timestamp, reason, and old/new context. |
| L-078 | Coverage Integrity | Coverage Integrity is a derived projection across Expected → Generated → Executed → Evidenced. Gaps are detected as soon as sufficient information exists, but severity is state-aware and depends on timing, lifecycle, legal significance, and approved exceptions. | Coverage Integrity is not a second task/status system. Missing generation, execution, or evidence becomes the appropriate control exception or statutory exposure only when the approved context warrants it. |
| L-079 | Component deadlines and package target | A component may have its own statutory deadline while remaining inside the parent compliance package. The TMF Package Target is based on the earliest applicable statutory deadline that requires package action, subject to the approved working-day policy. | Primary and component statutory dates remain separately explainable; the package target never overwrites or disguises them. |
| L-080 | RDO/LTS master | BIR jurisdiction is one canonical office master with office type and parent Revenue Region context. It supports RDO, LTS/LT office types, and additional classifications where authoritative BIR research requires them. | Profiles reference the office record; codes, names, status, and effective dates are governed and sourced. |
| L-081 | eFPS group | eFPS group is governed, effective-dated controlled data associated with filing-channel/rule context. | Current groups are not hardcoded in application logic or entered as uncontrolled profile text. |
| L-082 | User-facing tax taxonomy | The operating taxonomy is CIT, VAT / Percentage Tax, WHT, and Others. | The legal taxonomy may remain richer and maps upward; awkward cases are surfaced for HOD review rather than invented. |
| L-083 | Authoritative-content boundary | Initial canonical tax content is researched against official BIR/government sources. The 2026 BIR Interactive Tax Calendar is a validation/reference dataset, not the sole deadline engine. | Unmapped, missing, superseded, or conflicting content remains explicitly unresolved and never becomes a fabricated rule or deadline. |
| L-084 | Explainability | Every generated requirement/work item and deadline must be able to explain its Requirement/Rule/Profile context, date calculation, adjustment, risk state, and cited authoritative source. | Explainability is a control requirement; source metadata is retained through versioning and historical snapshots. |
| L-061 | Data Readiness | Data Readiness is a prerequisite/control condition, not necessarily a sequential work step. It may be Not Ready or Ready with a blocker reason. | Execution begins with Preparation only when the required readiness condition is satisfied. |
| L-062 | Engagement lifecycle | The V1 Engagement lifecycle is Preparation → Checking → Review → Client Approval → Filing → Payment if applicable → Other Submissions if applicable → Complete. | Non-applicable stages are skipped; required components remain inside one Generated Compliance Work object. |
| L-063 | Payment approval | Payment approval is distinct from return/client approval. Where payment applies, Payment Prepared/Uploaded → Client Payment Approval → Payment Completion is separately controlled. | Return approval does not imply payment approval, initiation, or confirmation. |
| L-064 | TMF Package Target | The default TMF Package Target is completion of the entire applicable package one Philippine working day before the earliest applicable statutory deadline. | Component statutory deadlines remain unchanged and separately explainable. Governed exceptions change the internal target only. |
| L-065 | Internal versus statutory exposure | Missing a TMF Package Target is not automatically a statutory breach. | RAG/control projections must distinguish internal-target exposure, statutory exposure, package completion, and statutory deadline miss. Exact visual treatment remains a UX decision. |
| L-066 | Independent QA | QA is separate from Engagement completion and may occur later, including on a monthly or selected/risk-based cadence. | QA does not block filing or statutory completion. QA findings return to Engagement for RCA and remediation. |
| L-067 | QA failure and RCA | QA Pending may become QA Passed or QA Failed. QA Failed automatically requires Return to Engagement → RCA + Remediation → Re-QA until Passed. | Engagement Team owns RCA/remediation; Tax Team records findings and rechecks. |
| L-068 | QA measures | QA Completion % is reviewed selected population divided by selected population; QA Pass Rate % is passed reviews divided by completed QA reviews. | QA Completion primarily measures Tax Team execution. QA Pass Rate is an Engagement Team quality signal. They are never one generic QA percentage. |
| L-069 | Gamification scope | V1 gamification is a restrained Team/Tower-level “Race to All Clear.” Staff may see personal progress, but there is no public individual leaderboard in V1. | Tax Run Completion, RAG/risk, QA Completion, QA Pass Rate, and RCA/remediation remain separate measures. No numerical ranking formula is approved yet. |
| L-070 | 2550M classification | BIR Form 2550M is represented as Optional-practice / Conditional pending Tax Team reconciliation of current BIR content. It is not universally activated by default. | Client Compliance Profile may activate it where approved; activation does not misrepresent it as universally mandatory. |
| L-071 | Product/content completeness | Core product/domain completeness is independent from complete authoritative BIR-content coverage. | Missing calendar months, specialized requirements, DAT mapping, excise families, or other content gaps remain visible unresolved content work and do not block the core domain freeze. |
| L-072 | Numbered module sequence (superseded) | The earlier numbered module sequence is retired as a delivery model. | The decision is retained for history; current development follows L-103. |
| L-085 | Monthly calendar release | Each operational month is calculated and reconciled before a human approves and releases it for authoritative operations. Future months may remain provisional for forecasting and impact analysis. | Monthly calendar state is Draft → Under Review → Approved → Released. Provisional dates must not masquerade as released statutory deadlines. |
| L-086 | Monthly calendar maker-checker | Monthly calendar preparation and approval are separate capabilities. Tax Team prepares/reconciles; an authorized Tax Reviewer, Tax Lead, or HOD independently approves/releases. HOD is not a mandatory operational bottleneck. | The preparer cannot approve their own monthly release. The monthly version records actors, sources, reconciliation, and approval history. |
| L-087 | Monthly exception review | Row reconciliation is automated and review is by exception; matched source-backed rows may be reviewed collectively. | Changes, new requirements, mismatches, unresolved items, and affected deadlines receive focused review, while the monthly version still requires human approval/release. |
| L-088 | Partial calendar release | An unresolved item does not automatically block unrelated verified requirements. | Partial release is explicit, with the unresolved population conspicuous and unavailable for authoritative use until resolved. |
| L-089 | Released calendar immutability | A released monthly calendar version is immutable. A later authority creates a new version and controlled impact review. | Old/new dates, sources, reconciliation, release decision, and affected work remain historically inspectable. |
| L-090 | BIR Center | BIR Center is a future first-class reference/control surface over canonical governed data, not a second source of truth or a mirror of bir.gov.ph. | It may project requirements, approved calendars, holidays, offices, issuances, forms, and channels without duplicating their master records. |
| L-091 | BIR organizational reference | Office and officer information is distinct from regulatory truth and TMF tax-audit operational history. | Public/factual office and officer data are source-backed and verification-dated; case history links to them without rewriting identity history. |
| L-092 | BIR Officer Master | TaxMonWeb may maintain a minimal governed officer identity with factual role/contact/source/verification fields. | No subjective ratings, reputation, settlement propensity, or unsupported allegations are stored. |
| L-093 | Officer office assignment | Officer-to-office relationships are effective-dated and separate from officer identity. | Transfers do not rewrite historical case relationships; office, role, dates, source, and verification remain attributable. |
| L-094 | Tax Audit officer relationship | Future Tax Audit records may associate an officer with a documented case role and office-at-the-time. | This milestone creates only the identity/assignment relationship foundation, not full Tax Audit workflow. |
| L-095 | Knowledge completeness | Only approved, source-backed Requirement/Rule/Calendar versions may later generate authoritative compliance work. | Draft, Researching, Verified, Approved, and Superseded states remain visible; unresolved content fails visibly and safely. |
| L-096 | Reconciliation artifact and regression scenarios | Tax knowledge is inspectable through a development reconciliation matrix and deterministic fictional golden scenarios. | Tests prove requirement, period, dates, components, package target, provenance, release state, and explainability without inventing tax content. |
| L-097 | Lego-first People & Portfolio foundation | The first usable product Lego is a straightforward People & Portfolio Foundation: team members, organization structure, coarse operational role labels, client assignments, and derived portfolio load/coverage. | This slice is operational, not HRIS or gamification. Fine-grained capabilities, scope, actual-actor SoD, approvals, overrides, and tax workflow controls remain authoritative behind the simple experience and are added only when a later slice requires them. |
| L-098 | Career bands and org-chart signals | Career service level, operational role, organizational scope, and RBAC capability remain separate concepts. The Team Lego may show an effective-dated reporting hierarchy, RAG status, and derived workload signal, with approved photo slots and explicit unresolved labels. | A career band never grants authority. RAG/workload are operational projections, not editable performance scores. Unreadable chart labels remain unresolved until confirmed; no identity or photo is invented. |
| L-099 | Shared Team roster projection | Interactive org chart, Team directory, organization summaries, and member coverage must project from one effective-dated team roster and the same assignment/work records. Temporary fixture aliases may bridge legacy synthetic name-based assignments, but persisted commands must use stable member IDs. | A chart-only person must not silently become a second directory person. Assignment, workload, coverage, and drill-down must remain explainable from the shared roster projection. |
| L-100 | HOD Master Admin and calibration edit mode | HOD is the TaxMonWeb Master Admin for tax-control governance: global visibility, client/profile maintenance, approved intervention, governed configuration, and separately recorded Elevated Override authority. System Administration remains separate. During sanitized prototype calibration, all demo users may edit Client/Profile fixture context through an explicit temporary open-edit mode. | Master Admin cannot fabricate external facts or erase actor/SoD history. Calibration edits are browser-persisted fixture changes, not production authority, and the mode must be disabled before real client data is introduced. |
| L-101 | Contract Repository hierarchy | A Client has one Contract Repository. The repository contains a Master Engagement branch for MSA, LSA, and addendum records, plus an Additional Engagement branch for engagements outside the master engagement, represented by Change Request Forms. | Engagement versus Tax Ad Hoc is not a single Client attribute. Contract records are commercial-scope evidence and must remain separate from Tax Profile, Compliance Universe, and legal applicability. |
| L-102 | Super Admin authority | TaxMonWeb has an explicit Super Admin authority that may access all modules, data projections, technical administration and governed tax-control actions. This is a combined authority, not an implied consequence of holding System Admin or HOD access. | Super Admin actions remain capability-aware, audited, subject to effective scope where applicable, and cannot fabricate external filing/payment/acceptance/evidence facts, erase history, or erase actual-actor segregation-of-duties history. |
| L-103 | Workspace and Lego development | TaxMonWeb is developed and experienced through six coherent workspaces: Control Tower, Team, Clients, Work, BIR Center, and Admin. Each workspace has a compact dashboard/landing view and focused submodules or tabs. | Development has no fixed Module 01/Module 02 sequence. A Lego is the smallest complete capability that includes its owning projection, commands/queries, access boundary, history/audit behavior, and tests. Capabilities may be implemented in dependency order and connected across workspaces without creating duplicate truths. Due Register and Calendar are Work submodules; Tax Team/QA and Super Admin are restricted lenses over shared records. |
| L-104 | BIR Center reference access | BIR Center is a shared, read-only encyclopedia-style reference projection over governed BIR masters and office data. All authenticated users may view it; governance actions remain separately authorized. | BIR Center must not become a second source of truth, a rules editor, a calendar-release surface, an obligation generator, or an execution workspace. |
| L-105 | Deadline-rule boundary | Deadline rules, holiday adjustment policies, and calendar generation/reconciliation/release are governed in restricted Tax Configuration/Admin capabilities, not in BIR Center. | BIR Center may link to or explain released reference results, but normal users do not author or release deadline logic from it. |
| L-106 | Client-linked operational deadlines | A client’s candidate returns are derived from its approved registration/profile context and applicable Compliance Universe. The authorized Tax Team onboarding manager verifies the entered earliest applicable statutory date by saving it and publishes the operational deadline in the same action; only published rows feed the client Service Calendar and later compliance-work generation. | Base Statutory Deadline, Adjusted Statutory Deadline, Published Operational Deadline, and TMF Package Target remain distinct. A row without a usable statutory date cannot be published, and the client view never stores a competing deadline. The separate row-level source/date reconciliation gate is removed; actor, timestamp, reason, source context, and supersession history remain auditable. This does not change the existing independent monthly-calendar version release/maker-checker invariant or decide the final organizational publication authority. |

## Configurable decisions

These mechanisms are part of the product, but their approved values are maintained as configuration or governed master data.

| ID | Area | Configurable content |
|---|---|---|
| C-001 | Profile fields | Tax Profile fields, registration attributes, source-document fields, client contacts, POC information, and professionally determined attributes. |
| C-002 | OCR policy | Confidence thresholds, ambiguity/conflict flags, required review fields, extraction retry behavior, and field-level validation rules. |
| C-003 | Retention policy | Retention duration for temporary 2303 processing copies, subject to approved security and records policy. |
| C-004 | Storage controls | Private object/blob storage implementation, purge mechanism, encryption, access controls, and related technical controls. These are selected in `06-TECHNICAL-ARCHITECTURE.md`. |
| C-005 | Applicability | Approved criteria for deciding whether an obligation applies to a Taxpayer Entity or Registration Unit. |
| C-006 | Service Scope | Effective-dated TMF responsibility for an otherwise applicable obligation. |
| C-007 | Obligation catalog | Approved obligation definitions, frequencies, periods, and supported compliance characteristics. |
| C-008 | Component requirements | Whether Submission, Payment, Attachments, and Evidence/Proof are required, conditional, optional, or not applicable. |
| C-009 | Control Templates | Required operational details, signoffs, evidence verification, component requirements, and segregation-of-duties constraints. V1 ordinary return/submission work has locked Preparation, Checking, Review, and Client Approval before Filing gates; future approved work types may vary through governed templates. |
| C-010 | Deadline policies | Approved strategies for base statutory, adjusted statutory, TMF Package Target, component/milestone internal targets, service milestones, and component-level deadlines. |
| C-011 | Holiday Master | Approved holiday/non-working-day records, source references, jurisdiction metadata, and verification state. |
| C-012 | Holiday adjustment | Whether and how a particular approved deadline policy responds to a holiday or non-working day. |
| C-013 | Evidence requirements | Required evidence types, reference fields, verification expectations, and Control Complete implications. |
| C-014 | Completion gates | Conditions for Compliance Complete and Control Complete by obligation or Control Template. |
| C-015 | RAG and blockers | GREEN/AMBER/RED timing behavior, precedence, blocker categories, and explanatory reason codes. |
| C-016 | Status labels | Simple accountant-facing labels and mappings to underlying states, provided they do not hide unresolved controls. |
| C-017 | Organization | Teams, towers, clusters, hierarchy, and access scopes. |
| C-018 | External outcomes | Approved user-facing vocabulary for reported, submitted, acknowledged, accepted, rejected, failed, confirmed, and unverified outcomes. |
| C-019 | Source references | Required metadata for SharePoint, filing, payment, acknowledgment, approval, and other external references. |
| C-020 | Audit detail | Material event types and fields captured by the audit model, subject to the immutable-history principles. |
| C-021 | Client copy/transmittal | Whether client copy/transmittal is required, what evidence is needed, and which service arrangement or Control Template governs it. |

## Pre-domain decision phase

The pre-domain decision phase and core product/domain freeze are complete. The seven previously open model-shaping decisions D-001 through D-007 were renamed L-047 through L-053 and are locked as baseline decisions above. L-061 through L-072 incorporate the subsequent HOD operating delta.

Future documents may refine configuration values, role-capability mappings, approved tax content, and technical implementation details without reopening these architectural decisions unless a concrete control, data-integrity, or architectural contradiction is found.

## Deferred

| ID | Area | Deferred item |
|---|---|---|
| F-001 | Identity | Corporate Microsoft SSO implementation. The identity model remains SSO-ready. |
| F-002 | Integrations | Direct BIR/eFPS/eBIRForms/eSubmission integration. |
| F-003 | Payments | Direct banking or payment execution integration. |
| F-004 | Documents | Full document-management functionality or SharePoint replacement. |
| F-005 | SharePoint | Rich SharePoint API synchronization or automated document verification beyond the approved V1 reference/attestation model. |
| F-006 | Workflow | Generic workflow-builder functionality. |
| F-007 | Rules | Generic tax-rule programming language or arbitrary tax DSL. |
| F-008 | Delegation | Temporary delegation chains, transfer acceptance, and complex absence coverage. |
| F-009 | Timezones | Complex timezone arithmetic. |
| F-010 | Migration | Historical Teams Planner/task-history migration. |
| F-011 | AI | Autonomous tax interpretation, approval, filing, payment authorization, or closure. |
| F-012 | Audit | Full tax-assessment or tax-audit case management. |
| F-013 | Notifications | Rich email, escalation, digest, and notification orchestration. |
| F-014 | Platform | Microservices, external multi-tenant SaaS architecture, and infrastructure for thousands of enterprises. |
| F-015 | Technical choices | Final technology stack, physical schema, indexes, deployment architecture, backup design, and production security implementation. |
| F-016 | Visual details | Exact TMF colors and final production design tokens until approved references are available. |
| F-017 | Future scope | Broader BIR, registration, notice, assessment, onboarding, AI, and analytics modules. |

## Decision-register invariants

The following invariants apply unless a later approved decision explicitly changes them:

- OCR alone cannot activate a Tax Profile or approve a Compliance Universe.
- Low-confidence, missing, ambiguous, and conflicting extraction results remain visible for human review.
- A temporary 2303 copy is private, retained according to policy, and not stored in Git or the application source repository.
- SharePoint remains the permanent document source of truth.
- Applicable + Out of TMF Scope remains visible but does not create normal TMF delivery work.
- No generated obligation disappears without an auditable lifecycle decision.
- Current assignment changes do not rewrite completed accountability or historical actors.
- Ordinary users cannot bypass required completion gates through a normal status edit.
- Overrides are visible exceptions, not disguised completion.
- A calendar view cannot become a second operational tracker.
- No unapproved Philippine tax rule or deadline is invented by the application.
- Model sophistication must remain behind a simple accountant-facing operating experience.
- Hierarchical POVs are views over one application, not separate products or dashboards.
- Visibility and authority remain separate concepts.
- Tax Team/Tax Control and System Administration do not become implicit hierarchical levels.
- Super Admin is an explicit combined authority, not an implicit expansion of System Admin, HOD, or Tax Control.
- Blocker, Risk/RAG, and Exception remain separate dimensions and are not collapsed into one status.
- Data Readiness is separate from the Engagement lifecycle.
- Preparation, Checking, Review, and pre-filing Client Approval are mandatory V1 controls for ordinary return/submission work.
- Return Client Approval and Payment Client Approval are separate facts.
- TMF Package Target never overwrites a component statutory deadline.
- QA does not block statutory completion and QA Failure requires RCA and remediation.
- QA Completion % and QA Pass Rate % are separate measures.
- Generated Compliance Work does not mean TaxMonWeb prepares or computes the tax return.


### Source: 00B-DOMAIN-GLOSSARY.md

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

### Contract Repository

The commercial record container associated with a Client. It preserves the Client's master engagement records and additional engagements outside the master engagement.

Each Client has one Contract Repository in the approved model. It is commercial-scope evidence and is not a substitute for a Tax Profile, Compliance Universe, or legal applicability decision.

### Master Engagement

The primary engagement branch within a Contract Repository. It may contain MSA, LSA, and addendum records.

### Additional Engagement

An engagement recorded outside the Master Engagement within the same Contract Repository. A Change Request Form may evidence an Additional Engagement. Additional Engagement does not mean a new Client or Taxpayer Entity.

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

### Published Operational Deadline

The deadline that Tax Team has reviewed, confirmed, and released for operational use in TaxMonWeb.

It is a governed publication state over a calculated or source-reconciled statutory date, not a second legal date. Only a published operational deadline may feed client Service Calendar projections and later authoritative work generation. Its rule version, source context, review/publication actor, and publication history remain traceable.

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


### Source: 01-DOMAIN-MODEL.md

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


### Source: 02-WORKFLOWS-CONTROLS.md

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

## 31. Remaining approved source documents


### Source: 03-RULES-DEADLINES.md

# TaxMonWeb Rules and Deadlines

**Document:** 03-RULES-DEADLINES.md  
**Product:** TaxMonWeb  
**Status:** Approved rules/deadlines baseline / amended core-domain freeze  
**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`, `01-DOMAIN-MODEL.md`

This document defines how TaxMonWeb represents, governs, versions, and applies rules. It does not populate the product with Philippine tax content.

No Philippine filing deadline, holiday treatment, form requirement, attachment requirement, payment rule, or tax interpretation is asserted here. Those values must be supplied, reviewed, approved, and maintained as domain content.

## 1. Purpose and principles

TaxMonWeb should:

- determine what should exist from approved Tax Profile and Compliance Universe information;
- generate predictable recurring obligations automatically;
- calculate deterministic dates through finite, explainable strategies;
- preserve the reason and source for every calculated deadline;
- make unresolved rule content visible;
- avoid silently creating, suppressing, or changing compliance work;
- keep the accountant experience simpler than the underlying model.

The rules/calendar side of the canonical domain spine is:

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work`

Generated Compliance Work is the control/work object created for an activated requirement and period/event. TaxMonWeb does not calculate or prepare the tax return.

The governing principles are:

> Set up once. Generate automatically. Manage by exception.

> Automate what is deterministic. Flag what requires judgment.

## 2. Three kinds of rule and date content

TaxMonWeb must keep these concepts separate.

| Category | Meaning | Examples of responsibility | What it must not do |
|---|---|---|---|
| Tax/legal rule | What the approved Philippine compliance rule requires. | Applicability, required submission, legally required payment or attachment, statutory deadline, approved legal adjustment. | It must not be invented or inferred from a TMF internal target. |
| TMF control policy | An internal operating standard used to control delivery quality and risk. | One-Day-Before target, internal evidence gate, escalation threshold, internal review requirement. | It must not change or represent the statutory deadline. |
| Client/service planning milestone | An operational date used to manage delivery for a client and service team. | Client Data Target, Draft/Submission-to-Client Target, Client Approval Target, TMF Filing Target. | It must not be presented as a legal deadline. |

A deadline display should identify which category a date belongs to. A TMF target or client milestone must never silently overwrite a statutory date.

## 3. Rule architecture

The BIR Requirement Master is the sole legal/control catalog. BIR Form Master, Tax Type Master, BIR Jurisdiction / Office Master, Filing / Submission Channel Master, eFPS Group values, and Requirement Components are governed supporting masters. They must not become parallel legal sources.

Regulatory Issuance / Authority is a reusable provenance record. A requirement or Rule Version may cite multiple issuances and precise page/section references, with publication, effectivity, retrieval, verification, and supersession metadata. A repeated URL is not sufficient provenance.

Deadline rules, holiday adjustment policies, and calendar generation/reconciliation/release are restricted governed configuration capabilities. They do not belong in the shared BIR Center reference surface. BIR Center may expose source-backed reference information and released results, but it must not author or release deadline logic.

### 3.1 Obligation Definition

An Obligation Definition, if retained, is generation/execution configuration referencing a BIR Requirement Master version. It is not a second legal catalog. If it adds no behavior beyond Requirement + Rules + Components, it must be merged or removed.

It is responsible for:

- stable identifier and user-facing name;
- high-level description;
- supported lifecycle/instance characteristics;
- relationship to approved Control Templates and rule content;
- whether the definition is active for configuration purposes.

It is not responsible for:

- a client-specific applicability decision;
- a particular Compliance Period;
- a particular deadline date;
- current ownership;
- completion state;
- evidence for an operational instance.

### 3.2 Rule and Rule Version

A Rule is an approved policy category. A Rule Version is a specific, effective-dated, reviewable version of that policy.

Rule Versions are responsible for approved, structured content such as:

- applicability and generation behavior;
- frequency and period strategy;
- component requirements;
- statutory deadline strategy;
- approved statutory adjustment behavior;
- references to TMF control policies and service-planning policies;
- source/reference metadata;
- effective dates and review governance.

A Rule Version must not contain arbitrary executable logic. It is interpreted through a finite set of supported strategy types and validated parameters.

### 3.3 Rule content is typed and finite

The initial mechanism should support a manageable set of typed strategies rather than a generic rule language.

Examples of finite strategy categories include:

- approved profile-attribute applicability;
- explicit approved applicability decision;
- recurring calendar-period generation;
- recurring fiscal-period generation;
- approved annual or effective-period generation;
- fixed or period-anchored statutory date;
- approved offset from a period boundary;
- approved working-day adjustment;
- explicit no-adjustment policy;
- One-Day-Before internal target;
- milestone relative to an internal target or another approved date.

The exact available strategies are product capabilities. Approved tax content supplies their parameters. Users cannot create arbitrary formulas, scripts, expressions, or workflow graphs.

### 3.4 Rule package coherence

For an operational obligation, the system must be able to identify the compatible approved versions used for:

- applicability/generation;
- period generation;
- component requirements;
- statutory deadline;
- deadline adjustment;
- TMF Package Target and component/milestone internal targets;
- service milestones;
- Control Template.

These may be maintained as separate governed configurations, but generation must capture a coherent context. A partial or incompatible rule set must fail visibly rather than generate an unexplained obligation.

### 3.5 Requirement versus component test

A related filing or submission receives its own Requirement ID only when it has an independently meaningful compliance identity: it can independently become due, overdue, applicable/non-applicable, or evidenced, or BIR governs it as a distinct submission. A separate form, file, or electronic channel alone is not sufficient. Otherwise it remains a component of the parent requirement and must not create an unrelated Due Register row.

## 4. Applicability and Compliance Universe generation

### 4.1 Inputs

Applicability evaluation uses:

- Validated Tax Profile;
- effective-dated Registration Unit context;
- approved Obligation Definitions;
- applicable Rule Versions;
- approved Service Scope information;
- explicit human decisions where the rule requires professional judgment.

### 4.2 Output

Applicability evaluation produces Proposed Compliance Universe items, not immediate operational obligations.

Each item must support:

- Applicable — In TMF Scope;
- Applicable — Out of TMF Scope;
- Not Applicable — reason required;
- Requires Review / Unresolved.

The Compliance Universe answers:

> What should exist?

It is the control point for detecting an expected item that was not generated.

### 4.3 Applicability strategy behavior

The rule mechanism may support finite strategies such as:

- approved match against a configured Tax Profile attribute;
- approved match against a configured Tax Profile flag;
- approved explicit applicability decision;
- approved conditional requirement requiring a human decision;
- unresolved because required source or rule information is missing.

TaxMonWeb must not infer a tax treatment simply because a profile field is blank or because an obligation would be convenient to generate.

### 4.4 Service Scope is evaluated separately

Legal applicability and TMF responsibility are separate decisions.

An applicable item outside TMF scope remains in the Compliance Universe for reconciliation and visibility. It does not enter the normal TMF delivery workflow.

### 4.5 Missing applicability information

If required information is missing, ambiguous, or unresolved:

- the item remains Requires Review / Unresolved;
- the missing information is visible;
- no invented applicability decision is created;
- no normal operational obligation is silently generated or omitted;
- the item remains available for authorized human resolution.

## 5. Frequency and period-generation strategies

The generation mechanism produces approved Compliance Periods for eligible Universe Items.

### 5.1 Supported strategy shape

A period-generation strategy should identify:

- period basis, such as calendar or fiscal context;
- recurrence type, such as recurring or annual;
- period boundary inputs;
- effective start and end behavior;
- whether a special approved Instance Type is permitted.

The strategy produces Compliance Period values. It does not itself determine a legal deadline unless it references an approved Deadline Policy.

### 5.2 Normal recurring generation

Normal recurring obligations are the default.

Generation must be idempotent for the approved obligation identity:

```text
Registration Unit + governed BIR Requirement Master version + meaningful generation/execution configuration where present + Compliance Period + governed Instance Type
```

Repeated generation runs must not create duplicate normal obligations.

### 5.3 Exceptional instance types

Amendment, correction, replacement, or related-instance types are narrowly governed.

They may be used only when approved domain behavior requires them. TaxMonWeb must not offer a generic catch-all instance type merely to avoid making a domain decision.

## 6. Component-requirement rules

### 6.1 User-facing component concepts

The product continues to present:

- Submission;
- Payment;
- Attachments;
- Evidence/Proof.

### 6.2 Rule responsibilities

Approved component-requirement content determines:

- whether a component applies;
- whether it is mandatory, conditional, optional, or not required;
- what action/result is expected;
- what evidence or verification is required;
- which completion gate it affects;
- whether it has a separate deadline.

### 6.3 Payment conditionality

TaxMonWeb must not calculate tax payable merely to decide whether Payment applies.

Where payment applicability depends on an external calculation or professional determination, the rule should identify the required input or human decision. If that input is missing, the payment state remains unresolved rather than being assumed to be Not Applicable.

### 6.4 Attachments

An obligation may have multiple attachment requirements. Each requirement may have its own action, external result, evidence, and verification history where needed.

The rule architecture must not assume that every obligation has attachments.

### 4.2 Optional-practice requirements

The BIR Requirement Master may contain requirements whose activation is optional, conditional, or practice-dependent. BIR Form 2550M is currently represented as an optional/conditional practice pending Tax Team reconciliation of the current BIR content. It must not be activated for every VAT profile by default.

Once an optional practice is approved and activated in a Client Compliance Profile, it may generate normal recurring Generated Compliance Work. Activation does not change the requirement's legal classification for other taxpayers.

### 6.5 Evidence and control requirements

Evidence requirements may support:

- legal/external completion evidence;
- internal archiving or control evidence;
- client approval evidence;
- funding or payment evidence;
- submission acknowledgment evidence.

The rule or Control Template must distinguish what is required for Compliance Complete from what is required for Control Complete.

## 7. Deadline model

### 7.1 Date chain

Where applicable, the date chain is:

```text
Base Statutory Deadline
  → Adjusted Statutory Deadline
  → TMF Package Target
  → Client/service planning milestones
```

These are related but distinct facts.

### 7.2 Base Statutory Deadline

The Base Statutory Deadline is determined by an approved tax/legal Deadline Policy.

Supported structured strategies may include:

- an approved source-provided date;
- a fixed date relative to an approved period context;
- an approved offset from a period boundary;
- another explicitly supported finite strategy.

No specific date or formula is asserted in this document.

The base date must not be replaced by the TMF target or a client milestone.

### 7.3 Adjusted Statutory Deadline

The Adjusted Statutory Deadline is produced only when the applicable approved tax/legal rule permits an adjustment.

The calculation must identify:

- the base date;
- the applicable adjustment policy;
- the relevant Holiday Master or non-working-day context;
- the adjustment result;
- the reason and source reference.

A holiday, weekend, or non-working day does not automatically move every statutory deadline.

### 7.4 TMF Package Target

The TMF Package Target is the primary package-level internal control date. It is not a statutory deadline.

The default TMF policy is the One-Day-Before target:

> Complete the entire applicable compliance package one Philippine working day before the earliest applicable statutory deadline, subject to approved exceptions.

The package-target calculation may use a configured Philippine working-day calendar for operational planning. This use of working days must not alter any component statutory deadline.

If the package target cannot be calculated because an adjusted deadline or working-day context is unresolved, the system must show an unresolved target rather than silently using a calendar-day approximation.

Component-level or milestone-specific TMF Internal Targets may exist where approved, but they remain distinct from the TMF Package Target.

### 7.4A Published Operational Deadline

The system-calculated Base Statutory Deadline and Adjusted Statutory Deadline remain distinct date fields. For the Deadline Control surface, the authorized Tax Team onboarding manager verifies the applicable date by entering/saving the earliest applicable statutory date and using Save and Publish. The Published Operational Deadline is the released projection used by client Service Calendars and, once all other generation gates are satisfied, downstream compliance work.

Publication must retain the rule/version, source/provenance, date explanation, actor, timestamp, reason, and any amendment or supersession history. A row without a usable statutory date remains unavailable for authoritative client use. The separate row-level source/date reconciliation gate is not required after the onboarding manager verifies the date. Publishing never collapses the statutory date into the TMF Package Target; the package target remains the one-Philippine-working-day-before internal control date. The separate monthly calendar version lifecycle remains governed by its approved release controls.

### 7.5 One-Day-Before exceptions

Exceptions may be approved for reasons such as:

- an obligation-specific operating requirement;
- an approved client/service arrangement;
- a component with a different internal lead time;
- a deadline that leaves no practical internal working day;
- an approved operational risk response.

An exception changes the TMF Package Target or another internal target, not the statutory deadline. It requires an authorized actor, reason, timestamp, and audit history.

An internal-target exception is not an Elevated Override unless it also bypasses an internal control gate.

### 7.6 Client and service milestones

The following are planning milestones, not legal deadlines:

- Client Data Target;
- Draft/Submission-to-Client Target;
- Client Approval Target;
- TMF Filing Target.

Milestones may be calculated relative to:

- the TMF Package Target or another approved internal target;
- the Adjusted Statutory Deadline;
- another approved milestone;
- an approved client/service lead-time policy.

They must be stored or projected with their category and calculation explanation so users cannot mistake them for statutory dates.

### 7.7 Component-level deadlines

Component-level deadlines are optional.

They should be configured only where a component genuinely requires a separate timing expectation. If no separate deadline exists, the component may inherit the relevant obligation-level target or deadline according to approved configuration.

An inherited date must remain distinguishable from an independently calculated component date.

## 8. Holiday Master and non-working days

### 8.1 Holiday Master responsibility

The Holiday Master is a separate governed dataset containing approved date and source metadata, such as:

- date;
- name;
- type;
- jurisdiction or calendar applicability;
- source/reference;
- verification status;
- effective context.

It is not copied into individual client calendars.

### 8.2 Separate legal and internal uses

The same Holiday Master may provide date information to different policies, but the policies remain separate:

- a tax/legal Deadline Policy decides whether a statutory date is adjusted;
- a TMF working-day policy decides how an internal target counts working days;
- a client/service policy decides how operational milestones are planned.

One policy must not inherit the behavior of another merely because both reference a holiday date.

### 8.3 Missing holiday information

If a deadline policy requires Holiday Master information and the relevant date or calendar context is missing or unresolved:

- the calculation is unresolved;
- the system displays the missing input;
- the system does not assume the day is working or non-working;
- no statutory date is silently moved;
- no internal target is silently approximated.

## 9. Deadline calculation provenance

Every calculated or approved deadline should be explainable through a calculation record or equivalent historical snapshot containing:

- Registration Unit;
- Compliance Obligation and component where relevant;
- Compliance Period;
- deadline category;
- input date(s);
- applied Rule Version or Deadline Policy;
- Holiday Master context where relevant;
- strategy type;
- parameters used by that finite strategy;
- resulting date or unresolved state;
- calculation timestamp;
- exception or manual-adjustment reference where applicable;
- approving or authorizing actor where human approval was required.

The accountant-facing experience may show a concise explanation such as:

> TMF Target: one Philippine working day before the adjusted statutory deadline.

The detailed explanation should be available progressively when a user needs to audit or challenge the result.

## 10. Manual approved exceptions

Manual exceptions are not free-form edits to a deadline.

### 10.1 Planning exception

A Planning Exception changes a TMF Package Target, another TMF Internal Target, or a service milestone for an approved operational reason.

It does not change the Base Statutory Deadline or Adjusted Statutory Deadline.

### 10.2 Legal deadline exception

A Legal Deadline Exception represents an approved external/legal deadline change supported by an approved source or domain-owner determination.

It must preserve:

- original calculated date;
- new approved date;
- source/reference;
- reason;
- authorizing actor;
- timestamp;
- affected rule or obligation context.

It is not created merely because the application cannot calculate a date.

### 10.3 Control override distinction

An Elevated Override bypasses an internal control or gate. It does not replace the appropriate rule, applicability, scope, or deadline-exception process and cannot fabricate an external filing, payment, acceptance, or legal applicability fact.

## 11. Effective dating and versioning

### 11.1 Rule lifecycle

Rule content should support governed states such as:

- Draft;
- Under Review;
- Approved;
- Active;
- Retired;
- Superseded.

Exact labels are configurable, but an unapproved version must not drive normal generation.

### 11.2 Rule Version metadata

An approved Rule Version should preserve:

- Obligation Definition or policy category;
- version identity;
- effective-from and effective-to context where applicable;
- publication/activation timestamp;
- source/reference;
- summary of change;
- maintained-by;
- reviewed-by;
- approved-by;
- last-reviewed date;
- superseded/replaced relationship where applicable.

### 11.3 Prospective changes

New Rule Versions apply prospectively by default.

Historical obligations retain the Rule Version and deadline context used when they were generated. A future rule must not silently rewrite historical deadlines, applicability, components, or completion facts.

## 12. Impact analysis for open obligations

When a new Rule Version, Holiday Master version, Deadline Policy, or related configuration becomes effective, TaxMonWeb should identify potentially affected open obligations.

The impact review may classify each affected obligation as:

- no operational impact;
- future calculation only;
- deadline potentially changed;
- component requirement potentially changed;
- applicability or scope potentially changed;
- manual review required;
- configuration conflict.

The system must not silently recalculate open obligations.

An authorized user may approve the appropriate action, such as:

- retain the existing generated context;
- apply a new prospective calculation;
- supersede the obligation;
- cancel it with reason;
- reopen it under controlled authority;
- update an open operational date through an approved exception.

Completed obligations are not recalculated by a new Rule Version.

## 13. Rule approval and governance

The Tax Team is the normal maintainer of the Rules Library and Holiday Master. HOD has elevated authority.

Rule governance should require:

- an approved source or domain-owner reference;
- clear ownership;
- review status;
- effective date;
- change summary;
- impact assessment where existing obligations may be affected;
- approval history;
- retirement or supersession handling.

Where practicable, the person who prepares a material rule change should not be the only person approving it. V1 does not require a universal two-person rule-authoring workflow unless later governance policy requires one.

Rule maintenance authority is separate from System Administration authority.

## 14. Validation and unresolved-rule behavior

The system must fail visibly when required approved content is missing, invalid, contradictory, or unresolved.

### 14.1 Missing applicability content

Keep the Universe Item in Requires Review / Unresolved. Do not infer applicability and do not silently omit the item.

### 14.2 Missing obligation-generation content

Do not create a normal recurring obligation if the system cannot identify the approved BIR Requirement Master version, any required generation/execution configuration, or a supported period-generation strategy. Record a visible configuration/generation exception against the expected item.

### 14.3 Missing component content

Do not assume Payment, Attachments, or Evidence/Proof is or is not required. Keep the affected item unresolved until approved component configuration exists.

### 14.4 Missing deadline content

Do not invent a statutory date, adjustment, internal target, or milestone.

If the obligation identity and applicability are known but a required deadline policy is unresolved, the system may create a visible operational exception or unresolved obligation state only if that state cannot be mistaken for a valid dated obligation. It must not present a fabricated date or silently classify the obligation as safe.

### 14.5 Contradictory content

Examples include:

- two active rule versions with overlapping effective scope and incompatible outcomes;
- a component marked both required and not required without an approved precedence rule;
- a deadline policy referencing a missing Holiday Master context;
- a service milestone that requires an unavailable anchor date;
- an Instance Type not approved for the Obligation Definition.

The system should block affected generation or calculation, identify the conflict, and route it for authorized resolution.

## 15. Illustrative model examples

These examples demonstrate model behavior only. They do not assert any Philippine tax content.

### Example A — Ordinary recurring generation

An approved Obligation Definition has an approved recurring period strategy and an applicability decision of Applicable — In TMF Scope.

The generator creates one obligation per approved Compliance Period, using the compatible Rule Version and assignment context. Re-running generation does not duplicate the obligation.

### Example B — No-payment obligation

An approved component policy states that Payment is not required for a particular configured obligation scenario.

The generated obligation has no unresolved Payment requirement. It does not wait for payment and does not fabricate a payment result.

### Example C — Holiday adjustment permitted

An approved tax/legal Deadline Policy permits adjustment when the calculated base date falls on a date classified as non-working by the relevant approved calendar.

The system consults the Holiday Master, records the policy and calendar version, calculates the adjusted date, and explains the adjustment.

No specific holiday or legal adjustment rule is asserted.

### Example D — Holiday adjustment not permitted

An approved tax/legal Deadline Policy does not permit adjustment for a particular obligation.

The Adjusted Statutory Deadline remains equal to the Base Statutory Deadline even if the date appears in the Holiday Master. The system explains that no adjustment policy applied.

### Example E — One-Day-Before target

An approved Adjusted Statutory Deadline is available. The TMF control policy selects the previous Philippine working day as the internal target.

If the immediately preceding date is a working day, it is selected. If preceding dates are non-working under the approved internal working-day policy, the system selects the prior working day. This changes only the TMF Package Target or another internal target; it does not change the statutory deadline.

### Example F — Overseas POC timing risk

The client POC location is outside the Philippines and an approved operational risk policy identifies possible approval lead-time risk.

TaxMonWeb flags the timing risk for attention. It does not perform complex timezone arithmetic, change Philippine statutory dates, or silently move the client milestone.

### Example G — Future rule change

An approved Rule Version becomes effective for future periods.

Future generation uses the new version. Historical obligations retain the old version and calculated dates.

### Example H — Potential open-obligation impact

An approved rule change may affect an already-generated open obligation.

TaxMonWeb identifies it for impact review. It does not silently recalculate the deadline or requirements. An authorized user chooses the approved controlled action.

### Example I — Missing rule configuration

An Approved Compliance Universe contains an in-scope item, but the required Obligation Definition or Deadline Policy is missing.

TaxMonWeb does not invent the definition or deadline. It keeps the expected item visible, records a configuration/generation exception, and surfaces the issue for Tax Team or other authorized resolution.

## 16. Pressure test against the Domain Model

The approved Domain Model supports this rules architecture without material redesign.

The support comes from:

- a governed Requirement Master version being separate from generated Compliance Work;
- Rule Versions being approved, effective-dated configuration;
- Compliance Universe being the answer to what should exist;
- generated obligations retaining rule, profile, universe, deadline, holiday, and assignment context;
- component requirements being distinct from actions, results, evidence, and signoffs;
- derived completion and RAG states remaining separate from stored facts;
- controlled lifecycle events supporting supersession, cancellation, reopening, and exceptions.

One implementation caution is explicit rather than contradictory: the Domain Model says an unresolved Universe Item does not generate normal in-scope workflow. This document therefore treats missing required tax content as a visible Universe/configuration exception, not as a fabricated normal obligation. If the product later requires an unresolved placeholder obligation for reporting, that should be an explicit domain decision rather than an accidental side effect.

No contradiction requiring a change to `01-DOMAIN-MODEL.md` was discovered.

## 17. Coverage Integrity and change impact

Coverage Integrity is a derived reconciliation projection:

```text
Expected → Generated → Executed → Evidenced
```

The system detects a missing transition as soon as approved context is sufficient to know it exists. It then classifies severity using lifecycle state, TMF Package Target, statutory dates, legal significance, and approved exception/waiver context. Detection alone does not make ordinary open work RED.

Material changes to a Rule Version, Regulatory Issuance / Authority interpretation, Tax Profile, Compliance Universe, Service Scope, or related deadline configuration follow this sequence:

1. detect potentially affected future and open work;
2. show old and proposed context and the source/version difference;
3. require an authorized decision;
4. apply Keep Existing, Rebase, Regenerate, Cancel, or Supersede only when approved;
5. preserve actor, timestamp, reason, old/new context, and resulting history.

Completed work is not silently rewritten. Coverage Integrity and impact analysis are control projections/records, not parallel task stores or generic workflow engines.

## 18. Monthly calendar governance

Each operational month has a governed Monthly Calendar Version. Calculation may run automatically, but authoritative operational release follows:

```text
Generate → Reconcile → Human Review → Approve → Release
```

The monthly version is Draft, Under Review, Approved, or Released. Row-level reconciliation should surface changes, new requirements, new issuances, mismatches, unresolved interpretations, and affected deadlines rather than require clerical confirmation of every matched row. The version itself always requires independent human approval/release; the preparer cannot approve their own release.

Partial release is allowed where approved governance permits it. Unresolved or mismatched populations remain explicit and unavailable for authoritative use; they never receive a fabricated deadline. A released version is immutable. A later authority creates a new version and impact review rather than silently overwriting the old month.

The calendar comparison vocabulary is:

- `MATCH` — generated and published dates reconcile;
- `EXPLAINED DIFFERENCE` — a documented source, adjustment, or applicability difference explains the result;
- `UNRESOLVED MISMATCH` — the comparison needs Tax Team resolution;
- `NOT COMPARABLE` — the published row lacks enough compatible structure for comparison.


### Source: 04-RBAC.md

# TaxMonWeb Role-Based Access Control

**Document:** 04-RBAC.md  
**Product:** TaxMonWeb  
**Status:** Approved conceptual RBAC baseline / amended core-domain freeze  
**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS-CONTROLS.md`, `03-RULES-DEADLINES.md`

This document defines the business concepts and permission boundaries for TaxMonWeb. It is not a Supabase RLS policy, JWT claim design, database schema, SQL script, API contract, authentication implementation, or screen design.

## 1. RBAC purpose

TaxMonWeb access must answer two separate questions:

1. What may this user see?
2. What may this user do?

The product must not infer authority from visibility or from job title alone.

The RBAC model applies:

> Visibility and authority are separate.

> A user may hold more than one capability.

> Scope limits every capability.

> Segregation of duties is checked against actual actors and history.

Ordinary accountant work should remain simple. Users should see the work and controls relevant to them without navigating multiple role-specific applications or managing permission abstractions directly.

## 2. Five authority dimensions

### 2.1 Visibility

The records, fields, queues, configuration, or audit history a user may see.

Visibility may be limited by:

- organizational scope;
- record relationship;
- sensitivity policy;
- cross-portfolio control mode;
- administrative scope.

Visibility does not grant edit, approval, governance, or override authority.

### 2.2 Action authority

Permission to perform operational actions, such as:

- record preparation progress;
- record an external result;
- add evidence;
- create or clear a blocker;
- update current accountability through reassignment;
- reopen or cancel through an ordinary controlled process.

Action authority is constrained by applicable Control Template, component, stage, assignment, and scope.

### 2.3 Approval authority

Permission to approve or sign off a business decision or control gate, such as:

- Tax Profile validation;
- Compliance Universe approval;
- checking;
- review;
- client-approval recording where authorized;
- evidence verification.

Approval authority is distinct from the ability to perform the underlying work.

### 2.4 Governance authority

Permission to maintain or approve governed configuration, such as:

- Rules Library;
- Holiday Master;
- Control Templates;
- Service Scope configuration;
- organizational access configuration.

Governance authority is not automatically granted by broad operational visibility.

### 2.5 Override authority

Exceptional authority to bypass an authorized internal control or gate.

Override authority is separately assigned, narrowly scoped, reason-required, fully audited, and cannot fabricate an external filing, payment, acceptance, confirmation, or legal applicability fact.

## 3. Hierarchical business POVs

TaxMonWeb is one application with views shaped by capabilities and organizational scope.

The six hierarchical business POVs are:

```text
Preparer
  → Checker
  → Reviewer
  → Tower Leader / Supervisor
  → Cluster Leader
  → HOD
```

The conceptual visibility progression is:

```text
My Work → Review/Control Queue → Tower → Cluster → All A&T
```

These are not six separate applications, permission bundles, or independently designed dashboards.

### 3.1 Preparer POV

Focused on assigned preparation work and required preparation actions.

Preparer POV does not automatically grant profile setup, universe approval, review, governance, or override authority.

### 3.2 Checker POV

Focused on assigned checking work and relevant preparer work within authorized scope.

Checker visibility does not allow a user to check their own preparation.

### 3.3 Reviewer POV

Focused on assigned review and control work within authorized scope.

Reviewer visibility does not automatically grant rule maintenance, universe approval, or override authority.

### 3.4 Tower Leader / Supervisor POV

Focused on the authorized Tower/Team portfolio, management exceptions, and approved operational interventions.

Tower scope does not automatically grant global or cross-portfolio governance authority.

### 3.5 Cluster Leader POV

Focused on the authorized Cluster portfolio, including authorized client setup, Compliance Universe approval, reassignment, and management intervention within scope.

Cluster authority does not automatically grant global access or unrestricted override authority.

### 3.6 HOD POV

Provides global/elevated portfolio visibility and approved intervention authority.

HOD access is broad but still subject to action-specific authority, auditability, and segregation-of-duties safeguards.

#### 3.6.1 HOD Master Admin mode

For the current calibration and eventual governed HOD capability bundle, HOD is the TaxMonWeb Master Admin for tax-control governance: global visibility, client/profile maintenance, reassignment, approved lifecycle intervention, governed configuration, and Elevated Override authority where separately recorded.

Master Admin is not a seventh hierarchy level and does not mean unrestricted System Administration. User, authentication, and technical organization administration remain separate capabilities. Master Admin cannot fabricate filing, payment, acceptance, applicability, or evidence facts, and cannot erase actual-actor segregation-of-duties history.

During the explicit sanitized prototype calibration mode, all prototype users may edit Client/Profile fixture context so the HOD can test the operating loop without a permission dead end. This is temporary demo behavior, browser-persisted for fixture data, and must be disabled before real client data or production authority is introduced.

### 3.7 Super Admin

Super Admin is an explicit combined authority for TaxMonWeb. It may access all modules, all authorized data projections, technical administration, governed tax configuration, operational intervention, and exceptional override actions.

Super Admin is not an un-audited bypass. Every material action remains capability-aware, actor-attributed, effective-dated where relevant, and subject to history and segregation-of-duties safeguards. Super Admin cannot fabricate filing, payment, acceptance, applicability, or evidence facts, erase audit history, or replace the actual actors attached to completed controls.

## 4. Cross-functional and administrative modes

### 4.1 Tax Team / Tax Control

Tax Team/Tax Control is a cross-functional capability set, not a seventh hierarchical level.

Authorized capabilities may include:

- cross-portfolio Tax Profile/2303 review;
- Compliance Universe review and approval;
- Rules Library maintenance and approval;
- Holiday Master maintenance;
- exception review;
- evidence/control review;
- Tax Audit Mode;
- approved elevated controls.

Cross-portfolio visibility does not automatically grant every operational or override action.

### 4.2 System Administration

System Administration is separate from compliance authority.

Administrative capabilities may include:

- user administration;
- organization structure administration;
- authentication administration;
- technical configuration administration.

System Administration does not automatically grant:

- Tax Profile validation;
- Compliance Universe approval;
- checking or review signoff;
- rule approval;
- evidence verification;
- Elevated Override;
- tax-control authority.

Super Admin is the explicit exception because the combined authority is separately assigned and governed; ordinary System Admin access remains technical-only.

## 5. Organizational scope

Capability and organizational scope are independent dimensions.

The baseline scope categories are:

| Scope | Meaning | Typical visibility |
|---|---|---|
| Own assigned work | Records where the user is current accountable owner or assigned actor. | My Work and assigned control actions. |
| Team/Tower | Records within the user’s authorized Team or Tower. | Team/Tower portfolio and Review/Control Queue. |
| Cluster | Records within the user’s authorized Cluster. | Cluster portfolio and exceptions. |
| Cross-portfolio Tax Control | Authorized cross-portfolio tax-control scope. | Tax Profiles, universes, rules, evidence, exceptions, and Tax Audit Mode according to capability. |
| All A&T | Global organizational portfolio scope. | Broad management portfolio for authorized HOD or equivalent explicit capability. |

### 5.1 Scope does not automatically grant authority

A user with Cluster visibility does not automatically have permission to approve every record in the Cluster.

A user with All A&T visibility does not automatically have permission to maintain rules or override controls.

A user with Tax Control visibility does not automatically become the Preparer, Checker, Reviewer, or accountable owner of every visible obligation.

### 5.2 Effective-dated scope

Organizational memberships, capability assignments, and accountable assignments may change over time.

Access evaluation for current work uses current authorized scope. Historical ownership and actor facts are not rewritten when organizational scope changes.

### 5.3 No complex delegation in V1

V1 does not introduce temporary delegation chains, transfer acceptance, or substitute-approval workflows. Authorized leadership reassignment of open obligations remains the primary staffing-change mechanism.

## 6. Permission vocabulary

The conceptual matrix uses these meanings:

| Term | Meaning |
|---|---|
| Allowed | The capability may perform the action when the record and stage are otherwise applicable. |
| Allowed within scope | The capability may perform the action only within its assigned organizational or portfolio scope. |
| Conditional | The capability may perform the action only when the Control Template, assignment, component, stage, or other condition permits it. |
| Elevated only | The action is reserved for separately assigned elevated authority. |
| Not allowed | The capability/scope combination does not grant the action. |

Every action also remains subject to object state, effective dates, actor conflicts, required evidence, and audit requirements.

## 7. Conceptual permission matrix

This matrix defines capability boundaries, not implementation claims. A scope column does not grant the capability by itself.

| Business action | Own assigned work | Team/Tower | Cluster | Cross-portfolio Tax Control | All A&T / HOD | Key condition |
|---|---|---|---|---|---|---|
| View assigned obligation | Allowed | Allowed | Allowed | Allowed | Allowed | Subject to data-access policy. |
| View Team/Tower portfolio | Not by own scope | Allowed within scope | Allowed within scope | Allowed where assigned | Allowed within global scope | Visibility only. |
| View Cluster portfolio | Not by own scope | Conditional | Allowed within scope | Allowed where assigned | Allowed within global scope | Visibility only. |
| View cross-portfolio control records | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Allowed within Tax Control scope | Conditional | Tax Control capability required. |
| View audit history | Conditional | Conditional within scope | Conditional within scope | Allowed within control scope | Allowed within global scope | Sensitive fields may be restricted. |
| Tax Profile review/correction | Conditional | Conditional within authorized setup scope | Allowed within authorized scope | Allowed within Tax Control scope | Allowed within global scope | Requires profile setup capability; not ordinary visibility. |
| Tax Profile validation/activation | Not allowed by preparation capability alone | Conditional | Conditional within authorized scope | Allowed within Tax Control scope | Allowed within global scope | Authorized validator; self-approval safeguards apply where practicable. |
| Propose Compliance Universe | Conditional | Conditional within scope | Allowed within authorized scope | Allowed within Tax Control scope | Allowed within global scope | Requires validated Tax Profile and proposal capability. |
| Review Compliance Universe | Conditional | Conditional within scope | Allowed within scope | Allowed within Tax Control scope | Allowed within global scope | Review is not approval. |
| Approve Compliance Universe | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Allowed within authorized scope | Allowed cross-portfolio | Allowed globally/elevated | Registration Unit approval record; self-approval avoided where practicable. |
| View/update operational obligation facts | Conditional | Conditional within scope | Conditional within scope | Conditional within control role | Conditional within global scope | Component, stage, assignment, and action capability required. |
| Preparation signoff | Conditional | Conditional within scope | Conditional within scope | Conditional if explicitly assigned | Conditional if explicitly assigned | Preparer actor must satisfy Control Template. |
| Checking signoff | Conditional | Conditional within scope | Conditional within scope | Conditional if explicitly assigned | Conditional if explicitly assigned | Checker must be distinct from the relevant Preparer. |
| Review signoff | Conditional | Conditional within scope | Conditional within scope | Conditional if explicitly assigned | Conditional if explicitly assigned | Reviewer must be distinct where required. |
| Record return client approval | Allowed within applicable V1 work | Allowed within scope | Allowed within scope | Conditional if control role assigned | Conditional if explicitly assigned | Mandatory before Filing for ordinary V1 return/submission work; actor and scope controls apply. |
| Record payment client approval | Conditional | Conditional within scope | Conditional within scope | Conditional if control role assigned | Conditional if explicitly assigned | Required only where Payment applies; distinct from return approval. |
| Record filing/submission result | Conditional | Conditional within scope | Conditional within scope | Conditional if assigned control role | Conditional if explicitly assigned | Result strength and evidence rules apply. |
| Record payment/funding result | Conditional | Conditional within scope | Conditional within scope | Conditional if assigned control role | Conditional if explicitly assigned | No banking execution authority implied. |
| Record attachment result | Conditional | Conditional within scope | Conditional within scope | Conditional if assigned control role | Conditional if explicitly assigned | Applies per attachment requirement. |
| Verify evidence | Conditional | Conditional within scope | Conditional within scope | Allowed within Tax Control scope | Allowed within global scope | Verifier must have verification capability and satisfy SoD rules. |
| Create blocker | Allowed within visible scope | Allowed within visible scope | Allowed within visible scope | Allowed within control scope | Allowed within global scope | Must identify category and reason. |
| Clear blocker | Conditional | Conditional within scope | Conditional within scope | Allowed within control scope | Allowed within global scope | Requires authority to confirm resolution. |
| Reassign open obligation | Not allowed by ownership alone | Conditional | Allowed within scope | Allowed within Tax Control scope | Allowed globally/elevated | Open obligations only; audited reassignment. |
| Reopen obligation | Not allowed by ordinary work capability | Conditional with authority | Allowed within scope | Allowed within Tax Control scope | Allowed globally/elevated | Controlled ordinary lifecycle action, not automatically an override. |
| Cancel/supersede obligation | Not allowed by ordinary work capability | Conditional with authority | Conditional within scope | Allowed within Tax Control scope | Allowed globally/elevated | Requires approved reason and lifecycle history. |
| Maintain Rules Library | Not allowed | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Allowed within Tax Control governance scope | Allowed globally/elevated | Governance capability required. |
| Maintain Holiday Master | Not allowed | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Allowed within Tax Control governance scope | Allowed globally/elevated | Governance capability required. |
| Maintain Control Templates | Not allowed | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Conditional within governance scope | Allowed globally/elevated | Approved governance capability required. |
| Change Service Scope | Not allowed by ordinary work capability | Conditional | Allowed within authorized scope | Allowed within Tax Control scope | Allowed globally/elevated | Effective-dated and audited; not applicability editing. |
| Enter Tax Audit Mode | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Conditional | Allowed within Tax Control scope | Allowed globally/elevated | Review/audit lens, not case-management authority. |
| Perform Elevated Override | Not allowed | Not allowed | Not allowed by hierarchy alone | Elevated only | Elevated only | Tax Team/HOD subject to override capability; cannot fabricate external facts. |
| Perform Tax Team QA | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Not allowed by hierarchy alone | Allowed within Tax Control scope | Allowed within global scope | QA is independent from Engagement completion and may occur later. |
| Record QA finding / QA Failed | Not allowed | Not allowed | Not allowed | Allowed within Tax Control scope | Allowed within global scope | QA Failed automatically requires RCA and Engagement remediation. |
| Perform QA Re-check | Not allowed | Not allowed | Not allowed | Allowed within Tax Control scope | Allowed within global scope | Re-QA records the new review; it does not erase the prior finding. |
| Record RCA/remediation | Conditional within own work | Allowed within scope | Allowed within scope | Review/oversight only unless separately assigned | Conditional within global scope | Engagement Team owns RCA/remediation; Tax Team does not ordinarily fix the work. |
| Administer users/org/authentication | Not allowed | Not allowed | Not allowed | Not by Tax Control alone | Not by HOD alone | System Administration capability; no automatic compliance authority. |

## 8. Capability families

The matrix is easier to govern when capabilities are grouped by business purpose.

### 8.1 Operational capabilities

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
- `CreateBlocker`;
- `ClearBlocker`;
- `ReassignOpenObligation`;
- `ReopenObligation`;
- `CancelOrSupersedeObligation`.

### 8.2 Setup and universe capabilities

- `ReviewTaxProfile`;
- `CorrectTaxProfile`;
- `ValidateTaxProfile`;
- `ProposeComplianceUniverse`;
- `ReviewComplianceUniverse`;
- `ApproveComplianceUniverse`;
- `ChangeServiceScope`.

### 8.3 Governance capabilities

- `MaintainRulesLibrary`;
- `ApproveRuleVersion`;
- `MaintainHolidayMaster`;
- `MaintainControlTemplate`;
- `ViewTaxControlHistory`;
- `EnterTaxAuditMode`.

### 8.4 Exceptional capabilities

- `PerformElevatedOverride`;
- `ApproveExceptionalLifecycleAction` where separately required by governance.

### 8.5 Administrative capabilities

- `AdministerUsers`;
- `AdministerOrganization`;
- `AdministerAuthentication`;
- `AdministerTechnicalConfiguration`.

Administrative capabilities remain separate from compliance capabilities.

## 9. Approval and signoff rules

### 9.1 Approval is action-specific

A user may be able to review a Tax Profile but not activate it, view an obligation but not sign off its review, or view a Rule Version but not approve it.

### 9.2 Compliance Universe approval

Universe approval follows locked decision L-047:

- approval is recorded per Registration Unit;
- Cluster Leader may approve within organizational scope;
- Tax Team may approve cross-portfolio as tax-control authority;
- HOD has global/elevated approval authority;
- grouped Client or Taxpayer Entity review is a UI convenience, not a replacement for per-Registration Unit approval;
- independent self-approval should be avoided where practicable;
- V1 does not require universal two-person approval.

### 9.3 Tax Profile validation

Tax Profile validation is distinct from OCR extraction and correction.

The validator must have explicit validation capability and must be able to see the source/provenance context required for the decision.

Where practicable, a person who made material corrections should not be the sole validator of the resulting profile.

### 9.4 Signoff is tied to actual actor history

Signoff eligibility is evaluated against:

- actual actor identity;
- required stage;
- Control Template;
- object scope;
- prior actors on the same obligation/component;
- current assignment where relevant.

Role labels are not sufficient evidence that a control occurred.

## 10. Multiple roles and segregation of duties

### 10.1 Capability union does not bypass controls

A user may hold Preparer and Checker capabilities simultaneously. That does not permit the user to check their own preparation.

For an obligation where both stages are required:

```text
preparationActor != checkingActor
```

For ordinary V1 return/submission work, review is mandatory. Where the review control applies:

```text
preparationActor != checkingActor != reviewActor
```

### 10.2 Same-person conflict behavior

When a user attempts a conflicting signoff:

- the system identifies the prior actor conflict;
- the signoff is not accepted as a normal control;
- the user is shown the reason and next valid action;
- another qualified actor must perform the stage;
- an Elevated Override is required only if policy permits exceptional bypass.

No routine shortcut should allow a user to self-check or self-review simply because multiple capabilities are assigned.

### 10.3 Reassignment and SoD

Reassignment changes current accountability for an open obligation. It does not make a prior actor eligible to sign off a conflicting stage or rewrite an already completed stage.

### 10.4 Tax Team and SoD

Tax Team has cross-portfolio control capabilities, but those capabilities do not erase actor-separation rules. If a Tax Team user performed a stage, the same person cannot perform a required distinct checking/review stage merely because Tax Team has broad visibility.

## 11. Elevated authority

### 11.1 Elevated Override boundary

An Elevated Override is exceptional internal-control authority.

It may:

- bypass an authorized internal control or gate where policy permits;
- record a controlled exceptional lifecycle result;
- resolve an internal control impasse with reason and authority.

It may not:

- mark an unfiled return Filed;
- mark an unconfirmed payment Paid;
- mark an unaccepted submission Accepted;
- mark an unresolved legal requirement Not Applicable;
- fabricate evidence or external acknowledgment;
- bypass the override actor’s own required control;
- replace the appropriate Rule, Tax Profile, Compliance Universe, Service Scope, or correction process.

### 11.2 Override recording

Every override records:

- affected object and control;
- original state;
- resulting exceptional state;
- actor;
- authority/capability;
- reason;
- timestamp;
- relevant evidence or reference;
- audit event.

No universal second-approver workflow is required in V1.

## 12. Governance permissions

### 12.1 Rules Library

Rules maintenance requires Tax Control governance capability or HOD authority. Rule authorship and approval should be separated where practicable.

Rule governance cannot be granted merely because a user can view a portfolio.

### 12.2 Holiday Master

Holiday Master maintenance requires Tax Control governance capability or HOD authority.

Changing a holiday record does not itself authorize changing statutory deadlines. The relevant Rule/Deadline Policy determines how the date is used.

### 12.3 Control Templates

Control Template maintenance requires explicit governance capability. It can change required stages, components, signoffs, or SoD behavior and therefore must be versioned and audited.

### 12.4 Service Scope

Service Scope changes require explicit authority within the relevant organizational scope. They affect whether applicable expectations create normal TMF workflow but do not change legal applicability by themselves.

## 13. Audit and history access

Audit visibility is itself a permission-controlled capability.

Users may need different levels of access to:

- ordinary obligation history;
- profile/provenance history;
- assignment history;
- rule/calculation history;
- override history;
- administrative history.

Tax Team and HOD should have broad control/audit visibility according to policy. System Administration may view technical administration history without automatically receiving tax-control history or approval authority.

Audit access must not allow editing or deleting audit history.

## 14. Management views

The application uses one operational record set and multiple scoped projections:

```text
My Work → Review/Control Queue → Tower → Cluster → All A&T
```

Each view is filtered by visibility scope and enriched by available actions. A user may see a record without receiving an action button for it.

Tax Team/Tax Control receives cross-portfolio control views where authorized. System Administration receives administrative views, not implicit compliance views.

No separate management tracker or role-specific operational database is created.

### 14.1 Team and Clients action boundary

The Team workspace exposes people, reporting structure, and workload projections. The Clients workspace remains the canonical place for recurring Preparer / Checker / Reviewer ownership. The following action policy is approved for the current People & Portfolio slice:

| Capability / POV | Team | Clients |
|---|---|---|
| Preparer | View people, structure, operating signals and assignment context | View within authorized work scope |
| Checker | View people, structure, operating signals and assignment context | View within authorized work scope |
| Reviewer | View only; no roster edit | View only within authorized work scope |
| Tower Leader / Supervisor | Add, edit, move and deactivate people within Tower scope | Manage recurring ownership within Tower scope |
| Cluster Leader | Add, edit, move and deactivate people within Cluster scope | Manage recurring ownership within Cluster scope |
| Tax Control | View/review people and structure; no ordinary roster edit | View/review client context within control scope |
| HOD / Master Admin | Add, edit, move and deactivate people; global operating-model accountability | Govern/reassign within approved scope |
| System Admin | Technical identity and organization administration only | No client ownership or tax-control authority |
| Super Admin | Explicit combined authority, still audited and SoD constrained | Explicit combined authority, still audited and SoD constrained |

`View`, `Edit`, `Retire`, and `Clients` are the only row-action concepts exposed in the Team directory. `Retire` means deactivate while retaining history; destructive delete is not available. `Clients` is a handoff to the canonical client-assignment surface and never creates a second ownership record in Team.

### 14.2 Team operating models and reporting ladder

Team records use one of three operating models:

- **Engagement team · agile** — an engagement team carrying multiple client relationships;
- **Engagement team · dedicated** — an engagement team primarily dedicated to one client, while its leaders may intake or oversee additional client relationships; and
- **Tax team** — a cross-portfolio team handling tax ad hoc work.

The Tax Team remains in the same career/reporting hierarchy; its operating model changes workload interpretation, not organizational visibility or RBAC. Client-role ownership remains canonical in Clients, and Team only stores the person/structure classification that Work and management projections consume.

The standard reporting ladder is `2.1/2.2 → 3.1 → 3.2 → 4.1 → 4.2`, with the existing senior layers above it. A different line is permitted only as an effective-dated, reasoned exception and is retained in the audit trail. The exception does not grant authority or change segregation-of-duties rules.

RAG remains a derived operational projection, not a free-text person attribute. If a later controlled workflow exposes editable RAG inputs, Preparer and Checker may record applicable source facts within scope; Reviewer remains view-only. No action may directly overwrite a derived RAG state or use it as a performance score.

## 15. Representative RBAC scenarios

### 15.1 User has Preparer and Checker capabilities

The user may prepare assigned work and see checking queues within scope, but cannot check their own preparation. The system compares actual actor history, not only capability labels.

### 15.2 Checker sees another team’s work

Visibility may be granted through Team/Tower scope, but checking authority still requires assignment or explicit checking capability for the obligation and a non-conflicting actor.

### 15.3 Temporary staff change

Authorized leadership reassigns an open obligation. The new owner may continue work. Prior preparation, checking, signoffs, and ownership history remain unchanged.

### 15.4 Cluster Leader approves a Compliance Universe

The Cluster Leader may approve only affected Registration Units within authorized organizational scope and with approval capability. Grouped UI review still creates separate Registration Unit approval records.

### 15.5 Tax Team reviews across portfolios

Tax Team may review profiles, universes, evidence, rules, or exceptions across the authorized portfolio. It does not automatically become the operational Preparer, Checker, Reviewer, or accountable owner.

### 15.6 HOD intervention

HOD may view All A&T and perform globally authorized approvals, reassignments, lifecycle actions, or Elevated Overrides. Every action remains action-specific, reasoned where required, and audited.

### 15.7 System Administrator changes a user

System Administration may create, deactivate, or update an account or organization assignment. That action does not allow the administrator to approve a Tax Profile, sign off a review, approve a universe, maintain tax rules, or perform an Elevated Override.

### 15.8 Self-review attempt

A user who prepared an obligation attempts to complete the Checker signoff. The system rejects the ordinary signoff due to actual-actor conflict and identifies the required next action.

### 15.9 Override attempt to fabricate filing

A user attempts to use Elevated Override to mark an unfiled return Filed. The action is not permitted because override authority cannot fabricate external compliance facts.

### 15.10 Visibility without authority

An HOD or Tax Team user can see a record but lacks the specific capability to maintain its rule or change its Service Scope. The record is visible; the unauthorized action is unavailable.

### 15.11 Reassignment after partial work

An open obligation is reassigned after preparation and checking. The new accountable owner can progress remaining work. Previous actors remain attached to the completed stages and cannot be replaced in history.

### 15.12 Rule maintenance versus system administration

A system administrator can manage technical users but cannot edit the Rules Library. A Tax Team rule maintainer can edit governed rules but cannot administer authentication unless separately assigned that capability.

## 16. Tax Team QA boundary

Tax Team QA is a cross-portfolio control capability, not an Engagement execution role.

Tax Team may select or receive QA work, record findings, mark QA Failed, require RCA/remediation, and perform Re-QA within authorized scope. QA may occur after Engagement Completion or on a later/monthly cadence and must not block Filing or statutory completion.

The Engagement Team remains responsible for RCA, remediation, filing evidence, payment evidence, and other corrective work. Tax Team does not ordinarily complete those actions for the Engagement Team.

QA Completion % and QA Pass Rate % are separate reporting concepts and do not create a new approval hierarchy.

## 17. Pressure test against approved models

### 17.1 Domain Model compatibility

The RBAC model attaches to existing concepts without changing the domain:

- visibility scopes attach to Client, Taxpayer Entity, Registration Unit, Compliance Universe, Compliance Obligation, organization units, and cross-portfolio control mode;
- action authority attaches to component actions, blockers, assignments, lifecycle transitions, and evidence;
- approval authority attaches to Tax Profile, Compliance Universe, Control Template, Rule Version, signoff, and evidence-verification actions;
- governance authority attaches to Rules, Holiday Master, Control Templates, and Service Scope;
- override authority attaches to exceptional internal-control actions;
- actual actor history remains the basis for segregation of duties.

### 17.2 Workflow compatibility

The RBAC model supports the parallel component lifecycle:

- filing-result recording does not imply payment authority;
- evidence verification is separate from external action recording;
- blocker creation and clearing are distinct actions;
- reassignment does not rewrite prior actors;
- completion remains derived;
- ordinary reopening/correction is distinct from Elevated Override.

### 17.3 Rules/Deadlines compatibility

RBAC does not change the deadline model:

- rule governance is separate from operational date use;
- Holiday Master maintenance does not automatically change deadlines;
- deadline exceptions require their approved policy/process;
- unresolved rule content remains an Exception and cannot be fabricated through access authority;
- users cannot use broad visibility or override authority to invent a statutory date.

### 17.4 No contradiction discovered

No contradiction requiring a change to `01-DOMAIN-MODEL.md`, `02-WORKFLOWS-CONTROLS.md`, or `03-RULES-DEADLINES.md` was found.

The main implementation constraint is deliberate: a user may possess multiple capabilities, but every action still requires the intersection of capability, organizational scope, object state, applicable Control Template, and actor-history constraints.

## 17. Decisions requiring domain-owner input

The following are policy/configuration decisions for later confirmation, not reasons to redesign the domain:

1. Exact mapping of internal job functions and named groups to capabilities.
2. Which fields or audit categories require restricted visibility.
3. Which roles may create and clear each blocker category.
4. Which Control Templates require a distinct validator from the person who made material Tax Profile corrections.
5. Which lifecycle actions require Cluster Leader, Tax Team, or HOD approval within the capability model.
6. Whether specific high-risk override categories require additional approval beyond the V1 baseline.
7. The exact organizational boundaries for Team/Tower, Cluster, Tax Control, and All A&T.

These should be resolved in policy and the later RBAC implementation design without turning ordinary work into a permission-management exercise.


### Source: 05-UX-DESIGN-SYSTEM.md

# TaxMonWeb UX and Design System

**Document:** 05-UX-DESIGN-SYSTEM.md  
**Product:** TaxMonWeb  
**Status:** Approved UX/design baseline / amended core-domain freeze
**Depends on:** `00-PRODUCT-BRIEF.md`, `00A-DECISION-REGISTER.md`, `00B-DOMAIN-GLOSSARY.md`, `01-DOMAIN-MODEL.md`, `02-WORKFLOWS-CONTROLS.md`, `03-RULES-DEADLINES.md`, `04-RBAC.md`

This document translates the approved domain, workflow, rules, RBAC, and TaxMonWeb ant brand direction into a coherent product experience.

It is not a screen implementation, component library implementation, route map, database design, API design, authentication design, or technical architecture.

The product spine represented in the experience is:

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA`

The interface must make clear that TaxMonWeb generates and controls compliance work; it does not prepare or compute the tax return.

## A. UX thesis

TaxMonWeb should feel like:

> LES Digital Campus product quality × TMF corporate identity × modern enterprise compliance/control-tower UX.

The experience should be:

- calm;
- precise;
- modern;
- fast;
- highly scannable;
- trustworthy;
- operationally intelligent;
- substantially simpler to operate than the domain model underneath.

The product must not feel like:

- eNate;
- SAP;
- a BIR portal;
- Excel inside a browser;
- a generic admin dashboard;
- a ticketing/workflow system;
- a wall of forms or status dropdowns.

The governing UX principles are:

> Set up once. Generate automatically. Manage by exception.

> Automate what is deterministic. Flag what requires judgment.

> Every click must either advance work, evidence a control, resolve an exception, or provide useful information. Otherwise question why the click exists.

## B. Information architecture

### B.1 Workspace navigation

The primary application navigation is organized as six workspaces:

1. **Control Tower** — what is happening;
2. **Team** — who is delivering it;
3. **Clients** — who TMF is servicing;
4. **Work** — what work needs to move;
5. **BIR Center** — governed BIR reference;
6. **Admin** — access, configuration, and audit.

Each workspace opens with a compact dashboard/landing view and exposes focused tabs or submodules. Due Register and Calendar are Work views, not global navigation. Tax Team/QA and Super Admin are restricted capability views over the same records, not ordinary top-level navigation.

The information architecture should not create navigation items merely because a domain object exists.

### B.2 Contextual areas

The following should appear contextually inside client, control, or authorized governance workspaces rather than automatically becoming top-level navigation:

- Tax Profile;
- 2303 review;
- Expected Compliance;
- Registration Unit;
- Rules Library;
- Holiday Master;
- Control Templates;
- Tax Audit Mode;
- History/Audit;
- administration.

Governance and administration should appear only to authorized users and only where the current task requires them.

### B.3 Global utility layer

A compact utility layer may provide:

- current user and scope;
- current date/context;
- search or quick find;
- help/contextual guidance;
- notifications only when later approved;
- profile and sign-out controls.

The utility layer should not become a second navigation system.

### B.4 Progressive disclosure

The default screen should answer the immediate operational question. Details appear through:

- expandable rows;
- side panels;
- drawers;
- focused detail pages;
- history views;
- audit/provenance panels.

Do not expose rule versions, generation context, extraction runs, or audit events on every screen.

## C. One application, role-aware experience

TaxMonWeb is one application and one operational truth.

The role-aware experience uses the approved visibility progression:

```text
My Work → Review/Control Queue → Tower → Cluster → All A&T
```

These are views and scope controls, not separate dashboards or applications.

### C.1 Scope switcher

Where a user has more than one authorized scope, a compact scope switcher may expose:

- My Work;
- Review/Control Queue;
- Tower;
- Cluster;
- All A&T;
- Tax Control where applicable.

The switcher should show only scopes the user can actually access. It must not imply that changing a view changes authority.

### C.2 Action visibility

Do not clutter screens with actions a user cannot perform.

An unavailable action should normally be hidden. When its absence could create confusion, show a concise explanation such as:

> Review is complete. Evidence verification requires an authorized control role.

Avoid large collections of disabled buttons.

### C.3 Multiple capabilities

A user may hold multiple capabilities. The experience should show the valid next action for the current record, not a menu of every capability the user possesses.

Actual actor conflicts remain enforced by the workflow/control model. The interface should explain a self-review conflict in plain language rather than exposing RBAC mechanics.

## D. Control Tower / HOD experience

The Control Tower should answer:

> It is 9 AM. What do I need to know or intervene in?

### D.1 First viewport priorities

The first viewport should prioritize:

- due today;
- due soon;
- AMBER;
- RED;
- waiting for client;
- waiting for funding;
- failed filing, payment, or attachment activity;
- unresolved configuration;
- Compliance Complete but not Control Complete;
- exceptions requiring intervention;
- expected items that appear missing.

The first viewport should not prioritize vanity metrics such as total records created, total users, or generic completion percentages without context.

### D.2 Recommended layout

The Control Tower can use four levels of attention:

1. **Immediate intervention queue** — urgent or overdue obligations and exceptions.
2. **Dependency queues** — client approval, client data, funding, internal review, BIR/system.
3. **Control gaps** — legally complete but control-incomplete, evidence missing, or failed attempts.
4. **Expected-compliance gaps** — unresolved or ungenerated items that should exist.

Each queue should be actionable and drillable. A count should always lead to the underlying records that explain it.

### D.3 Natural drill-down

The drill-down should feel like business context, not database traversal:

```text
All A&T → Cluster → Tower → Client → Taxpayer Entity → Registration Unit → Obligation
```

Breadcrumbs may preserve context, but labels should use familiar business names and avoid technical identifiers unless needed for audit.

### D.4 Control Tower cards and tables

Cards should be limited to high-value signals. Tables should carry the operational detail.

Useful row context includes:

- client/entity/registration unit;
- obligation description and period;
- next valid action;
- statutory deadline;
- TMF target;
- current owner;
- primary component status;
- blocker;
- risk/RAG;
- exception indicator.

## E. Work and My Work

The Work workspace should answer what work needs to move. Its My Work view should answer:

> What do I need to do today?

> What happens next?

> What is blocked?

> What is becoming risky?

### E.1 Queue structure

The default queue should group work by actionability rather than by database object:

- **Do today**;
- **Due soon**;
- **Waiting on someone else**;
- **Returned for correction**;
- **At risk**;
- **Recently completed**.

### E.2 Recommended row content

Each row should answer:

- What is it?
- What period does it relate to?
- What do I need to do next?
- When is it needed?
- What is blocking it?
- Who owns it?
- What is the risk?

Do not require staff to manually populate this queue. TaxMonWeb derives it from assignments, requirements, deadlines, component states, blockers, and exceptions.

### E.3 Empty and waiting states

An empty queue should explain why it is empty:

> Nothing requires your action today.

If records are waiting on another person, show useful context rather than presenting an empty generic task list.

## F. Client and Registration Unit workspace

The client experience should support the real hierarchy without forcing ordinary users to think in technical terms.

### F.1 Context header

Use a compact contextual header:

```text
Client name
  → Taxpayer Entity name
    → Registration Unit name / identifier
```

The header should emphasize human-readable names and show technical identifiers only where they help verification or audit.

### F.2 Recommended workspace sections

The Client workspace should use sections or tabs such as:

1. **Overview**
2. **Expected Compliance**
3. **Obligations**
4. **Tax Service Calendar**
5. **Tax Profile**
6. **Team & Scope**
7. **Exceptions**
8. **History/Audit** where authorized

These are contextual workspace sections, not necessarily primary navigation items.

### F.3 Overview

The overview should present:

- current compliance position;
- due today and upcoming work;
- open exceptions;
- client/data/funding dependencies;
- Compliance Complete versus Control Complete gaps;
- current accountable team/owner;
- quick links to the next useful action.

### F.4 Expected Compliance

Use the accountant-facing term **Expected Compliance**.

The core decisions should be visible as concise states:

- Applicable — In TMF Scope;
- Applicable — Out of TMF Scope;
- Not Applicable — reason required;
- Requires Review.

Prioritize:

- unresolved items;
- applicability/scope discrepancies;
- expected items that have not generated work;
- items awaiting approval.

Grouped review may be available at Client or Taxpayer Entity level, but the UI must make clear that approval records remain per Registration Unit.

### F.5 Team & Scope

Show current accountable owner, relevant team/tower/cluster context, and Service Scope in plain language.

Detailed effective-dated assignment history belongs behind a progressive-disclosure history action.

## G. Flagship 2303 / AI validation experience

This should be one of the strongest V1 experiences.

### G.1 Setup flow

Use a calm, visible stepper:

```text
Source  →  Review extraction  →  Validate Tax Profile  →  Review Expected Compliance  →  Approve  →  Generate
```

The stepper should show current progress and unresolved attention items without exposing internal lifecycle terminology.

### G.2 Upload state

The upload experience should explain:

- what document is expected;
- that the document is processed privately and temporarily;
- that human validation is required;
- what happens after validation;
- where the permanent SharePoint source reference belongs.

Do not imply that upload alone activates anything.

### G.3 Side-by-side review

Use a two-pane review:

```text
Source 2303/document viewer | Extracted Tax Profile
```

The source side should support:

- readable document viewing;
- page navigation;
- page reference highlighting where available;
- zoom and fit controls;
- clear source identity.

The structured side should support:

- grouped fields;
- source value and proposed structured value;
- confidence indicator;
- attention flag;
- editable correction;
- provenance preview;
- validation state.

### G.4 AI-assisted extraction language

Use language such as:

- Extracted value;
- Proposed value;
- Confidence;
- Needs review;
- Source reference;
- Corrected by human;
- Validated.

Avoid language suggesting that AI decided tax treatment or approved applicability.

### G.5 Attention-first review

Do not force users to approve every correctly extracted field individually.

Use a review summary such as:

- 24 fields extracted;
- 20 clear;
- 3 low-confidence;
- 1 conflicting;
- 2 missing/required.

The primary action should be **Review attention items**. A human can then validate the complete Tax Profile explicitly.

### G.6 Validation gate

The final action should be clearly named:

> Validate Tax Profile

It must not be named Approve OCR or Accept AI.

The interface should show:

- what remains unresolved;
- which values were corrected;
- who will be recorded as validator;
- what downstream step becomes available after validation.

### G.7 Temporary-document lifecycle

The experience should make temporary processing status understandable without exposing infrastructure terminology:

- Processing;
- Review in progress;
- Awaiting validation;
- Awaiting Expected Compliance approval;
- SharePoint reference captured;
- Processing copy retained according to policy;
- Processing copy purged after approved conditions.

## H. Expected Compliance experience

### H.1 Primary user goal

The user should answer:

> What should exist for this Registration Unit, and what is unresolved?

### H.2 Recommended layout

Use a review table with concise columns:

- expected obligation;
- applicability;
- TMF scope;
- reason or source;
- current decision;
- generated status;
- attention indicator;
- approval state.

Avoid exposing Rule Version IDs or internal revision numbers in the primary table.

### H.3 Detail panel

Selecting an item opens a side panel containing:

- why it is expected;
- which profile information contributed;
- scope context;
- current decision history;
- what happens next;
- unresolved inputs;
- generated obligations where applicable.

### H.4 Safe grouped approval

Grouped review can reduce repetitive clicks. The UI must still show the Registration Units included and preserve individual approval records.

Bulk approval should be available only when:

- the selected items share the same approved decision;
- no item has unresolved flags;
- no conflict or self-approval condition exists;
- the user has authority for every affected Registration Unit.

## I. Obligation experience

### I.1 Obligation header

The header should answer quickly:

- What obligation is this?
- For which Client, Taxpayer Entity, and Registration Unit?
- For what period?
- Who currently owns it?
- What is the next valid action?
- Is there a blocker, risk, or exception?

Show statutory deadline, TMF Package Target, any separately configured component/milestone internal target, and service milestones as separate labeled dates.

### I.2 Primary journey

Use the approved summary:

```text
PREPARE → REVIEW → CLIENT → FILE → POST-FILING → COMPLETE
```

This is a journey summary, not an assertion that Payment, Attachments, and Evidence are sequential.

### I.3 Component cards

Use four simple component cards:

1. **Submission**
2. **Payment**
3. **Attachments**
4. **Evidence/Proof**

Each card should show:

- current plain-language state;
- what is complete;
- what remains;
- who needs to act;
- next valid action;
- blocker, risk, or exception indicator;
- evidence strength where relevant.

Examples:

```text
Submission — Accepted
Payment — Awaiting confirmation
Attachments — 2 of 3 verified
Evidence — Missing filing acknowledgment
```

### I.4 Detail disclosure

Hide attempt history, provenance, audit events, and detailed signoff machinery behind:

- View history;
- View evidence;
- View calculation explanation;
- View assignment history;
- View audit trail.

The default experience should not resemble an event log.

### I.5 Next-action panel

The most prominent action area should answer:

> What is the next valid action?

Examples:

- Complete preparation;
- Send for checking;
- Resolve returned review item;
- Request client approval;
- Record submission result;
- Add payment confirmation;
- Verify evidence;
- Resolve configuration exception.

Do not present actions that are invalid because a prerequisite is unresolved.

### I.6 Completion presentation

Show separate indicators:

- **Compliance Complete**;
- **Control Complete**;
- **Overall Complete**.

Overall Complete is reserved for applicable final control gates. A legally complete obligation with missing evidence should be understandable as legally complete but operationally/control incomplete.

## J. Blocker, Risk/RAG, and Exception UX

These are distinct concepts and should use distinct visual treatments.

| Concept | UX treatment |
|---|---|
| Blocker | Plain-language reason label, affected component, owner/responsible party, and next action. |
| Risk/RAG | Timing signal tied to approved dates, shown with label, icon, and explanatory text. |
| Exception | Attention marker with reason category such as unresolved, conflicting, overridden, failed-generation, or abnormal. |

They may coexist. For example:

```text
Blocker: CLIENT APPROVAL
RAG: AMBER — TMF target reached
Exception: none
```

Or:

```text
Blocker: none
RAG: unavailable — rule unresolved
Exception: missing approved deadline policy
```

Never rely on color alone. Use labels, icons, text, and accessible patterns.

Internal-target exposure and statutory exposure must remain distinguishable. Missing the TMF Package Target may be an internal Amber condition without being a statutory Red condition. The exact visual treatment remains subject to UX validation.

Avoid an explosion of status colors. A small semantic system is preferable to giving every workflow state its own color.

## K. Tax Service Calendar

The calendar is a projection of the same Compliance Obligations, deadlines, and service milestones.

### K.1 Date distinction

Every date must retain a visible label:

- Statutory Deadline;
- Adjusted Statutory Deadline;
- TMF Package Target;
- component-level TMF Internal Target where separately configured;
- Client Data Target;
- Draft/Submission-to-Client Target;
- Client Approval Target;
- TMF Filing Target;
- component-level deadline where applicable.

Do not collapse these into one generic “Due” column.

The TMF Package Target represents the internal target for completing the entire applicable package one Philippine working day before the earliest applicable statutory deadline. It never replaces component statutory deadlines.

### K.2 Calendar views

Useful projections include:

- Annual Calendar;
- Upcoming;
- Today;
- Client;
- Team/Tower;
- Cluster;
- component or blocker-filtered view.

All views should link to the same obligation detail.

### K.3 Calendar interaction

V1 should support:

- filtering;
- sorting;
- date-type toggles;
- drill-down;
- exception visibility;
- approved planning-exception review.

### K.4 Independent QA presentation

QA is shown as a separate control dimension after Engagement completion or during a later QA cycle.

Show independently:

- Tax Run Completion;
- RAG/risk;
- QA Pending/Passed/Failed;
- QA Completion %;
- QA Pass Rate %;
- RCA/remediation state.

QA Completion % must not be presented as a generic quality percentage or used to make Engagement work appear incomplete. A formal QA Failed state should surface the finding and return-to-Engagement remediation path.

Do not turn V1 into a drag-and-drop scheduling product. Manual changes should use a deliberate exception flow with reason and authority.

## L. Visual design system

### L.1 Visual direction

Use:

- white and neutral surfaces;
- dark readable typography;
- restrained TMF-inspired red accents;
- spacious but information-efficient layouts;
- premium modern SaaS polish;
- strong hierarchy and calm density.

The application should not be predominantly red.

### L.2 Brand tokens from approved reference

The attached approved visual reference provides the current working brand palette:

| Token | Reference value | Intended role |
|---|---|---|
| Brand Red | `#E31E24` | Ant mark, selected brand emphasis, primary accent, selected key actions. |
| Charcoal | `#1F1F1F` | Primary text, dark surfaces, strong contrast. |
| Slate | `#6B6B6B` | Secondary text, metadata, supporting UI. |
| Light Gray | `#E5E5E5` | Borders, dividers, subtle surfaces. |
| Off White | `#FAFAFA` | Page/background surfaces. |

These should be represented as semantic design tokens rather than scattered literal colors.

### L.3 Semantic tokens

Brand tokens must remain separate from operational tokens.

At minimum define:

- `brand.primary`;
- `text.primary`;
- `text.secondary`;
- `surface.page`;
- `surface.card`;
- `border.default`;
- `status.success`;
- `status.warning`;
- `status.danger`;
- `status.info`;
- `status.exception`;
- `focus.default`;
- `interactive.primary`;
- `interactive.destructive`.

Operational RED/overdue must use `status.danger`, not simply reuse `brand.primary`.

Exception treatment should rely primarily on label, icon, border, and explanation rather than adding many competing colors.

### L.4 Typography

Use a highly legible modern sans-serif with strong numeric clarity for dates and counts.

Define semantic text roles rather than styling ad hoc:

- display/page title;
- section title;
- card title;
- table/header label;
- body;
- supporting metadata;
- badge/label;
- numeric emphasis;
- audit/detail text.

Recommended hierarchy should make page title, urgent count, next action, deadline, and exception reason distinguishable at a glance.

The final font family should be confirmed against TMF brand and deployment constraints before implementation.

### L.5 Spacing and density

Use a consistent small spacing base, preferably a 4/8 rhythm:

- compact spacing for metadata and table rows;
- comfortable spacing for cards and forms;
- generous spacing around major page sections;
- dense but readable operational tables.

Density should follow the question being answered. Control Tower and My Work may be dense; setup review and client overview should breathe.

### L.6 Layout

Prefer:

- a stable application shell;
- clear page headers;
- one dominant primary action per context;
- split panes for source-versus-structured review;
- side panels for detail and history;
- sticky critical context in long tables;
- consistent content width and alignment.

Avoid giant admin forms and full-screen modal sequences.

### L.7 Core components

The design system should establish consistent behavior for:

- cards;
- tables;
- badges/chips;
- buttons;
- forms;
- tabs;
- drawers;
- side panels;
- dialogs;
- breadcrumbs;
- progress/step indicators;
- empty states;
- skeleton/loading states;
- errors;
- success/confirmation states;
- inline validation;
- file/source viewers;
- filter and search controls.

Components should support progressive disclosure and avoid exposing database structure.

### L.8 Tables

Tables should answer decisions, not expose fields.

Prioritize:

- what it is;
- when it is due;
- where it is now;
- what is wrong;
- who owns it;
- what happens next.

Support:

- sorting;
- filtering;
- saved or role-aware useful views where justified;
- sticky critical context;
- concise statuses;
- expandable detail;
- safe bulk actions only where the action is unambiguous and authorized.

### L.9 Forms and dialogs

Use inline editing or focused side panels for small corrections. Use dialogs only for:

- deliberate destructive or irreversible decisions;
- required reason capture;
- approval confirmation;
- exception/override confirmation;
- clear, bounded multi-step action.

Do not use modals for ordinary navigation or every status update.

## M. Ant/logo application

The attached TaxMonWeb ant is the approved canonical visual direction. It must not be replaced with an unrelated mascot or redesigned into a different concept.

### M.1 Preserved characteristics

The identity remains:

- minimal;
- geometric;
- flat/2D;
- recognizable as an ant;
- professional rather than cute;
- suitable for enterprise software;
- usable at small sizes;
- visually distinct from game or cartoon mascot aesthetics.

Production refinement may include geometry cleanup, optical balance, small-size legibility, monochrome treatment, icon treatment, and responsive logo variants. Those refinements must preserve the approved underlying ant concept.

### M.2 Lockups

Define these approved usage forms:

| Lockup | Use |
|---|---|
| Primary lockup | Ant mark + TaxMonWeb. Login, full desktop navigation, formal product contexts. |
| Compact mark | Ant only. Collapsed navigation, compact header, app icon, favicon, small surfaces. |
| Product wordmark | TaxMonWeb. Text-led contexts where the mark is already established. |
| Optional descriptor | `Tax Compliance Control`. Login, formal/export contexts, or spacious brand surfaces. |

The wordmark treatment should preserve the approved dark `TaxMon` and red `Web` relationship shown in the reference.

### M.3 Usage contexts

| Context | Recommended treatment |
|---|---|
| Login | Primary lockup on a quiet off-white or approved branded surface. |
| Desktop navigation | Compact lockup or primary lockup depending on available width. |
| Collapsed navigation | Ant-only compact mark with accessible product name. |
| Favicon/app icon | Ant-only mark in approved light and dark variants. |
| Loading state | Small ant mark with restrained motion only if motion is useful and accessible. |
| Empty state | Occasional ant mark where it adds reassurance or orientation; do not decorate every empty state. |
| Mobile header | Compact ant mark with accessible TaxMonWeb label. |
| Export/report context | Primary lockup or wordmark plus optional descriptor according to available space. |

### M.4 Restraint

The ant is a product identity mark, not a decorative mascot scattered through the interface.

Use it to establish identity, orientation, loading, or selected empty states. The operating experience must remain corporate and controlled.

## N. Responsive and accessibility direction

### N.1 Responsive behavior

The operating environment is desktop-first, but the product must remain usable on tablet and mobile.

Recommended behavior:

- desktop: full application shell, multi-column tables, split-pane setup review;
- tablet: condensed navigation, fewer visible table columns, side panels widened into focused views;
- mobile: prioritized action cards, stacked component summaries, full-screen detail panels, simplified filters.

Do not merely shrink desktop tables until they become unreadable.

### N.2 Accessibility

The system should support:

- keyboard navigation;
- visible focus states;
- logical heading hierarchy;
- accessible labels for icons and ant-only marks;
- sufficient contrast;
- non-color status communication;
- readable type and numeric dates;
- screen-reader-friendly tables and status changes;
- reduced-motion behavior;
- clear error and validation messages;
- touch targets suitable for tablet/mobile.

Brand red must not be the only indicator of an operational RED condition.

### N.3 Data accessibility

Dense operational tables should provide:

- a concise default column set;
- accessible row expansion;
- text labels for RAG, blockers, and exceptions;
- alternative detail views when horizontal scrolling would hide critical context.

## O. Prototype screen inventory

The first meaningful vertical slice should demonstrate:

1. Login
2. Control Tower
3. Team
4. Clients
5. Work
6. BIR Center
7. Admin (authorized users only)
8. Client/profile setup and 2303 review
9. Work detail and execution projection
10. Tax Service Calendar projection inside Work
11. Control/QA views for authorized users

Contextual or later prototype surfaces may include:

- Tax Control workspace;
- Rules Library;
- Holiday Master;
- Control Templates;
- History/Audit;
- Tax Audit Mode;
- administration.

These should remain submodules or restricted views unless user research proves that a new workspace is necessary. Do not create a numbered module sequence merely because a capability has its own data.

## P. Prototype sample data

Prototype fixtures may use representative BIR Form 2303 samples supplied by the domain owner.

Fixtures must be sanitized or anonymized while preserving meaningful structural differences, such as:

- different registration-unit shapes;
- clear versus ambiguous extraction;
- multiple expected-compliance outcomes;
- in-scope versus out-of-scope items;
- different component combinations;
- blockers and failed attempts;
- evidence-complete versus control-incomplete states.

Real client identifiers must not appear in public or demonstration fixtures.

## Q. Screen-by-screen pressure test

Every proposed screen should answer:

1. What question is the user trying to answer?
2. What decision or action belongs here?
3. What can TaxMonWeb derive instead of asking the user?
4. What can remain hidden until needed?
5. What can be removed?
6. Can a click be eliminated?
7. Can an exception be surfaced instead of asking someone to inspect everything?
8. Does this feel like doing tax-compliance work or administering software?

If the screen feels like software administration, simplify it.

## R. Decisions requiring domain-owner input

These are UX/content decisions rather than domain-model blockers:

1. Final production font family and confirmation of TMF brand-token usage against approved brand standards.
2. The exact sanitized 2303 sample set and approved fixture structures.
3. Which Tax Profile fields are mandatory for the first prototype’s human validation gate.
4. Exact user-facing labels for selected external result states, provided evidence strength remains clear.
5. Which client/service arrangements require copy/transmittal evidence.
6. Final responsive prioritization details for the first prototype, within the monitoring/intervention/review/safe-action direction.

None of these require redesigning the approved domain architecture.

## S. Contradictions discovered

No contradiction requiring changes to `01-DOMAIN-MODEL.md`, `02-WORKFLOWS-CONTROLS.md`, or `03-RULES-DEADLINES.md` was found.

The following tensions are resolved through UX treatment rather than domain changes:

- sophisticated underlying history versus simple component cards;
- one application versus multiple hierarchical views;
- grouped Expected Compliance review versus per-Registration Unit approval;
- multiple deadline meanings versus one calendar projection;
- brand red versus operational RED;
- distinctive ant identity versus restrained enterprise presentation.

The attached ant reference is treated as the approved visual direction. This document recommends only production-use refinements that preserve the underlying concept.


### Source: 06-TECHNICAL-ARCHITECTURE.md

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


### Source: 07-V1-BUILD-PLAN.md

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

## 1.1 Workspace and Lego development boundary

The user-facing product is organized into six workspaces:

1. Control Tower — what is happening and what needs intervention;
2. Team — who is delivering it;
3. Clients — who TMF is servicing;
4. Work — what work needs to move;
5. BIR Center — a shared, read-only encyclopedia-style reference for the governed BIR data TaxMonWeb relies on;
6. Admin — who may access or change the system, and what happened.

Each workspace has a compact landing view and focused submodules/tabs. Due Register and Calendar are Work submodules. Tax Team/QA and Super Admin are restricted views over shared truth, not additional ordinary workspaces.

BIR Center is available as a read-only reference to all authenticated users. It is not a rules editor, calendar-release surface, obligation generator, or second source of truth. Deadline rules and calendar release remain restricted governed configuration capabilities outside BIR Center.

Development is Lego-first, not a fixed numbered-module sequence. A Lego is the smallest complete capability that includes its user-visible projection, owning commands/queries, authorization boundary, effective-dated/history behavior, audit trail, tests, and relevant responsive/accessibility behavior. Legos may be implemented in dependency order and connected across workspaces without creating duplicate trackers or sources of truth.

The review loop for each Lego is:

`HOD operational input → concise requirements → UX/interaction pressure test → build → QA → HOD testing → correction → Lego freeze`

The earlier Module 01/Module 02 sequence is retired. Do not create or plan a separate “Module 02” merely because a future capability is conceptually known.

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
- Team, Clients, Work, BIR Center, and authorized Admin entry points;
- Due Register and Calendar inside Work;
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

## 4. Active Lego backlog and dependency slices

The slices below are dependency-oriented implementation Legos, not a numbered product-module sequence and not separate services. A Lego may touch several workspaces while remaining one coherent application change. Reprioritize the active Lego backlog when HOD review exposes a more valuable dependency, while preserving the frozen domain and control invariants.

### Slice 01 — Product foundation and preview shell

**Complexity:** S

**Milestone:** Prototype 0

**Goal:** Get the smallest useful TaxMonWeb application running locally and deployable to a sanitized preview environment.

**User-visible outcome:** A user can log in, see the approved TaxMonWeb shell and ant identity, navigate the primary areas, and view clearly labelled sanitized fixture content.

**Domain behavior:** No complete domain schema. Establish only the application identity and fixture boundary needed to render the shell.

**Schema/data required:** Environment configuration, Supabase connection foundation, minimal authenticated identity reference if required, and a versioned sanitized fixture mechanism. Do not create the full Client, Tax Profile, Rules, or Obligation schema.

**Commands/queries:** Sign-in/sign-out/session query; fixture read query only.

**UI:** Login, authenticated shell, Control Tower, Team, Clients, Work, BIR Center, authorized Admin entry point, responsive navigation, useful fixture states, and loading/error/empty states. Due Register and Calendar are reached inside Work.

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

**UI:** Control Tower, Team, Clients, Work, BIR Center, and authorized Admin entry points; Work contains My Work, Due Register, Calendar, and control/exception views; concise status language, filters, and responsive monitoring views.

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

`Foundation Lego → workspace shell → first reviewable workspace projections → Gate 1`

The shell must not wait for live extraction, complete rules, or the full domain schema.

### Critical path to the Golden Path

`Prototype 0 → registration/profile Lego → BIR knowledge/configuration Lego → compliance-setup Lego → generated-work Lego → Gate 2/3/4`

The MockDocumentExtractionProvider is the critical-path extraction dependency. Production AI selection is not.

### Critical path to the Operational Pressure Test

`Golden Path → execution/component Lego → control/RAG/exception Lego → SoD/reassignment/audit Lego → Gate 5`

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
