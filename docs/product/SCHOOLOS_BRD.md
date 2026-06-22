# SchoolOS Business Requirements Document

**Status:** Canonical BRD
**Last reviewed date:** 2026-06-22

## Business Decision

SchoolOS is one Nepal-first multi-tenant education operating SaaS for:

```text
SCHOOL
  Grade 1-10

HIGHER_SECONDARY
  Grade 11-12 / +2

COLLEGE
  Bachelor, Master, Diploma, and professional programs
```

SchoolOS must not become separate products, databases, or apps for school, +2, and college segments.

## Target Segments

| Segment | Business need |
|---|---|
| School Grade 1-10 | Admissions, attendance, fees, homework, timetable, exams, report cards, notices, operations, and reporting. |
| Higher Secondary / +2 | Streams, subject combinations, practicals, projects, internal assessment, exams, and board-readiness workflows. |
| College | Departments, programs, batches, terms, courses, course registration, GPA/CGPA, back papers, projects, internships, placement, and portal workflows. |
| Multi-branch education groups | Tenant isolation, shared platform operations, reporting, subscriptions, support, and common controls. |

## Business Requirements

| ID | Requirement |
|---|---|
| BRD-01 | Support `SCHOOL`, `HIGHER_SECONDARY`, and `COLLEGE` as configurable experience packs over one shared core. |
| BRD-02 | Use `School (Grade 1-10)` as the official label for Grade 1-10 institutions. |
| BRD-03 | Support +2 through configurable streams, subject combinations, practicals, projects, internal assessments, and board-readiness workflows. |
| BRD-04 | Support college through departments, programs, batches, terms, courses, course offerings, course registrations, GPA/CGPA, back papers, projects, internships, placement, and alumni readiness. |
| BRD-05 | Keep one shared web application and one Flutter companion app with role-scoped capabilities. |
| BRD-06 | Keep release status evidence-based; documentation changes do not upgrade release readiness. |
| BRD-07 | Keep M14 Intelligence / AI roadmap-only until approved production controls exist. |

## Packaging Direction

| Package axis | Direction |
|---|---|
| Experience packs | `SCHOOL`, `HIGHER_SECONDARY`, `COLLEGE`. |
| Core modules | M0-M7 and M12 remain the likely baseline for most institutions, subject to entitlement policy. |
| Operations modules | Library, Transport, Canteen, Accounting, Learning, and advanced operations remain entitlement-controlled. |
| College expansion | Programs, courses, registration, GPA/CGPA, back papers, projects, internships, placement, and alumni can be phased by plan. |
| Mobile | One companion app; capabilities are controlled by backend entitlement, role, and scope. |

## Success Metrics

| Metric | Target direction |
|---|---|
| Pilot workflow completion | One institution completes agreed workflows without engineering intervention. |
| Finance correctness | Official totals remain backend-owned and auditable. |
| Academic readiness | Grade 1-10, +2, and college workflows are configurable without separate systems. |
| Support burden | Common tenant setup, role, provider, and module-lock questions are diagnosable from platform operations. |

## Business Risks

| Risk | Mitigation |
|---|---|
| Overclaiming readiness before staging/pilot proof | GA release policy and readiness audit remain authoritative. |
| Building separate products | PRD, FRS, SRS, and architecture enforce one shared core plus experience packs. |
| +2 workflows becoming hard-coded | Require configurable streams, combinations, practicals, and projects. |
| College workflows becoming class-only | Require program, batch, term, course, offering, and registration structures. |
| Support/ops cannot run the product | Production runbook, platform operations, monitoring, backup/restore, and support evidence are GA gates. |
