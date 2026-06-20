# SchoolOS Backend, Web, and Mobile Feature Allocation

**Status:** Active cross-surface product allocation reference
**Owner/audience:** Product, backend, web, mobile, QA, security, support/operations
**Scope:** M0-M14 backend ownership, SchoolOS Web responsibilities, mobile companion responsibilities, role boundaries, and explicit surface exclusions
**Precedence:** Product intent remains in `SCHOOLOS_PRODUCT_REQUIREMENTS.md`; functional behavior remains in `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`; software requirements remain in `../requirements/SCHOOLOS_SRS.md`; web and mobile UX rules remain in their design plans. This document owns cross-surface allocation and persona boundaries.
**Inputs/source documents:** `SCHOOLOS_PRODUCT_REQUIREMENTS.md`, `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`, `../requirements/SCHOOLOS_SRS.md`, `../architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`, `../design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `../design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`, repository code evidence recorded in the SRS/MDD.
**Out-of-scope content:** Endpoint URL invention, DTO schemas, Prisma migrations, runtime implementation, staging proof, and GA readiness claims.
**Last reviewed date:** 2026-06-20

---

## 1. Decision

SchoolOS Web is the school's operating desk and system of record. It is where authorized school staff configure, operate, verify, approve, reconcile, report on, and control official school work.

Mobile apps are focused companions. They reduce friction for immediate, role-specific work, alerts, field actions, and self-service. They must not become smaller copies of the school operations website.

The backend owns official truth and every critical rule:

```text
Backend = source of truth, validation, security, automation, audit, and full business capability
Web     = detailed school operating work, setup, control, review, and high-risk workflows
Mobile  = immediate information, safe daily action, field work, alerts, and self-service
```

This document allocates product capability. It does not prove that an endpoint, route, screen, provider, or workflow is implemented or release-ready. Current evidence remains in [`SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`](../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md), and execution priority remains in [`SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`](../project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md).

---

## 2. Product Surface Model

SchoolOS has one shared tenant-aware core and three configurable experience packs:

```text
Shared core
+ PRESCHOOL experience pack
+ SCHOOL experience pack
+ HIGHER_SECONDARY experience pack
+ shared Web app
+ shared Flutter companion app
```

The experience packs change workspace composition, labels, allowed workflows, and capability visibility. They do not create separate products, apps, databases, student tables, guardian systems, ledgers, or mobile binaries.

### 2.0 Shared Core Versus Stage-Specific Experience Packs

| Layer | Owns | Must not do |
|---|---|---|
| Shared core | Tenant, users/RBAC, students, guardians, staff, admissions, academic years, classes, sections, enrollment history, attendance, fees, files, notices, transport, canteen, library, HR/payroll, accounting, audit, reports, module entitlement, school settings. | Split into `PreschoolStudent`, `SchoolStudent`, `PlusTwoStudent`, separate ledgers, or separate apps. |
| `PRESCHOOL` pack | Montessori, Nursery, LKG, UKG child-safety composition: safe handover, activity diary, simple observations, supportive milestones, parent trust, admissions, fees, staff/classroom coverage. | Make heavy exams, marks grids, CAS, ranking, broad child app, or mandatory detailed care logs default. |
| `SCHOOL` pack | Grade 1-10 academic/operations composition: attendance, classes/subjects, timetable, homework, exams, marks/CAS, report cards, library, transport, canteen, fees, notices. | Use "Primary" as the universal Grade 1-10 label in product UX unless an existing compatibility contract requires it. |
| `HIGHER_SECONDARY` pack | Grade 11-12 / +2 composition: configurable streams/programs, subject combinations, theory/lab timetables, practicals, projects, internal assessment, mock exams, board-readiness workflows. | Hard-code streams or build a separate +2 academic platform. |

### 2.0A Backend-Owned Experience Context

The desired `ExperienceContext` is **PROPOSED / NEEDS_SCHEMA_DESIGN**. This document does not claim an endpoint, Prisma field, DTO, or Flutter model exists.

The backend-owned context must eventually derive from:

```text
Tenant program offerings
+ platform module entitlement
+ school-level configuration
+ class/section stage or program
+ active enrollment
+ user role
+ permission
+ teacher assignment
+ guardian-child relationship
+ enabled capability
```

Conceptual output:

```text
role
tenantId
enabledPrograms
assignedPrograms
activeProgram
activeClassOrChildContext
enabledCapabilities
permissionScope
moduleEntitlements
```

Web and mobile may compose stage-specific navigation only from backend-provided context. They must never infer authorization from class names, local labels, hidden buttons, or hard-coded route lists.

### 2.1 SchoolOS Web — The School Operating Desk

The web must let a school run its full official operation without depending on disconnected spreadsheets, paper registers, chat-only coordination, separate accounting tools, or staff memory.

It serves detailed, high-volume, official, and high-risk work:

- School setup, configuration, roles, permissions, and academic structures.
- Admissions, student lifecycle, guardians, documents, and official records.
- Attendance control, corrections, registers, policies, and anomaly review.
- Fees, cashier operations, reversals, reconciliation, payroll, and accounting.
- Exams, marks, report cards, promotion, timetable, and academic publishing.
- Staff, library, transport, canteen, communication, learning, reports, exports, files, and audit history.
- Cross-department workflows and leadership investigation without forcing leaders to perform every operational task.

The website contains two strictly separated environments:

| Environment | Route family | Purpose |
|---|---|---|
| School Operations Workspace | `/dashboard/*` and `/dashboard/settings/*` | One school runs operations and authorized school configuration. |
| SchoolOS Platform Workspace | `/platform/*` | SchoolOS operators manage tenants, plans, SaaS billing, providers, queues, support, suspension, and platform security. |

A school user never receives platform controls. A platform operator does not casually browse school-private records; tenant-private access requires the approved, reasoned, expiring, audited support-override flow where supported.

### 2.2 Mobile companion apps

| Mobile experience | Primary job |
|---|---|
| Parent | Understand and act on matters for linked children only. |
| Teacher | Run today's assigned classroom work quickly. |
| Principal | See attention items, alerts, and safe quick approvals. |
| Driver / Conductor | Operate one assigned trip. |
| Staff Self-Service | Manage the authenticated staff member's own work life. |
| Student controlled session | Join and complete a teacher-controlled learning session only. |

Parents, broad student users, drivers, casual visitors, and public users are not users of the main school operations workspace. Any future parent web portal must remain child-scoped and must not resemble the staff operating system.

### 2.3 Surface decision rule

| Feature type | Primary surface |
|---|---|
| Setup, configuration, bulk work, and dense tables | Web |
| Financial posting, accounting, payroll, reversals, and reconciliation | Web |
| Detailed review, reports, exports, audits, and investigations | Web |
| Quick daily task, alert, approval, and status check | Mobile |
| Parent and staff self-service information | Mobile first |
| Driver and field workflow | Mobile first |
| Student session activity | Controlled school device, tablet, or classroom runtime |
| High-risk or irreversible action | Web with confirmation, reason where required, permission, and audit |

### 2.4 Stage-Aware Context Switching Rules

| User context | Required behavior | Evidence status |
|---|---|---|
| Parent with multiple children | Parent switches child; backend context changes active child, stage, enabled modules, files, notices, fees, activity, and published academic visibility. | Shared guardian-child foundation exists; stage-aware resolver is **PROPOSED / NEEDS_SCHEMA_DESIGN**. |
| Teacher assigned across stages | Teacher switches assigned class/context; valid tools change by assignment, stage, subject, capability, and module entitlement. | Teacher assignment foundation exists; stage-aware tool projection needs backend/OpenAPI/mobile DTO design. |
| Principal / owner | Principal sees combined attention across the school and can filter by Preschool, School (Grade 1-10), or +2 without bypassing permissions. | Principal summary surfaces exist broadly; combined stage filter needs backend summary/context design. |
| Administrator / academic coordinator | Web workspaces filter by academic year, class/section, program/stage, stream, and enabled module where supported. | Class/section foundations exist; program/stage and +2 structures need schema design. |

### 2.5 What Backend Owns

Backend owns the official record and workflow rules for every stage:

- Tenant, RBAC, entitlement, suspension, support override, and audit enforcement.
- Stage/program offering and effective experience resolution after schema approval.
- Student, guardian, enrollment, class/section, teacher assignment, and parent/child scope.
- All official totals, financial values, attendance state, report-card state, notification recipient resolution, file authorization, and lifecycle transitions.
- OpenAPI/shared DTO contracts for any web/mobile stage-aware projection.
- Safe errors, pagination/filtering/sorting, idempotency, transaction boundaries, and job retries.

### 2.6 What Web Owns

Web owns the school operating desk in one Next.js app:

- Setup, configuration, dense tables, bulk work, approvals, correction/reversal, reporting, protected exports, audit, and platform operations.
- Stage-specific workspace composition for Preschool, School (Grade 1-10), and Higher Secondary / +2 after backend contracts exist.
- Honest unavailable, locked, permission, partial-failure, and queued states when a safe API is absent.

Web must not own authorization, official totals, lifecycle state, financial truth, file scope, notification recipient scope, or stage/program resolution.

### 2.7 What Mobile Owns

Mobile owns one Flutter companion app:

- Parent linked-child visibility and action prompts.
- Teacher assigned-class daily work.
- Principal attention/approval snapshots.
- Driver assigned-trip flow.
- Staff self-service own-record flow.
- Controlled student learning/session flow.

Mobile may cache safe reads and may queue only explicitly idempotent, reconciled, visible sync writes. Stage-aware switching must come from backend contracts and must not be faked in Flutter.

### 2.8 Not Appropriate For Mobile

Mobile must not provide:

- Broad admin settings, tenant/platform controls, provider settings, SaaS billing, role/permission administration, or module entitlement administration.
- Fee reversals, refunds, cashier close, offline payments, wallet debits, top-ups without provider/reconciliation proof, payroll posting, accounting posting, fiscal close, journal edits, report-card publishing, or promotion decisions.
- Bulk imports, large reports/exports, dense marks grids, CAS moderation administration, full timetable construction, stock/vendor administration, broad student directories, or unscoped private chat/moderation.
- Any high-risk offline write unless backend idempotency, conflict resolution, and visible sync/retry/failure states are approved.

### 2.9 Not Default Preschool Scope

Preschool must not default to:

- Heavy exams, marks grids, CAS workflows, complex report-card workflows, public child ranking, harsh child labels, open all-day parent-teacher chat, broad child-owned app, mandatory detailed meal/nap/toileting/medicine logs for every school, or screen-heavy independent learning.

Preschool teacher mobile P0 remains limited to:

```text
Today
Attendance
My Children
Pickup & Drop
Permitted Care Alerts
Activities
Quick Observation
Parent Updates
Notices
```

---

## 3. Cross-Module Backend Responsibilities

Every module backend must provide, where applicable:

- Tenant-scoped records, queries, jobs, exports, caches, and files.
- Role, permission, entitlement, relationship, assignment, and ownership validation.
- Audit logs for sensitive actions and state transitions.
- Idempotency for money, attendance sync, session submissions, callbacks, and retryable writes.
- File access through `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`.
- Normalized events for M12-owned notification delivery rather than direct provider calls.
- Queued processing for reports, media, imports, exports, reminders, generation, and provider actions.
- Server-side pagination and filtering for growing operational lists.
- Module-owned backend summaries for official totals; clients do not calculate official totals from list pages.
- Safe bounded error envelopes without stack traces, provider internals, storage internals, or private payload leakage.
- Separate purpose-limited web and mobile API shapes when the mobile persona needs less data or narrower actions.

Example:

```text
Web contract: full invoice table, filters, audit context, cashier actions, reconciliation state
Parent contract: linked-child invoices, backend due amount, confirmed receipts, safe payment status
```

If a safe API is missing, inspect existing contracts, OpenAPI, permissions, DTOs, tests, and module ownership. Add a purpose-limited module-owned contract only when the need is real, repeatable, tenant-scopable, RBAC/entitlement-gatable, and part of a production workflow. Otherwise show an honest unavailable, locked, or permission state. Never invent a response shape or derive official truth in the client.

---

## 4. Role and Surface Matrix

| Persona | Web role | Mobile role |
|---|---|---|
| School Owner / Director | School health, finance overview, approvals, reports, strategic control | Alerts and attention summary where approved |
| Principal / Vice Principal | Academic oversight, formal approvals, reports, configuration, investigations | Urgent attention, safe quick approvals, alerts |
| School Administrator | Daily setup, students, guardians, users, settings, notices | Alerts and quick review only |
| Admissions Officer / Front Desk | Full admission, document, student, and guardian workflow | No dedicated initial workflow |
| Accountant | Fees, accounting, reconciliation, financial reporting | Normally no full mobile workflow |
| Cashier | Collection counter, receipts, and daily close | Limited online tablet flow only if later approved |
| Academic Coordinator / Exam Head | Subjects, exams, marks, report cards, promotion, timetable | Attention summary only where useful |
| HR / Payroll Officer | Staff, contracts, leave, payroll, payslips | Limited approval and status use |
| Teacher | Marks, planning, homework management, reports, detailed class review | Today, attendance, homework, messages, prepared learning sessions |
| Librarian | Catalogue, circulation, fines, and reports | Scan, issue/return, and borrower lookup |
| Transport Manager | Routes, assignments, vehicles, trips, and reports | Alerts and trip status |
| Driver / Conductor | Not web-first | Assigned trip, boarding/drop, status, GPS |
| Canteen Manager / Staff | POS, menu, wallets, stock, vendors, reports | QR scan and serving where approved |
| Parent / Guardian | Optional future child-only portal | Main parent experience |
| Student | No broad operations dashboard | Controlled learning session only |
| School IT / System Admin | Users, roles, permissions, school integrations, settings, audit | Normally no dedicated workflow |
| SchoolOS Platform Operator | Platform control plane only | No meaningful mobile requirement |

Backend authorization remains authoritative. A role listed for a surface still needs the exact permission, module entitlement, tenant state, and ownership or assignment scope for each action.

---

## 5. Module Allocation

### M0 — Platform Core

**Backend owns**

- Tenant creation, plans, entitlements, module enablement, suspension, and lifecycle.
- Users, roles, permissions, session policy, academic-year setup, and school configuration.
- Provider readiness for SMS, email, payment, storage, and push.
- Audit logs, queues, File Registry, export history, and fail-closed feature locks.

**Web uses**

- School Operations: profile, logo, academic year, classes, sections, users, role assignment, permissions, module settings, school rules, notification policy, audit, exports, and protected-file administration.
- Platform Workspace: tenant onboarding, plans, modules, SaaS billing, provider and queue health, storage readiness, support override, suspension, platform audit, and security operations.

**Mobile uses**

- Login, session restore, logout, role-aware navigation, branding, academic-year context, module-locked and permission states, and push registration.

**Roles**

- Web: authorized school admin/system admin in the school plane; SchoolOS platform operator in the platform plane.
- Mobile: every authenticated persona receives only its session and navigation projection.

**Web-only / mobile-only boundary**

- Web-only: tenant setup, plan management, SaaS billing, provider/queue configuration, role creation, and platform security.
- Mobile-only: device push-token registration and device-specific session behavior.

### M1 — Admissions and Student Profiles

**Backend owns**

- Inquiries, applications, student records, guardian and sibling relationships.
- Class, section, roll number, academic-year assignment, and lifecycle states.
- Duplicate detection and merge review, student QR identity, documents, photos, ID cards, transfer certificates, and IEMIS/readiness exports.

**Web uses**

- Full admissions pipeline, review, conversion, bulk import, duplicate review, student directory, profiles, guardian links, document checklist, lifecycle changes, QR/ID printing, and IEMIS preparation.

**Mobile uses**

- Parent: linked-child profile, class/section, permitted photo, and safe document or identity preview.
- Teacher: assigned-class roster and a permission-bounded student summary.
- Principal: admission count, missing-document alerts, and class-capacity overview.

**Roles**

- Web: admissions/front desk, school admin, authorized principal, and authorized records staff.
- Mobile: linked parent, assigned teacher, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: bulk import, duplicate merge, admission conversion, IEMIS preparation, lifecycle changes, and guardian relationship editing.
- Mobile never receives a broad student directory or admin-shaped student record.

### M2 — Smart Attendance

**Backend owns**

- Rosters, attendance sessions and statuses, assignment validation, lock windows, corrections, registers, reports, anomalies, notification events, and offline draft conflict/sync rules.

**Web uses**

- Attendance dashboard, class grid, monthly register, correction review, lock/calendar policy, unmarked and repeated-absence anomalies, reports, exports, and working-day settings.

**Mobile uses**

- Teacher: today's assigned roster, bulk present, exceptions, draft/submit, conflict/lock status, and timetable-linked periods.
- Parent: own child's daily/monthly attendance and permitted reason/alert behavior.
- Principal: unmarked classes, high absence, staff absence, and substitution attention.

**Roles**

- Web: teacher within assignment, attendance officer, school admin, and authorized principal/approver.
- Mobile: assigned teacher, linked parent, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: correction administration, monthly exports, policy/calendar setup, and attendance audit review.
- Mobile offline writes are limited to approved replay-safe attendance drafts with visible conflict and sync state.

### M3 — Fees and Receipts

**Backend owns**

- Fee structures, heads, invoices, discounts, waivers, ledgers, backend due calculations, collection, receipts, verification, reversals, refunds, adjustments, cashier close, reconciliation, callbacks, reminders, audit, and idempotency.

**Web uses**

- Fee setup, student ledger, cashier counter, full/partial payment, receipt reprint, discounts/waivers/adjustments, reversal/refund approval, payment-method close, defaulter reports, campaigns, reconciliation, and exports.

**Mobile uses**

- Parent: linked-child fee summary, due invoices, confirmed receipts, status, reminders, and online payment initiation only after gateway safety is verified.
- Principal: collection snapshot, overdue risk, and pending discount/refund attention.
- Cashier tablet: later only, online-only, and only after explicit approval and strong controls.

**Roles**

- Web: cashier, accountant/finance staff, authorized school admin, and authorized approver.
- Mobile: linked parent and authorized principal; cashier only in an approved future tablet workflow.

**Web-only / mobile-only boundary**

- Web-only: fee configuration, refunds, reversals, adjustments, cashier close, reconciliation, and financial exports.
- Mobile: no offline payments, no client-calculated dues, and no financial adjustment workflow.

### M4 — Academics, Exams, CAS, Report Cards

**Backend owns**

- Subjects, assignments, exam terms, components, grading rules, marks, CAS, practicals, retests, absent/withheld states, locks, correction history, report-card generation/publication/regeneration, promotion, and academic records.

**Web uses**

- Subject and assessment setup, exam templates, marks/CAS grids, review, locks and correction approval, batch report-card generation, protected PDF review, publication, promotion, streams, practicals, projects, and subject combinations.

**Mobile uses**

- Teacher: assessment reminders, assigned result status, pending marks, and only approved small-assessment entry.
- Parent: published marks, report cards, timetable, and result notices for linked children.
- Principal: publication readiness, pending marks by class/subject, and exam risks.
- Student controlled/self scope: own published result and schedule only where an approved surface exists.

**Roles**

- Web: assigned teacher, exam head, academic coordinator, authorized principal, and school admin.
- Mobile: assigned teacher, linked parent, authorized principal, and strictly self-scoped student where approved.

**Web-only / mobile-only boundary**

- Web-only: large marks grids, grading policy, batch generation, promotion decisions, and lock/unlock administration.
- Mobile never publishes results or makes promotion decisions.

### M5 — Activity Feed and Milestones

**Backend owns**

- Posts, media, student tags, milestone templates, consent, audience targeting, moderation, approval, protected media, delivery events, and relationship-revocation enforcement.

**Web uses**

- Post composition, detailed audience selection, media upload, approval, archive/restore, consent review, moderation, templates, gallery, and delivery tracking.

**Mobile uses**

- Teacher: capture media, draft/publish an assigned-class update, and retry upload safely on weak networks.
- Parent: consent-safe linked-child feed, milestones, photos, and videos.
- Principal: moderation attention and important activity overview.

**Roles**

- Web: assigned teacher, moderator, school admin, and authorized principal.
- Mobile: assigned teacher, linked parent, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: bulk moderation, consent-policy setup, and detailed delivery logs.
- Mobile capture/upload is field-first but remains assignment-, audience-, consent-, and retry-scoped.

### M6 — Homework and Timetable

**Backend owns**

- Homework lifecycle, due/submission rules, attachments, templates, reminders, submissions, review, timetable slots, conflicts, assignments, substitution, availability, and workload checks.

**Web uses**

- Homework templates and review, submission tracking, timetable builder, room/teacher/class/subject conflict management, substitution calendar, workload reports, and exports.

**Mobile uses**

- Teacher: today's timetable, quick assigned-class homework, phone attachments, review reminders, and substitution alerts.
- Parent: linked-child homework, due dates, protected attachments, and submission status.
- Principal: conflict summary and uncovered-class/substitution alerts.
- Student controlled/self scope: assigned homework and safe attachments only where approved.

**Roles**

- Web: assigned teacher, academic coordinator, timetable manager, and authorized school admin/principal.
- Mobile: assigned teacher, linked parent, authorized principal, and strictly self-scoped student where approved.

**Web-only / mobile-only boundary**

- Web-only: large timetable construction, complex conflict resolution, bulk homework analysis, and workload reports.
- Mobile does not edit school-wide timetable structures.

### M7 — HR and Payroll

**Backend owns**

- Staff lifecycle, contracts, documents, leave balances/requests/approvals, attendance/check-in, salary structures, deductions, payroll runs, posting, reversals, payslips, and sensitive salary/bank permissions.

**Web uses**

- Staff directory and employment records, contracts, leave queue/calendar, HR reports, salary setup, payroll run/review/approval/post/reversal, payslip generation/export, and staff documents.

**Mobile uses**

- Staff: own profile, approved check-in, leave request/status, own payslips, and staff notices.
- Manager/Principal: pending leave, absence summary, contract expiry, and staffing alerts.

**Roles**

- Web: HR officer, payroll officer, authorized accountant, school admin, and authorized approver.
- Mobile: authenticated staff member for own records and authorized manager/principal for bounded approvals/attention.

**Web-only / mobile-only boundary**

- Web-only: salary structure, payroll review/post/reversal, other-staff salary/bank data, and HR bulk exports.
- Mobile self-service never exposes another staff member's payroll or banking data.

### M8 — Library

**Backend owns**

- Catalogue, books/copies, barcode/QR, issue/return/renewal, borrower rules, overdue/fines, lost/damaged workflow, approved finance handoff, and reports.

**Web uses**

- Catalogue and copy management, ISBN/barcodes, circulation counter, overdue/fines, lost/damaged archive workflow, reports, and exports.

**Mobile uses**

- Librarian: barcode scan, issue/return, borrower lookup, and quick overdue status.
- Parent/Student: own or linked-child loans, due dates, and fine notices; catalogue search only if later enabled.
- Principal: overdue and usage snapshot.

**Roles**

- Web: librarian, authorized school admin, and authorized finance/review staff.
- Mobile: librarian, linked parent, strictly self-scoped student where approved, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: catalogue bulk import, fine reconciliation, policy setup, and full reporting.
- Mobile scanning is circulation-focused and does not grant catalogue administration.

### M9 — Transport

**Backend owns**

- Routes, stops, vehicles, drivers/conductors, student assignments, trip lifecycle, boarding/drop/absence, GPS pings and stale handling, history, reports, and conflict validation.

**Web uses**

- Route/stop setup, vehicle records and expiry, driver and student assignment, history, GPS quality, reports, and route-change administration.

**Mobile uses**

- Driver/Conductor: assigned active trip, start/end, stop list, assigned riders, boarding/drop/absence, GPS/status sync, and emergency action.
- Parent: linked-child route/stop, bus status, delay/stale alerts, and pickup/drop state where enabled.
- Principal: delayed routes, stale GPS, and vehicle/driver exceptions.

**Roles**

- Web: transport manager, authorized school admin, and authorized principal/reviewer.
- Mobile: assigned driver/conductor, linked parent, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: route planning, vehicle setup, billing configuration, broad assignment lists, and operational reports.
- Mobile driver access is assigned-trip only; no broad student directory or unrelated route access.

### M10 — Canteen

**Backend owns**

- Menu, meal plans, wallets, top-ups, limits, POS sales, meal serving, QR verification, allergy/medical warnings, stock movement, vendors, wastage, receipts, and transaction safety.

**Web uses**

- POS/serving workspace, menu planning, wallet administration, stock/vendor/purchase records, close/wastage, reports, and meal plans.

**Mobile uses**

- Canteen staff/tablet: student QR scan, meal serve, allergy-warning acknowledgement, backend wallet status, and receipt confirmation.
- Parent: linked-child wallet balance, menu, meal plan, low-balance alert, and spending summary.
- Student controlled identity: meal QR only.
- Principal: service/sales snapshot, low stock, and allergy attention.

**Roles**

- Web: canteen manager/staff, authorized finance staff, school admin, and authorized principal.
- Mobile: authorized canteen staff, linked parent, strictly scoped student identity, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: stock audit, vendor bills, wallet adjustment, close, and full reports.
- Mobile: no offline wallet debit and no client-calculated wallet truth.

### M11 — Accounting and Finance

**Backend owns**

- Chart of accounts, journals, vouchers, ledgers, source posting, fiscal periods/locks, bank import/reconciliation, financial statements, export jobs, and audit.

**Web uses**

- Accountant workspace, chart of accounts, journal review/posting, ledgers, trial balance, fiscal periods, bank import, reconciliation, reports, queued exports, and source-mapping diagnostics.

**Mobile uses**

- Principal: read-only finance snapshot, collection/expense summary, unreconciled count, and fiscal-period warning from backend-owned summaries.

**Roles**

- Web: accountant/finance officer, authorized approver, auditor/read-only reviewer, and authorized principal/owner.
- Mobile: authorized principal/owner, read-only and summary-scoped.

**Web-only / mobile-only boundary**

- Web-only: journals, posting, reconciliation, fiscal close/reopen, exports, and chart-of-account changes.
- Mobile has no accounting mutation workflow.

### M12 — Notifications, Notices, Communication, Chat

**Backend owns**

- Normalized event intake, recipient resolution, notices, templates, priority, scheduling, channel routing, preferences/quiet hours, delivery attempts/retries, verified callbacks, notification center, read state, scoped chat, report/block/escalate/resolve/reopen, protected attachments, moderation, and audit.

**Web uses**

- Notice composition, recipient preview, templates, approval, scheduling, delivery logs, failed-recipient follow-up, provider diagnostics, moderation/escalation, and communication audit.

**Mobile uses**

- Parent: notification/notice inbox, child-scoped notices, permitted teacher chat, read state, and quiet-hour visibility.
- Teacher: notices and permitted parent threads, response, report, block, and escalation.
- Principal: emergency/high-impact notice approval and escalation attention.

**Roles**

- Web: authorized notice author/approver, school admin, moderator, communication officer, and platform operator for provider diagnostics only in the platform plane.
- Mobile: linked parent, assigned/permitted teacher, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: provider setup, mass segmentation, bulk retry operations, full delivery/audit review, and moderation administration.
- Mobile never receives provider credentials, callback secrets, private delivery payloads, or unrelated conversation bodies.

### M13 — Learning Layer

**Backend owns**

- Activity/question data, class/section/subject/topic metadata, language/difficulty/mode, draft/publish/archive, board/lab sessions, expiring code/QR, heartbeat, participants, attempt start/autosave/submit/evaluation, supportive progress, teacher review, child-only parent summaries, and protected resources.

**Web uses**

- Full activity builder, question authoring, resources, archive/scheduling, smart-board control, participant monitor, progress reports, learning administration, attempt review, and printable fallback.

**Mobile uses**

- Teacher: view or launch an already-prepared activity, basic participation, and allowed pause/end.
- Student controlled device: join an active session, answer, autosave, submit, and view own safe result.
- Parent: linked-child supportive, non-comparative summary only.
- Principal: adoption, active sessions, and class/subject engagement overview.

**Roles**

- Web: assigned teacher, learning/curriculum administrator, and authorized principal/reviewer.
- Mobile: assigned teacher, active-session student, linked parent, and authorized principal.

**Web-only / mobile-only boundary**

- Web-only: full authoring, question-bank administration, deep analytics, and learning policy controls.
- Mobile/student: no open AI tutor, leaderboard, open chat, unrelated attempts, or broad home-learning expansion without approval.

### M14 — Intelligence / AI

**Backend owns, only after explicit approval**

- Tenant-safe descriptive analytics, human-reviewed risk indicators, explainable summaries, evidence/confidence, review state, and audit.

**Web may use later**

- Principal insight workspace with evidence, explanation, confidence, human review, and action tracking.

**Mobile may use later**

- Principal: reviewed high-priority insight cards only.
- Teacher: supportive class-level prompts only after review and approval.

**Roles**

- Authorized, trained principal/leadership and approved staff only; no default parent/student access to risk indicators.

**Web-only / mobile-only boundary**

- M14 is roadmap-only. No runtime, predictive label, automated decision, open tutor, or raw risk score is approved today.
- Parents and students must not receive predictive labels or comparative risk scores.

---

## 5A. Stage-Aware Capability Allocation And Required Work

This table is the contract discipline for new stage-aware scope. It identifies the verified foundation, the proposed design, and the required work before implementation claims are allowed.

| Capability | Existing verified foundation | Proposed design | Required backend/OpenAPI/schema/mobile work |
|---|---|---|---|
| Backend-owned `ExperienceContext` | No verified endpoint, DTO, or Prisma model. Shared tenant/RBAC/module/student/class foundations exist. | Resolve active experience from tenant offerings, entitlement, school configuration, class/section profile, enrollment, role, permission, teacher assignment, guardian link, and capability. | **NEEDS_SCHEMA_DESIGN**, OpenAPI/shared DTO, backend resolver, web shell integration, Flutter context projection, tenant/stage/RBAC tests. |
| Tenant program offerings | Tenant, plans, modules, entitlements, and settings exist. | Tenant can enable `PRESCHOOL`, `SCHOOL`, and/or `HIGHER_SECONDARY` offerings without separate products. | Schema/index design, platform settings, seed/backfill, entitlement checks, audit, OpenAPI, web settings, mobile projection. |
| Class/section stage profile | Class/section/student enrollment foundations exist. | Class/section carries backend-owned stage/program classification used by rosters, dashboards, teacher scope, and parent child switching. | Schema/backfill, index review, M1/M4 ownership decision, OpenAPI, web academic settings, mobile teacher context DTO, tests. |
| Preschool authorized pickup | Student/guardian/emergency foundations exist. | Authorized pickup contacts and temporary pickup changes are audit-bound, role-scoped, and parent-visible where policy allows. | New schema/workflow, DTOs, permission rules, idempotency for temporary changes, M12 events, web/admin screens, mobile parent/teacher DTOs, safety tests. |
| Preschool arrival/checkout/pickup exception | M2 attendance and M9 transport foundations exist. | Preschool attendance extends to arrival/absence/late/checkout and exception review without confusing handover with transport trips. | Schema design, M1/M2/M12 ownership, idempotent mobile submit, OpenAPI, web safety dashboard, Flutter teacher/parent flows, audit tests. |
| Preschool care/allergy alerts | Student care fields and canteen allergy warnings exist broadly. | Narrow authorized-staff care alerts for classroom/safety decisions only. | Authorization review, DTO minimization, web/mobile display rules, audit/access tests; no broad medical profile exposure. |
| Preschool activity diary/observations/media | M5 activity/milestone/media foundations exist. | Consent-safe activity diary, quick observations, supportive milestones, parent updates. | Verify M5 contracts/media consent, preschool diary DTO, mobile quick observation contract, parent feed filters, File Registry/media tests. |
| School Grade 1-10 composition | M1-M13 broad foundations exist. | One web workspace composition for attendance, subjects, timetable, homework, exams, marks/CAS, report cards, operations, fees, notices. | Authenticated browser E2E, role-denial tests, server summaries, module-locked states, mobile role QA, staging proof. |
| +2 streams/programs | Subjects/exams/practical marks foundations exist partially. | School-configurable programs/streams, not hard-coded. | M4 schema design, uniqueness/index rules, OpenAPI/shared DTOs, web setup, teacher assignment scope, parent/student projection, tests. |
| +2 subject combinations | No verified stream/combination model. | Configurable allowed subject combinations per tenant/program/intake. | Schema/migration/backfill plan, validation APIs, enrollment impact, web academic coordinator screens, mobile read projection, tests. |
| +2 practicals/projects/lab timetable | Practical mark fields exist; no full lifecycle verified. | Practical components, lab timetable, project evidence, assessment, result/report-card impact. | M4/M6/File Registry ownership design, lifecycle DTOs, idempotency, protected evidence files, report-card integration, teacher/mobile DTOs, tests. |
| Stage-aware principal dashboard | Principal/admin summaries exist broadly. | Combined attention with Preschool / School / +2 filters and permission-filtered drilldowns. | Backend stage summary contracts, no browser totals, web composition, Flutter principal filters, role/tenant/stage tests. |

## 6. Cross-Department Workflow Rule

Module boundaries must preserve ownership without fragmenting the school workflow:

```text
Admission
-> Student record and guardian link
-> Class/section assignment
-> Attendance roster
-> Fee invoice
-> Parent access
-> Exams and report card
-> Promotion, transfer, withdrawal, or graduation
```

The source module owns its records and emits normalized events. M12 owns notification delivery. M11 owns accounting records and approved source postings. File Registry owns protected file access. Cross-module screens may compose module-owned summaries but must not duplicate module business logic or recalculate official totals.

---

## 7. Product Acceptance Rules

A surface allocation is acceptable only when:

1. The backend remains authoritative for tenant scope, permissions, entitlement, ownership, calculation, workflow state, audit, and file access.
2. Web supports the depth needed for official school operation and does not degrade into a shortcut dashboard.
3. Mobile exposes only the immediate persona need through a purpose-limited contract.
4. High-risk, bulk, configuration, finance, payroll, reconciliation, publishing, and audit work remains web-first.
5. Parent access is linked-child only; teacher access is assignment-scoped; driver access is assigned-trip only; staff self-service is own-record only; student access is self/session-scoped.
6. Missing APIs produce an explicit contract decision or honest unavailable state, never fake data or guessed shapes.
7. Protected files use authenticated File Registry flows on every surface.
8. Money writes are backend-calculated, idempotent, audited, and never queued offline without explicit reconciliation approval.
9. Every visible workflow handles relevant loading, empty, error, permission, module-locked, validation, pending, success, queued, partial-failure, offline/sync, and file-unavailable states.
10. Local implementation or tests do not establish staging, pilot, release-candidate, or GA readiness.

---

## 8. Relationship to Other Active Documents

| Document | Owns |
|---|---|
| [`SCHOOLOS_PRODUCT_REQUIREMENTS.md`](SCHOOLOS_PRODUCT_REQUIREMENTS.md) | Product vision, target users, scope, and non-negotiable product outcomes. |
| [`SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`](SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md) | Backend behavior, validation, states, edge cases, and acceptance criteria. |
| **This document** | Cross-surface allocation: backend ownership, web use, mobile use, roles, and explicit boundaries. |
| [`SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`](../design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) | Global web interaction, layout, state, protected-file, and contract-use rules. |
| [`SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`](../design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md) | Mobile persona UX, navigation, offline/sync, device, and mobile state rules. |
| [`SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`](../project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md) | Approved dependency-driven execution order and verification gates. |
| [`SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`](../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md) | Current implementation and release-readiness evidence. |

Do not convert every capability in this allocation into an immediate code task. Before implementation, verify the current repository, contracts, permissions, tests, release priority, and the next-phase plan. Add work only for a verified gap inside the supported release boundary.
