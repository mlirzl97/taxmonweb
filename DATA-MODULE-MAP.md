# TaxMonWeb data and module map

This is the verified relational map for the current repository. It is based on the tracked Supabase migrations, server repositories, API routes, domain adapters, and user-facing route modules. It describes the current implementation, then identifies the smallest safe simplifications.

## Audit scope

- 80 unique application tables in 64 workspace migrations, with unique version prefixes enforced by `npm run migration:check`.
- 19 API route handlers and 13 App Router page routes.
- Six primary workspaces: Control Tower, Team, Clients, Work, BIR Center, and Admin.
- Restricted Tax Team views over shared deadline, calendar, work, period-lock, and audit truth.
- A duplicate same-timestamp migration snapshot was removed from the workspace; the canonical `20261108000000_work_execution_commands.sql` remains the only migration for that change.

## The one domain spine

```text
BIR Requirement Master
  + Requirement Version -> Forms / Components
  + Rule Version -> Deadline Policy -> verified source
  + Monthly Calendar Version -> Monthly Calendar Entry
                                      |
                                      +-- Tax Team publishes operational date
                                      +-- Publication history
                                      v
Client -> Taxpayer Entity -> Registration Unit
                              |
                              +-- source references / authorities
                              +-- Tax Profile Version
                              |      +-- office / filing / tax-type context
                              |      +-- effective-dated assignments
                              |      +-- selected compliance universe
                              v
                    Generated Compliance Work
                      + components
                      + process steps / gates / checklist
                      + evidence / QA / period locks
                      + append-only work events
                              |
                              v
          Work, Control Tower, Tax Team reports, and Client Calendar
          are projections of the same records; they are not separate trackers.
```

## Module-to-data ownership

| Workspace / submodule | Reads | Writes / commands | Relationship to the spine | Current state |
| --- | --- | --- | --- | --- |
| Control Tower: overview, attention | `generated_compliance_work`, work children, client/team projections | none directly; opens Work or Team actions | Portfolio projection of generated work, ownership, deadlines, and RAG | Live shell is present; live team-progress and work data remain data-dependent |
| Team: overview, people, organization, coverage | `app_users`, `team_member_profiles`, history, org units, client/unit assignments | team profile and roster commands; structure is still prototype-local in places | Defines accountable people and scope used by Client and Work | Mixed live/prototype; organization editing is not a complete live command surface |
| Clients: registry | `clients`, `taxpayer_entities`, `registration_units`, scope, assignments, contracts | client setup and onboarding source commands | Creates the registration-unit anchor used by Tax Profile and Work | Live repository path exists; onboarding remains a hybrid prototype/live boundary |
| Clients: profile / tax profile | `tax_profile_versions`, source refs, authorities, relational context, audit snapshots | save and validate Tax Profile; versioned history | Converts registration evidence into the current effective Tax Profile | Versioned persistence exists; full Expected Compliance activation flow is incomplete |
| Clients: service calendar | published monthly calendar projection plus client applicability | none; opens Tax Team when held | Client-facing projection of released dates only | Local live API resolves selected forms, reads released/published calendar entries, and uses the shared projection; remote policy/schema reconciliation and authenticated pilot remain pending |
| Clients: authorities / history | `registration_authorities`, change events, `audit_events` | authority/profile commands | Evidence and historical context for a Registration Unit | Persistence exists; presentation is narrower than the data model |
| Work: My Work / team work / due register | `generated_compliance_work` and all execution children | work commands, checklist, gates, evidence, QA, period lock | Operational anchor for execution | Strongest live vertical slice |
| Work: detail | one generated-work record plus children | command RPCs with idempotency and SoD checks | Executes one obligation instance | Live command boundary and history exist |
| Work: calendar | released monthly calendar entries and generated-work dates | none | Operational date projection | Repository support exists; client calendar live wiring is incomplete |
| BIR Center | verified tax masters, BIR offices, reference calendar | read-only reference | Encyclopedia/reference projection; never the operational source | Read-only boundary is correct |
| Tax Team: deadline control | `monthly_calendar_versions`, `monthly_calendar_entries`, publication events | save/publish/supersede deadline command | Governs the operational date used downstream | Direct publish path exists; hidden source-code gate removed while provenance/history remain preserved |
| Tax Team: reports / QA / RCA / audit | generated work, evidence, QA, transaction reviews, audit events | transaction-review commands and work QA commands | Control projections over Work, not a second work store | Mixed live/fixture depending on report |
| Admin: users/access/org/audit | users, capabilities, scopes, org, audit | provisioning/access commands; some views remain placeholders | Controls who may read or command the spine | Access foundation is present; organization and audit screens are not equally complete |
| Admin: account preferences | `user_preferences`, private avatar storage | authenticated theme and avatar preference commands | Account-owned presentation preferences, separate from operational and client truth | Local live-mode API and RLS/storage boundary are implemented; remote migration review remains pending |

## Table inventory by responsibility

### 1. Identity, authorization, and scope

`organization_units`, `app_users`, `capabilities`, `user_capability_assignments`, `user_scope_assignments`, `team_member_profiles`, `team_member_profile_history`.

Relationships:

```text
auth.users -> app_users
app_users -> capability assignments -> capabilities
app_users -> scope assignments -> organization_units
app_users -> team_member_profiles -> organization_units
team_member_profiles -> team_member_profile_history
organization_units -> organization_units (parent/child)
```

This is the authorization foundation. UI visibility is only a convenience; server capability checks, scope checks, RLS, and actual-actor history remain authoritative.

### 2. Client identity and registration evidence

`clients`, `taxpayer_entities`, `registration_units`, `registration_unit_scope_assignments`, `registration_source_references`, `client_onboarding_source_items`, `registration_authorities`.

Relationships:

```text
clients -> taxpayer_entities -> registration_units
registration_units -> organization_units (effective scope)
registration_units -> registration_source_references
registration_units -> client_onboarding_source_items
registration_units -> registration_authorities
```

`registration_source_references` is the durable registration evidence pointer. `client_onboarding_source_items` is the intake/control record for the setup process. They should not be shown as two competing source lists; the UI should present one evidence view with intake state and canonical reference linked.

### 3. Tax Profile and client applicability

`tax_profile_versions`, `tax_profile_change_events`, `tax_profile_office_context`, `tax_profile_filing_context`, `tax_profile_registered_tax_types`, `registration_unit_team_assignments`, `client_compliance_universe_items`, `client_groups`, `client_group_memberships`, `tax_audit_exposure_snapshots`.

Relationships:

```text
registration_unit -> tax_profile_versions (immutable effective-dated snapshots)
tax_profile_version -> office context
tax_profile_version -> filing context -> filing channel / eFPS group
tax_profile_version -> registered tax types -> tax type master
tax_profile_version -> unit assignments -> app_users
registration_unit + requirement/version -> client_compliance_universe_items
client -> client_group_memberships -> client_group
tax_profile_version + registration_unit -> audit exposure snapshot
```

The Tax Profile version is the canonical snapshot. The child context tables are queryable relational projections, not independent profile truths. `client_compliance_universe_items` is the applicability projection; it must not become a second deadline or work table.

### 4. Governed tax knowledge and source provenance

`regulatory_issuances`, `regulatory_issuance_citations`, `tax_types`, `bir_forms`, `bir_offices`, `filing_channels`, `efps_groups`, `bir_requirements`, `bir_requirement_versions`, `requirement_version_forms`, `requirement_version_sources`, `rules`, `rule_versions`, `rule_version_sources`, `deadline_policies`, `deadline_policy_sources`, `requirement_components`, `holiday_master`, `coverage_integrity_observations`, `impact_analysis_cases`.

Relationships:

```text
regulatory_issuance -> citations
regulatory_issuance -> source-link tables for each governed master
bir_requirement -> requirement_version -> forms / components / source links
rule -> rule_version -> source links
deadline_policy -> source links
requirement_component -> deadline_policy and optional independent requirement
efps_group -> filing_channel
holiday_master -> regulatory_issuance
```

`BIR Requirement Master` remains the legal requirement spine. Forms, tax types, offices, channels, and eFPS groups are supporting governed masters. The repository must not surface them as parallel legal catalogs.

### 5. Calendar and deadline control

Operational tables:

`monthly_calendar_versions`, `monthly_calendar_entries`, `deadline_publication_events`.

Reference-only tables:

`published_calendar_entries`, `published_calendar_entry_sources`, `monthly_calendar_entry_sources`, `bir_facilities`, `facility_filing_channels`, `bir_officers`, `bir_officer_office_assignments`, `tax_audit_officer_assignments`, plus their source links.

The important distinction is:

```text
BIR/reference calendar import
  -> published_calendar_entries (reference snapshot only)

Tax Team controlled operational calendar
  -> monthly_calendar_versions
  -> monthly_calendar_entries
  -> deadline_publication_events
  -> released operational date
```

The two calendar entry tables intentionally represent different facts, but their columns are similar and the relationship is indirect. The UI should show only the operational calendar in Deadline Control and only the reference calendar in BIR Center.

### 6. Generated Compliance Work and execution

Anchor:

`generated_compliance_work`.

Children:

`generated_compliance_work_components`, `generated_compliance_work_events`, `generated_work_process_steps`, `generated_work_gate_attempts`, `generated_work_checklist_updates`, `generated_work_evidence`, `generated_work_qa_findings`, `generated_work_period_lock_events`, `generated_compliance_period_locks`.

Relationships:

```text
registration_unit + requirement + requirement_version
  -> generated_compliance_work (idempotent generation_key)
generated_work -> components / steps / gates / checklist / evidence / QA / lock events
period_key -> generated_compliance_period_locks
```

This is the correct operational anchor. Work, My Work, Control Tower, Tax Team reports, and QA must all query or project from it. The child tables are append-oriented history and control evidence, not separate workflow trackers.

### 7. Engagement and contract context

`contract_repositories`, `master_engagements`, `master_engagement_documents`, `additional_engagements`.

Relationships:

```text
client -> contract_repository -> master_engagement -> master_engagement_documents
contract_repository -> additional_engagements
```

This is client context, not a compliance obligation or execution record. Keep it out of the Work status model.

### 8. Specialized control and temporary boundaries

`audit_events`, `tax_team_transaction_reviews`, `temporary_source_documents`.

- `audit_events` is the cross-command audit trail.
- `tax_team_transaction_reviews` is a Tax Team population/control record; it currently stores labels and period text rather than durable foreign keys, which preserves a snapshot but limits navigation.
- `temporary_source_documents` is a private-storage metadata boundary for the temporary 2303 flow; it is not the Tax Profile or a document-management system.

## Verified simplification plan

### Keep one operational deadline spine

Use `monthly_calendar_entries` as the sole operational deadline row. Keep `published_calendar_entries` only as the BIR Center/reference projection. Do not join both into the same operational table or present both to users.

The user-facing deadline state can be reduced to:

```text
published | unresolved | superseded
```

The database still contains legacy `generated`, `needs_review`, and `confirmed` values for migration compatibility. They should be translated at the domain boundary, not presented as additional gates. A later forward-only migration can retire them after data is normalized.

### Compose assignment views instead of merging authority

Keep both assignment tables because they answer different questions:

- `client_team_assignments`: portfolio-level accountability.
- `registration_unit_team_assignments`: unit-level execution and SoD.

Expose one composed “Accountability” projection in Client and Work screens. Do not show two competing assignment panels.

### Make profile-to-work linkage explicit at the application boundary

The current generated-work row stores requirement/version and dates, while calendar/applicability lineage is partly carried in `source_context` JSON. This is workable for the prototype but makes impact analysis and client-calendar refresh harder.

The smallest safe improvement is to make the repository/query contract return the lineage together (`registration_unit`, active Tax Profile version, selected universe item, calendar entry) before adding new columns. Only add a foreign key after the live generation query and backfill strategy are approved.

### Collapse status language by responsibility

Do not use one generic “status” to mean all of these:

- source verification;
- deadline publication;
- client applicability;
- work lifecycle;
- RAG risk;
- control completion;
- external filing/payment outcome.

Keep the underlying fields where they protect a real invariant, but show the shortest relevant state in each workspace. This follows the approved distinction between Blocker, Risk/RAG, Exception, Compliance Complete, Control Complete, Filed, Paid, Submitted, and Accepted.

### Use one history projection

`audit_events` is the cross-module audit source. Specialized histories remain where they carry domain detail (`tax_profile_change_events`, `generated_compliance_work_events`, `deadline_publication_events`). The UI should compose them into one “who / when / what changed / why” trail instead of exposing separate empty or redundant history widgets.

## Gaps found while doing the requested audit

1. **Live client service calendar is now wired at the read boundary.** The client projection uses the published monthly-calendar repository through `/api/clients/[clientId]/service-calendar`; the new RLS boundary exposes only published rows from released calendar versions. Live Supabase migration/query verification remains outstanding.
2. **Expected Compliance is not a complete live vertical slice.** The applicability table exists, but the full profile → approved universe → idempotent generation path is not represented by a complete user-facing command/query flow.
3. **Calendar lineage is indirect.** Generated work has no foreign key to a monthly calendar entry or compliance-universe item; it uses requirement/version plus date fields and `source_context`.
4. **Deadline legacy states still leak through domain/UI compatibility.** Direct publish exists, but `needs_review`, `generated`, and `confirmed` remain in types, summary counts, fixtures, and transition constraints.
5. **Some Admin and Team surfaces are placeholders or hybrid.** The persistence foundation is stronger than the live editing UI for organization, access matrix, audit presentation, and some team progress views.
6. **Reference-only tax officer/audit structures are not a current workflow.** Their tables are source-backed reference context and should not be treated as a Tax Audit case-management module.
7. **Migration history needs reconciliation.** Local migration versions are now unique, but the connected Supabase project has a different, older migration ledger and must be reconciled before deployment.

## Recommended implementation order

1. Verify the live released-calendar query against a migrated Supabase pilot; do not add a new table.
2. Translate deadline legacy states to the three user-facing states at the domain boundary; keep history and database compatibility intact.
3. Add the explicit profile/universe/calendar lineage to live repository query results before changing schema.
4. Finish the Expected Compliance command/query slice and make its generated work command idempotent.
5. Only then consider a forward-only schema contraction of redundant columns or tables.

This order preserves history, avoids a second tracker, and fixes the visible operational gap before attempting structural deletion.
