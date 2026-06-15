# SchoolOS Project Status

**Status:** 2026-06-15 stabilization update: backend package gates pass, root typecheck/build pass, and local smoke suites pass (`pnpm smoke:pilot`, `pnpm smoke:learning`, `pnpm smoke:full`). The advanced-operations backend foundation is present and the additive Prisma migration `20260615090000_advanced_operations_foundation` has been added for approvals, deterministic automation, descriptive analytics summaries, document templates/generated documents, verification/access logs, and data export jobs. Staging/pilot migration deployment and browser E2E remain pending, so do not claim production-ready. 2026-06-14 M6 update: homework reminder batch history/retry routes are exposed, and approved staff leave now creates tenant-scoped draft substitution tasks for affected published/locked timetable slots without duplicating active substitutions. 2026-06-13 implementation updates recorded: Auth/Security settings now include live tenant role/permission inspection and the dashboard shell mounts the support-override warning banner; M0 queue operations reject retry/discard races and keep retry audit single-job scoped; M1 admission application pipeline, uploaded-document expiry reminders, configurable expiry-reminder templates, structured admissions bulk-import duplicate review with persistent batch/row history, and Student QR operational analytics are implemented; M2 monthly register exports are app-controlled and parent absence/late notifications plus repeated absence/late follow-up queue are implemented; M3 payment webhooks fail closed for non-success events, dotted provider callback events are normalized, and overdue reminder segmentation is implemented; M4 report-card PDF opening is protected through the shared web helper and backend assessment template presets are implemented; M5 activity media preview/download uses shared app-controlled blob helpers and milestone template presets are implemented; M6 homework attachment opening uses homework-specific access helpers and homework template filtering is implemented; M7 staff self-service masks bank account display; M8A library copy archive is wired through an audited reason UI; M8C canteen serving requires staff acknowledgement before submitting when allergy/medical warnings are present. 2026-06-12 updates: M12 Learning Layer production foundation implemented and verified across backend, web runtime, and Flutter summaries, including activity/session/attempt/progress/parent-summary/resource APIs, session monitoring/heartbeat/participants, matching/order questions, Prisma migrations, learning permissions/entitlements, audit logging, web routes, mobile summaries, and E2E/contract/mobile coverage. Prior 2026-06-06 updates: suspended-tenant file/export denial, M0 mobile/queue entitlement hardening, M1/M5/M10 satellite-controller entitlement gating, platform `/platform/demo-requests` operator workspace, and Section 11 remaining-work inventory for M1–M10.
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard, Flutter companion app

This is the consolidated source of truth for SchoolOS project status. It records the current product/technical state and points to the active focused documents.

---

## 1. Active Documentation Set

```text
README.md
AGENTS.md

docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md

docs/project/SCHOOLOS_PROJECT_STATUS.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md
docs/project/SCHOOLOS_LEARNING_LAYER_PLAN.md

docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md

docs/design/SCHOOLOS_UI_UX_GUIDE.md

docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md

apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

Do not recreate old split PRD, repo-analysis, remaining-plan, deployment-checklist, Docker-VPS runbook, mobile project-instructions, mobile UI direction, or mobile development-plan docs.

---

## 2. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue/API-key/File Registry hardening implemented; platform DTO validation and status/support-override request shaping refined on 2026-06-04; queue retry/discard race checks and per-job retry UX added on 2026-06-13; queue failure grouping diagnostics and local/S3/R2/MinIO-compatible readiness profiles added on 2026-06-14; real provider/storage/browser smoke remains
M1 Admissions & Student Profiles: Pilot-ready plus admission application pipeline, Student QR management/scan audit UI and operational analytics, storage/photo/logo, iEMIS artifact registration and student/class readiness review, duplicate candidate review, structured bulk-import duplicate review with persistent batch/row history, lifecycle timeline, document audit/checklist expiry hardening, configurable automated document-expiry reminders, mobile child profile foundation, and satellite-controller entitlement gating
M2 Smart Attendance: Pilot-ready plus lock-window enforcement, working-day calendar policy, concurrent-session conflict handling, correction/offline-draft, rejected replay regressions, correction-review UI, operational anomaly dashboard, app-controlled monthly register exports, child-scoped parent absence/late notifications, retry-safe duplicate suppression for parent absence/late notifications and repeated follow-up dispatch, repeated absence/late follow-up queue, mobile teacher scope, real-data teacher dashboard, and mobile parent attendance summary query validation
M3 Fees & Receipts: Pilot-ready plus receipt reprint history UI, printed receipt QR verification, reversal/refund approval foundation, legacy payment-reversal compatibility route mapped to the reversal workflow and permission, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage, segmented overdue reminders, and secure online payment webhook signature verification with duplicate/already-paid/failed-event guards
M4 Academics / Exams / CAS / Report Cards: Completed / Pilot-Ready with PDF/report/correction/snapshot polish, report-card batch partial-failure job surfacing and retry-safe already-generated locked-card skipping, protected/app-controlled report-card PDF opening, and backend assessment template presets
M5 Activity Feed & Milestones: Strong foundation with media privacy, consent-aware blocking, optimized previews, app-controlled private media preview/download helpers with active-child/tagged-consent/unavailable-post direct checks, moderation controls, teacher media gallery, backend milestone template presets, backend audience preview, active-student-only tagging and delivery, retry-pending delivery replay idempotency, and media-access entitlement gating
M6 Homework / Timetable: Completed / Pilot-Ready with File Registry attachments, homework-specific attachment access helpers, filtered homework template APIs, reminder hardening, absence/substitution conflict coverage, mobile homework/timetable views, and improved substitution slot selection / absence recording UI
M7 HR / Payroll: Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII/self-service bank masking, payroll reports, mobile staff self-service, and active-salary-structure statutory deduction retrieval
M8A Library: Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, copy archive workflow, and reports/export polish
M8B Transport: Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports
M8C Canteen: Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, parent mobile views, serving allergy acknowledgement, and canteen workspace UI polish
M9 Accounting: Production-candidate / Pilot-Ready with Nepal school chart template preview/import, source-mapping health checks, PDFs, retry-safe report snapshot reuse, synchronous export row thresholds, queued background General Ledger/Cash Book exports through File Registry, platform-visible accounting report queue diagnostics, audit trail, reconciliation suggestions, File Registry export support, and validated bank statement import DTO/service hardening
M10 Notices / Communication / Chat: Strong foundation with provider modes, HMAC-signed SMS/email/FCM provider callback verification, sanitized provider callback failures, duplicate/out-of-order provider status guards, provider-disabled retry fail-closed behavior, retry-race diagnostics, role-aware chat quiet-hours, escalation write locks, high-impact notice recipient preview, File Registry-backed notice attachments with raw object-key suppression, legacy messaging parent/guardian live-link scoping with unsafe attachment suppression and tenant-only SSE change signals, failure dashboard, moderation/escalation, unread-recipient follow-up, mobile notification/chat surfaces, and full communications/messaging sub-controller entitlement gating
Pre-AI Advanced Operations: Backend foundation and additive Prisma migration added for reusable approvals, rules-based automation, descriptive analytics summaries, document templates/generated documents, verification/access logs, and data export jobs; frontend/mobile workspaces, browser E2E, staging deployment, and pilot workflow tuning remain
M12 Learning Layer: Production foundation implemented and verified under apps/api/src/learning plus web Learning routes and Flutter summaries, with activity builder, school-only sessions, session monitoring/heartbeat/participants, lab attempts, autosave/submit, resources, matching/order questions, progress, parent child-scoped summary, student self-scoped summary, Prisma migrations, permissions, entitlement, audit logging, and focused E2E/contract/mobile coverage
Public marketing/demo intake: Public POST API plus platform `/platform/demo-requests` operator workspace, internal notes, RBAC, audit logging, rate limiting, and tests (public form on 2026-06-04; platform UI on 2026-06-06)
Settings / audit visibility: Settings audit-log access and UI depth added on 2026-06-04; live tenant role/permission inspection and support-override dashboard warning added on 2026-06-13
M11 School Intelligence / AI: Roadmap only
SchoolOS Flutter Mobile: Active companion app with scoped parent/student/teacher/staff/driver/admin surfaces where APIs exist
```

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks, browser E2E, and pilot smoke verification
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

**Current verification:** Backend gates are green, root typecheck/build are green, and local smoke suites are green. This is local verification only; staging/pilot deployment has not been recorded as passed.

**Remaining work categories:** Frontend implementation is the next active phase. Remaining work is categorized as frontend workspace completion, mobile polish/device QA, provider/staging verification, seeded browser E2E, pilot feedback, and future AI. M11 Intelligence/AI remains roadmap/deferred.

---

## 2.0 2026-06-15 Advanced Operations Stabilization Update

```text
Pre-AI Advanced Operations
- docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md remains the module-wise implementation blueprint for advanced non-AI SchoolOS features.
- Backend foundation exists for reusable approval workflows, rules-based automation, descriptive analytics summaries, document/certificate templates, and data export jobs.
- apps/api/prisma/migrations/20260615090000_advanced_operations_foundation adds the advanced-operations enums, tenant-scoped tables, indexes, and foreign keys.
- Migration SQL was reviewed as additive-only; staging/pilot migration deployment remains pending before production-readiness claims.
- Remaining Advanced Operations work is frontend workspace implementation, mobile/offline workflow depth, seeded browser E2E, provider/staging validation, and pilot feedback.
- M11 Intelligence/AI remains explicitly deferred until production data quality, aggregation, audit, and human-review foundations exist.
```

---

## 2.1 2026-06-06 Implementation Update

```text
Auth / Security
- Suspended-tenant denial on file registry, report exports, and entitled controllers.
- TenantActiveGuard on /files routes; queue processors skip suspended tenants.
- 2026-06-12: platform high-risk security audit queries added for failed logins, permission changes, tenant status changes, and support access; active role/permission changes and expiring support override enforcement verified from source.
- 2026-06-13: dashboard support-override warning banner mounted for tenant workspaces, and Roles & Permissions now inspects live tenant RBAC roles/permission keys from `/roles` and `/roles/permissions` with seeded catalog fallback.

M0 Platform
- Mobile parent per-module entitlement gates; finance-compat and ledger entitlement guards.
- Activity-feed RequiredModule gate; processor-tenant skip helper.
- 2026-06-12: aggregate provider readiness now includes payment gateways and fails production gateway readiness unless a validated TEST sandbox configuration exists.
- 2026-06-07: platform queue monitoring now includes reports and canteen-alerts; failed-job discard requires and audits an operator reason from the platform settings UI/API.
- 2026-06-13: platform failed-job retry and discard now re-check failed state before mutation, return bounded race/idempotency errors, and the platform UI exposes retry as audited single-job action only.
- 2026-06-14: platform failed jobs now expose grouped, payload-safe diagnostics by queue, job name, bounded failure reason, affected tenant hints, sample job IDs, and retry-safety category; object storage readiness now reports the selected local/S3/R2/MinIO-compatible adapter profile without making paid external bucket calls.
- 2026-06-14: Auth/M0 backend gate passed through Prisma generate/validate, OpenAPI, API typecheck, API unit tests, and API E2E; SaaS billing lifecycle tests remained green and separate from school fee/accounting ledger posting.
- Repo-truth correction: onboarding checklist UI and provider/storage readiness surfaces are already implemented; computed onboarding checklist plus audited override is sufficient for pilot backend closure unless product requirements add approval, rollback, or multi-status transition needs. Remaining M0 provider work is staging/provider-specific verification depth.

M1 / M5 / M10
- EntitlementGuard on student-documents, document-access, photo, QR, siblings, academic-years (M1).
- 2026-06-13: M1 uploaded student documents now run a daily expiry-reminder pass for active/verified documents due within 30 days or already expired, queue guardian email/SMS reminders, suppress same-day duplicates, and write document history plus audit records.
- 2026-06-13: M1 admissions bulk import now posts real CSV content to the backend, supports dry-run validation and confirmed duplicate imports, preserves structured duplicate candidates per row, and shows row-level review details in the web import workflow.
- 2026-06-13: M1 student directory now uses the tenant-scoped `/students/iemis/validation` endpoint for class/section iEMIS readiness review, with issue counts and profile links for corrections.
- 2026-06-13: M1 backend now persists admissions bulk-import batch/row history, exposes tenant-scoped import history APIs, adds configurable student-document expiry reminder templates, and exposes Student QR operational analytics from the audit trail.
- 2026-06-13: M1 admission applications now support tenant-scoped pipeline states from inquiry through application/document-pending/interview/accepted/enrolled/rejected, audited status transitions, duplicate review metadata, and conversion through the existing enrollment flow.
- 2026-06-14: M1 hardening coverage now validates tenant-scoped ownership audit lookups, QR analytics token-hash suppression, admission draft autosave/recovery scoping, enhanced duplicate signals, guardian-removal file-access review, generated ID-card metadata lookup, import-review queue scoping, iEMIS readiness, alumni graduation transitions, and admission-application conversion edge cases; guardian-link removal now mutates with tenant/student/guardian predicates. Application status updates now use tenant/status-scoped mutations, reject direct `ENROLLED` status changes, and require accepted, unconverted applications before enrollment conversion claims and creates the student/enrollment in one serializable transaction. Route-level M1 hardening controller contracts now pin module entitlement, high-risk route permissions, and authenticated actor delegation for ownership, drafts, duplicate/relationship review, guardian removal, generated documents, import review, iEMIS readiness, workflow labels, and alumni transitions. HTTP E2E now covers same-tenant and cross-tenant M1 ownership audit, guardian-removal file-access review, admission draft autosave/recovery, import-review queue paths, and admission-application status mutation hardening, including QR token-hash non-disclosure and no cross-tenant mutation or draft/import leakage.
- RequiredModule('activity') on media-access (M5).
- EntitlementGuard on all communications/messaging satellite controllers (M10).

M2 Attendance
- 2026-06-13: Monthly register CSV/PDF exports now use the shared authenticated web API helper with parsed backend errors and in-app success/failure states instead of raw URL `window.open` export links.
- 2026-06-13: Submitted absent/late records now create child-scoped parent notification deliveries with audit, and `/attendance/follow-ups` exposes a repeated absence/late follow-up queue from anomaly data.
- 2026-06-14: M2 hardening regression coverage now validates tenant-scoped anomaly detection across session windows, active-roster counts, explicit calendar policy, non-working/exam-day attendance, generic holiday status on exam days, not-marked sessions, missing roster records, high absence rates, anomaly audit metadata, and cutoff automation creating locked not-marked sessions for missing active-roster scopes.
- 2026-06-14: M2 lock-window overrides and correction reviews now enforce tenant-configured minimum reason lengths before attendance mutations or review lookups, and parent absence/late notifications now honor tenant-configured enablement, channels, and message templates while keeping attendance domain events intact.
- Repo-truth correction: lock-window enforcement, working-day calendar policy, duplicate/concurrent session conflict handling, and operational anomaly detection/dashboard are already implemented; remaining M2 work is regression depth, smoke, and UX triage polish.

M3 Fees & Receipts
- 2026-06-13: Online payment webhooks now fail closed for non-success gateway events, reject missing references and zero-amount success events, and keep duplicate/already-paid protections covered by focused finance hardening tests.
- 2026-06-13: Defaulter APIs now support aging-bucket and min/max overdue segmentation, return segment totals, and send child-scoped overdue reminders with segment-aware audit metadata.
- 2026-06-13: Online payment webhook status normalization now accepts common dotted provider callback events such as `payment.success`, `payment.failed`, and `payment.pending` while continuing to fail closed for unknown statuses.
- 2026-06-14: Payment collection now treats tenant-scoped idempotency-key unique races as idempotent responses by returning the existing receipt/payment, and cashier-close regression coverage maps database unique-window races to bounded conflict responses. Cashier-close overlap checks now respect payment-method-specific closes so cash/bank/manual mode day-close workflows can close separately while all-method closes still guard the whole window.
- 2026-06-14: Scholarship/waiver adjustments after invoice creation now enforce service-level `fees:discount` authorization, auditable nonblank reasons, paid/void invoice protections, tenant-scoped fee-head membership checks, and net-paid safeguards so waivers cannot silently create overpaid or negative invoices. Invoice adjustments now also enforce service-level `fees:adjust` authorization and nonblank reasons.
- 2026-06-14: M3 HTTP isolation coverage now verifies cross-tenant invoice-adjustment denial before invoice lines or ledger entries are written, paid-invoice waiver rejection without total mutation, and method-specific cashier close isolation that allows separate cash/bank closes for the same window while blocking duplicate same-method closes.

M4 Academics
- 2026-06-13: Report-card PDF opening now uses the shared authenticated web helper with response validation and parsed error handling across the dedicated report-card workspace and the academics tab.
- 2026-06-13: Assessment template backend presets now expose terminal and theory/practical templates and can apply them as audited tenant-scoped exam terms plus assessment components for class subjects.
- 2026-06-14: Marks service regression coverage now pins absent, withheld, and retest/make-up mark states through the tenant-scoped bulk upsert path with audit metadata.
- 2026-06-14: Teacher marks autosave now has first-class backend support through draft mark entries; draft/autosaved marks persist tenant-scoped, remain mutually exclusive with absent/withheld/retest states, and are treated as incomplete for report-card readiness until submitted.
- Repo-truth correction: mark lock/unlock approval, dues-aware result withholding, and queued large-batch report-card generation already exist; remaining M4 work is focused regression/staging smoke plus retest/make-up exam workflow depth.

M5 Activity Feed
- 2026-06-13: Activity media preview/download now uses shared web blob helpers for authenticated response validation, empty-file checks, object URL cleanup, and app-controlled downloads.
- 2026-06-13: Milestone template presets now expose Montessori/ECD and primary-stage milestone suggestions with stage/domain filtering for future teacher picker UI and mobile reuse.
- 2026-06-14: Activity feed parent visibility regression coverage now fails closed after guardian-student links are removed, preventing removed guardians from receiving activity posts or media visibility.
- 2026-06-14: Backend audience preview now supports class, section, and student-specific activity posts with active-student filtering, guardian recipient counts, and media-consent counts; activity notifications now use `AudienceType.STUDENT` for tagged posts, exclude inactive/removed students from delivery resolution, and replay `RETRY_PENDING` delivery retries without duplicate provider dispatch.

M6 Homework / Timetable
- 2026-06-13: Homework detail, review, and student attachment opening now use homework-specific signed access helpers instead of generic file view calls, preserving assignment/submission ownership checks.
- 2026-06-13: Homework template listing now accepts class, subject, search, and limit filters while preserving the existing metadata-backed template model.

M7 HR / Payroll
- 2026-06-13: Staff self-service now masks bank account display in the dashboard overview, with web contract coverage preventing direct raw account rendering.

M8A Library
- 2026-06-13: Library copy archive is now exposed in the web workspace through the existing backend archive route, requiring an audit reason and avoiding unsafe deletion when circulation history may exist.

Public Demo Requests
- Platform API helpers and /platform/demo-requests operator workspace (list, filter, review, status, internal notes).

Documentation
- Section 11 remaining implementation inventory for M1–M10 added to implementation status plan.
- 2026-06-07 M2 repo-truth correction: offline attendance sync/drafts/conflict-review backend APIs and replay-safe integration tests already exist; remaining M2 work is browser/mobile smoke and UX depth, not a missing sync API.
```

---

## 2.2 2026-06-12 M12 Learning Layer Completion Update

```text
M12 Learning Layer
- Dedicated backend domain added under apps/api/src/learning and registered once in AppModule.
- Prisma schema/migration added for LearningActivity, LearningQuestion, LearningSession, LearningParticipant, LearningAttempt, LearningAnswer, LearningProgress, and LearningResource.
- Learning permissions and module/feature entitlements added for admin/principal/teacher/subject_teacher/student/parent role defaults.
- Implemented authenticated, tenant-scoped APIs for activities, sessions, attempts, progress, parent learning summaries, and resources.
- Added session list, teacher heartbeat, participant monitor, resource CRUD/archive/attach, matching/order question types, and progress filters.
- Teacher activity/session writes validate active staff, same tenant, class/section/subject scope, subject curriculum, and SubjectTeacherAssignment.
- Student session access validates active same-tenant student, live/unexpired session, class/section match, school-only default, and valid session code or QR token hash.
- Attempts support idempotent start/autosave/submit, MCQ/true-false/short-answer/matching/ordering evaluation, score/accuracy, audit logging, and progress update after valid final submission.
- Parent learning summary is linked-child scoped only and non-comparative; no raw private answers or leaderboards are exposed.
- Web Learning client/routes now cover teacher/admin workspace, activity builder, resources, session monitor, smart-board runtime, student lab runtime, progress, and parent summary.
- Flutter mobile now includes parent/student Learning summary foundation only; no mobile smart-board or full lab runtime.
- Verification: compile:artifacts, db:generate, db:validate, API typecheck, focused Learning E2E, API unit tests, full API E2E, web tests, web lint, web typecheck, web build, Flutter analyze/test, root typecheck, root lint, root build, and web E2E passed.

Remaining M12 work
- Apply the migration in staging and validate against real school fixtures.
- Add seeded browser E2E for completed Learning flows.
- Harden school-only network/device policy if the product owner wants location/device-level enforcement.
- Defer advanced simulations, adaptive learning, AI tutor, open chat, and public leaderboard scope.
```

---

## 2.3 2026-06-04 Implementation Update

Today's commits added or updated the following:

```text
- AGENTS.md production-implementation operating instructions.
- M9 Accounting: bank statement import DTOs, reconciliation DTO, empty/invalid amount validation, UUID import batch IDs, and tests.
- M3 Finance: HMAC verification for online payment webhooks, adapter-aware gateway status, and webhook/signature tests.
- M7 Payroll: statutory deductions now derive from active salary structures, with controller delegation and tests.
- M0 Platform: structured DTOs for provider status updates, support override entry, and tenant billing status reason payloads, with validation tests.
- M2 Mobile/Attendance: parent attendance summary query DTO with month/year validation and tests.
- Web security: browser API request IDs now use secure randomness instead of Math.random.
- Public demo requests: DemoRequest Prisma model/migration, public POST API, CSRF public allow-list, backend service/controller/DTO/tests, web form API integration, marketing API helper, and public smoke/contract tests.
- Settings: settings audit-log API/UI depth and access-control tests.
- User management: web API helper foundation for school user management.
- M6 Timetable/Substitutions: substitution modal and substitutions list improved for timetable slot selection and absence recording.
- M8C Canteen: canteen workspace UI/API handling polish and serving allergy acknowledgement before staff can submit warned meal servings.
- Documentation: module-wise enhancement plan created and linked from active project docs.
```

Verification note:

```text
These updates are recorded from commit inspection. Full local/staging verification must still be run before changing readiness claims: db generate/validate, OpenAPI gate, lint, typecheck, unit tests, API E2E, web E2E, build, verify:production, and smoke:pilot (or legacy alias smoke:phase1).
```
