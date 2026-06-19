# SchoolOS Functional Requirements Specification 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school operating SaaS  
**Target schools:** Kindergarten / Montessori to Grade 12 as the long-term product direction; current implementation remains staged around controlled pilot readiness for existing core modules  
**Document type:** Functional Requirements Specification  
**Status:** Active FRS aligned with KG-12 product direction, M12 Learning Layer implementation foundation, and planned M13 Inventory & Asset Management  
**Last updated:** 2026-06-19

---

## 1. Purpose

This FRS breaks SchoolOS into feature-level functional behavior. It describes what each module must allow users to do, what validations must happen, what states must be supported, and what acceptance criteria must be satisfied.

The PRD remains the product master document. This FRS is meant for developers, QA, designers, and implementation agents who need detailed feature behavior.

Important distinction:

```text
Current core = broad implemented management foundation with remaining seed, browser, mobile, staging, provider, and pilot verification gates
KG-12 expansion = staged product direction
M12 Learning Layer = backend, web runtime, parent/student web summary, and Flutter summary foundation implemented locally; AI/adaptive/simulation depth remains staged
M13 Inventory & Asset Management = planned module; detailed product/design/implementation docs exist but code/contracts/migrations/tests are not yet proven
```

The dashboard and M1 desktop reference screens are documented in the supporting design appendix:

```text
docs/design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md
```

M13 Inventory & Asset Management details are documented in:

```text
docs/product/M13_INVENTORY_ASSET_MANAGEMENT.md
docs/design/modules/M13_INVENTORY_ASSET_FRONTEND_REFERENCE.md
docs/implementation/M13_INVENTORY_ASSET_IMPLEMENTATION_PLAN.md
```

These appendices and module-specific references do not override this FRS, the canonical web design plan, backend contracts, OpenAPI, tenant isolation, RBAC, module entitlement, File Registry, audit, or financial/idempotency rules.

---

## 2. Functional Requirement Format

Each module follows this structure:

1. Purpose.
2. Primary actors.
3. Core functions.
4. Key states.
5. Validation rules.
6. Edge cases.
7. Acceptance criteria.

---

## 3. Global Functional Rules

These rules apply to every module:

1. Every tenant-owned action must be scoped to the authenticated tenant.
2. Parent users can only access linked child records.
3. Student users can only access their own allowed records.
4. Staff users can only perform actions allowed by role and permission.
5. Platform override must require reason and audit.
6. Sensitive files must be accessed only through protected File Registry flows.
7. Money-related actions must be idempotent.
8. Reversals must require permission, reason, and audit.
9. Background jobs must re-check tenant, feature, entity, and permission state before executing.
10. Disabled/mock provider modes must be explicit in the UI.
11. Learning activity/session data must be tenant-scoped and must not duplicate core student, teacher, class, subject, parent, file, notification, or audit systems.
12. Teacher-created learning content must be limited to assigned class/section/subject unless an explicit admin permission allows broader curriculum management.
13. Student learning session access must fail closed when session, class, section, tenant, feature, or school-only policy validation fails.
14. Parent learning summaries must be child-scoped, non-comparative, and free from public ranking.
15. Dashboard and summary surfaces must use permission-filtered backend responses; a browser must not calculate official attendance, financial, payroll, accounting, inventory, asset, readiness, or delivery totals.
16. A missing, locked, unauthorized, queued, failed, partial-failure, or unavailable summary must remain distinct from a genuine zero state.
17. Screen actions must resolve into a real permitted workflow. A dashboard card, right rail, quick action, or contextual button must not simulate a backend state in browser-only production state.
18. Any user-visible aggregate that spans modules must be explicitly approved as a server-owned summary or consist only of separately authorized, non-official safe summaries.
19. Inventory stock movement, purchase receive, issue/return, transfer, adjustment, stocktake adjustment, maintenance completion, and asset write-off/disposal must be idempotent, permission-gated, tenant-scoped, and audited.
20. Inventory/accounting handoff must not bypass M9 Accounting posting, reversal, fiscal locks, or snapshots.

### 3.1 Principal dashboard and operating-desk requirements

SchoolOS web must provide a role-aware operating desk rather than a generic shortcut dashboard.

Principal/authorized-admin dashboard functions may include:

1. View permission-filtered school health summary.
2. View attention items and pending approvals.
3. Drill into daily operations: attendance, fees, transport, canteen, admissions, communication, and inventory where enabled.
4. View safe academic readiness, homework, report-card, and controlled-learning summaries.
5. View safe collection/overdue/cashier summaries where finance permissions allow.
6. View safe inventory/asset summaries where M13 permissions allow.
7. View permission-filtered recent activity and upcoming/scheduled work.
8. Use role-safe quick actions that open existing workflows.
9. View module state only for enabled/entitled modules.

Dashboard validation rules:

1. The dashboard must not expose private message bodies, raw protected-file details, salary/bank data, accounting journals, vendor bill details, asset write-off documents, or unavailable module data solely because a principal summary exists.
2. The school-day/open status must come from configured/calendar-backed backend context where it is shown; it must not depend only on browser time.
3. Charts render only when the backend returns valid, meaningful time-series data. A text summary replaces an absent series.
4. A dashboard alert, KPI, queue item, or quick action must check current role, permission, tenant, module entitlement, and record scope again when opened.
5. Financial cards, inventory valuation, stock totals, and payment-method breakdowns use backend Decimal/numeric values. The UI must not calculate authoritative totals.
6. Dashboard failure of one section must not blank independent successful sections.

---

## 4. KG-12 Scope Rules

SchoolOS must support staged configuration by school level:

```text
Kindergarten / ECD / Montessori
Grade 1-3
Grade 4-5
Grade 6-8
Grade 9-10
Grade 11-12
```

### 4.1 School-level configuration

The platform should allow a tenant to configure which levels it offers:

```text
ECD / Kindergarten enabled
Grade 1-5 enabled
Grade 6-8 enabled
Grade 9-10 enabled
Grade 11-12 enabled
Streams/programs enabled where applicable
Learning Layer enabled where applicable
Inventory & Asset Management enabled where applicable
```

### 4.2 Grade 11-12 extension

Grade 11-12 support should add, when implemented:

```text
streams/programs
subject combinations
practical/lab components
project components
advanced assessment policies
board exam preparation workflows
career/counselling notes
```

### 4.3 Stage-aware UI

Dashboards should not show every feature to every school level. For example:

```text
Kindergarten dashboard: attendance, pickup/drop, meal notes, milestones, parent updates, board activities
Primary dashboard: attendance, homework, subjects, basic learning, parent communication
Lower secondary dashboard: timetable, homework, subject practice, projects, lab sessions
Secondary dashboard: exams, report cards, SEE prep, topic mastery
Higher secondary dashboard: streams, subject combinations, practicals, projects, advanced labs
```

Inventory and asset screens should also adapt to school size and plan. A small school may start with item catalogue, purchases, stock, and asset register. A larger school may need stores, departments, stocktake, maintenance, vendor comparison, and M9 accounting handoff.

---

## 5. M0 Platform Core / SaaS Foundation

### 5.1 Purpose

Manage tenants, platform administration, feature controls, provider readiness, queues, File Registry, API keys, SaaS billing records, support override, onboarding, audit workflows, KG-12 school-level settings, and module entitlement.

### 5.2 Primary actors

- SchoolOS Platform Operator.
- Platform Admin.
- Support Operator.

### 5.3 Core functions

1. View tenant list.
2. View tenant detail.
3. Suspend tenant with reason.
4. Activate tenant with reason.
5. Manage plans and feature flags.
6. Manage tenant subscriptions and feature overrides.
7. View usage counters.
8. Create platform API key.
9. Display API key secret only once.
10. List masked API keys.
11. Revoke API key.
12. Configure provider settings with secret masking.
13. Run provider readiness checks.
14. View queue health.
15. Inspect failed jobs.
16. Retry failed jobs with audit.
17. View File Registry entries and report export history.
18. Use support tenant override with reason and expiry/time-bound behavior where possible.
19. View platform audit logs.
20. View onboarding checklist and platform health summary.
21. Configure school level coverage: ECD, primary, lower secondary, secondary, Grade 11-12.
22. Enable/disable M12 Learning Layer per tenant/plan.
23. Configure school-only learning policies and later learning usage limits.
24. Enable/disable M13 Inventory & Asset Management per tenant/plan when implemented.

### 5.4 Key states

- Tenant: active, suspended, archived.
- Feature: enabled, disabled, overridden.
- Provider: disabled, dev-log, mock, configured, misconfigured.
- API key: active, revoked.
- Queue job: waiting, active, completed, failed, retried.
- File registry entry: available, missing, failed, archived.
- Learning feature: disabled, enabled, pilot, suspended.
- Inventory feature: disabled, enabled, pilot, suspended.

### 5.5 Validation rules

1. Tenant suspend/activate requires reason.
2. Support override requires explicit tenant and reason.
3. API key secret must never be shown after creation.
4. Provider secret values must be masked.
5. Queue retry must be blocked for archived tenant or disabled feature.
6. Disabled feature routes must fail closed.
7. Learning routes must fail closed when M12 is disabled or plan-locked.
8. Inventory routes must fail closed when M13 is disabled or plan-locked.
9. School-level/stream/module configuration changes must be audited.

### 5.6 Acceptance criteria

1. Every platform override action is audited.
2. Suspended tenants are blocked across dashboard, API, mobile, jobs, downloads, reports, inventory, and learning sessions.
3. Disabled provider mode never pretends to send real notifications, payments, storage actions, inventory jobs, or learning delivery actions.
4. API keys are stored hashed and only shown once during creation.
5. File and queue failure screens show safe, non-secret diagnostics.

---

## 6. M1 Admissions and Student Profiles

### 6.1 Purpose

Manage student lifecycle from inquiry/application to active, transferred, withdrawn, graduated, archived, or alumni state where enabled, including guardians, protected documents, deterministic duplicate review, QR/ID credential lifecycle, and iEMIS reporting readiness.

### 6.2 Primary actors

- School Admin.
- Principal.
- Admission Officer where configured.
- Authorized reviewer/interviewer/counselor where configured.
- Teacher with limited assigned-scope access.
- Parent/Guardian with child-scoped access only.

### 6.3 Core functions

1. Create inquiry/application.
2. Create, reopen, and server-save application draft where supported.
3. Capture student, guardian, address, academic, medical/emergency, and document information according to tenant admission policy.
4. Validate required application fields/documents and calculate completeness from backend rules.
5. Move an application through supported stages such as new, verification, interview, under review, approved, rejected, or waitlist where policy and contracts support them.
6. Schedule/reschedule interview or assessment only where an approved contract and role permission exist.
7. Capture reviewer notes, assessment data, missing-item requests, and an audited decision.
8. Convert approved application to student admission.
9. Create and edit student profile.
10. Manage guardian details, relationship, verification, replacement, and removal.
11. Assign class, section, roll number, academic year, and later configured academic/stream properties.
12. Upload student photo and protected documents through File Registry.
13. View document checklist, vault, request state, verification state, audit history, and expiry state where supported.
14. Generate student QR credential.
15. Rotate, revoke, deactivate, print, and view authorized QR/ID-card artifacts.
16. Detect duplicate student/application candidates through deterministic, explainable backend factors.
17. Review candidate pair, select primary record, resolve conflicts, and perform audited merge where allowed.
18. Mark candidate as not duplicate with audit where supported.
19. Search applications/students with server-side filtering, sort, pagination, and scope enforcement.
20. View application, student lifecycle, document, QR, and safe activity history.
21. Maintain iEMIS/export readiness fields.
22. Run readiness validation, view validation issues, import jobs, export history, and mapping status where supported.
23. Create protected error/export artifacts for authorized users.
24. Transfer, withdraw, graduate, archive, or reactivate according to policy.
25. Support KG-12 student classification: ECD, primary, lower secondary, secondary, Grade 11-12 where enabled.
26. Support later Grade 11-12 stream and subject-combination assignment through Academics.

### 6.4 Key states

- Application: local unsaved, draft, submitted/new, verification, interview scheduled, under review, approved, rejected, waitlisted where supported, incomplete, withdrawn where supported, archived where supported.
- Application decision: ready, blocked by missing requirements, pending decision, request changes, approved, rejected, waitlisted where supported.
- Interview/assessment: not required, pending scheduling, scheduled, completed, missed/cancelled where supported.
- Student lifecycle: applicant, active, transferred, withdrawn, graduated, archived, alumni where enabled.
- QR credential: active, print queued, print ready, rotated, revoked/deactivated, expired, unavailable.
- Document: required, uploading, uploaded, pending verification, verified, rejected, missing, expiring soon, expired, unavailable, archived.
- Guardian link: active, pending verification, removed, replaced.
- Duplicate candidate: pending review, merged, ignored/not duplicate, merge blocked, merge failed.
- iEMIS import/export: validating, queued, processing, completed, partial failure, failed, artifact unavailable.

### 6.5 Validation rules

1. Admission number must be unique within tenant where policy requires.
2. Same admission number cannot be created concurrently.
3. Draft status may only be shown after explicit server persistence. Recoverable local form state must be visually distinct from a saved draft.
4. Required application fields/documents must come from configured admission policy, applicant class/level, transfer status, and current academic-year context; do not hard-code one universal checklist.
5. Application stage transitions must be backend-authorized, role-aware, tenant-scoped, audited, and validated against prerequisite requirements.
6. Application completeness, missing items, and readiness counts must be backend-derived. The browser must not infer them from currently visible fields.
7. Reviewer score components, assessment rules, and decision formulas must be tenant/configuration-backed where used. Do not assume every school follows the same 100-point scheme.
8. Application decision and parent/guardian notification are separate states. A successful approval/rejection does not imply delivery success.
9. Duplicate candidates must be shown before risky merge actions.
10. Duplicate matching must be explainable and deterministic unless M11 is explicitly approved later. UI labels must use `Match Breakdown` or equivalent, not `AI Similarity Breakdown`.
11. Merge must require primary-record selection, conflict resolution, impact preview, confirmation, reason where policy requires, transactional backend behavior, and audit.
12. Merge must preserve or explicitly resolve linked documents, guardians, attendance, fees, report cards, learning history, QR credentials, and audit evidence. It must not silently discard linked data.
13. Parent access must be revoked immediately when guardian linkage is removed.
14. QR resolve must fail for revoked, rotated, or expired credentials.
15. QR/card previews, print queues, exports, documents, and iEMIS artifacts must use protected File Registry flows; no raw credential token, object key, permanent URL, or private storage path may be shown.
16. QR generate/rotate/revoke/deactivate and bulk print must be permission-gated and audited; rotating/revoking invalidates prior credentials according to backend policy.
17. iEMIS validation/export/import must use versioned backend rules/mapping. Imports require file validation, mapped-column preview, row-level error summary, duplicate policy, retry/idempotency policy, and auditable outcome.
18. Partial or failed import/export job state must be explicit; it must never leave an ambiguous apparent-success state.
19. Student lifecycle change must preserve historical attendance, fees, report cards, files, learning history, and accounting links.
20. Same student name in another tenant must not affect local student search, duplicate candidate handling, merge, QR, document, import, or export behavior.
21. Health/emergency data must be restricted to authorized roles and must not appear in generic lists, search results, or detail rails.
22. Sibling/house/transport/etc. contextual fields appear only if configured and authorized; the browser must not infer relationships from surname, address, or guardian name.

### 6.6 Edge cases

1. Double-click/retry on application submit must not create duplicate application/admission records.
2. A user loses permission or tenant/module access while an application, student, document, QR card, or export panel is open.
3. A previously selected record becomes filtered out, archived, merged, deleted/soft-deleted, or no longer authorized.
4. A file upload succeeds but File Registry association fails, or an association succeeds but protected preview is unavailable.
5. A document requirement changes after a draft was saved.
6. An interview is cancelled/rescheduled after review work begins.
7. A decision is recorded but notification delivery is delayed, duplicated, failed, or out of order.
8. A duplicate merge request is stale because a linked record changed after the review was opened.
9. A QR print/export job is queued but the record is rotated/revoked before the artifact is downloaded.
10. An iEMIS import completes partially; the UI must identify succeeded/failed rows and safe next steps without treating the whole job as clean success.
11. A child is linked to multiple guardians, one guardian is removed, and a protected file deep link is revisited.
12. Existing student and new applicant match only partially; the UI must show uncertainty and require reviewer decision rather than automatically merge.

### 6.7 Acceptance criteria

1. Application, student, guardian, document, duplicate, QR/ID, iEMIS, import, and export queries/mutations are tenant-scoped.
2. Admission officer/admin can create a server-backed draft, restore it, see validation state, and submit it without duplicate creation.
3. Pipeline stage, completeness, missing item, interview, review, and decision states are backend-backed and audit-visible.
4. Guardian removal immediately blocks parent access.
5. Student documents/photos and exports do not expose raw storage keys, permanent URLs, or private credentials.
6. Protected document/card/export preview/download uses authenticated File Registry helpers.
7. QR lifecycle works with generate, rotate, revoke/deactivate, print-queue state, and fail-closed resolve.
8. Duplicate review shows explainable deterministic factors; merge requires explicit selection/confirmation and preserves linked history.
9. Student directory/list uses server pagination/filtering and fail-closed assigned-scope access.
10. Unauthorized actors do not receive health/emergency data, unrelated guardian data, or cross-module student details.
11. iEMIS readiness behaves as validation/import/export job workflow with clear queued, completed, partial-failure, failed, and protected-artifact states.
12. Historical records remain available after transfer, withdrawal, graduation, archive, alumni transition, or approved merge according to policy.
13. Browser smoke covers application draft/submit, decision safeguards, protected documents, guardian access revocation, duplicate merge safety, QR lifecycle, iEMIS job state, and tenant/role denial.

---

## 7. M4 Academics, Exams, Report Cards, and KG-12 Academic Structure

### 7.1 Purpose

Manage academic structure, subjects, exams, assessment components, CAS, report cards, promotion, and later KG-12 streams, practicals, projects, and subject combinations.

### 7.2 Primary actors

- Academic Admin.
- Principal.
- Exam Coordinator.
- Teacher.
- Parent/Student with published-result access.

### 7.3 Core functions

1. Manage academic years.
2. Manage classes and sections.
3. Manage subjects.
4. Assign teachers to subjects/classes.
5. Manage exam terms and assessment components.
6. Enter marks and CAS.
7. Lock/unlock marks with approval where enabled.
8. Generate report cards.
9. Manage promotion readiness.
10. Configure grade bands and school levels for KG-12.
11. Configure Grade 11-12 streams/programs where enabled.
12. Configure subject combinations where enabled.
13. Track practical/project components where enabled.
14. Expose subject/chapter/topic/outcome data to M12 Learning Layer where enabled.

### 7.4 Validation rules

1. Marks entry must be teacher/role scoped.
2. Published results must be parent/student scoped.
3. Academic records must remain linked after class transfer or graduation.
4. Stream and subject-combination rules must be tenant-scoped.
5. Learning Layer must reference academic subjects/topics and not duplicate them.

---

## 8. M12 Learning Layer

### 8.1 Purpose

Provide teacher-led, school-controlled learning workflows through smart-board activities, computer-lab practice, progress tracking, and parent learning summaries.

Implementation note: the code foundation for this section exists under `apps/api/src/learning`, `apps/web` Learning routes, and `apps/schoolos_mobile/lib/features/learning`; staging/browser/device verification and advanced learning depth remain staged.

### 8.2 Primary actors

- Teacher.
- Academic Admin.
- Student in school lab/session.
- Parent/Guardian.
- Principal.
- Platform Operator for feature entitlement.
- School support/platform operator only for entitlement/support diagnostics, never silent learning-data browsing.

### 8.3 Core functions

1. Create learning activity.
2. Edit learning activity.
3. Select class, section, subject, topic, mode, language, and difficulty.
4. Add questions and activity content.
5. Save activity as draft.
6. Publish/schedule activity.
7. Launch smart-board session.
8. List, monitor, heartbeat, pause/resume/end smart-board session.
9. Start computer-lab session.
10. Generate session code/QR.
11. Allow student to join valid school-only session.
12. Autosave student attempt.
13. Submit student attempt.
14. Evaluate answers backend-side, including MCQ, true/false, short answer, matching, and ordering.
15. Update learning progress.
16. Show teacher class/topic progress.
17. Show parent child-only learning summary.
18. Attach teacher-approved resources through File Registry.
19. Support Easy / Medium / Hard difficulty internally.
20. Show supportive student-facing labels: Practice, Challenge, Mastery, or Needs practice / Improving / Ready / Strong.
21. Keep student access lab-only or controlled school-device only for MVP.
22. Keep parent summary child-scoped and non-comparative.
23. Keep teacher assignment validation tied to active staff, tenant, class/section, subject, curriculum, module entitlement, and permission.

### 8.4 Key states

- Activity: draft, scheduled, published, archived.
- Session: planned, live, paused, ended, expired.
- Attempt: in_progress, submitted, auto_submitted, sync_pending.
- Progress: needs_practice, improving, ready, strong.
- Access: allowed, denied, expired, feature_locked, tenant_suspended.

### 8.5 Validation rules

1. Teacher can create/launch only for assigned class/section/subject unless explicitly permitted.
2. Student can join only live sessions for their own class/section.
3. Session code/QR must expire.
4. Parent can view only linked child learning summary.
5. Cross-tenant activity/session/attempt/progress access must be denied.
6. Smart-board and lab routes must expose no admin-sensitive data.
7. Activity media must use File Registry/Storage boundaries.
8. Autosave and submit must be idempotent.
9. School-only access must be default.
10. AI functionality must remain disabled until later approved phases.
11. Public leaderboards and class rank comparisons are not allowed.
12. Harmful labels such as weak, failed, poor, or low-rank are not allowed.
13. Open-ended AI chat is not allowed for students.
14. Learning must not block access based on fee status by default.
15. Student lab/session routes must not expose fees, parent/staff data, other students, unpublished marks, or admin configuration.

### 8.6 Acceptance criteria

1. Teacher can create a draft activity only for assigned class/subject.
2. Teacher can launch a smart-board session for an assigned class.
3. Student can join a live computer-lab session with valid code/QR.
4. Student cannot join another class session.
5. Parent cannot view another child summary.
6. Progress updates only after valid submission.
7. Tenant isolation tests pass for activity, session, attempt, and progress records.
8. Backend M12 E2E coverage passes for teacher assignment denial, inactive/expired/wrong-class session denial, session monitoring, resource handling, matching/order evaluation, cross-tenant denial, parent child-scope denial, autosave/submit idempotency, and progress-after-submit behavior.
9. Web contract coverage passes for Learning API helpers, routes, runtime safety, and no fake data.
10. Flutter tests pass for parent/student Learning summary parsing and supportive labels.
11. Direct URL checks deny another child, another class/session, expired/inactive sessions, and cross-tenant activity/session/attempt/progress access.
12. Learning outputs remain teacher-controlled, supportive, explainable, and non-comparative.

---

## 9. M13 Inventory & Asset Management

### 9.1 Purpose

Manage school-owned consumables, fixed assets, purchase requests, vendor/quotation records, goods received notes, stock movement, stocktake, maintenance, write-off/disposal, protected documents, reports, and accounting handoff.

M13 is planned. Implementation must not be claimed until code/contracts/migrations/tests/seed/smoke evidence exists.

### 9.2 Primary actors

- Storekeeper / Inventory Officer.
- School Admin.
- Principal / Owner.
- Accountant / Finance Staff.
- Department Head / Lab In-charge.
- Teacher / Staff requester.
- Auditor / SMC reviewer.
- Platform Operator for entitlement/support diagnostics only.

### 9.3 Core functions

1. Create and manage inventory categories/subcategories.
2. Create and manage item masters with unit, reorder level, controlled-item flag, category-specific fields, and status.
3. Configure stores and physical locations: main store, office store, science lab, computer lab, sports room, exam room, transport store, hostel store, building, floor, room, rack, shelf, cupboard, or bin.
4. View stock on hand by item, store, lot, batch, expiry, and status.
5. Raise purchase request with item, quantity, purpose, expected date, department/class/lab, estimated cost, and attachments.
6. Approve, reject, hold, or request changes for purchase requests according to amount/category/fiscal policy.
7. Maintain vendor records with contact, address, PAN/VAT metadata, category, status, and notes.
8. Attach and compare quotations.
9. Create purchase order from approved request or direct purchase where permission allows.
10. Receive goods through GRN with ordered, received, accepted, rejected quantity, bill number, bill date, VAT/PAN metadata, condition, and protected attachments.
11. Issue stock to staff, department, class, lab, office, hostel, event, or store.
12. Return reusable items and record condition.
13. Transfer stock between stores/locations.
14. Adjust stock with permission, reason, confirmation, and audit.
15. Register fixed assets from purchase, donation, transfer, opening balance, or grant.
16. Assign asset to staff, department, room, lab, bus, hostel, or admin unit.
17. Track asset lifecycle, condition, location, custodian, warranty, documents, photos, and maintenance history.
18. Create and complete maintenance/repair tickets.
19. Run stocktake sessions, enter counts, review variance, approve adjustment, and close session.
20. Manage lost, damaged, write-off, disposal, archive, and donation/grant asset workflows.
21. Generate and print barcode/QR labels where backend supports protected artifacts.
22. Produce inventory, stock movement, purchase, vendor, asset, warranty, maintenance, stocktake, write-off, donation/grant, and accounting handoff reports.
23. Emit safe accounting handoff events for M9; do not directly write official ledger entries from frontend/M13 browser code.

### 9.4 Key states

- Item: draft, active, inactive, archived.
- Purchase request: draft, submitted, under_review, approved, rejected, changes_requested, cancelled.
- Quotation: pending, received, selected, rejected, expired.
- Purchase order: draft, issued, partially_received, received, cancelled, closed.
- GRN: draft, posted, partially_accepted, rejected, cancelled.
- Stock lot: available, reserved, issued, depleted, expired, damaged, lost, adjusted.
- Stock movement: pending, posted, reversed, failed.
- Asset: active, assigned, in_store, under_repair, damaged, lost, written_off, disposed, archived.
- Maintenance: reported, approved, in_progress, completed, rejected, cancelled.
- Stocktake: planned, counting, review, approved, adjusted, closed, cancelled.
- Accounting handoff: pending, queued, posted, failed, reversed, ignored.

### 9.5 Validation rules

1. All M13 records must be tenant-scoped.
2. Disabled/locked M13 routes and APIs fail closed.
3. Parent, student, and driver routes must not expose M13 admin data.
4. Stock quantity changes only through backend movement records.
5. Receive, issue, return, transfer, adjustment, stocktake adjustment, maintenance completion, and write-off/disposal must be idempotent and audited.
6. Official stock quantity, inventory valuation, depreciation, and accounting handoff state must be backend-owned.
7. Browser UI must not calculate official stock, valuation, depreciation, or accounting truth.
8. High-risk actions require permission, reason, confirmation, and audit: adjustment, write-off, disposal, archive, accounting handoff retry, high-value purchase approval, and stocktake adjustment.
9. File attachments for bills, quotations, POs, GRNs, warranty cards, asset photos, repair invoices, stocktake sheets, write-off approvals, labels, and exports must use File Registry-backed access.
10. Vendor PAN/VAT and bill metadata must be permission-filtered.
11. Asset tag and item code uniqueness must be tenant-scoped.
12. Stocktake variance must not auto-adjust without reviewer approval.
13. Category-specific sensitive items such as chemicals, exam materials, or controlled equipment require restricted visibility and controlled issue.
14. M13 must not directly post official M9 ledger entries; M9 owns official journal posting, reversal, fiscal locks, and snapshots.
15. Canteen edible stock, Library book-copy lifecycle, Transport trip/GPS operations, and HR staff records remain owned by their respective modules unless an explicit contract integration exists.

### 9.6 Edge cases

1. Same purchase request is submitted twice due to slow network.
2. GRN is saved after purchase order is cancelled or already fully received.
3. Stock issue is attempted while available quantity changed in another tab.
4. Asset tag or serial number duplicates within tenant.
5. Same asset tag exists in another tenant.
6. Asset is assigned to a staff member who has been archived or left school.
7. Bill attachment upload succeeds but File Registry association fails.
8. Vendor becomes inactive while purchase order is still open.
9. Stocktake count conflicts with movement posted after count started.
10. Low-stock alert fires while purchase order is already approved but not received.
11. Asset is under repair when transfer/disposal is attempted.
12. Category policy changes after item was created.
13. Fiscal year closes before accounting handoff is posted.
14. User loses permission while adjustment/write-off drawer is open.
15. Parent/student deep link attempts to open inventory document.
16. Donation/grant item has no vendor bill but still needs ownership, source, and audit evidence.

### 9.7 Acceptance criteria

1. Catalogue, stock, asset, purchase, vendor, movement, maintenance, stocktake, and attachment queries/mutations are tenant-scoped.
2. Storekeeper can receive goods through GRN and stock increases exactly once.
3. Staff can request items only where permission allows.
4. Principal/owner can approve/reject high-value request with reason and audit.
5. Storekeeper can issue/return/transfer stock with idempotent movement records.
6. Fixed assets show lifecycle, location, custodian, condition, warranty, maintenance, and protected documents.
7. Stocktake variance requires approval before adjustment.
8. Accounting handoff queues safely for M9 and never writes ledger directly from browser.
9. Unauthorized parent/student/driver/staff routes cannot access inventory admin data.
10. Protected bills, warranties, labels, reports, and write-off documents use File Registry helpers.
11. Reports use backend filters, pagination, and queued export state where needed.
12. Module disabled and permission-denied states are clear and fail closed.
13. Backend tests cover tenant denial, permission denial, movement idempotency, stocktake approval, protected file access, inactive vendor, stale asset state, and accounting handoff boundary.
14. Web tests/contracts cover API helpers, states, protected file actions, no fake data, and report export states.

---

## 10. M10 Communication Integration for Learning and Inventory

### 10.1 Purpose

Use the existing communication system to send learning-related and inventory-related summaries/notices without creating separate notification systems.

### 10.2 Core functions

1. Send parent weekly learning summary.
2. Send teacher reminders for scheduled learning activity.
3. Send lab-session completion summary where enabled.
4. Send offline home practice suggestion where approved by teacher.
5. Send inventory low-stock alert to configured roles where M13 is enabled.
6. Send purchase approval reminder to approvers.
7. Send maintenance due or warranty expiry notice.
8. Send stocktake task/reminder to assigned reviewers.

### 10.3 Validation rules

1. Parent messages must be child-scoped.
2. Learning and inventory messages must respect quiet hours/provider status where configured.
3. Failed delivery must not mark a learning summary as viewed or an inventory approval as completed.
4. Notifications must not reveal other students, class rankings, sensitive vendor bill details, restricted item details, or asset write-off evidence to unauthorized recipients.

---

## 11. Non-Negotiable Functional Boundaries

1. Do not duplicate core SchoolOS student, teacher, class, subject, parent, file, notification, or audit systems inside Learning.
2. Do not block learning access based on fee status by default.
3. Do not publish public leaderboards for children.
4. Do not show harsh labels like weak, failed, poor, or low-rank.
5. Do not build broad student mobile/home learning for MVP.
6. Do not introduce AI tutor, adaptive recommendations, advanced simulations, or open chat until a later approved phase.
7. Parent learning access is own-child only.
8. Student learning access is school lab/session only unless a future school-controlled device policy is explicitly approved.
9. Do not implement open-ended student AI in MVP.
10. Do not expose admin-shaped APIs to student, parent, board, lab, driver, or staff self-service routes.
11. Do not claim KG-12 completion until the matching code, tests, data models, and workflows exist.
12. Do not claim the dashboard, M1 workflow states, saved views, score formulas, e-sign, calendar scheduling, print queues, or iEMIS job flows are implemented until confirmed by backend/OpenAPI and verified in browser/staging/pilot workflows.
13. Do not claim M13 Inventory & Asset Management is implemented until the matching backend models, contracts, APIs, web screens, protected-file flows, seed data, tests, and smoke evidence exist.
14. Do not calculate official inventory stock, valuation, depreciation, or accounting truth in browser/mobile code.
15. Do not allow M13 to bypass M9 Accounting for official ledger posting, reversal, fiscal locks, or report snapshots.
