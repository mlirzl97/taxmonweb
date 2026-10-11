# TaxMonWeb Agent Instructions

This repository implements TaxMonWeb. Coding agents must preserve the approved product, domain, workflow, RBAC, UX, technical architecture, and build-plan decisions.

## 1. Source of truth

Follow these approved documents, in this order of product/domain authority:

1. `00-PRODUCT-BRIEF.md`
2. `00A-DECISION-REGISTER.md`
3. `00B-DOMAIN-GLOSSARY.md`
4. `01-DOMAIN-MODEL.md`
5. `03-RULES-DEADLINES.md`
6. `02-WORKFLOWS-CONTROLS.md`
7. `04-RBAC.md`
8. `05-UX-DESIGN-SYSTEM.md`
9. `06-TECHNICAL-ARCHITECTURE.md`
10. `07-V1-BUILD-PLAN.md`

Locked decisions take precedence over implementation convenience. If approved documents appear contradictory, stop and surface the contradiction. Do not silently choose an interpretation.

The frozen product/domain spine is:

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA`

Generated Compliance Work is the work/control object created by TaxMonWeb. It does not mean that TaxMonWeb prepares or computes the tax return.

## 2. Product invariants

- Set up once. Generate automatically. Manage by exception.
- Automate what is deterministic. Flag what requires judgment.
- Every click must advance work, evidence a control, resolve an exception, or provide useful information.
- TaxMonWeb is a compliance monitoring/control system—not tax computation software, a DMS, filing platform, payment platform, or generic workflow engine.
- One operational truth powers My Work through All A&T. Never create duplicate trackers.

## 3. Philippine tax-content safety

Never invent Philippine tax content. Do not fabricate filing deadlines, forms, applicability, holiday adjustments, attachments, filing/payment requirements, or legal interpretations.

When approved tax content is unavailable, use an explicitly labelled illustrative test fixture or show an unresolved configuration state. Unknown must remain unknown. Never make a demo work by inventing compliance facts.

## 4. Core domain invariants

Preserve:

`Client → Taxpayer Entity → Registration Unit → Tax Profile → Expected Compliance → Compliance Obligation`

Obligation identity is:

`Registration Unit + Obligation Definition + Compliance Period + governed Instance Type`

Data Readiness is a prerequisite/control condition and is not automatically a Data Request workflow stage. For ordinary V1 return/submission work, Preparation → Checking → Review → Client Approval before Filing is mandatory. Payment Client Approval is separate from return Client Approval. QA is independent from Engagement completion and does not block statutory completion.

Also preserve effective dating, version history, historical snapshots/context, idempotent generation, append-oriented attempts/results/evidence, and current accountable owner versus actual actor.

The tax-knowledge foundation has one legal source of truth: `BIR Requirement Master`. `BIR Form Master`, Tax Type, BIR Jurisdiction/Office, Filing/Submission Channel, eFPS Group, and Requirement Component records are supporting governed masters, not parallel legal catalogs. `Obligation Definition`, if retained, is only generation/execution configuration referencing a Requirement Master version and must be merged/removed when it adds no behavior. Regulatory Issuance/Authority is reusable provenance with effective dates and inspectable citations.

Coverage Integrity is a derived projection `Expected → Generated → Executed → Evidenced`; detect gaps early, but classify severity from lifecycle/timing/legal context. Material rule/profile/universe changes must use impact analysis and an authorized, audited decision before rebase/regeneration/cancellation/supersession. Component statutory deadlines remain distinct from the TMF Package Target.

Operational monthly calendars require `Generate → Reconcile → Human Review → Approve → Release`. Released versions are immutable, maker-checker controlled, and may be partial only when unresolved populations are explicit and excluded from authoritative use. BIR Center is a shared, read-only encyclopedia/reference projection over canonical masters, not a second source of truth. All authenticated users may view it, but it does not author deadline rules, release calendars, generate obligations, or replace restricted Tax Configuration/Admin controls. BIR Officer identity and effective-dated office assignments are factual, source-backed reference data only; never add subjective officer ratings or unsupported allegations.

These distinctions are mandatory:

- Blocker ≠ Risk/RAG ≠ Exception
- Compliance Complete ≠ Control Complete
- Filed ≠ Paid
- Submitted ≠ Accepted
- Payment initiated ≠ Payment confirmed

Do not implement an approved derived status as a casually editable source-of-truth field.

## 5. Human-control invariants

AI/extraction may propose information, but cannot activate a Tax Profile, approve Expected Compliance, determine uncertain tax treatment, mark filing/payment/acceptance successful without required result/evidence, bypass required controls, fabricate external facts, or silently close unresolved compliance.

Actual actor history governs segregation of duties. Multiple capabilities do not permit self-check or self-review where distinct actors are required.

Elevated Override is exceptional, reason-required, visibly marked, and audited. It may bypass an authorized internal control where policy permits, but it can never fabricate an external fact.

## 6. Authorization

Never rely on UI visibility for security. Enforce authentication, RLS, organizational scope, server-side command authorization, actual-actor SoD, and elevated authority as applicable. Deny by default.

System Administration does not automatically grant tax-control authority. Super Admin is the explicit combined authority and may access all modules and technical/tax-control surfaces, but remains audited and cannot fabricate external facts, erase history, or erase actual-actor SoD. Never expose a Supabase service-role credential to the browser.

Current calibration exception: the sanitized prototype may present HOD as `Master Admin` and enable an explicit open-edit mode for Client/Profile fixture context. This mode is temporary, browser-persisted, and must never be treated as production authorization or used with real client data. Master Admin still cannot fabricate external facts, bypass validation truth, or erase actor/SoD history.

## 7. Data safety

Until explicitly approved otherwise:

- Local, preview, and demo environments use sanitized or synthetic data only.
- Do not use real TINs, client identifiers, addresses, contacts, documents, or SharePoint links.
- Never place real 2303s in public or preview environments.
- Temporary documents use private storage.
- Never commit uploaded documents, secrets, or sensitive fixture data to Git.

## 8. AI extraction

Preserve the provider abstraction `DocumentExtractionProvider`. Prototype extraction begins with `MockDocumentExtractionProvider` using the normalized contract.

Do not couple Tax Profile to a provider-specific response schema. Manual ChatGPT-assisted fixture preparation is development/benchmarking only. Do not automate personal ChatGPT credentials, sessions, cookies, or tokens, and do not make them an application dependency. Do not introduce self-hosted AI infrastructure.

## 9. Architecture constraints

V1 remains a Next.js/TypeScript modular monolith deployed primarily through Vercel with Supabase PostgreSQL, Auth, RLS, and private storage.

Do not introduce microservices, Redis, Kafka, Elasticsearch, Kubernetes, VMs, dedicated workers, a second database, generic workflow engines, or rules DSLs without an approved demonstrated requirement. Prefer the simplest managed implementation that preserves the domain.

## 10. UX constraints

Preserve the approved TaxMonWeb ant visual direction. The ant is product identity, not a decorative mascot.

Use Control Tower as the primary navigation label. Prefer progressive disclosure, concise language, exception-first views, and minimal clicks. Do not recreate Excel, Planner, or eNate in the browser.

Mobile/tablet experiences prioritize monitoring, intervention, review, and safe actions rather than reproducing every dense desktop workflow. Status must not depend on color alone.

## 11. Build discipline

Follow the active Lego backlog and the dependency order in `07-V1-BUILD-PLAN.md` unless a concrete dependency requires deviation. Implement the smallest complete capability inside its owning workspace; do not prebuild future architecture or create numbered “Module 02” work by assumption.

Before each slice:

1. Identify the relevant approved requirements.
2. State the implementation plan.
3. Identify migration, data, security, and environment implications.
4. Identify tests.

After each slice:

1. Run tests, lint, and typecheck.
2. Report what changed.
3. Report migration/configuration/environment changes.
4. Report test commands and results.
5. Report unresolved issues.
6. Stop at the designated domain-owner review gate when required.

Do not silently proceed past a review gate.

After the core freeze, organize work around the six user-facing workspaces: Control Tower, Team, Clients, Work, BIR Center, and Admin. Each workspace has a mini-dashboard/landing view and focused submodules or tabs. Build in Lego-sized capabilities: each Lego must include its user-visible projection, owning commands/queries, authorization boundary, effective-dated/history behavior, audit trail, and tests. Review each Lego with the HOD before extending it. People/Portfolio, Client Registry, BIR knowledge, Compliance Setup, Tax Run, QA, and management are capabilities placed in these workspaces—not a mandatory numbered module sequence. Due Register and Calendar belong to Work; Tax Team/QA and Super Admin are restricted views over shared truth. Do not elaborate downstream capabilities merely because they may eventually exist.

## 12. Database and change discipline

Do not create the entire future schema upfront. Add schema only when required by the current vertical slice. Migrations must be explicit and reviewable.

Preserve historical facts; do not correct history by deleting or replacing audit-relevant records. Commands vulnerable to retries or double submission must be idempotent. Use optimistic concurrency where approved.

## 13. Testing requirements

Every relevant slice requires positive and negative tests. High-risk tests must cover unauthorized direct access, RLS, SoD/self-check, idempotent generation, duplicate commands, stale updates, unresolved deadline/RAG, external-result strength, human Tax Profile validation, and Elevated Override restrictions.

A visually working demo with broken controls is not complete.

## 14. Scope discipline

Respect the V1 exclusions. Do not opportunistically add direct BIR integration, banking, tax computation, full SharePoint integration, SSO, Planner migration, generic workflow/rules engines, rich notifications, full Tax Audit case management, self-hosted AI, or microservices.

## 15. Ambiguity rule

When uncertain:

- Do not guess tax law.
- Do not weaken a control for convenience.
- Do not invent an external fact.
- Do not create a second source of truth.
- Do not expand scope because it is technically interesting.

Prefer a visible unresolved state and ask the domain owner.
