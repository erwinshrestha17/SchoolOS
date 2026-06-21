> Archived 2026-06-21. Unique implementation guidance was merged into `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md`. Retained as historical M6 reference analysis only.

# M6 Homework & Timetable — Web Reference Analysis

**Status:** Supporting M6 design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth. This document records the focused desktop-reference analysis and should be consolidated into that plan during the next master-doc curation pass.

---

## 1. Purpose

M6 is the school academic-operations workspace for assigning, reviewing, and following up homework, while building, validating, publishing, and maintaining class timetables. It must serve teachers' daily work, academic coordinators' school-wide control, and parent/student read visibility without exposing unrelated classes, students, staff, or operational data.

The supplied desktop references establish a task-first operating-desk direction:

- A stable shell: header, purpose line, one primary action, KPI strip, tabs, filters, work area, and optional right rail.
- Dense but readable tables, weekly grids, queues, and review panels.
- Right rails that explain a selected record, conflict, publish state, or substitute task; never a decorative panel.
- Clear status labels and school-friendly messages.
- Deep blue primary actions, restrained secondary actions, calm surfaces, and no fake dashboard values.

Every M6 screen keeps the SchoolOS rule: **one screen = one main job**.

---

## 2. Persona Scope

| Persona | Main M6 job | Required boundary |
|---|---|---|
| Academic coordinator / school admin | Build, validate, publish, lock, compare, archive, restore, and monitor timetables; manage conflicts and substitutions. | Tenant-scoped academic structure, rooms, teacher availability, and permitted workload data only. |
| Class / subject teacher | Create/review assigned homework; view own timetable; complete assigned substitution tasks. | Assigned class, section, subject, homework, and substitution scope only unless explicitly permitted. |
| Principal | Review readiness, risks, workload warnings, substitutions, and timetable status. | Decision summaries; no staff-private detail without permission. |
| Parent / guardian | View assigned published homework and published class timetable for linked children. | Linked child only; no other child, class ranking, or internal queue. |
| Student | View own assigned homework, own submission state, feedback, and published timetable. | Self-only; no other student work, internal operations, or unpublished content. |

---

## 3. Recommended Route Map

```text
/dashboard/homework
/dashboard/homework/new
/dashboard/homework/[homeworkId]
/dashboard/homework/templates
/dashboard/homework/submissions
/dashboard/homework/reminders
/dashboard/homework/reports

/dashboard/timetable
/dashboard/timetable/builder
/dashboard/timetable/conflicts
/dashboard/timetable/versions
/dashboard/timetable/substitutions
/dashboard/timetable/workload
/dashboard/timetable/reports
```

Parent/student and teacher-personal routes must consume purpose-limited APIs; do not reuse admin workspace response shapes.

---

## 4. Workspace Pattern

```text
Header: Homework & Timetable
Purpose: Assign work, monitor completion, and maintain conflict-safe schedules.
Primary action: Contextual — Create Homework, Open Builder, or Assign Substitute.
Secondary actions: More Actions.

KPI strip: Backend-provided summaries only.
Tabs: Homework | Submissions | Templates | Reminders | Timetable | Conflicts | Versions | Substitutions | Workload | Reports
Filters: Class | Section | Subject | Teacher | Date range | Status
Main: One task-first list, composer, weekly grid, review queue, or comparison workspace.
Right rail: Selected record, conflict center, validation/publish readiness, or substitute candidate panel.
```

KPI cards, charts, completion percentages, room utilisation, teacher load, reminder delivery, and conflict counts must use backend summaries or show an honest unavailable state. The browser must not invent operational truth.

---

## 5. Delivery Priority

| Priority | Screens | Outcome |
|---|---|---|
| **P0** | Homework Dashboard; Homework Composer & Publish; Submission Review; Timetable Overview; Timetable Builder & Conflict Center; Timetable Versions/Publish/Lock; Substitution Queue & Candidate Selection | Core teacher/coordinator workflow is safe and real-API backed. |
| **P1** | Homework Template Library; Reminder Delivery & Batch History; Homework Completion Report; Teacher Workload/Availability; Timetable Conflict Report | Reuse, follow-up, and operational tuning. |
| **P2** | Parent Homework Detail; Student Homework Detail; Teacher Personal Timetable; Parent/Student Published Timetable | Purpose-limited persona views and mobile parity direction. |

---

## 6. Homework Workspaces

### 6.1 Homework Dashboard

**Main job:** understand homework activity, items due soon, pending review, and follow-up needs.

```text
Header: Homework Dashboard & Overview
Primary action: Create Homework
Tabs: Overview | Homework | Templates | Submissions | Reminders | Reports
Filters: Class | Section | Subject | Teacher | Date range | Status
Main: Server-paginated recent assignments table
Right rail: Quick actions and upcoming due work
Bottom: Completion, pending review, reminder delivery, and protected attachment summaries where APIs provide them
```

Recommended signals:

- Draft homework.
- Published within the selected period.
- Due today / due soon.
- Awaiting review.
- Overdue or needs follow-up submissions.
- Reminder delivery state only when provider/batch data is available.

Teachers default to their own assignments. Coordinators may widen scope only through backend-authorized filters. Principals should receive decision summaries rather than a complete teacher work queue.

### 6.2 Homework Composer & Publish

**Main job:** create a clear, correctly scoped assignment and publish it safely.

```text
Top context: Class | Section | Subject | Assignment type | Due date/time | Parent notification setting
Main form: Title | Instructions | Learning objective | Tags | Submission / resubmission rules | Audience
Attachments: File Registry-backed resources with uploading, processing, ready, failed, restricted, and removed states
Right rail: Student-facing preview and publish safety checks
Sticky actions: Cancel | Save Draft | Preview | Publish
```

Rules:

- Class, section, subject, and audience must be backend-validated against the teacher's assignment scope.
- Show draft, scheduled publish, recurring homework, and resubmission controls only after OpenAPI/shared-contract confirmation.
- Publish confirmation shows recipient count, due context, attachment readiness, and notification/provider readiness.
- Homework attachments follow `Homework -> FileRegistryService -> StorageService`; never expose object keys, provider URLs, or raw signed URLs.
- Preserve input after recoverable upload, validation, or network failure.
- Published state comes from the backend lifecycle, not client-only state.

### 6.3 Homework Template Library

**Main job:** create, find, reuse, share, clone, or archive safe reusable assignments.

```text
Tabs: All Templates | My Templates | School Shared | Subject | Class | Recurring | Archived
Filters: Grade/class | Subject | Homework type | Submission required | Owner | Status
Main: Template table with title, subject, level, recurrence, last updated, usage, and status
Right rail: Selected template description, objectives, instructions, protected resources, recurrence, and class scope
Primary action: Create Template
Quick actions: Create Homework from Template | Clone | Edit | Archive
```

Templates used by published homework are archived rather than silently deleted. Applying a template still validates current teacher, subject, class, audience, and protected-file access.

### 6.4 Submission Review & Return for Correction

**Main job:** review one assignment's submissions and give actionable feedback.

```text
Assignment summary: class, section, subject, due date, submission window, requirement, status
KPI strip: Submitted | Pending | Late | Marked | Returned for Correction | Average only where permitted
Main: Server-paginated submission list
Right rail: Selected student's protected attachments, marks/grade where supported, rubric, feedback editor, submission history, audit summary
Actions: Mark Complete | Return for Correction | Request Resubmission | View Submission History
```

Rules:

- Teachers review only permitted assignments.
- Return-for-correction requires a teacher comment/reason and preserves attempt history.
- Large bulk download/export must be permission-aware and queue-backed where the backend requires it.
- Homework scoring must not silently become official academic marks without an Academics contract.
- Parent/student views show only own submission state, evidence, and feedback; never other students or internal audit data.

### 6.5 Reminder Delivery & Completion

**Main job:** monitor reminder batches, delivery outcomes, retries, and completion follow-up without misrepresenting provider state.

```text
Tabs: Reminder Queue | Batch History | Completion Reports | Delivery Logs | Templates
Filters: Channel | Status | Class | Section | Date range
Main: Reminder batch table with assignment, audience, channel, recipient count, delivered/failed count, retry count, triggered time, and status
Right rail: Selected batch summary, safe recipient failure diagnostics, replay history, allowed actions
Bottom: Completion by class/section and retry/reporting notes where summary APIs exist
```

Rules:

- Provider state is explicit: `disabled`, `log/dev`, `mock`, or `configured`.
- Disabled and mock modes never appear as real delivery success.
- Retry/replay uses backend idempotency and a reason where required.
- Minimise recipient data; do not expose contact details or message bodies broadly.
- Completion comes from assignment/submission data, not delivery status.

### 6.6 Parent / Student Homework Detail

```text
Child / student context
Assignment title, subject, class/section, teacher, assigned date, due date, remaining time
Instructions and submission requirement
Protected attached resources
Upcoming reminders and notification status
Own submission evidence and status
Own comment thread and teacher feedback
```

Parent access is linked-child only; student access is self-only. These views never show rankings, class averages, internal moderation/audit data, or another student's work. Offline visibility is limited to approved cached reads and previously authorised resources with a clear last-updated/unavailable state.

---

## 7. Timetable Workspaces

### 7.1 Timetable Overview

**Main job:** read the selected published/draft timetable and identify attention items before editing.

```text
Header: Weekly Timetable Workspace Overview
Primary action: Open Builder
Tabs: Overview | Weekly View | Builder | Conflicts | Versions | Substitutions
KPI strip: Published timetables | Draft timetables | Conflict alerts | Available rooms | Teacher load balance | Substitutions this week
Filters: Class | Section | Teacher | Room | Week
Main: Weekly period grid
Right rail: Quick actions and timetable status
Bottom: Room utilisation, teacher availability, upcoming changes, and weekly alerts where summaries exist
```

Role depth varies. Teachers see own published timetable and assigned substitutions; parents/students see published class timetable only; coordinators have permitted controls; principals see safe summaries and alerts.

### 7.2 Timetable Builder & Conflict Center

**Main job:** create or adjust one timetable version while exposing server-validated conflicts and requirements.

```text
Top context: Class | Section | Stream where enabled | Version | Builder mode
Left rail: Unassigned subjects and weekly required-period tracker
Main: Weekly period grid
Right rail: Conflict Center with teacher, room, period, workload, and requirement warnings
Bottom: Teacher availability | Room capacity/suitability | Workload balance | Validation summary
Primary action: Save Draft / Review Conflicts / Validate & Prepare for Publish
Secondary actions: More Actions for preview, compare, and confirmed deterministic helpers
```

Rules:

- Browser drag/drop is not schedule truth; the backend validates teacher, room, period, workload, and version state.
- Warnings identify the affected class/section, period, severity, and safe drill-through action.
- Only draft versions are editable; locked/archived versions are read-only.
- Auto-arrange, AI optimisation, and AI conflict suggestions are outside M6. Any future helper must be deterministic, explainable, and contract-backed.
- Unsaved changes, validation failure, stale/race conflict, permission denial, and module lock need clear in-context states.

### 7.3 Versions, Publish, Lock, Archive & Restore

**Main job:** govern timetable change through comparison and audited lifecycle actions.

```text
KPI strip: Current live version | Draft versions | Archived versions | Pending changes | Locked timetables | Last publish
Tabs: Compare Versions | Publish Queue | Archive | Restore History | Audit
Main: Side-by-side week/day comparison for old/new version
Right rail: Change summary and publish controls
Bottom: Restore history and audit log
Primary action: Publish New Version
Secondary actions: Lock | Archive | Restore | Download Snapshot in More Actions
```

Publishing, locking, archiving, and restoring require backend permission, impact preview, confirmation, pending/success/error state, and audit support. The publish preview should identify affected classes, teachers, rooms, effective date, and any impacted substitution tasks. Restore must follow backend-controlled version behavior; it must never silently overwrite a live timetable.

### 7.4 Teacher Absence & Substitute Selection

**Main job:** cover an affected lesson safely when a teacher is absent or approved leave creates a draft substitution task.

```text
Tabs: Today | Calendar | Availability | Substitute Queue | Alerts
KPI strip: Absent teachers | Open tasks | Assigned substitutions | Availability match rate | Leave-linked requests | Urgent coverage gaps
Main: Time/period task table with class/section, subject, absent teacher, reason category, candidates, and status
Right rail: Selected task, safe absence context, substitute candidates, workload/availability, assignment history
Primary action: Assign Substitute
Secondary actions: Reassign | Mark Covered | Notify Staff | View Leave Details where permitted
```

Candidate selection is deterministic and explainable: available in the affected period, qualified/assigned for the subject, no timetable conflict, and workload within configured limits. The backend re-checks availability at assignment time. Leave-linked tasks must not expose medical or other private leave detail beyond the allowed operational category. Notification respects M10 provider state and recipient scope.

---

## 8. Shared Components & States

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

Every M6 route must handle:

```text
Loading
Empty
Error
Permission denied
Module locked
Validation failure
Queued / processing
Partial failure
Protected file unavailable
Conflict found / no conflict
Draft saved
Publish pending / published
Locked
Archived
```

---

## 9. Security, File & Contract Boundaries

- Backend tenant scope, RBAC, module entitlement, teacher assignment scope, guardian-child linkage, student self-scope, and substitute rules remain authoritative.
- Homework resources, student submissions, timetable exports, comparison snapshots, and substitution reports use File Registry-backed authenticated preview/download helpers.
- Never use raw `window.open`, provider URLs, object keys, or permanent signed URLs for protected files.
- Growing lists use server-side pagination and filtering.
- High-risk actions require confirmation, pending/success/error state, and a reason when policy requires it: timetable publish/lock/archive/restore, assign/reassign substitute, return for correction, and replay reminders.
- Mark unresolved items as `needs OpenAPI confirmation`, `needs backend verification`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
- Do not invent drag/drop, auto-arrange, recurring assignment, scheduled publish, workload scoring, calendar, or replay contracts.

---

## 10. M6 Web Persona Smoke Expectations

```text
Teacher can create, publish, review, and open attachments only for assigned class/section/subject scope.
Parent cannot open another child's homework or submission by direct route.
Student cannot open another student's submission or an unpublished assignment.
Protected homework preview/download fails safely after scope changes.
Timetable builder rejects stale, locked, cross-tenant, teacher-conflict, room-conflict, and permission-denied changes through backend responses.
Publish/lock/archive/restore show confirmation, audit-aware state, and post-mutation refresh.
Substitute assignment re-checks availability and prevents duplicate coverage.
Reminder retry clearly handles configured/disabled/mock provider states and does not duplicate delivery.
Module-locked and suspended-tenant routes fail closed with safe SchoolOS copy.
```
