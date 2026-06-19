# M4 Academics Frontend Execution Plan

**Status:** Active frontend execution plan  
**Updated:** 2026-06-19  
**Scope:** `apps/web` work for M4 Academics, Exams, CAS, Results, Report Cards, and Promotion  
**Companion design specification:** `docs/design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md`  
**Implementation status:** Planning only. This document does not claim backend, frontend, OpenAPI, Prisma, test, staging, or browser-E2E completion.

---

## 1. Purpose

This plan converts the M4 visual references into safe implementation slices. It prevents frontend redesign work from bypassing real SchoolOS contracts, tenant isolation, teacher assignment checks, audit trails, result visibility rules, and protected-file boundaries.

Before changing any M4 route, read current source and test coverage. Do not invent an endpoint, permission, enum, field, or job state to match a screenshot.

---

## 2. Mandatory Source Inspection

Before each implementation slice, inspect:

```text
apps/web/app/dashboard/academics/**
apps/web/components/academics/**
apps/web/lib/api/academics.ts and related API modules
packages/core academic types/contracts where available
apps/api/src/** academic, exam, result, report-card, and promotion controllers/services
apps/api/prisma/schema.prisma and relevant migrations
OpenAPI output and verification gate
permission catalog and entitlement mapping
existing unit, contract, API E2E, web tests, and browser E2E
shared UI primitives and protected-file helpers
```

Unverified items must be marked as:

```text
needs backend verification
needs OpenAPI confirmation
needs idempotency confirmation
needs offline sync confirmation
```

---

## 3. Current Alignment Baseline

Current repository alignment records coverage for:

```text
Academic years, classes, sections, subjects, and teacher assignments
Exam terms, components, and grading policy
Marks and batch marks
CAS
Report-card generation, correction, history, and protected PDF access
Result readiness, preview, and publish
```

Known gaps to preserve:

```text
No one bounded M4 overview contract is confirmed for all reference KPI cards.
CAS rubric, evidence, moderation, and trend DTOs need confirmation before write UI.
Report-card progress must use confirmed persisted job-state fields.
Promotion eligibility/manual decision and Grade 11-12 streams, combinations, practicals, and projects need backend/OpenAPI confirmation before full implementation.
```

---

## 4. Delivery Sequence

### M4-W0 — Contract and Route Baseline

**Goal:** record repository truth before visual changes.

1. Inventory canonical M4 routes and current workspaces.
2. Map each desired screen to existing API helper and backend controller.
3. Record each desired field as confirmed, unavailable, or needs confirmation.
4. Confirm roles/entitlements for academic admin, exam coordinator, subject teacher, class teacher, principal, parent, and student.
5. Confirm protected report-card preview/download helper path.
6. Confirm marks correction/lock/unlock behaviour and whether a time-bounded correction window exists.
7. Confirm result publishing/withholding DTOs independently from finance-only reason detail.

**Exit criterion:** no screen begins from an assumed API, permission, field, or state.

### M4-W1 — Shared M4 Composition Primitives

**Goal:** extend shared UI rather than create a parallel system.

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

- Extend or re-export existing shared primitives.
- Reuse shared error, module-locked, pagination, toolbar, confirmation, reason, and protected-file patterns.
- Do not put provider/file URL logic inside M4 components.

**Exit criterion:** every reusable primitive has loading, empty, error, permission, and locked-state behavior where relevant.

### M4-W2 — Academics Overview and Structure

**Scope:** academics overview; academic years; classes/sections; subjects; teacher assignments; streams/subject combinations only when confirmed.

- Use bounded backend fields or explicit unavailable cards.
- Do not calculate school-wide readiness from paginated marks or student lists.
- Preserve current canonical routes and deep links.
- Keep academic structure sub-tabs focused rather than building one large master-data table.

### M4-W3 — Exam Terms, Components, and Grading

**Scope:** terms, assessment components, template presets, grade scales, and policies.

- Use backend presets; do not recreate preset logic in the browser.
- Use visible weight validation, but backend validation remains authoritative.
- Archive/apply/publish/policy actions use the established confirmation, reason, and audit patterns where required.
- Grade preview displays backend outcomes where available and never becomes a client-side grade engine.

### M4-W4 — Teacher Marks Entry

**Scope:** assigned context, teacher-scope banner, marks grid, autosave/draft, mark states, validation, submit-for-review, locked read-only state.

- Confirm exact autosave, submit, batch entry, and mark-state DTOs first.
- Use an idempotency strategy when required by the backend contract.
- Do not expose bulk paste/import until validation and failure behavior are confirmed.
- Locked marks are read-only and must route to correction request.
- Preserve input after recoverable errors only within the existing supported draft/autosave model.

**Focused tests:**

```text
Assigned teacher opens permitted marks context.
Unassigned teacher is backend-denied and sees safe UI.
Autosave success and failure render correctly.
Absent/withheld/retest states follow confirmed mutual-exclusion rules.
Submit does not duplicate review request.
Locked sheet cannot be edited.
```

### M4-W5 — CAS Entry and Moderation

**Hard gate:** do not implement CAS write UI until rubric, evidence, moderation, trend, and audit DTOs are verified.

**Scope:** CAS score grid, criteria, teacher observations, evidence, moderation queue/history, safe trend display.

- Evidence files use File Registry helpers.
- Moderation writes show actor, before/after context, state, and audit history.
- Parent/student surfaces remain published-only and non-comparative.

### M4-W6 — Review, Lock, Corrections, and Result Publishing

**Scope:** review queue; locked sheets; correction detail/timeline; result readiness; publish/schedule/withhold/release.

- Corrections require reason where policy requires it.
- Any temporary correction access must be backend-supported, time-bounded, and audited—not a local toggle.
- Finance-sensitive withholding reason detail is role-limited.
- Confirm scheduled publish and audit fields before visualizing them.

**Focused tests:**

```text
Correction requires reason.
Before/after values cannot cross tenants.
Reviewer cannot approve outside permission scope.
Parent/student cannot see unpublished or finance-internal withholding detail.
Publishing requires confirmation and refetches current state.
```

### M4-W7 — Report Cards and Protected Delivery

**Scope:** generation queue, batch detail, partial failure, safe retry, manifest/export where confirmed, protected file open/download, history/correction/regeneration.

- Render persisted backend job status only; never simulate progress with timers.
- Failure UI shows safe user-facing categories, not stack traces, object keys, or provider messages.
- Retry only supported job/record scopes and require reason where the backend requires it.
- Protected file actions use shared authenticated helpers only.

### M4-W8 — Promotion and Grade 11-12 Readiness

**Hard gate:** confirm promotion, stream, practical/project, and board-preparation contracts before adding write paths or official KPI values.

**Scope:** eligibility table, manual promotion/hold, streams/programs, subject combinations, practical/project completion, board checklist.

- Automatic eligibility is backend truth.
- Manual decisions are permissioned, reasoned where required, and audited.
- Feature/academic-level locked states are explicit.
- Parent/student see final released outcome only.

---

## 5. State, Security, and File Checklist

Every M4 slice must cover:

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
Slow network/retry where applicable
```

Before review:

```text
[ ] Backend tenant scope confirmed.
[ ] Teacher assignment scope remains backend-enforced.
[ ] Sensitive action uses audit support.
[ ] Locked marks cannot silently mutate.
[ ] Finance-sensitive holding detail is restricted.
[ ] Parent/student results remain own-record and published-only.
[ ] Report cards/evidence use File Registry helpers.
[ ] No raw object key, signed URL, provider detail, Prisma error, or stack trace appears.
[ ] Growing lists are server-filtered and paginated.
[ ] Background job state is persisted backend truth.
```

---

## 6. Verification Plan

Run relevant checks after meaningful changes and report real results only:

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

Required M4 browser coverage:

```text
Academic overview unavailable-summary state.
Assigned teacher marks entry.
Direct-route denial for unassigned marks context.
Autosave/draft success and failure.
Absent/withheld/retest state handling.
Lock/correction/review path.
Publish confirmation and published-only parent/student visibility.
Report-card queued/partial-failure/retry path.
Protected PDF success and failure/denial state.
Promotion permission and module/level locked state.
```

---

## 7. Risk Register

| Risk | Mitigation |
|---|---|
| Visual work invents missing contracts | Complete M4-W0 and label unknowns before implementation. |
| M4 overview becomes mock dashboard | Use bounded summary contracts or unavailable cards. |
| Grid bypasses scope/locks | Keep enforcement in backend and test direct routes. |
| CAS exceeds available API fields | Hold write UI until OpenAPI confirmation. |
| Report-card job progress is misleading | Use persisted job state only. |
| Temporary unlock undermines integrity | Require reason, actor, expiry, re-lock, and audit. |
| Withholding leaks finance detail | Purpose-limit by role. |
| Protected PDFs become raw URLs | Use shared authenticated file helpers only. |

---

## 8. Progress Reporting Format

Use this format for every M4 implementation update:

```text
Current module:
Completed:
Remaining:
Risks:
Verification run:
Verification result:
Next action:
```
