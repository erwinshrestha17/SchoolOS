# SchoolOS Product Requirements Document

**Product:** SchoolOS  
**Market:** Nepal-focused school management SaaS  
**Target schools:** Montessori to Class 10  
**Document type:** Product Requirements Document with edge cases and pilot-readiness checklist  
**Status:** Draft for controlled pilot hardening  
**Last updated:** 2026-05-28

---

## 1. Product Overview

SchoolOS is a production-grade, multi-tenant SaaS school management and financial operating system for Nepali schools. It is designed to support Montessori to Class 10 institutions through a modular platform covering admissions, student records, attendance, fees, receipts, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, and future school intelligence.

The product should first prioritize pilot reliability, financial correctness, tenant isolation, parent/student access boundaries, and operational stability before expanding into new modules or advanced AI/mobile workflows.

---

## 2. Problem Statement

Many schools in Nepal still operate through fragmented systems: paper registers, Excel sheets, WhatsApp/Viber groups, manual fee ledgers, offline accounting tools, and disconnected parent communication channels. This creates duplicate data entry, weak financial visibility, inconsistent student records, slow parent communication, and limited school-level analytics.

SchoolOS solves this by providing a single tenant-isolated system where each school can manage operations, academics, finance, communication, and compliance workflows in one place.

---

## 3. Product Vision

To become the default operating system for Nepali schools by offering a reliable, locally relevant, financially accurate, and easy-to-use SaaS platform that supports the full school lifecycle from admission to accounting and parent engagement.

---

## 4. Product Goals

### 4.1 Business Goals

1. Enable multiple schools to run independently on one SaaS platform.
2. Support controlled pilot deployment after staging verification.
3. Provide strong coverage for school operations, fees, accounting, academics, attendance, communication, and parent access.
4. Build trust through accurate receipts, ledgers, reports, and audit trails.
5. Prepare a foundation for future analytics, mobile expansion, provider integrations, and SaaS billing automation.

### 4.2 Product Goals

1. Centralize school data under secure tenant isolation.
2. Provide school administrators with one operational dashboard.
3. Allow teachers to manage attendance, homework, academics, and communication.
4. Allow parents to view child-specific notices, fees, receipts, attendance, homework, and progress.
5. Provide finance staff with double-entry accounting, fee ledgers, receipts, and reconciliation tools.
6. Keep platform administration separate from tenant/school operations.

### 4.3 Technical Goals

1. Keep the NestJS modular monolith as the primary architecture.
2. Use PostgreSQL/Prisma for persistence and Redis/BullMQ for cache and queues.
3. Maintain strict `tenantId` boundaries across all modules.
4. Avoid premature migration to microservices or Angular.
5. Continue using Next.js for the current dashboard and Flutter for the companion app.
6. Keep browser auth cookie-first and mobile/API access bearer-token compatible.

---

## 5. Target Users

| User | Needs |
|---|---|
| SchoolOS Platform Operator | Manage SaaS tenants, platform settings, support, feature access, provider readiness, billing records, and audit logs. |
| School Owner / Principal | View school health, finance, attendance, academics, staff, communication, and reports. |
| School Admin | Manage admissions, students, classes, settings, documents, notices, and daily operations. |
| Accountant / Finance Staff | Manage fees, receipts, refunds, reversals, accounting, ledgers, reports, and reconciliation. |
| Teacher | Mark attendance, assign homework, manage marks/CAS, view timetable, and communicate with parents. |
| Parent / Guardian | View linked child data, dues, receipts, notices, attendance, homework, progress, and future transport/canteen views. |
| Student | View own timetable, homework, notices, attendance, report cards, and library/canteen information. |
| Librarian | Manage books, copies, issues, returns, fines, and library reports. |
| Transport Staff / Driver | Manage routes, vehicles, trips, boarding/drop status, and future live-trip workflows. |
| Canteen Operator | Manage POS sales, wallets, meal plans, inventory, vendors, receipts, and reports. |
| HR / Payroll Staff | Manage staff records, leave, attendance, salary structures, payroll runs, payslips, and payroll posting. |

---

## 6. Product Planes

SchoolOS has three separate product planes:

| Plane | Audience | Purpose |
|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | Manage SaaS tenants, provider readiness, billing records, platform audit, usage, API keys, queues, and support actions. |
| Tenant Configuration Plane | Principal/admin | Configure one school's academic years, classes, fee settings, roles, school profile, logo, and module settings. |
| School Operations Plane | Staff, parents, students | Run daily workflows such as student management, attendance, fees, accounting, academics, library, transport, canteen, HR, and communication. |

Rules:

1. Do not mix SchoolOS SaaS billing with school fee collection.
2. Platform tenant override must be explicit, reason-required, and audited.
3. Tenant configuration should affect only the selected school.
4. School operations APIs must always be tenant scoped.

---

## 7. Core Modules and Requirements

## M0: Platform Core / SaaS Foundation

### Purpose

Provide the SaaS foundation for tenant management, platform administration, feature controls, provider readiness, queues, file registry, API keys, billing records, and support/audit workflows.

### Functional Requirements

- Multi-tenant architecture using `tenantId`.
- Platform tenant list, detail, status, suspend, and activate flows.
- Reason-required tenant suspend/activate behavior.
- Plans, features, tenant subscriptions, feature overrides, and usage counters.
- Platform API key management with one-time secrets, hashed storage, masked list responses, revoke flow, and audit records.
- Provider configuration masking and provider readiness checks.
- Queue health, failed job inspection, retry metadata, and audited retry actions.
- File Registry and report export history.
- Onboarding checklist and platform health summary.

### Edge Cases

- Suspended tenant attempts login, API access, mobile access, background jobs, file downloads, or report generation.
- Platform admin uses tenant override without a reason.
- Tenant override is active longer than intended.
- Disabled feature route is accessed directly by URL.
- API key is revoked while a request is in progress.
- Provider is configured incorrectly but the UI still allows a dependent action.
- Queue retry replays a job for an archived tenant.
- File Registry points to a missing object.
- SaaS billing record exists but tenant subscription status is inconsistent.

### Acceptance Criteria

- Every platform override action is audited.
- Suspended tenants are blocked consistently across dashboard, API, mobile, jobs, and downloads.
- Disabled provider mode never pretends to send real notifications, payments, or storage actions.
- API keys are stored hashed and only shown once during creation.
- File and queue failure screens show safe, non-secret error details.

---

## M1: Admissions and Student Profiles

### Purpose

Manage the full student lifecycle from admission to active, transferred, graduated, withdrawn, or archived states.

### Functional Requirements

- Student profile creation and editing.
- Guardian details and relationship management.
- Class, section, roll number, and academic year assignment.
- Student documents and photo uploads.
- Student identity and QR credential lifecycle.
- Duplicate candidate detection.
- iEMIS export support.
- Student search and lifecycle history.

### Edge Cases

- Same student entered twice with spelling differences.
- Same admission number created by two admins concurrently.
- Siblings share the same guardian phone.
- Student transfers class mid-year.
- Student leaves and later rejoins.
- Guardian is removed or changed after parent account access exists.
- Student photo upload succeeds but database save fails.
- Database save succeeds but file upload fails.
- Student QR is screenshotted, rotated, revoked, or expired.
- iEMIS export field does not exist in SchoolOS model.
- Same student name appears in two different schools.

### Acceptance Criteria

- Duplicate candidates are shown before risky merge actions.
- Parent access is immediately revoked when guardian linkage is removed.
- Student QR resolve must fail for revoked or rotated credentials.
- Student documents and photos must not expose raw storage keys.
- Student lifecycle changes must preserve historical attendance, fees, report cards, documents, and accounting links.

---

## M2: Smart Attendance

### Purpose

Digitize student attendance with correction requests, sync conflict handling, parent/student views, analytics, and export/report support.

### Functional Requirements

- Daily attendance sessions and records.
- Present, absent, late, leave, and correction states.
- Teacher-scoped marking.
- Attendance drafts and offline/reconnect recovery.
- Correction request and approval workflow.
- Attendance history, monthly analytics, and exports.
- Parent/student child-scoped access.

### Edge Cases

- Teacher marks the same class twice.
- Two teachers submit attendance for the same class/date.
- Attendance is submitted after the lock window.
- Offline draft conflicts with already-synced server data.
- Student joins class after attendance was already taken.
- Student transfers class mid-month.
- Half-day attendance is required by school policy.
- Attendance attempted on holiday, weekend, or exam-only day.
- Parent tries to view attendance for a child they do not own.
- Export generation fails after report entry is created.

### Acceptance Criteria

- Duplicate attendance submissions must be blocked or merged by deterministic conflict rules.
- Late edits must go through correction request workflow.
- Offline sync must show conflict choices instead of overwriting silently.
- Parent/student attendance APIs must fail closed to linked students only.
- Attendance exports must be tenant scoped and registered through File Registry where applicable.

---

## M3: Fees and Receipts

### Purpose

Manage fee setup, invoices, student ledgers, payments, receipts, refunds, reversals, cashier close, reconciliation, and finance reports.

### Functional Requirements

- Fee heads, fee plans, student assignments, invoices, invoice lines.
- Payment collection and receipt generation.
- Partial payments, dues, student ledgers, and reconciliation.
- Receipt PDF and reprint history.
- Refunds and reversals with permission and reason.
- Cashier close and day-end summary.
- Gateway readiness state.
- M9 accounting consistency.

### Edge Cases

- Parent pays partially against multiple invoice lines.
- Parent overpays.
- Cashier double-clicks payment submit.
- Same payment reference is submitted twice.
- Receipt PDF generation fails after payment is saved.
- Receipt is reprinted multiple times.
- Receipt reversal is attempted after cashier close.
- Already-reversed payment is reversed again.
- Refund is greater than original payment.
- Student changes class after invoice generation.
- Scholarship/discount is applied after invoice issue.
- Online payment webhook arrives twice or out of order.
- Gateway provider is disabled but UI attempts payment collection.
- Cashier close is submitted concurrently by two users.

### Acceptance Criteria

- Payment creation must be idempotent.
- Reversals require permission and reason.
- Closed cashier day reversals must be blocked or require explicit reopening policy.
- Receipt reprint must not create a new payment.
- Dues, student ledger, receipt, and accounting entries must remain consistent after partial payment, overpayment, refund, or reversal.
- Gateway-disabled mode must be clear in UI and must not collect fake payments.

---

## M4: Academics, Exams, CAS, and Report Cards

### Purpose

Manage subjects, exams, assessments, marks, CAS records, grading, report cards, result publishing, corrections, and promotion readiness.

### Functional Requirements

- Exam terms and assessment components.
- Subject and class setup.
- Marks entry and CAS entry.
- Marks lock/unlock workflow.
- Nepal grading/GPA preview.
- Report card generation and history.
- Correction and regeneration workflow.
- Result publishing and promotion readiness.
- Academic CSV/PDF exports.

### Edge Cases

- Teacher enters marks for unassigned subject or class.
- Marks are submitted after lock.
- Student was absent from exam.
- Retest or make-up exam is required.
- CAS record is incomplete.
- Grade rounding differs from school policy.
- Report card is regenerated after correction.
- Old report card version must remain available.
- Student has unpaid dues and school wants to hold result.
- Promotion decision differs from automatic result calculation.
- Report card file generation succeeds but storage registration fails.

### Acceptance Criteria

- Locked marks cannot be changed without correction/unlock workflow.
- Report-card regeneration must preserve version history.
- Result publication must be explicit and auditable.
- Promotion readiness must show incomplete, failed, withheld, and ready states clearly.
- Generated report files must be tenant scoped and retrievable only by authorized users.

---

## M5: Activity Feed and Milestones

### Purpose

Provide a safe school/class/student activity feed, developmental milestones, mood logs, attachments, reactions, parent views, and moderation lifecycle.

### Functional Requirements

- Activity posts with targeting.
- Student tags and class visibility.
- Media attachments with private access.
- Draft, approve, reject, archive, and remove lifecycle.
- Reactions and detail view.
- Developmental milestones and mood logs.
- Parent child-scoped activity feed.
- Media privacy and consent handling.

### Edge Cases

- Teacher posts media for the wrong class.
- Parent lacks photo/media consent.
- Activity media URL is shared externally.
- Post is approved, then student is removed from class.
- Post is archived after notification was sent.
- Attachment upload succeeds but post creation fails.
- Parent tries to access another child’s tagged media.
- Moderated/removed content still appears in cached feed.
- Low-bandwidth image loading fails.

### Acceptance Criteria

- Parent feed must show only approved child-scoped content.
- Missing consent must hide media safely.
- Media must not expose public URLs, raw storage keys, or internal file IDs.
- Removed or archived posts must disappear from feed and detail views.
- Moderation actions must be audited.

---

## M6: Homework and Timetable

### Purpose

Manage homework assignment lifecycle, submissions, reminders, reviews, timetable versions, conflict validation, teacher workload, substitutions, and parent/student views.

### Functional Requirements

- Homework creation, assignment, due dates, attachments, submissions, reviews, and correction requests.
- Homework reminders and reports.
- Timetable periods, rooms, versions, slots, publish/lock/archive/reopen.
- Teacher availability, workload limits, subject weekly requirements, and substitutions.
- Parent/student homework and timetable read views.

### Edge Cases

- Homework due date is before publish date.
- Homework is deleted after reminder job is queued.
- Attachment is too large, wrong type, or missing.
- Student submits after deadline.
- Parent views homework for wrong child.
- Teacher is assigned to two classes at the same time.
- Room is assigned to multiple classes at the same time.
- Teacher is on leave but still assigned in timetable.
- Published timetable is edited without versioning.
- Substitute teacher does not have subject/class permission.

### Acceptance Criteria

- Homework reminders must re-check current assignment status before sending.
- Homework attachments must be private and tenant scoped.
- Timetable publish must block teacher, room, workload, and absence conflicts.
- Published timetable edits must create or preserve version history.
- Parent/student reads must fail closed to authorized linked students.

---

## M7: HR and Payroll

### Purpose

Manage staff records, contracts, documents, attendance, leave, salary structures, payroll runs, payslips, approval, accounting posting, and staff self-service.

### Functional Requirements

- Staff profile and lifecycle management.
- Staff documents and sensitive field masking.
- HR attendance and leave management.
- Salary structures, payroll runs, payroll lines, and payslips.
- Payroll approval, posting, and reversal.
- Payroll reports, PDF payslips, PF/TDS/component/leave summaries.
- Staff self-service access.

### Edge Cases

- Staff joins mid-month.
- Staff leaves mid-month.
- Leave without pay affects payroll.
- Salary structure changes after payroll draft is created.
- Payroll is approved and then staff data changes.
- Payroll is posted twice.
- Payroll reversal does not reverse accounting.
- Unauthorized user views salary or bank details.
- Staff document access crosses tenant or role boundary.
- Duplicate payroll run is created for same period.

### Acceptance Criteria

- Approved payroll must be locked from unsafe edits.
- Payroll posting must be idempotent.
- Payroll reversal must update accounting through an approved reversal path.
- Sensitive fields must be masked unless the user has permission.
- Staff self-service must expose only the authenticated staff member’s own allowed data.

---

## M8A: Library Management

### Purpose

Manage books, copies, issue/return, overdue, fines, borrower history, QR lookup, reports, and future fine-to-fees/payment integration.

### Functional Requirements

- Book and copy catalog.
- Issue, return, lost, damaged, and overdue workflows.
- Fine settings and calculation.
- Student/staff borrower support.
- QR borrower lookup using student identity.
- Book/copy history and reports.
- CSV exports.

### Edge Cases

- Same physical copy is issued twice.
- Book copy is lost or damaged while issued.
- Student leaves school with borrowed book.
- Overdue fine calculation crosses holidays or weekends.
- Staff borrower follows different rules from student borrower.
- QR resolves to revoked student credential.
- Library fine posts twice to fees.
- Fine is paid in fees but library status does not update.
- Borrower belongs to a different tenant.

### Acceptance Criteria

- One copy cannot be actively issued to multiple borrowers.
- Lost/damaged status must preserve issue history.
- Fine posting to fees must be idempotent.
- QR lookup must be tenant scoped and respect revoked credentials.
- Borrower history must remain visible after return, loss, or student lifecycle change.

---

## M8B: Transport Management

### Purpose

Manage routes, stops, vehicles, drivers, student assignments, trips, boarding/drop statuses, location ingestion, reports, and future live map/driver/parent workflows.

### Functional Requirements

- Routes, stops, vehicles, drivers, and assignments.
- Trip lifecycle and boarded/dropped/absent statuses.
- Latest trip location and location logs.
- GPS ingestion validation.
- Redis latest-location cache and throttled database persistence.
- Tenant/trip-scoped location fanout.
- Parent active-trip endpoint.
- Trip and boarding reports.

### Edge Cases

- Student is assigned to two active routes accidentally.
- Different morning and evening routes are required.
- Driver marks wrong student boarded.
- GPS device sends too many updates.
- GPS stops updating mid-trip.
- Parent sees stale location as if it is live.
- Bus route changes for one day only.
- Student is absent but route assignment exists.
- Parent tries to track a non-linked child.
- Live map is disabled but route is still accessible.
- Vehicle/driver is assigned to overlapping trips.

### Acceptance Criteria

- Location UI must show stale-location state when data is old.
- GPS ingestion must throttle high-frequency updates.
- Parent active-trip access must be child scoped.
- Trip status must distinguish boarded, dropped, absent, not-boarded, delayed, and completed states.
- Live map and driver app routes must remain hidden/disabled until product-approved.

---

## M8C: Canteen Management

### Purpose

Manage menu items, meal plans, serving, student wallets, POS sales, spending controls, receipts, suppliers, inventory, purchase bills, wastage, stock ledger, reports, and parent spending visibility.

### Functional Requirements

- Menu item and meal plan management.
- Meal plan enrollments and serving.
- Student wallet top-up, history, correction, and reversal.
- POS sales and receipt JSON/PDF.
- Spending controls and low-balance reports.
- Supplier and inventory item management.
- Purchase bills, stock movement, wastage, stock ledger.
- Sales, spending, meal count, low-balance, and stock reports.
- QR resolve for canteen serving.

### Edge Cases

- Student wallet has insufficient balance.
- POS sale is submitted twice.
- Meal plan overlaps with existing active plan.
- Meal plan is cancelled after M3 invoice is issued.
- Wallet reversal would create negative balance.
- Inventory stock goes negative.
- Wastage entry is created after stock close.
- Student QR is revoked but used at canteen.
- Parent daily/monthly spending control is exceeded.
- Receipt reprint creates duplicate transaction.
- Supplier purchase bill is edited after stock movement.

### Acceptance Criteria

- Wallet balance must never go negative unless an explicit school policy enables overdraft.
- POS sales must be idempotent.
- Active overlapping meal plans must be blocked.
- Meal plan cancellation must follow a clear invoice/credit/void policy.
- QR serving must reject revoked credentials.
- Receipt reprint must not create a new POS transaction.

---

## M9: Accounting and Finance

### Purpose

Provide double-entry accounting, chart of accounts, fiscal years, journals, ledgers, vouchers, reconciliation, financial reports, snapshots, audit logs, and source-based posting from school modules.

### Functional Requirements

- Chart of accounts.
- Fiscal years and periods.
- Journal entries and vouchers.
- Double-entry enforcement.
- Decimal-safe posting.
- Immutable posted journals.
- Source-based idempotent posting.
- Reversal/correction workflow.
- Fiscal close/reopen.
- Trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS/PF summaries.
- CSV/PDF exports and report snapshots.
- Bank reconciliation and auto-match suggestions.
- Accounting audit log viewer.

### Edge Cases

- Unbalanced journal is submitted.
- Decimal precision causes one-paisa mismatch.
- Backdated transaction is attempted in closed fiscal period.
- Posted journal is edited directly.
- Fee receipt reversal does not reverse accounting.
- Payroll posts twice.
- Canteen, library, or transport source maps to wrong account.
- Default chart of accounts is missing for a tenant.
- Large ledger export times out.
- Bank reconciliation auto-match suggests wrong transaction.
- Fiscal year is reopened after reports were already exported.

### Acceptance Criteria

- Unbalanced journals must never post.
- Posted journals must be immutable.
- Corrections must use reversal/correction entries.
- Source-based posting must be idempotent.
- Closed-period posting must be blocked unless fiscal reopen policy permits it.
- Large reports should use background export when needed.
- Default chart of accounts and report mappings must be verified before pilot.

---

## M10: Notices, Communication, and Messaging

### Purpose

Centralize notices, events, consent, communication preferences, notification delivery, read tracking, parent-teacher messaging, attachments, retries, failure dashboards, and moderation foundations.

### Functional Requirements

- School-wide, class-specific, and targeted notices.
- Event and consent template support.
- Guardian consent and communication preferences.
- Notification center, delivery records, retry/read tracking, unread recipients.
- Provider modes: dev-log, disabled, configured-provider.
- Delivery failure dashboard and retry metadata.
- File Registry-backed notice/chat attachments.
- Parent-teacher thread/message foundation.
- Chat availability, escalation, and abuse report foundation.

### Edge Cases

- Notice sent to wrong class or wrong recipient group.
- Admin sends notice before previewing recipients.
- Parent removed from student but still has old message link.
- Attachment URL is shared externally.
- Provider is disabled but UI shows delivered state.
- Provider callback is duplicated or forged.
- Message delivery fails but read status is shown.
- Abuse report is submitted against teacher/parent.
- Retention policy deletes old messages but audit requirement remains.
- Unread recipient list includes removed guardians.

### Acceptance Criteria

- Recipient preview must be available before high-impact notices.
- Parent/guardian message access must be child scoped.
- Attachments must use protected access and never expose raw storage keys.
- Provider mode must be explicit in UI and admin diagnostics.
- Delivery retry must not duplicate messages.
- Abuse, escalation, and moderation actions must be auditable.

---

## M11: School Intelligence and Analytics

### Purpose

Provide future analytics and intelligence after reliable production data exists.

### Functional Requirements

- Student performance trends.
- Attendance risk indicators.
- Fee collection analytics.
- Staff and class-level insights.
- Parent engagement analytics.
- Predictive analytics in later phases only.

### Edge Cases

- Analytics uses incomplete pilot data.
- AI insight exposes sensitive student/staff data.
- Prediction is treated as final decision.
- Cross-tenant aggregation leaks tenant identity.
- Financial analytics disagree with accounting reports.

### Acceptance Criteria

- Do not implement AI/intelligence until reliable production data exists.
- Analytics must be explainable and tenant scoped.
- Financial analytics must reconcile with accounting source of truth.
- Sensitive insights must be permission-gated.

---

## 8. Cross-Cutting Edge Case Requirements

These requirements apply across all modules.

### 8.1 Tenant Isolation

- Every database query, file access, queue job, export, and report must be tenant scoped.
- Same names, phone numbers, admission numbers, class names, or receipt numbers across schools must never cause data leakage.
- Platform override must require explicit reason and audit trail.

### 8.2 Parent and Student Access

- Parents can only access linked children.
- Students can only access their own records.
- Guardian removal must revoke access immediately.
- Shared links must not bypass ownership checks.

### 8.3 File Privacy

- Student photos, documents, receipts, report cards, payslips, notices, chat attachments, activity media, and exports must use protected access.
- Raw storage keys, public object URLs, and internal file IDs must not be exposed to unauthorized clients.
- Signed URLs must be short lived.

### 8.4 Money and Accounting

- All payment, refund, reversal, payroll, canteen, library fine, and accounting posting flows must be idempotent.
- Posted accounting records must be immutable.
- Every reversal must have a reason, permission check, and audit trail.
- Financial reports must reconcile with source ledgers.

### 8.5 Offline, Slow Network, and Recovery

- Long forms should preserve drafts where practical.
- Expired sessions should recover safely without duplicate submission.
- Offline or reconnect sync must show conflicts instead of overwriting silently.
- Low-bandwidth media should fail gracefully.

### 8.6 Background Jobs

- Jobs must re-check tenant status, feature status, entity status, and permissions before executing.
- Retried jobs must not duplicate messages, payments, reports, or postings.
- Failed jobs must expose safe diagnostics without secrets.

### 8.7 PDFs and Exports

- Receipt, ID card, report card, payroll, accounting, attendance, fee, library, transport, and canteen exports must be tenant scoped.
- Export failure must not create false success states.
- Re-generated PDFs should maintain history where legally or operationally required.

### 8.8 Audit Logs

Audit logs are required for:

- Tenant override.
- Suspend/activate tenant.
- Payment reversal/refund.
- Accounting posting/reversal/fiscal reopen.
- Marks unlock/correction/report regeneration.
- Payroll approval/post/reversal.
- Student guardian changes.
- QR generate/rotate/revoke.
- File preview/download for sensitive documents.
- Notice moderation/removal.
- Queue retry for sensitive jobs.

---

## 9. Pilot Readiness Checklist

SchoolOS is ready for controlled pilot only when the following are true:

### 9.1 Backend Verification

- `pnpm db:generate` passes.
- `pnpm db:validate` passes.
- `pnpm verify:openapi` passes.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm test:e2e` passes or known blockers are explicitly documented and waived.
- `pnpm build` passes.
- `pnpm verify:production` passes.
- `pnpm smoke:phase1` passes with API, web, Postgres, and Redis running.

### 9.2 Browser and Dashboard Verification

The following routes must load without fatal error using seeded credentials:

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

### 9.3 High-Risk Pilot Scenarios

Before pilot, manually verify:

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
15. Report exports are stored and downloaded through protected file access.

---

## 10. Non-Functional Requirements

### 10.1 Security

- Cookie-first browser authentication.
- Bearer-token support for mobile/API clients.
- RBAC and tenant isolation.
- Reason-required platform override.
- No raw browser token storage.
- Protected file access.
- Secret masking in provider, queue, and diagnostic views.

### 10.2 Reliability

- Controlled pilot should not depend on fake provider behavior.
- Critical workflows must show safe failure states.
- Background jobs must be retry-safe.
- Reports and PDFs must be verifiable.

### 10.3 Performance

- Dashboard routes should load acceptably on typical school-office internet.
- Reports should support filters and background export when large.
- GPS/location ingestion must be throttled.
- Media handling should consider low-bandwidth Nepal usage.

### 10.4 Compliance and Local Fit

- Support Nepal school workflows.
- Support double-entry accounting.
- Support VAT/TDS/PF reporting where applicable.
- Validate iEMIS exports against real templates before claiming final compliance.
- Consider Nepali names, mixed scripts, guardian phone reuse, and fiscal-year requirements.

---

## 11. MVP and Release Scope

### 11.1 Controlled Pilot MVP

The controlled pilot should include:

1. Multi-tenant login and RBAC.
2. Student profiles and guardian linkage.
3. Attendance with correction workflow.
4. Fees, receipts, refunds/reversals, cashier close, and ledgers.
5. Accounting core and financial reports.
6. Notices and read/delivery tracking.
7. Academics, marks, CAS, report cards, and result publishing.
8. Homework/timetable pilot-ready flows.
9. HR/payroll pilot-ready flows.
10. Library, transport, and canteen admin foundations.
11. Protected file registry and report export flows.
12. Browser smoke coverage and staging verification.

### 11.2 Explicitly Out of Scope for Immediate Pilot

- Deep parent/mobile module expansion beyond the current companion app foundation.
- Driver live-trip workflow beyond the current shell.
- Live transport map/WebSocket/SSE UI.
- AI/ML features.
- Angular migration.
- Microservices.
- Biometric workflows.
- Unapproved payment provider collection.

---

## 12. Success Metrics

### 12.1 Pilot Success Metrics

| Metric | Target |
|---|---:|
| Successful pilot schools onboarded | 1-3 |
| Critical P0 workflow blockers | 0 |
| Tenant isolation incidents | 0 |
| Fee receipt/accounting mismatch | 0 |
| Attendance marking completion | 95%+ class days |
| Parent notice read rate | 70%+ |
| Staging verification pass rate | 100% or explicitly waived |
| Dashboard fatal route errors | 0 for pilot modules |

### 12.2 Product Success Metrics

| Metric | Target |
|---|---:|
| Monthly active schools | 80%+ onboarded schools |
| Fee collections recorded through SchoolOS | 80%+ |
| Parent/guardian activation | 50%+ linked guardians |
| Support tickets per school | Decreasing month over month |
| Admin workflow time saved | 30%+ |
| Report/export success rate | 99%+ |

---

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tenant isolation bug | Severe data breach | Add tenant tests, fail-closed access, platform override audit. |
| Financial inconsistency | Loss of trust | Idempotency, double-entry enforcement, reconciliation tests, reversal audit. |
| Too many modules expanded at once | Instability | Follow phase gates and harden one vertical at a time. |
| Weak browser smoke coverage | Pilot failure | Run seeded Playwright/browser smoke before pilot. |
| Provider misconfiguration | Failed notifications/storage/payments | Provider readiness checks and disabled-mode UI. |
| File privacy leak | Sensitive data exposure | Protected file access, short-lived URLs, no raw storage keys. |
| Offline/slow network duplicate submission | Duplicate payments/attendance/homework | Idempotency keys, drafts, conflict recovery. |
| Unvalidated Nepal-specific exports | Compliance issue | Validate iEMIS and finance mappings with real templates/data. |
| Premature AI/mobile/microservices | Delay and complexity | Keep deferred until pilot core is stable. |

---

## 14. Final Product Direction

SchoolOS should not expand broadly until the current product surface is trustworthy. The immediate direction is:

1. Complete Phase Gate 0 verification.
2. Stabilize tenant isolation, authentication, permissions, files, queues, and reports.
3. Harden fees/accounting, attendance, academics, and parent access.
4. Verify PDFs and exports in staging.
5. Run controlled pilot with real school data.
6. Deepen Library, Transport, Canteen, HR, Homework, and Communication one vertical at a time.
7. Defer AI, deep mobile expansion, live transport map, biometric workflows, Angular migration, and microservices until explicitly approved.
