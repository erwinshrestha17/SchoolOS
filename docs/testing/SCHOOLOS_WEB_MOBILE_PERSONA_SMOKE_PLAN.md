# SchoolOS Web and Mobile Persona Smoke Plan

**Status:** Planning baseline
**Last updated:** 2026-06-15
**Phase:** Planning only — test execution starts during implementation phase
**Purpose:** Define role/persona-based smoke tests so SchoolOS web and mobile experiences are validated by real school responsibilities, not only by page existence.

Related docs:

```text
docs/design/SCHOOLOS_WEB_MOBILE_MASTER_DESIGN_PLAN.md
docs/frontend/SCHOOLOS_FRONTEND_BACKEND_API_CONTRACT_MAP.md
docs/mobile/SCHOOLOS_FLUTTER_APP_PLAN.md
```

---

## 1. Testing Philosophy

SchoolOS is role-aware and permission-driven. Therefore smoke tests must answer:

```text
Does this user see the correct dashboard?
Does this user see only the correct navigation?
Does this user see only permitted data?
Does this user see only permitted actions?
Does direct URL access fail safely?
Does mobile show scoped, simple, role-specific screens?
Does backend block the action even if frontend hides it?
```

---

## 2. Global Smoke Checks For Every Persona

Every persona must pass:

```text
1. Can log in successfully.
2. Lands on the correct dashboard/home screen.
3. Sidebar/bottom navigation matches role permissions.
4. Hidden modules are not visible.
5. Locked modules show ModuleLockedState when directly opened, if applicable.
6. Forbidden direct routes show PermissionState or equivalent safe error.
7. Allowed records are visible.
8. Unallowed records are not visible.
9. Allowed actions are visible and work.
10. Forbidden actions are hidden and blocked by backend if attempted.
11. Loading, empty, and error states are not broken.
12. Private files/downloads require authenticated access.
13. Logout/session expiry returns to login safely.
```

---

## 3. Persona List

```text
Platform Operator
Owner / Director
Principal / Head Teacher
Academic Coordinator
School Admin / Office Admin
Admission Officer
Class Teacher
Subject Teacher
Accountant
Cashier
HR / Payroll Officer
Librarian
Transport Manager
Driver / Conductor
Canteen Manager
Canteen POS Staff
Parent / Guardian
Student Lab-Only User
Staff Self-Service User
```

---

## 4. Platform Operator Smoke

| Area | Expected result |
|---|---|
| Login | Lands on Platform Attention Dashboard. |
| Navigation | Sees platform tenants, plans, SaaS billing, providers, queues, audit. |
| Tenant data | Does not see tenant-private student/finance/chat data by default. |
| Support override | Can open support override only with reason, duration, and audit. |
| Dangerous actions | Tenant suspend/reactivate/retry/discard require confirmation/reason where required. |
| Direct school dashboard | Blocked unless audited support override is active. |

Priority tests:

```text
platform operator cannot access tenant student profile without override
support override banner appears when active
queue retry/discard is audited
SaaS invoice does not appear in school fee module
```

---

## 5. Owner / Director Smoke

| Area | Expected result |
|---|---|
| Dashboard | Lands on Executive Overview. |
| Sees | Enrollment, fee collection summary, dues, attendance risk, approvals, reports, module status. |
| Does not automatically see | Detailed payroll salary, deep accounting, private chats, unpublished marks, platform internals. |
| Mobile | Optional executive alerts only. |
| Direct blocked routes | Payroll/accounting details blocked unless permission granted. |

Priority tests:

```text
owner sees finance summary but not salary details without payroll permission
owner sees accounting summary only with accounting permission
owner approval action requires reason where configured
```

---

## 6. Principal / Head Teacher Smoke

| Area | Expected result |
|---|---|
| Dashboard | Lands on School Operations Overview. |
| Sees | Attendance not submitted, absent teachers, substitutions, timetable conflicts, exam/report readiness, notices, parent escalations. |
| Actions | Review/publish/approve based on permissions. |
| Does not automatically see | Deep accounting, individual salary, platform billing. |
| Mobile | Alerts/approvals and operational summaries. |

Priority tests:

```text
principal can view school attendance summary
principal cannot see payroll salary details without permission
principal can publish results only with result publish permission
principal direct accounting route is blocked unless permission exists
```

---

## 7. Academic Coordinator Smoke

| Area | Expected result |
|---|---|
| Dashboard | Academic overview. |
| Sees | Exam terms, marks readiness, CAS progress, report card readiness, timetable conflicts. |
| Actions | Setup exams/components, review marks/CAS, generate report cards, publish if granted. |
| Does not see | Fee collection, payroll, accounting by default. |

Priority tests:

```text
academic coordinator sees report card readiness
academic coordinator cannot access fee ledger by default
academic coordinator sees marks for configured scope
```

---

## 8. School Admin / Office Admin Smoke

| Area | Expected result |
|---|---|
| Dashboard | Office Dashboard. |
| Sees | Student directory, admissions, profile gaps, duplicate candidates, documents, guardian verification. |
| Actions | Create/update student profiles, manage guardians, documents, admissions handoff. |
| Does not see | Salary, accounting journals, private chats, platform controls. |

Priority tests:

```text
admin can open student profile
admin can manage student documents only if document permission exists
admin cannot open payroll salary page by default
```

---

## 9. Admission Officer Smoke

| Area | Expected result |
|---|---|
| Dashboard | Admissions/office task view. |
| Sees | Application pipeline, missing documents, duplicates, accepted ready to enroll. |
| Actions | Update application, review duplicate, confirm enrollment if granted. |
| Does not see | Existing student fee ledger, payroll, private academic marks. |

Priority tests:

```text
admission officer can move application status
admission officer cannot view unrelated student fee ledger
admission enrollment shows duplicate blockers before confirm
```

---

## 10. Class Teacher Smoke

| Area | Expected result |
|---|---|
| Dashboard | My Class / My Classes Today. |
| Sees | Own class roster, attendance, homework, activity, parent messages. |
| Actions | Mark own class attendance, assign homework, post activity, message parents. |
| Does not see | Other classes, school-wide finance, payroll, accounting. |
| Mobile | Attendance, homework, chat, class cards. |

Priority tests:

```text
class teacher sees own class only
class teacher cannot mark another class attendance
class teacher can message only allowed parent threads during policy hours
```

---

## 11. Subject Teacher Smoke

| Area | Expected result |
|---|---|
| Dashboard | My Subjects / My Classes Today. |
| Sees | Assigned subjects/classes, timetable, marks tasks, homework, syllabus. |
| Actions | Enter assigned marks/CAS, assign subject homework, update syllabus progress. |
| Does not see | Student fees, payroll, unrelated class data. |

Priority tests:

```text
subject teacher sees marks entry only for assigned subjects
subject teacher cannot see another subject/class marks grid
subject teacher cannot open fee collection
```

---

## 12. Accountant Smoke

| Area | Expected result |
|---|---|
| Dashboard | Finance Today / Accounting dashboard depending permission. |
| Sees | Fee setup, invoices, payments, receipts, reversals, reports, accounting if granted. |
| Actions | Manage fee setup, review reversals/refunds, export reports, post journals if permitted. |
| Does not see | Private academic notes, parent chat content, child-sensitive data beyond finance need. |

Priority tests:

```text
accountant can view invoice list and reports
accountant can reverse payment only with permission and reason
accountant cannot see private parent-teacher chat content
```

---

## 13. Cashier Smoke

| Area | Expected result |
|---|---|
| Dashboard | Cashier/counter workflow. |
| Sees | Student billing identity, dues, invoices, payment modes, recent receipts, cashier close. |
| Actions | Collect payment, issue receipt, reprint with reason, close day if permitted. |
| Does not see | Fee setup, payroll, academic records, full private student profile. |

Priority tests:

```text
cashier can collect payment and receive receipt success state
cashier cannot configure fee plans
cashier cannot reverse payment without permission
receipt reprint requires reason if configured
```

---

## 14. HR / Payroll Officer Smoke

| Area | Expected result |
|---|---|
| Dashboard | HR/payroll overview. |
| Sees | Staff, leave, salary structures, payroll runs, payslips, payroll reports. |
| Actions | Review leave, run payroll, generate payslips, post to accounting if permitted. |
| Does not see | Student fees, academic marks, parent chats, platform billing. |

Priority tests:

```text
HR can review leave queue
payroll officer sees salary data
non-payroll principal cannot see salary data
staff sees own payslip only
```

---

## 15. Librarian Smoke

| Area | Expected result |
|---|---|
| Dashboard | Library desk. |
| Sees | Catalog, copy status, borrower identity, issue/return, overdue, fines. |
| Actions | Issue/return books, manage reservations, reminders, fines if permitted. |
| Does not see | Full student profile, payroll, guardian private details, academic marks. |

Priority tests:

```text
librarian scanner lookup returns borrower identity only
librarian cannot open full student profile without permission
student sees own borrowed books only
```

---

## 16. Transport Manager Smoke

| Area | Expected result |
|---|---|
| Dashboard | Transport status dashboard. |
| Sees | Routes, vehicles, drivers, student assignments, active trips, stale GPS, delays. |
| Actions | Assign routes/vehicles/drivers/students, monitor trips, broadcast delays. |
| Does not see | Academic marks, payroll salary, accounting ledgers. |

Priority tests:

```text
transport manager sees active trips
transport manager can broadcast delay only with preview/confirmation
transport manager cannot access accounting journals
```

---

## 17. Driver / Conductor Smoke

| Area | Expected result |
|---|---|
| Platform | Mobile only by default. |
| Dashboard | My Assigned Trip. |
| Sees | Assigned route, vehicle, stops, student manifest, emergency contact/action. |
| Actions | Start trip, mark boarded/dropped/absent, report delay/emergency, complete trip. |
| Does not see | Fees, academics, full student profile, other routes, payroll. |

Priority tests:

```text
driver sees assigned trip only
driver cannot access another route/trip
driver emergency action is protected against accidental taps
driver trip updates handle offline/pending state where implemented
```

---

## 18. Canteen Manager / POS Staff Smoke

| Area | Expected result |
|---|---|
| Manager dashboard | Menu, meal plans, wallets, inventory, reports. |
| POS view | Scan/serve/sell fast workflow. |
| POS staff sees | Student scan result, wallet/meal eligibility, serve/sell action. |
| POS staff does not see | Full student profile, academic marks, payroll, inventory cost unless manager. |

Priority tests:

```text
POS staff can scan and serve eligible student
POS staff sees blocked/low balance state
POS staff cannot access full student profile
wallet correction requires permission and reason
```

---

## 19. Parent / Guardian Smoke

| Area | Expected result |
|---|---|
| Platform | Mobile-first, optional web portal later. |
| Dashboard | My Child Overview with child switcher for linked children only. |
| Sees | Own child attendance, homework, fees, receipts, notices, activity, published results, transport, canteen, library. |
| Actions | Pay/view fees if enabled, download own receipts/report cards, message allowed teachers. |
| Does not see | Other children, unpublished marks, internal comments, staff private data, audit logs. |

Priority tests:

```text
parent sees only linked child
parent cannot access another child by direct URL
parent sees only published report cards
parent can view own child receipts only
parent chat respects school-hours policy
```

---

## 20. Student Lab-Only Smoke

| Area | Expected result |
|---|---|
| Platform | Controlled computer-lab or school-device route only. |
| Dashboard | No broad mobile/dashboard home in MVP. |
| Sees | Current teacher-controlled learning session, assigned activity, own attempt/progress for that session. |
| Actions | Join session, autosave answers, submit attempt, exit session safely. |
| Does not see | Broad mobile app, fees, parent/staff data, other students, unpublished marks, public leaderboard, open chat. |

Priority tests:

```text
student can join only valid active assigned learning session
student cannot view another student's attempt or progress
student cannot access broad mobile home routes
student cannot see fees, parent/staff data, unpublished results, leaderboard, or chat
student autosave/submit retry is idempotent
```

---

## 21. Staff Self-Service Smoke

| Area | Expected result |
|---|---|
| Dashboard | Own staff profile/leave/payslip view. |
| Sees | Own profile, leave requests/status, own payslips where enabled. |
| Actions | Request leave, download own payslip. |
| Does not see | Other staff salary, payroll runs, HR admin screens. |

Priority tests:

```text
staff can request leave
staff sees own payslips only
staff cannot access another staff profile/payroll details
```

---

## 22. Cross-Persona Security Smoke Tests

These tests should be automated where possible.

```text
Parent cannot access another parent's child.
Student lab user cannot access another student's session attempt/progress.
Teacher cannot access another class unless assigned or explicitly permitted.
Subject teacher cannot enter marks for unassigned subject.
Driver cannot access unassigned trip.
Cashier cannot reverse/refund payment without permission.
Principal cannot view salary details without payroll permission.
Owner cannot access platform internals without platform permission.
Platform operator cannot view tenant-private data without support override.
Hidden frontend action is still blocked by backend.
Module locked route shows ModuleLockedState and backend blocks action.
```

---

## 23. Mobile-Specific Smoke Tests

```text
Mobile login works for parent, teacher, driver, and staff self-service.
Student MVP access is tested through lab/session routes, not broad mobile bottom nav.
Mobile bottom nav matches persona where mobile nav exists.
Mobile screens use own/scoped data only.
Offline banner appears when offline where supported.
Pending sync banner appears after offline write where supported.
Push notification opens correct scoped screen where implemented.
Private downloads require authenticated access.
Back navigation does not expose previous user's private data after logout.
```

---

## 24. MVP Smoke Test Priority

P0 smoke personas for first implementation phase:

```text
Owner / Director
Principal
School Admin
Class Teacher
Subject Teacher
Accountant
Cashier
Parent
Student Lab-Only User
Platform Operator
```

P1 after core flows:

```text
Admission Officer
Academic Coordinator
HR / Payroll Officer
Librarian
Transport Manager
Driver
Canteen Manager
POS Staff
Staff Self-Service User
```

---

## 25. Planning Open Questions

```text
Which personas need seeded demo users first?
Will smoke tests run in Playwright for web and Flutter integration_test for mobile?
Should each school type have its own persona bundle: preschool, K-10, 11-12, K-12, K-12+Bachelors?
Which smoke tests are required before pilot demo?
Which smoke tests are required before production launch?
```
