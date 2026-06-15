# SchoolOS Screen Contract Matrix

**Status:** Planning baseline  
**Last updated:** 2026-06-15  
**Phase:** Planning only — this matrix must be completed/validated before frontend/mobile implementation starts  
**Purpose:** Convert SchoolOS web/mobile screen plans into implementation-ready contracts that connect screen design, role access, permissions, API routes, backend gaps, frontend components, and tests.

Related docs:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md
docs/design/SCHOOLOS_UI_UX_CONSOLIDATION_NOTES.md
docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md
docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md
```

---

## 1. How To Use This Matrix

Before implementing any screen, fill/verify the row for that screen.

Each screen must answer:

```text
What role uses it?
Which permission unlocks it?
Which data scope applies?
Which API powers it?
Is the backend contract already present?
Which UI components are needed?
Which state components are required?
Which tests prove it is safe?
```

A screen is not implementation-ready until its row has no unknown P0 contract gaps.

---

## 2. Column Definitions

| Column | Meaning |
|---|---|
| Module | SchoolOS module code/name. |
| Screen ID | Stable planning ID for tracking. |
| Screen | User-facing screen name. |
| Platform | Web, Mobile, Tablet/POS, Platform Web. |
| Primary roles | Main roles that use the screen. |
| Permission baseline | Primary permission(s) from permission catalog. |
| Data scope | School-wide, own class, own subject, own child, assigned trip, platform, etc. |
| Primary API contract | Existing/planned backend endpoint or API client family. |
| Backend status | Supported / verify / missing DTO / missing endpoint / missing scope / missing tests. |
| Component pattern | Dashboard, DataTable, Form Wizard, Detail, Builder, Scanner, Feed, Timeline, etc. |
| Required states | Loading, empty, error, permission denied, module locked, read-only, success, partial success. |
| Audit/file rules | Reason required, protected file, signed upload, export, etc. |
| Test/smoke | Persona/contract test requirement. |
| Priority | P0, P1, P2, Later. |

---

## 3. Foundation Screens

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth | AUTH-W-01 | Login | Web | All | `auth.session.view` | Own session | `POST /auth/login` | Verify existing | Auth form | Loading, error, locked/throttled | Audit failed login where backend supports | Login smoke by role | P0 |
| Auth | AUTH-M-01 | Mobile Login | Mobile | Parent, student, teacher, driver, staff | `auth.session.view` | Own session | Mobile auth client | Verify existing | Mobile auth form | Loading, error, locked/throttled | Secure token/session storage | Mobile login smoke | P0 |
| Auth/RBAC | AUTH-W-02 | Session Restore / Me | Web/Mobile | All authenticated users | `auth.session.view` | Own session | `GET /api/v1/auth/me` | Verify/extend | Access provider | Loading, error, permission denied | None | `/auth/me` contract test | P0 |
| Layout | SHELL-W-01 | School AppShell + Sidebar | Web | Staff/admin roles | Derived from permissions | Tenant/school | `/auth/me` | Verify/extend | AppShell, Sidebar, Topbar | Loading, module locked, permission denied | None | Persona nav smoke | P0 |
| Layout | SHELL-W-02 | PlatformShell | Platform Web | Platform operator | `platform.dashboard.view` | Platform | `/auth/me`, platform dashboard | Verify | Platform shell | Loading, permission denied | Support override banner where active | Platform smoke | P0 |
| Layout | SHELL-M-01 | MobileShell | Mobile | Parent, student, teacher, driver, staff | Derived from permissions | Scoped | `/auth/me`, mobile dashboard | Verify/extend | Mobile shell, bottom nav | Loading, offline, permission denied | None | Mobile persona nav smoke | P0 |
| RBAC | RBAC-W-01 | Users Workspace | Web | Owner, school admin | `users.view`, `users.manage` | School | Users API | Verify | DataTable + action dialogs | Loading, empty, error, permission denied | Role changes audited | Admin user smoke | P1 |
| RBAC | RBAC-W-02 | Roles and Permissions | Web | Owner, school admin | `roles.view`, `roles.manage`, `roles.assign` | School | Roles API | Verify/extend | Permission matrix | Loading, empty, error, permission denied | Privilege escalation blocked | Permission tests | P1 |
| Settings | SET-W-01 | School Settings | Web | Owner, school admin | `settings.school.view`, `settings.school.manage` | School | Settings API | Verify | Sectioned settings forms | Loading, error, success, permission denied | Logo/file protected if private | Settings smoke | P1 |

---

## 4. Dashboard Screens

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | DASH-W-01 | Owner Executive Overview | Web | Owner/director | Executive/report permissions by module | School summary | `GET /dashboard/owner` or existing summary | Likely verify/missing summary | KPI dashboard | Loading, empty, error, module locked | No sensitive payroll/accounting unless permission | Owner dashboard smoke | P0 |
| Dashboard | DASH-W-02 | Principal School Operations Overview | Web | Principal | Academic/operation view permissions | School operational | `GET /dashboard/principal` | Likely verify/missing summary | Operations dashboard | Loading, empty, error | None | Principal dashboard smoke | P0 |
| Dashboard | DASH-W-03 | Office Dashboard | Web | School admin, admission officer | `students.directory.view`, `admissions.pipeline.view` | School | `GET /dashboard/office` | Likely missing | Task dashboard | Loading, empty, error | None | Office persona smoke | P1 |
| Dashboard | DASH-W-04 | Finance Today | Web | Accountant, cashier, owner if permitted | `fees.dashboard.view` | School/counter | `GET /dashboard/finance` | Verify/missing | Money dashboard | Loading, empty, error, permission denied | Financial values official backend totals | Finance smoke | P0 |
| Dashboard | DASH-W-05 | My Classes Today | Web | Class teacher, subject teacher | Teacher own permissions | Own class/subjects | `GET /dashboard/teacher` | Verify/missing | Teacher dashboard | Loading, empty, error | None | Teacher smoke | P0 |
| Dashboard | DASH-M-01 | Parent My Child Overview | Mobile | Parent | Parent child permissions | Own child | `GET /mobile/dashboard/parent` | Likely missing/scoped | Mobile cards | Loading, empty, error, offline | Own child only | Parent smoke | P0 |
| Dashboard | DASH-M-02 | Student My Learning Today | Mobile | Student | Student own permissions | Own data | `GET /mobile/dashboard/student` | Likely missing/scoped | Mobile cards | Loading, empty, error, offline | Published/own data only | Student smoke | P1 |
| Dashboard | DASH-M-03 | Driver My Assigned Trip | Mobile | Driver/conductor | `driver.trip.operate_assigned` | Assigned trip | `GET /mobile/dashboard/driver` | Likely missing/scoped | Trip card/action panel | Loading, empty, error, offline/pending | Assigned trip only | Driver smoke | P1 |
| Dashboard | DASH-W-06 | Platform Attention Dashboard | Platform Web | Platform operator | `platform.dashboard.view` | Platform | `GET /platform/dashboard` | Verify/missing | Platform dashboard | Loading, empty, error | Audit/security alerts | Platform smoke | P0 |

---

## 5. M1 Students and Admissions

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M1 Students | M1-W-01 | Student Directory | Web | Admin, principal, class teacher scoped | `students.directory.view` | School or own class | Students list API | Verify pagination/scope | DataTable + FilterBar | Loading, empty, error, permission denied, module locked | No private docs in rows | Admin/teacher scoped smoke | P0 |
| M1 Students | M1-W-02 | Student Profile | Web | Admin, principal, class teacher scoped | `students.profile.view` / `students.profile.view_scoped` | School or scoped | Student detail API | Verify scope | Detail/profile tabs | Loading, error, permission denied | Sensitive sections permission-gated | Student profile smoke | P0 |
| M1 Students | M1-W-03 | Guardian Management | Web | Admin, admission officer | `students.guardian.manage` | School | Guardian API | Verify | Cards + forms | Loading, empty, error | Guardian data private | Guardian smoke | P1 |
| M1 Students | M1-W-04 | Student Documents | Web | Admin/office | `students.documents.view` | School | Student document API | Verify protected files | File list/detail | Loading, empty, error, permission denied | Protected preview/download | File contract test | P0 |
| M1 Students | M1-W-05 | Student Photo | Web | Admin/class teacher with permission | `students.photo.upload` | School/scoped | Student photo API | Verify protected files | Upload/preview | Loading, error, success | Protected preview/upload/remove | Photo smoke | P1 |
| M1 Students | M1-W-06 | Student QR/Identity | Web | Admin/authorized roles | `students.qr.view`, `students.qr.generate` | School | Student QR API | Verify | QR lifecycle panel | Loading, empty, error | Rotate/revoke audited | QR smoke | P1 |
| M1 Students | M1-W-07 | Lifecycle Timeline | Web | Admin/principal | `students.lifecycle.view` | School | Lifecycle API | Verify | Timeline | Loading, empty, error | Transfer/archive reason required | Lifecycle tests | P1 |
| M1 Students | M1-W-08 | iEMIS Readiness | Web | Admin/owner | `students.iemis.view`, `students.iemis.export` | School | iEMIS export API | Verify file registry | Readiness table/export | Loading, empty, error, partial success | Protected CSV export | Export smoke | P1 |
| M1 Students | M1-M-01 | Parent Child Summary | Mobile | Parent | `parent.child.profile.view` | Own child | Mobile parent student API | Likely missing/scoped | Mobile child card | Loading, error, offline | Own child only | Parent child scope test | P0 |
| M1 Students | M1-M-02 | Student My Profile | Mobile | Student | `student.profile.view_own` | Own data | Mobile student profile API | Likely missing/scoped | Mobile profile card | Loading, error, offline | Own data only | Student scope test | P1 |
| M1 Admissions | M1-W-09 | Admissions Pipeline | Web | Admission officer/admin | `admissions.pipeline.view` | School | Admissions API | Verify | Board/table hybrid | Loading, empty, error | None | Admissions smoke | P1 |
| M1 Admissions | M1-W-10 | Application Detail | Web | Admission officer/admin | `admissions.application.view` | School | Application detail API | Verify | Detail sections | Loading, error | Documents private | Application smoke | P1 |
| M1 Admissions | M1-W-11 | Duplicate Review | Web | Admission officer/admin | `admissions.duplicate.resolve` | School | Duplicate API | Verify blockers/preview | Candidate comparison | Loading, empty, error | Merge reason/audit | Duplicate test | P1 |
| M1 Admissions | M1-W-12 | Enrollment Confirmation | Web | Admission officer/admin | `admissions.enrollment.confirm` | School | Enrollment API | Verify | Confirmation review | Loading, error, success | Enrollment audited | Enrollment test | P1 |

---

## 6. M2 Attendance

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M2 Attendance | M2-W-01 | Mark Attendance | Web | Class teacher | `attendance.mark.own_class` | Own class | Attendance marking API | Verify scope/lock | Roster form | Loading, empty, error, locked, success | Correction path if locked | Teacher attendance smoke | P0 |
| M2 Attendance | M2-M-01 | Teacher Mobile Attendance | Mobile | Class teacher | `teacher.attendance.mobile_mark` | Own class | Mobile attendance API | Verify/missing offline contract | Mobile roster form | Loading, offline, pending sync, error | Prevent duplicate submit | Mobile attendance smoke | P0 |
| M2 Attendance | M2-W-02 | Monthly Register | Web | Admin/principal/teacher scoped | `attendance.register.view_school` / scoped | School or own class | Attendance register API | Verify official totals/export | Register table | Loading, empty, error | Export protected | Register smoke | P1 |
| M2 Attendance | M2-W-03 | Corrections Queue | Web | Teacher/admin/principal | `attendance.correction.review` | School/scoped | Corrections API | Verify workflow states | Queue table | Loading, empty, error | Approval/rejection reason | Correction tests | P1 |
| M2 Attendance | M2-M-02 | Parent Attendance | Mobile | Parent | `parent.child.attendance.view` | Own child | Mobile parent attendance API | Verify/missing | Calendar/cards | Loading, empty, error, offline | Own child only | Parent attendance scope | P0 |
| M2 Attendance | M2-M-03 | Student Attendance | Mobile | Student | `student.attendance.view_own` | Own data | Mobile student attendance API | Verify/missing | Summary cards | Loading, empty, error, offline | Own data only | Student attendance scope | P1 |
| M2 Attendance | M2-W-04 | Principal Attendance Alerts | Web/Mobile | Principal | `attendance.dashboard.view` | School | Dashboard/principal attendance summary | Likely missing summary | Alert cards | Loading, empty, error | None | Principal alert smoke | P0 |

---

## 7. M3 Fees and Receipts

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M3 Fees | M3-W-01 | Finance Today | Web | Accountant/owner | `fees.dashboard.view` | School | Finance dashboard API | Verify/missing summary | Money dashboard | Loading, empty, error, permission denied | Official totals only | Finance dashboard smoke | P0 |
| M3 Fees | M3-W-02 | Fee Setup | Web | Accountant/admin | `fees.setup.manage` | School | Fee setup API | Verify | Forms/tables | Loading, empty, error, success | Fee changes audited as needed | Fee setup smoke | P1 |
| M3 Fees | M3-W-03 | Invoice List | Web | Accountant/cashier | `fees.invoice.view` | School/counter | Invoice list API | Verify pagination | DataTable | Loading, empty, error | None | Invoice smoke | P0 |
| M3 Fees | M3-W-04 | Student Ledger | Web | Accountant/cashier/admin scoped | `fees.ledger.view` | School/scoped | Ledger API | Verify scope | Ledger timeline/table | Loading, empty, error | Money official backend values | Ledger smoke | P0 |
| M3 Fees | M3-W-05 | Payment Collection | Web/Tablet | Cashier/accountant | `fees.payment.collect` | Assigned tenant/counter | Payment API | Verify idempotency | Counter workflow | Loading, error, pending, success | Receipt protected, double-submit safe | Cashier payment test | P0 |
| M3 Fees | M3-W-06 | Receipts | Web | Cashier/accountant | `fees.receipt.view`, `fees.receipt.download` | School/counter | Receipt API | Verify protected download | DataTable + receipt viewer | Loading, empty, error | Reprint reason required | Receipt tests | P0 |
| M3 Fees | M3-W-07 | Refund/Reversal Requests | Web | Accountant/principal/owner | `fees.payment.refund`, `fees.payment.reverse` | School | Reversal/refund API | Verify audit | Approval queue | Loading, empty, error | Reason/approval required | Reversal tests | P1 |
| M3 Fees | M3-W-08 | Cashier Close | Web | Cashier/accountant | `fees.cashier_close.create` | Counter/school | Cashier close API | Verify audit/reopen | Preview + confirm | Loading, error, success | Close/reopen reason | Cashier close test | P0 |
| M3 Fees | M3-M-01 | Parent Fees | Mobile | Parent | `parent.child.fees.view` | Own child | Mobile parent fees API | Likely missing/scoped | Due cards | Loading, empty, error, offline | Own child only | Parent fees scope | P0 |
| M3 Fees | M3-M-02 | Receipt Viewer | Mobile | Parent | `parent.child.receipt.download` | Own child | Mobile receipt API | Verify protected download | Receipt cards | Loading, empty, error | Protected PDF | Parent receipt test | P0 |

---

## 8. M4 Academics / Exams / Report Cards

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M4 Academics | M4-W-01 | Academic Setup | Web | Academic coordinator/admin | `academics.setup.manage` | School | Academic setup API | Verify | Setup forms | Loading, error, success | None | Academic setup smoke | P1 |
| M4 Academics | M4-W-02 | Marks Entry | Web | Subject teacher/coordinator | `academics.marks.enter_assigned` | Own subject/classes | Marks API | Verify scope/validation | Marks grid | Loading, empty, error, locked, partial success | Lock/unlock audited | Marks scope tests | P0 |
| M4 Academics | M4-W-03 | CAS Entry | Web | Teacher/coordinator | `academics.cas.enter_assigned` | Own class/subject | CAS API | Verify | Grid/table | Loading, empty, error, locked | None | CAS smoke | P1 |
| M4 Academics | M4-W-04 | Report Cards | Web | Coordinator/principal | `academics.report_cards.generate` | School | Report card API | Verify readiness/protected PDF | Batch table/preview | Loading, empty, error, partial success | Protected PDF | Report card tests | P0 |
| M4 Academics | M4-W-05 | Result Publishing | Web | Principal/coordinator | `academics.results.publish` | School | Result publish API | Verify blockers/audit | Readiness/confirm | Loading, error, success | Publish/unpublish reason/audit | Publish tests | P0 |
| M4 Academics | M4-M-01 | Parent Report Cards | Mobile | Parent | `parent.child.report_card.download_published` | Own child | Mobile parent results API | Verify/missing scoped | Published result card | Loading, empty, error | Published only, protected PDF | Parent result scope | P0 |
| M4 Academics | M4-M-02 | Student Results | Mobile | Student | `student.results.view_published` | Own data | Mobile student results API | Verify/missing scoped | Result cards | Loading, empty, error | Published only | Student result scope | P1 |

---

## 9. M5 Activity Feed and Milestones

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M5 Activity | M5-W-01 | Activity Feed Workspace | Web | Teacher/admin | `activity.feed.view` | Assigned class/school | Activity API | Verify scope | Feed/list/composer | Loading, empty, error | Media protected | Activity smoke | P1 |
| M5 Activity | M5-W-02 | Audience Preview | Web | Teacher/admin | `activity.audience.preview` | Assigned audience | Audience preview API | Verify/missing | Recipient preview | Loading, empty, error | Prevent wrong audience | Audience test | P1 |
| M5 Activity | M5-W-03 | Moderation Queue | Web | Moderator/principal | `activity.moderation.view` | School | Moderation API | Verify | Queue | Loading, empty, error | Decision reason/audit | Moderation test | P1 |
| M5 Activity | M5-M-01 | Parent Activity Feed | Mobile | Parent | `parent.child.activity.view` | Own child/class | Mobile parent feed API | Verify/missing scoped | Feed cards | Loading, empty, error, offline | Consent-aware media | Parent feed scope | P1 |
| M5 Activity | M5-M-02 | Teacher Quick Post | Mobile | Teacher | `activity.post.create` | Assigned class | Mobile activity post API | Verify/missing | Composer | Loading, error, success | Audience preview/media protected | Teacher post smoke | P2 |

---

## 10. M6 Homework and Timetable

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M6 Homework | M6-W-01 | Homework Workspace | Web | Teacher/coordinator | `homework.assignment.view` | Assigned classes/subjects | Homework API | Verify scope | DataTable/cards | Loading, empty, error | Attachments protected | Homework smoke | P0 |
| M6 Homework | M6-W-02 | Homework Detail | Web | Teacher | `homework.assignment.view` | Assigned | Homework detail API | Verify | Detail + lifecycle | Loading, error | Attachments protected | Homework detail smoke | P1 |
| M6 Homework | M6-W-03 | Submissions Review | Web | Teacher | `homework.submission.review` | Assigned | Submissions API | Verify | Review table/cards | Loading, empty, error | Feedback audited? | Submission smoke | P1 |
| M6 Homework | M6-W-04 | Reminder Preview | Web | Teacher | `homework.reminder.preview` | Assigned recipients | Reminder preview API | Likely missing | Recipient preview | Loading, empty, error | Preview before send | Reminder test | P1 |
| M6 Homework | M6-M-01 | Parent Homework | Mobile | Parent | `parent.child.homework.view` | Own child | Mobile parent homework API | Verify/missing | Homework cards | Loading, empty, error | Own child only | Parent homework scope | P0 |
| M6 Homework | M6-M-02 | Student Homework | Mobile | Student | `student.homework.view_assigned`, `student.homework.submit` | Own assigned | Mobile student homework API | Verify/missing | Task cards/submit | Loading, offline, pending, error | Attachments protected | Student homework smoke | P1 |
| M6 Timetable | M6-W-05 | Timetable Builder | Web | Coordinator/admin | `timetable.builder.manage` | School | Timetable API | Verify conflict structure | Grid builder | Loading, error, conflict state | Publish/lock audited | Timetable builder smoke | P1 |
| M6 Timetable | M6-W-06 | Substitutions | Web | Coordinator/principal | `timetable.substitution.assign` | School | Substitution API | Verify availability/conflict | Assignment workspace | Loading, empty, error | Cancellation audited | Substitution tests | P1 |
| M6 Timetable | M6-M-03 | My Timetable | Mobile | Teacher/student | `teacher.timetable.view_own`, `student.timetable.view_own` | Own | Mobile timetable API | Verify/missing | Period cards | Loading, empty, error, offline | Own only | Timetable scope | P1 |

---

## 11. M7 HR and Payroll

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M7 HR | M7-W-01 | Staff Directory | Web | HR/admin/principal scoped | `hr.staff.view` | School/scoped | Staff API | Verify pagination | DataTable | Loading, empty, error | Confidential fields permission-gated | Staff smoke | P1 |
| M7 HR | M7-W-02 | Leave Queue | Web | HR/principal | `hr.leave.review` | School/staff | Leave API | Verify | Approval queue | Loading, empty, error | Approve/reject reason | Leave tests | P1 |
| M7 Payroll | M7-W-03 | Payroll Runs | Web | Payroll officer/owner if permitted | `payroll.run.view` | School | Payroll API | Verify confidentiality | DataTable + status | Loading, empty, error, permission denied | Salary confidential | Payroll smoke | P1 |
| M7 Payroll | M7-W-04 | Payroll Run Detail | Web | Payroll officer | `payroll.run.preview`, `payroll.run.approve` | School | Payroll run API | Verify blockers/steps | Stepper/state machine | Loading, error, success | Approve/post audited | Payroll tests | P1 |
| M7 Payroll | M7-M-01 | My Payslips | Mobile | Staff | `staff.payslip.view_own` | Own | Mobile staff payslip API | Verify/missing scoped | Payslip cards | Loading, empty, error | Protected PDF | Staff payslip scope | P1 |
| M7 HR | M7-M-02 | My Leave | Mobile | Staff/teacher | `staff.leave.request_own` | Own | Mobile staff leave API | Verify/missing | Leave cards/form | Loading, empty, error | None | Staff leave smoke | P1 |

---

## 12. M8A Library, M8B Transport, M8C Canteen

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M8A Library | M8A-W-01 | Library Desk | Web/Tablet | Librarian | `library.issue_return.issue`, `library.issue_return.return` | Library desk | Library issue/return API | Verify scanner-safe lookup | Scanner/search workflow | Loading, empty, error, success | Borrower identity only | Library desk smoke | P1 |
| M8A Library | M8A-M-01 | My Library | Mobile | Student/parent | `student.library.view_own`, `parent.child.library.view` | Own/child | Mobile library API | Verify/missing scoped | Due cards | Loading, empty, error | Own records only | Library scope tests | P2 |
| M8B Transport | M8B-W-01 | Transport Dashboard | Web | Transport manager/principal | `transport.dashboard.view` | School/transport | Transport dashboard API | Verify/missing summary | Status dashboard | Loading, empty, error | Safety alerts | Transport smoke | P1 |
| M8B Transport | M8B-M-01 | Driver Trip | Mobile | Driver/conductor | `driver.trip.operate_assigned` | Assigned trip | Mobile driver trip API | Likely missing/scoped | Trip action panel | Loading, offline, pending, error | Assigned only, emergency protected | Driver trip test | P1 |
| M8B Transport | M8B-M-02 | Parent Transport | Mobile | Parent | `parent.child.transport.view` | Own child | Mobile parent transport API | Likely missing/scoped | Transport status card | Loading, empty, error | Own child only | Parent transport scope | P1 |
| M8C Canteen | M8C-W-01 | Canteen POS / Serving | Web/Tablet | POS staff/canteen manager | `canteen.pos.access`, `canteen.pos.scan` | Assigned POS/school | Canteen POS API | Verify POS-safe DTO | Scanner/POS workflow | Loading, error, success | Wallet corrections audited | POS smoke | P1 |
| M8C Canteen | M8C-M-01 | Parent Canteen | Mobile | Parent | `parent.child.canteen.view` | Own child | Mobile parent canteen API | Verify/missing scoped | Balance/status cards | Loading, empty, error | Own child only | Parent canteen scope | P2 |

---

## 13. M9 Accounting and M10 Communication

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M9 Accounting | M9-W-01 | Accounting Dashboard | Web | Accountant/owner if permitted | `accounting.dashboard.view` | School | Accounting dashboard API | Verify/missing summary | Control dashboard | Loading, empty, error, permission denied | Permission-strict | Accounting smoke | P1 |
| M9 Accounting | M9-W-02 | Journals | Web | Accountant | `accounting.journal.view` | School | Journal API | Verify pagination/lock | DataTable | Loading, empty, error | Post/reverse reason | Journal tests | P1 |
| M9 Accounting | M9-W-03 | Journal Detail | Web | Accountant/approver | `accounting.journal.view` | School | Journal detail API | Verify | Debit/credit detail | Loading, error | Audit timeline | Journal detail smoke | P1 |
| M9 Accounting | M9-W-04 | Financial Reports | Web | Accountant/owner if permitted | `accounting.reports.view` | School | Accounting reports API | Verify protected export | Report filters/export | Loading, empty, error | Protected export | Report smoke | P1 |
| M10 Communication | M10-W-01 | Notice Composer | Web | Admin/principal/teacher if allowed | `notices.create`, `notices.audience.preview` | Assigned audience | Notice API | Verify recipient preview | Composer + preview | Loading, error, success | Recipient preview mandatory | Notice tests | P0 |
| M10 Communication | M10-W-02 | Messaging Inbox | Web | Teacher/admin/staff | `messages.inbox.view` | Own/assigned | Messaging API | Verify policy state | Inbox/thread | Loading, empty, error | School-hours policy | Messaging smoke | P1 |
| M10 Communication | M10-M-01 | Parent Notices | Mobile | Parent | `parent.notices.view` | Own audience | Mobile notices API | Verify scoped | Notice cards | Loading, empty, error, offline | Audience scoped | Parent notices smoke | P0 |
| M10 Communication | M10-M-02 | Parent Chat | Mobile | Parent | `parent.messages.reply_allowed` | Own conversations | Mobile chat API | Verify policy/scoped | Thread | Loading, empty, error | School-hours/data policy | Parent chat test | P1 |
| M10 Communication | M10-M-03 | Teacher Chat | Mobile | Teacher | `teacher.messages.reply_allowed` | Assigned conversations | Mobile chat API | Verify policy/scoped | Thread list/detail | Loading, empty, error | School-hours/data policy | Teacher chat test | P1 |

---

## 14. M12 Learning, Reports, Advanced Operations

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M12 Learning | M12-W-01 | Learning Activities | Web | Teacher/coordinator | `learning.activity.view` | Assigned/school | Learning API | Verify | Activity list/cards | Loading, empty, error | Resources protected | Learning smoke | P2 |
| M12 Learning | M12-M-01 | Student Learning | Mobile | Student | `student.learning.view_assigned` | Own assigned | Mobile learning API | Verify/missing scoped | Activity cards | Loading, empty, error | Own only | Student learning scope | P2 |
| Reports | REP-W-01 | Report Catalog | Web | Authorized roles | `reports.catalog.view` | Permission-filtered | Reports catalog API | Verify/missing filtered catalog | Report cards | Loading, empty, error | Permission-filtered | Report catalog smoke | P1 |
| Reports | REP-W-02 | Export History | Web | Authorized roles | `reports.export` | Permission-filtered | Export jobs API | Verify job metadata | DataTable | Loading, empty, error | Protected download | Export tests | P1 |
| Advanced | ADV-W-01 | Approval Center | Web | Owner/principal/admin by permission | `approvals.view`, `approvals.act` | Permission-filtered | Approval API | Verify/missing summary | Approval queue | Loading, empty, error | Reason/action audit | Approval tests | P1 |
| Advanced | ADV-M-01 | Approval Cards | Mobile | Owner/principal | `approvals.act` | Permission-filtered | Mobile approval API | Later | Approval cards | Loading, empty, error | Reason for reject/approve where needed | Mobile approval smoke | P2 |

---

## 15. Matrix Completion Rules

Before implementation starts, this matrix should be reviewed and extended until:

```text
1. Every planned web screen has a row.
2. Every planned mobile screen has a row.
3. Every row has a permission baseline.
4. Every row has an API contract or planned API family.
5. Every P0 screen has backend status marked as supported/verified or has an implementation task.
6. Every scoped user screen has a scope test.
7. Every private file screen has protected preview/download rules.
8. Every dangerous action has audit/reason rules.
```

---

## 16. Immediate P0 Rows To Finalize First

```text
AUTH-W-02 Session Restore / Me
SHELL-W-01 School AppShell + Sidebar
DASH-W-01 Owner Executive Overview
DASH-W-02 Principal School Operations Overview
DASH-M-01 Parent My Child Overview
M1-W-01 Student Directory
M1-W-02 Student Profile
M2-W-01 Mark Attendance
M2-M-01 Teacher Mobile Attendance
M2-M-02 Parent Attendance
M3-W-03 Invoice List
M3-W-05 Payment Collection
M3-W-06 Receipts
M3-M-01 Parent Fees
M4-W-02 Marks Entry
M4-W-04 Report Cards
M4-M-01 Parent Report Cards
M10-W-01 Notice Composer
M10-M-01 Parent Notices
```

These rows represent the first high-value implementation path once planning ends.
