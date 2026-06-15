# SchoolOS Module Feature Breakdown

**Status:** Companion module feature breakdown for product planning, UI/UX planning, implementation planning, and developer roadmap alignment.  
**Scope:** Planning document only. This file does not implement backend, frontend, mobile, API, database, migrations, or tests.  
**Related docs:**

- `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
- `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
- `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`
- `docs/design/SCHOOLOS_WEB_MODULE_WORKSPACE_LAYOUT.md`
- `docs/design/SCHOOLOS_WEB_MAIN_DASHBOARD_LAYOUT.md`

This document lists SchoolOS modules and the major features each module should cover. It is intended to help planning, design, sprint scoping, QA, and implementation agents understand what belongs in each module.

Global rules:

- Keep `tenantId` as the tenant boundary everywhere.
- Keep SchoolOS as a NestJS modular monolith.
- Use real APIs only; no fake frontend data.
- Keep parent, student, driver, and staff self-service APIs purpose-limited.
- Keep private files behind File Registry and StorageService boundaries.
- Audit sensitive mutations.
- Keep money flows idempotent and auditable.
- Keep M11 Intelligence / AI roadmap-only until reliable production data and explicit approval exist.

---

## Main Dashboard

### Purpose

The dashboard is the **school command center**. It shows what is happening today, what needs attention, and quick shortcuts to important actions.

### Features

#### 1. School Overview

- Total students.
- Total staff.
- Active classes.
- Academic year status.
- School open/closed status.
- Today's date and Nepali calendar date.
- Current user role view.

#### 2. Today's Operations

- Attendance marking status.
- Fees collected today.
- Classes running today.
- Staff on leave today.
- Active transport trips.
- Canteen sales today.
- Notices sent today.

#### 3. Pending Approvals

- Attendance corrections.
- Leave requests.
- Fee discounts.
- Payment reversals.
- Activity post approvals.
- Payroll approval.
- Report-card publish approval.

#### 4. Alerts

- Attendance not submitted.
- Fees overdue.
- Staff shortage.
- Bus delay.
- Low canteen stock.
- Library overdue books.
- Unread important notices.
- Exam marks pending.

#### 5. Quick Actions

- New admission.
- Mark attendance.
- Collect fee.
- Create notice.
- Assign homework.
- Add staff.
- Issue book.
- Start transport trip.
- Run payroll.

#### 6. Recent Activity

- Payment received.
- Attendance submitted.
- New admission created.
- Homework assigned.
- Notice sent.
- Staff leave requested.
- Book issued.
- Canteen order served.

---

## M1 — Admissions and Student Profiles

### Purpose

Handles the complete student lifecycle from inquiry/admission to student profile, documents, guardian details, and iEMIS export readiness.

### Features

#### 1. Admission Management

- New student admission form.
- Admission application list.
- Admission status tracking.
- Draft admission save.
- Admission approval/rejection.
- Admission number generation.
- Academic year assignment.
- Class and section assignment.
- Roll number assignment.
- Admission source tracking.

#### 2. Student Profile

- Student personal details.
- Date of birth.
- Gender.
- Blood group.
- Nationality.
- Religion/caste/ethnicity fields where required by school.
- Permanent address.
- Temporary address.
- Contact details.
- Student photo.
- Student status: active, inactive, transferred, graduated, suspended, archived where supported.

#### 3. Guardian and Family Information

- Father details.
- Mother details.
- Local guardian details.
- Emergency contact.
- Guardian phone numbers.
- Guardian email.
- Occupation.
- Relationship with student.
- Multiple guardian support.
- Primary guardian selection.

#### 4. Academic Enrollment

- Class enrollment.
- Section assignment.
- Academic year mapping.
- Previous school information.
- Transfer certificate record.
- Current class history.
- Promotion history.
- Student movement history.

#### 5. Student Documents

- Birth certificate.
- Transfer certificate.
- Previous mark sheet.
- Passport-size photo.
- Citizenship/ID if needed.
- Guardian ID document.
- Medical document.
- Custom document type.
- Document upload.
- Protected document preview.
- Missing document alert.

#### 6. Duplicate Detection

- Detect duplicate student by name.
- Detect duplicate by guardian phone.
- Detect duplicate by date of birth.
- Duplicate candidate list.
- Merge duplicate profile where explicitly supported.
- Keep merge history.
- Prevent accidental duplicate admission.

#### 7. Student QR / ID Card

- Generate student QR code.
- Generate ID card.
- Print ID card.
- Reissue QR.
- Rotate QR credential.
- Mark QR as active/rotated/inactive/revoked according to backend status model.
- QR scan history.

#### 8. iEMIS / Government Export Readiness

- Student data validation.
- Required government fields.
- iEMIS CSV export.
- Missing iEMIS field warning.
- Export history.
- Download previous exports.

#### 9. Reports

- Student list report.
- Class-wise student report.
- Gender-wise report.
- New admission report.
- Withdrawn/transferred student report.
- Missing document report.
- Guardian contact report.

---

## M2 — Smart Attendance

### Purpose

Handles daily attendance, monthly registers, attendance corrections, teacher scope, parent alerts, and attendance reports.

### Features

#### 1. Daily Student Attendance

- Class-wise attendance.
- Section-wise attendance.
- Date selector.
- Present/absent/late status.
- Half-day status.
- Leave status.
- Remarks.
- Bulk mark present.
- Save draft.
- Submit attendance.
- Lock attendance after deadline.

#### 2. Teacher Attendance Scope

- Teacher can only mark assigned class/subject attendance.
- Class teacher permission.
- Subject teacher permission.
- Role-based attendance access.
- Prevent unauthorized class attendance update.

#### 3. Monthly Attendance Register

- Student-wise monthly view.
- Class-wise monthly register.
- Present/absent/late totals.
- Working days calculation.
- Holiday handling.
- Monthly export.
- Print register.

#### 4. Attendance Corrections

- Correction request form.
- Reason for correction.
- Old status vs new status.
- Approval workflow.
- Principal/admin approval.
- Correction history.
- Lock correction after allowed window.

#### 5. Offline Attendance Draft

- Teacher marks attendance offline where supported.
- Save local draft.
- Sync when internet returns.
- Conflict detection.
- Duplicate submission prevention.
- Sync status indicator.

#### 6. Attendance Alerts

- Attendance not marked alert.
- Absent student alert.
- Late student alert.
- Frequent absent student alert.
- Attendance below threshold.
- Parent notification for absence.

#### 7. Reports

- Daily attendance report.
- Monthly attendance report.
- Student attendance summary.
- Class attendance percentage.
- Absent list.
- Late list.
- Attendance correction report.
- Export PDF/CSV through protected helpers where retained.

---

## M3 — Fees and Receipts

### Purpose

Handles fee structure, invoice generation, payment collection, receipts, dues, discounts, refunds, reversals, and cashier close.

### Features

#### 1. Fee Structure Setup

- Fee category setup.
- Monthly fee setup.
- Admission fee.
- Exam fee.
- Transport fee.
- Canteen fee if linked.
- Library fine if linked.
- Custom fee heads.
- Class-wise fee structure.
- Student-specific fee adjustment.

#### 2. Invoice Management

- Generate invoice.
- Bulk invoice generation.
- Student-wise invoice.
- Monthly invoice.
- Term-wise invoice.
- Invoice due date.
- Invoice status: draft, unpaid, partially paid, paid, overdue, cancelled/void where supported.

#### 3. Payment Collection

- Record payment.
- Full payment.
- Partial payment.
- Multiple payment methods: cash, bank transfer, QR payment, cheque, online gateway later after staging verification.
- Payment remarks.
- Payment reference number.
- Auto receipt generation.

#### 4. Receipt Management

- Receipt print.
- Receipt PDF.
- Receipt reprint.
- Receipt reprint history.
- Receipt cancellation/reversal workflow where permitted.
- Receipt number sequence.
- Parent receipt view.
- Download receipt.

#### 5. Discounts and Scholarships

- Discount request.
- Sibling discount.
- Scholarship discount.
- Staff-child discount.
- Manual discount.
- Approval workflow.
- Discount history.
- Discount report.

#### 6. Fine and Penalty

- Late fee setup.
- Auto fine calculation.
- Manual fine waiver.
- Fine approval.
- Fine report.

#### 7. Refund and Reversal

- Payment reversal.
- Refund request.
- Refund approval.
- Reason required.
- Audit trail.
- Accounting reversal posting.
- Prevent silent deletion.

#### 8. Cashier Close

- Daily collection summary.
- Cashier-wise collection.
- Payment method breakdown.
- Expected cash vs actual cash.
- Difference remarks.
- Close day/window.
- Cashier close PDF.
- Prevent unsafe backdated change after close.

#### 9. Reports

- Fee due report.
- Collection report.
- Student ledger.
- Class-wise due report.
- Daily cash report.
- Discount report.
- Refund report.
- Overdue report.
- Export PDF/Excel/CSV through authenticated helpers.

---

## M4 — Academics, Exams, CAS, and Report Cards

### Purpose

Handles academic setup, subjects, exams, marks entry, CAS assessment, grading, and report-card generation.

### Features

#### 1. Academic Setup

- Academic year.
- Class setup.
- Section setup.
- Subject setup.
- Subject teacher assignment.
- Optional subject mapping.
- Full marks/pass marks setup.
- Grading scale setup.

#### 2. Exam Term Management

- Exam term creation.
- First terminal/second terminal/final exam.
- Custom exam terms.
- Exam start/end dates.
- Exam publish status.
- Exam weightage.
- Term lock/unlock.

#### 3. Exam Components

- Theory marks.
- Practical marks.
- Internal assessment.
- Project work.
- Viva.
- Attendance marks if required.
- Custom components.
- Component-wise full marks.

#### 4. Marks Entry

- Class-wise marks entry.
- Subject-wise marks entry.
- Student-wise marks entry.
- Spreadsheet-style grid.
- Auto total calculation.
- Grade calculation.
- Pass/fail status.
- Absent status.
- Withheld/retest states where supported.
- Marks draft save.
- Submit marks.
- Lock marks after submission.

#### 5. CAS Assessment

- Continuous Assessment System setup.
- Behavioral indicators.
- Skill indicators.
- Participation marks.
- Homework/classwork evaluation.
- Teacher remarks.
- CAS grading.
- Term-wise CAS record.

#### 6. Report Card

- Generate report card.
- Student-wise report card.
- Class-wise bulk generation.
- Report-card PDF.
- Principal remarks.
- Class teacher remarks.
- Attendance summary on report card.
- Grade sheet.
- GPA/percentage calculation.
- Publish/unpublish report card.
- Parent view for published results only.

#### 7. Result Processing

- Subject total.
- Grand total.
- Percentage.
- GPA.
- Rank calculation if enabled by school policy.
- Division calculation.
- Pass/fail.
- Grace marks if school allows.
- Recheck request later.

#### 8. Reports

- Marks ledger.
- Subject-wise performance.
- Class result summary.
- Failed student list.
- Topper list where school policy allows.
- Grade distribution.
- Report-card publish status.
- Exam analysis.

---

## M5 — Activity Feed and Milestones

### Purpose

Handles school activities, classroom posts, student milestones, media sharing, approval workflow, and parent visibility.

### Features

#### 1. Activity Posts

- Create activity post.
- Add title.
- Add description.
- Select class/section.
- Select visibility.
- Attach photos/videos.
- Save draft.
- Publish post.
- Edit post.
- Delete/soft-delete/archive post.

#### 2. Media Management

- Upload image.
- Upload video.
- File compression.
- Protected media preview.
- Signed/protected media access.
- Media gallery.
- Class-wise gallery.
- Student-tagged media.
- File Registry integration.

#### 3. Approval Workflow

- Teacher creates post.
- Admin/principal approval.
- Approve post.
- Reject post.
- Request changes.
- Approval remarks.
- Pending approval queue.

#### 4. Consent-Aware Sharing

- Student media consent record.
- Block media for students without consent.
- Warning before publishing.
- Parent visibility control.
- Audit media access.
- Hide sensitive media.

#### 5. Milestones

- Student milestone record.
- Learning milestone.
- Health/development milestone for preschool.
- Behavior milestone.
- Special achievement.
- Parent-visible milestone.
- Teacher notes.

#### 6. Parent View

- Parent activity feed.
- Child-specific posts.
- Class activity posts.
- Milestone view.
- Media download restriction where required.
- Read status.

#### 7. Reports

- Activity posts report.
- Pending approval report.
- Media upload report.
- Consent-blocked report.
- Parent engagement report.

---

## M6 — Homework and Timetable

### Purpose

Handles homework assignment, submissions, review, timetable creation, teacher workload, conflicts, and substitutions.

### Features

#### 1. Homework Assignment

- Create homework.
- Select class/section.
- Select subject.
- Add title.
- Add instructions.
- Add due date.
- Attach files.
- Assign to whole class.
- Assign to selected students.
- Save draft.
- Publish homework.

#### 2. Homework Attachments

- Upload file.
- Protected file preview.
- Download attachment.
- File Registry integration.
- File size validation.
- Attachment access control.

#### 3. Homework Submissions

- Student submission.
- Parent-assisted submission for lower grades where supported.
- Upload answer file.
- Text answer.
- Submission timestamp.
- Late submission flag.
- Resubmission support.

#### 4. Homework Review

- Teacher review.
- Mark as checked.
- Add remarks.
- Return for correction.
- Approve submission.
- Track pending submissions.
- Track missing homework.

#### 5. Homework Reports

- Assigned homework report.
- Pending submission report.
- Late submission report.
- Student homework history.
- Teacher homework workload.

#### 6. Timetable Builder

- Weekly timetable grid.
- Class-wise timetable.
- Teacher-wise timetable.
- Subject-wise periods.
- Room assignment.
- Period setup.
- Break/lunch setup.
- Publish timetable.
- Draft timetable.
- Timetable versioning.

#### 7. Conflict Detection

- Teacher conflict.
- Room conflict.
- Class conflict.
- Subject period conflict.
- Teacher workload limit.
- Weekly required period validation.
- Duplicate period warning.

#### 8. Substitution Management

- Absent teacher substitution.
- Substitute teacher assignment.
- Teacher availability check.
- Leave integration from HR.
- Substitution notice to class.
- Substitution history.

#### 9. Timetable Reports

- Class timetable.
- Teacher timetable.
- Room timetable.
- Daily period list.
- Teacher workload report.
- Substitution report.

---

## M7 — HR and Payroll

### Purpose

Handles staff records, contracts, attendance, leave, payroll processing, payslips, and HR reports.

### Features

#### 1. Staff Profile

- Add staff.
- Staff personal details.
- Contact information.
- Address.
- Emergency contact.
- Staff photo.
- Department.
- Designation.
- Role assignment.
- Employment status: active, on leave, resigned, terminated.

#### 2. Contract Management

- Contract creation.
- Contract type: full-time, part-time, temporary, visiting.
- Joining date.
- Contract start/end date.
- Salary details with permission-gated display.
- Contract document upload.
- Contract expiry alert.
- Contract renewal history.

#### 3. Staff Documents

- Citizenship/ID.
- Academic certificates.
- Experience letters.
- Contract files.
- Training certificates.
- Staff photo.
- Protected document preview/download.

#### 4. Leave Management

- Leave type setup.
- Leave balance.
- Leave request.
- Leave approval.
- Leave rejection.
- Half-day leave.
- Emergency leave.
- Leave calendar.
- Leave history.

#### 5. Staff Attendance

- Staff attendance marking.
- Biometric integration later.
- Manual attendance.
- Late record.
- Absent record.
- Attendance correction.
- Staff attendance report.

#### 6. Payroll Setup

- Salary components.
- Basic salary.
- Allowances.
- Deductions.
- Tax deduction.
- Provident fund if needed.
- Bonus.
- Advance salary.
- Custom payroll components.

#### 7. Payroll Run

- Monthly payroll run.
- Draft payroll.
- Review payroll.
- Approve payroll.
- Lock payroll.
- Generate payslips.
- Payroll reversal/correction.
- Payroll posting to accounting.

#### 8. Payslips

- Staff payslip PDF.
- Payslip preview.
- Download payslip.
- Email/share later.
- Payslip history.

#### 9. Reports

- Staff list.
- Leave report.
- Payroll summary.
- Salary sheet.
- Payslip report.
- Contract expiry report.
- Staff attendance report.

---

## M8A — Library

### Purpose

Handles books, book copies, issue/return, overdue tracking, fines, and library reports.

### Features

#### 1. Book Management

- Add book.
- Book title.
- Author.
- ISBN.
- Publisher.
- Edition.
- Category.
- Subject.
- Language.
- Shelf/rack location.
- Book status.

#### 2. Copy Management

- Add multiple copies.
- Barcode/QR for copy.
- Copy number.
- Copy condition.
- Available/issued/lost/damaged status.
- Copy history.

#### 3. Issue Book

- Issue to student.
- Issue to staff.
- Due date.
- Issue remarks.
- Prevent issue if overdue limit exceeded.
- Issue receipt/slip.

#### 4. Return Book

- Return book.
- Return date.
- Late days calculation.
- Fine calculation.
- Damage remarks.
- Lost book handling.

#### 5. Overdue Management

- Overdue list.
- Student overdue alert.
- Parent notification later.
- Fine collection link to fees.
- Overdue export.

#### 6. Search

- Search by title.
- Search by author.
- Search by ISBN.
- Search by category.
- Search by copy number.
- Availability filter.

#### 7. Reports

- Book inventory report.
- Issued books report.
- Overdue report.
- Lost/damaged report.
- Student library history.
- Popular books report.

---

## M8B — Transport

### Purpose

Handles school transport routes, stops, vehicles, drivers, student assignments, trips, and location/GPS status.

### Features

#### 1. Route Management

- Add route.
- Route name.
- Route code.
- Route description.
- Active/inactive route.
- Route fee mapping.
- Route student list.

#### 2. Stop Management

- Add stop.
- Stop name.
- Stop order.
- Pickup time.
- Drop time.
- Stop coordinates.
- Stop fee if distance-based.
- Assign stop to route.

#### 3. Vehicle Management

- Add vehicle.
- Vehicle number.
- Vehicle type.
- Capacity.
- Registration details.
- Insurance details.
- Pollution/fitness expiry.
- Vehicle status.

#### 4. Driver and Helper Assignment

- Assign driver.
- Assign helper.
- Driver contact.
- License details.
- Driver document upload.
- Route duty assignment.

#### 5. Student Transport Assignment

- Assign student to route.
- Assign pickup stop.
- Assign drop stop.
- Transport fee linking.
- Start/end date.
- Transport status.

#### 6. Trip Management

- Start trip.
- End trip.
- Morning pickup trip.
- Afternoon drop trip.
- Trip status: scheduled, running, completed, cancelled.
- Student boarding/deboarding tracking where supported.

#### 7. GPS / Location Status

- Vehicle location ping.
- Latest location state.
- Map view only where approved.
- Route progress.
- Last updated time.
- Delay alert.
- Parent live tracking later after policy/load approval.

#### 8. Alerts

- Bus delay.
- Vehicle inactive.
- Route not started.
- Overcapacity warning.
- Driver not assigned.
- Document expiry alert.

#### 9. Reports

- Route-wise student report.
- Vehicle report.
- Driver assignment report.
- Trip history.
- Transport fee report.
- Delay report.

---

## M8C — Canteen

### Purpose

Handles school canteen menu, wallet, QR-based serving, sales, refunds, stock alerts, and canteen reports.

### Features

#### 1. Menu Management

- Add menu item.
- Item category.
- Item price.
- Item image.
- Availability status.
- Daily menu.
- Item active/inactive.
- Veg/non-veg label.
- Allergy note if needed.

#### 2. Student Wallet

- Student wallet balance.
- Wallet top-up.
- Parent top-up later where gateway/provider readiness exists.
- Manual top-up.
- Wallet deduction.
- Wallet refund.
- Wallet transaction history.

#### 3. QR Serving

- Scan student QR.
- Show student wallet.
- Select menu item.
- Confirm serving.
- Deduct amount.
- Generate serving record.
- Prevent duplicate serving if needed.

#### 4. Orders / Sales

- Daily sales list.
- Student purchase history.
- Item-wise sales.
- Cash sale.
- Wallet sale.
- Cancel sale.
- Refund sale.

#### 5. Stock Management

- Stock quantity.
- Low stock alert.
- Stock adjustment.
- Daily consumption.
- Wastage record.

#### 6. Parent Controls Later

- Spending limit.
- Block item category where approved.
- View purchase history.
- Wallet top-up request.

#### 7. Reports

- Daily sales report.
- Item sales report.
- Wallet transaction report.
- Student spending report.
- Low stock report.
- Refund report.

---

## M9 — Accounting and Finance

### Purpose

Handles double-entry accounting, chart of accounts, journal entries, ledgers, financial reports, fiscal periods, and module posting from fees, payroll, canteen, library, and transport.

### Features

#### 1. Chart of Accounts

- Create account.
- Account code.
- Account name.
- Account type: asset, liability, equity, income, expense.
- Parent-child account structure.
- Active/inactive account.

#### 2. Journal Entries

- Manual journal entry.
- Debit/credit lines.
- Auto balance validation.
- Entry date.
- Reference number.
- Narration.
- Draft/post status.
- Post journal.
- Reverse journal.

#### 3. Auto Posting From Modules

- Fee collection posting.
- Payment reversal posting.
- Payroll posting.
- Canteen sales posting.
- Library fine posting.
- Transport fee posting.
- Cashier close posting.

#### 4. Ledger

- Account ledger.
- Student ledger link from fees.
- Staff payroll ledger.
- Date range filter.
- Opening/closing balance.
- Debit/credit movement.

#### 5. Trial Balance

- Trial balance report.
- Debit total.
- Credit total.
- Balance validation.
- Export PDF/Excel.

#### 6. Income and Expense

- Income report.
- Expense report.
- Monthly comparison.
- Category-wise summary.
- Fee income.
- Payroll expense.
- Canteen income.
- Transport income.

#### 7. Financial Statements

- Profit and loss report.
- Balance sheet.
- Cash flow summary later.
- Receivable report.
- Payable report.

#### 8. Period Close

- Monthly close.
- Year-end close.
- Lock closed period.
- Prevent backdated posting.
- Reopen period with permission.
- Close history.

#### 9. Audit and Compliance

- Journal audit trail.
- Source module reference.
- Created by.
- Approved by.
- Posted time.
- Reversal reason.
- Export history.

---

## M10 — Notices and Communication

### Purpose

Handles official notices, announcements, parent-teacher communication, delivery logs, templates, and controlled school chat.

### Features

#### 1. Notice Management

- Create notice.
- Notice title.
- Notice body.
- Attach files.
- Select audience.
- Save draft.
- Send notice.
- Schedule notice.
- Pin important notice.
- Archive notice.

#### 2. Audience Targeting

- Whole school.
- Class-wise.
- Section-wise.
- Student-wise.
- Parent-wise.
- Staff-wise.
- Role-wise.
- Transport route-wise.
- Fee due student group.

#### 3. Notice Delivery

- In-app delivery.
- SMS later where enabled and provider-ready.
- Email later where enabled and provider-ready.
- Push notification later where enabled and provider-ready.
- Delivery status.
- Read/unread status.
- Failed delivery tracking.

#### 4. Templates

- Holiday notice template.
- Fee reminder template.
- Exam notice template.
- Parent meeting template.
- Emergency notice template.
- Custom templates.
- Nepali/English templates.

#### 5. Parent-Teacher Chat

- Teacher to parent chat.
- Parent to class teacher chat.
- Teacher to teacher chat if enabled.
- School-hour-only chat.
- Quiet hours.
- Chat read receipts.
- Chat attachment control.
- Personal data sharing warning.
- Chat audit trail.

#### 6. Chat Safety Controls

- Disable chat outside school hours.
- Block personal contact sharing warning.
- Admin visibility only if policy/permission requires.
- Report message.
- Archive conversation.
- Restrict deleted messages.
- Role-based communication rules.

#### 7. Announcements

- School announcement.
- Class announcement.
- Staff announcement.
- Emergency announcement.
- Push to dashboard.
- Pin announcement.

#### 8. Delivery Logs

- Sent notice log.
- Recipient list.
- Read status.
- Failed status.
- Retry delivery.
- Export delivery log.

#### 9. Reports

- Notice sent report.
- Unread notice report.
- Parent engagement report.
- Chat usage report.
- Delivery failure report.
- Emergency notice report.

---

## M12 — Learning Layer

### Purpose

Handles teacher-led, school-controlled learning activities, smart-board sessions, computer-lab practice, resources, attempts, progress, and parent learning summaries.

### Features

#### 1. Activity Builder

- Create learning activity.
- Edit learning activity.
- Select class, section, subject, topic, mode, language, and difficulty.
- Add activity content.
- Add questions.
- Save draft.
- Publish/archive activity.

#### 2. Question and Practice Types

- Multiple choice.
- True/false.
- Short answer.
- Matching.
- Ordering.
- Supportive labels only.

#### 3. Smart Board Sessions

- Launch board session.
- Show session code/QR.
- Navigate questions.
- Heartbeat status.
- Pause/resume/end session.
- Participant monitor.

#### 4. Computer Lab Sessions

- Student joins valid session.
- Attempt start/resume.
- Autosave answers.
- Submit attempt.
- Idempotent submit behavior.
- Safe submitted summary.

#### 5. Resources

- Resource library.
- Attach resources to activity.
- Protected file picker later.
- Archive resources.
- File Registry-backed resources.

#### 6. Progress and Parent Summary

- Class progress.
- Student progress.
- Topic/subject filters.
- Parent child-scoped learning summary.
- Non-comparative progress labels.

#### 7. Safety Boundaries

- No broad student mobile app in MVP.
- No public leaderboard.
- No open student AI chat.
- No harsh labels such as weak, failed, poor, or low-rank.
- Parent sees own child only.
- Student sees own active session only.

---

## M0 — Platform Core / Developer and Platform Admin Only

M0 is **developer/platform/admin-only** and is not part of normal school pricing tiers.

### Purpose

Handles platform foundation, tenant setup, permissions, system health, storage, queues, and SaaS-level settings.

### Features

#### 1. Tenant Management

- Create school tenant.
- School profile.
- Tenant domain/subdomain.
- Tenant status.
- Subscription plan.
- Academic year defaults.
- Tenant isolation.

#### 2. Authentication

- Login.
- Logout.
- JWT/session management.
- Password reset.
- Role-based login.
- Multi-school access later.
- Login throttling.

#### 3. RBAC and Permissions

- Roles.
- Permissions.
- Role-permission map.
- Module access.
- Action-level access.
- PermissionGate support.
- RoleGuard support.

#### 4. File Registry

- Protected file upload.
- File preview.
- File download.
- Signed/protected access.
- File ownership.
- File audit log.
- Student/staff/document/media file linking.

#### 5. Audit Logs

- Who did what.
- When action happened.
- Before/after values.
- Source module.
- Sensitive action tracking.
- Export audit log.

#### 6. System Settings

- School settings.
- Academic year settings.
- Number sequence settings.
- Receipt number settings.
- ID card settings.
- Attendance lock settings.
- Notification settings.

#### 7. Queue and Background Jobs

- Email queue later.
- SMS queue later.
- Report generation queue.
- PDF generation queue.
- Notification queue.
- Retry failed jobs.
- Queue health.

#### 8. Object Storage

- MinIO/S3-compatible setup.
- Bucket health.
- Upload validation.
- File retention rules.
- Backup storage later.

#### 9. Health Monitoring

- API health.
- Database health.
- Redis health.
- Storage health.
- Queue health.
- Version info.
- Readiness check.

---

## M11 — School Intelligence / AI

### Current status

M11 remains roadmap-only.

Do not implement AI runtime, LLM calls, open student AI chat, automated punishment/risk decisions, or raw prediction scores for parents/students until reliable production data, tenant-safe aggregation, explainability, audit storage, human review, and explicit product approval exist.

---

## Final Recommended Module Structure

```text
Main Dashboard
M1  Admissions & Student Profiles
M2  Smart Attendance
M3  Fees & Receipts
M4  Academics, Exams, CAS & Report Cards
M5  Activity Feed & Milestones
M6  Homework & Timetable
M7  HR & Payroll
M8A Library
M8B Transport
M8C Canteen
M9  Accounting & Finance
M10 Notices & Communication
M12 Learning Layer
M0  Platform Core / Developer and Platform Admin Only
M11 School Intelligence / AI Roadmap Only
```

## Best Implementation Rule

Each module should have:

```text
1. Dashboard / Overview
2. List / Table View
3. Create / Edit Form
4. Detail Drawer
5. Approval Workflow if needed
6. Reports
7. Audit History
8. Export / Print
9. Role-Based Access
```

This structure keeps SchoolOS consistent, scalable, and easier to implement across web and mobile while preserving tenant isolation, financial correctness, auditability, protected file access, and school-friendly workflows.
