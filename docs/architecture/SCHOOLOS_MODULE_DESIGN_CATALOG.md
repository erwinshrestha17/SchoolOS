# SchoolOS Module Design Catalog

**Status:** Canonical MDD catalog
**Last reviewed date:** 2026-06-22

## Active Experience Packs

```text
SCHOOL
  Grade 1-10

HIGHER_SECONDARY
  Grade 11-12 / +2

COLLEGE
  Bachelor, Master, Diploma, and professional programs
```

## Active Module Taxonomy

| Module | Name | Canonical owner |
|---|---|---|
| M0 | Platform Core | Tenancy, plans, modules, users/RBAC, support override, File Registry, providers, queues, settings, audit, platform operations, and experience-pack enablement. |
| M1 | Admissions and Student Profiles | Student, guardian, enrollment, lifecycle, documents, ID, admission cases, duplicate review, and college admission/enrollment extensions. |
| M2 | Smart Attendance | Student/staff attendance, sessions, drafts, corrections, registers, anomalies, attendance alerts, and course-wise college attendance. |
| M3 | Fees and Receipts | Fee plans, invoices, payments, receipts, refunds, reversals, cashier close, and college fee heads. |
| M4 | Academics, Exams, CAS, Report Cards | Classes, subjects, streams, courses, curriculum, exams, marks, report cards, GPA/CGPA, back papers, projects, and college academic workflows. |
| M5 | Activity Feed and Milestones | Activity posts, media, consent, observations, milestones, parent/guardian feed, moderation, and stage-appropriate updates where enabled. |
| M6 | Homework and Timetable | Homework, submissions, timetable, substitutions, rooms, workload, course schedules, and conflict detection. |
| M7 | HR and Payroll | Staff records, contracts, leave, attendance, payroll, payslips, and staff self-service. |
| M8 | Library | Catalogue, copies, circulation, reservations, fines, labels, and library reports. |
| M9 | Transport | Routes, stops, vehicles, drivers, assignments, trips, boarding/deboarding, and status/GPS readiness. |
| M10 | Canteen | Menu, meal plans, wallet/POS, serving, stock, and vendor workflows. |
| M11 | Accounting and Finance | Chart of accounts, journals, vouchers, fiscal locks, reconciliation, and accounting reports. |
| M12 | Notifications, Notices, Communication, Chat | Event intake, recipient resolution, templates, preferences, delivery, retries, read state, notices, chat, moderation. |
| M13 | Learning Layer | Teacher activities, sessions, attempts, progress, resources, course materials, assignments, and parent/guardian summaries. |
| M14 | Intelligence / AI | Deferred roadmap only. |

`M8A`, `M8B`, and `M8C` are obsolete. Inventory & Asset Management is not active scope.

## Module And Stage Matrix

| Module | `SCHOOL` Grade 1-10 | `HIGHER_SECONDARY` Grade 11-12 | `COLLEGE` Bachelor/Master |
|---|---|---|---|
| M0 Platform Core | Required | Required | Required, with program/college experience configuration |
| M1 Admissions and Student Profiles | Required | Required, with stream/program context | Required, with program/batch/term enrollment context |
| M2 Smart Attendance | Required | Required, with theory/lab detail | Required, with course-wise and lecture-wise attendance |
| M3 Fees and Receipts | Required | Required | Required, with semester/exam/back-paper fee heads |
| M4 Academics, Exams, CAS, Report Cards | Required | Required, with streams/combinations/practicals/projects | Required, with programs, courses, GPA/CGPA, back papers, projects |
| M5 Activity Feed and Milestones | Optional/required by institution policy | Optional/required for updates/projects | Optional, mostly announcements and academic updates |
| M6 Homework and Timetable | Required | Required, with theory/lab timetable | Required, with course timetable, rooms/labs, faculty workload |
| M7 HR and Payroll | Required | Required | Required |
| M8 Library | Common | Common | Common, with research/journal readiness |
| M9 Transport | Where enabled | Where enabled | Where enabled |
| M10 Canteen | Where enabled | Where enabled | Where enabled |
| M11 Accounting and Finance | Optional/advanced | Optional/advanced | Optional/advanced |
| M12 Notifications, Notices, Communication, Chat | Required | Required | Required |
| M13 Learning Layer | Teacher-led/classroom/lab | Lab/project support where approved | Course materials, assignments, lab resources, project submissions |
| M14 Intelligence / AI | Deferred | Deferred | Deferred |

## Cross-Module Design Rules

1. `tenantId` is the tenant boundary for modules, jobs, files, exports, reports, notifications, cache, mobile, and learning.
2. Backend authorization and module entitlement are authoritative.
3. Files follow `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`.
4. Money modules use backend/database totals, idempotency, audit, and reversal/correction.
5. M12 owns notification delivery; source modules emit normalized events only.
6. M13 remains separate and reuses core records, timetable, communication, files, RBAC, and audit.
7. M14 is roadmap-only and must not be implemented as incidental analytics or AI inside another module.

## College Architecture Direction

College support must evolve SchoolOS from class-only structures into program-aware structures:

```text
Experience Pack -> Program -> Batch -> Term -> Course -> Offering -> Registration
```

Recommended Phase 1 models:

- `AcademicProgram`
- `AcademicBatch`
- `AcademicTerm`
- `Course`
- `CurriculumCourse`
- `CourseOffering`
- `CourseRegistration`

## Prioritized Roadmap

| Priority | Work | Required proof |
|---|---|---|
| P0 | Preserve release posture and complete smoke/staging gates. | Existing verification evidence plus staging/pilot proof. |
| P1 | Implement backend-owned experience resolver for `SCHOOL`, `HIGHER_SECONDARY`, and `COLLEGE`. | Schema, contracts, RBAC, tenant tests. |
| P1 | Design college program/batch/term/course model. | Prisma design, API contracts, OpenAPI/core DTOs. |
| P2 | Add college setup screens and APIs. | Backend tests, web tests, seed data. |
| P3 | Add college course registration, attendance, marks, GPA/CGPA, and back-paper workflows. | End-to-end academic tests. |
