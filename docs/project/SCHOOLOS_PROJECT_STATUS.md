# SchoolOS Project Status

**Status:** 2026-06-13 implementation updates recorded: pre-AI Advanced Operations Plan added as a module-wise blueprint; Auth/Security settings now include live tenant role/permission inspection and the dashboard shell mounts the support-override warning banner; M0 queue operations reject retry/discard races and keep retry audit single-job scoped; M1 uploaded-document expiry reminders and structured admissions bulk-import duplicate review are implemented; M2 monthly register exports are app-controlled; M3 payment webhooks fail closed for non-success events; M4 report-card PDF opening is protected through the shared web helper; M5 activity media preview/download uses shared app-controlled blob helpers; M6 homework attachment opening uses homework-specific access helpers; M7 staff self-service masks bank account display; M8A library copy archive is wired through an audited reason UI; M8C canteen serving requires staff acknowledgement before submitting when allergy/medical warnings are present. 2026-06-12 updates: M12 Learning Layer production foundation implemented and verified across backend, web runtime, and Flutter summaries, including activity/session/attempt/progress/parent-summary/resource APIs, session monitoring/heartbeat/participants, matching/order questions, Prisma migrations, learning permissions/entitlements, audit logging, web routes, mobile summaries, and E2E/contract/mobile coverage. Prior 2026-06-06 updates: suspended-tenant file/export denial, M0 mobile/queue entitlement hardening, M1/M5/M10 satellite-controller entitlement gating, platform `/platform/demo-requests` operator workspace, and Section 11 remaining-work inventory for M1–M10.
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
M0 Platform Core: Foundation complete; provider/queue/API-key/File Registry hardening implemented; platform DTO validation and status/support-override request shaping refined on 2026-06-04; queue retry/discard race checks and per-job retry UX added on 2026-06-13; staging/object-storage/browser coverage remains
M1 Admissions & Student Profiles: Pilot-ready plus Student QR management/scan audit UI, storage/photo/logo, iEMIS artifact registration and student/class readiness review, duplicate candidate review, structured bulk-import duplicate review, lifecycle timeline, document audit/checklist expiry hardening, automated document-expiry reminders, mobile child profile foundation, and satellite-controller entitlement gating
M2 Smart Attendance: Pilot-ready plus lock-window enforcement, working-day calendar policy, concurrent-session conflict handling, correction/offline-draft, rejected replay regressions, correction-review UI, operational anomaly dashboard, app-controlled monthly register exports, mobile teacher scope, real-data teacher dashboard, and mobile parent attendance summary query validation
M3 Fees & Receipts: Pilot-ready plus receipt reprint history UI, printed receipt QR verification, reversal/refund approval foundation, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage, and secure online payment webhook signature verification with duplicate/already-paid/failed-event guards
M4 Academics / Exams / CAS / Report Cards: Completed / Pilot-Ready with PDF/report/correction/snapshot polish and protected/app-controlled report-card PDF opening
M5 Activity Feed & Milestones: Strong foundation with media privacy, consent-aware blocking, optimized previews, app-controlled private media preview/download helpers, moderation controls, teacher media gallery, and media-access entitlement gating
M6 Homework / Timetable: Completed / Pilot-Ready with File Registry attachments, homework-specific attachment access helpers, reminder hardening, absence/substitution conflict coverage, mobile homework/timetable views, and improved substitution slot selection / absence recording UI
M7 HR / Payroll: Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII/self-service bank masking, payroll reports, mobile staff self-service, and active-salary-structure statutory deduction retrieval
M8A Library: Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, copy archive workflow, and reports/export polish
M8B Transport: Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports
M8C Canteen: Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, parent mobile views, serving allergy acknowledgement, and canteen workspace UI polish
M9 Accounting: Production-candidate / Pilot-Ready with PDFs, snapshots, audit trail, reconciliation suggestions, File Registry export support, and validated bank statement import DTO/service hardening
M10 Notices / Communication / Chat: Strong foundation with provider modes, attachments, failure dashboard, moderation/escalation, unread-recipient follow-up, mobile notification/chat surfaces, and full communications/messaging sub-controller entitlement gating
Pre-AI Advanced Operations Plan: Active module-wise implementation blueprint added on 2026-06-13 for tenant onboarding, student lifecycle, attendance automation, fee workflows, parent/student mobile self-service, communications, exams/report cards, timetable/substitution, transport, canteen, library, HR/payroll, accounting, approvals, rules-based automation, analytics, and document templates
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
Controlled pilot-ready: Yes, after staging checks and smoke verification
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

**Remaining M1–M10 work:** Core modules are pilot-ready; enhancement depth, staging smoke, and mobile polish remain. M12 production foundation is implemented; staging fixture validation, seeded browser E2E depth, future non-AI Advanced Operations depth, and later AI/adaptive/simulation scope remain. See `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` and `docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md`.

---

## 2.0 2026-06-13 Pre-AI Advanced Operations Planning Update

```text
Pre-AI Advanced Operations
- Added docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md as the module-wise implementation blueprint for advanced non-AI SchoolOS features.
- The plan covers Nepal-school operating realities: cash/bank/QR references, mixed Nepali/English communication, weak connectivity, IEMIS-ready data validation, SEE/+2 academic workflows, transport safety, parent adoption, and low-bandwidth school-office usage.
- The plan defines build phases before AI: pilot depth, premium private-school operations, and SaaS maturity.
- It adds implementation direction for reusable approval workflows, rules-based automation, descriptive analytics dashboards, document/certificate templates, mobile/offline reliability, and module-specific advanced backlogs across M0-M12.
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
- Repo-truth correction: onboarding checklist UI and provider/storage readiness surfaces are already implemented; remaining M0 provider work is staging/provider-specific verification depth.

M1 / M5 / M10
- EntitlementGuard on student-documents, document-access, photo, QR, siblings, academic-years (M1).
- 2026-06-13: M1 uploaded student documents now run a daily expiry-reminder pass for active/verified documents due within 30 days or already expired, queue guardian email/SMS reminders, suppress same-day duplicates, and write document history plus audit records.
- 2026-06-13: M1 admissions bulk import now posts real CSV content to the backend, supports dry-run validation and confirmed duplicate imports, preserves structured duplicate candidates per row, and shows row-level review details in the web import workflow.
- 2026-06-13: M1 student directory now uses the tenant-scoped `/students/iemis/validation` endpoint for class/section iEMIS readiness review, with issue counts and profile links for corrections.
- RequiredModule('activity') on media-access (M5).
- EntitlementGuard on all communications/messaging satellite controllers (M10).

M2 Attendance
- 2026-06-13: Monthly register CSV/PDF exports now use the shared authenticated web API helper with parsed backend errors and in-app success/failure states instead of raw URL `window.open` export links.
- Repo-truth correction: lock-window enforcement, working-day calendar policy, duplicate/concurrent session conflict handling, and operational anomaly detection/dashboard are already implemented; remaining M2 work is regression depth, smoke, and UX triage polish.

M3 Fees & Receipts
- 2026-06-13: Online payment webhooks now fail closed for non-success gateway events, reject missing references and zero-amount success events, and keep duplicate/already-paid protections covered by focused finance hardening tests.

M4 Academics
- 2026-06-13: Report-card PDF opening now uses the shared authenticated web helper with response validation and parsed error handling across the dedicated report-card workspace and the academics tab.
- Repo-truth correction: mark lock/unlock approval, dues-aware result withholding, and queued large-batch report-card generation already exist; remaining M4 work is focused regression/staging smoke plus retest/make-up exam workflow depth.

M5 Activity Feed
- 2026-06-13: Activity media preview/download now uses shared web blob helpers for authenticated response validation, empty-file checks, object URL cleanup, and app-controlled downloads.

M6 Homework / Timetable
- 2026-06-13: Homework detail, review, and student attachment opening now use homework-specific signed access helpers instead of generic file view calls, preserving assignment/submission ownership checks.

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
