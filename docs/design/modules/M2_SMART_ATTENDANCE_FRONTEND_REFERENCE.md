# M2 Smart Attendance — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-19
**Module:** M2 Smart Attendance
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M2 records daily student attendance, supports assignment-scoped teacher marking, controlled correction, registers, and linked-child visibility.

It replaces paper registers and untraceable edits with a quick daily workflow, explicit lock windows, auditable corrections, and trustworthy absence/late communication.

For Nepal schools, it must fit class-teacher routines, school calendars, section/roll ordering, late/half-day policies, and SMS-conscious guardian alerts.

---

## 2. Full Feature List

### Attendance dashboard

**Purpose:**
Summarizes completion, absence, lateness, missing registers, and corrections for the selected day.

**Users:**
Admin, principal, attendance officer.

**Frontend behavior:**
Backend KPI strip and class/section completion queue with drill-down.

**Backend alignment:**
Summary and completion state are backend-owned.

### Teacher mark attendance

**Purpose:**
Lets teachers mark only assigned class/section/date students quickly in roll order.

**Users:**
Assigned teacher.

**Frontend behavior:**
Dense register with Present default only if policy permits, row status controls, bulk safe action, and submit.

**Backend alignment:**
Roster, assignments, working-day rules, submission, and totals are backend-owned.

### Admin review

**Purpose:**
Shows submitted, missing, suspicious, and incomplete registers for operational follow-up.

**Users:**
Admin and attendance officer.

**Frontend behavior:**
Review queue with class/date/teacher/status and drawer details.

**Backend alignment:**
Backend provides authoritative completion and anomaly flags.

### Correction workflow

**Purpose:**
Changes a submitted record through request/review/approve/reject rather than silent overwrite.

**Users:**
Teacher requester and authorized approver.

**Frontend behavior:**
Correction form with before/after, reason, evidence, approval timeline.

**Backend alignment:**
Backend owns correction eligibility, transition, and audit.

### Lock windows

**Purpose:**
Prevents edits after policy deadlines, payroll/report cutoffs, or locked academic periods.

**Users:**
All attendance users.

**Frontend behavior:**
Visible lock banner, deadline, permitted correction path, and disabled mutation controls.

**Backend alignment:**
Backend time/policy/period lock is authoritative.

### Class/date/section filters

**Purpose:**
Finds the correct register without loading unrelated students.

**Users:**
Teacher and admin.

**Frontend behavior:**
Academic year, date, class, section, shift/status filters backed by server queries.

**Backend alignment:**
Backend assignment and tenant filters must apply.

### Parent/student attendance views

**Purpose:**
Shows a safe personal/linked-child calendar and summary.

**Users:**
Parent and student.

**Frontend behavior:**
Monthly calendar/list with present/absent/late/leave status and no peer data.

**Backend alignment:**
Purpose-limited child/self API required.

### Absence/late M12 alignment

**Purpose:**
Emits duplicate-safe events after authoritative attendance submission/correction.

**Users:**
Admin and guardian recipients through M12.

**Frontend behavior:**
Attendance UI shows notification event status, not direct provider controls.

**Backend alignment:**
M2 emits normalized events; M12 owns recipients/delivery/retry.

### Monthly register exports

**Purpose:**
Produces official class/student register files from backend truth.

**Users:**
Admin and permitted staff.

**Frontend behavior:**
Queued export action with period/class filters, job status, and protected download.

**Backend alignment:**
Backend generates snapshot/export; File Registry protects output.

---

## 3. Frontend Design Direction Based on Features

Use a daily register workspace under the global SchoolOS app shell. Keep one primary job per route, calm white surfaces, the module accent only for location, and semantic colors for status.

- **Layout style:** Module header, optional KPI strip, compact subnavigation, filter bar, main work area, and a right drawer for selection context.
- **Page density:** Laptop-friendly operational density; do not compress forms or hide decision context.
- **Cards and tables:** Cards summarize backend-owned values; paginated tables handle growing records; grids are reserved for visual content.
- **Drawers and tabs:** Drawers support review without losing filters. Tabs separate stable subdomains, not workflow steps.
- **Forms:** Group school-language fields, show inline validation, preserve safe drafts only when the backend supports them, and use sticky actions for long forms.
- **Filters and quick actions:** Server-side search/filtering; one primary header action; exports, imports, settings, and destructive actions under secondary menus.
- **Dialogs and badges:** Confirmation plus reason for high-risk actions. Text labels accompany every status color.
- **States:** Every route implements loading, empty, no-results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file-unavailable behavior.
- **Protected files:** Use File Registry-backed authenticated buttons/links; never render raw keys, provider URLs, or persistent signed URLs.
- **Responsive behavior:** At narrower desktop/tablet widths, collapse detail rails into drawers, prioritize columns, and move long filters into an expandable panel.

Follow [the master web design plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the web design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Admin | Tenant attendance dashboards, reviews, corrections, exports | Other tenants or forbidden class data | Dashboard, review, corrections, exports |
| Principal | School completion and exception summaries | Row edits without permission | Dashboard and review |
| Teacher | Assigned class/section marking and correction requests | Unassigned rosters and direct locked-date edits | Mark register, corrections |
| Parent | Linked-child attendance | Peers and internal correction notes | Parent attendance |
| Student | Own attendance | Peer attendance | Student attendance |

---

## 5. Recommended Route Map

> These are design-planning routes. Reuse current routes and names where they exist; additions or differences need OpenAPI/router confirmation.

### Admin / Staff Routes

```text
/dashboard/attendance
/dashboard/attendance/registers
/dashboard/attendance/review
/dashboard/attendance/corrections
/dashboard/attendance/reports
```

### Parent Routes

```text
/parent/children/[studentId]/attendance
```

### Student Routes

```text
/student/attendance
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Attendance Dashboard

**Purpose:**
See today’s completion and attention queue.

**Main users:**
Admin, principal, attendance officer.

**Route:**
`/dashboard/attendance` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Dashboard; admin review; filters; export status.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Class/section status table with teacher, roster count, marked count, absent, late, lock, and updated time, and a right detail drawer for selected class summary, notification state, latest audit.

**Header actions:**
Open Register; Export Monthly Register

**Filters:**
Date, academic year, class, section, shift, completion

**KPI cards / summary cards:**
Completion rate; missing registers; absent; late; corrections pending

**Main table / list / grid:**
Class/section status table with teacher, roster count, marked count, absent, late, lock, and updated time

**Right drawer / detail panel:**
selected class summary, notification state, latest audit

**Forms / modals:**
None

**Confirmations:**
Bulk reminders/export require confirmation where applicable

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Daily summary, paginated class completion, locks, and notification event state.

**Protected files:**
Monthly exports protected.

**Audit behavior:**
Reviews, reminder/export requests, late admin changes.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 2. Teacher Mark Register

**Purpose:**
Mark and submit one assigned register quickly.

**Main users:**
Assigned teacher.

**Route:**
`/dashboard/attendance/registers/[registerId]` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Teacher mark attendance; lock window; row notes.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Roll-ordered roster with admission number, student, status, arrival/leave reason, note, prior state, and a right detail drawer for student-safe context and existing record history.

**Header actions:**
Submit Attendance; Save Draft if backend supports it

**Filters:**
Date, assigned class/section; student search

**KPI cards / summary cards:**
Marked; unmarked; absent; late; leave

**Main table / list / grid:**
Roll-ordered roster with admission number, student, status, arrival/leave reason, note, prior state

**Right drawer / detail panel:**
student-safe context and existing record history

**Forms / modals:**
Row status/note; bulk mark; submission summary

**Confirmations:**
Submit after count review; locked register routes to correction

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Assigned roster, working day, lock, draft/submission and validation contracts.

**Protected files:**
Evidence attachment only if supported through File Registry.

**Audit behavior:**
Draft/submission, bulk changes, actor/time, notification event emission.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 3. Admin Review and Corrections

**Purpose:**
Review incomplete registers and decide correction requests.

**Main users:**
Admin, attendance approver.

**Route:**
`/dashboard/attendance/review` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Admin review; correction workflow; lock handling.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Queues/tabs for missing, submitted, correction requested, approved, rejected; before/after table, and a right detail drawer for request reason, before/after, evidence, lock, timeline.

**Header actions:**
Approve Correction; Reject; Request Clarification

**Filters:**
Date range, class, section, requester, status, locked

**KPI cards / summary cards:**
Pending corrections; overdue registers; approved today

**Main table / list / grid:**
Queues/tabs for missing, submitted, correction requested, approved, rejected; before/after table

**Right drawer / detail panel:**
request reason, before/after, evidence, lock, timeline

**Forms / modals:**
Correction decision comment; permitted admin correction form

**Confirmations:**
Approval/rejection and post-lock changes require reason

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Review queues, correction detail, transition eligibility, lock policy.

**Protected files:**
Correction evidence and register export protected.

**Audit behavior:**
Request, decision, before/after values, actor, reason.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 4. Parent / Student Attendance

**Purpose:**
Show only personal attendance history and understandable totals.

**Main users:**
Parent, student.

**Route:**
`/parent/children/[studentId]/attendance` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Child/self calendar; monthly summary; absence/late state.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Monthly calendar plus chronological list with date, day, status, arrival, approved note when safe, and a right detail drawer for selected day details and school contact guidance.

**Header actions:**
Change Child; Download allowed summary

**Filters:**
Month, academic year, status

**KPI cards / summary cards:**
Present; absent; late; leave; attendance rate from backend

**Main table / list / grid:**
Monthly calendar plus chronological list with date, day, status, arrival, approved note when safe

**Right drawer / detail panel:**
selected day details and school contact guidance

**Forms / modals:**
None

**Confirmations:**
None

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Linked-child/self summary and day-detail contracts.

**Protected files:**
Allowed monthly summary only if backend provides protected export.

**Audit behavior:**
Read/open only; no internal correction/audit data.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 5. Monthly Registers and Exports

**Purpose:**
Generate official attendance registers from locked backend data.

**Main users:**
Admin and permitted reporting staff.

**Route:**
`/dashboard/attendance/reports` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Monthly register exports; filters; job history.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Report form plus export job table with class/section, period, requested by, state, generated time, and a right detail drawer for job parameters, snapshot time, failure-safe detail, download.

**Header actions:**
Generate Register

**Filters:**
Academic year, month/date range, class, section, status

**KPI cards / summary cards:**
Queued; processing; ready; failed

**Main table / list / grid:**
Report form plus export job table with class/section, period, requested by, state, generated time

**Right drawer / detail panel:**
job parameters, snapshot time, failure-safe detail, download

**Forms / modals:**
Report parameters

**Confirmations:**
Generation/re-generation requires confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Report validation, snapshot, queued job, status and metadata.

**Protected files:**
Generated register protected via File Registry.

**Audit behavior:**
Requester, parameters, snapshot/version, download.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

---

## 7. Simple Wireframe Designs

### 1. Attendance Dashboard

```text
+------------------------------------------------------------------+
| Attendance Dashboard                       [Open Register] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Completion rate; missing registers; absent; late; cor |
+------------------------------------------------------------------+
| Filters: Date, academic year, class, section, shift, completio |
+--------------------------------------------+---------------------+
| Class/section status table with teacher, | selected class su |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 2. Teacher Mark Register

```text
+------------------------------------------------------------------+
| Teacher Mark Register                      [Submit Attendance] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Marked; unmarked; absent; late; leave                 |
+------------------------------------------------------------------+
| Filters: Date, assigned class/section; student search          |
+--------------------------------------------+---------------------+
| Roll-ordered roster with admission numbe | student-safe cont |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Row status/note; bulk mark; submission summary                 |
+------------------------------------------------------------------+
```

### 3. Admin Review and Corrections

```text
+------------------------------------------------------------------+
| Admin Review and Corrections               [Approve Correctio] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Pending corrections; overdue registers; approved toda |
+------------------------------------------------------------------+
| Filters: Date range, class, section, requester, status, locked |
+--------------------------------------------+---------------------+
| Queues/tabs for missing, submitted, corr | request reason, b |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Correction decision comment; permitted admin correction form   |
+------------------------------------------------------------------+
```

### 4. Parent / Student Attendance

```text
+------------------------------------------------------------------+
| Parent / Student Attendance                [Change Child] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Present; absent; late; leave; attendance rate from ba |
+------------------------------------------------------------------+
| Filters: Month, academic year, status                          |
+--------------------------------------------+---------------------+
| Monthly calendar plus chronological list | selected day deta |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 5. Monthly Registers and Exports

```text
+------------------------------------------------------------------+
| Monthly Registers and Exports              [Generate Register] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Queued; processing; ready; failed                     |
+------------------------------------------------------------------+
| Filters: Academic year, month/date range, class, section, stat |
+--------------------------------------------+---------------------+
| Report form plus export job table with c | job parameters, s |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Report parameters                                              |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Title, purpose, one primary action, secondary menu | Reuse existing | Keep scope and academic/fiscal context visible. |
| `KpiGrid` / `SummaryStrip` | Backend-owned operational summaries | Reuse existing | Show unavailable state when summary contract is missing. |
| `FilterBar` | Server-side search and filters | Reuse existing | Preserve filters in URL where practical. |
| Paginated data table | Growing operational records | Reuse existing | Column visibility remains permission-safe. |
| Module status badges | Domain lifecycle and risk | Extend shared badges | Text plus semantic color; never color-only. |
| Detail drawer | Selected record, actions, history | Reuse existing | Reauthorize actions on mutation. |
| Validated form sections | Create/edit/review workflows | Reuse primitives | Long forms use sticky action footer. |
| Reason confirmation dialog | High-risk action confirmation | Reuse existing | Reason required when backend policy requires it. |
| `ProtectedFileButton` / upload widget | Authenticated open/download/upload | Reuse existing | File Registry only; safe unavailable state. |
| Timeline / audit panel | Workflow and actor history | Reuse or create shared | Render backend audit facts only. |
| M2 scoped widgets | attendance register, lock, correction, calendar, and monthly export widgets | Create module composition | Reuse base primitives; do not fork the design system. |

---

## 9. Backend and API Alignment

> Capability names below are planning labels, not invented endpoint names. Implement with current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries; paginated lists; scoped detail; backend totals/status. **needs OpenAPI confirmation** unless already present in the current contract.

### Write / Mutation APIs

Create/update commands with validation, permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless already present in the current contract.

### Workflow APIs

Register draft/submit/lock; correction request/review/approve/reject; monthly register generation. **needs OpenAPI confirmation** unless already present in the current contract.

### Validation APIs

Working day, assigned class/section, roster membership, allowed status/reason, lock deadline, duplicate submission. **needs OpenAPI confirmation** unless already present in the current contract.

### Report / Export Jobs

Monthly class/student registers are backend snapshots delivered as protected queued exports. **needs OpenAPI confirmation** unless already present in the current contract.

### File Registry / Protected File APIs

Register exports and optional correction evidence use File Registry. **needs OpenAPI confirmation** unless already present in the current contract.

### Notification Events

Absence/late and correction outcomes emit idempotent events to M12; M2 never calls providers. **needs OpenAPI confirmation** unless already present in the current contract.

### Accounting / Finance Boundaries

No money or accounting ownership. **needs OpenAPI confirmation** unless already present in the current contract.

### Audit Logs

Submission, correction before/after, lock override, export generation, and notification event references. **needs OpenAPI confirmation** unless already present in the current contract.

### Role-Scoped APIs

Teacher assignment, parent linked-child, and student self projections are separate purpose-limited contracts. **needs OpenAPI confirmation** unless already present in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Initial or filtered request | Layout-matching skeleton; preserve header/filter context | Request status |
| Empty | No records exist | Explain why and show one permitted next action | Empty paginated response |
| No search results | Filters match nothing | Preserve filters; clear-filter action | Filtered list metadata |
| Validation error | Input fails rules | Inline field errors and safe summary | Bounded validation envelope |
| Permission denied | Role/scope fails | No forbidden data; safe route state | Backend RBAC |
| Module locked | Entitlement disabled | Locked state; no fake values or writes | Entitlement guard |
| Mutation pending | Command submitted | Disable duplicate submit; show progress | Mutation/job status |
| Success | Mutation confirmed | Success feedback and refetch affected data | Confirmed response |
| Failure | Safe command failure | Parsed school-friendly error and retry | Safe error envelope |
| Partial failure | Batch/job partly succeeds | Itemized success/failure; retry eligible items | Batch result |
| Queued job | Export/generation is asynchronous | Queued/processing/succeeded/failed tracker | Job status API |
| Protected file unavailable | Missing, expired, or unauthorized file | Safe unavailable message; no raw URL/key | File Registry authorization |
| Stale data | Timestamp exceeds policy | Stale badge and refresh; never imply live state | Backend timestamp |
| Attendance locked | Date/window is closed | Disable direct edit and offer permitted correction path | Backend lock policy |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- Every query, job, export, and file is isolated by authenticated `tenantId`; the browser never supplies trusted tenant scope.
- Backend RBAC and module entitlement are authoritative. Hidden controls are only UX; direct calls must fail closed.
- Teacher can access only assigned registers; parent and student views never include peer data.
- Locked attendance cannot be changed by manipulating browser state.
- Notification delivery/body/provider details remain in M12.
- Sensitive fields are omitted or masked by permission; do not place them in table rows, URLs, logs, or analytics.
- Protected files use authenticated File Registry helpers. Never expose raw object keys, provider URLs, permanent public URLs, or storage internals.
- Audit-sensitive actions show backend actor/time/reason/history; the browser does not invent audit facts.
- Parse safe backend error envelopes. Never show raw stack traces, Prisma/provider/storage errors, secrets, or internal payloads.

---

## 12. Nepal-Specific Requirements

- Order registers by local class/section/roll conventions and support school shifts where configured.
- Use the school calendar for holidays, Saturdays, exams, and non-working days.
- Make absence/late SMS expectations visible as M12 status without promising delivery before provider confirmation.
- Monthly registers should fit common school print/export practice and bilingual labels where configured.

---

## 13. Implementation Checklist

```text
[ ] Screen uses the SchoolOS app shell, master web rules, and design system.
[ ] Full feature list is covered by the documented screens.
[ ] Every Section 6 screen has a matching Section 7 wireframe.
[ ] Current routes, OpenAPI, shared contracts, permissions, DTOs, and tests were inspected.
[ ] Real backend APIs and backend-owned totals only; no fake production metrics.
[ ] Growing lists use server-side filtering and pagination.
[ ] Loading, empty, error, permission, locked, mutation, partial, queued, stale, and file states exist.
[ ] Protected files use File Registry-backed helpers.
[ ] Purpose-limited parent/student/teacher/staff/driver scopes are enforced where relevant.
[ ] High-risk actions have confirmation, reason where required, idempotency protection, and audit state.
[ ] Missing contracts are marked needs OpenAPI confirmation or needs backend verification.
[ ] Responsive behavior preserves the primary job on laptop/tablet widths.
```

---

## 14. Done Definition

```text
[ ] All module features are explained.
[ ] Each feature has matching frontend behavior.
[ ] Every expected screen is documented.
[ ] Every expected screen has a simple wireframe.
[ ] Backend/API needs are listed without inventing endpoint names.
[ ] Required states are listed.
[ ] Security and role boundaries are clear.
[ ] Nepal-specific needs are included.
[ ] Design remains simple and implementation-friendly.
[ ] A frontend engineer can implement without searching the master plan for module-specific behavior.
```
