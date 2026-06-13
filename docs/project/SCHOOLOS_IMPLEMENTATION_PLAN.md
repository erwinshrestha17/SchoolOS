# SchoolOS Implementation Plan

**Last updated:** 2026-06-13
**Status:** Consolidated active implementation plan and module backlogs  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard, Flutter companion app

---

## 1. Project Verdict and Readiness Status

### Current Status Verdict
* **Phase 0:** Completed
* **Phase 1A:** Completed / Pilot-Ready
* **Phase 1B:** Completed / Pilot-Ready
* **M0 Platform Core:** Foundation complete; provider/queue/API-key/File Registry hardening implemented; DTO validation added for provider status/support override/billing reason payloads; queue retry/discard race checks and single-job retry UX added; staging/object-storage/browser coverage remains.
* **M1 Admissions & Student Profiles:** Pilot-ready plus admission application pipeline, Student QR scan audit UI and operational analytics, storage/photo/logo, iEMIS artifact registration and class readiness review, duplicate candidate review, structured bulk-import duplicate review with persistent batch/row history, document audit/checklist expiry hardening, configurable automated document-expiry reminders, mobile child profile foundation, and satellite-controller entitlement gating.
* **M2 Smart Attendance:** Pilot-ready plus lock-window enforcement, working-day calendar policy, concurrent-session conflict handling, correction/offline-draft, rejected replay regressions, correction-review UI, operational anomaly dashboard, app-controlled monthly register exports, parent absence/late notifications and follow-up queue, mobile teacher scope, real-data teacher dashboard, and mobile parent attendance summary query validation.
* **M3 Fees & Receipts:** Pilot-ready plus receipt reprint history UI, printed receipt QR verification, reversal/refund approval foundation, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage, segmented overdue reminder backend, and HMAC-secured online payment webhook verification with duplicate/already-paid/failed-event guards plus dotted provider event fixtures.
* **M4 Academics / Exams / CAS / Report Cards:** Completed / Pilot-Ready with PDF/report/correction/snapshot polish, protected/app-controlled report-card PDF opening, and backend assessment template presets that create audited exam-term/component structures.
* **M5 Activity Feed & Milestones:** Strong foundation with media privacy, consent-aware blocking, optimized previews, app-controlled private media preview/download helpers, moderation controls, teacher media gallery, media-access gating, and backend milestone template presets.
* **M6 Homework / Timetable:** Completed / Pilot-Ready with File Registry attachments, homework-specific attachment access helpers, filtered homework template APIs, reminder hardening, absence/substitution conflict coverage, mobile homework/timetable views, and improved substitution slot selection / absence recording UI.
* **M7 HR / Payroll:** Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII/self-service bank masking, payroll reports, mobile staff self-service, and statutory deduction retrieval from active salary structures.
* **M8A Library:** Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, copy archive workflow, and reports/export polish.
* **M8B Transport:** Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports.
* **M8C Canteen:** Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, parent mobile views, serving allergy acknowledgement, and canteen workspace polish.
* **M9 Accounting:** Production-candidate / Pilot-Ready with PDFs, snapshots, audit trail, reconciliation suggestions, File Registry export support, and hardened bank statement import/reconciliation DTO validation.
* **M10 Notices / Communication / Chat:** Strong foundation with provider modes, attachments, failure dashboard, moderation/escalation, unread-recipient follow-up, mobile notification/chat surfaces, and full communications/messaging sub-controller entitlement gating.
* **M12 Learning Layer:** Production foundation implemented and verified under `apps/api/src/learning`, `apps/web` Learning routes, and `apps/schoolos_mobile/lib/features/learning`: activity builder, school-only sessions, session monitoring/heartbeat/participants, resource library, QR/code join, lab attempts, autosave/submit, MCQ/true-false/short-answer/matching/ordering evaluation, progress recording, parent child-scoped summary, student self-scoped mobile summary, tenant isolation, RBAC, entitlement, audit logging, Prisma migrations, and focused E2E/contract/mobile coverage.
* **Public Demo Requests:** Public POST intake plus platform operator list/detail/status-follow-up APIs and `/platform/demo-requests` review workspace with RBAC, audit logging, pagination/filtering, internal notes, public rate limiting, and tests.
* **Settings / Audit Visibility:** Settings audit-log access, support-override banner visibility, and live tenant role/permission inspection added with access-control tests.
* **M11 School Intelligence / AI:** Roadmap only.
* **SchoolOS Flutter Mobile:** Active companion app with scoped parent/student/teacher/staff/driver/admin surfaces where APIs exist.

### Overall Product Readiness
* **Demo-ready:** Yes
* **Internal QA-ready:** Yes
* **Controlled pilot-ready:** Yes, after staging checks and smoke verification
* **Multi-school production-ready:** Not yet
* **Full SchoolOS product complete:** No

**Remaining M1–M10 work:** Core modules are pilot-ready; enhancement depth, staging smoke, and mobile polish remain.

---

## 2. Strict Phase-Wise Implementation Plan

This order is mandatory. Do not start a later phase until the previous phase's exit criteria are fully met.

### Phase Gate 0 — Stabilize Main Before New Scope
* **Allowed work:** verification fixes, migration fixes, seed fixes, tenant isolation fixes, permission fixes, doc alignment, small code-file modularization in touched areas.
* **Blocked work:** AI, Angular migration, microservices, broad new modules, deep mobile expansion without purpose-limited APIs/ownership tests, live transport map/WebSocket/SSE UI, biometric workflows.
* **Exit criteria:**
  1. Prisma generate and validate pass.
  2. OpenAPI gate passes.
  3. Lint, typecheck, unit tests, API E2E, web E2E, build, verify:production pass.
  4. Local/staging smoke:pilot runs with API, web, Postgres, and Redis (or legacy alias `smoke:phase1`).
  5. Pending migrations are applied or intentionally parked with written reason.
  6. Seed data supports every dashboard module route used in browser smoke.
  7. No stale docs claim a module is next when it is already implemented.

### Phase 1 — Pilot Reliability for Existing Core
* **Scope:** Auth/Security, M0, M1, M2, M3, M5, M10, settings, reports, File Registry, notifications, public demo intake.
* **Focus:** staging secrets/session review, storage readiness, request/correlation logging, notification provider failure visibility, export/report history, tenant isolation tests, platform denial tests, entitlement enforcement tests, permission-denied/slow-session recovery web states, public demo request abuse controls.
* **Exit criteria:** One real school can run daily admissions, attendance, fees, notices, activity, settings, and platform operations without engineering handholding, and public demo intake can persist leads safely.

### Phase 2 — High-Value Academic and Finance Polish
* **Scope:** M4 Academics and M9 Accounting.
* **Focus:** staging object-storage/browser smoke, large-report threshold tuning, browser E2E execution, bank statement import/reconciliation browser smoke.
* **Exit criteria:** Academics and accounting can be sold as production-grade admin modules for the current Nepal school scope.

### Phase 3 — Harden Homework/Timetable and HR/Payroll
* **Scope:** M6 Homework/Timetable and M7 HR/Payroll.
* **Focus:** browser smoke in staging, mobile device smoke for teacher/staff flows, real-data QA for seeded assignments, substitution slot selection, payslips, statutory deductions, attendance, and leave workflows.
* **Exit criteria:** Academic coordinators, teachers, HR admins, and accountants can run these modules without direct database/admin intervention.

### Phase 4 — Harden Extended Operations Verticals
* **Scope:** M8A Library, M8B Transport, M8C Canteen.
* **Focus:** Library barcode/QR scan QA, transport driver device GPS runtime QA, canteen QR/POS speed polish, inventory/vendor edge-case staging coverage, and operation-specific Playwright tests.
* **Exit criteria:** Operations modules are reliable admin products, not just demos.

### Phase 5 — Mobile Companion, Parent, Driver, and Live Experiences
* **Scope:** Flutter parent/student/teacher/staff/driver/admin companion app depth.
* **Focus:** Secure storage, refresh token flow, role routing, error mapper, offline banner, network retry, push notifications.
* **Rules:** Use purpose-limited APIs, do not reuse admin-shaped responses directly, add ownership tests before release, and keep parent/student/driver data fail-closed.

### Phase 6 — M12 Learning Runtime Hardening
* **Scope:** Staging smoke, seeded browser E2E depth, UX polish, protected file upload picker integration, and school-only policy hardening for the implemented Learning foundation.
* **Current state:** M12 backend, web Learning workspace/runtime routes, parent/student web summary, and Flutter parent/student summary foundation are implemented and verified. Do not re-scatter learning logic into academics/students/homework.
* **Focus:** Validate real school fixtures, add end-to-end browser scenarios for activity create/edit/archive, matching/order creation, resource attach/archive, session launch/list/control, participant monitor, board heartbeat, student join/autosave/submit, parent child-scoped summary, and permission/module-denied states.
* **Exit criteria:** Staging proves one teacher can create/launch/monitor an activity, one student can join/autosave/submit, progress updates, and parent/student summaries remain non-comparative and child/self scoped.

### Phase 7 — M11 Intelligence / AI Readiness
* **Scope:** Roadmap only.
* **Rules:** No AI/ML runtime or LLM calls until approved, no automated punishment/risk action, human review is mandatory for recommendations, and tenant isolation + audit logging are mandatory.

---

## 3. Module Enhancement Rules

Before adding or expanding visible features:
1. Stabilize verification, migrations, seed data, smoke tests, and stale docs.
2. Keep the NestJS modular monolith.
3. Keep `tenantId` as the strict school/tenant boundary.
4. Enforce backend authorization even when frontend hides an action.
5. Keep parent, student, driver, and mobile APIs purpose-limited.
6. Do not use fake/mock/placeholder production data.
7. Do not mix SchoolOS SaaS billing with school fee collection.
8. Keep money flows idempotent and auditable.
9. Keep private files behind FileRegistryService and StorageService.
10. Keep AI/ML roadmap-only until reliable production data exists and M11 is approved.
11. Follow the web dashboard overhaul plan before broad visual redesign work.
12. Each school module should have dedicated web screens/workspaces for its real workflow.

---

## 4. Module-Wise Status and Backlog

### Cross-Cutting / All Modules
* **Current Status:** Basic foundations complete.
* **Staging / Verification Remaining:**
  - Broader cross-tenant denial tests on tenant-owned read/write paths.
  - Staging verification: `pnpm smoke:pilot` with Postgres, Redis, API, and web (or legacy alias `pnpm smoke:phase1`).
  - OpenAPI gate and full E2E/browser smoke rerun in a port-bindable environment.
* **Web Frontend Backlog:**
  - Permission-denied screens for direct route access.
  - Session-expiry and slow-network recovery states.
  - Module-locked empty states where plan lacks entitlement.
* **Mobile Frontend Backlog:**
  - Secure token refresh/logout hardening, role-aware route guards, session-expired/forbidden states.
  - Device smoke for teacher/staff/driver/parent flows.

### Auth, Security, and Tenant Isolation (94-97%)
* **Current Status:** Strong backend/browser-session foundation, JWT, CSRF, throttling, TenantActiveGuard, suspended-tenant file/export denial, active-session role/permission changes enforced from database lookups, reasoned and expiring platform support override checks with audit plus dashboard warning banner, live tenant role/permission inspection, mobile per-module gates, sub-controller entitlement gating, and platform high-risk security audit queries for failed logins, permission changes, tenant status changes, and support access.
* **Staging / Verification Remaining:**
  - Continue cross-tenant denial tests across all tenant-owned read/write paths.
  - Full browser session smoke for suspended-tenant UX messaging.
  - Permission-denied and session-expiry UX polish on web and mobile.
* **Backend Backlog:**
  - No source-confirmed Auth/Security backend implementation gap remains after the 2026-06-13 role-inspection and support-warning slice; continue verification and cross-tenant denial expansion before claiming production readiness.
* **Web Frontend Backlog:**
  - Continue permission-denied, session-expiry, and suspended-tenant UX polish across direct route access and long-running sessions.

### M0 Platform Core (87-91%)
* **Current Status:** Tenants, plans, usage tracking, SaaS billing foundation, platform audit logs, API keys, provider readiness queues, payment gateway aggregate readiness with validated-sandbox enforcement, File Registry, report exports, onboarding, structured platform operation DTOs, and bounded queue retry/discard race handling with per-job audited retry UX.
* **Staging / Verification Remaining:**
  - Provider-specific readiness staging (SMS/email/FCM/storage/gateway).
* **Backend Backlog:**
  - Continue provider-specific staging verification for SMS, email, FCM, object storage, and payment gateways using real provider/env setup.
  - Add queue failure grouping and richer queue diagnostics; retry/discard reasons and race/idempotency checks are implemented for single-job operations.
  - Add platform SaaS billing lifecycle without mixing it with school fee collection.
  - Add storage readiness verification for local, S3, R2, MinIO, and future adapters.
  - Add tenant onboarding state machine with audit trail.
* **Web Frontend Backlog:**
  - Guided tenant onboarding checklist: school profile, logo, academic year, classes, sections, fee heads, users, modules.
  - Visual plan comparison and entitlement warnings.
  - Provider health dashboard with disabled/mock/real mode labels.
  - Queue timeline and failure diagnostics without exposing secrets.
  - Storage readiness panel and report export history.

### M1 Admissions & Student Profiles (96-98%)
* **Current Status:** Admissions, admission application pipeline states, student records, guardian links, classes, sections, academic year context, Student QR generate/rotate/revoke with credential history, backend scan audit, and operational analytics surfaced through backend APIs, protected photos/documents, logo storage, duplicate candidate review, structured CSV bulk-import row review with duplicate candidate metadata plus persistent import batch/row history, student lifecycle timeline API/UI, student-level iEMIS readiness score/issues, class/section iEMIS readiness review in the student directory, document audit/checklist expiry hardening, configurable automated document-expiry reminder templates/jobs, and parent-safe mobile child profile foundation. Gated by EntitlementGuard.
* **Staging / Verification Remaining:**
  - Continue ownership and document-access cross-tenant tests.
  - Duplicate warning and sibling/guardian relationship resolution.
* **Backend Backlog:**
  - Continue ownership/document cross-tenant regression depth for generated document, import-history, QR analytics, admission-application, and guardian-removal file access paths.
  - Pilot feedback refinements for transfer-certificate / ID-card wording, application workflow labels, and import-review workflows.
* **Web Frontend Backlog:**
  - Admission draft autosave and recovery.
  - Sibling/guardian relationship resolution UI.
  - Unified cross-module student profile timeline beyond the implemented lifecycle history tab.
  - Bulk document checklist review and export for admissions/admin teams.
  - iEMIS export preparation refinements after pilot feedback.
* **Mobile Frontend Backlog:**
  - Child switcher, QR identity, and safe document previews.
  - Teacher quick student profile scoped to assigned classes only.

### M2 Smart Attendance (96-98%)
* **Current Status:** Roster, lock-window enforcement, correction/offline drafts, rejected replay, concurrent submission conflict handling, working-day calendar policy, correction review UI, monthly register reports/exports, operational anomaly dashboard, child-scoped parent absence/late notifications, repeated absence/late follow-up queue, mobile teacher scope, parent attendance, and real-data teacher dashboard.
* **Staging / Verification Remaining:**
  - Continue browser/mobile smoke and UX depth for correction/offline states.
* **Backend Backlog:**
  - Continue regression coverage for lock-window override, correction audit, duplicate-session conflicts, anomaly calculations, and calendar policy edge cases before claiming production readiness.
  - Exam-day policy refinements after pilot timetable/exam fixture feedback.
  - Pilot feedback tuning for parent notification wording, channels, and follow-up queue thresholds.
* **Web Frontend Backlog:**
  - Dedicated attendance workspace polish around bulk present, exception workflows, correction queue filtering, and report discoverability.
  - Attendance anomaly dashboard filters and principal/admin triage polish.
* **Mobile Frontend Backlog:**
  - Offline attendance draft queue with sync status (pending, synced, failed, retry).
  - Teacher assigned-class roster and bulk present.
  - Parent/student monthly attendance calendar with reason display.

### M3 Fees & Receipts (96-98%)
* **Current Status:** Fee setup, invoices, student ledger, payments, receipts, printed receipt QR verification, receipt reprint with audit history UI, reversal/refund approval foundation, cashier close, reconciliation, CSV exports, protected day-end PDFs, aging-bucket/min-max overdue defaulter segmentation with child-scoped reminder delivery/audit, and HMAC online payment webhook verification with duplicate, already-paid, missing-reference, zero-amount, dotted success/failure/pending provider events, and failed/pending event guards.
* **Staging / Verification Remaining:**
  - Reversal/refund/cashier-close isolation tests and gateway sandbox verification.
* **Backend Backlog:**
  - Sandbox/staging payment gateway verification before enabling real gateways.
  - Provider-specific gateway sandbox smoke before enabling real gateways.
  - Scholarship/discount adjustment workflow after invoice creation.
  - Additional cashier-close concurrency and idempotency coverage.
* **Web Frontend Backlog:**
  - Cashier-first collection screen (search student, partial/full collect, print/share).
  - Reusable fee templates by class, transport, canteen, exam, activity, scholarship, discount.
  - Receipt QR verification public-facing wording polish after pilot school feedback.
  - Day-end cashier close by cash, bank, manual reference, and future gateway mode.
  - Overdue reminder preview UI for the existing backend defaulter segmentation.
* **Mobile Frontend Backlog:**
  - Parent fee dashboard, invoice/receipt list/detail, PDF download/share, due alerts.
  - Payment initiation remains disabled until gateway verification is staging-proven.

### M4 Academics / Exams / CAS / Report Cards (98-100%)
* **Current Status:** Subjects, exams, marks, CAS, mark lock/unlock workflow, tenant grading scale/rounding policy, dues-aware result withholding, queued large-batch report-card generation, protected report-card PDFs, backend assessment template presets for terminal and theory/practical exam structures, and report/correction/history/snapshot/grading-policy workspace polish.
* **Staging / Verification Remaining:**
  - Report generation failure and correction tests.
  - Smoke `/dashboard/academics/report-cards`.
* **Backend Backlog:**
  - Regression coverage for mark lock/correction/result-publish/report-card queue edge cases before claiming production readiness.
  - Retest/make-up exam handling.
  - Pilot tuning for large batch thresholds and queue observability after staging fixtures.
* **Web Frontend Backlog:**
  - UI polish for the backend exam-term and assessment-component template presets.
  - Teacher-friendly marks grid with autosave and absent/withheld/retest states.
  - Rubric-based CAS entry and progress timeline.
  - Report-card template polish with school branding and remarks after the protected PDF helper path.
  - Promotion readiness dashboard (automatic calculation plus manual decision).
* **Mobile Frontend Backlog:**
  - Exam schedule, published marks, report-card list/detail, PDF download/share.
  - Show only published results and permission-safe data.

### M5 Activity Feed & Milestones (92-96%)
* **Current Status:** Private media, consent-aware media blocking, optimized previews, app-controlled media preview/download helpers, moderation controls, teacher media gallery, media-access gating, deterministic Montessori/ECD/primary milestone template presets, post-create media/database cleanup on downstream failures, and cross-surface feed/gallery/parent/dashboard invalidation after post mutations.
* **Staging / Verification Remaining:**
  - Consent/media cross-tenant tests.
  - Protected media browser smoke.
* **Backend Backlog:**
  - Stronger consent-aware media tests across guardian changes and removed students.
  - Delivery retry idempotency for activity notifications.
* **Web Frontend Backlog:**
  - Improved teacher post composer with class/section/student audience preview.
  - Image compression, upload retry, and low-bandwidth preview behavior after the protected media helper path.
  - UI picker for the backend Montessori/ECD/primary milestone template presets.
  - Moderation queue with reason, restore/archive, and audit trail.
* **Mobile Frontend Backlog:**
  - Parent child-specific feed and activity detail.
  - Teacher create post with image compression and audience selection.
  - Signed media preview/download refresh behavior.

### M6 Homework & Timetable (98-100%)
* **Current Status:** Reminders, homework-specific attachment access helpers, filtered metadata-backed homework template APIs, timetable conflicts, substitutions, slot selection, absence recording, and homework create/publish UI payload alignment with backend `dueDate`, `submissionRequired`, and publish endpoint contracts.
* **Staging / Verification Remaining:**
  - Attachment and conflict lifecycle tests.
  - Dashboard route smoke and substitution mutation smoke.
* **Backend Backlog:**
  - Continue pilot tuning for homework templates, recurring homework, and scheduled reminders.
  - Attachment lifecycle and reminder re-check tests.
  - Timetable workload balancing and conflict scoring.
  - Substitution workflows linked to staff leave/absence.
* **Web Frontend Backlog:**
  - Drag-and-drop timetable builder polish.
  - Homework template library UI backed by the filtered template endpoint and recurring assignment UI.
  - Homework completion reports and teacher workload report.
  - Substitution calendar with teacher availability.
* **Mobile Frontend Backlog:**
  - Teacher homework creation with attachments.
  - Parent/student homework detail, offline viewing, due reminders, submission status.
  - Weekly timetable and substitution alerts.

### M7 HR & Payroll (96-100%)
* **Current Status:** Posting locks, reversals, PII/self-service bank masking, payroll reports, statutory deduction retrieval from active salary structures, and payroll-run UI boundaries that stop at review/approve/post without exposing disbursement or mark-paid controls.
* **Staging / Verification Remaining:**
  - PII/approval/post/reverse tests.
  - HR/payroll mutation smoke.
* **Backend Backlog:**
  - Staff lifecycle timeline and contract expiry reminders.
  - Shift/check-in/check-out support.
  - Leave balance rules and leave-without-pay payroll impact.
  - Salary structure versioning and payroll draft safety.
  - Payroll reversal/accounting reconciliation regression coverage.
* **Web Frontend Backlog:**
  - Staff profile timeline (joined, contract changed, leave, payroll, documents, exit).
  - Leave calendar and approval queue polish.
  - Salary template and allowance/deduction rule UI.
  - Branded payslip PDF polish and payroll report filters.
* **Mobile Frontend Backlog:**
  - Leave request creation, leave approval, payslip detail/download, attendance/check-in, staff notices.
  - Salary/bank fields masked unless permission allows.

### M8A Library (93-96%)
* **Current Status:** CRUD, book copies, fines, QR lookup, staff borrowers, fine-to-fees/accounting boundary, scanner-first UI, copy archive workflow with audit reason, reports/export polish, and required audited reasons for lost/damaged copy status changes.
* **Staging / Verification Remaining:**
  - Lost/damaged/fine posting tests.
  - Reports/export smoke.
* **Backend Backlog:**
  - Lost/damaged lifecycle and fine/replacement workflows.
  - Holiday-aware overdue fine calculation.
  - Student/staff borrower policy differences.
  - Fine posting/payment reconciliation idempotency tests.
* **Web Frontend Backlog:**
  - ISBN/barcode entry and full metadata (author, publisher, category, shelf).
  - Scanner-first issue/return flow with student QR and book barcode.
  - Overdue, lost books, fine summary, and popular books reports.
  - Book/archive workflow polish after the copy archive path, including pilot labels for history retention.
* **Mobile Frontend Backlog:**
  - Borrowed books, due dates, fine warnings, book search, book detail.
  - Librarian scanner workflows after device QA.

### M8B Transport (91-95%)
* **Current Status:** Routes, stops, vehicles, assignments, trips, Redis GPS latest-location cache with persisted-history fallback metadata, driver/parent scoped trip surfaces, and trip-history exports.
* **Staging / Verification Remaining:**
  - Route and end-to-end GPS retention smoke.
  - Route and CSV smoke.
* **Backend Backlog:**
  - Background/automated driver GPS ping flow after device-auth contracts.
  - GPS ingestion acceptance/rejection reports.
  - Route deviation, overspeed, geofence, and ETA (deferred until live tracking approved).
  - Vehicle/driver overlapping trip validation and one-day route changes.
* **Web Frontend Backlog:**
  - Trip history and GPS quality reports.
  - Live map only after SSE/WebSocket decision and load testing (intentionally deferred).
* **Mobile Frontend Backlog:**
  - Driver start trip, stop list, boarded/dropped/absent, emergency contact, complete trip.
  - Background GPS permission flow, location sync status, retry queue.
  - Parent bus status: not started, en route, delayed, arrived, stale GPS.

### M8C Canteen (93-97%)
* **Current Status:** Menu, plans, POS, wallets, inventory, vendors, receipt JSON/PDF, stock hardening with atomic manual decrement guards, wallet guards, linked invoice handoff, parent mobile views, serving allergy acknowledgement, and workspace polish.
* **Staging / Verification Remaining:**
  - POS reversal/wallet guard smoke.
  - POS/report smoke.
* **Backend Backlog:**
  - POS double-submit and receipt reprint idempotency tests.
  - Backend policy/regression coverage for allergy and medical warning enforcement after pilot serving rules are finalized.
  - Daily/monthly spending controls and low-balance events.
  - Stock close, wastage reports, and vendor bill edit locks.
* **Web Frontend Backlog:**
  - POS speed polish with QR/student search, wallet balance, allergy warning, and receipt after device/browser QA.
  - Daily/weekly menu planner.
  - Inventory low-stock alerts, vendor purchase reports, wastage reports.
  - Meal-plan cancellation and linked invoice status clarity.
* **Mobile Frontend Backlog:**
  - Parent wallet balance, meal plan, today's menu, low-balance alert.
  - Student meal QR.
  - Canteen scanner and serve meal flow after device QA.

### M9 Accounting & Finance (98-100%)
* **Current Status:** Accounts, journals, source-record drilldown, reports, reconciliation, PDFs, snapshots, audit, bank statement DTO/import validation, and reconciliation DTOs.
* **Staging / Verification Remaining:**
  - Fiscal lock/reversal/export failure and bank reconciliation browser tests.
  - Report/export/import/reconciliation smoke.
* **Backend Backlog:**
  - Nepal school-friendly default chart of accounts templates.
  - Fiscal close/reopen safety and period-lock regression coverage.
  - Reversal/correction-only enforcement for posted records.
  - Source mapping checks for fees, payroll, canteen, library, and transport.
  - Large-report background export thresholds.
* **Web Frontend Backlog:**
  - Accountant dashboard for fiscal status, unreconciled items, pending postings, export history.
  - Bank reconciliation review with manual confirmation polish.
  - Report snapshots and large export progress UI.
* **Mobile Frontend Backlog:**
  - Principal read-only finance snapshot only; no full COA/journal editing on mobile.

### M10 Notices / Communication / Chat (94-97%)
* **Current Status:** Notices, deliveries, events, consents, notice-detail, notification-center, parent-teacher chat, messaging-hardening, and audited delivery retry reasons. Delivery retry now preserves existing tenant-scoped/idempotent backend claims, records operator reasons for single and bulk retry attempts, and the web retry panel requires those reasons while showing backend `RETRY_PENDING` state.
* **Staging / Verification Remaining:**
  - Provider failure, retry, moderation, attachment tests.
  - Provider-mode browser smoke.
* **Backend Backlog:**
  - Real provider callback verification (duplicate, forged, failed, delayed, out-of-order).
  - Provider-disabled fail-closed behavior for retry dispatch.
  - Quiet-hours and moderation policy enforcement for chat.
  - Attachment access tests after guardian removal or role change.
* **Web Frontend Backlog:**
  - Notice templates (holiday, fee reminder, emergency, exam, transport delay, event).
  - Recipient preview before high-impact notices.
  - Unread follow-up UI polish.
  - Communication audit for emergency and high-impact messages.
* **Mobile Frontend Backlog:**
  - Push notifications, notification center polish, notice attachment preview.
  - Chat read receipts, quiet-hours banner, report/block/escalation flow.

### M12 Learning Layer (Production Foundation Implemented)
* **Current Status:** M12 foundation implemented on 2026-06-12. Dedicated `LearningModule` is registered in the API and owns activities, questions, sessions, participants, attempts, answers, progress, resources, and parent summaries. Web and Flutter summary/runtime surfaces consume real APIs.
* **Implemented Backend/API:**
  - Activity CRUD/archive with Easy / Medium / Hard difficulty, activity modes, language modes, question attachment, pagination/filtering, and teacher assignment validation.
  - School-only session launch/list/detail/control with generated session codes, QR token hashes, pause/resume/end, heartbeat, participant monitor, expiry fail-closed behavior, and safe student/teacher payloads.
  - Attempt start/autosave/submit with idempotent writes, MCQ/true-false/normalized short-answer/matching/ordering evaluation, score/accuracy calculation, and progress updates only after final submission.
  - Class/student progress APIs with section/subject/date filters and parent child-scoped non-comparative learning summary.
  - Resource library CRUD/archive/list/attach endpoints with FileAsset-backed private-file references and audit logging.
  - `module.learning`, `feature.learning.basic`, `feature.learning.full`, learning permission catalog, role defaults, audit logs, and tenant-scoped Prisma queries.
* **Implemented Web/Mobile:**
  - Typed web API client for activities, sessions, attempts, progress, parent summary, resources, heartbeat, participants, and matching/order payloads.
  - Teacher/admin Learning workspace with activity builder, question editor, resource panel, session list/control/monitor, board/lab launch links, and progress views.
  - Smart-board runtime with question navigation, status/expiry banner, and heartbeat integration.
  - Student lab runtime with join, idempotent start/resume, autosave status, submit confirmation, unanswered warning, and safe submitted summary.
  - Parent web summary with child switcher and supportive labels only.
  - Flutter parent/student Learning summary foundation with child/self-scoped API calls.
* **Database:** `LearningActivity`, `LearningQuestion`, `LearningSession`, `LearningParticipant`, `LearningAttempt`, `LearningAnswer`, `LearningProgress`, and `LearningResource` models plus migrations `20260612120000_m12_learning_layer_foundation` and `20260612143000_m12_learning_completion`.
* **Staging / Verification Remaining:**
  - Apply migrations in staging and verify with real school fixtures.
  - Add seeded browser E2E for the completed Learning frontend flows.
  - School-only network/device policy hardening beyond authenticated membership and expiring code/QR token.
* **Backend Backlog:**
  - Optional scheduled-session lifecycle/expiry job if sessions need background expiration beyond fail-closed reads.
  - Protected file upload picker workflow for Learning resources if teachers need file registration from the Learning UI.
  - Future resource recommendation/library search depth after pilot usage.
* **Web Frontend Backlog:**
  - Browser E2E coverage for activity builder, board, lab, resources, participant monitor, and parent summary.
  - Selector UX polish for large class/subject/student datasets.
  - More polished protected file-picker integration for resources.
* **Mobile Frontend Backlog:**
  - Continue parent/student summary polish only; do not build full lab or smart-board runtime first.

### M11 School Intelligence & AI (Roadmap Only - 0%)
* **Current Status:** No active implementation.
* **Backend Backlog:**
  - Analytics data mart or reporting-safe aggregation layer only after production data quality is proven.
  - Tenant-safe aggregation and anonymization controls.
  - Explainability and audit storage for recommendations.
  - Human-review workflow for every AI-generated insight.
* **Web Frontend Backlog:**
  - Principal insight dashboard only after approved backend foundations.
  - Insight confidence, evidence, recommended action, and "human reviewed" status.
* **Mobile Frontend Backlog:**
  - Show reviewed, permission-gated insights only.
  - Do not show raw prediction scores to parents/students.

---

## 5. Verification Commands

Run relevant checks after meaningful changes:

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
pnpm smoke:pilot          # Legacy alias: pnpm smoke:phase1
```

For mobile changes:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
```

---

## 6. Non-Negotiable Rules

1. Tenant isolation is mandatory.
2. Parent/student/mobile APIs must be purpose-limited and fail closed.
3. SchoolOS SaaS billing must not mix with school fee collection.
4. Money flows must be idempotent and auditable.
5. Confirmed financial records must use reversal/correction workflows.
6. Private files must use StorageService/FileRegistryService boundaries.
7. Provider-disabled/mock modes must be honest in UI.
8. Do not implement AI/analytics until reliable production data exists.
9. Do not introduce microservices or Angular migration without explicit owner approval.
10. Apply code-file modularization gradually in touched areas, not as a risky repo-wide rewrite.
