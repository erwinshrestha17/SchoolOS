# SchoolOS Web Design — Astra Frontend Design & Execution Playbook

## Authority

This file is the **scoped Web design and frontend execution playbook** for SchoolOS.

It applies to:

- `apps/web`
- tenant-facing SchoolOS web UX
- SchoolOS Platform web UX when explicitly in scope
- Web design-system, accessibility, responsiveness, interaction architecture, and visual QA work

This file is **not** an independent repository source of truth.

`AGENTS.md` remains authoritative for product scope, Nepal-only roadmap boundaries, personas and access boundaries, module status, tenant isolation, authentication/authorization, finance/accounting integrity, compliance, protected data, offline boundaries, backend authority, and release/verification policy.

If this file conflicts with `AGENTS.md`, **`AGENTS.md` wins**.

---

# 1. Purpose

Guide Astra/Codex when auditing, redesigning, implementing, and verifying the SchoolOS web application.

The goal is not to preserve the current visual treatment. The goal is to make SchoolOS feel like a **serious, coherent, fast, high-trust school operating system** for daily work.

When an explicit SchoolOS Web redesign is in scope:

- the existing backend, contracts, permissions, routes, data model, and business rules remain authoritative;
- the existing visual design is **not** authoritative;
- Astra MAY substantially replace page composition, shell presentation, navigation presentation, design primitives, layout, typography, spacing, table treatment, filters, forms, drawers, and interaction patterns;
- Astra SHOULD preserve working application behavior unless the existing interaction model itself is the problem;
- do not introduce a parallel frontend framework or duplicate design system when the current stack can support the redesign.

This is a **presentation and interaction redesign**, not a rewrite of SchoolOS.

---

# 2. Web Product Role

Web is the primary surface for:

- dense operational work;
- configuration;
- high-volume tables;
- bulk operations;
- detailed corrections;
- approvals and governance;
- reporting and exports;
- financial operations;
- HR/payroll operations;
- audit and compliance work;
- complex scheduling and planning.

Do not redesign Web as a large mobile app.

Mobile remains the preferred surface for frequent, time-sensitive, one-handed workflows as defined by `AGENTS.md` and `SCHOOLOS_APP_DESIGN_ASTRA.md`.

---

# 3. Current Frontend Stack

SchoolOS Web currently uses:

- Next.js;
- React;
- TypeScript;
- Tailwind CSS;
- Radix UI;
- Lucide icons;
- Motion;
- React Query;
- React Hook Form;
- Zod;
- Playwright.

Use these foundations unless an explicit technical task authorizes a replacement.

Prefer one coherent component system over overlapping UI stacks.

---

# 4. Design Direction

SchoolOS Web should feel:

- calm;
- precise;
- modern;
- operational;
- information-efficient;
- institutionally credible;
- fast to scan;
- consistent across modules;
- dense where the work requires density;
- visually restrained.

The visual target is **modern productivity software**, not a marketing site and not a generic ERP skin.

## 4.1 Visual principles

Prefer:

- neutral page canvas;
- white or near-white working surfaces;
- restrained SchoolOS primary accent;
- semantic status colors only;
- thin borders and dividers;
- moderate radius;
- minimal shadows;
- strong typography hierarchy;
- dense but breathable tables;
- clear focus states;
- consistent iconography;
- meaningful whitespace rather than excessive whitespace.

Avoid excessive:

- gradients;
- glassmorphism;
- glowing borders;
- giant rounded cards;
- nested cards;
- oversized page titles;
- decorative KPI grids;
- random module colors;
- giant illustrations inside operational pages;
- meaningless charts;
- floating decorative UI;
- animation that slows task completion.

Do not turn every data point into a card.

---

# 5. Astra Web Redesign Execution Sequence

For broad Web redesign work:

```text
Read AGENTS.md
    ↓
Read this playbook
    ↓
Inspect real routes, layouts, components, API calls, permissions, and tests
    ↓
Map the persona + module + highest-frequency workflow
    ↓
Run the application and inspect rendered screens
    ↓
Define the target workspace pattern
    ↓
Refine shared design-system primitives
    ↓
Migrate the highest-value flow first
    ↓
Verify loading / empty / error / permission states
    ↓
Verify responsive + keyboard + accessibility behavior
    ↓
Run targeted tests/typecheck/lint/build
    ↓
Re-render and compare
```

Do not start broad redesigns by randomly changing CSS page by page.

---

# 6. Core Interaction Architecture

The Web UX should move away from:

```text
Module directory
→ choose module
→ choose sub-page
→ find record
→ perform task
```

toward:

```text
Persona context
→ current priority / record / task
→ direct action
→ deeper workspace only when needed
```

The sidebar remains useful, but it must not be the only way to operate SchoolOS.

---

# 7. Application Shell

The shell should provide:

- school identity;
- active academic year;
- active branch when applicable;
- persona/role context;
- grouped primary navigation;
- global command search;
- persona-aware quick actions;
- notifications;
- user/security menu;
- breadcrumbs/context;
- responsive collapse;
- entitlement/module state.

## 7.1 Navigation hierarchy

Avoid an endless flat sidebar.

Prefer high-level groupings such as:

```text
Overview

People
  Students
  Admissions
  Staff

Academics
  Attendance
  Academics
  Homework
  Timetable
  Activities

Finance
  Fees & Receipts
  Accounting
  Payroll

Communication
  Notices
  Notifications

Operations
  Library
  Transport
  Canteen

Insights
  Reports
  Audit

Settings
```

The exact groups and visible destinations MUST be persona-, permission-, capability-, and entitlement-aware.

Specialist sub-functions belong inside their module workspace rather than all being exposed permanently in the global sidebar.

---

# 8. Global Command Search

SchoolOS Web SHOULD provide an authorization-aware command/search surface, preferably available through `Cmd+K` / `Ctrl+K`.

It may search permitted:

- students;
- guardians;
- staff;
- classes/sections;
- admissions;
- invoices;
- receipts;
- notices;
- requests;
- reports;
- operational destinations.

It may expose permitted contextual actions such as:

- take attendance;
- add student;
- create admission;
- create homework;
- enter marks;
- collect payment;
- create notice;
- open reconciliation;
- run a report.

Rules:

- search visibility never grants authorization;
- server-backed entity search must remain tenant- and permission-scoped;
- results should be grouped by type;
- keyboard navigation should be first-class;
- recent searches/records may be shown only when still authorized.

---

# 9. Persona-Aware Quick Actions

Provide a small, controlled quick-action system.

### Teacher
- Take attendance
- Create homework
- Enter marks
- Record activity/observation

### Admin
- Add student
- Start admission
- Create notice
- Open service request

### Accountant / Cashier
- Collect payment
- Find invoice
- Open cashier close
- Start reconciliation

### HR
- Add staff
- Review leave
- Open payroll readiness

### Principal
- Review approvals
- Open attention items
- Publish approved notice

Do not create a universal “create everything” menu.

---

# 10. Persona Experience Targets

## 10.1 Teacher — task density

Teacher Web should feel like a teaching workspace, not an Admin interface with hidden permissions.

Home should prioritize:

- current/next class;
- today's timetable;
- attendance due;
- homework needing review;
- missing marks;
- substitutions;
- returned work/corrections;
- assigned students/classes.

Common daily tasks should generally be reachable in **1–3 meaningful interactions** from the relevant teacher workspace.

## 10.2 Principal — decision density

Principal Web should prioritize:

- critical attention;
- approvals;
- attendance exceptions;
- academic readiness;
- finance exceptions;
- staff absence impact;
- communication failures;
- school readiness.

The Principal should not be forced through configuration-heavy Admin workspaces for routine oversight.

## 10.3 Admin — operational density

Admin Web may remain dense.

Prioritize:

- admissions and student operations;
- school-wide attendance completion;
- academic administration;
- fee operations where authorized;
- staff operations;
- communication;
- reports;
- configuration readiness.

Use tables, bulk actions, filters, validation queues, and exception workspaces.

## 10.4 HR — workforce density

Prioritize:

- staff lifecycle;
- attendance;
- leave;
- contracts;
- payroll readiness;
- staff documents;
- exceptions and expiry.

## 10.5 Accountant — numerical density

Prioritize:

- collections;
- outstanding balances;
- reconciliation;
- journals;
- payables/receivables;
- posting failures;
- payroll handoff;
- period status;
- financial statements and drill-down.

Numeric alignment and traceability matter more than decorative presentation.

---

# 11. Shared Workspace Patterns

Not every SchoolOS module should look the same. Use the pattern that matches the work.

## 11.1 Data Workspace

For Students, Staff, Admissions lists, Invoices, Receipts, Requests, Audit, etc.

Standard capability set:

- search;
- visible high-frequency filters;
- advanced filters;
- active filter chips;
- saved views where useful;
- sort;
- column visibility;
- density;
- pagination;
- bulk selection/actions where valid;
- export when authorized;
- contextual row actions;
- refresh/last-updated state;
- empty/loading/error states.

## 11.2 Entity 360 Workspace

For a student, staff member, admission case, tenant, or other major entity.

Use:

```text
Identity header
Status + key context
Primary actions
Tab/section navigation
Core details
Related operational records
History / audit where permitted
```

Prefer one coherent record workspace over forcing users through separate modules to understand one person.

## 11.3 Queue / Triage Workspace

For approvals, anomalies, corrections, failed deliveries, duplicates, pending reviews.

Use:

- severity/status;
- owner;
- age/deadline;
- filters;
- list + contextual inspector;
- clear approve/return/reject/resolution actions;
- evidence/reason context.

## 11.4 Ledger / Reconciliation Workspace

For finance/accounting.

Use dense, aligned data with:

- debit/credit/amount columns;
- running balances;
- source references;
- status;
- reconciliation state;
- drill-down lineage;
- side-by-side matching where appropriate.

## 11.5 Schedule / Grid Workspace

For timetable and similar planning.

Use:

- time/resource grid;
- sticky headers;
- conflict highlighting;
- drag/drop only when safe and accessible;
- keyboard alternative;
- version state;
- unsaved/change indicators;
- conflict side panel.

## 11.6 Composer / Publication Workspace

For notices, activities, homework, report publication.

Use:

- content/edit area;
- audience/context;
- attachments;
- schedule;
- preview;
- validation/readiness;
- publication state;
- approval state.

---

# 12. Student 360 Standard

The student record should become one of the strongest SchoolOS Web experiences.

Recommended information architecture:

```text
Student identity header
Grade / section / roll / status
Guardian summary
Primary actions

Overview
Profile
Guardians
Attendance
Academics
Fees
Homework
Activities
Documents
Requests
History
```

Only authorized sections appear.

Examples:

- Teacher: Overview, Attendance, Academics, permitted Guardian contact.
- Accountant: Overview, Fees, payer/receipt context.
- Admin: full authorized operational record.
- Principal: oversight-oriented read/approve views.

Do not duplicate canonical data across modules to create this experience; compose authorized projections from existing sources.

---

# 13. Module-Specific Web Design Blueprint

This section defines **target interaction patterns**, not authorization grants or activation decisions.

## M0 — Platform Core / School Settings

### Current feature families
Platform control plane, schools/tenants, operations, billing, audit, account security, settings; tenant settings include academic calendar/structure, access, admissions, attendance, accounting, communication, branding/documents, audit/data operations and other school configuration.

### Target design
Use two visibly distinct surfaces:

**Platform control plane**
- operations-console character;
- tenant table + tenant inspector;
- platform health/queue/provider status;
- audit/security timeline;
- billing/entitlement state;
- support-access state clearly marked;
- stronger visual distinction from school tenant UI.

**School Settings**
- settings hub grouped by domain;
- searchable settings;
- readiness/completeness indicators;
- change history;
- explicit save state;
- impact warnings for high-risk changes;
- avoid one giant settings form.

Settings should feel like controlled configuration, not a normal operational module.

---

## M1 — Admissions & Student Profiles

### Current feature families
Students list/detail/overview plus Admissions applications, cases, assessments, documents, duplicate review, IEMIS, QR, new application and review workflows.

### Target design

**Admissions Home**
- funnel/status summary;
- applications requiring review;
- incomplete documents;
- duplicate risks;
- capacity/waitlist signals where available;
- direct “new application” action.

**Application/Case Review**
Use a split workspace:

```text
Applicant/case list | Application detail
                    | Checklist
                    | Documents
                    | Assessment
                    | Decision history
```

Keep review actions visible but separated from destructive/irreversible decisions.

**Students**
Use a dense searchable Data Workspace.

**Student detail**
Use the Student 360 standard.

**Duplicate Review**
Use a side-by-side comparison workspace showing exact conflicting fields and merge consequences.

**IEMIS**
Use a data-quality/readiness workspace:
- completeness score/status;
- errors grouped by field/category;
- affected records;
- validation detail;
- export batch history;
- clear distinction between “SchoolOS ready” and “government submitted”.

---

## M2 — Smart Attendance

### Current feature families
Overview, marking, registers, sessions, anomalies, corrections, follow-ups, offline drafts, reports and student attendance views.

### Target design

**Teacher attendance**
This is a focused action workspace, not a dashboard.

```text
Class/period context
Roster
Mark all present
Exception controls
Draft/submitted/locked state
Primary submit action
```

Optimize normal attendance for very low interaction count.

**Admin/Principal Attendance Command Centre**
- today's completion progress;
- missing class/period submissions;
- unusual absence/lateness;
- correction queue;
- follow-up queue;
- class/grade drill-down.

**Corrections**
Queue/triage design with original value, requested value, reason, requester, approver and audit lineage.

**Anomalies**
Risk/exception list, not decorative charts.

**Reports**
Calendar/register/table-first with print/export readiness.

Never visually imply that an offline/local draft is final attendance.

---

## M3 — Fees & Receipts

### Current feature families
Billing, collection, invoices, receipts, ledgers, adjustments, cashier close, reports and setup.

### Target design

**Fees Home**
- collections today;
- outstanding/overdue;
- pending reconciliation;
- failed/unposted events;
- cashier status;
- actionable exceptions.

**Collect Payment**
Design as a dedicated transaction workspace:

```text
Student/payer search
→ outstanding invoices
→ selected allocation
→ amount/payment method
→ confirmation
→ receipt result
```

Keep the student identity, amount, payment method and allocation visible before confirmation.

**Student Fee Ledger**
Dense chronological financial workspace with invoice/payment/refund/reversal lineage.

**Invoices / Receipts**
Table + right-side inspector for routine review; full detail for complex records.

**Adjustments / Refunds / Reversals**
Use explicit consequence summaries and reason/evidence fields. Never hide original transaction lineage.

**Cashier Close**
Reconciliation-focused layout: expected vs actual, method totals, differences, unresolved items, approval state.

Avoid consumer-fintech styling; prioritize precision and auditability.

---

## M4 — Academics, Exams, CAS & Report Cards

### Current feature families
Assessment components, exam terms, CAS, marks, locks, readiness, results, publishing, report cards, promotion, retakes, board readiness and learning-improvement views.

### Target design

**Academics Home**
Show readiness and deadlines rather than generic KPIs:
- marks completion;
- missing/invalid submissions;
- locked/unlocked state;
- publication readiness;
- report generation failures;
- promotion/retake exceptions.

**Teacher Marks Entry**
Spreadsheet-style grid is appropriate:
- sticky student identity;
- keyboard navigation;
- clear max/pass/component context;
- autosave/draft state;
- validation inline;
- submit state clearly separated from save.

**Exam Administration**
Use lifecycle/step navigation:
Setup → Entry → Review → Lock → Publish → Correct.

**Readiness**
Use a class/subject matrix so missing work is immediately visible.

**Publishing**
Treat as a controlled release workspace with impact summary, recipient scope, blocking issues, approval state and confirmation.

**Results / Report Cards**
Student-level result detail should be readable and printable; admin views should support batch status and regeneration/version history.

Do not use charts where a completion matrix or exception table is more actionable.

---

## M5 — Activity Feed & Milestones

### Current feature families
Activity posts, post detail, gallery, deliveries, milestones, observations, moderation, oversight and reports.

### Target design

**Teacher Activity Workspace**
Composer + recent own posts + drafts.

**Composer**
- audience;
- assigned students;
- media;
- consent state;
- milestone/observation context;
- preview;
- publish/submit-for-review state.

**Feed**
Use restrained content cards only where the content object genuinely benefits from card presentation.

**Gallery**
Media-first grid with consent/scope metadata available on inspection.

**Moderation**
Queue/triage pattern with reported/sensitive context, audience, media and decision reason.

**Milestones / Observations**
Student/class-scoped timeline or structured list, not social-media gamification.

---

## M6 — Homework & Timetable

### Homework feature families
Homework list, create, detail and review.

### Homework target design

**Teacher Homework Workspace**
- assigned classes/subjects;
- drafts;
- upcoming;
- due;
- review needed;
- overdue/completion context.

**Create Homework**
Focused composer: class/subject → instructions → attachments → due date → submission method → preview → publish/schedule.

**Review**
Submission queue with student list and contextual inspector for quick feedback.

### Timetable feature families
Timetable, builder, conflicts, substitutions, replacements, versions and workload.

### Timetable target design

**Timetable Viewer**
Calendar/grid first, filters for class/teacher/room.

**Builder**
True scheduling workspace:
- schedule grid;
- unscheduled items;
- teacher/room context;
- conflict side panel;
- workload indicator;
- version state.

**Conflicts**
Dedicated queue with direct jump to the affected slots.

**Substitutions/Replacements**
Today-oriented operational queue with absent teacher, impacted periods, eligible replacements and acknowledgement state.

**Versions**
Compare, review, publish and archive without losing context.

---

## M7 — HR & Payroll

### HR feature families
Overview, staff, contracts, attendance, leave and teacher development.

### Payroll feature families
Salary structures, payroll readiness, runs, payslips and reports.

### Target design

**HR Home**
- present/absent/leave;
- pending leave;
- expiring contracts;
- missing staff data/documents;
- payroll readiness issues;
- staff lifecycle attention.

**Staff**
Dense directory + Staff 360: Overview, Employment, Contracts, Attendance, Leave, Payroll access where authorized, Documents, History.

**Contracts**
Expiry/renewal queue with clear dates and actions.

**Leave**
Calendar + request queue; avoid card-per-request when volume is high.

**Payroll Readiness**
Checklist/exception workspace before any run can progress.

**Payroll Run**
Use a controlled step/lifecycle interface: Prepare → Validate → Review → Approve → Finalize → Post.

**Payslips**
Batch state plus individual employee detail/download.

Salary and bank information must remain visually and permission-wise protected.

---

## M8 — Library

M8 may remain deferred under `AGENTS.md`; this design applies only when explicitly in scope.

### Current feature families
Books, catalogue, copies, borrowers, issue/return, issues, reservations, overdue, fines and reports.

### Target design

**Circulation Desk**
Scanner/keyboard-first transaction workspace: Borrower → scan/search copy → due status → issue/return.

**Catalogue**
Search-first list with availability and copy count.

**Book/Resource Detail**
Bibliographic detail + copy inventory + circulation status.

**Overdue/Fines**
Queue/table design with borrower, due date, age, amount and resolution.

**Reservations**
Queue ordered by availability/waitlist rules.

Avoid ornamental book-card grids for staff workflows.

---

## M9 — Transport

M9 may remain deferred under `AGENTS.md`; this design applies only when explicitly in scope.

### Current feature families
Routes, assignments, students, vehicles, trips, live status, location and reports.

### Target design

**Transport Operations**
Use a two-mode workspace:

```text
Live / Today
Routes / Setup
```

**Live**
- active trips;
- delay/incident state;
- stale/unavailable GPS state;
- vehicle/driver context;
- map only when it improves operational understanding.

**Routes**
Route/stop list + route detail; map and ordered stop sequence should work together.

**Assignments**
Student-route assignment table with bulk assignment where safe.

**Vehicles**
Fleet table with document/maintenance status.

**Trips**
Timeline/status table with route, vehicle, driver, start/end and exception state.

Never imply real-time location when data is stale.

---

## M10 — Canteen

M10 may remain deferred under `AGENTS.md`; this design applies only when explicitly in scope.

### Current feature families
Controls, enrollments, menu, meal plans, plans, POS, serving, wallets, inventory/stock, vendors and reports.

### Target design

**POS**
High-speed transaction surface with large actionable controls, student/account identification, allergy warning, basket, total and clear completion state.

**Serving**
Queue/scan workflow; prioritize entitlement and allergy safety over decoration.

**Menu / Meal Plans**
Structured planner/editor.

**Wallets**
Transaction-ledger pattern with balance and adjustment lineage.

**Inventory / Stock**
Dense table + low-stock/expiry exceptions.

**Vendors**
Standard procurement/vendor workspace.

Do not make back-office canteen operations look like a consumer food-ordering app.

---

## M11 — Accounting & Finance

### Current feature families
Accounts/chart of accounts, journals, cash/bank, budgets, collections, fiscal periods, payables, receivables, reconciliation, payroll handoff, management and audit.

### Target design

Accounting should have the highest information density in SchoolOS.

**Accounting Home**
- cash/bank position;
- unreconciled items;
- unposted journals;
- receivables/payables attention;
- period status;
- posting failures;
- financial reporting shortcuts.

**Chart of Accounts**
Hierarchical table/tree with account code, type, status and balance context.

**Journals**
Dense journal register + journal inspector; debit and credit must align clearly.

**Journal Entry**
Balanced-entry editor with live debit/credit totals and explicit validation.

**Cash & Bank**
Account-level ledgers with running balance.

**Reconciliation**
Split-pane matching workspace: bank statement items ↔ SchoolOS ledger items, with matched/unmatched state.

**Receivables / Payables**
Aging-first operational tables.

**Fiscal Periods**
Timeline/status view with lock/reopen state and consequences.

**Reports**
Every statement must drill down: Statement → line → account → ledger → journal/voucher → source transaction → approval/document.

Avoid large decorative cards and pie-chart dashboards.

---

## M12 — Notifications & Delivery

### Current feature families
Notification center/preferences plus deliveries and failures.

### Target design

Separate:

**User Inbox**
Simple readable notification list with filters and deep links.

**Admin Delivery Operations**
Observability workspace:
- queued/sent/delivered/read/acknowledged/failed;
- provider/channel;
- retry state;
- failure reason;
- recipient scope.

**Failure Queue**
Triage pattern with safe retry controls and provider/context detail.

**Preferences**
Compact settings, not operational dashboard styling.

M12 should show delivery truth; it must not visually blur M15 notice-authoring ownership.

---

## M13 — Learning Layer

M13 is frozen/disabled by default under `AGENTS.md`.

Do not surface it in active navigation or redesign it into prominence merely because routes exist.

If explicitly reactivated later, target:

- teacher activity/resource authoring;
- controlled sessions;
- progress matrix;
- learner attempt review;
- resource library;
- session state.

Avoid gamified public ranking or social patterns.

---

## M15 — Notices & Announcements

### Current feature families
Notice list/detail, create, approvals, scheduled notices, deliveries and failures.

### Target design

**Notices Home**
- drafts;
- scheduled;
- awaiting approval;
- recently published;
- failed/attention items.

**Notice Composer**
Structured publication workflow:

```text
Content
→ Audience
→ Attachments
→ Schedule
→ Recipient Preview
→ Approval / Publish
```

Recipient preview is important for high-impact communication.

**Approval**
Queue/triage pattern showing author, audience, urgency, attachments and consequence.

**Published Notice Detail**
Content + version/status + exact audience + acknowledgements/delivery summary.

**Delivery**
Deep-link into M12 delivery diagnostics rather than duplicating provider logic.

Corrected, superseded and withdrawn notices must be visually unambiguous.

---

# 14. Cross-Module Reports & Exports

Reports should not be a file-download graveyard.

Use:

- report catalogue grouped by domain/persona;
- recent/favourite reports;
- parameter panel;
- preview when feasible;
- generated-at/as-of context;
- protected export state;
- generation history;
- clear draft/final/confidential status.

Financial reports require drill-down and stronger numeric density than general school reports.

---

# 15. Master → Detail and Inspector Panels

For high-volume workflows, avoid unnecessary full-page navigation.

Good candidates for list + inspector:

- student quick view;
- admission review;
- fee invoice/receipt review;
- approval items;
- attendance corrections;
- notification failures;
- audit events;
- library issues;
- transport trip details.

Use a full page when:

- editing is complex;
- the record has many sibling sections;
- deep linking matters;
- audit/history context is substantial.

Preserve list filters, sort, pagination and scroll position when returning from detail.

---

# 16. Tables

Tables are first-class SchoolOS surfaces.

Required qualities:

- stable alignment;
- clear headers;
- compact/moderate density;
- search/filter/sort;
- pagination;
- selection and bulk actions when valid;
- row actions;
- sticky headers where useful;
- horizontal overflow strategy;
- accessible headers;
- keyboard usability where practical;
- saved views/column preferences for high-frequency staff work where justified.

Numeric and monetary columns should align consistently.

Do not convert dense desktop tables into giant card lists just to look modern.

---

# 17. Forms

Forms should:

- group related fields;
- use explicit labels;
- show validation close to fields;
- preserve input after recoverable errors;
- distinguish required fields;
- use searchable selectors for large datasets;
- avoid exposing internal IDs;
- prevent duplicate/destructive submission;
- use staged flows only when they reduce cognitive load.

For long workflows, use meaningful section navigation or a step model.

Do not hide important fields behind decorative minimalism.

---

# 18. Status & Lifecycle UI

Equivalent states must look and mean the same thing across modules.

Shared concepts include:

- draft;
- pending;
- submitted;
- returned;
- approved;
- rejected;
- finalized;
- locked;
- published;
- overdue;
- failed;
- reversed;
- reconciled;
- synced;
- conflicted;
- superseded.

Use text plus semantic color/icon where useful.

Never depend on color alone.

---

# 19. Dashboard Rules

A dashboard is not a gallery of KPI cards.

Prioritize:

1. attention;
2. pending work;
3. operational completion;
4. exceptions;
5. recent changes;
6. useful trends.

Fixed safety/compliance-critical attention MUST NOT be user-hideable.

Lower-priority widgets MAY later support controlled personalization such as reorder, pin/hide, favourite views, or default landing preference.

---

# 20. Low-Bandwidth Web UX

Design for real Nepal connectivity, not only complete offline/online extremes.

Prefer:

- smaller payloads;
- pagination;
- field projection;
- deferred secondary panels;
- image thumbnails;
- request deduplication;
- cache-aware reads;
- clear retry;
- partial-data honesty;
- last-updated/stale indicators where material.

Do not block the entire page because one secondary module panel failed.

Do not show fake zeros for unavailable data.

---

# 21. Responsive Design

Inspect representative widths such as:

- 1440px;
- 1280px;
- 1024px;
- 768px;
- narrower windows where useful.

SchoolOS Web is a productivity application.

Use:

- column prioritization;
- horizontal scroll where appropriate;
- responsive panels;
- compact controls;
- collapsible navigation;
- adaptive form grids.

Do not mechanically turn every table into cards.

---

# 22. Accessibility

Target WCAG-aligned behavior, aiming toward WCAG 2.2 AA for priority flows.

Audit:

- keyboard navigation;
- visible focus;
- semantic headings;
- labels/descriptions;
- error association;
- contrast;
- target size;
- screen-reader naming;
- dialogs/menus;
- tables;
- reduced motion;
- non-color status;
- accessible authentication;
- Nepali/Devanagari content.

Accessibility must be verified in rendered priority flows.

---

# 23. Loading, Empty, Error, Permission & Disabled States

Every meaningful screen must intentionally handle:

- loading;
- empty;
- API failure;
- no permission;
- disabled module;
- suspended tenant where applicable;
- stale data;
- partial failure;
- locked/finalized state where relevant.

Never present unauthorized state as empty data.

Never present failed data as zero.

Provide a useful recovery action where possible.

---

# 24. Deferred Modules

Astra MAY visually normalize existing M8/M9/M10/M13 screens only when explicitly in scope or encountered as part of an authorized redesign task.

Astra MUST NOT reactivate, expand, or promote a deferred module through design work alone.

`AGENTS.md` remains authoritative.

---

# 25. Redesign Migration Strategy

A comprehensive Web redesign SHOULD be incremental even when the target visual system is entirely new.

Recommended sequence:

```text
Phase 1
Design System v2
Application shell
Navigation
Command search
Quick actions
Core Data Workspace / Inspector / Form primitives

Phase 2
Admin Home
Teacher Today
Principal Attention/Approvals
HR Home
Finance Home

Phase 3
Students + Student 360
Admissions

Phase 4
Attendance
Homework
Academics / Marks / Results
Timetable

Phase 5
Fees / Receipts
HR / Payroll
Accounting

Phase 6
Activity
Notices / Notifications
Reports / Settings

Phase 7
Deferred operational modules only when authorized
Responsive
Accessibility
Low-bandwidth performance
Visual consistency
```

Do not perform a risky all-routes-at-once visual rewrite unless explicitly required.

---

# 26. Visual QA

When browser tooling is available:

```text
Inspect source
→ Run page
→ Observe real rendered result
→ Identify interaction/visual defects
→ Implement
→ Re-render
→ Compare
→ Repeat
```

For changed high-value flows inspect:

- primary desktop width;
- compact desktop/tablet width;
- focus/keyboard behavior;
- loading/empty/error/permission states;
- long content;
- Nepali text;
- low-bandwidth behavior where relevant.

Do not rely only on source review.

---

# 27. Verification

For Web UI-only changes, normally run:

- targeted tests;
- relevant Playwright tests;
- typecheck;
- lint;
- production build when justified by impact;
- rendered visual inspection;
- responsive/accessibility checks.

If work changes routing, auth, finance, permissions, contracts, state transitions or sensitive data handling, escalate verification according to `AGENTS.md`.

Visual QA alone is never sufficient for security- or data-sensitive work.

---

# 28. Web Definition of Done

A Web design task is complete only when applicable items pass:

- the page/workspace matches the persona and job-to-be-done;
- high-frequency actions are easy to find;
- unnecessary navigation/context switching has been reduced;
- shared primitives are used consistently;
- lifecycle/status semantics are consistent;
- loading/empty/error/permission states are intentional;
- responsive behavior is verified;
- keyboard/accessibility behavior is checked;
- Nepali/English presentation remains sound;
- no authorization/security authority was moved to the client;
- relevant tests/typecheck/lint/build pass;
- broad design work was inspected in the actual rendered application;
- no unrelated product/module scope was expanded.

---

# Final Web Principle

SchoolOS Web should feel like **one intentionally designed operational product with purpose-built workspaces**, not a collection of module pages using the same generic dashboard/card template.

The existing application architecture is valuable and should be preserved.

The existing visual design is replaceable.

`AGENTS.md` owns product/security/domain authority. This file owns the **Web-specific design and interaction discipline** within that authority.
