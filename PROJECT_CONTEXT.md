# SchoolOS Project Context

This is the short context file for Codex and AI assistants. It keeps repeated prompts small.

For full project memory, read:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Supporting focused references:

```text
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md
```

Legacy long roadmap files have been consolidated into the master memory:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_PHASE_STRUCTURE.md
docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
docs/project/SCHOOLOS_PROJECT_MEMORY.md
docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md
```

---

## Product

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Current stage: Phase 2 Transition Readiness
```

Phase 2 work may continue, but it must stay focused and production-aware. Do not expand every Phase 2/3 module at once.

Recommended near-term direction:

```text
Run Phase 1 pilot hardening while completing one Phase 2 vertical at a time.
First preferred vertical: Academics / Exams / CAS / Report Cards.
Alternative vertical: HR / Payroll / Accounting posting hardening.
```

---

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

Rules:

- Do not migrate to Angular yet.
- Do not introduce microservices unless clearly justified.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.

---

## Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

| Plane | Audience | Frontend Namespace | Backend Namespace |
|---|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School principal/admin | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | School staff/parents/students | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices` |

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for a school to configure itself.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Platform support/tenant override must be explicit and audited.
- For the full school-settings vs platform-settings boundary, read `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md`.

---

## Tenant Boundary

`tenantId` is the current database and Prisma tenant/school boundary.

Do not rename `tenantId` to `schoolId` unless a future migration is explicitly planned.

---

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

---

## Current Phase 2 Focus

Phase 2 should proceed one vertical at a time:

1. Preferred: M4 Academics / Exams / CAS / Report Cards.
2. Alternative: M7 HR / Payroll with M9 posting hardening.
3. Keep M6 Timetable/Homework focused if started.
4. Do not start broad Phase 3 production work yet.
5. Do not start AI/ML features yet.

---

## Scalability Rule

SchoolOS scalability must be implemented as development continues, not postponed to the end.

Every new feature must answer:

```text
1. Which module owns this feature: M0 or M1-M10?
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
```

Scalability implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification
```

---

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

---

## Recommended Codex Prompt Format

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md

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
