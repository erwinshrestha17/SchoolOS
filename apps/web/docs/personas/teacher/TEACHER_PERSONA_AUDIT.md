# SchoolOS Teacher Web Persona Audit

**Persona:** Teacher / Class Teacher / Subject Teacher / delegated teacher coordinator  
**Surface:** SchoolOS Web  
**Audit type:** Repository-grounded product, authorization, information architecture, UX, route, and workflow audit  
**Status:** Governing design input — not runtime implementation evidence  
**Date:** 2026-08-02

---

## 1. Executive conclusion

SchoolOS already contains a serious Teacher authorization foundation:

- a canonical assignment-scoped `TeacherScopeService`;
- active staff resolution;
- exact tenant, academic-year, class, section, subject, component, capability, ownership, and lifecycle evaluation;
- temporary delegation support;
- generic fail-closed `403` responses;
- teacher-specific persona resolution;
- a permission-derived delegated capability matrix;
- restricted-route redirection;
- teacher-aware navigation;
- a Teacher Today workspace;
- separate Subject Students and Homeroom views;
- a borrower-only Teacher Library workspace;
- teacher-aware notice audience restrictions;
- backend-owned assignment projections.

This is materially stronger than a role-only Teacher implementation.

However, the Teacher web experience is not yet a complete, coherent Teacher product. Several pages still reuse school-administrator workspaces, and the canonical Teacher role preset contains permissions that the canonical Teacher persona specification says should not be granted by default.

The largest gap is **Attendance**. The route is available to Teachers, but the default page is still described and structured as a school-wide operations console. It loads analytics, pending corrections, conflicts, follow-ups, bulk actions, anomalies, exports, and policy settings without first rendering a Teacher-specific assigned-scope composition.

The target product should be:

```text
Teacher authority
= base teacher self-service
+ active class/subject assignments
+ approved temporary delegations
+ workflow state
+ record ownership
```

It must never become:

```text
Teacher authority
= broad school read permission
+ frontend filtering
```

---

## 2. Repository evidence inspected

### Canonical product and access specifications

- `docs/Persona/SchoolOS_Teacher_Persona_Access_Spec.md`
- `docs/Persona/SchoolOS_Module_Features_and_Persona_Platform_Mapping.md`
- `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
- `docs/SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md`
- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`

### Role, persona, and capability authority

- `packages/core/src/permissions/roles.ts`
- `packages/core/src/teacher-capabilities.ts`
- `packages/core/src/school-web-persona.ts`
- `apps/web/lib/teacher-access.ts`
- `apps/web/lib/permissions-ui.ts`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/components/layout/sidebar-persona-nav.config.ts`
- `apps/web/components/dashboard/module-tabs.tsx`

### Backend assignment scope

- `apps/api/src/teacher-scope/teacher-scope.service.ts`
- `apps/api/src/teacher-scope/teacher-capability.ts`
- `apps/api/src/teacher-scope/teacher-scope.service.spec.ts`
- `apps/api/test/teacher-scope-authorization.e2e-spec.ts`
- marks, homework, attendance, activity, and teacher-workspace services using the teacher-scope boundary

### Teacher home, roster, and homeroom

- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/dashboard/teacher-today-workspace.tsx`
- `apps/web/app/dashboard/my-students/page.tsx`
- `apps/web/components/students/my-students-tabs.tsx`
- `apps/web/components/students/my-students-workspace.tsx`
- `apps/web/components/students/homeroom-academic-summary.tsx`

### Teacher operational workspaces

- Attendance pages and `attendance-m2-workspaces.tsx`
- Homework pages and forms
- Academics, marks, CAS, report-card, result, retest, and lock routes
- Activity feed, composer, gallery, observations, milestones, and moderation routes
- Timetable, schedule, substitutions, and builder routes
- Notices, composer, detail, acknowledgement, delivery, and failure routes
- Notifications inbox and preferences
- Learning activities, sessions, attempts, and progress routes
- Library and `teacher-library-workspace.tsx`
- `my-workspace`, staff self-service, leave, payslips, contracts, and attendance components

### Browser and contract tests

- `apps/web/e2e/README.md`
- `apps/web/e2e/attendance-fees-smoke.spec.ts`
- web authorization and teacher route contract tests
- API teacher-scope and academics hardening E2E tests

---

## 3. Intended Teacher model

The canonical specification defines one base Teacher identity with operational authority coming from active assignments:

```text
TEACHER
+ CLASS_TEACHER assignment
+ SUBJECT_TEACHER assignment
+ ASSISTANT_TEACHER assignment
+ SUBSTITUTE_TEACHER assignment
+ EXAM_INVIGILATOR assignment
+ approved COORDINATOR delegation
```

A single person may be both:

- Class Teacher for one section;
- Subject Teacher for several class-section-subject combinations;
- temporary substitute for another section;
- delegated exam, timetable, activity, or library coordinator.

The primary invariant is:

> No active assignment means no teaching data access.

The Teacher web design must reflect the difference between:

1. **subject responsibility** — teacher-owned subject work;
2. **homeroom responsibility** — cross-subject coordination without editing other teachers’ work;
3. **self-service** — the Teacher’s own employment and account records;
4. **delegated coordination** — time-bounded or role-granted administrative capabilities.

---

## 4. Current canonical Teacher permissions

The current `teacher` preset includes:

### Teaching and assigned-record permissions

- classes and sections read;
- students read;
- attendance read and mark;
- academics read;
- marks entry and read;
- exam-term and assessment-component read;
- CAS read;
- results read;
- homework create/read/update/review/notify;
- activity feed create/read;
- timetable read;
- notices read;
- events read;
- Learning read/create/update/delete/launch/progress;
- narrow Library catalogue/copy/own issue reads.

### Self-service permissions

- HR staff read;
- leave read/request;
- own payslip read;
- settings public and general read;
- notifications own inbox through other permission grants.

### Broad permissions requiring correction or explicit justification

The canonical Teacher persona specification explicitly identifies several permissions that should not be granted by default, yet the current role includes some of them:

- `roles:read`;
- `staff:read`;
- `settings:read`;
- `reports:read`;
- `hr:staff:read`;
- `learning:delete`;
- stale `messaging:read` while open chat is removed.

These permissions may be harmless on endpoints that independently apply TeacherScopeService or self-scope. They are still a poor canonical role contract because new endpoints can silently inherit them later.

### `teacher` versus `subject_teacher`

The repository retains separate system presets:

- `teacher` includes `attendance:mark`;
- `subject_teacher` does not include `attendance:mark`;
- both otherwise contain very similar broad permission lists.

This conflicts with the canonical product decision that Class Teacher and Subject Teacher are assignment types, not mutually exclusive system identities.

The target should converge to one base `teacher` role. Homeroom, subject, period-attendance, assistant, substitute, and coordinator authority should come from active assignments and explicit capabilities.

---

## 5. Strong implementation already present

### 5.1 Canonical TeacherScopeService

The backend resolver correctly evaluates:

- tenant;
- active linked staff identity;
- academic year;
- effective assignment dates;
- class;
- section;
- subject;
- assessment component;
- capability;
- record owner;
- record status;
- assignment type;
- temporary delegation;
- audit on denial.

It returns the same generic denial envelope for mismatches, avoiding record enumeration.

### 5.2 Permission-derived delegated capabilities

The web does not depend only on role names. It derives capabilities from effective permissions, including:

- timetable administration;
- substitution administration;
- exam-term administration;
- academic structure administration;
- report-card administration;
- activity moderation;
- notice administration;
- delivery operations;
- library administration;
- school settings administration;
- student directory administration;
- staff administration;
- marks entry;
- attendance marking;
- homework authoring;
- activity authoring.

This allows a Teacher to keep the Teacher shell while receiving only the extra coordination routes they legitimately need.

### 5.3 Teacher route isolation

Restricted routes are redirected to the nearest valid Teacher page before their child component renders. This prevents an ordinary Teacher from briefly rendering an administrator workspace and firing unauthorized page queries.

### 5.4 Global workspace-tab filtering

`WorkspaceTabs` filters destinations using the canonical Teacher route restriction resolver. Academics, Library, Notices, Activity, and other shared tab rows therefore remove routes that would redirect an ordinary Teacher.

### 5.5 Teacher Today composition

The current Today page already includes:

- current period;
- next period;
- assigned classes today;
- pending attendance count;
- homework given/due/awaiting review;
- substitution alerts;
- marks deadlines;
- module-unavailable states;
- no-assignment state;
- refresh and generated-at evidence.

The payload is composed from assignment-scoped backend calls rather than a school-wide dashboard.

### 5.6 My Students split by real authorization boundary

The web correctly separates:

- **My Subject Students**;
- **My Homeroom**.

The subject view contains only assignment-resolved groups. The Homeroom tab appears only when a Class Teacher assignment exists.

### 5.7 Homeroom cross-subject read-only design

The Homeroom summary correctly keeps other Subject Teachers’ records read-only and presents coordination evidence instead of edit controls.

### 5.8 Teacher Library projection

Ordinary Teachers receive:

- own current and historical loans;
- due-soon and overdue counts;
- catalogue search.

They do not trigger librarian administration APIs. Teacher-librarians receive the full desk only with `LIBRARY_ADMIN`.

### 5.9 Teacher notice audience model

The notice composer passes `isTeacherPersona` into the capability resolver and limits ordinary Teachers to assignment-compatible audience types rather than whole-school, role-wide, or arbitrary staff targeting.

---

## 6. Current Teacher navigation audit

Current base navigation:

```text
Today
  Home
  My Schedule

Teaching
  My Students
  Attendance
  Homework
  Assessments & Marks
  Activities
  Messages & Announcements
  Notifications

Resources
  Library

My Account
  My Workspace
  Profile
  Preferences
  Security

Coordination                     [conditional]
  Timetable Builder
  Substitutions
  Replacements
  Exam Terms
  Activity Moderation
  Library Desk
```

### What works

- Teacher-only shell;
- no Admissions, Fees, Accounting, HR administration, Transport, Canteen, or Platform navigation;
- conditional coordination links;
- personal settings remain available;
- Library is teacher-specific;
- hidden groups collapse naturally.

### Information architecture gaps

The canonical Teacher specification calls for explicit Teacher mental models:

- My Homeroom;
- My Subjects;
- My Students;
- Class Reports;
- My Attendance;
- Leave;
- Payslips.

The current shell compresses several of these into tabs or a generic `My Workspace`. This is functional but increases navigation cost for frequent work.

`Messages & Announcements` is also misleading because open chat has been removed. The label should be `Notices` or `Class Notices`.

---

## 7. Current page and feature inventory

## 7.1 Today

**Available now**

- current and next period;
- assigned classes;
- pending attendance count;
- homework snapshot;
- substitutions;
- marks deadlines;
- module-disabled states;
- no-assignment state.

**Missing or weak**

- unread urgent notices;
- attendance correction status;
- marks submissions returned for correction;
- overdue homework review queue;
- student follow-up summary;
- assignment-expiry or temporary-delegation notice;
- personal leave/payslip reminders;
- direct “start current class” action;
- one consistent priority queue.

## 7.2 My Students

**Available now**

- Subject Students and Homeroom split;
- assignment-derived groups;
- search by name, roll, ID;
- sort by roll, name, attendance;
- low-attendance and medical-alert flags;
- homeroom academic summary;
- cross-subject homework and reported-marks status.

**Missing or weak**

- no dedicated Teacher student-detail route;
- no explicit approved guardian-contact action in the visible table;
- no student-level attendance history drill-down;
- no Teacher-owned subject-performance drill-down;
- no intervention/observation timeline;
- no printable assigned class directory;
- no contextual actions from a student row.

## 7.3 Attendance

**Available now**

- overview;
- mark attendance;
- monthly register;
- corrections;
- reports;
- offline drafts;
- analytics and latest sessions;
- conflict review components;
- follow-up queues;
- assignment-aware marking form.

**Major mismatch**

The default page is still an Admin-shaped `Smart Attendance` operations console. Its language says “across the school,” and it mounts school-level analytics, pending corrections, conflicts, and follow-ups. It also advertises:

- bulk actions;
- exports;
- anomalies;
- follow-up queue;
- attendance policy settings.

The Teacher page should instead be `My Attendance` and show only:

- exact homeroom or period contexts the Teacher may mark;
- own submitted sessions;
- own drafts;
- assigned-class history;
- correction requests created by the Teacher;
- attendance follow-ups for the Teacher’s homeroom where allowed.

Administrative correction approval, conflict review, anomaly operations, lock override, school-wide follow-up, and policy settings must be delegated or hidden.

## 7.4 Homework

**Available now**

- Today, All, Completion, and Templates views;
- assignment-scoped class/section/subject options;
- teacher filter removed for scoped Teachers;
- create, draft, publish, review, feedback, reminders, templates, and analytics;
- permission-aware authoring and review;
- class and subject context.

**Gap**

When a date filter is active, the web fetches up to 100 records and filters/paginates client-side because the backend does not support the required date query. A high-volume Teacher could receive an incomplete day view. This should be fixed with server-side date filtering and pagination.

## 7.5 Assessments, marks, CAS, and homeroom readiness

**Available now**

- marks entry route;
- assignment-scoped marks service;
- CAS;
- component-level capability model;
- drafts, submission, corrections, and workflow state;
- Homeroom cross-subject readiness evidence;
- delegated exam, academic structure, report-card, retest, and lock routes.

**Gaps**

- the Marks page always shows a `Retest queue` primary action, even for an ordinary Teacher whose route guard will redirect it;
- Today’s “Go to Assessments & Marks” link points to `/dashboard/academics/exams`, an exam-administration route restricted to `EXAM_TERM_ADMIN`, instead of the Teacher marks workspace;
- Teacher needs a clearer separation between My Assessments, Marks Grid, CAS, Submission Status, Corrections, Subject Performance, and Homeroom Readiness;
- report-card and result pages remain shared structures rather than an intentionally limited Teacher projection.

## 7.6 Activities, observations, and milestones

**Available now**

- assignment-scoped feed;
- own drafts and published-post metrics;
- media processing state;
- assigned class and section filters;
- create activity;
- gallery;
- milestones;
- moderation only with delegated capability;
- school-wide moderation metrics hidden from ordinary Teachers.

**Gaps**

- Teacher needs a stronger distinction between own posts, class feed, observations, milestones, and media processing;
- activity detail should clearly show edit ownership, consent evidence, audience, moderation state, and publication history;
- class-teacher observation and subject-teacher activity contexts should be visually differentiated.

## 7.7 Timetable and substitutions

**Available now**

- ordinary Teacher receives My Schedule;
- delegated coordinator receives builder, versions, requirements, conflicts, substitutions, and replacements;
- route restriction prevents ordinary Teachers from opening administration pages.

**Gaps**

- Today and My Schedule should behave as one connected workflow;
- current-period actions should deep-link to attendance, homework, or class roster;
- exam duty and temporary room change need stronger visibility;
- substitution acknowledgement and conflict state need explicit Teacher states.

## 7.8 Notices and notifications

**Available now**

- Teacher inbox metrics;
- urgent unread count;
- notice list;
- protected attachments;
- composer for permitted Teachers;
- teacher-aware audience types;
- recipient preview;
- acknowledgement;
- delivery logs only with delegated capability;
- personal notification inbox.

**Gaps**

- navigation wording implies chat;
- Teacher-specific list views should distinguish received notices, own drafts, submitted-for-approval, published, and acknowledgement-required;
- class/subject scope should be visible on every authored notice;
- Teacher should never see a whole-school recipient option without explicit notice delegation.

## 7.9 My Workspace

**Available now**

- own staff profile;
- employment summary;
- masked bank details when returned;
- employment timeline;
- own payslips;
- own attendance;
- leave request/history;
- contracts;
- unlinked-staff safe state.

**Gaps**

- frequent self-service work is nested in a large tabbed card rather than direct routes;
- leave and payslip attention items are not reflected on Today;
- documents, workload, training, and qualification summaries are not clearly organized;
- personal account profile and employment profile are separate but not clearly explained.

## 7.10 Library

**Available now**

- own loans;
- due-soon and overdue counts;
- catalogue search;
- no librarian administration APIs for ordinary Teachers;
- teacher-librarian delegation.

**Missing from target specification**

- reservation request;
- renewal request;
- own fine amount/status where permitted;
- teaching-resource request;
- assigned-class reading lists;
- recommended reading lists;
- printable reading list.

## 7.11 Learning

**Current role grants**

- read;
- create;
- update;
- delete;
- launch;
- progress.

**Risk**

The Teacher specification describes Learning as entitlement-gated and assignment-scoped, and explicitly lists `learning:delete` as a permission that should not be granted by default. Teacher-owned delete should be a workflow action or ownership-scoped capability, not a broad base permission.

## 7.12 Class reports

The canonical Teacher product requires assignment-scoped reports, but the current generic `/dashboard/reports` route is treated as a delegated academic-administration route. Ordinary Teachers therefore have no coherent Class Reports workspace despite holding broad `reports:read` in the base role.

The target needs purpose-limited Teacher report endpoints and pages for:

- assigned-class attendance;
- subject performance;
- homework completion;
- marks-entry completion;
- homeroom readiness;
- intervention/follow-up list;
- activity history;
- notice acknowledgement for Teacher-owned notices.

---

## 8. Findings and priorities

## TCH-P0-001 — Base Teacher permission preset is broader than the canonical specification

**Severity:** P0  
**Area:** RBAC / future endpoint safety

The base Teacher preset includes broad school permissions that should be replaced by purpose-limited or self/assignment-scoped keys.

**Required correction**

Create an explicit Teacher allowlist using self-service and assignment-scoped permission families. Remove or justify:

- roles read;
- broad staff read;
- broad settings read;
- broad reports read;
- HR staff read;
- Learning delete;
- removed messaging read.

## TCH-P0-002 — Separate `teacher` and `subject_teacher` presets conflict with the assignment model

**Severity:** P0  
**Area:** Role model / attendance capability

The product specification defines one base Teacher role. Subject and Class Teacher authority should be assignments. The two current presets can drift, as already shown by `attendance:mark` existing on one and not the other.

**Required correction**

Converge on one base Teacher role and migrate legacy `subject_teacher` users to Teacher plus assignment records.

## TCH-P0-003 — Attendance default page is administrator-shaped

**Severity:** P0  
**Area:** data minimization / UX authorization

The Teacher can open a page that describes school-wide operations and mounts school-level queues. Even where backend endpoints scope or deny safely, the page composition is incorrect.

**Required correction**

Introduce a Teacher Attendance composition and purpose-limited summary endpoint. Do not mount administrator queries for Teacher sessions.

## TCH-P0-004 — Teacher attendance administrator routes are not fully represented in the Teacher restricted-route matrix

**Severity:** P0  
**Area:** direct route isolation

Anomalies, follow-up operations, correction review, bulk register operations, and settings are advertised by the shared Attendance header. They must be capability-gated and direct-route protected.

## TCH-P0-005 — Teacher pages contain links to restricted academic administration routes

**Severity:** P0 UX / P1 security hardening  
**Examples:**

- Today marks deadlines link to `/dashboard/academics/exams`;
- Marks Entry always shows `Retest queue`.

The route guard prevents unauthorized rendering, but the product advertises actions the Teacher cannot perform.

## TCH-P0-006 — Assignment removal must revoke all web options, cached query data, protected files, and offline drafts

**Severity:** P0  
**Area:** lifecycle revocation

The backend scope resolver handles active assignment dates, but the complete web contract must explicitly clear cached assignment-derived data and invalidate active screens when assignments end.

## TCH-P1-001 — Teacher navigation does not fully match the Teacher mental model

Expose My Homeroom, My Subjects, Class Reports, and direct self-service destinations. Rename `Messages & Announcements` to `Notices`.

## TCH-P1-002 — No complete Teacher student-detail workspace

The Teacher roster is strong but lacks a page for approved student context, attendance history, subject evidence, observations, guardian contact, and follow-up actions.

## TCH-P1-003 — Today is a summary, not yet a complete priority queue

Add urgent notices, returned submissions, corrections, overdue review, follow-up students, and delegation/assignment status.

## TCH-P1-004 — Homework date filtering can truncate results

Move date filtering and pagination to the backend.

## TCH-P1-005 — Marks and CAS information architecture is coordinator-oriented

Create Teacher-owned pages for My Assessments, Marks Grid, CAS, Submission Status, Corrections, Subject Performance, and Homeroom Readiness.

## TCH-P1-006 — Class Reports workspace is missing

Create purpose-limited assignment-scoped reports rather than exposing the generic school report engine.

## TCH-P1-007 — Self-service is overly nested

Provide direct routes for My Attendance, Leave, Payslips, Contracts, and Documents while retaining the overview.

## TCH-P1-008 — Library Teacher feature set is incomplete

Add reservation, renewal request, resource request, reading lists, and permitted fine visibility.

## TCH-P1-009 — Browser E2E coverage is fragmented

The repository includes real teacher attendance/offline coverage and API scope tests, but needs a dedicated Class Teacher and Subject Teacher browser matrix covering shell, navigation, direct-route denial, assignment scoping, permitted writes, self-service, delegated coordination, and assignment revocation.

## TCH-P2-001 — Teacher coordination capabilities need a unified assignment/delegation centre

Teachers with exam, timetable, moderation, or library responsibilities should see one Coordination landing page showing capability, scope, grantor, effective dates, and expiry.

## TCH-P2-002 — Web/mobile continuation metadata should be standardized

Drafts and pending work started on mobile should show consistent ownership, sync, last-update, and conflict state on web.

---

## 9. Target access matrix

| Module | Ordinary Teacher | Class Teacher | Subject Teacher | Delegated Teacher |
|---|---|---|---|---|
| M0 account | Self only | Self only | Self only | Self only |
| M1 students | Assigned projection | Homeroom projection | Subject-group projection | Student admin only if explicitly delegated |
| M2 attendance | Assigned read | Homeroom mark/read/follow-up | Period read/mark only when enabled | Conflict/anomaly/admin only if delegated |
| M3 fees | Hidden | Hidden | Hidden | No Teacher delegation recommended |
| M4 academics | Assigned work | Homeroom readiness + own subject | Own subject/components | Coordinator routes by capability |
| M5 activity | Own + assigned | Homeroom activity/observations | Subject activity | Moderation by capability |
| M6 homework | Own subject | Class tasks + own subject | Own subject | Policy/admin only if delegated |
| M6 timetable | Own schedule | Own + homeroom schedule | Own schedule | Builder/substitution by capability |
| M7 HR/payroll | Self-service | Self-service | Self-service | Cross-staff only if explicit staff admin delegation |
| M8 library | Borrower | Borrower + reading lists | Borrower + reading lists | Full desk by capability |
| M9 transport | Contextual alerts | Assigned-student safety alerts | Relevant alerts | No default workspace |
| M10 canteen | Contextual safety | Assigned-student allergy/safety | Relevant safety | No default workspace |
| M11 accounting | Hidden | Hidden | Hidden | No Teacher delegation recommended |
| M12 notifications | Own inbox | Own + owned communication status | Own + owned communication status | Delivery ops by capability |
| M13 learning | Assigned and enabled | Assigned and enabled | Assigned and enabled | School admin only if explicit |
| M15 notices | Read + scoped draft | Homeroom draft | Subject-group draft | Publish/approve/delivery by capability |

---

## 10. Recommended Teacher navigation

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

Coordination                  [only when delegated]
  Coordination Overview
  Timetable Builder
  Substitutions
  Exam Terms
  Activity Moderation
  Library Desk
```

The sidebar should not contain:

- Admissions;
- school-wide Students;
- Fees;
- Accounting;
- HR administration;
- Payroll runs;
- Transport management;
- Canteen management;
- school settings;
- generic school reports;
- Platform.

---

## 11. Teacher web safety definition of done

The Teacher web persona is safe only when all of the following are true:

1. The canonical base role contains only self-service and assignment-scoped capabilities.
2. Class Teacher and Subject Teacher are assignments, not drifting system presets.
3. Every Teacher list, selector, search, report, export, and protected file is assignment-scoped at the backend.
4. No active assignment produces no teaching data and a useful safe state.
5. Assignment expiry removes navigation options and invalidates cached data.
6. Shared pages do not mount administrator queries for Teacher sessions.
7. Direct routes are denied or redirected before child rendering.
8. The Teacher cannot edit another Teacher’s homework, marks, activities, or observations without delegation.
9. Class Teacher cross-subject access is read-only except for explicit homeroom records.
10. Component-level marks authority is enforced.
11. Teacher notice audiences are assignment-constrained.
12. Fees, accounting, student admissions, Platform, and unrestricted HR remain hidden and backend-denied.
13. Offline replay is idempotent and rechecks current assignment scope.
14. Protected downloads reauthorize on every access.
15. Class Teacher and Subject Teacher E2E fixtures prove both permitted and forbidden behavior.

---

## 12. Governing product rule

```text
The Teacher teaches, records, reviews, coordinates, communicates, and follows up
inside active assignments.

The Teacher does not become a school administrator merely because a shared module
contains school-wide capabilities.
```
