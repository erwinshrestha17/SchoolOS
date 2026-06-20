# M6 Homework & Timetable — Frontend Implementation Checklist

**Status:** Archived implementation companion for the M6 web reference analysis.
**Updated:** 2026-06-19  
**Master implementation source:** `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` remains the active implementation plan. This checklist translates the M6 reference analysis into an implementation order without claiming that the listed work is complete.

> Archived 2026-06-20. Active M6 web guidance now lives in `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md`; current delivery sequencing lives in `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.

---

## 1. Current Module Position

M6 currently has backend and workflow foundations for homework reminders, reminder batch history/retry routes, homework-specific attachment access helpers, filtered metadata-backed template APIs, timetable conflicts, substitutions, leave-linked draft substitution tasks, slot selection, absence recording, and homework create/publish payload alignment.

This checklist covers the remaining **web workspace completion and verification work**. It does not approve AI functionality, invent missing API contracts, or change the backend/module architecture.

---

## 2. Non-Negotiable Implementation Rules

```text
Real backend APIs only.
No fake production metrics, charts, completion counts, or conflict totals.
Every tenant-owned read/write/export/file action is tenant-scoped.
Backend authorization remains the source of truth.
Teachers remain limited to assigned class/section/subject scope unless explicitly permitted.
Parents remain linked-child only; students remain self-only.
All protected files use File Registry-backed authenticated helpers.
Growing lists use server-side pagination and filtering.
High-risk actions use confirmation, pending/success/error state, and audit reason where required.
No AI, LLM, AI conflict suggestions, or browser-only optimisation logic in M6.
```

Unknown work must be labelled as one of:

```text
needs OpenAPI confirmation
needs backend verification
needs idempotency confirmation
needs offline sync confirmation
```

---

## 3. P0 — Core Daily Workflow

### 3.1 Homework Dashboard

- [ ] Create a real-API homework overview route with role-safe KPI summaries or unavailable states.
- [ ] Add URL-backed, server-side filters: class, section, subject, teacher, date range, status.
- [ ] Add a server-paginated recent assignments table.
- [ ] Add clear status labels: Draft, Published, Due Soon, Overdue, Awaiting Review, Returned for Correction, Resubmitted, Closed.
- [ ] Add loading, empty, error, permission denied, module locked, and partial-failure states.
- [ ] Add one primary action: `Create Homework`.
- [ ] Use a right rail only for quick actions/upcoming due work with actual data.

### 3.2 Homework Composer & Publish

- [ ] Inspect existing backend/OpenAPI/shared contracts for create, update, draft, publish, audience, due date, submission required, and attachments.
- [ ] Limit selectable class/section/subject/audience to backend-authorized teacher scope.
- [ ] Implement title, instructions, learning objective, tags, submission/resubmission, due date/time, and audience fields only where API support exists.
- [ ] Add File Registry-backed attachment upload/list/remove states: uploading, processing, ready, failed, restricted, removed.
- [ ] Use protected file helpers for preview/download; never render raw object keys or permanent signed URLs.
- [ ] Add publish safety panel: recipient count, due context, attachment readiness, provider readiness.
- [ ] Add sticky `Cancel | Save Draft | Preview | Publish` actions, with draft/schedule controls only after contract confirmation.
- [ ] Preserve form state after recoverable request failure.

### 3.3 Submission Review

- [ ] Implement an assignment summary and server-paginated submission table.
- [ ] Add own-scope teacher review checks in the UI while relying on backend enforcement.
- [ ] Render protected student submission attachments using homework-specific authenticated helpers.
- [ ] Implement marks/grade/rubric fields only when confirmed by the homework contract; do not silently map homework marks to M4 official marks.
- [ ] Require feedback/reason when returning work for correction.
- [ ] Show submission history/audit data only when the role is permitted.
- [ ] Add mutation states for mark complete, request resubmission, and return-for-correction.

### 3.4 Timetable Overview

- [ ] Build the selected-week timetable grid from real published/draft version data.
- [ ] Add role-aware context: coordinator/admin full permitted scope; teacher own timetable; parent/student published class view only.
- [ ] Add filters for class, section, teacher, room, and week where backend supports them.
- [ ] Use backend summaries for conflicts, room usage, teacher load, and substitutions; render unavailable states where a summary endpoint is absent.
- [ ] Add one primary action: `Open Builder`.

### 3.5 Timetable Builder & Conflict Center

- [ ] Inspect slot/version/room/teacher validation contracts before creating any drag-and-drop mutation.
- [ ] Build draft-only weekly period grid and clearly show locked/archived read-only state.
- [ ] Add unassigned subject queue and weekly required-period tracker only where backend summary/validation supports them.
- [ ] Show conflict center for teacher, room, period, workload, and requirement warnings returned by backend.
- [ ] Revalidate after slot mutation and render stale/race/conflict responses safely.
- [ ] Add unsaved-change protection.
- [ ] Keep primary action contextual: `Save Draft`, `Review Conflicts`, or `Validate & Prepare for Publish`.
- [ ] Do not implement Auto Arrange or AI suggestions.

### 3.6 Versions & Publish Lifecycle

- [ ] Implement list/select view for draft, published, locked, archived, and previous timetable versions.
- [ ] Implement side-by-side comparison only after diff contract confirmation.
- [ ] Add publish impact preview: affected class/section, teachers, rooms, effective date, substitution impact where available.
- [ ] Require confirmation and reason where policy/API requires it for publish, lock, archive, restore.
- [ ] Use post-mutation refetch/invalidation; do not update lifecycle truth only in browser state.
- [ ] Add protected snapshot/download state where an export artifact exists.

### 3.7 Substitution Queue & Candidate Selection

- [ ] Implement today/calendar/availability/queue/alert views using real substitution task data.
- [ ] Display safe absence context; do not expose medical/private leave detail.
- [ ] Show deterministic candidate reasons only where backend returns or confirms them: available period, subject suitability, no timetable conflict, workload threshold.
- [ ] Re-check availability at assignment submit time through backend mutation response.
- [ ] Add actions with confirmation/audit behaviour: assign, reassign, mark covered, notify staff.
- [ ] Honour M10 provider/quiet-hour state for notification actions.

---

## 4. P1 — Reuse, Follow-up & Reporting

### 4.1 Template Library

- [ ] Use existing filtered template API with class, subject, search, and limit filters.
- [ ] Add My Templates, School Shared, Subject, Class, Recurring, Archived views only when ownership/share metadata is confirmed.
- [ ] Support clone, edit, archive, and create-homework-from-template with current-scope revalidation.
- [ ] Archive rather than silently delete templates already used by published homework.

### 4.2 Reminder Delivery & Batch History

- [ ] Implement batch history, delivery log, completion report, and safe selected-batch detail rail.
- [ ] Show explicit provider mode: disabled, log/dev, mock, configured.
- [ ] Replay/retry only through confirmed idempotent routes, with a reason if the backend requires one.
- [ ] Minimise recipient details and avoid exposing message body content in broad queues.
- [ ] Use assignment/submission data for completion, not notification status.

### 4.3 Reports, Workload & Availability

- [ ] Implement homework completion report only from confirmed backend aggregates.
- [ ] Implement teacher workload and availability views only from safe, permission-filtered data.
- [ ] Add timetable conflict report with severity, affected scope, timestamp, and drill-through.
- [ ] Keep dense reports server-filtered and paginated where applicable.
- [ ] Make long export operations job/status based when backend uses queued exports.

---

## 5. P2 — Persona Read Views

- [ ] Parent homework detail for linked child only.
- [ ] Student homework detail for own record only.
- [ ] Teacher personal published timetable and assigned substitutions only.
- [ ] Parent/student published weekly timetable only.
- [ ] Offline/read-cache behaviour only after safe cache and retention policy confirmation.
- [ ] Every protected attachment uses authenticated preview/download helpers.

---

## 6. Shared UI Building Blocks

```text
HomeworkKpiStrip
HomeworkFilters
HomeworkStatusBadge
HomeworkAttachmentList
ProtectedHomeworkFileButton
HomeworkComposer
HomeworkAudienceSelector
HomeworkPublishSafetyPanel
HomeworkTemplateTable
SubmissionReviewPanel
ReminderBatchTable
ReminderDeliveryStatusBadge

TimetableWeekGrid
TimetablePeriodCell
TimetableConflictPanel
ConflictSeverityBadge
UnassignedSubjectQueue
WeeklyRequirementTracker
TimetableVersionPicker
TimetableCompareView
PublishImpactDialog
TeacherAvailabilityMatrix
SubstitutionTaskPanel
SubstituteCandidateList
WorkloadIndicator
```

Use shared loading, empty, error, permission, module-locked, queued-job, partial-failure, and protected-file-unavailable states rather than module-specific duplicates.

---

## 7. Browser E2E & Smoke Matrix

### Homework

- [ ] Teacher can open only assigned class/section/subject homework.
- [ ] Teacher can create/publish homework through real API lifecycle.
- [ ] Parent cannot open another child's homework or attachment through direct URL.
- [ ] Student cannot open another student's submission or unpublished homework.
- [ ] Protected attachments download/preview through authenticated helpers and fail safely after scope change.
- [ ] Return-for-correction keeps history and requires feedback.
- [ ] Reminder retry handles configured/disabled/mock provider mode without duplicate delivery.

### Timetable

- [ ] Teacher sees own timetable only where role API requires it.
- [ ] Builder rejects locked/archived version edits.
- [ ] Backend conflict response is visible for teacher, room, period, and stale/race conflict cases.
- [ ] Publish/lock/archive/restore require confirmation, permitted role, audit-aware state, and post-mutation refresh.
- [ ] Cross-tenant class/version/slot access is denied.
- [ ] Substitute assignment re-checks availability and blocks duplicate coverage.
- [ ] Module-locked and suspended-tenant routes fail closed with friendly copy.

---

## 8. Verification Commands

Run the relevant checks after implementation. Do not claim that they passed unless actually run.

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

M6-focused browser verification must include dashboard, composer, submissions, timetable builder/lifecycle, substitution, protected attachment, permission-denied, and module-locked paths.

---

## 9. Definition of Done

```text
[ ] Uses real API/database persistence.
[ ] Tenant isolation and backend authorization confirmed.
[ ] Teacher/parent/student scopes fail closed.
[ ] Lists are server-paginated and server-filtered.
[ ] Loading, empty, error, success, permission, module-locked, queued, and partial-failure states exist.
[ ] Protected downloads use shared authenticated helpers.
[ ] High-risk timetable/substitution/reminder actions show confirmation and audit-aware state.
[ ] No fake metrics, browser-only scheduling truth, or AI wording.
[ ] Focused regression or browser E2E coverage updated.
[ ] Relevant verification commands were actually run and recorded.
```
