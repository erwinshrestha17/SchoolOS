# SchoolOS Software Requirements Specification 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school management SaaS  
**Target schools:** Montessori to Class 10 first, with future K-12/+2 extensibility  
**Document type:** Software Requirements Specification  
**Status:** Draft derived from `docs/product/SCHOOLOS_PRD_COMBINED_MASTER_2026.md`  
**Last updated:** 2026-06-03

---

## 1. Purpose

This SRS defines the software-level requirements for SchoolOS. It translates the PRD into system behavior, constraints, non-functional requirements, security rules, data protection requirements, integration expectations, and pilot-readiness conditions.

The PRD explains what the product should be. This SRS explains what the software system must do and how it must behave.

---

## 2. System Overview

SchoolOS is a production-grade, multi-tenant SaaS school management and financial operating system for Nepali schools.

The system must support:

- Platform/SaaS control.
- Tenant/school setup.
- Admissions and student profiles.
- Guardians and parent access.
- Attendance.
- Fees and receipts.
- Accounting and finance.
- Academics, exams, CAS, and report cards.
- Homework and timetable.
- Notices, communication, and messaging.
- Activity feed and milestones.
- HR and payroll.
- Library.
- Transport.
- Canteen.
- Protected File Registry.
- Reports and exports.
- Future analytics after reliable production data exists.

---

## 3. Architecture Constraints

1. The backend must remain a NestJS modular monolith for the pilot stage.
2. The system must use PostgreSQL with Prisma for persistent data.
3. Redis/BullMQ must be used for cache, queues, and background jobs where needed.
4. The dashboard must continue using Next.js.
5. The companion app must continue using Flutter.
6. Browser authentication must be cookie-first.
7. Mobile/API clients must support bearer-token access.
8. The system must maintain strict `tenantId` boundaries across modules.
9. The system must avoid premature migration to microservices.
10. The system must avoid Angular migration for the current product direction.
11. Large services/components should be split by responsibility as code-file modularization, not microservices.

---

## 4. Product Planes and Boundaries

SchoolOS must support three separate product planes.

| Plane | Audience | Requirement |
|---|---|---|
| Platform Control Plane | SchoolOS operator | Manage SaaS tenants, subscriptions, provider readiness, queues, API keys, support override, audit, billing records. |
| Tenant Configuration Plane | Principal/admin | Configure academic years, classes, sections, fee settings, school profile, roles, modules, localization. |
| School Operations Plane | Staff, parents, students | Run daily workflows including students, attendance, fees, accounting, academics, communication, library, transport, canteen, HR. |

System rules:

1. SchoolOS SaaS billing must not mix with school fee collection.
2. Platform support override must require explicit tenant, reason, audit, and time-bound design where possible.
3. Tenant configuration must affect only the selected tenant.
4. School operation APIs must always be tenant-scoped.
5. Parent/student/driver/mobile APIs must be purpose-limited and must not expose admin-shaped responses.
6. Disabled feature routes must fail closed even when accessed directly by URL.

---

## 5. User Classes

The system must support the following user classes:

- SchoolOS Platform Operator.
- School Owner / Principal.
- School Admin.
- Accountant / Finance Staff.
- Cashier.
- Teacher.
- Parent / Guardian.
- Student.
- Librarian.
- Transport Staff / Driver.
- Canteen Operator.
- HR / Payroll Staff.

Each user class must have role-based permissions and tenant-scoped access.

---

## 6. Functional Requirements by Module

### 6.1 M0 Platform Core / SaaS Foundation

The system must provide:

1. Tenant list, detail, dashboard, status, suspend, and activate flows.
2. Reason-required suspend/activate behavior.
3. Plans, features, tenant subscriptions, feature overrides, and usage counters.
4. Platform API key creation with one-time secret display.
5. API key hashed storage, masked list responses, revoke flow, and audit records.
6. Provider configuration masking and provider readiness checks.
7. Queue health, failed job inspection, retry metadata, and audited retry actions.
8. File Registry and report export history.
9. Onboarding checklist and platform health summary.
10. Storage provider readiness for local, R2, S3-compatible, and MinIO-style providers.

### 6.2 M1 Admissions and Student Profiles

The system must provide:

1. Inquiry/application/admission workflow.
2. Student creation, editing, search, and lifecycle history.
3. Guardian details and relationship management.
4. Class, section, roll number, and academic year assignment.
5. Student document and photo uploads.
6. Student identity and QR credential lifecycle.
7. Duplicate candidate detection.
8. IEMIS/export readiness fields.
9. Student lifecycle states: applicant, active, transferred, withdrawn, graduated, archived.

### 6.3 M2 Smart Attendance

The system must provide:

1. Daily attendance sessions and records.
2. Present, absent, late, leave, correction, and half-day states where school policy requires.
3. Teacher-scoped attendance marking.
4. Attendance drafts and offline/reconnect recovery.
5. Correction request and approval workflow.
6. Attendance history, monthly analytics, and exports.
7. Parent/student child-scoped attendance views.

### 6.4 M3 Fees and Receipts

The system must provide:

1. Fee heads, fee plans, student assignments, invoices, and invoice lines.
2. Payment collection and receipt generation.
3. Partial payments, overpayments, dues, student ledgers, and reconciliation.
4. Receipt PDF generation and reprint history.
5. Refunds and reversals with permission and reason.
6. Cashier close and day-end summary.
7. Gateway readiness state.
8. Accounting consistency with M9.

### 6.5 M4 Academics, Exams, CAS, and Report Cards

The system must provide:

1. Exam terms and assessment components.
2. Subject and class setup.
3. Marks entry and CAS entry.
4. Marks lock/unlock workflow.
5. Nepal grading/GPA preview.
6. Report card generation and version history.
7. Correction and regeneration workflow.
8. Result publishing and promotion readiness.
9. Academic CSV/PDF exports.

### 6.6 M5 Activity Feed and Milestones

The system must provide:

1. Activity posts with targeting.
2. Student tags and class visibility.
3. Media attachments with private access.
4. Draft, approve, reject, archive, remove lifecycle.
5. Reactions and detail view.
6. Developmental milestones and mood logs.
7. Parent child-scoped activity feed.
8. Media privacy and consent handling.

### 6.7 M6 Homework and Timetable

The system must provide:

1. Homework creation, assignment, due dates, attachments, submissions, reviews, and corrections.
2. Homework reminders and reports.
3. Timetable periods, rooms, versions, slots, publish, lock, archive, and reopen.
4. Teacher availability, workload limits, weekly subject requirements, and substitutions.
5. Parent/student homework and timetable read views.

### 6.8 M7 HR and Payroll

The system must provide:

1. Staff profile and lifecycle management.
2. Staff documents and sensitive field masking.
3. HR attendance and leave management.
4. Salary structures, payroll runs, payroll lines, and payslips.
5. Payroll approval, posting, and reversal.
6. Payroll reports including PF/TDS/component/leave summaries.
7. Staff self-service access.

### 6.9 M8A Library Management

The system must provide:

1. Book and copy catalog.
2. Issue, return, lost, damaged, and overdue workflows.
3. Fine settings and calculation.
4. Student/staff borrower support.
5. QR borrower lookup using student identity.
6. Book/copy history and reports.
7. CSV exports.
8. Future fine-to-fees/payment integration.

### 6.10 M8B Transport Management

The system must provide:

1. Routes, stops, vehicles, drivers, and assignments.
2. Trip lifecycle and boarded/dropped/absent statuses.
3. Latest trip location and location logs.
4. GPS ingestion validation.
5. Redis latest-location cache and throttled database persistence.
6. Tenant/trip-scoped location fanout.
7. Parent active-trip endpoint.
8. Trip and boarding reports.

### 6.11 M8C Canteen Management

The system must provide:

1. Menu item and meal plan management.
2. Meal plan enrollments and serving.
3. Student wallet top-up, history, correction, and reversal.
4. POS sales and receipt JSON/PDF.
5. Spending controls and low-balance reports.
6. Supplier and inventory item management.
7. Purchase bills, stock movement, wastage, stock ledger.
8. Sales, spending, meal count, low-balance, and stock reports.
9. QR resolve for canteen serving.

### 6.12 M9 Accounting and Finance

The system must provide:

1. Chart of accounts.
2. Fiscal years and periods.
3. Journal entries and vouchers.
4. Double-entry enforcement.
5. Decimal-safe posting.
6. Immutable posted journals.
7. Source-based idempotent posting.
8. Reversal/correction workflow.
9. Fiscal close/reopen.
10. Trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS/PF summaries.
11. CSV/PDF exports and report snapshots.
12. Bank reconciliation and auto-match suggestions.
13. Accounting audit log viewer.

### 6.13 M10 Notices, Communication, and Messaging

The system must provide:

1. School-wide, class-specific, and targeted notices.
2. Event and consent template support.
3. Guardian consent and communication preferences.
4. Notification center, delivery records, retry/read tracking, unread recipients.
5. Provider modes: dev-log, disabled, configured-provider.
6. Delivery failure dashboard and retry metadata.
7. File Registry-backed notice/chat attachments.
8. Parent-teacher thread/message foundation.
9. Chat availability, escalation, and abuse report foundation.

### 6.14 M11 School Intelligence and Analytics

The system may provide future analytics only after reliable production data exists:

1. Student performance trends.
2. Attendance risk indicators.
3. Fee collection analytics.
4. Staff and class-level insights.
5. Parent engagement analytics.
6. Human-review queue for recommendations.
7. Predictive analytics in later phases only.

---

## 7. Cross-Cutting System Requirements

### 7.1 Tenant isolation

1. Every database query, file access, queue job, export, and report must be tenant-scoped.
2. Same names, phone numbers, admission numbers, class names, or receipt numbers across schools must never cause leakage.
3. Platform override must require explicit reason and audit trail.
4. Suspended tenants must be blocked consistently across dashboard, API, mobile, jobs, file downloads, and report generation.

### 7.2 Parent and student access

1. Parents can only access linked children.
2. Students can only access their own allowed records.
3. Guardian removal must revoke access immediately.
4. Shared links must not bypass ownership checks.
5. Parent/student APIs must fail closed.

### 7.3 File privacy

1. Student photos, documents, receipts, report cards, payslips, notices, chat attachments, activity media, and exports must use protected access.
2. Raw storage keys, public object URLs, and internal file IDs must not be exposed to unauthorized clients.
3. Signed URLs must be short-lived.
4. Sensitive file preview/download must be audited.

### 7.4 Money and accounting

1. Payment, refund, reversal, payroll, canteen, library fine, and accounting posting flows must be idempotent.
2. Posted accounting records must be immutable.
3. Every reversal must have reason, permission check, and audit trail.
4. Financial reports must reconcile with source ledgers.
5. Decimal-safe money handling must prevent one-paisa mismatches where possible.

### 7.5 Offline, slow network, and recovery

1. Long forms should preserve drafts where practical.
2. Expired sessions should recover safely without duplicate submission.
3. Offline/reconnect sync must show conflicts instead of overwriting silently.
4. Low-bandwidth media must fail gracefully.

### 7.6 Background jobs

1. Jobs must re-check tenant status, feature status, entity status, and permissions before executing.
2. Retried jobs must not duplicate messages, payments, reports, exports, or accounting postings.
3. Failed jobs must expose safe diagnostics without secrets.
4. Queue retry for sensitive jobs must be audited.

### 7.7 PDFs, reports, and exports

1. Receipt, ID card, report card, payroll, accounting, attendance, fee, library, transport, canteen, notice, and official-reporting exports must be tenant-scoped.
2. Export failure must not create false success states.
3. Re-generated PDFs should maintain history where legally or operationally required.
4. Large reports should use background export when needed.
5. Exported artifacts must be registered in File Registry where retained.

### 7.8 Audit logging

Audit logs are required for:

- Tenant override.
- Support override entry/exit.
- Suspend/activate tenant.
- Payment reversal/refund.
- Accounting posting/reversal/fiscal reopen.
- Marks unlock/correction/report regeneration.
- Result publication.
- Payroll approval/post/reversal.
- Student guardian changes.
- QR generate/rotate/revoke.
- Sensitive file preview/download.
- Notice moderation/removal.
- Abuse, escalation, and messaging moderation actions.
- Queue retry for sensitive jobs.
- Bulk exports and official-reporting export actions.

---

## 8. Payment and Provider Requirements

1. Cash must be supported for pilot.
2. Manual bank transfer must be supported as a controlled workflow with reference/proof and approval.
3. eSewa and Khalti must only be enabled after sandbox/staging verification.
4. Mock provider mode is allowed only for demo/dev and must be clearly shown in UI.
5. Card/bank host-to-host payments are future scope.
6. SchoolOS must create its own payment intent/order before provider redirect/initiation.
7. The system must deduplicate payments by provider reference, SchoolOS order/reference, and amount.
8. The system must not finalize receipt from redirect/callback alone where provider lookup/status verification is supported.
9. Pending, expired, failed, canceled, and provider-error states must be retained.
10. Refund/reversal must create explicit records and must not overwrite original receipt.
11. Cashier/accounting must be able to reconcile gateway totals against SchoolOS receipts.
12. Disabled provider mode must block fake real-payment collection.

---

## 9. IEMIS and Official Reporting Requirements

1. IEMIS readiness must be treated as validation and export readiness workflow.
2. Export states must include Draft, Validation Failed, Ready, Exported, and Archived.
3. School master profile fields must be complete before official-ready state.
4. Student identity, guardian, class/section, roll, status, transfer/promote/leave state must be represented.
5. Scholarship/payment readiness fields must be explicit where required.
6. Teacher/staff roster must align with timetable and attendance ownership.
7. Physical/infrastructure profile fields must support school profile readiness where required.
8. Special flags such as technical, disability, scholarship, transfer, dropout, and status must not be hidden in notes.
9. Unsupported official fields must be documented instead of guessed.
10. Claims of final IEMIS compliance require validation against real official templates during pilot/staging.

---

## 10. Non-Functional Requirements

| Area | Requirement / target |
|---|---|
| Availability | 99.5% monthly for pilot SaaS environment, excluding announced maintenance. |
| Common page response | p95 under 2.0 seconds for common dashboard workflows under pilot data size. |
| Attendance/marks save | p95 write under 1.5 seconds. |
| Cashier receipt generation | Receipt issued under 2 seconds after confirmed save. |
| Search | Student/staff lookup under 1 second p95 for pilot data size. |
| Audit integrity | 100% of configured sensitive actions logged. |
| Backup | Daily full backup plus intra-day snapshot/incremental strategy. |
| Recovery | Target RPO 24 hours or better; target RTO 8 business hours for pilot. |
| Access control | Role checks on all business actions; step-up approval for reversals, refunds, bulk export. |
| Localization | Nepali + English UI baseline; BS/AD date support; printable formats configurable. |
| Data portability | CSV/Excel export for major masters and transactions; archival export for tenant offboarding. |
| Observability | Failed payments, failed jobs, failed exports, and provider problems visible to operators. |
| Mobile/low bandwidth | Mobile screens must degrade gracefully on intermittent connections. |
| List scalability | Growing lists must be paginated and server-filtered. |

---

## 11. Security Requirements

1. Browser auth must be cookie-first.
2. Mobile/API access must support bearer tokens.
3. No raw browser token storage.
4. RBAC must protect all business actions.
5. Tenant isolation must be enforced on every backend operation.
6. Support override must require reason, explicit tenant, audit, and expiry/time-bound handling where possible.
7. File access must be protected and signed URLs short-lived.
8. Provider secrets must be masked in UI, logs, diagnostics, queue screens, and failure screens.
9. Sensitive data must be masked unless the user has permission.
10. Bulk export must require permission and audit.
11. Parent/student access must fail closed.

---

## 12. Data Requirements

The system must maintain canonical backend models for:

- Tenant.
- User.
- Role and permission.
- Student.
- Guardian.
- Staff.
- Class.
- Section.
- Academic year.
- Fiscal year.
- Fee head.
- Fee plan.
- Invoice.
- Payment.
- Receipt.
- Ledger.
- Journal entry.
- Attendance session and attendance record.
- Subject.
- Exam term.
- Marks and CAS.
- Report card.
- Homework.
- Timetable.
- Notice and message.
- File Registry entry.
- Book and copy.
- Route, trip, vehicle, driver.
- Canteen wallet, POS sale, inventory movement.
- Payroll run and payslip.
- Audit log.

All tenant-owned records must carry tenant ownership either directly or through a tenant-owned parent chain.

---

## 13. Error Handling Requirements

1. Duplicate payment submissions must return an existing safe result or deterministic duplicate error.
2. File upload/database save partial failures must be recoverable or clearly reported.
3. Export generation failure must not show success.
4. Provider-disabled mode must block dependent actions.
5. Offline sync conflicts must show user choices.
6. Expired sessions must not duplicate submissions after re-authentication.
7. Suspended tenants must receive consistent blocked responses.
8. Unauthorized parent/student access must fail closed without exposing whether another record exists.

---

## 14. Pilot Verification Requirements

Before controlled pilot, the following must pass or be explicitly waived:

- `pnpm db:generate`.
- `pnpm db:validate`.
- `pnpm verify:openapi`.
- `pnpm lint`.
- `pnpm typecheck`.
- `pnpm test`.
- `pnpm test:e2e`.
- `pnpm build`.
- `pnpm verify:production`.
- `pnpm smoke:phase1` with API, web, Postgres, and Redis running.

Browser routes that must load without fatal error:

- Platform dashboard.
- Tenant dashboard.
- Students.
- Attendance.
- Fees/finance.
- Academics.
- Accounting.
- Homework/timetable.
- HR/payroll.
- Library.
- Transport.
- Canteen.
- Notices/communication.
- Settings.

---

## 15. High-Risk Manual Verification Scenarios

1. School A cannot access School B students, files, reports, fees, or messages.
2. Parent can only view linked children.
3. Student QR revoke/rotate stops old QR from working.
4. Partial payment, overpayment, receipt reprint, refund, and reversal keep ledger/accounting correct.
5. Cashier close blocks unsafe reversal.
6. Attendance correction request works after lock window.
7. Offline attendance draft conflict is recoverable.
8. Marks lock, correction, report regeneration, and result publishing work.
9. Payroll approval, posting, payslip download, and reversal work.
10. Canteen POS sale cannot duplicate on double submit.
11. Library copy cannot be issued twice.
12. Transport stale GPS location is shown as stale, not live.
13. Notice attachment cannot be accessed by unauthorized parent.
14. Suspended tenant is blocked consistently.
15. Report exports are stored and downloaded through protected access.

---

## 16. Relationship to Other Documents

| Document | Purpose |
|---|---|
| PRD | Product direction, module scope, user needs, edge cases, acceptance criteria. |
| BRD | Business need, market, customer value, risks, success metrics. |
| SRS | System-level software behavior, constraints, NFRs, security, data, verification. |
| FRS | Detailed feature-level functions, flows, validation, states, acceptance criteria. |
| Technical Design | Architecture, APIs, database, queues, integrations, deployment. |
| Test Plan | Manual and automated validation strategy. |
