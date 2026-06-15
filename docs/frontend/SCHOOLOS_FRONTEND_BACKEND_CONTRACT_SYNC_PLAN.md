# SchoolOS Frontend + Backend Contract Sync Plan

**Status:** Execution companion plan for frontend implementation  
**Last updated:** 2026-06-15  
**Purpose:** Ensure that as SchoolOS frontend web/mobile screens are implemented, every required backend contract update is identified, implemented, tested, and verified in the same development slice.

Related documents:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md
docs/frontend/SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md
```

This document does **not** mean rewriting the backend. It means frontend work must include any missing backend contract needed for safe, role-aware, mobile-safe, permission-aware UI.

---

## 1. Executive Decision

SchoolOS frontend and backend must move together from this point forward.

Final rule:

```text
No frontend screen is complete until the backend contract needed by that screen is verified or implemented.
```

This means every module UI slice must include:

```text
1. Frontend screen/component work
2. API client work
3. Backend contract audit
4. Backend contract implementation if missing
5. Permission / entitlement / scoped-access verification
6. API tests or contract tests
7. Frontend state handling: loading, empty, error, permission denied, module locked
8. Smoke/manual verification
```

---

## 2. What Counts as a Backend Contract Update?

A backend contract update is allowed when the frontend/mobile design requires backend support that is missing or unsafe.

Backend contract updates include:

```text
Session/access metadata
Permission metadata
Module entitlement/locked state metadata
Role landing/dashboard summaries
Scoped mobile endpoints
Purpose-limited parent/student/driver/staff endpoints
Backend pagination/filtering/sorting
Global search
Consistent error codes
Audit reason enforcement
Protected file preview/download
Notification/count endpoints
Approval center summaries
Workflow state fields
Report/export job metadata
```

Backend contract updates do **not** include unnecessary backend redesign, database churn, or business logic rewrites when the existing contract already supports the screen safely.

---

## 3. Frontend Slice Definition of Done

A frontend slice is done only when this checklist passes:

```text
1. Screen route exists and is protected.
2. Screen uses SchoolOS shared components.
3. Screen uses real backend API through apps/web/lib/api.
4. API contract exists and is documented in the slice notes.
5. Missing backend contract has been implemented in the same slice.
6. Role/permission behavior is verified.
7. Module locked behavior is verified.
8. Scoped data behavior is verified for parent/student/teacher/driver/staff where relevant.
9. Loading, empty, error, success, permission denied, and module locked states render.
10. Dangerous actions enforce confirmation/reason in UI and backend where required.
11. Private file/PDF/CSV/media actions use authenticated helpers.
12. Backend unit/contract/e2e tests are added or updated where backend changed.
13. Frontend typecheck/build/smoke path is updated or verified.
```

---

## 4. Contract Audit Template Per Screen

Every screen implementation must start with this audit table.

| Field | Required answer |
|---|---|
| Module | Example: M3 Fees |
| Screen | Example: Payment Collection |
| Web or mobile | Web / Mobile / Tablet |
| Primary roles | Example: Cashier, Accountant |
| Data required | Student billing identity, dues, invoice, payment modes |
| Actions required | Collect payment, generate receipt, print/download receipt |
| Existing API route | Existing route if available |
| Missing API contract | Anything missing |
| Permission required | Example: `fees.payment.collect` |
| Scope required | Example: cashier assigned tenant/counter |
| Module entitlement | Example: `fees` must be enabled |
| Error states | Permission denied, module locked, payment failed |
| Audit reason | Required or not |
| File/download | Receipt PDF through protected helper |
| Backend tests | Required tests |
| Frontend tests/smoke | Required verification |

---

## 5. Backend Contract Categories Required by Frontend

### 5.1 Session and access contract

Frontend needs one reliable access source for route guards, sidebar visibility, role landing dashboard, module locked states, and scoped UI variants.

Recommended contract:

```text
GET /api/v1/auth/me
```

Should include:

```text
user
school/tenant context
active academic year if available
roles
permissions
module entitlements
module locked/disabled states
relationship scopes: classes, sections, subjects, children, trips, counters, staff profile
platform access flag
support override session if active
```

Acceptance criteria:

```text
Frontend does not hardcode access by display role name alone.
Sidebar, route guard, and action visibility can be derived from backend-provided access metadata.
```

### 5.2 Permission and entitlement errors

Backend should return clear machine-readable error codes.

Required examples:

```text
PERMISSION_DENIED
MODULE_LOCKED
TENANT_SUSPENDED
READ_ONLY_MODE
ACTION_NOT_ALLOWED
WORKFLOW_LOCKED
REASON_REQUIRED
VALIDATION_FAILED
NOT_FOUND_OR_NOT_ACCESSIBLE
```

Acceptance criteria:

```text
Frontend can show the correct PermissionState, ModuleLockedState, ReadOnlyState, or workflow blocker message without parsing raw technical errors.
```

### 5.3 Role-based dashboard summaries

Dashboards should not require the frontend to call 10-20 module endpoints.

Recommended summary contracts:

```text
GET /api/v1/dashboard/owner
GET /api/v1/dashboard/principal
GET /api/v1/dashboard/teacher
GET /api/v1/dashboard/finance
GET /api/v1/dashboard/office
GET /api/v1/dashboard/hr
GET /api/v1/dashboard/transport
GET /api/v1/dashboard/canteen
GET /api/v1/mobile/dashboard/parent
GET /api/v1/mobile/dashboard/student
GET /api/v1/mobile/dashboard/teacher
GET /api/v1/mobile/dashboard/driver
GET /api/v1/platform/dashboard
```

Use existing routes if already available. Do not duplicate contracts.

Acceptance criteria:

```text
Each role landing dashboard receives official backend totals, alerts, pending counts, and next actions from backend-safe scoped queries.
```

### 5.4 Scoped mobile APIs

Mobile must use purpose-limited endpoints, not admin endpoints.

Required scoped contract families:

```text
/mobile/parent/*
/mobile/student/*
/mobile/teacher/*
/mobile/driver/*
/mobile/staff/*
/mobile/canteen-pos/* where needed
```

Acceptance criteria:

```text
Parent sees only own children.
Student sees only own data.
Teacher sees assigned classes/subjects.
Driver sees assigned trips only.
Staff sees own leave/payslips/profile unless granted more.
```

### 5.5 Pagination, filtering, and sorting

Every dense web table should use backend pagination.

Required query pattern:

```text
page
pageSize
search
sortBy
sortOrder
status
academicYearId
classId
sectionId
studentId
staffId
dateFrom
dateTo
module-specific filters
```

Required response pattern:

```text
data
meta.page
meta.pageSize
meta.total
meta.totalPages
```

Acceptance criteria:

```text
Frontend never fetches thousands of students, receipts, journals, attendance rows, books, trips, or payroll records just to paginate in the browser.
```

### 5.6 Global search

Global search must be permission-filtered.

Recommended contract:

```text
GET /api/v1/search?q=...
```

Search groups:

```text
students
staff
invoices
receipts
books
vehicles
notices
classes/sections where useful
```

Acceptance criteria:

```text
Search results never leak hidden student, guardian, staff, finance, or tenant-private data.
```

### 5.7 Audit reason enforcement

Frontend can collect reasons, but backend must enforce them.

Reason-required actions include:

```text
Transfer/archive/delete student
Merge duplicates
Reverse/refund payment
Reprint receipt
Close/reopen cashier day
Post/reverse/correct journal
Lock/unlock marks
Publish/unpublish results
Approve/reject payroll
Post payroll to accounting
Suspend/reactivate tenant
Open support override
Retry/discard failed jobs
Cancel trip
Emergency/delay broadcast
Delete/restore activity post
```

Acceptance criteria:

```text
If reason is required and missing, backend rejects with REASON_REQUIRED.
Audit log stores user, tenant, action, target, reason, timestamp, and support override context if active.
```

### 5.8 Protected file/media/PDF/CSV contracts

Private files must not be exposed through raw public URLs.

Required for:

```text
Student photos
Student documents
Tenant logos where private
Receipts
Report cards
Payslips
Homework attachments
Activity media
Exports
Library/canteen/accounting reports
```

Acceptance criteria:

```text
All private file actions use authenticated or signed preview/download helpers and are permission/scoped.
```

---

## 6. Module-by-Module Frontend + Backend Sync Plan

## 6.1 Foundation: Auth, Access, RBAC, Entitlements

Frontend screens:

```text
Login
Session restore
Sidebar
Route guards
Role landing resolver
Users
Roles and permissions
Settings
Module locked states
```

Backend contract checks:

```text
/auth/me returns roles, permissions, entitlements, scopes
Permission checks are consistent
Module entitlement/locked state is exposed
Support override context is exposed when active
User/role assignment endpoints protect privilege escalation
```

Backend updates if missing:

```text
Add/extend access metadata DTO
Add clear permission/module error codes
Add tests for route/action permission behavior
```

---

## 6.2 Dashboard / Home

Frontend screens:

```text
Owner Executive Overview
Principal School Operations Overview
Office Dashboard
Finance Today
Teacher My Classes Today
Parent My Child Overview
Student My Learning Today
Driver My Assigned Trip
Platform Attention Dashboard
```

Backend contract checks:

```text
Role dashboard summary routes exist or can be composed safely
Counts are official backend totals
Summary respects permissions and module entitlements
Mobile dashboards are scoped
```

Backend updates if missing:

```text
Add role-based dashboard summary endpoints
Add pending count endpoints for approvals/notices/messages/tasks
Add mobile dashboard summary endpoints for parent/student/teacher/driver
```

---

## 6.3 M1 Students and Admissions

Frontend screens:

```text
Student Directory
Student Profile
Guardian Management
Student Documents
Student Photo
Student QR/Identity
Lifecycle Timeline
IEMIS Readiness
Admissions Pipeline
Application Detail
Duplicate Review
Bulk Import Review
Enrollment Confirmation
Parent Child Summary
Teacher My Class Students
Student My Profile
```

Backend contract checks:

```text
Student lists are paginated/filterable
Teacher/class scopes are enforced
Parent/student scoped profile endpoints exist
Protected document/photo preview/download exists
Student lifecycle actions require reason where needed
Duplicate review/enrollment endpoints expose blockers and previews
IEMIS export uses protected file/export registry
```

Backend updates if missing:

```text
Add scoped parent/student profile endpoints
Add consistent student list pagination metadata
Add missing lifecycle/audit reason enforcement
Add missing protected preview/download contracts
```

---

## 6.4 M2 Attendance

Frontend screens:

```text
Mark Attendance
Monthly Register
Corrections Queue
Conflict Review
Working Day Calendar
Teacher Mobile Attendance
Parent Attendance
Student Attendance
Principal Attendance Alerts
```

Backend contract checks:

```text
Teacher assigned class/session scope is enforced
Attendance lock state is returned
Correction workflow has request/review state
Monthly register has backend-generated official totals
Parent/student summaries are scoped
Mobile attendance supports pending/offline-safe draft sync where planned
```

Backend updates if missing:

```text
Add lock/correction status fields
Add scoped parent/student attendance summary endpoints
Add principal not-submitted/risk summary endpoint
Add offline draft sync contract if mobile slice requires it
```

---

## 6.5 M3 Fees, Receipts, Payments

Frontend screens:

```text
Finance Today
Fee Setup
Invoice List
Student Ledger
Payment Collection
Receipts
Refund/Reversal Requests
Cashier Close
Defaulters
Fee Reports
Parent Fees
Receipt Viewer
Owner Finance Alerts
```

Backend contract checks:

```text
Money totals are official backend values
Invoice/payment/receipt lists are paginated/filterable
Cashier collection is idempotent and double-submit safe
Receipt PDFs use protected download
Reprint/reversal/refund/close require reason/audit where needed
Parent sees own child dues/receipts only
Owner summary respects finance permission
```

Backend updates if missing:

```text
Add role summary endpoint for finance dashboard
Add parent fee summary/receipt endpoints if missing
Add idempotency metadata/handling for payment collection if not complete
Add REASON_REQUIRED enforcement for reprint/reversal/refund/close actions
```

---

## 6.6 M4 Academics, Exams, CAS, Report Cards

Frontend screens:

```text
Academic Setup
Exam Timetable
Marks Entry
CAS Entry
Report Cards
Result Publishing
Promotion Workflow
Syllabus Progress
Teacher Marks Tasks
Parent Report Cards
Student Results
Principal Academic Alerts
```

Backend contract checks:

```text
Subject teacher scopes are enforced
Marks/CAS grids expose validation errors and lock state
Report card generation exposes readiness and partial success/failure
Publish/unpublish requires permission and confirmation/audit
Parent/student endpoints expose only published results
```

Backend updates if missing:

```text
Add readiness blocker endpoint for report cards/results
Add scoped teacher marks task endpoint
Add parent/student published result endpoints if missing
Add clear unpublished/locked error states
```

---

## 6.7 M5 Activity Feed and Milestones

Frontend screens:

```text
Activity Feed Workspace
Post Detail
Audience Preview
Media Gallery
Moderation Queue
Mood Logs / Milestones
Parent Activity Feed
Teacher Quick Post
Milestone Update
```

Backend contract checks:

```text
Audience preview endpoint exists
Media consent state is returned
Parent feed is scoped to own child/class only
Moderation queue is permission-filtered
Media preview/download is protected
Delete/restore/moderation actions are audited
```

Backend updates if missing:

```text
Add audience preview contract
Add consent-aware media fields
Add parent scoped feed endpoint
Add moderation decision reason/audit enforcement
```

---

## 6.8 M6 Homework and Timetable

Frontend screens:

```text
Homework Workspace
Homework Detail
Submissions Review
Reminder Preview
Homework Reports
Parent Homework
Student Homework
Teacher Homework Quick View
Timetable Builder
Periods and Rooms
Teacher Availability
Workload Rules
Substitutions
Teacher/Class Timetable
My Timetable
Class Timetable
Substitution Alert
```

Backend contract checks:

```text
Homework lifecycle states exist
Assignments/submissions are scoped
Reminder preview returns recipients before send
Attachments use protected preview/download
Timetable conflicts are returned as structured data
Substitution assignment checks availability/conflicts
Parent/student timetable/homework endpoints are scoped
```

Backend updates if missing:

```text
Add reminder preview endpoint
Add structured timetable conflict endpoint/fields
Add scoped mobile homework/timetable endpoints
Add substitution availability contract
```

---

## 6.9 M7 HR and Payroll

Frontend screens:

```text
Staff Directory
Staff Profile
Leave Queue
My Staff Self-Service
Payroll Preview
Payroll Runs
Payroll Run Detail
Payslips
Salary Structures
Payroll Reports
My Leave
My Payslips
Leave Approval
Payroll Alerts
```

Backend contract checks:

```text
Payroll salary visibility is permission-strict
Staff self-service endpoints are own-user scoped
Payslips use protected downloads
Payroll run lifecycle exposes step/status/blockers
Posting payroll to accounting requires permission and audit
Owner/principal payroll alerts do not leak salary details without payroll permission
```

Backend updates if missing:

```text
Add scoped staff self-service endpoints
Add payroll run blocker/readiness fields
Add protected payslip download contract
Add confidential field filtering by permission
```

---

## 6.10 M8A Library

Frontend screens:

```text
Library Desk
Book Catalog
Copy Management
Reservations
Overdue
Fines
Library Reports
My Library
Library Scanner
```

Backend contract checks:

```text
Catalog/copy lists are paginated/filterable
Issue/return workflow returns borrower/copy state clearly
Parent/student see own borrowed/due items only
Fine posting to fees uses permission or workflow boundary
Scanner lookup does not expose full student profile
```

Backend updates if missing:

```text
Add scanner-safe lookup endpoint
Add parent/student library summary endpoint
Add fine posting state/permission contract if needed
```

---

## 6.11 M8B Transport

Frontend screens:

```text
Transport Dashboard
Routes and Stops
Vehicles
Driver Assignments
Student Assignments
Active Trips
Trip Detail
Delay Broadcast
Transport Reports
Driver Trip
Parent Transport
Principal Transport Alerts
```

Backend contract checks:

```text
Driver sees assigned trips only
Parent sees own child trip status only
GPS stale/missing status is returned
Delay/emergency broadcast has recipient preview/confirmation where needed
Trip manifest is scoped
Vehicle document alerts are returned
```

Backend updates if missing:

```text
Add driver assigned trip/today endpoint
Add parent child transport status endpoint
Add trip alert summary endpoint for principal
Add delay broadcast preview endpoint
```

---

## 6.12 M8C Canteen

Frontend screens:

```text
Canteen POS / Serving
Menu
Meal Plans
Enrollments
Wallets
Inventory
Suppliers
Canteen Reports
POS Tablet
Parent Canteen
Student Canteen
```

Backend contract checks:

```text
POS scan/serve/sell endpoint is fast and idempotent where required
POS-only staff sees serving/payment eligibility only
Wallet balance/status is scoped
Inventory cost/details are permission-filtered
Parent/student see own child/own wallet/meal status only
Wallet corrections require audit
```

Backend updates if missing:

```text
Add POS-safe scan response DTO
Add parent/student canteen summary endpoint
Add confidential inventory/cost filtering
Add wallet correction reason enforcement
```

---

## 6.13 M9 Accounting

Frontend screens:

```text
Accounting Dashboard
Chart of Accounts
Journals
Journal Detail
Fiscal Periods
Vouchers
Bank Reconciliation
Financial Reports
Source Ledger
Owner Accounting Summary if permitted
```

Backend contract checks:

```text
Accounting is permission-strict
Journal lists are paginated/filterable
Debit/credit balance state is returned
Period lock state is returned
Posting/reversing/correcting requires reason/audit
Reports use official backend generation/export
Owner/principal summaries require accounting permission
```

Backend updates if missing:

```text
Add accounting dashboard summary endpoint
Add structured period lock/blocker fields
Add reason enforcement for posting/reversing/correction
Add protected report export contract
```

---

## 6.14 M10 Notices, Messaging, Parent-Teacher Chat

Frontend screens:

```text
Notice Composer
Recipient Preview
Notice List
Scheduled Notices
Messaging Inbox
Parent-Teacher Threads
Availability
Escalation/Abuse Review
Parent Notices
Parent Chat
Teacher Chat
Principal Communication Alerts
```

Backend contract checks:

```text
Recipient preview exists before send
Notices are audience-scoped
Parent sees own conversations only
Teacher chat respects school-hours policy
Escalation/abuse review is permission-filtered
Emergency notices use priority/severity fields
Unread counts are available where needed
```

Backend updates if missing:

```text
Add recipient preview endpoint
Add unread/attention counts endpoint
Add chat policy state endpoint
Add escalation review contract
```

---

## 6.15 M12 Learning

Frontend screens:

```text
Learning Activities
Activity Detail
Sessions
Attempts Review
Class Progress
Resources
Student Learning
Parent Learning Summary
Teacher Session Control
```

Backend contract checks:

```text
Teacher sees assigned activities/classes only
Student sees own activities/resources only
Parent sees own child learning summary only
Session state is returned clearly
Attempt/review state is scoped
Resources use protected access where private
```

Backend updates if missing:

```text
Add student mobile learning endpoint
Add parent child learning summary endpoint
Add session status summary endpoint
Add resource protected download contract
```

---

## 6.16 Reports, File Registry, Export Center, Advanced Operations

Frontend screens:

```text
Report Catalog
Report Filter Screen
Export History
File Registry Access
Approval Center
Automation Rules
Analytics Summary
Document Templates
Export Center
Approval Cards
Insight Summary
```

Backend contract checks:

```text
Report catalog is permission-filtered
Export jobs return status/progress/errors/download link safely
Private files use protected preview/download
Approvals show only approvable items
Automation is admin/platform restricted
Analytics respects role data scope
```

Backend updates if missing:

```text
Add permission-filtered report catalog endpoint
Add export job status/progress contract
Add approval center summary endpoint
Add analytics scoped summary endpoint
```

---

## 7. Development Workflow From Now On

Every frontend PR or slice should follow this order:

```text
1. Pick one module screen or small workflow.
2. Complete the Contract Audit Template.
3. Check existing backend route/controller/service/tests.
4. Mark backend state:
   - Supported already
   - Needs DTO/response field only
   - Needs endpoint
   - Needs permission/scope enforcement
   - Needs audit/reason enforcement
   - Needs tests only
5. Implement backend gap if needed.
6. Add/update API client in apps/web/lib/api.
7. Build frontend screen with shared components.
8. Add loading/empty/error/permission/module-locked states.
9. Add or update tests/smoke verification.
10. Document screen-to-contract mapping.
```

---

## 8. PR Checklist

Every frontend PR should include this section:

```markdown
## Frontend + Backend Contract Checklist

- [ ] Screen uses real backend APIs only
- [ ] Contract audit completed
- [ ] Existing backend route verified or new route added
- [ ] API client added/updated under apps/web/lib/api
- [ ] Permission and module entitlement behavior verified
- [ ] Scoped data verified for role/device where relevant
- [ ] Loading/empty/error/permission/module-locked states implemented
- [ ] Dangerous actions require UI confirmation
- [ ] Backend enforces reason/audit where required
- [ ] Private file/download actions use protected helpers
- [ ] Pagination/filtering uses backend for dense lists
- [ ] Tests updated where backend changed
- [ ] Typecheck/build/smoke run or explicitly noted
```

---

## 9. What Not To Do

```text
Do not build frontend with fake data.
Do not use admin endpoints for parent/student/driver mobile screens.
Do not hide buttons in UI and assume that is security.
Do not add backend endpoints without permission/scope tests.
Do not add role dashboards by stitching many frontend calls when a backend summary is needed.
Do not expose raw file URLs for private school data.
Do not defer P0 backend contract gaps after frontend merge.
Do not rewrite backend business logic unless a real contract/safety gap requires it.
```

---

## 10. Final Rule

From now on, SchoolOS frontend implementation follows this rule:

```text
Design the screen.
Audit the backend contract.
Implement the missing contract if needed.
Then build the UI.
Verify role, permission, scope, and audit behavior before marking done.
```

This keeps frontend progress fast while preventing unsafe UI, fake workflows, permission leaks, and mobile screens powered by the wrong endpoints.
