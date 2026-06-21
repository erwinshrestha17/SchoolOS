# M6 Homework and Timetable — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-21
**Module:** M6 Homework and Timetable
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M6 publishes assignment-scoped homework and maintains conflict-aware class, teacher, room, and substitution timetables.

It replaces diary-only homework and spreadsheet timetables with one publishable schedule that parents, students, and teachers can trust.

For Nepal schools, it must support local academic calendars, period/shift patterns, class-section routines, short-notice substitutions, bilingual instructions, and low-bandwidth attachments.

---

## 2. Full Feature List

### Homework dashboard

**Purpose:**
Shows drafts, due work, overdue/archive state, and assignment coverage.

**Users:**
Teachers and admin.

**Frontend behavior:**
Backend summary plus paginated homework list.

**Backend alignment:**
Backend owns counts and scope.

### Create/edit homework

**Purpose:**
Captures subject, class/section, title, instructions, due date, and audience.

**Users:**
Assigned teacher.

**Frontend behavior:**
Sectioned form with assignment context and preview.

**Backend alignment:**
Backend validates assignment, roster audience, dates, status.

### Attachments

**Purpose:**
Adds protected resources without public URLs.

**Users:**
Teacher; allowed viewers.

**Frontend behavior:**
Upload rows with progress, type, size, preview, replace/remove.

**Backend alignment:**
File Registry owns access and processing.

### Publish/archive/lock

**Purpose:**
Controls when assigned users can see or change homework.

**Users:**
Teacher/admin by permission.

**Frontend behavior:**
Explicit lifecycle badges, impact confirmation, and timeline.

**Backend alignment:**
Backend owns transitions and locks.

### Timetable builder

**Purpose:**
Places subjects/teachers/rooms into school periods.

**Users:**
Timetable admin.

**Frontend behavior:**
Week grid with controlled edit drawer, not uncontrolled browser state.

**Backend alignment:**
Backend persists slots and versions.

### Conflict detection

**Purpose:**
Flags teacher, room, class, and policy collisions before save/publish.

**Users:**
Timetable admin.

**Frontend behavior:**
Conflict rail with severity, affected slots, and fix links.

**Backend alignment:**
Backend detection is authoritative.

### Substitution workflow

**Purpose:**
Assigns temporary teacher/room changes with date/reason and communication.

**Users:**
Admin and substitute teacher.

**Frontend behavior:**
Substitution queue/form with original vs replacement and status.

**Backend alignment:**
Backend validates availability/scope and emits events.

### Parent/student views

**Purpose:**
Shows only published assigned homework and applicable timetable.

**Users:**
Parent and student.

**Frontend behavior:**
Today/upcoming list and weekly timetable; linked-child/self scope.

**Backend alignment:**
Purpose-limited projections; no drafts or peers.

---

## 3. Frontend Design Direction Based on Features

Use a assignment and schedule workspace inside the standard SchoolOS app shell. Follow [the master web plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

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
| Admin | Tenant timetable, conflicts, substitutions, homework oversight | Other tenants | Dashboard, builder, substitutions |
| Teacher | Assigned homework and personal timetable | Unassigned classes | Homework, teacher timetable |
| Parent | Linked-child published work/schedule | Drafts and peers | Parent homework/timetable |
| Student | Own assigned published work/schedule | Other students | Student homework/timetable |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes/contracts where present; differences need router/OpenAPI confirmation.

### Admin / Staff Routes

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

### Parent Routes

```text
/parent/children/[studentId]/homework
/parent/children/[studentId]/timetable
```

### Student Routes

```text
/student/homework
/student/timetable
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Homework Dashboard

**Purpose:**
Manage assigned homework workload and publication.

**Main users:**
Teacher, admin.

**Route:**
`/dashboard/homework` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, publish/archive/lock, attachments.

**Layout:**
Module header, filter/context bar, Table with title, class/section, subject, due date, status, attachment count, author, updated, and a right drawer for homework preview, audience, files, status timeline.

**Header actions:**
Create Homework

**Filters:**
Status, class, section, subject, author, due range, search

**KPI cards / summary cards:**
Draft; published; due today; overdue; archived

**Main table / list / grid:**
Table with title, class/section, subject, due date, status, attachment count, author, updated

**Right drawer / detail panel:**
homework preview, audience, files, status timeline

**Forms / modals:**
None

**Confirmations:**
Archive/lock/bulk publish require confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Summary, scoped list/detail, lifecycle eligibility.

**Protected files:**
Attachments protected.

**Audit behavior:**
Create/edit/publish/lock/archive.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 2. Homework Editor

**Purpose:**
Create, edit, preview, and publish homework.

**Main users:**
Assigned teacher, admin.

**Route:**
`/dashboard/homework/[homeworkId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Create/edit, attachments, publish.

**Layout:**
Module header, filter/context bar, Sectioned form and student-view preview, and a right drawer for audience, attachment state, validation, audit.

**Header actions:**
Save Draft; Publish

**Filters:**
Assignment/class/section/subject context

**KPI cards / summary cards:**
None

**Main table / list / grid:**
Sectioned form and student-view preview

**Right drawer / detail panel:**
audience, attachment state, validation, audit

**Forms / modals:**
Title, bilingual instructions, subject, class/section, assigned date, due date, attachments

**Confirmations:**
Publish/lock/archive shows audience/date impact

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Assignments, dates, draft/version, validation, transition.

**Protected files:**
Uploads/open via File Registry.

**Audit behavior:**
Draft versions, files, publish/lock/archive.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 3. Timetable Builder

**Purpose:**
Build and validate one timetable version.

**Main users:**
Timetable admin.

**Route:**
`/dashboard/timetable/builder` (planning route; reuse current route if different).

**Main features shown on this screen:**
Builder and conflict detection.

**Layout:**
Module header, filter/context bar, Week/period grid with selected-slot drawer and conflict rail, and a right drawer for slot subject/teacher/room, collisions, history.

**Header actions:**
Validate Timetable; Publish Version

**Filters:**
Academic year, shift, class/section, teacher, room, version

**KPI cards / summary cards:**
Conflicts; unassigned slots; draft/published version

**Main table / list / grid:**
Week/period grid with selected-slot drawer and conflict rail

**Right drawer / detail panel:**
slot subject/teacher/room, collisions, history

**Forms / modals:**
Slot subject, teacher, room, period; bulk copy only if backend supports

**Confirmations:**
Publish/replace version requires conflict-free confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Periods, subjects, assignments, rooms, slots, version, conflict validation.

**Protected files:**
Protected export if generated.

**Audit behavior:**
Slot changes, validation, publish/version replacement.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 4. Substitution Workflow

**Purpose:**
Handle dated replacements without rewriting base timetable.

**Main users:**
Admin, permitted teacher.

**Route:**
`/dashboard/timetable/substitutions` (planning route; reuse current route if different).

**Main features shown on this screen:**
Substitution and notification.

**Layout:**
Module header, filter/context bar, Queue with date/period, class, original teacher/room, replacement, reason, status, and a right drawer for availability, original slot, affected audience, event status.

**Header actions:**
Create Substitution

**Filters:**
Date, class, teacher, status

**KPI cards / summary cards:**
Today; unfilled; notified; cancelled

**Main table / list / grid:**
Queue with date/period, class, original teacher/room, replacement, reason, status

**Right drawer / detail panel:**
availability, original slot, affected audience, event status

**Forms / modals:**
Date/period, replacement teacher/room, reason

**Confirmations:**
Create/cancel requires impact confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Current slot, availability, substitution mutation/status.

**Protected files:**
None.

**Audit behavior:**
Requester, before/after, reason, cancellation, M12 event.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 5. Parent / Student Homework and Timetable

**Purpose:**
Show assigned published work and applicable schedule only.

**Main users:**
Parent, student.

**Route:**
`/parent/children/[studentId]/homework` (planning route; reuse current route if different).

**Main features shown on this screen:**
Published homework and weekly timetable.

**Layout:**
Module header, filter/context bar, Today/upcoming homework list plus week timetable tabs, and a right drawer for instructions, protected files, teacher/schedule context.

**Header actions:**
Open Homework

**Filters:**
Child for parent, date/week, subject, completion display only if supported

**KPI cards / summary cards:**
Due today; upcoming; overdue from backend

**Main table / list / grid:**
Today/upcoming homework list plus week timetable tabs

**Right drawer / detail panel:**
instructions, protected files, teacher/schedule context

**Forms / modals:**
None unless submission is separately approved

**Confirmations:**
None

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Linked-child/self homework and timetable projections.

**Protected files:**
Homework attachments protected.

**Audit behavior:**
Read/open state only if contract supports it.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

---

## 7. Simple Wireframe Designs

### 1. Homework Dashboard

```text
+------------------------------------------------------------------+
| Homework Dashboard                          [Create Homework] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Draft; published; due today; overdue; archived        |
+------------------------------------------------------------------+
| Filters: Status, class, section, subject, author, due range, s |
+--------------------------------------------+---------------------+
| Table with title, class/section, subject | homework preview, |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 2. Homework Editor

```text
+------------------------------------------------------------------+
| Homework Editor                             [Save Draft] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: None                                                  |
+------------------------------------------------------------------+
| Filters: Assignment/class/section/subject context              |
+--------------------------------------------+---------------------+
| Sectioned form and student-view preview  | audience, attachm |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Title, bilingual instructions, subject, class/section, assigne |
+------------------------------------------------------------------+
```

### 3. Timetable Builder

```text
+------------------------------------------------------------------+
| Timetable Builder                           [Validate Timetab] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Conflicts; unassigned slots; draft/published version  |
+------------------------------------------------------------------+
| Filters: Academic year, shift, class/section, teacher, room, v |
+--------------------------------------------+---------------------+
| Week/period grid with selected-slot draw | slot subject/teac |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Slot subject, teacher, room, period; bulk copy only if backend |
+------------------------------------------------------------------+
```

### 4. Substitution Workflow

```text
+------------------------------------------------------------------+
| Substitution Workflow                       [Create Substitut] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Today; unfilled; notified; cancelled                  |
+------------------------------------------------------------------+
| Filters: Date, class, teacher, status                          |
+--------------------------------------------+---------------------+
| Queue with date/period, class, original  | availability, ori |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Date/period, replacement teacher/room, reason                  |
+------------------------------------------------------------------+
```

### 5. Parent / Student Homework and Timetable

```text
+------------------------------------------------------------------+
| Parent / Student Homework and Timetable     [Open Homework] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Due today; upcoming; overdue from backend             |
+------------------------------------------------------------------+
| Filters: Child for parent, date/week, subject, completion disp |
+--------------------------------------------+---------------------+
| Today/upcoming homework list plus week t | instructions, pro |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| None unless submission is separately approved                  |
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
| M6 widgets | homework, attachment, timetable grid, conflict, and substitution widgets | Create composition | Reuse shared primitives. |

---

## 9. Backend and API Alignment

> These are capability labels, not endpoint names. Use current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summary, paginated list, scoped detail, backend totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated create/update commands with permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Homework draft/publish/lock/archive; timetable validate/version/publish; substitution create/cancel. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Teacher assignment, class/section, due dates, file rules, period/teacher/room conflicts, version/lock. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Timetable/homework exports are backend-generated protected files where supported. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Homework attachments and timetable exports use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Homework publish/reminders and timetable/substitution changes emit M12 events. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

No finance ownership. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Homework lifecycle/files; timetable versions/slots; substitution before/after/reason. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Teacher assignment, parent child-link, and student self APIs are distinct. **needs OpenAPI confirmation** unless verified in the current contract.

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
| Timetable conflict | Backend detects slot collision/policy violation | Highlight affected slots and block publish until resolved | Conflict validation |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates every query, job, export, file, and event; browser input is never trusted tenant scope.
- Backend RBAC and module entitlement are authoritative; hidden controls are UX only.
- Teachers cannot publish to unassigned classes/subjects.
- Parent/student routes show published assigned content only.
- Attachments reauthorize every access.
- Sensitive fields are omitted/masked by permission and never placed in URLs, logs, or analytics.
- Protected files use File Registry helpers; never raw object keys, provider URLs, or storage errors.
- Audit-sensitive actions display backend actor/time/reason/history only.
- Raw backend, provider, Prisma, and storage errors never reach users.

---

## 12. Nepal-Specific Requirements

- Support school shifts, local period lengths, Saturday/holiday calendars, assemblies and breaks.
- Use class/section/subject labels familiar to Nepal schools.
- Allow Nepali/English homework instructions where configured.
- Make substitution notices explicit but do not promise SMS delivery before M12 confirmation.

---

## 12A. Consolidated M6 Reference Notes

The retired M6 reference analysis was merged here so this file remains the single active M6 frontend source of truth.

- Delivery priority is P0 for Homework Dashboard, Homework Composer and Publish, Submission Review, Timetable Overview, Timetable Builder and Conflict Center, Timetable Versions/Publish/Lock, and Substitution Queue/Candidate Selection. Template libraries, reminder history, completion reports, workload views, and persona read projections follow once contracts are confirmed.
- Homework templates can be created, cloned, reused, shared, or archived only through backend-supported template lifecycle. A template used by published homework is archived rather than silently deleted.
- Submission review keeps attempt history. Return for correction requires a teacher comment or reason, preserves prior evidence, and never turns homework scoring into official academic marks without an M4 contract.
- Reminder delivery shows provider mode explicitly: disabled, log/dev, mock, configured, queued, delivered, failed, retried, or partial where supported. Completion comes from assignment/submission data, not delivery status.
- Timetable builder drag/drop is a convenience only. Backend validation owns teacher, room, period, workload, requirement, version, stale/race, and publish eligibility checks.
- Timetable publish, lock, archive, restore, compare, and snapshot actions show affected classes, teachers, rooms, effective date, impacted substitutions, confirmation, audit state, and safe failure handling. Restore never silently overwrites a live timetable.
- Substitute candidate selection is deterministic and explainable: available in the affected period, qualified or assigned for the subject, conflict-free, and within configured workload limits. Leave-linked substitution tasks expose only allowed operational reason categories, not private leave details.

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
