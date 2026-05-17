# SchoolOS Current Repo Status Analysis

**Last updated:** 2026-05-17

**Scope:** Full repo documentation review against `apps/api`, `apps/web`, `packages/core`, Prisma schema, and available tests.

This document is the short current-state audit for backend implementation, frontend implementation, remaining module work, and strict implementation order.

For the long-running source of truth, read:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
```

Do not treat older Phase 1B / Phase 2-transition notes as current unless they are explicitly marked as historical.

---

## Current Consolidated Verdict

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue pilot hardening implemented; broader pilot hardening remains
Phase 2A M4 Academics: Completed / Pilot-Ready
Phase 2 Academics polish: Completed (report-card PDFs, corrections/history, exports, snapshots, raster logo embedding, and browser smoke coverage)
Phase 2B M6 Homework/Timetable: Completed / Pilot-Ready (File Registry attachments, reminder hardening, teacher absence conflict detection, substitution dashboard, conflict visualization)
Phase 2C M7 HR/Payroll: Completed / Pilot-Ready (Leave accrual idempotency, payroll posting locks, accounting integration, reversal workflows, PII masking, PDF slips)
Phase 2D M9 Accounting: Completed / Pilot-Ready
Phase 2 Accounting polish: Completed (report PDFs, bank reconciliation PDFs, File Registry snapshots, audit trail, auto-match suggestions, raster logo embedding, and browser smoke coverage)
Phase 2E M10 Parent communication/chat: Foundation implemented
Student QR Identity: Backend model/API/service and admin UI foundation implemented
Phase 3 M8A/M8B/M8C: Admin/backend foundations implemented with more depth than older docs showed
Phase 4 M11 Intelligence/AI: Roadmap only
```

Current readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks and smoke verification
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Latest practical caveat:

```text
Phase Gate 0 verification was green before M0 depth work started.
The current M0 provider/queue hardening pass ran targeted tests plus repo tests through build.
`pnpm verify:production` reached the browser E2E stage but the sandbox could not bind `127.0.0.1:3101`.
`pnpm smoke:phase1` still requires local Postgres, Redis, API, and web services to be running.
```

---

## Repository Implementation Map

Backend modules are registered in `apps/api/src/app.module.ts` and include Auth/RBAC, M0 Platform, M1-M10 school modules, Prisma, Redis/BullMQ, storage, reports, file registry, usage, plans, and settings.

Frontend routes in `apps/web/app` include dashboard workspaces for students, admissions, attendance, fees/finance, activity, notices, messaging, academics, homework, timetable, HR, payroll, accounting, library, transport, canteen, settings, and platform control.

Shared contracts live in `packages/core/src`.

Available verification coverage includes API unit/E2E tests, web tests, and Playwright smoke specs for phase 1, academics, accounting, dashboard/platform route behavior, and UX keyboard flows.

---

## Module-by-Module Implemented vs Remaining

| Module | Backend Implemented | Frontend Implemented | Remaining Backend | Remaining Frontend |
|---|---|---|---|---|
| Auth / Security / Tenant | Cookie-first auth, bearer support, RBAC, tenant context, platform/tenant separation, super-admin override audit, throttling. | Login/register/session-aware dashboard shell. | Deeper request/correlation logging, more denial/override regression tests, production secret/session review. | Permission-denied polish across every route and slow-session recovery. |
| M0 Platform Core | Tenant management, plans/features, entitlements/usage, SaaS billing records, provider masking/readiness detail, queue health/retry/detail/history, file registry, reports/exports, health, onboarding. | `/platform/dashboard`, `/platform/schools`, tenant detail, platform settings, audit surfaces, provider readiness dialog, queue failed-job detail dialog. | SaaS lifecycle automation, entitlement enforcement tests against school APIs, explicit staging object-storage checks, broader browser coverage. | More platform tenant-action QA and browser coverage for critical platform mutations. |
| M1 Admissions & Students | Admissions, profiles, guardians, documents, lifecycle, search, photo/document access, duplicate/merge foundations, StudentIdentity, StudentQrCredential model/service/API. | Admissions workspace, student directory/detail/profile tabs, document/profile actions, QR card management. | iEMIS final mapping, duplicate merge polish, storage-backed photo/document hardening, QR release verification, more tenant-isolation tests. | QR manual QA, photo/logo upload UX polish, student document audit visibility, parent-safe student views later. |
| M2 Attendance | Attendance sessions/records, corrections, sync submissions/conflicts, drafts, monthly/history analytics, exports, teacher-scope tests. | Attendance daily workflow and register routes. | Offline sync persistence hardening, attendance export/report stabilization, parent summary API later. | Parent attendance view later, slow-network/offline UX, correction workflow polish. |
| M3 Fees & Receipts | Fee heads/plans, invoices, payments, receipts, cashier close, refunds/reversals, ledger/report foundations, M9 consistency coverage. | Fees/finance workspaces, collection counter, ledger, receipt/reprint/correction UI foundations. | Online payment gateway readiness, receipt reprint history depth, cashier-close verification, better export/PDF coverage. | Fee-head/period dues table polish, gateway payment UX, finance report export polish. |
| M4 Academics / Exams / CAS / Report Cards | Exam terms, assessment components, marks, CAS, grading/GPA preview, locks/unlocks, polished report-card PDFs, raster logo embedding, correction/regeneration history, academic CSV/PDF exports, report snapshots, promotion readiness, publishing, parent notification hooks, contract tests. | Academics hub and routes for setup, marks, CAS, locks, results, report cards, promotion, publishing; keyboard marks/CAS polish; report-card download/history/correction actions; browser smoke coverage. | Further staging data QA, final index review after usage stabilizes. | Dialog-level correction UX polish and deeper academic reporting UI beyond smoke coverage. |
| M5 Activity Feed & Milestones | Posts, targeting, attachments/media access, lifecycle, reactions, milestones/mood foundations, media privacy tests. | Activity dashboard route. | Object-storage/direct upload hardening, compression queue depth, moderation/approval workflow, edit/delete/soft-delete polish. | Activity detail/media gallery, parent activity view, moderation UI. |
| M6 Homework & Timetable | Homework lifecycle/submissions/review/reminders/reports/attachment access via File Registry; timetable periods, rooms, versions, slots, validation with teacher absence context, substitution summary API. | Homework list/new/detail/review/attachments; timetable builder with conflict visualization, teacher dashboard widgets (Today's Classes, Homework Reviews), substitutions dashboard. | Unit/Integration test coverage for complex absence edge cases. | Browser E2E verification in staging environment. |
| M7 HR & Payroll | Staff, documents, lifecycle, contracts, HR attendance, leave balances/requests/accrual idempotency, payroll runs/lines with posting locks, salary structures, payslips, payroll-to-accounting integration, reversal workflows, PII masking. | HR staff/detail/attendance/contracts/leave; payroll dashboard with status steppers, posting actions, reversal workflows, PDF slips. | Extended reporting depth (tax reports, trends). | Browser smoke execution in staging environment. |
| M8A Library | Books, copies, issue/return, overdue, fines, settings, borrowed students, QR borrower lookup, reports, CSV export, book/copy history, explicit fine-to-M3 posting with M9 boundary. | Library dashboard, books, copies, issues, overdue, fines, reports, Phase 4 smoke coverage. | Overdue queue hardening, staff borrower depth, receipt/payment linkage polish after M3 collection rules finalize. | Barcode/QR scan ergonomics and report export polish beyond current admin routes. |
| M8B Transport | Routes/stops, vehicles, driver/student assignments, trip lifecycle, student boarding statuses, latest location, cleanup, parent active-trip endpoint, delays/logs/reports/CSV, GPS validation/cache/throttle/fanout guard. | Transport dashboard, routes, vehicles, assignments, trips, latest location, Phase 4 smoke coverage. | ETA/geofence/deviation later; billing/accounting remains guarded until pricing rules are approved. | Admin live map only after product-approved real-time readiness; driver app and parent tracking later. |
| M8C Canteen | Menu, meal plans, enrollments, serving, wallets, POS, spending controls, QR resolve, suppliers, inventory, purchase bills, stock movement, wastage, reports/CSV, wallet/POS idempotency and stock hardening. | Canteen dashboard, menu, plans, enrollments, serving, wallets, POS, controls, reports, Phase 4 smoke coverage. | Meal-plan M3 dues boundary once product rules are approved, POS receipt generation, low-balance queue depth. | QR/POS speed polish, inventory/vendor UI depth, parent wallet/menu/spending views later. |
| M9 Accounting & Finance | Chart of accounts, journals, fiscal years/periods, posting service, reversals/corrections, fiscal close/reopen, opening balances, reports, bank reconciliation, CSV/PDF exports, File Registry report snapshots, deterministic bank auto-match suggestions, audit trail, bank reconciliation PDF, raster logo embedding. | Accounting dashboard, accounts, journals, reports, reconciliation, management, audit trail viewer; report PDF export and snapshot panel; reconciliation suggestion surface; seeded smoke coverage. | Production seed review, optional background workers for large exports. | Large-report UX polish. |
| M10 Notices / Communication / Messaging | Notices, events, consent templates/preferences, deliveries/retries/read tracking, notification center, unread recipients, parent-teacher chat availability/escalation/abuse foundations. | Notices/detail, notification surfaces, messages/messaging routes. | Real SMS/FCM/email providers, delivery retry failure dashboard, attachment signed URLs, retention/audit policy depth, guardian ownership tests. | Parent/mobile chat UI later, moderation/escalation UI depth, unread recipient polish. |
| M11 Intelligence / AI | Roadmap only. | None. | Do not implement until reliable production data and approved M11 foundations exist. | None until Phase 4. |

---

## Updated Completion Estimate

| Module | Estimated Completion | Current Implementation State |
|---|---:|---|
| Auth / RBAC / Tenant Isolation | 90-95% | Strong backend and browser-session foundation; production security/denial coverage remains. |
| M0 Platform Core | 85-90% | Foundation complete with provider readiness and queue failed-job detail; entitlement enforcement depth, SaaS lifecycle automation, staging checks, and browser coverage remain. |
| M1 Admissions & Student Profiles | 90-95% | Pilot-ready plus Student QR foundation; storage, iEMIS, duplicate merge, QR QA remain. |
| M2 Smart Attendance | 85-90% | Pilot-ready attendance and reports; offline/parent/report depth remains. |
| M3 Fees & Receipts | 85-90% | Pilot-ready collection/receipts/cashier close; gateway/export/reprint depth remains. |
| M4 Academics / Exams / CAS / Report Cards | 98-100% | Backend/admin UI plus Phase 2 PDF/report/correction/snapshot polish implemented; staging QA and optional report variants remain. |
| M5 Activity Feed & Milestones | 75-85% | Strong foundation; object storage/media compression/moderation/parent views remain. |
| M6 Homework & Timetable | 95-100% | Backend/Admin UI complete with File Registry integration, reminder hardening, and absence conflict detection; E2E verification remains. |
| M7 HR & Payroll | 95-100% | Backend/Admin UI complete with posting locks, accounting integration, reversal workflows, and PII masking; E2E verification remains. |
| M8A Library | 75-85% | Admin/backend foundation plus controlled fine-to-fees posting, reports/fines/history/QR lookup; scan ergonomics and queue depth remain. |
| M8B Transport | 70-80% | Admin/trip/location/report foundation plus GPS/cache/retention hardening; live map, driver app, parent tracking, and pricing-approved billing remain. |
| M8C Canteen | 75-85% | Admin/wallet/POS/inventory/vendor/report foundation plus idempotency and stock hardening; meal-plan dues, parent views, QR/manual QA remain. |
| M9 Accounting & Finance | 98-100% | Production-candidate for current scope with PDF exports, snapshots, and advanced reconciliation suggestions implemented; audit viewer depth and staging QA remain. |
| M10 Notices / Communication / Chat | 85-90% | Strong school communication and chat foundation; providers/mobile/moderation depth remains. |
| M11 Intelligence / AI | 0% | Roadmap only. |

---

## Strict Phase-Wise Implementation Plan

This order is mandatory for future implementation unless the project owner explicitly changes it. Do not start a later phase because it is more interesting.

### Phase Gate 0 - Stabilize Main Before New Scope

Exit criteria:

```text
1. Prisma generate and validate pass.
2. OpenAPI gate passes.
3. Lint, typecheck, unit tests, API E2E, web E2E, build, verify:production pass.
4. Local/staging smoke:phase1 runs with API, web, Postgres, and Redis.
5. Pending migrations are applied or intentionally parked with written reason.
6. Seed data supports every dashboard module route used in browser smoke.
7. No stale docs claim a module is "next" when it is already implemented.
```

Allowed work: verification fixes, migration fixes, seed fixes, tenant isolation fixes, doc alignment.

Blocked work: AI, Angular migration, microservices, parent/mobile, driver app, broad new modules.

### Phase 1 - Pilot Reliability for Existing Core

Scope:

```text
Auth/Security, M0, M1, M2, M3, M5, M10, settings, reports, file registry, notifications.
```

Backend requirements:

```text
Staging secrets/session review, storage readiness, request/correlation logging, notification provider failure visibility, export/report history, tenant isolation tests, platform denial tests, entitlement enforcement tests.
```

Frontend requirements:

```text
Permission-denied states, slow-network states, smoke coverage for dashboard/students/attendance/finance/notices/settings/platform, QR manual QA for student profile.
```

Exit criteria: controlled pilot can run one real school without engineering handholding for daily admissions, attendance, fees, notices, activity, settings, and platform operations.

### Phase 2 - Complete High-Value Academic and Finance Polish

Scope:

```text
M4 Academics and M9 Accounting.
```

Backend requirements:

```text
Implemented: report-card PDF polish, raster logo embedding, locked correction/regeneration workflow, academic exports, accounting PDF exports, saved report snapshots through File Registry, audit log viewer API, and deterministic bank reconciliation suggestion rules.
Remaining: optional async workers for large reports, and staging object-storage/browser smoke verification.
```

Frontend requirements:

```text
Implemented: end-to-end academics smoke updates, report-card download/history/correction polish, accounting report PDF/snapshot polish, audit viewer UI, and seeded accounting workflow smoke coverage.
Remaining: browser E2E execution in an environment that can bind local ports.
```

Exit criteria: academics and accounting can be sold as production-grade admin modules for the current Nepal school scope.

### Phase 3 - Harden Phase 2 Operations Depth

Scope:

```text
M6 Homework/Timetable and M7 HR/Payroll.
```

Backend requirements:
- [x] Implemented: Homework File Registry uploads, reminder queue hardening, timetable absence integration, absence conflict validations, payroll approval/posting locks, leave accrual idempotency, sensitive staff field masking, payroll reversal workflows.
- [ ] Remaining: Final integration test coverage for complex absence edge cases.

Frontend requirements:
- [x] Implemented: Timetable builder conflict visualization, teacher dashboard (Today's Classes, Homework Reviews), homework attachment UX, payroll status steppers, reversal UI, PDF payslips.
- [ ] Remaining: browser smoke execution in staging environment.

Exit criteria: academic coordinators, teachers, HR admins, and accountants can run these modules without relying on direct database/admin intervention.

### Phase 4 - Harden Extended Operations Verticals

Scope:

```text
M8A Library, M8B Transport, M8C Canteen.
```

Backend requirements:

```text
Library fine-to-fees integration, canteen wallet/POS accounting-source hardening, transport billing guard where pricing is not approved, QR scan audit depth, inventory/vendor edge cases, GPS ingestion pressure protection, retention cleanup, report exports, permission tests.
```

Frontend requirements:

```text
Library barcode/QR scan UX, transport live map only after real-time backend design is product-approved for admin use, canteen QR/POS speed polish, inventory/vendor UI depth, operation-specific Playwright tests.
```

Exit criteria: operations modules are reliable admin products, not just demos.

### Phase 5 - Parent, Mobile, Driver, and Live Experiences

Start only after Phases 0-4 are green.

Scope:

```text
Parent portal, mobile/PWA shell, parent chat UI, parent academic/fee/attendance views, driver app, parent transport tracking, push notifications.
```

Rules:

```text
Parent/driver/mobile APIs must be purpose-limited, tenant-scoped, child/route-owned, and audited.
Do not expose admin-shaped data directly to parent/mobile clients.
```

### Phase 6 - Enterprise Scale and M11 Intelligence

Start only after reliable production data exists.

Scope:

```text
M11 read models, analytics snapshots, explainable rules, human-reviewed recommendations, opt-in cross-school aggregates, then AI/ML/LLM features.
```

Rules:

```text
No automated punishment or official action from AI output.
No cross-school analytics without anonymization, aggregation, explicit opt-in, and platform audit.
```

---

## Required Verification Gate

Run after every meaningful backend/module hardening change:

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

For frontend-heavy work, also run the relevant Playwright spec or `pnpm test:web:e2e` when credentials and local ports are available.
