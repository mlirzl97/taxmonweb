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

V1 is a managed/serverless-first Next.js/TypeScript modular monolith deployed primarily through Vercel and Supabase. Initial module order is Client Registry & Tax Profile, Compliance Setup, BIR Requirement Master/Rules/Calendar, Tax Run/Filing Execution, Control Tower/My Work, Tax Team QA, and Gamification/Management.

Locked decisions in the Decision Register and approved domain, workflow, RBAC, UX, technical architecture, and build-plan documents take precedence over this concise restatement and over implementation convenience.
