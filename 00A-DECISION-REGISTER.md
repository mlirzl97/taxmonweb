# TaxMonWeb Decision Register

**Document:** 00A-DECISION-REGISTER.md  
**Product:** TaxMonWeb  
**Status:** Approved core-domain freeze / amended baseline
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
| L-072 | Module-by-module development | After the core freeze, product development proceeds module by module: Client Registry & Tax Profile; Compliance Setup; BIR Requirement Master, Rules & Calendar; Tax Run / Filing Execution; Control Tower & My Work; Tax Team QA; Gamification & Management. | Each module follows HOD operational interview → module requirements → UX/interaction design → pressure test → build → HOD testing → corrections → module freeze. Future modules are not elaborated prematurely. |
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
- Blocker, Risk/RAG, and Exception remain separate dimensions and are not collapsed into one status.
- Data Readiness is separate from the Engagement lifecycle.
- Preparation, Checking, Review, and pre-filing Client Approval are mandatory V1 controls for ordinary return/submission work.
- Return Client Approval and Payment Client Approval are separate facts.
- TMF Package Target never overwrites a component statutory deadline.
- QA does not block statutory completion and QA Failure requires RCA and remediation.
- QA Completion % and QA Pass Rate % are separate measures.
- Generated Compliance Work does not mean TaxMonWeb prepares or computes the tax return.
