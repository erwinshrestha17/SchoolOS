# M4 Academics, Exams, CAS, Report Cards — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-21
**Module:** M4 Academics, Exams, CAS, Report Cards
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M4 configures subjects and assessment structures, captures marks and CAS evidence, produces grade sheets/report cards, publishes results, and supports promotion.

It turns spreadsheet-heavy exam work into assignment-scoped, lock-aware workflows with reviewable publication and immutable result artifacts.

For Nepal schools, it must handle local terms/exams, theory/practical and CAS patterns, grade/class/section conventions, bilingual report cards, and school-approved grading policies.

---

## 2. Full Feature List

### Subject setup

**Purpose:**
Defines subjects, class/section offerings, codes, credit/full/pass marks, and teacher assignments.

**Users:**
Academic admin.

**Frontend behavior:**
Subject table/forms with academic-year context and assignment coverage.

**Backend alignment:**
Backend validates uniqueness, curriculum links, and assignments.

### Assessment components

**Purpose:**
Defines exams, terms, components, weights, theory/practical/CAS rules, and locks.

**Users:**
Academic admin and exam officer.

**Frontend behavior:**
Assessment builder with totals/weight validation and lifecycle badges.

**Backend alignment:**
Backend owns calculation policy and permissible transitions.

### Marks entry

**Purpose:**
Lets assigned teachers enter marks for only authorized students/subjects/components.

**Users:**
Assigned subject teacher.

**Frontend behavior:**
Spreadsheet-like but accessible grid with autosave only if supported, row validation, missing/absent states, and submit.

**Backend alignment:**
Roster, assignment, max marks, lock, version, and calculations are backend-owned.

### CAS

**Purpose:**
Records continuous assessment components and evidence under school policy.

**Users:**
Teacher and academic admin.

**Frontend behavior:**
Component tabs, student rows, score/evidence entry, completion status.

**Backend alignment:**
Backend owns component definitions, score bounds, and aggregation.

### Grade sheets

**Purpose:**
Reviews backend-calculated marks, grades, GPA/remarks, missing data, and moderation status.

**Users:**
Exam officer, principal, teacher by scope.

**Frontend behavior:**
Filterable sheet with exception highlighting and drill-down.

**Backend alignment:**
Backend calculates all official grades/totals.

### Report-card generation

**Purpose:**
Creates versioned report-card artifacts from validated result snapshots.

**Users:**
Exam officer/admin.

**Frontend behavior:**
Eligibility summary, generation job, version history, and protected preview/download.

**Backend alignment:**
Backend snapshots and generates files.

### Publish workflow

**Purpose:**
Moves validated results through review/approval/published/unpublished correction policy.

**Users:**
Exam officer and principal approver.

**Frontend behavior:**
Publication checklist, audience impact, confirmation, timeline.

**Backend alignment:**
Backend owns approval, locks, and visibility.

### Promotion workflow

**Purpose:**
Reviews student promotion/retention/graduation decisions using published academic state and policy.

**Users:**
Admin/principal.

**Frontend behavior:**
Cohort decision table, exceptions, reasoned confirmation, result summary.

**Backend alignment:**
Backend owns eligibility and lifecycle handoff.

### Parent/student published results

**Purpose:**
Shows only published child/self results and permitted comments.

**Users:**
Parent and student.

**Frontend behavior:**
Term cards, subject result table, teacher remarks, protected report-card button.

**Backend alignment:**
Purpose-limited API excludes draft/unpublished peers.

### Protected report-card PDFs

**Purpose:**
Provides authenticated versioned PDF access without raw storage URLs.

**Users:**
Authorized users.

**Frontend behavior:**
Protected open/download, unavailable/version state, generated timestamp.

**Backend alignment:**
File Registry authorizes current user and record scope.

---

## 3. Frontend Design Direction Based on Features

Use a assessment and publication workspace under the global SchoolOS app shell. Keep one primary job per route, calm white surfaces, the module accent only for location, and semantic colors for status.

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
| Admin / exam officer | Academic setup, review, generation, publication, promotion | Other tenants and unauthorized payroll/finance | All M4 staff screens |
| Principal | Approval, publication and promotion decisions | Unapproved detail outside permission | Grade sheets, publish, promotion |
| Teacher | Assigned subject/class marks and CAS | Unassigned marks and publish controls | Marks entry, CAS |
| Parent | Linked-child published results | Draft/unpublished or other students | Parent results |
| Student | Own published results | Peers and draft results | Student results |

---

## 5. Recommended Route Map

> These are design-planning routes. Reuse current routes and names where they exist; additions or differences need OpenAPI/router confirmation.

### Admin / Staff Routes

```text
/dashboard/academics
/dashboard/academics/subjects
/dashboard/academics/assessments
/dashboard/academics/marks
/dashboard/academics/cas
/dashboard/academics/grade-sheets
/dashboard/academics/report-cards
/dashboard/academics/promotion
```

### Parent Routes

```text
/parent/children/[studentId]/results
```

### Student Routes

```text
/student/results
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Academic Setup

**Purpose:**
Configure subjects, assignments, exams, and components before marks entry.

**Main users:**
Academic admin, exam officer.

**Route:**
`/dashboard/academics/subjects` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Subject setup; assessment components.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Tabs for subjects, teacher assignments, terms/exams, components, grading policy with paginated tables/forms, and a right detail drawer for selected definition, dependencies, validation, change history.

**Header actions:**
Add Subject / Assessment; More: Import, copy year

**Filters:**
Academic year, class, section, subject, assignment status

**KPI cards / summary cards:**
Subjects; unassigned offerings; invalid weight sets; locked assessments

**Main table / list / grid:**
Tabs for subjects, teacher assignments, terms/exams, components, grading policy with paginated tables/forms

**Right drawer / detail panel:**
selected definition, dependencies, validation, change history

**Forms / modals:**
Subject/assessment/component fields, weight/full/pass marks, theory/practical/CAS flags

**Confirmations:**
Delete/lock/copy requires dependency review and confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Setup lists/details, assignment, validation, lock and mutation contracts.

**Protected files:**
Policy/reference file only if supported through File Registry.

**Audit behavior:**
Configuration changes, locks, assignments, imports.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 2. Marks Entry and CAS

**Purpose:**
Enter and submit assigned marks with clear validation and lock state.

**Main users:**
Assigned teachers, exam officer.

**Route:**
`/dashboard/academics/marks` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Marks entry; CAS; assignment scope.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Context selector then roll-ordered grid with component columns, absent/missing markers, status, totals preview from backend, and a right detail drawer for selected student component history, evidence, moderation notes.

**Header actions:**
Save / Submit Marks

**Filters:**
Academic year, term/exam, class, section, assigned subject/component

**KPI cards / summary cards:**
Entered; missing; absent; validation errors; submitted

**Main table / list / grid:**
Context selector then roll-ordered grid with component columns, absent/missing markers, status, totals preview from backend

**Right drawer / detail panel:**
selected student component history, evidence, moderation notes

**Forms / modals:**
Grid cells, status/reason, CAS evidence upload where allowed

**Confirmations:**
Submit/recall/override requires confirmation and permission

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Assigned roster/components, bounds, draft/version, calculation preview, submit/lock.

**Protected files:**
CAS evidence protected if present.

**Audit behavior:**
Save/submit/recall, before/after, override reason, actor.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 3. Grade Sheets and Review

**Purpose:**
Review backend-calculated cohort results and resolve exceptions.

**Main users:**
Exam officer, principal, scoped teachers.

**Route:**
`/dashboard/academics/grade-sheets` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Grade sheets; calculation exceptions; moderation.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Wide priority-column table with student, subjects summary, total/grade/GPA/remarks, missing and moderation state, and a right detail drawer for subject breakdown, calculation inputs/outputs, moderation and audit.

**Header actions:**
Open Publish Checklist; Export

**Filters:**
Year, term/exam, class, section, subject, exception, status

**KPI cards / summary cards:**
Complete; missing; failed validation; awaiting moderation

**Main table / list / grid:**
Wide priority-column table with student, subjects summary, total/grade/GPA/remarks, missing and moderation state

**Right drawer / detail panel:**
subject breakdown, calculation inputs/outputs, moderation and audit

**Forms / modals:**
Moderation/comment form where policy permits

**Confirmations:**
Override/moderation requires reason; no client recalculation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Calculated result sheet, exception, moderation, lock and snapshot metadata.

**Protected files:**
Protected grade-sheet export.

**Audit behavior:**
Calculation version, moderation, approvals, exports.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 4. Report Cards and Publish

**Purpose:**
Generate versioned report cards and publish validated results safely.

**Main users:**
Exam officer, principal approver.

**Route:**
`/dashboard/academics/report-cards` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Generation; publish workflow; protected PDFs.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Cohort eligibility checklist, generation job table, version list, publish impact summary, and a right detail drawer for student eligibility, blockers, versions, approval/audit timeline.

**Header actions:**
Generate Report Cards; Publish when eligible

**Filters:**
Year, term/exam, class, section, generation/publish state

**KPI cards / summary cards:**
Eligible; blocked; generated; published; file failures

**Main table / list / grid:**
Cohort eligibility checklist, generation job table, version list, publish impact summary

**Right drawer / detail panel:**
student eligibility, blockers, versions, approval/audit timeline

**Forms / modals:**
Generation parameters; publish note/effective time

**Confirmations:**
Generation/publish/unpublish correction path requires exact cohort confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Eligibility, snapshot, generation job, versions, approval, publish visibility.

**Protected files:**
Report-card PDFs through File Registry.

**Audit behavior:**
Snapshot/version, generation, approval, publish/unpublish correction.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 5. Promotion Workflow

**Purpose:**
Decide next-grade placement from approved academic results and policy.

**Main users:**
Admin, principal.

**Route:**
`/dashboard/academics/promotion` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Promotion, retention, graduation and exceptions.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Cohort table with current class, result status, backend recommendation if policy supports it, decision, target class, and a right detail drawer for student result summary, policy evidence, prior lifecycle, decision audit.

**Header actions:**
Review and Confirm Decisions

**Filters:**
Academic year, class, section, decision, exception

**KPI cards / summary cards:**
Eligible; promoted; retained; pending; blocked

**Main table / list / grid:**
Cohort table with current class, result status, backend recommendation if policy supports it, decision, target class

**Right drawer / detail panel:**
student result summary, policy evidence, prior lifecycle, decision audit

**Forms / modals:**
Per-student exception reason and target placement

**Confirmations:**
Bulk confirmation shows counts and exceptions; no automatic irreversible promotion

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Eligibility, proposed placements, validation, commit job, per-row results.

**Protected files:**
Decision export protected if generated.

**Audit behavior:**
Every decision, exception reason, actor, before/after placement.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 6. Parent / Student Published Results

**Purpose:**
Present only published results in a clear non-comparative view.

**Main users:**
Parent, student.

**Route:**
`/parent/children/[studentId]/results` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Published term results; protected report card.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Term selector, result summary, subject rows, attendance/comment sections if contract permits, and a right detail drawer for selected subject/component breakdown and teacher remark.

**Header actions:**
Open Report Card

**Filters:**
Child for parent, academic year, term

**KPI cards / summary cards:**
Overall result/grade from backend; publication date

**Main table / list / grid:**
Term selector, result summary, subject rows, attendance/comment sections if contract permits

**Right drawer / detail panel:**
selected subject/component breakdown and teacher remark

**Forms / modals:**
None

**Confirmations:**
None

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Linked-child/self published result and allowed detail contracts.

**Protected files:**
Versioned published report-card PDF protected.

**Audit behavior:**
No draft/moderation/internal audit exposure.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

---

## 7. Simple Wireframe Designs

### 1. Academic Setup

```text
+------------------------------------------------------------------+
| Academic Setup                             [Add Subject / Ass] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Subjects; unassigned offerings; invalid weight sets;  |
+------------------------------------------------------------------+
| Filters: Academic year, class, section, subject, assignment st |
+--------------------------------------------+---------------------+
| Tabs for subjects, teacher assignments,  | selected definiti |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Subject/assessment/component fields, weight/full/pass marks, t |
+------------------------------------------------------------------+
```

### 2. Marks Entry and CAS

```text
+------------------------------------------------------------------+
| Marks Entry and CAS                        [Save / Submit Mar] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Entered; missing; absent; validation errors; submitte |
+------------------------------------------------------------------+
| Filters: Academic year, term/exam, class, section, assigned su |
+--------------------------------------------+---------------------+
| Context selector then roll-ordered grid  | selected student  |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Grid cells, status/reason, CAS evidence upload where allowed   |
+------------------------------------------------------------------+
```

### 3. Grade Sheets and Review

```text
+------------------------------------------------------------------+
| Grade Sheets and Review                    [Open Publish Chec] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Complete; missing; failed validation; awaiting modera |
+------------------------------------------------------------------+
| Filters: Year, term/exam, class, section, subject, exception,  |
+--------------------------------------------+---------------------+
| Wide priority-column table with student, | subject breakdown |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Moderation/comment form where policy permits                   |
+------------------------------------------------------------------+
```

### 4. Report Cards and Publish

```text
+------------------------------------------------------------------+
| Report Cards and Publish                   [Generate Report C] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Eligible; blocked; generated; published; file failure |
+------------------------------------------------------------------+
| Filters: Year, term/exam, class, section, generation/publish s |
+--------------------------------------------+---------------------+
| Cohort eligibility checklist, generation | student eligibili |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Generation parameters; publish note/effective time             |
+------------------------------------------------------------------+
```

### 5. Promotion Workflow

```text
+------------------------------------------------------------------+
| Promotion Workflow                         [Review and Confir] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Eligible; promoted; retained; pending; blocked        |
+------------------------------------------------------------------+
| Filters: Academic year, class, section, decision, exception    |
+--------------------------------------------+---------------------+
| Cohort table with current class, result  | student result su |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Per-student exception reason and target placement              |
+------------------------------------------------------------------+
```

### 6. Parent / Student Published Results

```text
+------------------------------------------------------------------+
| Parent / Student Published Results         [Open Report Card] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Overall result/grade from backend; publication date   |
+------------------------------------------------------------------+
| Filters: Child for parent, academic year, term                 |
+--------------------------------------------+---------------------+
| Term selector, result summary, subject r | selected subject/ |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
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
| M4 scoped widgets | subject, assessment, marks grid, grade sheet, publication, and promotion widgets | Create module composition | Reuse base primitives; do not fork the design system. |

---

## 9. Backend and API Alignment

> Capability names below are planning labels, not invented endpoint names. Implement with current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries; paginated lists; scoped detail; backend totals/status. **needs OpenAPI confirmation** unless already present in the current contract.

### Write / Mutation APIs

Create/update commands with validation, permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless already present in the current contract.

### Workflow APIs

Assessment lock; marks save/submit/recall; moderation; report snapshot/generation; approval/publish; promotion commit. **needs OpenAPI confirmation** unless already present in the current contract.

### Validation APIs

Teacher assignment, roster, component/max/pass rules, weights, missing/absent semantics, locks, calculation version. **needs OpenAPI confirmation** unless already present in the current contract.

### Report / Export Jobs

Grade sheets, report cards, promotion results and exports use backend snapshots/jobs. **needs OpenAPI confirmation** unless already present in the current contract.

### File Registry / Protected File APIs

CAS evidence, report cards, grade-sheet exports, and generated reports use File Registry. **needs OpenAPI confirmation** unless already present in the current contract.

### Notification Events

Exam schedule, marks completion, result publication, and report-card availability emit M12 events. **needs OpenAPI confirmation** unless already present in the current contract.

### Accounting / Finance Boundaries

No fee/accounting truth; financial clearance if used must come from authorized M3/M11 policy API. **needs OpenAPI confirmation** unless already present in the current contract.

### Audit Logs

Setup, assignments, marks before/after, overrides, calculation version, generation, publication, promotion. **needs OpenAPI confirmation** unless already present in the current contract.

### Role-Scoped APIs

Teacher assigned subject/class; parent linked-child; student self; published-only projections. **needs OpenAPI confirmation** unless already present in the current contract.

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
| Results not publishable | Backend eligibility has blockers | List exact blockers and disable publish without fabricating completion | Eligibility/publish contract |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- Every query, job, export, and file is isolated by authenticated `tenantId`; the browser never supplies trusted tenant scope.
- Backend RBAC and module entitlement are authoritative. Hidden controls are only UX; direct calls must fail closed.
- Teachers cannot view/edit unassigned subject marks; parent/student never receive drafts or peer results.
- Official totals/grades are backend calculations, never browser formulas.
- Published artifacts are immutable/versioned; corrections follow backend workflow.
- Sensitive fields are omitted or masked by permission; do not place them in table rows, URLs, logs, or analytics.
- Protected files use authenticated File Registry helpers. Never expose raw object keys, provider URLs, permanent public URLs, or storage internals.
- Audit-sensitive actions show backend actor/time/reason/history; the browser does not invent audit facts.
- Parse safe backend error envelopes. Never show raw stack traces, Prisma/provider/storage errors, secrets, or internal payloads.

---

## 12. Nepal-Specific Requirements

- Support local class/section, subject, term/exam, theory/practical, CAS, full/pass-mark and grading conventions as configured.
- Allow bilingual subject names, remarks, and report-card labels where school templates provide them.
- Report cards must carry school-approved academic-year, attendance/comment, grading-policy and authorized-signature context from backend/template.
- Promotion must fit Nepal academic-year transitions and school policy; never infer policy in UI.

---

## 12A. Consolidated M4 Reference Notes

The retired M4 web reference specification was merged here so `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md` remains the only active M4 frontend source of truth.

- Every M4 workspace carries a backend-backed academic context bar: academic year, term, class, section, subject, stream/program where enabled, and workflow status. A selector never grants permission by itself; context changes refetch dependent data.
- Teacher marks and CAS screens show the effective backend-confirmed assignment scope. Use a teacher-scope banner where a teacher can edit only a subset of class, section, subject, component, or academic-year data.
- Academic setup separates years/classes/sections, subjects, teacher assignments, exam terms, components, templates, presets, rubrics, grading policy, and stage-aware streams/programs. Do not combine all master data, marks, and reports into one mega-screen.
- Marks entry may use a spreadsheet-style grid only when keyboard, paste, cell validation, row validation, lock state, autosave, and stale/race conflict behavior are contract-confirmed.
- States such as absent, withheld, retest/make-up, practical pending, and project pending appear only when the backend exposes them. A blank mark must not silently become a lifecycle state.
- Locked sheets are read-only. Corrections, result withholding, publication changes, report-card regeneration, and promotion decisions use reasoned, audited workflows and never silently mutate a published snapshot.
- Report-card generation, exports, and regeneration are backend jobs with queued, processing, completed, failed, partial-failure, unavailable, version, and protected-file states.

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
