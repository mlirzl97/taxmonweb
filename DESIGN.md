# TaxMonWeb design philosophy

Status: active implementation contract

TaxMonWeb is a quiet compliance control desk. It should feel precise, calm, and
evidence-led when used repeatedly by people who need to find the next safe
action quickly. It is not a generic dashboard, a tax calculator, a filing
portal, or a database viewer.

## Non-negotiable principles

1. **One operational truth.** Every workspace reads the same client, profile,
   obligation, deadline, work, evidence, and history records. A view may filter
   or summarize them, but must not create a duplicate tracker.
2. **Exception-first scanning.** The first viewport answers what needs action,
   what is blocked, what is due, and what is complete. Counts always drill to
   their underlying records.
3. **Progressive disclosure.** Show the decision needed now. Put provenance,
   technical identifiers, and transaction history behind the relevant detail
   view or disclosure.
4. **One task per surface.** A page owns a collection; a drawer owns one
   record or one focused command; a dialog owns one confirmation or evidence
   capture. Do not stack competing edit/review/publish windows.
5. **Automate deterministic work.** Dates, targets, statuses, and generated
   relationships are derived where the rule is known. Human judgment is
   requested only where the record genuinely needs it.
6. **Audit without clutter.** Mutations retain actor, timestamp, reason, and
   before/after context. The default view shows the result; history is available
   in the record detail.
7. **Red is a signal, not decoration.** Brand red is reserved for the primary
   action, active navigation, urgent state, and controlled warnings. It is not a
   general-purpose accent for every component.
8. **Readable density.** Use compact rows and tables for scanning, but keep
   body text, labels, focus states, and touch targets readable. Never solve
   density by hiding the next action or shrinking primary text.

## Layout and navigation

- The six workspaces remain: Control Tower, Team, Clients, Work, BIR Center,
  and Admin. Restricted Tax Team views are contextual control surfaces, not a
  second application.
- Page headers place the page title and explanation on the left and the primary
  page action or scope controls on the right. On small screens they stack in
  that order.
- Panels group one decision surface. Avoid cards inside cards; use a section
  heading, a ruled list, or a table when the content is already structured.
- Rows are actionable only when the whole row is the action. Inline controls
  (filters, checkboxes, status controls) remain independent and have labels.
- Drawers open from the right, occupy one focused task, expose a clear close
  control, trap focus, close on Escape, and restore focus to the trigger.
- Dialogs are reserved for a short confirmation, an evidence capture, or a
  required reason. They do not repeat the surrounding drawer's context.

## Typography

- System UI/Inter is the product typeface: familiar, neutral, and legible.
- Page titles are compact and editorial; body copy is 13–14px with generous
  line-height; dense metadata may be 11–12px. Do not use 8–9px for required
  labels or actionable content.
- Uppercase letter-spaced text is reserved for eyebrows and table headers.
- Dates, counts, identifiers, and status values use tabular numerals.
- Labels describe the business meaning first. Technical IDs and provenance are
  secondary context, not the headline.

## Controls and mutation mechanics

- Use native `button`, `a`, `input`, `select`, `textarea`, `details`, and table
  semantics before custom interaction patterns.
- The primary action is one clear verb: **Save**, **Save and publish**,
  **Confirm**, or **Complete**. Secondary actions are quiet. Cancel is always
  available at the opposite edge of the action group.
- Add is placed in the page header or empty-state action area. Edit is the
  focused record action or direct row action; do not open a read-only drawer
  only to expose a second edit window.
- Delete is not used for governed or historical records. Use remove only for
  reversible local selections; use supersede for effective-dated records and
  retain the transaction trail. Any destructive local reset requires an explicit
  confirmation.
- Save feedback appears close to the changed surface and remains available to
  assistive technology through a polite live region.
- Disabled actions explain the missing prerequisite in nearby text; never make
  the operator guess why a button cannot be used.

## Temporary prototype access mode

- The sanitized prototype operates as one `Super Admin` persona with access to
  every module. The persona switcher and local Users & access editor are hidden
  so the prototype does not simulate an access model that has not been approved.
- This is a prototype presentation/operating policy only. Authenticated server
  capability checks, RLS, actor history, and segregation-of-duties controls are
  not bypassed. Role definitions can be restored by re-enabling the existing
  access matrix when the production access design is approved.

## Status and empty states

- Status never depends on color alone: pair tone with text, icon, or explicit
  label.
- Keep lifecycle, risk, blocker, exception, and control-complete concepts
  separate. Do not expose redundant gates such as “needs rule review” when the
  current workflow has already verified the date.
- Loading keeps the final layout stable. Empty states say why there is no data
  and offer the safe next action. Error states say what failed and how to retry.
- Unknown tax facts remain unknown; the UI may show an unresolved configuration
  state but must not invent a Philippine rule or deadline.

## Responsive and accessibility contract

- Target desktop at 1440×900, tablet at 768×1024, and mobile at 390×844.
- At mobile widths, dense tables become labeled row cards or deliberate
  horizontal scrollers; drawers become full-width sheets; actions remain
  reachable without horizontal overflow.
- Every icon-only control has an accessible name. Every form control has a
  visible label or an explicit accessible label. Focus is visible and trapped
  inside open modal surfaces. Escape and the close button both work.
- Minimum interactive target is 24px for web controls; primary mobile controls
  use a 40px visual target. Status and errors remain understandable in forced
  colors and without color perception.
- Respect reduced motion and do not use animation to communicate a state that
  is unavailable in text.

## Review gate

Any new module or mutation must be reviewed against this file, the approved
`05-UX-DESIGN-SYSTEM.md`, and the domain/control instructions in `AGENTS.md`.
The rendered audit record lives in `audit-artifacts/UI-UX-AUDIT.md` and the
machine-checkable evidence in `audit-artifacts/evidence.json`.
