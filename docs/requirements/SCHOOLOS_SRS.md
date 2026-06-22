# SchoolOS Software Requirements Specification

**Status:** Canonical SRS
**Last reviewed date:** 2026-06-22

## Active System Scope

SchoolOS supports one shared multi-tenant platform for:

```text
SCHOOL
  Grade 1-10

HIGHER_SECONDARY
  Grade 11-12 / +2

COLLEGE
  Bachelor, Master, Diploma, and professional programs
```

## Core Requirements

| Area | Requirement |
|---|---|
| Tenancy | Every institution remains isolated by `tenantId`. |
| Experience packs | `SCHOOL`, `HIGHER_SECONDARY`, and `COLLEGE` are configurable over the shared core. |
| Academic structure | Grade 1-10 uses classes/sections/subjects; +2 uses streams/combinations/practicals/projects; College uses departments/programs/batches/terms/courses/offerings/registrations. |
| Admissions | Admissions must support Grade 1-10, +2, and College intake workflows. |
| Attendance | Attendance must support daily, class-wise, and course-wise patterns. |
| Fees | Fees, receipts, reversals, and ledgers remain backend-owned and auditable. |
| Exams/results | The system must support school report cards, +2 board-readiness workflows, and college GPA/CGPA/back-paper workflows. |
| Timetable | Timetable must support classes, sections, streams, courses, rooms, labs, and faculty assignments. |
| Documents | Documents and protected files must use the platform file registry flow. |
| Notifications | Module events must route through the notification/communication module. |
| Mobile | Mobile remains a companion app with role-scoped capabilities. |
| AI | M14 Intelligence / AI remains roadmap-only unless explicitly approved. |

## College-Specific Requirements

- Department management
- Program management
- Batch management
- Semester/year management
- Course and curriculum management
- Course offerings
- Course registrations
- Internal assessments
- GPA/CGPA
- Back papers
- Project/thesis readiness
- Internship readiness
- Placement and alumni readiness

## Non-Functional Requirements

- Tenant isolation is mandatory.
- Backend authorization is authoritative.
- Official totals must come from backend/database logic.
- Release readiness must remain evidence-based.
- Documentation changes do not upgrade GA status.
