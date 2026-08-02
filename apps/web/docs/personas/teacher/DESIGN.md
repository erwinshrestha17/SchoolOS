# SchoolOS Teacher Web Design

**Canonical design entry point**  
**Persona:** Teacher  
**Variants:** Class Teacher, Subject Teacher, Assistant Teacher, Substitute Teacher, delegated Teacher coordinator  
**Surface:** SchoolOS Web  
**Authority model:** Assignment-scoped  
**Date:** 2026-08-02

---

## 1. Product definition

The Teacher web workspace is the detailed teaching and class-coordination surface of SchoolOS.

```text
Teacher authority
= base Teacher self-service
+ active Class/Subject assignments
+ approved temporary delegations
+ workflow state
+ record ownership
```

The Teacher must never receive school-wide authority merely because a shared module contains administrative features.

The web experience supports:

- the Teacher's daily schedule and priorities;
- assigned homerooms, subjects, classes, sections, and students;
- homeroom and permitted period attendance;
- homework creation, review, feedback, and completion analysis;
- marks and CAS entry for assigned subjects and components;
- Class Teacher coordination without editing another Teacher's work;
- consent-aware activities, observations, and milestones;
- assignment-scoped notices and acknowledgement tracking;
- assignment-scoped class reports;
- Library borrower and reading-list workflows;
- Learning when enabled and assignment-scoped;
- personal attendance, leave, payslips, contracts, documents, profile, preferences, and security;
- explicitly delegated timetable, examination, moderation, notice, delivery, or Library responsibilities.

---

## 2. Primary security invariant

> No active assignment means no teaching data access.

Every Teacher operation must be authorized by the applicable combination of:

1. tenant;
2. active user and active Staff identity;
3. academic year;
4. active assignment or delegation;
5. effective dates;
6. class and section;
7. subject;
8. assessment component;
9. capability;
10. workflow state;
11. record ownership;
12. module entitlement;
13. protected-file relation;
14. current authorization during offline replay.

The browser must not fetch school-wide data and filter it into a Teacher view.

---

## 3. Teacher variants

### Base Teacher

Receives account, schedule, relevant notices and notifications, and employee self-service. Teaching records require an active assignment.

### Class Teacher

Receives homeroom coordination for one assigned class-section:

- full assigned homeroom roster;
- homeroom attendance;
- class-level attendance follow-up;
- cross-subject completion and readiness;
- class tasks;
- Class Teacher remarks;
- homeroom activities and notices;
- approved guardian communication context.

Cross-subject records owned by other Teachers remain read-only.

### Subject Teacher

Receives operational authority for exact class-section-subject combinations:

- subject roster;
- subject homework;
- marks and CAS for assigned components;
- subject performance;
- subject activities and notices;
- permitted period attendance.

### Temporary or substitute Teacher

Receives only the explicitly delegated scope and capabilities during the effective period.

### Coordinator Teacher

Keeps the Teacher shell while receiving explicitly delegated workspaces such as timetable administration, substitution management, exam setup, activity moderation, notice operations, or the Library desk.

---

## 4. Current audit result

SchoolOS already has a strong Teacher authorization foundation:

- canonical `TeacherScopeService`;
- exact assignment and delegation evaluation;
- ownership and lifecycle checks;
- generic fail-closed denial;
- Teacher-specific persona resolution;
- permission-derived delegated capabilities;
- direct-route redirection before child rendering;
- Teacher-aware module-tab filtering;
- a Teacher Today composition;
- separate Subject Students and Homeroom projections;
- a Teacher-specific borrower Library workspace;
- Teacher-aware notice audiences.

The primary remaining defects are:

1. The base Teacher role still contains broad permissions that the canonical Teacher specification says should not be granted by default.
2. Separate `teacher` and `subject_teacher` system presets conflict with the assignment-first product model and have already drifted.
3. The default Attendance page is still an administrator-shaped, school-wide operations composition.
4. Some Attendance administrator routes and actions are not fully isolated for ordinary Teachers.
5. Teacher pages advertise restricted academic actions, including a Today marks link to exam administration and an unconditional Retest action.
6. There is no dedicated Teacher student-detail workspace.
7. The navigation does not directly expose My Homeroom, My Subjects, Class Reports, and frequent employee self-service tasks.
8. Homework date filtering may truncate results because the browser fetches a maximum of 100 records and filters locally.
9. There is no purpose-limited assignment-scoped Class Reports workspace.
10. Library borrower features are incomplete.
11. Assignment expiry and delegation expiry need an explicit web cache, draft, file, and open-page revocation contract.
12. Browser coverage does not yet provide a complete Class Teacher, Subject Teacher, delegated Teacher, and no-assignment Teacher matrix.

---

## 5. Target Teacher navigation

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
  Library                     [when enabled]
  Learning                    [when enabled]

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

The ordinary Teacher sidebar must not contain Admissions, school-wide Students, Fees, Accounting, HR administration, payroll runs, Transport management, Canteen management, school settings, generic school reports, or Platform.

---

## 6. Module access summary

| Module | Teacher target |
|---|---|
| M0 Platform Core | Personal account and security only; no school or Platform administration |
| M1 Students | Assigned-student projection; Homeroom and Subject contexts remain distinct |
| M2 Attendance | Assignment-scoped read/write, own correction requests, assigned reports |
| M3 Fees | Hidden |
| M4 Academics | Assignment- and component-scoped marks, CAS, corrections, performance, and readiness |
| M5 Activities | Assigned classes plus ownership; moderation only by delegation |
| M6 Homework | Assigned-subject homework and Class Teacher class tasks |
| M6 Timetable | Own schedule; administration only by delegation |
| M7 HR & Payroll | Employee self-service only |
| M8 Library | Borrower, catalogue, reservations, renewals, reading lists, resource requests |
| M9 Transport | Contextual assigned-student safety alerts only |
| M10 Canteen | Contextual approved allergy/service alerts only |
| M11 Accounting | Hidden |
| M12 Notifications | Own inbox and owned communication status; diagnostics by delegation only |
| M13 Learning | Enabled and assignment-scoped; own content and assigned progress |
| M14 AI | Deferred |
| M15 Notices | Read plus assignment-scoped drafting; publish/approve/delivery by delegation |

---

## 7. Page catalogue

The governing design specifies 60 Teacher web surfaces.

### Today and schedule

1. Today.
2. My Schedule.

### Teaching context

3. My Homeroom.
4. My Subjects.
5. My Students.
6. Teacher Student Detail.

### Attendance

7. My Attendance Overview.
8. Mark Homeroom Attendance.
9. Mark Period Attendance.
10. Attendance History.
11. Monthly Register.
12. My Attendance Corrections.
13. New Attendance Correction.
14. Assigned Attendance Reports.

### Homework

15. Homework Overview.
16. Create/Edit Homework.
17. Homework Detail.
18. Submission Review.
19. Homework Templates.
20. Homework Completion.

### Assessments and marks

21. My Assessments & Marks.
22. Assessment Detail.
23. Marks Entry Grid.
24. CAS Workspace.
25. Marks Submission Status.
26. Marks Correction Request.
27. Subject Performance.
28. Homeroom Academic Readiness.

### Activities and observations

29. Activities.
30. Create/Edit Activity.
31. Activity Detail.
32. Activity Gallery.
33. Observations & Milestones.

### Communication

34. Notices.
35. Notice Composer.
36. Notice Detail.
37. Notifications.

### Class reports

38. Class Reports Hub.
39. Attendance Report.
40. Homework Completion Report.
41. Subject Performance Report.
42. Marks Completion / Homeroom Readiness Report.
43. Follow-up and Intervention Report.

### Resources

44. Teacher Library.
45. Reading Lists.
46. Learning Overview.
47. Learning Activity Editor.
48. Learning Session and Attempts.

### Employee self-service

49. My Workspace Overview.
50. My Staff Attendance.
51. Leave.
52. Payslips.
53. Contracts & Documents.
54. Profile, Preferences, and Security.

### Delegated coordination

55. Coordination Overview.
56. Timetable Coordination.
57. Substitution Coordination.
58. Exam Coordination.
59. Activity Moderation.
60. Teacher-Librarian Desk.

Detailed page requirements are in [`TEACHER_WEB_DESIGN.md`](./TEACHER_WEB_DESIGN.md), with low-fidelity structures in [`TEACHER_WEB_WIREFRAMES.md`](./TEACHER_WEB_WIREFRAMES.md).

---

## 8. Required page anatomy

Every Teacher teaching page must display:

1. page title and current school date;
2. exact assignment context;
3. assignment type or delegation;
4. workflow state;
5. ownership/read-only state;
6. one clear primary action;
7. generated-at or autosave evidence;
8. loading, empty, partial, stale, offline, and assignment-ended states.

Example context rail:

```text
Academic year 2083 / Grade 6 B / Mathematics / Subject Teacher / Theory
```

Example ownership labels:

```text
Created by you
View only — submitted by Rina Sharma
Acting as Class Teacher
Temporary delegation until 25 Shrawan
```

---

## 9. Attendance implementation gate

The Teacher design is not implemented while `/dashboard/attendance` mounts the school-wide administrator composition.

The Teacher Attendance landing must query only:

- exact assigned attendance contexts;
- the Teacher's own submitted sessions;
- the Teacher's offline drafts;
- the Teacher's correction requests;
- Class Teacher follow-up data for the assigned homeroom.

Ordinary Teachers must not mount or advertise:

- school-wide attendance analytics;
- global conflicts;
- anomalies;
- lock override;
- school correction approval;
- bulk register administration;
- attendance policy settings.

---

## 10. Role and permission implementation gate

The target requires one canonical base Teacher role.

```text
Base Teacher permissions
= self-service capabilities
+ purpose-limited assignment-scoped capabilities
```

Review and remove or replace broad default grants including:

- `roles:read`;
- `staff:read`;
- `settings:read`;
- `reports:read`;
- `hr:staff:read`;
- `learning:delete`;
- removed `messaging:read`.

Legacy `subject_teacher` identities should migrate to the base Teacher role plus active Subject Teacher assignments.

---

## 11. Assignment revocation gate

When an assignment or delegation ends, SchoolOS must immediately:

- deny subsequent reads and writes;
- remove assignment-derived navigation and selector options;
- invalidate assignment-scoped query caches;
- make an open editor read-only;
- stop offline replay;
- reauthorize protected files;
- remove sensitive data from search and deep links;
- show a useful assignment-ended state;
- preserve audit evidence.

A Teacher must not need to log out for revocation to take effect.

---

## 12. Testing gate

Production readiness requires dedicated browser fixtures for:

- Class Teacher;
- Subject Teacher;
- delegated Teacher coordinator;
- active Teacher with no assignments.

The E2E matrix must prove:

- correct Teacher shell and navigation;
- assignment-derived lists and filters;
- permitted attendance, homework, marks, activities, notices, and self-service actions;
- Class Teacher cross-subject read-only behavior;
- Subject Teacher subject/component isolation;
- direct-route denial for Admissions, Fees, Accounting, HR administration, school settings, generic reports, and Platform;
- assignment expiry and delegation expiry;
- protected-file denial after scope removal;
- offline replay reauthorization.

---

## 13. Documentation package

| Document | Purpose |
|---|---|
| [`TEACHER_PERSONA_AUDIT.md`](./TEACHER_PERSONA_AUDIT.md) | Repository-grounded current-state audit and prioritized findings. |
| [`TEACHER_FEATURE_MATRIX.md`](./TEACHER_FEATURE_MATRIX.md) | Current-versus-target feature, module, and route matrix. |
| [`TEACHER_WEB_DESIGN.md`](./TEACHER_WEB_DESIGN.md) | Detailed design specification for 60 Teacher page-level surfaces. |
| [`TEACHER_WEB_WIREFRAMES.md`](./TEACHER_WEB_WIREFRAMES.md) | Desktop, narrow, state, grid, review, and delegation wireframes. |
| [`TEACHER_WEB_IMPLEMENTATION_SPEC.md`](./TEACHER_WEB_IMPLEMENTATION_SPEC.md) | Permission, API, route, component, offline, security, test, and delivery requirements. |

---

## 14. Governing design rule

```text
The Teacher teaches, records, reviews, coordinates, communicates, and follows up
inside active assignments.

The Teacher does not become a school administrator because a shared module also
contains school-wide controls.
```
