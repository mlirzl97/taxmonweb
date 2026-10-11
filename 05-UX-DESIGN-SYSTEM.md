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
