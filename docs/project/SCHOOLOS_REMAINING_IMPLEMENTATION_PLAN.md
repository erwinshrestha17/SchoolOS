# SchoolOS Remaining Implementation Plan

**Status source:** `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`  
**Current stage:** Phase 2 implemented foundations + Phase 3 operations admin foundations  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard  
**Last updated:** 2026-05-06

---

## 1. Current Product Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Phase 2: Foundations implemented; production hardening in progress
Phase 3: Operations admin foundations implemented; parent/mobile/driver/live UX deferred
Phase 4: Not started
```

SchoolOS is no longer a Phase 1-only system. The repo now contains real backend and web foundations for Phase 2 modules and admin foundations for Phase 3 operations modules.

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
Full SchoolOS vision: around 60–70% implemented
Phase 1 pilot product: around 90–95% implemented
```

Near-term rule:

```text
Do not start broad new modules.
Harden existing Phase 2 and Phase 3 foundations one vertical at a time.
Highest priority: M9 accounting correctness, tenant isolation, reports/exports, and production verification.
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
| M0 Platform Core | Started | 45–55% |
| M1 Admissions & Student Profiles | Pilot-ready | 90–95% |
| M2 Smart Attendance | Pilot-ready | 85–90% |
| M3 Fees & Receipts | Pilot-ready | 85–90% |
| M4 Academics / Exams / CAS / Report Cards | Phase 2 foundation implemented | 70–80% |
| M5 Activity Feed & Milestones | Strong Phase 1 foundation | 75–85% |
| M6 Homework & Timetable | Phase 2 foundation implemented | 60–70% |
| M7 HR & Payroll | Phase 2 foundation implemented | 65–75% |
| M8A Library Management | Phase 3 admin foundation implemented | 45–55% |
| M8B Transport Management | Phase 3 admin foundation implemented | 45–55% |
| M8C Canteen Management | Phase 3 admin foundation implemented | 45–55% |
| M9 Accounting & Finance | Foundation implemented; hardening priority | 55–65% |
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

Foundations implemented; production hardening in progress.

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

Current estimate: 70–80% implemented.

Remaining:

- Exam setup polish.
- Assessment component UI and validation hardening.
- CAS workflow depth.
- Marks lock/unlock hardening.
- Marks review and approval workflow.
- Missing marks validation.
- Report card batch generation.
- Report card PDF queue/background generation.
- Promotion workflow polish.
- Result publishing audit hardening.
- Parent result notification polish.
- Academic reports/export.
- Class/section/term/subject index review.
- Cross-tenant academic tests.
- Playwright coverage for academics.

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

Current estimate: 55–65% implemented.

This is the highest-priority remaining module because accounting correctness affects fees, payroll, canteen, library fines, expenses, audit, and future commercial rollout.

Remaining:

- AccountingPostingService hard boundary.
- Double-entry enforcement tests.
- Immutable ledger enforcement.
- Fiscal year/fiscal period close/lock/reopen workflow.
- No posting into closed period enforcement.
- Journal/voucher numbering per tenant/fiscal year.
- Source document linkage hardening.
- Manual journal approval workflow.
- Expense voucher approval workflow.
- Bank/cash account management polish.
- Bank reconciliation depth.
- Trial balance report.
- General ledger report.
- Cash book report.
- Income statement.
- Balance sheet.
- VAT summary.
- TDS/PF reports.
- Budget vs actual.
- Audit-ready accounting exports.
- Reversal/correction workflow polish.
- M3 fee posting integration hardening.
- M7 payroll posting integration hardening.
- M8C canteen accounting integration later.
- M8A library fine accounting integration later.
- Backend-generated reports only.
- Accounting Playwright/admin UI polish.

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

Current estimate: 45–55% implemented.

Remaining:

- Platform Control Plane depth.
- Tenant/school management polish.
- Tenant activation/suspension workflow.
- Plan/subscription management.
- Usage limits and plan rules.
- Tenant Settings depth.
- Generic File Registry full adoption.
- Global API response envelope.
- Generic Reports Foundation.
- Safe Activity Logs.
- API Key Management.
- Webhook System.
- SaaS Subscription and Billing.
- Platform health dashboard.
- Queue failure dashboard.
- Support access audit UI.
- Provider configuration UI.

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

Web admin UI is now broadly implemented across Phase 1, Phase 2 foundations, and Phase 3 admin foundations.

Remaining UI/UX:

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

1. Harden M9 Accounting correctness and immutability.
2. Fix production verification and contract-test drift.
3. Add tenant isolation tests across Phase 2 and Phase 3.
4. Harden reports and exports.
5. Complete File Registry and storage-backed uploads.
6. Polish Phase 2 admin UX.
7. Harden Library, Transport, and Canteen admin foundations.
8. Start parent/mobile portal only after backend ownership and permissions are stable.
9. Add driver app and live transport map/WebSocket after transport APIs are hardened.
10. Start AI/ML only after real production data exists.

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
Phase 2: Foundations implemented; needs production hardening.
Phase 3: Admin foundations implemented; parent/mobile/driver/live tracking/inventory remain.
Phase 4: Not started.
M0 Platform Core: Partially implemented; SaaS/platform depth remains.
```

SchoolOS should now prioritize production hardening over broad feature expansion.
