# SchoolOS Architecture

This file is intentionally concise. The full source of truth is:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Read this file for stable architecture rules, then use the master memory for module scope, phase structure, platform core, scalability, and current repo status.

---

## Architecture Style

SchoolOS uses a **NestJS modular monolith first**.

Reasons:

- School workflows are highly connected: admissions, attendance, fees, notices, payroll, and accounting share transactional data.
- A modular monolith is easier to build, test, deploy, and audit at the current stage.
- Microservices would add distributed transaction and deployment complexity too early.

Microservices should only be considered later if scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.

---

## Current Stack

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep using `apps/web` for the current dashboard.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Do not introduce microservices only to separate product planes or modules.

---

## Three-Plane SaaS Architecture

SchoolOS has three logical product planes inside the same modular monolith. These are access, routing, and responsibility boundaries, not separate services.

| Plane | Purpose | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS company/operator administration | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School-owned settings/configuration | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | Daily school workflows | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices` |

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
  api/      NestJS backend
  web/      Current Next.js dashboard and later public website
  admin/    Future Angular internal dashboard, not now
packages/
  core/     Shared validation, types, contracts, permissions
docs/
  project/  Master memory, plans, and roadmaps
```

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
- Keep tenant/school modules under their domain modules: M1 through M10.

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

---

## Auth and Tenant Isolation

- Browser auth is cookie-first with httpOnly access and refresh cookies.
- API bearer tokens remain supported for future mobile/API clients.
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

Provider failures must not crash core business transactions.

---

## File and Media Architecture

- Use private object storage for documents and media.
- Store object keys, not permanent public URLs.
- Serve downloads/previews through signed URLs.
- Student documents, photos, activity media, and receipts must remain tenant-scoped.
- Activity media should support compression for Nepal low-bandwidth environments.
- Generic File Registry belongs to M0 Platform Core and should provide reusable file metadata across modules.

---

## M9 Accounting Architecture

Full M9 Accounting belongs to Phase 2, but Phase 1B finance ledger foundations can continue.

Strict rules:

1. Confirmed ledger entries are immutable.
2. Use reversal/correction/adjustment entries instead of silent edits.
3. Enforce double-entry: total debit must equal total credit.
4. Enforce fiscal period states: OPEN, LOCKED, CLOSED.
5. Every journal must link to a source document.
6. Other modules must post through `AccountingPostingService` or a clear accounting boundary.
7. Use Decimal/numeric for all money.
8. Journal, voucher, and receipt numbers must be unique per tenant and fiscal year.
9. Reports must come from backend ledger data, not frontend calculations.
10. Audit posting, approval, reversal, closing, reopening, and exports.

---

## Verification Commands

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
