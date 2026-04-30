# SchoolOS Architecture

This file records the stable architecture decisions for SchoolOS. Keep this concise. Detailed module scope belongs in `docs/project/SCHOOLOS_PROJECT_MEMORY.md`.

## Architecture Style

SchoolOS uses a modular monolith first.

Reasons:

- School workflows are highly connected: admissions, attendance, fees, notices, payroll, and accounting share transactional data.
- A modular monolith is easier to build, test, deploy, and audit at the current stage.
- Microservices would add distributed transaction and deployment complexity too early.

Microservices should only be considered later if scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.

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

## Backend Architecture

Backend: NestJS modular monolith.

Rules:

- Organize by business modules, not technical layers only.
- Keep controllers thin.
- Put business rules in services/domain-oriented classes.
- Use DTO validation for all external input.
- Use Prisma transactions for multi-step business writes.
- Use module boundaries to prevent unrelated modules from writing each other's internal data directly.

## Database Architecture

Database: PostgreSQL with Prisma.

Rules:

- `tenantId` is the tenant/school boundary.
- Every tenant-owned table must include `tenantId` unless it is explicitly global metadata.
- Every tenant-owned query must filter by `tenantId`.
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

## Frontend Architecture

Current frontend: Next.js in `apps/web`.

Rules:

- Consume real APIs.
- Do not use fake production data.
- Keep forms validated and user-friendly.
- Preserve cookie-first auth behavior.
- Prefer feature-based components.
- Keep screens optimized for school staff speed and low friction.

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
