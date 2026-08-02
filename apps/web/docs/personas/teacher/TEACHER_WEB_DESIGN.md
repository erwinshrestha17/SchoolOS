# SchoolOS Teacher Web Design

**Persona:** Teacher  
**Variants:** Class Teacher, Subject Teacher, Assistant Teacher, Substitute Teacher, delegated coordinator  
**Surface:** SchoolOS Web  
**Status:** Target page architecture and UX specification  
**Date:** 2026-08-02

---

## 1. Product intent

The Teacher web experience is the detailed working surface for:

- planning and reviewing the teaching day;
- understanding current assignments;
- accessing assigned students;
- recording attendance;
- creating and reviewing homework;
- entering marks and CAS;
- coordinating a homeroom without editing another Teacher’s work;
- creating consent-aware activities and observations;
- drafting assignment-scoped notices;
- reviewing class evidence and reports;
- accessing personal employment self-service;
- performing explicitly delegated coordination duties.

The design must make authorization understandable without making the interface feel defensive.

Every page should communicate:

```text
Your role in this context
+ the class/section/subject currently in scope
+ the workflow state
+ the next valid action
```

---

## 2. Teacher UX principles

### 2.1 Assignment-first

Never begin with a school-wide selector. Begin with the Teacher’s active contexts.

Examples:

- `Grade 5 A · Homeroom`
- `Grade 6 B · Mathematics`
- `Grade 8 A · Science Practical`
- `Temporary substitution · Grade 7 C · 10:20–11:00`

### 2.2 Today-first

The first screen should answer:

- What am I teaching now?
- What is next?
- Which attendance is incomplete?
- Which work requires review?
- Which marks are due?
- Which students need follow-up?
- Which notices require acknowledgement?

### 2.3 Ownership-visible

Teacher-owned records and coordination-only records must look different.

Use labels such as:

- `Created by you`
- `Submitted by you`
- `View only · set by Rina Sharma`
- `Acting as Class Teacher`
- `Temporary delegation until 25 Shrawan`

### 2.4 No hidden school-wide assumptions

Terms such as `All classes`, `All students`, `All staff`, and `School reports` are prohibited for an ordinary Teacher unless they mean “all of your assigned contexts.”

Prefer:

- All my classes
- All my subjects
- My homeroom
- My students
- My reports

### 2.5 Dense work on web, immediate work on mobile

Web is the authoritative detailed surface for:

- marks grids;
- reports;
- historical review;
- large homework submission sets;
- printing;
- multi-student observations;
- class coordination;
- detailed employment records.

### 2.6 Calm safety design

Medical, attendance, and student-safety alerts must be visible but not sensationalized. Show only the minimum approved context and the exact safe action.

---

## 3. Global shell

### 3.1 Desktop layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ School / academic year │ Search my workspace │ Notifications │ Profile     │
├───────────────────┬─────────────────────────────────────────────────────────┤
│ Teacher sidebar   │ Page header                                             │
│                   │ Context rail / filters                                  │
│ Today             │ Main work surface                                       │
│ My Teaching       │                                                         │
│ Communication     │                                                         │
│ Resources         │                                                         │
│ My Workspace      │                                                         │
│ Coordination*     │                                                         │
└───────────────────┴─────────────────────────────────────────────────────────┘
```

`Coordination` appears only when at least one delegated capability is active.

### 3.2 Header context

Every teaching page should carry a compact context rail:

```text
Academic year 2083  /  Grade 6 B  /  Mathematics  /  Subject Teacher
```

For homeroom pages:

```text
Academic year 2083  /  Grade 5 A  /  Class Teacher
```

### 3.3 Global search

Search must be limited to:

- assigned students;
- Teacher-owned homework;
- Teacher-owned activities;
- permitted notices;
- own employment documents;
- enabled Library catalogue.

No global school search.

### 3.4 Responsive behavior

- Sidebar collapses to a drawer below large desktop.
- Context rail becomes horizontally scrollable.
- Tables keep the primary identity column sticky.
- Dense marks grids use horizontal scrolling, sticky student names, and keyboard navigation.
- Multi-column review screens become stacked work surfaces.

---

## 4. Target navigation

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

# 5. Page-by-page design

## Page 01 — Today

**Route:** `/dashboard`

### User job

Understand the teaching day and complete the most urgent valid task.

### Header

- Title: `Today`
- Subtitle: school day and Nepali date
- Metadata: last refreshed, online state, active assignment count
- Primary action: context-sensitive, such as `Mark Grade 5 A attendance`

### Layout

1. Current and next period band.
2. Priority queue.
3. My classes today.
4. Review work.
5. Student follow-ups.
6. Notices and substitutions.

### Priority queue order

1. current attendance not submitted;
2. urgent notice acknowledgement;
3. returned marks/homework requiring correction;
4. marks deadline within 48 hours;
5. overdue homework review;
6. substitution acknowledgement;
7. homeroom follow-up.

### Forbidden content

- school-wide attendance totals;
- all staff absence;
- fees;
- admissions;
- generic operational readiness.

### States

- no active assignments;
- no classes today;
- module unavailable;
- partial data;
- stale data;
- offline/read-only;
- assignment changed while page open.

---

## Page 02 — My Schedule

**Route:** `/dashboard/my-schedule` or existing `/dashboard/timetable`

### User job

See the week, current period, rooms, substitutions, and exam duties.

### Layout

- Today strip with current/next period.
- Week switcher.
- Schedule grid.
- Right rail for substitutions and exam duty.

### Row/card anatomy

- time;
- class and section;
- subject;
- room;
- assignment type;
- temporary change;
- quick actions: roster, attendance, homework.

### Interaction

Selecting a period opens a side drawer rather than navigating away immediately.

---

## Page 03 — My Homeroom

**Route:** `/dashboard/my-homeroom`

**Visibility:** Class Teacher only.

### User job

Coordinate one assigned homeroom across attendance, homework, marks readiness, notices, and student follow-up.

### Header

- Class/section.
- Class Teacher effective dates.
- Primary action: `Open homeroom attendance`.

### KPIs

- students;
- attendance follow-ups;
- subjects awaiting marks;
- homework due this week;
- notices awaiting acknowledgement.

### Main sections

1. Student attention list.
2. Subject completion table.
3. Homework workload calendar.
4. Recent class activities.
5. Parent communication/notice status.
6. Result readiness and Class Teacher remarks.

### Ownership rule

Cross-subject records show author and remain read-only.

---

## Page 04 — My Subjects

**Route:** `/dashboard/my-subjects`

### User job

Open one active subject assignment and see its teaching workload.

### Layout

Assignment cards or a compact table grouped by subject:

- class/section;
- component scope;
- timetable periods;
- attendance mode;
- homework due;
- marks deadline;
- students needing subject follow-up;
- assignment effective date.

### Primary action per assignment

`Open subject workspace`.

### Empty state

Explain that no active subject assignment exists; do not show school subjects.

---

## Page 05 — My Students

**Route:** `/dashboard/my-students`

### User job

Find an assigned student and open the context needed for teaching.

### Views

- My Subject Students.
- My Homeroom, when applicable.

### Filters

- all my classes;
- subject;
- needs attention;
- attendance band;
- search name/roll/ID.

### Table

- photo/name;
- roll;
- class/section;
- relationship to Teacher;
- attendance signal;
- Teacher-owned work status;
- approved safety alert;
- open details.

### Mobile/narrow

Each row becomes a compact list item, not a decorative card grid.

---

## Page 06 — Teacher Student Detail

**Route:** `/dashboard/my-students/[studentId]`

### User job

Review one assigned student without exposing unrelated school records.

### Header

- student name/photo;
- roll and class;
- Teacher’s relationship: Homeroom / Mathematics / Substitute;
- approved safety flag.

### Tabs

1. Overview.
2. Attendance.
3. My Subject.
4. Homework.
5. Observations.
6. Communication.

### Overview

- approved guardian contact;
- emergency contact action;
- attendance signal;
- current assigned homework;
- Teacher-owned marks summary;
- active approved accommodation/safety note.

### Restrictions

- no fees;
- no full medical documents;
- no guardian identity documents;
- no unrelated subject marks;
- no admissions or lifecycle mutation.

---

# Attendance

## Page 07 — My Attendance Overview

**Route:** `/dashboard/attendance`

### User job

See exactly which assigned attendance contexts are pending, submitted, locked, or need correction.

### Header

- Title: `My Attendance`
- Primary action: next valid attendance context
- More: offline drafts, my history, request correction

### KPIs

- pending today;
- submitted today;
- offline drafts;
- correction requests open.

### Main sections

1. Today’s contexts.
2. Recent submissions.
3. Homeroom follow-ups, Class Teacher only.
4. Correction status.

### Never mount

- school-wide analytics;
- global conflict queue;
- anomaly operations;
- policy settings;
- bulk school register actions.

---

## Page 08 — Mark Homeroom Attendance

**Route:** `/dashboard/attendance/mark?mode=homeroom`

### User job

Mark daily attendance for the exact assigned homeroom.

### Layout

- context banner;
- date/session status;
- sticky action toolbar;
- roster table;
- exception reason drawer;
- submission summary.

### Roster columns

- roll;
- student;
- status segmented control;
- reason;
- note;
- safety indicator.

### Actions

- mark all present;
- apply to selected;
- save draft;
- submit;
- open offline draft.

### Submission confirmation

Show counts and unresolved missing reasons before submit.

---

## Page 09 — Mark Period Attendance

**Route:** `/dashboard/attendance/period/[periodId]`

**Visibility:** only when the tenant enables period attendance and the Teacher is assigned to the exact period.

### Differences from homeroom

- timetable period is immutable context;
- late arrival can reference period start;
- no full-day status override;
- substitution/delegation badge appears;
- session closes according to policy.

---

## Page 10 — Attendance History

**Route:** `/dashboard/attendance/history`

### User job

Review sessions the Teacher marked or was assigned to.

### Filters

- assignment;
- date range;
- status;
- homeroom/period mode.

### Table

- date;
- class/subject;
- mode;
- submitted count;
- absent/late;
- state;
- submitted at;
- correction status.

---

## Page 11 — Monthly Register

**Route:** `/dashboard/attendance/register/monthly`

### User job

Review or print an assigned-class monthly register.

### Design

- academic year, class, section, BS month;
- sticky student column;
- compact daily cells;
- legend;
- missing-session markers;
- protected print/export.

Only assigned contexts appear in selectors.

---

## Page 12 — My Attendance Corrections

**Route:** `/dashboard/attendance/corrections`

### User job

Create and track correction requests for records the Teacher is authorized to correct.

### Views

- My requests.
- Draft request.
- Returned.
- Resolved.

### Table

- student/session;
- original;
- requested;
- reason;
- submitted;
- reviewer status;
- resolution.

No approval or lock override controls for ordinary Teachers.

---

## Page 13 — New Attendance Correction

**Route:** `/dashboard/attendance/corrections/new`

### Flow

1. Select own submitted session.
2. Select student.
3. Review original record.
4. Enter requested status/reason.
5. Attach evidence if allowed.
6. Confirm no direct official record change occurs.
7. Submit.

---

## Page 14 — Assigned Attendance Reports

**Route:** `/dashboard/attendance/reports`

### Reports

- homeroom attendance;
- subject/period attendance;
- student trend within assignment;
- consecutive absence list for homeroom;
- Teacher submission history.

### Export

PDF/CSV only for permitted assignment scope, with generated-at and filter evidence.

---

# Homework

## Page 15 — Homework Overview

**Route:** `/dashboard/homework`

### Views

- Today.
- All.
- Awaiting Review.
- Completion.
- Templates.

### KPIs

- due today;
- awaiting review;
- overdue review;
- drafts;
- classes with workload clash.

### Primary action

`Create homework` or `Create class task` based on current context.

---

## Page 16 — Create/Edit Homework

**Route:** `/dashboard/homework/new` and `/dashboard/homework/[id]/edit`

### First decision

- Subject homework.
- Homeroom class task, Class Teacher only.

### Form structure

1. Assignment context.
2. Title and instructions.
3. Due date/time.
4. Submission method.
5. Attachments.
6. Rubric/feedback settings.
7. Audience preview.
8. Draft/publish/schedule.

Selectors contain only active assignments.

---

## Page 17 — Homework Detail

**Route:** `/dashboard/homework/[homeworkId]`

### Header

- title;
- class/subject;
- status;
- owner;
- due date;
- audience;
- last updated.

### Sections

- instructions and attachments;
- completion summary;
- submission status;
- reminders;
- version history;
- permitted actions.

---

## Page 18 — Submission Review

**Route:** `/dashboard/homework/[homeworkId]/submissions`

### Layout

- left student queue;
- central submission/evidence;
- right feedback panel.

### Actions

- mark reviewed;
- feedback;
- request resubmission;
- apply rubric;
- next student.

Keyboard navigation is required for large classes.

---

## Page 19 — Homework Templates

**Route:** `/dashboard/homework/templates`

### Content

- own templates;
- school-provided read-only templates;
- search/filter;
- duplicate;
- archive own template;
- create from template.

---

## Page 20 — Homework Completion

**Route:** `/dashboard/homework/completion`

### Layout

- assignment filter;
- date range;
- completion distribution;
- student table;
- late/missing list;
- protected export.

For Class Teachers, a separate read-only cross-subject workload view is available.

---

# Assessments and marks

## Page 21 — My Assessments & Marks

**Route:** `/dashboard/assessments` or canonical `/dashboard/academics/marks`

### User job

Understand all assigned assessment work and enter the next required marks.

### KPIs

- entry windows open;
- drafts;
- missing marks;
- submitted;
- returned for correction;
- deadlines within 48 hours.

### Main table

- exam/assessment;
- class/section;
- subject;
- component scope;
- deadline;
- completion;
- state;
- open action.

Do not show Retest, Publish, Lock, or Promotion actions without delegated capability.

---

## Page 22 — Assessment Detail

**Route:** `/dashboard/assessments/[assessmentId]`

### Content

- configured maximum/pass marks, read-only;
- component authority;
- entry window;
- students/missing state;
- instructions;
- submission history;
- correction history.

Primary action: `Enter marks` when editable.

---

## Page 23 — Marks Entry Grid

**Route:** `/dashboard/academics/marks?assessmentId=...`

### Grid design

- sticky student identity columns;
- component columns;
- inline validation;
- autosave status per row;
- missing/exempt state;
- keyboard navigation;
- draft summary;
- submit toolbar.

### Guardrails

- no fields outside component scope;
- no editing after submission unless returned;
- no other subject marks;
- no hidden client-side calculations presented as official.

---

## Page 24 — CAS Workspace

**Route:** `/dashboard/academics/cas`

### Design

- assigned context selector;
- assessment period;
- criteria/rubric rail;
- student entry table;
- evidence note;
- save/submit state.

Support qualitative and quantitative CAS without diagnostic labels.

---

## Page 25 — Marks Submission Status

**Route:** `/dashboard/academics/submissions`

### Views

- Draft.
- Submitted.
- Returned.
- Accepted.
- Locked.

Each row shows who returned it, reason, deadline, and next action.

---

## Page 26 — Marks Correction Request

**Route:** `/dashboard/academics/corrections`

### Content

- Teacher’s own requests;
- original and proposed value;
- reason/evidence;
- approval status;
- corrected version reference.

No direct unlock or approval.

---

## Page 27 — Subject Performance

**Route:** `/dashboard/academics/subject-performance`

### User job

Understand performance only for subjects the Teacher actively teaches.

### Design

- assessment and assignment filters;
- distribution chart;
- learning outcome/skill breakdown where configured;
- missing work;
- student table;
- comparison to the same assigned group over time, not public rankings.

---

## Page 28 — Homeroom Academic Readiness

**Route:** `/dashboard/academics/homeroom-readiness`

**Visibility:** Class Teacher only.

### Content

- subject submission matrix;
- missing marks by subject;
- report-card readiness;
- Class Teacher remarks status;
- students requiring coordination;
- request correction from responsible Teacher;
- submit homeroom readiness.

No editing of another Teacher’s marks.

---

# Activities and observations

## Page 29 — Activities

**Route:** `/dashboard/activity`

### Views

- Assigned feed.
- My drafts.
- Awaiting review.
- Published by me.
- Gallery.
- Observations.
- Milestones.

### Filters

Only assigned classes/sections/subjects.

---

## Page 30 — Create/Edit Activity

**Route:** `/dashboard/activity/new` and `/dashboard/activity/[id]/edit`

### Form

1. Homeroom or subject context.
2. Title/story.
3. Student tagging.
4. Media upload.
5. Consent evidence.
6. Observation/milestone relation.
7. Audience preview.
8. Draft/submit for review/publish if delegated.

### Safety

Students without required media consent remain visibly excluded from media tagging.

---

## Page 31 — Activity Detail

**Route:** `/dashboard/activity/[activityId]`

### Content

- story/media;
- class/subject context;
- tagged students;
- consent result;
- audience;
- owner;
- moderation state;
- delivery state;
- version history;
- edit/archive/report actions as permitted.

---

## Page 32 — Activity Gallery

**Route:** `/dashboard/activity/gallery`

### Design

- list/grid toggle;
- assignment filter;
- processing, failed, approved states;
- own uploads versus class-visible media;
- retry for own failed upload;
- protected preview.

Avoid a decorative social-media gallery; keep evidence and consent visible.

---

## Page 33 — Observations & Milestones

**Routes:** `/dashboard/activity/observations`, `/dashboard/activity/milestones`

### Design

- assigned student selector;
- observation type;
- date/context;
- supportive narrative;
- optional activity link;
- visibility;
- draft/published state;
- history.

No diagnosis, ranking, or irreversible label.

---

# Communication

## Page 34 — Notices

**Route:** `/dashboard/notices`

### Views

- Received.
- Acknowledgement required.
- My drafts.
- Submitted for approval.
- Published by me.

### Table/list

- title;
- scope;
- priority;
- lifecycle;
- scheduled/published date;
- acknowledgement state;
- owner.

Primary action appears only when the Teacher can create a notice.

---

## Page 35 — Notice Composer

**Route:** `/dashboard/notices/new`

### Context-first design

The first field is assignment context, not audience type.

```text
Grade 5 A homeroom
Grade 6 B Mathematics
```

The allowed audience is derived from that context.

### Form

- context;
- title/body in supported languages;
- category/priority;
- acknowledgement requirement;
- attachment;
- recipient preview;
- save draft;
- submit for approval.

Whole-school, arbitrary role, staff, or emergency targeting is absent without delegation.

---

## Page 36 — Notice Detail

**Route:** `/dashboard/notices/[noticeId]`

### Content

- notice body and attachment;
- exact audience summary;
- lifecycle timeline;
- acknowledgement count for owned scoped notices;
- delivery summary when permitted;
- approval feedback;
- correction/replacement history.

---

## Page 37 — Notifications

**Route:** `/dashboard/notifications`

### Design

- unread/all;
- type filter;
- class/subject context;
- exact event time;
- deep link;
- acknowledgement action;
- mark read;
- preference shortcut.

Sensitive content uses generic preview until opened.

---

# Class reports

## Page 38 — Class Reports Hub

**Route:** `/dashboard/class-reports`

### User job

Select a purpose-limited report within active assignments.

### Report catalogue

- attendance;
- homework completion;
- subject performance;
- marks completion;
- homeroom readiness;
- intervention/follow-up;
- activity history;
- notice acknowledgement.

No generic school report definitions.

---

## Page 39 — Attendance Report

**Route:** `/dashboard/class-reports/attendance`

- assignment/date filters;
- attendance trend;
- student table;
- consecutive absence list for homeroom;
- submission history;
- export.

---

## Page 40 — Homework Completion Report

**Route:** `/dashboard/class-reports/homework`

- subject or homeroom mode;
- completion/late/missing;
- workload by date;
- student detail;
- export.

---

## Page 41 — Subject Performance Report

**Route:** `/dashboard/class-reports/subject-performance`

- assessment filter;
- distribution;
- component breakdown;
- student table;
- longitudinal view;
- export.

---

## Page 42 — Marks Completion / Homeroom Readiness Report

**Route:** `/dashboard/class-reports/marks-completion`

- subject submission matrix;
- missing components;
- returned submissions;
- responsible Teacher;
- readiness state.

Class Teacher sees cross-subject state, not values outside allowed scope.

---

## Page 43 — Follow-up and Intervention Report

**Route:** `/dashboard/class-reports/interventions`

- attendance concern;
- missing work;
- observation follow-up;
- communication status;
- owner;
- due date;
- resolved state.

This is supportive coordination, not automated diagnosis.

---

# Library and Learning

## Page 44 — Teacher Library

**Route:** `/dashboard/library`

### Views

- My loans.
- Catalogue.
- Reservations.
- Reading lists.
- Resource requests.

### KPIs

- books out;
- due soon;
- overdue;
- reservations ready.

### Actions

- request reservation;
- request renewal;
- create assigned-class reading list;
- request teaching resource.

No issue/return or fine-posting controls.

---

## Page 45 — Reading Lists

**Route:** `/dashboard/library/reading-lists`

### Content

- own lists;
- assigned class/subject;
- catalogue items;
- optional note;
- publish to assigned group;
- print/download.

---

## Page 46 — Learning Overview

**Route:** `/dashboard/learning`

**Visibility:** enabled module + active assignment.

### Views

- My activities.
- Sessions.
- Attempts.
- Progress.
- Resources.

### Constraints

- only assigned subjects;
- only Teacher-owned content for edit;
- no school-wide analytics;
- delete becomes archive/withdraw according to lifecycle.

---

## Page 47 — Learning Activity Editor

**Route:** `/dashboard/learning/activities/new` and detail routes

- assignment context;
- learning objective;
- activity steps;
- resources;
- access/session configuration;
- draft/publish;
- accessibility check.

---

## Page 48 — Learning Session and Attempts

**Routes:** session and attempt routes

- live session code/status;
- assigned participants;
- attempts queue;
- response review;
- feedback;
- progress summary;
- no ranking.

---

# Employee self-service

## Page 49 — My Workspace Overview

**Route:** `/dashboard/my-workspace`

### Content

- employment summary;
- today’s staff attendance;
- leave balance;
- latest payslip;
- contract expiry/status;
- pending requests;
- recent employment timeline.

### Primary actions

- request leave;
- request attendance correction;
- open latest payslip.

---

## Page 50 — My Staff Attendance

**Route:** `/dashboard/my-workspace/attendance`

- monthly calendar;
- present/late/leave/missing;
- working days;
- correction requests;
- attendance policy summary.

---

## Page 51 — Leave

**Route:** `/dashboard/my-workspace/leave`

- balance by leave type;
- request form;
- request history;
- approval timeline;
- cancellation rules;
- supporting attachment.

---

## Page 52 — Payslips

**Route:** `/dashboard/my-workspace/payslips`

- payroll period;
- net pay;
- status;
- protected PDF;
- earnings/deductions detail;
- correction/report issue action.

Sensitive data should support privacy masking and reauthentication policy.

---

## Page 53 — Contracts & Documents

**Route:** `/dashboard/my-workspace/contracts`

- current contract summary;
- contract history;
- qualifications;
- own employment documents;
- expiry dates;
- protected downloads;
- acknowledgement where required.

---

## Page 54 — Profile, Preferences, Security

**Routes:** existing personal settings routes

### Profile

- personal contact data;
- photo;
- preferred name;
- correction request for official fields.

### Preferences

- language;
- appearance;
- notification channels;
- quiet hours where allowed;
- accessibility.

### Security

- password;
- active sessions;
- revoke session;
- device history;
- security events.

---

# Delegated coordination

## Page 55 — Coordination Overview

**Route:** `/dashboard/coordination`

**Visibility:** at least one delegated capability.

### Content

- capability name;
- scope;
- grantor;
- effective date;
- expiry;
- current queue;
- audit note;
- open workspace.

This page prevents delegated work from being mistaken for permanent broad authority.

---

## Page 56 — Timetable Coordination

**Routes:** existing builder/version/conflict routes

### Design

Keep the full operational tools, but show a persistent delegation banner for Teacher coordinators. The page must distinguish:

- own schedule;
- school timetable administration;
- draft versus published version;
- validation errors;
- high-impact publish confirmation.

---

## Page 57 — Substitution Coordination

**Routes:** existing substitutions/replacements routes

- absence context;
- eligible replacement evidence;
- conflict check;
- assignment period;
- notification status;
- cancellation/history.

---

## Page 58 — Exam Coordination

**Routes:** exam-term and delegated academic routes

- terms;
- entry windows;
- assessment components;
- submission progress;
- returned work;
- no silent expansion into result publication unless separately delegated.

---

## Page 59 — Activity Moderation

**Route:** `/dashboard/activity/moderation`

- pending queue;
- media/consent evidence;
- audience;
- author;
- approve/return/reject with reason;
- immutable decision history.

---

## Page 60 — Teacher-Librarian Desk

**Routes:** existing Library admin routes

- catalogue;
- copies;
- issue/return;
- reservations;
- overdue;
- fines;
- reports.

A delegation banner must make it clear that the user is acting as Library Operator, not under ordinary Teacher authority.

---

## 6. Shared page states

Every Teacher page must define:

### Loading

Preserve page anatomy with skeletons; do not expose stale data from a previous assignment.

### No assignment

Explain the missing assignment and direct the Teacher to the academic coordinator.

### Assignment ended

Close editing immediately, clear cached context, and show:

```text
This assignment ended. Your draft is no longer editable.
Contact the school office if the assignment should still be active.
```

### Module unavailable

Use an honest unavailable state; do not show an upgrade CTA to Teachers.

### Permission changed

Invalidate the route and redirect to the nearest valid Teacher page.

### Partial data

Name the unavailable module or source. Do not replace missing data with zero.

### Offline

Show read-only cached state and local draft status. Every pending operation displays last attempted sync and conflict state.

### Error

Preserve entered work and provide retry. Avoid generic destructive refresh actions.

---

## 7. Accessibility requirements

- Full keyboard marks-grid navigation.
- Sticky headers and row labels retain semantic table structure.
- Status must not depend on color alone.
- Focus returns to the initiating control after drawers/dialogs.
- Destructive or submission confirmation announces impact.
- Charts include data tables or text alternatives.
- Student safety alerts use descriptive text.
- All protected-file controls describe file type and access behavior.
- Reduced-motion support.
- Minimum touch target 44px on narrow layouts.

---

## 8. Visual direction

Use the existing SchoolOS neutral shell and module accents. The Teacher workspace should feel:

- focused;
- calm;
- practical;
- evidence-based;
- less dense than Admin;
- more task-oriented than Principal;
- more detailed than mobile.

Avoid:

- decorative dashboards;
- oversized KPI walls;
- school-wide executive language;
- excessive card nesting;
- social-media styling for activities;
- finance or administrative metaphors;
- lock icons as a substitute for hiding unavailable routes.

Use:

- open work surfaces;
- compact context rails;
- strong tables;
- sticky toolbars;
- side drawers for detail;
- clear ownership labels;
- restrained semantic alerts;
- consistent assignment badges.

---

## 9. Governing rule

```text
Design every Teacher page around the exact assignment that makes the page valid.

If the interface cannot explain why this Teacher may see or change a record,
the page is not ready.
```
