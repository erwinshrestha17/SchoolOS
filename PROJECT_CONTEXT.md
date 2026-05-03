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
2. Global API Response Envelope
3. Generic Reports Foundation
4. Safe Activity Logs Module
5. Usage Limits and Plan Rules
6. API Key Management
7. Webhook System
8. Generic File Registry
9. SaaS Subscription and Billing Module

Important distinction:

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using the platform.
```

Recommended near-term platform sequence after or alongside Phase 1B depth:

1. Tenant Settings foundation
2. Global API response envelope with safe binary/PDF exceptions
3. Reports foundation for Phase 1B reports
4. Safe Activity Logs projection
5. Usage limits and plan rules

## Core Rules

- Backend-first for data integrity.
- UI must consume real APIs, not fake production data.
- Every tenant-owned query must be tenant-scoped.
- Every business-critical write must be audited.
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
- Add validation, error handling, audit logs, and tests where needed.
- Run the relevant verification commands.
- Return summary, files changed, tests, verification results, and remaining gaps only.
```
