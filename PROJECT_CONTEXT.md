# SchoolOS Project Context

This file gives Codex and other coding assistants a short, stable context file so repeated prompts can stay small.

For full project memory, read:

- `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md`
- `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md`
- `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md`
- `docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md`
- `docs/project/SCHOOLOS_PRICING_TIERS_AND_ENTITLEMENTS_PLAN.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`

## Product

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

## Current Stage

Current delivery stage:

```text
Phase 0 completed
Phase 1A completed / pilot-ready
Phase 1B completed / pilot-ready
Current stage: Phase 2 implemented foundations + Phase 3 operations admin foundations
```

The repo is ahead of the older Phase 1B/Phase 2-transition notes. Phase 2 foundations now exist for Academics, Homework/Timetable, HR/Payroll, Accounting, and Parent Communication/Messaging. Phase 3 admin foundations now exist for Library, Transport, and Canteen. M0 platform control, tenant settings, file registry, reports, usage, and plan-service foundations also exist.

Current work should focus on hardening, correctness, scale, permissions, tests, verification, and admin UX polish for existing modules rather than opening broad new product fronts.

Recommended near-term direction:

```text
Run controlled pilot hardening while deepening one existing vertical at a time.
Highest priority: M9 accounting correctness, production verification, tenant isolation, reports/exports, API/UI contract alignment, and Phase 2/3 admin foundation stabilization.
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
- M1 Admissions & Student Profiles
- M2 Smart Attendance
- M3 Fees & Receipts
- M4 Academics, Exams, CAS, Report Cards
- M5 Activity Feed & Milestones
- M6 Homework & Timetable
- M7 Staff/HR and Payroll
- M8A Library Management admin foundation
- M8B Transport Management admin/trip/location foundation
- M8C Canteen Management admin/wallet/POS foundation
- M9 Accounting & Finance foundation and hardening work
- M10 Notices, Notifications, Communications, Messaging / Parent-Class Teacher foundation

Treat Phase 2 and Phase 3 modules as foundation/admin-ready unless verified locally. Several recent GitHub-connector PRs noted that full local verification was not run in the connector environment, so production readiness still requires local/staging verification.

## Readiness

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

## Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

### Layer 1: Platform Control Plane

For the SchoolOS company owner/internal platform team.

Purpose:

- Manage all schools/tenants.
- Manage plans, subscriptions, SaaS billing, limits, support access, and platform audit.

Recommended namespace:

```text
Frontend: /platform/*
Backend:  /platform/*
```

Typical roles:

- `PLATFORM_SUPER_ADMIN`
- `PLATFORM_SUPPORT`
- `PLATFORM_BILLING_ADMIN`

### Layer 2: Tenant Configuration Plane

For each school principal/admin.

Purpose:

- Manage school logo, branding, settings, academic year, receipt preferences, attendance lock time, fee reminder rules, notification rules, and future chat availability hours.

Recommended namespace:

```text
Frontend: /dashboard/settings/*
Backend:  /settings/* or /tenant-settings/*
```

Typical roles:

- `TENANT_PRINCIPAL`
- `TENANT_ADMIN`

### Layer 3: School Operations Plane

For school staff and day-to-day operations.

Purpose:

- Manage students, attendance, fees, notices, activity feed, reports, academics, HR/payroll, library, transport, canteen, accounting, and future intelligence dashboards.

Recommended namespace:

```text
Frontend: /dashboard/*
Backend:  module APIs such as /students, /attendance, /finance, /notices, /academics, /homework, /timetable, /payroll, /accounting, /library, /transport, /canteen
```

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for a school to configure itself.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Platform support/tenant override must be explicit and audited.
- For the full school-settings vs platform-settings boundary, read `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md`.

## Tenant Boundary

`tenantId` is the current database and Prisma tenant/school boundary.
Do not rename `tenantId` to `schoolId` unless a future migration is explicitly planned.

## Scalability Rule

SchoolOS scalability must be implemented as development continues, not postponed to the end.

Before every meaningful feature/module change, read:

```text
docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md
```

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

## Pricing Tiers and Entitlements Roadmap

SchoolOS commercial packaging is documented as:

```text
Tier 1: SchoolOS Core
Tier 2: SchoolOS Professional
Tier 3: SchoolOS Intelligence
Optional add-ons: Transport GPS, Canteen, Library, SMS Pack, AI Credits, Branded Parent App, Advanced Accounting, Custom Reports
```

Technical rule:

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

Do not hardcode plan names across the app. Use feature keys such as `module.exams`, `module.transport`, `module.intelligence`, `feature.ai_teacher_assistant`, and `feature.parent_teacher_chat`.

## M11 School Intelligence & Analytics Roadmap

M11 is documented as the Phase 4 intelligence and analytics layer. Do not implement M11 product features yet.

Rules:

```text
- Roadmap/documentation can be updated now.
- Implementation waits until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment, fee blocking, suspension, payroll decision, or public teacher ranking from AI/risk scores.
- Human review is required before AI output becomes official communication or record.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
```

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

## Recommended Codex Prompt Format

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
- docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md
- docs/project/SCHOOLOS_PRICING_TIERS_AND_ENTITLEMENTS_PLAN.md when touching plans, pricing, subscriptions, feature access, or UI gating

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
