# M1 Admissions and Student Profiles — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-20
**Module:** M1 Admissions and Student Profiles
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## Implemented Admission Workflow Decision

All supported sources create or continue one `AdmissionApplication`-backed Admission Case. The school policy selects direct admission or review; “Direct Admission” and “Admission Review” are entry choices into the same case model, not separate systems.

The default Nepal office flow is:

```text
Choose admission path
→ Student and guardian basics
→ Academic placement and optional protected documents
→ Backend eligibility, duplicate, and policy check
→ Admit Student or continue the same case through review
→ Student-profile follow-up for documents, IEMIS, guardian verification, and QR/ID
```

Confirmed routes include:

```text
/dashboard/admissions
/dashboard/admissions/new
/dashboard/admissions/cases/[admissionCaseId]
/dashboard/settings/admissions
```

Confirmed API capabilities include admission policy read/update, Admission Case create/read/update/eligibility, audited review actions, duplicate-safe direct admission, approved-case finalization, paginated business-status queues, student follow-ups, and a purpose-limited principal mobile admissions summary. Legacy application routes remain compatibility contracts; active web entry and review use the unified case routes.

---

## 1. Module Purpose

M1 manages the path from first inquiry through admission, an active student record, guardian relationships, protected documents, and later lifecycle changes.

It replaces scattered paper forms and duplicate student records with a reviewable, auditable student source of truth while keeping teachers and guardians within purpose-limited views.

For Nepal schools, it must support bilingual identity data, guardian-phone-led communication, local admission paperwork, class/section/roll conventions, transfer documentation, and IEMIS readiness.

---

## 2. Full Feature List

### Inquiry and application pipeline

**Purpose:**
Captures inquiries and moves applications through draft, submitted, review, approved, rejected, and converted states so admissions staff can see ownership and blockers.

**Users:**
Admission staff, admin, principal.

**Frontend behavior:**
A paginated pipeline/list with stage counts, assignee, missing requirements, and a selected-application drawer.

**Backend alignment:**
Backend owns lifecycle, permissible transitions, stage totals, and audit history.

### Application form and draft

**Purpose:**
Collects identity, guardian, address, previous-school, class request, medical/emergency, and document details without forcing one-session completion.

**Users:**
Admission staff and authorized applicants/staff.

**Frontend behavior:**
Sectioned form with save draft, resume, inline validation, document checklist, and submit-for-review action.

**Backend alignment:**
Persistent drafts, validation, concurrency/version rules, and submit transition are backend-owned.

### Student profile

**Purpose:**
Provides the authoritative operational view of an admitted student and current lifecycle status.

**Users:**
Admin and assigned teachers; parent/guardian sees a child-safe projection.

**Frontend behavior:**
Profile header plus personal, academic, contact, medical-warning, document, and history tabs with permission-aware fields.

**Backend alignment:**
Detail projections must be role-scoped; summary data from other modules comes from their APIs.

### Guardian management

**Purpose:**
Links verified guardians to children and controls relationship, contact, portal access, and revocation.

**Users:**
Admin and linked guardians.

**Frontend behavior:**
Guardian table, add/link form, linked-children context, portal-status badge, and unlink confirmation.

**Backend alignment:**
Backend enforces guardian-child scope and immediate access revocation.

### Duplicate review

**Purpose:**
Surfaces likely duplicate applications/students using bilingual names, DOB, phones, previous school, and sibling clues.

**Users:**
Admission reviewer and admin.

**Frontend behavior:**
Side-by-side comparison with match reasons and manual link/ignore/escalate decisions; never auto-merge.

**Backend alignment:**
Candidate scoring and merge/link semantics are backend-owned.

### Document management

**Purpose:**
Tracks required and optional identity, admission, and lifecycle documents.

**Users:**
Admission staff and admin; scoped users where allowed.

**Frontend behavior:**
Document checklist with upload, review, rejection reason, replace, open, and unavailable states.

**Backend alignment:**
Files use File Registry and backend authorization/status.

### ID card generation

**Purpose:**
Generates a school-approved student ID/QR artifact from confirmed profile data.

**Users:**
Admin and authorized school staff.

**Frontend behavior:**
Generation preview, template choice where supported, queued job status, and protected download.

**Backend alignment:**
Backend generates/version-controls artifact and QR semantics.

### Transfer certificate and lifecycle

**Purpose:**
Handles transfer, withdrawal, graduation, alumni, archive, and certificate workflows without silent history edits.

**Users:**
Admin and principal approver.

**Frontend behavior:**
Lifecycle timeline, eligibility blockers, reason/effective date form, confirmation, and protected certificate.

**Backend alignment:**
Transitions, numbering, approvals, and immutable history are backend-owned.

### Import review

**Purpose:**
Validates bulk student imports before committing accepted rows.

**Users:**
Admin and admission staff.

**Frontend behavior:**
Upload, column mapping, row-error review, duplicate warnings, partial-result summary, and retry export.

**Backend alignment:**
Backend parses, validates, deduplicates, commits, and reports per-row results.

### IEMIS readiness

**Purpose:**
Shows missing or invalid official reporting fields before export.

**Users:**
Admin and reporting staff.

**Frontend behavior:**
Blocking/warning issue table grouped by student/field with fix links and queued protected export.

**Backend alignment:**
Validation rules and export payload are backend-owned and need current policy verification.

### Parent and teacher visibility

**Purpose:**
Provides only linked-child or assigned-student profile projections.

**Users:**
Parent/guardian and teacher.

**Frontend behavior:**
Purpose-limited profile cards with no admission review, unrelated guardian, or sensitive document access.

**Backend alignment:**
Backend child-link and assignment scope must fail closed.

---

## 3. Frontend Design Direction Based on Features

Use a pipeline-to-profile workspace under the global SchoolOS app shell. Keep one primary job per route, calm white surfaces, the module accent only for location, and semantic colors for status.

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
| Admin | Tenant admissions, students, guardians, documents, lifecycle | Other tenants; unauthorized health/private fields | All M1 staff screens |
| Principal | Pipeline summaries and approved high-risk decisions | Routine edits without permission | Dashboard, review, lifecycle |
| Teacher | Assigned-student safe profile projection | Unassigned students and private documents | Scoped student profile |
| Parent | Linked-child safe profile and allowed documents | Other children and internal admission/audit detail | Parent child profile |

---

## 5. Recommended Route Map

> These are design-planning routes. Reuse current routes and names where they exist; additions or differences need OpenAPI/router confirmation.

### Admin / Staff Routes

```text
/dashboard/admissions
/dashboard/admissions/new
/dashboard/admissions/cases/[admissionCaseId]
/dashboard/admissions/applications
/dashboard/admissions/applications/[applicationId]
/dashboard/admissions/duplicate-review
/dashboard/settings/admissions
/dashboard/students
/dashboard/students/[studentId]
/dashboard/students/import-review
/dashboard/students/iemis-readiness
```

### Parent Routes

```text
/parent/children/[studentId]/profile
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Admissions Dashboard

**Purpose:**
Monitor admissions workload and move the next application safely.

**Main users:**
Admission staff, admin, principal.

**Route:**
`/dashboard/admissions` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Inquiry/application pipeline; duplicate, missing-document, and review queues.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Stage table/board with applicant, requested class, guardian phone, stage, owner, age, and blocker, and a right detail drawer for selected application summary, missing fields, duplicate risk, latest audit.

**Header actions:**
New Application; More: Import, readiness export

**Filters:**
Academic year, stage, class request, owner, date, search

**KPI cards / summary cards:**
New inquiries; submitted; pending review; duplicate warnings; converted

**Main table / list / grid:**
Stage table/board with applicant, requested class, guardian phone, stage, owner, age, and blocker

**Right drawer / detail panel:**
selected application summary, missing fields, duplicate risk, latest audit

**Forms / modals:**
Assignment/stage update; no large creation form

**Confirmations:**
Approve/reject/convert and bulk actions require review/reason

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Summary, paginated pipeline, transition eligibility, and audit contracts; needs OpenAPI confirmation.

**Protected files:**
Application documents via File Registry.

**Audit behavior:**
Stage, owner, approval, rejection, conversion, export.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 2. Application Form / Review

**Purpose:**
Create, resume, validate, and submit an application.

**Main users:**
Admission staff, admin.

**Route:**
`/dashboard/admissions/applications/[applicationId]` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Application draft; guardian data; class request; documents; review decision.

**Layout:**
Module header, filter bar where relevant, Section navigation plus identity, guardian, address, previous school, medical/emergency, class request, and document form, and a right detail drawer for review notes, duplicate candidates, document checklist, audit timeline.

**Header actions:**
Save Draft; Submit for Review / Approve when eligible

**Filters:**
None; section completion and validation summary

**KPI cards / summary cards:**
None

**Main table / list / grid:**
Section navigation plus identity, guardian, address, previous school, medical/emergency, class request, and document form

**Right drawer / detail panel:**
review notes, duplicate candidates, document checklist, audit timeline

**Forms / modals:**
Sectioned fields; guardian phone; bilingual name; DOB; address; previous school; requested class; uploads

**Confirmations:**
Submit, approve, reject, or convert require confirmation; rejection needs reason

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Draft/detail, validation, duplicate, workflow eligibility, and optimistic-concurrency contracts.

**Protected files:**
Photo and admission documents through protected upload/open controls.

**Audit behavior:**
Draft save, submit, review, approval/rejection, conversion.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 3. Duplicate Review

**Purpose:**
Resolve possible duplicate people without unsafe automatic merging.

**Main users:**
Admission reviewer, admin.

**Route:**
`/dashboard/admissions/duplicate-review` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Duplicate comparison and manual decision.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Candidate queue and side-by-side comparison of names, DOB, phones, previous school, siblings, and existing links, and a right detail drawer for match evidence, related profiles, prior decisions, audit.

**Header actions:**
Resolve Match; Mark Not Duplicate; Escalate

**Filters:**
Risk band, unresolved/resolved, class, date, search

**KPI cards / summary cards:**
Unresolved; high risk; awaiting manual review

**Main table / list / grid:**
Candidate queue and side-by-side comparison of names, DOB, phones, previous school, siblings, and existing links

**Right drawer / detail panel:**
match evidence, related profiles, prior decisions, audit

**Forms / modals:**
Decision reason and optional canonical-record selection

**Confirmations:**
Link/merge semantics require explicit confirmation and permission

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Candidate list/detail, evidence, allowed decisions, and resolution mutation.

**Protected files:**
Protected photos/documents only when role permits.

**Audit behavior:**
Every resolution, reason, actor, and before/after reference.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 4. Student Profile and Guardians

**Purpose:**
Operate one admitted student record and guardian access safely.

**Main users:**
Admin; assigned teacher projection.

**Route:**
`/dashboard/students/[studentId]` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Student profile; guardian management; document and lifecycle summaries.

**Layout:**
Module header, filter bar where relevant, Profile header with tabs for overview, guardians, documents, lifecycle, and permitted module summaries, and a right detail drawer for alerts, guardian contacts, protected files, lifecycle and audit timeline.

**Header actions:**
Edit Profile; More: Link Guardian, ID Card, Transfer

**Filters:**
Academic year; tab-local history filters

**KPI cards / summary cards:**
None

**Main table / list / grid:**
Profile header with tabs for overview, guardians, documents, lifecycle, and permitted module summaries

**Right drawer / detail panel:**
alerts, guardian contacts, protected files, lifecycle and audit timeline

**Forms / modals:**
Profile edit; guardian link/unlink; emergency/medical warning edit by permission

**Confirmations:**
Guardian unlink, sensitive edits, and lifecycle changes require reason/confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Role-scoped student detail, guardian links, summaries, allowed actions.

**Protected files:**
Photo, identity documents, certificates, and ID card via File Registry.

**Audit behavior:**
Profile changes, guardian access, sensitive fields, lifecycle actions.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 5. Import Review

**Purpose:**
Validate and commit bulk student data with row-level evidence.

**Main users:**
Admin, admission staff.

**Route:**
`/dashboard/students/import-review` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Import mapping, validation, duplicates, partial success.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Stepper for upload, mapping, validation table, commit, and result, and a right detail drawer for selected row source values, normalized preview, errors.

**Header actions:**
Upload File; Validate; Commit Valid Rows

**Filters:**
Error type, duplicate status, row, class

**KPI cards / summary cards:**
Valid; warning; blocked; duplicates

**Main table / list / grid:**
Stepper for upload, mapping, validation table, commit, and result

**Right drawer / detail panel:**
selected row source values, normalized preview, errors

**Forms / modals:**
Column mapping and default academic/class fields

**Confirmations:**
Commit and retry require exact row count confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Upload token, parsed preview, row validation, duplicate, commit job, result export.

**Protected files:**
Source file and result/error export protected by File Registry.

**Audit behavior:**
Uploader, mapping, validation, commit counts, rejected rows.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 6. IEMIS Readiness and Documents

**Purpose:**
Resolve official-reporting gaps and generate approved student artifacts.

**Main users:**
Admin, reporting staff.

**Route:**
`/dashboard/students/iemis-readiness` (planning route; reuse the current route if different).

**Main features shown on this screen:**
IEMIS readiness; ID card; transfer certificate; protected exports.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Issue table grouped by student plus generation/export job panel, and a right detail drawer for issue explanation, source field, fix link, generation history.

**Header actions:**
Export Readiness; Generate selected artifact

**Filters:**
Severity, field, class, section, lifecycle, search

**KPI cards / summary cards:**
Ready; blocking; warnings; export queued

**Main table / list / grid:**
Issue table grouped by student plus generation/export job panel

**Right drawer / detail panel:**
issue explanation, source field, fix link, generation history

**Forms / modals:**
Artifact options; transfer effective date/reason

**Confirmations:**
Exports and certificate generation require confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Readiness rules/results, fix targets, generation eligibility, job status.

**Protected files:**
IEMIS export, ID cards, transfer certificates protected.

**Audit behavior:**
Export/generation requests, versions, downloads, lifecycle evidence.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

---

## 7. Simple Wireframe Designs

### 1. Admissions Dashboard

```text
+------------------------------------------------------------------+
| Admissions Dashboard                       [New Application] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: New inquiries; submitted; pending review; duplicate w |
+------------------------------------------------------------------+
| Filters: Academic year, stage, class request, owner, date, sea |
+--------------------------------------------+---------------------+
| Stage table/board with applicant, reques | selected applicat |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Assignment/stage update; no large creation form                |
+------------------------------------------------------------------+
```

### 2. Application Form / Review

```text
+------------------------------------------------------------------+
| Application Form / Review                  [Save Draft] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| State or guidance area |
+------------------------------------------------------------------+
| Filters: None; section completion and validation summary       |
+--------------------------------------------+---------------------+
| Section navigation plus identity, guardi | review notes, dup |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Sectioned fields; guardian phone; bilingual name; DOB; address |
+------------------------------------------------------------------+
```

### 3. Duplicate Review

```text
+------------------------------------------------------------------+
| Duplicate Review                           [Resolve Match] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Unresolved; high risk; awaiting manual review         |
+------------------------------------------------------------------+
| Filters: Risk band, unresolved/resolved, class, date, search   |
+--------------------------------------------+---------------------+
| Candidate queue and side-by-side compari | match evidence, r |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Decision reason and optional canonical-record selection        |
+------------------------------------------------------------------+
```

### 4. Student Profile and Guardians

```text
+------------------------------------------------------------------+
| Student Profile and Guardians              [Edit Profile] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| State or guidance area |
+------------------------------------------------------------------+
| Filters: Academic year; tab-local history filters              |
+--------------------------------------------+---------------------+
| Profile header with tabs for overview, g | alerts, guardian  |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Profile edit; guardian link/unlink; emergency/medical warning  |
+------------------------------------------------------------------+
```

### 5. Import Review

```text
+------------------------------------------------------------------+
| Import Review                              [Upload File] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Valid; warning; blocked; duplicates                   |
+------------------------------------------------------------------+
| Filters: Error type, duplicate status, row, class              |
+--------------------------------------------+---------------------+
| Stepper for upload, mapping, validation  | selected row sour |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Column mapping and default academic/class fields               |
+------------------------------------------------------------------+
```

### 6. IEMIS Readiness and Documents

```text
+------------------------------------------------------------------+
| IEMIS Readiness and Documents              [Export Readiness] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Ready; blocking; warnings; export queued              |
+------------------------------------------------------------------+
| Filters: Severity, field, class, section, lifecycle, search    |
+--------------------------------------------+---------------------+
| Issue table grouped by student plus gene | issue explanation |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Artifact options; transfer effective date/reason               |
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
| M1 scoped widgets | pipeline, duplicate comparison, guardian, lifecycle, and readiness widgets | Create module composition | Reuse base primitives; do not fork the design system. |

---

## 9. Backend and API Alignment

> Capability names below are planning labels, not invented endpoint names. Implement with current backend/OpenAPI/shared-contract names.

### Read APIs

Confirmed unified-case reads: school admission policy; tenant-scoped case detail and eligibility; paginated business-status queues; admitted-student follow-ups; and purpose-limited principal mobile summary. Other planned summaries still need OpenAPI confirmation.

### Write / Mutation APIs

Confirmed unified-case writes: policy update, progressive case create/update, audited review actions, direct admission, and approved-case finalization. Direct/finalize commands are duplicate-safe and backend-authorized. Other planned mutations still need OpenAPI confirmation.

### Workflow APIs

Unified Admission Case review/approve/reject/escalate/close, duplicate override with permission and reason, and final conversion are confirmed. Duplicate merge, guardian link/unlink, lifecycle transitions, import commit, and artifact generation remain separate existing module commands and must not be simulated from case UI.

### Validation APIs

Bilingual identity, DOB, guardian phone, required documents, duplicate indicators, class request, IEMIS readiness. **needs OpenAPI confirmation** unless already present in the current contract.

### Report / Export Jobs

Pipeline/readiness/import-result exports and generated ID/transfer artifacts use queued jobs when appropriate. **needs OpenAPI confirmation** unless already present in the current contract.

### File Registry / Protected File APIs

Application/student documents, photos, ID cards, transfer certificates, and exports use File Registry. **needs OpenAPI confirmation** unless already present in the current contract.

### Notification Events

Admission decision, missing-document, guardian access, and lifecycle events emit normalized M12 events. **needs OpenAPI confirmation** unless already present in the current contract.

### Accounting / Finance Boundaries

M1 may display fee-admission context only through M3; it must not calculate or post money. **needs OpenAPI confirmation** unless already present in the current contract.

### Audit Logs

Application decisions, duplicate resolutions, imports, guardian access, profile/lifecycle changes, and artifact generation. **needs OpenAPI confirmation** unless already present in the current contract.

### Role-Scoped APIs

Teacher assigned-student and parent linked-child projections must not reuse admin payloads. **needs OpenAPI confirmation** unless already present in the current contract.

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
| Duplicate review required | Backend flags a possible match | Block conversion until manually resolved or policy permits | Duplicate candidate/decision state |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- Every query, job, export, and file is isolated by authenticated `tenantId`; the browser never supplies trusted tenant scope.
- Backend RBAC and module entitlement are authoritative. Hidden controls are only UX; direct calls must fail closed.
- Teacher access is assignment-scoped; parent access is linked-child scoped and revoked immediately when unlinked.
- Medical/emergency details and identity documents are field- and file-permission gated.
- No duplicate auto-merge or client-owned lifecycle transition.
- Sensitive fields are omitted or masked by permission; do not place them in table rows, URLs, logs, or analytics.
- Protected files use authenticated File Registry helpers. Never expose raw object keys, provider URLs, permanent public URLs, or storage internals.
- Audit-sensitive actions show backend actor/time/reason/history; the browser does not invent audit facts.
- Parse safe backend error envelopes. Never show raw stack traces, Prisma/provider/storage errors, secrets, or internal payloads.

---

## 12. Nepal-Specific Requirements

- Store/display Nepali and English names without treating one as optional display decoration.
- Support Nepal guardian phone formats, relationship conventions, municipality/address fields, and local previous-school details.
- Use local class/section/roll conventions and academic-year context.
- Treat IEMIS readiness as validation/export planning; current government schema needs backend verification.
- ID cards and transfer certificates must use school-approved numbering/templates and protected delivery.

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
