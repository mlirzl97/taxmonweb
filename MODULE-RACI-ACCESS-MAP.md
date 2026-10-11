# TaxMonWeb Module, RACI & Access Map

Status: current workspace, Lego, RACI, and access map for HOD review. This supersedes the earlier numbered-module delivery framing but does not change the frozen legal/control spine.

## 1. Operating shape

TaxMonWeb has six user-facing modules. Each module has a landing view and focused submodules. The application keeps one operational truth; dashboards, registers, calendars, clients and team views are projections of the same governed records.

```text
TaxMonWeb
├── Control Tower     What is happening?
├── Team              Who is delivering it?
├── Clients           Who are we servicing?
├── Work              What work needs to move?
├── BIR Center        What governed BIR reference do we rely on?
└── Admin             Who may access/change the system, and what happened?
```

## 2. Module / Lego map

| Module | Submodules | Boundary |
|---|---|---|
| Control Tower | Overview, attention/intervention, upcoming pressure, team/tower projection | Portfolio control view. It does not create a second work register. |
| Team | Overview, All People, Organization, teams/clusters/towers, coverage and assignment projection, person/team/cluster views | Operational people and structure. Not an HRIS. Client ownership remains linked to the canonical assignment. |
| Clients | All Clients, taxpayer profile, Tax Profile/2303, authorities, TMF setup, audit context, history, contract reference | Taxpayer and servicing context. Compliance setup is a connected capability, not a separate numbered module; its approved client universe and generated work remain distinct domain records. |
| Work | My Work, scoped work, Due Register, Calendar, work detail, lifecycle/components, evidence/history | Generated Compliance Work and execution. No duplicate Control Tower tracker. |
| BIR Center | Overview/map, tax types/forms, RDO/LTS directory, calendar/deadline reference, regulatory sources | Read-oriented projection of governed tax masters. It is not a second legal source. |
| Admin | Overview, Users & Access, Organization, Audit Trail, restricted governed configuration | Technical access/organization administration and audit visibility. System administration is not tax authority. |

QA/Tax Control remains a restricted control capability over the same Work and Client records. It is not an additional ordinary navigation module until its HOD module gate is approved.

## 3. Access levels

RACI answers accountability. It does not grant permission. Actual access is the intersection of capability, organizational scope, lifecycle stage, segregation of duties, RLS and server-side command authorization.

| Level | Meaning |
|---|---|
| NONE | No module access. Direct route/API access must fail. |
| VIEW | Read-only visibility within authorized scope. |
| ACT | Create or change operational records within scope and permitted stage. Historical facts are never deleted. |
| APPROVE | Record a governed approval/sign-off/control decision. This does not automatically grant edit authority. |
| GOVERN | Maintain controlled master, organization or configuration records within the capability boundary. |
| OVERRIDE | Exceptional, reason-required, actor-attributed and audited authority. It cannot fabricate an external fact. |

Prototype access lenses are a test harness for these boundaries. Production access must be derived from authenticated capabilities and scope on the server, not from the browser selector.

### Prototype module access profile

| Persona | Control Tower | Team | Clients | Work | BIR Center | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Preparer | View | View | View | Act | — | — |
| Checker | View | View | View | Act | — | — |
| Reviewer | View | View | View | Act | — | — |
| Tower Leader | Approve | Act | Act | Approve | View | — |
| Cluster Leader | Approve | Act | Act | Approve | View | — |
| Tax Control | View | View | Approve | Approve | Govern | — |
| HOD / Master Admin | Override | Act | Govern | Override | Govern | View |
| System Admin | — | Govern | — | — | — | Govern |
| Super Admin | Override | Override | Override | Override | Override | Override |

This is intentionally a module-level summary, not a universal CRUD grant. For example, Tax Control may validate a Tax Profile and perform QA, but is not automatically the operational Preparer, Checker, Reviewer or owner of every visible work item. System Admin may administer users and organization structure, but cannot approve tax controls merely by being an administrator.

Super Admin is the explicit combined authority. It may access all modules and governed actions, but it remains audited and cannot fabricate external facts, erase history, or erase actual-actor segregation-of-duties history.

## 4. Team and Clients action policy

This is the resolved working policy for the current Team/Clients prototype. It is deliberately action-specific: module visibility is not a blanket CRUD grant, and production enforcement still belongs to authenticated server-side capability, scope, RLS, actor history and audit checks.

| User / capability | Team row actions | Client ownership actions | RACI position |
|---|---|---|---|
| Preparer | View person, view operating signals and assignment context | View within authorized work scope | Responsible for assigned preparation; not roster authority |
| Checker | View person, view operating signals and assignment context | View within authorized work scope | Responsible for checking; not roster authority |
| Reviewer | View person, view operating signals and assignment context | View within authorized work scope | Responsible for review; view-only in Team and Clients |
| Tower Leader / Supervisor | Add, edit structure, move within scope, deactivate/retain history; view assignments | Manage recurring Preparer / Checker / Reviewer ownership within Tower scope | Responsible for operational staffing; accountable within Tower scope |
| Cluster Leader | Add, edit structure, move within scope, deactivate/retain history; view assignments | Manage recurring ownership within Cluster scope | Responsible and accountable for Cluster staffing/coverage |
| Tax Control | View people, structure, operating signals and assignment context | View/review client context within Tax Control scope; no ordinary roster edit | Consulted/control reviewer; not people administrator |
| HOD / Master Admin | Add, edit structure, move, deactivate/retain history; global visibility | Govern/reassign within approved scope | Accountable for the operating model and global intervention |
| System Admin | Administer technical identity/org records only; no tax-control approval | No client ownership authority | Responsible for technical administration; not tax authority |
| Super Admin | All actions, still audited and scope/SoD constrained | All actions, still audited and scope/SoD constrained | Combined explicit authority |

RAG is not a free-text person edit. Derived RAG remains a projection from governed operational facts. Where the workflow later exposes editable RAG inputs, Preparer and Checker may record applicable operating facts within assigned scope; Reviewer is view-only. No user may directly overwrite a derived RAG state or use it as a performance score.

The row action contract is therefore:

- `View` is available to every Team-visible persona.
- `Edit` means edit the person’s effective-dated structure, role, reporting line or operating model only when the policy grants it.
- `Retire` means deactivate and retain history; it is never destructive delete.
- `Clients` means open the canonical recurring-portfolio assignment surface. Team does not duplicate client ownership.

## 5. Proposed operational RACI

R = accountable operator for the activity, A = accountable decision owner, C = consulted, I = informed. This is a working RACI; exact assignment of A for particular approval types remains subject to the relevant module HOD gate.

| Activity | R | A | C | I |
|---|---|---|---|---|
| Control Tower portfolio monitoring | Tower/Cluster Lead | HOD | Tax Control | Authorized A&T users |
| Control Tower intervention routing | Tower/Cluster Lead | HOD | Tax Control, assigned Engagement Team | Affected team |
| People and operating structure | Tower/Cluster Lead / System Admin for technical identity | HOD for operating model; System Admin for technical administration | Tax Control | Affected users |
| Client Registry and TMF servicing setup | Engagement Team | Cluster Lead/HOD within scope | Tax Control | Work and Team views |
| Tax Profile correction | Authorized setup user / Tax Control | Tax Control or HOD within scope | Engagement Team | Assigned team |
| Tax Profile validation/activation | Tax Control | Tax Control/HOD authority | Engagement Team | Control Tower |
| Generated Compliance Work execution | Preparer → Checker → Reviewer by stage | Assigned Reviewer/authorized engagement owner | Client, Tax Control as applicable | Control Tower |
| Client approval and filing/payment evidence | Engagement Team | Assigned Reviewer/engagement accountability | Client, Tax Control as applicable | Control Tower |
| BIR master/rule/source governance | Tax Control | HOD / governed authority | System Admin for technical support | Authorized users |
| QA review and findings | Tax Control | Tax Control/HOD | Engagement Team | HOD/leadership |
| QA remediation / RCA | Engagement Team | Assigned Reviewer/engagement accountability | Tax Control | HOD/leadership |
| Users, authentication and organization administration | System Admin | System Admin | HOD/Tax Control for business impact | Affected users |
| Audit trail preservation and review | System/Admin for technical history; Tax Control for tax-control history | Relevant governance owner | HOD | Authorized users |

## 6. Non-negotiable action boundaries

- View does not imply edit, approve, reassign, govern or override.
- Preparer cannot self-check; Checker and Reviewer must remain distinct where required.
- System Admin cannot approve Tax Profiles, Compliance Universes, tax rules, QA findings or Elevated Overrides solely because they administer the system.
- Tax Control can inspect and control across scope but does not inherit Engagement Team execution ownership.
- Delete is not a normal action for history-bearing records. Use deactivate, archive, supersede, cancel or governed correction with append-only history.
- All material changes require actor, timestamp, effective date and reason where required.
- Direct URL/API access must be denied even when a button is hidden.

## 7. Remaining policy gates outside this Team decision

These are intentionally not guessed here:

1. The exact approval authority for a generated-work reassignment, reopen, cancel or supersede by work type.
2. The governed maker/checker pair for BIR master, deadline rule and calendar release changes.
3. Whether the HOD wants Admin visible as read-only context for HOD users or hidden unless technical administration is assigned.

The Team/Clients row-action policy above is resolved for this slice. These remaining items belong to later module gates and do not reopen Team people access.
