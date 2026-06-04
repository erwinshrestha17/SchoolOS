# SchoolOS Implementation Status and Plan

**Last updated:** 2026-06-04  
**Status source:** Consolidated from `SCHOOLOS_CURRENT_REPO_ANALYSIS.md`, `SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`, `SCHOOLOS_MASTER_PROJECT_MEMORY.md`, `SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md`, and 2026-06-04 commit inspection  
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

For module-wise feature and enhancement planning, read:

```text
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
```

For coding and agent rules, read:

```text
DEVELOPMENT_RULES.md
AGENTS.md
```

---

## 2. Current Consolidated Verdict

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue/API-key/File Registry hardening implemented; 2026-06-04 DTO validation added for provider status/support override/billing reason payloads; staging/object-storage/browser coverage remains
M1 Admissions & Student Profiles: Pilot-ready plus Student QR, storage/photo/logo, iEMIS artifact registration, duplicate candidate review, document audit, and mobile child profile foundation
M2 Smart Attendance: Pilot-ready plus correction/offline-draft, rejected replay regressions, correction-review UI, mobile teacher scope, real-data teacher dashboard, and mobile parent attendance summary query validation
M3 Fees & Receipts: Pilot-ready plus receipt reprint, reversal, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage, and HMAC-secured online payment webhook verification
M4 Academics / Exams / CAS / Report Cards: Completed / Pilot-Ready with PDF/report/correction/snapshot polish
M5 Activity Feed & Milestones: Strong foundation with media privacy, consent-aware blocking, optimized previews, moderation controls, and teacher media gallery
M6 Homework / Timetable: Completed / Pilot-Ready with File Registry attachments, reminder hardening, absence/substitution conflict coverage, mobile homework/timetable views, and improved substitution slot selection / absence recording UI
M7 HR / Payroll: Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII masking, payroll reports, mobile staff self-service, and statutory deduction retrieval from active salary structures
M8A Library: Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, and reports/export polish
M8B Transport: Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports
M8C Canteen: Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, parent mobile views, and canteen workspace polish
M9 Accounting: Production-candidate / Pilot-Ready with PDFs, snapshots, audit trail, reconciliation suggestions, File Registry export support, and hardened bank statement import/reconciliation DTO validation
M10 Notices / Communication / Chat: Strong foundation with provider modes, attachments, failure dashboard, moderation/escalation, unread-recipient follow-up, and mobile notification/chat surfaces
Public Demo Requests: New backend-persisted public demo request API, Prisma model/migration, CSRF allow-list entry, web form integration, marketing API helper, public smoke coverage, and DTO/service tests
Settings / Audit Visibility: Settings audit-log access and UI depth added with access-control tests
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

## 2.1 2026-06-04 Commit-Based Implementation Notes

Commits inspected:

```text
8f3c6c6d0ef2d8c404245984460ae29300a9c0d4 - Create AGENTS.md
f784effebb4950f739449ce83b0c3e1df797da26 - accounting/finance/payroll/platform/mobile/web hardening
baa525ce882f81383de128ef316fab0f22b4a8b6 - demo request backend/web integration plus settings/timetable/canteen polish
106856a4c21c8d1e6517ca3bb2596128007a5186 - docs: add module feature enhancement plan
f5bee7a7c36dce37c7e015b0c748a8e6a542f5ad - docs: reference module enhancement plan in project memory
55bca05fb657e54dc4f2a51533dd14dc21c34ee1 - docs: link module enhancement plan from implementation status
```

Implemented today:

```text
AGENTS / operating rules
- Added AGENTS.md with production implementation protocol, module completion criteria, verification expectations, and stop conditions.

M0 Platform Core
- Added structured DTOs and validation tests for provider status updates, support override entry, and platform tenant billing status reason payloads.
- Refined controller handling for these structured platform operations.

M2 Attendance / Mobile API
- Added ParentAttendanceSummaryQueryDto for mobile parent attendance summary month/year validation.
- Added DTO validation tests.

M3 Finance / Fees
- Added secure HMAC signature verification for online payment webhooks.
- Updated payment gateway status checks to remain adapter-aware and not claim readiness when the server adapter is unavailable.
- Added webhook/signature handling tests.
- Removed hardcoded values from the finance form and improved dynamic handling.

M6 Homework / Timetable
- Improved substitution modal slot selection.
- Improved substitutions list absence-recording flow with available timetable slots.
- Added/updated related web contract coverage.

M7 HR / Payroll
- Refined statutory deduction retrieval to use active salary structures.
- Updated PayrollController delegation with tenant context.
- Added hardening/controller tests for statutory deductions.

M8C Canteen
- Polished canteen workspace data/API handling and UI behavior.

M9 Accounting
- Added ImportBankStatementDto, ImportBankStatementLineDto, and ReconcileBankStatementDto.
- Added validation for empty bank statement imports, invalid dates/descriptions, negative amounts, zero-amount lines, and both debit/credit on one line.
- Replaced timestamp/Math.random import batch IDs with randomUUID-backed IDs.
- Switched bank statement access to generated Prisma client property.
- Added DTO and service tests for bank statement import validation.

Public Demo Requests / Marketing Intake
- Added DemoRequest Prisma model and migration.
- Added public POST /demo-requests endpoint with DTO validation and persistence.
- Added DemoRequestsModule, controller, service, DTO, service tests, and DTO tests.
- Added CSRF public allow-list coverage for demo requests.
- Updated RequestDemoForm to submit through backend API with better error/user feedback.
- Added marketing API helper and public smoke/contract tests.

Settings / Audit Visibility
- Added settings audit-log API/service/controller depth.
- Updated dashboard settings UI for audit-log visibility and access-control behavior.
- Added settings controller/service and web contract tests.

Web API / Security / Contracts
- Added school user-management API helper foundation.
- Updated frontend API request ID generation to use secure browser randomness.
- Expanded web contract tests for secure request IDs, demo request backend integration, settings audit behavior, and related UI/API contracts.

Documentation
- Added docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md.
- Linked the module enhancement plan from active project memory and implementation status docs.
```

Verification status:

```text
Not confirmed from this document update. The commits include tests and contract updates, but full local/staging verification still must be run before readiness claims are raised.
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

Backend modules are registered in `apps/api/src/app.module.ts` and cover Auth/RBAC, M0 Platform, M1-M10 school modules, Prisma, Redis/BullMQ, storage, reports, File Registry, usage, plans, settings, mobile APIs, and public demo requests.

Frontend routes in `apps/web/app` include dashboard workspaces for students, admissions, attendance, fees/finance, activity, notices, messaging, academics, homework, timetable, HR, payroll, accounting, library, transport, canteen, settings, platform control, and public demo request intake.

Shared contracts live in `packages/core/src`.

Flutter mobile lives in:

```text
apps/schoolos_mobile
```

Active mobile guide:

```text
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
```

Active module-wise feature/enhancement guide:

```text
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
```

---

## 5. Module Completion Snapshot

| Module | Current Status | Estimated Completion |
|---|---|---:|
| Auth / Security / Tenant Isolation | Strong backend/browser-session foundation with JWT issuer/audience, CSRF, support override, throttling, request IDs, structured logging, secure browser request IDs, and production secret/cookie validation | 93-97% |
| M0 Platform Core | Tenant, plan, feature, usage, SaaS billing foundation, API keys, provider readiness, queue detail/retry, File Registry, report exports, onboarding, storage boundary hardening, and structured platform operation DTOs | 86-91% |
| M1 Admissions & Student Profiles | Pilot-ready plus Student QR, storage/photo/logo, parent-safe mobile profile, iEMIS export artifact registration, duplicate review, document audit | 93-97% |
| M2 Smart Attendance | Pilot-ready plus correction/offline draft, rejected sync replay, mobile teacher scope, parent attendance, correction queue, and mobile attendance query validation | 93-97% |
| M3 Fees & Receipts | Pilot-ready plus receipt/cashier-close hardening, Analysis exports, protected day-end PDFs, race coverage, dynamic finance form handling, and HMAC payment webhook verification | 94-97% |
| M4 Academics / Exams / CAS / Report Cards | Backend/admin UI plus PDF/report/correction/history/snapshot polish implemented | 98-100% |
| M5 Activity Feed & Milestones | Strong foundation with private media, consent-aware media blocking, optimized previews, moderation, gallery | 90-95% |
| M6 Homework & Timetable | Backend/admin/mobile surfaces complete for current scope; reminders, attachments, timetable conflicts, substitutions, slot selection, and absence recording hardened | 98-100% |
| M7 HR & Payroll | Backend/admin/mobile surfaces complete for current scope; posting locks, reversals, PII masking, payroll reports, statutory deductions from active salary structures | 96-100% |
| M8A Library | Admin/backend foundation plus fines, reports, QR lookup, staff borrowers, fine-to-fees/accounting boundary | 92-96% |
| M8B Transport | Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention and driver/parent mobile surfaces | 91-95% |
| M8C Canteen | Admin/wallet/POS/inventory/vendor/report foundation plus stock hardening, receipt PDF, linked invoice handoff, mobile parent views, and workspace polish | 93-97% |
| M9 Accounting & Finance | Production-candidate for current scope; reports, PDFs, snapshots, audit, reconciliation suggestions, bank statement import validation, reconciliation DTOs | 98-100% |
| M10 Notices / Communication / Chat | Strong foundation with provider modes, attachments, failure dashboard, moderation, unread follow-up, mobile chat/notification surfaces | 92-96% |
| Public Demo Requests / Marketing Intake | Backend-persisted public demo request API, Prisma model/migration, CSRF allow-list, web form integration, API helper, and tests implemented | 90-95% |
| Settings / Audit Visibility | Settings audit-log API/UI depth and access-control tests added | 90-95% |
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
Auth/Security, M0, M1, M2, M3, M5, M10, settings, reports, File Registry, notifications, public demo intake.
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
public demo request monitoring and abuse controls
```

Exit criteria: one real school can run daily admissions, attendance, fees, notices, activity, settings, and platform operations without engineering handholding, and public demo intake can persist leads safely without affecting tenant operations.

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
bank statement import/reconciliation browser smoke
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
real-data QA for seeded assignments, substitution slot selection, payslips, statutory deductions, attendance, and leave workflows
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

## 7. Module-Wise Feature Enhancement Backlog

The active module-wise feature and enhancement backlog is maintained separately in:

```text
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
```

Use that document when planning feature enhancements for:

```text
Auth/Security
M0 Platform Core
M1 Admissions and Student Profiles
M2 Smart Attendance
M3 Fees and Receipts
M4 Academics, Exams, CAS, and Report Cards
M5 Activity Feed and Milestones
M6 Homework and Timetable
M7 HR and Payroll
M8A Library
M8B Transport
M8C Canteen
M9 Accounting and Finance
M10 Notices, Communication, and Chat
Public Demo Requests / Marketing Intake
Settings / Audit Visibility
M11 School Intelligence and AI
Flutter Mobile Companion App
Cross-module search, notifications, audit, offline, performance, and UI/UX polish
```

This backlog does not override the strict phase gate. During Phase Gate 0, only verification, migrations, seed data, tenant isolation, permissions, doc alignment, and small touched-area modularization are allowed.

---

## 8. Required Verification Gate

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

## 9. Non-Negotiable Rules

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

## 10. Fresh Backend/Web Audit Checklist - 2026-06-04

Audit inputs used for this checklist:

```text
DEVELOPMENT_RULES.md
AGENTS.md
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
docs/design/SCHOOLOS_UI_UX_GUIDE.md
apps/api/src controllers/services/modules
apps/web/lib/api
apps/web/app/dashboard and apps/web/app/platform routes
apps/web/components dashboard/module workspaces
2026-06-04 commit inspection
```

| Module | Backend implemented | Backend missing / hardening | Web API implemented | Web UI implemented | Web UI missing / route issue | Browser/runtime / test gap |
|---|---|---|---|---|---|---|
| Auth / tenant / RBAC | Yes: auth, tenants, roles, users, RBAC, support override foundations, secure request ID generation contract | Continue suspended-tenant and cross-tenant denial tests | Yes: auth plus shared client/session helpers | Yes: login/register/session shell | No broad route issue found in first pass | Full browser session smoke still required |
| M0 Platform | Yes: tenants, plans, billing, providers, queues, API keys, webhooks, report exports, structured provider/support/billing DTOs | Staging provider/object-storage/browser verification remains | Yes: `platform.ts` exported | Yes: platform dashboard, schools, billing, settings | No broken platform links found in first pass | `test:web:e2e` still environment-sensitive |
| M1 Students / Admissions | Yes: students, admissions, records, QR, documents, classes, sections, academic-years | Continue ownership and document-access tests | Yes: `students.ts` plus academics helpers | Yes: students, admissions, student detail | Settings had dead student/staff import links; fixed in prior slice | Needs dashboard route smoke |
| M2 Attendance | Yes: attendance, HR attendance controllers/services, mobile parent attendance summary query DTO | Continue correction/offline/suspended-tenant tests | Yes: `attendance.ts` | Yes: attendance and register routes | No broken route found in first pass | Needs route smoke and mutation confirmation audit |
| M3 Fees / Receipts | Yes: fees, finance compat, payments, receipts, ledger, HMAC webhook verification | Continue reversal/refund/cashier-close isolation tests and gateway sandbox verification | Yes: `finance.ts` | Yes: fees/finance components; finance form no longer relies on hardcoded values for touched flow | No broken route found in first pass | Needs browser mutation smoke and webhook/provider-mode staging smoke |
| M4 Academics / Report Cards | Yes: academics, subjects, marks, CAS, locks, report-card PDFs | Continue report generation failure and correction tests | Yes: `academics.ts` | Yes: academics overview and subroutes | Settings linked to missing `/dashboard/academics/years`; fixed to implemented exam terms route | Specifically smoke `/dashboard/academics/report-cards` |
| M5 Activity Feed | Yes: activity feed, media access, privacy routes | Continue consent/media cross-tenant tests | Yes: `activity.ts` | Yes: activity, parent activity, detail route | No broken route found in first pass | Needs protected media browser smoke |
| M6 Homework / Timetable | Yes: homework, timetable, substitutions, conflicts | Continue attachment and conflict lifecycle tests | Yes: homework/timetable methods in `academics.ts` | Yes: homework, timetable, builder, review/subroutes; substitution slot/absence UI improved | Timetable linked to missing `/dashboard/timetable/new`; fixed to builder route | Needs dashboard route smoke and substitution mutation smoke |
| M7 HR / Payroll | Yes: staff, HR attendance/leave, payroll, payslips, reports, statutory deduction retrieval from active salary structures | Continue PII/approval/post/reverse tests | Yes: `payroll.ts`; staff APIs via shared exports | Yes: HR, HR staff, payroll, payslips, reports | Settings linked to old `/dashboard/hr/payroll`; fixed to payroll reports | Needs HR/payroll mutation smoke |
| M8 Library | Yes: library CRUD, fines, reports, QR lookup | Continue lost/damaged/fine posting tests | Yes: `library.ts` | Yes: library workspace and subroutes | No broken route found in first pass | Needs reports/export smoke |
| M8 Transport | Yes: routes, stops, vehicles, assignments, trips, GPS, reports | Continue driver/parent scope and GPS retention tests | Yes: `transport.ts` | Yes: transport workspace and subroutes | No broken route found in first pass | Needs route and CSV smoke |
| M8 Canteen | Yes: menu, plans, POS, wallets, inventory, reports | Continue stock/POS reversal/wallet guard tests | Yes: `canteen.ts` | Yes: canteen workspace and subroutes; workspace polish added | No broken route found in first pass | Needs POS/report smoke |
| M9 Accounting | Yes: accounts, journals, reports, reconciliation, PDFs, bank statement DTO/import validation | Continue fiscal lock/reversal/export failure and bank reconciliation browser tests | Yes: `accounting.ts` | Yes: accounting dashboard and subroutes | No broken route found in first pass | Needs report/export/import/reconciliation smoke |
| M10 Notices / Messaging | Yes: notices, communications deliveries, messaging, parent-teacher chat | Continue provider failure, retry, moderation, attachment tests | Yes: `communications.ts`, `messaging.ts` | Yes: notices, messages/messaging routes | No broken route found in first pass | Needs provider-mode browser smoke |
| Public Demo Requests / Marketing Intake | Yes: DemoRequest model/migration, public controller/service/DTO, CSRF public allow-list, tests | Add admin/platform follow-up workflow for reviewing/responding to demo requests if required | Yes: `marketing.ts`, `api.submitDemoRequest` | Yes: request-demo form submits to backend and shows status/error feedback | No route issue found in touched public flow | Needs public smoke in staging and abuse/rate-limit review |
| Settings / Audit Visibility | Yes: settings audit-log service/controller depth and access-control tests | Continue role/permission coverage and pagination/filter hardening | Yes: settings APIs and platform/user helper exports | Yes: settings page audit-log UI depth added | No known route issue from touched slice | Needs settings browser smoke |
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
