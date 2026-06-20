# SchoolOS Product Requirements Document

**Product:** SchoolOS
**Market:** Nepal-focused school operating SaaS
**Target schools:** Preschool, School (Grade 1-10), and Higher Secondary / +2 inside one multi-tenant product
**Document type:** Product Requirements Document
**Status:** Canonical PRD
**Owner/audience:** CEO, CTO, product management, design, engineering leads, QA, school owner/principal, preschool owner, school administrator, accountant, teacher, parent/guardian, support/operations
**Scope:** Product vision, personas, product boundaries, stage-aware experience model, user journeys, capability matrices, prioritization, and release criteria.
**Precedence:** Business rationale is owned by `SCHOOLOS_BRD.md`; functional detail by `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`; software requirements by `../requirements/SCHOOLOS_SRS.md`; module design by `../architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`; current readiness by `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`; release stage policy by `../production/SCHOOLOS_GA_RELEASE_POLICY.md`.
**Inputs/source documents:** `SCHOOLOS_BRD.md`, `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`, `SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`, `../requirements/SCHOOLOS_SRS.md`, `../architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`, `../architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`, `../design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `../design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`, `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`, repository source inspected on 2026-06-20.
**Out-of-scope content:** Endpoint URLs, DTO schemas, Prisma migrations, code implementation plans, pricing numbers, staging credentials, and GA readiness claims.
**Last reviewed date:** 2026-06-20

---

## 0. Maintainer Note

This document is the active PRD for SchoolOS. It keeps the existing pilot-hardening direction while defining one product model for three configurable education experiences:

```text
PRESCHOOL
SCHOOL
HIGHER_SECONDARY
```

The canonical allocation of backend ownership, SchoolOS Web responsibilities, mobile companion responsibilities, allowed roles, and explicit surface exclusions is [`SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`](SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md). This PRD owns product intent; it does not duplicate the module-by-module allocation.

Important distinction:

```text
Current implemented core = broad school-management foundation with remaining seed, browser, mobile, staging, provider, and pilot verification gates
Stage-aware SchoolOS = one shared core plus configurable Preschool, School, and Higher Secondary experience packs
M12 Notification Module = explicit product module for notification center, events, delivery, preferences, retries, provider diagnostics, read state, and audit
M13 Learning Layer = backend, web runtime, parent/student web summary, and Flutter summary foundation implemented locally; staging/browser/device depth remains staged
M14 Intelligence / AI = roadmap-only until production data, privacy, audit, and human-review controls are ready
Inventory & Asset Management = scrapped from active module taxonomy
```

Implementation claims must still be validated against the evidence in `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`, real pilot-school workflows, official reporting templates, provider sandbox/staging flows, production security review, and the verification commands in the next-phase plan.

---

## 1. Executive Summary

SchoolOS should be positioned as a **Nepal-first Preschool-through-+2 school operating system**, not merely a generic school management dashboard.

The core product thesis:

```text
One login, one school record, one fee ledger, one attendance truth, one learning record, one communication trail, one audit trail.
```

SchoolOS must help Nepali schools manage daily operations, student records, guardians, attendance, fees, receipts, accounting, academics, exams, report cards, parent communication, HR/payroll, library, transport, canteen, classroom learning, file privacy, reporting readiness, notifications, and future school intelligence from one tenant-isolated platform.

The strongest product direction is to build around six anchors:

1. **School master data** strong enough to support admissions, government-reporting readiness, class setup, student lifecycle, staff assignments, and school configuration.
2. **Academic operations** covering attendance, timetable, homework, gradebook, exams, CAS, report cards, promotion, streams, practicals, and parent/student visibility.
3. **Cashier and finance operations** reliable enough for real-world fee collection, receipt generation, refunds, reversals, day-end close, reconciliation, and accounting controls.
4. **Physical operations** covering library, transport, canteen, HR/payroll, and daily school resource workflows.
5. **Communication and notification operations** covering notices, in-app notifications, SMS/email/push routing, quiet hours, delivery logs, parent-teacher communication, chat moderation, and emergency messaging.
6. **Privacy, auditability, and tenant isolation** as first-class requirements because SchoolOS stores student, guardian, staff, financial, operational, learning, and communication data.

The product should first prove:

```text
1 school
1 clean source of truth
1 reconciled fee flow
1 teacher-friendly daily workflow
1 parent-visible student record
1 safe notification/communication flow
1 safe classroom-learning workflow
1 reporting/export validation layer
```

Do not expand into open-ended AI, microservices, Angular migration, broad live-map workflows, biometric workflows, or deep mobile expansion until the pilot workflows are stable.

---

## 2. Active Module Taxonomy

| Module | Name | Product intent |
|---|---|---|
| M0 | Platform Core | SaaS tenancy, plans, settings, File Registry, providers, queues, support override, audit. |
| M1 | Admissions and Student Profiles | Inquiry, admission, student lifecycle, guardians, documents, QR/ID, alumni/transfer states. |
| M2 | Smart Attendance | Daily attendance, corrections, registers, alerts, parent visibility, teacher mobile flow. |
| M3 | Fees and Receipts | Fee plans, invoices, payments, receipts, discounts, waivers, reversals, cashier close. |
| M4 | Academics, Exams, CAS, Report Cards | Subjects, marks, CAS, exams, report cards, promotion, streams/practicals later. |
| M5 | Activity Feed and Milestones | Class/activity updates, media, milestones, consent-aware parent visibility. |
| M6 | Homework and Timetable | Homework, timetable, substitutions, conflict detection, teacher/student/parent visibility. |
| M7 | HR and Payroll | Staff records, leave, attendance, salary structures, payroll, payslips, staff self-service. |
| M8 | Library | Catalogue, copies, issue/return, reservations, fines, lost/damaged, scanner, parent view. |
| M9 | Transport | Routes, vehicles, drivers, trips, boarding/deboarding, parent status, GPS-readiness. |
| M10 | Canteen | Menu, POS, wallet/debit controls, meal QR, allergy warnings, stock/vendor links. |
| M11 | Accounting and Finance | Chart of accounts, vouchers, journals, fiscal locks, reconciliation, reports, snapshots. |
| M12 | Notifications, Notices, Communication, Chat | Notification center, templates, delivery, notices, read receipts, chat, moderation, emergency audit. |
| M13 | Learning Layer | Teacher-created activities, smart-board mode, lab sessions, practice, progress, parent summary. |
| M14 | Intelligence / AI | Deferred teacher-reviewed analytics and safe AI after reliable production data exists. |

`M8A`, `M8B`, and `M8C` must not be used as active module numbers. Library, Transport, and Canteen are standalone modules.

Inventory & Asset Management is not part of the active taxonomy.

---

## 3. Product Overview

SchoolOS is a production-grade, multi-tenant SaaS school operating system for Nepali schools. It should support Preschool, School (Grade 1-10), and Higher Secondary / +2 through configurable experience packs over one shared core.

The platform covers:

```text
Platform/SaaS control
Tenant/school setup
Admissions and student profiles
Guardians and parent access
Smart attendance
Fees and receipts
Accounting and finance
Notifications, notices, communication, and chat
Activity feed and milestones
Academics, exams, CAS, report cards, streams, practicals, and projects
Homework and timetable
HR and payroll
Library
Transport
Canteen
Reports and exports
Protected File Registry
M13 Learning Layer
Future school intelligence
```

SchoolOS should not feel like a generic CRUD dashboard. It must match real school-office and classroom workflows in Nepal: front-desk fee collection, principal oversight, teacher attendance/marks entry, guardian communication, smart-board teaching, computer-lab practice, transport tracking, library/canteen counters, and periodic reporting pressure.

SchoolOS Web is the school operating desk and system of record for detailed setup, operation, approval, reconciliation, reporting, and control. Mobile apps are focused companions for immediate, role-scoped action and visibility. Neither surface owns business truth; backend rules and persisted records remain authoritative.

The product should first prioritize pilot reliability, financial correctness, tenant isolation, parent/student access boundaries, protected files, auditability, notification reliability, and operational stability before expanding into advanced AI, mobile, payment, biometric, live-map, or advanced learning workflows.

---

## 4. Problem Statement

Many schools in Nepal still operate through fragmented systems: paper registers, Excel sheets, manual fee ledgers, offline accounting tools, attendance notebooks, printed/PDF report-card templates, WhatsApp/Viber groups, unstructured Google Drive folders, disconnected parent communication channels, library notebooks, transport trip sheets, and canteen counter records.

This creates:

- Duplicate data entry.
- Weak financial visibility.
- Fee receipt/accounting mismatch risk.
- Inconsistent student records.
- Slow parent communication.
- Missed or duplicated notices.
- Weak delivery evidence for critical alerts.
- Poor auditability.
- Weak file privacy.
- Limited school-level analytics.
- Difficult official-reporting preparation.

SchoolOS solves this by providing a single tenant-isolated system where each school can manage operations, academics, finance, communication, notifications, files, reporting workflows, and staged classroom-learning workflows in one place.

---

## 5. Product Goals

### 5.1 Business Goals

1. Enable multiple schools to run independently on one SaaS platform.
2. Support controlled pilot deployment after staging verification.
3. Provide strong coverage for school operations, fees, accounting, academics, attendance, communication, notifications, and parent access.
4. Build trust through accurate receipts, ledgers, reports, audit trails, protected files, permission-scoped learning records, and delivery evidence.
5. Prepare a foundation for stage-aware Preschool, School (Grade 1-10), and Higher Secondary / +2 expansion, analytics, mobile expansion, provider integrations, SaaS billing automation, M13 Learning, and M14 Intelligence/AI.
6. Differentiate through Nepal-first operating context, cashier workflows, IEMIS readiness, smart-board learning support, computer-lab practice, and strong tenant isolation.

### 5.2 Product Goals

1. Centralize school data under secure tenant isolation.
2. Provide school administrators with one operational dashboard.
3. Provide principals with visibility into school health, collections, attendance gaps, academic status, pending approvals, communication delivery, reporting-readiness issues, and learning adoption.
4. Allow teachers to manage attendance, homework, academics, marks/CAS, timetable, communication, and planned classroom activities.
5. Allow parents to view child-specific notices, notifications, dues, fees, receipts, attendance, homework, progress, report cards, and safe learning summaries.
6. Allow students to view their own timetable, homework, notices, attendance, report cards, library/canteen information, and school-approved learning activities where enabled.
7. Provide finance staff/cashiers with fee ledgers, receipts, refunds, reversals, cashier close, reconciliation, and accounting controls.
8. Provide school operations staff with library, transport, canteen, and daily workflow tools.
9. Keep platform administration separate from tenant/school operations.
10. Treat official reporting and IEMIS readiness as a validation workflow, not a static export button.
11. Treat M12 Notifications/Communication as a first-class module, not a side effect of notices.
12. Treat M13 Learning as a separate product vertical that reuses SchoolOS Core data instead of duplicating it.

### 5.3 Technical Goals

1. Keep the NestJS modular monolith as the primary architecture.
2. Use PostgreSQL/Prisma for persistence and Redis/BullMQ for cache and queues.
3. Maintain strict `tenantId` boundaries across all modules.
4. Avoid premature migration to microservices or Angular.
5. Continue using Next.js for the current dashboard and Flutter for the companion app.
6. Keep browser auth cookie-first and mobile/API access bearer-token compatible.
7. Split large services/components by responsibility as code-file modularization, not microservices.
8. Keep parent/student/driver/mobile APIs purpose-limited and avoid exposing admin-shaped responses.
9. Implement M12 notification delivery through module-emitted events, backend-owned recipient resolution, templates, preferences, channel routing, queues, provider callbacks, delivery logs, and read state.
10. Keep M13 Learning as `apps/api/src/learning`, `apps/web/app/dashboard/learning`, `apps/web/app/classroom/board`, `apps/web/app/student/learning`, `apps/web/app/parent/learning`, and `packages/core/src/learning` where implemented.

---

## 6. Nepal-First Requirements

| Area | Product implication |
|---|---|
| Academic year and fiscal year may differ | Support academic-year context and fiscal-year/accounting period context separately. |
| Schools use class/section/roll conventions | Class, section, roll number, academic year, and lifecycle status must be first-class fields. |
| KG, primary, secondary, and +2 workflows differ | Use grade bands, school levels, streams, practicals, and product edition settings. |
| Parents expect simple communication | Parent app/portal should show child-specific dues, attendance, notices, notifications, homework, results, receipts, and learning summaries without admin complexity. |
| School offices often use mixed manual/digital workflows | Import/export, CSV/Excel, printable receipts, and manual reconciliation must be supported. |
| Nepali and English usage both matter | UI labels, reports, receipts, notices, notifications, learning activities, and templates should be localization-ready. |
| Official reporting pressure exists | IEMIS/export readiness must be treated as a validation workflow, not a single static file export. |
| Connectivity can be inconsistent | Important workflows need drafts, retry-safe submissions, clear sync/conflict behavior, and queued notification delivery. |
| Smart boards and computer labs may exist before 1:1 devices | M13 Learning should prioritize teacher-led board mode and school-only lab mode. |
| Local financial workflows matter | Cash, manual bank transfer, eSewa/Khalti readiness, cashier close, and reconciliation must be explicit. |
| Local communication workflows matter | Notices, parent-teacher messages, push, SMS, email, quiet hours, language-ready templates, and delivery logs must be explicit. |
| Local naming patterns matter | Nepali names, mixed scripts, guardian phone reuse, and duplicate candidate matching must be handled. |
| Low-bandwidth usage is common | Media, dashboards, learning activities, reports, protected documents, and notification center pages must degrade gracefully. |

---

## 7. Stage-Aware Product Model

SchoolOS must support three configurable education experiences inside one multi-tenant product:

```text
PRESCHOOL
  Montessori
  Nursery
  LKG
  UKG

SCHOOL
  Grade 1-5
  Grade 6-8
  Grade 9-10

HIGHER_SECONDARY
  Grade 11-12 / +2
```

Do not use "Primary" as the universal Grade 1-10 system label in product UX. Prefer `School (Grade 1-10)` unless an existing compatibility contract requires a narrower internal label.

### 7.1 Shared Core

All stages use one shared core:

```text
Tenant
Users and RBAC
Students
Guardians
Staff
Admissions
Academic years
Classes and sections
Student enrollment history
Attendance
Fees and receipts
Files and documents
Notices and communication
Transport
Canteen
Library
HR/payroll
Accounting
Audit logs
Reports
Module entitlements
School settings
```

The official model remains:

```text
Student
+ Guardian relationship
+ Student enrollment
+ Academic year
+ Class/section
+ stage/program classification
+ role and permission scope
+ enabled module/capability
```

Do not create separate data systems such as `PreschoolStudent`, `PrimaryStudent`, or `PlusTwoStudent`.

### 7.2 Experience Resolution

The effective user experience must be backend-owned and derived from:

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

Conceptual `ExperienceContext` output:

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

Current repository status: this is a **PROPOSED** product contract and **NEEDS_SCHEMA_DESIGN**. No endpoint, Prisma field, or DTO is claimed as implemented by this PRD.

### 7.3 Program And Capability Matrix

| Capability | `PRESCHOOL` | `SCHOOL` Grade 1-10 | `HIGHER_SECONDARY` Grade 11-12 |
|---|---|---|---|
| Student and guardian profile | P0, child-care fields emphasized | P0 | P0 |
| Emergency contacts | P0 | P0 | P0 |
| Authorized pickup and temporary pickup change | P0 proposed workflow | Optional | Optional |
| Arrival, absence, late, checkout | P0 proposed preschool extension of attendance | Attendance P0 | Attendance P0 plus theory/lab context proposed |
| Attendance registers and corrections | Simple daily safety lens | P0 | P0 |
| Activity diary and consent-safe photos | P0 | P1/P2 by school policy | P2 |
| Observations and supportive milestones | P0 | Grade 1-3 P1, otherwise optional | Usually not core |
| Homework and timetable | Light/optional | P0 | P0 |
| Exams, marks, CAS, report cards | Not default except supportive reporting | P0 | P0 plus +2 practical/project readiness |
| Streams/subject combinations | Not applicable | Usually not applicable | P0 proposed |
| Practical/lab timetable | Not applicable | P2 for labs | P0 proposed |
| Projects/internal assessment | Light observations | P1/P2 | P0 proposed |
| Fees, invoices, receipts, dues | P0 | P0 | P0 |
| Library | Optional | Common | Common |
| Transport | Where enabled | Where enabled | Where enabled |
| Canteen | Optional/allergy-safe where enabled | Where enabled | Where enabled |
| Notices and notifications | P0 | P0 | P0 |
| Parent-teacher chat | Policy-controlled, not open all-day by default | Policy-controlled | Policy-controlled |
| Learning Layer | Teacher-led/screen-light only | Classroom/lab/session mode | Lab/project resource support where approved |
| Intelligence / AI | Deferred | Deferred | Deferred |

### 7.4 Persona And Surface Matrix

| Persona | Web | Parent App | Teacher App | Principal App | Student Session |
|---|---|---|---|---|---|
| Platform operator | Platform control only | No | No | No | No |
| School owner/principal | Operating desk, reports, approvals | No | No | Attention, alerts, safe approvals | No |
| Preschool owner | Operating desk and exception review | No | No | Child-safety exceptions and coverage | No |
| School administrator/receptionist | Admissions, records, guardians, settings, notices | No | No | Optional attention only | No |
| Accountant/cashier | Fees, receipts, cashier close, accounting handoff | No | No | Read-only finance attention where permitted | No |
| Teacher | Detailed assigned class/subject work | No | Today, attendance, homework, activities, messages | No | Can launch/monitor controlled sessions |
| Parent/guardian | Optional future child-only portal, not operations desk | Main linked-child experience | No | No | No |
| Student | No broad operations dashboard | No | No | No | Controlled learning/session-only surface |
| Driver/conductor | Not web-first | No | No | No | No |
| Staff self-service | Own profile/HR web where enabled | No | No | No | No |

Backend authorization remains authoritative for every cell.

### 7.5 Preschool Product Model

Preschool covers Montessori, Nursery, LKG, and UKG.

Core purpose:

```text
Child safety
Safe handover
Parent trust
Daily care and activity visibility
Teacher simplicity
Admissions and fee operations
Developmental milestones
```

Stage-specific capabilities, subject to school policy and permissions:

- Child and guardian profile.
- Emergency contacts.
- Authorized pickup contacts.
- Temporary pickup change workflow.
- Arrival, absence, late, and checkout tracking.
- Pickup/drop exception workflow.
- Classroom activity diary.
- Consent-safe activity media.
- Simple child observations.
- Supportive milestones.
- Parent updates.
- Events and consent.
- Admissions, waitlist, and class capacity.
- Fees, invoices, receipts, dues, and cashier close.
- Classroom/staff coverage.
- Care and allergy alerts only for authorized staff.

Not default Preschool scope:

- Heavy exams.
- Marks grids.
- CAS workflows.
- Complex report-card workflow.
- Public child ranking.
- Harsh child labels.
- Open all-day parent-teacher chat.
- Broad child-owned app.
- Mandatory detailed meal/nap/toileting/medicine logs for every school.
- Screen-heavy independent learning.

Preschool teacher mobile P0:

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

Preschool parent P0:

```text
Today
Attendance
Pickup/Drop
Activity Updates
Consent-safe Photos
Milestones
Fees and Receipts
Notices
Events
Transport where enabled
```

Preschool admin web P0:

```text
Admissions
Children and Guardians
Attendance
Pickup & Drop
Fees and Receipts
Activities and Milestones
Parent Notices
Staff/Classrooms
Events
Reports
```

Principal/owner view is exception-focused:

```text
Children not checked out
Pending pickup exceptions
Attendance gaps
Care alerts
Unresolved parent concerns
Fee collection/due summary
Admissions and capacity
Staff/classroom coverage
```

### 7.6 School Grade 1-10 Product Model

School (Grade 1-10) is the academic and operational core:

```text
Attendance
Classes, subjects, and teacher assignments
Timetable
Homework
Exams
Marks
CAS/internal assessment where applicable
Report cards
Promotion
Learning activities
Library
Transport
Canteen
Parent communication
Fees and receipts
```

Internal differences:

| Band | Product emphasis |
|---|---|
| Grade 1-3 | Foundational learning and parent-heavy communication. |
| Grade 4-5 | Guided practice, reading, basic homework. |
| Grade 6-8 | Subjects, projects, stronger timetable/homework workflows. |
| Grade 9-10 | Exams, marks, SEE-oriented readiness, report-card workflows. |

Teacher app, parent app, principal app, and web admin remain purpose-specific. Web is the operating desk; mobile is quick, role-scoped companion work.

### 7.7 Higher Secondary / +2 Product Model

Higher Secondary is an extension of shared academics, not a separate academic platform.

Required capabilities:

```text
Programs/streams
Subject combinations
Teacher assignment
Theory timetable
Lab/practical timetable
Practical components
Projects
Internal assessment
Exam and mock-exam readiness
Report cards/results
Lab/room utilization
Student progression and board-preparation workflows
```

Streams and subject combinations must remain school-configurable, not hard-coded. Parent and student views are controlled, own-scope, and non-comparative.

---

## 8. M12 Notification, Notices, Communication, and Chat Summary

M12 is the explicit notification and communication module. It covers both broadcast communication workflows and system-generated alerts.

M12 must include:

```text
Notification Event Intake
Recipient Resolver
Template Engine
Notification Center
Unread Counts
Notification Preferences
Quiet Hours
Channel Routing
SMS/Email/Push/In-app Delivery
Provider Callback Verification
Delivery Logs
Read Receipts
Notice Templates
Recipient Targeting and Preview
Scheduled Notices
Parent-Teacher Chat
Chat Moderation / Report / Block / Escalation
Emergency Broadcast Audit
```

Core rule:

```text
Feature modules emit events.
M12 owns recipient resolution, templates, preferences, delivery routing, retries, delivery logs, read state, and audit.
```

M12 must not:

- Allow each feature module to call SMS/email/push providers directly.
- Expose provider secrets, callback payload secrets, raw object keys, or permanent private URLs.
- Pretend delivery succeeded when a provider is disabled, mocked, or failed.
- Leak private chat bodies or message recipients through dashboard summaries.
- Replace backend authorization with browser-side recipient filtering.

---

## 9. M13 Learning Layer Summary

M13 Learning Layer has an implemented backend/web/mobile foundation with local test evidence. It is not production-ready until staging fixtures, seeded authenticated browser E2E, device QA, school-only policy hardening, and later advanced learning phases are verified.

M13 must include:

```text
Teacher Activity Builder
Smart Board Classroom Mode
School-Only Learning Sessions
Computer Lab Individual Mode
Practice & Quiz Engine
Progress & Mastery Tracking
Parent Learning Summary
Learning Resource Library
Adaptive Recommendations later
Safe AI Assistant later only if approved
```

M13 must reuse:

```text
M0 Platform entitlement and feature settings
M1 Students and guardians
M2 Attendance context
M4 Academics subjects/topics/outcomes
M6 Timetable/homework
M7 Teacher/staff assignments
M12 Communication and Notifications
File Registry and Storage
Audit logs and RBAC
```

M13 must not duplicate core student, teacher, class, subject, parent, file, notification, or audit systems.

---

## 10. Target Users and Daily Workflows

| User | Needs / daily workflows |
|---|---|
| SchoolOS Platform Operator | Manage SaaS tenants, subscriptions, platform settings, provider readiness, billing records, feature access, usage, queues, API keys, support override, and audit logs. |
| School Owner / Principal | View school health, finance, collections, attendance gaps, academics, staff, communication delivery, pending approvals, reports, learning adoption, and operational risks. |
| School Admin | Manage admissions, students, guardians, classes, settings, documents, notices, notification settings, school profile, module settings, and daily records. |
| Accountant / Finance Staff | Manage fee setup, invoices, payments, receipts, refunds, reversals, accounting, ledgers, reports, reconciliation, and day-end close. |
| Librarian | Manage catalogue, copies, issue/return, reservations, overdues, fines, lost/damaged cases, labels, and parent-safe library visibility. |
| Transport Manager / Driver / Conductor | Manage routes, vehicles, assignments, trips, boarding/deboarding, safety alerts, parent trip status, and vehicle/driver documents where supported. |
| Canteen Staff | Manage menu, POS, student meal QR, allergy warnings, wallet/spending controls, receipts, and stock/vendor workflows where supported. |
| Teacher | Manage assigned attendance, homework, marks, class activities, smart-board sessions, lab sessions, progress review, and parent communication. |
| Parent / Guardian | View child-specific attendance, dues, receipts, homework, notices, notifications, results, media, and learning summaries. |
| Student | View allowed timetable, homework, notices, notifications, results, library/canteen information, and school-approved learning sessions where enabled. |

---

## 11. Non-Negotiable Product Boundaries

1. Tenant isolation is mandatory.
2. Parent/student/mobile APIs must be purpose-limited and fail closed.
3. SchoolOS SaaS billing must not mix with school fee collection.
4. Money flows must be idempotent and auditable.
5. Private files must use StorageService/FileRegistryService boundaries.
6. M12 owns notification delivery lifecycle: recipient resolution, templates, preferences, provider routing, delivery logs, retries, read state, and audit.
7. Source modules may emit notification events but must not directly own provider delivery.
8. Learning must be a separate M13 domain, not scattered through existing modules.
9. Learning activities must be school-only by default.
10. Teachers can create/launch activities only for assigned classes/subjects unless an explicit admin permission allows broader curriculum management.
11. Parent learning summaries must be child-scoped and non-comparative.
12. M14 AI/analytics remain roadmap-only until reliable production data exists and human-review controls are approved.
13. Inventory & Asset Management is not active scope and should not appear in active module lists unless re-approved.
