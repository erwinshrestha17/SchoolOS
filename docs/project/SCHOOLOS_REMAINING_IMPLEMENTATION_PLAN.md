# SchoolOS Remaining Implementation Plan

**Status source:** `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`  
**Current stage:** Phase 2A backend complete + Phase 2 implemented foundations + Phase 3 operations admin foundations  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard  
**Last updated:** 2026-05-11

---

## 1. Current Product Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend: Completed / contract-protected
M9 Accounting Ledger Hardening: Production Candidate Complete
Phase 2: Foundations implemented; frontend/admin UI and vertical hardening in progress
Phase 3: Operations admin foundations implemented; parent/mobile/driver/live UX deferred
Phase 4: Not started
```

SchoolOS is no longer a Phase 1-only system. The repo now contains real backend and web foundations for Phase 2 modules and admin foundations for Phase 3 operations modules. Phase 2A backend for M4 Academics, Exams, CAS, Report Cards, Promotion Readiness, Result Publishing, and parent notification is now complete and protected by a dedicated Phase 2A flow contract.

Current practical readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Estimated completion:

```text
Full SchoolOS vision: around 70–80% implemented
Phase 1 pilot product: around 90–95% implemented
Phase 2A backend: 100% for current backend scope; frontend/admin UI remains
```

Near-term rule:

```text
Do not start broad new modules.
Harden existing Phase 2 and Phase 3 foundations one vertical at a time.
Highest priority: Phase 2A admin UI wired to completed backend APIs, then browser smoke tests and vertical hardening.
```

Explicitly deferred unless requested:

```text
Parent/mobile portal
Driver app
Live transport map/WebSocket UI
Full canteen inventory/vendor workflows
AI/ML features
Angular migration
Microservices
```

---

## 2. Module Completion Snapshot

| Module | Current Status | Estimated Completion |
|---|---|---:|
| Auth / Security / Tenant Isolation | Strong foundation | 90–95% |
| M0 Platform Core | Completed Foundation Depth | 65–75% |
| M1 Admissions & Student Profiles | Pilot-ready | 90–95% |
| M2 Smart Attendance | Pilot-ready | 85–90% |
| M3 Fees & Receipts | Pilot-ready | 85–90% |
| M4 Academics / Exams / CAS / Report Cards | Backend complete / contract-protected; admin UI next | 80–90% |
| M5 Activity Feed & Milestones | Strong Phase 1 foundation | 75–85% |
| M6 Homework & Timetable | Phase 2 foundation implemented | 60–70% |
| M7 HR & Payroll | Phase 2 foundation implemented | 65–75% |
| M8A Library Management | Phase 3 admin foundation implemented | 45–55% |
| M8B Transport Management | Phase 3 admin foundation implemented | 45–55% |
| M8C Canteen Management | Phase 3 admin foundation implemented | 45–55% |
| M9 Accounting & Finance | Production Candidate Complete | 95–100% |
| M10 Notices & Communication | Strong Phase 1 + chat foundation | 85–90% |
| Parent / Mobile Portal | Mostly deferred | 5–10% |
| Driver App | Deferred | 0–5% |
| AI / ML | Not started | 0% |

---

## 3. Phase 0 — Foundation

### Status

Completed. Only continuous hardening remains.

### Remaining Implementation

- Improve production verification stability.
- Improve OpenAPI verification.
- Improve CI reliability.
- Improve contract-test stability.
- Add/strengthen request and correlation ID logging.
- Add deeper observability for API, database, Redis, BullMQ, and file storage.
- Add queue failure visibility for admin/platform operators.

---

## 4. Phase 1 — Pilot-Ready Core School System

### Status

Completed / pilot-ready. Remaining work is hardening, polish, and staging/pilot validation.

### M1 — Admissions & Student Profiles

Remaining:

- Storage-backed student photo upload hardening.
- Logo/branding upload hardening.
- iEMIS export final field mapping.
- Duplicate merge workflow.
- Better student document audit trail polish.
- More cross-tenant tests.
- More Playwright coverage for student flows.

### M2 — Smart Attendance

Remaining:

- Attendance correction request workflow.
- Parent-facing attendance summary.
- True offline draft persistence.
- More monthly register polish.
- More teacher-specific permission tests.
- Attendance report/export stabilization.

### M3 — Fees & Receipts

Remaining:

- Receipt reprint history polish.
- Fee-head/period-level dues table polish.
- Online payment gateway readiness.
- More payment reversal/correction tests.
- More cashier close verification.
- Better finance report exports.

### M5 — Activity Feed & Milestones

Remaining:

- Real object storage/direct upload hardening.
- Image compression for low-bandwidth Nepal usage.
- Post edit/delete/soft-delete polish.
- Moderation/approval workflow.
- Activity detail page.
- Parent-facing activity view.
- Teacher media gallery polish.

### M10 — Notices & Communication

Remaining:

- Consent text/version templates.
- Marketing opt-out rules.
- Event RSVP.
- Real SMS/FCM/email provider integration.
- Unread recipient list polish.
- Delivery retry failure dashboard.
- More notification queue tests.

### Global Phase 1 UX / QA Remaining

- Full Playwright smoke test stabilization.
- Browser smoke coverage for dashboard, students, attendance, finance, notices, notification bell, and global search.
- PDF visual polish consistency.
- Staging pilot checklist.
- Slow-network UI testing.
- Permission-denied states.

---

## 5. Phase 2 — Academic, HR, Timetable, Accounting Expansion

### Status

Phase 2 foundations are implemented. Phase 2A backend is complete and contract-protected. Remaining work is mostly frontend/admin UI, browser smoke tests, vertical hardening, and deeper reports/exports.

Modules:

```text
M4 Academics / Exams / CAS / Report Cards
M6 Homework & Timetable
M7 HR & Payroll
M9 Accounting & Finance
M10 Parent Communication Expansion
```

---

### 5.1 Phase 2A — M4 Academics, Exams, CAS, Report Cards

Current estimate: 80–90% implemented.

Backend status: **Complete / contract-protected**.

Completed backend sequence:

```text
Step 1 — Exam Terms + Assessment Components foundation
Step 2 — Subject Marks Entry
Step 3 — CAS Records
Step 4 — Nepal Grading/GPA Result Preview
Step 5 — Marks Lock/Unlock Workflow Hardening
Step 6 — Report Card Generation Backend Hardening
Step 7 — Promotion Readiness Backend Hardening
Step 8 — Result Publishing + Parent Notification Backend Hardening
Step 9 — Backend Final Hardening + Phase 2A Flow Contract
```

Verified backend results:

```text
pnpm --filter @schoolos/api test src/academics/phase2a-flow.contract.spec.ts
  PASS: 1 suite / 9 tests

pnpm --filter @schoolos/api test src/integrity/production-contracts.spec.ts
  PASS: 1 suite / 11 tests

pnpm typecheck
  PASS: API + web

pnpm test
  PASS: API 76 suites / 494 tests
  PASS: Web 71 tests
```

Remaining:

- Academics workspace/dashboard UI.
- Exam term setup UI.
- Assessment component setup UI.
- Marks entry UI.
- CAS records UI.
- Result preview UI.
- Marks lock/review UI.
- Report card generation UI.
- Promotion readiness UI.
- Result publishing and notification UI.
- Browser smoke / Playwright coverage for the full Phase 2A workflow.
- Report card PDF visual polish.
- Locked report-card correction/regeneration workflow.
- Deeper academic reports/export.
- Final class/section/term/subject index review after UI usage patterns stabilize.

---

### 5.2 Phase 2B — M6 Homework and Timetable

Current estimate: 60–70% implemented.

Remaining:

- Timetable builder polish.
- Teacher availability rules.
- Teacher workload limits.
- Room conflict checks.
- Period conflict checks.
- Subject weekly required periods validation.
- Timetable version compare/restore.
- Publish/lock/archive hardening.
- Substitution workflow depth.
- Absent teacher + leave integration.
- Teacher timetable view polish.
- Parent/student timetable view later.
- Homework attachment storage via File Registry.
- Homework reminder queue hardening.
- Homework submission review polish.
- Cross-tenant timetable/homework tests.

---

### 5.3 Phase 2C — M7 HR and Payroll

Current estimate: 65–75% implemented.

Remaining:

- Staff profile depth polish.
- Staff document manager.
- Staff attendance reports.
- Leave balance/accrual rules hardening.
- Leave approval audit workflow.
- Salary component rules.
- Payroll run lifecycle hardening.
- Payroll approval/posting lock.
- Payslip PDF polish.
- Payroll register/report exports.
- Payroll-to-accounting integration hardening.
- Sensitive staff field masking/encryption review.
- Contract termination workflow.
- More HR/payroll permission tests.

---

### 5.4 Phase 2D — M9 Accounting and Finance

Current estimate: 95–100% implemented for the current backend/admin scope.

Status: **Production Candidate Complete**.

Completed:

- AccountingPostingModule added.
- AccountingPostingService centralized as ledger write boundary.
- FinanceModule and AccountingModule wired through AccountingPostingModule.
- FinanceService delegates ledger postings to AccountingPostingService.
- Ledger boundary production contracts added/updated.
- Audit logging required for ledger mutations.
- Trial Balance backend.
- General Ledger backend.
- Cash Book backend.
- Income Statement backend.
- Balance Sheet backend.
- VAT/TDS/PF summaries.
- CSV report exports.
- Fiscal period close/lock/reopen workflows.
- Bank reconciliation foundation.
- Frontend Accounting workspace.

Remaining:

- PDF accounting exports.
- Saved report snapshots and File Registry integration.
- Advanced bank auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.

Non-negotiable M9 rules:

1. Never edit confirmed journal entries directly.
2. Use reversal/correction/adjustment entries.
3. Enforce total debit = total credit.
4. Enforce fiscal period states: OPEN, LOCKED, CLOSED.
5. Link every journal to a source document.
6. Other modules must post through `AccountingPostingService` or a clear accounting boundary.
7. Use PostgreSQL numeric/Prisma Decimal, never JavaScript floating point.
8. Journal/voucher/receipt numbers must be unique per tenant/fiscal year.
9. Reports must come from backend ledger data.
10. Audit posting, approval, reversal, closing, reopening, and exports.

---

### 5.5 Phase 2E — Parent Communication Expansion

Current status: chat foundation implemented.

Remaining:

- Parent-class teacher chat moderation.
- Quiet hours and chat availability polish.
- Outside-hours queued message notice polish.
- Emergency override workflow.
- Admin/principal escalation workflow.
- Abuse/report/block controls.
- Attachment support with signed URLs.
- Retention/audit rules.
- Conversation closure workflow.
- Teacher notification rules through M10.
- Parent/mobile chat UI later.
- More guardian ownership tests.

---

## 6. Phase 3 — Extended School Operations

### Status

Admin foundations implemented for Library, Transport, and Canteen. Deeper production workflows, reports, parent/mobile, driver app, and live tracking UI remain.

---

### 6.1 Phase 3A — M8A Library Management

Current estimate: 45–55% implemented.

Remaining:

- Borrowed-students endpoint/page.
- Fine records endpoint/page.
- Library report endpoints.
- Library report/export UI.
- Barcode/QR scan polish.
- Book history.
- Borrower history.
- Popular books report.
- Lost/damaged books report.
- Fine summary report.
- Library fine integration with M3 fees.
- Library accounting integration with M9 later.
- Overdue reminder queue hardening.
- Staff borrower depth.
- Library permission tests.
- Library Playwright tests.

---

### 6.2 Phase 3B — M8B Transport Management

Current estimate: 45–55% implemented.

Remaining:

- Live map UI.
- WebSocket/SSE real-time transport updates.
- Driver app.
- Parent child-specific tracking UI.
- ETA calculation polish.
- Trip history report polish.
- Transport attendance report.
- Route dashboard depth.
- Delay alert workflow.
- Vehicle document expiry alerts.
- Driver mobile GPS ingestion hardening.
- Redis Pub/Sub for multi-instance live updates.
- GPS write-pressure protection.
- Location history retention/partition strategy.
- Geofence later.
- Overspeed later.
- Route deviation later.
- Premium GPS device integration later.
- Parent transport notifications polish.
- Transport billing integration with M3 later.
- Transport accounting integration with M9 later.

---

### 6.3 Phase 3C — M8C Canteen Management

Current estimate: 45–55% implemented.

Remaining:

- Inventory management.
- Vendor purchase tracking.
- Supplier profile.
- Purchase bill workflow.
- Credit purchase/payment status.
- Inventory stock in/out.
- Expiry alerts.
- Wastage tracking.
- Profit/loss report.
- Parent spending controls UI polish.
- Parent wallet/menu view.
- Low-balance notification queue.
- QR/student ID scan UI polish.
- Meal serving speed optimization.
- Allergy warning enforcement audit.
- Wallet ledger immutability hardening.
- POS receipt generation.
- Canteen accounting integration with M9.
- Meal plan fee integration with M3.
- Canteen reports/export polish.
- Canteen Playwright tests.

---

### 6.4 Phase 3D — Parent and Mobile Expansion

Current estimate: 5–10% implemented / mostly deferred.

Remaining:

- Parent dashboard.
- Parent child switcher.
- Parent attendance view.
- Parent fee and receipt view.
- Parent activity feed view.
- Parent notices and consent view.
- Parent report card/result view.
- Parent homework view.
- Parent timetable view.
- Parent transport tracking view.
- Parent canteen wallet/menu view.
- Parent-class teacher chat mobile UI.
- Push notification support.
- Student age-aware portal.
- Teacher mobile workflows.
- Teacher attendance/homework quick actions.
- Driver app trip workflow.
- Mobile/API client stabilization.
- PWA/mobile shell.
- Role-specific mobile navigation.

---

## 7. Phase 4 — AI, Analytics, Scale, Enterprise SaaS

### Status

Not started. Start only after reliable production data exists.

---

### 7.1 Phase 4A — AI/ML Features

Remaining:

- Attendance risk prediction.
- Fee defaulter risk scoring.
- Student learning/behavior insights.
- Activity caption assistance.
- Parent engagement analytics.
- Transport ETA prediction.
- Canteen demand forecasting.
- Accounting anomaly detection.
- Smart notice/message templates.

---

### 7.2 Phase 4B — Advanced Data Platform

Remaining:

- Analytics warehouse.
- Event tracking.
- Longitudinal student data model.
- School benchmarking.
- Cohort analysis.
- Anonymized/consented ML datasets.
- Read models/materialized views.

---

### 7.3 Phase 4C — Scale Optimization

Remaining:

- API/worker process separation.
- Dedicated worker entrypoints.
- Queue scaling.
- Read replicas if needed.
- Slow query monitoring.
- Metrics endpoint.
- Request/correlation ID logging.
- Operational dashboards.
- Partitioning/archive strategy.
- Attendance record partitioning.
- Notification delivery partitioning.
- Transport log partitioning.
- Audit log partitioning.
- Journal line fiscal-year strategy.

---

### 7.4 Phase 4D — Enterprise SaaS

Remaining:

- Multi-school group support.
- Advanced SaaS subscription billing.
- Plan/module entitlements.
- Usage limits enforcement.
- White-label branding.
- Enterprise onboarding.
- SLA/monitoring dashboard.
- Platform billing reports.
- Provider configuration UI.
- API key management.
- Webhook system.
- Developer portal.
- Compliance exports.

---

## 8. M0 Platform Core Remaining

M0 cuts across all phases.

Current estimate: 65–75% implemented.

Completed:

- platform tenant server-side pagination.
- tenant status reason workflow.
- platform audit log UI.
- centralized usage service.
- plans/limits foundation.
- tenant settings validation depth.
- file registry lifecycle hardening.
- reports foundation hardening.

Remaining:

- SaaS subscription billing.
- API key management.
- Webhook system.
- Advanced provider configuration.
- Full platform health dashboard.
- Queue failure dashboard.
- Full usage enforcement.
- Full file registry migration across all modules.
- Full report migration across all modules.

Important boundary:

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using SchoolOS.
```

Do not mix these two systems.

---

## 9. Scalability Remaining Work

Overall scalability implementation estimate: 55–65%.

Remaining:

- Full production verification stability.
- Contract-test drift cleanup.
- More cross-tenant tests.
- Full index review across Phase 2/3.
- Consistent pagination across all growing lists.
- API/worker process separation.
- Queue failure dashboard.
- Request/correlation ID logging.
- Metrics endpoint.
- Heavy report/PDF background generation.
- Object storage lifecycle/retention.
- Transport GPS scaling discipline.
- Database connection pooling strategy.
- Archival/partitioning for attendance, logs, notifications, transport, and journals.

Scalability gate for every new feature:

```text
1. Which module owns this feature: M0 or M1-M10?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
```

Implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification
```

---

## 10. UI/UX Remaining Work

Web admin UI is now broadly implemented across Phase 1, Phase 2 foundations, and Phase 3 admin foundations. Phase 2A backend is complete, so the next UI/UX priority is an Academics admin workflow wired to real APIs.

Remaining UI/UX:

- Phase 2A Academics admin workspace.
- Exam term and assessment component setup screens.
- Marks entry and CAS workflow screens.
- Result preview, lock/review, report-card generation, promotion readiness, and publishing screens.
- Browser smoke/Playwright coverage for Phase 2A.
- Parent/mobile portal.
- Student mobile/PWA portal.
- Teacher mobile workflows.
- Driver app.
- Live transport map.
- WebSocket/SSE tracking UI.
- Full canteen inventory/vendor UI.
- Advanced reports/exports UX.
- Developer portal.
- Full accessibility pass.
- Full browser smoke coverage.
- Permission-denied states.
- Slow-network UX review for Nepal schools.

Estimated UI/UX status:

```text
Web admin UI/UX: 75–85%
Platform UI/UX: 45–55%
Parent/mobile UI/UX: 5–10%
Driver app UI/UX: 0–5%
Full UI/UX roadmap: 60–70%
```

---

## 11. Recommended Next Implementation Order

Do next:

1. Build Phase 2A Academics frontend/admin UI against the completed backend APIs.
2. Add browser smoke/Playwright contracts for the full Phase 2A workflow.
3. Stabilize and browser-test the completed Accounting UI.
4. Review production seeds for default Chart of Accounts and report mappings.
5. Add tenant isolation tests across Phase 2 and Phase 3.
6. Harden reports and exports.
7. Complete File Registry and storage-backed uploads.
8. Harden Library, Transport, and Canteen admin foundations.
9. Start parent/mobile portal only after backend ownership and permissions are stable.
10. Add driver app and live transport map/WebSocket after transport APIs are hardened.
11. Start AI/ML only after real production data exists.

Avoid now:

```text
Broad new modules
AI/ML
Angular migration
Microservices
Parent/mobile before tenant ownership is fully verified
Driver/live map before transport scaling is ready
Canteen inventory/vendor workflows before wallet/accounting boundaries are hardened
```

---

## 12. Final Summary

```text
Phase 1: Completed; only hardening remains.
Phase 2A backend: Completed / contract-protected; frontend/admin UI next.
Phase 2B/2C/2E: Foundations implemented; needs vertical hardening.
Phase 2D M9: Production Candidate Complete.
Phase 3: Admin foundations implemented; parent/mobile/driver/live tracking/inventory remain.
Phase 4: Not started.
M0 Platform Core: Partially implemented; SaaS/platform depth remains.
```

SchoolOS should now prioritize production hardening and Phase 2A frontend/admin UI over broad feature expansion.
