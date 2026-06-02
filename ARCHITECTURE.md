# SchoolOS Architecture

This file is intentionally concise. The full source of truth is:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Read this file for stable architecture rules, then use the master memory and current repo analysis for module scope, phase structure, platform core, scalability, and current repo status.

For code-file modularization guidance, also read:

```text
docs/project/SCHOOLOS_CODE_FILE_MODULARIZATION_PLAN.md
```

---

## Architecture Style

SchoolOS uses a **NestJS modular monolith first**.

Reasons:

- School workflows are highly connected: admissions, attendance, fees, notices, payroll, and accounting share transactional data.
- A modular monolith is easier to build, test, deploy, and audit at the current stage.
- Microservices would add distributed transaction and deployment complexity too early.

Microservices should only be considered later if scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.

Important distinction:

```text
Code-file modularization is required as the repo grows.
Code-file modularization means splitting huge services, controllers, components, hooks, helpers, and API clients into focused files inside the existing modular monolith.
It does not mean microservices, separate deployments, route rewrites, tenantId renames, or product-plane separation into different apps.
```

---

## Current Stack

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Mobile app: Flutter companion app in apps/schoolos_mobile
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep using `apps/web` for the current dashboard.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Do not introduce microservices only to separate product planes or modules.
- Do modularize large code files gradually by business/screen responsibility when working on M0-M10 and future modules.

---

## Current Implementation Snapshot

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend/admin UI: Completed
Student QR Foundation: Implemented / release hardening remains
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: M0 platform foundation complete + Phase 1 pilot-ready core + Phase 2 foundations + M4 academics backend/admin UI complete + Student QR foundation implemented + M9 production-candidate completion + Phase 3 operations admin foundations
```

Current readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Important architecture implication:

```text
The repo is now broad. The next architecture priority is not module expansion.
The next priority is verification, stabilization, service/schema alignment, tenant isolation tests, authenticated browser smoke tests, one-vertical-at-a-time hardening, and opportunistic code-file modularization in touched areas.
```

---

## Three-Plane SaaS Architecture

SchoolOS has three logical product planes inside the same modular monolith. These are access, routing, and responsibility boundaries, not separate services.

| Plane | Purpose | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS company/operator administration | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School-owned settings/configuration | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | Daily school workflows | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/homework`, `/timetable`, `/payroll`, `/accounting`, `/library`, `/transport`, `/canteen` |

Plane rules:

- Platform Control Plane manages SaaS/customer administration.
- Tenant Configuration Plane manages one school's own settings.
- School Operations Plane manages day-to-day school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Do not allow school users to access `/platform/*` routes.
- Platform support/tenant override must require an explicit reason and audit log.
- Keep all planes inside the modular monolith for now.

---

## Repository Shape

Expected high-level structure:

```text
apps/
  api/              NestJS backend
  web/              Current Next.js dashboard and later public website
  schoolos_mobile/  Flutter parent/teacher/student/admin companion app
  admin/            Future Angular internal dashboard, not now
packages/
  core/             Shared validation, types, contracts, permissions
docs/
  project/          Master memory, plans, and roadmaps
```

Current implementation snapshot:

- Phase 1 school operations are pilot-ready in `apps/web` and `apps/api`.
- Phase 2A Academics backend/admin UI is complete and contract-protected.
- Student QR identity foundation is implemented, with release hardening and PDF verification still required.
- Phase 2D M9 Accounting is production-candidate complete.
- Phase 2 foundations exist for Homework/Timetable, HR/Payroll, and Parent-Class Teacher Chat.
- Phase 3 admin/backend foundations exist for Library, Transport, and Canteen, with reports, QR/scan foundations, and inventory/location/POS depth depending on the vertical.
- The Flutter mobile companion app has started under `apps/schoolos_mobile`; deeper parent/driver/live transport experiences remain gated behind purpose-limited APIs, ownership tests, and staging verification.

Suggested frontend namespaces inside `apps/web`:

```text
/platform/*           Platform Control Plane
/dashboard/settings/* Tenant Configuration Plane
/dashboard/*          School Operations Plane
```

---

## Backend Architecture Rules

- Organize by business modules, not technical layers only.
- Keep controllers thin.
- Put business rules in services/domain-oriented classes.
- Validate all external input with DTOs/schemas.
- Use Prisma transactions for multi-step business writes.
- Use module boundaries to prevent unrelated modules from writing each other's internal data directly.
- Keep platform modules under M0 Platform Core or equivalent platform-oriented modules.
- Keep tenant/school modules under their domain modules: M1 through M11.
- Other modules must not directly write accounting ledger rows; they must use `AccountingPostingService` or a clear accounting boundary.
- When a service/controller grows too large, split it into focused files by subfeature, such as query service, command service, workflow service, reports service, exports service, jobs, and pure helpers.
- Keep existing public routes stable during file-level modularization unless a route change is explicitly requested.

---

## Frontend Architecture Rules

- Keep large dashboard workspaces as thin shells where possible.
- Split large workspace files into tab components, smaller UI components, hooks, and pure utilities.
- Keep existing UI/UX stable during file-level modularization unless a redesign is explicitly requested.
- Keep domain API clients separated from the base HTTP client.
- Do not let `apps/web/lib/api/client.ts` become a dumping ground for module-specific API methods.

---

## Database Architecture Rules

- PostgreSQL is the source of truth.
- `tenantId` is the tenant/school boundary.
- Every tenant-owned table must include `tenantId` unless explicitly global metadata.
- Every tenant-owned query must filter by authenticated tenant context.
- Platform/global metadata such as plans, platform users, and SaaS billing records must be clearly separated from tenant-owned school operations data.
- Use PostgreSQL numeric/Prisma Decimal for money.
- Never use JavaScript floating point for money.
- Add indexes for common tenant-scoped queries.
- Prefer database constraints where correctness must be guaranteed.
- Treat recent schema/service drift reports as stabilization blockers before expanding new features.

---

## Auth and Tenant Isolation

- Browser auth is cookie-first with httpOnly access and refresh cookies.
- API bearer tokens are used by the Flutter mobile app and remain supported for API clients.
- Tenant context is seeded from verified auth/session data.
- Super-admin tenant override must be explicit, validated, and audited.
- Frontend should not be trusted for access control.
- RBAC and tenant isolation must be enforced server-side.
- Platform roles must be separate from tenant roles.
- Platform APIs require platform permissions.
- Tenant APIs require tenant permissions and tenant ownership.

---

## Queue and Background Work

Use Redis + BullMQ for:

- Notification delivery.
- SMS/email/push provider work.
- Retryable background jobs.
- Scheduled operational tasks.
- Heavy exports or report generation.
- PDF generation when heavy/batch-oriented.
- Media processing/compression.
- Payroll/report-card batch work where needed.
- Future transport ETA/location fanout jobs.

Provider failures must not crash core business transactions.

---

## File and Media Architecture

- Use private object storage for documents and media.
- Store object keys, not permanent public URLs.
- Serve downloads/previews through signed URLs or protected API access URLs.
- Student documents, photos, activity media, homework attachments, receipts, report cards, payslips, and exports must remain tenant-scoped.
- Activity media should support compression for Nepal low-bandwidth environments.
- Generic File Registry belongs to M0 Platform Core and should provide reusable file metadata across modules.

---

## M8B Transport GPS Strategy

Transport live-tracking is built for high-concurrency GPS ingestion without compromising database stability.

1. **Latest-Value Cache**: Every GPS ping is stored in Redis for real-time tracking (6-hour expiry). This serves the real-time "Latest coordinate" API without touching PostgreSQL.
2. **Throttled Persistence**: GPS pings are persisted to PostgreSQL only if the previous ping for that specific trip was more than 30 seconds ago. This prevents write-pressure on the primary database during active tracking.
3. **Retention Policy**: Location history is for operational auditing, not permanent storage. A 90-day retention policy is enforced; older coordinates are cleaned up to keep the `TransportLocationPing` table performant.
4. **Tenant Isolation**: All location data is strictly scoped by `tenantId` and `tripId`. Drivers can only ping their assigned trips; parents can only view their assigned child's trip location.

---
