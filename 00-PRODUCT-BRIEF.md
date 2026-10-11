# TaxMonWeb Product Brief

## Purpose

TaxMonWeb is a Philippine tax-compliance monitoring and control system for TMF A&T. It gives the Engagement Team a dependable operating view of what must be prepared, checked, reviewed, approved, filed, paid, evidenced, and completed; it gives leadership a dependable view of what requires intervention.

TaxMonWeb controls and explains tax-compliance work. It does not compute tax, replace working papers or document management, file directly with BIR, execute bank payments, or become a generic workflow platform.

## Product promise

Set up once. Generate automatically. Manage by exception.

Automate what is deterministic. Flag what requires judgment.

## Frozen product spine

`BIR Requirement Master + Rules/Calendar → Client Compliance Profile → Generated Compliance Work → Engagement Execution → Completion → Independent QA`

Generated Compliance Work is the work/control object created by TaxMonWeb. It does not mean that TaxMonWeb prepares or computes the tax return.

## Operating truth

One operational truth powers My Work, Control Tower, Clients, Team, Due Register, Calendar, and management views. The product preserves the distinction between lifecycle, RAG/risk, blockers, exceptions, evidence/control state, and QA.

## Experience principles

- Make normal work quiet and intervention visible.
- Keep the surface simple while preserving legal, operational, and control detail underneath.
- Every interaction must advance work, evidence a control, resolve an exception, or provide useful information.
- Unknown tax content remains unresolved; approved sources and effective-dated history are required for governed decisions.

## V1 shape

V1 is a managed/serverless-first Next.js/TypeScript modular monolith deployed primarily through Vercel and Supabase. The user-facing product is organized as six coherent workspaces:

1. **Control Tower** — what is happening and what needs intervention;
2. **Team** — who is delivering it;
3. **Clients** — who TMF is servicing;
4. **Work** — what work needs to move;
5. **BIR Center** — which governed BIR reference data TaxMonWeb relies on;
6. **Admin** — who may access or change the system, and what happened.

Each workspace has a compact landing view and focused submodules/tabs. Due Register and Calendar belong inside Work; Tax Team/QA and Super Admin are restricted capability views over the same records, not additional ordinary top-level workspaces.

Development follows a Lego approach rather than a fixed numbered-module sequence: build the smallest complete capability, connect it to the owning workspace and shared projections, add the required CRUD, authorization, effective history, and audit trail, then review and extend it. “Module 02” and the earlier sequential module order are retired delivery labels, not product boundaries.

Locked decisions in the Decision Register and approved domain, workflow, RBAC, UX, technical architecture, and build-plan documents take precedence over this concise restatement and over implementation convenience.
