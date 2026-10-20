# TaxMonWeb UI/UX audit

Date: 2026-10-17
Scope: all app routes, shared shell, lists/tables, forms, drawers, dialogs,
mutation controls, responsive behavior, and previously unverified Work detail
states.

## Executive result

The product direction is coherent and intentionally restrained: white working
surfaces, warm-neutral page background, ant/red signal identity, ruled lists,
compact tables, and right-side detail drawers. The main risk was not the visual
identity; it was drift in interaction mechanics. The audit therefore makes the
shared shell and drawer contract the enforcement point instead of introducing a
new component library or a second theme.

## Route and submodule coverage

| Workspace | Routes / submodules checked | Primary interaction contract |
| --- | --- | --- |
| Control Tower | `/app/control-tower`, Due Register, Calendar, Exceptions | Filter → scan → open one Work detail drawer |
| Team | `/app/team`, Directory, Structure, My Work | Scope/filter → inspect → edit only when authorized |
| Clients | `/app/clients`, Registry, CRF, client dossier | Scope/filter → open client dossier → contextual edit drawer |
| Client dossier | `/app/clients/[clientId]`, registration, profile, compliance, service calendar | Read shared truth; mutate through one focused command surface |
| Work | `/app/work`, My Work, Due Register, Calendar, Exceptions | Queue → Work detail → one evidence/status dialog at a time |
| Work detail | `/app/work/[workId]` | Progression and evidence, not tax computation; history remains append-oriented |
| BIR Center | `/app/bir-center`, Tax map, directory, updates | Read-only governed reference; no authoring controls |
| Admin | `/app/admin`, Users & access, templates, local fixture reset | Explicit capability; reason-required changes; destructive local reset confirms |
| Tax Team | `/app/tax-team`, reports, QA, RCA, Deadline Control, Period locks | Shared operational truth with restricted control actions |

## Interaction audit

### Windows and drawers

- The shared `DetailDrawer` is the canonical record surface. It has a labelled
  dialog role, close button, backdrop close, Escape close, focus capture, focus
  trap, body scroll lock, and focus restoration.
- Work evidence and period-lock surfaces are focused dialogs rather than
  competing record drawers. Their primary action is on the right and Cancel is
  on the left.
- Nested client previews are treated as progressive disclosure and use the
  existing stacked-drawer mechanism. No new modal framework is required.

### Add / edit / remove

- Add actions belong in the page header or the empty state; the shared header
  action pattern is reused by client intake, CRF, team, and deadline control.
- Row selection opens the record directly. Detail-to-edit is used where the
  record needs context; inline edit is used only for compact, local changes.
- Governed records are not deleted. Deadline history uses supersession and
  append-oriented events. Local fixture reset is the one destructive action and
  is explicitly confirmed.
- Save feedback is local to the changed surface and exposed through status/live
  messaging where the component already provides it.

### Typography and density

- The system uses Inter/system UI and a small set of neutral/red/semantic
  tokens. The title and eyebrow hierarchy is consistent across workspaces.
- Existing dense metadata is intentionally smaller, but required labels and
  primary controls are not treated as decorative metadata. The design contract
  now forbids shrinking primary content below readable sizes.
- Dates and counts are tabular-number candidates and remain aligned in tables.

### Responsive audit

- Desktop: sidebar + main operating surface; tables retain their scan order.
- Mobile: sidebar becomes a focus-trapped module drawer; headers and toolbars
  stack; dense registers become labelled row patterns or intentional scrollers;
  record drawers become full-width.
- Work detail uses container-aware layout so the drawer's width, not the browser
  width, drives its timeline and evidence layout.

## Previous skip / verification closure

- Dynamic Work detail states are exercised by the E2E suite: row → detail,
  direct detail route, certification dialog, payment-not-applicable branch,
  status dialog, evidence capture, period locks, and close/restore behavior.
- Mobile navigation and mobile overflow are exercised at 390×844. Additional
  rendered route evidence is recorded in `evidence.json`.
- The earlier seven expectation failures and interrupted test were not silently
  accepted as product behavior; the current verification run is the authority:
  54 passed and 2 intentional skips.
- The final axe sweep found zero violations across the 30 route/viewport renders
  and the dynamic Work detail drawer at all three target widths.
- The sanitized prototype now exposes one Super Admin operating mode across all
  modules. The temporary persona switcher and Users & access editor are hidden;
  the underlying authenticated capability/RLS model remains intact for later
  access design.

## Remaining risks

- Live Supabase paths cannot be fully proven with sanitized fixture mode alone.
- The live service calendar now reads the published monthly-calendar boundary;
  authenticated Supabase migration/query verification remains outstanding.
- Legacy deadline status values remain in the domain compatibility layer. They
  should be retired only with a data migration and approved domain decision,
  not by presentation-only renaming.
