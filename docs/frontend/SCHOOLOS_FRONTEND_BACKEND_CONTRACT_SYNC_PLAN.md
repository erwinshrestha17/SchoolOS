# SchoolOS Frontend + Backend Contract Sync Plan

**Status:** Source of Truth  
**Last updated:** 2026-06-15  
**Purpose:** Ensure that as SchoolOS frontend web/mobile screens are implemented, every required backend contract update is identified, implemented, tested, and verified in the same development slice.

Related documents:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/references/SCHOOLOS_ROLE_SCREEN_DESIGN_REFERENCE.md
docs/frontend/SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md
```

This document does **not** mean rewriting the backend. It means frontend work must include any missing backend contract needed for safe, role-aware, mobile-safe, permission-aware UI.

---

## 1. Executive Decision

SchoolOS frontend and backend must move together from this point forward.

Final rule:

```text
No frontend screen is complete until the backend contract needed by that screen is verified or implemented.
```

Every module UI slice must include:

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

Allowed backend contract updates:

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

Not allowed without a real implementation need:

```text
Unnecessary backend redesign
Database churn just because UI changed
Duplicated endpoints when an existing safe route works
Business logic rewrites unrelated to the screen contract
```

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

## 5. Required Backend Contract Categories

### 5.1 Session and access contract

Frontend needs one reliable access source for route guards, sidebar visibility, role landing dashboards, module locked states, and scoped UI variants.

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

### 5.2 Permission and entitlement errors

Required machine-readable examples:

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

### 5.3 Role-based dashboard summaries

Dashboards should not require the frontend to call 10-20 endpoints.

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

---

## 6. Module Contract Sync Checklist

Use this checklist with the screen contract matrix.

| Module | Required backend checks while implementing UI |
|---|---|
| Foundation / Auth / RBAC | `/auth/me`, roles, permissions, entitlements, scopes, module locks, user/role privilege escalation protection. |
| Dashboard / Home | Official backend totals, pending counts, role-specific summaries, permission-filtered data. |
| M1 Students / Admissions | Paginated/filterable student lists, scoped teacher/parent/student views, protected documents/photos, lifecycle audit reasons, duplicate/enrollment blockers, iEMIS export. |
| M2 Attendance | Teacher scope, lock state, correction workflow, official monthly totals, parent/student scoped summaries, mobile offline/pending contract where needed. |
| M3 Fees / Receipts | Official money totals, paginated invoices/receipts, idempotent collection, protected receipt PDFs, reason enforcement for reprint/refund/reversal/close, parent own-child fees only. |
| M4 Academics | Teacher subject scope, marks/CAS validation/lock state, report card readiness, publish/unpublish audit, parent/student published-only results. |
| M5 Activity | Audience preview, media consent state, parent scoped feed, moderation permissions, protected media, audited delete/restore/moderation. |
| M6 Homework / Timetable | Homework lifecycle, scoped assignments/submissions, reminder preview, protected attachments, structured timetable conflicts, substitution availability/conflicts. |
| M7 HR / Payroll | Confidential salary filtering, staff self-service scopes, protected payslips, payroll lifecycle blockers, posting-to-accounting permission/audit. |
| M8A Library | Paginated catalog/copies, safe issue/return state, parent/student own borrowed items, scanner-safe identity response, fine posting boundary. |
| M8B Transport | Driver assigned trips only, parent own-child trip status, stale GPS status, delay/emergency preview, scoped manifest. |
| M8C Canteen | POS-safe scan DTO, idempotent serve/sell where required, POS-only data, wallet scopes, inventory cost filtering, wallet correction audit. |
| M9 Accounting | Permission-strict access, paginated journals, debit/credit state, period lock state, reason enforcement, protected reports. |
| M10 Notices / Chat | Recipient preview, scoped audiences, school-hours chat policy, parent own conversations, escalation review permissions, unread counts. |
| M12 Learning | Teacher assigned activities, student assigned learning, parent child summary, session state, protected resources. |
| Reports / Advanced Ops | Permission-filtered catalog, export job status/progress, protected downloads, approval center scope, automation restrictions, scoped analytics. |

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

```text
Design the screen.
Audit the backend contract.
Implement the missing contract if needed.
Then build the UI.
Verify role, permission, scope, and audit behavior before marking done.
```

This keeps frontend progress fast while preventing unsafe UI, fake workflows, permission leaks, and mobile screens powered by the wrong endpoints.
