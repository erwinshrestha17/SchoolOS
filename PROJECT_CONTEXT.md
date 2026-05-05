# SchoolOS Project Context

This file gives Codex and other coding assistants a short, stable context file so repeated prompts can stay small.

For full project memory, read:

- `docs/project/SCHOOLOS_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md`
- `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md`
- `docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`

## Product

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

## Current Stage

Current delivery stage:

```text
Phase 1A completed
Phase 1B completed / pilot-ready
Current stage: Phase 2 Transition Readiness
```

Phase 2 work may continue, but it must stay focused and production-aware. Do not expand every Phase 2/3 module at once.

Recommended near-term direction:

```text
Run Phase 1 pilot hardening while completing one Phase 2 vertical at a time.
First preferred vertical: Academics / Exams / CAS / Report Cards.
Alternative vertical: HR / Payroll / Accounting posting hardening.
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

## Scalability Rule

SchoolOS scalability must be implemented as development continues, not postponed to the end.

Before every meaningful feature/module change, read:

```text
docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md
```

Every new feature must answer:

```text
1. Which tenant owns this data?
2. Which role/permission can access it?
3. Is the list paginated?
4. Which index supports the main query?
5. Does the write need a transaction?
6. Is the operation idempotent?
7. Should this be sync or queued?
8. Does it require audit logging?
9. Does it affect accounting/ledger?
10. What tests prove tenant isolation and permissions?
```

Scalability implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification.
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
Backend:  /tenant-settings/* or /settings/*
```

Typical roles:

- `TENANT_PRINCIPAL`
- `TENANT_ADMIN`

### Layer 3: School Operations Plane

For school staff and day-to-day operations.

Purpose:

- Manage students, attendance, fees, notices, activity feed, reports, and later academic/HR/library/transport/canteen/accounting workflows.

Recommended namespace:

```text
Frontend: /dashboard/*
Backend:  module APIs such as /students, /attendance, /finance, /notices
```

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for a school to configure itself.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Platform support/tenant override must be explicit and audited.

## Tenant Boundary

`tenantId` is the current database and Prisma tenant/school boundary.
Do not rename `tenantId` to `schoolId` unless a future migration is explicitly planned.

## Completed Phase 1A / 1B Areas

- Auth/RBAC/Tenant Isolation
- M1 Admissions/Student Management
- M2 Attendance
- M3 Fee Management
- M5 Activity Feed/Milestones
- M10 Notices/Communications/Consent
- Next.js dashboard shell and Phase 1 screens
- Cookie-first browser auth with httpOnly cookies
- Docker Postgres/Redis smoke script
- PDF response validation
- Browser/web smoke foundation
- Production preflight checks
- `verify:production` gate

## M0 Platform Core Additions Now Documented

The long-term memory includes a separate `M0 Platform Core` roadmap in `docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md`.

These features are documented for future implementation and should be added gradually without disrupting Phase 1 pilot hardening or focused Phase 2 vertical work:

1. Tenant Settings Module
2. Generic File Registry
3. Global API Response Envelope
4. Generic Reports Foundation
5. Safe Activity Logs Module
6. Usage Limits and Plan Rules
7. API Key Management
8. Webhook System
9. SaaS Subscription and Billing Module

Important distinction:

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using the platform.
```

Recommended near-term platform sequence:

1. Platform Control Plane depth for school/tenant management and operational health
2. Tenant Settings foundation
3. Generic File Registry hardening
4. Global API response envelope with safe binary/PDF/CSV exceptions
5. Reports foundation for Phase 1/2 reports
6. Safe Activity Logs projection
7. Usage limits and plan rules

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
- Do not start AI features until reliable production data exists.
- Do not copy generic SaaS-template modules blindly; adapt reusable platform pieces into SchoolOS only when they strengthen production readiness.

## Recommended Codex Prompt Format

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md

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
