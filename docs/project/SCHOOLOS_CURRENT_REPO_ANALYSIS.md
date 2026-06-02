# SchoolOS Current Repo Status Analysis

**Last updated:** 2026-06-02

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
SchoolOS Flutter Mobile: Started in `apps/schoolos_mobile`; auth/API connection, parent and teacher attendance, notification center read state, and staff self-service API/PDF wiring are active implementation surfaces
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
Phase Gate 0 verification was green before M0 and later feature-depth work started.
M0 provider/queue hardening and the M10 -> M6 -> M7 -> M8A -> M8C -> M8B feature-depth pass ran targeted tests and sprint gates through build.
M0/File Registry storage hardening now includes env-backed S3-compatible R2 PUT/GET support in StorageService instead of metadata-only R2 saves; live staging bucket verification still requires configured R2 credentials.
Local M0-M10 backend hardening now includes Accounting PDF control-total summaries, Student QR tenant-filtered token lookup, timetable Sunday/normalized-date substitution regressions, guardian-owned chat scope regressions, activity media File Registry upload-completion, CSRF/JWT guard regressions, attendance offline rejected-submission replay coverage, library tenant-scope tests, and cashier-close duplicate race coverage.
The admin web global polish pass now replaces all browser-native `alert()`/`confirm()` usage in `apps/web/app` and `apps/web/components` with shared app-controlled feedback, and adds a contract test to keep it that way.
`pnpm verify:production` must still be rerun in a local/staging environment that can bind browser-test ports if the sandbox blocks `127.0.0.1:3101`.
`pnpm smoke:phase1` still requires local Postgres, Redis, API, and web services to be running.
```

Latest feature-depth implementation:

```text
M10: explicit notification provider modes, adapter boundary, failure dashboard API, File Registry notice/chat attachment access, guardian-owned chat attachment tests, notice composer attachment upload, and Flutter notification-center read-state wiring through the mobile API.
M5: activity media list/detail/gallery responses now avoid exposing raw storage keys, public URLs, and File Registry IDs; parent media previews are blocked when PHOTO_USAGE consent is missing.
M2: Flutter teacher attendance now has purpose-limited assigned class, roster, and submit endpoints that reuse the existing backend teacher-scope attendance validation, with service-level tenant/staff assignment coverage.
M6: parent/student homework assignment and submission reads now fail closed when the actor is not linked to the requested student.
M7: payroll register endpoints now honor run scope; PF, TDS, and salary-component summaries are explicit backend reports. Payroll report filters now support run/month/year/status/department/staff scope, PF/TDS CSV exports use dedicated backend report services, the web payroll reports/dashboard no longer show hard-coded payroll or ledger figures, HR staff detail shows backend lifecycle audit history, and Flutter staff self-service uses real staff/attendance/payroll endpoints including payslip PDF download/share.
M8A: library fine-to-fees/accounting posting tests, staff borrower tests, purpose-limited QR test, and bounded history/report reads.
M8C: POS receipt endpoint, receipt controller coverage, wallet reversal/correction negative-balance guards, purchase-bill accounting/stock-movement tests, wastage/manual-adjustment negative-stock tests, and admin inventory purchase-bill/wastage/manual-adjustment UI wiring.
M8B: Redis-backed GPS pressure guard, latest-location cache/publish tests, throttled persistence coverage, and bounded cleanup retention.
M1: Student QR resolution now filters by tenant during token lookup and service regressions cover inactive/expired/rotated/revoked scan denial, last-scan metadata, purpose-limited responses, parent/teacher ownership checks, and cross-tenant status/rotate/revoke denial.
Frontend: dashboard shell/stat/card polish, accounting audit summary/detail polish, transport latest-location freshness, Library/Canteen scanner-first QR flows, M10 moderation/unread-recipient controls, report-card correction review, and app-controlled Toast/ConfirmDialog feedback across Academics, Homework, Admissions, Staff, Students, and Platform operations.
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
| Auth / Security / Tenant | Cookie-first auth, bearer support, RBAC, tenant context, platform/tenant separation, super-admin override audit, JWT issuer/audience checks, active support-session override checks, CSRF browser mutation protection, throttling, request-id propagation, structured request logging, and production secret/cookie validation. | Login/register/session-aware dashboard shell with direct-route permission-denied gating and slow-session retry/sign-in recovery. | Production credential review during deployment. | Broader browser coverage for permission-denied and slow-session states. |
| M0 Platform Core | Tenant management, plans/features, entitlements/usage, SaaS billing records plus renewal lifecycle automation, provider masking/readiness detail, queue health/retry/detail/history, file registry with signed upload/read/download hardening, webhooks, reports/exports, health, onboarding, and entitlement denial coverage across accounting, mobile parent, library, transport, canteen, and homework controllers. | `/platform/dashboard`, `/platform/schools`, tenant detail, platform settings, audit surfaces, API key management, webhook registry/history, provider readiness dialog, queue failed-job detail dialog. | Explicit staging object-storage checks, broader browser coverage, and wider tenant-isolation regression coverage as modules mature. | More platform tenant-action QA and browser coverage for critical platform mutations. |
| M1 Admissions & Students | Admissions, profiles, guardians, documents, lifecycle, search, photo/document access, duplicate/merge foundations, StudentIdentity, StudentQrCredential model/service/API with tenant-filtered QR resolution and tenant-scope QR regressions, local and S3-compatible storage service read/write support, document history reader. | Admissions workspace, student directory/detail/profile tabs, document/profile actions, QR card management, student document audit trail. | iEMIS final mapping, duplicate merge polish, staging storage-backed photo/document verification, and QR release verification/browser coverage. | QR manual QA, photo/logo upload UX polish, parent-safe student views later. |
| M2 Attendance | Attendance sessions/records, corrections, sync submissions/conflicts with rejected-submission persistence/replay regressions, drafts, monthly/history analytics, exports, teacher-scope tests, correction/guardian denial regressions, guardian-scoped mobile attendance summary with month-history data, and purpose-limited mobile teacher class/roster/submit endpoints with unassigned-scope denial coverage. | Attendance daily workflow and register routes; Flutter parent attendance uses the purpose-limited mobile API and selected-child state; Flutter teacher attendance loads assigned rosters and submits non-present exceptions through mobile teacher APIs. | Attendance export/report staging verification. | Slow-network/offline UX, correction workflow polish, and browser/manual QA for reconnect conflict choices. |
| M3 Fees & Receipts | Fee heads/plans, invoices, payments, receipts, cashier close with deterministic duplicate keys and transaction-level race regression coverage, refunds/reversals, ledger/report foundations, M9 consistency coverage. | Fees/finance workspaces, collection counter with fee-head/period dues filters and line quick-fill, ledger, receipt/reprint/correction UI foundations. | Online payment gateway readiness, live cashier-close race verification against a real DB, and staging export/PDF coverage. | Gateway payment UX after provider approval and finance report export polish. |
| M4 Academics / Exams / CAS / Report Cards | Exam terms, assessment components, marks, CAS, grading/GPA preview, locks/unlocks, polished report-card PDFs, raster logo embedding, correction/regeneration history, academic CSV/PDF exports, report snapshots, promotion readiness, publishing, parent notification hooks, contract tests. | Academics hub and routes for setup, marks, CAS, locks, results, report cards, promotion, publishing; keyboard marks/CAS polish; report-card download/history/correction actions with review dialog; browser smoke coverage. | Further staging data QA, final index review after usage stabilizes. | Staging/browser re-verification as deployment data changes. |
| M5 Activity Feed & Milestones | Posts, targeting, attachments/media access, lifecycle, reactions, milestones/mood foundations, media privacy tests, audited post edit/moderation/delete lifecycle, storage service R2 read/write support for private media objects, File Registry upload-completion hardening for server-side media writes, sanitized activity-media responses, and PHOTO_USAGE consent-aware parent media blocking. | Activity dashboard route plus backend-backed post detail route for private media, tags, reactions, draft edits, moderation decisions, audited removal, consent-hidden media states, and parent activity feed foundation. | Real compression/variant generation depth and staging object-storage verification. | Broader teacher media gallery polish and browser E2E verification. |
| M6 Homework & Timetable | Homework lifecycle/submissions/review/reminders/reports/attachment access via File Registry; timetable periods, rooms, versions, slots, validation with teacher absence context, substitution summary API, and Sunday/normalized-date absence-substitution edge-case coverage; parent/student homework assignment and submission reads fail closed for unlinked students. | Homework list/new/detail/review/attachments; timetable builder with conflict visualization, teacher dashboard widgets (Today's Classes, Homework Reviews), substitutions dashboard. | No local backend gaps identified after complex absence/substitution calendar coverage; continue staging data QA as real schedules stabilize. | Browser E2E verification in staging environment. |
| M7 HR & Payroll | Staff, documents, lifecycle, contracts, HR attendance, leave balances/requests/accrual idempotency, payroll runs/lines with posting locks, salary structures, payslips, payroll-to-accounting integration, reversal workflows, PII masking, run-scoped register/PF/TDS/component reports. | HR staff/detail/attendance/contracts/leave with backend lifecycle Audit tab; payroll dashboard with status steppers, posting actions, reversal workflows, PDF slips; Flutter staff self-service profile, attendance, leave, payslip list, and payslip PDF download/share screens backed by real APIs. | Extended trend analytics and policy-specific statutory exports after rules are finalized. | Browser/mobile smoke execution in staging environment. |
| M8A Library | Books, copies, issue/return, overdue, fines, settings, borrowed students, staff borrower support tests, tenant-scope regressions for issue/return/history, QR borrower lookup, reports, CSV export, bounded book/copy history, deterministic overdue reminder source IDs, explicit fine-to-M3 posting with M9 boundary tests. | Library dashboard, books, copies, issues, overdue, fines, reports, scanner-first admin issue flow with copy barcode/QR lookup and QR borrower context, Phase 4 smoke coverage. | Receipt/payment linkage polish after M3 collection rules finalize and staging reminder-queue verification. | Report export polish beyond current admin CSV/report routes and seeded staging browser coverage. |
| M8B Transport | Routes/stops, vehicles, driver/student assignments, trip lifecycle, student boarding statuses, Redis latest location, throttled persistence, GPS pressure guard, retention cleanup bounds, parent active-trip endpoint, delays/logs/reports/CSV. | Transport dashboard, routes, vehicles, assignments, trips, latest location, Phase 4 smoke coverage. | ETA/geofence/deviation later; billing/accounting remains guarded until pricing rules are approved. | Admin live map only after product-approved real-time readiness; driver app and parent tracking later. |
| M8C Canteen | Menu, meal plans, enrollments, serving, wallets, POS, POS receipt JSON/PDF reprint endpoints, meal-plan enrollment to linked M3 invoice boundary, spending controls, QR resolve, suppliers, inventory, purchase bills, stock movement, wastage, reports/CSV, wallet/POS idempotency, negative-balance reversal/correction guards, purchase-bill accounting/stock-movement tests, wastage/manual-adjustment negative-stock tests, and stock hardening. | Canteen dashboard, menu, plans, enrollments with linked-invoice indicator, serving/POS QR scan result cards, wallets, POS receipt preview/PDF actions, controls, supplier and inventory item list/create UI, purchase-bill/wastage/manual-adjustment operation forms, stock ledger visibility, reports, Phase 4 smoke coverage. | Meal-plan cancellation/void collection rules, low-balance queue staging verification, and additional vendor/stock edge-case coverage as staging data reveals gaps. | Parent wallet/menu/spending views later plus report/export and linked-invoice action polish. |
| M9 Accounting & Finance | Chart of accounts, journals, fiscal years/periods, production-reviewed default accounts/report mappings, posting service, reversals/corrections, fiscal close/reopen, opening balances, reports, bank reconciliation, CSV/PDF exports with Trial Balance and Balance Sheet control-total summary cards, File Registry report snapshots, deterministic bank auto-match suggestions, audit trail, bank reconciliation PDF, raster logo embedding. | Accounting dashboard, accounts, journals, reports, reconciliation, management, audit trail viewer with summary/detail context, report PDF export and snapshot panel, reconciliation suggestion surface, seeded smoke coverage. | Optional background workers for large exports after product thresholds are defined. | Large-report UX polish and staging/browser verification. |
| M10 Notices / Communication / Messaging | Notices, events, consent templates/preferences, deliveries/retries/read tracking, notification center, unread recipients, attachment signed access, retention-policy review, communication-scoped audit trail, parent-teacher chat availability/escalation/abuse foundations, guardian ownership regressions for chat/message access, and mobile notification delivery read endpoint. | Notices/detail with unread-recipient follow-up controls, notification surfaces, messages/messaging routes with moderation decision panel; Flutter notification center reads and marks mobile notifications through real APIs. | Real SMS/FCM/email providers and signed callbacks after provider contracts are approved. | Parent/mobile chat UI later. |
| M11 Intelligence / AI | Roadmap only. | None. | Do not implement until reliable production data and approved M11 foundations exist. | None until Phase 4. |

---

## Updated Completion Estimate

| Module | Estimated Completion | Current Implementation State |
|---|---:|---|
| Auth / RBAC / Tenant Isolation | 93-97% | Strong backend and browser-session foundation with JWT issuer/audience, CSRF, and support-override regressions; production credential review and browser-state coverage remain. |
| M0 Platform Core | 85-90% | Foundation complete with provider readiness and queue failed-job detail; entitlement enforcement depth, SaaS lifecycle automation, staging checks, and browser coverage remain. |
| M1 Admissions & Student Profiles | 92-96% | Pilot-ready plus Student QR foundation with tenant-filtered QR resolution and tenant-scope regressions; storage, iEMIS, duplicate merge, QR release/browser QA remain. |
| M2 Smart Attendance | 90-94% | Pilot-ready attendance and reports with mobile teacher scope, correction/guardian denial, and rejected offline-sync replay regressions; offline UX and staging report verification remain. |
| M3 Fees & Receipts | 90-94% | Pilot-ready collection/receipts/cashier close with interactive dues breakdown and transaction-race regression coverage; gateway, live DB concurrency, and export/PDF staging remain. |
| M4 Academics / Exams / CAS / Report Cards | 98-100% | Backend/admin UI plus Phase 2 PDF/report/correction dialog/snapshot polish implemented; staging QA and optional report variants remain. |
| M5 Activity Feed & Milestones | 85-92% | Strong foundation with consent-aware media privacy and File Registry upload-completion hardening; real compression variants, staging storage verification, and teacher gallery depth remain. |
| M6 Homework & Timetable | 98-100% | Backend/Admin UI complete with File Registry integration, reminder hardening, absence conflict detection, Sunday timetable-day mapping, and normalized same-day substitution collision coverage; E2E verification remains. |
| M7 HR & Payroll | 95-100% | Backend/Admin UI complete with posting locks, accounting integration, reversal workflows, and PII masking; E2E verification remains. |
| M8A Library | 88-94% | Admin/backend foundation plus controlled fine-to-fees posting, accounting-boundary tests, tenant-scope regressions, reports/fines/history/QR lookup, and scanner-first issue ergonomics; overdue queue operations, report export polish, and staging QA remain. |
| M8B Transport | 75-85% | Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening; live map, driver app, parent tracking, and pricing-approved billing remain. |
| M8C Canteen | 90-95% | Admin/wallet/POS/receipt JSON/PDF/inventory/vendor/report foundation plus supplier/item and purchase-bill/wastage/manual-adjustment UI, idempotency, negative-balance guards, purchase/wastage/manual-adjustment stock tests, meal-plan M3 invoice linkage, QR serving/POS scan result polish, and stock hardening; cancellation/void dues rules, parent views, QR/manual QA, and staging smoke remain. |
| M9 Accounting & Finance | 98-100% | Production-candidate for current scope with styled Trial Balance/Balance Sheet PDF control totals, snapshots, and advanced reconciliation suggestions implemented; large-report UX and staging QA remain. |
| M10 Notices / Communication / Chat | 92-96% | Strong school communication and chat foundation with guardian ownership regressions, admin moderation/escalation decision UI, and unread-recipient follow-up controls; provider adapters and parent/mobile chat UI remain. |
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

Blocked work: AI, Angular migration, microservices, deep parent/mobile expansion beyond the started Flutter companion app, driver live-trip workflow, broad new modules.

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
- [x] Implemented: Homework File Registry uploads, reminder queue hardening, timetable absence integration, absence conflict validations, Sunday/normalized-date substitution edge-case coverage, payroll approval/posting locks, leave accrual idempotency, sensitive staff field masking, payroll reversal workflows.

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

### Phase 5 - Mobile Companion, Parent, Driver, and Live Experiences

Started as a thin Flutter companion app track while the main product remains stabilization-first.

Scope:

```text
apps/schoolos_mobile auth/API foundation, parent chat UI, parent academic/fee/attendance views, driver trip workflow, parent transport tracking, push notifications.
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
