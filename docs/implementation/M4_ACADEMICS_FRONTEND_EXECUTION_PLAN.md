# M4 Academics Frontend Execution Plan

**Status:** Active frontend execution plan  
**Updated:** 2026-06-19  
**Scope:** `apps/web` implementation work for M4 Academics, Exams, CAS, Results, Report Cards, and Promotion  
**Companion design specification:** `docs/design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md`  
**Implementation status:** Planning only; no backend, frontend, OpenAPI, Prisma, or test completion is claimed here.

---

## 1. Purpose

This plan converts the M4 reference design specification into safe implementation slices. It exists to prevent a visual redesign from bypassing real SchoolOS contracts, tenant isolation, teacher assignment checks, audited correction flows, protected-file rules, and published-only parent/student visibility.

Use this plan only after reading the current route, API helper, backend controller, DTO, OpenAPI, permissions, audit, and test coverage for the touched flow.

---

## 2. Non-Negotiables

```text
Real API only.
No mock production data.
No browser-owned grades, readiness, totals, or job progress.
No unscoped teacher marks entry.
No silent change to locked marks.
No raw report-card file URL, object key, or permanent signed URL.
No unpublished result or internal correction detail for parent/student surfaces.
No Grade 11-12 feature surface without tenant and product-level confirmation.
No claims that staging, browser E2E, pilot smoke, or production checks passed unless they were actually run.
```

---

## 3. Required Repository Inspection Before Each Slice

Before changing a screen, inspect all relevant sources:

```text
apps/web/app/dashboard/academics/**
apps/web/components/academics/**
apps/web/lib/api/academics.ts and related API helper modules
packages/core academic contracts/types where available
apps/api/src/** academic, exam, result, report-card, and promotion controllers/services
apps/api/prisma/schema.prisma and relevant migrations
OpenAPI generated output / verification gate
permission catalog and entitlement mapping
existing unit, contract, API E2E, web tests, and browser E2E
shared UI primitives and protected-file helpers
```

For every proposed endpoint, mutation, field, job state, or permission, label an unverified item as:

```text
needs backend verification
needs OpenAPI confirmation
needs idempotency confirmation
needs offline sync confirmation
```

Do not invent a backend contract to match a screenshot.

---

## 4. Current Confirmed Frontend/Backend Alignment

Repository alignment already records coverage for:

```text
Academic years, classes, sections, subjects, and teacher assignments
Exam terms, components, and grading policy
Marks and batch marks
CAS
Report-card generation, correction, history, and protected PDF access
Result readiness, preview, and publish
```

Known alignment gaps to preserve:

```text
No single bounded M4 overview API is confirmed for all reference KPI cards.
CAS rubric, evidence, moderation, and trend DTO shapes require confirmation before mutation UI is built.
Report-card visual progress must be backed by confirmed persisted job-state fields.
Promotion eligibility/manual decision, Grade 11-12 streams, subject combinations, practicals, and projects need backend/OpenAPI confirmation before full route implementation.
```

---

## 5. Delivery Sequence

### M4-W0 — Contract and Route Baseline

**Goal:** record repository truth before changing visual composition.

**Tasks:**

1. Inventory existing M4 routes and canonical workspaces.
2. Map each screen to an existing API helper and backend controller.
3. Record whether each desired field is confirmed, unavailable, or needs contract confirmation.
4. Confirm current role and entitlement gates for academic admin, exam coordinator, subject teacher, class teacher, principal, parent, and student.
5. Confirm protected report-card file open/download path.
6. Confirm existing correction/lock/unlock audit behaviour and whether time-bounded correction windows are supported.
7. Confirm result publishing, withholding, and parent/student publication DTOs separately from finance-only detail.

**Exit criteria:** no new UI starts from an assumed endpoint or inferred permission.

### M4-W1 — Shared M4 Composition Primitives

**Goal:** provide reusable pieces without duplicating the shared UI system.

**Implementation targets:**

```text
AcademicContextBar
TeacherScopeBanner
AcademicStatusBadge
AssessmentComponentBadge
MarksValidationRail
ProtectedReportCardButton
ReportCardVersionTimeline
CorrectionRequestDrawer
ApprovalTimeline
```

**Rules:**

- Extend or re-export existing shared components in `components/ui` / established dashboard primitives.
- Do not create a third shared component system.
- Reuse shared `ErrorState`, `ModuleLockedState`, pagination, table toolbar, confirmation, reason, and protected-file helpers.
- Add only visual primitives that can be used by more than one M4 workspace.

**Exit criteria:** shared components have explicit loading/empty/error/permission/locked states and no direct provider/file URL logic.

### M4-W2 — Academics Overview and Structure

**Goal:** align overview and academic-structure screens to the references without fake data.

**Scope:**

```text
/dashboard/academics
Academic years
Classes and sections
Subjects
Teacher assignments
Streams and subject combinations only when contract-confirmed
```

**Rules:**

- Use existing bounded data or display explicit unavailable KPI cards.
- Do not compute school-wide readiness from paginated lists.
- Keep academic structure sub-tabs focused; do not build one mega-table with all master data.
- Preserve existing routes where they are canonical; composition must not break deep links.

**Exit criteria:** every summary has a real source or is clearly unavailable, filters are server-backed where supported, and teacher assignment context remains backend-owned.

### M4-W3 — Exam Terms, Components, and Grading Configuration

**Goal:** make assessment setup practical, safe, and auditable.

**Scope:**

```text
Exam term list/detail
Assessment component builder
Template preset apply/clone flow
Grade-scale and grading-policy configuration
```

**Rules:**

- Use backend presets; do not rebuild preset logic in the browser.
- Display weight validation from backend or a client-side precheck that does not replace backend validation.
- Archive, apply, publish, and grading-policy changes require the established confirmation/reason/audit patterns where relevant.
- Grade preview must display backend-calculated sample conversion where available; it is not a second grading engine.

**Exit criteria:** no template, scale, or policy action silently mutates existing published/used academic data.

### M4-W4 — Teacher Marks Entry

**Goal:** deliver the P0 daily academic work screen.

**Scope:**

```text
Assigned-scope context selection
Teacher scope banner
Marks grid
Draft/autosave states
Mark-state selection
Validation
Submit-for-review flow
Read-only locked state
```

**Rules:**

- Confirm exact autosave, submit, bulk entry, and mark-state DTOs first.
- Use a stable idempotency strategy if the backend contract requires one.
- Do not make a bulk paste/import action available until its validation and failure behaviour are confirmed.
- A locked row/sheet is read-only; it must link to correction request rather than accepting edits.
- Preserve user input after recoverable save failures only within the existing supported draft/autosave model.

**Focused tests:**

```text
Assigned teacher can open permitted context.
Unassigned teacher is denied by backend and sees a safe UI state.
Draft/autosave success and failure states render correctly.
Absent/withheld/retest values obey confirmed mutually exclusive rules.
Submit cannot duplicate a review request.
Locked marks cannot be edited.
```

### M4-W5 — CAS Entry and Moderation

**Goal:** ship CAS only after exact contract shape is verified.

**Scope:**

```text
CAS score grid
Rubric criteria
Teacher observations and remarks
Evidence files
Moderation queue and history
Student-safe trend display where supported
```

**Hard gate:**

```text
Do not implement write UI until rubric, evidence, moderation, trend, and audit DTOs are confirmed in OpenAPI/backend sources.
```

**Rules:**

- Evidence files use File Registry helpers.
- Moderation writes must have explicit actor, before/after context, status, and audit path.
- Parent/student surfaces remain published-only and non-comparative.

### M4-W6 — Review, Lock, Corrections, and Result Publishing

**Goal:** make high-risk academic control operations clear and auditable.

**Scope:**

```text
Review queue
Locked sheets
Correction requests
Correction detail and approval timeline
Result readiness
Publish / schedule / withhold / release actions
```

**Rules:**

- Require reason before correction requests or rejection where current policy requires it.
- Model any temporary correction access as a backend-supported, time-bounded state; never as a local unlock switch.
- Split finance-sensitive withholding detail from academic readiness.
- Confirm scheduled publication and audit fields before visualizing them.

**Focused tests:**

```text
Correction requires reason.
Before/after values do not cross tenant boundaries.
A reviewer cannot approve outside permission scope.
A parent/student cannot view unpublished or withheld internal detail.
Publishing requires confirmation and refetches result state.
```

### M4-W7 — Report Card Generation, History, and Protected Delivery

**Goal:** provide safe asynchronous generation and protected file access.

**Scope:**

```text
Generation queue
Batch detail
Partial failure list
Safe retry
Manifest/export where confirmed
Protected PDF open/download
Version/correction/regeneration history
```

**Rules:**

- Render only persisted job status; never simulate progress with client timers.
- Failures show safe user-facing categories, not stack traces, object keys, or provider messages.
- Retry only the safe backend-supported job/record scope and require reason when the route requires one.
- All protected file actions use shared authenticated helpers.
- Do not expose raw temporary URLs in components, state, copied text, logs, or tooltips.

### M4-W8 — Promotion and Grade 11-12 Readiness

**Goal:** add stage-aware promotion and board-preparation work after the P0 path is stable.

**Scope:**

```text
Promotion eligibility table
Manual promotion/hold decision
Grade 11-12 stream/program readiness
Subject-combination readiness
Practical/project completion
Board-preparation checklist
```

**Hard gate:**

```text
Confirm promotion, stream, practical/project, and board-preparation backend contracts before adding mutations or official readiness KPIs.
```

**Rules:**

- Automatic eligibility is backend truth.
- Manual decision is audited and reasoned where required.
- Feature/academic-level locked states are explicit.
- Parent/student surfaces show only final released outcome.

---

## 6. State Coverage Checklist

Every M4 slice must assess these states before review:

```text
Loading
Empty
Backend error
Validation error
Permission denied
Module locked
No active academic year
No assigned teacher scope
Draft/autosave pending/saved/failed
Marks locked
Correction window expired
Result unpublished
Result withheld
Queued job
Partial job failure
Protected file missing/expired/denied
Slow network / retry where applicable
```

---

## 7. Security, Audit, and File Checklist

```text
[ ] Every query/mutation is tenant-scoped by backend.
[ ] Teacher assignment validation is backend-enforced.
[ ] Sensitive actions use existing audit support.
[ ] Locked marks do not silently mutate.
[ ] No finance-sensitive hold details leak to unauthorized academic actors.
[ ] Parent/student results are own-record and published-only.
[ ] Report cards and evidence files use authenticated File Registry helpers.
[ ] No raw object key, provider URL, permanent signed URL, Prisma error, or stack trace appears in the UI.
[ ] Pagination/filtering are server-side for growing lists.
[ ] Background job state is persisted backend truth.
```

---

## 8. Verification Plan

Run only relevant checks after meaningful changes and report the actual outcome:

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

M4 browser verification must cover:

```text
Academic overview with unavailable summary state.
Teacher assigned-scope marks entry.
Teacher direct-route denial for unassigned marks context.
Autosave/draft success and failure.
Absent/withheld/retest state handling.
Lock/correction request/review path.
Result publishing confirmation and published-only parent/student visibility.
Report-card generation queued/partial-failure/retry path.
Protected report-card preview/download failure and success.
Promotion permission and module/level locked state.
```

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Visual work invents missing API contracts | Finish M4-W0 and label unknowns before implementation. |
| M4 overview turns into mock dashboard data | Use bounded summary contracts or explicit unavailable cards. |
| Spreadsheet grid bypasses teacher scope or locks | Keep scope and lock enforcement in backend; test direct routes. |
| CAS introduces unsupported criteria/evidence fields | Hold write UI until OpenAPI confirmation. |
| Report-card queue progress is misleading | Render persisted job state only. |
| Temporary unlock undermines marks integrity | Use audited correction workflow with expiry and re-lock only. |
| Withholding leaks finance detail | Purpose-limit presentation by role. |
| Protected PDFs become reusable raw links | Use existing protected helper components and authenticated blob flows. |

---

## 10. Progress Reporting Format

For each implementation slice, report:

```text
Current module:
Completed:
Remaining:
Risks:
Verification run:
Verification result:
Next action:
```
