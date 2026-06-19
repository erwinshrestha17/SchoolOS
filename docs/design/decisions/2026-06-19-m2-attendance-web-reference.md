# M2 Smart Attendance Web Reference Decisions

**Date:** 2026-06-19  
**Status:** Supplemental design-reference decision record. It supports, but does not replace, `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`, the OpenAPI contract, and backend authorization rules.  
**Scope:** `apps/web` attendance workspaces only. No backend, API, database, mobile, QR, biometric, or timetable-session implementation is approved by this document.

---

## 1. Purpose

This record captures the approved design direction from the ten M2 attendance web references reviewed on 2026-06-19. The references show a complete attendance operating desk: daily marking, registers, corrections, student attendance review, reports, and settings.

The approved direction is:

```text
SchoolOS M2 is an operational attendance workspace, not a decorative dashboard.
```

The design must retain SchoolOS rules:

- Real backend data only.
- `tenantId`, RBAC, module entitlement, assigned-class, and lock-window enforcement remain backend-owned.
- No fake dashboard values, browser-only production state, or client-owned official totals.
- Growing lists use confirmed server-side pagination and filtering.
- Exports and evidence files use authenticated File Registry / protected-file helpers.
- Parent/student/teacher views remain purpose-limited and fail closed.
- Any unknown API shape is marked for backend/OpenAPI verification before UI work.

---

## 2. Reference Screen Inventory and Route Mapping

| Reference screen | Existing or recommended SchoolOS web route | Delivery decision |
|---|---|---|
| Smart Attendance overview | `/dashboard/attendance` | P0 redesign |
| Daily Attendance Marking | `/dashboard/attendance/mark` | P0 redesign |
| Class Session Attendance | `/dashboard/attendance/sessions/[sessionId]` | Deferred; safe unavailable state remains |
| Class Attendance Register | `/dashboard/attendance/register` | P0 redesign |
| Monthly Attendance Register | `/dashboard/attendance/register/monthly` | P0 redesign |
| Attendance Corrections queue | `/dashboard/attendance/corrections` | P0 redesign |
| Correction Review | `/dashboard/attendance/corrections/[id]` | P0 redesign |
| Student Attendance Profile | `/dashboard/attendance/students/[studentId]` | P1 redesign |
| Attendance Reports & Analytics | `/dashboard/attendance/reports` | P1 redesign |
| Attendance Settings | `/dashboard/settings/attendance` | P1 redesign |

Existing attendance routes also include `/dashboard/attendance/offline-drafts`, `/dashboard/attendance/anomalies`, and `/dashboard/attendance/follow-ups`. They should remain part of the M2 workflow even though they were not shown as standalone references.

---

## 3. Shared Desktop Layout Decision

All M2 desktop screens use the standard SchoolOS authenticated shell:

```text
Topbar
Left navigation
Page header: title, one-line purpose, one primary action, More Actions
Context filters
KPI strip when useful
Main work area
Optional right rail for decision support, summary, policy notes, or safe quick actions
```

### Visual direction

- Calm white cards on the standard SchoolOS soft app background.
- Deep blue for primary actions and navigation state.
- Emerald is the M2 module accent, but semantic success/warning/danger colors must keep their global meaning.
- Tables are preferred for roster, register, correction, and report workflows.
- The right rail is a support surface, not a duplicate dashboard.
- For narrower laptop layouts, the right rail must stack below content or open as a drawer; it must not make the roster unusable.
- Real student photos must use approved, privacy-safe image variants and must not use mock people in production states.

### Header rule

Each screen has exactly one main action. Export, print, report, settings, and history actions belong in `More Actions` unless the screen's one main job is export or print.

---

## 4. Screen Decisions

### 4.1 Overview — `/dashboard/attendance`

**Main job:** show what requires action today.

Use a compact KPI strip with backend-provided or backend-derived values only:

```text
Attendance today
Classes pending
Absent students
Late arrivals
Pending corrections
Attendance rate
```

The workspace should include:

- Class attendance status table with class/section, date, counts, submitted state, and a safe route to the relevant daily view.
- Trend and recent activity panels only when the underlying analytics endpoint supports the displayed time period.
- Anomaly and follow-up summary panels with clear links to triage queues.
- Right rail: selected class summary when a class is selected; otherwise quick actions, at-risk/follow-up list, and concise policy information.
- URL-backed filters for date, academic year, class, section, teacher, status, search, page, and page size when confirmed by OpenAPI.

**Do not:** calculate an official attendance percentage in the browser. The API must supply a canonical attendance rate or a contract-approved numerator/denominator plus calculation rule. This is a required backend/OpenAPI confirmation before visual parity work.

### 4.2 Daily Attendance Marking — `/dashboard/attendance/mark`

**Main job:** mark one assigned class/section safely and submit it once.

The approved layout is:

```text
Header: Daily Attendance Marking
Context bar: Date | Class | Section | daily attendance scope
KPI strip: Total students | Marked | Pending | Present | Absent | Late
Roster controls: Mark all present | Mark selected | Apply remark | Search | Filter
Roster table: student identity | roll number | house if available | status | remarks | quick mark
Right rail: session/class summary | completion checklist | students requiring follow-up
Sticky footer or header actions: Save Draft | Submit Attendance | More Actions
```

Required interaction rules:

- Load only the roster permitted for the authenticated teacher/staff actor.
- Keep supported M2 statuses visible: Present, Absent, Late, Sick Leave, Excused Leave, and Unexcused Leave. Do not show Half Day unless the confirmed API supports it.
- Bulk present must warn when a partially marked roster would be overwritten.
- Lock-state, submitted-state, correction-window, override-required, and expired state messages must come from backend responses.
- Make saved-local, syncing, synced, conflict, and failed draft states visible in plain school language.
- Preserve unsent work after recoverable errors; never overwrite a newer submitted server session silently.
- The submit action needs pending, success, duplicate-safe, validation-error, conflict, and permission-denied states.
- Quick-mark controls must have accessible labels and must not rely on color alone.

**No period selection:** daily attendance is the current product contract. A timetable period control must not be displayed unless a confirmed period-attendance contract exists.

### 4.3 Class Register — `/dashboard/attendance/register`

**Main job:** review class/section attendance records over a selected date range or month.

Use:

- Academic year, class, section, month/date-range filters.
- Summary cards for completed registers, pending registers, locked dates, and average attendance.
- Server-backed register table with visible submission status, date, class/section, teacher where supplied, totals, and safe detail navigation.
- Right rail register snapshot with status mix and audit/quick actions when available.
- Protected CSV/PDF export actions through shared authenticated helpers.

The design may present a daily register list and a monthly register entry point, but it must not imply edit access for locked dates.

### 4.4 Monthly Register — `/dashboard/attendance/register/monthly`

**Main job:** inspect an attendance matrix for one class/section and month.

Use the reference's matrix approach with these constraints:

- Student rows and day columns remain server-provided and scope-limited.
- Include a compact legend for all supported attendance status codes.
- Show weekend, holiday, and non-working-day indicators only from the working-day/calendar policy.
- Show daily totals and attendance rate only if the backend data model provides them.
- Keep horizontal scroll usable on common school-office laptop sizes.
- PDF and CSV exports remain protected backend exports.

**Nepal calendar requirement:** display may use Bikram Sambat month labels where enabled, but the canonical storage/API date contract must be confirmed. Until then, do not invent BS-to-AD conversion in the browser.

### 4.5 Corrections Queue — `/dashboard/attendance/corrections`

**Main job:** triage correction requests without losing audit context.

Use:

```text
KPI strip: Pending requests | Reviewed today | Escalated | Due soon | Average resolution time
Tabs: Inbox | Reviewed | Escalated | Audit Log
Filters: Request type | Priority | Class/Section | Requester role | Date range | Search
Table: request ID | student | class/section | request type | original state | requested state | requester | date | priority | due date | status
Right rail: queue summary | recent reviewer activity | quick actions | policy notes
```

Only show `Escalated`, `Due soon`, reviewer assignment, SLA, priority, or resolution-time values when a persisted backend contract provides them. Otherwise render an honest unavailable state; never synthesize queue metrics in the browser.

### 4.6 Correction Review — `/dashboard/attendance/corrections/[id]`

**Main job:** make an auditable approval or rejection decision.

Required sections:

- Request identity, student, class/section, date, requested-by, submission time, and backend-provided lock state.
- Side-by-side before/after attendance record comparison.
- Request explanation and reviewer notes.
- Protected evidence panel using File Registry helpers only.
- Policy checklist and lock-window explanation from backend-safe data.
- Decision reason field; approve/reject stays disabled until the tenant policy's minimum reason rule is satisfied.
- Impact summary showing only backend-confirmed before/after data.
- Approval history/audit timeline.

Approve/reject is high risk: require a confirmation step, pending state, success/error message, and query invalidation/refetch. No approval should be silent.

### 4.7 Offline Drafts, Anomalies, and Follow-ups

These routes remain first-class M2 operations:

| Route | Main job | Required treatment |
|---|---|---|
| `/dashboard/attendance/offline-drafts` | inspect draft sync and conflict state | show local/server distinction, queued/synced/failed/conflict states, and safe retry guidance |
| `/dashboard/attendance/anomalies` | triage backend-detected anomalies | read-only until a persisted triage-resolution workflow exists |
| `/dashboard/attendance/follow-ups` | prepare or dispatch repeated absence/late follow-ups | require operational reason where backend requires it; provider state stays explicit |

### 4.8 Student Attendance Profile — `/dashboard/attendance/students/[studentId]`

**Main job:** understand one student's attendance pattern and follow-up context.

The reference's profile concept is approved for P1 with these boundaries:

- Teacher/admin visibility must stay scoped to allowed students.
- Parent access uses the separate purpose-limited parent surface; the admin profile must not be reused.
- Include overall attendance, present/absent/late totals, recent calendar/history, guardian communication history where permission allows, and intervention/follow-up notes only when such records are backend-supported.
- Any attendance risk label must be descriptive and policy-backed. Do not add unreviewed automated risk scoring.

### 4.9 Reports — `/dashboard/attendance/reports`

**Main job:** review school/class attendance trends and request auditable exports.

Use the reference's analytics layout only for data that exists in the analytics contract:

- school attendance trend;
- class/grade breakdown;
- status mix;
- weekly pattern;
- top/bottom classes where roles and data exist;
- report result table with server-side filters and pagination;
- report summary side panel with selected parameters, generated-by, refresh time, export formats, insights, and safe quick actions.

Large reports must use the established queued-report lifecycle and File Registry artifacts. Never generate heavy reports synchronously in the browser.

### 4.10 Attendance Settings — `/dashboard/settings/attendance`

**Main job:** configure one school's attendance policy, not platform operations.

The reference supports these settings sections when backend contracts exist:

```text
Policies
Lock Windows
Devices
Notifications
Roles & Permissions
Audit Log
```

Rules:

- All settings writes require permission, pending/success/error state, and audit support.
- Device rows must show safe device metadata only; never expose provider credentials or raw device secrets.
- Notification toggles must surface disabled/log/dev/mock/configured provider mode clearly.
- Role permissions are backend truth; the UI is a read/edit surface only for authorized admins.
- Do not create biometric, QR kiosk, device ingestion, or period-session features from this reference without confirmed backend contracts.

---

## 5. Explicitly Deferred Design

The class-session reference is visually useful but is not approved for implementation yet.

The current product contract is daily attendance. The following remain deferred until a tenant-safe, timetable-linked backend contract, OpenAPI, permission model, audit rules, and browser E2E exist:

```text
Period/session attendance
QR scan attendance
Biometric attendance
Device-source breakdown
Manual override analytics for period sessions
Live check-in feed
Session start/close controls
Check-in timestamps as attendance authority
```

The existing session route should remain an honest unavailable state rather than rendering a simulated live-session experience.

---

## 6. Reusable Component Inventory

Reuse existing shared primitives wherever possible:

```text
DashboardPageShell
ModuleHeader
ModuleTabs
FilterBar
KpiGrid / KpiCard
SectionCard
Table
Badge / StatusBadge
LoadingState
EmptyState
ErrorState
LockedRecordBanner
ConfirmDialog
ProtectedFileButton / ProtectedFileLink
```

Add shared M2-specific composition components only where they represent repeated real workflows:

```text
AttendanceContextBar
AttendanceDraftSyncBanner
AttendanceKpiStrip
AttendanceRosterToolbar
AttendanceQuickMarkControl
AttendanceRegisterSummaryPanel
AttendanceCorrectionComparison
AttendancePolicyPanel
AttendanceFollowUpPanel
```

Do not create duplicated one-off loading, error, locked, or file-download implementations.

---

## 7. API and Contract Decisions

### Confirmed design assumptions

- Daily roster and attendance submission remain the primary teacher workflow.
- Local/server draft, sync, and conflict states are visible UI concerns.
- Corrections are audited and include before/after comparison and a reviewer reason.
- Register exports are backend-generated and protected.
- Anomaly and follow-up workflows depend on backend policy/query results.

### Needs backend/OpenAPI confirmation

| Topic | Required decision before UI implementation |
|---|---|
| Official attendance rate | canonical API field or documented numerator/denominator rule |
| Overview filters | supported parameters and server-side pagination metadata |
| Class/session attendance | whether a future persisted timetable-period contract exists |
| Corrections SLA/escalation/reviewer assignment | persisted models, permissions, timestamps, and filter contracts |
| Correction evidence | file ID response shape and File Registry preview/download permission path |
| Bikram Sambat display | canonical date storage, conversion ownership, and report/export format |
| Attendance settings devices | device listing and safe status DTO; no inferred biometric/QR contract |
| Student risk/follow-up profile | supported policy labels and intervention records; no speculative AI scoring |

---

## 8. Acceptance Expectations

A finished M2 web redesign must prove:

```text
[ ] Real API data only; no reference mock data survives.
[ ] Teacher can only mark assigned class/section scope.
[ ] Locked or already-submitted attendance cannot be edited silently.
[ ] Save/local draft/sync/conflict/failed states are visible.
[ ] Bulk actions cannot silently overwrite meaningful existing attendance.
[ ] Corrections require an auditable reason and show before/after context.
[ ] Protected exports and evidence use authenticated helpers.
[ ] Lists/filtering/pagination are server-backed where the dataset grows.
[ ] Permission denied, module locked, loading, empty, error, success, queued, and partial-failure states exist where relevant.
[ ] Unsupported class-session, QR, biometric, and device workflows remain explicitly unavailable.
[ ] Browser E2E covers the P0 daily marking, register, correction, and forbidden-scope flows before readiness claims change.
```

---

## 9. Implementation Status

**Current module:** M2 Smart Attendance frontend design direction  
**Completed:** reference analysis, route mapping, P0/P1 screen decisions, deferred scope definition, contract-risk inventory  
**Remaining:** real API-backed workspace redesign, OpenAPI confirmations, browser E2E, staging/pilot smoke  
**Risks:** unsupported period-session reference, browser-calculated official totals, unconfirmed correction SLA/assignment fields, BS calendar conversion ownership  
**Verification run:** repository workspace and route review; no code changed by this decision record  
**Verification result:** documentation-only addition; no application checks run  
**Next action:** implement P0 daily marking and overview improvements only after confirming the required API fields and query contracts.
