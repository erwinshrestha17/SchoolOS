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
Current stage: Phase 2 implemented foundations + Phase 3 operations admin foundations
```

Phase 2 is no longer only “next”: the repo now contains real backend and web foundations for Academics, Homework/Timetable, HR/Payroll, Accounting, and Parent–Class Teacher Chat. Phase 3 Library, Transport, and Canteen also have backend models/APIs and web admin workspaces. Treat these areas as implemented foundations that need hardening, coverage, scale review, and UX completion rather than greenfield modules.

Recommended near-term direction:

```text
Run pilot hardening while deepening one existing vertical at a time.
Highest priority: accounting correctness, tenant isolation, reports, exports, and production verification.
Do not add parent/mobile, driver app, live map/WebSocket, AI, or broad new scope until the existing foundations are stable.
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

## Implemented Beyond Phase 1

- M4 Academics backend/web foundation: subjects, teacher assignments, exam terms, assessment components, marks, CAS, lock/review, report cards, result publishing, promotion, and PDFs.
- M6 Homework/Timetable backend/web foundation: timetable periods/slots/versions, conflict handling, substitutions, homework assignment/submission/review/reminders.
- M7 HR/Payroll backend/web foundation: staff records, contracts, staff attendance/leave, salary structures, payroll preview/runs/approval/posting, salary slips.
- M9 Accounting backend/web foundation: chart of accounts, fiscal years/periods, journal entries/lines, posting boundary, manual journals, expenses, reversals, reconciliation/report surfaces.
- M10 parent-teacher messaging foundation: conversations, participants, messages, read receipts, parent-class-teacher access rules, and web messaging routes.
- M8A Library admin foundation: books, copies, issue/return, overdue reminders, readable status badges, and pending placeholders for borrowed-student/fine/report endpoints.
- M8B Transport admin foundation: routes/stops, vehicles, driver/student assignments, trips, student trip statuses, logs, location pings/latest location, reports, and Phase 3 UX polish for admin monitoring.
- M8C Canteen admin foundation: menu items, meal plans, enrollments, serving, wallets/top-ups, POS sales, spending controls, reports, allergy/wallet badges, QR-style serving foundation, and inventory-later placeholder.

## Current Focus

1. Stabilize existing Phase 2 and Phase 3 admin foundations instead of starting new broad modules.
2. Harden M9 accounting correctness, immutable posting/reversal workflows, and module posting boundaries.
3. Improve production gates and fix unrelated contract-test drift before relying on `verify:production` as fully green.
4. Keep parent/mobile portal, driver app, live map/WebSocket, full inventory/vendor workflows, and AI/ML out of scope until the admin foundations are reliable.

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
