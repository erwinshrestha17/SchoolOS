# SchoolOS Permission Catalog

**Status:** Planning baseline  
**Last updated:** 2026-06-15  
**Phase:** Planning only — permissions must be reviewed against backend implementation before development  
**Purpose:** Define stable permission names that can drive backend guards, frontend route guards, sidebar visibility, action visibility, mobile scoped screens, tests, and documentation.

---

## 1. Core Rule

SchoolOS must not hardcode access only by role display names.

Final rule:

```text
Roles are bundles of permissions.
Permissions decide access.
Scopes decide data boundaries.
Backend enforces truth.
Frontend reflects that truth.
```

Example:

```text
Principal may have academics.result.publish but not payroll.salary.view.
Teacher may have attendance.mark.own_class but not attendance.review.school.
Parent may have parent.child.view but only for linked children.
Driver may have transport.trip.operate_assigned but only for assigned trips.
```

---

## 2. Permission Naming Convention

Use this pattern:

```text
<module>.<resource-or-workflow>.<action-or-scope>
```

Examples:

```text
students.profile.view
students.profile.manage
attendance.mark.own_class
fees.payment.collect
academics.results.publish
transport.trip.operate_assigned
platform.tenant.suspend
```

Guidelines:

```text
Use lowercase.
Use dots for hierarchy.
Use own/scoped/school/all where needed.
Use action names that match product workflows.
Avoid generic permissions like manage_everything.
```

---

## 3. Permission Scopes

Some permissions require a relationship scope.

| Scope | Meaning |
|---|---|
| `own` | User's own profile/data only. |
| `own_class` | Class teacher's assigned class/section only. |
| `own_subject` | Subject teacher's assigned subject/classes only. |
| `assigned` | Assigned route/trip/counter/library desk/POS context only. |
| `child` | Parent/guardian's linked child/children only. |
| `school` | Whole tenant/school scope. |
| `platform` | Platform/SaaS operator scope outside tenant dashboard. |

---

## 4. Global / Cross-Cutting Permissions

```text
auth.session.view
settings.school.view
settings.school.manage
settings.academic.view
settings.academic.manage
users.view
users.invite
users.manage
users.disable
roles.view
roles.manage
roles.assign
audit.view
audit.export
files.preview
files.download
files.upload
files.delete
reports.catalog.view
reports.export
notifications.view
notifications.manage
approvals.view
approvals.act
```

---

## 5. M0 Platform Core Permissions

```text
platform.dashboard.view
platform.tenant.view
platform.tenant.create
platform.tenant.update
platform.tenant.suspend
platform.tenant.reactivate
platform.tenant.delete
platform.plan.view
platform.plan.manage
platform.billing.view
platform.billing.manage
platform.provider.view
platform.provider.manage
platform.provider.test
platform.queue.view
platform.queue.retry
platform.queue.discard
platform.audit.view
platform.audit.export
platform.support_override.open
platform.support_override.close
platform.support_override.view
platform.feature_flags.view
platform.feature_flags.manage
```

Notes:

```text
M0 is not part of customer school tiers.
Platform permissions must never appear in normal school dashboards.
Support override must be reasoned, time-limited, visible, and audited.
```

---

## 6. M1 Students Permissions

```text
students.directory.view
students.profile.view
students.profile.view_scoped
students.profile.create
students.profile.update
students.profile.archive
students.profile.transfer
students.profile.restore
students.guardian.view
students.guardian.manage
students.documents.view
students.documents.upload
students.documents.generate
students.documents.preview
students.documents.download
students.documents.revoke
students.photo.view
students.photo.upload
students.photo.remove
students.qr.view
students.qr.generate
students.qr.rotate
students.qr.revoke
students.lifecycle.view
students.lifecycle.manage
students.duplicate.view
students.duplicate.merge
students.iemis.view
students.iemis.export
```

Scoped examples:

```text
Class teacher: students.profile.view_scoped for own class.
Parent: parent.child.profile.view instead of admin student profile permission.
Student: student.profile.view_own.
```

---

## 7. M1 Admissions Permissions

```text
admissions.pipeline.view
admissions.application.view
admissions.application.create
admissions.application.update
admissions.application.approve
admissions.application.reject
admissions.application.archive
admissions.documents.view
admissions.documents.manage
admissions.duplicate.view
admissions.duplicate.resolve
admissions.bulk_import.view
admissions.bulk_import.run
admissions.enrollment.preview
admissions.enrollment.confirm
admissions.reports.view
```

---

## 8. M2 Attendance Permissions

```text
attendance.dashboard.view
attendance.mark.own_class
attendance.mark.assigned_class
attendance.mark.school
attendance.register.view_own_class
attendance.register.view_school
attendance.register.export
attendance.correction.request
attendance.correction.review
attendance.correction.approve
attendance.correction.reject
attendance.conflict.view
attendance.conflict.resolve
attendance.lock.view
attendance.lock.manage
attendance.working_day.view
attendance.working_day.manage
attendance.staff.view
attendance.staff.manage
attendance.reports.view
attendance.reports.export
```

Mobile/scoped:

```text
parent.child.attendance.view
student.attendance.view_own
teacher.attendance.mobile_mark
```

---

## 9. M3 Fees and Receipts Permissions

```text
fees.dashboard.view
fees.setup.view
fees.setup.manage
fees.invoice.view
fees.invoice.create
fees.invoice.update
fees.invoice.cancel
fees.ledger.view
fees.ledger.view_scoped
fees.payment.collect
fees.payment.view
fees.payment.reverse
fees.payment.refund
fees.receipt.view
fees.receipt.download
fees.receipt.reprint
fees.cashier_close.view
fees.cashier_close.create
fees.cashier_close.reopen
fees.discount.view
fees.discount.manage
fees.waiver.view
fees.waiver.manage
fees.defaulters.view
fees.reminders.preview
fees.reminders.send
fees.reports.view
fees.reports.export
```

Parent/mobile:

```text
parent.child.fees.view
parent.child.receipt.download
parent.child.payment.initiate
```

Audit-heavy actions:

```text
fees.payment.reverse
fees.payment.refund
fees.receipt.reprint
fees.cashier_close.reopen
fees.discount.manage
fees.waiver.manage
```

---

## 10. M4 Academics / Exams / CAS / Report Cards Permissions

```text
academics.dashboard.view
academics.setup.view
academics.setup.manage
academics.exam.view
academics.exam.manage
academics.exam_timetable.view
academics.exam_timetable.manage
academics.marks.view
academics.marks.enter_assigned
academics.marks.enter_school
academics.marks.lock
academics.marks.unlock
academics.cas.view
academics.cas.enter_assigned
academics.cas.enter_school
academics.report_cards.view
academics.report_cards.generate
academics.report_cards.preview
academics.report_cards.download
academics.results.view_unpublished
academics.results.publish
academics.results.unpublish
academics.promotion.view
academics.promotion.manage
academics.syllabus.view
academics.syllabus.manage
academics.reports.view
academics.reports.export
```

Parent/student:

```text
parent.child.results.view_published
parent.child.report_card.download_published
student.results.view_published
student.report_card.download_published
```

Important:

```text
Unpublished marks/results must never be exposed to parent/student scoped endpoints.
```

---

## 11. M5 Activity Feed and Milestones Permissions

```text
activity.feed.view
activity.post.create
activity.post.update_own
activity.post.delete_own
activity.post.delete_any
activity.post.publish
activity.post.unpublish
activity.audience.preview
activity.media.upload
activity.media.view
activity.media.download
activity.media.moderate
activity.moderation.view
activity.moderation.approve
activity.moderation.reject
activity.milestone.view
activity.milestone.create
activity.milestone.update
activity.reports.view
```

Parent/student:

```text
parent.child.activity.view
parent.child.media.view_consent_allowed
student.activity.view
```

---

## 12. M6 Homework Permissions

```text
homework.dashboard.view
homework.assignment.view
homework.assignment.create
homework.assignment.update_own
homework.assignment.update_any
homework.assignment.publish
homework.assignment.close
homework.assignment.cancel
homework.submission.view
homework.submission.review
homework.submission.return_for_correction
homework.reminder.preview
homework.reminder.send
homework.attachment.upload
homework.attachment.preview
homework.attachment.download
homework.reports.view
homework.reports.export
```

Parent/student:

```text
parent.child.homework.view
student.homework.view_assigned
student.homework.submit
student.homework.attachment.upload
```

---

## 13. M6 Timetable / Substitution Permissions

```text
timetable.view_school
timetable.view_own
timetable.builder.view
timetable.builder.manage
timetable.periods.view
timetable.periods.manage
timetable.rooms.view
timetable.rooms.manage
timetable.availability.view
timetable.availability.manage
timetable.workload_rules.view
timetable.workload_rules.manage
timetable.conflicts.view
timetable.conflicts.resolve
timetable.publish
timetable.lock
timetable.archive
timetable.substitution.view
timetable.substitution.assign
timetable.substitution.cancel
timetable.reports.view
```

Parent/student/mobile:

```text
parent.child.timetable.view
student.timetable.view_own
teacher.timetable.view_own
teacher.substitution.view_assigned
```

---

## 14. M7 HR and Payroll Permissions

```text
hr.dashboard.view
hr.staff.view
hr.staff.create
hr.staff.update
hr.staff.archive
hr.staff.terminate
hr.contract.view
hr.contract.manage
hr.leave.view
hr.leave.request_own
hr.leave.review
hr.leave.approve
hr.leave.reject
hr.leave.balance.view
hr.leave.balance.manage
hr.staff_attendance.view
hr.staff_attendance.manage
payroll.dashboard.view
payroll.salary_structure.view
payroll.salary_structure.manage
payroll.run.view
payroll.run.preview
payroll.run.create
payroll.run.approve
payroll.run.reject
payroll.run.mark_paid
payroll.run.post_to_accounting
payroll.payslip.view
payroll.payslip.download
payroll.reports.view
payroll.reports.export
```

Staff self-service:

```text
staff.profile.view_own
staff.leave.request_own
staff.leave.view_own
staff.payslip.view_own
staff.payslip.download_own
```

Important:

```text
Principal/owner do not automatically see salary details without payroll permissions.
```

---

## 15. M8A Library Permissions

```text
library.dashboard.view
library.catalog.view
library.catalog.manage
library.copy.view
library.copy.manage
library.issue_return.view
library.issue_return.issue
library.issue_return.return
library.reservation.view
library.reservation.manage
library.overdue.view
library.overdue.remind
library.fine.view
library.fine.manage
library.fine.post_to_fees
library.scanner.lookup
library.reports.view
library.reports.export
```

Parent/student:

```text
parent.child.library.view
student.library.view_own
```

---

## 16. M8B Transport Permissions

```text
transport.dashboard.view
transport.route.view
transport.route.manage
transport.stop.view
transport.stop.manage
transport.vehicle.view
transport.vehicle.manage
transport.vehicle.documents.view
transport.vehicle.documents.manage
transport.driver_assignment.view
transport.driver_assignment.manage
transport.student_assignment.view
transport.student_assignment.manage
transport.trip.view
transport.trip.view_assigned
transport.trip.start_assigned
transport.trip.update_assigned
transport.trip.complete_assigned
transport.trip.monitor_school
transport.trip.gps_ping
transport.trip.delay_broadcast
transport.trip.emergency_report
transport.reports.view
transport.reports.export
```

Parent/student/driver:

```text
parent.child.transport.view
student.transport.view_own
driver.trip.operate_assigned
driver.trip.manifest_view_assigned
```

---

## 17. M8C Canteen Permissions

```text
canteen.dashboard.view
canteen.pos.access
canteen.pos.scan
canteen.pos.serve
canteen.pos.sell
canteen.menu.view
canteen.menu.manage
canteen.meal_plan.view
canteen.meal_plan.manage
canteen.enrollment.view
canteen.enrollment.manage
canteen.wallet.view
canteen.wallet.top_up
canteen.wallet.correct
canteen.wallet.transaction.view
canteen.inventory.view
canteen.inventory.manage
canteen.supplier.view
canteen.supplier.manage
canteen.reports.view
canteen.reports.export
```

Parent/student:

```text
parent.child.canteen.view
student.canteen.view_own
```

Audit-heavy:

```text
canteen.wallet.correct
canteen.wallet.top_up
```

---

## 18. M9 Accounting and Finance Permissions

```text
accounting.dashboard.view
accounting.chart.view
accounting.chart.manage
accounting.journal.view
accounting.journal.create
accounting.journal.update_draft
accounting.journal.post
accounting.journal.reverse
accounting.journal.correct
accounting.period.view
accounting.period.close
accounting.period.reopen
accounting.voucher.view
accounting.voucher.create
accounting.voucher.post
accounting.bank_reconciliation.view
accounting.bank_reconciliation.manage
accounting.source_ledger.view
accounting.reports.view
accounting.reports.export
```

Important:

```text
Accounting is web-first and permission-strict.
Owner/principal summaries require accounting permission.
Posting/reversing/correcting requires reason and audit.
```

---

## 19. M10 Notices and Communication Permissions

```text
notices.dashboard.view
notices.view
notices.create
notices.update_own
notices.update_any
notices.audience.preview
notices.schedule
notices.send
notices.cancel
notices.delivery.view
notices.reports.view
messages.inbox.view
messages.thread.view
messages.thread.reply
messages.thread.close
messages.parent_teacher.view
messages.parent_teacher.reply
messages.availability.view
messages.availability.manage
messages.escalation.view
messages.escalation.review
messages.abuse_report.view
messages.abuse_report.review
```

Parent/teacher/mobile:

```text
parent.notices.view
parent.messages.thread.view_own
parent.messages.reply_allowed
teacher.messages.thread.view_assigned
teacher.messages.reply_allowed
student.notices.view
```

Important:

```text
Teacher-parent chat must respect school-hours and data-sharing policy.
Parent sees own conversations only.
```

---

## 20. M12 Learning Permissions

```text
learning.dashboard.view
learning.activity.view
learning.activity.create
learning.activity.update
learning.activity.publish
learning.activity.archive
learning.session.view
learning.session.launch
learning.session.close
learning.attempt.view
learning.attempt.review
learning.progress.view
learning.resources.view
learning.resources.upload
learning.resources.download
learning.reports.view
```

Parent/student:

```text
student.learning.view_assigned
student.learning.join_session
student.learning.submit_attempt
parent.child.learning.view
```

---

## 21. Default Role Bundles — Planning Baseline

These bundles are not final backend seed data yet. They are planning defaults.

| Role | Permission style |
|---|---|
| Platform Operator | `platform.*`, limited audited support override. |
| Owner / Director | Executive summaries, reports, approvals; sensitive payroll/accounting only if granted. |
| Principal | Operational and academic review/publish/approve; not automatic payroll/accounting deep access. |
| Academic Coordinator | M4/M6 academic operations, exams, timetables, report readiness. |
| School Admin / Office Admin | M1 records/admissions/settings/notices; no payroll/accounting by default. |
| Admission Officer | M1 admissions pipeline and enrollment handoff. |
| Class Teacher | Own class students, attendance, homework, activity, parent chat. |
| Subject Teacher | Own subject/classes, homework, marks/CAS, timetable, chat. |
| Accountant | M3/M9 finance/accounting, reports, reversals, exports. |
| Cashier | Fee collection, receipts, cashier close. |
| HR / Payroll Officer | M7 staff, leave, payroll, payslips. |
| Librarian | M8A desk, catalog, issue/return, overdue. |
| Transport Manager | M8B route/vehicle/trip operations. |
| Driver / Conductor | Assigned trip mobile-only. |
| Canteen Manager | M8C POS, menu, wallet, inventory, reports. |
| POS Staff | Canteen scan/serve/sell only. |
| Parent / Guardian | Own child scoped data and parent communication. |
| Student | Own learning, homework, timetable, published results. |
| Staff Self-Service | Own profile, leave, payslips where enabled. |

---

## 22. Permission Test Requirements

For every permission family, create tests for:

```text
Allowed role can access route/action.
Disallowed role cannot access route/action.
Scoped user cannot access another scope.
Parent cannot access another child.
Teacher cannot access another class/subject unless granted.
Driver cannot access another trip.
Student cannot access unpublished results.
Principal cannot see salary details without payroll permission.
Owner cannot access platform internals without platform role.
UI hidden action is also blocked by backend.
```

---

## 23. Open Planning Questions

```text
Should role bundles be seeded per school type: preschool, K-10, 11-12, K-12, K-12+Bachelors?
Should schools be able to create custom roles from these permissions in v1?
Which permissions are tier-gated by subscription plans?
Which permissions require approval workflows instead of direct actions?
Which actions require reason but no approval?
Which actions require both reason and approval?
```
