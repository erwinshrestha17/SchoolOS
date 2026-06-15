# SchoolOS Screen Contract Matrix

**Status:** Source of Truth  
**Last updated:** 2026-06-15  
**Phase:** Planning only — this matrix must be completed/validated before frontend/mobile implementation starts  
**Purpose:** Convert SchoolOS web/mobile screen plans into implementation-ready contracts that connect screen design, role access, permissions, API routes, backend gaps, frontend components, and tests.

Related docs:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/references/SCHOOLOS_ROLE_SCREEN_DESIGN_REFERENCE.md
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

## 3. P0 Foundation Matrix

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth | AUTH-W-01 | Login | Web | All | `auth.session.view` | Own session | `POST /auth/login` | Verify existing | Auth form | Loading, error, locked/throttled | Audit failed login where backend supports | Login smoke by role | P0 |
| Auth | AUTH-M-01 | Mobile Login | Mobile | Parent, student, teacher, driver, staff | `auth.session.view` | Own session | Mobile auth client | Verify existing | Mobile auth form | Loading, error, locked/throttled | Secure token/session storage | Mobile login smoke | P0 |
| Auth/RBAC | AUTH-W-02 | Session Restore / Me | Web/Mobile | All authenticated users | `auth.session.view` | Own session | `GET /api/v1/auth/me` | Verify/extend | Access provider | Loading, error, permission denied | None | `/auth/me` contract test | P0 |
| Layout | SHELL-W-01 | School AppShell + Sidebar | Web | Staff/admin roles | Derived from permissions | Tenant/school | `/auth/me` | Verify/extend | AppShell, Sidebar, Topbar | Loading, module locked, permission denied | None | Persona nav smoke | P0 |
| Layout | SHELL-W-02 | PlatformShell | Platform Web | Platform operator | `platform.dashboard.view` | Platform | `/auth/me`, platform dashboard | Verify | Platform shell | Loading, permission denied | Support override banner where active | Platform smoke | P0 |
| Layout | SHELL-M-01 | MobileShell | Mobile | Parent, student, teacher, driver, staff | Derived from permissions | Scoped | `/auth/me`, mobile dashboard | Verify/extend | Mobile shell, bottom nav | Loading, offline, permission denied | None | Mobile persona nav smoke | P0 |

---

## 4. P0 Dashboard Matrix

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | DASH-W-01 | Owner Executive Overview | Web | Owner/director | Executive/report permissions by module | School summary | `GET /dashboard/owner` or existing summary | Verify/missing summary | KPI dashboard | Loading, empty, error, module locked | No sensitive payroll/accounting unless permission | Owner dashboard smoke | P0 |
| Dashboard | DASH-W-02 | Principal School Operations Overview | Web | Principal | Academic/operation view permissions | School operational | `GET /dashboard/principal` | Verify/missing summary | Operations dashboard | Loading, empty, error | None | Principal dashboard smoke | P0 |
| Dashboard | DASH-W-03 | Finance Today | Web | Accountant/cashier/owner if permitted | `fees.dashboard.view` | School/counter | `GET /dashboard/finance` | Verify/missing summary | Money dashboard | Loading, empty, error, permission denied | Official backend totals only | Finance smoke | P0 |
| Dashboard | DASH-W-04 | My Classes Today | Web | Class teacher, subject teacher | Teacher own permissions | Own class/subjects | `GET /dashboard/teacher` | Verify/missing summary | Teacher dashboard | Loading, empty, error | None | Teacher smoke | P0 |
| Dashboard | DASH-M-01 | Parent My Child Overview | Mobile | Parent | Parent child permissions | Own child | `GET /mobile/dashboard/parent` | Likely missing/scoped | Mobile cards | Loading, empty, error, offline | Own child only | Parent smoke | P0 |
| Dashboard | DASH-W-05 | Platform Attention Dashboard | Platform Web | Platform operator | `platform.dashboard.view` | Platform | `GET /platform/dashboard` | Verify/missing | Platform dashboard | Loading, empty, error | Audit/security alerts | Platform smoke | P0 |

---

## 5. P0 Core Workflow Matrix

| Module | Screen ID | Screen | Platform | Primary roles | Permission baseline | Data scope | Primary API contract | Backend status | Component pattern | Required states | Audit/file rules | Test/smoke | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M1 Students | M1-W-01 | Student Directory | Web | Admin, principal, class teacher scoped | `students.directory.view` | School or own class | Students list API | Verify pagination/scope | DataTable + FilterBar | Loading, empty, error, permission denied, module locked | No private docs in rows | Admin/teacher scoped smoke | P0 |
| M1 Students | M1-W-02 | Student Profile | Web | Admin, principal, class teacher scoped | `students.profile.view` / `students.profile.view_scoped` | School or scoped | Student detail API | Verify scope | Detail/profile tabs | Loading, error, permission denied | Sensitive sections permission-gated | Student profile smoke | P0 |
| M1 Students | M1-W-03 | Student Documents | Web | Admin/office | `students.documents.view` | School | Student document API | Verify protected files | File list/detail | Loading, empty, error, permission denied | Protected preview/download | File contract test | P0 |
| M1 Students | M1-M-01 | Parent Child Summary | Mobile | Parent | `parent.child.profile.view` | Own child | Mobile parent student API | Likely missing/scoped | Mobile child card | Loading, error, offline | Own child only | Parent child scope test | P0 |
| M2 Attendance | M2-W-01 | Mark Attendance | Web | Class teacher | `attendance.mark.own_class` | Own class | Attendance marking API | Verify scope/lock | Roster form | Loading, empty, error, locked, success | Correction path if locked | Teacher attendance smoke | P0 |
| M2 Attendance | M2-M-01 | Teacher Mobile Attendance | Mobile | Class teacher | `teacher.attendance.mobile_mark` | Own class | Mobile attendance API | Verify/missing offline contract | Mobile roster form | Loading, offline, pending sync, error | Prevent duplicate submit | Mobile attendance smoke | P0 |
| M2 Attendance | M2-M-02 | Parent Attendance | Mobile | Parent | `parent.child.attendance.view` | Own child | Mobile parent attendance API | Verify/missing | Calendar/cards | Loading, empty, error, offline | Own child only | Parent attendance scope | P0 |
| M3 Fees | M3-W-01 | Invoice List | Web | Accountant/cashier | `fees.invoice.view` | School/counter | Invoice list API | Verify pagination | DataTable | Loading, empty, error | None | Invoice smoke | P0 |
| M3 Fees | M3-W-02 | Student Ledger | Web | Accountant/cashier/admin scoped | `fees.ledger.view` | School/scoped | Ledger API | Verify scope | Ledger timeline/table | Loading, empty, error | Official backend money values | Ledger smoke | P0 |
| M3 Fees | M3-W-03 | Payment Collection | Web/Tablet | Cashier/accountant | `fees.payment.collect` | Assigned tenant/counter | Payment API | Verify idempotency | Counter workflow | Loading, error, pending, success | Receipt protected, double-submit safe | Cashier payment test | P0 |
| M3 Fees | M3-W-04 | Receipts | Web | Cashier/accountant | `fees.receipt.view`, `fees.receipt.download` | School/counter | Receipt API | Verify protected download | DataTable + receipt viewer | Loading, empty, error | Reprint reason required | Receipt tests | P0 |
| M3 Fees | M3-M-01 | Parent Fees | Mobile | Parent | `parent.child.fees.view` | Own child | Mobile parent fees API | Likely missing/scoped | Due cards | Loading, empty, error, offline | Own child only | Parent fees scope | P0 |
| M4 Academics | M4-W-01 | Marks Entry | Web | Subject teacher/coordinator | `academics.marks.enter_assigned` | Own subject/classes | Marks API | Verify scope/validation | Marks grid | Loading, empty, error, locked, partial success | Lock/unlock audited | Marks scope tests | P0 |
| M4 Academics | M4-W-02 | Report Cards | Web | Coordinator/principal | `academics.report_cards.generate` | School | Report card API | Verify readiness/protected PDF | Batch table/preview | Loading, empty, error, partial success | Protected PDF | Report card tests | P0 |
| M4 Academics | M4-W-03 | Result Publishing | Web | Principal/coordinator | `academics.results.publish` | School | Result publish API | Verify blockers/audit | Readiness/confirm | Loading, error, success | Publish/unpublish reason/audit | Publish tests | P0 |
| M4 Academics | M4-M-01 | Parent Report Cards | Mobile | Parent | `parent.child.report_card.download_published` | Own child | Mobile parent results API | Verify/missing scoped | Published result card | Loading, empty, error | Published only, protected PDF | Parent result scope | P0 |
| M10 Communication | M10-W-01 | Notice Composer | Web | Admin/principal/teacher if allowed | `notices.create`, `notices.audience.preview` | Assigned audience | Notice API | Verify recipient preview | Composer + preview | Loading, error, success | Recipient preview mandatory | Notice tests | P0 |
| M10 Communication | M10-M-01 | Parent Notices | Mobile | Parent | `parent.notices.view` | Own audience | Mobile notices API | Verify scoped | Notice cards | Loading, empty, error, offline | Audience scoped | Parent notices smoke | P0 |

---

## 6. Module Family Rows To Expand During Planning

These rows are intentionally compact. Expand each module into screen-level rows before implementation starts.

| Module family | Screens to expand | Priority |
|---|---|---|
| M1 Admissions | Admissions Pipeline, Application Detail, Duplicate Review, Bulk Import Review, Enrollment Confirmation | P1 |
| M2 Attendance | Monthly Register, Corrections Queue, Conflict Review, Working Day Calendar, Principal Attendance Alerts | P1 |
| M3 Fees | Fee Setup, Refund/Reversal Requests, Cashier Close, Defaulters, Fee Reports, Receipt Viewer | P1 |
| M4 Academics | Academic Setup, Exam Timetable, CAS Entry, Promotion Workflow, Syllabus Progress, Student Results | P1 |
| M5 Activity | Activity Feed Workspace, Audience Preview, Moderation Queue, Parent Activity Feed, Teacher Quick Post | P1/P2 |
| M6 Homework/Timetable | Homework Workspace, Submissions Review, Reminder Preview, Timetable Builder, Substitutions, My Timetable | P0/P1 |
| M7 HR/Payroll | Staff Directory, Leave Queue, Payroll Runs, Payroll Run Detail, My Payslips, My Leave | P1 |
| M8A Library | Library Desk, My Library, Catalog, Issue/Return, Overdue, Fines | P1/P2 |
| M8B Transport | Transport Dashboard, Driver Trip, Parent Transport, Routes, Vehicles, Trip Detail | P1 |
| M8C Canteen | Canteen POS, Parent Canteen, Menu, Wallets, Inventory, Reports | P1/P2 |
| M9 Accounting | Accounting Dashboard, Journals, Journal Detail, Financial Reports | P1 |
| M12 Learning | Learning Activities, Student Learning, Parent Learning Summary | P2 |
| Reports/Advanced | Report Catalog, Export History, Approval Center, Approval Cards | P1/P2 |

---

## 7. Matrix Completion Rules

Before implementation starts, this matrix should be reviewed and extended until:

```text
1. Every planned P0 web screen has a row.
2. Every planned P0 mobile screen has a row.
3. Every row has a permission baseline.
4. Every row has an API contract or planned API family.
5. Every P0 screen has backend status marked as supported/verified or has an implementation task.
6. Every scoped user screen has a scope test.
7. Every private file screen has protected preview/download rules.
8. Every dangerous action has audit/reason rules.
```

---

## 8. Immediate P0 Rows To Finalize First

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
M3-W-01 Invoice List
M3-W-03 Payment Collection
M3-W-04 Receipts
M3-M-01 Parent Fees
M4-W-01 Marks Entry
M4-W-02 Report Cards
M4-M-01 Parent Report Cards
M10-W-01 Notice Composer
M10-M-01 Parent Notices
```

These rows represent the first high-value implementation path once planning ends.
