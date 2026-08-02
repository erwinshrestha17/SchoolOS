# SchoolOS Teacher Web Persona Design Package

This directory defines the repository-grounded audit, capability matrix, complete page architecture, wireframes, and implementation plan for the SchoolOS **Teacher** web persona.

## Governing rule

```text
Teacher access is created by active assignments and explicit delegations.
A Teacher role alone never grants school-wide access.
```

The target supports ordinary Teachers, Class Teachers, Subject Teachers, temporary substitutes, assistants, and delegated coordinators while preserving one Teacher-focused shell.

---

## Documents

| Document | Purpose |
|---|---|
| [`DESIGN.md`](./DESIGN.md) | Canonical Teacher design entry point, target navigation, module scope, 60-page catalogue, and implementation gates. |
| [`TEACHER_PERSONA_AUDIT.md`](./TEACHER_PERSONA_AUDIT.md) | Full current-state audit of roles, permissions, assignments, navigation, routes, page compositions, features, risks, and required corrections. |
| [`TEACHER_FEATURE_MATRIX.md`](./TEACHER_FEATURE_MATRIX.md) | Current-versus-target matrix for M0–M15, route ownership, forbidden workspaces, and Teacher variants. |
| [`TEACHER_WEB_DESIGN.md`](./TEACHER_WEB_DESIGN.md) | Detailed page-by-page UX specification for 60 Teacher web surfaces. |
| [`TEACHER_WEB_WIREFRAMES.md`](./TEACHER_WEB_WIREFRAMES.md) | Low-fidelity desktop, narrow, table, marks-grid, review, state, and delegated-workspace wireframes. |
| [`TEACHER_WEB_IMPLEMENTATION_SPEC.md`](./TEACHER_WEB_IMPLEMENTATION_SPEC.md) | Permission cleanup, role migration, API projections, route changes, components, cache revocation, offline behavior, security, tests, and delivery slices. |

---

## Strong current foundations

The current repository already includes:

- canonical assignment-scoped backend authorization;
- active Staff resolution;
- exact class, section, subject, component, lifecycle, and ownership checks;
- temporary delegation support;
- generic fail-closed authorization responses;
- Teacher-specific persona resolution;
- permission-derived coordinator capabilities;
- direct-route redirect before restricted child rendering;
- globally filtered Teacher workspace tabs;
- a Teacher Today page;
- separate Subject Students and Homeroom views;
- a read-only Homeroom cross-subject summary;
- a Teacher borrower Library workspace;
- Teacher-aware notice audience restrictions;
- real offline attendance replay coverage.

The package preserves and extends these foundations.

---

## Critical audit findings

1. The base `teacher` role includes broad permissions that the canonical Teacher specification says should not be granted by default.
2. Separate `teacher` and `subject_teacher` presets conflict with the assignment-first model and already differ on attendance capability.
3. `/dashboard/attendance` still renders an administrator-shaped school-wide operations composition for Teachers.
4. Attendance anomalies, conflicts, follow-up, bulk operations, and settings require stronger Teacher route isolation.
5. Today links marks deadlines to a restricted exam-administration route.
6. The Marks page exposes a Retest action even when the Teacher cannot open it.
7. There is no dedicated assignment-scoped Teacher student-detail page.
8. Teacher navigation does not directly expose My Homeroom, My Subjects, Class Reports, or frequent self-service pages.
9. Homework date filtering may truncate results because a maximum of 100 records is filtered and paginated in the browser.
10. Ordinary Teachers lack a purpose-limited Class Reports workspace.
11. Library reservations, renewal requests, reading lists, and resource requests are incomplete.
12. Assignment expiry does not yet have one explicit web cache, draft, protected-file, and open-page revocation contract.
13. Browser E2E coverage needs a complete Class Teacher, Subject Teacher, delegated Teacher, and no-assignment Teacher matrix.

---

## Target Teacher authority

```text
Base Teacher self-service
+ active TeacherAssignment
+ active TeacherDelegation
+ module entitlement
+ workflow state
+ record ownership
```

Class Teacher and Subject Teacher should be assignment types under one base Teacher role, not permanently drifting broad system roles.

---

## Target navigation

```text
Today
  Today
  My Schedule

My Teaching
  My Homeroom                 [Class Teacher only]
  My Subjects
  My Students
  Attendance
  Homework
  Assessments & Marks
  Activities
  Class Reports

Communication
  Notices
  Notifications

Resources
  Library                     [enabled]
  Learning                    [enabled]

My Workspace
  Overview
  My Attendance
  Leave
  Payslips
  Contracts & Documents
  Profile
  Preferences
  Security

Coordination                  [delegated only]
  Coordination Overview
  Timetable Builder
  Substitutions
  Exam Terms
  Activity Moderation
  Library Desk
```

---

## Ordinary Teacher exclusions

The ordinary Teacher must not receive navigation, API, search, report, export, or protected-file access for:

- admissions;
- school-wide student administration;
- fees and receipts;
- accounting;
- HR administration;
- payroll operations;
- school settings;
- generic school reports;
- Transport management;
- Canteen management;
- school-wide attendance operations;
- result publication, marks unlocking, promotion, or report-card administration;
- Platform.

---

## Page coverage

The design package specifies 60 pages across:

- Today and schedule;
- Homeroom, Subjects, Students, and Student Detail;
- Attendance;
- Homework;
- Assessments, Marks, CAS, Corrections, Performance, and Readiness;
- Activities, Gallery, Observations, and Milestones;
- Notices and Notifications;
- assignment-scoped Class Reports;
- Library and Learning;
- employee self-service;
- delegated timetable, substitution, exam, moderation, and Library coordination.

---

## Delivery order

### P0

1. Clean the canonical base Teacher permission preset.
2. Converge Class/Subject authority on assignments and plan legacy `subject_teacher` migration.
3. Replace the shared Admin attendance landing with a Teacher attendance composition.
4. Expand restricted-route coverage for Attendance administration.
5. Fix Teacher links and actions that point to restricted academic routes.
6. Implement assignment-expiry cache, editor, offline draft, and protected-file revocation.

### P1

1. Add My Homeroom, My Subjects, Student Detail, Class Reports, and direct self-service routes.
2. Redesign the Teacher Assessments & Marks information architecture.
3. Add purpose-limited Teacher report APIs.
4. Move homework date filtering and pagination to the server.
5. Complete Library borrower and reading-list workflows.
6. Add the dedicated Teacher browser test matrix.

### P2

1. Add Coordination Overview with delegation scope and expiry evidence.
2. Standardize mobile-to-web draft and conflict continuation.

---

## Implementation gate

This package is a documentation and design specification. It does not itself change runtime authorization or UI code.

The Teacher design is not implemented until:

- the base permission preset is purpose-limited;
- the Attendance landing is Teacher-specific;
- direct routes and visible actions match Teacher capabilities;
- assignment removal revokes cached and offline access immediately;
- assignment-scoped Student Detail and Class Reports exist;
- ordinary Teachers remain denied from every administrative and financial domain;
- the complete persona E2E matrix passes.
