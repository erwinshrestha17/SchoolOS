# SchoolOS Teacher Web Implementation Specification

**Purpose:** Convert the Teacher audit and design into bounded implementation work  
**Applies to:** Core permissions, API, web routes, components, protected files, offline replay, browser tests, and rollout  
**Date:** 2026-08-02

---

## 1. Implementation objective

Deliver a complete Teacher web persona that is:

- assignment-scoped;
- ownership-aware;
- workflow-aware;
- delegation-aware;
- fail-closed;
- entitlement-aware;
- safe under assignment expiry;
- visually coherent across modules;
- separate from Admin, Principal, HR, Accountant, Librarian, Transport, Canteen, and Platform workspaces.

The implementation must preserve the existing strong `TeacherScopeService` and extend it rather than creating parallel authorization logic.

---

## 2. Non-negotiable authorization model

```text
Effective Teacher authority
= base Teacher self-service permissions
+ active TeacherAssignment capabilities
+ active TeacherDelegation capabilities
+ module entitlement
+ workflow state
+ record ownership
```

Every operation must remain tenant-scoped.

### 2.1 One base Teacher role

Target canonical role:

```text
teacher
```

The following are assignment types, not standalone broad system roles:

- CLASS_TEACHER;
- SUBJECT_TEACHER;
- ASSISTANT_TEACHER;
- SUBSTITUTE_TEACHER;
- EXAM_INVIGILATOR;
- COORDINATOR.

### 2.2 Legacy `subject_teacher` migration

1. Find active users with `subject_teacher`.
2. Add or confirm `teacher`.
3. Verify active subject assignments exist.
4. Remove `subject_teacher` after migration evidence.
5. Preserve audit of role transition.
6. Add a compatibility period only if required; do not maintain two long-term drifting presets.

### 2.3 Base Teacher permission allowlist

The base role should contain only purpose-limited keys.

Recommended families:

```text
account:self:read
account:self:update
security:self:manage
notifications:self:read
notifications:self:preferences
school:public:read

teacher_assignments:self:read
timetable:self:read
timetable:assigned:read
students:assigned:read

attendance:assigned:read
attendance:assigned:mark
attendance:own_correction_request

homework:assigned:read
homework:assigned:create
homework:own:update
homework:assigned:review
homework:assigned:notify

academics:assigned:read
marks:assigned:read
marks:assigned:enter
marks:own:submit
marks:own:correction_request
cas:assigned:enter
results:assigned:read
homeroom:readiness:read
homeroom:remarks:manage

activity:assigned:read
activity:own:create
activity:own:update
activity:observation:create
activity:milestone:create

notices:self:read
notices:assigned:draft
notices:owned:read_status

staff:self:read
staff_attendance:self:read
staff_attendance:self:correction_request
leave:self:read
leave:self:request
payslip:self:read
contract:self:read

library:catalogue:read
library:self:issues
library:self:reservation_request
library:self:renewal_request
library:assigned:reading_list

reports:assigned:read
```

Existing permission names may be retained initially if every endpoint is purpose-limited, but the target semantic contract must be documented and tested.

### 2.4 Remove or replace broad base grants

Review and remove from ordinary Teacher:

- `roles:read`;
- `staff:read`;
- `settings:read`;
- `reports:read`;
- `hr:staff:read`;
- `learning:delete`;
- `messaging:read`.

If a current Teacher feature depends on one of these, create a purpose-limited endpoint and permission before removal.

---

## 3. Teacher scope requirements

### 3.1 Required evaluation dimensions

Every Teacher read/write must evaluate as applicable:

1. tenant;
2. active user;
3. active Staff row;
4. current or requested academic year;
5. active assignment/delegation;
6. effective dates;
7. class;
8. section;
9. subject;
10. assessment component;
11. capability;
12. record lifecycle;
13. record owner;
14. module entitlement;
15. branch, when branch support is enabled;
16. protected-file relation;
17. offline operation replay validity.

### 3.2 Assignment expiry

When an assignment or delegation expires:

- new API calls return generic scope denial;
- open page queries invalidate;
- mutation controls disappear;
- active editors become read-only;
- offline replay rechecks scope and fails safely;
- assignment-derived query caches are removed;
- protected file access is reauthorized;
- push/deep-link payloads do not reveal the record;
- server audit records denied replay where appropriate.

### 3.3 Cache key standard

Every assignment-scoped query key should include:

```text
tenantId
academicYearId
assignmentScopeVersion or assignment IDs
purpose
filters
```

Do not key only by generic module name when a user can switch assignments.

---

## 4. Persona and route authority

### 4.1 Teacher persona resolution

Keep the existing rule:

- teaching role present;
- no administrative persona role;
- delegated capability does not change the Teacher shell.

### 4.2 Restricted-route expansion

Add explicit ordinary-Teacher restrictions for administrator-shaped Attendance routes, including:

```text
/dashboard/attendance/anomalies
/dashboard/attendance/follow-ups          [unless homeroom projection route]
/dashboard/attendance/conflicts
/dashboard/attendance/register            [global/bulk form]
/dashboard/attendance/corrections/*        [approval/review variants]
/dashboard/settings/policies/attendance
```

Split route ownership where one current path mixes Teacher request status and Admin approval.

### 4.3 Fix misleading links

- Today marks deadline must link to `/dashboard/academics/marks` or the new assessment detail.
- Marks Entry `Retest queue` action renders only when `ACADEMIC_STRUCTURE_ADMIN` is present.
- Attendance header actions must be capability/persona aware.
- Notice navigation label becomes `Notices`.
- Generic school Reports is not advertised to ordinary Teachers.

### 4.4 Direct-route behavior

A forbidden Teacher route must:

1. avoid rendering child content;
2. avoid firing child queries;
3. redirect to nearest valid Teacher page;
4. display a brief role-appropriate transition state;
5. rely on backend denial as final authority.

---

## 5. Target route migration

## 5.1 Today and schedule

| Current | Target | Action |
|---|---|---|
| `/dashboard` | same | Expand Teacher priority composition |
| `/dashboard/timetable` | `/dashboard/my-schedule` canonical, legacy redirect optional | Preserve Teacher schedule projection |
| substitution data inside Today | `/dashboard/my-schedule/substitutions` | Add Teacher-owned status route |
| exam duty absent/fragmented | `/dashboard/my-schedule/exam-duty` | Add |

## 5.2 Teaching context

| Current | Target | Action |
|---|---|---|
| `/dashboard/my-students` tabs | keep + add direct `/dashboard/my-homeroom` and `/dashboard/my-subjects` | Improve IA |
| no Teacher student detail | `/dashboard/my-students/[studentId]` | Add purpose-limited projection |

## 5.3 Attendance

| Current | Target | Action |
|---|---|---|
| shared `/dashboard/attendance` | Teacher composition at same route | Persona route composition |
| `/dashboard/attendance/mark` | same | Keep assignment-scoped form |
| shared corrections | Teacher request/status at `/dashboard/attendance/corrections` | Split from Admin approval |
| no explicit history | `/dashboard/attendance/history` | Add |
| shared reports | Teacher assigned reports at same route | Purpose-limited API |

## 5.4 Academics

| Current | Target | Action |
|---|---|---|
| `/dashboard/academics/marks` | Teacher My Assessments & Marks composition | Refactor header/actions |
| CAS route | keep | Teacher scope-specific composition |
| no submission status | `/dashboard/academics/submissions` | Add |
| no correction hub | `/dashboard/academics/corrections` | Add |
| no subject performance hub | `/dashboard/academics/subject-performance` | Add |
| homeroom summary embedded | `/dashboard/academics/homeroom-readiness` | Add direct page |

## 5.5 Reports

Create `/dashboard/class-reports/*` and keep generic `/dashboard/reports` restricted to administrative/delegated personas.

## 5.6 Self-service

Create direct child routes under `/dashboard/my-workspace/*`. Existing tab state may redirect or compose these routes during migration.

---

## 6. Purpose-limited API contracts

The browser must not fetch a school-wide payload and project it locally.

## 6.1 Today

```http
GET /teacher-workspace/today
```

Extend response with:

```ts
type TeacherTodaySummary = {
  generatedAt: string;
  assignmentScopeVersion: string;
  currentPeriod: TeacherPeriod | null;
  nextPeriod: TeacherPeriod | null;
  assignedClasses: AssignedClassSummary[];
  priorityItems: TeacherPriorityItem[];
  attendance: {
    pendingCount: number;
    submittedCount: number;
    offlineDraftCount?: number;
  } | null;
  homework: {
    dueToday: number;
    awaitingReview: number;
    overdueReview: number;
    returnedCount: number;
  } | null;
  marks: {
    dueSoon: number;
    returnedCount: number;
    missingCount: number;
  } | null;
  notices: {
    urgentUnread: number;
    acknowledgementRequired: number;
  } | null;
  studentFollowUps: TeacherStudentFollowUp[] | null;
  substitutions: TeacherSubstitution[] | null;
  assignmentNotices: AssignmentLifecycleNotice[];
};
```

## 6.2 Teaching contexts

```http
GET /teacher-workspace/assignments
GET /teacher-workspace/homerooms
GET /teacher-workspace/subject-groups
GET /teacher-workspace/students
GET /teacher-workspace/students/:studentId
```

Student detail must return a purpose-limited projection, never the Admin Student DTO.

## 6.3 Teacher attendance summary

```http
GET /teacher-workspace/attendance/summary
GET /teacher-workspace/attendance/sessions
GET /teacher-workspace/attendance/register
GET /teacher-workspace/attendance/corrections
POST /teacher-workspace/attendance/corrections
GET /teacher-workspace/attendance/reports/:reportKey
```

`summary` should contain only contexts the caller may read or mark.

## 6.4 Homework

Add backend date filtering and server pagination:

```http
GET /homework?assignedDate=YYYY-MM-DD&page=&limit=
```

Do not retrieve 100 records and paginate locally.

## 6.5 Assessment work

```http
GET /teacher-workspace/assessments
GET /teacher-workspace/assessments/:id
GET /teacher-workspace/marks/submissions
GET /teacher-workspace/marks/corrections
GET /teacher-workspace/subject-performance
GET /teacher-workspace/homeroom-readiness
```

Marks mutations continue using the canonical marks service and TeacherScopeService.

## 6.6 Class reports

```http
GET /teacher-workspace/reports/catalog
POST /teacher-workspace/reports/:key/run
POST /teacher-workspace/reports/:key/export
```

The report catalogue itself is assignment and capability aware.

## 6.7 Library

```http
GET /library/my/issues
GET /library/my/reservations
POST /library/my/reservations
POST /library/my/renewal-requests
GET /library/my/reading-lists
POST /library/my/reading-lists
POST /library/my/resource-requests
```

## 6.8 Coordination

```http
GET /teacher-workspace/delegations
```

Return only active and recently expired grants for the signed-in Teacher, including:

- capability;
- scope;
- grantor display name;
- effective dates;
- reason;
- audit reference;
- destination route.

---

## 7. Frontend component architecture

## 7.1 Shell and context

Create or standardize:

- `TeacherPageShell`;
- `TeacherContextRail`;
- `TeacherAssignmentBadge`;
- `TeacherOwnershipLabel`;
- `TeacherDelegationBanner`;
- `TeacherModuleUnavailableState`;
- `TeacherAssignmentEndedState`;
- `TeacherScopeChangedBoundary`.

## 7.2 Today

- `TeacherPriorityQueue`;
- `TeacherCurrentPeriodPanel`;
- `TeacherClassAgenda`;
- `TeacherStudentFollowUpPanel`;
- `TeacherNoticePanel`;
- `TeacherAssignmentLifecyclePanel`.

## 7.3 Students

- `TeacherStudentDirectory`;
- `TeacherStudentRow`;
- `TeacherStudentDetailHeader`;
- `TeacherStudentAttendancePanel`;
- `TeacherStudentSubjectPanel`;
- `TeacherStudentObservationTimeline`;
- `ApprovedGuardianContactAction`.

## 7.4 Attendance

- `TeacherAttendanceOverview`;
- `TeacherAttendanceContextList`;
- existing assignment-scoped `AttendanceForm`;
- `TeacherAttendanceHistoryTable`;
- `TeacherCorrectionRequestList`;
- `TeacherCorrectionRequestForm`;
- `TeacherAttendanceReportWorkspace`.

Do not reuse the Admin `AttendanceOverviewWorkspace` as the Teacher landing page.

## 7.5 Assessments

- `TeacherAssessmentQueue`;
- `TeacherAssessmentDetail`;
- existing marks grid with assignment header;
- `TeacherSubmissionStatusTable`;
- `TeacherMarksCorrectionList`;
- `TeacherSubjectPerformanceWorkspace`;
- `HomeroomReadinessWorkspace`.

## 7.6 Self-service

Refactor `StaffDashboard` into route-level components while retaining shared data primitives:

- `MyEmploymentOverview`;
- `MyStaffAttendanceWorkspace`;
- `MyLeaveWorkspace`;
- `MyPayslipsWorkspace`;
- `MyContractsDocumentsWorkspace`.

## 7.7 Reports

- `TeacherReportCatalog`;
- `TeacherReportFilters`;
- `TeacherReportEvidenceHeader`;
- `TeacherReportTable`;
- `TeacherProtectedExportAction`.

---

## 8. Data and state requirements

### 8.1 No false zero

Unavailable data renders `Unavailable` or an explicit module-unavailable state, never zero.

### 8.2 Generated-at evidence

Every summary/report shows:

- generated at;
- academic year;
- assignment context;
- filters;
- partial/stale state.

### 8.3 Draft preservation

Forms preserve valid local input when:

- a query retries;
- recipient preview fails;
- upload processing fails;
- network drops;
- server returns a workflow conflict.

If scope expires, the draft becomes read-only and must not replay automatically.

### 8.4 URL-backed filters

Use URL filters for shareable Teacher pages only when the URL cannot broaden authorization. Server still validates every ID.

---

## 9. Protected files

Every Teacher protected file access must reauthorize:

- active session;
- tenant;
- active assignment/self relation;
- record relation;
- workflow visibility;
- file purpose;
- module entitlement.

Applies to:

- homework attachments and submissions;
- activity media;
- notice attachments;
- report exports;
- own payslips;
- own contracts/documents;
- Learning resources;
- Library exports/reading lists.

Signed URLs must be short-lived and must not be cached across assignment changes.

---

## 10. Offline and sync

### 10.1 Supported web offline drafts

- attendance;
- homework;
- activity/observation;
- correction request draft where safe.

### 10.2 Replay envelope

Every replay includes:

- operation ID;
- tenant ID derived from session, never trusted from client;
- actor/user ID from session;
- original assignment ID/context;
- client timestamp;
- current server authorization recheck;
- idempotency handling;
- conflict result.

### 10.3 Assignment removal

A pending draft whose assignment ended must receive a stable non-retryable result such as:

```text
TEACHER_SCOPE_ENDED
```

The UI should preserve the local draft as exportable/read-only text where policy permits, but must not submit it under another assignment.

---

## 11. Design-system requirements

Use existing SchoolOS primitives:

- `ModuleHeader`;
- `DashboardPageShell` or new Teacher wrapper;
- `WorkspaceTabs`;
- `WorkSurface`;
- `SummaryGrid` with restrained KPI count;
- semantic `DataTable`/`PaginatedDataTable`;
- `LoadingState`, `ErrorState`, `EmptyState`, `PermissionDenied`;
- protected file controls;
- reason and confirmation dialogs.

### Teacher-specific visual rules

- no more than four summary cards above the first work surface;
- every page shows assignment context;
- ownership/delegation labels use text plus icon, not color alone;
- class and subject filters never show school-wide values;
- Teacher pages use action-oriented copy, not executive or operations language;
- tables remain tables on desktop;
- no generic bento dashboard.

---

## 12. Test strategy

## 12.1 Core role contract tests

Data-driven tests must assert:

- `teacher` contains only approved base permissions;
- legacy `subject_teacher` does not drift during migration;
- ordinary Teacher lacks finance, admissions, Platform, school settings, HR admin, and school report permissions;
- delegated permission grants resolve the correct TeacherCapability;
- delegation does not change the shell to Admin.

## 12.2 TeacherScopeService tests

Cover:

- active/inactive staff;
- exact class/section;
- wrong subject;
- component scope;
- Class Teacher versus Subject Teacher rules;
- ownership mismatch;
- draft/submitted/locked lifecycle;
- effective dates;
- delegation capability list;
- delegation expiry;
- generic denial envelope;
- audit record;
- assignment removed during replay.

## 12.3 API authorization matrix

Test both Class Teacher and Subject Teacher fixtures against:

- assigned records — allowed;
- same class wrong subject — denied where subject exactness is required;
- same class wrong section — denied;
- unassigned class — denied;
- other Teacher’s draft — denied;
- homeroom submitted cross-subject record — read-only allowed where specified;
- finance — denied;
- admissions — denied;
- staff admin — denied;
- Platform — denied;
- protected file from unassigned record — denied.

## 12.4 Web route tests

Assert ordinary Teacher:

- receives Teacher nav;
- sees Today;
- sees only assignment-derived filters;
- does not see restricted tabs;
- does not see Retest action;
- does not see attendance anomaly/settings actions;
- is redirected before restricted child render;
- sees direct self-service routes;
- sees Coordination only with delegation.

## 12.5 Browser E2E fixtures

Create dedicated fixtures:

### Class Teacher fixture

- one homeroom;
- one subject in same homeroom;
- attendance write capability;
- homework and marks work;
- no admin delegation.

### Subject Teacher fixture

- two subject groups;
- no homeroom;
- period attendance enabled for one group and disabled for another;
- no school-wide access.

### Delegated coordinator fixture

- Teacher plus one time-bounded capability;
- verify conditional nav, scope banner, expiry behavior.

### No-assignment Teacher fixture

- active user/staff;
- no current TeacherAssignment;
- self-service only;
- no teaching data.

## 12.6 Core E2E flows

1. Login and Teacher shell.
2. Today priority queue.
3. My Students contains only assigned groups.
4. Student detail denies unassigned ID.
5. Homeroom attendance draft/submit.
6. Period attendance exact assignment.
7. Offline attendance replay.
8. Homework create/review in assigned subject.
9. Marks entry/submit for assigned component.
10. Cannot edit another Teacher’s subject.
11. Class Teacher sees cross-subject readiness read-only.
12. Activity create with consent evidence.
13. Notice audience derived from assignment.
14. Own leave and payslip.
15. Library borrower workspace.
16. Direct URL denial for fees/accounting/admissions/HR admin/Platform.
17. Assignment expiry revokes open page and pending draft.
18. Delegated coordinator sees only granted coordination route.

## 12.7 Accessibility tests

- marks-grid keyboard navigation;
- attendance status controls and labels;
- tab semantics;
- focus restoration;
- screen-reader table headers;
- error announcements;
- confirmation impact text;
- reduced motion;
- horizontal grid usability at 200% zoom.

---

## 13. Delivery slices

## TCH-P0-01 — Canonical Teacher role cleanup

### Scope

- define explicit base Teacher allowlist;
- remove broad permissions;
- document purpose-limited replacements;
- plan `subject_teacher` migration.

### Acceptance

- contract tests fail if a new broad permission silently enters Teacher;
- ordinary Teacher still completes current core workflows.

## TCH-P0-02 — Teacher Attendance composition

### Scope

- new Teacher attendance summary endpoint;
- Teacher landing page;
- capability-filtered actions;
- separate own correction requests from approval queue;
- restricted-route expansion.

### Acceptance

- no admin attendance query mounts for ordinary Teacher;
- only assigned contexts are visible;
- no anomalies/settings/conflict review without delegation.

## TCH-P0-03 — Academic action and deep-link correction

### Scope

- fix Today marks link;
- hide Retest primary action;
- verify all Teacher links against route restrictions;
- add automated link contract test.

### Acceptance

- no ordinary Teacher CTA points to a route that immediately redirects.

## TCH-P0-04 — Assignment revocation and cache invalidation

### Scope

- assignment scope version;
- query-cache invalidation;
- open editor lock;
- offline replay recheck;
- protected file reauthorization.

### Acceptance

- ended assignment loses data and write access without logout.

## TCH-P1-01 — Teacher navigation and context pages

### Scope

- My Homeroom;
- My Subjects;
- Student detail;
- direct self-service entries;
- Class Reports;
- Notices label correction.

## TCH-P1-02 — Teacher Assessments & Marks IA

### Scope

- assessment queue;
- submission status;
- corrections;
- subject performance;
- homeroom readiness.

## TCH-P1-03 — Class Reports

### Scope

- purpose-limited report catalogue and APIs;
- protected exports;
- no generic school report engine.

## TCH-P1-04 — Homework server filtering

### Scope

- assigned-date query;
- server pagination;
- remove 100-record client cap.

## TCH-P1-05 — Self-service route refactor

### Scope

- direct My Attendance, Leave, Payslips, Contracts/Documents routes;
- keep overview composition.

## TCH-P1-06 — Library completion

### Scope

- reservations;
- renewals;
- own fines;
- resource requests;
- reading lists.

## TCH-P1-07 — Dedicated Teacher browser matrix

### Scope

- four fixtures;
- permitted/forbidden flows;
- responsive and accessibility checks.

## TCH-P2-01 — Coordination Overview

### Scope

- active delegation API;
- capability cards;
- scope/expiry banner;
- audit reference.

## TCH-P2-02 — Cross-device continuation

### Scope

- consistent operation IDs;
- sync metadata;
- mobile-to-web draft state;
- conflict UI.

---

## 14. Implementation acceptance criteria

The design is implemented only when:

- [ ] one canonical Teacher role exists;
- [ ] broad base grants are removed or replaced;
- [ ] Class/Subject authority comes from assignments;
- [ ] Today is assignment-scoped and actionable;
- [ ] Teacher Attendance does not mount Admin operations;
- [ ] every Teacher CTA opens an authorized destination;
- [ ] My Students has a purpose-limited detail page;
- [ ] marks, CAS, homework, and activities preserve ownership rules;
- [ ] Class Teacher cross-subject access remains read-only;
- [ ] Class Reports are assignment-scoped;
- [ ] self-service has direct routes;
- [ ] Library borrower features are complete;
- [ ] Learning delete is ownership/lifecycle controlled;
- [ ] assignment expiry revokes caches, drafts, files, and pages;
- [ ] ordinary Teachers cannot access fees, accounting, admissions, HR admin, school settings, generic reports, or Platform;
- [ ] delegated Teacher capabilities are explicit and time/scope visible;
- [ ] Class Teacher, Subject Teacher, delegated Teacher, and no-assignment Teacher E2E suites pass.

---

## 15. Final engineering rule

```text
Do not solve Teacher authorization by rendering the full school workspace and
hiding buttons.

Query, compose, navigate, cache, export, and download only the Teacher-scoped
projection the authenticated assignment actually permits.
```
