# SchoolOS Product Requirements Document - Combined Master 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school operating SaaS  
**Target schools:** Kindergarten / Montessori to Grade 12 as the long-term product direction; current implementation remains staged around controlled pilot readiness for existing core modules  
**Document type:** Combined master PRD merged from the original pilot-hardening PRD and the researched 2026 PRD draft  
**Status:** Active product requirements document for controlled pilot hardening, KG-12 product planning, and M12 Learning Layer alignment  
**Last updated:** 2026-06-18

---

## 0. Maintainer Note

This document is the active PRD for SchoolOS. It keeps the existing pilot-hardening direction while expanding the product vision from a school-management system into a full KG-12 school operating platform.

Important distinction:

```text
Current implemented core = broad school-management foundation with remaining seed, browser, mobile, staging, provider, and pilot verification gates
KG-12 SchoolOS = staged product direction
M12 Learning Layer = backend, web runtime, parent/student web summary, and Flutter summary foundation implemented locally; staging/browser/device depth remains staged
```

Implementation claims must still be validated against the evidence in `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`, real pilot-school workflows, official reporting templates, provider sandbox/staging flows, production security review, and the verification commands in the next-phase plan.

---

## 1. Executive Summary

SchoolOS should be positioned as a **Nepal-first KG-12 school operating system**, not merely a generic school management dashboard.

The core product thesis:

```text
One login, one school ledger, one student record, one learning record, one audit trail.
```

SchoolOS must help Nepali schools manage daily operations, student records, guardians, attendance, fees, receipts, accounting, academics, exams, report cards, parent communication, HR/payroll, library, transport, canteen, classroom learning, file privacy, reporting readiness, and future school intelligence from one tenant-isolated platform.

The strongest product direction is to build around five anchors:

1. **School master data** strong enough to support admissions, government-reporting readiness, class setup, student lifecycle, staff assignments, and school configuration.
2. **Academic operations** covering attendance, timetable, homework, gradebook, exams, CAS, report cards, promotion, streams, practicals, and parent/student visibility.
3. **Cashier and finance operations** reliable enough for real-world fee collection, receipt generation, refunds, reversals, day-end close, reconciliation, and accounting controls.
4. **Learning operations** covering teacher-created activities, smart-board sessions, school-only computer-lab practice, progress tracking, and parent learning summaries.
5. **Privacy, auditability, and tenant isolation** as first-class requirements because SchoolOS stores student, guardian, staff, financial, operational, learning, and communication data.

The product should first prove:

```text
1 school
1 clean source of truth
1 reconciled fee flow
1 teacher-friendly daily workflow
1 parent-visible student record
1 safe classroom-learning workflow
1 reporting/export validation layer
```

Do not expand into open-ended AI, microservices, Angular migration, broad live-map workflows, biometric workflows, or deep mobile expansion until the pilot workflows are stable.

---

## 2. Product Overview

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
Notices and communication
Activity feed and milestones
Academics, exams, CAS, report cards, streams, practicals, and projects
Homework and timetable
HR and payroll
Library
Transport
Canteen
Reports and exports
Protected File Registry
M12 Learning Layer
Future school intelligence
```

SchoolOS should not feel like a generic CRUD dashboard. It must match real school-office and classroom workflows in Nepal: front-desk fee collection, principal oversight, teacher attendance/marks entry, guardian communication, smart-board teaching, computer-lab practice, transport tracking, library/canteen counters, and periodic reporting pressure.

The product should first prioritize pilot reliability, financial correctness, tenant isolation, parent/student access boundaries, protected files, auditability, and operational stability before expanding into advanced AI, mobile, payment, biometric, live-map, or advanced learning workflows.

---

## 3. Problem Statement

Many schools in Nepal still operate through fragmented systems: paper registers, Excel sheets, manual fee ledgers, offline accounting tools, attendance notebooks, printed/PDF report-card templates, WhatsApp/Viber groups, unstructured Google Drive folders, disconnected parent communication channels, and separate or informal classroom-learning tools.

This creates:

- Duplicate data entry.
- Weak financial visibility.
- Fee receipt/accounting mismatch risk.
- Inconsistent student records.
- Slow parent communication.
- Poor auditability.
- Weak file privacy.
- Limited school-level analytics.
- Difficult official-reporting preparation.
- Little connection between classroom activities, teacher planning, student practice, and parent progress summaries.

SchoolOS solves this by providing a single tenant-isolated system where each school can manage operations, academics, finance, communication, files, reporting workflows, and staged classroom-learning workflows in one place.

---

## 4. Product Vision

To become the default KG-12 operating system for Nepali schools by offering a reliable, locally relevant, financially accurate, classroom-aware, and easy-to-use SaaS platform that supports the full school lifecycle from admission to learning progress, accounting, reporting, and parent engagement.

SchoolOS should win through:

- Nepal-first workflows.
- Strong accounting and fee correctness.
- Tenant-safe SaaS architecture.
- Parent/teacher/mobile readiness.
- Protected File Registry and private media access.
- QR identity for student operations.
- IEMIS/reporting readiness matrix.
- Canteen, library, transport, HR, payroll, academics, communication, learning, and accounting in one connected platform.
- Smart-board and computer-lab friendly classroom support.
- Practical low-bandwidth and school-office UX.
- Gradual code-file modularization instead of premature microservices.

---

## 5. Product Goals

### 5.1 Business Goals

1. Enable multiple schools to run independently on one SaaS platform.
2. Support controlled pilot deployment after staging verification.
3. Provide strong coverage for school operations, fees, accounting, academics, attendance, communication, and parent access.
4. Build trust through accurate receipts, ledgers, reports, audit trails, protected files, and permission-scoped learning records.
5. Prepare a foundation for KG-12 expansion, analytics, mobile expansion, provider integrations, SaaS billing automation, and M12 Learning.
6. Differentiate through Nepal-first operating context, cashier workflows, IEMIS readiness, smart-board learning support, computer-lab practice, and strong tenant isolation.

### 5.2 Product Goals

1. Centralize school data under secure tenant isolation.
2. Provide school administrators with one operational dashboard.
3. Provide principals with visibility into school health, collections, attendance gaps, academic status, pending approvals, learning adoption, and reporting-readiness issues.
4. Allow teachers to manage attendance, homework, academics, marks/CAS, timetable, communication, and planned classroom activities.
5. Allow parents to view child-specific notices, dues, fees, receipts, attendance, homework, progress, report cards, and safe learning summaries.
6. Allow students to view their own timetable, homework, notices, attendance, report cards, library/canteen information, and school-approved learning activities where enabled.
7. Provide finance staff/cashiers with fee ledgers, receipts, refunds, reversals, cashier close, reconciliation, and accounting controls.
8. Keep platform administration separate from tenant/school operations.
9. Treat official reporting and IEMIS readiness as a validation workflow, not a static export button.
10. Treat M12 Learning as a separate product vertical that reuses SchoolOS Core data instead of duplicating it.

### 5.3 Technical Goals

1. Keep the NestJS modular monolith as the primary architecture.
2. Use PostgreSQL/Prisma for persistence and Redis/BullMQ for cache and queues.
3. Maintain strict `tenantId` boundaries across all modules.
4. Avoid premature migration to microservices or Angular.
5. Continue using Next.js for the current dashboard and Flutter for the companion app.
6. Keep browser auth cookie-first and mobile/API access bearer-token compatible.
7. Split large services/components by responsibility as code-file modularization, not microservices.
8. Keep parent/student/driver/mobile APIs purpose-limited and avoid exposing admin-shaped responses.
9. Implement M12 Learning as `apps/api/src/learning`, `apps/web/app/dashboard/learning`, `apps/web/app/classroom/board`, `apps/web/app/student/learning`, `apps/web/app/parent/learning`, and `packages/core/src/learning` when implementation begins.

---

## 6. Nepal Market and School Operating Context

### 6.1 Nepal-First Requirements

| Area | Product implication |
|---|---|
| Academic year and fiscal year may differ | Support academic-year context and fiscal-year/accounting period context separately. |
| Schools use class/section/roll conventions | Class, section, roll number, academic year, and lifecycle status must be first-class fields. |
| KG, primary, secondary, and +2 workflows differ | Use grade bands, school levels, streams, practicals, and product edition settings. |
| Parents expect simple communication | Parent app/portal should show child-specific dues, attendance, notices, homework, results, receipts, and learning summaries without admin complexity. |
| School offices often use mixed manual/digital workflows | Import/export, CSV/Excel, printable receipts, and manual reconciliation must be supported. |
| Nepali and English usage both matter | UI labels, reports, receipts, notices, learning activities, and templates should be localization-ready. |
| Official reporting pressure exists | IEMIS/export readiness must be treated as a validation workflow, not a single static file export. |
| Connectivity can be inconsistent | Important workflows need drafts, retry-safe submissions, and clear sync/conflict behavior. |
| Smart boards and computer labs may exist before 1:1 devices | M12 Learning should prioritize teacher-led board mode and school-only lab mode. |
| Local financial workflows matter | Cash, manual bank transfer, eSewa/Khalti readiness, cashier close, and reconciliation must be explicit. |
| Local naming patterns matter | Nepali names, mixed scripts, guardian phone reuse, and duplicate candidate matching must be handled. |
| Low-bandwidth usage is common | Media, dashboards, and learning activities must degrade gracefully. |

### 6.2 Education System and Reporting Context

SchoolOS should support the operational structure used by Nepali schools:

- Kindergarten / Montessori / ECD and primary levels.
- Basic and secondary class progression.
- Grade 11-12 / +2 extensibility through streams and subject combinations.
- Class and section setup.
- Roll number assignment by academic year/class/section.
- Teacher, class teacher, and subject teacher assignments.
- Exam terms, assessment components, CAS/continuous assessment, grade sheets, and report cards.
- Promotion, transfer, withdrawal, graduation, and archived student states.
- Practical, project, and stream-based academic records for Grade 11-12 later.
- Scholarships, student category flags, and official/export-related fields where needed.
- School profile readiness, infrastructure fields, stream/program flags, and staff roster readiness.

The product should maintain a clean distinction between:

```text
Academic structure: class, section, subject, timetable, exam term, stream, subject combination
Student lifecycle: applicant, active, transferred, withdrawn, graduated, archived
Financial lifecycle: fee plan, invoice, payment, receipt, reversal, refund, cashier close, journal posting
Learning lifecycle: activity draft, scheduled session, live session, attempt, progress, parent summary
Reporting lifecycle: draft data, validation errors, official-ready state, exported artifact, audit trail
```

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

## 8. M12 Learning Layer Summary

M12 Learning Layer has an implemented backend/web/mobile foundation with local test evidence. It is not production-ready until staging fixtures, seeded authenticated browser E2E, device QA, school-only policy hardening, and later advanced learning phases are verified.

M12 must include:

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
Safe AI Assistant later
```

Implemented on 2026-06-12:

```text
Teacher Activity Builder APIs and web workspace
Easy / Medium / Hard difficulty
Smart Board and Computer Lab session backend plus web runtime routes
School-Only Learning Sessions
Session list, heartbeat, and participant monitor
Practice & Quiz Engine for MCQ, true/false, normalized short answer, matching, and ordering
Attempt autosave and idempotent submission
Progress & Mastery Tracking foundation
Parent Learning Summary foundation on web and mobile
Student self-scoped mobile learning summary
Learning Resource Library endpoints and activity resource panel
Tenant isolation, RBAC, entitlement, audit logs, E2E, web contract, and mobile test coverage
```

M12 must reuse:

```text
M0 Platform entitlement and feature settings
M1 Students and guardians
M2 Attendance context
M4 Academics subjects/topics/outcomes
M6 Timetable/homework
M7 Teacher/staff assignments
M10 Communication
File Registry and Storage
Audit logs and RBAC
```

M12 must not duplicate core student, teacher, class, subject, parent, file, notification, or audit systems.

### 8.1 Product Positioning

SchoolOS is positioned as a KG-12 school operating platform with three connected layers:

```text
1. School Management Layer
2. Learning Layer
3. Intelligence & Insight Layer later
```

The School Management Layer runs daily school operations: records, fees, attendance, academics, staff, communication, transport, canteen, library, accounting, reports, and platform controls.

The Learning Layer improves classroom teaching and school-controlled student practice. It supports teacher-led interactive learning, smart-board sessions, lab practice, progress tracking, and parent-safe summaries.

The future Intelligence Layer is deferred until reliable production data, tenant-safe aggregation, explainability, human review, and explicit product approval exist. It must not become open-ended student AI chat or automatic punishment/risk scoring.

### 8.2 KG-12 Learning Stages

| Stage | Primary mode | Product expectations | Avoid / defer |
|---|---|---|---|
| Stage A - Kindergarten / ECD / Montessori | Smart-board teacher-led only | Picture matching, letter/Nepali character sounds, number counting, colors/shapes, rhymes, story sequencing, movement activities, milestones, parent daily summary | Independent long screen sessions, ranking, open-ended AI, heavy quizzes |
| Stage B - Grade 1-3 | Teacher-led smart board plus short guided practice | Phonics, Nepali reading, basic math, picture vocabulary, story comprehension, science sorting, short quizzes, supportive progress labels | Competitive ranking and unsupervised screen-heavy learning |
| Stage C - Grade 4-5 | Smart-board explanation plus group/lab practice | Fractions, science diagrams, Nepal map basics, grammar, revision quizzes, library-linked reading, parent weekly summary | Public comparisons and broad home learning app |
| Stage D - Grade 6-8 | Smart-board concepts plus computer-lab practice | Algebra, geometry visualizer, science simulations, maps/timelines, paragraph writing, coding basics, digital safety, projects | AI tutor/open chat and heavy simulations until later |
| Stage E - Grade 9-10 | Concept mastery plus SEE-style preparation | Topic mastery, mock tests, mistake notebook, math/science/social studies revision, teacher weak-topic dashboard | Raw prediction scores to parents/students |
| Stage F - Grade 11-12 | Stream-based advanced learning, practicals, projects, board prep | Science, Management, Humanities, Education, Computer Science, accountancy/economics/coding labs, project/practical tracking, career/counselling notes | Full adaptive recommendations and AI tutor until approved |

### 8.3 Nepal-First Learning Rules

The Learning Layer must support smart-board classrooms, projector-based teaching, shared computer labs, low-bandwidth environments, mixed manual/digital workflows, English/Nepali/mixed explanations, local examples, curriculum alignment, teacher-controlled session flow, and parent-safe summaries.

Local content examples should use familiar Nepal contexts such as momo, roti, rice, rupees, local markets, monsoon, Terai, Hills, Himalayas, Bagmati, Lumbini, school bus, crops, festivals, and community life.

Allowed usage modes:

```text
SMART_BOARD  = one screen, whole class
GROUP        = students participate in groups
COMPUTER_LAB = individual attempts in school lab
WORKSHEET    = printable fallback
HYBRID       = smart-board explanation + lab practice
```

### 8.4 Deferred Boundaries

Explicitly deferred until later approval:

```text
Full adaptive learning and recommendations
AI tutor or open chat
Heavy simulations and advanced subject labs
Public leaderboards or comparative ranking
Full Flutter smart-board/lab runtime
Broad student mobile/home app
School-only network/location hardening beyond authenticated membership and expiring code/QR token
```

---

## 9. Target Users and Daily Workflows

| User | Needs / daily workflows |
|---|---|
| SchoolOS Platform Operator | Manage SaaS tenants, subscriptions, platform settings, provider readiness, billing records, feature access, usage, queues, API keys, support override, and audit logs. |
| School Owner / Principal | View school health, finance, collections, attendance gaps, academics, staff, communication, pending approvals, reports, learning adoption, and operational risks. |
| School Admin | Manage admissions, students, guardians, classes, settings, documents, notices, school profile, module settings, and daily records. |
| Accountant / Finance Staff | Manage fee setup, invoices, payments, receipts, refunds, reversals, accounting, ledgers, reports, reconciliation, and day-end close. |
| Teacher | Manage assigned attendance, homework, marks, class activities, smart-board sessions, lab sessions, and progress review. |
| Parent / Guardian | View child-specific attendance, dues, receipts, homework, notices, results, media, and learning summaries. |
| Student | View allowed timetable, homework, notices, results, library/canteen information, and school-approved learning sessions where enabled. |

---

## 10. Non-Negotiable Product Boundaries

1. Tenant isolation is mandatory.
2. Parent/student/mobile APIs must be purpose-limited and fail closed.
3. SchoolOS SaaS billing must not mix with school fee collection.
4. Money flows must be idempotent and auditable.
5. Private files must use StorageService/FileRegistryService boundaries.
6. Learning must be a separate M12 domain, not scattered through existing modules.
7. Learning activities must be school-only by default.
8. Teachers can create/launch activities only for assigned classes/subjects.
9. Parent learning summaries must be child-scoped and non-comparative.
10. AI/analytics remain roadmap-only until reliable production data exists and human-review controls are approved.
