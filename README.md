# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

It is designed as a modular school operating system covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, and future AI/analytics.

---

## Source of Truth

The consolidated project memory is:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Short companion files:

```text
PROJECT_CONTEXT.md
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md
```

Legacy long planning files have been merged into the master memory and should stay as redirects/summaries:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_PHASE_STRUCTURE.md
docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
docs/project/SCHOOLOS_PROJECT_MEMORY.md
docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md
```

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Current stage: Phase 2 Transition Readiness
```

Phase 1 pilot product is ready for controlled staging/pilot preparation. Phase 2 should proceed one focused vertical at a time.

Preferred next vertical:

```text
Academics / Exams / CAS / Report Cards
```

Alternative vertical:

```text
HR / Payroll / Accounting posting hardening
```

---

## Stack

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Do not migrate to Angular yet. Do not introduce microservices unless scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.

---

## Workspace Layout

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

---

## Product Planes

| Plane | Audience | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School principal/admin | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | School staff/parents/students | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices` |

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for one school's settings.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- `tenantId` is the current database tenant/school boundary.

---

## Production Module Map

| Module | Name | Phase |
|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation + gradual rollout |
| M1 | Admissions & Student Profiles | Phase 1A/1B |
| M2 | Smart Attendance | Phase 1A/1B |
| M3 | Fees & Receipts | Phase 1A/1B |
| M4 | Exams, CAS & Report Cards | Phase 2 |
| M5 | Activity Feed & Milestones | Phase 1A/1B |
| M6 | Homework & Timetable | Phase 2 |
| M7 | HR & Payroll | Phase 2 |
| M8A | Library Management | Phase 3 |
| M8B | Transport Management | Phase 3 |
| M8C | Canteen Management | Phase 3 |
| M9 | Accounting & Finance | Phase 2 |
| M10 | Notices & Communication | Phase 1A/1B + Phase 2/3 chat |

---

## Completed Phase 1A / 1B Highlights

- Tenant context seeded through auth/CLS.
- JWT guard hardened.
- Super-admin tenant override validated and audited.
- Cookie-first browser auth with `httpOnly` access/refresh cookies.
- Browser dashboard no longer stores raw tokens.
- API still supports bearer tokens for future mobile/API clients.
- Docker Postgres/Redis smoke script added.
- `verify:production` gate exists.
- PDF response validation added.
- Student ID card and receipt PDFs manually tested and open.
- Dashboard shell and Admin Dashboard.
- Platform Control Plane shell and tenant-management foundation.
- Students/Admissions workspace.
- Student Directory and full Student Detail page.
- Student edit/update and guardian edit/update.
- Student lifecycle/transfer actions.
- Student document manager.
- Attendance 3-tap screen.
- Monthly Attendance Register export.
- Student Attendance History in profile.
- Fee Collection Counter.
- Invoice detail and student fee ledger.
- Fee Collection and Defaulter Aging reports.
- Payment reversal/refund workflow.
- Cashier close/day-end UI.
- Activity Feed with media preview foundation.
- Notices/Communications.
- Consent Management and Delivery Records.
- Global API response envelope.
- Generic Reports Foundation.

---

## Local Development

Install dependencies:

```bash
pnpm install
```

Copy the API env file if needed:

```bash
cp apps/api/.env.example apps/api/.env
```

Start local Postgres and Redis:

```bash
docker compose up -d postgres redis
```

Generate Prisma client, validate schema, migrate, and seed:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

Optionally seed a local Platform Control Plane operator:

```bash
PLATFORM_SEED_EMAIL=<platform-operator-email> \
PLATFORM_SEED_PASSWORD=<platform-operator-password> \
pnpm --filter @schoolos/api db:seed:platform
```

Start API and web app together:

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
| School Admin UI | `http://localhost:3000/dashboard` |
| Platform Control Plane | `http://localhost:3000/platform/dashboard` |

---

## Workspace Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
pnpm --filter @schoolos/api db:seed:platform
pnpm smoke:phase1
pnpm verify:production
```

---

## Production Operations

- Docker VPS baseline: [`docs/production/docker-vps-runbook.md`](docs/production/docker-vps-runbook.md)
- Phase 1 pilot readiness: [`docs/production/phase1-pilot-readiness.md`](docs/production/phase1-pilot-readiness.md)
- Phase 1 release checklist: [`docs/production/phase1-release-checklist.md`](docs/production/phase1-release-checklist.md)
- Backup and restore baseline: [`docs/production/backup-restore-runbook.md`](docs/production/backup-restore-runbook.md)

Production API startup validates required secrets, CORS origins, Redis, database, cookie, encryption, and provider settings before listening.

---

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

---

## Deferred / Later

- Angular internal dashboard migration.
- Parent and teacher mobile apps.
- Real SMS/push/R2 provider credentials until adapters are selected.
- Payment gateways such as eSewa/Khalti until manual/bank/cash reconciliation is production-ready.
- Full M9 Accounting.
- Academics, timetable/homework, HR/payroll production hardening.
- Library, transport, and canteen production hardening.
- AI integrations until consent, moderation, storage, messaging, and reliable production data are stable.
