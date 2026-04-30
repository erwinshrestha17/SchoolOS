# SchoolOS

SchoolOS is a production-grade, multi-tenant school management SaaS for Nepal, targeting Montessori to Class 10.

The project is structured as a `pnpm` monorepo centered on a NestJS modular-monolith backend, PostgreSQL/Prisma data layer, Redis/BullMQ background processing, shared core contracts, and a Next.js dashboard for current admin/staff workflows.

## Current Stage

SchoolOS is currently in **Phase 1B Completion Sprint**.

- Phase 1A core workflows are mostly complete and pilot-candidate.
- Phase 1B focuses on operational depth: detail pages, edits, reports, exports, management actions, polish, and browser testing.
- Phase 2 modules should not be started unless explicitly planned.

Source of truth:

- [`docs/project/SCHOOLOS_PROJECT_MEMORY.md`](docs/project/SCHOOLOS_PROJECT_MEMORY.md)

## Workspace Layout

- `apps/api`
  - NestJS + Prisma backend
  - auth, RBAC, admissions, attendance, finance, academics, payroll, accounting, library, transport, notices, and messaging foundations
- `apps/web`
  - Next.js App Router dashboard
  - tenant registration, login, dashboard, students/admissions, attendance, finance, activity, communications, and settings flows
- `packages/core`
  - shared validation schemas, permission keys, and DTO-style TypeScript types

## Core Platform Decisions

- Multi-tenant SaaS remains the primary deployment model.
- `tenantId` is the current database tenant/school boundary.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Current internal dashboard remains in Next.js for now.
- Future target:
  - `apps/web` = public website, SEO pages, admissions/public pages
  - `apps/admin` = Angular internal dashboard later
- Do not migrate to Angular yet.
- API routes are versioned under `/api/v1`.
- Swagger docs are exposed from the API at `/api/v1/docs`.
- Fee payments post journal entries into the finance/accounting ledger foundation automatically.
- Full M9 Accounting remains Phase 2, but Finance ledger foundations continue in Phase 1B.
- Do not introduce microservices unless scale, team size, deployment needs, or compliance isolation justify it.

## Completed Phase 1A / 1B Highlights

- Tenant context seeded through auth/CLS.
- JWT guard hardened.
- Super-admin tenant override validated and audited.
- Cookie-first browser auth with `httpOnly` access/refresh cookies.
- Browser dashboard no longer stores raw tokens.
- API still supports bearer tokens for future mobile/API clients.
- Docker Postgres/Redis smoke script added.
- `verify:production` passes.
- PDF response validation added.
- Student ID card and receipt PDFs manually tested and open.
- Dashboard shell and Admin Dashboard.
- Students/Admissions workspace.
- Student Directory and full Student Detail page.
- Student edit/update and guardian edit/update.
- Student lifecycle/transfer actions.
- Student document manager.
- Attendance 3-tap screen.
- Fee Collection Counter.
- Invoice detail and student fee ledger.
- Payment reversal/refund workflow.
- Cashier close/day-end UI.
- Activity Feed.
- Notices/Communications.
- Consent Management and Delivery Records.

## Local Development

1. Install workspace dependencies.

```bash
pnpm install
```

2. Copy the API env file if needed.

```bash
cp apps/api/.env.example apps/api/.env
```

3. Start local Postgres and Redis.

```bash
docker compose up -d postgres redis
```

The default API env file targets Docker Postgres on `localhost:5433` and Redis on `localhost:6379`.

4. Generate the Prisma client, validate schema, apply migrations, and seed local data.

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

5. Start the API and web app together.

```bash
pnpm dev
```

Expected local URLs:

| Service | URL |
|---|---|
| Web app | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| Swagger | `http://localhost:4000/api/v1/docs` |
| Health | `http://localhost:4000/api/v1/health` |
| Readiness | `http://localhost:4000/api/v1/ready` |

If either server reports `EADDRINUSE`, another process is already listening on that port.

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
```

Stop the stale process, then run:

```bash
unset PORT
pnpm dev
```

Sensitive medical/compliance fields are encrypted at the app layer before storage. Local development uses a safe fallback key, but production must set `MEDICAL_ENCRYPTION_KEY` to a stable 32-byte hex/base64 value, or a long secret passphrase, before admitting students with medical data.

## Workspace Commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm smoke:phase1`
- `pnpm verify:production`

## Production Operations

- Docker VPS baseline: [`docs/production/docker-vps-runbook.md`](docs/production/docker-vps-runbook.md)
- Phase 1 pilot readiness: [`docs/production/phase1-pilot-readiness.md`](docs/production/phase1-pilot-readiness.md)
- Phase 1 release checklist: [`docs/production/phase1-release-checklist.md`](docs/production/phase1-release-checklist.md)
- Backup and restore baseline: [`docs/production/backup-restore-runbook.md`](docs/production/backup-restore-runbook.md)

Production API startup validates required secrets, CORS origins, Redis, database, cookie, encryption, and provider settings before listening.

The Next.js dashboard authenticates browser API calls with `httpOnly` access and refresh cookies. The backend still returns access tokens in JSON for direct API/mobile compatibility, but the dashboard persists only non-sensitive session metadata in browser storage.

## Local Test Login Credentials

After running `pnpm db:seed`, the following **local/dev-only** demo accounts are available.

| Role | Tenant Slug | Email | Password |
|---|---|---|---|
| Super Admin | `default-school` | `superadmin@schoolos.com` | `superadmin123` |
| Admin | `default-school` | `admin@schoolos.com` | `admin123` |
| Principal | `default-school` | `principal@schoolos.com` | `principal123` |
| Accountant | `default-school` | `accountant@schoolos.com` | `accountant123` |
| Class Teacher | `default-school` | `classteacher@schoolos.com` | `classteacher123` |
| Subject Teacher | `default-school` | `subjectteacher@schoolos.com` | `subjectteacher123` |
| Parent/Guardian | `default-school` | `guardian@schoolos.com` | `guardian123` |
| Student | `default-school` | `student@schoolos.com` | `student123` |

Notes:

- These credentials are for local development and manual testing only.
- Never use these credentials in staging or production.
- Parent and student users can authenticate, but child/student-scoped pages may be empty until those users are linked to actual guardian/student records.

## Current Backend Surface Area

- Platform/auth/RBAC with tenant onboarding, users, roles, super-admin support, refresh sessions, audit records, and provider-neutral adapters.
- Phase 1 core:
  - admissions
  - student documents/certificates
  - student lifecycle
  - attendance
  - fees
  - invoice detail
  - student fee ledger
  - payment reversal/refund
  - cashier close
  - activity feed
  - notices
  - consent
  - deliveries
  - receipts
  - immutable finance-ledger posting foundation
- Phase 2 foundations/scaffolding:
  - academics
  - timetable/homework
  - HR/payroll
  - accounting reports
  - messaging
- Phase 3 foundations/scaffolding:
  - library
  - transport

## Current Frontend Surface Area

- Public/root app shell and login.
- Dashboard shell.
- Admin Dashboard.
- Students/Admissions workspace.
- Student Directory.
- Student Detail page.
- Student edit and guardian edit.
- Student lifecycle/transfer actions.
- Student document manager.
- Multi-step enrollment.
- Attendance 3-tap screen.
- Fee Collection Counter.
- Invoice Detail panel.
- Student Fee Ledger.
- Payment refund/reversal flow.
- Cashier Close / Day-End panel.
- Activity Feed.
- Notices/Communications.
- Consent Management.
- Delivery Records.
- Settings/setup screens.

## Phase 1B Remaining Priorities

1. Fee collection reports and defaulter aging filters.
2. Attendance monthly register and student attendance history.
3. Notification center/read/retry UI.
4. Activity signed media preview/download.
5. Global student search and header actions.
6. Playwright browser smoke tests.
7. PDF visual polish.
8. Student photo upload/storage.
9. iEMIS export UI.
10. Duplicate merge workflow.

## M9 Accounting Direction

Keep the current stack for M9 Accounting:

- NestJS
- PostgreSQL
- Prisma
- Modular monolith
- Redis/BullMQ/domain events
- Current Next.js dashboard for now

Do not move M9 Accounting to a microservice yet.

Strict M9 Accounting rules:

1. Immutable ledger: never edit confirmed journal entries; use reversal/correction/adjustment entries.
2. Double-entry enforcement: total debit must equal total credit.
3. Fiscal period control: `OPEN`, `LOCKED`, `CLOSED`; no posting into closed periods.
4. Source document linkage: every journal links to invoice/payment/receipt/payroll/expense/waiver/refund source.
5. AccountingPostingService boundary: other modules must not directly write ledger rows.
6. Decimal money handling: use PostgreSQL `numeric`/Prisma Decimal, never floating point.
7. Fiscal sequence control: journal/voucher/receipt numbers unique per tenant/fiscal year.
8. Correction/reversal workflow for mistakes.
9. Reports come from backend ledger, not frontend calculations.
10. Audit all posting, approval, reversal, closing, reopening, and exports.

## Deferred / Later

- Angular internal dashboard migration.
- Parent and teacher mobile apps.
- Real SMS/push/R2 provider credentials until adapters are selected.
- Payment gateways such as eSewa/Khalti until manual/bank/cash reconciliation is production-ready.
- Full M9 Accounting.
- Academics, timetable/homework, HR/payroll production hardening.
- Library and transport production hardening.
- AI integrations until consent, moderation, storage, messaging, and reliable production data are stable.
