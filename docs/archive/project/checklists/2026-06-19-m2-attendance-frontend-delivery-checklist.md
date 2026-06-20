# M2 Smart Attendance Frontend Delivery Checklist

**Date:** 2026-06-19  
**Status:** Supplemental delivery checklist for the M2 reference-design decision. It does not replace the consolidated implementation plan, backend source, OpenAPI, or the web design master plan.  
**Companion document:** `docs/archive/design/decisions/2026-06-19-m2-attendance-web-reference.md`

> Archived 2026-06-20. Active M2 implementation guidance now lives in `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md`, `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, and the current next-phase plan.

---

## 1. Delivery Objective

Bring the existing M2 attendance web surfaces to the approved operational design direction without changing backend truth, inventing contracts, or enabling deferred attendance modes.

```text
Target: a teacher, attendance officer, or principal can safely understand attendance status,
mark an assigned daily roster, review protected registers, decide corrections with audit context,
and follow up on policy-backed risks.
```

This is frontend implementation work. It does not authorize QR attendance, biometric attendance, timetable-period attendance, or a new backend data model.

---

## 2. P0 — Daily Operating Workspaces

### 2.1 Overview — `/dashboard/attendance`

- [ ] Keep the current real analytics, anomalies, corrections, and follow-up API sources.
- [ ] Replace visual-only filter controls with confirmed URL-backed, server-side filters.
- [ ] Use a backend-provided canonical attendance rate or a confirmed calculation contract; remove browser-only official-rate calculation.
- [ ] Retain an honest unavailable state when a summary field is not in the API.
- [ ] Show class attendance status, trend, recent activity, anomaly summary, quick actions, and follow-up queue without duplicate data panels.
- [ ] Make KPI click-through preserve applicable filters.
- [ ] Verify direct route permission-denied and module-locked states.

### 2.2 Daily marking — `/dashboard/attendance/mark`

- [ ] Use the existing daily roster API and assigned-class authorization only.
- [ ] Build the context bar: date, academic year, class, section, daily-scope state.
- [ ] Build the KPI strip: total, marked, pending, present, absent, late.
- [ ] Add the roster toolbar: mark all present, selection-safe bulk action, remarks action, search, and status filter.
- [ ] Keep all supported statuses explicit: Present, Absent, Late, Sick Leave, Excused Leave, Unexcused Leave.
- [ ] Do not render a Half Day option unless it is confirmed in the attendance DTO.
- [ ] Show saved locally, syncing, synced, conflict, and failed states from the existing draft/sync behavior.
- [ ] Keep lock-window, submitted, correction-window, override-required, and expired state messaging backend-driven.
- [ ] Require confirmation before a bulk action overwrites a partially marked roster.
- [ ] Add pending/success/error/duplicate-safe submit behavior and preserve entries after recoverable errors.
- [ ] Add accessible labels for every quick-mark action.

### 2.3 Registers — `/dashboard/attendance/register` and `/dashboard/attendance/register/monthly`

- [ ] Keep academic-year, class, section, month/date filters server-backed.
- [ ] Keep class/section selection and export disabled until valid backend selection exists.
- [ ] Use protected authenticated CSV/PDF export helpers.
- [ ] Render daily register list and monthly matrix with real values only.
- [ ] Show lock state as policy-backed data, not a browser guess.
- [ ] Make matrix horizontal scrolling usable on school-office laptops.
- [ ] Use a shared status legend for all backend-supported codes.
- [ ] Confirm Bikram Sambat display and canonical API-date ownership before changing date labels.

### 2.4 Corrections — `/dashboard/attendance/corrections` and `/dashboard/attendance/corrections/[id]`

- [ ] Make Inbox, Reviewed, Escalated, and Audit Log tabs match confirmed status/filter contracts.
- [ ] Add server-side filters and page metadata when the correction endpoint supports them.
- [ ] Keep unavailable states for SLA, due date, escalation, priority, reviewer assignment, and resolution time until backend fields exist.
- [ ] Add before/after comparison, request reason, policy explanation, reviewer reason, and audit timeline.
- [ ] Require a tenant-policy-compliant reason before approval/rejection.
- [ ] Add an approve/reject confirmation step, pending state, success/error messaging, and refetch/invalidation.
- [ ] Replace any evidence placeholder with File Registry-based protected preview/download once the contract is confirmed.

---

## 3. P1 — Decision Support and Configuration

### 3.1 Student attendance profile — `/dashboard/attendance/students/[studentId]`

- [ ] Build student identity, trend, summary, recent attendance history, follow-up, and guardian-communication context only from permission-safe APIs.
- [ ] Keep parent access separate and child-scoped; do not reuse this admin/teacher workspace for parents.
- [ ] Use descriptive policy-backed follow-up/risk language only.
- [ ] Do not add predictive or AI-generated attendance risk labels.

### 3.2 Reports — `/dashboard/attendance/reports`

- [ ] Use current analytics data only for charts and KPIs.
- [ ] Add filters only when confirmed by the report API.
- [ ] Use queued report state and File Registry artifact download for large reports.
- [ ] Keep selected parameters, generated time, generated-by, and report state visible.
- [ ] Use server-side result-table pagination/filtering.

### 3.3 Settings — `/dashboard/settings/attendance`

- [ ] Separate school attendance policy, lock windows, notification policy, safe device status, role-permission summary, and audit history.
- [ ] Require confirmation/reason/audit for policy changes where the backend requires it.
- [ ] Make provider mode explicit: disabled, log/dev, mock, or configured.
- [ ] Do not add device provisioning, QR kiosk, biometric, or raw provider-secret controls without API support.

### 3.4 Auxiliary routes

- [ ] `/dashboard/attendance/offline-drafts`: visible local/server draft distinction and conflict/retry guidance.
- [ ] `/dashboard/attendance/anomalies`: read-only triage until persisted resolution actions exist.
- [ ] `/dashboard/attendance/follow-ups`: preview/dispatch workflow with required operational reason and provider-state clarity.

---

## 4. Deferred Scope Gate

Do not implement any of the following until all listed backend and security gates are approved:

```text
Timetable period/session attendance
QR or biometric attendance authority
Device-source breakdown
Live class check-in feed
Manual overrides for period sessions
Session start/close controls
Session check-in timestamps as official attendance truth
```

Required gates before reconsideration:

- [ ] Tenant-scoped persisted data model.
- [ ] OpenAPI contracts and purpose-limited response DTOs.
- [ ] Teacher/attendance-admin permission matrix.
- [ ] Timetable and calendar-policy integration rules.
- [ ] Audit, correction, lock-window, and offline-conflict rules.
- [ ] Device/file/QR privacy and security review.
- [ ] Browser E2E and staging smoke plan.

---

## 5. Contract and Data Checklist

| Item | Status | Required next step |
|---|---|---|
| Daily roster, submit, draft, sync | Existing frontend/backend flow | Preserve and expose states clearly |
| Register query and CSV/PDF export | Existing flow | Continue protected helper use |
| Correction review and reason | Existing flow | Add design polish and confirmation |
| Follow-up dispatch with reason | Existing flow | Improve preview/feedback design |
| Official attendance-rate field | Needs OpenAPI confirmation | Confirm canonical source/calculation rule |
| Overview/list filters and pagination | Needs OpenAPI confirmation | Confirm query parameters and response metadata |
| Correction evidence file DTO | Needs OpenAPI confirmation | Confirm File Registry file-id flow |
| SLA/escalation/reviewer assignment | Needs backend verification | Keep unavailable until persisted |
| Bikram Sambat display | Needs backend/product confirmation | Define conversion and export ownership |
| Session/QR/biometric attendance | Deferred | Do not implement |

---

## 6. Required States Per Screen

Every applicable M2 screen must implement:

```text
Loading
Empty
Error with retry
Permission denied
Module locked
Lock-window/read-only
Validation error
Draft saved locally
Syncing
Synced
Sync conflict
Sync failed
Mutation pending
Success
Partial failure
Queued export/report
Protected file unavailable
```

State copy must remain school-friendly. Do not show raw status codes, Prisma errors, storage keys, or provider diagnostics.

---

## 7. Browser E2E and Regression Checklist

### P0 browser scenarios

- [ ] Assigned teacher loads an allowed class roster and submits daily attendance.
- [ ] Teacher cannot open or submit an unassigned class/section.
- [ ] Bulk present confirmation prevents accidental overwrite of existing exceptions.
- [ ] Locked/submitted attendance is read-only and routes to correction flow where allowed.
- [ ] Local draft is restored after reload; sync states are visible.
- [ ] Reconnect conflict does not overwrite a newer server submission.
- [ ] Register filters load a tenant-scoped class/section matrix.
- [ ] CSV/PDF export uses authenticated protected helper and handles failure safely.
- [ ] Correction requester sees before/after values; reviewer cannot approve/reject without reason.
- [ ] Correction decision is audited and UI refreshes to the new state.
- [ ] Direct forbidden correction/student route fails safely.
- [ ] Module-locked route shows `ModuleLockedState` and backend rejects the action.

### P1 scenarios

- [ ] Anomaly and follow-up data remains tenant scoped.
- [ ] Dispatch requires an operational reason and respects disabled/mock provider state.
- [ ] Student attendance profile denies an unrelated student.
- [ ] Report export shows queued/ready/failed state where backend uses jobs.
- [ ] Settings mutation requires allowed role and reflects backend validation error safely.

---

## 8. Verification Commands

Documentation-only changes do not require application commands.

For implementation work, run the relevant gates and record real outcomes only:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

M2-focused implementation must additionally include the relevant web/browser smoke coverage and any attendance API E2E affected by the change.

---

## 9. Progress Record

**Current module:** M2 Smart Attendance frontend  
**Completed:** visual-reference analysis, route/scope mapping, P0/P1 checklist, deferred-scope gate, contract-risk inventory  
**Remaining:** API confirmations, real UI implementation, browser E2E, staging smoke, pilot workflow validation  
**Risks:** unsupported session attendance reference; false official totals in browser; unconfirmed SLA/evidence/BS-calendar contracts  
**Verification run:** documentation review and repository workspace inspection  
**Verification result:** documentation-only addition; no runtime verification run  
**Next action:** confirm M2 API contract gaps, then implement the daily-marking P0 workspace using existing shared UI and protected-file helpers.
