# SchoolOS Web Design — Astra Frontend Design & Execution Playbook

## Authority

This file is the **scoped Web design and frontend execution playbook** for SchoolOS.

It applies to:

- `apps/web`;
- tenant-facing SchoolOS web UX;
- SchoolOS Platform web UX when explicitly in scope;
- Web design-system, accessibility, responsiveness, interaction architecture, performance UX, and visual QA work.

This file is **not** an independent repository source of truth.

`AGENTS.md` remains authoritative for product scope, Nepal-only roadmap boundaries, personas and access boundaries, module status, tenant isolation, authentication/authorization, finance/accounting integrity, compliance, protected data, offline boundaries, backend authority, and release/verification policy.

If this file conflicts with `AGENTS.md`, **`AGENTS.md` wins**.

---

# 1. Purpose

Guide Astra/Codex when auditing, redesigning, implementing, and verifying the SchoolOS web application.

The goal is not to preserve the current visual treatment. The goal is to make SchoolOS feel like a **serious, coherent, fast, high-trust school operating system** for frequent daily work.

When an explicit SchoolOS Web redesign is in scope:

- existing backend contracts, permissions, routes, data model, domain rules, and security boundaries remain authoritative;
- the existing visual design is **not** authoritative;
- page composition, shell presentation, navigation presentation, design primitives, layout, typography, spacing, tables, filters, forms, drawers, dashboards, and interaction patterns MAY be substantially redesigned;
- working application behavior SHOULD be preserved unless the existing interaction model itself is the problem;
- do not introduce a parallel frontend framework or a third overlapping component system.

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

Use these foundations unless an explicit technical task authorizes replacement.

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

The target is **modern productivity software**, not a marketing site, consumer fintech dashboard, or generic ERP skin.

## 4.1 Visual principles

Prefer:

- neutral page canvas;
- white or near-white working surfaces;
- one restrained SchoolOS primary accent;
- semantic status colors for meaning;
- thin borders/dividers;
- small-to-moderate radii;
- little or no shadow on ordinary work surfaces;
- strong typography hierarchy;
- compact but breathable tables;
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
- giant illustrations in operational pages;
- meaningless charts;
- floating decorative UI;
- animation that slows task completion.

Do not turn every data point into a card.

## 4.2 Card restraint rule

A card is **not** the default SchoolOS container.

Use cards only when the content is genuinely a discrete object, such as:

- a current class;
- a notice;
- an event;
- a compact decision unit;
- media/content feed material.

Prefer for ordinary operational structure:

- sections;
- dividers;
- work surfaces;
- tables;
- list rows;
- split panes;
- inspector panels;
- grouped form sections.

A page MUST NOT default to four KPI cards merely because four metrics exist.

---

# 5. Design System v2 — Required Before Broad Module Migration

Before broad visual migration, audit existing primitives and converge on **one canonical SchoolOS Web component layer**.

The repository currently contains legacy and newer primitives. The redesign MUST NOT create a third generation of near-duplicate components.

## 5.1 Canonical component responsibilities

Converge toward explicit roles:

- `AppShell` — global application frame;
- `Sidebar` / navigation rail — primary workspace navigation;
- `Topbar` — school context, search, notifications, user context;
- `CommandPalette` — global command/search layer;
- `PageHeader` / `WorkspaceHeader` — title, context, actions;
- `Surface` — neutral grouped work area, no shadow by default;
- `Section` — lightweight structural grouping;
- `Panel` — contextual side/secondary region;
- `Card` — discrete object only;
- `Metric` / `DecisionMetric` — compact numeric summary when independently useful;
- `DataWorkspace` — table/list/filter container;
- `Inspector` — contextual right-side detail;
- `Entity360` — coherent major-record workspace;
- `QueueWorkspace` — review/triage workflow;
- `FormSection` — structured form grouping;
- `Timeline` / `AuditTrail` — chronological state/history;
- `Dialog` / `ConfirmDialog` / `Sheet` — transient interaction surfaces.

## 5.2 Legacy consolidation rule

Before migrating modules, produce and follow a replacement map similar to:

```text
Legacy / overlapping primitive   → Canonical v2 responsibility
ui/card                          → Surface or Card
ui/primitives/card               → Surface or Card
StatCard                         → Metric
SummaryCard                      → DecisionMetric / compact summary
SectionCard                      → Section
WorkSurface                      → DataWorkspace / Surface / Panel
shell-card/custom card wrappers  → remove or migrate
module-specific generic panels   → canonical shared primitive
```

Do not remove a legacy component until all affected callers are safely migrated, but mark it as legacy and prevent new usage where practical.

## 5.3 Baseline geometry

Use one explicit scale. Exact token names may follow repository conventions, but the system SHOULD converge roughly toward:

```text
Radius
small       6px
medium      8px
large       12px
extra-large exceptional only

Control heights
compact     32px
standard    36–40px
large       44px

Table/list rows
compact     40–44px
standard    48px

Page gutters
large desktop   28–32px
standard        24px
compact         16–20px

Inspector widths
small       ~360px
medium      ~440px
large       ~560px
```

Do not permit arbitrary radius, spacing, control height, or shadow values page by page.

## 5.4 Shadow rule

Default work surfaces SHOULD use border and hierarchy rather than shadow.

Use shadows mainly for:

- dialogs;
- popovers;
- command palette;
- floating/sticky overlays;
- temporary elevated surfaces.

---

# 6. Color System

SchoolOS should feel like one product.

Module identity colors MAY remain for **subtle location context only**.

Allowed module-color usage:

- small navigation icon/accent;
- thin active indicator;
- restrained selected-tab marker;
- small icon chip;
- very light tint where it materially helps location awareness.

Avoid module color as:

- major page background;
- primary button system;
- table background system;
- large card/panel fill;
- independent hover language;
- replacement for semantic status color.

Semantic colors remain authoritative for:

- success;
- warning;
- danger/critical;
- information;
- disabled;
- draft/pending/finalized state when applicable.

The user should perceive **SchoolOS first, module second**.

---

# 7. Astra Web Redesign Execution Sequence

For broad Web redesign work:

```text
Read AGENTS.md
    ↓
Read this playbook
    ↓
Inspect routes, layouts, components, APIs, permissions, tests, and current rendered UI
    ↓
Map persona + module + job-to-be-done + highest-frequency workflow
    ↓
Identify legacy primitives used by the flow
    ↓
Define target workspace pattern
    ↓
Refine canonical Design System v2 primitives first
    ↓
Migrate the highest-value flow
    ↓
Verify desktop + compact widths
    ↓
Verify keyboard + accessibility
    ↓
Verify loading / empty / error / permission / stale states
    ↓
Verify low-bandwidth behavior
    ↓
Run tests/typecheck/lint/build as appropriate
    ↓
Re-render and compare
```

Do not begin broad redesign by randomly changing CSS page by page.

---

# 8. Core Interaction Architecture

Move away from:

```text
Module directory
→ choose module
→ choose sub-page
→ find record
→ perform task
```

Toward:

```text
Persona context
→ current priority / record / task
→ direct action
→ deeper workspace only when needed
```

The sidebar remains important, but it must not be the only way to operate SchoolOS.

---

# 9. Interaction Budgets

Use interaction count as a UX quality measure.

Targets for common flows:

| Workflow | Target |
| --- | ---: |
| Teacher open current/next class | ≤ 1 meaningful action from Today |
| Teacher normal attendance | designed toward ~30 seconds for a typical class |
| Admin locate a student | ≤ 2 meaningful actions |
| Admin open Student 360 | ≤ 2 meaningful actions |
| Principal open a critical attention item | ≤ 1 meaningful action from Home/Attention |
| Principal approve after review | generally ≤ 3 meaningful actions |
| Accountant start fee collection | ≤ 2 meaningful actions |
| HR locate a staff member | ≤ 2 meaningful actions |
| HR open pending leave | ≤ 2 meaningful actions |
| Open a primary persona workspace | generally ≤ 2 meaningful actions |

These are UX targets, not permission/security shortcuts.

Consequential operations may require additional review/confirmation where safety, finance, audit, or lifecycle integrity demands it.

---

# 10. Application Shell

The shell should provide:

- school identity;
- active academic year;
- active branch when applicable;
- persona/role context;
- grouped primary navigation;
- global command/search;
- persona-aware quick actions;
- notifications;
- user/security menu;
- breadcrumbs/context;
- responsive collapse;
- entitlement/module state.

## 10.1 Navigation hierarchy

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

Finance
  Fees & Receipts
  Accounting
  Payroll

Communication
  Notices

Operations
  Activities
  Service Requests
  Library / Transport / Canteen when enabled

Insights
  Reports
  Audit

Settings
```

The exact groups and visible destinations MUST remain persona-, permission-, capability-, and entitlement-aware.

Specialist sub-functions belong inside module workspaces rather than permanently occupying global navigation.

---

# 11. Global Command/Search Layer

SchoolOS already has a command palette concept. **Evolve it; do not build a second competing palette.**

The target command/search layer SHOULD support one mental model:

```text
Search SchoolOS…

RECENT
recent authorized records

PEOPLE / RECORDS
students, guardians, staff, invoices, notices, etc.

ACTIONS
take attendance, create homework, collect payment, create notice, etc.

WORKSPACES
Students, Attendance, Accounting, Settings, etc.
```

Rules:

- `Cmd+K` / `Ctrl+K` should remain the primary keyboard entry point;
- server-backed entity search must remain tenant- and permission-scoped;
- search visibility never grants authorization;
- recent records must be revalidated against current access;
- results should be grouped by type;
- keyboard navigation must be first-class;
- do not create separate overlapping “jump”, “global search”, and “action launcher” systems unless there is a strong documented reason.

---

# 12. Persona-Aware Quick Actions

Provide a small controlled set of high-frequency actions.

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

# 13. Persona Experience Targets

## 13.1 Teacher — task density

Teacher Web must feel like a teaching workspace, not an Admin interface with hidden permissions.

Home prioritizes:

- current/next class;
- today's schedule;
- attendance due;
- homework needing review;
- missing marks;
- substitutions;
- returned work/corrections;
- assigned students/classes.

Prefer one continuous `Today` workspace over many boxed dashboard cards.

## 13.2 Principal — decision density

Principal Web prioritizes:

- critical attention;
- approvals;
- attendance exceptions;
- academic readiness;
- finance exceptions;
- staff absence impact;
- communication failures;
- school readiness.

Routine oversight must not require navigating configuration-heavy Admin screens.

## 13.3 Admin — operational density

Admin Web may remain dense.

Prioritize:

- admissions/student operations;
- school-wide attendance completion;
- academic administration;
- fee operations where authorized;
- staff operations;
- communication;
- reports;
- configuration readiness.

Use tables, bulk actions, filters, validation queues, and exception workspaces.

## 13.4 HR — workforce density

Prioritize:

- staff lifecycle;
- attendance;
- leave;
- contracts;
- payroll readiness;
- staff documents;
- expiry/exceptions.

## 13.5 Accountant — numerical density

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

# 14. Shared Workspace Patterns

Not every SchoolOS module should look the same. Use the pattern matching the work.

## 14.1 Data Workspace

For Students, Staff, Admissions lists, Invoices, Receipts, Requests, Audit, etc.

Required capability set where applicable:

- search;
- visible high-frequency filters;
- advanced filters;
- active filter chips;
- saved views;
- sort;
- column visibility;
- density;
- pagination;
- bulk selection/actions;
- authorized export;
- contextual row actions;
- refresh/last-updated state;
- empty/loading/error states.

Rows should optimize scanning. Avoid giving every row several always-visible buttons.

Prefer row click/keyboard open + one primary contextual action + overflow where needed.

## 14.2 Entity 360 Workspace

For a student, staff member, admission case, tenant, or other major entity.

```text
Identity header
Status + key context
Primary actions
Tab/section navigation
Core details
Related operational records
History / audit when permitted
```

Prefer one coherent record workspace over forcing users through separate modules to understand one person.

## 14.3 Queue / Triage Workspace

For approvals, anomalies, corrections, failures, duplicates, and pending reviews.

Use:

- severity/status;
- owner;
- age/deadline;
- filters;
- list + contextual inspector;
- explicit decision/resolution actions;
- evidence/reason context.

## 14.4 Ledger / Reconciliation Workspace

For finance/accounting.

Use dense aligned data with:

- debit/credit/amount columns;
- running balances;
- source references;
- status;
- reconciliation state;
- drill-down lineage;
- side-by-side matching where appropriate.

## 14.5 Schedule / Grid Workspace

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

## 14.6 Composer / Publication Workspace

For notices, activities, homework, and controlled publication.

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

# 15. Student 360 Standard

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

- Teacher: Overview, Attendance, Academics, permitted Guardian contact;
- Accountant: Overview, Fees, payer/receipt context;
- Admin: full authorized operational record;
- Principal: oversight-oriented read/approve views.

Do not duplicate canonical data to create Student 360. Compose authorized projections from existing authoritative sources.

---

# 16. Module-Specific Web Design Blueprint

This section defines target interaction patterns, not authorization grants or activation decisions.

Each module MUST optimize its primary job rather than copying a generic dashboard template.

## M0 — Platform Core / School Settings

**Primary job:** safely configure and operate platform/school context without blurring control-plane and tenant authority.

Current feature families include Platform control plane, schools/tenants, operations, billing, audit, account security, and tenant settings.

### Platform target

- operations-console character;
- tenant table + tenant inspector;
- platform health/queue/provider status;
- audit/security timeline;
- billing/entitlement state;
- support-access state clearly marked;
- visually distinct from normal school UI.

### School Settings target

- grouped settings hub;
- settings search;
- readiness/completeness indicators;
- change history;
- explicit save/dirty state;
- high-risk impact warnings;
- no giant settings form.

---

## M1 — Admissions & Student Profiles

**Primary job:** move an applicant safely from intake through review into a trustworthy student record, then provide fast access to that student's full operational context.

Current feature families: Students, Admissions applications/cases, assessments, documents, duplicates, IEMIS, QR, new/review flows.

### Admissions Home

Show:

- stage/status summary;
- applications requiring review;
- incomplete documents;
- duplicate risks;
- capacity/waitlist signals where available;
- direct New Application action.

### Application Review

Use split workspace:

```text
Applicant list | Application detail
               | Checklist
               | Documents
               | Assessment
               | Decision history
```

### Students

Use a dense Data Workspace. The student list should scan like a directory/table, not a stack of profile cards.

Prefer columns such as:

```text
Student | Student ID | Class/Section | Guardian | Status
```

Routine details open in an inspector; deeper work opens Student 360.

### Duplicate Review

Use side-by-side comparison with exact conflicting fields and merge consequences.

### IEMIS

Use data-quality/readiness design:

- completeness/readiness state;
- grouped validation errors;
- affected records;
- batch/export history;
- clear distinction between SchoolOS-ready and government-submitted state.

---

## M2 — Smart Attendance

**Primary job:** complete authoritative attendance quickly and resolve exceptions safely.

Current feature families: marking, registers, sessions, anomalies, corrections, follow-ups, offline drafts, reports, student attendance.

### Teacher Attendance

Focused action workspace:

```text
Class / period context
Roster
Mark all present
Exception controls
Draft / submitted / locked state
Submit
```

Design the normal flow toward ~30 seconds for a typical class.

### Admin / Principal Attendance Command Centre

Prioritize:

- today's completion;
- missing submissions;
- unusual absence/lateness;
- correction queue;
- follow-up queue;
- grade/class drill-down.

### Corrections

Queue with original value, requested value, reason, requester, approver, and audit lineage.

Never visually imply an offline/local draft is final attendance.

---

## M3 — Fees & Receipts

**Primary job:** identify what is owed, receive money correctly, issue proof, and reconcile the result without losing transaction lineage.

Current feature families: billing, collection, invoices, receipts, ledgers, adjustments, cashier close, reports, setup.

### Fees Home

Prioritize:

- collections today;
- outstanding/overdue;
- pending reconciliation;
- failed/unposted events;
- cashier status;
- actionable exceptions.

### Collect Payment

Dedicated transaction workspace:

```text
Student / payer search
→ outstanding invoices
→ allocation
→ amount / method
→ confirmation
→ receipt result
```

Student identity, amount, payment method, and allocation remain visible before confirmation.

### Student Fee Ledger

Dense chronological transaction lineage including invoice/payment/refund/reversal.

### Cashier Close

Expected vs actual, method totals, differences, unresolved items, approval state.

Avoid consumer-fintech styling.

---

## M4 — Academics, Exams, CAS & Report Cards

**Primary job:** move academic data safely from setup → marks → review → lock → publish → correction.

Current feature families: components, exam terms, CAS, marks, locks, readiness, results, publishing, report cards, promotion, retakes, board readiness.

### Academics Home

Do **not** make this mainly a directory of submodules.

Lead with academic readiness and required work:

- marks completion by class/subject;
- missing/invalid submissions;
- lock requests;
- publication blockers;
- report-card failures;
- deadlines;
- promotion/retake exceptions.

Use matrices and exception tables before decorative KPI cards.

### Teacher Marks Entry

Spreadsheet-style grid:

- sticky student identity;
- keyboard navigation;
- max/pass/component context;
- inline validation;
- explicit draft/autosave state;
- Submit clearly separated from Save.

### Exam lifecycle

```text
Setup → Entry → Review → Lock → Publish → Correct
```

### Publishing

Controlled release workspace with impact summary, recipient scope, blockers, approval state, and confirmation.

---

## M5 — Activity Feed & Milestones

**Primary job:** capture and publish meaningful school/student activity with correct audience, consent, and moderation context.

Current feature families: posts, gallery, deliveries, milestones, observations, moderation, oversight, reports.

Use:

- teacher composer + drafts/recent posts;
- restrained content cards only where content objects benefit from cards;
- media-first gallery;
- moderation queue;
- student/class milestone timeline;
- no social-media gamification.

---

## M6 — Homework & Timetable

### Homework primary job

Create, distribute, track, and review assigned work with minimal teacher navigation.

Teacher workspace prioritizes drafts, upcoming work, due items, review required, and overdue context.

Composer:

```text
Class/subject → Instructions → Attachments → Due date → Submission method → Preview → Publish/Schedule
```

Review uses submission queue + contextual inspector.

### Timetable primary job

Build and operate a conflict-free schedule while making substitutions/replacements immediately actionable.

Viewer is grid/calendar first.

Builder uses:

- schedule grid;
- unscheduled items;
- teacher/room context;
- conflict panel;
- workload indicator;
- version state.

Substitutions are Today-oriented operational queues.

---

## M7 — HR & Payroll

**Primary job:** maintain trustworthy staff lifecycle data and prepare payroll without omissions or hidden exceptions.

Current feature families: staff, contracts, attendance, leave, development, salary structures, payroll readiness, runs, payslips, reports.

### HR Home

Avoid the standard four-card dashboard pattern.

Prefer compact operational summary + attention list:

```text
Today: present / absent / leave / unconfirmed

Needs attention
pending leave
expiring contracts
missing staff data
missing salary structures
payroll readiness issues
```

### Staff

Dense directory + Staff 360:

Overview, Employment, Contracts, Attendance, Leave, permitted Payroll, Documents, History.

### Payroll Run

```text
Prepare → Validate → Review → Approve → Finalize → Post
```

Salary/bank data remains strongly protected.

---

## M8 — Library

M8 may remain deferred under `AGENTS.md`.

**Primary job when activated:** issue/return resources quickly while preserving borrower, copy, reservation, overdue, and fine state.

Use:

- scanner/keyboard-first Circulation Desk;
- search-first catalogue;
- copy/resource detail;
- overdue/fines table;
- reservations queue.

Avoid ornamental book grids for staff operations.

---

## M9 — Transport

M9 may remain deferred under `AGENTS.md`.

**Primary job when activated:** know what routes/trips are operating, who/what is assigned, and where operational exceptions exist.

Use two modes:

```text
Live / Today
Routes / Setup
```

Live view must show stale/unavailable GPS truth and never imply real-time data when stale.

Routes combine ordered stop sequence with map only when useful.

Assignments and fleet are dense operational tables.

---

## M10 — Canteen

M10 may remain deferred under `AGENTS.md`.

**Primary job when activated:** serve safely and quickly while maintaining entitlement, wallet, allergy, stock, and vendor truth.

Use:

- fast POS;
- scan/serve queue;
- explicit allergy warning;
- meal-plan editor;
- wallet ledger;
- inventory/expiry exceptions;
- vendor workspace.

Do not make back-office canteen UI look like consumer food ordering.

---

## M11 — Accounting & Finance

**Primary job:** preserve financial truth from source transaction through ledger, reconciliation, reporting, and audit lineage.

Accounting should have the highest information density in SchoolOS.

### Accounting Home

Prioritize:

- cash/bank position;
- unreconciled items;
- unposted journals;
- receivables/payables attention;
- period status;
- posting failures;
- reporting shortcuts.

### Core workspaces

- Chart of Accounts — hierarchy/tree + codes + balances;
- Journals — dense register + inspector;
- Journal Entry — balanced-entry editor with live debit/credit totals;
- Cash & Bank — account ledgers with running balance;
- Reconciliation — split-pane matching;
- Receivables / Payables — aging-first tables;
- Fiscal Periods — status/timeline + lock/reopen consequences.

Every report should drill down:

```text
Statement → line → account → ledger → journal/voucher → source transaction → approval/document
```

Avoid decorative finance cards and pie-chart dashboards.

---

## M12 — Notifications & Delivery

**Primary job:** show delivery truth, surface failures, and support safe retries without duplicating notice-authoring responsibility.

Separate:

- User Inbox — readable list with filters/deep links;
- Admin Delivery Operations — queued/sent/delivered/read/acknowledged/failed;
- Failure Queue — reason, provider, retry state, recipient context;
- Preferences — compact settings.

M12 must not visually blur M15 authoring ownership.

---

## M13 — Learning Layer

M13 is frozen/disabled by default under `AGENTS.md`.

Do not surface it in active navigation or redesign it into prominence merely because routes exist.

If explicitly reactivated later, target controlled teacher activity/resource authoring, sessions, progress matrices, attempt review, and resource library.

Avoid public ranking/gamification patterns.

---

## M15 — Notices & Announcements

**Primary job:** author the correct message, target the correct audience, obtain required approval, publish intentionally, and verify delivery.

Current feature families: notice list/detail, create, approvals, scheduled notices, deliveries, failures.

### Notice Composer

```text
Content
→ Audience
→ Attachments
→ Schedule
→ Recipient Preview
→ Approval / Publish
```

Recipient preview is mandatory for high-impact communication where backend support exists.

Approval uses queue/triage design.

Published detail shows content, version/status, exact audience, acknowledgements, and delivery summary.

Delivery diagnostics deep-link to M12 rather than duplicating provider state.

Corrected, superseded, and withdrawn notices must be visually unambiguous.

---

# 17. Cross-Module Reports & Exports

Reports must not become a file-download graveyard.

Use:

- report catalogue grouped by domain/persona;
- recent/favourite reports;
- parameter panel;
- preview when feasible;
- generated-at/as-of context;
- protected export state;
- generation history;
- clear draft/final/confidential status.

Financial reports require drill-down and stronger numeric density than general reports.

---

# 18. Master → Detail and Inspector Panels

Avoid unnecessary full-page navigation for high-volume work.

Good list + inspector candidates:

- student quick view;
- admission review;
- fee invoice/receipt review;
- approvals;
- attendance corrections;
- notification failures;
- audit events;
- library issues;
- transport trip details.

Use a full page when:

- editing is complex;
- many sibling sections exist;
- deep linking matters;
- audit/history context is substantial.

Preserve filters, sort, pagination, and scroll position when returning from detail.

---

# 19. Tables

Tables are first-class SchoolOS surfaces.

Required qualities:

- stable alignment;
- clear headers;
- compact/moderate density;
- search/filter/sort;
- pagination;
- valid selection/bulk actions;
- contextual row actions;
- sticky headers when useful;
- horizontal overflow strategy;
- accessible headers;
- keyboard usability where practical;
- saved views/column preferences for high-frequency work.

Numeric and monetary columns align consistently.

Do not convert desktop tables into giant card lists merely to look modern.

---

# 20. Forms

Forms should:

- group related fields;
- use explicit labels;
- show validation near fields;
- preserve input after recoverable errors;
- distinguish required fields;
- use searchable selectors for large datasets;
- avoid internal IDs;
- prevent duplicate/destructive submission;
- use staged flows only when they reduce cognitive load.

Long workflows should use meaningful section navigation or a step model.

Do not hide important fields behind decorative minimalism.

---

# 21. Status & Lifecycle UI

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

# 22. Dashboard Rules

A dashboard is not a gallery of KPI cards.

Prioritize:

1. attention;
2. pending work;
3. operational completion;
4. exceptions;
5. recent changes;
6. useful trends.

Fixed safety/compliance-critical attention MUST NOT be user-hideable.

Lower-priority widgets MAY support controlled personalization such as reorder, pin/hide, favourite views, or default landing preference.

Prefer compact summary strips and attention lists over four independent cards when metrics belong together.

---

# 23. Low-Bandwidth Web UX

Design for real Nepal connectivity, not just complete offline/online extremes.

Default rules:

- paginate large datasets; typical default page size should remain around 25–50 unless workflow evidence supports another value;
- avoid fetching hidden-tab data before needed;
- field-project list endpoints when practical;
- defer secondary panels;
- show thumbnails before large media;
- deduplicate requests;
- cancel/ignore obsolete searches;
- use cache-aware reads where safe;
- provide retry;
- show partial-data truthfully;
- show last-updated/stale state where material;
- do not block primary content because one secondary panel failed;
- do not show fake zeros for unavailable data.

Every migrated priority screen should be sanity-checked under throttled/poor connectivity where practical.

---

# 24. Responsive Design

Responsive behavior is **not a final-phase task**.

Every migrated slice must be designed and verified responsively before completion.

Inspect representative widths such as:

- 1440px;
- 1280px;
- 1024px;
- 768px;
- narrower windows where useful.

Use:

- column prioritization;
- horizontal scroll when appropriate;
- responsive panels;
- compact controls;
- collapsible navigation;
- adaptive form grids.

Do not mechanically turn every table into cards.

---

# 25. Accessibility

Accessibility is **part of each implementation phase**, not a polish pass.

Target WCAG 2.2 AA for priority flows.

Verify:

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

A component is not considered production-ready merely because its underlying library is accessible; the rendered flow must be checked.

---

# 26. Loading, Empty, Error, Permission & Disabled States

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

# 27. Dark Mode Decision

For the current redesign, **light mode is authoritative** unless the project owner explicitly expands scope.

Design tokens and semantic component architecture SHOULD remain compatible with a future dark mode, but broad dark-mode implementation must not delay or destabilize the primary Web redesign.

Do not create partially supported dark mode on a subset of operational pages.

---

# 28. Deferred Modules

Astra MAY visually normalize existing M8/M9/M10/M13 screens only when explicitly in scope or encountered as part of an authorized redesign task.

Astra MUST NOT reactivate, expand, or promote a deferred module through design work alone.

`AGENTS.md` remains authoritative.

---

# 29. Redesign Migration Strategy

A comprehensive redesign SHOULD be incremental even when the target visual system is entirely new.

## Phase 0 — Design-system audit and convergence

- inventory existing UI primitives;
- identify duplicate/legacy card/button/input/table systems;
- define canonical Design System v2 tokens;
- define replacement map;
- restrict module-color usage;
- define Surface/Section/Card/DataWorkspace/Inspector responsibilities;
- prevent new legacy primitive usage where practical.

## Phase 1 — Core product shell

- Design System v2 implementation;
- application shell;
- navigation;
- command/search evolution;
- quick actions;
- Data Workspace;
- Inspector;
- canonical form primitives.

## Phase 2 — Persona homes

- Admin Home;
- Teacher Today;
- Principal Attention/Approvals;
- HR Home;
- Finance Home.

## Phase 3 — People

- Students directory;
- Student 360;
- Admissions/review.

## Phase 4 — Academic operations

- Attendance;
- Homework;
- Academics/Marks/Results;
- Timetable.

## Phase 5 — Financial/workforce depth

- Fees/Receipts;
- HR/Staff 360;
- Payroll;
- Accounting/Reconciliation.

## Phase 6 — Communication and administration

- Activity;
- Notices/Notifications;
- Reports;
- Settings.

## Phase 7 — Cross-product hardening

- deferred modules only when authorized;
- full WCAG 2.2 AA audit;
- visual consistency audit;
- low-bandwidth/performance audit;
- Nepali typography/localization QA;
- cross-module keyboard audit;
- final responsive audit;
- visual-regression baseline review.

**Important:** responsive, accessibility, loading/error/permission, and low-bandwidth checks are required inside every earlier phase. Phase 7 repeats them across the whole product; it does not postpone them.

Do not perform a risky all-routes-at-once rewrite unless explicitly required.

---

# 30. Visual QA and Regression Protection

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

For every changed high-value flow inspect:

- primary desktop width;
- compact desktop/tablet width;
- focus/keyboard behavior;
- loading/empty/error/permission states;
- long content;
- Nepali text;
- low-bandwidth behavior where relevant.

## 30.1 Canonical visual baselines

Maintain visual-regression coverage for a small set of design-system reference surfaces rather than snapshotting every page.

Recommended canonical surfaces:

- application shell;
- Admin Home;
- Teacher Today;
- Principal Attention;
- Student Directory;
- Student 360;
- Attendance Register;
- Marks Grid;
- Fee Collection;
- Accounting Reconciliation.

Where Playwright snapshot infrastructure is practical, prefer asserted visual baselines for these canonical views rather than screenshots that are captured only on failure.

Do not rely only on source review.

---

# 31. Verification

For Web UI-only changes, normally run:

- targeted tests;
- relevant Playwright tests;
- typecheck;
- lint;
- production build when justified by impact;
- rendered visual inspection;
- responsive/accessibility checks;
- low-bandwidth sanity check for priority operational workspaces.

If work changes routing, auth, finance, permissions, contracts, state transitions, or sensitive-data handling, escalate verification according to `AGENTS.md`.

Visual QA alone is never sufficient for security- or data-sensitive work.

---

# 32. Web Definition of Done

A Web design task is complete only when applicable items pass:

- page/workspace matches the persona and primary job-to-be-done;
- high-frequency actions are easy to find;
- interaction budget is reasonable for the workflow;
- unnecessary navigation/context switching is reduced;
- canonical v2 primitives are used;
- no new overlapping primitive/design system was introduced;
- cards are used only where appropriate;
- module colors are restrained and semantic colors remain correct;
- lifecycle/status semantics are consistent;
- loading/empty/error/permission/stale states are intentional;
- responsive behavior is verified in the same slice;
- keyboard/accessibility behavior is verified in the same slice;
- Nepali/English presentation remains sound;
- low-bandwidth behavior is acceptable for the flow;
- no authorization/security authority moved to the client;
- relevant tests/typecheck/lint/build pass;
- broad design work was inspected in the actual rendered application;
- canonical visual baseline is updated/verified when applicable;
- no unrelated product/module scope was expanded.

---

# Final Web Principle

SchoolOS Web should feel like **one intentionally designed operational product with purpose-built workspaces**, not a collection of module pages using the same generic dashboard/card template.

The existing application architecture is valuable and should be preserved.

The existing visual design is replaceable.

Design System v2 must remove the structural causes of the current card-heavy, module-colored inconsistency before broad module migration.

`AGENTS.md` owns product/security/domain authority. This file owns the **Web-specific design and interaction discipline** within that authority.
