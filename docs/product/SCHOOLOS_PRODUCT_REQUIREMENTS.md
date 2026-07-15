# SchoolOS Product Requirements Document

**Product:** SchoolOS  
**Market:** Nepal-first multi-tenant education operating SaaS  
**Document type:** Product Requirements Document (PRD)  
**Status:** Canonical product source of truth  
**Owner/audience:** CEO, CTO, product management, design, backend/web/mobile engineering, QA, school leadership, finance, operations, support, and implementation agents  
**Scope:** Product vision, target users, education-experience model, module boundaries, product requirements, cross-surface responsibilities, product priorities, success measures, and release acceptance criteria  
**Precedence:** This document owns product purpose, personas, scope, module outcomes, user journeys, priorities, and product acceptance boundaries. Software and non-functional requirements are owned by `../requirements/SCHOOLOS_SRS.md`; architecture by `../architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`; module ownership and known gaps by `../architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`; release stages by `../production/SCHOOLOS_GA_RELEASE_POLICY.md`. Current work and blockers live in GitHub Issues, Milestones, or Projects; verification evidence lives in CI runs, smoke outputs, staging records, and release artifacts.
**Out of scope:** Endpoint invention, DTO schemas, Prisma migrations, UI pixel specifications, provider credentials, pricing commitments, legal opinions, implementation-status inflation, and GA claims without evidence  
**Last reviewed:** 2026-07-12

---

## 0. Maintainer Note

This document is the canonical PRD for SchoolOS. It defines what the product is, who it serves, the outcomes it must deliver, the boundaries between backend, web, mobile, modules, and education experiences, and the evidence required before broader release claims are made.

This PRD does not by itself prove that a feature is implemented, tested, Staging validated, Controlled pilot validated, or released as GA / Production. Implementation and readiness claims must be confirmed against code, OpenAPI/shared contracts, migrations, tests, browser/device verification, staging evidence, provider checks, backup/restore proof, and controlled-pilot results.

Current release posture:

```text
Current posture: Internal QA / controlled-pilot preparation
Not yet established: Staging validated
Not yet established: Controlled pilot validated
Not yet established: Release candidate
Not yet established: GA / Production release
```

---

## 1. Executive Summary

SchoolOS is a Nepal-first, multi-tenant education operating SaaS designed to run the daily administrative, academic, financial, operational, notification, and notice workflows of an education institution from one tenant-isolated platform. The existing controlled-learning layer is preserved but deferred/frozen outside the current pilot and release boundary.

SchoolOS is not a generic CRUD dashboard. It is an operating system for real institutional work:

```text
One tenant-aware source of truth
+ one student and guardian record
+ one attendance truth
+ one fee and receipt trail
+ one academic record
+ one notification and notice trail
+ one protected file registry
+ one audit trail
+ role-scoped web and mobile experiences
```

The active education direction is:

```text
PRESCHOOL
  Montessori, Nursery, LKG, UKG

SCHOOL
  Grade 1-10

HIGHER_SECONDARY
  Grade 11-12 / +2
```

A broad Student App is not active scope.

The immediate product objective is not maximum module breadth. It is to prove that one Nepal school can safely and reliably run an agreed set of daily workflows with correct tenant isolation, role scope, financial integrity, protected files, parent trust, and operational evidence.

The initial commercial and controlled-pilot hypothesis is a narrow School (Grade 1-10) workflow centered on:

```text
Student and guardian records
+ attendance
+ transparent fee records
+ scholarship/discount treatment where enabled
+ understandable receipts and correction/reversal history
+ parent notices
+ principal attention items
```

This is a product and market hypothesis to validate through interviews and a controlled pilot, not a claim that every school has identical needs.

---

## 2. Product Decision

### 2.1 One platform, shared core

SchoolOS must remain one platform with one tenant boundary and one shared institutional record model. Education experiences may change labels, navigation, workflows, policy defaults, and capability visibility, but must not create parallel products or duplicate core records.

```text
One SchoolOS platform
+ shared tenant-aware backend
+ shared PostgreSQL data model
+ shared File Registry and audit systems
+ shared Next.js web application
+ shared Flutter companion app
+ configurable education experiences
```

SchoolOS must not create separate databases, separate student tables, separate guardian systems, separate fee ledgers, separate authentication systems, or separate mobile binaries for Preschool, School, or +2.

### 2.2 Production/GA target, evidence-based readiness

SchoolOS is governed by a Production / General Availability target, not an MVP-completion label. Product planning must use the official release stages:

```text
Development complete
Internal QA ready
Staging validated
Controlled pilot validated
Release candidate
GA / Production release
```

A local build, passing unit tests, seeded demo, implemented backend, or polished screen does not establish production readiness. GA requires the applicable evidence defined by the release policy, including staging migration, authenticated browser E2E, device QA, provider/storage checks, backup/restore proof, monitoring, rollback readiness, controlled-pilot validation, and release approval.

---

## 3. Problem Statement

Education institutions in Nepal commonly operate across disconnected systems and manual processes:

- Paper admission forms and student registers.
- Excel-based class, fee, attendance, and exam records.
- Handwritten receipts or disconnected billing tools.
- Separate accounting software with weak operational linkage.
- Attendance notebooks and manual correction practices.
- Report cards created from spreadsheets or isolated templates.
- WhatsApp, Viber, SMS, phone calls, and paper notices without reliable delivery evidence.
- Unstructured local drives or cloud folders for student, staff, receipt, and report-card files.
- Manual library, transport, canteen, payroll, and timetable workflows.
- Weak parent visibility and repeated requests for the same information.
- Limited audit trails, unclear corrections, duplicated records, and weak tenant/data boundaries.

These conditions create operational risk:

1. Duplicate data entry and inconsistent records.
2. Fee, receipt, cashier, and accounting mismatch risk.
3. Slow or unprovable parent notification and notice delivery.
4. Unauthorized or accidental disclosure of student, staff, salary, or financial information.
5. Weak traceability for approvals, corrections, reversals, and published results.
6. High staff dependency on institutional memory and manual follow-up.
7. Difficulty preparing reliable reports and exports.
8. Limited ability for leadership to identify exceptions requiring attention.

SchoolOS solves this by providing one tenant-isolated operational platform where official records, workflows, files, permissions, notifications, audit evidence, and role-scoped experiences are connected without making the browser or mobile client the source of business truth.

---

## 4. Product Vision and Value Proposition

### 4.1 Vision

Enable education institutions in Nepal to run daily work with operational confidence, financial clarity, safer data handling, better parent trust, and evidence-based oversight from one configurable system.

### 4.2 Value proposition

SchoolOS provides:

- **One source of truth:** shared students, guardians, enrollments, classes, staff, fee records, attendance, academics, files, and audit history.
- **Nepal-first workflows:** Nepal school-day context, BS-date display direction, NPR finance, School Grade 1-10 and +2 realities, iEMIS/reporting readiness, and practical school-office workflows.
- **Operational confidence:** exception-focused dashboards and real workflow drill-throughs instead of decorative metrics.
- **Finance trust:** backend-owned totals, idempotent money writes, immutable confirmed records, reasoned reversals/corrections, receipts, cashier close, and accounting boundaries.
- **Parent trust:** linked-child-only visibility, understandable records, consent-safe content, protected documents, and honest notification delivery states.
- **Teacher usability:** assigned-scope attendance, homework, timetable, marks, and notices without admin-dashboard complexity. Preserved M13 Learning behavior is not part of the current pilot.
- **Leadership oversight:** attention items, approvals, risks, readiness summaries, and audit trails without bypassing operational controls.
- **Platform governance:** strict `tenantId` isolation, entitlement enforcement, provider readiness, queue operations, support override controls, and release gates.

### 4.3 Initial commercial wedge

The first controlled commercial wedge should emphasize traceable operational evidence rather than broad platform claims:

```text
Clear fee records
+ visible scholarship/discount treatment
+ understandable receipts
+ reasoned reversals/corrections
+ attendance truth
+ parent notifications and notices
+ principal attention
```

External wording must avoid unsupported claims of legal compliance, regulator approval, guaranteed outcomes, or certification. SchoolOS may describe workflows as traceable, auditable, controlled, and reporting-ready only when the supporting product behavior exists.

---

## 5. Product Goals

### 5.1 Business goals

1. Prove one school can run agreed daily workflows without engineering intervention.
2. Build a repeatable controlled-pilot onboarding, support, verification, backup, and rollback process.
3. Establish a trusted operational record for student, attendance, fees, receipts, academics, notifications, notices, files, and audit.
4. Support modular packaging without weakening tenant, role, entitlement, or data boundaries.
5. Differentiate through Nepal-first usability, fee transparency, parent trust, protected records, and practical school operations.
6. Create a scalable foundation for Preschool, School, and +2 without parallel systems while preserving the frozen M13 Learning implementation for possible future re-approval.
7. Move from the current Internal QA / controlled-pilot preparation posture through the defined release stages only with recorded evidence.

### 5.2 Product goals

1. Centralize tenant-owned institutional data with strict isolation.
2. Provide the web operating desk required for setup, detailed work, approvals, reconciliation, reports, exports, audits, and high-risk actions.
3. Provide a persona-first Flutter companion app for immediate, safe, role-scoped tasks and visibility.
4. Make parents able to understand linked-child attendance, dues, receipts, notices, homework, activity, report cards, and enabled services.
5. Make teachers able to complete assigned daily work quickly without broad administrative access.
6. Make principals able to identify and act on attention items, approvals, operational risks, finance snapshots, academic readiness, and notification-delivery failures.
7. Make financial records idempotent, auditable, explainable, and backend-owned.
8. Make protected files accessible only through authenticated, scoped File Registry flows.
9. Make notification delivery status honest across in-app, push, SMS, and email modes.
10. Keep M13 Learning deferred and frozen: preserve existing teacher-led, school-controlled, session-scoped, non-comparative implementation without new feature work or current release claims.
11. Keep M14 Intelligence / AI deferred until explicitly approved with production data, privacy, human review, cost, and safety controls.

---

## 6. Non-Goals

SchoolOS must not, in the current release boundary:

- Become a generic dashboard or a collection of disconnected CRUD screens.
- Introduce microservices, Kubernetes, new search/database clusters, or separate deployment units without an approved need.
- Migrate the web application to Angular.
- Rename `tenantId` to `schoolId`.
- Mix SchoolOS SaaS billing with a school's student fee collection or M11 accounting.
- Use browser-calculated totals as official financial, attendance, payroll, accounting, report-card, or readiness truth.
- Expose raw object keys, permanent private URLs, provider credentials, token hashes, stack traces, Prisma errors, or private payloads.
- Allow parents to see unlinked children, teachers to see unassigned classes, drivers to see unassigned trips, staff to see other staff self-service data, or students to see other students.
- Provide offline payment, refund, wallet debit, payroll, accounting, report-card publishing, or platform-setting writes.
- Build a broad Preschool-through-Grade-12 student mobile app. These students receive controlled school learning/session access only.
- Build a public leaderboard, open student chat, harsh child labels, AI tutor, adaptive recommendations, automated punishment/risk decisions, or heavy simulations without approval.
- Add Bachelor or Master's institution-management features, a broad Student App, or M14 runtime without explicit product approval.
- Claim staging, pilot, release-candidate, production, or GA readiness from documentation or local tests alone.

---

## 7. Target Market and Education Experiences

### 7.1 Target segments

| Segment | Primary needs | SchoolOS direction |
|---|---|---|
| Preschool / Montessori / Nursery / LKG / UKG | Child safety, attendance, authorized pickup, parent trust, activities, milestones, notices, fees, simple teacher workflows | Preschool experience over shared students, guardians, attendance, activity, fees, files, communication, and mobile companion |
| School Grade 1-10 | Admissions, attendance, fees, homework, timetable, exams, CAS, report cards, library, transport, canteen, HR, notices, parent communication | Core School experience and initial controlled-pilot beachhead |
| Higher Secondary / +2 | Programs/streams, subject combinations, theory/practical timetables, labs, projects, internal assessment, mock exams, board readiness | Configurable +2 extension over shared academics, staff, fees, files, communication, and reports |
| Multi-branch or growing groups | Common controls, role separation, tenant isolation, module packaging, operator support, reporting | Multi-tenant SaaS control plane plus tenant configuration and school operations planes |

### 7.2 Education experience model

Experience composition must eventually be resolved by a backend-owned context derived from:

```text
Tenant offerings
+ module entitlements
+ institution configuration
+ active enrollment
+ academic program/class/section
+ user role and permission
+ teacher assignment
+ guardian-child relationship
+ approved capability
```

Web and mobile must never infer authorization from class names, hidden buttons, local enums, or route labels.

### 7.3 Experience-specific defaults

#### Preschool

Default emphasis:

- Safe arrival and handover.
- Authorized pickup and temporary pickup changes where implemented.
- Attendance and pickup exceptions.
- Activity updates and consent-safe media.
- Supportive milestones and observations.
- Parent notices and simple fees/receipts.
- Teacher simplicity and child-safety alerts.

Not default:

- Heavy marks grids, complex CAS, ranking, broad child-owned mobile app, open chat, or mandatory detailed care logs for every school.

#### School Grade 1-10

Default emphasis:

- Admissions and student records.
- Daily attendance and corrections.
- Fees, receipts, discounts/scholarships where enabled, and cashier controls.
- Homework, timetable, substitutions, and conflicts.
- Exams, marks, CAS, report cards, and promotion.
- Parent communication and notices.
- Library, transport, canteen, HR/payroll, and school accounting where enabled.

#### Higher Secondary / +2

Default emphasis:

- Configurable programs and streams.
- Subject combinations and optional subjects.
- Theory, practical, lab, project, and internal-assessment workflows.
- Timetable and faculty assignment flexibility.
- Mock exam and board-readiness workflows.

No hard-coded streams or parallel +2 platform may be introduced.

## 8. Users and Jobs to Be Done

| Persona | Core job | Product requirement |
|---|---|---|
| School owner / director | Understand institutional health and risk | Accurate, permission-safe, exception-focused summaries and drill-throughs |
| Principal / vice principal | Resolve attention items, approvals, academic/operational risks | Safe mobile attention view plus detailed web approval/investigation workflows |
| School administrator / receptionist | Manage admissions, students, guardians, notices, documents, and school setup | One reliable operating desk with clear states and protected records |
| Admissions officer | Move inquiry/application/direct admission through policy and review to enrollment | Progressive, auditable admission-case workflow with duplicate/document checks |
| Accountant / finance officer | Manage invoices, receipts, reversals, reports, reconciliation, and accounting handoff | Backend-owned totals, idempotency, controlled corrections, audit, protected artifacts |
| Cashier | Collect fees quickly and close the counter accurately | Fast student search, payment, receipt, reprint, method totals, and day-end close |
| Academic coordinator / exam head | Configure academics, timetable, exams, marks, CAS, report cards, and promotion | Dense, task-first web workspaces with locks, readiness, corrections, and publishing controls |
| Teacher | Run assigned daily classroom work | Assigned-scope attendance, homework, timetable, notices, and marks; preserved Learning sessions remain outside the current pilot |
| HR / payroll officer | Manage staff, contracts, leave, attendance, payroll, and payslips | Protected staff records, controlled payroll lifecycle, reasoned corrections, and audit |
| Librarian | Run circulation and catalogue workflows | Search, scan, issue/return, reservation, fine/lost/damaged handling, and reports |
| Transport manager | Manage routes, vehicles, assignments, trips, and safety exceptions | Assignment conflict checks, stale-status labels, protected documents, and parent-safe status |
| Driver / conductor | Operate one assigned trip safely | Assigned-trip-only mobile flow, manifest, boarding/deboarding, status, and emergency contacts |
| Canteen manager / staff | Run menu, POS, QR serve, wallet, safety, and stock workflows | Fast, idempotent counter/serve flow with allergy/medical warnings and backend wallet truth |
| Parent / guardian | Understand and act on matters for linked children | Child-scoped attendance, dues, receipts, homework, notices, activity, reports, transport, and enabled services |
| Staff self-service user | Manage own attendance, leave, profile, payslips, and notices | Own-record-only mobile experience with protected files |
| Student, Preschool through +2 | No broad Student App; preserve controlled-session compatibility only | Existing expiring session/QR, own activity, autosave/submit, and own-result boundaries remain frozen and disabled by default for pilots |
| SchoolOS platform operator/support | Manage tenants, plans, providers, queues, SaaS billing, and support access | Separate `/platform/*` control plane, masked secrets, reasoned support override, audit, and expiry |

---

## 9. Product Principles

### 9.1 One screen, one main job

Every web and mobile screen must make clear:

```text
Where am I?
What needs attention?
What can I safely do next?
```

### 9.2 Backend owns truth

Backend services and persisted records own:

- Authorization and scope.
- Official totals and lifecycle state.
- Financial values.
- Recipient resolution.
- File access.
- Validation and idempotency.
- Audit and workflow transitions.

Frontend hiding is usability only, not security.

### 9.3 Web is the operating desk

SchoolOS Web is the primary surface for:

- Setup and configuration.
- High-volume lists and dense tables.
- Detailed records.
- Bulk operations.
- Approvals and corrections.
- Financial posting, reconciliation, and close.
- Academic configuration, marks, report-card publishing, and promotion.
- Reports, exports, audit, and investigations.
- Platform operations.

### 9.4 Mobile is a focused companion

Mobile is for:

- Immediate information.
- Today's assigned tasks.
- Safe field actions.
- Attention items and bounded approvals.
- Parent and staff self-service.
- Driver trip operation.
- Preserved controlled student learning sessions only when explicitly re-approved and entitled; not in the current pilot boundary.

Mobile must not copy the desktop dashboard or expose admin-shaped APIs.

### 9.5 Honest states

Unavailable, locked, unauthorized, empty, zero, stale, queued, partial failure, provider-disabled, and failed states must remain distinct. The product must never fabricate `0`, success, sent, paid, healthy, or completed states.

### 9.6 Fail closed

Suspended tenants, disabled modules, expired sessions, invalid relationships, removed assignments, stale support overrides, and invalid file/session tokens must fail closed across API, web, mobile, jobs, exports, files, notifications, and learning.

---

## 10. Product Surface Model

### 10.1 Three operating planes

| Plane | Route family | Purpose |
|---|---|---|
| Platform control plane | `/platform/*` | SchoolOS tenant, plan, SaaS billing, provider, queue, support, audit, and platform operations |
| Tenant configuration plane | `/dashboard/settings/*` | One institution's branding, academic setup, roles, fee heads, policies, notification preferences, and enabled configuration |
| Institution operations plane | `/dashboard/*` | Daily admissions, students, attendance, fees, academics, homework, HR, library, transport, canteen, accounting, notifications, notices, learning, reports, and files |

These planes must not be mixed.

### 10.2 Backend responsibilities

Backend must provide:

- Tenant-scoped records, queries, jobs, exports, reports, caches, and files.
- RBAC, entitlement, relationship, assignment, ownership, and tenant-active enforcement.
- Server-side pagination/filtering/sorting for growing lists.
- Official summaries and aggregate values.
- Idempotency and transaction safety.
- Audit for sensitive actions.
- Purpose-limited mobile contracts.
- Safe bounded errors.
- Normalized events to M12 instead of direct provider calls.

### 10.3 Web responsibilities

Web must provide:

- Real API-backed workspaces only.
- One dominant task per route.
- Loading, empty, no-results, error, permission, module-locked, validation, pending, success, queued, partial-failure, stale, and file-unavailable states.
- Shared protected-file helpers.
- Confirmation and reason collection for high-risk actions.
- Server-driven tables and summaries.
- School-friendly language instead of raw technical errors.

### 10.4 Mobile responsibilities

Mobile must provide:

- Persona-specific navigation and home.
- Purpose-limited API consumption.
- Secure credential storage and private-cache clearing on logout/session expiry.
- Safe low-bandwidth reads and last-updated labels.
- Offline cache only for approved safe reads.
- Visible pending/synced/failed state only for explicitly idempotent approved writes.
- Authenticated file download/share helpers.
- No offline finance, payroll, accounting, report-card publication, platform, or tenant-setting actions.

---

## 11. Active Module Taxonomy and Product Requirements

| Module | Name | Product outcome |
|---|---|---|
| M0 | Platform Core | Operate the multi-tenant SaaS safely, control plans/providers/queues/files/support, and separate platform concerns from institution operations |
| M1 | Admissions and Student Profiles | Create a reliable student/guardian/enrollment record from inquiry or admission through lifecycle, documents, identity, and reporting readiness |
| M2 | Smart Attendance | Let authorized teachers mark assigned rosters quickly while preserving corrections, locks, registers, alerts, offline conflict handling, and parent visibility |
| M3 | Fees and Receipts | Manage fee setup, invoices, payments, receipts, discounts/waivers, reversals/refunds, cashier close, reminders, and accounting handoff with financial integrity |
| M4 | Academics, Exams, CAS, Report Cards | Configure academics, record marks/CAS, review and lock results, publish report cards, and manage promotion safely |
| M5 | Activity Feed and Milestones | Share consent-aware activities, media, observations, and milestones with the correct audience and moderation controls |
| M6 | Homework and Timetable | Assign and review homework and build, validate, publish, version, and maintain conflict-safe timetables and substitutions |
| M7 | HR and Payroll | Manage staff lifecycle, attendance, leave, contracts, salary structures, payroll, payslips, and staff self-service with privacy and audit |
| M8 | Library | Manage catalogue, copies, circulation, reservations, fines, lost/damaged handling, scanning, reports, and borrower-safe views |
| M9 | Transport | Manage vehicles, drivers/conductors, routes/stops, assignments, trips, boarding/deboarding, status, safety, documents, and parent visibility |
| M10 | Canteen | Manage menus, meal plans, POS, wallets, QR serving, allergy/medical safety, receipts, stock, vendors, and finance handoff |
| M11 | Accounting and Finance | Maintain chart of accounts, vouchers, journals, fiscal periods, source mappings, reconciliation, financial statements, snapshots, and audit |
| M12 | Notifications and Delivery | Own normalized event intake, recipient resolution, personal inbox/read state, templates, preferences, channels, provider delivery, retries, callbacks, diagnostics, and delivery audit |
| M13 | Learning Layer | Deferred and frozen; preserve the existing teacher-created, school-controlled activity/session implementation without pilot availability, feature expansion, or current release claims |
| M14 | Intelligence / AI | Deferred teacher-reviewed analytics and safe AI after production data, privacy, audit, human review, safety, and cost controls are approved |
| M15 | Notices and Announcements | Own school-authored notice drafts, audiences, preview, approval, scheduling, publication, protected attachments, acknowledgements, read follow-up, archive, and publication audit |

`M8A`, `M8B`, and `M8C` are obsolete. Library, Transport, and Canteen are independent modules. Inventory & Asset Management is not active scope.

### 11.1 M0 Platform Core

Required capabilities:

- Tenant creation, activation, suspension, and lifecycle.
- Plans, module entitlements, feature flags, and usage counters.
- SchoolOS SaaS billing separate from school fees/accounting.
- Provider configuration with masked secrets and explicit modes.
- Queue health, failed-job diagnostics, retry/discard controls, and audit.
- File Registry and storage readiness.
- Platform audit and reasoned, expiring support override.
- Onboarding/readiness checklist.
- Health, readiness, storage, database, Redis, and provider diagnostics.

Critical boundary: platform operators must not casually browse tenant-private records. Support access must be explicit, reasoned, time-bounded where supported, and audited.

### 11.2 M1 Admissions and Student Profiles

Required capabilities:

- Inquiry, application, walk-in/direct-admission, transfer, and import entry paths through one coherent admission-case model.
- Tenant policy, eligibility, class/capacity, placement, duplicate, guardian, and document checks.
- Draft, review, request-information, approve, reject, finalize, and follow-up states.
- Student, guardian, enrollment, lifecycle, transfer/alumni, emergency, and identity records.
- Protected student documents/photos.
- QR/ID credential issue, rotation, revocation, and audit.
- Duplicate review and controlled merge/override.
- iEMIS/reporting-readiness exports without claiming direct regulatory approval.

Critical boundary: M1 admission finalization must not silently create or mutate unrelated financial records unless a confirmed backend workflow explicitly owns that handoff.

### 11.3 M2 Smart Attendance

Required capabilities:

- Backend-confirmed teacher assignment and roster scope.
- Present-by-default or exception-oriented marking where policy allows.
- Draft, autosave/offline queue where approved, submit, lock, correction, review, and conflict states.
- Working-day, holiday, exam-day, and school-calendar policy.
- Monthly register and exports.
- Repeated absence/late follow-up and M12 events.
- Principal/admin anomaly and not-marked attention.
- Parent linked-child view.

Critical boundary: stale offline replays must not overwrite official attendance; conflicts must remain visible and auditable.

### 11.4 M3 Fees and Receipts

Required capabilities:

- Fee heads, plans, assignments, invoices, installments, due ledger, scholarships/discounts/waivers where enabled.
- Cashier-first payment workflow with idempotency.
- Confirmed receipt generation, protected access, reprint history, and verification.
- Partial payment, over/under-payment policy, adjustments, refunds, and reversals.
- Cashier session/day-end close and payment-method totals.
- Defaulter/aging segmentation and parent reminders through M12.
- Payment provider intents/callbacks only after signature, duplicate, failure, settlement, and sandbox verification.
- Approved handoff to M11 accounting.

Critical boundary: confirmed money records use reasoned reversal/correction workflows; they are not silently edited or deleted.

### 11.5 M4 Academics, Exams, CAS, Report Cards

Required capabilities:

- Academic years, classes/sections, subjects, teacher assignments, programs/streams where implemented.
- Exam terms, components, templates, weights, rubrics, and grading policies.
- Assigned-scope marks and CAS entry, draft/autosave where supported, validation, submit, review, lock, and correction.
- Result readiness, withholding, scheduling, publishing, and audit.
- Report-card generation jobs, partial failure, protected output, regeneration, and history.
- Promotion readiness and controlled decisions.
- Parent/student access only to published own records.

Critical boundary: official grades, GPA, totals, publication state, and generation progress come from backend truth.

### 11.6 M5 Activity Feed and Milestones

Required capabilities:

- Teacher/admin activity creation for permitted audiences.
- Consent-aware photos/media and File Registry processing.
- Milestones, observations, supportive labels, and parent-linked-child visibility.
- Draft, publish, archive, moderation, report, and audit states.
- Audience preview and notification handoff to M12.
- Safe media unavailable/restricted/processing states.

Critical boundary: no public child comparison, harsh labeling, unsafe media exposure, or permanent private URLs.

### 11.7 M6 Homework and Timetable

Required capabilities:

- Homework create, draft, publish, schedule where supported, attach protected resources, remind, archive, and review submissions.
- Teacher assignment/class/section/subject validation.
- Submission, late, return-for-correction, resubmission, feedback, and history.
- Timetable builder with class, teacher, subject, room, workload, and availability conflicts.
- Versions, compare, publish, lock, archive, and restore.
- Substitution queue, eligible candidates, assignment, cancellation reason, and notification.
- Parent/student own published homework/timetable views.

Critical boundary: the browser must not invent completion, workload, conflict, or readiness totals.

### 11.8 M7 HR and Payroll

Required capabilities:

- Staff directory, profile, lifecycle, departments/designations, contracts, documents, bank/salary protection, and audit.
- Staff attendance, shifts/rosters, leave policies, requests, balances, approval, and payroll impact.
- Versioned salary structures and assignments.
- Payroll run draft, validate, review, approve, post, reverse/correct, journal preview, and audit.
- Protected payslip generation, delivery, download, and staff self-service.
- Own-record-only staff mobile experience.

Critical boundary: salary, bank, PAN, and protected staff data must be permission-filtered and masked where appropriate.

### 11.9 M8 Library

Required capabilities:

- Catalogue, authors/categories, copies/barcodes/QR, shelves/locations, and copy status.
- Borrower lookup with scope-safe student/staff information.
- Issue, return, renew, reserve, cancel, fine, lost, damaged, waive/adjust where permitted, and audit.
- Overdue reminders through M12.
- Scanner-assisted counter flow and protected labels/reports where generated.
- Parent linked-child library status where enabled.

Critical boundary: circulation and fine state must be backend-owned and duplicate-safe.

### 11.10 M9 Transport

Required capabilities:

- Routes, ordered stops, vehicles, drivers/conductors, student assignments, schedules, and documents.
- Assignment conflict detection.
- Trip start/end, boarding/deboarding, manifest, latest status/GPS timestamp, and stale labeling.
- Parent linked-child route/trip status.
- Driver assigned-trip-only mobile flow.
- Emergency contact/action flow with confirmation and audit where supported.
- Maintenance and document-expiry attention.

Critical boundary: live maps, ETA, geofence, overspeed, or continuous tracking must not be represented as production-ready without backend/provider/load/privacy evidence.

### 11.11 M10 Canteen

Required capabilities:

- Menu planning and meal plans.
- POS sales with idempotency and protected receipts.
- Student wallet backend truth, top-up controls, spending limits, freeze/restrict, and reasoned adjustments.
- QR meal serving with duplicate-serve, eligibility, allergy, and medical checks.
- Stock consumption/close, vendors, bills, and finance handoff.
- Parent linked-child menu, wallet, transactions, and receipts.

Critical boundary: no offline wallet debit, top-up, refund, or canteen financial write without explicit reconciliation approval.

### 11.12 M11 Accounting and Finance

Required capabilities:

- Nepal-ready chart of accounts and import preview.
- Fiscal years/periods, open/close/lock controls, and reasoned reopen where permitted.
- Vouchers, journal entries, source mappings, posting, approval, correction/reversal, and audit.
- Receivables/payables where supported.
- Bank accounts, statements, reconciliation, and cheque lifecycle where supported.
- Trial balance, general ledger, balance sheet, income/expenditure, cash flow, snapshots, exports, and protected reports.
- Principal read-only summary separate from accountant operations.

Critical boundary: other modules and browsers do not directly write official ledger records; accounting entries use backend-owned integration boundaries.

### 11.13 M12 Notifications and Delivery

Required capabilities:

- Normalized event intake from source modules.
- Deterministic recipient resolution.
- Templates, language-ready variants, priorities, school overrides, and protected emergency templates.
- In-app, push, SMS, and email channel routing.
- Explicit disabled, log/dev, mock, sandbox, degraded, and configured provider modes.
- Idempotent delivery jobs, retries, callbacks, delivery logs, and diagnostics.
- Notification inbox, unread/read/archive state, safe deep links, and preferences/quiet hours.

Critical boundary: feature modules emit events and never call SMS/email/push providers directly.

### 11.14 M13 Learning Layer

Status: deferred and frozen. The existing implementation is preserved as-is, disabled by default for pilot tenants, hidden when the module entitlement is disabled, and excluded from current pilot acceptance and production-readiness claims.

Preserved implementation boundary:

- Teacher-created activities for assigned class/section/subject.
- Draft, publish, schedule/archive where supported.
- Question types such as MCQ, true/false, short answer, matching, and ordering where implemented.
- Smart-board and school-lab modes.
- Expiring join code/QR, session launch/control, participant monitor, autosave, submit, and backend scoring.
- Supportive progress labels such as `Needs Practice`, `Improving`, `Ready`, and `Strong`.
- Parent linked-child summaries that are non-comparative and supportive.
- Protected learning resources through File Registry.

Critical boundary: no public leaderboard, unrestricted home learning, AI tutor, adaptive recommendation, open student chat, or broad student app without approval.

No new activities, questions, session modes, reports, analytics, seed expansion, populated visual fixtures, mobile expansion, AI, adaptive behavior, or public/student-home learning may be added while M13 is frozen. A focused change is allowed only to fix tenant isolation, RBAC/ownership, suspended-tenant failure, protected-file security, build/typecheck failure, Prisma migration failure, OpenAPI verification failure, or a repository-wide test regression. Existing Learning records must not be deleted and destructive Learning migrations are prohibited.

### 11.15 M14 Intelligence / AI

Status: deferred roadmap only.

No AI/ML/LLM runtime may be added until explicitly approved after:

- Reliable production data and data-quality evidence.
- Privacy and consent policy.
- Human review and appeal path.
- Tenant isolation and audit design.
- Safety and bias review.
- Model/provider cost and failure controls.
- Clear prohibition on automated punishment or irreversible decisions.

### 11.16 M15 Notices and Announcements

Required capabilities:

- Draft, category, English/Nepali/bilingual content, template, schedule, expiry, pin/highlight, archive, and restore.
- Class, section, role, staff, linked-parent, and authorized selected-recipient audiences.
- Backend recipient preview using the same resolver used again at final dispatch.
- High-impact/emergency approval, confirmation, reason where required, audit, and cancellation before dispatch.
- Protected attachments through File Registry.
- Publish or schedule, then emit `NOTICE_PUBLISHED` or an equivalent normalized event to M12.
- Aggregated M12 delivery state plus M15 read/acknowledgement reporting and safe unread follow-up.

Critical boundary: M15 never calls provider SDKs or delivery adapters. Chat, messaging, and conversations are removed from the active product; new writes and active navigation remain disabled while historical records and authorization are preserved for compatibility and approved retention/disposal handling.

---

## 12. Core User Journeys

### 12.1 Admission to active student

```text
Inquiry / application / walk-in
-> admission case draft
-> policy, class, duplicate, guardian, and document validation
-> direct finalize or review/approval
-> Student + Guardian link + Enrollment + protected documents + audit
-> role-scoped web/mobile visibility
```

Acceptance outcome: a permitted user can complete or review admission without duplicate core records, cross-tenant access, silent guardian overwrite, or client-only saved state.

### 12.2 Attendance to parent alert

```text
Teacher opens assigned roster
-> marks present/exceptions
-> submits
-> backend validates assignment, date, enrollment, lock, and idempotency
-> official records and audit persist
-> M12 receives absence/late event where policy allows
-> linked guardian receives honest delivery/read state
```

Acceptance outcome: ordinary resubmission, locked attendance, stale offline replay, and correction all behave distinctly and fail safely.

### 12.3 Fee invoice to confirmed receipt

```text
Fee plan / invoice
-> backend due ledger
-> cashier payment or approved gateway intent
-> tenant, amount, reference, and idempotency validation
-> confirmed payment
-> receipt + audit + protected artifact
-> approved M11 handoff
-> refund/reversal through reasoned workflow
```

Acceptance outcome: duplicate submission/callback cannot create duplicate money records or receipts.

### 12.4 Homework create to review

```text
Teacher selects assigned class/section/subject
-> creates draft with protected resources
-> backend validates audience and attachments
-> publishes
-> M12 notifies recipients
-> student/parent sees own assignment
-> student submits where supported
-> teacher reviews and returns/marks with history
```

### 12.5 Marks to report card

```text
Academic/exam setup
-> assigned teacher marks/CAS entry
-> validation and submission
-> coordinator review and lock
-> reasoned correction where required
-> result readiness and publish
-> report-card generation job
-> protected parent/student access to own published card
```

### 12.6 Notice to delivery evidence

```text
Compose notice
-> define audience
-> backend recipient preview
-> approval where high impact
-> publish or schedule
-> M15 emits normalized notice publication event
-> M12 re-resolves final recipients with the same rules
-> M12 creates inbox rows and configured-channel jobs
-> delivery/read state and callbacks
-> M15 acknowledgement/read follow-up with audit
```

### 12.7 Driver trip

```text
Driver signs in
-> sees assigned trip only
-> starts trip
-> views scoped manifest/stops
-> records boarding/deboarding/status
-> emergency action if needed
-> ends trip
-> parents see child-scoped status and timestamp
```

### 12.8 Preserved controlled learning session

Deferred/frozen compatibility flow only. It is not a current pilot journey or acceptance criterion.

```text
Teacher creates approved activity
-> launches session
-> student joins using expiring code/QR
-> backend validates tenant, class, session, and self scope
-> autosave/submit
-> backend scores where applicable
-> teacher monitors
-> parent receives supportive child-scoped summary
```

---

## 13. Cross-Cutting Product Requirements

### 13.1 Tenancy and authorization

- `tenantId` is the strict boundary for every tenant-owned read, write, job, cache, export, report, file, notification, and mobile response.
- Backend authorization is the source of truth.
- Parent access is linked-child only.
- Student access is own/session-scoped only.
- Teacher access is assigned class/section/subject only unless explicitly permitted.
- Driver access is assigned-trip only.
- Staff self-service is own-staff only.
- Disabled modules and suspended tenants fail closed everywhere.
- Platform support override requires reason, audit, and expiry where supported.

### 13.2 Data and lifecycle integrity

- Official lifecycle values originate in backend/domain contracts.
- Web/mobile do not invent local-only official statuses.
- High-risk state transitions are permission-gated, confirmed, reasoned where required, and audited.
- Confirmed records use correction/reversal/archival policy rather than silent mutation or destructive deletion.
- Growing lists use server-side pagination/filtering/sorting.

### 13.3 Financial integrity

- Backend/database values are financial truth.
- Money is not calculated using JavaScript floating-point as the official value.
- Payment, receipt, wallet, payroll, accounting, provider callback, and retryable money writes are idempotent or duplicate-safe.
- Provider callbacks require signature verification and out-of-order/duplicate handling.
- Confirmed money records use reversal/correction.
- Offline financial writes are prohibited unless separately approved with reconciliation evidence.

### 13.4 Protected files

All protected files follow:

```text
Feature module
-> FileRegistryService
-> StorageService
-> StorageAdapter
```

Protected files include student documents/photos, receipts, report cards, activity media, homework/learning resources, staff documents/contracts/payslips, vehicle documents, notice attachments, preserved historical chat attachments, accounting evidence/reports, exports, labels, and generated certificates.

The product must not expose raw object keys, permanent provider URLs, or unauthenticated private files.

### 13.5 Notifications and providers

- Source modules emit normalized events.
- M12 owns recipients, templates, preferences, routing, delivery, retries, callbacks, read state, diagnostics, and audit.
- Provider mode must be explicit.
- Mock/dev-log delivery must not be represented as real sent delivery.
- Critical notifications cannot be silently discarded.
- Deep links re-check permission, tenant, entitlement, relationship, assignment, and record state.

### 13.6 Dates, time, and Nepal context

- School operating timezone is `Asia/Kathmandu`.
- Stored timestamps remain UTC instants.
- School-day queries use Nepal-local day boundaries.
- School-facing date display should support the approved BS-date standard while preserving stable API/storage contracts.
- NPR is the default monetary context for Nepal institutions.
- Academic and fiscal year labels must support Nepal practices without hard-coding one institution's policy.

### 13.7 Accessibility and usability

- Status is never communicated by color alone.
- Focus, keyboard navigation, validation, dialogs, tables, and protected-file actions must be accessible.
- Mobile touch targets must be suitable for common devices.
- School-friendly messages replace raw technical errors.
- Core web workspaces must remain usable on common 13-inch laptops through column priority, drawers, and filter collapse rather than unreadable compression.

### 13.8 Low-bandwidth and resilience

- Mobile avoids automatic large-media loading.
- Safe read summaries may be cached with last-updated labels.
- Retry behavior is explicit.
- Partial section failure must not blank an entire dashboard where independent data can still be shown.
- Stale operational data must show its timestamp and stale state.

---

## 14. Required UI States

Every applicable route or screen must explicitly support:

```text
Loading
Empty
No results
Validation error
Permission denied
Module locked
Tenant suspended
Session expired
Mutation pending
Success
Mutation failure
Partial success/failure
Queued/processing
Provider disabled/mock/degraded
File processing/unavailable/restricted
Offline
Pending sync
Sync failed/conflicted
Stale data
```

A missing or unavailable summary must not render as a genuine zero.

---

## 15. Nepal-First Product Requirements

SchoolOS must support the practical institutional context in Nepal:

1. Nepal school-day timezone and BS-date display direction.
2. NPR fees, receipts, discounts, scholarships, reversals, and cashier workflows.
3. School Grade 1-10 and +2 academic structures without assuming one board or stream configuration.
4. iEMIS/reporting-readiness preparation without unsupported direct-integration or compliance claims.
5. Formal/IRD-ready billing capabilities only where implemented and verified, without claiming certification.
6. Weak-connectivity and varied-device mobile conditions.
7. Parent communication that can use in-app, push, SMS, and email according to provider readiness and school policy.
8. English-first product language with Nepali-ready labels/templates and future localization support.
9. Configurable admission criteria, academic calendars, fee heads, terms, grading, roles, and school-specific policies.
10. School-friendly workflows for principals, administrators, teachers, cashiers, parents, drivers, librarians, HR staff, and canteen staff.

---

## 16. Product Metrics

Metrics must be measured from backend-owned data and interpreted within the current release stage.

### 16.1 Pilot and adoption metrics

- Agreed pilot workflows completed without engineering intervention.
- Time required for admission, attendance, fee collection, receipt explanation, notice delivery, and common parent lookup tasks.
- Teacher completion rate for assigned attendance/homework tasks.
- Parent ability to find child-specific attendance, fee, receipt, notice, and homework information without support.
- Principal resolution time for attention items and approvals.

### 16.2 Trust and correctness metrics

- Cross-tenant access incidents: target zero.
- Unauthorized parent/teacher/driver/staff/student scope incidents: target zero.
- Duplicate payment/receipt/payroll/wallet/accounting record incidents: target zero.
- Silent mutation of confirmed financial records: target zero.
- Protected-file unauthorized access incidents: target zero.
- Incorrect provider-delivery success claims: target zero.
- Unresolved P0/P1 finance, safety, tenant, or privacy defects at pilot exit: target zero.

### 16.3 Reliability metrics

- Authenticated browser E2E pass rate for supported workflows.
- Mobile role-flow pass rate on supported Android/iOS devices.
- Queue retry/failure rate and unresolved critical failures.
- Backup success and restore drill success.
- Staging smoke pass rate.
- Provider callback/retry correctness.
- Incident detection, response, and recovery time during controlled pilot.

### 16.4 Commercial learning metrics

- Interview evidence for buyer, budget owner, approval path, priority pain, replacement context, and willingness to run shadow mode.
- Pilot-fit institutions with an accountable admin/finance champion.
- Conversion from interview to design partner to validated pilot.
- Support load per pilot institution.
- Referenceability and retention after pilot exit.

---

## 17. Prioritization

### P0 — Release safety and core pilot proof

- Security, authentication, RBAC, entitlement, and tenant-isolation evidence.
- Realistic idempotent seed and role assignments.
- Authenticated browser E2E.
- Purpose-limited mobile role QA.
- Initial Grade 1-10 student, attendance, fee/receipt, parent notice, and principal-attention workflows.
- File Registry/protected-file hardening.
- Financial idempotency, corrections/reversals, and audit.
- Staging migration, provider/storage checks, backup/restore, monitoring, and rollback proof.

### P1 — Complete operating workspaces

- Real API-backed frontend standardization across M0-M12 and M15; preserve M13 without expansion.
- Complete loading/empty/error/permission/locked/queued/partial states.
- Academic/report-card, HR/payroll, accounting, homework/timetable, notification-delivery, and notice workflow depth.
- Parent, teacher, principal, driver, and staff companion polish.
- Server-side pagination/filtering and performance/index review.

### P2 — Expanded experience depth

- Preschool safety workflow after schema/contract approval.
- +2 streams, subject combinations, practicals, projects, and board-readiness depth.
- Library/transport/canteen device and provider hardening.
- Multi-branch operational depth.

### Deferred

- Broad Student App.
- M13 Learning feature work, pilot acceptance, and production-readiness claims.
- M14 Intelligence / AI.
- Unverified live transport map/ETA/geofence expansion.
- Biometric attendance.
- Microservices or infrastructure expansion without demonstrated need.

---

## 18. Release Acceptance Criteria

### 18.1 Development-complete criteria for a workflow

A workflow may be called development complete only when:

- Real API and database persistence exist.
- No fake production data or browser-only official state is used.
- Tenant, RBAC, entitlement, relationship/assignment/ownership scope is enforced.
- Sensitive writes are audited.
- Money writes are idempotent where applicable.
- Files use File Registry/StorageService.
- Growing lists are server-paginated/filtered.
- Required UI states exist.
- Protected downloads use authenticated helpers.
- Focused tests/regression coverage are updated.
- Applicable verification commands actually pass.

### 18.2 Staging-validated criteria

At minimum:

- Staging migration applies successfully.
- Environment preflight and secrets/origins are valid.
- API/web health and readiness pass.
- Redis/BullMQ and storage/provider modes are verified.
- Authenticated browser E2E runs against seeded staging data.
- Mobile role flows run against the same backend.
- Backup and restore drill succeeds.
- Monitoring/logging/alert routing is operational.
- Rollback procedure is executable.

### 18.3 Controlled pilot validated criteria

At minimum:

- One institution completes the agreed workflows with named owners.
- Staff and parent role scopes are proven in real usage.
- No unresolved P0/P1 tenant, privacy, safety, finance, file, or result-visibility issue remains.
- Attendance and fee workflows complete shadow-mode validation where required.
- Provider, queue, file, backup, restore, support, incident, and rollback processes are evidenced.
- Pilot exit review records product gaps, adoption, support load, and go/no-go decision.

### 18.4 GA criteria

GA requires all applicable release-policy gates, release-owner approval, supported scope freeze, documented rollback/recovery, operational ownership, and evidence that the supported plans/modules can be onboarded beyond a controlled pilot.

---

## 19. Dependencies

SchoolOS product delivery depends on:

- Stable Prisma schema and migrations.
- OpenAPI generation and shared contracts.
- PostgreSQL, Redis, BullMQ, and storage readiness.
- Tenant, auth, RBAC, entitlement, audit, and File Registry foundations.
- Realistic seed data.
- Browser/device test environments.
- Approved SMS/email/push/payment/storage providers and sandbox credentials.
- School policy and reporting-template validation.
- Pilot institution ownership, process mapping, and feedback.
- Backup, restore, monitoring, incident, and support procedures.

---

## 20. Product Risks and Mitigations

| Risk | Impact | Required mitigation |
|---|---|---|
| Broad module scope hides weak core workflows | Pilot failure and poor adoption | Freeze the sold pilot slice and require end-to-end evidence |
| Cross-tenant or persona-scope leakage | Severe privacy/security impact | Backend fail-closed checks, denial tests, file/job/export coverage, pilot proof |
| Financial duplication or silent mutation | Loss of trust and accounting mismatch | Idempotency, transaction safety, immutable confirmed records, reasoned reversal, reconciliation |
| Browser/mobile computes official truth | Inconsistent records | Backend-owned summaries/totals and contract tests |
| Protected-file exposure | Student/staff/finance privacy breach | File Registry-only access, short-lived/authenticated download, denial tests |
| Provider mode represented incorrectly | False notification/payment confidence | Explicit provider state, verified callbacks, honest delivery status |
| Mobile becomes a mini admin dashboard | Scope leakage and poor usability | Persona-first navigation and purpose-limited APIs |
| Premature inactive-scope or AI expansion | Distracts from pilot/GA blockers | Explicit non-scope labels and release-governed approval |
| Documentation overstates readiness | Bad decisions and buyer mistrust | Evidence-based status language and release-policy precedence |
| Weak school ownership during pilot | Operational dependency on engineering | Pilot screening, named champions, shadow mode, support/runbook readiness |
| Hard-coded education assumptions | Poor Preschool/School/+2 fit | Configurable experience context, contracts, and staged schema design |

---

## 21. Open Product Decisions

These require explicit owner/product decision and must not be guessed in implementation:

1. Final paid-pilot institution profile, pricing cadence, and packaging.
2. Exact Preschool authorized-pickup and care-alert schema/workflow.
3. Exact +2 program, stream, combination, practical, project, and board-readiness model.
4. Supported payment, SMS, email, push, and object-storage providers for pilot and GA.
5. Nepali localization depth and template ownership.
6. Formal/IRD-ready billing boundary and external claim wording after expert validation.
7. Education-reporting export formats and institution/authority validation.
8. Offline-write policy beyond currently approved attendance-style idempotent workflows.
9. Approved retention and disposal policy for historical chat/conversation records; Chat remains removed from the active product and cannot be reactivated without explicit new-scope approval.
10. Any M14 Intelligence / AI proposal.

Unknown implementation items must be labeled precisely:

```text
needs backend verification
needs OpenAPI confirmation
needs shared-contract confirmation
needs mobile DTO
needs authorization rule
needs idempotency confirmation
needs File Registry confirmation
needs offline sync confirmation
needs provider staging verification
```

---

## 22. Traceability and Document Ownership

Use the active documentation hierarchy:

| Question | Source of truth |
|---|---|
| Why is SchoolOS being built, for whom, and what product outcomes, journeys, and boundaries are required? | This PRD |
| What software, security, API, database, performance, and operational requirements apply? | `../requirements/SCHOOLOS_SRS.md` |
| How is the system architected and secured? | `../architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| What does each module own and what gaps exist? | `../architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| What are the release stages and GA gates? | `../production/SCHOOLOS_GA_RELEASE_POLICY.md` |
| What is currently verified? | CI runs, smoke outputs, staging records, and release artifacts |
| Where are current work, blockers, and sequencing tracked? | GitHub Issues, Milestones, or Projects |
| How is staging/production deployed and recovered? | `../production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

---

## 23. Product Definition of Done

SchoolOS is not complete because every menu item exists. The supported release boundary is complete when real institutions can run the promised workflows safely, repeatedly, and with recorded evidence.

For every supported workflow, completion means:

```text
Real persistence
+ correct tenant and persona scope
+ backend-owned truth
+ audited high-risk actions
+ idempotent money/retry behavior
+ protected files
+ honest UI states
+ focused tests
+ browser/device verification
+ staging proof
+ pilot validation where required
```

Until those gates are met, SchoolOS remains Internal QA / controlled-pilot work and must not be described as production-ready or GA.
