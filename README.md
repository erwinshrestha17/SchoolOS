# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

It is designed as a modular school operating system covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, and future intelligence/analytics.

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
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
docs/project/SCHOOLOS_CURRENT_UI_PROGRESS.md
```

Legacy long planning files have been merged into the master memory and should stay as redirects/summaries unless a focused update is needed:

```text
docs/project/SCHOOLOS_PHASE_STRUCTURE.md
docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
docs/project/SCHOOLOS_PROJECT_MEMORY.md
```

Do not update `docs/design/SCHOOLOS_FINAL_UI_UX_DIRECTION.md` unless the task is specifically about final UI/UX direction.

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend/admin UI: Completed
Student QR Foundation: Implemented; release hardening remains
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: M0 platform foundation complete + Phase 1 pilot-ready core + Phase 2 foundations + M4 academics backend/admin UI complete + Student QR foundation implemented + M9 production-candidate completion + Phase 3 operations admin foundations
```

Targeted web-admin polish and Phase2F browser smoke coverage are now present on main.

Current product readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Recommended next direction:

```text
Strict Phase Gate 0 from docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
→ stabilize verification, migrations, seed data, smoke tests, and stale docs
→ harden controlled pilot reliability across M0 and Phase 1 core
→ polish Academics and Accounting
→ deepen Homework/Timetable, HR/Payroll, Library, Transport, and Canteen one vertical at a time
```

Do not start broad new product fronts until the full verification gate is clean.

Explicitly deferred unless requested:

```text
Angular migration
AI/ML implementation
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket UI
Full canteen purchase-bill/wastage/vendor workflows
Microservices
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
Mobile app: Flutter companion app in apps/schoolos_mobile
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep the modular monolith first.
- Do not migrate to Angular yet.
- Do not introduce microservices unless scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.

---

## Workspace Layout

```text
apps/
  api/              NestJS backend
  web/              Current Next.js dashboard and later public website
  schoolos_mobile/  Flutter parent/teacher/student/admin mobile app
  admin/            Future Angular internal dashboard, not now
packages/
  core/             Shared validation, types, contracts, permissions
docs/
  project/          Master memory, plans, and roadmaps
```

For now, keep the Flutter mobile app as a standalone app under `apps/`.
Do not add it to `pnpm` workspaces; run it with Flutter commands.

## Running Locally

Run backend and web from the SchoolOS root:

```bash
pnpm dev
```

Run the mobile app from its Flutter app directory:

```bash
cd apps/schoolos_mobile
flutter pub get
flutter run
```

The local backend API is usually available at:

```text
http://localhost:4000/api/v1
```

For iOS Simulator, the default mobile API base URL can use localhost:

```bash
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://localhost:4000/api/v1
```

For Android Emulator, point the app to the host machine through `10.0.2.2`:

```bash
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://10.0.2.2:4000/api/v1
```

For a real phone on the same Wi-Fi network, get the Mac's local IP and use it:

```bash
ipconfig getifaddr en0
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://<mac-local-ip>:4000/api/v1
```

---

## Product Planes

| Plane | Audience | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School principal/admin | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | School staff/parents/students | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/homework`, `/timetable`, `/payroll`, `/accounting`, `/library`, `/transport`, `/canteen` |

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for one school's settings.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- `tenantId` is the current database tenant/school boundary.
- Platform support/tenant override must be explicit and audited.

---

## Production Module Map

| Module | Name | Status |
|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation depth completed; billing/API keys/webhooks later |
| M1 | Admissions & Student Profiles | Phase 1A/1B complete / pilot-ready |
| M2 | Smart Attendance | Phase 1A/1B complete / pilot-ready |
| M3 | Fees & Receipts | Phase 1A/1B complete / pilot-ready |
| M4 | Exams, CAS & Report Cards | Phase 2A backend/admin UI complete; PDF/report polish remains |
| M5 | Activity Feed & Milestones | Phase 1A/1B complete; media/moderation hardening ongoing |
| M6 | Homework & Timetable | Backend/admin UI foundation implemented; attachment, queue, conflict, and role-view depth remains |
| M7 | HR & Payroll | Backend/admin UI foundation implemented; approval, reporting, self-service, and browser depth remains |
| M8A | Library Management | Admin/backend foundation with fines, reports, history, and QR lookup |
| M8B | Transport Management | Admin/trip/location/report foundation; live/driver/parent later |
| M8C | Canteen Management | Admin/wallet/POS receipt JSON/PDF/inventory/vendor/report foundation with meal-plan M3 invoice linkage and supplier/item admin UI; cancellation rules and parent views later |
| M9 | Accounting & Finance | Phase 2D production-candidate complete |
| M10 | Notices & Communication | Phase 1A/1B + parent-teacher chat foundation |
| M11 | School Intelligence & Analytics | Roadmap only; implementation deferred |

---

## Current Backend Completion Estimate

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
Phase 2A M4 Academics backend/admin UI: complete
Student QR Foundation: implemented / release hardening remains
M9 Accounting: production-candidate complete
```

Strongest areas:

```text
Auth/RBAC/Tenant isolation
M1-M3 Phase 1 operations
M4 Academics backend
M9 Accounting
M10 notification/read/delivery foundation
```

Areas requiring stabilization/depth:

```text
M6 Homework & Timetable
M7 HR & Payroll
M8A Library
M8B Transport
M8C Canteen
Student QR cross-module manual QA
Authenticated browser smoke tests
Staging/pilot verification
```

---

## Completed Highlights

- Tenant context seeded through auth/CLS.
- JWT guard hardened.
- Super-admin tenant override validated and audited.
- Cookie-first browser auth with `httpOnly` access/refresh cookies.
- Browser dashboard no longer stores raw tokens.
- API supports bearer tokens for the active Flutter mobile app and future API clients.
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
- Student document manager and private access boundaries.
- Attendance 3-tap screen, monthly register, corrections, exports.
- Fee Collection Counter, invoice detail, student fee ledger, cashier close, reports.
- M4 Academics backend flow from exam setup to publishing/parent notification.
- M9 Accounting ledger/reporting/bank reconciliation workspace.
- Activity Feed with media access/moderation foundations.
- Notices/Communications, Consent Management, Delivery Records, Notification Center.
- Library, Transport, and Canteen admin foundations.

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

Full verification gate after meaningful backend/module changes:

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

---

## Production Operations

- Docker VPS baseline: [`docs/production/docker-vps-runbook.md`](docs/production/docker-vps-runbook.md)
- Phase 1 pilot readiness: [`docs/production/phase1-pilot-readiness.md`](docs/production/phase1-pilot-readiness.md)
- Phase 1 release checklist: [`docs/production/phase1-release-checklist.md`](docs/production/phase1-release-checklist.md)
- Backup and restore baseline: [`docs/production/backup-restore-runbook.md`](docs/production/backup-restore-runbook.md)

Production API startup validates required secrets, CORS origins, Redis, database, cookie, encryption, and provider settings before listening.

---

## M9 Accounting Direction

M9 Accounting is now production-candidate complete, but the rules remain strict:

1. Immutable ledger: never edit confirmed journal entries; use reversal/correction/adjustment entries.
2. Double-entry enforcement: total debit must equal total credit.
3. Fiscal period control: `OPEN`, `LOCKED`, `CLOSED`; no posting into closed periods.
4. Source document linkage: every journal links to invoice/payment/receipt/payroll/expense/waiver/refund source.
5. AccountingPostingService boundary: other modules must not directly write ledger rows.
6. Decimal money handling: use PostgreSQL `numeric`/Prisma Decimal, never floating point.
7. Fiscal sequence control: journal/voucher/receipt numbers unique per tenant/fiscal year.
8. Correction/reversal workflow for mistakes.
9. Reports come from backend ledger, not frontend calculations.
10. Audit all posting, approval, reversal, closing, reopening, bank reconciliation, and exports.

Do not move M9 Accounting to a microservice yet.

---

## Deferred / Later

- Angular internal dashboard migration.
- Deep parent and teacher mobile workflows beyond the started Flutter app foundation.
- Real SMS/push/R2 provider credentials until adapters are selected.
- Payment gateways such as eSewa/Khalti until manual/bank/cash reconciliation is production-ready.
- Driver live-trip workflow beyond the started mobile shell.
- Live transport map/WebSocket UI.
- Full canteen purchase-bill/wastage/vendor workflows.
- AI integrations until reliable production data and M11 foundations exist.
