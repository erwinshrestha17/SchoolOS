# M7 HR and Payroll — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-21
**Module:** M7 HR and Payroll
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M7 manages staff identity, employment records, documents, leave, attendance, salary structures, payroll runs, payslips, and staff self-service.

It replaces disconnected files and spreadsheets with permissioned HR records and an auditable payroll state machine without exposing salary or bank data broadly.

For Nepal schools, it must support local contracts, PAN/bank/tax fields, leave and attendance practices, NPR payroll, Nepali calendar context where configured, and protected payslips.

---

## 2. Full Feature List

### Staff directory and profile

**Purpose:**
Maintains active staff identity, role/employment status, contacts, emergency data, and history.

**Users:**
HR/admin; staff sees own projection.

**Frontend behavior:**
Permission-aware directory and tabbed profile with masked sensitive fields.

**Backend alignment:**
Backend scopes fields and lifecycle.

### Staff documents and contracts

**Purpose:**
Stores protected identity, qualification, appointment, and contract files with expiry/version state.

**Users:**
HR and authorized staff self-service.

**Frontend behavior:**
Document checklist, protected open/upload, expiry alerts, contract timeline.

**Backend alignment:**
File Registry and backend authorization/versioning.

### Leave workflow

**Purpose:**
Supports request, balance check, review, approve/reject/cancel, and calendar impact.

**Users:**
Staff, manager, HR.

**Frontend behavior:**
Self-service form and approver queue with backend balances.

**Backend alignment:**
Backend owns eligibility, balance, overlap, transitions.

### Attendance/check-in

**Purpose:**
Shows authorized staff attendance and self check-in state where approved.

**Users:**
Staff and HR.

**Frontend behavior:**
Daily status, timestamp/source, correction path, no fabricated location truth.

**Backend alignment:**
Backend validates method, window, and scope.

### Salary structures

**Purpose:**
Defines versioned earnings/deductions/effective dates for authorized staff.

**Users:**
Payroll officer.

**Frontend behavior:**
Masked structure table/form with totals from backend preview.

**Backend alignment:**
Backend computes and versions structures.

### Payroll run state machine

**Purpose:**
Moves a period through draft, validate, approve, post, pay/correct states.

**Users:**
Payroll officer and approver.

**Frontend behavior:**
Run checklist, exception table, backend totals, gated transitions.

**Backend alignment:**
Backend owns calculations, locks, idempotency, posting.

### Payslips

**Purpose:**
Provides staff-safe versioned protected payslips only after allowed state.

**Users:**
Payroll and individual staff.

**Frontend behavior:**
Payslip history with masked summary and protected open/download.

**Backend alignment:**
Backend generates and File Registry scopes.

### Staff self-service

**Purpose:**
Lets a staff member see/update permitted own details, leave, attendance, documents, and payslips.

**Users:**
Staff.

**Frontend behavior:**
Separate purpose-limited routes; never reuse admin payload.

**Backend alignment:**
Backend self scope fails closed.

### Sensitive field masking

**Purpose:**
Protects salary, bank, PAN, tax, identity, and document data.

**Users:**
All roles.

**Frontend behavior:**
Masked-by-default values with permissioned reveal if policy allows and audit.

**Backend alignment:**
Backend omits unauthorized fields; reveal needs verification.

### M11 accounting handoff

**Purpose:**
Shows approved payroll posting/handoff status without client ledger writes.

**Users:**
Payroll/accounting roles.

**Frontend behavior:**
Run-level handoff badge and exception detail.

**Backend alignment:**
Backend integration owns accounting event/posting.

---

## 3. Frontend Design Direction Based on Features

Use a sensitive staff and payroll workspace inside the standard SchoolOS app shell. Follow [the master web plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

- Layout: module header, optional backend KPI strip, shallow tabs, server filter bar, main workspace, and selection drawer.
- Density: compact enough for laptop operations, with decision context and field labels never sacrificed.
- Cards/tables: cards only for backend summaries; growing lists are server-paginated tables; visual media may use a grid.
- Drawers/tabs: drawers preserve list context; tabs separate stable subdomains, not arbitrary steps.
- Forms: sectioned, inline-validating, keyboard usable, and sticky-action only when long.
- Filters/actions: URL-preserved server filters; one primary action; import/export/settings under secondary actions.
- Confirmations/badges: high-risk changes require impact, reason, and confirmation; every color has text.
- States: loading, empty, no results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file unavailable.
- Files: File Registry authenticated helpers only; never raw keys, provider links, or persistent signed URLs.
- Responsive: collapse rails to drawers, prioritize table columns, and move long filters into an expandable panel.

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| HR/payroll officer | Tenant staff, leave, salary/payroll, documents | Other tenants and unauthorized posting | All M7 admin screens |
| Principal | Permissioned approvals and aggregate snapshot | Salary/bank detail without permission | Approval/run summary |
| Staff self-service user | Own profile, leave, attendance, documents, payslips | Other staff/admin payroll | Self-service routes |
| Accountant | Approved handoff/status where permitted | HR private details | Payroll handoff |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes/contracts where present; differences need router/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/hr
/dashboard/hr/staff
/dashboard/hr/staff/new
/dashboard/hr/staff/[staffId]
/dashboard/hr/staff/[staffId]/documents
/dashboard/hr/departments
/dashboard/hr/designations
/dashboard/hr/contracts
/dashboard/hr/contracts/[contractId]
/dashboard/hr/leave
/dashboard/hr/attendance
/dashboard/hr/attendance/corrections
/dashboard/hr/shifts
/dashboard/hr/rosters
/dashboard/payroll
/dashboard/payroll/salary-structures
/dashboard/payroll/allowances
/dashboard/payroll/deductions
/dashboard/payroll/runs/[runId]
/dashboard/payroll/runs/[runId]/exceptions
/dashboard/payroll/runs/[runId]/journals
/dashboard/payroll/payslips
/dashboard/payroll/reports
```

### Staff Self-Service Routes

```text
/staff/profile
/staff/leave
/staff/attendance
/staff/payslips
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Staff Directory and Profile

**Purpose:**
Find and manage permissioned staff records.

**Main users:**
HR/admin.

**Route:**
`/dashboard/hr/staff` (planning route; reuse current route if different).

**Main features shown on this screen:**
Directory, profile, documents, contracts, masking.

**Layout:**
Module header, filter/context bar, Table with staff code, name, role/department, employment type, join date, status, document alerts, and a right drawer for profile tabs, masked contacts/bank/PAN, files, contract, audit.

**Header actions:**
Add Staff

**Filters:**
Status, role, department, employment type, date, search

**KPI cards / summary cards:**
Active; on leave; contract expiry; missing documents

**Main table / list / grid:**
Table with staff code, name, role/department, employment type, join date, status, document alerts

**Right drawer / detail panel:**
profile tabs, masked contacts/bank/PAN, files, contract, audit

**Forms / modals:**
Profile/employment/contact/contract fields

**Confirmations:**
Deactivate/contract end/sensitive reveal requires confirmation and permission

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Scoped directory/detail, field permissions, lifecycle, document metadata.

**Protected files:**
Staff documents/contracts protected.

**Audit behavior:**
Profile, contract, status, reveal/download actions.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 2. Leave and Staff Attendance

**Purpose:**
Process leave and attendance exceptions with balances and audit.

**Main users:**
HR, approver; staff via self-service.

**Route:**
`/dashboard/hr/leave` (planning route; reuse current route if different).

**Main features shown on this screen:**
Leave workflow and check-in/correction.

**Layout:**
Module header, filter/context bar, Tabs for requests, calendar, balances, attendance exceptions, and a right drawer for balance, overlap, coverage, attendance history, timeline.

**Header actions:**
Review Request

**Filters:**
Status, date, staff, department, leave type

**KPI cards / summary cards:**
Pending; approved today; absent; correction pending

**Main table / list / grid:**
Tabs for requests, calendar, balances, attendance exceptions

**Right drawer / detail panel:**
balance, overlap, coverage, attendance history, timeline

**Forms / modals:**
Leave request/decision/correction reason

**Confirmations:**
Approve/reject/cancel/correction requires reason

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Balances, overlap validation, requests/transitions, attendance state.

**Protected files:**
Evidence protected if supported.

**Audit behavior:**
Request/decision/cancel/correction/check-in.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 3. Salary Structures

**Purpose:**
Maintain effective-dated earnings/deductions safely.

**Main users:**
Payroll officer.

**Route:**
`/dashboard/payroll/salary-structures` (planning route; reuse current route if different).

**Main features shown on this screen:**
Salary structures and masking.

**Layout:**
Module header, filter/context bar, Permissioned table with staff, version, effective date, status, backend gross/deduction/net preview, and a right drawer for components, effective history, masked bank/tax context, audit.

**Header actions:**
Create Structure Version

**Filters:**
Status, department, effective period, search

**KPI cards / summary cards:**
Active structures; expiring; missing; draft

**Main table / list / grid:**
Permissioned table with staff, version, effective date, status, backend gross/deduction/net preview

**Right drawer / detail panel:**
components, effective history, masked bank/tax context, audit

**Forms / modals:**
Earning/deduction components, effective date, note

**Confirmations:**
Activate/replace requires impact and reason

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Component definitions, preview calculation, version/activation.

**Protected files:**
Supporting approval file protected if present.

**Audit behavior:**
Create/version/activate, before/after, viewer/reveal where required.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 4. Payroll Run

**Purpose:**
Validate, approve, post, and track one payroll period.

**Main users:**
Payroll officer, approver.

**Route:**
`/dashboard/payroll/runs/[runId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Payroll state machine, payslips, M11 handoff.

**Layout:**
Module header, filter/context bar, Run header/checklist, backend totals, employee exception table, transition timeline, and a right drawer for employee calculation breakdown by permission, blockers, approvals, handoff.

**Header actions:**
Validate Run / next allowed action

**Filters:**
Period, department, exception, employee status

**KPI cards / summary cards:**
Gross; deductions; net; employees; exceptions from backend

**Main table / list / grid:**
Run header/checklist, backend totals, employee exception table, transition timeline

**Right drawer / detail panel:**
employee calculation breakdown by permission, blockers, approvals, handoff

**Forms / modals:**
Run parameters, correction/reversal reason

**Confirmations:**
Approve/post/pay/correct requires exact impact, permission, reason, idempotency

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Run calculations, exceptions, eligibility, transitions, posting/handoff, payslip job.

**Protected files:**
Payslips and run reports protected.

**Audit behavior:**
Every transition, approver, calculation version, correction, handoff.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 5. Staff Self-Service

**Purpose:**
Give a staff member safe access to their own employment services.

**Main users:**
Staff self-service user.

**Route:**
`/staff/profile` (planning route; reuse current route if different).

**Main features shown on this screen:**
Own profile, leave, attendance, documents, payslips.

**Layout:**
Module header, filter/context bar, Cards/tabs for own profile, leave balance/requests, attendance, documents, payslips, and a right drawer for own record details only; no other staff search.

**Header actions:**
Request Leave

**Filters:**
Date/status filters per tab

**KPI cards / summary cards:**
Own leave balance; attendance summary; latest payslip availability

**Main table / list / grid:**
Cards/tabs for own profile, leave balance/requests, attendance, documents, payslips

**Right drawer / detail panel:**
own record details only; no other staff search

**Forms / modals:**
Allowed contact update and leave request

**Confirmations:**
Cancel leave or acknowledge document requires confirmation where applicable

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Purpose-limited own profile/leave/attendance/document/payslip APIs.

**Protected files:**
Own protected documents and payslips.

**Audit behavior:**
Own requests/updates/downloads; no admin audit internals.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

---

## 7. Simple Wireframe Designs

### 1. Staff Directory and Profile

```text
+------------------------------------------------------------------+
| Staff Directory and Profile                 [Add Staff] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Active; on leave; contract expiry; missing documents  |
+------------------------------------------------------------------+
| Filters: Status, role, department, employment type, date, sear |
+--------------------------------------------+---------------------+
| Table with staff code, name, role/depart | profile tabs, mas |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Profile/employment/contact/contract fields                     |
+------------------------------------------------------------------+
```

### 2. Leave and Staff Attendance

```text
+------------------------------------------------------------------+
| Leave and Staff Attendance                  [Review Request] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Pending; approved today; absent; correction pending   |
+------------------------------------------------------------------+
| Filters: Status, date, staff, department, leave type           |
+--------------------------------------------+---------------------+
| Tabs for requests, calendar, balances, a | balance, overlap, |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Leave request/decision/correction reason                       |
+------------------------------------------------------------------+
```

### 3. Salary Structures

```text
+------------------------------------------------------------------+
| Salary Structures                           [Create Structure] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Active structures; expiring; missing; draft           |
+------------------------------------------------------------------+
| Filters: Status, department, effective period, search          |
+--------------------------------------------+---------------------+
| Permissioned table with staff, version,  | components, effec |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Earning/deduction components, effective date, note             |
+------------------------------------------------------------------+
```

### 4. Payroll Run

```text
+------------------------------------------------------------------+
| Payroll Run                                 [Validate Run / n] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Gross; deductions; net; employees; exceptions from ba |
+------------------------------------------------------------------+
| Filters: Period, department, exception, employee status        |
+--------------------------------------------+---------------------+
| Run header/checklist, backend totals, em | employee calculat |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Run parameters, correction/reversal reason                     |
+------------------------------------------------------------------+
```

### 5. Staff Self-Service

```text
+------------------------------------------------------------------+
| Staff Self-Service                          [Request Leave] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Own leave balance; attendance summary; latest payslip |
+------------------------------------------------------------------+
| Filters: Date/status filters per tab                           |
+--------------------------------------------+---------------------+
| Cards/tabs for own profile, leave balanc | own record detail |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Allowed contact update and leave request                       |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Title, purpose, primary and secondary actions | Reuse | Keep school context visible. |
| `KpiGrid` / `SummaryStrip` | Backend-owned totals | Reuse | Unavailable if summary API is absent. |
| `FilterBar` | Server filtering/search | Reuse | Preserve filters where practical. |
| Paginated table / purposeful grid | Operational records | Reuse | Permission-safe columns. |
| Status badges | Lifecycle and risk | Extend shared | Text plus semantic color. |
| Detail drawer | Detail, actions, timeline | Reuse | Reauthorize mutations. |
| Validated form / sticky footer | Create/edit workflows | Reuse | Inline bounded errors. |
| Reason dialog | High-risk confirmation | Reuse | Show impact and require reason. |
| Protected file/upload controls | Authenticated file actions | Reuse | File Registry only. |
| Audit timeline | Actor, reason, transition | Reuse/create shared | Backend facts only. |
| M7 widgets | staff profile, leave, attendance, salary, payroll-run, payslip, and masked-field widgets | Create composition | Reuse shared primitives. |

---

## 9. Backend and API Alignment

> These are capability labels, not endpoint names. Use current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summary, paginated list, scoped detail, backend totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated create/update commands with permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Staff lifecycle; contract version; leave request/decision/cancel; attendance correction; salary version; payroll validate/approve/post/pay/correct. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Employment state, effective dates, leave balance/overlap, check-in policy, payroll period/lock/components, idempotency. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Payroll registers, exception reports, payslips and summaries are queued protected outputs. **needs OpenAPI confirmation** unless verified in the current contract.

The protected payslip regeneration contract is verified as:

- `POST /api/v1/payroll/runs/:runId/payslips/:payslipId/regeneration-jobs` queues or reuses the active job.
- `GET /api/v1/payroll/runs/:runId/payslips/:payslipId/regeneration-jobs/:jobId` returns `QUEUED`, `PROCESSING`, `SUCCEEDED`, or `FAILED` plus bounded generation counts.
- Both routes require `payroll:payslip:generate`, remain tenant/run/payslip scoped, and never expose queue payloads, storage keys, provider errors, or raw failure reasons.

### File Registry / Protected File APIs

Staff documents, contracts, evidence, payslips, payroll reports use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Leave decisions, document expiry, payroll/payslip events emit M12 notifications without sensitive bodies. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

M7 calculates/approves payroll; M11 owns official accounting entries. UI never posts journals directly. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Sensitive view/reveal where supported, staff/contracts, leave, attendance, salary versions, payroll transitions, files. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Staff self-service is own-data only; principal/accountant receive purpose-limited projections. **needs OpenAPI confirmation** unless verified in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Request pending | Layout skeleton; retain context | Request state |
| Empty | No records | Explain and offer one permitted action | Empty response |
| No search results | Filters match nothing | Preserve/clear filters | List metadata |
| Validation error | Input invalid | Inline errors and summary | Safe validation envelope |
| Permission denied | Scope fails | Reveal no forbidden data | Backend RBAC |
| Module locked | Entitlement off | Locked screen; no fake values | Entitlement guard |
| Mutation pending | Command in flight | Prevent duplicate submit | Mutation/job state |
| Success | Backend confirms | Feedback and refetch | Confirmed response |
| Failure | Safe command error | Friendly parsed error/retry | Safe error envelope |
| Partial failure | Batch partly succeeds | Itemized result/retry | Batch result |
| Queued job | Async work | Job tracker | Job API |
| Protected file unavailable | Missing/unauthorized | Safe unavailable state | File Registry |
| Stale data | Timestamp exceeds policy | Stale label and refresh | Backend timestamp |
| Payroll posted | Run is immutable after posting | Disable edits and offer approved correction/reversal path | Payroll state machine |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates every query, job, export, file, and event; browser input is never trusted tenant scope.
- Backend RBAC and module entitlement are authoritative; hidden controls are UX only.
- Salary, bank, PAN, tax, identity, and payslip fields are omitted/masked by backend permission.
- Staff self-service never receives admin-shaped directory or payroll-run payloads.
- Posted payroll cannot be silently edited; correction/reversal is audited.
- Sensitive fields are omitted/masked by permission and never placed in URLs, logs, or analytics.
- Protected files use File Registry helpers; never raw object keys, provider URLs, or storage errors.
- Audit-sensitive actions display backend actor/time/reason/history only.
- Raw backend, provider, Prisma, and storage errors never reach users.

---

## 12. Nepal-Specific Requirements

- Format payroll in NPR using exact backend Decimal values.
- Support PAN, local bank/payment details, appointment/contract documents, and school employment categories with strict masking.
- Use school leave calendars, holidays, shifts and attendance policies.
- Payslips need approved school identity, period, earnings/deductions, net, status, and protected delivery.
- Tax/statutory calculations remain backend/policy owned and need current legal verification.

---

## 12A. Consolidated M7 Reference Notes

The retired M7 web design reference was merged here so this file remains the active M7 frontend source of truth.

- M7 navigation keeps HR staff lifecycle, attendance, leave, contracts, salary structures, payroll runs, payslips, reports, and staff self-service separated. Global finance may link to payroll handoff/status, but it does not own HR staff lifecycle or payroll processing.
- Staff profile is a full protected route, not only a drawer. Bank, salary, PAN, tax, contract, and protected document sections are masked or omitted unless permission allows; reveal/download actions are audit-sensitive where backend supports audit.
- Staff directory, profile, contracts, attendance, leave, salary structures, payroll runs, payslips, reports, and self-service should reuse shared tables, filters, rails, protected fields, protected-file controls, workflow steppers, queued job state, partial failure state, and audit timelines.
- Missing but expected HR flows are add/edit staff, import review, duplicate staff warning, deactivate/resign/terminate, reactivation, contract renewal/non-renewal, attendance corrections, shift/roster setup, leave policy/balance adjustments, payroll exception resolution, correction run creation, payslip delivery retry, and export queues. Implement only when backend contracts are verified.
- Payroll uses a controlled state model: Draft, Review, Approved, Posted, Reversed, Correction Run, Failed Posting, Period Locked, and Accounting Disconnected where exposed. Posted payroll is immutable; corrections use reversal/correction flows only.
- High-risk actions require impact preview, permission, pending/success/error state, safe retry behavior, and reason where policy requires it: leave decisions, payslip generation/delivery, salary version activation, payroll create/recalculate/approve/post/lock/reverse/correction, protected bulk download, contract non-renewal, staff termination, and password reset.
- Staff self-service uses purpose-limited own-data APIs and a more mobile-friendly layout than admin payroll screens. It must never receive admin directory or payroll-run payloads.

---

## 13. Implementation Checklist

```text
[ ] Uses SchoolOS layout and design system.
[ ] Features map to screens; every screen maps to a wireframe.
[ ] Current route/OpenAPI/contracts/permissions were inspected.
[ ] Real APIs and backend-owned totals only; no fake metrics.
[ ] Lists paginate/filter server-side.
[ ] All global and domain states exist.
[ ] Protected files use File Registry helpers.
[ ] Purpose-limited personas fail closed.
[ ] High-risk actions confirm, collect reason, prevent duplicates, and show audit state.
[ ] Unknowns say needs OpenAPI confirmation or needs backend verification.
[ ] Responsive layout preserves the main job.
```

---

## 14. Done Definition

```text
[ ] All module features are explained.
[ ] Each feature has matching frontend behavior.
[ ] Every expected screen is documented and wireframed.
[ ] Backend/API and file needs are listed without invented endpoints.
[ ] Required states and security/role boundaries are clear.
[ ] Nepal-specific needs are included.
[ ] Design is simple and implementation-friendly.
[ ] Implementation does not require module detail from the master plan.
```
