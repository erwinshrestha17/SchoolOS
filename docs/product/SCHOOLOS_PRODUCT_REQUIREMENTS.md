# SchoolOS Product Requirements Document - Combined Master 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school operating SaaS  
**Target schools:** Kindergarten / Montessori to Grade 12 as the long-term product direction; current implementation remains staged around controlled pilot readiness for existing core modules  
**Document type:** Combined master PRD  
**Status:** Active product requirements document for controlled pilot hardening, KG-12 product planning, notification module alignment, and M13 Learning Layer alignment  
**Last updated:** 2026-06-20

---

## 0. Maintainer Note

This document is the active PRD for SchoolOS. It keeps the existing pilot-hardening direction while expanding the product vision from a school-management system into a full KG-12 school operating platform.

The canonical allocation of backend ownership, SchoolOS Web responsibilities, mobile companion responsibilities, allowed roles, and explicit surface exclusions is [`SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`](SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md). This PRD owns product intent; it does not duplicate the module-by-module allocation.

Important distinction:

```text
Current implemented core = broad school-management foundation with remaining seed, browser, mobile, staging, provider, and pilot verification gates
KG-12 SchoolOS = staged product direction
M12 Notification Module = explicit product module for notification center, events, delivery, preferences, retries, provider diagnostics, read state, and audit
M13 Learning Layer = backend, web runtime, parent/student web summary, and Flutter summary foundation implemented locally; staging/browser/device depth remains staged
M14 Intelligence / AI = roadmap-only until production data, privacy, audit, and human-review controls are ready
Inventory & Asset Management = scrapped from active module taxonomy
```

Implementation claims must still be validated against the evidence in `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`, real pilot-school workflows, official reporting templates, provider sandbox/staging flows, production security review, and the verification commands in the next-phase plan.

---

## 1. Executive Summary

SchoolOS should be positioned as a **Nepal-first KG-12 school operating system**, not merely a generic school management dashboard.

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

SchoolOS is a production-grade, multi-tenant SaaS school operating system for Nepali schools. It should support Kindergarten / Montessori to Grade 12 through staged implementation.

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
5. Prepare a foundation for KG-12 expansion, analytics, mobile expansion, provider integrations, SaaS billing automation, M13 Learning, and M14 Intelligence/AI.
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

## 7. KG-12 Product Stages

```text
Stage A: Kindergarten / ECD / Montessori
Stage B: Grade 1-3
Stage C: Grade 4-5
Stage D: Grade 6-8
Stage E: Grade 9-10
Stage F: Grade 11-12
```

| Stage | Primary SchoolOS Emphasis |
|---|---|
| Kindergarten / ECD | guardians, attendance, pickup/drop, meals, milestones, activity feed, smart-board teacher-led learning |
| Grade 1-3 | foundation learning, parent-heavy communication, simple homework, attendance, basic progress |
| Grade 4-5 | guided practice, homework, library reading, smart-board lessons, basic lab practice |
| Grade 6-8 | subject depth, projects, digital skills, lab practice, stronger timetable/homework |
| Grade 9-10 | SEE preparation, exams, report cards, topic mastery, academic tracking |
| Grade 11-12 | streams, subject combinations, practicals, projects, advanced learning labs, board exam preparation |

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
