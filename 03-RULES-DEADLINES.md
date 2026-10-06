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
