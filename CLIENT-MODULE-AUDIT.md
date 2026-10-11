# Client module cycle audit

Status: architecture and UX audit for the next Lego-sized Client module slice. The first Lego adjustment (derived Overview and client activity projection) is now implemented; the remaining gaps below are intentionally not hidden.

This audit follows the approved hierarchy and product spine. It does not create a second obligation tracker, infer tax treatment, or author the approved Compliance Universe or Generated Compliance Work records owned by connected Work capabilities.

## 1. The client cycle

```text
Client relationship
  → Taxpayer Entity
    → Registration Unit
      → Registration sources / 2303
        → Tax Profile version
          → Expected Compliance approval
            → Generated work and client activity
              → Exceptions, history, and control evidence
```

The Client module should be the context and drill-down surface for this cycle. It should not own tax computation, external filing, banking, or a second work tracker.

## 2. Current-state audit

| Lego block | Current state | Audit result |
|---|---|---|
| Client register | 112 sanitized records, search/filter/sort, assignment visibility | Usable portfolio-scale read surface; add flow is still a browser-local draft |
| Client identity | Client, entity, and registration-unit concepts exist in fixtures and repository migrations | Domain shape is correct; creation of multiple entities/units is not yet a complete UI flow |
| Registration facts | Profile shows TIN, unit type, RDO/LTS, address, fiscal year, filing context, tax types | Good profile read surface; several values are still uncontrolled fixture text rather than canonical references |
| Registration sources | Temporary 2303 upload/extraction/review exists per Registration Unit | Correct lifecycle boundary; onboarding source-pack metadata is currently local-only and not multi-document persisted |
| Tax Profile | Versioned save and explicit validation path exist | Strong control boundary; validation is too easy to reach from a long dossier and needs a clearer Lego stepper/handoff |
| Client transactions / activity | Derived client activity block now rolls up work, calendar, and exceptions | First slice implemented; contract/source/profile events still need a unified persisted activity projection |
| Client mini-dashboard | Derived Overview block now sits above the dossier | First slice implemented; metrics remain projections, not stored KPI truth |
| Contract Repository | Master Engagement plus Additional Engagement/CRF branches are represented | Correct hierarchy; management actions are still read-only in the profile |
| Team and scope | Current assignment, Tower/Cluster, team history, and edit drawer exist | Reuse Team as source of assignment truth; do not duplicate staffing data inside Clients |
| Exceptions and audit | Attention banner, BIR audit exposure, profile history exist | Good base; needs client-level roll-up of operational exceptions and activity |
| Downstream handoff | Work items and calendar reference client IDs | Linkage exists for fixtures; the client workspace does not yet expose it as a transaction/activity view |

## 3. Lego boundaries

### Lego A — Client relationship

Owns the commercial relationship identity, lifecycle state, client reference, and link to one Contract Repository. It does not own legal tax identity or obligations.

### Lego B — Taxpayer and registration structure

Owns Taxpayer Entities and Registration Units. One Client may have many entities; one entity may have many head-office/branch Registration Units. This is where Add Entity and Add Registration Unit belong.

### Lego C — Registration source pack

Owns source-document identity, source references, status, provenance, and the temporary 2303 processing boundary. ATP and other documents are source records; applicability must not be invented.

### Lego D — Tax Profile

Owns versioned source-derived and professionally determined facts, corrections, validation, effective dates, and activation history. It is not the source pack and not Expected Compliance.

### Lego E — Commercial engagements

Owns the Contract Repository tree:

```text
Contract Repository
  ├── Master Engagement: MSA / LSA / Addendum
  └── Additional Engagement: CRF
```

An Additional Engagement does not create a new Client or Taxpayer Entity.

### Lego F — Operating setup

Owns accountable Preparer/Checker/Reviewer, Tower/Cluster, Service Scope, payment route, eNATE context, and workload projection. Assignment truth remains related to Team.

### Lego G — Client activity / transactions

For the first slice, this should mean derived operational records: engagement/CRF changes, source submissions, profile changes, generated work, client approval, filing/payment-control facts, exceptions, and audit exposure. It must not become an accounting transaction ledger or tax computation surface.

The exact meaning of “client transactions” still needs HOD confirmation if it is intended to include billing, collections, invoices, or client commercial transactions.

### Lego H — Client mini-dashboard

Overview is a derived projection over the other blocks. It should answer:

- Who is this client and which Registration Unit is selected?
- What is the current setup/validation state?
- What requires attention now?
- What work/activity is open or upcoming?
- Who owns the client?
- What is the next useful action?

It must not create a new status or KPI source of truth.

## 3A. Add / edit / modify action audit

| Area | Correct action entry point | Current prototype position |
|---|---|---|
| Client relationship | Add client setup-pending record; edit relationship identity | Intake drawer currently saves a sanitized local draft; server-backed command is still required |
| Taxpayer Entity | Add/edit entity identity under the Client | Not yet exposed as a complete UI command |
| Registration Unit | Add/edit head office or branch under the Entity | Existing fixtures/profile switcher show units; add-unit command is missing |
| Registration sources | Add source reference; upload temporary 2303; review/correct/validate | 2303 path exists; multi-source pack persistence is missing |
| Tax Profile | Edit a proposed version with reason; validate explicitly | Existing profile drawers and persistence boundary exist |
| Contract Repository | Add/edit MSA/LSA/addendum or CRF in the correct branch | Read-only in the Client profile; repository commands exist in migration direction but are not wired here |
| Team & scope | Assign through canonical Team records; preserve effective history and SoD | Team module owns the editable assignment surface |
| Activity / transactions | Inspect underlying record; act in its owning module | Correctly read-only projection in the Client module |
| Mini-dashboard | No direct editing; links to the owning block/action | Correct derived projection behavior |

## 4. Recommended client workspace

Use contextual sections/tabs rather than one long dossier:

1. Overview
2. Client & registration details
3. Client activity / transactions
4. Contract Repository
5. Team & scope
6. Sources and validation
7. History / audit

The selected Registration Unit remains visible in the context header. Expected Compliance and Obligations should be linked when those downstream slices are available, but the Client module should not prebuild their full authoring workflows.

## 5. Lego build order

1. **Client shell and context** — stable route, Client → Entity → Registration Unit header, tabs, back-state.
2. **Client/entity/unit CRUD** — create and edit setup-pending records; prevent duplicate references; support multiple units.
3. **Source pack** — typed source references and statuses, private temporary 2303 handoff, resumable intake.
4. **Tax Profile** — extraction review, correction, provenance, validation, version history.
5. **Contract Repository** — manage MSA/LSA/addendum and CRF records separately from registration data.
6. **Team & scope** — use canonical Team hierarchy and audited effective-dated assignments.
7. **Client activity / transactions** — derived view over existing work, calendar, exceptions, source, contract, and profile history.
8. **Client mini-dashboard** — derived Overview projection over the completed blocks.

Each block should have its own positive/negative tests, empty state, unresolved state, edit command, and audit/history behavior before the next block is expanded.

## 6. Immediate corrections identified

- Stop treating Start client setup as if it creates a complete Client Profile. It creates an intake/setup-pending record.
- Move branch/entity creation out of a one-off drawer and into the Client/entity/unit block.
- Replace the profile’s long single-page reading burden with contextual sections while preserving the existing strong identity, attention, source-review, and audit areas.
- Add a derived client activity/transactions view using existing work/calendar/exception data; do not create a second tracker.
- Add a derived client Overview mini-dashboard; do not store duplicate summary KPIs.
- Keep Contract Repository management separate from registration/source setup.
- Keep assignment edits related to Team and preserve actual-actor/SoD controls.
- Persist source-pack metadata server-side before real client registration data is introduced. Browser-local drafts are only safe for the sanitized prototype.

Implemented in the first adjustment:

- Added a client workspace section bar for Overview, registration, activity/transactions, contracts, Team & scope, sources/validation, and history/audit.
- Added a derived client mini-dashboard with setup state, attention, open activity, BIR audit exposure, accountability, and next action.
- Added a derived activity/transactions block sourced from existing My Work, Calendar, and Control Exceptions records.

## 7. Decisions required before expanding the transaction block

1. Does “client transactions” mean operational compliance activity only, or also billing/invoicing/collections?
2. Should client-level activity include CRF and master-engagement events, or should those remain only in Contract Repository with a compact roll-up?
3. Which client-level actions may be performed by which capabilities: maintain relationship, maintain registration, correct Tax Profile, manage contracts, assign team, and approve compliance?

Until those are answered, the safe implementation is an operational activity projection, not a new financial or tax-transaction domain.
