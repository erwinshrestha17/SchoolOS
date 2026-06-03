# SchoolOS Implementation Status and Plan

**Last updated:** 2026-06-03  
**Status source:** Consolidated from `SCHOOLOS_CURRENT_REPO_ANALYSIS.md`, `SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`, and `SCHOOLOS_MASTER_PROJECT_MEMORY.md`  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard, Flutter companion app

---

## 1. Purpose

This is the active implementation status and phase plan for SchoolOS. It replaces the older split files:

```text
/docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
/docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
```

Use this file to understand:

- What is implemented.
- What remains.
- Which modules are pilot-ready.
- Which risks remain before multi-school production.
- What phase order future work must follow.

For long-term project context, read:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

For coding rules, read:

```text
DEVELOPMENT_RULES.md
```

---

## 2. Current Consolidated Verdict

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue/API-key/File Registry hardening implemented; staging/object-storage/browser coverage remains
M1 Admissions & Student Profiles: Pilot-ready plus Student QR, storage/photo/logo, iEMIS artifact registration, duplicate candidate review, document audit, and mobile child profile foundation
M2 Smart Attendance: Pilot-ready plus correction/offline-draft, rejected replay regressions, correction-review UI, mobile teacher scope, and real-data teacher dashboard
M3 Fees & Receipts: Pilot-ready plus receipt reprint, reversal, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, and transaction-race coverage
M4 Academics / Exams / CAS / Report Cards: Completed / Pilot-Ready with PDF/report/correction/snapshot polish
M5 Activity Feed & Milestones: Strong foundation with media privacy, consent-aware blocking, optimized previews, moderation controls, and teacher media gallery
M6 Homework / Timetable: Completed / Pilot-Ready with File Registry attachments, reminder hardening, absence/substitution conflict coverage, and mobile homework/timetable views
M7 HR / Payroll: Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII masking, payroll reports, and mobile staff self-service
M8A Library: Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, and reports/export polish
M8B Transport: Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports
M8C Canteen: Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, and parent mobile views
M9 Accounting: Production-candidate / Pilot-Ready with PDFs, snapshots, audit trail, reconciliation suggestions, and File Registry export support
M10 Notices / Communication / Chat: Strong foundation with provider modes, attachments, failure dashboard, moderation/escalation, unread-recipient follow-up, and mobile notification/chat surfaces
M11 School Intelligence / AI: Roadmap only
SchoolOS Flutter Mobile: Active companion app with scoped parent/student/teacher/staff/driver/admin surfaces where APIs exist
```

Current readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks and smoke verification
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

---

## 3. Latest Practical Caveats

```text
- Phase Gate 0 verification must be rerun in a local/staging environment that can bind browser-test ports.
- pnpm smoke:phase1 requires local Postgres, Redis, API, and web services.
- R2/S3-compatible object-storage support exists, but live staging bucket verification still requires configured credentials.
- Browser/device smoke remains important for mobile teacher/staff/driver/parent flows.
- Gateway payments must stay disabled/mock until sandbox/staging verification is complete.
- Live maps, background GPS, ETA/geofencing, AI/ML, biometric workflows, Angular migration, and microservices remain intentionally deferred.
```

---

## 4. Repository Implementation Map

Backend modules are registered in `apps/api/src/app.module.ts` and cover Auth/RBAC, M0 Platform, M1-M10 school modules, Prisma, Redis/BullMQ, storage, reports, File Registry, usage, plans, settings, and mobile APIs.

Frontend routes in `apps/web/app` include dashboard workspaces for students, admissions, attendance, fees/finance, activity, notices, messaging, academics, homework, timetable, HR, payroll, accounting, library, transport, canteen, settings, and platform control.

Shared contracts live in `packages/core/src`.

Flutter mobile lives in:

```text
apps/schoolos_mobile
```

Active mobile guide:

```text
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
```

---

## 5. Module Completion Snapshot

| Module | Current Status | Estimated Completion |
|---|---|---:|
| Auth / Security / Tenant Isolation | Strong backend/browser-session foundation with JWT issuer/audience, CSRF, support override, throttling, request IDs, structured logging, and production secret/cookie validation | 93-97% |
| M0 Platform Core | Tenant, plan, feature, usage, SaaS billing foundation, API keys, provider readiness, queue detail/retry, File Registry, report exports, onboarding, and storage boundary hardening | 85-90% |
| M1 Admissions & Student Profiles | Pilot-ready plus Student QR, storage/photo/logo, parent-safe mobile profile, iEMIS export artifact registration, duplicate review, document audit | 93-97% |
| M2 Smart Attendance | Pilot-ready plus correction/offline draft, rejected sync replay, mobile teacher scope, parent attendance, correction queue | 93-97% |
| M3 Fees & Receipts | Pilot-ready plus receipt/cashier-close hardening, Analysis exports, protected day-end PDFs, race coverage | 93-97% |
| M4 Academics / Exams / CAS / Report Cards | Backend/admin UI plus PDF/report/correction/history/snapshot polish implemented | 98-100% |
| M5 Activity Feed & Milestones | Strong foundation with private media, consent-aware media blocking, optimized previews, moderation, gallery | 90-95% |
| M6 Homework & Timetable | Backend/admin/mobile surfaces complete for current scope; reminders, attachments, timetable conflicts, substitutions hardened | 98-100% |
| M7 HR & Payroll | Backend/admin/mobile surfaces complete for current scope; posting locks, reversals, PII masking, payroll reports | 95-100% |
| M8A Library | Admin/backend foundation plus fines, reports, QR lookup, staff borrowers, fine-to-fees/accounting boundary | 92-96% |
| M8B Transport | Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention and driver/parent mobile surfaces | 91-95% |
| M8C Canteen | Admin/wallet/POS/inventory/vendor/report foundation plus stock hardening, receipt PDF, linked invoice handoff, mobile parent views | 93-97% |
| M9 Accounting & Finance | Production-candidate for current scope; reports, PDFs, snapshots, audit, reconciliation suggestions | 98-100% |
| M10 Notices / Communication / Chat | Strong foundation with provider modes, attachments, failure dashboard, moderation, unread follow-up, mobile chat/notification surfaces | 92-96% |
| M11 Intelligence / AI | Roadmap only | 0% |

---

## 6. Strict Phase-Wise Implementation Plan

This order is mandatory unless the project owner explicitly changes it. Do not start a later phase because it is more interesting.

### Phase Gate 0 — Stabilize Main Before New Scope

Allowed work:

```text
verification fixes
migration fixes
seed fixes
tenant isolation fixes
permission fixes
doc alignment
small code-file modularization in touched areas
```

Blocked work:

```text
AI
Angular migration
microservices
broad new modules
deep mobile expansion without purpose-limited APIs and ownership tests
live transport map/WebSocket/SSE UI
biometric workflows
```

Exit criteria:

```text
1. Prisma generate and validate pass.
2. OpenAPI gate passes.
3. Lint, typecheck, unit tests, API E2E, web E2E, build, verify:production pass.
4. Local/staging smoke:phase1 runs with API, web, Postgres, and Redis.
5. Pending migrations are applied or intentionally parked with written reason.
6. Seed data supports every dashboard module route used in browser smoke.
7. No stale docs claim a module is next when it is already implemented.
```

### Phase 1 — Pilot Reliability for Existing Core

Scope:

```text
Auth/Security, M0, M1, M2, M3, M5, M10, settings, reports, File Registry, notifications.
```

Focus:

```text
staging secrets/session review
storage readiness
request/correlation logging
notification provider failure visibility
export/report history
tenant isolation tests
platform denial tests
entitlement enforcement tests
permission-denied and slow-network browser states
```

Exit criteria: one real school can run daily admissions, attendance, fees, notices, activity, settings, and platform operations without engineering handholding.

### Phase 2 — High-Value Academic and Finance Polish

Scope:

```text
M4 Academics and M9 Accounting.
```

Remaining focus:

```text
staging object-storage/browser smoke verification
large-report threshold tuning
browser E2E execution where local ports can bind
```

Exit criteria: academics and accounting can be sold as production-grade admin modules for the current Nepal school scope.

### Phase 3 — Harden Homework/Timetable and HR/Payroll

Scope:

```text
M6 Homework/Timetable and M7 HR/Payroll.
```

Remaining focus:

```text
browser smoke execution in staging
mobile device smoke for teacher/staff flows
real-data QA for seeded assignments, payslips, attendance, and leave workflows
```

Exit criteria: academic coordinators, teachers, HR admins, and accountants can run these modules without direct database/admin intervention.

### Phase 4 — Harden Extended Operations Verticals

Scope:

```text
M8A Library, M8B Transport, M8C Canteen.
```

Remaining focus:

```text
Library barcode/QR scan QA
Transport driver device GPS runtime QA and background/automated location ping flow later
Canteen QR/POS speed polish
Inventory/vendor edge-case staging coverage
Operation-specific Playwright tests
```

Exit criteria: operations modules are reliable admin products, not just demos.

### Phase 5 — Mobile Companion, Parent, Driver, and Live Experiences

Scope:

```text
Flutter parent/student/teacher/staff/driver/admin companion app depth.
```

Rules:

```text
Use purpose-limited APIs.
Do not reuse admin-shaped responses directly.
Add ownership tests before release.
Keep parent/student/driver data fail-closed.
```

### Phase 6 — M11 Intelligence / AI Readiness

Scope:

```text
Roadmap only until reliable production data exists.
```

Rules:

```text
No AI/ML runtime or LLM calls until explicitly approved.
No automated punishment/risk action.
Human review is mandatory for recommendations.
Tenant isolation and audit logging are mandatory.
```

---

## 7. Required Verification Gate

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

For Flutter mobile work, run:

```bash
flutter pub get
dart format .
flutter analyze
flutter test
```

Add `flutter build apk --debug` and `flutter build ios --no-codesign` when preparing mobile release/build verification.

---

## 8. Non-Negotiable Rules

```text
- Tenant isolation is mandatory.
- Parent/student/mobile APIs must be purpose-limited and fail closed.
- SchoolOS SaaS billing must not mix with school fee collection.
- Money flows must be idempotent and auditable.
- Confirmed financial records must use reversal/correction workflows.
- Private files must use StorageService/FileRegistryService boundaries.
- Provider-disabled/mock modes must be honest in UI.
- Do not implement AI/analytics until reliable production data exists.
- Do not introduce microservices or Angular migration without explicit owner approval.
- Apply code-file modularization gradually in touched areas, not as a risky repo-wide rewrite.
```

---

## 9. Fresh Backend/Web Audit Checklist - 2026-06-03

Audit inputs used for this checklist:

```text
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
docs/design/SCHOOLOS_UI_UX_GUIDE.md
apps/api/src controllers/services/modules
apps/web/lib/api
apps/web/app/dashboard and apps/web/app/platform routes
apps/web/components dashboard/module workspaces
```

| Module | Backend implemented | Backend missing / hardening | Web API implemented | Web UI implemented | Web UI missing / route issue | Browser/runtime / test gap |
|---|---|---|---|---|---|---|
| Auth / tenant / RBAC | Yes: auth, tenants, roles, users, RBAC, support override foundations | Continue suspended-tenant and cross-tenant denial tests | Yes: auth plus shared client/session helpers | Yes: login/register/session shell | No broad route issue found in first pass | Full browser session smoke still required |
| M0 Platform | Yes: tenants, plans, billing, providers, queues, API keys, webhooks, report exports | Staging provider/object-storage/browser verification remains | Yes: `platform.ts` exported | Yes: platform dashboard, schools, billing, settings | No broken platform links found in first pass | `test:web:e2e` still environment-sensitive |
| M1 Students / Admissions | Yes: students, admissions, records, QR, documents, classes, sections, academic-years | Continue ownership and document-access tests | Yes: `students.ts` plus academics helpers | Yes: students, admissions, student detail | Settings had dead student/staff import links; fixed in current slice | Needs dashboard route smoke |
| M2 Attendance | Yes: attendance and HR attendance controllers/services | Continue correction/offline/suspended-tenant tests | Yes: `attendance.ts` | Yes: attendance and register routes | No broken route found in first pass | Needs route smoke and mutation confirmation audit |
| M3 Fees / Receipts | Yes: fees, finance compat, payments, receipts, ledger | Continue reversal/refund/cashier-close isolation tests | Yes: `finance.ts` | Yes: fees/finance components | No broken route found in first pass | Needs browser mutation smoke |
| M4 Academics / Report Cards | Yes: academics, subjects, marks, CAS, locks, report-card PDFs | Continue report generation failure and correction tests | Yes: `academics.ts` | Yes: academics overview and subroutes | Settings linked to missing `/dashboard/academics/years`; fixed to implemented exam terms route | Specifically smoke `/dashboard/academics/report-cards` |
| M5 Activity Feed | Yes: activity feed, media access, privacy routes | Continue consent/media cross-tenant tests | Yes: `activity.ts` | Yes: activity, parent activity, detail route | No broken route found in first pass | Needs protected media browser smoke |
| M6 Homework / Timetable | Yes: homework, timetable, substitutions, conflicts | Continue attachment and conflict lifecycle tests | Yes: homework/timetable methods in `academics.ts` | Yes: homework, timetable, builder, review/subroutes | Timetable linked to missing `/dashboard/timetable/new`; fixed to builder route | Needs dashboard route smoke |
| M7 HR / Payroll | Yes: staff, HR attendance/leave, payroll, payslips, reports | Continue PII/approval/post/reverse tests | Yes: `payroll.ts`; staff APIs via shared exports | Yes: HR, HR staff, payroll, payslips, reports | Settings linked to old `/dashboard/hr/payroll`; fixed to payroll reports | Needs HR/payroll mutation smoke |
| M8 Library | Yes: library CRUD, fines, reports, QR lookup | Continue lost/damaged/fine posting tests | Yes: `library.ts` | Yes: library workspace and subroutes | No broken route found in first pass | Needs reports/export smoke |
| M8 Transport | Yes: routes, stops, vehicles, assignments, trips, GPS, reports | Continue driver/parent scope and GPS retention tests | Yes: `transport.ts` | Yes: transport workspace and subroutes | No broken route found in first pass | Needs route and CSV smoke |
| M8 Canteen | Yes: menu, plans, POS, wallets, inventory, reports | Continue stock/POS reversal/wallet guard tests | Yes: `canteen.ts` | Yes: canteen workspace and subroutes | No broken route found in first pass | Needs POS/report smoke |
| M9 Accounting | Yes: accounts, journals, reports, reconciliation, PDFs | Continue fiscal lock/reversal/export failure tests | Yes: `accounting.ts` | Yes: accounting dashboard and subroutes | No broken route found in first pass | Needs report/export smoke |
| M10 Notices / Messaging | Yes: notices, communications deliveries, messaging, parent-teacher chat | Continue provider failure, retry, moderation, attachment tests | Yes: `communications.ts`, `messaging.ts` | Yes: notices, messages/messaging routes | No broken route found in first pass | Needs provider-mode browser smoke |
| Reports / File Registry / Storage | Yes: reports, export history, File Registry, storage boundaries | Continue signed URL, export failure, background retry coverage | Report helpers in `client.ts` and module APIs now cover async export acknowledgements plus protected snapshot history/downloads | Yes: dashboard reports page now has report selection, background export queueing, Recent Exports status rows, and module-locked route gating for non-entitled tenants | Tenant API access/webhook cards had no backend tenant route; disabled in current slice. Reports module entitlement gate added to avoid frontend calls/buttons when plan lacks `module.reports` | Needs entitled-tenant export-history browser smoke once a seeded tenant includes the Reports module |

First mechanical route audit result:

```text
routes: 103
links scanned: 69
broken links before current slice: 7
broken links fixed/disabled in current slice: 7
```

Focused browser verification added after the route audit:

```text
/dashboard/academics/report-cards was exercised with the real seeded
school-admin login and running API. The page and backend route passed once the
Playwright web server default was aligned to localhost, matching the API cookie
host used by local authenticated smoke tests.
```
