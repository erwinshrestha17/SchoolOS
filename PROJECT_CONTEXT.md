# SchoolOS Project Context

This file gives Codex and other coding assistants a short, stable context file so repeated prompts can stay small.

For full project memory, read:

- `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md`
- `docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`
- `docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`

Merged into master memory:

```text
Phase structure
Scalability roadmap
M9 Accounting completion details
M11 Intelligence / AI roadmap
Pricing tiers and entitlements plan
```

Do not recreate separate Phase Structure, Scalability, M9, M11, or Pricing/Entitlements docs unless the project becomes large enough to justify splitting them again.

## Product

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

## Current Stage

Current delivery stage:

```text
Phase 0 completed
Phase 1A completed / pilot-ready
Phase 1B completed / pilot-ready
M0 Platform Core Foundation Depth completed
Phase 2A M4 Academics backend completed / contract-protected
Phase 2D M9 Accounting production-candidate complete
Current stage: Backend Sprints 1-4 hardening complete on top of Phase 2A backend + M0 platform foundation + M9 production-candidate completion
```

The repo is ahead of older Phase 1B/Phase 2-transition notes. Phase 2A Academics backend is complete. M9 Accounting is production-candidate complete. Foundations now exist for Homework/Timetable, HR/Payroll, Parent Communication/Messaging, Library, Transport, and Canteen.

Current work should focus on stabilization, correctness, scale, permissions, tests, verification, and admin UX polish for existing modules rather than opening broad new product fronts.

Recommended near-term direction:

```text
Post-hardening pilot readiness sprint
→ run Docker-backed smoke with Postgres, Redis, and API running
→ add seeded authenticated browser smoke credentials
→ wire Phase 2A Academics admin UI to completed APIs
→ expand M6/M7/M8 vertical hardening one module at a time
→ prepare controlled pilot staging
```

Explicitly deferred unless requested:

```text
Parent/mobile portal
Driver app
Live transport map/WebSocket UI
Full canteen inventory/vendor workflows
Broad SaaS billing automation
AI/ML implementation
Microservices
Angular migration
```

## Stack

- Monorepo: `pnpm`
- Backend: NestJS modular monolith
- Database: PostgreSQL with Prisma
- Cache/queues: Redis + BullMQ
- Shared package: `packages/core`
- Current frontend: Next.js dashboard in `apps/web`
- Future frontend target:
  - `apps/web` = public website, SEO/admissions/public pages
  - `apps/admin` = Angular internal dashboard later

Do not migrate to Angular yet.
Do not introduce microservices unless clearly justified.
Do not rename `tenantId` to `schoolId`.

## Current Backend/API Module Snapshot

Implemented or registered backend foundations now include:

- Auth/RBAC/Tenant Isolation
- M0 Platform Core: platform tenant control, tenant settings, file registry, reports, usage service, plan service foundations
- M1 Admissions & Student Profiles, including secure Student QR credential foundation
- M2 Smart Attendance
- M3 Fees & Receipts
- M4 Academics, Exams, CAS, Report Cards backend completion
- M5 Activity Feed & Milestones
- M6 Homework & Timetable foundation with backend entitlement hooks and conflict/lifecycle test coverage
- M7 Staff/HR and Payroll foundation
- M8A Library Management admin foundation
- M8B Transport Management admin/trip/location foundation
- M8C Canteen Management admin/wallet/POS foundation
- M9 Accounting & Finance production-candidate completion
- M10 Notices, Notifications, Communications, Messaging / Parent-Class Teacher foundation
- M11 School Intelligence & Analytics roadmap only

Treat Phase 2/3 modules as foundation/admin-ready unless verified locally. Several GitHub-connector PRs noted that full local verification was not run in the connector environment. Production readiness still requires local/staging verification.

## Readiness

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after Docker-backed smoke and seeded staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

## Module Completion Estimate

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
M4 Academics backend: complete / contract-protected
M9 Accounting: production-candidate complete
```

Approximate module status:

```text
Auth/Security/Tenant: 90-95%
M0 Platform Core: 80-90%
M1 Students: 90-95%
M2 Attendance: 85-90%
M3 Fees: 85-90%
M4 Academics: 80-90%
M5 Activity: 75-85%
M6 Homework/Timetable: 70-80%
M7 HR/Payroll: 65-75%
M8A Library: 45-55%
M8B Transport: 45-55%
M8C Canteen: 45-55%
M9 Accounting: 95-100%
M10 Communications: 85-90%
M11 Intelligence/AI: 0% implementation
```

## Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

```text
Platform Control Plane: /platform/*
Tenant Configuration Plane: /dashboard/settings/*
School Operations Plane: /dashboard/*
```

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for a school to configure itself.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Platform support/tenant override must be explicit and audited.
- For the full school-settings vs platform-settings boundary, read `docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md`.

## Tenant Boundary

`tenantId` is the current database and Prisma tenant/school boundary.
Do not rename `tenantId` to `schoolId` unless a future migration is explicitly planned.

## Scalability Rule

SchoolOS scalability is now documented in the master memory and must be applied during development, not postponed to the end.

Every new feature must answer:

```text
1. Which module owns this feature: M0 or M1-M11?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
13. If pricing/tiered access is involved, which feature key, entitlement, and usage limit controls access?
14. If intelligence/AI is involved, is the output explainable and human-reviewed?
```

Scalability implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification.
```

## M9 Accounting Rules

M9 Accounting is production-candidate complete, but all rules remain strict:

```text
- Immutable posted journals.
- Reversal/correction instead of silent edits.
- Double-entry debit = credit enforcement.
- OPEN/LOCKED/CLOSED fiscal period control.
- Source document linkage for every journal.
- AccountingPostingService boundary for other modules.
- Decimal/numeric money only.
- Backend ledger reports only.
- Audit posting, approval, reversal, closing, reopening, reconciliation, and exports.
```

## M11 School Intelligence & Analytics Roadmap

M11 is documented in the master memory as the Phase 4 intelligence and analytics layer. Do not implement M11 product features yet.

Rules:

```text
- Roadmap/documentation can be updated now.
- Implementation waits until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment, fee blocking, suspension, payroll decision, or public teacher ranking from AI/risk scores.
- Human review is required before AI output becomes official communication or record.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
```

## Pricing and Entitlement Rules

Pricing tiers and entitlement rules are documented in the master memory.

Golden rule:

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

Do not hardcode plan names into feature access logic. Use feature keys.

## Core Rules

- Backend-first for data integrity.
- UI must consume real APIs, not fake production data.
- Every tenant-owned query must be tenant-scoped.
- Every list endpoint must use pagination/filtering for growing data.
- Every new high-volume query must include an index review.
- Every business-critical write must be audited.
- Platform actions affecting tenants must be audited.
- Keep the modular monolith structure.
- Prefer small, focused tasks over broad rewrites.
- Move slow, retryable, provider, report, and PDF work to BullMQ workers.
- Redis is for cache, queue, latest-value, and rate-limit style use cases; PostgreSQL remains source of truth.
- Do not start AI feature implementation until the M11 event/snapshot/risk-score foundation is approved and reliable production data exists.
- Do not start broad SaaS billing automation until platform plan/subscription boundaries are approved.
- Do not copy generic SaaS-template modules blindly; adapt reusable platform pieces into SchoolOS only when they strengthen production readiness.

## Verification Gate

Run relevant checks after meaningful changes:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1
```

## Recommended Codex Prompt Format

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md when planning execution order
- docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md when touching platform/settings boundaries

Task:
[Exact feature/change]

Constraints:
- Do not rewrite unrelated files.
- Keep the NestJS modular monolith structure.
- Keep all tenant-owned queries tenant-scoped by tenantId.
- Keep platform routes separated from tenant/school routes.
- Add pagination/filtering for growing list endpoints.
- Add or review indexes for new high-volume query patterns.
- Move slow/retryable/provider/report/PDF work to BullMQ where appropriate.
- Add validation, error handling, audit logs, and tests where needed.
- Run the relevant verification commands.
- Return summary, files changed, scalability decisions, tests, verification results, and remaining gaps only.
```
