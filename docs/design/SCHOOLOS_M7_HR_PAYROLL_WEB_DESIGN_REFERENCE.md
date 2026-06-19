# SchoolOS M7 HR & Payroll Web Design Reference

**Status:** Active frontend design reference for Module 7 web implementation.  
**Updated:** 2026-06-19  
**Scope:** `apps/web`, Module 7 HR & Payroll admin workspaces, payroll workflows, staff records, protected payslips, and staff self-service routes.

This document translates the supplied Module 7 desktop references into a backend-aligned, permission-aware, production-ready frontend specification. It is design and implementation guidance only. It does not implement frontend, backend, database, migration, package, or test code.

---

## 1. Interpretation Rule

The reference screens define the **visual direction, workflow density, information architecture, and operational screen composition** for M7. They do not prove that every metric, route, endpoint, permission, payroll state, protected file flow, or background job already exists.

Implementation must continue to follow:

```text
NestJS API contracts
OpenAPI output
packages/core shared types
tenant/RBAC/module-entitlement guards
File Registry rules
payroll/accounting immutability rules
audited workflow requirements
```

When a referenced field or action is not confirmed, mark it clearly as one of:

```text
needs backend verification
needs OpenAPI confirmation
needs shared-contract confirmation
needs summary API
needs idempotency confirmation
needs File Registry confirmation
needs accounting boundary confirmation
```

---

## 2. Reference Screen Coverage

The supplied references cover a strong full-module set:

| Area | Reference coverage | Implementation status target |
|---|---|---|
| HR & Payroll dashboard | KPIs, quick actions, attendance snapshot, contracts, payroll calendar, recent activity, leave summary, payroll progress | Build as summary-driven command center |
| Staff directory | Search, filters, bulk actions, export, table, selected row, side preview | Build as server-paginated staff list |
| Staff profile | Identity, employment snapshot, lifecycle, documents, contracts, bank/salary, leave, quick actions | Build as full protected staff hub |
| Contract expiry | Expiring soon, pending renewals, overdue, reminders, selected contract rail | Build as contract-renewal workspace |
| Attendance | Present/late/absent/on-leave/missing checkout/overtime, daily table, anomalies, shifts | Build as HR staff attendance workspace |
| Leave management | Requests, balances, approval queue, calendar, payroll impact, detail rail | Build as approval and balance workspace |
| Salary structures | Versioned structures, components, assignments, statutory deductions, selected structure panel | Build as versioned compensation setup |
| Payroll runs | Draft/review/approve/post/reverse workflow, entries, exceptions, journal preview, audit trail | Build as controlled payroll workflow |
| Payslips | Protected downloads, delivery, preview, reports, quick actions | Build as protected artifact workflow |
| Staff self-service | Own profile, attendance, leave, payslips, notices, compensation/bank summary | Build as separate purpose-limited route family |

---

## 3. Visual and Layout Standard

### 3.1 M7 desktop frame

Use the standard SchoolOS authenticated workspace frame:

```text
Compact global topbar
+ persistent role/module sidebar
+ page title / purpose / action row
+ 3-6 context-aware KPI cards
+ tabs or filter toolbar
+ main operational work area
+ optional right rail with an explicit job
```

The M7 reference style should use:

- Calm soft-blue app canvas.
- White cards, tables, drawers, and panels.
- Deep blue primary actions.
- Thin blue-grey borders.
- Subtle shadows only for hierarchy.
- Rounded cards around 12-16px for dense workspaces.
- Navy headings and readable compact body text.
- Status chips with explicit labels, never color-only meaning.
- Tables with clear row hierarchy, selected state, server metadata, and row action menu.

### 3.2 Right rail rule

A right rail is allowed only when it has a real job:

| Rail type | M7 usage |
|---|---|
| Record context rail | Selected staff member in directory; compact profile preview |
| Approval rail | Selected leave request with payroll impact and approval actions |
| Contract rail | Selected contract with renewal status, notes, timeline, renewal/non-renewal actions |
| Payroll status rail | Posting lock, accounting integration, journal preview, audit trail |
| Protected preview rail | Payslip preview and protected download state |

Do not use a rail for primary workflows that need a full route, such as staff profile, payroll run detail, salary structure versioning, large imports, or payroll exception resolution.

---

## 4. Navigation Standard for M7

The references currently vary between global sidebar and dedicated HR sidebar. Implementation must use one consistent route hierarchy.

Recommended M7 navigation while inside HR & Payroll:

```text
HR & Payroll
- Overview
- Staff Directory
- Departments
- Roles & Designations
- Documents
- Contracts
- Attendance
- Shifts & Rosters
- Leave Management
- Salary Structures
- Allowances & Deductions
- Payroll Runs
- Payslips
- Reports & Analytics
- HR Settings
- Approval Workflows
```

Global finance navigation may link to payroll summaries or accounting outcomes, but it must not own HR staff lifecycle or payroll processing workflows.

---

## 5. Recommended Route Structure

Use this route plan as the frontend target. Exact paths must be confirmed against existing route conventions before coding.

```text
/dashboard/hr
/dashboard/hr/staff
/dashboard/hr/staff/new
/dashboard/hr/staff/[staffId]
/dashboard/hr/staff/[staffId]/edit
/dashboard/hr/staff/[staffId]/documents
/dashboard/hr/departments
/dashboard/hr/designations
/dashboard/hr/contracts
/dashboard/hr/contracts/[contractId]

/dashboard/hr/attendance
/dashboard/hr/attendance/corrections
/dashboard/hr/shifts
/dashboard/hr/rosters

/dashboard/hr/leave
/dashboard/hr/leave/requests
/dashboard/hr/leave/balances
/dashboard/hr/leave/calendar
/dashboard/hr/leave/policies

/dashboard/payroll/salary-structures
/dashboard/payroll/allowances
/dashboard/payroll/deductions
/dashboard/payroll/statutory
/dashboard/payroll/runs
/dashboard/payroll/runs/[runId]
/dashboard/payroll/runs/[runId]/exceptions
/dashboard/payroll/runs/[runId]/journals
/dashboard/payroll/runs/[runId]/audit
/dashboard/payroll/payslips
/dashboard/payroll/reports
/dashboard/payroll/settings
/dashboard/payroll/approval-workflows

/staff-self-service
/staff-self-service/profile
/staff-self-service/attendance
/staff-self-service/leave
/staff-self-service/payslips
/staff-self-service/notices
```

If the app already uses different route names, preserve existing conventions and map these targets to the current route family.

---

## 6. Core Frontend Domain Models

M7 frontend work should be organized around these domain objects:

```text
StaffMember
Department
Designation
EmploymentContract
StaffDocument
StaffLifecycleEvent
StaffBankDetail
StaffSalarySummary
AttendanceRecord
AttendanceCorrectionRequest
Shift
RosterAssignment
LeaveType
LeavePolicy
LeaveRequest
LeaveBalance
SalaryStructure
SalaryStructureVersion
SalaryComponent
SalaryAssignment
PayrollRun
PayrollEntry
PayrollException
PayrollJournalPreview
PayrollPostingLock
PayrollReversalRequest
Payslip
PayslipDelivery
ProtectedFileAccessLog
AuditEvent
ApprovalWorkflow
```

Do not invent browser-only data models for official payroll, salary, attendance, leave balances, or posted accounting output.

---

## 7. Shared Components Required Before Screen Duplication

Standardize these components for M7 and other dense modules:

```text
PageHeader
MetricCard
KpiStrip
FilterToolbar
ActiveFilterChips
PaginatedDataTable
TableRowActionMenu
StatusBadge
RightRail
RecordContextRail
ApprovalDetailRail
ContractDetailRail
ProtectedPreviewRail
WorkflowStepper
AuditTimeline
ActivityTimeline
ProtectedField
ProtectedFileButton
ProtectedFileLink
ProtectedFilePreview
ReasonConfirmationDialog
PermissionGuard
ModuleLockedState
EmptyState
ErrorState
LoadingState
QueuedJobState
PartialFailureState
```

Rules:

- Shared components own visual consistency and accessibility.
- Feature components own M7 domain vocabulary and API calls.
- `MetricCard` and `KpiStrip` must accept backend-backed values or explicit unavailable state.
- `ProtectedField` is required for salary, bank, PAN, and sensitive contact details.
- `ProtectedFileButton`, `ProtectedFileLink`, and `ProtectedFilePreview` are required for payslips and staff documents.

---

## 8. Screen Specifications

## 8.1 HR & Payroll Dashboard Overview

Primary job:

```text
Show HR/payroll operational status and route the user into the next safe workflow.
```

Required composition:

```text
PageHeader: HR & Payroll Dashboard Overview
Purpose: Manage staff, attendance, leave, and payroll operations across the school.
KPI strip: Total Staff | Present Today | On Leave Today | Contracts Expiring Soon | Pending Leave Approvals | Payroll Due This Month | Posted Payroll Runs
Quick actions: Add Staff | Approve Leave | Run Payroll | View Payslips | Export Report | More Actions
Main grid: attendance snapshot, contract expiry alerts, upcoming payroll calendar, recent HR activity, leave status summary, payroll processing progress
```

Rules:

- All metrics must come from backend summaries or show unavailable state.
- Dashboard quick actions render only when permission and module entitlement allow them.
- Payroll amount cards must not render for users without payroll permission.
- Contract expiry and leave approval cards must deep-link into filtered workspaces.
- Recent HR activity must be tenant-scoped and permission-filtered.

---

## 8.2 Staff Directory & Records Management

Primary job:

```text
Find, filter, inspect, and manage staff records safely.
```

Required composition:

```text
PageHeader: Staff Directory & Records Management
Primary action: Add Staff
Secondary: Import Staff
Filter bar: search, department, role, employment type, status, branch/campus, more filters
Table: selection, photo, name, staff ID, department, role, join date, employment type, status, contract status, actions
Right rail: selected staff quick profile, quick info, collapsible employment/salary/documents/emergency/notes sections
Footer: pagination, rows per page, total count
```

Required table behavior:

- Server-side pagination and filtering.
- Selected row state must be visible and accessible.
- Bulk actions only where safe and permission-approved.
- Export must use backend export/job flow when large.
- Sensitive fields in the rail must be masked or hidden unless permission allows.

Missing but required flows:

- Add staff wizard.
- Edit staff form.
- Staff import review screen.
- Duplicate staff warning.
- Staff deactivate/resign/terminate flow.
- Staff reactivation flow.

---

## 8.3 Staff Profile

Primary job:

```text
Act as the protected source-of-truth hub for one staff member.
```

Required sections:

```text
Identity header
Employment status / role / employee type / join date
Contact summary
Tabs: Overview | Personal Info | Employment | Documents | Contracts | Attendance | Leave | Payroll | Audit
Employment snapshot
Lifecycle timeline
Protected documents
Contract summary
Bank information
Salary information
Leave balance
Quick actions
```

Rules:

- Staff profile must be a full route, not only a drawer.
- Bank, salary, PAN, and protected document data are masked by default.
- All protected document view/download actions must go through File Registry-backed helpers.
- Lifecycle timeline must use backend audit/lifecycle events.
- Quick actions render only if permission allows.
- Reset password and profile updates require confirmation and audit where backend supports it.

---

## 8.4 Contract Expiry Reminders & Renewal Workspace

Primary job:

```text
Track contract timelines, send reminders, and manage renewal/non-renewal decisions.
```

Required composition:

```text
KPI strip: Expiring in 7 Days | Expiring in 30 Days | Auto Reminders Sent | Pending Renewals | Overdue Renewals
Tabs: All Contracts | Expiring Soon | Pending Renewal | Overdue | Renewed | Non-Renewed | History
Filter bar: department, contract type, renewal status, days left, owner
Table: staff, staff ID, department, contract type, start date, end date, days left, renewal status, reminder sent, owner, actions
Right rail: selected contract details, renewal notes, actions, timeline
Bottom panels: upcoming expiries, reminder configuration
```

Rules:

- `Renew Contract`, `Update Terms`, and `Mark Non-Renewal` are high-risk HR lifecycle actions and need confirmation/reason where policy requires.
- Reminder counts and reminder schedule must come from backend state.
- Overdue/non-renewed states must be explicit; do not treat missing date as expired unless backend marks it so.
- Download contract uses protected file flow.

---

## 8.5 Staff Attendance, Shift & Check-in/Check-out

Primary job:

```text
Monitor staff attendance, shift coverage, anomalies, correction requests, and check-in/check-out state.
```

Required composition:

```text
KPI strip: Present | Late | Absent | On Leave | Missing Check-out | Overtime
Filter bar: date, department, shift, status, more filters, reset
Daily Attendance Overview table: staff, department, shift, check-in, check-out, worked hours, status, late by, overtime, actions
Right panels: shift coverage, attendance anomalies, correction requests
Bottom panels: check-in/check-out direction, attendance trend, shift assignment summary
```

Rules:

- Attendance counts and worked hours must be backend-owned.
- Correction request approval/rejection requires reason and audit.
- Missing check-out and overtime states must not be inferred purely from browser time.
- Bulk marking requires backend support and confirmation.
- Check-in/check-out actions must show pending/success/error and handle duplicate submissions.

---

## 8.6 Leave Requests, Balances, Approval Queue & Calendar

Primary job:

```text
Review leave requests with balance, payroll impact, approval history, and calendar context.
```

Required composition:

```text
KPI strip: Pending Requests | Approved Today | Rejected | Leave Without Pay Cases | Staff Currently On Leave
Tabs: Requests | Approval Queue | Balances | Calendar
Filter bar: department, leave type, status, approver, date range
Table: staff, leave type, date range, days, balance before, balance after, payroll impact, approver, status, actions
Right rail: leave request details, payroll impact, balances, approver, timeline, attachments, actions
Bottom panels: leave calendar, leave balance cards
```

Rules:

- LWP payroll impact must come from backend calculation.
- Approve/reject/request clarification are high-impact actions with pending and audit states.
- Leave balance must not be recalculated in the browser.
- Attachments use protected file helpers.
- Calendar must distinguish approved, pending, rejected, and leave type colors with text labels.

---

## 8.7 Salary Structures, Allowances, Deductions & Versioning

Primary job:

```text
Configure versioned salary structures and assigned compensation components safely.
```

Required composition:

```text
KPI strip: Active Structures | Draft Structures | Employees Assigned | Statutory Deductions Synced | Pending Version Changes
Tabs: Salary Structures | Allowances | Deductions | Statutory | Assignments | Reports
Filter/search: structure search, status, employee group, filters
Table: structure name, employee group, status, current version, effective date, employees assigned, actions
Right rail: selected structure overview, assign employees, create version, salary components, estimated net pay
Bottom panel: version history and compare versions
```

Rules:

- Salary structure changes are versioned; do not silently mutate active posted structures.
- Effective dates and assigned employee counts come from backend.
- Gross/net pay preview is backend-owned or explicitly marked estimate from a backend preview endpoint.
- Statutory rates must not be hardcoded unless the repo has confirmed versioned statutory tables.
- Compare versions should show changed fields, old/new values, actor, timestamp, and effective date.

---

## 8.8 Payroll Runs — Draft, Review, Approve, Post, Reverse

Primary job:

```text
Process payroll through controlled states with immutable posted records and safe correction/reversal flows.
```

Required workflow states:

```text
Draft -> Review -> Approved -> Posted -> Reversed
```

Allowed UI behavior by state:

| Payroll state | UI behavior |
|---|---|
| Draft | Editable by authorized payroll user; recalculation allowed with pending state |
| Review | Editable only through review/exception workflow where backend permits |
| Approved | Locked except post or reopen if backend policy allows |
| Posted | Immutable; original run cannot be silently changed |
| Reversed | Read-only, linked to reversal/correction records |
| Correction Run | Linked to original posted run; explicit correction context |
| Failed Posting | Retry/rollback path shown only if backend exposes safe workflow |
| Period Locked | Backdated unsafe changes blocked |
| Accounting Disconnected | `Post Payroll` disabled with clear reason |

Required composition:

```text
Workflow stepper
Status banner: corrections are through reversal/correction runs
Payroll run header: run ID, period, pay date, frequency, created by, action buttons
Metric cards: employees included, gross payroll, net payroll, exceptions, posted journals, reversal requests
Entries table: staff, gross pay, allowances, deductions, net pay, status, exception flags, actions
Right rail: accounting integration, posting lock, journal posting preview, audit trail
Footer actions: download register, view audit trail, recalculate run
```

Rules:

- `Post Payroll`, `Reverse Run`, `Approve Run`, `Lock Run`, and `Recalculate Run` require confirmation and reason where policy requires.
- Post button must be disabled when exceptions, posting lock, period lock, or accounting integration failure exists.
- Journal preview must come from backend accounting boundary.
- Payroll totals must never be browser-calculated.
- Posted records are immutable. Corrections use reversal/correction workflows only.

---

## 8.9 Payslips, Protected Downloads, Branding, Reports & Filters

Primary job:

```text
Generate, deliver, preview, and download staff payslips as protected payroll artifacts.
```

Required composition:

```text
PageHeader: HR & Payroll: Payslips, Protected Downloads, Branding, Reports & Filters
Primary action: Generate Payslips
Secondary: Export Payroll Report, More Actions
Filter bar: month, department, payroll run, staff type, status
Table: staff, month, gross pay, deductions, net pay, delivery status, protected download, actions
Right rail: payslip preview, protected download, email payslip, regenerate, print preview
Bottom panels: total payouts, delivery success, pending downloads, protected file usage, recent payroll runs, quick actions
```

Rules:

- Payslip previews/downloads use protected file helpers only.
- Delivery status must distinguish generated, queued, sent, delivered, failed, downloaded, and not downloaded where backend supports it.
- Bulk protected download and bulk email require confirmation and partial-failure handling.
- Payslip template/branding settings belong in a settings/template route or modal with preview.
- Re-generate is high-risk when a payslip is already delivered or downloaded.

---

## 8.10 Staff Self-Service Portal

Primary job:

```text
Let staff view and manage only their own permitted information.
```

Required composition:

```text
Dedicated self-service sidebar
Overview dashboard: my profile, my attendance, my leave balances, my leave requests, my payslips, notices, compensation/bank details, quick links
Routes: My Profile | My Attendance | My Leave | My Payslips | Notices
```

Rules:

- Staff self-service must use purpose-limited APIs, not admin-shaped staff payloads.
- User sees own records only.
- Salary, bank, PAN, and contact details are masked by default.
- Payslip download is protected and audited where backend supports it.
- Leave request creation must show balance and policy validation from backend.
- Staff update profile actions should be approval-backed where school policy requires.

---

## 9. Permission and Privacy Matrix

| Data/action | Required frontend behavior |
|---|---|
| Staff directory | Role/module gated; row data limited by permission |
| Staff profile | Full route guarded by backend permission |
| Staff documents | Protected helper only; no raw URLs/object keys |
| Salary structure | HR/payroll/admin permission; otherwise hidden or safe permission state |
| Bank details | Payroll/admin permission only; masked by default |
| PAN/tax details | Payroll/admin permission only; masked by default |
| Payslip | Staff owner or authorized payroll user only |
| Leave approval | Approver/HR/admin only; reason/audit state where required |
| Payroll approve/post/reverse | Payroll-authorized role only; confirmation, reason, audit, backend state checks |
| Principal view | Summary/read-only unless explicit payroll permission exists |
| Staff self-service | Own data only; no admin payload leakage |
| Export/report | Permission-gated; protected/queued for large outputs |

Frontend hiding is only UX. Backend authorization remains mandatory.

---

## 10. Data Consistency Requirements

The references contain illustrative inconsistencies such as staff counts, dates, IDs, roles, and payroll periods. Implementation must not repeat this.

Rules:

- Never hardcode dashboard counts.
- Use a single backend dataset or shared fixture source for all M7 demo/dev states.
- Staff ID format must be consistent across directory, profile, payroll, payslip, and self-service.
- B.S./A.D. dates must use one formatter and show context consistently.
- NPR currency must use one formatter.
- One staff member must not appear with conflicting department/role unless the lifecycle/versioned employment data explains it.
- Payroll periods must be selected from backend fiscal/calendar context.

---

## 11. Nepal-Specific M7 Requirements

M7 web should support:

| Area | Requirement |
|---|---|
| Calendar | B.S. primary where school context requires it; A.D. secondary only where useful |
| Timezone | Nepal Time / NPT |
| Currency | NPR formatting |
| Salary | Basic salary, allowances, deductions, net pay |
| Statutory | PF, CIT, SSF, tax slabs where supported by backend/versioned policy |
| Tax identity | PAN support with masking |
| Leave | Nepali holidays and school-specific holidays where backend supports it |
| Payroll | Monthly payroll, approval, posting, correction, reversal, period locks |
| Reports | Excel/PDF exports through protected file/job flow |
| Payslips | School branding, protected download, delivery tracking |

Do not hardcode statutory rates or fiscal rules without versioned backend support.

---

## 12. Missing Screens and Modals to Add

### Staff management

- Add staff wizard.
- Edit staff form.
- Department management.
- Role/designation management.
- Staff document upload modal.
- Staff import review screen.
- Duplicate staff warning.
- Resignation/termination flow.
- Reactivation flow.

### Attendance

- Manual correction modal.
- Correction approval queue.
- Shift creation/edit screen.
- Holiday/weekend handling.
- Bulk attendance import.
- Device/GPS/biometric source log screen if backend supports it.

### Leave

- Leave type settings.
- Leave policy configuration.
- Leave balance adjustment screen.
- Multi-level approval workflow setup.
- Carry-forward/encashment settings.
- LWP payroll sync confirmation.

### Payroll

- Payroll run creation wizard.
- Payroll exception resolution screen.
- Employee-level payroll detail drawer.
- Recalculate confirmation modal.
- Post payroll confirmation modal.
- Reverse payroll confirmation modal.
- Correction run creation screen.
- Accounting journal detail screen.
- Fiscal/period lock warning screen.

### Payslips

- Payslip template and branding settings.
- Bulk delivery confirmation.
- Failed delivery retry screen.
- Protected download access log.
- Payslip password/PIN policy screen where supported.

### Reports

- HR report center.
- Payroll report center.
- Export queue.
- Large report processing state.
- Audit log search/filter screen.

---

## 13. High-Risk Actions Requiring Confirmation

These actions must not execute instantly:

```text
approve leave
reject leave
request leave clarification
generate payslips
send payslips
bulk protected download
re-generate delivered payslip
create salary structure version
activate salary structure version
assign salary structure to employees
create payroll run
recalculate payroll run
approve payroll run
post payroll
lock payroll run
reverse payroll run
create correction run
remove staff document
terminate staff contract
mark contract non-renewal
reset staff password
```

Confirmation dialog must include:

```text
action name
affected record(s)
impact preview
reason/comment where policy requires it
pending state
success/error state
safe retry behavior
```

---

## 14. Audit Requirements

Audit-sensitive M7 actions should expose or request enough context for the backend audit log:

```text
actor
role
action
target entity
old value
new value
timestamp
reason/comment
source workflow
IP/device where backend captures it
```

Frontend must show audit timeline where it affects trust:

- Staff profile lifecycle.
- Staff documents.
- Contract renewal/non-renewal.
- Leave approvals.
- Payroll recalculation.
- Payroll approval/post/reversal.
- Payslip generation/delivery/download.

---

## 15. Responsive Behavior

The references are desktop-first. Admin HR/payroll work may remain optimized for desktop, but it still needs safe responsive behavior.

| Width | Required behavior |
|---|---|
| >= 1440px | Persistent sidebar, main workspace, and optional 280-360px right rail allowed |
| 1024-1439px | Compact sidebar; right rail collapses to drawer when needed |
| 768-1023px | Tables horizontally contained; filters collapse; detail panels become drawers |
| < 768px | Prefer card-list layout for staff self-service; admin dense tables may require horizontal containment |

Staff self-service must be more mobile-friendly than admin payroll screens.

---

## 16. Implementation Priority

### Phase 1 — Foundation

1. HR/payroll layout and module sidebar.
2. Shared cards, tables, filters, badges, drawers, protected fields.
3. Staff directory.
4. Staff profile.
5. Staff documents.
6. Staff contracts.

### Phase 2 — Attendance and Leave

1. Attendance dashboard/table.
2. Shift and roster views.
3. Leave requests.
4. Leave approval rail.
5. Leave balances.
6. Leave calendar.

### Phase 3 — Salary and Payroll

1. Salary structures.
2. Allowances and deductions.
3. Payroll run list.
4. Payroll run detail.
5. Payroll exceptions.
6. Payroll approval/posting/reversal states.

### Phase 4 — Payslips and Reports

1. Payslip list.
2. Payslip preview.
3. Protected download.
4. Delivery tracking.
5. HR reports.
6. Payroll reports.

### Phase 5 — Staff Self-Service

1. Self-service dashboard.
2. My profile.
3. My attendance.
4. My leave.
5. My payslips.
6. Notices.

---

## 17. M7 Acceptance Checklist

Before marking M7 frontend complete:

```text
[ ] M7 sidebar/navigation is consistent across all HR/payroll screens.
[ ] Admin HR routes and staff self-service routes are separated.
[ ] Staff directory uses server-side pagination/filtering.
[ ] Staff profile is a full route with permission-gated sections.
[ ] Salary, bank, PAN, and payroll fields are masked or hidden unless allowed.
[ ] Staff documents and payslips use protected file helpers only.
[ ] Leave approvals show balance, payroll impact, action state, and audit timeline.
[ ] Attendance counts, worked hours, overtime, and late calculations are backend-owned.
[ ] Salary structures are versioned and effective-dated.
[ ] Payroll run state machine is visible and enforced in UI.
[ ] Posted payroll is immutable in UI; correction/reversal flow is used.
[ ] Post payroll is blocked when accounting/period/exception state is unsafe.
[ ] Journal preview comes from backend accounting boundary.
[ ] Payslip generation/delivery supports queued/partial-failure states where backend supports it.
[ ] Large exports use queued/protected job flow.
[ ] Every high-risk M7 action has confirmation, pending, success, and error state.
[ ] Every sensitive action supports reason/audit where backend policy requires it.
[ ] All KPIs come from backend summaries or show unavailable state.
[ ] No fake counts, fake payroll amounts, fake staff roles, or browser-only official totals.
[ ] B.S./A.D., NPT, and NPR formatting are consistent.
[ ] Loading, empty, error, permission, locked, file unavailable, queued, and partial-failure states exist.
[ ] Principal and staff self-service users cannot see payroll/private staff data without permission.
```

---

## 18. Final M7 Standard

M7 is not just a staff table. It is a controlled HR and payroll operating system.

A correct implementation makes the user feel:

```text
I can find staff quickly.
I know which HR work needs attention.
I know which payroll action is safe.
I cannot accidentally mutate posted payroll.
I can trust salary, leave, attendance, document, and payslip data.
```

That is the frontend standard for SchoolOS Module 7.
