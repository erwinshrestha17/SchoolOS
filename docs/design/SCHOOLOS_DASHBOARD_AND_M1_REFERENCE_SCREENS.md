# SchoolOS Dashboard and M1 Reference Screens

**Status:** Approved visual-reference appendix for the 2026-06-19 principal dashboard and M1 Admissions / Student Profiles desktop screens.  
**Updated:** 2026-06-19  
**Scope:** `apps/web` desktop information architecture and interaction patterns only.  
**Canonical design rules:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the source of truth for global shell, security, File Registry, tenant/RBAC/entitlement handling, shared UI states, protected files, and web acceptance criteria.

This appendix turns the supplied dashboard and M1 screen references into implementation-ready design guidance. It does not prove that a shown number, route, role, provider, background job, field, or API endpoint already exists.

Every implementation must confirm the current NestJS controller/DTO/OpenAPI/shared-contract shape first. Mark missing contracts as:

```text
needs backend verification
needs OpenAPI confirmation
needs shared-contract confirmation
needs summary API
needs idempotency confirmation
needs File Registry confirmation
```

---

## 1. How to Use This Appendix

The reference screens establish:

- Desktop layout cadence and information density.
- Principal dashboard family and role-safe drill-through patterns.
- M1 screen hierarchy from inquiry through admission, student profile, documents, duplicate resolution, QR/ID, and iEMIS readiness.
- Right-rail responsibilities.
- Safe page transitions, filters, bulk actions, review queues, and protected-file treatment.

The reference screens do **not** authorize:

```text
Fake dashboard data
Client-owned totals or completion percentages
New backend routes without OpenAPI confirmation
Raw document URLs, object keys, permanent signed URLs, or QR credential secrets
AI/ML/LLM duplicate matching or risk scores
Unscoped student, guardian, document, or export access
Silent record merge, lifecycle mutation, or QR rotation
```

---

## 2. Shared Desktop Frame

```text
Compact topbar
+ role-aware persistent sidebar
+ title / concise purpose / primary action row
+ 3-6 context-aware KPI cards
+ tab strip where the page has distinct work areas
+ server-backed filter/search toolbar
+ primary operational workspace
+ optional right rail with a specific job
```

### 2.1 Visual and density rules

- Use the existing SchoolOS light operating-desk shell: calm blue-grey canvas, white cards, clear navy headings, subtle border hierarchy, restrained shadows, and deep-blue primary actions.
- Desktop workspaces may be dense, but each must preserve current context, readable rows, one safe primary action, and clear status labels.
- Do not make cards decorative. Each card must show a real backend-backed metric, state, next action, or an explicit unavailable/locked state.
- Use colour as a supporting semantic cue only. Every status also needs text and a shape/badge treatment.
- Use `More Actions` for secondary actions. Destructive/high-risk actions must never compete visually with the primary action.
- The right rail is not page decoration. It must have a purpose, a data state, a permission state, a close/back action, and a responsive collapse behavior.

### 2.2 Responsive behavior

| Condition | Required behavior |
|---|---|
| Desktop >= 1440px | Persistent sidebar and an optional 280-360px context rail are allowed when the rail has an active job. |
| Desktop 1180-1439px | Preserve the main task; collapse non-critical right rails into a dismissible drawer or on-demand panel. |
| Compact laptop/tablet | Stack KPI cards, place secondary filters under an expandable filter control, and use detail routes/drawers on demand. |
| High zoom/narrow table | Do not compress dense tables until unreadable. Use column priority, horizontal containment, or a full detail route. |

---

## 3. Principal Dashboard Family

The supplied principal screens form a focused dashboard family. Each page has one job and should share the same shell, school context, academic-year context, notification center, and role menu.

| Surface | Main job | Main CTA | Source/contract requirement |
|---|---|---|---|
| Principal Home | Orient principal to school health and immediate work. | Resolve top alert. | needs principal dashboard summary API |
| Attention & Approvals | Review actionable approvals, risks, recent decisions, and escalations. | Review next approval. | needs approval/attention aggregation confirmation |
| Today’s Operations | Run and monitor current school-day operations. | Open daily workflow. | needs daily-operations summary confirmation |
| Academic & Learning Snapshot | Review readiness, teaching load, homework, exams, report-card status, and controlled learning sessions. | Open academic overview. | needs academics/learning summary confirmation |
| Finance & Collections Snapshot | Review collection health and pending finance actions without bypassing financial workflows. | Open fee operations. | needs finance summary confirmation |
| School Activity & Module Summary | Orient staff to recent activity, upcoming work, enabled modules, and safe shortcuts. | Open school dashboard. | needs audit/activity/module summary confirmation |

### 3.1 Principal home

```text
Greeting + school / academic year / school-day context + top alert CTA
-> permission-filtered school KPI strip
-> Today’s Operations
-> Pending Approvals & Alerts
-> Academic & Learning Snapshot
-> Recent Activity
-> Quick Actions
-> Enabled Module Summary
```

#### Required sections

| Section | Design requirement | Security/data requirement |
|---|---|---|
| Context header | Greeting, school name, academic-year context, school-day state. | School-day state must be backend/configuration-backed, not inferred only from browser time. |
| KPI strip | Active students, present today, collected today, pending approvals, staff present, overdue fees where permitted. | Amounts, ratios, trends, and counts are server-owned. Do not render unavailable values as zero. |
| Today’s Operations | Attendance, fees, transport, canteen; one compact row/card per enabled operational module. | Each opens a real module route and only shows entitled data. |
| Pending Approvals & Alerts | Corrections, leave, discount/refund/reversal review, payroll sign-off, delayed routes, publish blockers. | Do not reveal salary/bank/financial internals without permission. |
| Academic & Learning Snapshot | Marks pending, exams, homework, live sessions, supportive learning distribution. | No ranking, AI prediction, or public comparative learning label. |
| Recent Activity | Safe, timestamped school events. | No private message body, protected-file detail, or unreadable raw audit payload. |
| Quick Actions | New admission, collect fee, create notice, review approvals, add staff, generate report. | Render only when backend permission and module entitlement permit the target action. |
| Module Summary | Enabled-module tiles with one current state and drill-through. | Locked/unavailable modules must say so; never invent a healthy zero value. |

### 3.2 Attention & Approvals

```text
Actionable alert strip
-> approval / risk KPI strip
-> pending approvals queue
-> operational alert list
-> optional backend-backed approval trend
-> recent decisions
-> escalations
```

Requirements:

- Alert strips contain only current actionable states such as unsubmitted attendance, delayed transport, or a pending final sign-off.
- The queue may show request type, safe details, requester, amount/duration only when authorized, status, and one review action.
- `Review` opens a dedicated drawer or full workflow with before/after context, required reason fields, result state, and audit history.
- Trend charts are optional and render only from a meaningful backend time series. A concise text summary replaces a missing/invalid chart.
- Escalations show category and safe summary. Chat body/content remains scope-controlled.

### 3.3 Today’s Operations

```text
Operational KPI strip
-> attendance operations
-> transport operations
-> fee collection counter
-> canteen operations
-> admissions desk
-> communication desk
-> operational timeline
-> team-on-duty summary
-> quick daily actions
```

Each card must show one live state, one safe action, and one drill-through. Examples: submitted/pending attendance classes, active/delayed trips, payment transactions/pending parent query, meals served/low-stock warning, incomplete applications, or unread follow-ups.

The operational timeline is a permission-filtered, tenant-scoped event feed ordered by server timestamp. It must only link to records the current actor can open.

### 3.4 Academic & Learning Snapshot

```text
Academic KPI strip
-> readiness progress rows
-> supportive learning distribution + subject summaries
-> today’s teaching / workload snapshot
-> homework status
-> exam and report-card readiness
-> controlled live learning sessions
-> recent academic activity
```

- Every progress row shows a defined numerator/denominator or `Not available yet`.
- Use only supportive learning labels: `Needs Practice`, `Improving`, `Ready`, `Strong`.
- Teacher workload is a planning aid, not a performance verdict.
- Principal sees permitted summaries. Teachers continue to use assigned-scope marks, homework, timetable, and learning workspaces.

### 3.5 Finance & Collections Snapshot

```text
Collection KPI strip
-> daily collection trend + payment-method breakdown
-> pending finance actions
-> recent receipts
-> overdue follow-up segments
-> cashier/counter status
-> finance quick actions
-> finance alerts
```

- This is a read/triage view for a principal unless finance permissions allow deeper work.
- Do not bypass the confirmed payment, receipt, refund/reversal, cashier close, reconciliation, and audit lifecycle.
- Any chart or payment-method breakdown uses backend Decimal/numeric totals. The browser never becomes the financial truth source.
- Do not show bank account, payroll, or accounting journal detail simply because a finance summary is allowed.

### 3.6 Dashboard loading and failure behavior

- Render the shell/header immediately and load independent sections with local skeletons.
- One failed summary must not blank the dashboard; display a section-level safe error and retry.
- Module locked, missing summary, and permission states must be distinct from a genuine zero.
- Re-check scope after session refresh. Do not leave a previously allowed summary in view after a permission change.
- Dashboard actions must open actual module workflows with preserved filter context when a safe URL representation exists.

---

## 4. M1 Information Architecture

M1 covers admissions, active student records, guardians, protected documents, deterministic duplicate review, QR/ID credentials, and iEMIS readiness.

```text
Inquiry / application
-> verification
-> interview / assessment when enabled
-> review and decision
-> approved admission
-> active student record
-> guardians, documents, QR/ID, lifecycle and reporting readiness
```

### 4.1 M1 route map

These are design targets only; reconcile them with the current app/router and OpenAPI before implementation.

```text
/dashboard/admissions
/dashboard/admissions/new
/dashboard/admissions/[applicationId]
/dashboard/students
/dashboard/students/[studentId]
/dashboard/students/[studentId]/documents
/dashboard/students/duplicates
/dashboard/students/qr
/dashboard/students/iemis
```

### 4.2 M1 shared rules

- All lists use server-side filtering, sorting, pagination, and total metadata.
- Student/application selection persists across a detail rail only while the record remains authorized and matches the current filter context.
- `Save Draft` means server-persisted draft only. A local unsaved form is clearly labelled and must never be represented as a saved application.
- Student, guardian, health, address, document, and QR data must be permission-filtered. Class/subject teachers must not receive unrelated student records.
- All document preview/download actions use File Registry authenticated helpers.
- Status changes, approval/rejection, archive/transfer, guardian-link removal, duplicate merge, QR rotation/revoke, import execution, and export generation are audited.
- A screen may show a file count/status but cannot expose raw storage keys, permanent URLs, token hashes, or private file metadata to unauthorized roles.

---

## 5. Admissions & Student Profiles Workspace

### 5.1 Admissions & Student Profiles overview

```text
Header: Admissions & Student Profiles
Primary action: New Admission
Secondary action: More Actions
KPI strip: active students, pending applications, missing documents,
duplicate candidates, iEMIS issues, active QR credentials
Tabs: Students | Admissions | Documents | Duplicates | iEMIS | QR / ID Cards
Filters: search, class, section, lifecycle/status, admission status, document state
Main: paginated student table
Right rail: selected student quick context
```

#### Student table

Recommended visible columns:

```text
Photo / Student name
Admission number
Class / Section
Guardian / relationship
Contact number only where permitted
Lifecycle status
Document status
QR state
Actions
```

The right rail may show identity, guardian summary, document checklist, QR status, and a `View Full Profile` action. It must not substitute for the full student profile and must not expose unrelated cross-module content.

### 5.2 Admissions Pipeline

```text
Header: Admissions Pipeline
Primary action: Create Application
Secondary actions: Import Applications | Export
KPI strip: new, under review, interview scheduled, approved, rejected, incomplete
Pipeline tabs: New | Verification | Interview | Approved | Rejected | Waitlist
Filters: academic year, class applied for, source, status, date range, search, saved view where supported
Main: paginated application list
Right rail: application summary, notes, missing items, next actions
```

#### Pipeline requirements

- Pipeline stages are backend states, not local Kanban labels. The transition contract, allowed roles, prerequisite checks, and audit rules need backend/OpenAPI confirmation.
- Do not include a `Waitlist` stage until it is supported by lifecycle policy and contracts; otherwise show only implemented stages.
- Application completeness must be server-derived from required field/document rules and current academic-year/school policy.
- Application source is a controlled enum/configured field. Do not accept unchecked user-provided source labels as reporting truth.
- Saved views are user-scoped preferences only if persisted safely and tenant/permission-aware; otherwise do not present them as saved server views.
- `Schedule Interview`, `Send Message`, and `Update Status` actions must respect M10/provider/calendar/quiet-hour readiness. Mark as needs backend confirmation when unavailable.

### 5.3 New Admission Wizard

```text
Breadcrumb + New Admission header
-> server-backed stepper
-> Student details
-> Guardian details
-> Address
-> Academic details
-> Medical / emergency details
-> Documents
-> right-side application summary / draft progress / document checklist / internal notes
-> Cancel | Save Draft | Submit Application
```

#### Required behavior

- Step status is explicit: not started, in progress, complete, validation error, blocked by missing data.
- The form preserves safe input after recoverable errors. It does not silently retain sensitive information in unsafe browser storage.
- `Save Draft` calls an explicit draft endpoint and returns a draft identifier/status only after confirmed backend persistence.
- File fields use the File Registry upload flow; uploaded file state includes queued/uploading/available/failed/missing/permission denied where relevant.
- Required documents depend on school policy, applicant class/level, transfer status, and any configured admission requirement. Do not hard-code a universal Nepal document list.
- Medical/emergency fields are sensitive. Show only to authorized roles and avoid exposing them in list/summary cards.
- Submit must run server validation, duplicate-candidate checks, audit creation, and an explicit success/error result. It must be duplicate-safe if the user retries.

### 5.4 Application Review & Decision

```text
Application identity + status + completeness + timeline
Tabs: Application Details | Documents | Checklist | Review & Decision | Activity Timeline
Main: student / guardian / academic history / assessment / checklist / documents / comments
Right rail: interview details, score summary, missing items, reviewer notes,
decision selection, decision date, notification choice, approval history
```

#### Review rules

- The review screen is a workflow, not a profile read-only page. It must show current application state, allowed next actions, and a complete audit trail.
- Scores must be schema/configuration-backed. Never assume every school uses the same admission assessment formula or 100-point scale.
- Missing documents/items are generated from policy-backed requirements; they are not manually inferred from UI fields.
- Approval, rejection, request-changes, and waitlist decisions require backend-authorized transition rules, optional/required reason policy, and audit entries.
- Applicant/guardian notification is a separate provider delivery workflow. A successful decision change must not be displayed as a successfully delivered message.
- Review notes must distinguish internal reviewer notes, counselor notes, and system-generated audit notes. Parent/guardian visibility is explicit and fail-closed.

### 5.5 Student Directory

```text
Header: Student Directory
Primary action: Add Student
Secondary actions: Bulk Import | Export Directory | More
KPI strip: total, active, inactive, new this month, missing documents, transfer requests
Filters: search, class, section, lifecycle status, house where configured, transport state, document state
Main: paginated directory table
Right rail: selected student identity, contact/guardian, academic information,
document summary, QR/ID state
```

- `Bulk Import` uses a validated import workflow, a review/preview step, partial-failure reporting, and audit logs. It must not directly insert unchecked rows.
- Directory export is permission-scoped, queued where necessary, retained as a File Registry artifact, and downloaded with a protected helper.
- House/transport fields appear only when those features are configured and the actor may see them.
- Transfer requests are lifecycle actions; completion requires policy/permission/audit and preserves linked historical records.

### 5.6 Student Profile

```text
Student identity hero + lifecycle status + profile actions
Tabs: Overview | Guardians | Academics | Attendance Snapshot | Fees Snapshot |
      Documents | Activity Timeline | Notes
Main: permission-filtered personal/contact/health/address/guardian/sibling data
Right rail: profile summary, alerts/reminders, safe quick actions, QR state
```

#### Profile rules

- Use a full-page profile for full lifecycle and cross-module context; use the rail only for quick context.
- Attendance/fees/activity snippets are permission-filtered summaries with real drill-through. Do not deep-fetch every module by default.
- Health information is restricted to authorized staff; it must not appear in a generic selected-record rail, global search, or casual activity feed.
- Sibling links are tenant-scoped relationship views. Do not infer siblings from surname/guardian name in the browser.
- Profile actions such as edit, transfer, archive, print ID, view QR, send guardian message, add note, and create reminder each require real permission/contract confirmation.

### 5.7 Student Documents & Guardians

```text
Student header + linked guardian cards
Primary action: Upload Document
Secondary actions: Request Missing | Download Checklist
Tabs: Document Checklist | Document Vault | Requests | eSign Consent where implemented
KPI strip: required, verified, pending, missing, expiring soon, rejected
Main: document table
Right rail: selected protected document preview, detail, audit history, request status
```

#### Document and guardian rules

- Every uploaded file follows feature module -> FileRegistryService -> StorageService -> StorageAdapter.
- Preview/download/print opens only through authenticated protected-file helpers. Never render a raw object URL or permanent signed URL.
- Document checklist requirements are policy/class/lifecycle-aware and server-derived.
- `Request Missing` must create a tracked request with recipient scope and M10/provider state. It is not merely a client-side reminder.
- Verification/rejection/expiry actions are role-gated, reason/audit-backed where policy requires, and preserve previous version/history.
- `eSign Consent` appears only after consent contract, legal copy, provider mode, guardian scope, signature retention, and audit behavior are confirmed.
- Guardian cards show only permitted contact/relationship data. Removing/replacing a guardian link immediately changes parent authorization on the backend.

### 5.8 Duplicate Candidates and Merge Review

```text
Header: Duplicate Candidates
Primary actions: Merge Selected | Mark Not Duplicate
Filters: source, applied class, match score, lifecycle/status
Main: deterministic candidate-pair comparison and field-level match/conflict view
Right rail: choose primary record, resolve conflicts, post-merge options, audit data
```

#### Duplicate rules

- The reference visual label `AI Similarity Breakdown` is not approved for SchoolOS. Use `Match Breakdown` or `Duplicate Match Factors` unless a future M11 approval explicitly authorizes an AI runtime and user-facing claim.
- Candidate matching may use deterministic, explainable factors such as exact normalized name, date of birth, guardian/contact, admission/reference number, and address similarity. The backend owns the score and factor output.
- Merge requires choosing the primary record, resolving conflicting field values, previewing the impact, confirming any document/history linkage policy, and recording reviewer/reason/timestamp.
- A merge cannot silently drop documents, guardian links, attendance, fees, report cards, learning history, QR credentials, or audit evidence.
- `Mark Not Duplicate` is a deliberate reviewer decision with audit and safe future re-evaluation behavior. It must not erase the underlying records.
- Guardian notification after merge is optional, separate from the merge transaction, and requires approved communication scope/provider state.

### 5.9 QR / ID Cards

```text
Header: QR / ID Cards
Primary action: Generate QR
Secondary actions: Bulk Print ID Cards | Rotate Codes | Deactivate | More
KPI strip: active cards, pending prints, rotated, inactive, scan events
Tabs: QR Cards | ID Cards | Print Queue | Scan History | Settings
Filters: search, class, section, QR state, card/print state
Main: paginated card list
Right rail: protected QR/card preview, print settings, generation details, recent safe scan log
```

#### QR and ID rules

- QR/ID material is a protected credential. The UI may render an authorized QR/card preview but must not expose raw credential tokens, token hashes, or a public resolver URL.
- Generate, bulk print, rotate, revoke/deactivate, and download/print actions require permission, confirmation where high impact, audit, and server-confirmed lifecycle state.
- Rotation/revocation must invalidate prior credentials according to backend policy and fail closed at resolve time.
- Print queues and generated card/PDF artifacts are job/file states: queued, processing, completed, failed, unavailable. Use protected File Registry downloads.
- Scan history is tenant-scoped and intentionally minimal: time, authorized location/reader label where policy permits, and outcome. Do not turn it into unrestricted surveillance data.

### 5.10 iEMIS Readiness, Import, and Export

```text
Header: iEMIS Readiness
Primary action: Run Validation
Secondary actions: Export iEMIS CSV | Import Students | Download Errors
KPI strip: ready records, validation errors, missing fields, duplicate rows,
last export, import jobs
Tabs: Readiness | Validation Issues | Import Jobs | Export History | Mapping
Main: validation issue table and import-job table
Right rail: export checklist, error breakdown, latest protected export
```

#### iEMIS rules

- Treat iEMIS as a reporting-readiness workflow, not a static export button.
- Validation must run against a versioned requirement/mapping configuration and returns severity, affected field, record scope, state, and safe fix/drill-through target.
- Running validation and generating a large export are background-job workflows when appropriate; UI states are queued, processing, completed, failed, partial failure, expired/unavailable artifact.
- Imports must provide file validation, mapped column preview, row-level error summary, duplicate handling policy, idempotency/retry behavior, and an audited result. A failed/partial import cannot silently leave uncertain data state.
- Error downloads and generated exports are protected File Registry artifacts; checksum or internal identifiers must not be treated as a public file link.
- Mapping configuration is tenant/school configuration only where supported. It must not let browser state redefine official export criteria.

---

## 6. M1 State Matrix

| Area | Required states |
|---|---|
| Application | draft, new/submitted, verification, interview scheduled, under review, approved, rejected, waitlisted where supported, incomplete, withdrawn where supported, archived where supported |
| Draft | local unsaved, saving, saved server draft, save failed, stale/conflict where supported |
| Interview/assessment | not required, pending scheduling, scheduled, completed, missed/cancelled where supported |
| Review decision | ready, blocked by missing requirements, pending decision, approved, rejected, request changes, waitlisted where supported |
| Student lifecycle | applicant, active, transferred, withdrawn, graduated, archived, alumni where enabled |
| Guardian link | active, pending verification, removed, replaced |
| Document | required, uploading, uploaded, pending verification, verified, rejected, missing, expiring soon, expired, unavailable |
| Duplicate candidate | pending review, merged, ignored/not duplicate, merge blocked, merge failed |
| QR / ID credential | active, print queued, print ready, rotated, revoked/deactivated, expired, unavailable |
| iEMIS import/export | draft/uploading, validating, queued, processing, completed, partial failure, failed, artifact unavailable |

All state labels must come from defined backend contracts. Where an existing backend uses different enum names, the UI maps them through typed feature adapters without inventing a second source of truth.

---

## 7. M1 API and Contract Checklist

Before coding the reference screens, confirm the following contracts rather than inventing routes:

| Work area | Required API/DTO behavior | Status |
|---|---|---|
| Admissions overview | Counts, tabs, server list/filter/sort/pagination, selected application/student context. | needs OpenAPI confirmation |
| Application draft/wizard | Draft create/update, per-step validation, upload association, duplicate-safe submit. | needs idempotency confirmation |
| Pipeline | Stage enum, allowed transition actions, status counts, filters, saved-view behavior if any. | needs backend verification |
| Application review | Review fields, scoring schema, notes, interview data, decision transition, audit timeline. | needs backend/OpenAPI confirmation |
| Student directory/profile | Purpose-limited list/detail DTOs and permission-filtered related summaries. | needs DTO/scope confirmation |
| Guardians/documents | Relationship management, document checklist/vault/request, version/audit, protected preview. | needs File Registry confirmation |
| Duplicate review | Explainable factor results, merge preview, conflict resolution, transactional merge, audit. | needs duplicate-service and idempotency confirmation |
| QR/ID | Generate/rotate/revoke, card/print queue, scan history, protected preview/download. | needs credential/print contract confirmation |
| iEMIS | Validation, mapping, import job, export job, error/export artifact. | needs reporting/import-job confirmation |
| Dashboard drill-through | Principal summaries route to permitted current module state. | needs aggregation contract confirmation |

---

## 8. M1 Browser E2E Priorities

```text
Admissions overview
- tenant-scoped filtered list
- selected application/student rail
- no data leak when a record becomes unauthorized

New admission
- server-backed draft save/reload
- required document / validation state
- duplicate-safe submit
- protected file upload failure/retry

Application review
- missing-item block
- request change / approve / reject permission and reason behavior
- interview/notification state separated from decision state

Student directory and profile
- server pagination/filtering
- assigned-scope denial for teacher
- health/guardian data hidden for unauthorized actor
- profile action permission treatment

Documents and guardians
- protected document preview/download
- missing-document request tracking
- guardian removal immediately blocks parent route

Duplicates
- deterministic match breakdown only
- primary record selection / conflict preview
- merge requires confirmation and audit
- mark-not-duplicate audit behavior

QR / ID
- rotate/revoke invalidates previous credential
- print/export job state
- scan history scope

 iEMIS
- validation issue drill-through
- partial import failure summary
- protected error/export download
- queued/failed job states
```

---

## 9. Risks and Non-Goals

| Risk | Required mitigation |
|---|---|
| Screens become fake dashboards | Use real summary/list APIs or show unavailable state. |
| Student/guardian leakage in rails | Backend tenant/RBAC/scope checks; stale-panel clearing after selection/session changes. |
| Wizard draft confused with persisted record | Explicit server draft state; no fake client-only completion. |
| Duplicate merge destroys history | Transactional backend merge preview, confirmation, audit, preservation of linked history. |
| Screenshot label implies AI | Use deterministic `Match Breakdown`; M11 remains roadmap only. |
| QR/card material exposed | Authenticated preview/print helpers; no raw token/object URL. |
| iEMIS import corrupts records | Validated background job, idempotency/retry policy, partial failure report, audit. |
| Parent notification confused with decision | Separate decision success from provider delivery state. |
| Health/private fields appear in generic UI | Permission-scoped DTOs and safe empty/denied states. |
| Large export blocks browser | Queued job + protected artifact lifecycle. |

---

## 10. Implementation Boundary

This appendix is documentation only. It does not:

```text
claim a production-ready dashboard or M1 implementation
claim a screen/API/provider/job is already implemented
authorize a new M1 stage, score formula, calendar, e-sign, or saved-view contract
approve an AI duplicate detector or M11 runtime
replace tenant isolation, RBAC, module entitlement, audit, File Registry,
financial idempotency, OpenAPI verification, browser E2E, staging smoke,
or real school workflow validation
```

Before implementing any referenced screen, inspect the touched web route/components, API client helper, NestJS controller/DTO, OpenAPI output, shared contracts, role/permission definitions, File Registry path, audit service, existing tests, and module entitlement behavior.