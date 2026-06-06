# SchoolOS Implementation Status and Plan

**Last updated:** 2026-06-06  
**Status source:** Consolidated from `SCHOOLOS_CURRENT_REPO_ANALYSIS.md`, `SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`, `SCHOOLOS_MASTER_PROJECT_MEMORY.md`, `SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md`, 2026-06-04 commit inspection, and 2026-06-06 auth/entitlement/platform-UI hardening  
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
M1 Admissions & Student Profiles: Pilot-ready plus Student QR, storage/photo/logo, iEMIS artifact registration, duplicate candidate review, document audit, mobile child profile foundation, and satellite-controller entitlement gating (documents, photo, QR, siblings, academic-years)
M2 Smart Attendance: Pilot-ready plus correction/offline-draft, rejected replay regressions, correction-review UI, mobile teacher scope, real-data teacher dashboard, and mobile parent attendance summary query validation
M3 Fees & Receipts: Pilot-ready plus receipt reprint, reversal, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage, and HMAC-secured online payment webhook verification
M4 Academics / Exams / CAS / Report Cards: Completed / Pilot-Ready with PDF/report/correction/snapshot polish
M5 Activity Feed & Milestones: Strong foundation with media privacy, consent-aware blocking, optimized previews, moderation controls, teacher media gallery, and media-access entitlement gating
M6 Homework / Timetable: Completed / Pilot-Ready with File Registry attachments, reminder hardening, absence/substitution conflict coverage, mobile homework/timetable views, and improved substitution slot selection / absence recording UI
M7 HR / Payroll: Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII masking, payroll reports, mobile staff self-service, and statutory deduction retrieval from active salary structures
M8A Library: Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, and reports/export polish
M8B Transport: Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports
M8C Canteen: Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, parent mobile views, and canteen workspace polish
M9 Accounting: Production-candidate / Pilot-Ready with PDFs, snapshots, audit trail, reconciliation suggestions, File Registry export support, and hardened bank statement import/reconciliation DTO validation
M10 Notices / Communication / Chat: Strong foundation with provider modes, attachments, failure dashboard, moderation/escalation, unread-recipient follow-up, mobile notification/chat surfaces, and full communications/messaging sub-controller entitlement gating
Public Demo Requests: Public POST intake plus platform operator list/detail/status-follow-up APIs and `/platform/demo-requests` review workspace with RBAC, audit logging, pagination/filtering, internal notes, public rate limiting, and tests
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

## 2.2 2026-06-06 Auth / Security Hardening Notes

Implemented in this slice:

```text
Auth / Security — suspended-tenant file and export denial
- Added shared SUSPENDED_TENANT_MESSAGE constant and PlansService.assertTenantActive().
- Added TenantActiveGuard for controller-level denial on /files routes.
- FileRegistryService now asserts tenant active on register, signed URL, protected download, access checks, and soft delete.
- ReportsService now asserts tenant active on export, queued export completion, retry, snapshot download, and export history.
- EntitlementGuard reuses the shared suspended-tenant message for entitled controllers (including /reports).
- Added unit tests (guard, plans, file registry, reports) and tenant-active-hardening e2e coverage.
- Test helpers now seed active tenant records when ensureTenantDefaultsWithState() is called.
```

Verification run for this slice:

```text
pnpm --filter @schoolos/api test        → 961 passed
pnpm --filter @schoolos/api test:e2e    → 183 passed
pnpm lint                               → passed
pnpm build                              → passed
```

Remaining auth/security hardening after this slice:

```text
- Broader cross-tenant denial tests across tenant-owned read/write paths.
- Full browser session smoke for suspended-tenant UX messaging.
- Permission-denied and session-expiry UX polish on web and mobile.
- Support override warning banner and role/permission inspection UI.
```

---

## 2.3 2026-06-06 M0 Entitlement + Queue + Mobile Hardening Notes

Implemented in this slice:

```text
Mobile parent API entitlement depth
- Added @RequiredModule gates on mobile parent sub-routes (fees, homework, timetable, exams, activity, canteen, library, transport, attendance, students).
- Class-level MOBILE_PARENT_BASIC remains required; paid-module routes now require both.

M0 entitlement enforcement depth
- Added EntitlementGuard + module.fees to finance-compat and ledger controllers.
- Added EntitlementGuard + RequiredModule('activity') to activity-feed controller.

Queue / background job hardening
- Added PlansService.shouldProcessTenantJob() and skipSuspendedTenantJob helper.
- Finance, payroll, homework, notifications, activity-media, canteen-alerts, and reports processors skip jobs for suspended/missing tenants.
- Reports processor marks queued exports FAILED with the standard suspended message when skipped.

Tests
- route-denial e2e: mobile sub-module denial, suspended mobile denial, finance-compat and activity-feed module denial.
- notifications processor unit test for suspended-tenant skip.
- processor-tenant.guard and shouldProcessTenantJob unit tests.
```

Verification run for this slice:

```text
pnpm --filter @schoolos/api test        → 966 passed
pnpm --filter @schoolos/api test:e2e    → 187 passed
pnpm lint                               → passed
pnpm build                              → passed
```

Remaining M0 / provider / queue backlog:

```text
- Platform queue monitoring for reports and canteen-alerts queues.
- Discard reason DTO for platform removeJob.
- Provider-specific readiness depth (SMS/email/FCM/storage/gateway) with staging verification.
- Guided tenant onboarding checklist UI (school profile, academic year, classes, fee heads, users, modules).
- Provider health dashboard and storage readiness panel polish.
```

---

## 2.4 2026-06-06 M1/M5/M10 Entitlement Depth + Platform Demo Requests UI Notes

Implemented in this slice:

```text
M1 Admissions / Student Profiles entitlement depth
- Added EntitlementGuard + module.students to student-documents, student-document-access, student-photo, student-qr, siblings, and academic-years controllers.

M5 Activity Feed entitlement depth
- Added EntitlementGuard + RequiredModule('activity') to media-access controller.

M10 Notices / Communication / Chat entitlement depth
- Added EntitlementGuard + module.communications to deliveries, events, consents, notice-detail, notification-center (+ aliases), m10-hardening, parent-teacher-chat, and messaging-hardening controllers.

Platform Demo Requests / Marketing Intake frontend
- Added platform API helpers: listPlatformDemoRequests, getPlatformDemoRequest, updatePlatformDemoRequestStatus.
- Added /platform/demo-requests operator workspace with search, status filters, detail review, internal notes, and follow-up status updates.
- Added platform navigation entry gated by platform:demo-requests:read.

Tests
- route-denial e2e: communications-deliveries module denial and student-documents module.students denial.
- web contract coverage for platform demo request API, page, and navigation.
```

Verification run for this slice:

```text
pnpm lint                               → passed
pnpm --filter @schoolos/api test        → 966 passed
route-denial e2e                        → 18 passed
pnpm --filter @schoolos/web test        → 148 passed
pnpm --filter @schoolos/web build       → passed
```

Remaining after this slice (M1–M10 production depth, not greenfield):

```text
See Section 11 — Remaining Implementation by Module (M1–M10) for the full per-module backlog.
At a high level, M1–M10 backend APIs and dashboard workspaces are pilot-ready; remaining work is enhancement depth, staging/browser smoke, and mobile companion polish — not missing core CRUD flows.
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

Frontend routes in `apps/web/app` include dashboard workspaces for students, admissions, attendance, fees/finance, activity, notices, messaging, academics, homework, timetable, HR, payroll, accounting, library, transport, canteen, settings, platform control (including `/platform/demo-requests` lead review), and public demo request intake.

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
| M5 Activity Feed & Milestones | Strong foundation with private media, consent-aware media blocking, optimized previews, moderation, gallery, and media-access entitlement gating | 91-96% |
| M6 Homework & Timetable | Backend/admin/mobile surfaces complete for current scope; reminders, attachments, timetable conflicts, substitutions, slot selection, and absence recording hardened | 98-100% |
| M7 HR & Payroll | Backend/admin/mobile surfaces complete for current scope; posting locks, reversals, PII masking, payroll reports, statutory deductions from active salary structures | 96-100% |
| M8A Library | Admin/backend foundation plus fines, reports, QR lookup, staff borrowers, fine-to-fees/accounting boundary | 92-96% |
| M8B Transport | Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention and driver/parent mobile surfaces | 91-95% |
| M8C Canteen | Admin/wallet/POS/inventory/vendor/report foundation plus stock hardening, receipt PDF, linked invoice handoff, mobile parent views, and workspace polish | 93-97% |
| M9 Accounting & Finance | Production-candidate for current scope; reports, PDFs, snapshots, audit, reconciliation suggestions, bank statement import validation, reconciliation DTOs | 98-100% |
| M10 Notices / Communication / Chat | Strong foundation with provider modes, attachments, failure dashboard, moderation, unread follow-up, mobile chat/notification surfaces, and full sub-controller entitlement gating | 93-97% |
| Public Demo Requests / Marketing Intake | Public POST intake plus platform APIs and `/platform/demo-requests` operator workspace with internal notes, RBAC, audit logging, rate limiting, and tests | 96-98% |
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

For a **single consolidated remaining-work list for M1–M10** (backend, web, mobile, and tests), read **Section 11** in this document.

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
| Auth / tenant / RBAC | Yes: auth, tenants, roles, users, RBAC, support override, TenantActiveGuard, suspended-tenant file/export denial, mobile per-module gates, queue suspended-tenant skip, M1/M5/M10 satellite-controller entitlement gating | Continue cross-tenant denial tests; permission-denied/session-expiry UX; support override banner | Yes: auth plus shared client/session helpers | Yes: login/register/session shell | No broad route issue found in first pass | Full browser session smoke still required |
| M0 Platform | Yes: tenants, plans, billing, providers, queues, API keys, webhooks, report exports, structured platform DTOs, background job suspended-tenant skip | Platform queue monitoring for reports/canteen-alerts; discard reason on removeJob; provider-specific readiness staging; onboarding checklist UI | Yes: `platform.ts` exported incl. demo-request helpers | Yes: platform dashboard, schools, billing, settings, demo-requests | No broken platform links found in first pass | `test:web:e2e` still environment-sensitive |
| M1 Students / Admissions | Yes: students, admissions, records, QR, documents, classes, sections, academic-years; EntitlementGuard now covers student-documents, document-access, photo, QR, siblings, academic-years | Continue ownership and document-access tests | Yes: `students.ts` plus academics helpers | Yes: students, admissions, student detail | Settings had dead student/staff import links; fixed in prior slice | Needs dashboard route smoke |
| M2 Attendance | Yes: attendance, HR attendance controllers/services, mobile parent attendance summary query DTO | Continue correction/offline/suspended-tenant tests | Yes: `attendance.ts` | Yes: attendance and register routes | No broken route found in first pass | Needs route smoke and mutation confirmation audit |
| M3 Fees / Receipts | Yes: fees, finance compat, payments, receipts, ledger, HMAC webhook verification | Continue reversal/refund/cashier-close isolation tests and gateway sandbox verification | Yes: `finance.ts` | Yes: fees/finance components; finance form no longer relies on hardcoded values for touched flow | No broken route found in first pass | Needs browser mutation smoke and webhook/provider-mode staging smoke |
| M4 Academics / Report Cards | Yes: academics, subjects, marks, CAS, locks, report-card PDFs | Continue report generation failure and correction tests | Yes: `academics.ts` | Yes: academics overview and subroutes | Settings linked to missing `/dashboard/academics/years`; fixed to implemented exam terms route | Specifically smoke `/dashboard/academics/report-cards` |
| M5 Activity Feed | Yes: activity feed, media access, privacy routes; media-access controller now has RequiredModule('activity') | Continue consent/media cross-tenant tests | Yes: `activity.ts` | Yes: activity, parent activity, detail route | No broken route found in first pass | Needs protected media browser smoke |
| M6 Homework / Timetable | Yes: homework, timetable, substitutions, conflicts | Continue attachment and conflict lifecycle tests | Yes: homework/timetable methods in `academics.ts` | Yes: homework, timetable, builder, review/subroutes; substitution slot/absence UI improved | Timetable linked to missing `/dashboard/timetable/new`; fixed to builder route | Needs dashboard route smoke and substitution mutation smoke |
| M7 HR / Payroll | Yes: staff, HR attendance/leave, payroll, payslips, reports, statutory deduction retrieval from active salary structures | Continue PII/approval/post/reverse tests | Yes: `payroll.ts`; staff APIs via shared exports | Yes: HR, HR staff, payroll, payslips, reports | Settings linked to old `/dashboard/hr/payroll`; fixed to payroll reports | Needs HR/payroll mutation smoke |
| M8 Library | Yes: library CRUD, fines, reports, QR lookup | Continue lost/damaged/fine posting tests | Yes: `library.ts` | Yes: library workspace and subroutes | No broken route found in first pass | Needs reports/export smoke |
| M8 Transport | Yes: routes, stops, vehicles, assignments, trips, GPS, reports | Continue driver/parent scope and GPS retention tests | Yes: `transport.ts` | Yes: transport workspace and subroutes | No broken route found in first pass | Needs route and CSV smoke |
| M8 Canteen | Yes: menu, plans, POS, wallets, inventory, reports | Continue stock/POS reversal/wallet guard tests | Yes: `canteen.ts` | Yes: canteen workspace and subroutes; workspace polish added | No broken route found in first pass | Needs POS/report smoke |
| M9 Accounting | Yes: accounts, journals, reports, reconciliation, PDFs, bank statement DTO/import validation | Continue fiscal lock/reversal/export failure and bank reconciliation browser tests | Yes: `accounting.ts` | Yes: accounting dashboard and subroutes | No broken route found in first pass | Needs report/export/import/reconciliation smoke |
| M10 Notices / Messaging | Yes: notices, communications deliveries, messaging, parent-teacher chat; EntitlementGuard now covers all communications/messaging sub-controllers | Continue provider failure, retry, moderation, attachment tests | Yes: `communications.ts`, `messaging.ts` | Yes: notices, messages/messaging routes | No broken route found in first pass | Needs provider-mode browser smoke |
| Public Demo Requests / Marketing Intake | Yes: public POST intake plus platform list/detail/status follow-up APIs, internal notes, RBAC, audit logging, pagination/filtering, public throttling, tests | Continue staging public abuse review and operator follow-up workflow polish | Yes: `marketing.ts`, `platform.ts` demo-request helpers | Yes: request-demo form plus `/platform/demo-requests` operator workspace | No route issue found in touched public/platform flow | Needs platform lead-review browser smoke and staging public abuse review |
| Settings / Audit Visibility | Yes: settings audit-log service/controller depth and access-control tests | Continue role/permission coverage and pagination/filter hardening | Yes: settings APIs and platform/user helper exports | Yes: settings page audit-log UI depth added | No known route issue from touched slice | Needs settings browser smoke |
| Reports / File Registry / Storage | Yes: reports, export history, File Registry, storage boundaries, suspended-tenant denial on signed URLs, protected downloads, and report exports | Continue export failure retry coverage; extend suspended-tenant denial to any remaining direct-storage bypass paths | Report helpers in `client.ts` and module APIs now cover async export acknowledgements plus protected snapshot history/downloads | Yes: dashboard reports page now has report selection, background export queueing, Recent Exports status rows, and module-locked route gating for non-entitled tenants | Tenant API access/webhook cards had no backend tenant route; disabled in current slice. Reports module entitlement gate added to avoid frontend calls/buttons when plan lacks `module.reports` | Needs entitled-tenant export-history browser smoke once a seeded tenant includes the Reports module |

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

---

## 11. Remaining Implementation by Module (M1–M10)

**Last reviewed:** 2026-06-06

M1–M10 are **pilot-ready for current scope**: backend APIs, database persistence, tenant isolation, RBAC, dashboard workspaces, and mobile companion surfaces exist for core workflows. The items below are **remaining production depth and enhancement work** — not missing greenfield modules. Full detail also lives in `SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md`.

### Cross-cutting (all modules)

```text
Backend
- Broader cross-tenant denial tests on tenant-owned read/write paths.
- Staging verification: pnpm smoke:phase1 with Postgres, Redis, API, and web.
- OpenAPI gate and full e2e/browser smoke rerun in a port-bindable environment.

Web frontend
- Permission-denied screens for direct route access.
- Session-expiry and slow-network recovery states.
- Module-locked empty states where plan lacks entitlement (partial coverage exists).

Mobile (Flutter)
- Secure token refresh/logout hardening, role-aware route guards, session-expired/forbidden states.
- Device smoke for teacher/staff/driver/parent flows.
```

### M1 — Admissions & Student Profiles (93–97%)

```text
Backend remaining
- Stronger duplicate detection (Nepali/English/mixed names, guardian phone reuse, siblings).
- Student lifecycle timeline API (admitted, class changed, transferred, withdrawn, graduated, rejoined, archived).
- QR revoke/rotate history and QR scan audit.
- Document expiry/reminder metadata.
- Student-level iEMIS readiness score and missing-field reasons.
- Import review queue for partial/duplicate legacy records.
- Expanded ownership and document-access cross-tenant tests.

Web frontend remaining
- Admission draft autosave and recovery.
- Duplicate warning and sibling/guardian relationship resolution UI.
- Unified student profile timeline (admissions, attendance, fees, documents, academics, communication, lifecycle).
- QR management UI (generate, revoke, rotate, audit).
- Document checklist with missing/expired/verified status.
- iEMIS readiness panel per student and class.

Mobile remaining
- Parent/student profile depth: child switcher, QR identity, safe document previews.
- Teacher quick student profile scoped to assigned classes only.
```

### M2 — Smart Attendance (93–97%)

```text
Backend remaining
- Deterministic offline attendance sync conflict rules.
- Lock-window enforcement and correction workflow audit depth.
- Duplicate session prevention for concurrent teachers.
- Absence streak, repeated late, and attendance anomaly calculations.
- Holiday/weekend/exam-day policy integration.

Web frontend remaining
- Dedicated attendance workspace polish: bulk present, exception workflows, correction queue reports.
- Class/month/student attendance reports and exports.
- Attendance anomaly dashboard for principal/admin.

Mobile remaining
- Offline attendance draft queue with sync status (pending, synced, failed, retry).
- Teacher assigned-class roster and bulk present.
- Parent/student monthly attendance calendar with reason display.
```

### M3 — Fees & Receipts (94–97%)

```text
Backend remaining
- Sandbox/staging payment gateway verification before enabling real gateways.
- Webhook duplicate, forged, delayed, and out-of-order handling tests.
- Refund/reversal approval workflow with reason and audit.
- Scholarship/discount adjustment workflow after invoice creation.
- Cashier-close concurrency and idempotency coverage.

Web frontend remaining
- Cashier-first collection screen polish (search, partial/full collect, print/share).
- Reusable fee templates by class, transport, canteen, exam, activity, scholarship, discount.
- Receipt QR verification and reprint history UI.
- Day-end cashier close by cash, bank, manual reference, and future gateway mode.
- Overdue reminder preview and defaulter segmentation.

Mobile remaining
- Parent fee dashboard, invoice/receipt list/detail, PDF download/share, due alerts.
- Payment initiation remains disabled until gateway verification and idempotency are staging-proven.
```

### M4 — Academics / Exams / CAS / Report Cards (98–100%)

```text
Backend remaining
- Tenant-configurable grading scale and rounding policy.
- Marks lock/unlock approval workflow with reason and audit.
- Retest/make-up exam handling.
- Result withholding policy integration with dues where enabled.
- Large report-card batch generation thresholds and background jobs.

Web frontend remaining
- Exam-term and assessment-component templates.
- Teacher-friendly marks grid with autosave and absent/withheld/retest states.
- Rubric-based CAS entry and progress timeline.
- Report-card template polish with school branding and remarks.
- Promotion readiness dashboard (automatic calculation plus manual decision).

Mobile remaining
- Exam schedule, published marks, report-card list/detail, PDF download/share.
- Show only published results and permission-safe data.
```

### M5 — Activity Feed & Milestones (91–96%)

```text
Backend remaining
- Stronger consent-aware media tests across guardian changes and removed students.
- Media upload cleanup for post-create failures.
- Moderation state cache invalidation and removed-content disappearance checks.
- Delivery retry idempotency for activity notifications.

Web frontend remaining
- Improved teacher post composer with class/section/student audience preview.
- Image compression, upload retry, and low-bandwidth preview behavior.
- Montessori/ECD milestone templates.
- Moderation queue with reason, restore/archive, and audit trail.

Mobile remaining
- Parent child-specific feed and activity detail.
- Teacher create post with image compression and audience selection.
- Signed media preview/download refresh behavior.
```

### M6 — Homework & Timetable (98–100%)

```text
Backend remaining
- Homework templates, recurring homework, and scheduled reminders.
- Attachment lifecycle and reminder re-check tests.
- Stronger timetable workload balancing and conflict scoring.
- Substitution workflows linked to staff leave/absence.

Web frontend remaining
- Drag-and-drop timetable builder polish.
- Homework template library and recurring assignment UI.
- Homework completion reports and teacher workload report.
- Substitution calendar with teacher availability.

Mobile remaining
- Teacher homework creation with attachments.
- Parent/student homework detail, offline viewing, due reminders, submission status.
- Weekly timetable and substitution alerts.
```

### M7 — HR & Payroll (96–100%)

```text
Backend remaining
- Staff lifecycle timeline and contract expiry reminders.
- Shift/check-in/check-out support where required.
- Leave balance rules and leave-without-pay payroll impact.
- Salary structure versioning and payroll draft safety.
- Payroll reversal/accounting reconciliation regression coverage.

Web frontend remaining
- Staff profile timeline (joined, contract changed, leave, payroll, documents, exit).
- Leave calendar and approval queue polish.
- Salary template and allowance/deduction rule UI.
- Branded payslip PDF polish and payroll report filters.

Mobile remaining
- Leave request creation, leave approval, payslip detail/download, attendance/check-in, staff notices.
- Salary/bank fields masked unless permission allows.
```

### M8A — Library (92–96%)

```text
Backend remaining
- Lost/damaged lifecycle and fine/replacement workflows.
- Holiday-aware overdue fine calculation.
- Student/staff borrower policy differences.
- Fine posting/payment reconciliation idempotency tests.

Web frontend remaining
- ISBN/barcode entry and full metadata (author, publisher, category, shelf).
- Scanner-first issue/return flow with student QR and book barcode.
- Overdue, lost books, fine summary, and popular books reports.
- Book copy archive instead of unsafe deletion when history exists.

Mobile remaining
- Borrowed books, due dates, fine warnings, book search, book detail.
- Librarian scanner workflows after device QA.
```

### M8B — Transport (91–95%)

```text
Backend remaining
- Background/automated driver GPS ping flow after device-auth contracts.
- Stale-location metrics and Redis outage fallback behavior.
- GPS ingestion acceptance/rejection reports.
- Route deviation, overspeed, geofence, and ETA (deferred until live tracking approved).
- Vehicle/driver overlapping trip validation and one-day route changes.

Web frontend remaining
- Admin stale-location labels and latest-location confidence indicators.
- Trip history and GPS quality reports.
- Live map only after SSE/WebSocket decision and load testing (intentionally deferred).

Mobile remaining
- Driver start trip, stop list, boarded/dropped/absent, emergency contact, complete trip.
- Background GPS permission flow, location sync status, retry queue.
- Parent bus status: not started, en route, delayed, arrived, stale GPS.
```

### M8C — Canteen (93–97%)

```text
Backend remaining
- POS double-submit and receipt reprint idempotency tests.
- Allergy/medical warning enforcement before serving.
- Daily/monthly spending controls and low-balance events.
- Stock close, wastage, vendor bill edit locks, negative stock prevention.

Web frontend remaining
- Fast POS mode with QR/student search, wallet balance, allergy warning, receipt.
- Daily/weekly menu planner.
- Inventory low-stock alerts, vendor purchase reports, wastage reports.
- Meal-plan cancellation and linked invoice status clarity.

Mobile remaining
- Parent wallet balance, meal plan, today's menu, low-balance alert.
- Student meal QR.
- Canteen scanner and serve meal flow after device QA.
```

### M9 — Accounting & Finance (98–100%)

```text
Backend remaining
- Nepal school-friendly default chart of accounts templates.
- Fiscal close/reopen safety and period-lock regression coverage.
- Reversal/correction-only enforcement for posted records.
- Source mapping checks for fees, payroll, canteen, library, and transport.
- Large-report background export thresholds.

Web frontend remaining
- Accountant dashboard for fiscal status, unreconciled items, pending postings, export history.
- Bank reconciliation review with manual confirmation polish.
- Report snapshots and large export progress UI.
- Source-ledger drilldown from accounting entries back to original module records.

Mobile remaining
- Principal read-only finance snapshot only; no full COA/journal editing on mobile.
```

### M10 — Notices / Communication / Chat (93–97%)

```text
Backend remaining
- Real provider callback verification (duplicate, forged, failed, delayed, out-of-order).
- Notification retry idempotency and provider-disabled fail-closed behavior.
- Quiet-hours and moderation policy enforcement for chat.
- Attachment access tests after guardian removal or role change.

Web frontend remaining
- Notice templates (holiday, fee reminder, emergency, exam, transport delay, event).
- Recipient preview before high-impact notices.
- Failed-recipient retry and unread follow-up UI polish.
- Communication audit for emergency and high-impact messages.

Mobile remaining
- Push notifications, notification center polish, notice attachment preview.
- Chat read receipts, quiet-hours banner, report/block/escalation flow.
```

### Suggested implementation order (M1–M10 depth)

Follow the strict phase gate in Section 6. Within M1–M10 enhancement work, prefer:

```text
1. Staging/browser smoke and cross-tenant tests (unblocks pilot confidence).
2. M2 offline sync + M3 gateway sandbox (core daily operations risk).
3. M1 lifecycle timeline + M10 provider callback hardening (data trust).
4. M4 promotion readiness + M9 source-ledger drilldown (academic/finance polish).
5. M6/M7 template and timeline UIs (coordinator/HR productivity).
6. M8 device QA and mobile depth (operations verticals).
7. M11 only after reliable production data and explicit owner approval.
```
