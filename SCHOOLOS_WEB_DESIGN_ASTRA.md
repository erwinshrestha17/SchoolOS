# SchoolOS Web Design — Astra Frontend Design & Execution Playbook

## Authority

This file is a **scoped Web design and frontend execution playbook** for SchoolOS.

It applies to:

- `apps/web`
- SchoolOS tenant-facing web UX
- SchoolOS Platform web UX when explicitly in scope
- Web-specific design-system, accessibility, responsiveness, and visual QA work

This file is **not** an independent repository source of truth.

`AGENTS.md` remains authoritative for:

- product scope;
- Nepal-only roadmap boundaries;
- personas and access boundaries;
- module status;
- tenant isolation;
- authentication/authorization;
- financial/accounting rules;
- compliance;
- protected data;
- offline boundaries;
- backend authority;
- release and verification policy.

If this playbook conflicts with `AGENTS.md`, **`AGENTS.md` wins**.

This playbook may refine the Web experience only within those boundaries.

---

# 1. Purpose

Guide GPT-6 Astra/Codex when auditing, redesigning, implementing, visually verifying, and continuously improving the SchoolOS web application.

Use Astra's strengths in:

- repository-wide frontend inspection;
- visual hierarchy and UI judgment;
- information architecture;
- responsive redesign;
- reusable design-system construction;
- browser-based verification;
- interaction testing;
- accessibility review;
- screenshot comparison;
- frontend debugging;
- iterative visual QA.

The goal is not merely to make SchoolOS look modern.

The goal is to make it feel like a **serious, polished, fast, coherent, high-trust school operating system** suitable for frequent daily work.

---

# 2. Web Product Role

Web is the primary surface for:

- dense operational work;
- configuration;
- bulk operations;
- high-volume tables;
- detailed corrections;
- governance;
- reporting;
- exports;
- audit history;
- financial operations;
- HR operations;
- administrative workflows.

Do not redesign Web as if it were a large mobile app.

Mobile remains the preferred surface for frequent, time-sensitive, one-handed workflows as defined by `AGENTS.md` and `SCHOOLOS_APP_DESIGN_ASTRA.md`.

---

# 3. Existing Frontend Context

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

Astra should improve and consolidate the existing frontend before introducing replacement frameworks or overlapping dependencies.

Prefer one coherent component system over parallel UI stacks.

---

# 4. Astra Execution Sequence

For broad Web redesign or UX work:

```text
Read AGENTS.md
    ↓
Read this playbook
    ↓
Inspect routes/layouts/components
    ↓
Map personas and workflows
    ↓
Audit existing design primitives
    ↓
Run the actual application
    ↓
Inspect rendered screens
    ↓
Identify systemic problems
    ↓
Refine shared design system
    ↓
Improve high-value flows
    ↓
Migrate remaining screens consistently
    ↓
Run responsive/accessibility QA
    ↓
Run targeted tests/build checks
    ↓
Re-render and verify
```

Do not begin a broad redesign by randomly editing CSS.

Prefer systemic fixes over isolated page patches.

---

# 5. Product Character

SchoolOS Web should feel:

- calm;
- precise;
- modern;
- structured;
- trustworthy;
- operational;
- information-efficient;
- institutionally appropriate;
- consistent across modules.

It should communicate:

> “This system manages important school operations accurately.”

It should not resemble a flashy marketing site or generic AI dashboard.

---

# 6. Explicit Anti-Patterns

Avoid excessive:

- gradients;
- glassmorphism;
- glowing borders;
- giant rounded cards;
- nested cards;
- oversized page titles;
- hero sections inside operational screens;
- decorative charts;
- huge KPI tiles;
- excessive whitespace;
- random accent colors;
- colored icon boxes for every label;
- unnecessary animations;
- floating decorative UI.

Do not turn every data point into a card.

Prefer:

- hierarchy;
- typography;
- alignment;
- grouping;
- dividers;
- compact tables;
- structured panels;
- progressive disclosure;
- semantic status.

---

# 7. Shared SchoolOS Cross-Surface Contract

Web must share the same product semantics as Mobile for:

- terminology;
- business-state names;
- semantic status meaning;
- success/warning/error/critical semantics;
- Nepali + English quality;
- accessibility principles;
- sensitive-data treatment;
- identity context;
- date/time/currency meaning;
- loading/error/empty-state language principles;
- icon meaning for equivalent concepts.

Web does **not** need pixel parity with Mobile.

Web-specific patterns are expected where appropriate:

- sidebars;
- multi-column layouts;
- dense tables;
- keyboard-oriented workflows;
- bulk actions;
- desktop forms;
- hover/focus interactions.

Never copy mobile navigation patterns to Web merely for consistency.

---

# 8. Persona Design

Primary Web personas:

- Principal;
- Teacher;
- Admin;
- HR;
- Accountant.

Platform Operator is a separate control-plane identity/surface.

Parent is mobile-first and should not drive staff Web information architecture.

## Teacher

Optimize around assigned work:

```text
Home
My Students
Attendance
Homework
Assessments & Marks
Activities
Timetable
Class Reports
Notices
Notifications
My Workspace
```

Teacher Web must not feel like an Admin dashboard with permissions removed.

## Admin

Optimize around school operations:

```text
Dashboard
Admissions
Students
Attendance
Fees
Academics
Activities
Homework
Timetable
Staff
Notifications
Notices
Reports
Settings
Audit
```

## Principal

Optimize around exceptions and decisions:

```text
Executive Dashboard
Attention Items
Approvals
Students & Admissions
Attendance
Finance Overview
Academic Readiness
Staff Overview
Operations
Communication
Reports
Audit
```

## HR

Optimize around staff lifecycle and payroll preparation:

```text
HR Dashboard
Staff
Contracts
Attendance
Leave
Payroll
Payslips
Reports
Documents
HR Notices
Settings
```

## Accountant

Optimize around numerical clarity and reconciliation:

```text
Finance Dashboard
Fees & Receipts
Cashier Close
Reconciliation
Accounting
Payroll Posting
Source Module Posting
Reports
Finance Notices
Audit
```

These are design targets, not authorization grants. Backend authorization remains authoritative.

---

# 9. Platform Surface

The internal SchoolOS Platform must remain visually and navigationally distinct from tenant school workspaces.

Design separation should reinforce, not blur, the security-domain separation defined in `AGENTS.md`.

Do not place Platform controls into ordinary school sidebars.

Do not visually imply that a Principal/Admin can access Platform functionality.

---

# 10. Application Shell

The shell should provide a coherent strategy for:

- school identity;
- active academic year;
- active branch when applicable;
- role context;
- primary navigation;
- global/contextual search;
- notifications;
- user/security menu;
- breadcrumbs/context;
- responsive collapse;
- entitlement/module state.

Avoid an endless sidebar.

Use grouping, progressive disclosure, clear active states, restrained iconography, and compact spacing.

---

# 11. Page Structure

Every page should answer:

1. Where am I?
2. What is the current context?
3. What requires attention?
4. What can I do here?
5. What matters most?
6. What happens next?

Standard hierarchy:

```text
Context / Breadcrumb
Page title
Relevant status / description
Primary action
Secondary actions
Filters / controls
Main content
Supporting detail
History / audit when relevant
```

Do not use giant headers on dense operational pages.

---

# 12. Design System

Converge toward explicit reusable tokens and primitives.

## Foundation

Define/normalize:

- color roles;
- typography roles;
- spacing scale;
- radius scale;
- borders;
- surface hierarchy;
- shadows;
- focus ring;
- motion durations;
- breakpoints;
- container widths;
- z-index strategy.

## Semantic states

Use shared SchoolOS semantics such as:

- neutral;
- information;
- success;
- warning;
- danger/critical;
- disabled;
- draft;
- pending;
- submitted;
- finalized;
- locked;
- published;
- reversed;
- failed;
- conflicted.

Never rely on color alone.

## Core primitives

Prefer shared components for:

- Button/IconButton;
- inputs/select/combobox;
- DatePicker;
- FormField;
- Badge/StatusBadge;
- Alert;
- Tooltip/Popover;
- DropdownMenu;
- Dialog/ConfirmDialog;
- Sheet;
- Tabs;
- Breadcrumb;
- Pagination;
- DataTable;
- EmptyState;
- ErrorState;
- LoadingState/Skeleton;
- PageHeader;
- FilterBar;
- SectionHeader;
- DetailList;
- Timeline;
- AuditTrail.

Do not create module-specific near-duplicates without a real need.

---

# 13. Typography and Density

Typography must optimize scanning and long work sessions.

Use disciplined hierarchy and restrained weight.

Density guidance:

- dashboards: moderate;
- forms: moderate;
- tables: compact;
- accounting: compact;
- details/profiles: moderate;
- settings: moderate;
- authentication: focused and somewhat spacious.

Do not solve poor hierarchy by adding padding everywhere.

Numeric and monetary columns should align consistently.

Nepali/Devanagari text must receive equivalent quality and spacing consideration.

---

# 14. Tables

Tables are first-class SchoolOS surfaces.

Required qualities:

- stable alignment;
- clear headers;
- appropriate density;
- search/filter/sort;
- pagination;
- row selection when useful;
- bulk actions where appropriate;
- row actions;
- empty/loading/error states;
- sticky headers where useful;
- horizontal overflow strategy;
- accessible headers;
- keyboard usability where practical.

Use visible buttons only for common row actions; secondary actions may use overflow menus.

Preserve important identifiers during horizontal scrolling where practical.

---

# 15. Forms

Forms should:

- group related fields;
- use explicit labels;
- use clear helper text only when needed;
- keep validation close to fields;
- preserve entered data after recoverable errors;
- distinguish required fields;
- use searchable selectors for large datasets;
- avoid exposing internal IDs;
- prevent accidental destructive submission;
- use staged flows only when they materially reduce complexity.

Large workflows should show progress/completion state rather than one overwhelming form.

---

# 16. Search and Filtering

Use one coherent model for:

- quick search;
- common filters;
- advanced filters;
- active-filter visibility;
- filter count;
- reset;
- date range;
- academic year;
- class/section;
- status.

Do not hide high-frequency filters merely to achieve decorative minimalism.

Operational efficiency wins.

---

# 17. Status and Lifecycle UI

Lifecycle states must be represented consistently across modules.

Examples:

- draft;
- submitted;
- pending;
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
- conflicted.

Use text + semantic color + icon/explanation when useful.

Do not invent module-specific colors for the same meaning.

---

# 18. Dashboards

A dashboard is not a gallery of KPI cards.

Prioritize:

1. attention;
2. pending work;
3. operational status;
4. exceptions;
5. recent changes;
6. useful trends.

Every widget should answer:

> What decision or action does this help the user make?

Remove or redesign widgets that cannot answer that question.

Principal dashboards should prioritize risk and exceptions.
Teacher dashboards should prioritize assigned work.
Admin dashboards should prioritize operational completeness.
HR dashboards should prioritize staff lifecycle/action items.
Finance dashboards should prioritize reconciliation and financial exceptions.

---

# 19. Loading, Empty, Error, Permission, and Disabled States

Every meaningful screen must intentionally handle:

- loading;
- empty;
- API failure;
- no permission;
- disabled module;
- suspended tenant where applicable;
- stale data where relevant;
- partial failure where relevant.

Never present unauthorized state as empty data.

Never present failed data as zero.

Provide recoverable next actions where possible.

---

# 20. Responsive Design

Inspect at representative widths such as:

- 1440px;
- 1280px;
- 1024px;
- 768px;
- narrower windows where useful.

SchoolOS Web is a productivity application.

Do not convert every desktop table into cards merely because the viewport narrows.

Use:

- column prioritization;
- horizontal scroll;
- responsive panels;
- compact controls;
- collapsible navigation;
- adaptive form grids.

Preserve operational efficiency.

---

# 21. Accessibility

Target strong WCAG-aligned behavior.

Audit:

- keyboard navigation;
- visible focus;
- semantic headings;
- labels/descriptions;
- error association;
- contrast;
- click/touch target size;
- screen-reader naming;
- dialogs/menus;
- tables;
- reduced motion;
- status not based on color alone;
- accessible authentication.

Accessibility must be tested in priority flows, not only inferred from components.

---

# 22. Deferred Modules and Scope

Astra may visually normalize existing deferred-module screens when they are directly encountered in an explicitly scoped task.

Astra MUST NOT reactivate, expand, or promote deferred modules merely because their UI exists.

P0 scope restrictions in `AGENTS.md` remain authoritative.

---

# 23. Visual QA

When browser tooling is available:

```text
Inspect source
→ Run page
→ Observe rendered result
→ Identify visual/interaction defects
→ Implement
→ Re-render
→ Compare
→ Repeat
```

Do not rely only on source assumptions.

For changed high-value flows, inspect:

- primary desktop width;
- compact width;
- focus/keyboard behavior;
- loading/empty/error states;
- dark mode if supported;
- long content;
- Nepali text where applicable.

---

# 24. Verification

This playbook inherits the verification hierarchy in `AGENTS.md`.

For Web UI-only changes, usually run:

- targeted tests;
- relevant Playwright tests;
- typecheck;
- lint;
- production build when impact justifies it;
- rendered visual inspection;
- responsive/accessibility checks.

If the design task changes client logic, contracts, routing, auth, finance, permissions, or state handling, escalate verification according to `AGENTS.md`.

Visual QA alone is never sufficient for security- or data-sensitive changes.

---

# 25. Web Definition of Done

A Web design task is complete only when applicable items pass:

- visual hierarchy is coherent;
- page behavior fits the persona/workflow;
- shared primitives are used consistently;
- equivalent states look/behave consistently;
- loading/empty/error/permission states are intentional;
- responsive behavior is verified;
- keyboard/accessibility behavior is checked;
- Nepali/English presentation remains sound;
- no authorization/security rule was moved to the client;
- relevant tests/typecheck/lint/build pass;
- actual rendered output was inspected for broad design work;
- no unrelated module scope was expanded.

---

# Final Web Principle

SchoolOS Web should behave and feel like **one intentionally designed, production-grade operational system**, not a collection of independently styled modules.

Use this playbook together with `AGENTS.md`.

`AGENTS.md` owns product/security/domain authority. This file owns the **Web-specific design and frontend execution discipline** within that authority.
