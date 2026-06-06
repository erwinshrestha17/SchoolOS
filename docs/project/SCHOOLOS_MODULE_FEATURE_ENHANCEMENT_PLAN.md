# SchoolOS Module Feature Enhancement Plan

**Status:** Active module-wise feature and enhancement backlog  
**Last updated:** 2026-06-06  
**Purpose:** Capture module-wise feature scope, enhancement direction, backend/frontend ownership, and implementation order for future SchoolOS work.

**Pilot-ready vs remaining:** M1–M10 core backend APIs and dashboard workspaces are implemented and pilot-ready for current scope. Sections 4–15 below describe **enhancement and production-depth backlog** — not missing greenfield modules. For a consolidated per-module remaining list, read `SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md` Section 11.

This document complements:

```text
README.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
docs/project/SCHOOLOS_STORAGE_AND_FILE_REGISTRY.md
docs/project/SCHOOLOS_TRANSPORT_REALTIME_READINESS.md
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
docs/design/SCHOOLOS_WEB_DASHBOARD_UI_UX_OVERHAUL_PLAN.md
```

Do not treat this as permission to start broad new scope. Follow the active implementation phase gate first.

---

## 1. Enhancement Rules

Before adding or expanding visible features:

```text
1. Stabilize verification, migrations, seed data, smoke tests, and stale docs.
2. Keep the NestJS modular monolith.
3. Keep `tenantId` as the strict school/tenant boundary.
4. Enforce backend authorization even when frontend hides an action.
5. Keep parent, student, driver, and mobile APIs purpose-limited.
6. Do not use fake/mock/placeholder production data.
7. Do not mix SchoolOS SaaS billing with school fee collection.
8. Keep money flows idempotent and auditable.
9. Keep private files behind FileRegistryService and StorageService.
10. Keep AI/ML roadmap-only until reliable production data exists and the owner explicitly approves M11.
11. Follow the web dashboard overhaul plan before broad visual redesign work.
12. Each school module should have dedicated web screens/workspaces for its real workflow.
```

Enhancement priority order:

```text
Phase Gate 0 -> verification, migrations, seed data, tenant isolation, permissions, doc alignment
Phase 1 -> Auth/Security, M0, M1, M2, M3, M5, M10, settings, reports, File Registry, notifications
Phase 2 -> M4 Academics and M9 Accounting production polish
Phase 3 -> M6 Homework/Timetable and M7 HR/Payroll hardening
Phase 4 -> M8A Library, M8B Transport, M8C Canteen operational QA
Phase 5 -> Flutter parent/student/teacher/staff/driver/admin companion app depth
Phase 6 -> M11 intelligence only after reliable production data exists
```

### 2026-06-06 implementation snapshot (what is done vs what sections below still describe)

```text
Done for current pilot scope (M1–M10)
- Backend: NestJS modules, Prisma persistence, tenant isolation, RBAC, plan entitlements on primary and satellite controllers (M1 documents/QR/photo/siblings/academic-years; M5 media-access; M10 all communications/messaging sub-controllers).
- Web: Dashboard workspaces wired to real APIs for students, admissions, attendance, fees, academics, activity, homework, timetable, HR, payroll, accounting, library, transport, canteen, notices, messaging, settings, reports.
- Platform: /platform/demo-requests operator workspace for marketing lead review.
- Mobile: Flutter companion surfaces where purpose-limited APIs exist.

Still described in sections below (remaining enhancement depth)
- M1: lifecycle timeline, duplicate depth, QR audit UI, iEMIS readiness panel.
- M2: offline sync conflict rules, anomaly dashboard, lock-window audit.
- M3: gateway sandbox, refund approval workflow, cashier-first UI polish.
- M4: grading policy, promotion readiness, marks grid autosave.
- M5: moderation queue polish, milestone templates, consent media test depth.
- M6: homework templates, drag-and-drop builder polish, workload reports.
- M7: staff lifecycle timeline, leave calendar, salary template UI.
- M8A/B/C: lost/damaged library flows, live transport map (deferred), canteen allergy enforcement, device QA.
- M9: COA templates, source-ledger drilldown, fiscal close regression.
- M10: provider callback verification, notice templates, push notification depth.
- Cross-cutting: staging smoke, cross-tenant tests, permission-denied UX, mobile session hardening.
```

---

## 2. Auth, Security, and Tenant Isolation

### Current feature scope

- Login, logout, browser session foundation, JWT issuer/audience validation.
- Cookie-first browser auth and bearer-token-compatible API/mobile direction.
- CSRF protection, throttling, request IDs, structured logging.
- RBAC, role/permission checks, route gating, and support override foundation.
- Production secret/cookie validation.

### Enhancement backlog

Backend:

- Add complete suspended-tenant denial coverage across API, file downloads, exports, queue jobs, provider actions, and mobile APIs.
- Add cross-tenant denial tests for every tenant-owned read/write path.
- Enforce role changes during active sessions through backend permission checks.
- Add support override expiry checks, reason requirements, and detailed audit entries.
- Add high-risk security audit queries for failed logins, permission changes, tenant status changes, and support access.

Web frontend:

- Add clearer permission-denied screens for direct route access.
- Add session-expiry and slow-session recovery states.
- Add admin role/permission inspection UI: “What can this role access?”
- Add support override warning banner when platform support is acting inside a tenant.

Mobile frontend:

- Strengthen secure token refresh/logout handling.
- Add role/permission-aware route guards.
- Add safe session-expired and forbidden states.

Definition of done:

```text
No tenant-owned data path depends on frontend-only security. Every denial has backend coverage and user-safe UI feedback.
```

---

## 3. M0 Platform Core

### Current feature scope

- Tenant management, plan and feature access, usage tracking.
- SaaS billing foundation, platform audit logs, API keys.
- Provider readiness, queues, failed-job inspection/retry.
- File Registry, report exports, onboarding, and storage boundary hardening.

### Enhancement backlog

Backend:

- Add provider-specific readiness checks for SMS, email, FCM, object storage, and payment gateways.
- Add queue failure grouping, retry reason, discard reason, and retry idempotency checks.
- Add platform SaaS billing lifecycle without mixing it with school fee collection.
- Add storage readiness verification for local, S3, R2, MinIO, and future adapters.
- Add tenant onboarding state machine with audit trail.

Web frontend:

- Add guided tenant onboarding checklist: school profile, logo, academic year, classes, sections, fee heads, users, modules.
- Add visual plan comparison and entitlement warnings.
- Add provider health dashboard with disabled/mock/real mode labels.
- Add queue timeline and failure diagnostics without exposing secrets.
- Add storage readiness panel and report export history.

Mobile frontend:

- No deep M0 admin mobile scope by default.
- Add admin/principal mobile read-only health summary only after purpose-limited APIs exist.

Definition of done:

```text
A new school can be onboarded, configured, verified, and audited without direct database intervention.
```

---

## 4. M1 Admissions and Student Profiles

### Current feature scope

- Admissions, student records, guardian links, classes, sections, academic year context.
- Student QR, protected photos/documents, logo storage.
- iEMIS artifact registration, duplicate candidate review, document audit.
- Parent-safe mobile child profile foundation.

### Enhancement backlog

Backend:

- Improve duplicate detection for Nepali names, English names, mixed scripts, guardian phone reuse, and sibling scenarios.
- Add student lifecycle timeline: admitted, class changed, transferred, withdrawn, graduated, rejoined, archived.
- Add QR revoke/rotate history and QR scan audit.
- Add document expiry/reminder metadata for common school documents.
- Add student-level official/IEMIS readiness score and missing-field reasons.
- Add import review queue for partial/duplicate legacy records.

Web frontend:

- Add admission draft autosave and recovery.
- Add clearer duplicate warning and sibling/guardian relationship resolution UI.
- Add student profile timeline across admissions, attendance, fees, documents, academics, communication, and lifecycle.
- Add QR management UI: generate, revoke, rotate, view audit.
- Add document checklist with missing/expired/verified status.
- Add iEMIS readiness panel per student and class.
- Align Students/Admissions/Profile screens with the dedicated web dashboard overhaul route plan.

Mobile frontend:

- Improve parent/student profile with child switcher, QR identity, class/section, attendance, homework, fees, report cards, activity, and safe document previews.
- Add teacher quick student profile with only assigned-class data.

Definition of done:

```text
Student Profile becomes the single source of truth for a child’s operational, academic, guardian, fee, document, and lifecycle history.
```

---

## 5. M2 Smart Attendance

### Current feature scope

- Teacher attendance, attendance roster, correction/offline draft foundation.
- Rejected replay regressions, correction review UI, mobile teacher scope.
- Parent attendance and real-data teacher dashboard.

### Enhancement backlog

Backend:

- Strengthen offline attendance sync with deterministic conflict rules.
- Add lock-window enforcement and correction workflow audit.
- Add duplicate session prevention for concurrent teachers.
- Add absence streak, repeated late, and attendance anomaly calculations.
- Add holiday/weekend/exam-day policy integration.

Web frontend:

- Add a dedicated attendance workspace with class/section/date context, attendance register, draft/submit states, exception marking, correction queue, and reports.
- Support bulk present and exception workflows without framing the experience around shortcut or tap-count concepts.
- Add correction request/review workflow with reason and audit history.
- Add class/month/student attendance reports and exports.
- Add attendance anomaly dashboard for principal/admin.

Mobile frontend:

- Add offline attendance draft queue with sync status: pending, synced, failed, retry.
- Add teacher assigned-class roster and bulk present support.
- Add parent/student monthly attendance calendar with reason display.

Definition of done:

```text
Attendance works reliably under poor connectivity and concurrent usage without duplicate or silent overwrite risk, and the web UX is a dedicated School Management System attendance workspace.
```

---

## 6. M3 Fees and Receipts

### Current feature scope

- Fee setup, invoices, student ledger, payments, receipts, receipt PDFs.
- Receipt reprint, reversal, cashier close, reconciliation.
- Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage.

### Enhancement backlog

Backend:

- Add sandbox/staging payment gateway verification before enabling real gateways.
- Add webhook duplicate, forged, delayed, and out-of-order handling tests.
- Add refund/reversal approval workflow with reason and audit.
- Add scholarship/discount adjustment workflow after invoice creation.
- Add cashier-close concurrency and idempotency coverage.

Web frontend:

- Add cashier-first collection screen: search student, view dues, collect partial/full, print/share receipt.
- Add reusable fee templates by class, transport, canteen, exam, activity, scholarship, and discount.
- Add receipt QR verification and reprint history.
- Add day-end cashier close by cash, bank, manual reference, and future gateway mode.
- Add overdue reminder preview and defaulter segmentation.

Mobile frontend:

- Add parent fee dashboard, invoice list/detail, receipt list/detail, PDF download/share, due alerts.
- Keep payment initiation disabled until gateway verification and idempotency are ready.

Definition of done:

```text
A cashier can replace manual fee ledgers for pilot workflows while receipts, dues, reversals, refunds, and accounting remain reconciled.
```

---

## 7. M4 Academics, Exams, CAS, and Report Cards

### Current feature scope

- Subjects, exams, marks, CAS, locks, report-card PDFs.
- Report/correction/history/snapshot polish.
- Backend/admin UI is pilot-ready for current scope.

### Enhancement backlog

Backend:

- Add tenant-configurable grading scale and rounding policy.
- Add marks lock/unlock approval workflow with reason and audit.
- Add retest/make-up exam handling.
- Add result withholding policy integration with dues where enabled.
- Add large report-card batch generation thresholds and background jobs.

Web frontend:

- Add exam-term and assessment-component templates.
- Add teacher-friendly marks grid with autosave and absent/withheld/retest states.
- Add rubric-based CAS entry and progress timeline.
- Add report-card template polish with school branding and remarks.
- Add promotion readiness dashboard with automatic calculation plus manual decision.

Mobile frontend:

- Add exam schedule, published marks, report-card list/detail, and PDF download/share.
- Show only published results and permission-safe data.

Definition of done:

```text
Academics can support exam setup, marks/CAS, result publication, report-card history, and promotion workflows without unsafe manual database intervention.
```

---

## 8. M5 Activity Feed and Milestones

### Current feature scope

- Activity feed, private media, consent-aware media blocking.
- Optimized previews, moderation controls, teacher media gallery.
- Milestones/development-oriented foundation.

### Enhancement backlog

Backend:

- Add stronger consent-aware media tests across guardian changes and removed students.
- Add media upload cleanup for post-create failures.
- Add moderation state cache invalidation and removed-content disappearance checks.
- Add delivery retry idempotency for activity notifications.

Web frontend:

- Add improved teacher post composer with class/section/student audience preview.
- Add image compression, upload retry, and low-bandwidth preview behavior.
- Add Montessori/ECD milestone templates.
- Add moderation queue with reason, restore/archive, and audit trail.

Mobile frontend:

- Add parent child-specific feed and activity detail.
- Add teacher create post with image compression and audience selection.
- Add signed media preview/download refresh behavior.

Definition of done:

```text
Activity Feed becomes a trusted parent-engagement surface with consent-safe private media and clear moderation history.
```

---

## 9. M6 Homework and Timetable

### Current feature scope

- Homework and timetable backend/admin/mobile surfaces for current scope.
- File Registry attachments, reminders, conflict validation, substitutions.
- Absence/substitution conflict hardening.

### Enhancement backlog

Backend:

- Add homework templates, recurring homework, and scheduled reminders.
- Add attachment lifecycle and reminder re-check tests.
- Add stronger timetable workload balancing and conflict scoring.
- Add substitution workflows linked to staff leave/absence.

Web frontend:

- Add drag-and-drop timetable builder polish.
- Add homework template library and recurring assignment UI.
- Add homework completion reports and teacher workload report.
- Add substitution calendar with teacher availability.

Mobile frontend:

- Add teacher homework creation with attachments.
- Add parent/student homework detail, offline viewing, due reminders, and submission status.
- Add weekly timetable and substitution alerts.

Definition of done:

```text
Academic coordinators and teachers can run homework, timetable, substitutions, reminders, and workload checks without direct admin/database intervention.
```

---

## 10. M7 HR and Payroll

### Current feature scope

- Staff records, HR attendance/leave, payroll, payslips, reports.
- Posting locks, accounting integration, reversals, PII masking.
- Mobile staff self-service foundation.

### Enhancement backlog

Backend:

- Add staff lifecycle timeline and contract expiry reminders.
- Add shift/check-in/check-out support where required.
- Add leave balance rules and leave-without-pay payroll impact.
- Add salary structure versioning and payroll draft safety.
- Add payroll reversal/accounting reconciliation tests.

Web frontend:

- Add staff profile timeline: joined, contract changed, leave, payroll, documents, exit.
- Add leave calendar and approval queue.
- Add salary template and allowance/deduction rule UI.
- Add branded payslip PDF polish and payroll report filters.

Mobile frontend:

- Add leave request creation, leave approval, payslip detail/download, attendance/check-in, and staff notices.
- Keep salary/bank fields masked unless permission allows.

Definition of done:

```text
HR and payroll can safely handle real salary and staff data through permissions, locks, audit trails, and accounting-safe posting/reversal.
```

---

## 11. M8A Library

### Current feature scope

- Library CRUD, books/copies, fines, QR lookup, staff borrowers.
- Fine-to-fees/accounting boundary, scanner-first UI, reports/export polish.

### Enhancement backlog

Backend:

- Add lost/damaged lifecycle and fine/replacement workflows.
- Add holiday-aware overdue fine calculation.
- Add student/staff borrower policy differences.
- Add fine posting/payment reconciliation idempotency tests.

Web frontend:

- Add ISBN/barcode entry, author/publisher/category/shelf metadata.
- Add scanner-first issue/return flow with student QR and book barcode.
- Add overdue, lost books, fine summary, and popular books reports.
- Add book copy archive instead of unsafe deletion when history exists.

Mobile frontend:

- Add borrowed books, due dates, fine warnings, book search, and book detail.
- Add librarian scanner workflows later only after device QA.

Definition of done:

```text
Library can run daily issue/return/fine workflows with barcode/QR support and reliable history.
```

---

## 12. M8B Transport

### Current feature scope

- Routes, stops, vehicles, assignments, trips, GPS, reports.
- Redis GPS/latest-location cache, pressure limits, retention hardening.
- Driver mobile surfaces, parent latest-GPS view, trip-history exports.

### Enhancement backlog

Backend:

- Add background/automated driver GPS ping flow after device-auth contracts.
- Add stale-location metrics and Redis outage fallback behavior.
- Add GPS ingestion acceptance/rejection reports.
- Add route deviation, overspeed, geofence, and ETA later after live tracking is approved.
- Add vehicle/driver overlapping trip validation and one-day route changes.

Web frontend:

- Add admin stale-location labels and latest-location confidence indicators.
- Add trip history and GPS quality reports.
- Add live map only after SSE/WebSocket decision and load testing.

Mobile frontend:

- Add driver start trip, stop list, boarded/dropped/absent actions, emergency contact, complete trip.
- Add background GPS permission flow, location sync status, and retry queue.
- Add parent bus status: not started, en route, delayed, arrived, stale GPS.

Definition of done:

```text
Transport becomes reliable for daily route operations first; live map and ETA only follow after device QA, ownership tests, and load testing.
```

---

## 13. M8C Canteen

### Current feature scope

- Menu, meal plans, POS, wallets, inventory, vendors, reports.
- Receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff.
- Parent mobile views.

### Enhancement backlog

Backend:

- Add POS double-submit and receipt reprint idempotency tests.
- Add allergy/medical warning enforcement before serving.
- Add daily/monthly spending controls and low-balance events.
- Add stock close, wastage, vendor bill edit locks, and negative stock prevention.

Web frontend:

- Add fast POS mode with QR/student search, wallet balance, allergy warning, and receipt.
- Add daily/weekly menu planner.
- Add inventory low-stock alerts, vendor purchase reports, and wastage reports.
- Add meal-plan cancellation and linked invoice status clarity.

Mobile frontend:

- Add parent wallet balance, meal plan, today’s menu, low-balance alert.
- Add student meal QR.
- Add canteen scanner and serve meal flow after device QA.

Definition of done:

```text
Canteen can run wallet/POS/meal/inventory workflows without negative stock, duplicate sale, or unsafe allergy handling.
```

---

## 14. M9 Accounting and Finance

### Current feature scope

- Chart of accounts, journals, reports, reconciliation suggestions.
- PDFs, snapshots, audit trail, File Registry export support.
- Production-candidate for current scope.

### Enhancement backlog

Backend:

- Add Nepal school-friendly default chart of accounts templates.
- Add fiscal close/reopen safety and period-lock regression coverage.
- Add reversal/correction-only enforcement for posted records.
- Add source mapping checks for fees, payroll, canteen, library, and transport.
- Add large-report background export thresholds.

Web frontend:

- Add accountant dashboard for fiscal status, unreconciled items, pending postings, and export history.
- Add bank reconciliation review with manual confirmation.
- Add report snapshots and large export progress UI.
- Add source-ledger drilldown from accounting entries back to original module records.

Mobile frontend:

- Add principal read-only finance snapshot and approval-oriented views only.
- Do not expose full chart of accounts, journal editing, or fiscal close on mobile.

Definition of done:

```text
Accounting acts as the financial backbone for SchoolOS, with immutable posted records, safe corrections, and source-ledger reconciliation.
```

---

## 15. M10 Notices, Communication, and Chat

### Current feature scope

- Notices, communication deliveries, provider modes, attachments.
- Failure dashboard, moderation/escalation, unread-recipient follow-up.
- Mobile notification/chat surfaces.

### Enhancement backlog

Backend:

- Add real provider callback verification for duplicate, forged, failed, delayed, and out-of-order events.
- Add notification retry idempotency and provider-disabled fail-closed behavior.
- Add quiet-hours and moderation policy enforcement for chat.
- Add attachment access tests after guardian removal or role change.

Web frontend:

- Add notice templates for holiday, fee reminder, emergency, exam, transport delay, and event.
- Add recipient preview before high-impact notices.
- Add failed-recipient retry and unread follow-up UI.
- Add communication audit for emergency and high-impact messages.

Mobile frontend:

- Add push notifications, notification center polish, notice attachment preview, chat read receipts, quiet-hours banner, report/block/escalation flow.

Definition of done:

```text
Communication becomes reliable and auditable across notices, events, provider delivery, chat, attachments, and emergency workflows.
```

---

## 16. M11 School Intelligence and AI

### Current feature scope

- Roadmap only.
- No AI/ML runtime should be implemented until reliable production data exists and M11 is explicitly approved.

### Future enhancement backlog

Backend:

- Add analytics data mart or reporting-safe aggregation layer only after production data quality is proven.
- Add tenant-safe aggregation and anonymization controls.
- Add explainability and audit storage for recommendations.
- Add human-review workflow for every AI-generated insight.

Web frontend:

- Add principal insight dashboard only after approved backend foundations.
- Add insight confidence, evidence, recommended action, and “human reviewed” status.

Mobile frontend:

- Show reviewed, permission-gated insights only.
- Do not show raw prediction scores to parents/students.

Definition of done:

```text
M11 must never make automated punitive decisions. It may provide reviewed, explainable, permission-gated recommendations only.
```

---

## 17. Flutter Mobile Companion App

### Current feature scope

- Active Flutter companion app with scoped parent/student/teacher/staff/driver/admin surfaces where APIs exist.

### Enhancement backlog

Foundation:

- Strengthen secure storage, refresh token flow, role routing, error mapper, offline banner, and network retry behavior.
- Add push notification foundation and local notification handling.
- Add app icon, splash branding, crash logging, accessibility pass, and release build checks.

Parent:

- Improve child dashboard, attendance, homework, fees, report cards, notices, activity feed, canteen wallet, transport status, and chat.

Student:

- Add timetable, homework, attendance, notices, report cards, library borrowings, and canteen balance.

Teacher:

- Add assigned classes, attendance marking, homework creation, timetable, substitutions, notices, student profiles, and parent messages.

Driver:

- Add start trip, route, stop list, boarded/dropped, GPS sharing, emergency contact, complete trip, and trip history.

Staff:

- Add profile, attendance/check-in, leave request/history, payslips, notices, and approvals.

Principal/Admin:

- Add daily overview, pending approvals, attendance alerts, fee snapshot, transport alerts, staff leave approvals, and emergency notices.

Definition of done:

```text
Mobile supports daily operations and parent engagement through purpose-limited APIs, ownership tests, offline-aware UX, and real-device smoke verification.
```

---

## 18. Cross-Module Product Enhancements

### Search and navigation

- Add global search for students, guardians, staff, receipts, notices, books, routes, and reports where permission allows.
- Keep search results tenant-scoped and permission-scoped.

### Notifications

- Add unified notification center for notices, attendance, fees, homework, transport, canteen, HR, and system alerts.
- Add provider failure visibility and retry-safe delivery.

### Audit and compliance

- Add module-specific audit timelines for high-risk records.
- Add principal/admin audit dashboards.
- Add export-ready audit evidence for fees, payroll, accounting, student records, and communication.

### Offline and low bandwidth

- Add offline views for parent child profile, homework, notices, timetable, teacher attendance drafts, and driver trip state.
- Add deterministic conflict handling instead of silent overwrite.

### Performance and scalability

- Add pagination/filtering for every growing list.
- Review indexes for high-volume queries.
- Move slow reports, PDFs, provider calls, retries, and exports to BullMQ.
- Add large export thresholds and async progress tracking.

### UI/UX polish

- Add consistent loading, empty, error, forbidden, success, and retry states.
- Keep dashboards calm, school-office-friendly, and low-bandwidth-aware.
- Avoid decorative features that do not support real school workflows.
- Follow the web dashboard overhaul plan for shared typography, shell, Tailwind/shadcn-style primitives, performance rules, and dedicated module screens.

---

## 19. Recommended Implementation Sequence

```text
1. Phase Gate 0 verification and stabilization.
2. Auth/RBAC/tenant isolation hardening.
3. Platform, settings, reports, File Registry, provider readiness.
4. Admissions, attendance, fees, notices, and activity pilot reliability.
5. Academics and accounting production polish.
6. Homework/timetable and HR/payroll staging/device QA.
7. Library, transport, and canteen operation-specific QA.
8. Flutter mobile companion depth through purpose-limited APIs.
9. Transport live map/background GPS only after device/load/ownership tests.
10. M11 intelligence only after reliable production data exists and explicit approval is given.
```

Do not start broad new product fronts until the verification gate and staging smoke are clean.
