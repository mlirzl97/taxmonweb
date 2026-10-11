# TaxMonWeb Team Module — Draft

> Status: planning draft. This file does not override the approved product, domain, RBAC, UX, or technical documents. It translates those decisions into an implementable Team module and Lego sequence.

## 1. Module purpose

Team is the operational organization map for A&T. It answers:

- who is active and where they sit in the approved organization;
- who reports to whom;
- which operating model a person belongs to;
- what portfolio or specialist-work signals are authoritative for that model;
- where a manager needs to intervene;
- how a person can be inspected without losing the current Team context.

Team is not an HRIS, payroll tool, performance-ranking tool, generic RBAC administrator, client assignment editor, or Tax Audit case-management system.

The module has one canonical people projection. The directory, hierarchy, drawers, workload summaries, coverage signals, and member-to-client/case drill-downs must all resolve from the same stable member IDs and effective-dated organization records.

## 2. Domain boundary

### Team owns or projects

- effective-dated team-member identity and active/inactive lifecycle;
- career service level and operating title;
- approved tower, cluster, team, and reporting relationship;
- operating model: `DELIVERY` or `SPECIALIST_CASE`;
- structure changes: add, promote, move, and deactivate;
- organization summaries and reporting-line projections;
- derived operational signals appropriate to the member's operating model;
- change history and unresolved structural conditions.

### Team reads from another canonical surface

- recurring taxpayer/client portfolio assignments, roles, and portfolio weight from Clients/Assignments;
- active generated work and attention from the canonical work projection;
- specialist case signals from the governed specialist-case interface.

Team must not create a second portfolio assignment system. A client added or reassigned is changed in Clients/Assignments; Team then reflects the resulting projection.

### Explicitly out of scope for this module

- full Tax Audit workflow or case lifecycle;
- new specialist-case types beyond the approved `Tax Audit` boundary;
- payroll, leave, compensation, performance ratings, or HR records;
- public individual leaderboards or workload ranking formulas;
- fine-grained RBAC administration;
- replacing historical records with destructive edits;
- converting specialist-case workload into portfolio weight.

## 3. Operating-model semantics

| Operating model | Accountability signal | Team display | Not allowed |
| --- | --- | --- | --- |
| Delivery | recurring portfolio assignments and derived portfolio weight | clients, portfolio weight, coverage, work attention where authoritative | treating a specialist case as portfolio ownership |
| Specialist cases | governed specialist-case assignments, beginning with Tax Audit | active cases, affected taxpayers, case attention/deadline signals when authoritative | showing `0 clients · 0 weight` as if the person is inactive or comparing case load numerically with portfolio weight |

Tax Team remains part of the same canonical organization. It is a cross-portfolio control mode/capability, not an additional hierarchy level.

The relationship is:

`Taxpayer → Specialist Case (Tax Audit) → Tax Team assignee(s)`

It does not rewrite the taxpayer's delivery ownership or Preparer/Checker/Reviewer assignments.

## 4. Team page information architecture

Team has three primary areas. Directory, hierarchy, digest, coverage, and assignment signals are views inside those areas—not separate modules.

### Overview

One management snapshot for the selected scope:

1. active people;
2. delivery taxpayers and delivery weight;
3. coverage gaps;
4. specialist-case attention;
5. roster changes and the next useful intervention.

Mixed operating models remain separate. A single total workload score is not valid. The digest routes portfolio changes to Clients and keeps specialist-case workflow outside Team.

### People & structure

One surface with two views:

- `Organization`: compact progressive-disclosure hierarchy with HOD/leadership context, expandable branches, quiet connectors, and person inspection in a right-side drawer;
- `Directory`: searchable operational index with operating-model-specific measures, effective-dated changes, and RACI-controlled row actions.

Both views project from the same stable member IDs and reporting relationships. A chart-only person is a defect.

### Workload & coverage

One projection of staffing pressure by approved area:

- Delivery rows show recurring taxpayers, portfolio weight, coverage gaps, and relevant work signals;
- Tax Team rows show specialist-case measures such as active Tax Audits, affected taxpayers, and case attention;
- no specialist workload is converted into portfolio weight;
- ownership changes route to Clients/Assignments rather than creating a Team shadow record.

### Action semantics

The directory exposes only the actions granted by the current RACI/access lens:

- `View` for every Team-visible persona;
- `Edit` for authorized structure changes;
- `Retire` for deactivation with history retained;
- `Clients` as the canonical recurring-ownership handoff.

RAG remains a derived operational projection. It is not a direct person edit.

## 5. Lego inventory

Each Lego should be independently useful when released and compose with the others.

### Lego 0 — Shared interaction shell

Reuse the existing `DetailDrawer` pattern from My Work for all Team mutations and inspection.

Includes:

- right-side drawer with backdrop, close button, Escape, focus trap, and focus restoration;
- action feedback, validation, and error placement;
- preserved search, expansion, focus, selection, and scroll context;
- consistent drawer titles and action hierarchy.

Done when every Team add/edit/inspect action uses one predictable interaction pattern.

### Lego 1 — Team overview digest

Provides the top-level answer for a manager without opening the chart.

Includes separate cards/summary rows for active people, delivery portfolio coverage, specialist cases, and structural follow-up. Suppress zero-value noise and avoid unsupported metrics.

### Lego 2 — Canonical roster directory

Provides the people index from stable IDs and effective-dated records.

Includes active/inactive filtering, search, operating-model labels, career levels, reporting context, and empty/loading/error states.

### Lego 3 — Organization structure projection

Provides tower/cluster/team context and reporting relationships.

Includes effective-dated `reportsTo`, approved structural labels, unresolved structural states, and scope-aware visibility.

### Lego 4 — Org chart navigation

Provides compact hierarchy navigation rather than a giant canvas.

Includes expand/collapse, focus mode, breadcrumbs, search-to-branch reveal, keyboard navigation, quiet connectors, and accessible tree semantics.

### Lego 5 — Person operational drawer

Provides a focused inspection surface without leaving Team.

Includes identity, operating title, career level, operating model, RAG/status text where authoritative, reporting line, model-appropriate workload signals, recent changes, and links to canonical Clients/work/case surfaces.

### Lego 6 — Roster lifecycle commands

Provides safe management of people and structure.

Supported transitions:

- add a new employee;
- promote or change career service level;
- change title or operating role;
- move tower/cluster/team or reporting line;
- change operating model only when current work is resolved or explicitly handled;
- deactivate/depart while retaining history;
- restore/reactivate only through an authorized effective-dated command when supported.

Every change records actor, effective date, before/after context, and reason where required. No destructive delete is used for an identity that has historical accountability.

### Lego 7 — Recurring portfolio projection

Provides delivery-team load and coverage from Clients/Assignments.

Includes assigned taxpayers/clients, role-aware ownership, derived portfolio weight, coverage gaps, and a route to edit the source assignment in Clients. It must never be editable as a Team-only shadow value.

### Lego 8 — Specialist-case projection boundary

Provides the interface for specialist work without implementing the case workflow.

The first governed type is `Tax Audit`. Team may display controlled fixture or authoritative signals such as active cases, affected taxpayers, assignee, and case attention/deadline state when available. It must not create portfolio weight or claim taxpayer ownership.

### Lego 9 — Change history and structural follow-up

Provides an auditable explanation of how the current organization came to be.

Includes recent roster events, effective dates, inactive people retained for history, open portfolio/case ownership warnings, and unresolved manager/reporting gaps. History is append-oriented.

### Lego 10 — Scope and authorization seam

Keeps the simple experience compatible with the frozen authorization model.

The UI may begin with straightforward scope filtering, but server-side authorization, organization scope, RLS, actual-actor rules, and command authorization remain mandatory before production persistence. Career level must never grant authority.

## 6. Core user journeys

### New employee

1. Open Team → Add employee.
2. Enter identity, title, career level, operating model, structure, and effective date.
3. Validate manager/cluster and operating-model consistency.
4. Save the roster change.
5. If Delivery, portfolio ownership is assigned separately in Clients/Assignments.
6. If Specialist cases, case ownership is assigned through the specialist-case surface when available.

### Promotion

1. Find the person in Directory or Organization.
2. Open Edit structure.
3. Change career level/title and effective date.
4. Preserve historical level and prior reporting context.
5. Recalculate only derived projections affected by the effective date.

### Internal move

1. Open the person drawer and choose Edit structure.
2. Change reporting line, tower, cluster, or team with an effective date.
3. Do not silently move recurring client ownership.
4. Surface any ownership/coverage follow-up in Team and route the assignment change to Clients.

### Resignation/departure

1. Open the person drawer and choose Deactivate / retain history.
2. Set effective date and inactive state.
3. Preserve the person, reporting history, assignments, and audit facts.
4. Warn about active portfolio or specialist-case ownership.
5. Reassign open work through its canonical surface before treating the transition as complete.

### New client

Create the client and taxpayer structure in Clients. Create or validate delivery assignments there. Team automatically reflects the resulting portfolio projection. Team may surface a coverage gap, but it does not become the source of the client or assignment.

### Tax Audit assignment

Create/manage the specialist case in the future specialist-case workflow. Team may show the resulting cross-portfolio signal. A Tax Team assignee does not become the taxpayer's recurring portfolio owner.

## 7. Validation and guardrails

- A member cannot be removed destructively once referenced by reporting, assignment, work, or case history.
- A member with active portfolio or specialist work cannot silently switch operating model.
- Deactivation preserves history and surfaces open ownership follow-up.
- Reporting-line changes must prevent invalid cycles and unresolved required parents.
- Effective dates cannot silently rewrite past accountability.
- Unsupported metrics remain unavailable or explicitly unresolved.
- RAG and workload are derived projections, not casually editable performance scores.
- Specialist-case workload is not converted to portfolio weight.
- Team actions cannot bypass SoD, RLS, or authorized command checks.

## 8. Recommended build order

1. Shared drawer and action feedback — already established through My Work pattern.
2. Canonical roster directory — current fixture projection; next production seam is repository/command persistence.
3. Structure projection and compact org navigation — current UI surface; harden effective dating and accessibility.
4. Lifecycle commands — add, edit, promote, move, deactivate with audited server-side commands.
5. Recurring portfolio projection — keep ownership mutations in Clients/Assignments.
6. Specialist-case projection seam — controlled Tax Audit fixture/interface only; no full workflow.
7. Overview digest and structural follow-up — derive from the same projections.
8. Scope/RBAC/RLS hardening and HOD acceptance testing.

Do not start a separate Team assignment database, generic HR module, or full Tax Audit workflow before the relevant domain owner review gate.

## 9. Acceptance gate for the Team module

The module is ready for freeze when:

- one person appears consistently in directory, chart, drawer, and projections;
- add, promotion, move, and departure preserve effective-dated history;
- a new client is created/assigned in Clients and becomes visible in Team without duplicate editing;
- Delivery and Tax Team metrics are separated and semantically honest;
- no Tax Team member is described as inactive because portfolio metrics are not applicable;
- a departure with open work produces an actionable follow-up rather than silent data loss;
- org navigation works at 70+ people without a giant canvas;
- keyboard and screen-reader users can understand hierarchy without relying on connector lines;
- unauthorized direct commands and out-of-scope mutations are denied server-side;
- lint, typecheck, tests, production build, and browser QA pass;
- the HOD can complete the core journeys without explanatory workarounds.
