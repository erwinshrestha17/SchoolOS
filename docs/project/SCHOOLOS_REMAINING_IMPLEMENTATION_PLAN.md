# SchoolOS Remaining Implementation Plan

**Last updated:** 2026-05-13

**Status source:** `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md` and `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`

**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the strict implementation order for SchoolOS from the current repo state. It records what is already implemented, what remains in backend and frontend, and the phase gates future work must follow.

---

## 1. Current Product Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; pilot hardening remains
M4 Academics: Backend and admin UI implemented
M6 Homework/Timetable: Backend and admin UI foundations implemented
M7 HR/Payroll: Backend and admin UI foundations implemented
M8A Library: Admin/backend foundation implemented
M8B Transport: Admin/trip/location foundation implemented
M8C Canteen: Admin/wallet/POS/inventory foundation implemented
M9 Accounting: Production-candidate complete for current scope
M10 Communication/Chat: Foundation implemented
M11 Intelligence/AI: Not started
```

Current practical readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks and smoke verification
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Important working-tree note:

```text
This documentation pass did not modify runtime code.
Before this pass, the worktree already had modified files:
- apps/api/src/common/pdf/simple-pdf.ts
- pnpm-lock.yaml
Do not treat QR-in-PDF or lockfile behavior as verified by this documentation update.
```

Near-term rule:

```text
Do not start broad new modules.
Follow the phase gates below.
Stabilize and harden existing modules one vertical at a time.
```

Explicitly deferred until the plan allows it:

```text
Parent/mobile portal
Driver app
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
| M0 Platform Core | Foundation complete; pilot hardening remains | 80-90% |
| M1 Admissions & Student Profiles | Pilot-ready plus Student QR foundation | 90-95% |
| M2 Smart Attendance | Pilot-ready | 85-90% |
| M3 Fees & Receipts | Pilot-ready | 85-90% |
| M4 Academics / Exams / CAS / Report Cards | Backend and admin UI implemented | 95-100% |
| M5 Activity Feed & Milestones | Strong Phase 1 foundation | 75-85% |
| M6 Homework & Timetable | Backend/admin UI foundation implemented | 70-80% |
| M7 HR & Payroll | Backend/admin UI foundation implemented | 75-85% |
| M8A Library Management | Admin/backend foundation implemented | 65-75% |
| M8B Transport Management | Admin/trip/location foundation implemented | 60-70% |
| M8C Canteen Management | Admin/wallet/POS/inventory foundation implemented | 65-75% |
| M9 Accounting & Finance | Production-candidate complete | 95-100% |
| M10 Notices & Communication | Strong Phase 1 + chat foundation | 85-90% |
| M11 School Intelligence / AI | Roadmap only | 0% |

---

## 3. Implemented vs Remaining by Module

### Auth / Security / Tenant Isolation

Implemented:

- Cookie-first browser auth with bearer support for future API/mobile clients.
- RBAC and tenant context foundations.
- Platform vs tenant route separation.
- Super-admin tenant override audit behavior.
- App-level throttling and production verification scripts.

Remaining backend:

- Request/correlation ID logging end-to-end.
- More denial, override, tenant-isolation, and session/security regression tests.
- Production cookie/session/secret review.

Remaining frontend:

- Consistent permission-denied states across all dashboard/platform routes.
- Better expired-session and slow-network recovery.

### M0 - Platform Core / SaaS Starter

Implemented:

- Platform tenant list/detail/dashboard/status flows.
- Reason-required tenant suspend/activate behavior.
- Plans, features, tenant subscriptions, feature overrides, usage limits/counters.
- SaaS billing records: profiles, invoices, invoice lines, payments.
- Provider configuration masking.
- Queue health and audited retry endpoint.
- File Registry, report exports/history, health summary, onboarding checklist.
- Platform dashboard/schools/settings/audit routes.

Remaining backend:

- Deeper BullMQ failed-job inspection by deployed queue topology.
- SaaS billing lifecycle automation beyond records.
- Entitlement enforcement tests against real school APIs.
- Object-storage readiness checks against staging provider.
- Provider test connection expansion without leaking secrets or making unsafe paid calls.

Remaining frontend:

- Platform tenant-action manual QA.
- Queue/provider failure detail surfaces.
- Browser coverage for suspend/activate, overrides, billing, providers, and queue retry.

### M1 - Admissions & Student Profiles

Implemented:

- Admissions, student profiles, guardians, lifecycle, documents, student search.
- Student photo/document access boundaries.
- Student identity models.
- Student QR credential model, secure token hashing, generate/rotate/revoke/resolve API, QR admin card, and Library/Canteen QR resolver foundations.

Remaining backend:

- iEMIS final export mapping.
- Duplicate merge workflow polish.
- Storage-backed student photo/document hardening.
- QR scan release verification and more tenant/permission tests.
- ID-card QR PDF behavior verification.

Remaining frontend:

- QR manual QA in student, library, and canteen flows.
- Student photo/logo upload UX polish.
- Student document audit trail visibility.
- Parent-safe student profile views later.

### M2 - Smart Attendance

Implemented:

- Attendance sessions and records.
- Correction requests, sync submissions/conflicts, drafts.
- Monthly/history analytics and exports.
- Teacher-scope and correction/sync tests.
- Attendance daily and register routes.

Remaining backend:

- True offline draft persistence hardening.
- Attendance report/export stabilization.
- Parent attendance summary API later.

Remaining frontend:

- Offline/slow-network attendance UX.
- Correction request polish.
- Parent attendance view later.

### M3 - Fees & Receipts

Implemented:

- Fee heads/plans, student assignments, invoices, invoice lines.
- Payments, receipts, refunds/reversals, cashier close.
- Student fee ledger, dues/report foundations, M9 consistency coverage.
- Fees/finance collection and ledger UI foundations.

Remaining backend:

- Online payment gateway readiness.
- Receipt reprint history depth.
- Payment reversal/correction test depth.
- Cashier-close verification and export/PDF hardening.

Remaining frontend:

- Fee-head/period dues table polish.
- Gateway payment UX when backend is approved.
- Finance reports/export polish.

### M4 - Academics, Exams, CAS, Report Cards

Implemented:

- Exam terms, assessment components, marks entry, CAS records.
- Nepal grading/GPA result preview.
- Marks lock/unlock workflow.
- Report card generation/history/correction models.
- Promotion readiness and result publishing.
- Academics dashboard and full admin routes for setup, marks, CAS, locks, results, report cards, promotion, publishing.
- Keyboard-friendly marks and CAS entry.

Remaining backend:

- Report-card PDF visual polish.
- Locked report-card correction/regeneration workflow.
- Deeper academic reports/exports.
- Final index review after real usage patterns stabilize.

Remaining frontend:

- Full browser/manual smoke of the complete academic flow.
- PDF preview/download polish.
- Academic reporting UI depth.

### M5 - Activity Feed & Milestones

Implemented:

- Activity posts, targeting, attachments/media access, reactions.
- Post lifecycle foundations.
- Developmental milestones and mood log foundations.
- Media privacy tests.
- Activity dashboard route.

Remaining backend:

- Real object-storage/direct upload hardening.
- Image compression queue depth for low-bandwidth Nepal usage.
- Moderation/approval workflow.
- Post edit/delete/soft-delete polish.

Remaining frontend:

- Activity detail page.
- Parent-facing activity view.
- Teacher media gallery and moderation UI.

### M6 - Homework & Timetable

Implemented:

- Homework assignment lifecycle, submissions, review, correction requests, reminders, reports, attachment access.
- Timetable periods, rooms, versions, slots, compare/restore, validation, publish/lock/archive/reopen.
- Teacher availability, workload limits, subject weekly requirements, substitutions.
- Homework and timetable dashboard routes, builder, versions, substitutions, review pages.

Remaining backend:

- Homework upload through File Registry.
- Homework reminder queue hardening.
- Leave/absent teacher integration.
- Deeper timetable conflict/service tests.

Remaining frontend:

- Timetable builder polish.
- Advanced conflict visualization.
- Teacher timetable view.
- Student/parent homework and timetable views later.
- Homework attachment upload UX.

### M7 - HR & Payroll

Implemented:

- Staff profiles, documents, lifecycle, contracts.
- HR attendance, leave balances/requests/accrual foundation.
- Salary structures, payroll runs/lines, payslips.
- Payroll-to-accounting posting and reversal foundations.
- HR and payroll dashboard routes.

Remaining backend:

- Payroll approval/posting lock depth.
- Leave accrual edge cases and audit workflow depth.
- Sensitive staff field encryption/masking review.
- Payroll register/report export hardening.
- More HR/payroll permission tests.

Remaining frontend:

- HR/payroll browser smoke coverage.
- Staff self-service finalization.
- Payslip PDF polish.
- Payroll reports UI polish.

### M8A - Library Management

Implemented:

- Books, copies, issue/return, overdue, fines, settings.
- Borrowed-students endpoint.
- QR borrower lookup using shared Student QR service.
- Issued/overdue/lost-damaged/fine/borrower-history/popular reports and CSV export.
- Book/copy history.
- Library dashboard, books, copies, issues, overdue, fines, reports routes.

Remaining backend:

- Library fine integration with M3 fees.
- Library accounting integration with M9 where product-approved.
- Overdue reminder queue hardening.
- Staff borrower depth.
- More tenant/permission tests.

Remaining frontend:

- Barcode/QR scanner polish.
- Report/export UI polish.
- Library Playwright tests.

### M8B - Transport Management

Implemented:

- Routes, stops, vehicles.
- Driver and student assignments.
- Trip lifecycle, boarded/dropped/absent statuses.
- Latest trip location, location cleanup, logs, delays.
- Parent active-trip endpoint.
- Trip/boarding reports and CSV export.
- Transport dashboard, routes, vehicles, assignments, trips, location routes.

Remaining backend:

- Driver mobile GPS ingestion hardening.
- Redis Pub/Sub or SSE/WebSocket fanout for multi-instance real-time tracking.
- GPS write-pressure protection and retention/partition strategy.
- ETA/geofence/overspeed/deviation later.
- Transport billing/accounting integration later.

Remaining frontend:

- Live map UI after real-time backend is ready.
- Driver app.
- Parent child-specific tracking UI.
- Route dashboard and trip-history report polish.

### M8C - Canteen Management

Implemented:

- Menu items, meal plans, enrollments, serving.
- Wallets, top-ups, transaction history, reversals/corrections.
- POS sales, spending controls, low-balance reports.
- QR resolve for canteen serving.
- Suppliers, inventory items, purchase bills, stock movement, wastage, stock ledger.
- Daily meal count, item-wise sales, low-balance, student spending, stock ledger reports and CSV exports.
- Canteen dashboard, menu, plans, enrollments, serving, wallets, POS, controls, reports routes.

Remaining backend:

- Wallet immutability hardening review.
- POS receipt generation.
- Canteen accounting integration with M9.
- Meal plan fee integration with M3.
- Low-balance notification queue depth.
- Inventory/vendor edge-case tests.

Remaining frontend:

- QR/student ID scan speed polish.
- Inventory/vendor UI depth.
- Parent wallet/menu/spending views later.
- Canteen report/export polish.
- Canteen Playwright tests.

### M9 - Accounting & Finance

Implemented:

- Chart of accounts, journals, fiscal years/periods.
- Double-entry enforcement, Decimal-safe posting, immutable posted journals.
- Source-based idempotent posting, reversal/correction workflows.
- Fiscal close/reopen, opening balances, vouchers.
- Trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS/PF summaries, CSV exports.
- Bank reconciliation and accounting report mapping.
- Accounting dashboard, accounts, journals, reports, reconciliation, management routes.

Remaining backend:

- PDF accounting exports.
- Saved report snapshots and File Registry integration.
- Advanced bank auto-match rules.
- Accounting audit log viewer API/UI support.
- Production seed review for default Chart of Accounts and report mappings.

Remaining frontend:

- Seeded Playwright accounting workflow tests.
- Advanced accounting report visual polish.
- Audit log viewer UI.

### M10 - Notices, Communication, Messaging

Implemented:

- Notices, events, consent templates, guardian consent, communication preferences.
- Delivery records, retry/read tracking, unread recipients, notification center.
- Parent-teacher thread/message foundation, chat availability, escalation, abuse report foundations.
- Notices/detail/messages/messaging routes.

Remaining backend:

- Real SMS/FCM/email provider integration.
- Delivery retry failure dashboard.
- Attachment support with signed URLs.
- Retention and audit policy depth.
- More guardian ownership tests.

Remaining frontend:

- Parent/mobile chat UI later.
- Moderation/escalation UI depth.
- Unread recipient list polish.

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

1. Polish report-card PDFs.
2. Implement locked report-card correction/regeneration.
3. Add deeper academic reports/exports.
4. Add accounting PDF exports.
5. Add saved accounting/academic report snapshots through File Registry.
6. Add advanced bank reconciliation auto-match rules.

Frontend tasks:

1. Complete end-to-end Academics manual/browser smoke.
2. Polish report-card preview/download.
3. Polish Accounting reports and audit viewer.
4. Add seeded Playwright coverage for accounting workflows.

Exit criteria:

```text
Academics and Accounting are production-grade admin modules for the current Nepal school scope.
```

### Phase 3 - Homework, Timetable, HR, and Payroll Depth

Purpose: finish operational depth for Phase 2 foundations.

Backend tasks:

1. Route homework attachments through File Registry.
2. Harden homework reminder queues.
3. Integrate timetable substitutions with leave/absent teacher workflows.
4. Deepen timetable conflict validation and tests.
5. Harden leave accrual and payroll approval/posting locks.
6. Harden payroll reports/exports and payslip generation.
7. Review sensitive staff field masking/encryption.

Frontend tasks:

1. Polish timetable builder and conflict visualization.
2. Add teacher timetable and homework views.
3. Finish homework attachment UX.
4. Add HR/payroll browser smoke.
5. Finalize staff self-service and payslip views.

Exit criteria:

```text
Academic coordinators, teachers, HR admins, and accountants can operate M6/M7 without admin workarounds.
```

### Phase 4 - Library, Transport, and Canteen Production Depth

Purpose: turn Phase 3 admin foundations into reliable operations products.

Backend tasks:

1. Integrate Library fines with M3 fees and M9 accounting where approved.
2. Integrate Canteen meal plans/wallets/POS with M3/M9 where approved.
3. Integrate Transport billing/accounting only after pricing rules are approved.
4. Harden QR scan audit depth and purpose-limited responses.
5. Harden inventory/vendor, stock, wastage, and canteen wallet immutability.
6. Harden GPS ingestion, latest-location cache, retention cleanup, and real-time fanout design.
7. Add vertical-specific permission, tenant, and report tests.

Frontend tasks:

1. Polish Library barcode/QR scan and report export flows.
2. Polish Canteen QR/POS speed and inventory/vendor screens.
3. Build Transport live map only after real-time backend design is complete.
4. Add Library, Transport, and Canteen Playwright smoke coverage.

Exit criteria:

```text
Library, Transport, and Canteen are reliable admin operations modules and are clearly separated from future parent/driver/mobile experiences.
```

### Phase 5 - Parent, Mobile, Driver, and Live Experiences

Purpose: expose safe role-specific experiences after admin modules are stable.

Backend tasks:

1. Build parent-safe APIs for attendance, fees, activity, notices, report cards, homework, timetable, canteen, library, and transport.
2. Build driver-safe APIs for assigned route/trip workflows only.
3. Add push notification support.
4. Add child/route ownership tests for every endpoint.

Frontend tasks:

1. Parent dashboard and child switcher.
2. Parent views for attendance, fees, notices, report cards, homework, timetable, canteen, library, and transport.
3. Parent-class teacher chat UI.
4. Driver app/PWA trip workflow.
5. Mobile/PWA role-specific navigation.

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
