# SchoolOS Architecture

This file records the stable architecture decisions for SchoolOS. Keep this concise. Detailed module scope belongs in `docs/project/SCHOOLOS_PROJECT_MEMORY.md`.

## Architecture Style

SchoolOS uses a modular monolith first.

Reasons:

- School workflows are highly connected: admissions, attendance, fees, notices, payroll, and accounting share transactional data.
- A modular monolith is easier to build, test, deploy, and audit at the current stage.
- Microservices would add distributed transaction and deployment complexity too early.

Microservices should only be considered later if scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.

## Three-Plane SaaS Architecture

SchoolOS has three logical product planes inside the same modular monolith. These are access, routing, and responsibility boundaries; they are not separate microservices at this stage.

### Layer 1: Platform Control Plane

For the SchoolOS company owner and internal platform team.

Purpose:

- Manage all schools/tenants.
- Manage plans and subscriptions.
- Manage SaaS billing and renewal status.
- Manage usage limits and plan enforcement.
- Manage support access / tenant override.
- View platform audit logs.
- Monitor global operational health, failed jobs, delivery failures, and provider issues.

Typical users:

- `PLATFORM_SUPER_ADMIN`
- `PLATFORM_SUPPORT`
- `PLATFORM_BILLING_ADMIN`

Recommended route/API namespace:

```text
Frontend: /platform/*
Backend:  /platform/*
```

Core rule: platform access must be explicit, permission-guarded, and audited. Platform users are SchoolOS company users, not school staff.

### Layer 2: Tenant Configuration Plane

For each school principal/admin to configure their own school.

Purpose:

- Manage school logo and branding.
- Manage academic year and fiscal settings.
- Manage receipt format and numbering preferences.
- Manage attendance lock time.
- Manage fee due/reminder rules.
- Manage notification/SMS preferences.
- Manage school-level feature toggles.
- Manage future parent-teacher chat availability hours.

Typical users:

- `TENANT_PRINCIPAL`
- `TENANT_ADMIN`
- Limited super-admin support access with audit trail.

Recommended route/API namespace:

```text
Frontend: /dashboard/settings/*
Backend:  /tenant-settings/* or /settings/*
```

Core rule: tenant configuration is tenant-owned data and must always be scoped by `tenantId`.

### Layer 3: School Operations Plane

For day-to-day school staff operations.

Purpose:

- Manage students and admissions.
- Mark attendance.
- Collect fees and print receipts.
- Publish notices.
- Manage activity feed and milestones.
- View reports and exports.
- Later: academics, timetable, HR/payroll, library, transport, canteen, and accounting.

Typical users:

- `TENANT_PRINCIPAL`
- `TENANT_ADMIN`
- `TENANT_ACCOUNTANT`
- `TENANT_TEACHER`
- `TENANT_STAFF`
- `TENANT_PARENT`
- `TENANT_STUDENT`

Recommended route/API namespace:

```text
Frontend: /dashboard/*
Backend:  module-specific tenant APIs such as /students, /attendance, /finance, /notices
```

Core rule: school operations must consume real tenant-scoped APIs. Frontend visibility is not security; backend guards and `tenantId` filters enforce isolation.

## Plane Separation Rules

- Platform Control Plane manages SaaS/customer administration.
- Tenant Configuration Plane manages a school's own settings.
- School Operations Plane manages day-to-day school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Do not allow school users to access `/platform/*` routes.
- Do not allow platform support to enter a tenant silently; support/tenant override must require an explicit reason and audit log.
- Keep `tenantId` as the tenant/school boundary.
- Keep all three planes in the NestJS modular monolith for now.
- Do not introduce microservices only to separate these planes.

## Repository Shape

Expected high-level structure:

```text
apps/
  api/      NestJS backend
  web/      Current Next.js dashboard and later public website
packages/
  core/     Shared validation, types, contracts, permissions
docs/
  project/  Project memory, plans, and roadmap
```

Current frontend rule:

- Keep using `apps/web` for the current dashboard.
- Do not migrate to Angular yet.
- Later target: `apps/web` becomes public website and `apps/admin` becomes Angular internal dashboard.

Suggested near-term frontend namespaces inside `apps/web`:

```text
/platform/*           Platform Control Plane for SchoolOS owner/team
/dashboard/settings/* Tenant Configuration Plane for school principal/admin
/dashboard/*          School Operations Plane for school staff/users
```

## Backend Architecture

Backend: NestJS modular monolith.

Rules:

- Organize by business modules, not technical layers only.
- Keep controllers thin.
- Put business rules in services/domain-oriented classes.
- Use DTO validation for all external input.
- Use Prisma transactions for multi-step business writes.
- Use module boundaries to prevent unrelated modules from writing each other's internal data directly.
- Keep platform modules under `M0 Platform Core` or equivalent platform-oriented modules.
- Keep tenant/school modules under their domain modules: M1 through M10.

## Database Architecture

Database: PostgreSQL with Prisma.

Rules:

- `tenantId` is the tenant/school boundary.
- Every tenant-owned table must include `tenantId` unless it is explicitly global metadata.
- Every tenant-owned query must filter by `tenantId`.
- Platform/global metadata such as plans, platform users, and SaaS billing records must be clearly separated from tenant-owned school operations data.
- Use PostgreSQL numeric/Prisma Decimal for money.
- Never use JavaScript floating point for money.
- Add indexes for common tenant-scoped queries.
- Prefer database constraints where correctness must be guaranteed.

## Auth and Tenant Isolation

- Browser auth is cookie-first with httpOnly access and refresh cookies.
- API bearer tokens remain supported for future mobile/API clients.
- Tenant context is seeded from verified auth/session data.
- Super-admin tenant override must be explicit, validated, and audited.
- Frontend should not be trusted for access control.
- RBAC and tenant isolation must be enforced server-side.
- Platform roles must be separate from tenant roles.
- Platform APIs should require platform permissions.
- Tenant APIs should require tenant permissions and tenant ownership.

## Queue and Background Work

Use Redis + BullMQ for:

- Notification delivery
- SMS/email/push provider work
- Retryable background jobs
- Scheduled operational tasks
- Heavy exports or report generation where needed

Provider failures must not crash core business transactions.

## File and Media Architecture

- Use private object storage for documents and media.
- Store object keys, not permanent public URLs.
- Serve downloads/previews through signed URLs.
- Student documents, photos, activity media, and receipts must remain tenant-scoped.
- Activity media should support compression for Nepal low-bandwidth environments.
- Generic File Registry belongs to M0 Platform Core and should provide reusable file metadata across modules.

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

## SaaS Billing vs School Finance

Keep these separate:

```text
SchoolOS SaaS Billing = SchoolOS company charges schools for using the platform.
School Finance/M3/M9 = a school collects fees and manages its own accounting.
```

SaaS billing belongs to the Platform Control Plane. Student fees, receipts, ledgers, and school accounting belong to the School Operations Plane.

## Frontend Architecture

Current frontend: Next.js in `apps/web`.

Rules:

- Consume real APIs.
- Do not use fake production data.
- Keep forms validated and user-friendly.
- Preserve cookie-first auth behavior.
- Prefer feature-based components.
- Keep screens optimized for school staff speed and low friction.
- Keep platform owner pages, tenant settings pages, and school operations pages separated by route namespace and permissions.

Important UX constraints:

- Attendance must stay teacher-first and fast.
- Fee collection must support accountant/cashier workflows.
- Student management must support real admissions, edits, documents, transfers, and exports.

## Verification Commands

Run relevant checks after meaningful changes:

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1
```
