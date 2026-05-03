# SchoolOS Project Context

This file gives Codex and other coding assistants a short, stable context file so repeated prompts can stay small.

For full project memory, read:

- `docs/project/SCHOOLOS_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`

## Product

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

## Current Stage

Current delivery stage:

```text
Phase 1A completed -> Phase 1B Completion Sprint -> Phase 2 later
```

Do not start Phase 2 unless explicitly requested.

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

## Completed Phase 1A Areas

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
- `verify:production` passes

## Phase 1B Priority Order

1. Student Management depth
2. Fee/Finance depth
3. Attendance reports/history
4. Notification center/read/retry UI
5. Activity media storage/signed preview
6. Global search/header actions
7. Playwright browser smoke tests
8. PDF visual polish

## M0 Platform Core Additions Now Documented

The long-term memory now includes a separate `M0 Platform Core` roadmap in `docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md`.

These features are documented for future implementation and should be added gradually without disrupting Phase 1B:

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

Recommended near-term platform sequence after the next Student Management detail slice:

1. Platform Control Plane foundation where needed for school/tenant management
2. Tenant Settings foundation
3. Generic File Registry
4. Global API response envelope with safe binary/PDF/CSV exceptions
5. Reports foundation for Phase 1B reports
6. Safe Activity Logs projection
7. Usage limits and plan rules

## Core Rules

- Backend-first for data integrity.
- UI must consume real APIs, not fake production data.
- Every tenant-owned query must be tenant-scoped.
- Every business-critical write must be audited.
- Platform actions affecting tenants must be audited.
- Keep the modular monolith structure.
- Prefer small, focused tasks over broad rewrites.
- Do not start AI features until reliable production data exists.
- Do not start Phase 2 until Phase 1B priorities are completed or explicitly deferred.
- Do not copy generic SaaS-template modules blindly; adapt reusable platform pieces into SchoolOS only when they strengthen production readiness.

## Recommended Codex Prompt Format

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md

Task:
[Exact feature/change]

Constraints:
- Do not rewrite unrelated files.
- Keep the NestJS modular monolith structure.
- Keep all tenant-owned queries tenant-scoped by tenantId.
- Keep platform routes separated from tenant/school routes.
- Add validation, error handling, audit logs, and tests where needed.
- Run the relevant verification commands.
- Return summary, files changed, tests, verification results, and remaining gaps only.
```
