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

Use cards only when content is genuinely a discrete object, such as:

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

Do not remove a legacy component until affected callers are safely migrated, but mark it as legacy and prevent new usage where practical.

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

# 7. Core Interaction Architecture

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

# 8. Interaction Budgets

| Workflow | Target |
| --- | ---: |
| Teacher open current/next class | ≤ 1 meaningful action from Today |
| Teacher normal attendance | designed toward ~30 seconds for a typical class |
| Admin locate a student | ≤ 2 meaningful actions |
| Admin open Student 360 | ≤ 2 meaningful actions |
| Principal open a critical item | ≤ 1 meaningful action from Home/Attention |
| Principal approve after review | generally ≤ 3 meaningful actions |
| Accountant start fee collection | ≤ 2 meaningful actions |
| HR locate a staff member | ≤ 2 meaningful actions |
| HR open pending leave | ≤ 2 meaningful actions |
| Open a primary persona workspace | generally ≤ 2 meaningful actions |

These are UX targets, not permission/security shortcuts.

---

# 9. Application Shell

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

## 9.1 Navigation hierarchy

Prefer:

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

Specialist sub-functions belong inside module workspaces rather than permanently occupying global navigation.

---

# 10. Global Command/Search Layer

SchoolOS already has a command palette concept. **Evolve it; do not build a second competing palette.**

Target:

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

- `Cmd+K` / `Ctrl+K` remains the primary keyboard entry point;
- server-backed entity search remains tenant- and permission-scoped;
- search visibility never grants authorization;
- recent records must be revalidated against current access;
- results grouped by type;
- keyboard navigation first-class;
- avoid overlapping jump/search/action systems.

---

# 11. Shared Workspace Patterns

## 11.1 Data Workspace

Use for high-volume records.

Structure:

```text
Workspace header                         Primary action
Secondary tabs / saved views
Search + high-frequency filters + More filters
Active filter chips
────────────────────────────────────────────────────
Table / dense list
────────────────────────────────────────────────────
Selection state / bulk actions / pagination
```

Rules:

- rows optimize scanning;
- avoid multiple always-visible buttons per row;
- one primary row affordance + overflow is preferred;
- inspector for routine review;
- full page for complex record work;
- filters and pagination survive back navigation.

## 11.2 Entity 360 Workspace

```text
Identity strip
Name / code / status / core context            Primary action
Secondary metadata
────────────────────────────────────────────────────
Tabs
────────────────────────────────────────────────────
Main content                          Context / audit panel when useful
```

## 11.3 Queue / Triage Workspace

```text
Queue title + total + aging summary
Filters: severity / owner / age / status
────────────────────────────────────────────────────
Queue list                    Inspector
                              Evidence
                              History
                              Decision controls
```

## 11.4 Ledger / Reconciliation Workspace

Dense numeric table; right-aligned money; source lineage; split matching where relevant.

## 11.5 Schedule / Grid Workspace

Time/resource grid + sticky headers + conflict side panel + keyboard-accessible edit path.

## 11.6 Composer / Publication Workspace

Main editor + narrow contextual sidebar for audience, schedule, attachments, readiness, preview and approval state.

---

# 12. Persona Home Design

## Teacher Today

Do not use a dashboard card mosaic.

```text
Today · date                                          Refresh

NEXT CLASS
08:15–09:00  Mathematics · Grade 8A · Room 204
[Take attendance] [Open class]

TODAY'S SCHEDULE
08:15 Mathematics 8A                         Now
09:10 Mathematics 9B
10:05 Free period
11:00 Mathematics 10A

TO DO
7 marks missing                              Complete →
3 homework submissions                       Review →
1 attendance correction                      Review →

SUBSTITUTIONS / ALERTS
Only when present
```

## Principal Home

```text
School day status · date

REQUIRES ATTENTION
Critical and high-priority items ordered by severity and age

APPROVALS
Pending approvals with direct review

SCHOOL TODAY
Attendance completion | staff availability | finance exceptions | communication failures

READINESS
Academic / configuration / operational readiness

RECENT MATERIAL CHANGES
Only items useful for leadership awareness
```

## Admin Home

```text
Operations today
Admissions pending | attendance incomplete | fee exceptions | setup blockers

ACTION CENTRE
Cross-module operational tasks

TODAY'S COMPLETION
Compact rows, not four independent cards

RECENT ACTIVITY
Important changes and failures
```

## HR Home

```text
Today: present / absent / leave / unconfirmed

NEEDS ATTENTION
Pending leave
Expiring contracts
Qualification/licence verification or expiry
Teacher eligibility blockers
Uncovered teacher absence/substitution
Missing staff documents
Missing salary structures
Payroll readiness issues

PAYROLL STATUS
Current cycle + blockers

RECENT STAFF CHANGES
```

## Accountant Home

```text
Today: collected | posted | unreconciled | cashier state

NEEDS ATTENTION
Unreconciled items
Posting failures
Overdue receivables
Payables due
Period warnings

CASH / BANK
Compact balance strip

RECENT FINANCIAL ACTIVITY
```

---

# 13. Module-Specific Web Design Specification

The following is the implementation target. Module screens should be recognizable as SchoolOS while using interaction patterns appropriate to their work.

---

## M0 — Platform Core / School Settings

**Primary job:** safely configure and operate platform/school context without blurring control-plane and tenant authority.

### M0-A Platform Dashboard

**Layout:** three vertical bands, not a KPI card grid.

```text
Platform header: SchoolOS Platform | environment | operator

ATTENTION
Failed tenant provisioning / provider issues / security items

PLATFORM STATUS
Tenants | active schools | job health | provider readiness in compact rows

RECENT OPERATIONS
Audit/event table
```

**Primary CTA:** context dependent, usually `Open operations`, not `Create`.

**Design:** dark or clearly differentiated Platform shell is acceptable; tenant SchoolOS shell must not be reused unchanged.

### M0-B Schools / Tenants

Use `DataWorkspace`.

Recommended columns:

```text
School | Tenant ID | Plan/Entitlement | Status | Region | Last activity | Issues
```

Click opens medium/large inspector containing:

- identity;
- lifecycle status;
- entitlements;
- environment/readiness;
- support-access state;
- recent audit;
- safe links to full tenant operations.

### M0-C Platform Operations

Queue/monitoring workspace.

Use status rows for:

- jobs;
- providers;
- queues;
- failed operations;
- retries;
- stale integrations.

No decorative charts unless time-series trend genuinely helps diagnose reliability.

### M0-D School Settings Hub

**Layout:** left settings navigation + main editor + optional change-history panel.

```text
Settings search

Academic
  Academic year
  Classes & sections
  Calendar
Admissions
Attendance
Finance
Communication
Access
Branding
Data & audit
```

**Main editor:** flat grouped form sections, not stacked cards.

**Sticky footer:** `Discard` / `Save changes` appears only with dirty state.

**High-risk settings:** show consequence callout immediately above save controls.

### M0-E Access / Roles

Use permission matrix/table with role/persona selector.

Avoid checkbox walls without grouping. Group permissions by business capability.

### M0-F Nepal Education & HR Compliance Policies

This is a governance/configuration workspace, not a generic settings form.

Use two primary sections:

```text
Education
  School recognition / jurisdiction
  Curriculum versions
  Grading / assessment / promotion policies
  Academic-calendar versions
  NEB configuration/evidence
  IEMIS mappings / export schemas

HR / Employment
  Employment/post classifications
  Contract/service-condition policies
  Qualification / teaching-licence requirements
  Working-time / leave policies
  Compensation/statutory/tax policy inputs
  Payroll policy versions
```

Every policy detail should show:

- status: draft/reviewed/approved/active/superseded;
- jurisdiction and school-type applicability;
- effective from/to;
- source/evidence reference;
- current reviewer/approver;
- supersedes/superseded-by relationship;
- affected workflows;
- change history.

Do not expose mutable statutory rules as unlabelled toggles. A school-level override must clearly show whether it is permitted and must never present a below-minimum/invalid value as valid.

Government integration states must be truthful. `Ready for export` is not `Submitted`; `Submitted` is not `Acknowledged`.

---

## M1 — Admissions & Student Profiles

**Primary job:** move an applicant safely from intake through review into a trustworthy student record, then provide fast access to the student's full operational context.

### M1-A Admissions Home

**Header:** `Admissions` + `New application` primary CTA.

Under header use a compact stage strip:

```text
New 12 | In review 8 | Documents missing 5 | Decision pending 3 | Enrolled 21
```

Below:

```text
REQUIRES REVIEW
Application                 Stage        Age       Issue
Aarav Sharma                Review       2d        Document missing
...

PIPELINE
Tabular/list view grouped by stage, not kanban by default
```

Kanban MAY exist as a secondary view if users benefit from stage movement, but list/queue remains the operational default.

### M1-B Applications Data Workspace

Columns:

```text
Applicant | Application ID | Applying for | Stage | Documents | Assessment | Submitted | Owner
```

High-frequency filters:

- academic year;
- applying class;
- stage;
- document state;
- assigned reviewer.

Row click opens inspector. `Review application` opens full review workspace.

### M1-C Application Review

Use split 35/65 layout on large desktop.

```text
LEFT
Applicant identity
Stage
Checklist
Documents
Assessment status
Duplicate warning

RIGHT
Current review section
Decision notes
Timeline
```

Sticky action bar:

```text
Save draft      Return for info      Approve / Reject
```

Irreversible decisions require explicit confirmation and consequence summary.

### M1-D Duplicate Review

Full-width comparison table.

```text
Field            Record A                Record B              Match state
Name             Aarav Sharma            Aarav Sharma          Exact
DOB              2013-06-12              2013-06-12            Exact
Guardian phone   98...                   97...                  Conflict
```

Below: merge consequences + authoritative record choice.

### M1-E Students Directory

No profile-card rows.

**Default columns:**

```text
Student | Student ID | Class | Section | Roll | Primary guardian | Status
```

Optional columns through column picker:

- phone;
- admission date;
- IEMIS readiness;
- outstanding document status.

**Row behavior:** row click opens inspector; double/explicit action opens Student 360.

**Inspector:**

- photo/name/status;
- student ID;
- class/section/roll;
- primary guardian;
- quick attendance state;
- fee access only when authorized;
- document readiness;
- `Open full profile`.

### M1-F Student 360

**Identity header:**

```text
[Avatar] Aarav Sharma                     Active
         STU-2083-0192
         Grade 8A · Roll 14
         Primary guardian: Maya Sharma

[Edit profile] [More]
```

Tabs:

```text
Overview | Profile | Guardians | Attendance | Academics | Fees | Homework | Activities | Documents | Requests | History
```

**Overview layout:** two-column, not card mosaic.

Left:
- core profile;
- enrollment;
- guardian summary.

Right:
- current operational state;
- attendance today;
- academic alerts;
- fee alert when authorized;
- documents requiring action.

Timeline at bottom.

### M1-G IEMIS Readiness

Use validation workspace.

Top:

```text
Ready 1189 / 1248          Blocking records 59
```

Main table:

```text
Student | Missing/invalid field | Category | Severity | Last updated
```

Right inspector explains exact field issue and link to correct record.

Do not imply upload/submission to government unless that operation actually occurred.

---

## M2 — Smart Attendance

**Primary job:** complete authoritative attendance quickly and resolve exceptions safely.

### M2-A Teacher Attendance Register

This is a task screen, not a dashboard.

Header:

```text
Grade 8A · Mathematics
Tuesday 15 Sep · Period 1 · 08:15–09:00
Draft / Submitted / Locked
```

Action row:

```text
[Mark all present]  [Clear]                  Present 27 | Absent 2 | Late 1
```

Roster table:

```text
Roll | Student | Present | Absent | Late | Excused | Note
```

Attendance status controls should support keyboard entry and fast pointer selection.

Sticky bottom action:

```text
Saved locally / Synced state              [Save draft] [Submit attendance]
```

Offline/local drafts must use a clearly distinct state treatment.

### M2-B Attendance Command Centre

Principal/Admin layout:

```text
TODAY COMPLETION
38/41 registers submitted      3 missing

MISSING REGISTERS
Class | Teacher | Period | Due age | Contact/action

EXCEPTIONS
High absence | Late spikes | correction backlog

FOLLOW-UP QUEUE
```

No pie chart for present/absent unless trend analysis is specifically requested.

### M2-C Corrections Queue

Columns:

```text
Student | Date | Original | Requested | Reason | Requested by | Age | Status
```

Inspector:

- authoritative original record;
- requested change;
- reason/evidence;
- prior corrections;
- audit lineage;
- approve/reject/return controls.

### M2-D Student Attendance Detail

Calendar/month view + summary strip + chronological exceptions.

Avoid full-year heatmaps as the only representation; exact dates and states remain available.

### M2-E Attendance Reports

Use table/calendar/report preview patterns. Print/export actions live in header, not duplicated throughout page.

---

## M3 — Fees & Receipts

**Primary job:** identify what is owed, receive money correctly, issue proof, and reconcile the result without losing transaction lineage.

### M3-A Fees Home

Compact summary strip:

```text
Collected today NPR X | Outstanding NPR Y | Overdue NPR Z | Unreconciled N
```

Below:

```text
NEEDS ATTENTION
Failed posting
Refund awaiting approval
Cashier difference
Overdue high-value balances

RECENT COLLECTIONS
transaction table
```

### M3-B Collect Payment

Use a dedicated transaction layout.

Large desktop:

```text
LEFT 60%                              RIGHT 40%
Student/payer search                  PAYMENT SUMMARY
Outstanding invoices                  Student
Allocation table                      Total selected
                                      Payment method
                                      Amount tendered
                                      Difference/change
                                      Receipt destination
```

Primary CTA `Review payment` first, then confirmation screen/dialog `Confirm & collect`.

Never hide allocation details behind an accordion during confirmation.

### M3-C Invoice Workspace

Columns:

```text
Invoice # | Student | Period | Amount | Paid | Balance | Due | Status
```

Inspector:

- invoice lines;
- allocations;
- discounts/adjustments;
- payment history;
- source/creator;
- printable/downloadable artifact.

### M3-D Receipt Workspace

Columns:

```text
Receipt # | Student/Payer | Date | Method | Amount | Cashier | Status
```

Voided/reversed receipts remain visible with unmistakable status and linkage to replacement/reversal.

### M3-E Student Fee Ledger

Full-width chronological ledger:

```text
Date | Reference | Type | Description | Debit | Credit | Running balance | Status
```

Use tabular numbers and right alignment.

### M3-F Adjustments / Refunds / Reversals

Use controlled form with:

- original transaction summary pinned at top;
- reason mandatory;
- amount limits/validation;
- consequence preview;
- approval requirement;
- immutable lineage after completion.

### M3-G Cashier Close

```text
Expected
Cash        NPR ...
QR          NPR ...
Bank        NPR ...

Actual
...

Difference
...

UNRESOLVED ITEMS
transaction list
```

Primary CTA appears only when reconciliation conditions are met.

---

## M4 — Academics, Exams, CAS & Report Cards

**Primary job:** move academic data safely from setup → marks → review → lock → publish → correction.

### M4-A Academics Home

Do not make the page a link directory.

Top readiness strip:

```text
Marks completion 89% | Lock requests 3 | Publish blockers 18 | Report-card failures 2
```

Main content:

```text
READINESS MATRIX
              Grade 8A   Grade 8B   Grade 9A
Mathematics   Ready      4 missing  Ready
Science       Ready      Ready      2 missing
English       1 invalid  Ready      Ready

REQUIRES ATTENTION
ordered queue

UPCOMING DEADLINES
```

### M4-B Exam Terms

Data workspace:

```text
Term | Academic year | Entry window | Review | Lock | Publish | Status
```

Full term detail uses lifecycle header:

```text
Setup → Entry → Review → Lock → Publish → Correct
```

### M4-C Marks Entry

Spreadsheet-like surface occupying most viewport.

Sticky left columns:

```text
Roll | Student
```

Then assessment columns.

Top toolbar:

- class/section;
- subject;
- exam term;
- component;
- entry state;
- Save state;
- validation count.

Cells:

- keyboard navigable;
- inline validation;
- max mark visible in header;
- absent/exempt state separate from numeric marks;
- unsaved/draft/invalid visually distinct.

Do not wrap each student in a card.

### M4-D Marks Lock Review

Queue + inspector.

Inspector shows completeness, validation, requester, last edits, and lock consequences.

### M4-E Report Cards

Batch workspace:

```text
Student | Generated version | Validation | Published | Last generated | Action
```

Preview opens document-oriented panel/full page.

### M4-F Publishing

Controlled release workspace.

```text
SCOPE
Term / classes / recipients

READINESS
Ready N
Blocked N
Warnings N

BLOCKERS
specific list

IMPACT
Who will see results

[Schedule] [Publish]
```

Publishing confirmation must repeat scope and blockers resolved.

### M4-G Promotion / Retakes

Exception-first tables. Bulk actions only when explicit rules and review state allow them.

---

## M5 — Activity Feed & Milestones

**Primary job:** capture and publish meaningful school/student activity with correct audience, consent, and moderation context.

### M5-A Activity Home

Teacher view:

```text
[Create activity]
Drafts 2 | Awaiting review 1 | Published this week 5

RECENT OWN ACTIVITY
compact content list
```

Admin/Principal view:

```text
Moderation required
Consent-sensitive items
Delivery failures
Recent published activity
```

### M5-B Composer

Two-column layout.

Main:

- title;
- content;
- media;
- student/class association;
- milestone/observation fields.

Side panel:

- audience;
- consent state;
- preview;
- publish schedule;
- moderation state.

### M5-C Activity Feed

Cards are acceptable here because posts are discrete content objects.

Keep cards restrained:

- author;
- timestamp;
- audience marker;
- content;
- media preview;
- limited action row.

No engagement gamification, follower counts, likes leaderboards, etc.

### M5-D Gallery

Media grid with lazy thumbnails. Selecting item opens inspector with consent/audience/linked students.

### M5-E Moderation

Queue + large content preview + decision controls.

---

## M6 — Homework & Timetable

### M6-A Homework Home

**Primary job:** create, distribute, track, and review assigned work with minimal teacher navigation.

Teacher layout:

```text
[Create homework]

NEEDS REVIEW
3 assignments · 18 submissions

UPCOMING
assignment list

DRAFTS
assignment list
```

Rows:

```text
Title | Class | Subject | Due | Submission status | Review status
```

### M6-B Homework Composer

Main editor + right summary panel.

Main:

- class/subject;
- title;
- instructions;
- attachments;
- submission method.

Side:

- due date/time;
- audience count;
- schedule;
- preview;
- publication state.

### M6-C Homework Review

Split workspace:

```text
Student submissions list | Submission detail
                         | Attachment/answer
                         | Feedback
                         | Mark/review state
```

Keyboard next/previous student shortcuts are desirable.

### M6-D Timetable Viewer

**Primary job:** display a clear schedule and make conflicts/substitutions obvious.

Use full-width timetable grid, not cards.

Toolbar:

```text
Week | Class | Teacher | Room | Print
```

Cells contain only essential subject/teacher/room information.

### M6-E Timetable Builder

Three-region layout:

```text
LEFT            CENTER GRID             RIGHT
Unscheduled     timetable               Conflicts
classes/items                           Selected slot detail
```

Drag/drop may supplement but never replace keyboard/form editing.

### M6-F Conflicts

Dedicated queue grouped by teacher/room/class collision type with direct `Open slot` action.

### M6-G Substitutions

Today-oriented table:

```text
Period | Class | Subject | Absent teacher | Substitute | Status | Acknowledged
```

---

## M7 — HR & Payroll

**Primary job:** maintain trustworthy staff identity, employment, professional eligibility, leave/coverage and compensation data, then prepare payroll from verified inputs without omissions, hidden exceptions or a parallel accounting ledger.

### M7-A HR Home

No four-card dashboard.

```text
TODAY
Present 51 | Absent 3 | Leave 4 | Unconfirmed 2

NEEDS ATTENTION
7 leave requests
3 contracts expiring
2 teaching licences expiring / unverified
3 teacher eligibility blockers
1 uncovered teaching period
2 staff missing salary structure
5 document issues

PAYROLL READINESS
September · 14 blockers                         Review →

RECENT STAFF CHANGES
```

### M7-B Staff Directory

Columns:

```text
Staff | Staff ID | Department | Designation | Employment | Professional status | Attendance today | Status
```

Inspector:

- identity/contact;
- active employment and position;
- current contract;
- teacher/professional status when relevant;
- attendance/leave today;
- document/compliance issues;
- payroll access only when permitted.

Do not reduce staff identity to one role label.

### M7-C Staff 360

Identity header + authorization-aware tabs:

```text
Overview | Employment | Contracts | Qualifications | Teaching Licence | Eligibility |
Assignments | Attendance | Leave | Compensation | Payroll | Documents | History
```

Rules:

- teacher-only tabs appear only where relevant;
- compensation/payroll/bank/tax/medical/disciplinary/safeguarding data require server-authorized projections;
- hidden tabs must mean the data was not returned, not merely hidden after full payload download;
- SchoolOS role/permission is not displayed as proof of professional eligibility.

### M7-D Employment & Contracts

Use effective-dated employment/service records.

```text
Staff | Employment type | Post/designation | Start | End | Contract | Status
```

Full detail should distinguish:

- employment status;
- organizational position/responsibility;
- contract/service terms;
- probation/effective dates;
- evidence;
- lifecycle/history.

Historical records should remain readable after later policy or contract changes.

### M7-E Qualifications

Evidence workspace:

```text
Staff | Qualification | Institution/Issuer | Level/Subject | Verified | Effective/Expiry | Issue
```

Inspector shows evidence document, verification state, verifier, date, source/reference and history.

An uploaded certificate must never render as `Verified` unless verification actually occurred.

### M7-F Teaching Licence

Teacher-specific workspace:

```text
Teacher | Licence/reference | Level/subject context | Verified | Valid through | Status
```

Use clear states such as:

```text
Unverified | Verified | Expiring | Expired | Revoked | Review required
```

Do not imply TSC/government verification unless SchoolOS has actual authorized evidence of that verification.

### M7-G Teacher Eligibility

Use an operational validation workspace rather than a generic HR profile.

```text
Teacher | Employment | Required evidence | Policy version | Eligibility | Current assignments | Blocking issue
```

Inspector:

- active employment;
- applicable jurisdiction/school/post context;
- qualifications;
- teaching licence;
- active policy/evidence;
- level/subject requirements where applicable;
- eligibility decision and reason codes;
- affected current/future assignments;
- history.

Elevated overrides, if the active policy permits them, require visible reason/approval/audit context.

### M7-H Assignments & Professional Impact

Staff 360 should link professional eligibility to academic assignments without collapsing the concepts.

Show:

```text
Assignment | Academic year | Class/section | Subject | Effective dates | Eligibility state | Status
```

An assignment warning must identify the authoritative blocker rather than simply showing "No access".

### M7-I Staff Attendance

Dense daily/monthly attendance workspace with corrections and payroll-impact projection where enabled.

Do not treat payroll consumption of attendance as permission for Payroll users to see unrelated sensitive HR records.

### M7-J Leave & Academic Impact

Desktop split:

```text
Calendar / team availability      Request queue
```

Request inspector contains:

- entitlement/balance;
- overlap;
- reason/evidence;
- effective dates or partial day;
- approval history;
- affected timetable periods for teaching staff;
- substitution/coverage status;
- unresolved academic impact.

For teacher leave, approval is not presented as the end of the operational workflow when classes remain uncovered.

### M7-K Substitution Coverage

Today/period-oriented workspace:

```text
Period | Class | Subject | Absent teacher | Eligible substitutes | Assigned substitute | Coverage | Acknowledged
```

Candidate presentation should combine availability and server-provided eligibility/assignment authority. UI ranking never bypasses backend authorization.

### M7-L Compensation & Statutory Profile

Restricted workspace for effective-dated salary, allowances, deductions, payment/bank data, statutory membership and policy references.

Use a clear historical timeline. Do not silently overwrite prior compensation or statutory configuration after it has affected payroll.

### M7-M Payroll Readiness

Checklist matrix:

```text
Staff | Employment | Compensation | Attendance | Leave | Statutory/Tax | Bank | Policy | Ready
```

Blockers must be explicit. `Ready` means the configured prerequisites passed; it is not a statutory-compliance certification.

### M7-N Payroll Run

Lifecycle screen:

```text
Prepare → Validate → Review → Approve → Finalize → Accounting Post
```

At each stage show:

- employee count;
- gross/net totals;
- statutory/deduction summaries;
- blockers;
- changes since prior stage;
- policy/configuration version;
- authorized actions;
- accounting-post state.

M7 calculates and approves payroll obligations. Final approved liabilities/expenses post to M11 through controlled idempotent events. Do not create a second payroll ledger that competes with M11.

### M7-O Payslips

Batch table + individual detail/download. Avoid card-per-employee.

Payslip visibility remains self/scoped/authorized and must not expose other employees' compensation.

---

## M8 — Library

M8 may remain deferred under `AGENTS.md`.

**Primary job when activated:** issue/return resources quickly while preserving borrower, copy, reservation, overdue, and fine state.

### M8-A Circulation Desk

High-speed, keyboard/scanner-first.

```text
Borrower search / scan
Borrower status + active loans

Book/copy scan input
────────────────────────────────
Current transaction rows
────────────────────────────────
[Issue] / [Return]
```

Do not surround every borrowed item with large cards.

### M8-B Catalogue

Columns:

```text
Title | Author | ISBN/Code | Copies | Available | Reserved | Status
```

Book detail opens inspector with copy-level status.

### M8-C Overdue / Fines

Columns:

```text
Borrower | Item | Due | Days overdue | Fine | Contact/Resolution | Status
```

### M8-D Reservations

Queue ordered by availability and request age.

---

## M9 — Transport

M9 may remain deferred under `AGENTS.md`.

**Primary job when activated:** know what routes/trips are operating, who/what is assigned, and where operational exceptions exist.

### M9-A Transport Home

Two top-level tabs:

```text
Live / Today | Routes & Setup
```

### M9-B Live / Today

Two-column large-screen layout:

```text
LEFT 40%                         RIGHT 60%
Active trips                     Map / selected route
Delayed trips
Incidents
GPS unavailable/stale
```

Each trip row shows last location timestamp. Stale location must be explicit.

### M9-C Routes

Route list + route detail.

Route detail combines ordered stops with map.

### M9-D Student Assignments

Dense table:

```text
Student | Class | Route | Pickup stop | Drop stop | Status
```

Bulk assignment allowed only where safe.

### M9-E Fleet

```text
Vehicle | Registration | Driver | Capacity | Documents | Maintenance | Status
```

### M9-F Trips

Timeline/status table with exceptions; not consumer ride-tracking styling.

---

## M10 — Canteen

M10 may remain deferred under `AGENTS.md`.

**Primary job when activated:** serve safely and quickly while maintaining entitlement, wallet, allergy, stock, and vendor truth.

### M10-A POS

High-speed two-column POS.

```text
LEFT 65%                         RIGHT 35%
Student/account lookup           Basket
Menu/search                      Allergy/entitlement alert
Items                            Wallet/balance
                                 Total
                                 [Complete sale]
```

Critical allergy warning must remain visible during transaction.

### M10-B Serving

Scan/queue layout optimized for throughput.

### M10-C Menu / Meal Plans

Week/calendar planner + structured item editor.

### M10-D Wallets

Ledger table:

```text
Date | Type | Reference | Debit | Credit | Balance | Status
```

### M10-E Inventory

```text
Item | On hand | Reorder level | Expiry | Vendor | Status
```

Low stock and expiry are exception indicators, not giant cards.

---

## M11 — Accounting & Finance

**Primary job:** preserve financial truth from source transaction through ledger, reconciliation, reporting, and audit lineage.

This module should use the **highest information density** in SchoolOS.

### M11-A Accounting Home

```text
PERIOD
Current fiscal period · Open

ATTENTION
12 unreconciled bank items
3 unposted journals
5 overdue receivables
2 payables due
1 posting failure

CASH & BANK
Account             Balance             Reconciled through
...

RECENT JOURNALS
```

### M11-B Chart of Accounts

Tree table:

```text
Code | Account | Type | Parent | Balance | Status
```

Expandable hierarchy. Avoid tiles.

### M11-C Journals

Register:

```text
Journal # | Date | Source | Description | Debit | Credit | Status | Posted by
```

Inspector shows lines, source, approvals, audit.

### M11-D Journal Entry

Full-width editor with line table.

```text
Account | Description | Debit | Credit | Dimension/Reference
```

Sticky totals footer:

```text
Total Debit | Total Credit | Difference
```

Primary `Post` disabled until balanced and valid.

### M11-E Cash & Bank

Account selector + chronological ledger.

### M11-F Reconciliation

Split-pane:

```text
BANK STATEMENT                         SCHOOLOS LEDGER
unmatched rows                         candidate matches
```

Selected match panel below/right shows amount/date/reference confidence and final match control.

### M11-G Receivables / Payables

Aging-first tables with due bucket filters.

### M11-H Fiscal Periods

Timeline/table:

```text
Period | Opened | Status | Close blockers | Closed by | Reopen state
```

Closing/reopening requires consequence summary and authorization.

### M11-I Reports

Financial report viewer should resemble professional accounting software.

- strong column alignment;
- period comparison;
- expand/drill-down;
- print/export;
- source trace.

Every figure should drill through:

```text
Statement → line → account → ledger → journal/voucher → source transaction → approval/document
```

---

## M12 — Notifications & Delivery

**Primary job:** show delivery truth, surface failures, and support safe retries without duplicating notice-authoring responsibility.

### M12-A User Inbox

Simple message list.

Columns/row content:

```text
Read state | Title | Source | Time | Context
```

No operational provider details for normal users.

### M12-B Delivery Operations

Dense observability table:

```text
Message/Notice | Recipient | Channel | Provider | State | Attempts | Last attempt | Failure
```

Top filter strip:

- channel;
- provider;
- state;
- age;
- source module.

### M12-C Failure Queue

Queue + inspector with safe retry action.

Inspector contains:

- recipient;
- payload/source reference;
- provider state;
- failure reason;
- retry history;
- next allowed action.

### M12-D Preferences

Compact grouped settings form; no dashboard layout.

---

## M13 — Learning Layer

M13 is frozen/disabled by default under `AGENTS.md`.

Do not surface it in active navigation or redesign it into prominence merely because routes exist.

If explicitly reactivated later:

- authoring uses Composer pattern;
- sessions use operational list/timeline;
- progress uses class/student matrix;
- attempt review uses split-pane learner list + attempt detail;
- resources use searchable library.

Avoid public ranking/gamification patterns.

---

## M15 — Notices & Announcements

**Primary job:** author the correct message, target the correct audience, obtain required approval, publish intentionally, and verify delivery.

### M15-A Notices Home

```text
[Create notice]

NEEDS ATTENTION
Awaiting approval 3
Failed delivery 2
Scheduled with issue 1

RECENT / SCHEDULED
Notice | Audience | Author | Publish time | Delivery | Status
```

### M15-B Notice Composer

Large desktop two-column layout.

```text
MAIN 65%                         SIDE 35%
Title                            Audience
Body                             Recipient count
Attachments                      Schedule
                                 Approval requirement
                                 Preview status
```

Flow:

```text
Content → Audience → Attachments → Schedule → Recipient Preview → Approval / Publish
```

Recipient preview should show counts and representative scope, not expose unnecessary personal data.

### M15-C Approval Queue

Columns:

```text
Notice | Author | Audience | Urgency | Submitted | Age | Status
```

Inspector shows complete content preview before decision.

### M15-D Notice Detail

Document-like reading surface with metadata header.

Below content:

- exact audience scope;
- version/correction state;
- acknowledgements summary;
- delivery summary;
- timeline.

Corrected, superseded, and withdrawn notices must be visually unmistakable.

### M15-E Delivery

Deep-link to M12 provider diagnostics rather than duplicating delivery-operational UI.

---

# 14. Cross-Module Reports & Exports

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

Recommended report catalogue layout:

```text
Search reports                       Favorites

FINANCE
Fee collection report
Trial balance
Income statement

ACADEMICS
Marks completion
Result summary

ATTENDANCE
Daily register
Monthly attendance
```

Opening a report should show parameter controls in a left/narrow panel and preview in the main area when feasible.

---

# 15. Tables

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

# 16. Forms

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

For forms longer than roughly one viewport, prefer either:

```text
Left section navigation | Main form
```

or a justified step flow.

Do not hide important fields behind decorative minimalism.

---

# 17. Status & Lifecycle UI

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

# 18. Low-Bandwidth Web UX

Design for real Nepal connectivity, not just complete offline/online extremes.

Default rules:

- paginate large datasets; typical default page size around 25–50 unless workflow evidence supports another value;
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

# 19. Responsive Design

Responsive behavior is **not a final-phase task**.

Every migrated slice must be designed and verified responsively before completion.

Inspect:

- 1440px;
- 1280px;
- 1024px;
- 768px;
- narrower windows where useful.

Rules:

- preserve desktop table/grid behavior as long as practical;
- use horizontal scroll for dense finance/marks/timetable tables rather than card conversion;
- inspector may become full-height sheet below desktop widths;
- two-column composer/review screens collapse to sequential sections;
- sticky critical actions remain reachable;
- global sidebar becomes compact/drawer as appropriate.

---

# 20. Accessibility

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

Data grids, marks entry, timetable builder, reconciliation, and attendance require explicit keyboard design rather than assuming ordinary tab order is sufficient.

---

# 21. Loading, Empty, Error, Permission & Disabled States

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

# 22. Dark Mode Decision

For the current redesign, **light mode is authoritative** unless the project owner explicitly expands scope.

Tokens and semantic components SHOULD remain compatible with future dark mode, but dark-mode implementation must not delay or destabilize the primary redesign.

---

# 23. Deferred Modules

Astra MAY visually normalize existing M8/M9/M10/M13 screens only when explicitly in scope or encountered as part of an authorized redesign task.

Astra MUST NOT reactivate, expand, or promote a deferred module through design work alone.

`AGENTS.md` remains authoritative.

---

# 24. Redesign Migration Strategy

## Phase 0 — Design-system audit and convergence

- inventory primitives;
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

Responsive, accessibility, loading/error/permission, and low-bandwidth checks are required inside every earlier phase.

---

# 25. Visual QA and Regression Protection

For broad design work:

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

Canonical visual-regression surfaces should include:

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

Prefer asserted Playwright visual baselines for these canonical views where practical, not screenshots captured only on failure.

---

# 26. Web Definition of Done

A Web design task is complete only when applicable items pass:

- page/workspace matches the persona and primary job-to-be-done;
- module-specific layout in this playbook is respected or intentionally improved with evidence;
- high-frequency actions are easy to find;
- interaction budget is reasonable;
- unnecessary navigation/context switching is reduced;
- canonical v2 primitives are used;
- no new overlapping primitive/design system introduced;
- cards used only where appropriate;
- module colors restrained and semantic colors correct;
- dense operational pages use tables/grids/queues rather than decorative cards;
- lifecycle/status semantics are consistent;
- loading/empty/error/permission/stale states are intentional;
- responsive behavior is verified in the same slice;
- keyboard/accessibility behavior is verified in the same slice;
- Nepali/English presentation remains sound;
- low-bandwidth behavior is acceptable;
- no authorization/security authority moved to the client;
- relevant tests/typecheck/lint/build pass;
- rendered output was inspected;
- canonical visual baseline updated/verified when applicable;
- no unrelated module scope expanded.

---

# Final Web Principle

SchoolOS Web should feel like **one intentionally designed operational product with purpose-built workspaces**, not a collection of module pages using the same generic dashboard/card template.

The existing application architecture is valuable and should be preserved.

The existing visual design is replaceable.

Design System v2 must remove the structural causes of the current card-heavy, module-colored inconsistency before broad module migration.

Each module must have a recognizable **job-specific interaction model** while still looking and behaving like SchoolOS.

`AGENTS.md` owns product/security/domain authority. This file owns the **Web-specific design and interaction discipline** within that authority.
