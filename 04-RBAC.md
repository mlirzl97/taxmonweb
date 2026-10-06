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
