# M4 Academics Web Reference Specification

**Status:** Active design and implementation-reference document  
**Updated:** 2026-06-19  
**Scope:** M4 Academics, Exams, CAS, Results, Report Cards, and Promotion in `apps/web`  
**Reference source:** M4 desktop reference-screen set reviewed on 2026-06-19  
**Implementation status:** Documentation only. This document does not claim that any screen, API, migration, test, or browser workflow has been implemented or verified.

---

## 1. Purpose

This document turns the approved M4 desktop references into an implementation-safe web design specification for SchoolOS.

M4 is a connected academic operating workflow:

```text
Academic structure
-> assessment setup
-> teacher marks / CAS entry
-> review, lock, and correction
-> result readiness and publishing
-> report-card generation and protected delivery
-> promotion and Grade 11-12 readiness
```

It must feel like a school academic desk, not a generic dashboard or a static report template.

---

## 2. Product and Safety Boundaries

All M4 work must preserve the following rules:

1. `tenantId` remains the strict school boundary for every read, write, export, queue job, file, report, and direct route.
2. Backend authorization, teacher assignment validation, module entitlement, and result-visibility rules remain the source of truth.
3. A subject teacher may enter or review marks only for their assigned class, section, subject, assessment component, and academic context unless an explicit backend permission says otherwise.
4. Parents and students may see only their own published, permission-safe academic data. Draft marks, internal remarks, peer data, approval history, and internal finance reasons are never exposed to them.
5. Locked marks are changed through an audited correction workflow, not a silent edit or permanent client-side unlock.
6. Result withholding must not expose finance-sensitive detail to teachers, parents, students, or unauthorized staff.
7. Report cards, result snapshots, exports, and regenerated PDFs are protected files. They must use File Registry-backed authenticated helpers only.
8. Official totals, readiness, grades, GPA, report-card status, generation progress, and publication state come from backend/database contracts. Browser calculations and list-length approximations are not production truth.
9. Growing lists use server-side filtering and pagination.
10. No AI, public rankings, comparative child-facing data, or unapproved M11 intelligence surfaces are part of M4.

---

## 3. Visual Baseline

The reference set establishes a calm desktop operating-desk layout:

```text
Global topbar
+ compact left navigation
+ module header with one primary action
+ contextual tabs and filters
+ decision-ready KPI strip
+ dense operational workspace
+ optional contextual right rail
```

Use the shared SchoolOS design system rather than creating an M4-only visual language.

### 3.1 Composition rules

- Use a clear title, a one-line operational purpose, and one strong primary action.
- Keep secondary actions inside `More Actions`, row menus, or contextual rails.
- Use white work cards on the shared soft blue-grey app surface.
- Keep tables dense but readable. Tables are appropriate for marks, corrections, templates, report-card jobs, and promotion readiness.
- Use module accent colour to identify Academics, not as the sole source of meaning.
- Every status needs text plus accessible semantic treatment; do not rely on colour only.
- A right rail must have a real job: selected-student context, validation rules, approval history, publishing controls, or protected-file actions.
- On narrower viewports, preserve the main grid/table first and move the rail to a drawer or dedicated route.

### 3.2 Reference data rule

The source references contain illustrative students, counts, dates, progress percentages, and statuses. They are visual examples only.

```text
Never use reference numbers, names, dates, percentages, or charts as production fallback data.
```

When a bounded backend summary is unavailable, show an explicit unavailable state rather than a mock KPI.

---

## 4. Information Architecture and Screen Map

| Workspace | Main job | Primary users | Route family / implementation note |
|---|---|---|---|
| Academic Overview | Orient academic staff to real readiness, upcoming work, and drill-throughs | Academic admin, principal, exam coordinator | `/dashboard/academics` |
| Academic Structure | Configure years, classes, sections, subjects, teacher assignments, streams, and combinations | Academic admin | Existing academics structure routes; exact route composition needs repository confirmation |
| Exam Terms and Templates | Configure terms, assessment components, weights, templates, and presets | Academic admin, exam coordinator | Existing exam term/component routes |
| Marks Entry | Enter, autosave, validate, and submit assigned marks | Subject teacher, class teacher where permitted | Existing marks routes |
| CAS | Record continuous assessment, evidence, moderation, and summary | Subject teacher, coordinator | Existing CAS routes; rubric payload needs OpenAPI confirmation |
| Grading Configuration | Configure grade bands, GPA mapping, rounding, aggregation, and passing policy | Academic admin | Existing grading-policy routes |
| Review, Lock, and Corrections | Validate submitted mark sheets and process correction requests | Exam coordinator, authorized reviewer | Existing locks/corrections routes |
| Results Publishing and Withholding | Prepare, schedule, publish, withhold, and audit result visibility | Academic admin, principal, authorized finance staff | Existing results/publishing routes |
| Report Card Generation Center | Queue batches, track partial failures, retry safely, and reach protected output | Academic admin, exam coordinator | Existing report-card routes |
| Report Card Detail and History | Review one protected card, versions, corrections, and regeneration | Authorized academic staff, parent/student published view | Existing report-card detail/history routes |
| Promotion Readiness | Review academic eligibility and record manual decisions | Principal, academic admin | Existing promotion routes |

### 4.1 Navigation structure

The academics workspace may use module tabs, but each active surface still has one dominant job:

```text
Overview
Academic Structure
Exam Terms
Marks Entry
CAS
Results
Report Cards
Promotion
```

Use nested tabs only when they remain within one operational job. For example, Academic Structure may contain:

```text
Academic Years | Classes & Sections | Subjects | Teacher Assignments | Streams & Programs | Subject Combinations
```

Do not place all academic master data, marks, and report-card actions inside one mega-dashboard.

---

## 5. Shared Context and KPI Rules

### 5.1 Academic context bar

Every M4 workspace should carry the academic context needed for a safe decision:

```text
Academic year | Term | Class | Section | Subject | Stream / Program | Status
```

Rules:

- Context values must come from current backend-backed lookups.
- Filters must be represented in URL search parameters for growing lists where the existing route can support it safely.
- Changing context must invalidate/refetch dependent data.
- A teacher-facing route must show the effective backend-confirmed assignment scope.
- Never assume that a teacher may switch to an arbitrary class or subject because it appears in a selector.

### 5.2 KPI strip

Potential KPI concepts from the references:

```text
Active classes
Upcoming exam terms
Marks entry progress
Result publish readiness
Generated report cards
Locked mark sheets
```

Implementation rule:

- Use only module-owned bounded summary fields.
- Current repository alignment records that a single M4 overview contract for all six reference KPI cards is not confirmed.
- Unsupported KPI cards must render `Not available yet` with no fabricated number or percentage.
- KPI drill-through must route to a real filtered workflow, not a browser-only state.

---

## 6. Screen Specifications

### 6.1 Academic Overview

**Main job:** show real academic readiness and route the actor to the work that needs action.

**Recommended composition:**

```text
Header
-> bounded KPI strip or explicit unavailable cards
-> tabs
-> academic-context filters
-> academic structure summary
-> upcoming assessment timeline
-> marks readiness by class
-> result / report-card queue summary
-> quick actions and shortcuts
```

**Required behaviour:**

- Do not deep-fetch unbounded student, marks, CAS, report-card, and promotion lists to calculate a dashboard.
- Use a calendar/timeline only when actual assessment schedule data exists.
- Show Grade 11-12 streams/programs only for enabled school levels and authorized actors.
- Quick actions must open actual routes and preserve safe context.

**Empty/error states:**

```text
No academic year is active.
No exam term has been configured for this context.
Academic overview is not available yet.
You do not have permission to view school-wide marks readiness.
```

### 6.2 Academic Structure and Teacher Assignments

**Main job:** maintain the authoritative academic structure that M4, M6, and M12 reuse.

**Recommended sub-tabs:**

```text
Academic Years | Classes & Sections | Subjects | Teacher Assignments | Streams & Programs | Subject Combinations
```

**Primary actions by sub-tab:**

```text
Create Academic Year
Add Class / Section
Add Subject
Assign Teacher
Add Stream / Program
Add Subject Combination
```

**Design rules:**

- Keep each sub-tab focused; do not show the entire structure matrix, subject master, and teacher assignment table at full density on one page.
- Teacher assignment matrix cells must show class/section/subject context and backend assignment status.
- Grade 11-12 stream, practical, and subject-combination surfaces must be hidden or module-locked for schools where the level or feature is not enabled.
- Imports, exports, and structure changes must be audit-supported and use real backend contracts.

### 6.3 Exam Terms, Components, and Template Presets

**Main job:** define reusable assessment structures safely.

**Required sections:**

```text
Exam Terms
Assessment Components
Template Presets
Templates
Rubrics
```

**Template builder requirements:**

- Show component code, type, count, required flag, and weight.
- Enforce visible total-weight validation before an assessment template can be published or applied.
- Use existing backend template presets for terminal and theory/practical structures; do not rebuild presets in the browser.
- Clone/apply actions need confirmation and a clear target class/subject scope.
- Archive actions require a reason where backend policy requires it.

**States:**

```text
Weight total is incomplete.
This template is already in use.
No subjects are available for the selected class.
Template presets are unavailable for this school configuration.
```

### 6.4 Marks Entry Workspace

**Main job:** allow a teacher to safely enter and submit marks only for assigned work.

**Required layout:**

```text
Breadcrumb / title
-> fixed academic context bar
-> teacher scope banner
-> marks draft / autosave / pending-submission / locked summary
-> marks action toolbar
-> marks grid
-> validation and submission right rail
-> state legend
```

**Grid requirements:**

- Use a spreadsheet-style grid only because it improves entry speed.
- Support keyboard navigation and paste only through a validated, contract-confirmed path.
- Keep student identity, roll number, component maximum, calculated total, remarks, and mark state readable.
- Save draft only through backend-supported draft/autosave contracts.
- Surface row-level and cell-level validation beside the relevant input.
- Make `Absent`, `Withheld`, `Retest / Make-up`, `Practical Pending`, and `Project Pending` explicit selectable states where supported by the backend.
- Do not convert a missing numeric mark into a state implicitly.
- Locked sheets are read-only with a direct route to the correction request workflow.

**Autosave states:**

```text
Saving changes
Saved just now
Could not save draft. Retry
Draft saved, but marks are not submitted
Submitted for review
Locked after review
```

**Teacher scope banner:**

```text
You can enter marks for Grade X - Section Y - Subject Z - Component A.
```

The visible scope is a usability statement, not authorization; backend scope checks remain mandatory.

### 6.5 CAS Workspace

**Main job:** record continuous assessment and supporting evidence with moderation visibility.

**Required composition:**

```text
CAS context bar
-> assessed / pending / average / teacher-submission summary
-> rubric score grid
-> moderation summary
-> teacher remarks and evidence
-> selected-student trend / observations rail
```

**Contract rule:**

The visual design may include rubric criteria, observations, evidence files, moderation status, and progress trends, but their mutation and query shape require OpenAPI confirmation before implementation.

Mark as `needs OpenAPI confirmation` until verified:

```text
Rubric criterion identifiers and scales
Observation payloads
Evidence-file link fields
Moderation status and review actions
CAS trend-series data
Teacher remarks history
```

**Evidence files:**

- Use File Registry-backed protected links only.
- Do not show raw storage URLs, object keys, or unmanaged external file paths.

### 6.6 Grade Scales and Grading Policy

**Main job:** configure grade bands, GPA mapping, rounding, aggregation, and passing rules.

**Required sections:**

```text
Grade Scale
Grading Rules and Policies
Sample Grade Preview
Audit / Change History
Quick Actions
```

**Rules:**

- Grade bands must not have gaps or overlaps.
- A scale must cover the permitted score range according to the backend policy.
- Rounding, decimal precision, grace marks, aggregation, best-of policies, minimum-pass requirements, and failure overrides require explicit labels and audit-aware edits.
- Current scale changes should display draft/published status where backend supports it.
- A sample preview may illustrate backend-calculated outcomes, but must not become an alternate client-side grading engine.

### 6.7 Marks Review, Lock, and Correction Workflow

**Main job:** validate submitted sheets, lock safe records, and process changes transparently.

**Required tabs:**

```text
Review Queue | Locked Sheets | Unlock Requests | Corrections | Audit Log
```

**Correction workflow:**

```text
Teacher requests correction
-> required reason and affected mark context
-> reviewer validates before/after context
-> authorized approver decides
-> limited correction window if policy supports it
-> teacher corrects
-> reviewer revalidates
-> sheet is locked again
-> audit history remains available
```

**Do not implement:**

```text
Permanent direct unlock button
Silent changes to locked marks
Unlock without actor, reason, scope, expiry, and audit
```

A temporary unlock action is valid only when the backend supports a reasoned, time-bounded, auditable correction window.

### 6.8 Result Publishing and Withholding

**Main job:** prepare and release results with safe visibility controls.

**Required composition:**

```text
Publish queue
-> readiness and publish-window table
-> publishing summary rail
-> withholding overview
-> dues-aware withholding rules
-> access and visibility controls
```

**Role and privacy rules:**

- Academic staff see readiness and publication status only within their scope.
- Dues-related reason detail is limited to authorized finance/admin roles.
- Teachers should see a neutral state such as `Not available for publication` where finance detail is not appropriate.
- Parents and students see only their own final published or withheld result state. They never see internal rule configuration or another student’s outcome.
- Scheduling, publishing, withholding, and release actions require confirmation and audit support.

### 6.9 Report Card Generation Center

**Main job:** manage queued batch generation, inspect partial failure, retry safely, and retrieve protected outputs.

**Required composition:**

```text
Generation queue
-> batch job table
-> selected-job summary rail
-> partial failure details
-> protected file storage panel
-> safe retry / manifest / protected-PDF actions
```

**Rules:**

- Render queued, processing, completed, failed, and retry-safe state only when confirmed by persisted backend job contracts.
- Do not simulate report progress from timers or browser list lengths.
- Partial failure must list the affected student/record safely, error category, and permitted retry action without exposing implementation secrets.
- Retry actions must be idempotent, reasoned where required, and bounded to safe failed work.
- Reused/re-generated PDFs remain File Registry-protected.

### 6.10 Report Card Detail, History, and Regeneration

**Main job:** inspect one protected report card, its snapshots, corrections, and regeneration history.

**Required composition:**

```text
Student identity and academic context
-> protected report-card preview state
-> version history
-> correction summary
-> actions rail
-> protected-file status and metadata
```

**Protected-file actions:**

```text
Open Protected PDF
Download Protected PDF
Share Securely
Regenerate Report Card
Compare Versions
View Correction History
```

Do not expose a reusable unrestricted raw link or raw signed storage URL. `Copy Link` must only be used when the actual backend supports a scoped secure-share flow with expiry, permission re-check, and audit.

### 6.11 Promotion Readiness and Grade 11-12 Board Preparation

**Main job:** show eligibility, blockers, academic readiness, and controlled promotion decisions.

**Required composition:**

```text
Promotion readiness table
-> Grade 11-12 stream/program readiness
-> board-preparation checklist
-> pending practical/project completion
-> selected-student rail
-> manual recommendation / decision actions
```

**Rules:**

- Automatic calculations must be backend-owned and explainable through visible prerequisites.
- Manual promotion, hold, stream assignment, or override decisions require permission, confirmation, reason where policy requires it, and audit.
- Grade 11-12 stream/program surfaces are stage-aware and should not appear for schools where they are not configured.
- Parent/student access must show only released outcomes, never internal recommendation or board-preparation risk notes.

---

## 7. Shared Components

Create or extend shared UI primitives rather than introducing an M4-only parallel system.

```text
AcademicContextBar
AcademicKpiStrip
AcademicStatusBadge
AssessmentComponentBadge
TeacherScopeBanner
MarksEntryGrid
MarkCell
MarkStateSelector
MarksValidationRail
AssessmentTemplateBuilder
GradeScaleEditor
CASRubricGrid
ModerationQueueTable
CorrectionRequestDrawer
ApprovalTimeline
ResultPublishingPanel
WithholdingRulePanel
ReportCardJobTable
ReportCardFailurePanel
ProtectedReportCardButton
ReportCardVersionTimeline
PromotionReadinessTable
PromotionDecisionDrawer
```

All components must reuse shared loading, empty, error, permission-denied, module-locked, queued-job, partial-failure, confirmation, reason, and protected-file patterns.

---

## 8. Role and Visibility Matrix

| Role | Allowed M4 work | Explicitly denied or restricted |
|---|---|---|
| Academic Admin | Academic structure, exam setup, grading policy, report-card batches, results, promotion | Platform controls; finance-detail withholding reason unless separately permitted |
| Exam Coordinator | Terms/components, review queue, lock/correction workflow, batch monitoring | Unscoped teacher marks; finance-only withholding details |
| Subject Teacher | Assigned marks and CAS entry, own submission state | Other subject/class marks, result publish, policy edits, report-card batch action |
| Class Teacher | Permitted class remarks, class-level review where assigned | Subject marks outside assignment; school-wide policy configuration |
| Principal | Safe school-wide readiness, approvals, publishing/promotion decisions when permitted | Salary, fee, or private finance detail without separate permission |
| Finance/Admin with separate permission | Dues-hold rule administration where implemented | Marks editing unless academic permission exists |
| Parent / Student | Own published result/report-card only | Drafts, internal notes, correction history, peer data, queues, configuration |

---

## 9. Required State Matrix

Every M4 route must handle the following where relevant:

| State | Required response |
|---|---|
| Loading | Render a layout-matched skeleton while preserving title and selected context. |
| Empty | Explain why no record exists and show one safe next action when allowed. |
| Error | Show a parsed, school-friendly error; preserve filters and retry safely. |
| Permission denied | Explain that access is not permitted without exposing hidden marks, students, or finance detail. |
| Module locked | Show shared `ModuleLockedState`; backend must also reject the route/action. |
| No active academic year | Explain configuration gap and route only authorized users to setup. |
| No teacher assignment | Show teacher-scope denial; do not render an editable blank marks grid. |
| Draft/autosave failed | Preserve local input only where the existing workflow safely supports it; show retry. |
| Marks locked | Render read-only grid and correction request path. |
| Validation failure | Place precise errors beside cells/fields and summarise only for long forms. |
| Queued job | Render backend job state; do not invent progress. |
| Partial report failure | Separate successful and failed records and offer only safe retry actions. |
| Protected file unavailable | Explain missing, expired, or restricted file without raw provider detail. |
| Result unpublished/withheld | Show safe actor-appropriate visibility state. |
| Correction window expired | Explain that the record cannot be changed and route to authorized review if allowed. |

---

## 10. API and Contract Verification Matrix

Do not invent endpoint shapes. Confirm from backend controllers, OpenAPI, `packages/core`, current API helpers, DTOs, permissions, and tests before building each slice.

| Workflow | Current repository-alignment evidence | Implementation status |
|---|---|---|
| Academic years, classes, sections, subjects, assignments | Existing backend/API-client coverage recorded | Confirm exact query/mutation DTOs in touched route |
| Exam terms, components, grading policy | Existing backend/API-client coverage recorded | Confirm exact apply/clone/preset behavior |
| Marks and batch marks | Existing backend/API-client coverage recorded | Confirm autosave, row-state, bulk-edit, and submit semantics |
| CAS | Existing backend/API-client coverage recorded | **Needs OpenAPI confirmation** for rubrics, evidence, moderation, and trend payloads |
| Report-card generation/correction/history/PDF | Existing backend/API-client coverage recorded | Confirm persisted job-state and safe retry fields before progress UI |
| Result readiness/preview/publish | Existing backend/API-client coverage recorded | Confirm publishing schedule, withholding, visibility, and audit payloads |
| Promotion | Existing route family is recorded | **Needs backend/OpenAPI confirmation** for eligibility, manual decision, stream assignment, and audit semantics |
| Grade 11-12 streams/subject combinations/practicals | Product direction requires staged support | **Needs backend verification** before route-level implementation |

Unknowns must be labelled in code and implementation notes as one of:

```text
needs backend verification
needs OpenAPI confirmation
needs mobile DTO
needs idempotency confirmation
needs offline sync confirmation
```

---

## 11. Implementation Priority

### P0 — Daily academic operational path

1. Academic Overview using existing bounded APIs and explicit unavailable KPI states.
2. Teacher Marks Entry Workspace with backend-confirmed scope, autosave/draft, mark states, validation, and submit-for-review.
3. Review, Lock, and Correction workflow with reason, before/after context, approval state, and audit trace.
4. Result Publishing and Withholding controls with role-safe visibility.
5. Report Card Generation Center with real job status, partial failure, retry-safe action, and protected outputs.
6. Individual Report Card Detail, version history, correction history, and protected open/download actions.

### P1 — Academic setup and quality controls

7. Academic Structure and Teacher Assignments.
8. Exam Terms, Components, and Template Presets.
9. Grade Scale and Grading Policy.
10. CAS Entry and Moderation after contract confirmation.
11. Promotion Readiness with automatic backend calculation plus auditable manual decision.

### P2 — Grade 11-12 depth

12. Streams / programs.
13. Subject combinations.
14. Practical and project components.
15. Board-preparation readiness.

---

## 12. Definition of Done

An M4 web slice is complete only when:

```text
[ ] Uses a confirmed real API and shared types where available.
[ ] Enforces tenant, role, assignment, and module scope through backend authorization.
[ ] Has loading, empty, error, success, permission-denied, and module-locked states.
[ ] Keeps filters and growing lists server-side and paginated.
[ ] Does not use reference/mock production data.
[ ] Shows official totals, grades, readiness, and job state from backend truth.
[ ] Uses reason, confirmation, pending, and audit support for high-risk actions.
[ ] Handles marks lock/correction without silent mutation.
[ ] Uses File Registry-backed protected helpers for PDFs, exports, and evidence files.
[ ] Preserves parent/student published-only, own-record access.
[ ] Includes focused contract/regression coverage where appropriate.
[ ] Includes a browser smoke case or updates an existing focused E2E path.
```

---

## 13. Verification Plan

No runtime verification is claimed by this documentation update.

Before marking an M4 implementation slice complete, run the relevant checks:

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

M4-focused browser smoke must include at minimum:

```text
Subject teacher cannot open unassigned marks context.
Teacher draft/autosave and failed-save state are visible.
Locked marks cannot be silently edited.
Correction request requires reason and preserves before/after history.
Parent/student cannot see unpublished result or another student's report card.
Report-card file opens through protected authenticated helper.
Report-card batch partial failure shows failed records without exposing unsafe details.
Module-locked and permission-denied routes fail safely.
```

---

## 14. Risks and Deferrals

| Risk | Required mitigation |
|---|---|
| CAS visual design exceeds confirmed backend contract | Implement read-only/available states until DTOs and OpenAPI are verified. |
| Reference KPIs tempt mock data or browser aggregation | Use bounded module summaries or explicit unavailable cards. |
| Temporary unlock becomes an uncontrolled edit path | Require backend-supported reason, actor, expiry, review, re-lock, and audit. |
| Withholding leaks finance detail | Split academic visibility from finance-authorized policy detail. |
| Report-card progress is simulated | Render only persisted backend job state. |
| Protected PDFs become raw URLs | Use shared protected-file helpers only. |
| Grade 11-12 surfaces appear for unsupported schools | Gate by tenant configuration, module entitlement, and academic-level feature support. |
| Dense tables become unusable at smaller widths | Preserve primary workflow, collapse rail, use detail drawers, and avoid unreadable compression. |

---

## 15. Related Documents

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md
docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
```
