# SchoolOS Functional Requirements Specification 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school management SaaS  
**Target schools:** Montessori to Class 10 first, with future K-12/+2 extensibility  
**Document type:** Functional Requirements Specification  
**Status:** Draft derived from `docs/product/SCHOOLOS_PRD_COMBINED_MASTER_2026.md`  
**Last updated:** 2026-06-03

---

## 1. Purpose

This FRS breaks SchoolOS into feature-level functional behavior. It describes what each module must allow users to do, what validations must happen, what states must be supported, and what acceptance criteria must be satisfied.

The PRD remains the product master document. The SRS defines system-level requirements. This FRS is meant for developers, QA, designers, and implementation agents who need detailed feature behavior.

---

## 2. Functional Requirement Format

Each module follows this structure:

1. Purpose.
2. Primary actors.
3. Core functions.
4. Key states.
5. Validation rules.
6. Edge cases.
7. Acceptance criteria.

---

## 3. Global Functional Rules

These rules apply to every module:

1. Every tenant-owned action must be scoped to the authenticated tenant.
2. Parent users can only access linked child records.
3. Student users can only access their own allowed records.
4. Staff users can only perform actions allowed by role and permission.
5. Platform override must require reason and audit.
6. Sensitive files must be accessed only through protected File Registry flows.
7. Money-related actions must be idempotent.
8. Reversals must require permission, reason, and audit.
9. Background jobs must re-check tenant, feature, entity, and permission state before executing.
10. Disabled/mock provider modes must be explicit in the UI.

---

## 4. M0 Platform Core / SaaS Foundation

### 4.1 Purpose

Manage tenants, platform administration, feature controls, provider readiness, queues, File Registry, API keys, SaaS billing records, support override, onboarding, and audit workflows.

### 4.2 Primary actors

- SchoolOS Platform Operator.
- Platform Admin.
- Support Operator.

### 4.3 Core functions

1. View tenant list.
2. View tenant detail.
3. Suspend tenant with reason.
4. Activate tenant with reason.
5. Manage plans and feature flags.
6. Manage tenant subscriptions and feature overrides.
7. View usage counters.
8. Create platform API key.
9. Display API key secret only once.
10. List masked API keys.
11. Revoke API key.
12. Configure provider settings with secret masking.
13. Run provider readiness checks.
14. View queue health.
15. Inspect failed jobs.
16. Retry failed jobs with audit.
17. View File Registry entries and report export history.
18. Use support tenant override with reason and expiry/time-bound behavior where possible.
19. View platform audit logs.
20. View onboarding checklist and platform health summary.

### 4.4 Key states

- Tenant: active, suspended, archived.
- Feature: enabled, disabled, overridden.
- Provider: disabled, dev-log, mock, configured, misconfigured.
- API key: active, revoked.
- Queue job: waiting, active, completed, failed, retried.
- File registry entry: available, missing, failed, archived.

### 4.5 Validation rules

1. Tenant suspend/activate requires reason.
2. Support override requires explicit tenant and reason.
3. API key secret must never be shown after creation.
4. Provider secret values must be masked.
5. Queue retry must be blocked for archived tenant or disabled feature.
6. Disabled feature routes must fail closed.

### 4.6 Acceptance criteria

1. Every platform override action is audited.
2. Suspended tenants are blocked across dashboard, API, mobile, jobs, downloads, and reports.
3. Disabled provider mode never pretends to send real notifications, payments, or storage actions.
4. API keys are stored hashed and only shown once during creation.
5. File and queue failure screens show safe, non-secret diagnostics.

### 4.7 Future Enhancement Direction

Unique angle: SchoolOS Pilot Readiness Console — a platform operator can see exactly why a school is or is not ready to go live.

Planned enhancements: guided onboarding wizard, tenant readiness score, provider health center, queue mission control, tenant sandbox mode, data import center, tenant change log, feature usage analytics, and tenant exit/export package. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 5. M1 Admissions and Student Profiles

### 5.1 Purpose

Manage student lifecycle from inquiry/admission to active, transferred, withdrawn, graduated, or archived.

### 5.2 Primary actors

- School Admin.
- Principal.
- Teacher with limited access.
- Parent/Guardian with child-scoped access.

### 5.3 Core functions

1. Create inquiry/application.
2. Convert application to student admission.
3. Create student profile.
4. Edit student profile.
5. Manage guardian details and relationships.
6. Assign class, section, roll number, and academic year.
7. Upload student photo and documents.
8. Generate student QR credential.
9. Rotate/revoke student QR credential.
10. Detect duplicate student candidates.
11. Search students.
12. View student lifecycle history.
13. Maintain IEMIS/export readiness fields.
14. Transfer, withdraw, graduate, archive, or reactivate according to policy.

### 5.4 Key states

- Student lifecycle: applicant, active, transferred, withdrawn, graduated, archived.
- QR credential: active, rotated, revoked, expired.
- Document: uploaded, linked, failed, archived.
- Guardian link: active, removed, replaced.

### 5.5 Validation rules

1. Admission number must be unique within tenant where policy requires.
2. Same admission number cannot be created concurrently.
3. Duplicate candidates must be shown before risky merge actions.
4. Parent access must be revoked immediately when guardian linkage is removed.
5. QR resolve must fail for revoked, rotated, or expired credentials.
6. Student lifecycle change must preserve historical attendance, fees, report cards, files, and accounting links.
7. Same student name in another tenant must not affect local student search or merge.

### 5.6 Acceptance criteria

1. Student creation and editing are tenant-scoped.
2. Guardian removal immediately blocks parent access.
3. Student documents/photos do not expose raw storage keys.
4. QR lifecycle works with generate, rotate, revoke, and fail-closed resolve.
5. Historical records remain available after transfer, withdrawal, graduation, or archive.

### 5.7 Future Enhancement Direction

Unique angle: Family 360, not just Student 360. Nepal schools deal with siblings, guardians, fee negotiations, transport, and documents together.

Planned enhancements: admission funnel board, Nepali-name duplicate engine, sibling intelligence, guardian trust profile, parent pickup pass, medical safety card, student risk-free flagging, and alumni registry. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 6. M2 Smart Attendance

### 6.1 Purpose

Digitize student attendance with teacher-scoped marking, correction requests, offline/reconnect recovery, analytics, exports, and parent/student views.

### 6.2 Primary actors

- Teacher.
- Class Teacher.
- School Admin.
- Principal.
- Parent/Guardian.
- Student.

### 6.3 Core functions

1. Create daily attendance session.
2. Mark present, absent, late, leave, correction, and half-day states where enabled.
3. Save attendance draft.
4. Submit attendance.
5. Detect duplicate attendance session.
6. Handle offline draft sync.
7. Show conflict when offline draft conflicts with server state.
8. Submit correction request after lock window.
9. Approve/reject correction request.
10. View attendance history.
11. Generate monthly analytics.
12. Export attendance reports.
13. Show parent/student child-scoped attendance view.

### 6.4 Key states

- Session: draft, submitted, locked, correction_requested, corrected.
- Record: present, absent, late, leave, half_day, corrected.
- Sync: local_draft, synced, conflict.

### 6.5 Validation rules

1. Teacher can mark only assigned class/section unless permission allows.
2. Duplicate submissions must be blocked or merged by deterministic rules.
3. Late edits after lock must use correction workflow.
4. Attendance on holiday/weekend/exam-only day must follow school policy.
5. Parent/student access must fail closed to linked/own student only.
6. Export generation failure must not create success state.

### 6.6 Acceptance criteria

1. Duplicate attendance submissions do not overwrite silently.
2. Offline conflicts show choices instead of silently replacing data.
3. Correction workflow preserves audit history.
4. Attendance exports are tenant-scoped and registered through File Registry where retained.

### 6.7 Future Enhancement Direction

Unique angle: Poor-connectivity-first attendance. Make offline sync and conflict clarity a major selling point.

Planned enhancements: attendance command board, parent absence confirmation, leave pre-approval, exam-day attendance mode, late arrival register, class attendance heatmap, attendance correction SLA, and substitute teacher attendance authority. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 7. M3 Fees and Receipts

### 7.1 Purpose

Manage fee setup, invoices, student ledgers, payments, receipts, refunds, reversals, cashier close, reconciliation, gateway readiness, and accounting consistency.

### 7.2 Primary actors

- Cashier.
- Accountant / Finance Staff.
- Principal.
- Parent/Guardian for child-scoped view and future payment flows.

### 7.3 Core functions

1. Create fee heads.
2. Create fee plans.
3. Assign fee plans to students/classes.
4. Generate invoices and invoice lines.
5. Search student dues.
6. Collect full payment.
7. Collect partial payment.
8. Handle overpayment according to policy.
9. Generate receipt.
10. Generate receipt PDF.
11. Reprint receipt without creating new payment.
12. Reverse receipt/payment with permission and reason.
13. Refund payment with permission and reason.
14. Close cashier day.
15. Reconcile collection summary.
16. Show student ledger.
17. Handle payment gateway intent and verification.
18. Handle duplicate/out-of-order webhooks.
19. Post accounting entries through M9.

### 7.4 Key states

- Invoice: draft, issued, partially_paid, paid, voided, adjusted.
- Payment: initiated, pending, verified, receipted, failed, canceled, expired, reversed, refunded.
- Receipt: active, reprinted, reversed.
- Cashier day: open, closed, reopened_by_policy.

### 7.5 Validation rules

1. Payment creation must be idempotent.
2. Same payment reference must not create duplicate receipt.
3. Cashier double-click must not create duplicate payment.
4. Receipt PDF failure after payment save must be recoverable.
5. Receipt reprint must not create a new payment.
6. Reversal after cashier close must be blocked or require explicit reopening policy.
7. Already-reversed payment cannot be reversed again.
8. Refund cannot exceed original payment unless explicit policy permits.
9. Gateway-disabled mode must block fake real-payment collection.
10. Online webhook duplicates/out-of-order events must not duplicate payment or receipt.
11. Ledger, dues, receipt, and accounting must remain consistent.

### 7.6 Acceptance criteria

1. Partial payment, overpayment, refund, and reversal preserve ledger/accounting correctness.
2. Reversals require permission, reason, and audit.
3. Cashier close detects variance between expected and actual collection.
4. Receipt reprint is history-tracked and non-duplicating.
5. Gateway readiness state is visible and honest.

### 7.7 Future Enhancement Direction

Unique angle: Nepal-first fee operations — cash, QR wallet, bank transfer, manual references, partial payments, scholarship, and audit-safe receipts.

Planned enhancements: fee negotiation plans, discount rule engine, fee hold policy, overpayment wallet, installment plans, defaulter segmentation, smart reminders, payment provider fallback, fee dispute workflow, and bank statement matching. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 8. M4 Academics, Exams, CAS, and Report Cards

### 8.1 Purpose

Manage subjects, exams, assessments, marks, CAS, grading, report cards, result publishing, corrections, and promotion readiness.

### 8.2 Primary actors

- Teacher.
- Academic Coordinator.
- School Admin.
- Principal.
- Parent/Guardian.
- Student.

### 8.3 Core functions

1. Configure subjects.
2. Configure exam terms.
3. Configure assessment components.
4. Assign teachers to subjects/classes.
5. Enter marks.
6. Enter CAS records.
7. Lock marks.
8. Request marks unlock/correction.
9. Approve marks correction.
10. Preview Nepal grading/GPA.
11. Generate report card.
12. Regenerate report card after correction.
13. Preserve report-card version history.
14. Publish results.
15. Withhold result according to school policy.
16. Determine promotion readiness.
17. Export academic CSV/PDF reports.

### 8.4 Key states

- Marks: draft, submitted, locked, correction_requested, corrected.
- Report card: generated, published, regenerated, archived.
- Result: unpublished, published, withheld.
- Promotion: incomplete, failed, withheld, ready, promoted.

### 8.5 Validation rules

1. Teacher cannot enter marks for unassigned subject/class.
2. Locked marks cannot change without workflow.
3. Absent, retest, make-up, and incomplete CAS must be represented clearly.
4. Grade rounding must follow tenant policy.
5. Report-card regeneration must preserve old version.
6. Result publication must be explicit and auditable.
7. Generated report files must be tenant-scoped and authorized.

### 8.6 Acceptance criteria

1. Marks lock/unlock workflow works with audit.
2. Report-card version history is preserved.
3. Promotion readiness clearly shows incomplete, failed, withheld, and ready states.
4. Parent/student see only authorized published results.

### 8.7 Future Enhancement Direction

Unique angle: Promotion readiness + result publishing governance. Manage the approval and hold workflow, not just report card generation.

Planned enhancements: marks grid spreadsheet UX, assessment blueprint, CAS rubric builder, report card designer, result publish checklist, result hold manager, promotion board, result analytics, academic timeline, and intervention plans. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 9. M5 Activity Feed and Milestones

### 9.1 Purpose

Provide safe school/class/student activity feed, media, milestones, mood logs, reactions, parent views, and moderation lifecycle.

### 9.2 Primary actors

- Teacher.
- School Admin.
- Principal.
- Parent/Guardian.

### 9.3 Core functions

1. Create activity post.
2. Target school, class, section, or student group.
3. Tag students.
4. Upload media attachment.
5. Save draft.
6. Submit for approval.
7. Approve/reject/archive/remove post.
8. View detail.
9. React to post where enabled.
10. Manage developmental milestones.
11. Manage mood logs.
12. Show parent child-scoped feed.
13. Apply media consent rules.

### 9.4 Key states

- Post: draft, pending_approval, approved, rejected, archived, removed.
- Media: uploaded, hidden_by_consent, unavailable, removed.

### 9.5 Validation rules

1. Parent feed shows only approved child-scoped content.
2. Missing consent hides media safely.
3. Archived/removed content must disappear from feed and detail views.
4. Media must not expose raw storage keys, public URLs, or unsafe internal IDs.
5. Parent cannot access another child’s tagged media.
6. Moderation actions must be audited.

### 9.6 Acceptance criteria

1. Wrong-class media does not leak to unauthorized parents.
2. Removed content does not appear from cache.
3. Media access is private and tenant-scoped.

### 9.7 Future Enhancement Direction

Unique angle: Consent-safe private parent engagement. Critical for school trust.

Planned enhancements: student tagging confidence, consent-aware media hiding, mood/wellbeing logs, parent engagement analytics, activity albums, private student notes, birthday/achievement templates, parent comment controls, and activity-to-profile linking. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 10. M6 Homework and Timetable

### 10.1 Purpose

Manage homework lifecycle, submissions, reminders, reviews, correction requests, timetable versions, conflict validation, substitutions, and parent/student views.

### 10.2 Primary actors

- Teacher.
- School Admin.
- Academic Coordinator.
- Parent/Guardian.
- Student.

### 10.3 Core functions

1. Create homework.
2. Assign homework to class/section/student group.
3. Add due date and attachments.
4. Publish homework.
5. Send reminder.
6. Accept student submission.
7. Review submission.
8. Request correction.
9. Generate homework reports.
10. Create timetable periods, rooms, versions, and slots.
11. Validate teacher conflicts.
12. Validate room conflicts.
13. Validate teacher workload and leave.
14. Publish timetable.
15. Lock/archive/reopen timetable.
16. Manage substitutions.
17. Show parent/student homework and timetable reads.

### 10.4 Key states

- Homework: draft, published, closed, archived.
- Submission: not_submitted, submitted, late, reviewed, correction_requested.
- Timetable: draft, published, locked, archived, reopened.

### 10.5 Validation rules

1. Homework due date cannot be before publish date.
2. Reminder jobs must re-check current assignment status before sending.
3. Attachments must be private, valid type, and tenant-scoped.
4. Published timetable edits must preserve version history.
5. Timetable publish must block teacher, room, workload, and absence conflicts.
6. Substitute teacher must have required permission/class/subject access.
7. Parent/student reads must fail closed.

### 10.6 Acceptance criteria

1. Timetable cannot publish with unresolved conflicts.
2. Homework deleted after queued reminder does not send stale reminder.
3. Parent/student can see only authorized homework/timetable data.

### 10.7 Future Enhancement Direction

Unique angle: Academic operations scheduler — homework, timetable, exams, leave, and substitutions working together.

Planned enhancements: homework template library, student submission states, homework load calendar, timetable version compare, teacher availability matrix, room/resource booking, substitution auto-suggest, and event/exam timetable integration. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 11. M7 HR and Payroll

### 11.1 Purpose

Manage staff records, contracts, documents, leave, attendance, salary structures, payroll runs, payslips, approvals, accounting posting, and staff self-service.

### 11.2 Primary actors

- HR / Payroll Staff.
- Principal.
- Accountant.
- Staff self-service user.

### 11.3 Core functions

1. Create staff profile.
2. Manage staff lifecycle.
3. Upload staff documents.
4. Mask sensitive staff fields.
5. Manage staff attendance.
6. Manage leave.
7. Create salary structure.
8. Create payroll run.
9. Calculate payroll lines.
10. Approve payroll.
11. Generate payslips.
12. Post payroll to accounting.
13. Reverse payroll through approved reversal path.
14. Generate payroll reports.
15. Provide staff self-service access.

### 11.4 Key states

- Staff: active, on_leave, resigned, terminated, archived.
- Payroll: draft, calculated, approved, posted, reversed.
- Payslip: generated, published, downloaded.

### 11.5 Validation rules

1. Duplicate payroll run for same period must be blocked.
2. Staff join/leave mid-month must affect calculation.
3. Leave without pay must affect payroll.
4. Approved payroll must be locked from unsafe edits.
5. Payroll posting must be idempotent.
6. Payroll reversal must reverse accounting through approved path.
7. Unauthorized users cannot view salary/bank details.
8. Staff self-service exposes only authenticated staff member’s own allowed data.

### 11.6 Acceptance criteria

1. Approved payroll cannot be edited unsafely.
2. Payroll cannot post twice.
3. Sensitive fields are masked unless permission allows.
4. Payslip files use protected access.

### 11.7 Future Enhancement Direction

Unique angle: HR + timetable + payroll integration. Connect staff workload, leave, and payroll rather than keeping them separate.

Planned enhancements: contract renewal workflow, staff document checklist, leave calendar, leave policy engine, payroll approval chain, payroll variance report, staff workload link, exit clearance, and substitute availability from HR leave. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 12. M8A Library Management

### 12.1 Purpose

Manage books, physical copies, issue/return, overdue, fines, borrower history, QR lookup, reports, and future fine-to-fees integration.

### 12.2 Primary actors

- Librarian.
- School Admin.
- Student/Staff borrower.

### 12.3 Core functions

1. Create book catalog record.
2. Create physical copy record.
3. Issue copy to borrower.
4. Return copy.
5. Mark copy lost or damaged.
6. Calculate overdue fine.
7. Support student and staff borrowers.
8. Resolve borrower by QR.
9. View book/copy history.
10. Generate library reports.
11. Export CSV.
12. Post fine to fees where enabled.

### 12.4 Key states

- Copy: available, issued, overdue, lost, damaged, retired.
- Issue: active, returned, lost, damaged, fine_pending, fine_paid.

### 12.5 Validation rules

1. One physical copy cannot be actively issued to multiple borrowers.
2. Lost/damaged status must preserve issue history.
3. Fine posting to fees must be idempotent.
4. QR lookup must be tenant-scoped and reject revoked credentials.
5. Borrower from another tenant must be rejected.
6. Fine paid in fees must update library status where integration is enabled.

### 12.6 Acceptance criteria

1. Same copy cannot be issued twice.
2. Borrower history remains visible after return, loss, or lifecycle change.
3. Library reports are tenant-scoped.

### 12.7 Future Enhancement Direction

Unique angle: Library as reading engagement, not just inventory.

Planned enhancements: reservation/hold queue, book availability portal, shelf/location map, acquisition workflow, reading challenge, class reading list, library period attendance, fine waiver approval, and barcode label printing. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 13. M8B Transport Management

### 13.1 Purpose

Manage routes, stops, vehicles, drivers, assignments, trips, boarding/drop statuses, location ingestion, stale location handling, and reports.

### 13.2 Primary actors

- Transport Staff.
- Driver.
- School Admin.
- Parent/Guardian.

### 13.3 Core functions

1. Create route.
2. Create stop.
3. Manage vehicle.
4. Manage driver.
5. Assign students to route.
6. Support different morning/evening route where needed.
7. Create trip.
8. Mark boarded, dropped, absent, not-boarded, delayed, completed.
9. Ingest GPS location.
10. Cache latest location in Redis.
11. Persist throttled location logs.
12. Show stale location state.
13. Provide parent active-trip endpoint.
14. Generate trip and boarding reports.

### 13.4 Key states

- Trip: scheduled, active, delayed, completed, canceled.
- Student trip status: not_boarded, boarded, dropped, absent.
- Location: live, stale, unavailable.

### 13.5 Validation rules

1. Student cannot be assigned to two conflicting active routes unless policy allows morning/evening separation.
2. Driver cannot mark wrong tenant/student.
3. GPS ingestion must throttle high-frequency updates.
4. Parent active-trip access must be child-scoped.
5. Parent UI must show stale location as stale, not live.
6. Vehicle/driver overlapping trips must be blocked.
7. Live map and driver app routes remain hidden/disabled until approved.

### 13.6 Acceptance criteria

1. Parent cannot track non-linked child.
2. Stale GPS is never presented as live.
3. Trip status supports boarded, dropped, absent, not-boarded, delayed, and completed.

### 13.7 Future Enhancement Direction

Unique angle: Trustworthy transport visibility, not just live map. Stale/uncertain GPS should be honestly shown.

Planned enhancements: driver daily manifest, substitute vehicle/driver, GPS quality score, transport fee integration, boarding anomaly detection, trip incident log, and vehicle maintenance log. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 14. M8C Canteen Management

### 14.1 Purpose

Manage menu items, meal plans, serving, student wallets, POS sales, spending controls, receipts, suppliers, inventory, stock ledger, and parent visibility.

### 14.2 Primary actors

- Canteen Operator.
- School Admin.
- Accountant.
- Parent/Guardian.

### 14.3 Core functions

1. Manage menu items.
2. Create meal plans.
3. Enroll student in meal plan.
4. Serve meal by QR/student search.
5. Show allergy warning.
6. Manage student wallet top-up.
7. View wallet history.
8. Correct/reverse wallet entry.
9. Process POS sale.
10. Generate POS receipt JSON/PDF.
11. Enforce spending controls.
12. Generate low-balance reports.
13. Manage suppliers and inventory items.
14. Create purchase bill.
15. Record stock movement and wastage.
16. Maintain stock ledger.
17. Generate sales, spending, meal count, low-balance, and stock reports.

### 14.4 Key states

- Wallet: active, blocked, overdraft_enabled_by_policy.
- POS sale: pending, completed, reversed.
- Meal plan: active, canceled, expired.
- Stock item: available, low_stock, out_of_stock.

### 14.5 Validation rules

1. Wallet balance must never go negative unless explicit policy enables overdraft.
2. POS sale must be idempotent.
3. Overlapping active meal plans must be blocked.
4. Meal plan cancellation must follow invoice/credit/void policy.
5. Wallet reversal must not create negative balance unless policy allows.
6. Inventory stock cannot go negative unless policy allows.
7. QR serving must reject revoked credentials.
8. Receipt reprint must not create duplicate POS transaction.
9. Parent spending controls must be enforced.

### 14.6 Acceptance criteria

1. POS double submit cannot duplicate transaction.
2. Parent can see only linked child canteen spending where enabled.
3. Stock ledger and sales reports are tenant-scoped.

### 14.7 Future Enhancement Direction

Unique angle: Safety-first canteen — allergy enforcement + wallet controls + inventory accountability.

Planned enhancements: hard allergy block, parent spending control, meal subscription, menu planner, inventory recipe linking, student dietary profile, parent canteen history, and popular item reports. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 15. M9 Accounting and Finance

### 15.1 Purpose

Provide double-entry accounting, chart of accounts, fiscal years, journals, ledgers, vouchers, reconciliation, financial reports, snapshots, audit logs, and source-based posting.

### 15.2 Primary actors

- Accountant / Finance Staff.
- Principal.
- Platform operator for diagnostics only where allowed.

### 15.3 Core functions

1. Manage chart of accounts.
2. Manage fiscal years and periods.
3. Create journal entries and vouchers.
4. Enforce double-entry posting.
5. Post source transactions idempotently.
6. Prevent direct edit of posted journals.
7. Create reversal/correction entries.
8. Close fiscal period/year.
9. Reopen fiscal period/year with permission and audit.
10. Generate trial balance.
11. Generate general ledger.
12. Generate cash book.
13. Generate income statement.
14. Generate balance sheet.
15. Generate VAT/TDS/PF summaries where applicable.
16. Export CSV/PDF.
17. Create report snapshots.
18. Perform bank reconciliation.
19. Suggest auto-matches.
20. View accounting audit logs.

### 15.4 Key states

- Journal: draft, posted, reversed, corrected.
- Fiscal period: open, closed, reopened.
- Reconciliation: unmatched, suggested, matched, rejected.

### 15.5 Validation rules

1. Unbalanced journal must never post.
2. Posted journals must be immutable.
3. Corrections must use reversal/correction entries.
4. Source-based posting must be idempotent.
5. Closed-period posting must be blocked unless fiscal reopen policy permits.
6. Decimal precision must avoid one-paisa mismatch where possible.
7. Fee, payroll, canteen, library, and transport source mappings must map to valid accounts.
8. Large reports should use background export.
9. Financial analytics must reconcile with accounting reports.

### 15.6 Acceptance criteria

1. Trial balance remains balanced.
2. Fee receipt reversal creates accounting reversal.
3. Payroll cannot post twice.
4. Large ledger export does not block normal operations.

### 15.7 Future Enhancement Direction

Unique angle: ERP-grade accounting backbone, not a side ledger.

Planned enhancements: accounting setup wizard, source-ledger drilldown, fiscal close checklist, bank reconciliation workspace, voucher workflows, audit-ready snapshots, budgeting, tax/PAN/VAT readiness, and management reports. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 16. M10 Notices, Communication, and Messaging

### 16.1 Purpose

Centralize notices, events, consent, preferences, notification delivery, read tracking, parent-teacher messaging, attachments, retries, failure dashboards, and moderation foundations.

### 16.2 Primary actors

- School Admin.
- Principal.
- Teacher.
- Parent/Guardian.
- Student where allowed.

### 16.3 Core functions

1. Create school-wide notice.
2. Create class-specific notice.
3. Create targeted notice.
4. Preview recipients before high-impact notice.
5. Attach files through File Registry.
6. Send notice through selected provider mode.
7. Track delivery.
8. Track read state.
9. Show unread recipient list.
10. Retry failed delivery without duplicating messages.
11. Manage guardian consent and communication preferences.
12. Support parent-teacher thread/message foundation.
13. Manage chat availability.
14. Submit abuse report.
15. Escalate or moderate message/thread.

### 16.4 Key states

- Notice: draft, scheduled, sent, failed, archived, removed.
- Delivery: pending, delivered, failed, retried, read.
- Provider: disabled, dev-log, configured-provider.
- Message/thread: open, closed, escalated, reported, moderated.

### 16.5 Validation rules

1. Recipient preview must be available before high-impact notices.
2. Parent/guardian message access must be child-scoped.
3. Removed guardians must not remain in unread recipient list.
4. Attachment access must be protected.
5. Provider-disabled mode must not show delivered state.
6. Duplicated/forged provider callbacks must not duplicate delivery records.
7. Abuse, escalation, and moderation actions must be audited.

### 16.6 Acceptance criteria

1. Notice sent to wrong class can be audited and corrected according to policy.
2. Parent removed from student cannot access old message link.
3. Delivery retry does not duplicate messages.

### 16.7 Future Enhancement Direction

Unique angle: Reliable school communication, not just chat. Delivery/read/failure transparency is the differentiator.

Planned enhancements: notice template library, delivery confidence tracking, emergency override, parent-teacher office hours, chat moderation, multi-channel fallback, parent language preference, and communication health score. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 17. M11 School Intelligence and Analytics

### 17.1 Purpose

Provide future analytics and intelligence only after reliable production data exists.

### 17.2 Primary actors

- Principal.
- School Admin.
- Teacher with limited class-level analytics.
- Platform operator for aggregate operational metrics where privacy-safe.

### 17.3 Core functions

1. Show student performance trends.
2. Show attendance risk indicators.
3. Show fee collection analytics.
4. Show staff and class-level insights.
5. Show parent engagement analytics.
6. Provide human-review queue for recommendations.
7. Support predictive analytics only in later phases.

### 17.4 Key states

- Insight: draft, reviewed, published, dismissed.
- Risk indicator: informational, warning, critical.

### 17.5 Validation rules

1. AI/intelligence must not be implemented until reliable production data exists.
2. Analytics must be explainable and tenant-scoped.
3. Sensitive insights must be permission-gated.
4. Cross-tenant aggregation must not leak tenant identity.
5. Financial analytics must reconcile with accounting source of truth.
6. No automated punishment, ranking, discipline, payroll, or parent message action.

### 17.6 Acceptance criteria

1. Analytics are advisory, not final decisions.
2. Sensitive insights are visible only to authorized roles.
3. Incomplete pilot data is clearly marked.

### 17.7 Future Enhancement Direction

Unique angle: Human-reviewed school intelligence, not automated decisions.

Planned enhancements: attendance risk insight, fee collection risk, academic intervention, parent engagement insight, transport reliability score, canteen demand forecast, timetable optimization, staff workload balancing, accounting anomaly detection, and student wellbeing signals. All must be human-reviewed, explainable, and permission-gated. See MODULE_FEATURE_ENHANCEMENT_PLAN.md for full backlog.

---

## 18. Cross-Module Integration Features

### 18.1 Universal Student 360

- FR-CM-01: The system must provide a unified student profile view aggregating data from admissions, attendance, fees, receipts, homework, marks, report cards, activity feed, library, transport, canteen, and notices.
- FR-CM-02: The system must support a Family 360 variant showing sibling relationships, shared guardians, and family-level fee/transport/document views.
- FR-CM-03: Student 360 data must be tenant-scoped and permission-gated by viewer role.

### 18.2 School Command Center

- FR-CM-04: The system must provide a principal dashboard showing live operational status including today's attendance, absent students, unpaid fees, cashier collection, homework due, transport status, canteen stock, pending leave, pending approvals, and unread emergency notices.
- FR-CM-05: Command Center data must be role-gated to principal and authorized admin roles.

### 18.3 Nepal Compliance Center

- FR-CM-06: The system must provide a compliance area with iEMIS readiness, PAN/VAT readiness, accounting close readiness, fee receipt audit, payroll/PF/TDS summaries, student document completeness, and report-card publish readiness.
- FR-CM-07: Compliance checks must identify specific missing fields and blocking issues.

### 18.4 Approval Inbox

- FR-CM-08: The system must provide a global approval queue aggregating fee reversal/refund, marks unlock, attendance correction, leave, payroll, report-card correction, notice, canteen reversal, and library fine waiver approvals.
- FR-CM-09: Each approver must see only their authorized approval types based on role and permissions.
- FR-CM-10: Pending approvals must track SLA duration and highlight overdue items.

### 18.5 School Health Score

- FR-CM-11: The system must provide a deterministic (non-AI) school health score covering attendance health, fee health, academic data completeness, communication reach, transport reliability, canteen stock safety, HR/payroll readiness, and accounting close readiness.
- FR-CM-12: Health score must be calculated from real module data, not estimates or projections.
- FR-CM-13: Health score history must be tracked for trend analysis.

---

---

## 19. Architecture Constraints

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

## 20. Product Planes and Boundaries

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

## 21. User Classes

The system must support the following user classes with role-based permissions and tenant-scoped access:
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

---

## 22. Cross-Cutting System Requirements

### 22.1 Tenant Isolation
1. Every database query, file access, queue job, export, and report must be tenant-scoped.
2. Same names, phone numbers, admission numbers, class names, or receipt numbers across schools must never cause leakage.
3. Platform override must require explicit reason and audit trail.
4. Suspended tenants must be blocked consistently across dashboard, API, mobile, jobs, file downloads, and report generation.

### 22.2 Parent and Student Access
1. Parents can only access linked children.
2. Students can only access their own allowed records.
3. Guardian removal must revoke access immediately.
4. Shared links must not bypass ownership checks.
5. Parent/student APIs must fail closed.

### 22.3 File Privacy
1. Student photos, documents, receipts, report cards, payslips, notices, chat attachments, activity media, and exports must use protected access.
2. Raw storage keys, public object URLs, and internal file IDs must not be exposed to unauthorized clients.
3. Signed URLs must be short-lived.
4. Sensitive file preview/download must be audited.

### 22.4 Money and Accounting
1. Payment, refund, reversal, payroll, canteen, library fine, and accounting posting flows must be idempotent.
2. Posted accounting records must be immutable.
3. Every reversal must have reason, permission check, and audit trail.
4. Financial reports must reconcile with source ledgers.
5. Decimal-safe money handling must prevent one-paisa mismatches where possible.

### 22.5 Offline, Slow Network, and Recovery
1. Long forms should preserve drafts where practical.
2. Expired sessions should recover safely without duplicate submission.
3. Offline/reconnect sync must show conflicts instead of overwriting silently.
4. Low-bandwidth media must fail gracefully.

### 22.6 Background Jobs
1. Jobs must re-check tenant status, feature status, entity status, and permissions before executing.
2. Retried jobs must not duplicate messages, payments, reports, exports, or accounting postings.
3. Failed jobs must expose safe diagnostics without secrets.
4. Queue retry for sensitive jobs must be audited.

### 22.7 PDFs, Reports, and Exports
1. Receipt, ID card, report card, payroll, accounting, attendance, fee, library, transport, canteen, notice, and official-reporting exports must be tenant-scoped.
2. Export failure must not create false success states.
3. Re-generated PDFs should maintain history where legally or operationally required.
4. Large reports should use background export when needed.
5. Exported artifacts must be registered in File Registry where retained.

---

## 23. Payment and Provider Requirements

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

## 24. IEMIS and Official Reporting Requirements

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

## 25. Non-Functional Requirements

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

## 26. Security Requirements

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

## 27. Data Requirements

The system must maintain canonical backend models for:
- Tenant, User, Role and permission, Student, Guardian, Staff, Class, Section, Academic year, Fiscal year.
- Fee head, Fee plan, Invoice, Payment, Receipt, Ledger, Journal entry.
- Attendance session and attendance record.
- Subject, Exam term, Marks and CAS, Report card.
- Homework, Timetable.
- Notice and message.
- File Registry entry.
- Book and copy.
- Route, trip, vehicle, driver.
- Canteen wallet, POS sale, inventory movement.
- Payroll run and payslip.
- Audit log.

All tenant-owned records must carry tenant ownership either directly or through a tenant-owned parent chain.

---

## 28. Error Handling Requirements

1. Duplicate payment submissions must return an existing safe result or deterministic duplicate error.
2. File upload/database save partial failures must be recoverable or clearly reported.
3. Export generation failure must not show success.
4. Provider-disabled mode must block dependent actions.
5. Offline sync conflicts must show user choices.
6. Expired sessions must not duplicate submissions after re-authentication.
7. Suspended tenants must receive consistent blocked responses.
8. Unauthorzed parent/student access must fail closed.

---

## 29. Pilot Verification Requirements

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
- Platform dashboard, Tenant dashboard, Students, Attendance, Fees/finance, Academics, Accounting, Homework/timetable, HR/payroll, Library, Transport, Canteen, Notices/communication, Settings.

---

## 30. High-Risk Manual Verification Scenarios

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

