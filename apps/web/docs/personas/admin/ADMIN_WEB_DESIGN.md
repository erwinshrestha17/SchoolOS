# SchoolOS Admin Web Design

**Document type:** Governing web UX and page specification  
**Persona:** School Admin  
**Surface:** `/dashboard/*` and `/dashboard/settings/*`  
**Status:** Target design; implementation must remain repository- and API-backed  

---

## 1. Design North Star

The Admin web application is the operating system for one school.

It should feel like:

```text
A complete, controlled school operations desk.
```

It must not feel like:

```text
A developer console.
A SaaS platform control plane.
A generic ERP menu dump.
A dashboard made of decorative cards.
A collection of unrelated specialist applications.
```

The Admin has full tenant-scoped school authority, but the interface must still guide the user toward safe delegation, evidence, and controlled high-risk actions.

### Core design rule

```text
One page = one main job.
One module hub = one coherent operational domain.
One Admin account = complete school authority, never Platform authority.
```

Every page should answer within ten seconds:

1. Where am I?
2. Which school, branch, academic year, or fiscal period am I operating in?
3. What is blocked, overdue, or waiting?
4. What is the safest next action?
5. What evidence will be recorded if I act?

---

## 2. Admin Persona Jobs

The Admin performs six broad jobs.

### 2.1 Configure

- school identity and branding;
- academic years, classes, sections, and subjects;
- admissions, attendance, exam, homework, finance, HR, communication, and security policy;
- users, roles, permissions, and assignments;
- enabled module configuration;
- safe integration and document settings.

### 2.2 Operate

- admissions and student lifecycle;
- attendance;
- fees and collections;
- academics and results;
- activity and communication;
- homework and timetable;
- HR and payroll;
- Library, Transport, Canteen, and Learning when enabled;
- accounting and finance.

### 2.3 Review and approve

- exceptions;
- corrections;
- sensitive lifecycle actions;
- refunds and reversals;
- payroll and fiscal actions;
- results and publication;
- notice and media approval;
- role and security changes.

### 2.4 Monitor

- school-day readiness;
- module health;
- failures and stale work;
- financial control;
- staffing and academic readiness;
- communication delivery;
- tenant-safe integration status.

### 2.5 Delegate

- assign work to Cashier, Accountant, HR, Librarian, Transport, Canteen, Academic, Examination, and Communication operators;
- review role coverage;
- avoid routine use of the highest-authority account.

### 2.6 Prove

- reports;
- audit history;
- approval evidence;
- protected exports;
- immutable transaction lineage;
- who changed what, when, why, and with what outcome.

---

## 3. Access and Platform Separation

### Admin plane

```text
/dashboard/*
/dashboard/settings/*
```

### Platform plane

```text
/platform/*
```

No Platform item appears in Admin navigation, global search, command palette, quick actions, recent items, or deep-link suggestions.

### Platform-denied page

When a school Admin reaches a Platform route:

- show a compact restricted page;
- do not show Platform shell navigation;
- do not reveal tenant, provider, plan, or infrastructure data;
- provide one action: `Return to School Dashboard`;
- log the denied attempt where appropriate;
- backend independently returns `403`.

---

## 4. Global Shell

### 4.1 Desktop structure

```text
Topbar
  School / branch context
  Academic year or fiscal context
  Global search / command palette
  Notifications
  Help
  User menu

Sidebar
  Command Centre
  Students
  Daily Operations
  Academics
  People
  Finance
  School Services
  Evidence
  System

Page
  Breadcrumb / module label
  ModuleHeader
  Optional context/filter bar
  Summary strip only where decision-useful
  Main work surface
  Optional detail drawer or right rail
  Sticky action bar only for review or multi-step workflows
```

### 4.2 Global context controls

The topbar should support:

- school name;
- branch selection where the user has multiple branches;
- academic year selection for academic modules;
- fiscal year/period indicator for finance modules;
- current BS and AD date presentation;
- active support override banner only when an audited override exists;
- environment label only outside production.

Changing branch or year must:

- update the URL or durable context state;
- invalidate relevant queries;
- warn before discarding unsaved work;
- never silently broaden the data scope.

### 4.3 Sidebar behavior

- 264 px expanded, 72 px collapsed.
- Searchable.
- Grouped by school job, not module number.
- Module links are hubs; detailed subpages live inside local tabs.
- Entitlement-disabled modules are omitted from operations and visible in Settings > Modules.
- Enabled but unconfigured modules show a setup indicator.
- No financial amounts, student names, or sensitive data in sidebar badges.
- Badge counts are limited to actionable queues.

### 4.4 Mobile and narrow laptop behavior

Admin is web-first, but every page must remain usable at 1024 px and support emergency access on smaller screens.

- Sidebar becomes a drawer below `lg`.
- Tables switch to horizontal scroll or priority columns; never cardify financial ledgers.
- Right detail panels become full-screen drawers.
- KPI strips become two columns and then one column.
- Sticky action bars remain reachable above browser chrome.
- Critical actions require deliberate taps and remain separated from navigation.

---

## 5. Target Navigation

```text
Command Centre
  Dashboard
  Action Centre
  Approval Centre
  School Readiness

Students
  Admissions
  Students
  Guardians & Access
  Enrollment & Lifecycle

Daily Operations
  Attendance
  Activity Feed
  Notices
  Notifications & Delivery

Academics
  Academics
  Exams & Results
  Homework
  Timetable
  Learning                     [enabled only]

People
  HR & Staff
  Leave & Attendance
  Payroll

Finance
  Fees & Receipts
  Accounting
  Cash & Bank
  Expenses & Payables

School Services               [enabled only]
  Library
  Transport
  Canteen

Evidence
  Reports & Exports
  School Audit

System
  Settings
```

### Navigation principle

Full access does not require every route in the sidebar. Each module hub exposes its own task tabs, recent work, queues, reports, and settings.

---

## 6. Global Visual System

Use `apps/web/docs/DESIGN_SYSTEM.md` without introducing a separate Admin theme.

### Admin-specific visual direction

- Calm light background.
- Deep navy and SchoolOS blue for authority and action.
- Module accents identify location.
- Semantic colors communicate status.
- Dense tables remain readable with 13–14 px text.
- No decorative gradient dashboards.
- No card grid where a queue, table, calendar, or split workspace is more appropriate.
- Use tabular numerals for counts, marks, money, receipt numbers, and payroll values.

### Summary cards

Use maximum four to six cards only on overview pages.

Every card must:

- come from a bounded backend summary;
- have an explicit period or context;
- drill to a real filtered workspace;
- distinguish zero from unavailable;
- not duplicate a nearby table total.

### Risk labels

High-authority does not mean low-friction everywhere.

- Routine action: standard primary button.
- Sensitive reveal: secondary button plus reason.
- High-risk action: warning treatment and confirmation.
- Destructive/lifecycle action: separated danger area.
- Bulk action: preview-first wizard.
- Protected export: reason, watermark, expiry, history.

---

## 7. Shared Page Archetypes

### 7.1 Overview page

```text
ModuleHeader
Decision summary strip
Attention / readiness queues
Operational trend or status table
Recent changes / next actions
```

### 7.2 List page

```text
ModuleHeader
Workspace tabs
Server filter bar
Active filter chips
Paginated table
Detail drawer
Bulk actions only when safe
```

### 7.3 Record detail page

```text
Identity header
Status and context
Primary workflow action
Summary facts
Tabbed record domains
Timeline / audit rail
Protected files
Danger zone
```

### 7.4 Review and approval page

```text
Queue on left
Evidence and impact in center
Decision panel on right
Reason required
Original vs requested values
Audit preview
Approve / return / reject
```

### 7.5 Builder or configuration page

```text
Context and scope
Step or tab navigation
Editable canvas/form
Validation panel
Preview
Save draft
Validate
Publish/apply with confirmation
```

### 7.6 Financial page

```text
Period context
Reconciliation or control status
Table/ledger as primary surface
Right-aligned money
Drill-down lineage
No client-calculated official totals
Immutable correction path
```

---

# 8. Page-by-Page Design

## Page 01 — Admin Dashboard

**Route:** `/dashboard`

**Main job:** Understand the school operating position and choose the most important next action.

### Header

- Eyebrow: `School operations`
- Title: `School Dashboard`
- Description: `Today’s school readiness, exceptions, approvals, and module health.`
- Metadata: branch, school day, academic year, last updated, overall status.
- Primary action: highest-severity safe next action.
- More actions: refresh, open reports, open settings readiness.

### Summary strip

Maximum six:

- attendance completion;
- admissions requiring action;
- fees collected/outstanding control status;
- academic readiness;
- staff/payroll readiness;
- approvals requiring action.

### Main layout

- Left 2/3: `Needs action` queue ordered by severity and SLA.
- Right 1/3: `Today’s operations` compact rows.
- Full width: enabled-module health matrix.
- Lower left: configuration and security readiness.
- Lower right: recent school activity and audit events.

### Rules

- Do not render all module totals.
- Finance values are masked by user preference only if policy requires; Admin may reveal with reason.
- Every issue links to a filtered queue.
- Platform health is never shown; only tenant-safe integration readiness.

### States

- Partial summary shows which modules are unavailable.
- Stale data shows timestamp and refresh.
- Zero issues reads `All clear`, never blank.

---

## Page 02 — Action Centre

**Route:** `/dashboard/service-requests` or future `/dashboard/actions`

**Main job:** Triage, assign, resolve, and escalate structured school work.

### Header

- Title: `Action Centre`
- Primary action: `Create internal action` only if a backend contract exists.
- Summary: open, overdue, unassigned, escalated.

### Filters

- source module;
- category;
- priority;
- status;
- assignee;
- branch;
- due date;
- requester type.

### Table

Columns:

- action;
- linked student/staff/account;
- source;
- priority;
- status;
- assignee;
- due time;
- last activity.

### Detail drawer

- request narrative;
- linked evidence;
- parent-visible and internal notes;
- assignment history;
- SLA timeline;
- resolve/escalate controls;
- audit events.

### Rules

- No free-form open chat.
- Parent-visible notes must be clearly labeled.
- Resolution requires a summary.
- Escalation requires assignee and reason.

---

## Page 03 — Approval Centre

**Route:** proposed `/dashboard/approvals`

**Main job:** Make cross-module decisions with evidence and impact visibility.

### Summary

- urgent;
- due today;
- high-value finance;
- academic publication;
- people/security.

### Queue categories

- finance;
- attendance;
- academics;
- HR/payroll;
- communication/content;
- users/security;
- school configuration.

### Layout

Three-pane desktop:

1. queue list;
2. evidence and original/requested comparison;
3. decision panel.

### Decision panel

- impact summary;
- policy/threshold;
- requested by;
- reviewer separation warning;
- attachments;
- reason field;
- approve, return, reject;
- optional step-up or second approval.

### Rules

- No decision from a dashboard card.
- Preserve original record and requested change.
- Show downstream financial, student, staff, or audience effect.

---

## Page 04 — School Readiness

**Route:** proposed `/dashboard/readiness`

**Main job:** Verify the school is ready for the current day, term, payroll cycle, and fiscal period.

### Domains

- school-day operations;
- student data;
- attendance;
- fees;
- academics;
- people/payroll;
- accounting;
- communication;
- enabled services;
- settings/security.

### Layout

- readiness score is not a single synthetic percentage;
- use domain rows with `Ready`, `Attention`, `Blocked`, `Unavailable`;
- each row shows exact checks and owner;
- right rail shows blockers by severity;
- footer shows recent resolved blockers.

### Primary action

`Review blockers`.

---

## Page 05 — Admissions Overview

**Route:** `/dashboard/admissions`

**Main job:** Move applicants safely through the admission pipeline.

### Summary

- needs information;
- waiting for review;
- ready to admit;
- duplicate warnings;
- waitlist/capacity exception.

### Main surface

- pipeline or queue tabs;
- server-paginated case table;
- capacity by class/section;
- upcoming assessments;
- document and duplicate exception rail.

### Primary action

`New admission`.

### More actions

- applications;
- assessments;
- documents;
- duplicates;
- iEMIS;
- QR/ID;
- policy.

---

## Page 06 — Admission Case Detail

**Route:** `/dashboard/admissions/[caseId]`

**Main job:** Review one applicant and complete the next valid workflow step.

### Header

- applicant name;
- case number;
- stage;
- target class/year;
- branch;
- age/capacity warnings.

### Tabs

- overview;
- guardians;
- documents;
- assessment;
- decisions;
- timeline.

### Right rail

- missing requirements;
- duplicate candidates;
- next action;
- owner;
- due date.

### High-risk controls

- accept/admit;
- reject;
- override capacity;
- merge duplicate;
- sensitive guardian action.

Require reason, impact preview, and audit.

---

## Page 07 — Students Directory

**Route:** `/dashboard/students`

**Main job:** Find, filter, and open authoritative student records.

### Header

- Title: `Students`
- Primary action: `New admission`
- More actions: document issues, duplicates, iEMIS, QR/ID, export.

### Filters

- academic year;
- branch;
- class;
- section;
- status;
- search;
- data-quality flag.

### Table

- student;
- ID/roll;
- class/section;
- guardians;
- enrollment status;
- data-quality status;
- action.

### Rules

- server pagination;
- sensitive fields not in list view;
- export uses current filters and protected job history.

---

## Page 08 — Student Profile

**Route:** `/dashboard/students/[studentId]`

**Main job:** Manage one student's authoritative school record.

### Header

- photo;
- name;
- student ID;
- class/section;
- enrollment status;
- branch;
- safety flag;
- primary action based on lifecycle state.

### Tabs

- overview;
- enrollment;
- guardians;
- attendance;
- academics;
- fees;
- documents;
- activity;
- service requests;
- history.

### Right rail

- critical contacts;
- safety/medical summary;
- outstanding actions;
- recent documents;
- audit timeline.

### Sensitive behavior

- mask medical, custody, and restricted guardian details by default;
- reveal requires reason where policy requires;
- record every reveal and export.

### Danger zone

- transfer;
- withdraw;
- graduate;
- archive;
- merge duplicate.

Never destructive-delete authoritative history.

---

## Page 09 — Guardians and Access

**Route:** proposed `/dashboard/guardians` with student-linked detail routes

**Main job:** Manage guardian identity, relationships, capabilities, and account recovery safely.

### Summary

- unverified links;
- suspended links;
- recovery requests;
- duplicate guardians;
- restricted relationships.

### Table

- guardian;
- linked students;
- relationship;
- capabilities;
- account status;
- verification;
- last sign-in;
- action.

### Detail

- identity/contact;
- relationship evidence;
- capability matrix;
- linked students;
- devices/sessions;
- history.

### High-risk actions

- suspend/revoke link;
- temporary access;
- reset/recovery;
- custody restriction;
- merge duplicate.

Require reason and evidence.

---

## Page 10 — Enrollment and Lifecycle

**Route:** proposed `/dashboard/enrollment`

**Main job:** Manage placement, re-enrollment, transfers, withdrawals, graduation, and history.

### Layout

- workflow tabs by status;
- class/section capacity panel;
- lifecycle queue table;
- bulk preview for promotions or placements;
- exception rail.

### Rules

- academic year is mandatory context;
- capacity warnings cannot be silently bypassed;
- bulk actions require preview and downloadable result;
- no historical enrollment deletion.

---

## Page 11 — Documents, Data Quality, and iEMIS

**Route:** existing admissions/student routes; target hub `/dashboard/students/data-quality`

**Main job:** Fix missing, invalid, duplicate, or export-blocking student data.

### Tabs

- missing documents;
- verification;
- duplicate records;
- iEMIS readiness;
- import jobs;
- export history.

### Main table

- issue;
- affected student;
- severity;
- source;
- owner;
- status;
- next action.

### Import flow

- upload;
- parse;
- validate;
- preview create/update/skip;
- commit;
- result report.

---

## Page 12 — Attendance Overview

**Route:** `/dashboard/attendance`

**Main job:** Ensure attendance is submitted and exceptions are resolved.

### Summary

- submitted sessions;
- not submitted;
- absent/late;
- pending corrections;
- conflicts/anomalies.

### Primary action

Default Admin action: `Review missing submissions`.

`Mark attendance` remains available under More Actions or when the Admin intentionally opens the marking workflow.

### Main layout

- class submission table;
- at-risk/repeated absence panel;
- conflict queue;
- teacher compliance trend;
- correction queue preview.

---

## Page 13 — Attendance Marking and Register

**Routes:** `/dashboard/attendance/mark`, `/dashboard/attendance/register`, `/dashboard/attendance/register/monthly`

**Main job:** Record or inspect authoritative attendance within an explicit class/session scope.

### Layout

- context selector: date, class, section, session;
- roster grid;
- sticky exception summary;
- draft/sync state;
- submit/finalize action bar.

### Admin override

- normal marking and override modes are distinct;
- override requires reason;
- locked sessions display original state and lock owner;
- no browser inference of period authority.

### Monthly register

- BS month/year selector;
- class/section filter;
- scrollable register;
- protected export;
- correction indicators.

---

## Page 14 — Attendance Corrections, Conflicts, and Anomalies

**Routes:** M2 correction, conflict, anomaly, and follow-up routes

**Main job:** Resolve attendance evidence conflicts without overwriting history.

### Queue

- correction requests;
- sync conflicts;
- duplicate records;
- repeated absence;
- unexplained late/early departure;
- missing teacher submission.

### Review detail

- original status;
- requested status;
- source device/session;
- timestamps;
- reason/evidence;
- student and guardian impact;
- approve, reject, return.

### Rule

A correction creates a new audited state. It does not mutate or remove the original event.

---

## Page 15 — Attendance Reports

**Route:** `/dashboard/attendance/reports`

**Main job:** Analyze attendance and produce protected evidence.

### Report families

- daily completion;
- monthly register;
- student history;
- class/grade comparison;
- repeated absence;
- late/early departure;
- corrections;
- teacher submission compliance.

### Design

- report selector left;
- filters and preview center;
- export/action rail right;
- recent snapshots below.

---

## Page 16 — Fees Overview

**Route:** `/dashboard/fees`

**Main job:** Control billing, collections, outstanding balances, adjustments, and cashier close.

### Summary

- billed for selected period;
- collected today;
- outstanding and aging;
- pending adjustments;
- cashier close state;
- unposted finance events.

### Main layout

- collections trend;
- overdue/defaulter queue;
- cashier and payment-method status;
- failed/pending provider events;
- M11 posting readiness.

### Primary action

`Collect payment`.

### More actions

billing, invoices, ledgers, receipts, adjustments, close, reports, setup.

---

## Page 17 — Billing Runs and Invoices

**Routes:** `/dashboard/fees/billing`, `/dashboard/fees/invoices`

**Main job:** Generate and manage fee invoices safely.

### Billing run page

- period and fee-plan selection;
- target population preview;
- exclusions and warnings;
- estimated invoice count and amount from backend;
- validation;
- queue generation;
- job progress and result.

### Invoice register

- server filters;
- invoice table;
- due, paid, outstanding, status;
- detail drawer;
- protected invoice download;
- no destructive invoice deletion.

---

## Page 18 — Collection Counter

**Route:** `/dashboard/fees/collect`

**Main job:** Find the correct payer and confirm one payment without ambiguity.

### Flow

1. search student/invoice;
2. confirm student and guardian/payer;
3. review invoices and allocation;
4. choose payment method;
5. verify amount and reference;
6. confirm;
7. show receipt result.

### Layout

- left: student discovery/context;
- center: invoice allocation;
- right: payment summary;
- sticky confirmation bar.

### Safety

- prevent wrong-student payment;
- warn about overpayment;
- idempotency key;
- no receipt before confirmed backend state;
- no optimistic official balance.

---

## Page 19 — Student Ledger and Receipt Centre

**Routes:** `/dashboard/fees/ledgers`, `/dashboard/fees/receipts`

**Main job:** Explain a student's financial position and verify immutable receipt evidence.

### Ledger

- opening balance;
- invoices;
- waivers/discounts;
- payments;
- refunds/reversals;
- credits;
- closing balance;
- running balance from backend.

### Receipt centre

- receipt number;
- payment;
- payer/student;
- method/reference;
- original/reprint/reversal state;
- protected PDF;
- reprint reason and history.

---

## Page 20 — Adjustments, Refunds, Reversals, and Waivers

**Route:** `/dashboard/fees/adjustments`

**Main job:** Correct financial events without deleting confirmed records.

### Queue tabs

- refund requests;
- reversal requests;
- waivers;
- discounts;
- completed history.

### Review

- original transaction;
- requested correction;
- amount and accounting effect;
- receipt impact;
- policy threshold;
- requester/approver separation;
- reason and attachments.

### Decision

- approve;
- return;
- reject;
- execute only when workflow contract allows.

---

## Page 21 — Cashier Close

**Route:** `/dashboard/fees/cashier-close`

**Main job:** Reconcile expected and actual collection totals for a cashier session.

### Layout

- session selector;
- method totals;
- expected cash;
- refunds/reversals;
- actual cash;
- variance;
- deposit reference;
- supporting documents;
- approval panel.

### Rules

- close becomes immutable;
- reopening is a separate high-risk workflow;
- variance requires explanation;
- printable/protected close report;
- M11 posting status shown after close.

---

## Page 22 — Fees Reports and Setup

**Routes:** `/dashboard/fees/reports`, `/dashboard/fees/setup`

**Reports:** collections, dues, aging, defaulters, payment methods, cashier close, adjustments, receipts, posting status.

**Setup:** fee heads, plans, assignments, installments, discount rules, receipt numbering, methods, approvals.

### Design

- report pages use report selector + filters + preview + snapshots;
- setup pages use structured forms and versioned policy sections;
- high-impact plan changes require impact preview before application.

---

## Page 23 — Academics Overview

**Route:** `/dashboard/academics`

**Main job:** Monitor academic setup, marks completion, results, report cards, and promotion.

### Summary

- active exam terms;
- marks sheets incomplete;
- lock/correction queue;
- result readiness;
- report-card failures;
- promotion decisions pending.

### Main layout

- readiness by term/class;
- workflow list: setup, marks/CAS, results, report cards, promotion;
- exceptions rail;
- publication timeline.

### Primary action

`Open current exam term` or `Create exam term` when none exists.

---

## Page 24 — Academic Structure and Teacher Assignments

**Route:** settings academic structure plus proposed academic assignment hub

**Main job:** Configure classes, sections, subjects, streams, rooms, and teacher assignments.

### Layout

- left navigation by entity;
- main table/editor;
- assignment matrix;
- conflict/coverage side panel;
- effective-date and academic-year context.

### Bulk operations

- import structure;
- assign teachers;
- copy previous year;
- validate;
- preview and commit.

---

## Page 25 — Exam Setup

**Routes:** exam terms and assessment component routes

**Main job:** Configure an exam cycle before marks entry.

### Steps

1. term details;
2. classes/subjects;
3. components and max/pass marks;
4. grading scale;
5. schedule;
6. teacher access;
7. validation;
8. open marks entry.

### Right rail

- missing configuration;
- affected classes;
- marks window;
- audit/version.

---

## Page 26 — Marks and CAS

**Routes:** `/dashboard/academics/marks`, `/dashboard/academics/cas`

**Main job:** Enter, review, validate, and submit marks within a controlled scope.

### Layout

- scope selector;
- spreadsheet grid;
- missing/invalid cells;
- autosave state;
- validation summary;
- submit/lock action bar.

### Admin behavior

- may operate all scopes;
- impersonation is not used;
- changes show actor as Admin;
- editing another teacher's submitted marks requires override mode and reason;
- lock history remains visible.

---

## Page 27 — Results and Publication

**Route:** `/dashboard/academics/results`

**Main job:** Verify calculated results and control audience visibility.

### Summary

- ready;
- blocked;
- withheld;
- awaiting approval;
- published;
- correction pending.

### Main surface

- class/term readiness table;
- blocker drawer;
- result preview;
- publication schedule;
- audience and notification preview;
- publish/withdraw controls.

### Safety

- no client result calculation;
- publication requires readiness confirmation;
- withdrawal requires reason and impact warning;
- parents never see unpublished values.

---

## Page 28 — Report Cards, Promotion, Retakes, and Locks

**Routes:** M4 report-card, promotion, retake, and lock routes

**Main job:** Complete end-of-term academic workflows.

### Report cards

- generation job queue;
- template/version;
- failures;
- protected PDFs;
- regeneration history.

### Promotion

- backend readiness;
- decision queue;
- exceptions;
- next-year placement preview;
- bulk commit report.

### Retakes and locks

- request queue;
- original values;
- evidence;
- approve/return/reject;
- audit.

---

## Page 29 — Activity Feed

**Route:** `/dashboard/activity`

**Main job:** Monitor and manage school-wide activity publishing.

### Summary

- pending moderation;
- consent issues;
- media failures;
- drafts;
- published today;
- reported posts.

### Main surface

- server filters by class, section, category, status, month, author;
- table or editorial list;
- detail drawer;
- quick moderation actions only where safe.

### Primary action

`Create activity`.

---

## Page 30 — Activity Composer

**Route:** `/dashboard/activity/new`

**Main job:** Create a consent-aware school or class activity.

### Form sections

- title and narrative;
- category;
- class/section/student tags;
- media upload and processing;
- consent preview;
- audience;
- schedule;
- notification preview;
- draft/publish/submit for approval.

### Rules

- protected media only;
- no student tag outside allowed scope;
- consent blocks are explicit;
- publish button shows exact audience count.

---

## Page 31 — Moderation, Consent, Milestones, and Activity Reports

**Routes:** M5 moderation, gallery, observations, milestones, deliveries, reports

### Moderation layout

- queue;
- content preview;
- consent and audience evidence;
- decision panel.

### Milestones

- student/class context;
- supportive labels;
- evidence and teacher source;
- history;
- no public comparative rankings.

### Reports

- participation;
- media processing;
- consent exceptions;
- parent delivery;
- moderation turnaround.

---

## Page 32 — Homework Overview

**Route:** `/dashboard/homework`

**Main job:** Monitor homework publishing, workload, completion, and templates school-wide.

### Summary

- due today;
- overdue follow-up;
- unpublished drafts;
- completion exceptions;
- workload conflicts.

### Tabs

- today;
- all;
- completion;
- templates.

### Filters

- branch;
- class;
- section;
- subject;
- teacher;
- status;
- date;
- search.

### Primary action

`Create homework`.

---

## Page 33 — Homework Editor and Review

**Routes:** homework create/detail/review routes

**Main job:** Create, schedule, publish, review submissions, and provide feedback.

### Editor

- assignment scope;
- instructions;
- due date;
- attachments;
- submission method;
- rubric;
- reminders;
- audience preview.

### Review

- submission list;
- student response and files;
- feedback;
- return/resubmit;
- completion status;
- audit.

---

## Page 34 — Timetable Overview

**Route:** `/dashboard/timetable`

**Main job:** Monitor the published timetable, versions, conflicts, requirements, and substitutions.

### Summary

- published version;
- draft versions;
- conflicts;
- uncovered periods;
- substitutions;
- teacher workload exceptions.

### Main surface

- weekly grid;
- filters for year/class/teacher/room;
- local tabs for versions, requirements, conflicts, substitutions.

### Primary action

`New timetable version`.

---

## Page 35 — Timetable Builder and Exceptions

**Routes:** builder, conflicts, substitutions, replacements

### Builder

- draggable or form-based schedule canvas;
- subject/teacher/room palette;
- constraints;
- conflict panel;
- autosave;
- validate;
- compare versions;
- publish.

### Exceptions

- conflicts table;
- eligible substitute suggestions;
- assignment and cancellation;
- impact on teacher/class;
- notification preview.

### Publication

- compare current and proposed;
- unresolved conflicts;
- effective date;
- audience;
- approval if school policy requires.

---

## Page 36 — HR Dashboard

**Route:** `/dashboard/hr`

**Main job:** Monitor staff lifecycle, attendance, leave, contracts, and HR readiness.

### Summary

- active staff;
- on leave;
- pending leave;
- attendance anomalies;
- contracts expiring;
- onboarding/offboarding tasks.

### Main layout

- leave queue;
- contract reminders;
- staff coverage;
- onboarding/offboarding;
- payroll boundary link, not embedded payroll operations.

### Primary action

`Add staff`.

---

## Page 37 — Staff Directory and Profile

**Routes:** `/dashboard/hr/staff`, staff detail routes

### Directory

- search;
- department;
- designation;
- employment status;
- branch;
- contract status;
- document readiness.

### Profile tabs

- overview;
- employment;
- contract;
- qualifications;
- attendance;
- leave;
- salary/payroll;
- documents;
- assignments;
- history.

### Sensitive controls

- salary and bank details masked by default;
- reveal and export reason;
- termination/offboarding in separated danger zone;
- no deletion of employment history.

---

## Page 38 — Contracts, Leave, and Staff Attendance

**Routes:** HR contract, leave, and attendance routes

### Contracts

- active/expiring/probation queues;
- contract editor;
- protected files;
- renewal/termination workflow.

### Leave

- request queue;
- balances;
- staffing impact;
- approve/return/reject;
- calendar.

### Staff attendance

- daily status;
- corrections;
- leave reconciliation;
- payroll handoff readiness.

---

## Page 39 — Payroll Runs

**Routes:** `/dashboard/payroll`, `/dashboard/payroll/runs`, `/dashboard/payroll/readiness`

**Main job:** Prepare, validate, review, approve, post, and pay a payroll period.

### Run stages

```text
Draft
Generated
Under review
Reviewed
Approved
Posted
Paid / settlement recorded
Reversed / corrected
```

### Layout

- run list;
- selected run summary;
- employee exceptions;
- earnings/deductions totals;
- statutory schedule status;
- approval and posting timeline;
- accounting handoff.

### Safety

- backend totals only;
- salary lines are sensitive;
- post and reverse require reason and step-up;
- bank file export is protected and audited;
- legal/statutory verification status is visible.

---

## Page 40 — Payslips and Payroll Reports

**Routes:** `/dashboard/payroll/payslips`, `/dashboard/payroll/reports`

### Payslips

- generation status;
- employee/period filters;
- protected preview/download;
- issue/reissue history;
- delivery status.

### Reports

- payroll register;
- salary expense;
- allowance/deduction;
- payable;
- bank transfer;
- statutory schedules;
- payroll-to-GL reconciliation;
- adjustments/reversals.

Exports require reason, watermark, expiry, and history.

---

## Page 41 — School Operations Hub

**Route:** `/dashboard/operations`

**Main job:** See enabled service-module status and open the correct specialist workspace.

### Layout

- no six-card metric wall;
- one status row for each enabled module;
- critical exceptions;
- setup readiness;
- recent incidents;
- finance handoff status;
- quick links.

### Modules

- Library;
- Transport;
- Canteen.

M13 remains under Academics.

---

## Page 42 — Library Workspace

**Route family:** `/dashboard/library/*`

### Hub summary

- issues today;
- returns today;
- overdue;
- reservations;
- lost/damaged;
- fine review.

### Local pages

- catalog;
- copies/accessions;
- issue/return counter;
- reservations;
- borrowers;
- overdue;
- fines;
- lost/damaged;
- reports;
- settings.

### Design rules

- barcode/QR scanning optimized for counter workflow;
- borrower history is purpose-limited in list views;
- fine waiver is a controlled adjustment;
- archive records, never unsafe deletion.

---

## Page 43 — Transport Workspace

**Route family:** `/dashboard/transport/*`

### Hub summary

- trips today;
- active/delayed/stale;
- unassigned students;
- vehicle/driver document expiry;
- incidents;
- GPS provider status.

### Local pages

- routes/stops;
- vehicles;
- drivers/conductors;
- student enrollment;
- assignments;
- trips;
- boarding/deboarding;
- live status;
- incidents;
- documents/maintenance;
- reports;
- settings.

### Safety

- stale location is never shown as live;
- access to child movement data is audited;
- provider credentials remain Platform-only;
- route changes show affected students and notifications.

---

## Page 44 — Canteen Workspace

**Route family:** `/dashboard/canteen/*`

### Hub summary

- sales today;
- meals served;
- low wallets;
- allergy alerts;
- low stock;
- unsettled sessions/vendor bills.

### Local pages

- menu;
- meal plans;
- enrollments;
- wallets;
- POS;
- serving;
- transactions;
- refunds;
- inventory;
- vendors;
- wastage;
- settlement;
- reports;
- settings.

### Safety

- allergy alerts override module branding;
- wallet and POS corrections are audited;
- serving and payment are separate states;
- finance handoff is visible.

---

## Page 45 — Finance and Accounting Dashboard

**Route:** `/dashboard/accounting`

**Main job:** Control the complete school financial position and accounting readiness.

### Summary

- fiscal period status;
- pending journal/voucher approvals;
- unreconciled bank items;
- receivables/payables;
- source posting issues;
- report readiness.

### Main layout

- financial control exceptions;
- recent journals;
- cash/bank position;
- posting batches;
- report shortcuts;
- fiscal status rail.

### Primary action

`Create voucher` with type selection.

---

## Page 46 — Chart of Accounts and Fiscal Management

**Routes:** account and fiscal-period routes

### Chart of accounts

- hierarchical table;
- account code/name/type;
- parent;
- normal balance;
- active state;
- branch/cost center;
- source mappings;
- change history.

### Fiscal management

- years and periods;
- status;
- open/lock/close/reopen;
- checks;
- prior period effect;
- approval timeline.

### Safety

- posted accounts cannot be destructively removed;
- reopen is highest-risk with step-up and dual approval option;
- opening balances use a controlled import and reconciliation report.

---

## Page 47 — Journals and Vouchers

**Route:** `/dashboard/accounting/journals` and voucher routes

### List

- entry number;
- date;
- type;
- narration;
- debit/credit;
- source;
- status;
- creator/approver;
- action.

### Editor

- voucher type;
- date and period;
- balanced lines;
- cost center/branch;
- narration;
- attachments;
- validation;
- submit.

### Review

- source lineage;
- accounting lines;
- supporting documents;
- policy checks;
- approve/reject/post/reverse.

No destructive edit after posting.

---

## Page 48 — Cash, Bank, and Reconciliation

**Routes:** `/dashboard/accounting/cash-bank`, `/dashboard/accounting/reconciliation`

### Cash and bank

- account selector;
- opening/movement/closing;
- cash book/bank book;
- transfers;
- deposit pending;
- cheque status.

### Reconciliation

- bank statement import;
- suggested matches;
- unmatched ledger and statement rows;
- adjustments;
- difference summary;
- reviewer/approver;
- finalize.

### Rules

- imported statement rows are immutable evidence;
- matching is reversible before finalization;
- finalization and reopening are audited high-risk actions.

---

## Page 49 — Receivables, Payables, Expenses, and Source Postings

**Routes:** M11 receivable, payable, payroll-handoff, source-mapping, and posting-batch routes

### Receivables

- student ledger and aging;
- collection linkage;
- unallocated payments;
- M3 posting status.

### Payables/expenses

- vendors;
- bills;
- advances;
- expense vouchers;
- aging;
- payment status;
- supporting documents.

### Source posting

- M3, M7, M8, M9, M10 batches;
- idempotency key;
- accepted/rejected/unposted;
- mapping issue;
- retry with reason;
- journal link.

---

## Page 50 — Financial Reports and Accounting Audit

**Routes:** accounting report routes and `/dashboard/accounting/audit`

### Reports

- trial balance;
- general ledger;
- cash book;
- income and expenditure;
- balance sheet;
- cash flow;
- budget versus actual;
- receivables/payables;
- tax/statutory schedules where verified;
- branch and cost-center reports.

### Drill path

```text
Statement
-> line
-> account
-> ledger
-> journal/voucher
-> source event
-> approval
-> protected evidence
-> audit event
```

### Audit

- manual journals;
- backdated entries;
- reversals;
- period reopen;
- segregation conflicts;
- unusual transactions;
- supporting-document exceptions;
- user access.

---

## Page 51 — Notices Centre

**Route:** `/dashboard/notices`

**Main job:** Manage the complete official notice lifecycle.

### Summary

- drafts;
- approval pending;
- scheduled;
- delivery failures;
- acknowledgement overdue;
- corrections/withdrawals.

### Main surface

- lifecycle tabs;
- server filters;
- notice table;
- recipient scope;
- status;
- schedule;
- delivery/acknowledgement summary;
- action.

### Primary action

`Create notice`.

---

## Page 52 — Notice Composer and Lifecycle Detail

**Routes:** `/dashboard/notices/new`, notice detail routes

### Composer

- title/content;
- category/priority;
- audience builder;
- exact recipient preview;
- attachments;
- schedule;
- acknowledgement;
- channel preview;
- approval route;
- save/submit/publish.

### Detail

- lifecycle timeline;
- versions;
- recipients;
- delivery;
- acknowledgements;
- correction/replacement;
- withdrawal/archive;
- audit.

### Safety

- never label queued as delivered;
- urgent audience and impact confirmed before publish;
- correction links original and replacement.

---

## Page 53 — Delivery and Failure Centre

**Routes:** notice delivery and failure routes

**Main job:** Diagnose tenant-side delivery problems and retry safely.

### Summary

- failed;
- delayed;
- retrying;
- provider unavailable;
- unacknowledged critical;
- callback exceptions.

### Table

- notice/event;
- recipient/channel;
- lifecycle state;
- provider-safe error category;
- attempt count;
- last attempt;
- next action.

### Controls

- retry selected;
- cancel scheduled;
- switch approved fallback where policy allows;
- export diagnostics;
- escalate to SchoolOS support.

Provider credentials and raw secrets are never displayed.

---

## Page 54 — Notifications Inbox

**Route:** `/dashboard/notifications`

**Main job:** Read the Admin user's own operational notifications.

### Layout

- unread/read/all tabs;
- severity filters;
- module filters;
- compact inbox list;
- right detail panel;
- safe deep link;
- mark read/archive.

This is personal inbox state, not the tenant delivery console.

---

## Page 55 — Learning Overview

**Route:** `/dashboard/learning`

**Visibility:** enabled and release-gated only.

### Summary

- active activities;
- live/upcoming sessions;
- attempts awaiting review;
- low participation;
- resource/file failures.

### Main layout

- activities;
- sessions;
- participation/progress;
- resource administration;
- policy and retention status.

### Primary action

`New learning activity`.

---

## Page 56 — Learning Activity, Session, Attempts, and Progress

**Route family:** `/dashboard/learning/*`

### Activity editor

- title/instructions;
- resources;
- assigned scope;
- access/session settings;
- schedule;
- publish/launch.

### Session console

- access code/status;
- participants;
- progress;
- pause/close;
- no public ranking.

### Review

- attempts;
- responses;
- feedback;
- completion;
- supportive progress summary;
- protected files.

---

## Page 57 — Reports and Exports

**Route:** `/dashboard/reports`

**Main job:** Configure, generate, track, and download every permitted school report.

### Layout

- left: grouped report catalogue;
- center: report description, filters, and preview;
- right: output format and export options;
- bottom: recent exports/jobs.

### Required categories

- students/admissions;
- attendance;
- fees;
- academics;
- activity;
- homework/timetable;
- HR/payroll;
- Library/Transport/Canteen/Learning when enabled;
- accounting/finance;
- communication;
- governance/audit.

### Export controls

- synchronous only for small bounded output;
- background job for large output;
- reason for sensitive exports;
- watermark/classification;
- protected download;
- checksum and generation history;
- expiry/revocation.

---

## Page 58 — School Audit

**Route:** proposed `/dashboard/audit`

**Main job:** Search tenant-wide change and decision evidence.

### Filters

- date/time;
- actor;
- role;
- branch;
- module;
- entity;
- action;
- risk;
- request/correlation ID;
- reason present/missing;
- export.

### Table

- time;
- actor;
- action;
- entity;
- module;
- result;
- risk;
- source.

### Detail drawer

- before/after;
- reason;
- approval chain;
- source event;
- IP/device where policy permits;
- linked protected evidence;
- downstream events;
- checksum/correlation.

### Rules

- audit events are immutable;
- Admin may view tenant audit but cannot alter it;
- platform audit remains Platform-only;
- sensitive values follow masking rules.

---

## Page 59 — Settings Overview

**Route:** `/dashboard/settings`

**Main job:** Understand school configuration readiness and open the correct setting domain.

### Header

- Title: `School Settings`
- Description: `Configure this school. Platform plans and provider secrets are managed by SchoolOS.`

### Layout

- readiness summary;
- grouped settings navigation from backend;
- incomplete/blocked items;
- recent changes;
- pending approvals;
- owner/delegation status;
- safe integration status.

### Groups

- School Setup;
- Academic & Student Policy;
- Finance & Administration;
- Communication & Documents;
- People & Governance;
- Enabled Module Settings.

---

## Page 60 — School Identity, Branding, Calendar, and Academic Structure

**Routes:** school setup settings routes

### Identity

- official name;
- registration;
- address and Nepal administrative hierarchy;
- contacts;
- branch information;
- school type;
- verification/status.

### Branding

- protected logo;
- document header/footer;
- colors within accessibility rules;
- receipt/report-card/notice preview.

### Calendar

- BS/AD academic year;
- terms;
- working days;
- holidays;
- closures;
- copy/rollover.

### Structure

- classes;
- sections;
- subjects;
- streams/programs;
- rooms;
- capacity;
- version/effective year.

---

## Page 61 — Policies, Modules, Integrations, and Documents

**Routes:** policy, module, integration, and document-template settings routes

### Policies

- admissions;
- attendance;
- exams/report cards;
- homework/timetable;
- activity/consent;
- fees;
- accounting;
- HR/payroll;
- communication;
- security.

Each policy page shows:

- current effective values;
- impact;
- last changed by;
- effective date;
- validation;
- draft/save/apply;
- approval requirement;
- audit history.

### Modules

- enabled/disabled;
- configuration readiness;
- entitlement owner: SchoolOS Platform;
- request support/action, not a fake toggle.

### Integrations

- connection status;
- last successful event;
- tenant-safe error;
- test action where safe;
- support escalation;
- no secrets.

### Documents

- templates;
- numbering;
- branding preview;
- protected file defaults;
- version history.

---

## Page 62 — Users, Roles, Permissions, and Security

**Routes:** users, roles, and security settings routes

### Users

- name/email;
- staff link;
- roles;
- status;
- last sign-in;
- must-change-password;
- active sessions;
- action.

### User detail

- account;
- staff/person link;
- roles;
- permissions summary;
- sessions/devices;
- security events;
- reset/suspend/reactivate;
- history.

### Roles

- system/custom role;
- assigned users;
- permission domains;
- risky permission warnings;
- compare roles;
- create/clone;
- assignment impact preview.

### Security

- session duration;
- step-up policy;
- masking/reveal policy;
- export policy;
- password policy;
- owner safeguards;
- suspicious session review.

### Rules

- Admin cannot grant Platform permissions;
- `platform:*` permissions never appear in school role editor;
- removing the last active Configuration Owner is blocked;
- risky grants require confirmation and audit;
- role changes show affected users before apply.

---

## Page 63 — Personal Account

**Routes:** `/dashboard/settings/personal/*`

### Pages

- profile;
- notification preferences;
- security/password;
- sessions/devices;
- appearance/language.

### Rules

- personal settings remain separate from school settings;
- changing the Admin's own role is not available here;
- password and session actions require re-authentication where appropriate;
- biometric configuration belongs to supported mobile personas, not Admin web.

---

# 9. Cross-Page Interaction Standards

## 9.1 Header actions

- One primary action.
- Maximum five secondary actions under More Actions.
- Destructive actions never in the primary position.
- Current scope/context visible near title.

## 9.2 Filters

- Server-backed for growing datasets.
- URL-backed when shareable.
- Active filter chips.
- Reset action.
- Filter state preserved through detail navigation.
- No silent client truncation presented as complete results.

## 9.3 Tables

- Sticky header on long tables.
- Server pagination.
- Column visibility based on permission and screen size.
- Names/statuses readable; money right-aligned.
- Row primary action is open/review.
- Secondary actions in menu.
- Bulk actions require explicit selection and preview.

## 9.4 Drawers

Use drawers for:

- record preview;
- quick evidence review;
- non-destructive edit;
- approval detail on wide screens.

Use full pages for:

- complex creation;
- financial transaction editing;
- student/staff profiles;
- multi-step workflow;
- high-risk decision.

## 9.5 Loading and partial data

- Preserve page header and filters.
- Skeleton matches final layout.
- Existing data remains visible during refresh.
- Partial data identifies affected sections.
- Do not collapse unavailable to zero.

## 9.6 Empty states

Explain:

- why empty;
- whether filters caused it;
- whether module setup is incomplete;
- one safe next action.

## 9.7 Errors

- School-friendly message.
- Retry.
- Preserve filters and unsaved safe drafts.
- No raw stack/provider/database detail.
- Financial and lifecycle errors state that no authoritative record was changed.

## 9.8 Protected files

- File Registry-backed.
- Explicit file type and classification.
- Permission check at click time.
- Loading/error state.
- No permanent public URL.
- Export history and expiry.

---

# 10. High-Risk Action Design

All high-risk Admin actions use the same five-stage pattern.

```text
1. Review context
2. Review impact
3. Provide reason/evidence
4. Confirm or step up
5. Receive immutable result and audit reference
```

### Required impact summaries

| Action | Impact summary |
|---|---|
| Student withdrawal | enrollment, attendance, fees, transport, library, parent access |
| Guardian restriction | linked children, capabilities, sessions, notifications |
| Bulk attendance correction | students, dates, original/new states, parent alerts |
| Refund/reversal | payment, receipt, ledger, accounting journal, payer notification |
| Payroll post/reverse | staff totals, liabilities, accounting, payslips, bank export |
| Result publish/withdraw | classes, students, parent visibility, report cards, notifications |
| Timetable publish | classes, teachers, rooms, substitutions, notifications |
| Fiscal reopen | affected reports, entries, approvers, re-lock requirement |
| Role change | users affected, newly granted sensitive capabilities |
| Notice withdrawal | recipients, delivery state, replacement/correction plan |
| Sensitive export | records, columns, classification, expiry, watermark |

---

# 11. Accessibility

- Keyboard access for all navigation, filters, tabs, tables, drawers, and dialogs.
- Visible focus.
- Status is not communicated by color alone.
- Table headers and row actions have proper semantics.
- Dialog focus trap and return focus.
- Screen-reader announcement for save, queued job, partial failure, and approval results.
- 44 px minimum touch target for critical mobile/narrow controls.
- Charts have summaries and accessible data tables.
- Nepali and English text use correct font fallback and line height.
- Reduced motion respected.

---

# 12. Performance and Data Rules

- Dashboard receives bounded server summaries.
- Growing lists use server filtering and pagination.
- Detail queries load only after selection where appropriate.
- Avoid duplicate context queries across modules.
- Query keys include tenant, branch, academic/fiscal context where material.
- Prefetch only safe likely next routes.
- Official totals never derived from partially loaded browser lists.
- Long exports and generation jobs use queued state.
- Realtime updates are used only where operationally valuable and safely scoped.

---

# 13. Final Admin Design Principle

```text
Give the Admin complete school authority.
Organize that authority into focused module workspaces.
Make high-risk actions harder, not hidden.
Keep the Platform completely separate.
```