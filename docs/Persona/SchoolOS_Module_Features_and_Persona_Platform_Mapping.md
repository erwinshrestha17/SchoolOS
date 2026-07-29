# SchoolOS Module Features and Persona Platform Allocation

**Document type:** Target product allocation (web vs mobile × persona)  
**Audience:** Product, web, mobile, backend, QA, security  
**Status:** Target scope — not implementation, staging, or GA evidence  
**Version:** 1.1  
**Date:** 2026-07-29  

## Document Purpose

This document defines the recommended feature scope and platform allocation for all SchoolOS modules except **M14 — Intelligence / AI**.

It identifies:

- the core capabilities of each module;
- which features belong on the web application;
- which features belong in the mobile application;
- which personas should access each feature;
- the required role boundaries between Parent, Teacher, Admin, Principal, HR, and Accountant users.

This is a **target product allocation**, not a claim that every capability is currently implemented or production-ready. Module implementation evidence and known gaps remain in `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`. Product acceptance boundaries remain in `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`.

---

# 1. Included Modules

| Code | Module |
|---|---|
| M0 | Platform Core |
| M1 | Admissions and Student Profiles |
| M2 | Smart Attendance |
| M3 | Fees and Receipts |
| M4 | Academics, Exams, CAS and Report Cards |
| M5 | Activity Feed and Milestones |
| M6 | Homework and Timetable |
| M7 | HR and Payroll |
| M8 | Library |
| M9 | Transport |
| M10 | Canteen |
| M11 | Accounting and Finance |
| M12 | Notifications and Delivery |
| M13 | Learning Layer |
| M15 | Notices and Announcements |

## Excluded Module

| Code | Module | Status |
|---|---|---|
| M14 | Intelligence / AI | Excluded from this document |

---

# 2. Persona and Platform Model

| Persona | Web | Mobile App | Primary Purpose |
|---|---:|---:|---|
| Parent / Guardian | No | Yes | Linked-child information and parent actions |
| Teacher | Yes | Yes | Detailed academic work on web and frequent classroom work on mobile |
| Admin | Yes | No | School configuration and operational management |
| Principal | Yes | Yes | Oversight, approvals, attention items and executive monitoring |
| HR | Yes | No | Staff lifecycle, attendance, leave and payroll |
| Accountant | Yes | No | Fees, reconciliation, accounting and financial reporting |

## Platform Principle

The mobile app must not be a smaller copy of the web dashboard.

### Mobile should prioritize

- frequent tasks;
- time-sensitive actions;
- quick data capture;
- alerts and acknowledgements;
- offline-safe classroom workflows;
- lightweight approvals;
- persona-specific summaries.

### Web should prioritize

- configuration;
- bulk operations;
- complex forms;
- dense data tables;
- detailed corrections;
- exports and reports;
- audit history;
- high-risk financial and administrative actions.

---

# 3. Access-Level Terminology

| Access Level | Meaning |
|---|---|
| Full | Configure and operate the module |
| Scoped | Operate only assigned or permitted records |
| Oversight | View summaries, approve, reject or escalate |
| Self-service | Access only the user’s own information |
| Contextual | Receive only relevant alerts or limited information |
| Hidden | No navigation, API access or data visibility |

---

# M0 — Platform Core

## Core Features

- Tenant provisioning and lifecycle.
- Plans, subscriptions and module entitlements.
- Platform operator accounts.
- School users, roles and permissions.
- Authentication, passwords, sessions and device management.
- Support overrides and impersonation controls.
- Institution settings and branding.
- Branch and school configuration.
- Academic-calendar foundations.
- Feature flags and module enablement.
- File Registry and protected files.
- Storage-provider configuration.
- Notification-provider configuration.
- Queue health, retries and job diagnostics.
- Audit logs.
- Approval-workflow infrastructure.
- Shared export and document-generation infrastructure.
- Platform operational monitoring.

## Parent App

- Login and logout.
- Password recovery.
- Biometric or device unlock.
- Own sessions and device management.
- Revoke own sessions.
- Notification preferences.
- Language and accessibility settings.
- Guardian profile.
- Linked-child and linked-school switching.
- Privacy and consent settings.
- Help and account recovery.

## Teacher Web

- Own profile and security.
- Password and session management.
- Notification preferences.
- Appearance and language.
- Own device/session visibility.
- Read permitted school policies and settings.

## Teacher App

- Login and biometric unlock.
- Device registration.
- Secure local cache.
- Session-expiry cleanup.
- Offline and synchronization status.
- Personal preferences.
- Password and session controls.

## Admin Web

- Institution profile and branding.
- Branch and school structure.
- User account management.
- Role and permission assignment.
- Module entitlement visibility.
- School-level module configuration.
- Academic year and calendar settings.
- File and document settings.
- Notification-provider readiness.
- Approval-policy configuration.
- Audit-log review.
- Queue and failed-job visibility.
- Data export and retention controls.
- School onboarding checklist.

Admin must not manage platform-wide SaaS plans, other tenants or platform provider secrets unless separately assigned as a Platform Operator.

## Principal Web

- Own profile and security.
- Read institution configuration.
- Review module enablement and readiness.
- Review high-risk audit events.
- Approve designated configuration changes.
- View unresolved provider or queue failures.
- Review operational-readiness summaries.

## Principal App

- Own security and sessions.
- School operational-status summary.
- Critical configuration alerts.
- Provider failure alerts.
- Pending approval notifications.
- Emergency tenant or module-disabled state.

## HR Web

- Own account and sessions.
- HR-related role and permission requests.
- HR document-template access.
- HR export-job status.
- HR audit events.

## Accountant Web

- Own account and sessions.
- Finance-related roles and permissions.
- Finance export-job status.
- Finance document templates.
- Finance audit events.
- No platform SaaS billing access unless separately authorized.

---

# M1 — Admissions and Student Profiles

## Core Features

- Admission inquiries and applications.
- Admission cases and workflow stages.
- Applicant screening and review.
- Waitlist and capacity management.
- Student creation.
- Student demographic and contact details.
- Guardian and caregiver relationships.
- Guardian capability permissions.
- Emergency contacts.
- Student and guardian documents.
- Document verification.
- Duplicate-student detection and review.
- Enrollment and re-enrollment.
- Academic-year placement.
- Class and section assignment.
- Roll number and student identifiers.
- Student ID cards and QR codes.
- Transfer, withdrawal and graduation lifecycle.
- Historical enrollment.
- Restricted or sensitive profile fields.
- Medical and support summaries where approved.
- iEMIS and reporting-readiness validation.
- Student and guardian data-quality reports.

## Parent App

- View selected child profile.
- View class, section, roll number and academic year.
- View verified guardian relationships.
- View permitted emergency contacts.
- View approved student documents.
- Download protected ID card and approved records.
- View admission and enrollment status.
- Submit permitted profile-update requests.
- Report incorrect information.
- Request guardian-relationship review.
- View guardian capability permissions.
- Switch safely between multiple children and schools.
- Track correction requests.
- Update own contact information through controlled verification.

Parents must not directly modify official enrollment, class placement, custody restrictions or verified identity records.

## Teacher Web

- View assigned class and subject rosters.
- View permitted student profile information.
- View guardian contact information where operationally required.
- View medical, allergy or safety information where permitted.
- View historical enrollment context relevant to teaching.
- Print assigned-class directory.
- Submit profile-data concerns.

Teachers must not process admissions, link guardians, transfer students or access unrestricted student search.

## Teacher App

- Assigned roster.
- Student name, photo and permitted identifier.
- Quick guardian contact through approved route.
- Critical medical and safety summary.
- New-student and transferred-student indicators.
- Offline cached assigned roster.
- Report student-profile concerns.

## Admin Web

- Admission inquiry and application management.
- Applicant review, waitlist and acceptance.
- Student and guardian creation.
- Guardian capability assignment.
- Temporary guardian access.
- Relationship verification, suspension and revocation.
- Lost-phone and account-recovery support.
- Duplicate review and merging.
- Document upload and verification.
- Enrollment and class placement.
- Transfers and withdrawals.
- Student ID and QR generation.
- Bulk import and export.
- Data-quality reports.
- iEMIS-readiness validation.
- Full audit history.

## Principal Web

- Admission funnel and capacity summary.
- Waitlist and exception review.
- Sensitive admission approvals.
- Duplicate-review exceptions.
- Transfer and withdrawal oversight.
- Guardian-restriction approval.
- Student-data completeness summary.
- Enrollment trends and reports.

## Principal App

- Admission attention items.
- Capacity and waitlist alerts.
- Pending sensitive approvals.
- Student-safety or guardian-access escalation.
- Enrollment summary.

## HR Web

- Normally hidden from admissions.
- Limited student identity lookup only where required for staff-related workflows.
- No guardian administration.
- No unrestricted student documents.

## Accountant Web

- Student name and identifier.
- Active enrollment.
- Class and section.
- Billing guardian or payer information.
- No academic, medical or guardian-restriction access.

---

# M2 — Smart Attendance

## Core Features

- Student attendance.
- Staff attendance integration.
- Daily and homeroom attendance.
- Period attendance.
- Present, absent, late, excused and leave states.
- Early departure and authorized release.
- Attendance sessions.
- Draft and autosave.
- Offline attendance queue.
- Submission and finalization.
- Locking and correction workflow.
- Original-versus-corrected audit history.
- Attendance conflict detection.
- Duplicate synchronization prevention.
- Working-day and holiday policies.
- Exam-day attendance.
- Monthly registers.
- Attendance exports.
- Missing-attendance alerts.
- Repeated absence and lateness monitoring.
- Parent absence alerts.
- Principal anomaly dashboard.
- Leave and attendance reconciliation.

## Parent App

- Today’s attendance status.
- Daily and period attendance where enabled.
- Monthly attendance calendar.
- Attendance percentage.
- Absence, late and early-departure details.
- Approved leave visibility.
- Exact event time and notification time.
- Report incorrect attendance.
- Track correction requests.
- Submit student leave request where enabled.
- Receive corrected-attendance notification.
- View attendance history and patterns.

## Teacher Web

- Assigned-class attendance registers.
- Homeroom attendance.
- Period attendance for assigned subjects.
- Draft, submit and review attendance.
- Missing-record validation.
- Correction requests.
- Detailed class attendance reports.
- Date-range and student filters.
- Print and export assigned registers.
- Class-teacher attendance summaries.

## Teacher App

- Current-period or homeroom shortcut.
- Assigned roster only.
- Mark all present.
- Record exceptions quickly.
- Late, excused and absent reasons.
- Offline draft.
- Pending, synced and failed states.
- Conflict resolution.
- Submit and finalize where authorized.
- Correction request.
- Cached assigned roster.
- Assignment-removal cache purge.
- Sync-failure warning.

Teacher attendance writes must require the exact active homeroom or period-attendance capability.

## Admin Web

- Attendance policy and session configuration.
- Working-day and holiday calendar.
- Attendance correction administration.
- Lock and reopen workflows.
- Leave reconciliation.
- Early-departure and release records.
- Missing-class attendance dashboard.
- Monthly register generation.
- Bulk corrections with reason and audit.
- Attendance reports and exports.
- Parent dispute handling.
- Device and import administration where enabled.

## Principal Web

- School-wide attendance summary.
- Missing-submission dashboard.
- Absence and late anomalies.
- Repeated-absence attention list.
- Correction and reopen approvals.
- Teacher submission compliance.
- Class and grade comparisons.
- Attendance report review.

## Principal App

- Today’s school attendance.
- Classes not yet submitted.
- Unusual absence or late patterns.
- Pending correction approvals.
- Student safety and early-departure alerts.
- Drill-down to class or student context.
- No bulk attendance editing.

## HR Web

- Staff attendance configuration and review.
- Staff attendance records.
- Missing staff attendance.
- Staff correction workflow.
- Leave-to-attendance reconciliation.
- Staff attendance reports.
- Approved attendance handoff to payroll.

## Accountant Web

- Hidden from student attendance.
- Read-only approved staff attendance or paid-day totals where payroll reconciliation requires it.
- No attendance editing.

---

# M3 — Fees and Receipts

## Core Features

- Fee heads and categories.
- Fee plans and structures.
- Student fee assignments.
- Invoices and installments.
- Due ledger and balances.
- Scholarships, discounts and waivers.
- Penalties where approved.
- Cash, bank and digital-payment collection.
- Partial payments.
- Overpayment and credit handling.
- Payment intents and provider callbacks.
- Pending reconciliation.
- Confirmed receipts.
- Receipt PDF and reprint history.
- Refunds.
- Reversals and corrections.
- Cashier sessions and day-end close.
- Payment-method totals.
- Defaulter and aging reports.
- Parent reminders.
- Dispute and correction requests.
- M11 accounting handoff.
- Formal invoice sequences where verified.

## Parent App

- Fee summary by child.
- Outstanding and overdue amounts.
- Invoice and installment details.
- Scholarship, discount and waiver visibility.
- Payment history.
- Receipt details and protected download.
- Payment-provider workflow where enabled.
- Pending, failed and confirmed payment states.
- Counter-payment visibility.
- Bank or wallet reference.
- Request fee correction.
- Report missing cash payment.
- Request installment arrangement.
- Track refund or dispute status.
- Wrong-child and amount confirmation before payment.

## Teacher Web and App

- Hidden.
- Teachers must not see balances, discounts, payment history or finance internals.

## Admin Web

- Fee heads and school fee policies.
- Fee plans and student assignments.
- Invoice generation.
- Scholarship and waiver administration.
- Operational cashier workflow where assigned.
- Parent fee follow-up.
- Corrections and dispute routing.
- Receipt lookup and reprint.
- Defaulter list.
- Bulk invoicing and exports.
- Payment-provider operational status.
- Permission-controlled finance details.

## Principal Web

- Collection and outstanding summary.
- Scholarship and waiver oversight.
- Large adjustment, refund or reversal approvals.
- Aging and defaulter trends.
- Cashier-close exceptions.
- Payment-provider failure summary.
- Dispute and reconciliation attention items.
- Read-only finance drill-down unless separately authorized.

## Principal App

- Daily collection summary.
- Overdue and exception indicators.
- Pending high-value approvals.
- Failed reconciliation alert.
- Refund or reversal attention items.
- No payment entry or ledger editing.

## HR Web

- Hidden.
- Staff-related deductions belong to M7.

## Accountant Web

- Fee configuration review.
- Invoice and receivable ledger.
- Cashier and payment reconciliation.
- Payment-provider settlement.
- Receipt verification.
- Cashier close.
- Bank-deposit matching.
- Refund and reversal processing.
- Discounts and adjustment review.
- Aging and defaulter reports.
- M3-to-M11 posting status.
- Unposted or rejected finance events.
- Financial exports.
- Formal invoice and credit or debit note workflows where verified.

---

# M4 — Academics, Exams, CAS and Report Cards

## Core Features

- Academic years.
- Classes and sections.
- Subjects.
- Programs and streams for +2 where implemented.
- Teacher assignments.
- Theory, practical, project and internal components.
- Exam terms and assessment schedules.
- Assessment templates.
- Maximum marks and pass marks.
- Rubrics and grading scales.
- Continuous Assessment System records.
- Marks draft and autosave.
- Missing-mark validation.
- Marks submission and review.
- Marks locking and correction.
- Result calculation.
- Result readiness.
- Result withholding and scheduling.
- Result publication and withdrawal.
- Report-card generation.
- Protected report-card PDFs.
- Report-card regeneration and version history.
- Class-teacher and subject remarks.
- Promotion readiness and decisions.
- Academic reports and exports.
- NEB and +2 extensions where approved.

## Parent App

- Exam schedule.
- Published marks and results.
- Subject-wise outcome.
- Theory, practical, project and internal breakdown where published.
- Grading-system explanation.
- Teacher and class-teacher remarks.
- Provisional versus final result status.
- Corrected-result history.
- Published report-card download.
- Request result explanation or correction.
- Result-publication notification.
- No unpublished marks or internal review notes.

## Teacher Web

- Assigned subject assessments.
- Spreadsheet-style marks entry.
- Theory, practical, project and internal marks.
- CAS records.
- Rubrics.
- Draft and autosave.
- Missing-mark checks.
- Submit marks.
- Correction requests.
- Subject remarks.
- Subject analytics.
- Import from approved template.
- Export and print assigned result sheet.
- Class-teacher completion monitoring.
- Class-teacher remarks.
- Result-readiness submission.
- Assigned-student performance reports.

Teacher authority must match the active class, section, subject and component assignment. Class teachers may monitor completion across subjects but must not edit another teacher’s marks.

## Teacher App

- Assessment deadlines.
- Assigned assessment list.
- Limited marks entry where approved.
- Missing-mark indicator.
- Submit or request correction.
- CAS or observation quick entry.
- Subject performance summary.
- Class readiness status.
- Push alerts for deadlines and returned submissions.
- No result publication, unlocking or configuration.

## Admin Web

- Academic structure configuration.
- Subject and curriculum setup.
- Teacher assignment administration.
- Exam term and component setup.
- Grading policies.
- Marks-entry windows.
- Missing-marks monitoring.
- Return and correction workflows.
- Result calculation and validation.
- Result publication.
- Report-card templates.
- Report-card generation and regeneration.
- Promotion workflow.
- Bulk import and export.
- Academic reporting.
- +2 stream and practical setup where approved.

## Principal Web

- Exam-readiness dashboard.
- Missing marks and delayed submissions.
- Class and grade performance summary.
- Result approval.
- Publication authorization.
- Result withdrawal approval.
- Correction and unlock oversight.
- Promotion review.
- Report-card generation failures.
- Academic trend and exception reports.

## Principal App

- Exam progress.
- Missing-submission alerts.
- Results awaiting approval.
- Publication readiness.
- Correction or withdrawal approval.
- High-level performance summary.
- No bulk marks editing.

## HR Web

- Teacher assignment and workload projection.
- Staff availability for academic assignments.
- Qualification and specialization visibility.
- No marks, results or publication authority.

## Accountant Web

- Hidden.
- Only a permitted fee-result withholding indicator may be visible where required.
- No marks access.

---

# M5 — Activity Feed and Milestones

## Core Features

- Classroom activity posts.
- School activity posts.
- Photos, videos and attachments.
- Consent verification.
- Media processing.
- Audience selection and preview.
- Draft, publish and archive.
- Moderation and reporting.
- Student tagging.
- Teacher observations.
- Learning and development milestones.
- Supportive milestone labels.
- Parent linked-child feed.
- Sensitive-post approval.
- Post version and audit history.
- M12 notification handoff.

## Parent App

- Linked-child activity feed.
- Class and school updates.
- Approved photos and media.
- Milestone and observation summaries.
- Acknowledgement where enabled.
- Report inappropriate or incorrect content.
- Download permitted media.
- Publication time, author and revision status.
- No access to restricted content involving other children.

## Teacher Web

- Create assigned-class and subject activities.
- Upload protected media.
- Tag assigned students.
- Check consent status.
- Record observations and milestones.
- Save drafts.
- Edit permitted own posts.
- Select approved audiences.
- Submit sensitive content for moderation.
- Manage own post archive.
- Detailed activity history.

## Teacher App

- Camera capture.
- Compressed media upload.
- Quick activity draft.
- Student tagging from assigned roster.
- Observation and milestone entry.
- Offline draft.
- Submit for review.
- Processing or failed-upload state.
- Edit own unpublished draft.

## Admin Web

- School-wide activity authoring.
- Moderation queue.
- Consent-policy configuration.
- Audience management.
- Media review and removal.
- Reported-post handling.
- Milestone configuration.
- Archive and retention administration.
- Activity reports and exports.
- Audit history.

## Principal Web

- School-wide feed oversight.
- Sensitive-post approval.
- Moderation escalations.
- Consent and media-risk summary.
- Activity participation summary.
- Removal or correction approval.

## Principal App

- Recent school activities.
- Posts awaiting approval.
- Reported or sensitive-content alerts.
- Approve, reject or return with reason.
- No complex media administration.

## HR Web

- Internal staff-recognition posts where enabled.
- No unrestricted student activity access.
- Staff content should remain separate from parent-facing student content.

## Accountant Web

- Hidden.

---

# M6 — Homework and Timetable

## Core Homework Features

- Homework drafts.
- Assigned-subject homework.
- Homeroom and class tasks.
- Scheduling and publishing.
- Due dates.
- Protected attachments.
- Submission methods.
- Student or parent submissions where enabled.
- Late and overdue states.
- Teacher feedback.
- Return for correction.
- Resubmission.
- Reminders.
- Templates.
- Recurrence and duplication.
- Completion analytics.
- Archive and history.

## Core Timetable Features

- Class timetable.
- Teacher timetable.
- Subject, room and period allocation.
- Teacher availability.
- Workload checks.
- Conflict detection.
- Timetable versions.
- Compare, publish, lock and archive.
- Substitution queue.
- Eligible substitute suggestions.
- Assignment and cancellation.
- Exam-duty schedule.
- Timetable-change notifications.

## Parent App

- Child’s published homework.
- Due today, upcoming, overdue and completed grouping.
- Instructions and attachments.
- Teacher and subject.
- Submission method.
- Upload submission where permitted.
- View feedback and resubmission requests.
- Parent acknowledgement where required.
- Weekly timetable.
- Temporary timetable changes.
- Exam timetable.
- School closures and calendar changes.
- Substitution indicators.
- Report broken attachment or incorrect deadline.

## Teacher Web

- Assigned-subject homework creation.
- Homeroom class tasks.
- Templates and recurrence.
- Bulk duplication.
- Detailed attachments.
- Rubric builder.
- Review submissions.
- Feedback and grading for own subject.
- Request resubmission.
- Completion analytics.
- Archive management.
- Personal and assigned-class timetable.
- Substitution status.
- Exam-duty schedule.
- Class-teacher homework workload view.
- Deadline-clash review.

## Teacher App

- Create quick homework.
- Draft, publish or schedule.
- Add camera or photo attachment.
- Set due date.
- Review submissions.
- Quick feedback.
- Send reminder.
- Offline homework draft.
- Today’s timetable.
- Current and next period.
- Substitution and room-change alerts.
- Cached timetable.
- Sync status.

Teachers may create subject homework only for matching active assignments. Class-teacher status must not permit editing another teacher’s homework.

## Admin Web

- Timetable builder.
- Teacher, subject, room and period configuration.
- Workload and availability settings.
- Conflict resolution.
- Version comparison and publication.
- Substitution administration.
- Homework policy.
- School-wide homework monitoring.
- Archived homework administration.
- Attachment and template controls.
- Reports and exports.

## Principal Web

- Timetable readiness.
- Conflict and workload summary.
- Uncovered classes.
- Substitution exceptions.
- Homework publication and overload summary.
- Missing or delayed homework patterns.
- Approval of major timetable publication where required.

## Principal App

- Today’s timetable exceptions.
- Uncovered class or substitution alert.
- Teacher-absence impact.
- Homework-overload attention item.
- Published timetable summary.
- No timetable building.

## HR Web

- Teacher availability.
- Leave and timetable conflict projection.
- Staff workload summary.
- Training, leave and duty availability.
- No academic timetable publication unless separately authorized.

## Accountant Web

- Hidden.

---

# M7 — HR and Payroll

## Core Features

- Staff profiles.
- Employment records.
- Staff documents.
- Contracts and contract history.
- Qualifications.
- Departments and designations.
- Staff onboarding and offboarding.
- Leave types and balances.
- Leave requests and approvals.
- Staff attendance.
- Attendance corrections.
- Salary structures.
- Earnings, allowances and deductions.
- Payroll periods and runs.
- Paid days and unpaid leave.
- Payroll calculation.
- Payroll review and approval.
- Payslips.
- Payroll reports.
- Bank-payment files where approved.
- Payroll reversal and correction.
- Payroll-to-accounting handoff.
- Staff self-service.
- Statutory deduction configuration and reports.

Nepal statutory calculations such as TDS, PF/EPF, SSF, CIT, gratuity and festival allowance require qualified legal and accounting verification before production compliance claims.

## Parent App

- Hidden.

## Teacher Web

- Own staff profile.
- Own attendance history.
- Attendance correction request.
- Leave request.
- Leave balance and history.
- Own payslips.
- Own contract summary where permitted.
- Own workload summary.
- Download own protected documents.

## Teacher App

- Quick leave request.
- Leave status.
- Leave balance.
- Recent attendance.
- Attendance correction request.
- Recent payslip.
- Payslip notification.
- Own profile.
- Biometric protection for salary information.

## Admin Web

- Basic staff directory where permitted.
- User-to-staff linking.
- Operational role assignment.
- Department and designation configuration.
- Staff onboarding support.
- No unrestricted salary or bank access unless separately authorized.

## Principal Web

- Staff headcount and vacancy summary.
- Leave approval or escalation.
- Staff attendance anomalies.
- Contract-expiry attention.
- Payroll readiness and exception summary.
- Payroll final approval where required.
- Workforce and workload reports.
- Salary details only when explicitly authorized.

## Principal App

- Pending leave approvals.
- Staff absence impact.
- Contract-expiry alerts.
- Payroll awaiting approval.
- High-level payroll total.
- No salary-structure or bank-detail editing.

## HR Web

- Staff onboarding and profile administration.
- Contracts and employment history.
- Qualifications and documents.
- Departments and designations.
- Leave policies, balances and approvals.
- Staff attendance and corrections.
- Salary structures.
- Allowance and deduction setup.
- Payroll preparation and validation.
- Payroll run.
- Payslip generation.
- Payroll correction and reversal.
- Staff offboarding.
- HR reports and exports.
- Protected staff-document management.
- Statutory reports with verification status.
- HR audit history.

## Accountant Web

- Approved payroll totals.
- Payroll posting status.
- Salary payable and deduction payable schedules.
- Bank-payment reconciliation.
- Payroll-to-M11 posting.
- Payroll reversal accounting.
- No staff medical, disciplinary or unrelated HR documents.
- Salary-level access only where explicitly required.

---

# M8 — Library

## Core Features

- Book and resource catalogue.
- Authors, publishers, subjects and categories.
- Physical and digital copies.
- Accession numbers.
- Barcode and QR labels.
- Copy availability.
- Issue, return and renewal.
- Reservations and waitlist.
- Due dates.
- Fines and fine adjustments.
- Lost or damaged items.
- Borrower history.
- Reading lists.
- Teaching-resource requests.
- Library reports.
- Fine-to-fee and accounting handoff.
- Catalogue import and export.

A dedicated Librarian or Library Operator persona is recommended.

## Parent App

- Search permitted catalogue.
- View child’s borrowed books.
- Due dates and overdue items.
- Fine summary.
- Reservation status.
- Renewal request where allowed.
- Lost or damaged-item information.
- Library reminders.
- Recommended reading and class reading lists.

## Teacher Web

- Advanced catalogue search.
- Reserve resources.
- View own borrowed items and fines.
- Teaching-resource requests.
- Recommend reading.
- Create assigned-class reading lists.
- Printable reading lists.

## Teacher App

- Quick catalogue search.
- Availability.
- Own loans and due dates.
- Reservation.
- Due reminders.
- Limited reading-list access.

## Admin Web

- Catalogue administration.
- Copy and accession management.
- Issue, return and renewal.
- Reservations.
- Fine calculation and approved waiver.
- Lost and damaged processing.
- Barcode and QR label generation.
- Borrower management.
- Library reports.
- Import and export.
- Fine handoff to M3 or M11.
- Archive circulation records instead of unsafe deletion.

## Principal Web

- Collection and circulation summary.
- Overdue and lost-item trends.
- Fine and waiver oversight.
- Resource utilization.
- Acquisition needs.
- Exception approvals.

## Principal App

- Library attention summary.
- High overdue or loss alerts.
- Basic utilization dashboard.
- No circulation operations.

## HR Web

- Staff borrower records.
- Staff resource requests.
- Employee clearance during offboarding.
- No general catalogue administration unless assigned.

## Accountant Web

- Library fine and replacement-charge reconciliation.
- Approved accounting postings.
- No circulation-history browsing beyond financial need.

---

# M9 — Transport

## Core Features

- Routes and route versions.
- Stops and pickup or drop points.
- Vehicles.
- Vehicle documents and maintenance records.
- Drivers and conductors.
- Driver and vehicle assignment.
- Student transport enrollment.
- Route and stop assignment.
- Morning and afternoon trips.
- Boarding and deboarding.
- Pickup authorization.
- Delay and route-change alerts.
- Trip incidents.
- Latest vehicle status.
- GPS-provider readiness.
- Stale or unavailable location handling.
- Transport reports.
- Transport fee handoff.

A dedicated Transport Manager, Driver and Conductor persona is recommended.

## Parent App

- Child’s route and stop.
- Pickup and drop time.
- Assigned vehicle.
- Transport-contact information.
- Today’s trip status.
- Delay and route-change alerts.
- Boarding and deboarding confirmation.
- GPS or latest location only where verified.
- Clear stale or unavailable location state.
- Temporary pickup authorization.
- Report transport issues.
- Transport fee visibility through M3.

## Teacher Web

- No transport workspace.
- View transport information only where dismissal or student safety requires it.

## Teacher App

- Relevant delay alerts.
- Dismissal or boarding concern.
- Approved pickup arrangement.
- Emergency route alert.
- Contact transport office.

## Admin Web

- Route and stop configuration.
- Vehicle records.
- Driver and conductor assignment.
- Student enrollment and route assignment.
- Trip scheduling.
- Boarding and deboarding monitoring.
- Delay and incident management.
- Pickup authorization administration.
- GPS-provider status.
- Vehicle-document reminders.
- Transport reports.
- Transport-fee setup handoff.

## Principal Web

- Route and vehicle utilization.
- Delays and missed-trip summary.
- Safety incidents.
- Unassigned students or vehicles.
- Driver and vehicle document exceptions.
- GPS-provider failures.
- Transport performance and complaints.

## Principal App

- Active transport disruption.
- Emergency incident.
- Delayed or missing vehicle.
- Unresolved boarding concern.
- Route-change approval where configured.
- No route building.

## HR Web

- Driver and conductor employment records through M7.
- Qualification and document status.
- Leave and replacement availability.
- No student-route administration unless separately assigned.

## Accountant Web

- Transport-fee reconciliation through M3.
- Vehicle expense and vendor posting through M11.
- No child movement, route or GPS access beyond financial need.

---

# M10 — Canteen

## Core Features

- Menu planning.
- Meal items and prices.
- Meal plans and subscriptions.
- Dietary and allergy warnings.
- Student and staff canteen wallets.
- Wallet top-up.
- POS sales.
- Serving and redemption.
- Meal entitlement.
- Refunds and reversals.
- Daily settlement.
- Vendor and procurement records.
- Stock and ingredient records.
- Wastage.
- Canteen reports.
- Finance and accounting handoff.

A dedicated Canteen Manager, POS Operator and Serving Staff persona is recommended.

## Parent App

- View menu.
- View meal plan.
- Child allergy and dietary profile visibility.
- Wallet balance.
- Top-up where enabled.
- Purchase history.
- Meal consumption or serving status where supported.
- Spending controls.
- Report incorrect charge.
- Canteen closure or menu-change alerts.

## Teacher Web

- No financial or POS access.
- View permitted meal-supervision or safety information only.

## Teacher App

- Allergy warning for assigned students.
- Dietary restrictions.
- Canteen closure.
- Meal-service issue.
- Meal-supervision instruction.

## Admin Web

- Menu and pricing.
- Meal-plan setup.
- Wallet administration.
- POS operator configuration.
- Serving and transaction monitoring.
- Refund and correction workflow.
- Allergy-policy administration.
- Vendor and procurement management.
- Stock and wastage.
- Canteen reports.
- Finance handoff.

## Principal Web

- Sales and meal-service summary.
- Subsidy or meal-plan oversight.
- Allergy and safety exceptions.
- Refund and correction approvals.
- Vendor and wastage summary.
- Operational performance reports.

## Principal App

- Canteen closure or safety alerts.
- Allergy incidents.
- Daily service exception.
- High-level sales or subsidy summary.
- No POS or wallet editing.

## HR Web

- Staff meal plans.
- Staff wallet or deduction setup where policy allows.
- Canteen staff employment records through M7.
- No student-wallet access unless operationally assigned.

## Accountant Web

- Wallet funding reconciliation.
- POS settlement.
- Refund and reversal accounting.
- Vendor payables.
- Stock and expense accounting.
- M10-to-M11 posting and exception review.

---

# M11 — Accounting and Finance

## Core Features

- Chart of accounts.
- Account groups.
- Fiscal years and periods.
- Opening balances.
- Journals.
- Vouchers.
- Receipts, payments and contra entries.
- Source-module posting.
- Idempotent posting from fees, payroll, library, transport and canteen.
- Posting review and rejection.
- Fiscal-period locks.
- Corrections and reversal entries.
- Bank accounts.
- Bank reconciliation.
- Cash book.
- General ledger.
- Trial balance.
- Receivables and payables.
- Income statement.
- Balance sheet.
- Cash-flow reports.
- Cost centers and branches where enabled.
- Accounting reports and protected exports.
- Audit trail.

## Parent App

- Hidden.

## Teacher Web and App

- Hidden.

## Admin Web

- High-level operational posting status.
- Source-event exception routing.
- Limited voucher request where permitted.
- No unrestricted journal editing or financial statements unless separately assigned.

## Principal Web

- Financial-position summary.
- Income and expense summary.
- Cash and bank overview.
- Budget-versus-actual where implemented.
- Pending posting or reconciliation issues.
- Fiscal-lock approval.
- Large or unusual voucher approval.
- Read-only financial statements.
- No routine ledger manipulation.

## Principal App

- High-level finance dashboard.
- Critical reconciliation failure.
- Large pending approval.
- Cash-position or overdue attention item.
- No journal entry or fiscal configuration.

## HR Web

- Payroll-posting status only.
- Deduction and salary payable schedules where authorized.
- No general ledger access.

## Accountant Web

- Chart of accounts.
- Fiscal-year and period configuration.
- Journals and vouchers.
- Source-module posting review.
- Fiscal locks.
- Corrections and reversals.
- Bank reconciliation.
- Cash and bank books.
- General ledger.
- Trial balance.
- Receivables and payables.
- Income statement.
- Balance sheet.
- Cash-flow reporting.
- Branch and cost-center reporting.
- Protected report generation.
- Audit and posting history.
- Period close and reopening with approval.

---

# M12 — Notifications and Delivery

## Core Features

- Normalized event intake from other modules.
- Recipient resolution.
- Parent-child and teacher-assignment filtering.
- In-app inbox.
- Read and unread state.
- Acknowledgements.
- Notification templates.
- Localization-ready content.
- User channel preferences.
- Push notifications.
- SMS.
- Email.
- Voice or fallback readiness where approved.
- Delivery queues.
- Retry policy.
- Provider callbacks.
- Deduplication.
- Severity and priority.
- Queued, accepted, delivered, read, acknowledged, failed and escalated states.
- Critical-alert escalation.
- Quiet hours and communication windows.
- Delivery diagnostics.
- Provider health.
- Delivery reports.

## Parent App

- Personal notification inbox.
- Child-specific filtering.
- Push notifications.
- Read and unread state.
- One-tap acknowledgement.
- Critical-alert acknowledgement.
- Notification preferences.
- Channel and quiet-hour preferences where allowed.
- Exact event time and delivery time.
- Superseded or corrected notice state.
- Generic lock-screen previews for sensitive information.
- Deep links to the relevant child and record.

## Teacher Web

- Personal inbox.
- Relevant operational alerts.
- Assigned-class communication status.
- Homework and marks reminder status.
- Attendance alert history.
- Acknowledgement reports for teacher-owned communication.
- Detailed delivery summary for permitted recipients.

## Teacher App

- Push notifications.
- Substitution alerts.
- Timetable changes.
- Attendance reminders.
- Marks deadlines.
- Homework reminders.
- Sync-failure alerts.
- One-tap acknowledgement.
- Deep links.
- Personal notification preferences.

## Admin Web

- Notification templates.
- Recipient and audience policies.
- Channel configuration.
- Provider readiness.
- Delivery queue.
- Failed and retried messages.
- Critical escalation rules.
- Quiet hours.
- Delivery diagnostics.
- Delivery and acknowledgement reports.
- Manual resend with permission and reason.
- Provider-disabled and partial-failure states.
- Audit history.

## Principal Web

- Critical-delivery dashboard.
- Failed emergency alerts.
- Unacknowledged critical notices.
- Provider reliability.
- Escalation status.
- High-level communication reach.
- Approve selected critical campaigns.

## Principal App

- Critical alerts.
- Unacknowledged emergency items.
- Delivery failure requiring intervention.
- Quick acknowledgement.
- Approve or escalate permitted urgent messages.
- No provider configuration.

## HR Web

- Staff notifications.
- Leave, attendance, contract and payroll alerts.
- HR campaigns to approved staff groups.
- HR delivery and acknowledgement reports.
- No parent or student targeting unless explicitly permitted.

## Accountant Web

- Fee reminders and receipt notifications.
- Payment-failure and reconciliation alerts.
- Finance-specific template use.
- Finance delivery status.
- No global provider or unrelated audience administration.

---

# M13 — Learning Layer

## Current Status

M13 is **GA-in-scope for Wave 5** (owner-approved 2026-07-29). Keep it disabled by default for new tenants, hidden from navigation when the entitlement is off, and entitlement-gated until Wave 5 exit evidence is recorded.

Until Wave 5 unfreeze evidence: only security, tenancy, suspended-tenant, protected-file, build, migration, OpenAPI, or repository-regression fixes may change M13. After Wave 5 unfreeze: feature work must stay within PRD M13 boundaries and pass `pnpm smoke:learning` as a GA gate.

Existing contracts, migrations, permissions, tests, and records remain protected. Do not delete Learning data or run destructive Learning migrations. M14 remains roadmap-only.

## Preserved Features

- Teacher-created learning activities.
- Controlled learning sessions.
- Session access codes or scoped access.
- Learning resources.
- Student attempts.
- Responses and submissions.
- Progress tracking.
- Session-scoped feedback.
- Teacher review.
- Parent learning summaries.
- Non-comparative progress views.
- Resource files and protected downloads.
- Session and attempt history.

## Parent App

- Linked-child learning summary.
- Assigned activity status.
- Teacher feedback.
- Progress summary.
- Recommended school-provided resources.
- No public rankings or comparisons.

## Teacher Web

- Create and configure learning activities.
- Attach resources.
- Create controlled sessions.
- Review attempts.
- Provide feedback.
- View assigned-student progress.
- Export permitted learning reports.

## Teacher App

- Launch or manage a session.
- Quick review.
- Capture observations.
- View progress summary.
- Session alerts.

## Admin Web

- Module enablement.
- Learning policy.
- Activity and resource administration.
- Access and retention controls.
- School-wide operational reports.

## Principal Web and App

- Participation and progress oversight.
- Low-engagement attention items.
- No direct modification of teacher-owned feedback.

## HR and Accountant Web

- Hidden.

---

# M15 — Notices and Announcements

## Core Features

- Notice drafts.
- Notice categories and priority.
- Audience targeting.
- Class, section, role and individual audiences.
- Recipient preview.
- Approval workflow.
- Scheduling.
- Publication.
- Protected attachments.
- Versioning.
- Correction and replacement notices.
- Withdrawal and archive.
- Read and acknowledgement state.
- Acknowledgement deadlines.
- Notice reports.
- M12 delivery handoff.
- Delivery and acknowledgement reconciliation.

M15 owns notice creation and publication. M12 owns delivery channels, retries, provider callbacks and delivery states.

Chat and open conversations are not part of M15.

## Parent App

- Relevant school and class notices.
- Urgent-announcement banner.
- Protected attachments.
- Translation availability.
- Read state.
- Required acknowledgement.
- Corrected or superseded notice status.
- Calendar integration for dated events.
- Notice search and archive.
- No unrestricted reply or open chat.

## Teacher Web

- Read school and staff notices.
- Draft class or subject notices where permitted.
- Recipient preview for assigned scope.
- Schedule or submit for approval.
- Protected attachments.
- Acknowledgement report for owned notices.
- Delivery summary.
- No targeting of unassigned classes.
- No school-wide publishing without authority.

## Teacher App

- Read and acknowledge notices.
- Push notification.
- Open attachments.
- Draft a simple assigned-class notice where allowed.
- Submit notice for approval.
- View owned-notice acknowledgement summary.
- No complex audience administration.

## Admin Web

- Full notice authoring.
- Category and priority configuration.
- Audience targeting.
- Recipient preview.
- Approval routing.
- Schedule and publish.
- Version and correction management.
- Attachments.
- Withdrawal and archive.
- Acknowledgement tracking.
- Delivery handoff and reports.
- Official-notice audit trail.

## Principal Web

- Draft leadership notices.
- Approve high-impact notices.
- Preview exact recipients.
- Schedule or publish.
- Review acknowledgements.
- Correct, withdraw or replace official notices.
- School-wide notice history.

## Principal App

- Review pending notices.
- Recipient and impact summary.
- Approve, reject or return.
- Publish urgent approved notices.
- Track critical acknowledgements.
- Correct or withdraw only through controlled confirmation.

## HR Web

- Staff notices.
- Policy, leave, training and HR announcements.
- Staff audience targeting.
- Acknowledgement tracking.
- No parent or student targeting unless explicitly authorized.

## Accountant Web

- Finance-office notices.
- Fee-deadline and counter-closure announcements.
- Approved finance audience targeting.
- Acknowledgement and delivery status.
- No unrelated school-wide publishing.

---

# 4. Recommended Persona Navigation

## Parent App

```text
Home
Updates
Calendar
Requests
Profile
```

Contextual child areas:

- Profile.
- Attendance.
- Fees and receipts.
- Results and report cards.
- Homework and timetable.
- Activities.
- Library.
- Transport.
- Canteen.
- Notices.
- Notifications.
- Learning only when M13 is reactivated.

## Teacher Web

```text
Home
My Students
Attendance
Homework
Assessments and Marks
Activities
Timetable
Class Reports
Notices
Notifications
Library
My Workspace
```

`My Workspace` should contain:

- Leave.
- Staff attendance.
- Payslips.
- Profile.
- Security.
- Preferences.

The Teacher web workspace must show only assigned classes, sections and subjects.

## Teacher App

```text
Today
Attendance
Classes
Homework
More
```

`More` should contain:

- Marks.
- Timetable.
- Activities.
- Notices.
- Notifications.
- Library.
- Leave.
- Payslips.
- Profile.
- Security.
- Synchronization.

## Admin Web

```text
Dashboard
Admissions
Students
Attendance
Fees
Academics
Activities
Homework
Timetable
Staff
Library
Transport
Canteen
Notifications
Notices
Reports
Settings
Audit
```

Admin access to payroll, accounting, provider secrets and sensitive data must remain permission-specific.

## Principal Web

```text
Executive Dashboard
Attention Items
Approvals
Students and Admissions
Attendance
Finance Overview
Academic Readiness
Staff Overview
Operations
Communication
Reports
Audit
```

## Principal App

```text
Overview
Attention
Approvals
School
Notifications
```

## HR Web

```text
HR Dashboard
Staff
Contracts
Attendance
Leave
Payroll
Payslips
Reports
Documents
HR Notices
Settings
```

## Accountant Web

```text
Finance Dashboard
Fees and Receipts
Cashier Close
Reconciliation
Accounting
Payroll Posting
Canteen Posting
Transport Posting
Library Posting
Reports
Finance Notices
Audit
```

---

# 5. Missing Operational Personas

The requested personas are not sufficient to operate every module realistically.

SchoolOS should eventually introduce these assignment-driven operational personas:

| Module | Recommended Additional Persona |
|---|---|
| M3 Fees and Receipts | Cashier |
| M4 Academics | Academic Coordinator |
| M4 Exams | Examination Coordinator |
| M8 Library | Librarian / Library Operator |
| M9 Transport | Transport Manager |
| M9 Transport | Driver |
| M9 Transport | Conductor |
| M10 Canteen | Canteen Manager |
| M10 Canteen | POS Operator |
| M10 Canteen | Serving Staff |
| M7 HR and Payroll | Payroll Approver |
| M15 Notices | Communication Officer |

These should be implemented as functional assignments and scoped capabilities rather than unnecessary unrestricted global roles.

Admin should not permanently absorb every specialist workflow.

---

# 6. Critical Role-Boundary Rules

## Parent

- Access only linked children.
- Never access other students.
- Never directly modify authoritative school records.
- Financial, academic and medical data must be limited to approved guardian capabilities.

## Teacher

- Access only actively assigned classes, sections and subjects.
- Subject teachers may edit only their assigned subject data.
- Class teachers may coordinate their assigned class but must not edit another teacher’s marks or homework.
- Assignment removal must revoke web, API, mobile and cached access.

## Admin

- Operates school-level configuration and workflows.
- Must not automatically receive unrestricted payroll, accounting, guardian restriction, medical or platform-operator access.
- Sensitive access must be explicit and audited.

## Principal

- Primarily oversight and approval.
- Should not be used as an unrestricted operational super-user.
- High-risk actions require explicit confirmation and audit.

## HR

- Access staff and payroll data.
- Must not receive broad student, guardian, academic or finance access.

## Accountant

- Access fees, finance, reconciliation and accounting.
- Must not receive academic, medical, guardian-restriction, transport-location or unrestricted HR data.

---

# 7. Final Product Principle

SchoolOS should use:

- role-based access control;
- assignment-based access control;
- tenant isolation;
- child-link scoping;
- branch scoping;
- module entitlements;
- explicit functional capabilities;
- approval workflows;
- immutable audit history;
- protected file access;
- fail-closed authorization.

The product should not grant access merely because a user has a broad role such as Teacher, Admin or Principal.

Every sensitive action must be authorized by:

1. tenant;
2. branch;
3. persona;
4. active assignment;
5. functional capability;
6. record scope;
7. module entitlement;
8. workflow state.

---

# 8. Document Status

**Status:** Target Product Scope and Persona Allocation (not implementation or GA evidence)  
**Canonical path:** `docs/Persona/SchoolOS_Module_Features_and_Persona_Platform_Mapping.md`  
**Related:** `docs/Persona/SchoolOS_Teacher_Persona_Access_Spec.md`; product ownership remains in `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`  
**M14:** Excluded (roadmap-only)  
**M13:** GA-in-scope Wave 5; disabled by default until Wave 5 exit evidence  
**Parent:** App Only  
**Teacher:** Web and App  
**Admin:** Web Only  
**Principal:** Web and App  
**HR:** Web Only  
**Accountant:** Web Only
