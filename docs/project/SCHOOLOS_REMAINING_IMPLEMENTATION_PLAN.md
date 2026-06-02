# SchoolOS Remaining Implementation Plan

**Last updated:** 2026-06-02

**Status source:** `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md` and `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`

**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the strict implementation order for SchoolOS from the current repo state. It records what is already implemented, what remains in backend and frontend, and the phase gates future work must follow.

---

## 1. Current Product Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue pilot hardening implemented; broader pilot hardening remains
M4 Academics: Completed / Pilot-Ready
M6 Homework/Timetable: Completed / Pilot-Ready
M7 HR/Payroll: Completed / Pilot-Ready
M8A Library: Admin/backend foundation plus fine/accounting/staff-borrower depth implemented
M8B Transport: Admin/trip/location foundation plus GPS pressure/cache/retention depth implemented
M8C Canteen: Admin/wallet/POS/inventory foundation plus receipt/wallet-guard depth implemented
M9 Accounting: Completed / Pilot-Ready
M10 Communication/Chat: Foundation plus provider/attachment/retry depth implemented
SchoolOS Flutter mobile app: Started in apps/schoolos_mobile with auth/API connection, parent and teacher attendance, notification center read state, and staff self-service API/PDF wiring in progress
M11 Intelligence/AI: Not started
```

Current practical readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks, `verify:production`, and smoke verification in a local/staging environment that can bind browser-test ports
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Important working-tree note:

```text
Phase Gate 0 verification was green before M0 and feature-depth work started.
M0 provider/queue/API-key pilot hardening and M10/M6/M7/M8A/M8C/M8B feature-depth hardening have now been implemented and verified through build during their sprint gates.
M0/File Registry storage hardening now includes a provider-neutral `StorageAdapter` contract, normalized local/s3/r2/minio/gcp config, backward-compatible R2 aliases, private-by-default object writes, short-lived signed URL helpers, and StorageService delegation through local and S3-compatible adapters. M0 platform storage readiness has started using the normalized config; staging bucket verification remains environment-gated.
`pnpm verify:production` must be rerun in local/staging if the current sandbox blocks browser E2E local-port binding.
`pnpm smoke:phase1` still requires local Postgres, Redis, API, and web services.
```

Near-term rule:

```text
Do not start broad new modules.
Follow the phase gates below.
Stabilize and harden existing modules one vertical at a time.
```

Explicitly deferred until the plan allows it:

```text
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket/SSE UI
AI/ML features
Angular migration
Microservices
Biometric workflows
```

---

## 2. Module Completion Snapshot

| Module | Current Status | Estimated Completion |
|---|---|---:|
| Auth / Security / Tenant Isolation | Strong foundation | 90-95% |
| M0 Platform Core | Foundation complete with provider/queue pilot hardening; broader pilot hardening remains | 85-90% |
| M1 Admissions & Student Profiles | Pilot-ready plus Student QR foundation | 90-95% |
| M2 Smart Attendance | Pilot-ready | 85-90% |
| M3 Fees & Receipts | Pilot-ready plus focused finance hardening slice | 90-95% |
| M4 Academics / Exams / CAS / Report Cards | Completed / Pilot-Ready | 100% |
| M5 Activity Feed & Milestones | Strong Phase 1 foundation plus media privacy hardening | 80-90% |
| M6 Homework & Timetable | Completed / Pilot-Ready | 100% |
| M7 HR & Payroll | Completed / Pilot-Ready | 100% |
| M8A Library Management | Admin/backend foundation plus controlled fine-to-fees posting, accounting-boundary tests, staff borrowers, and QR lookup implemented | 80-90% |
| M8B Transport Management | Admin/trip/location foundation plus billing guard, GPS pressure guard, Redis cache/fanout tests, and cleanup bounds implemented | 75-85% |
| M8C Canteen Management | Admin/wallet/POS/receipt/inventory foundation plus idempotency, negative-balance guards, supplier, stock operation UI/tests, and accounting-source hardening implemented | 87-93% |
| M9 Accounting & Finance | Completed / Pilot-Ready | 100% |
| M10 Notices & Communication | Strong Phase 1 + chat foundation with provider modes, attachment access, and failure-dashboard API depth | 90-95% |
| M11 School Intelligence / AI | Roadmap only | 0% |

---

## 3. Implemented vs Remaining by Module

### Auth / Security / Tenant Isolation

Implemented:

- Cookie-first browser auth with bearer support for the active Flutter mobile app and future API clients.
- RBAC and tenant context foundations.
- Platform vs tenant route separation.
- Super-admin tenant override audit behavior.
- App-level throttling and production verification scripts.
- Request/correlation ID propagation through response headers, response envelopes, structured request logs, and audit records.
- Production secret, cookie, and same-site runtime validation.
- Dashboard direct-route permission-denied gating before protected module pages load.
- Dashboard slow-session recovery with retry/sign-in actions when cookie validation or permission loading stalls.

Remaining backend:

- More denial, override, tenant-isolation, and session/security regression tests.
- Final production credential review during deployment.

Remaining frontend:

- Browser coverage for permission-denied states across all dashboard/platform routes.
- Deeper expired-session and slow-network recovery browser coverage.

### M0 - Platform Core / SaaS Starter

Implemented:

- Platform tenant list/detail/dashboard/status flows.
- Reason-required tenant suspend/activate behavior.
- Plans, features, tenant subscriptions, feature overrides, usage limits/counters.
- SaaS billing records: profiles, invoices, invoice lines, payments.
- Tenant-scoped platform API key management with generated one-time secrets, SHA-256 hashed storage, masked list responses, revoke flow, and audit records.
- Platform API key management UI with one-time secret reveal and audited revoke actions on tenant detail.
- SaaS billing lifecycle automation now generates due renewal invoices, advances free-plan renewals without school finance postings, and records lifecycle audit entries.
- Webhook endpoint registry and signed delivery-history surfaces are implemented for platform operators.
- Provider configuration masking.
- Provider readiness detail API with dry-run validation, masked secrets, disabled-mode warnings, and S3-compatible object-storage readiness checks without paid external calls by default.
- Env-backed cloud-agnostic storage adapter boundary for local, R2, S3, and MinIO-compatible providers, with fail-closed config checks and R2 alias compatibility.
- Queue health, failed-job detail inspection, sanitized payload visibility, stack/timing detail, retry audit history, and audited retry endpoint.
- File Registry, report exports/history, health summary, onboarding checklist.
- Entitlement regression coverage now denies real school module controllers for accounting, mobile parent, library, transport, canteen, and homework when a tenant plan lacks the required feature, even if RBAC permissions are present.
- Platform dashboard/schools/settings/audit routes.

Remaining backend:

- Object-storage readiness verification against an explicit staging provider.
- File Registry signed read/download/upload API hardening is implemented; staging provider verification remains.
- M1-M10 module-by-module migration audit to remove any remaining direct file/provider assumptions.
- Provider real connection checks only where safe, configured, and non-paid.

Remaining frontend:

- Platform tenant-action manual QA.
- Broader browser coverage for queue/provider failure detail surfaces.
- Browser coverage for suspend/activate, overrides, billing, API keys, webhooks, providers, and queue retry.

### M1 - Admissions & Student Profiles

Implemented:

- Admissions, student profiles, guardians, lifecycle, documents, student search.
- Student photo/document access boundaries.
- Student photo uploads now enforce MIME, extension, size, safe filename, image signature, tenant-scoped storage keys, File Registry metadata, short-lived preview/download URLs, replace/remove audit actions, and profile edit UI controls.
- School logo uploads now use the same private object storage + File Registry pattern with tenant-scoped preview/download URLs, validation, update/remove audit logs, and PDF-safe file asset IDs in `school_logo`.
- Student document audit trail API and profile visibility, with sanitized document list responses that avoid raw storage keys and read-history entries for preview/download access.
- Student identity models.
- Student QR credential model, secure token hashing, generate/rotate/revoke/resolve API, transactional rotation that preserves old credentials as ROTATED history, safe status/history API, QR admin card, and Library/Canteen QR resolver foundations.
- iEMIS export now persists a tenant-scoped CSV artifact through File Registry/report export history and exposes a directory export action.
- Duplicate review now has an admin-only candidate list endpoint and directory UI based on name, guardian phone, DOB, admission number, and previous-school signals.

Remaining backend:

- iEMIS final export mapping still needs staging validation against a real Nepal iEMIS template; unsupported schema fields must stay blank/documented until modeled.
- Duplicate merge execution remains implemented but still needs broader linked-module staging verification before enabling aggressive admin workflows.
- Staging verification for storage-backed student photo/document/logo flows.
- QR scan release verification, browser coverage, and more tenant/permission tests.
- ID-card QR PDF behavior has backend integration coverage for opaque QR payload support; visual/manual PDF QR rendering still needs staging verification with real generated cards.

Remaining frontend:

- QR manual QA in student, library, and canteen flows.
- Student photo/logo upload UX polish beyond the current profile-edit and settings API foundations.
- [x] Student document audit trail visibility.
- [x] Student directory duplicate candidate review visibility for lifecycle admins.
- Parent-safe student profile views later.

### M2 - Smart Attendance

Implemented:

- Attendance sessions and records.
- Correction requests, sync submissions/conflicts, drafts.
- Monthly/history analytics and exports.
- Teacher-scope and correction/sync tests.
- Attendance daily and register routes.
- M2 hardening slice: correction requests now persist previous status and reason-required review metadata, correction lists are paginated, teacher lock-window failures use the school-friendly correction message, parent/student attendance access checks correctly honor guardian-owned children, attendance register exports register generated artifacts through File Registry when available, and the web attendance form has tenant/user/class/date-scoped local draft recovery plus sync/conflict states.
- Parent mobile attendance now uses the purpose-limited `/mobile/students/:id/attendance-summary` API with month-history data instead of admin-shaped attendance endpoints or hard-coded child fallbacks.
- Teacher mobile attendance now uses purpose-limited `/mobile/teacher/attendance/classes`, `/mobile/teacher/attendance/roster`, and `/mobile/teacher/attendance/submit` APIs backed by existing teacher-scope attendance validation.

Remaining backend:

- Broader attendance report/export staging verification against real object storage.
- More service-level permission tests for correction approval/rejection, guardian denial, and tenant isolation.
- More mobile teacher attendance permission/tenant-isolation tests beyond the focused controller and repository contract coverage.

Remaining frontend:

- Correction request/admin review workspace polish.
- Browser/manual QA for offline reload recovery and reconnect conflict choices.
- Mobile teacher attendance device smoke with seeded teacher assignments.

### M3 - Fees & Receipts

Implemented:

- Fee heads/plans, student assignments, invoices, invoice lines.
- Payments, receipts, refunds/reversals, cashier close.
- Student fee ledger, dues/report foundations, M9 consistency coverage.
- Fees/finance collection and ledger UI foundations.
- M3 hardening slice: receipt reprints now record payment/student/File Registry metadata and list latest reprint history, reversal paths require service-level permission and reason, already-reversed and closed-cashier-day reversals are blocked with school-friendly messages, cashier close uses a deterministic duplicate-protection key, reconciliation summaries include payment-method rollups and registered CSV artifacts, and gateway readiness exposes disabled/configured status without fake payment collection.

Remaining backend:

- Real online payment provider initiation/webhook implementation after provider config and settlement contracts are approved.
- Broader receipt/report export PDF polish and staging File Registry verification.
- More concurrent cashier-close race tests against a real database.
- Full day-end close PDF report polish.

Remaining frontend:

- More detailed fee-head/period dues table interactions in the main counter screen.
- Gateway payment collection UX after backend provider integration is approved.
- Finance reports/export polish beyond current receipt history, gateway-readiness notice, and reconciliation export foundations.

### M4 - Academics, Exams, CAS, Report Cards

Implemented:

- Exam terms, assessment components, marks entry, CAS records.
- Nepal grading/GPA result preview.
- Marks lock/unlock workflow.
- Report card generation/history/correction models.
- Polished report-card PDF downloads, File Registry snapshots, academic CSV/PDF reports, and explicit locked correction/regeneration flow.
- Promotion readiness and result publishing.
- Academics dashboard and full admin routes for setup, marks, CAS, locks, results, report cards, promotion, publishing.
- Report-card download/history/correction UI polish and Playwright smoke coverage updates.
- Keyboard-friendly marks and CAS entry.

Remaining backend:

- [x] Optional CAS summary, failed-threshold, and promotion-readiness export variants where product rules require them.
- [x] Raster logo embedding in the simple PDF engine.
- [ ] Staging object-storage verification for generated report files.
- [ ] Final index review after real usage patterns stabilize.

Remaining frontend:

- [x] Browser/manual smoke execution in an environment with seeded credentials and local ports.
- [ ] Dialog-level correction UX polish beyond the current guarded action.
- [x] Academic reporting UI depth beyond the smoke-tested report-card workflow.

### M5 - Activity Feed & Milestones

Implemented:

- Activity posts, targeting, attachments/media access, reactions.
- Post lifecycle foundations with backend-backed web edit, moderation, archive, and audited removal controls.
- Developmental milestones and mood log foundations.
- Backend-backed activity post detail route in the web dashboard.
- Media privacy tests.
- Activity media responses now avoid raw storage keys, public URLs, and File Registry IDs; feed/detail/gallery previews route through controlled backend preview endpoints.
- Parent media previews now fail closed when PHOTO_USAGE consent is missing and show a school-friendly hidden-media state in the web UI.
- Parent activity feed route added for approved child-scoped activity posts.
- Activity dashboard route.

Remaining backend:

- Direct-upload API/UX hardening beyond backend storage-service R2 read/write support.
- Real image compression/variant generation depth for low-bandwidth Nepal usage beyond the current queue pattern.
- Staging object-storage verification for private activity media preview/download.

Remaining frontend:

- [x] Activity detail page for private media, student tags, and reactions.
- [x] Moderation and lifecycle UI for draft edit, approve/reject/archive, and audited removal.
- [x] Parent-facing activity view foundation.
- Teacher media gallery.

### M6 - Homework & Timetable

Implemented:

- Homework assignment lifecycle, submissions, review, correction requests, reminders, reports, attachment access.
- Timetable periods, rooms, versions, slots, compare/restore, validation, publish/lock/archive/reopen.
- Teacher availability, workload limits, subject weekly requirements, substitutions.
- Parent/student homework assignment and submission list/detail reads fail closed to authorized linked students.
- Homework and timetable dashboard routes, builder, versions, substitutions, review pages.

Remaining backend:

- [x] Homework upload through File Registry.
- [x] Homework reminder queue hardening.
- [x] Leave/absent teacher integration into conflict validation.
- [x] Deeper timetable conflict/service tests for absence edge cases.

Remaining frontend:

- [x] Timetable builder conflict visualization.
- [x] Teacher dashboard widgets (Today's Classes, Homework Reviews).
- [x] Homework attachment UX (detail page, review modal).
- [ ] Student/parent homework and timetable views later.

### M7 - HR & Payroll

Implemented:

- Staff profiles, documents, lifecycle, contracts.
- HR attendance, leave balances/requests/accrual foundation.
- Salary structures, payroll runs/lines, payslips.
- Payroll-to-accounting posting and reversal foundations.
- HR and payroll dashboard routes.
- HR staff detail lifecycle Audit tab backed by `/hr/staff/:staffId/history`.
- Flutter staff self-service profile, attendance, leave, payslip list, and payslip PDF download/share screens use real staff/attendance/payroll APIs.

Remaining backend:

- [x] Payroll approval/posting lock depth and Accounting integration.
- [x] Leave accrual idempotency locking.
- [x] Sensitive staff field masking and permission-based visibility.
- [x] Payroll register/report export hardening and PDF slips, including backend-filtered register/PF/TDS/component/leave summaries and dedicated PF/TDS CSV export actions.
- [x] More HR/payroll permission tests (locks and mask checks).

Remaining frontend:

- [x] HR/payroll dashboard polish and reversal workflows.
- [x] Staff self-service PDF payslip access.
- [x] Payslip PDF and reversal action UI.
- [x] Payroll reports UI uses real backend totals and no hard-coded payroll/ledger status figures.
- [x] Staff lifecycle audit log visibility in HR staff detail.
- [ ] Browser/mobile smoke execution in staging environment.

### M8A - Library Management

Implemented:

- Books, copies, issue/return, overdue, fines, settings.
- Borrowed-students endpoint.
- QR borrower lookup using shared Student QR service.
- Issued/overdue/lost-damaged/fine/borrower-history/popular reports and CSV export.
- Book/copy history.
- Overdue reminder hardening now uses deterministic daily source IDs through the base delivery path, so manual and cron retries dedupe against the same delivery window.
- Library dashboard, books, copies, issues, overdue, fines, reports routes.

Remaining backend:

- Receipt/payment linkage polish for library fines after M3 collection rules are finalized.
- Overdue reminder queue operational depth in staging.
- More tenant/permission tests beyond fine posting, staff borrowers, QR, and report coverage.

Remaining frontend:

- Barcode/QR scanner polish beyond current admin scan surface.
- Report/export UI polish beyond current CSV/report routes.
- Browser smoke execution in seeded staging.

### M8B - Transport Management

Implemented:

- Routes, stops, vehicles.
- Driver and student assignments.
- Trip lifecycle, boarded/dropped/absent statuses.
- Latest trip location, location cleanup, logs, delays.
- GPS ingestion validation, Redis latest-location cache, throttled PostgreSQL persistence, tenant/trip-scoped fanout, and retention cleanup.
- Redis GPS pressure guard and cleanup retention bounds.
- Parent active-trip endpoint.
- Trip/boarding reports and CSV export.
- Transport dashboard, routes, vehicles, assignments, trips, location routes.

Remaining backend:

- ETA/geofence/overspeed/deviation later.
- Transport billing/accounting integration remains deferred behind explicit pricing-rule approval.
- Production live map remains blocked until the admin real-time design in `docs/project/SCHOOLOS_TRANSPORT_REALTIME_READINESS.md` is accepted.

Remaining frontend:

- Live map UI after real-time backend is product-approved for admin consumption.
- Driver app.
- Parent child-specific tracking UI.
- Route dashboard and trip-history report polish.

### M8C - Canteen Management

Implemented:

- Menu items, meal plans, enrollments, serving.
- Wallets, top-ups, transaction history, reversals/corrections.
- POS sales, spending controls, low-balance reports.
- POS receipt JSON and protected PDF reprint endpoints, plus wallet reversal/correction guards that prevent negative balances.
- Meal-plan enrollments create linked M3 invoices through `FinanceService`, post through the approved M9 `AccountingPostingService` boundary, and block overlapping duplicate active assignments.
- QR resolve for canteen serving.
- Suppliers, inventory items, purchase bills, stock movement, wastage, stock ledger.
- Purchase bills have accounting-boundary and stock-movement tests; wastage and manual stock adjustments have negative-stock guard tests.
- Daily meal count, item-wise sales, low-balance, student spending, stock ledger reports and CSV exports.
- Canteen dashboard, menu, plans, enrollments, serving, wallets, POS, controls, reports routes.
- Admin supplier and inventory item list/create surfaces now use real canteen APIs, support purchase-bill/wastage/manual stock-adjustment operation posting, and show backend stock ledger visibility.

Remaining backend:

- Meal-plan cancellation/void collection rules after product decides how canteen enrollments should affect already-issued M3 dues.
- Low-balance notification queue staging verification.
- Additional inventory/vendor edge-case tests as staging data reveals supplier, batch, expiry, and adjustment-rule gaps.

Remaining frontend:

- QR/student ID scan speed polish beyond current admin POS/serving surfaces.
- Parent wallet/menu/spending views later.
- Canteen report/export polish and deeper linked-invoice actions beyond the current enrollment invoice indicator and POS receipt preview/PDF actions.
- Browser smoke execution in seeded staging.

### M9 - Accounting & Finance

Implemented:

- Chart of accounts, journals, fiscal years/periods.
- Double-entry enforcement, Decimal-safe posting, immutable posted journals.
- Source-based idempotent posting, reversal/correction workflows.
- Fiscal close/reopen, opening balances, vouchers.
- Trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS/PF summaries, CSV/PDF exports.
- File Registry report snapshots, bank reconciliation, deterministic auto-match suggestions, and accounting report mapping.
- Accounting dashboard, accounts, journals, reports, reconciliation, management routes with PDF/snapshot/suggestion surfaces.

Remaining backend:

- [x] Dedicated bank-reconciliation PDF export.
- [x] Accounting audit log viewer API/UI support.
- [x] Production seed review for default Chart of Accounts and report mappings.
- [ ] Optional background workers for large tenant report exports.

Remaining frontend:

- [x] Audit log viewer UI depth.
- [x] Browser smoke execution in an environment with seeded credentials and local ports.

### M10 - Notices, Communication, Messaging

Implemented:

- Notices, events, consent templates, guardian consent, communication preferences.
- Delivery records, retry/read tracking, unread recipients, notification center.
- Explicit notification provider modes: dev-log, disabled, configured-provider.
- Delivery failure dashboard API and retry metadata.
- File Registry notice/chat attachment upload and signed/protected access with guardian ownership tests.
- Parent-teacher thread/message foundation, chat availability, escalation, abuse report foundations.
- Communication retention-policy review API and communication-scoped audit trail API.
- Notices/detail/messages/messaging routes.
- Flutter notification center reads from `/mobile/me/notifications`, maps backend source families to mobile categories, and marks delivery read state through the mobile notification read endpoint.

Remaining backend:

- Production SMS/FCM/email adapters and signed provider callbacks where provider contracts are approved.
- More guardian ownership tests across all chat/message routes.

Remaining frontend:

- Parent/mobile chat UI later.
- Moderation/escalation UI depth.
- Unread recipient list polish.
- Mobile notification browser/device smoke in staging.

### M11 - School Intelligence and AI

Implemented:

- Roadmap only.

Remaining:

- Do not implement until reliable production data exists and Phase 6 is opened.

---

## 4. Strict Phase-Wise Implementation Plan

The following phase order must be followed strictly. A later phase may only start after the earlier phase exit criteria are met or the project owner explicitly changes priority.

### Phase Gate 0 - Stabilize Main Before New Scope

Purpose: make the current broad repo trustworthy before adding more product surface.

Backend tasks:

1. Run and fix the full verification gate.
2. Apply or intentionally park pending migrations with a written reason.
3. Confirm seed data supports all dashboard modules.
4. Verify OpenAPI generation.
5. Check tenant isolation for high-risk modules.
6. Verify File Registry, storage, Redis, BullMQ, and report-export basics.

Frontend tasks:

1. Run credential-gated Playwright smoke where local ports and credentials are available.
2. Verify dashboard, platform, students, attendance, finance, academics, accounting, HR/payroll, library, transport, and canteen routes load without fatal errors.
3. Fix stale route links and permission-denied states found by smoke.

Exit criteria:

```text
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1 with API/web/Postgres/Redis running
```

Current storage rollout verification note:

```text
Storage Sprint 1 passed through pnpm test. The next gate is blocked at pnpm test:e2e by existing non-storage e2e issues: SaaS invoice Decimal string formatting, finance/M9 suspended-tenant setup, and missing student lifecycle tenant fixture. Do not claim build or verify:production for this storage rollout until e2e is repaired or explicitly waived.
```

### Phase 1 - Controlled Pilot Reliability

Purpose: make existing Phase 1 and M0 operations reliable for a real school pilot.

Backend tasks:

1. Harden Auth/RBAC/session/security.
2. Harden M0 platform tenant actions, entitlement enforcement, provider/queue visibility, and File Registry.
3. Harden M1-M3 daily workflows: admissions, students, attendance, fees, receipts.
4. Harden M5/M10 media, notices, consent, notification delivery and failure visibility.
5. Add request/correlation IDs and operational logging where missing.

Frontend tasks:

1. Polish permission-denied, slow-network, and empty/error states.
2. Smoke dashboard/students/attendance/finance/notices/settings/platform.
3. Manually test Student QR generation/rotation/revocation/resolve across student profile, library, and canteen.

Exit criteria:

```text
One controlled school can run admissions, attendance, fees, notices, activity feed, settings, and platform support without direct engineering intervention.
```

### Phase 2 - Academics and Accounting Production Polish

Purpose: complete the two highest-value production modules already closest to completion.

Backend tasks:

1. Done: polished report-card PDFs.
2. Done: implemented locked report-card correction/regeneration with history.
3. Done: added backend-driven academic reports/exports.
4. Done: added accounting PDF exports for core reports and tax summaries.
5. Done: added saved accounting/academic report snapshots through File Registry.
6. Done: added deterministic bank reconciliation auto-match suggestions.

Frontend tasks:

1. Done: updated end-to-end Academics browser smoke.
2. Done: polished report-card download/history/correction surfaces.
3. Done: polished Accounting report PDF/snapshot and reconciliation suggestion surfaces.
4. Done: added/updated seeded Playwright coverage for accounting workflows.

Exit criteria:

```text
Completed. Academics and Accounting are production-grade admin modules for the current Nepal school scope.
```

### Phase 3 - Homework, Timetable, HR, and Payroll Depth

Purpose: finish operational depth for Phase 2 foundations.

Backend tasks:

1. [x] Done: Route homework attachments through File Registry.
2. [x] Done: Harden homework reminder queues.
3. [x] Done: Integrate timetable substitutions with leave/absent teacher workflows.
4. [x] Done: Deepen timetable conflict validation and tests.
5. [x] Done: Harden leave accrual and payroll approval/posting locks.
6. [x] Done: Harden payroll reports/exports and payslip generation.
7. [x] Done: Review sensitive staff field masking/encryption.

Frontend tasks:

1. [x] Done: Polish timetable builder and conflict visualization.
2. [x] Done: Add teacher dashboard widgets for timetable and homework.
3. [x] Done: Finish homework attachment UX.
4. [ ] Remaining: Add HR/payroll browser smoke in staging.
5. [x] Done: Finalize staff self-service and payslip views.

Exit criteria:

```text
Academic coordinators, teachers, HR admins, and accountants can operate M6/M7 without admin workarounds.
```

### Phase 4 - Library, Transport, and Canteen Production Depth

Purpose: turn Phase 3 admin foundations into reliable operations products.

Backend tasks:

1. Library fines now post explicitly to M3 fee invoices and M9 via approved posting boundaries; payment collection remains owned by M3.
2. Canteen wallet top-ups/POS sales use immutable source records, idempotency keys, and M9 posting boundaries; meal-plan dues remain deferred until M3 product rules are approved.
3. Transport billing/accounting is explicitly guarded because route pricing rules are not approved.
4. QR scan audit depth and purpose-limited responses are hardened for Library/Canteen usage.
5. Inventory/vendor, stock, wastage, and canteen wallet immutability are hardened for current admin scope.
6. GPS ingestion, latest-location cache, retention cleanup, and tenant/trip-scoped fanout design are backend-first; no unrestricted map UI is introduced.
7. Vertical-specific permission, tenant, and report tests were added or extended for the hardened surfaces.

Frontend tasks:

1. Library barcode/QR scan and report export surfaces remain admin-only and are covered by Phase 4 smoke.
2. Canteen QR/POS and inventory/menu routes remain admin-only and are covered by Phase 4 smoke.
3. Transport live map remains gated; location route exposes only safe latest/status surfaces for admin operations.
4. Library, Transport, and Canteen Playwright smoke coverage is credential-gated and skips cleanly without seeded credentials.

Exit criteria:

```text
Library, Transport, and Canteen are reliable admin operations modules and are clearly separated from future parent/driver/mobile experiences.
```

### Phase 5 - Mobile Companion, Parent, Driver, and Live Experiences

Purpose: expose safe role-specific experiences from the started Flutter companion app without leaking admin-shaped data.

Current status:

```text
Started: apps/schoolos_mobile exists in the monorepo and the auth/API foundation is being connected to the existing NestJS API.
```

Backend tasks:

1. Keep mobile auth on existing `/auth/login`, `/auth/me`, `/auth/refresh`, and `/auth/logout` APIs with bearer tokens and secure refresh-token storage.
2. Build parent-safe APIs for attendance, fees, activity, notices, report cards, homework, timetable, canteen, library, and transport.
3. Build driver-safe APIs for assigned route/trip workflows only.
4. Add push notification support.
5. Add child/route ownership tests for every endpoint.

Frontend tasks:

1. Parent dashboard and child switcher.
2. Parent views for attendance, fees, notices, report cards, homework, timetable, canteen, library, and transport.
3. Parent-class teacher chat UI.
4. Driver app/PWA trip workflow.
5. Flutter role-specific navigation in `apps/schoolos_mobile`.

Exit criteria:

```text
Parent and driver users can use their own limited products without seeing admin-shaped data.
```

### Phase 6 - M11 Intelligence, Analytics, Enterprise Scale

Purpose: add intelligence only after the operational data is reliable.

Backend tasks:

1. Define approved M11 read models.
2. Build analytics snapshots and explainable rule-based insights.
3. Add human-review workflows before recommendations become official actions.
4. Add anonymized, opt-in cross-school aggregate support only with platform audit.
5. Only then consider ML/LLM features.

Frontend tasks:

1. Admin analytics dashboards.
2. Human-review queues.
3. Explainability and audit surfaces.

Exit criteria:

```text
M11 insights are explainable, audited, tenant-scoped, and cannot automatically punish students, staff, parents, or schools.
```

---

## 5. Non-Negotiable Implementation Rules

1. Keep the NestJS modular monolith.
2. Keep `tenantId` as the tenant/school boundary.
3. Keep platform, tenant settings, and school operations routes separate.
4. Scope every tenant-owned query by authenticated `tenantId`.
5. Add indexes for high-volume tenant-scoped queries before scale pain.
6. Use transactions for multi-step business writes.
7. Queue slow, retryable, provider, PDF, report, media, and notification work.
8. Audit sensitive writes and all financial, platform, QR, student, staff, and communication actions.
9. Enforce entitlements in the backend; frontend gating is display only.
10. Other modules must post accounting effects through `AccountingPostingService` or an approved boundary.
11. Use Prisma Decimal/PostgreSQL numeric for money; never JavaScript floating point.
12. Do not implement AI/ML before Phase 6.
13. Do not migrate to Angular or microservices before explicit approval.
14. Do not implement biometrics before QR identity, consent, retention, encryption, audit, and deletion workflows are mature.

---

## 6. Verification Gate

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

For frontend-heavy changes, also run the targeted Playwright spec or `pnpm test:web:e2e` when local credentials and ports are available.
