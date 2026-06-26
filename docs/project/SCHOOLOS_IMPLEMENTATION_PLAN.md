# SchoolOS Implementation Plan

**Last updated:** 2026-06-20
**Status:** Consolidated implementation backlog and module history. Current readiness evidence lives in `SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`; active execution sequencing lives in `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard, Flutter companion app

Backend/web/mobile scope allocation is defined in `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`. That reference prevents cross-surface duplication but does not turn every listed capability into an active task; sequencing remains governed by `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` and current repository evidence.

Active education scope now includes Preschool, School (Grade 1-10), Higher Secondary / +2, and Bachelor's direction over one shared core. Bachelor's implementation remains a later design/validation phase after pilot hardening and needs schema, OpenAPI, shared-contract, RBAC/entitlement, tenant-isolation, student self-scope, seed, browser/mobile, and staging proof. Master's is not a full current management pack; it is future extension and Student App eligibility only.

---

## 1. Project Verdict and Readiness Status

### Current Status Verdict

Use the audit statuses and scores for current readiness:

```text
Product Implementation Completion Score: 74 / 100
Production Deployment Readiness Score: 50 / 100
Current recommended target: Internal QA
Next execution phase: Phase 1 - Realistic Seeded Tenant, Role Assignment, and Smokeable Demo Flows
```

The repository has broad implemented foundations across M0-M13, web, mobile, File Registry, RBAC, entitlement, finance/accounting/payroll, learning, and platform operations. The blocking issue is not lack of source code; it is missing proof for realistic seeded flows, authenticated browser E2E, mobile device QA, staging deployment, provider/storage checks, backup restore, and pilot operation.

### Overall Product Readiness
* **Demo-ready:** Local-only
* **Internal QA-ready:** Yes
* **Controlled pilot-ready:** Conditional, after staging checks, authenticated browser E2E, mobile emulator QA, backup restore, and pilot smoke verification
* **Single-school production-ready:** No
* **Multi-school production-ready:** Not yet
* **Full SchoolOS product complete:** No

**Verification snapshot:** On 2026-06-18, root lint/typecheck/test/E2E/build and local `pnpm verify:production` passed with caveats. On 2026-06-21, local Docker Postgres/Redis/API seed/smoke evidence passed after staff seed idempotency was fixed. `pnpm test:web:e2e` still has only public-browser checks passing with authenticated checks skipped. See `SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` for exact command results.

**Remaining work categories:** authenticated browser E2E, mobile role/device QA, provider/staging verification, backup/restore, monitoring, pilot feedback, keeping seed/smoke repeatable, later Bachelor's design/validation, and future AI. M14 remains roadmap/deferred.

---

## 2. Historical Phase-Wise Implementation Backlog

The focused active delivery sequence is now `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`. The section below is retained as historical module backlog context and must not be used to override the next-phase plan or the readiness audit.

Do not start a later next-phase delivery item until the corresponding exit criteria in `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` are met.

### Phase Gate 0 — Stabilize Main Before Frontend Scope
* **Allowed work:** verification fixes, migration fixes, seed fixes, tenant isolation fixes, permission fixes, doc alignment, small code-file modularization in touched areas.
* **Blocked work:** AI, Angular migration, microservices, broad new modules, deep mobile expansion without purpose-limited APIs/ownership tests, live transport map/WebSocket/SSE UI, biometric workflows.
* **Current local status:** Root local gates pass with the caveats documented in the 2026-06-18 audit. Local pilot smoke did not pass in the audit because required services were not running.
* **Exit criteria:**
  1. Prisma generate and validate pass.
  2. OpenAPI gate passes.
  3. Lint, typecheck, unit tests, API E2E, web E2E, build, verify:production pass.
  4. Local smoke suites run with API, web, Postgres, and Redis: `pnpm smoke:pilot`, `pnpm smoke:learning`, and `pnpm smoke:full`.
  5. Pending migrations are applied in the target environment or intentionally parked with written reason.
  6. Seed data supports every dashboard module route used in browser smoke.
  7. No stale docs claim a module is next when it is already implemented.

### Phase 1 — Frontend Implementation for Existing Core
* **Scope:** Auth/Security, M0, M1, M2, M3, M5, M12, settings, reports, File Registry, notifications, public demo intake, and the pre-AI Advanced Operations frontend shell.
* **Focus:** Real API-backed web workspaces, loading/empty/error/success/permission-denied/module-locked states, server-side pagination/filtering, app-controlled confirmations, seeded browser E2E, and staging secrets/session/provider review.
* **Exit criteria:** One real school can run daily admissions, attendance, fees, notices, activity, settings, and platform operations without engineering handholding, and public demo intake can persist leads safely.

### Phase 2 — High-Value Academic and Finance Polish
* **Scope:** M4 Academics and M11 Accounting.
* **Focus:** staging object-storage/browser smoke, large-report threshold tuning, browser E2E execution, bank statement import/reconciliation browser smoke.
* **Exit criteria:** Academics and accounting can be sold as production-grade admin modules for the current Nepal school scope.

### Phase 3 — Harden Homework/Timetable and HR/Payroll
* **Scope:** M6 Homework/Timetable and M7 HR/Payroll.
* **Focus:** browser smoke in staging, mobile device smoke for teacher/staff flows, real-data QA for seeded assignments, substitution slot selection, payslips, statutory deductions, attendance, and leave workflows.
* **Exit criteria:** Academic coordinators, teachers, HR admins, and accountants can run these modules without direct database/admin intervention.

### Phase 4 — Harden Extended Operations Verticals
* **Scope:** M8 Library, M9 Transport, M10 Canteen.
* **Focus:** Library barcode/QR scan QA, transport driver device GPS runtime QA, canteen QR/POS speed polish, inventory/vendor edge-case staging coverage, and operation-specific Playwright tests.
* **Exit criteria:** Operations modules are reliable admin products, not just demos.

### Phase 5 — Mobile Companion, Parent, Driver, and Live Experiences
* **Scope:** Flutter parent/student/teacher/staff/driver/admin companion app depth.
* **Focus:** Secure storage, refresh token flow, role routing, error mapper, offline banner, network retry, push notifications.
* **Rules:** Use purpose-limited APIs, do not reuse admin-shaped responses directly, add ownership tests before release, and keep parent/student/driver data fail-closed.

### Phase 6 — M13 Learning Runtime Hardening
* **Scope:** Staging smoke, seeded browser E2E depth, UX polish, protected file upload picker integration, and school-only policy hardening for the implemented Learning foundation.
* **Current state:** M13 backend, web Learning workspace/runtime routes, parent/student web summary, and Flutter parent/student summary foundation are implemented and verified. Do not re-scatter learning logic into academics/students/homework.
* **Focus:** Validate real school fixtures, add end-to-end browser scenarios for activity create/edit/archive, matching/order creation, resource attach/archive, session launch/list/control, participant monitor, board heartbeat, student join/autosave/submit, parent child-scoped summary, and permission/module-denied states.
* **Exit criteria:** Staging proves one teacher can create/launch/monitor an activity, one student can join/autosave/submit, progress updates, and parent/student summaries remain non-comparative and child/self scoped.

### Phase 7 — M14 Intelligence / AI Readiness
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
10. Keep AI/ML roadmap-only until reliable production data exists and M14 is approved.
11. Follow `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` and `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` before broad web/mobile visual redesign work.
12. Each school module should have dedicated web screens/workspaces for its real workflow.

---

## 4. Module-Wise Status and Backlog

### Cross-Cutting / All Modules
* **Current Status:** Basic foundations complete.
* **Staging / Verification Remaining:**
  - Broader cross-tenant denial tests on tenant-owned read/write paths.
  - Staging verification: `pnpm smoke:pilot`, `pnpm smoke:learning`, and `pnpm smoke:full` with Postgres, Redis, API, and web.
  - Seeded browser E2E and browser smoke rerun in a port-bindable staging environment.
* **Web Frontend Backlog:**
  - Frontend implementation is the next active phase after backend/migration stabilization.
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
* **Current Status:** Tenants, plans, usage tracking, SaaS billing foundation, platform audit logs, API keys, provider readiness queues, payment gateway aggregate readiness with validated-sandbox enforcement, File Registry, report exports, computed onboarding checklist plus audited manual override workflow, structured platform operation DTOs, queue failure grouping/detail diagnostics, and bounded queue retry/discard race handling with per-job audited retry UX.
* **Staging / Verification Remaining:**
  - Provider-specific readiness staging (SMS/email/FCM/storage/gateway).
* **Backend Backlog:**
  - Continue provider-specific staging verification for SMS, email, FCM, object storage, and payment gateways using real provider/env setup.
  - Continue deployed queue-topology smoke for the implemented queue health, failure grouping, detail diagnostics, and retry/discard workflows.
  - Continue platform SaaS billing lifecycle staging verification; implemented lifecycle paths must remain separate from school fee collection and M11 accounting posting.
  - Continue real-environment storage smoke for the implemented local, S3, R2, and MinIO-compatible readiness surfaces.
  - Formal tenant onboarding state transitions are not required for current backend closure; the accepted pilot model is computed checklist state plus audited platform overrides. Reopen only if product requires additional onboarding statuses, approvals, or rollback transitions.
* **Web Frontend Backlog:**
  - Guided tenant onboarding checklist: school profile, logo, academic year, classes, sections, fee heads, users, modules.
  - Visual plan comparison and entitlement warnings.
  - Provider health dashboard with disabled/mock/real mode labels.
  - Queue timeline and failure diagnostics without exposing secrets.
  - Storage readiness panel and report export history.

### M1 Admissions & Student Profiles (96-98%)
* **Current Status:** Admissions now has one backward-compatible `AdmissionApplication`-backed Admission Case model across office/walk-in, parent online, phone inquiry, transfer request, and import sources. The backend owns school/scoped policy resolution, eligibility, simple display statuses, tenant-scoped placement and duplicate checks, principal-approval enforcement, audited review actions, authorized duplicate override, serializable retry-safe direct admission/finalization, guardian reuse without silent profile overwrite, protected document attachment, and non-financial student follow-ups. The web provides a choose-path entry, progressive three-step direct wizard, scoped policy settings, paginated simple queues, missing-detail/document completion, focused case review/finalization, success/profile/add-another actions, and student-profile follow-up cards. Principal mobile has a purpose-limited read-only admissions snapshot. Existing legacy application routes remain compatibility contracts, not a second active product workflow. Student records, guardian links, QR, lifecycle, iEMIS, import, document hardening, and earlier M1 security coverage remain in place. Gated by EntitlementGuard.
* **Staging / Verification Remaining:**
  - Run authenticated browser E2E for direct admission, policy-routed review, duplicate override denial/approval, approved finalization, protected document attachment, and follow-up profile cards against a seeded tenant.
  - Run principal mobile admissions snapshot device QA against the same seeded backend; mobile admission writes remain intentionally out of scope.
  - Continue deeper HTTP/E2E ownership and document-access cross-tenant tests beyond ownership audit, guardian-removal file-access review, draft autosave/recovery, import-review queue coverage, and application status mutation coverage, especially standalone generated-document retrieval, import-history, QR analytics mutation paths, and successful admission-application enrollment conversion paths.
  - Duplicate warning and sibling/guardian relationship resolution.
* **Backend Backlog:**
  - Continue route-level and E2E ownership/document cross-tenant regression depth for generated document, import-history, QR analytics, successful admission-application enrollment conversion, and remaining guardian file-access paths.
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
* **Current Status:** Roster, lock-window enforcement, correction/offline drafts, rejected replay, concurrent submission conflict handling, working-day calendar policy, correction review UI, monthly register reports/exports, operational anomaly dashboard, focused regression coverage for anomaly detection across active roster counts, non-working/exam-day calendar policy, not-marked sessions, missing roster records, high absence rates, anomaly audit metadata, and cutoff automation for locked not-marked sessions, child-scoped parent absence/late notifications, retry-safe duplicate suppression for parent absence/late notifications and repeated follow-up dispatch, repeated absence/late follow-up queue, mobile teacher scope, parent attendance, and real-data teacher dashboard.
* **Staging / Verification Remaining:**
  - Continue browser/mobile smoke and UX depth for correction/offline states.
* **Backend Backlog:**
  - Continue regression coverage for lock-window override, correction audit, duplicate-session conflicts, offline sync conflict rules, and broader calendar policy edge cases before claiming production readiness.
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
* **Current Status:** Fee setup, invoices, student ledger, payments, receipts, printed receipt QR verification, receipt reprint with audit history UI, reversal/refund approval foundation, legacy payment-reversal compatibility route mapped to the reversal workflow and permission, cashier close, method-specific cashier close overlap rules, reconciliation, CSV exports, protected day-end PDFs, payment idempotency race handling, cashier-close unique-window race coverage plus HTTP method-specific isolation coverage, aging-bucket/min-max overdue defaulter segmentation with child-scoped reminder delivery/audit, service-hardened scholarship/waiver and invoice-adjustment workflows after invoice creation with HTTP tenant/paid-invoice denial coverage, HMAC online payment webhook verification, and purpose-limited parent payment intents with persisted idempotency, linked-child invoice scope, HTTPS checkout validation, exact-amount callback reconciliation, and receipt posting after verified success.
* **Staging / Verification Remaining:**
  - Broader reversal/refund/cashier-close HTTP isolation tests and gateway sandbox verification.
* **Backend Backlog:**
  - Execute and record provider-specific sandbox/staging payment intent, callback, duplicate callback, failed callback, and settlement/reconciliation smoke before enabling a real gateway.
  - Broader payment/cashier browser and HTTP workflow coverage, including cashier-close by manual reference and gateway mode once staging gateway verification exists.
* **Web Frontend Backlog:**
  - Cashier-first collection screen (search student, partial/full collect, print/share).
  - Reusable fee templates by class, transport, canteen, exam, activity, scholarship, discount.
  - Receipt QR verification public-facing wording polish after pilot school feedback.
  - Day-end cashier close by cash, bank, manual reference, and future gateway mode.
  - Overdue reminder preview UI for the existing backend defaulter segmentation.
* **Mobile Frontend Backlog:**
  - Parent fee dashboard, invoice/receipt list/detail, PDF download/share, due alerts.
  - Parent payment initiation is implemented as a network-only, backend-gated checkout flow. It remains unavailable unless the backend reports validated sandbox, intent adapter, signed webhook, and settlement configuration readiness; device/staging gateway evidence is still required before a release claim.

### M4 Academics / Exams / CAS / Report Cards (98-100%)
* **Current Status:** Subjects, exams, marks, CAS, mark lock/unlock workflow, teacher marks autosave/draft backend support, absent/withheld/retest mark-state coverage, tenant grading scale/rounding policy, dues-aware result withholding, queued large-batch report-card generation with partial-failure job surfacing and retry-safe already-generated locked-card skipping, protected report-card PDFs, backend assessment template presets for terminal and theory/practical exam structures, and report/correction/history/snapshot/grading-policy workspace polish.
* **Staging / Verification Remaining:**
  - Correction/regeneration staging smoke.
  - Smoke `/dashboard/academics/report-cards`.
* **Backend Backlog:**
  - Regression coverage for mark lock/correction/result-publish edge cases before claiming production readiness.
  - Broader retest/make-up exam workflow depth beyond mark-state persistence.
  - Pilot tuning for large batch thresholds and queue observability after staging fixtures.
* **Web Frontend Backlog:**
  - UI polish for the backend exam-term and assessment-component template presets.
  - Teacher-friendly marks grid UI integration for autosave and absent/withheld/retest states.
  - Rubric-based CAS entry and progress timeline.
  - Report-card template polish with school branding and remarks after the protected PDF helper path.
  - Promotion readiness dashboard (automatic calculation plus manual decision).
* **Mobile Frontend Backlog:**
  - Exam schedule, published marks, report-card list/detail, PDF download/share.
  - Show only published results and permission-safe data.

### M5 Activity Feed & Milestones (92-96%)
* **Current Status:** Private media, consent-aware media blocking, removed-guardian parent feed visibility denial, optimized previews, app-controlled media preview/download helpers with direct signed-preview checks for active linked children, all tagged-student consent, and archived/rejected/soft-deleted post denial, moderation controls, teacher media gallery, media-access gating, deterministic Preschool and School (Grade 1-10) milestone template presets, backend class/section/student audience preview, active-student-only tagged-post validation and activity notification delivery, retry-pending delivery replay idempotency, post-create media/database cleanup on downstream failures, and cross-surface feed/gallery/parent/dashboard invalidation after post mutations.
* **Staging / Verification Remaining:**
  - Consent/media cross-tenant tests.
  - Protected media browser smoke.
* **Backend Backlog:**
  - No current-code M5 backend backlog remains; protected preview/download paths share tenant, actor-scope, post-status, file-asset, and consent checks.
* **Web Frontend Backlog:**
  - Improved teacher post composer consuming the backend class/section/student audience preview.
  - Image compression, upload retry, and low-bandwidth preview behavior after the protected media helper path.
  - UI picker for the backend Preschool and School (Grade 1-10) milestone template presets.
  - Moderation queue with reason, restore/archive, and audit trail.
* **Mobile Frontend Backlog:**
  - Parent child-specific feed and activity detail.
  - Teacher create post with image compression and audience selection.
  - Signed media preview/download refresh behavior.

### M6 Homework & Timetable (98-100%)
* **Current Status:** Reminders, reminder batch history/retry routes, homework-specific attachment access helpers, filtered metadata-backed homework template APIs, timetable conflicts, substitutions, staff-leave-approved draft substitution task linkage, slot selection, absence recording, and homework create/publish UI payload alignment with backend `dueDate`, `submissionRequired`, and publish endpoint contracts.
* **Staging / Verification Remaining:**
  - Attachment and conflict lifecycle tests.
  - Dashboard route smoke and substitution mutation smoke.
* **Backend Backlog:**
  - Continue pilot tuning for homework templates, recurring homework, and scheduled reminders.
  - Attachment lifecycle and reminder re-check tests.
  - Timetable workload balancing and conflict scoring.
  - Continue pilot tuning for substitution calendar behavior and leave/absence mutation smoke.
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

### M8 Library (93-96%)
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

### M9 Transport (91-95%)
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

### M10 Canteen (93-97%)
* **Current Status:** Menu, plans, POS, wallets, inventory, vendors, receipt JSON/PDF, stock hardening with atomic manual decrement guards, wallet guards, linked invoice handoff, parent mobile views, serving allergy acknowledgement, and workspace polish.
* **Staging / Verification Remaining:**
  - POS reversal/wallet guard smoke.
  - POS/report smoke.
* **Backend Backlog:**
  - No current-code M10 backend closure blocker remains after monthly spending controls, low-balance events, stock close, wastage reports, supplier purchase reports, vendor bill edit locks, serving warning acknowledgement, POS/wallet guards, and local backend/root/smoke gates.
  - Continue regression depth for POS double-submit, receipt reprint idempotency, and allergy/medical warning enforcement after pilot serving rules are finalized.
* **Web Frontend Backlog:**
  - POS speed polish with QR/student search, wallet balance, allergy warning, and receipt after device/browser QA.
  - Daily/weekly menu planner.
  - Inventory low-stock alerts, vendor purchase reports, wastage reports.
  - Meal-plan cancellation and linked invoice status clarity.
* **Mobile Frontend Backlog:**
  - Parent wallet balance, meal plan, today's menu, low-balance alert.
  - Student meal QR.
  - Canteen scanner and serve meal flow after device QA.

### M11 Accounting & Finance (98-100%)
* **Current Status:** Accounts, Nepal school-friendly chart template preview/import, journals, source-record drilldown, source-mapping health checks for fees/payroll/canteen/library/transport, reports, reconciliation, PDFs, retry-safe File Registry report snapshot reuse, synchronous export row thresholds plus queued background General Ledger/Cash Book exports through File Registry, platform-visible `accounting-reports` queue health/failure diagnostics, audit, bank statement DTO/import validation, and reconciliation DTOs.
* **Staging / Verification Remaining:**
  - Fiscal lock/reversal/export failure and bank reconciliation browser tests.
  - Report/export/import/reconciliation smoke.
* **Backend Backlog:**
  - No current-code M11 backend backlog remains; fiscal close/reopen, period-lock posting denial, and posted-record reversal/correction-only enforcement are covered by backend service/E2E tests.
* **Web Frontend Backlog:**
  - Accountant dashboard for fiscal status, unreconciled items, pending postings, export history.
  - Bank reconciliation review with manual confirmation polish.
  - Report snapshots and large export progress UI.
* **Mobile Frontend Backlog:**
  - Principal read-only finance snapshot only; no full COA/journal editing on mobile.

### M12 Notifications / Notices / Communication / Chat (94-97%)
* **Current Status:** Notices, deliveries, events, consents, high-impact recipient preview, notice-detail, notification-center, parent-teacher chat, messaging-hardening, HMAC-signed SMS/email/FCM provider callback verification, sanitized provider callback failures, duplicate/out-of-order provider status guards, provider-disabled retry fail-closed behavior, role-aware chat quiet-hours, escalation write locks with reopen-on-resolve, File Registry-backed notice attachment signing with raw object-key suppression, legacy messaging parent/guardian live-link scoping with unsafe attachment suppression and tenant-only SSE change signals, and audited delivery retry reasons. Delivery retry now preserves existing tenant-scoped/idempotent backend claims, records operator reasons for single and bulk retry attempts, skips lost retry races with per-row diagnostics, blocks disabled providers without enqueueing sends, and the web retry panel requires those reasons while showing backend `RETRY_PENDING` state.
* **Staging / Verification Remaining:**
  - Provider failure, retry, moderation, attachment tests against staging fixtures.
  - Provider-specific signed callback staging smoke against real SMS/email/FCM fixtures.
  - Provider-mode browser smoke.
* **Backend Backlog:**
  - No current-code M12 backend backlog remains. Add attachment access tests when a future parent-teacher chat attachment schema/workflow is introduced.
* **Web Frontend Backlog:**
  - Notice templates (holiday, fee reminder, emergency, exam, transport delay, event).
  - Unread follow-up UI polish.
  - Communication audit for emergency and high-impact messages.
* **Mobile Frontend Backlog:**
  - Push notifications, notification center polish, notice attachment preview.
  - Chat read receipts, quiet-hours banner, report/block/escalation flow.

### M13 Learning Layer (Production Foundation Implemented)
* **Current Status:** M13 foundation implemented on 2026-06-12. Dedicated `LearningModule` is registered in the API and owns activities, questions, sessions, participants, attempts, answers, progress, resources, and parent summaries. Web and Flutter summary/runtime surfaces consume real APIs.
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

### M14 Intelligence / AI (Roadmap Only - 0%)
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

## 5. Advanced Operations Consolidated Plan

**Status:** Active pre-AI implementation blueprint merged from the former advanced operations plan.
**Scope:** Nepal-first advanced school operations before M14 Intelligence / AI.

Advanced Operations deepens production workflows without introducing AI/ML/LLM runtime. It uses deterministic workflows, explicit business rules, human approvals, audit trails, tenant-scoped access, queued work, and File Registry-backed documents/exports.

Current implementation status:

```text
Backend foundation: Implemented for approval workflows, deterministic automation, descriptive analytics summaries, document templates/generated documents, verification/access logs, and data export jobs.
Migration: apps/api/prisma/migrations/20260615090000_advanced_operations_foundation adds advanced-operations enums, tenant-scoped tables, indexes, and foreign keys.
Local verification: root gates passed on 2026-06-18 with caveats; local Phase 1 seed/smoke passed on 2026-06-21. See `SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
Still pending: staging migration apply/deploy, seeded browser E2E, frontend workspaces, mobile/offline workflow depth, provider/staging checks, and pilot feedback.
M14 AI: Deferred/roadmap only.
```

### Advanced Operations Purpose

The goal is to deepen real Nepali school workflows around:

1. Tenant onboarding and SaaS operations.
2. Admissions and student lifecycle.
3. Attendance and parent notifications.
4. Fees, receipts, cashier close, and reconciliation.
5. Academics, exams, report cards, and promotion.
6. Homework, timetable, and substitutions.
7. HR, leave, payroll, and staff self-service.
8. Library, transport, canteen, and accounting.
9. Parent/staff/driver mobile self-service and controlled student lab/session access.
10. Approval workflows, rules-based automation, descriptive analytics, exports, verification/access logs, and document templates.

Nepal-school operating context to preserve:

| Reality | Product implication |
|---|---|
| Cash, bank deposit, cheque, QR/wallet, and online references may coexist | Fee collection supports multiple modes, references, cashier close, and reconciliation. |
| Parent app usage may be inconsistent | Notices, fee reminders, attendance alerts, and transport messages need channel fallback behavior. |
| Schools use mixed Nepali and English | Notices, receipts, certificates, reports, and templates must be localization-ready. |
| Internet can be unstable | Attendance, homework viewing, parent summaries, and driver workflows need offline/cache/retry states where practical. |
| Student records may start in paper/Excel | CSV import, preview, validation errors, duplicate review, and legacy import batches are required. |
| IEMIS-style reporting pressure exists | Maintain reporting-ready fields and validation/export readiness without claiming unsupported government integration. |
| SEE and Grade 11-12 workflows matter | Support exam terms, report cards, practicals, projects, streams, subject combinations, and board-prep fields. |
| Smart boards/shared labs may arrive before 1:1 devices | Learning prioritizes teacher-led board mode, lab mode, and printable fallback before adaptive/AI learning. |
| Transport and student safety are selling points | Routes, stops, vehicles, drivers, GPS status, boarding/deboarding, emergency contacts, and stale-location warnings matter. |

### Advanced Operations Guardrails

1. Keep the NestJS modular monolith.
2. Scope all tenant-owned reads, writes, jobs, exports, file access, and analytics by authenticated `tenantId`.
3. Keep parent, student, driver, and mobile APIs purpose-limited; do not expose admin-shaped responses.
4. Keep money flows idempotent and auditable.
5. Use reversal/correction workflows for confirmed financial records.
6. Keep private files behind File Registry and StorageService boundaries.
7. Require reason, actor, timestamp, and audit trail for sensitive actions.
8. Avoid fake/mock production data.
9. Keep provider-disabled/mock modes explicit in the UI.
10. Do not implement AI/ML/LLM runtime under this plan.
11. Add browser/mobile smoke coverage for user-facing workflows before readiness claims.
12. Add ownership and cross-tenant denial tests for every new parent/student/mobile/driver endpoint.

### Build Order

| Phase | Scope |
|---|---|
| Phase A - Pre-AI Pilot Depth | Frontend workspaces for implemented approval, automation, analytics, document-template, and export foundations; tenant onboarding wizard; student lifecycle/IEMIS readiness; fee workflows; attendance automation/offline polish; parent mobile self-service; controlled student lab/session access; communication read receipts/follow-ups; exam/report-card/certificate generation; seeded browser E2E and staging smoke. |
| Phase B - Premium Private-School Operations | Timetable conflict/substitution engine; transport GPS/driver/parent hardening; canteen POS/wallet controls; scanner-first library; HR leave/payroll self-service; accounting reconciliation polish; Grade 11-12 streams/practicals/projects; export center and document template system. |
| Phase C - SaaS Maturity Before AI | Usage-based plan limits; add-on entitlements; provider health center; queue operations center; advanced audit/security dashboard; multi-branch support if needed; backup/export/recovery; reporting-safe aggregation for future M14. |

### Cross-Cutting Advanced Features

| Feature | Model / API ownership | Required workflows | Remaining work |
|---|---|---|---|
| Approval Workflow Engine | `ApprovalRequest`, `ApprovalStep`, `ApprovalDecision`, `ApprovalPolicy`, `ApprovalComment`, `ApprovalAttachment`; advanced approvals routes under `/api/v1/advanced/approvals/*` | Fee reversal/refund, scholarship/discount, marks correction, attendance correction, leave request, payroll posting/reversal, transfer/withdrawal, document deletion/archive, high-impact notice, platform support override | Frontend workspace, module-specific final-action wiring, browser E2E, staging migration apply, pilot feedback |
| Rules-Based Automation Engine | `AutomationRule`, `AutomationTrigger`, `AutomationCondition`, `AutomationAction`, `AutomationExecutionLog`, `AutomationFailure`; `/api/v1/advanced/automation/*` | Absent notification, attendance cutoff reminder, fee due reminder, unread notice follow-up, staff-leave substitution, library overdue, canteen low wallet, bus started notification, result published notification, tenant suspended blocking | Rule management UI, module-specific catalog depth, browser E2E, staging validation, pilot tuning |
| Descriptive Analytics Dashboards | `/api/v1/advanced/analytics/summaries`, `/refresh` | Principal, attendance, fee, academic, homework, communication, transport, canteen, library, HR, platform dashboards | Dashboard frontend, summary refresh coverage, seeded browser E2E, staging validation, pilot metric tuning |
| Document and Template System | `DocumentTemplate`, `GeneratedDocument`, `DocumentVerificationToken`, `DocumentPrintHistory`, `DocumentAccessLog`; `/api/v1/advanced/document-templates/*` | Fee receipt, report card, transfer/character/bonafide/attendance certificates, student/staff ID, exam admit-card-style document, payment due letter, notice PDF | Template builder/generation screens, PDF/template polish, browser E2E, staging validation, pilot wording/localization |
| Export Jobs | `/api/v1/advanced/exports`, `/retry` | Large data exports, report history, retry failed export, File Registry download | Export center UI, queue status, retry UX, staging smoke |
| Mobile and Offline Reliability | Flutter feature-specific queues and cache | Offline draft, retry queue, sync status, conflict state, expired session, forbidden state, module locked state, stale data indicator | Teacher attendance drafts, parent child summary, receipts/notices, driver GPS/trip queue, staff leave/payslip, scanner flows after device QA |

Approval acceptance criteria:

- Requests are tenant-scoped.
- Rejecting requires a reason.
- Applying final action is idempotent.
- Related module screens show approval state.
- Sensitive approvals expose safe before/after context.

Automation acceptance criteria:

- Rules can be enabled/disabled per tenant/feature.
- Executions log trigger, action, target, and result.
- Failed actions are retry-safe and auditable.
- Provider-disabled modes do not pretend messages were delivered.

Document/template acceptance criteria:

- Templates support school logo/header/footer.
- Templates are localization-ready for English/Nepali labels.
- Generated PDFs include timestamp, generated-by, and optional QR verification.
- Reprints are logged.
- Protected documents use File Registry access controls.

### Module-Wise Advanced Blueprint

| Module | Advanced features to preserve | Backend ownership | Web/mobile routes | Acceptance criteria |
|---|---|---|---|---|
| M0 Platform Core | Onboarding wizard, school level configuration, Grade 11-12 enablement, plans/entitlements, usage counters, provider dashboard, queue center, storage readiness, support override, audit, export center, suspension preview | `apps/api/src/platform/onboarding`, `tenants`, `providers`, `entitlements`, `queues`, `audit` | `/dashboard/platform/tenants`, `/dashboard/platform/providers`, `/dashboard/platform/queues`, `/dashboard/platform/audit`, `/dashboard/platform/exports` | Setup changes audited, modules fail closed, secrets masked, queue retries require reason, support banner visible |
| M1 Admissions and Students | Pipeline, draft autosave, document checklist/expiry, duplicate review, lifecycle timeline, QR ID, ID card, transfer certificate, alumni, sibling/guardian resolution, IEMIS readiness, legacy import review | `students`, `admissions`, `student-documents`, `student-qr`, `imports` | `/dashboard/admissions/*`, `/dashboard/students/[id]/*`, `/dashboard/students/imports`, `/dashboard/students/iemis-readiness` | Guardian removal revokes access, QR actions audited, duplicate merge never automatic, inactive students filtered from active rosters |
| M2 Attendance | Teacher workspace, expanded attendance states, offline draft queue, lock window, correction approval, duplicate session prevention, calendar policy, parent notifications, exports, follow-up queue | `attendance`, `attendance-corrections`, `attendance-reports` | `/dashboard/attendance`, `/dashboard/attendance/corrections`, `/dashboard/attendance/reports`, teacher/parent mobile attendance | Offline sync cannot silently overwrite newer data, corrections include before/after reason, parent notifications child-scoped |
| M3 Fees and Receipts | Fee builder, assignment rules, cashier collection, cash/bank/cheque/QR/gateway/adjustment modes, QR verification, reversal/refund, discount adjustment, cashier close, gateway sandbox, reminders, parent dashboard | `fees`, `receipts`, `cashier-close`, `payment-gateways`, `reconciliation` | `/dashboard/fees/collect`, `/dashboard/fees/reversals`, `/dashboard/fees/cashier-close`, `/dashboard/fees/reconciliation`, parent mobile fees | Double-submit cannot duplicate receipts, gateway webhooks handle duplicate/forged/delayed/out-of-order cases, confirmed receipts use reversal |
| M4 Academics | Exam templates, marks autosave grid, absent/withheld/retest/practical/project states, lock/unlock approval, result publish, report-card template/QR, batch PDF queue, promotion dashboard, Grade 11-12 streams/practicals/projects | `academics`, `exams`, `report-cards`, `promotions` | `/dashboard/academics/exams`, `/marks-entry`, `/report-cards`, `/promotion`, `/streams`, parent/student published results | Parents see published results only, locked marks require correction workflow, report failures safe, stream changes audited |
| M5 Activity Feed | Audience preview, Preschool and School (Grade 1-10) milestones, class/section/student posts, consent-aware media, compression/retry/previews, moderation queue, parent child feed, gallery, retry idempotency | `activity-feed`, `media-access`, `consents` | `/dashboard/activity/*`, parent activity, teacher composer | Parent sees linked child-safe media only, removed guardians lose access, failed upload cleanup, moderation audited |
| M6 Homework and Timetable | Templates, recurring homework, reminders, submission states, review/comments/marks, offline viewing, builder, conflict scoring, workload, room/lab allocation, leave-substitution linkage, substitution alerts | `homework`, `timetable`, `substitutions` | `/dashboard/homework/*`, `/dashboard/timetable/*`, teacher/parent mobile | Attachments protected, students/parents see assigned/published homework, conflicts blocked/acknowledged, substitutions notify where enabled |
| M7 HR and Payroll | Staff lifecycle, documents, contract reminders, attendance/check-in/out, leave balances/approvals, LWP payroll impact, salary versioning, payroll review/approve/post/reverse, payslip polish, staff self-service | `hr`, `payroll`, `staff-attendance`, `leave` | `/dashboard/hr/*`, `/dashboard/payroll/*`, staff mobile | Salary/bank masked unless allowed, posted payroll uses reversal, accounting linked where enabled, staff self-service own-data only |
| M8 Library | Metadata/barcode/shelf, copy QR/barcode, scanner issue/return, borrower policies, holiday-aware fines, lost/damaged lifecycle, fine-to-fees/accounting, reservations, reports, parent/student due views | `library`, `library-fines` | `/dashboard/library/*`, optional parent/student library views | Copies with history archived, fine posting idempotent, scoped views, scanner device QA before production claims |
| M9 Transport | Vehicles/doc expiry, driver/conductor assignment, routes/stops, student assignments, driver trip operations, boarding/deboarding/absent, GPS stale warnings, parent bus status, trip history/GPS quality, emergency, maintenance, fee mapping | `transport`, `transport-gps`, `transport-trips` | `/dashboard/transport/*`, driver mobile, parent transport | Parent sees assigned child route only, stale GPS labeled, overlapping trips blocked unless allowed, live maps deferred until policy/load test |
| M10 Canteen | Fast POS, wallets/top-up/adjustment, spending controls, low balance, allergy warnings, menu planner, inventory, stock close/wastage, vendors/bill locks, receipt idempotency, parent wallet/menu/spending, student meal QR | `canteen`, `canteen-pos`, `canteen-wallets`, `canteen-inventory`, `canteen-vendors` | `/dashboard/canteen/*`, parent canteen, POS tablet/mobile | POS double-submit safe, wallet debit atomic, allergy warning before serving, parent child-scoped |
| M11 Accounting and Finance | Chart templates, journal/voucher approval, source mappings from fees/payroll/canteen/library/transport, bank import/reconciliation, fiscal lock/close/reopen, reversal-only posted records, reports, large export progress, principal read-only snapshot | `accounting`, `accounting-reconciliation`, `accounting-reports` | `/dashboard/accounting/*`, principal read-only summary later | Posted records not silently edited, source drilldown works, fiscal lock blocks unsafe backdated changes, mobile finance read-only unless approved |
| M12 Notifications, Notices, Communication, Chat | Notice templates, recipient preview, targeting, scheduling, read receipts/follow-up, provider callback verification, provider-disabled behavior, quiet hours, report/block/escalation, high-impact audit, attachment preview, notification center | `communications`, `notices`, `messaging`, `notification-providers` | `/dashboard/notices/*`, `/dashboard/messages/*`, parent/teacher mobile | Attachments remain protected after guardian/role changes, high-impact messages audited, diagnostics safe, teacher communication scoped |
| M13 Learning Layer | Curriculum topic map, manual question bank, template worksheet generator, smart-board/lab polish, session replay/summary, resource library folders, protected file picker, printable fallback, parent/student summaries, browser E2E | `learning`, `learning-resources`, `learning-progress` | `/dashboard/learning/*`, `/classroom/board/*`, `/student/learning/*`, `/parent/learning/*` | Learning does not duplicate core systems, parent summaries child-scoped/non-comparative, public leaderboards out of scope, AI/adaptive/simulations/open chat deferred |

### M14 AI Deferred Rule

M14 remains roadmap-only until:

1. Reliable production data exists across attendance, fees, academics, communication, and learning.
2. Tenant-safe analytics/aggregation exists.
3. Parent/student/mobile APIs are purpose-limited and tested.
4. Sensitive actions have approval and audit trails.
5. Data quality issues are visible.
6. Human review exists for future recommendations.
7. Product owner explicitly approves AI scope.

Do not implement:

```text
LLM calls
Open student AI chat
Automated punishment/risk action
Raw prediction scores for parents/students
Cross-tenant model data leakage
Unreviewed recommendations
```

### Definition of Done for Advanced Operations

1. Backend API is tenant-scoped and permission-gated.
2. Parent/student/mobile endpoints are purpose-limited where applicable.
3. Sensitive writes are audited.
4. Money writes are idempotent.
5. File access uses File Registry/StorageService boundaries.
6. Web UI has loading, empty, forbidden, module-locked, and error states.
7. Mobile UI has session-expired/forbidden/network states where applicable.
8. Background jobs re-check tenant, feature, entity, and provider state.
9. E2E or focused regression coverage exists for the critical path.
10. Staging smoke is run before readiness claims are updated.

---

## 6. Verification Commands

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

## 7. Non-Negotiable Rules

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
