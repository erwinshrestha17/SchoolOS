# M4 Academics Web Reference Specification

**Status:** Active design and implementation-reference document  
**Updated:** 2026-06-19  
**Scope:** M4 Academics, Exams, CAS, Results, Report Cards, and Promotion in `apps/web`  
**Reference source:** M4 desktop reference-screen set reviewed on 2026-06-19  
**Implementation status:** Documentation only. No screen, API, migration, test, or browser workflow is claimed as implemented or verified by this document.

---

## 1. Purpose

This document converts the M4 desktop references into an implementation-safe SchoolOS design specification.

```text
Academic structure
-> assessment setup
-> teacher marks / CAS entry
-> review, lock, and correction
-> result readiness and publishing
-> report-card generation and protected delivery
-> promotion and Grade 11-12 readiness
```

M4 must feel like a school academic operating desk, not a generic dashboard or static report template.

---

## 2. Non-Negotiable Boundaries

1. `tenantId` is the strict boundary for all M4 queries, mutations, jobs, exports, report cards, and files.
2. Backend RBAC, teacher assignment validation, entitlement, mark-lock, and result-visibility rules are the source of truth.
3. Teachers can enter or review marks only for backend-confirmed class, section, subject, component, and academic-year scope.
4. Parents and students see only their own published, permission-safe data. Drafts, peer data, internal remarks, approval history, and finance details are not exposed.
5. Locked marks use a reasoned and auditable correction workflow. They must not be silently edited or permanently unlocked in the client.
6. Report cards, result snapshots, evidence, exports, and regenerated PDFs use File Registry-backed authenticated helpers only.
7. Official grades, GPA, readiness, generation progress, and publication state come from backend/database truth, never browser calculations or list lengths.
8. Growing lists must use server-side filtering and pagination.
9. No AI, public ranking, comparative child-facing data, or M11 intelligence surfaces are in scope.

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

Rules:

- Use the shared SchoolOS visual system. Do not create an M4-only design language.
- Use a clear title, short operational purpose, and one strong primary action.
- Keep secondary actions in `More Actions`, row menus, or contextual rails.
- Dense tables are appropriate for marks, corrections, templates, report-card jobs, and promotion readiness.
- Status must have visible text and semantic treatment; colour alone is insufficient.
- The right rail must have a job: selected-record context, validation, review history, visibility controls, or protected-file actions.
- On smaller widths, preserve the primary grid/table first and collapse the right rail into a drawer or dedicated route.
- The reference names, figures, dates, charts, and percentages are illustrative only. Never use them as production fallback data.

---

## 4. Information Architecture

| Workspace | Main job | Primary users | Route family / note |
|---|---|---|---|
| Academic Overview | Show real readiness and drill-throughs | Academic admin, principal, exam coordinator | `/dashboard/academics` |
| Academic Structure | Maintain years, classes, subjects, teachers, streams | Academic admin | Confirm canonical routes in existing code |
| Exam Terms and Templates | Configure terms, components, weights, templates, presets | Academic admin, exam coordinator | Existing exam/component routes |
| Marks Entry | Enter, autosave, validate, submit assigned marks | Subject teacher, class teacher where permitted | Existing marks routes |
| CAS | Record continuous assessment and moderation | Subject teacher, coordinator | Existing CAS routes; exact rubric/evidence DTO needs confirmation |
| Grading Configuration | Grade bands, GPA, rounding, aggregation, passing rules | Academic admin | Existing grading-policy routes |
| Review, Lock, Corrections | Validate submitted sheets and process changes | Exam coordinator, authorized reviewer | Existing locks/corrections routes |
| Results Publishing | Publish, schedule, withhold, release, and audit outcomes | Academic admin, principal, authorized finance staff | Existing results/publishing routes |
| Report Card Center | Queue generation, handle partial failure, reach protected output | Academic admin, exam coordinator | Existing report-card routes |
| Report Card Detail | Inspect one card, history, correction, regeneration | Authorized academic staff; parent/student published view | Existing report-card detail/history routes |
| Promotion Readiness | Evaluate eligibility and record manual decisions | Principal, academic admin | Existing promotion routes |

### 4.1 Module navigation

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

Academic Structure may use sub-tabs:

```text
Academic Years | Classes & Sections | Subjects | Teacher Assignments | Streams & Programs | Subject Combinations
```

Each active workspace retains one dominant job. Do not build a mega-dashboard containing all master data, marks, results, and report cards at once.

---

## 5. Shared Context and KPI Rules

### 5.1 Academic context bar

Every M4 workspace should carry the needed context:

```text
Academic year | Term | Class | Section | Subject | Stream / Program | Status
```

- Use current backend-backed lookups only.
- Filters for growing lists should use URL search parameters where the canonical route supports it.
- Context changes refetch dependent data.
- A teacher-facing page displays the effective backend-confirmed assignment scope.
- A selector never grants permission by itself.

### 5.2 KPI strip

Possible reference concepts:

```text
Active classes
Upcoming exam terms
Marks entry progress
Result publish readiness
Generated report cards
Locked mark sheets
```

- Use only bounded, module-owned backend fields.
- Current repository alignment does not confirm one M4 overview contract for all reference KPI cards.
- Unsupported KPIs render an explicit unavailable state, not a fabricated number or percentage.
- A KPI drill-through must open a real filtered route/workspace.

---

## 6. Screen Specifications

### 6.1 Academic Overview

**Main job:** orient academic staff to real readiness and direct them to work needing attention.

```text
Header
-> bounded KPI strip or explicit unavailable cards
-> academic-context filters
-> academic structure summary
-> upcoming assessment timeline
-> marks readiness by class
-> result/report-card queue summary
-> quick actions and shortcuts
```

- Do not deep-fetch unbounded student, marks, CAS, report-card, and promotion lists to calculate a dashboard.
- Use calendar/timeline only with actual schedule data.
- Grade 11-12 streams/programs appear only when school level and feature are enabled.

### 6.2 Academic Structure and Teacher Assignments

**Main job:** maintain academic structure shared by M4, M6, and M12.

- Keep each sub-tab focused; do not show class directory, subject master, and teacher matrix at full density together.
- Teacher assignment matrix cells must display class/section/subject context and backend assignment state.
- Streams, practicals, and subject combinations are stage-aware and feature-gated.
- Imports, exports, and structure changes use real contracts and audit-aware actions.

### 6.3 Exam Terms, Components, and Template Presets

**Main job:** define safe reusable assessment structures.

```text
Exam Terms | Components | Templates | Presets | Rubrics
```

- Show component code, type, count, required flag, and weight.
- Show visible total-weight validation before publish/apply.
- Use backend template presets for terminal and theory/practical structures; do not recreate preset logic in the browser.
- Clone/apply actions need confirmation and a clear target scope.
- Archive actions require a reason where backend policy requires it.

### 6.4 Marks Entry Workspace

**Main job:** enable assigned teachers to safely enter and submit marks.

```text
Breadcrumb / title
-> fixed academic context bar
-> teacher scope banner
-> draft/autosave/pending/locked summary
-> marks toolbar
-> marks grid
-> validation and submission right rail
-> state legend
```

Rules:

- Spreadsheet grid is allowed because it improves entry speed.
- Support keyboard navigation and paste only when the validation path is confirmed.
- Keep roll number, student identity, component maximum, total, remarks, and state visible.
- Draft/autosave uses only existing backend support.
- Surface cell and row validation beside the relevant input.
- Make `Absent`, `Withheld`, `Retest / Make-up`, `Practical Pending`, and `Project Pending` explicit states only where confirmed by backend.
- A missing number must not silently become a state.
- Locked sheets are read-only and link to correction request.

Autosave language:

```text
Saving changes
Saved just now
Could not save draft. Retry
Draft saved, but marks are not submitted
Submitted for review
Locked after review
```

### 6.5 CAS Workspace

**Main job:** record continuous assessment with moderation and evidence visibility.

```text
CAS context bar
-> assessed / pending / average / teacher-submission summary
-> rubric score grid
-> moderation summary
-> teacher remarks and evidence
-> selected-student observations / trend rail
```

The visual design may include rubric criteria, observations, evidence files, moderation status, and trends. Before implementation, mark these as `needs OpenAPI confirmation` unless verified in current source:

```text
Rubric criterion IDs and scales
Observation payloads
Evidence-file links
Moderation status/review actions
CAS trend series
Teacher-remark history
```

Evidence files must use File Registry-backed protected actions.

### 6.6 Grade Scales and Grading Policy

**Main job:** configure grade bands, GPA mapping, rounding, aggregation, and pass rules.

```text
Grade Scale
Grading Rules and Policies
Sample Grade Preview
Audit / Change History
Quick Actions
```

- Grade bands cannot overlap or leave gaps contrary to backend policy.
- Rounding, decimal precision, grace marks, aggregation, best-of, pass, and override rules need explicit labels and audit-aware edits.
- The preview illustrates backend calculation where available; it is not a second client grading engine.

### 6.7 Marks Review, Lock, and Correction

**Main job:** validate submitted sheets, lock safe records, and process changes transparently.

```text
Review Queue | Locked Sheets | Unlock Requests | Corrections | Audit Log
```

Required workflow:

```text
Teacher requests correction
-> reason + affected mark context
-> reviewer validates before/after context
-> authorized approver decides
-> limited correction window if supported
-> teacher corrects
-> reviewer revalidates
-> sheet re-locks
-> audit history remains available
```

Do not implement a permanent direct unlock or silent locked-mark edit. A temporary unlock is valid only when backend supports an actor, reason, scope, expiry, re-lock, and audit trail.

### 6.8 Result Publishing and Withholding

**Main job:** prepare and release results with safe visibility controls.

```text
Publish queue
-> readiness and publish-window table
-> publishing summary rail
-> withholding overview
-> dues-aware withholding rules
-> access and visibility controls
```

- Academic staff see readiness and publication state within scope.
- Finance-sensitive reason detail is limited to authorized finance/admin actors.
- Teachers use a neutral state such as `Not available for publication` when finance detail is not appropriate.
- Parent/student views are own-record and final published/withheld state only.
- Scheduling, publishing, withholding, and release actions require confirmation and audit support.

### 6.9 Report Card Generation Center

**Main job:** manage asynchronous batches, partial failure, safe retry, and protected output.

```text
Generation queue
-> batch job table
-> selected-job summary rail
-> partial failure details
-> protected file storage panel
-> safe retry / manifest / protected-PDF actions
```

- Render queued, processing, completed, failed, and retry-safe only when backed by persisted job contracts.
- Do not simulate progress with timers or list lengths.
- Partial failure reveals safe error category and permitted retry action, not stack traces, object keys, or provider details.
- Retry must be bounded to safe backend-supported work.
- Generated and regenerated PDFs remain File Registry-protected.

### 6.10 Report Card Detail, History, and Regeneration

**Main job:** inspect one protected card and its versions/corrections.

```text
Student identity and academic context
-> protected preview state
-> version history
-> correction summary
-> actions rail
-> protected-file status and metadata
```

Actions:

```text
Open Protected PDF
Download Protected PDF
Share Securely
Regenerate Report Card
Compare Versions
View Correction History
```

Do not expose reusable raw links or signed storage URLs. A copy-link action is permissible only for a confirmed secure-share contract with expiry, permission re-check, and audit.

### 6.11 Promotion and Grade 11-12 Board Preparation

**Main job:** show eligibility, blockers, stage-aware readiness, and controlled decisions.

```text
Promotion readiness table
-> Grade 11-12 stream/program readiness
-> board-preparation checklist
-> pending practical/project completion
-> selected-student rail
-> manual decision actions
```

- Automatic eligibility is backend truth and should expose prerequisites, not opaque scores.
- Manual promotion, hold, stream assignment, or override needs permission, confirmation, reason where required, and audit.
- Parent/student surfaces show released outcome only, never internal recommendations or board-preparation notes.

---

## 7. Shared Components

Extend shared primitives; do not build a parallel M4 component system.

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

All use shared loading, empty, error, permission-denied, module-locked, queued-job, partial-failure, confirmation, reason, and protected-file patterns.

---

## 8. Role Matrix

| Role | Allowed M4 work | Restricted work |
|---|---|---|
| Academic Admin | Structure, templates, grading policy, report-card batches, results, promotion | Platform controls and finance-only holding detail unless separately permitted |
| Exam Coordinator | Terms/components, review queue, locks/corrections, batch monitoring | Unscoped teacher marks and finance-only detail |
| Subject Teacher | Assigned marks/CAS entry and own submission state | Other class/subject marks, publishing, policy changes, batch generation |
| Class Teacher | Permitted class remarks and class review | Subject marks outside assignment and school-wide configuration |
| Principal | Safe readiness, approvals, publishing/promotion if permitted | Salary/finance detail without separate permission |
| Parent / Student | Own published result/report card | Drafts, internal notes, correction history, peer data, queues, configuration |

---

## 9. Required States

| State | Required response |
|---|---|
| Loading | Layout-matched skeleton while title/context remain visible. |
| Empty | Explain why no data exists and offer one safe next action if allowed. |
| Error | School-friendly parsed error; preserve filters and retry. |
| Permission denied | Do not reveal hidden marks, students, or finance detail. |
| Module locked | Shared `ModuleLockedState`; backend also blocks action. |
| No active academic year | Explain configuration gap and route authorized actor safely. |
| No teacher assignment | Show scope denial; do not render editable blank grid. |
| Draft/autosave failed | Preserve safe local input only where existing workflow supports it; show retry. |
| Marks locked | Read-only grid with correction-request path. |
| Queued job | Backend job state only. |
| Partial report failure | Separate successful/failed records and offer only safe retry. |
| Protected file unavailable | Explain missing/expired/restricted file without provider detail. |
| Result unpublished/withheld | Actor-appropriate safe state. |
| Correction window expired | Explain immutability and route to review if allowed. |

---

## 10. Contract Verification Matrix

Do not invent endpoint shapes. Confirm backend controller, OpenAPI, `packages/core`, API helper, DTO, permission, audit, and test coverage before implementation.

| Workflow | Current alignment evidence | Implementation requirement |
|---|---|---|
| Academic years/classes/sections/subjects/assignments | Existing coverage recorded | Confirm exact touched query/mutation DTOs |
| Exam terms/components/grading policy | Existing coverage recorded | Confirm preset apply/clone behavior |
| Marks/batch marks | Existing coverage recorded | Confirm autosave, mark state, bulk edit, submit semantics |
| CAS | Existing coverage recorded | **Needs OpenAPI confirmation** for rubrics/evidence/moderation/trends |
| Report-card generation/correction/history/PDF | Existing coverage recorded | Confirm persisted job fields and safe retry scope before progress UI |
| Results readiness/preview/publish | Existing coverage recorded | Confirm scheduling, holding, visibility, audit payloads |
| Promotion | Existing route family recorded | **Needs backend/OpenAPI confirmation** for eligibility/manual decision/stream assignment |
| Grade 11-12 depth | Product direction only | **Needs backend verification** before route-level work |

---

## 11. Priority and Definition of Done

### P0

1. Academics overview with existing bounded APIs and unavailable KPI states.
2. Teacher marks entry with confirmed scope, autosave/draft, states, validation, and review submission.
3. Review, lock, and correction workflow.
4. Result publishing and safe withholding visibility.
5. Report-card generation center with real job/partial-failure/retry/protected outputs.
6. Report-card detail/history/protected open and download.

### P1

7. Academic structure and teacher assignments.
8. Exam terms/components/templates.
9. Grading configuration.
10. CAS after contract confirmation.
11. Promotion readiness with backend-calculated eligibility and auditable manual decision.

### P2

12. Streams/programs.
13. Subject combinations.
14. Practical/project components.
15. Board-preparation readiness.

An M4 slice is complete only when it uses real confirmed APIs, enforces backend scope, handles all states, uses server-side lists, contains no mock data, protects files, preserves published-only own-record access, and has focused regression/browser coverage as appropriate.

---

## 12. Verification and Risks

No runtime verification is claimed by this documentation update.

Run relevant checks before calling an M4 implementation complete:

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

Minimum M4 browser checks:

```text
Teacher denied for unassigned marks context.
Draft/autosave success and failure visible.
Locked marks cannot be silently edited.
Correction request requires reason and preserves history.
Parent/student cannot see unpublished or another student's result.
Report-card protected file success and failure states work.
Batch partial failure is safe and retry-bounded.
Module-locked and permission-denied routes fail safely.
```

Key risks:

| Risk | Mitigation |
|---|---|
| Visual work invents API contracts | Confirm contracts before each slice; label unknowns. |
| KPI cards use mock/list-length totals | Use bounded summaries or unavailable states. |
| CAS outgrows contract | Hold write UI until OpenAPI verification. |
| Progress is simulated | Render persisted backend job state only. |
| Correction path undermines marks integrity | Require backend scope, reason, expiry, re-lock, and audit. |
| Withholding leaks finance data | Purpose-limit detail by role. |
| PDFs become raw URLs | Use authenticated File Registry helpers only. |
| Grade 11-12 appears for unsupported school | Gate by tenant configuration/entitlement/academic level. |

---

## 13. Related Documents

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md
docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
```
