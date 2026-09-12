# SchoolOS Web Design — Astra Frontend Design & Execution Specification

## Purpose

This document has one purpose only:

> **Guide GPT-6 Astra when auditing, redesigning, implementing, visually verifying, and continuously improving the SchoolOS web application.**

This is not a backend roadmap, mobile-app specification, database document, finance specification, or general SchoolOS product roadmap.

It governs only the **SchoolOS web experience** and the frontend engineering decisions required to deliver that experience.

Astra should use its strongest capabilities here:

- repository-wide frontend inspection;
- visual hierarchy and UI judgment;
- information-architecture analysis;
- responsive redesign;
- reusable design-system construction;
- browser-based visual verification;
- interaction testing;
- accessibility review;
- screenshot comparison;
- frontend debugging;
- iterative implementation and QA.

The objective is not to make SchoolOS merely look modern.

The objective is to make SchoolOS feel like a **serious, polished, fast, coherent, high-trust school operating system** designed for frequent daily operational use.

---

# 1. Primary Design Objective

Redesign and continuously improve the SchoolOS web application so that it becomes:

- visually coherent;
- operationally efficient;
- information-dense without feeling crowded;
- easy to scan;
- easy to learn;
- role-aware;
- accessible;
- responsive;
- fast;
- predictable;
- professional;
- suitable for long daily work sessions;
- scalable as SchoolOS adds more functionality.

The web application must feel like one product.

It must **not** feel like dozens of independently designed module screens placed behind one sidebar.

Every page should visibly belong to the same SchoolOS design language.

---

# 2. Existing Frontend Context

The existing SchoolOS web application is built around:

- Next.js;
- React;
- TypeScript;
- Tailwind CSS;
- Radix UI primitives;
- Lucide icons;
- Motion;
- React Query;
- React Hook Form;
- Zod;
- Playwright.

Astra must improve the existing application instead of replacing proven frontend infrastructure without a clear reason.

Before introducing a new dependency, first determine whether the existing stack can solve the problem cleanly.

Prefer improving and consolidating existing primitives over introducing another overlapping UI framework.

---

# 3. Audit Before Redesign

Astra must **never begin a broad SchoolOS redesign by immediately editing CSS or replacing components**.

First inspect the existing frontend thoroughly.

Audit at minimum:

## Application structure

- routes;
- layouts;
- dashboard shells;
- classroom surfaces;
- platform surfaces;
- authentication surfaces;
- shared components;
- module components;
- loading boundaries;
- error boundaries;
- data-fetching patterns;
- forms;
- tables;
- drawers;
- dialogs;
- sheets;
- dropdowns;
- filters;
- search;
- pagination;
- exports;
- alerts;
- notifications.

## Visual system

- typography;
- font sizes;
- font weights;
- line heights;
- foreground hierarchy;
- background hierarchy;
- borders;
- shadows;
- radius values;
- spacing;
- page width;
- cards;
- tables;
- forms;
- buttons;
- badges;
- status colors;
- icons;
- charts;
- empty states;
- loading states.

## UX consistency

Identify where equivalent operations use different patterns.

Examples:

- page headers;
- create buttons;
- table filters;
- row actions;
- save actions;
- destructive actions;
- confirmation dialogs;
- date pickers;
- student selectors;
- class selectors;
- search boxes;
- pagination;
- status presentation;
- side panels;
- detail pages;
- activity history;
- audit history.

## Responsive behavior

Inspect major screens at representative widths such as:

- 1440px desktop;
- 1280px desktop;
- 1024px compact desktop/tablet landscape;
- 768px tablet;
- narrow browser windows where appropriate.

SchoolOS web is primarily a productivity application.

Do not destroy dense operational workflows simply to force every desktop table into an artificially mobile-looking layout.

Use responsive transformation intelligently.

## Accessibility

Audit:

- keyboard navigation;
- visible focus;
- semantic headings;
- labels;
- descriptions;
- error association;
- contrast;
- touch/click target size;
- screen-reader naming;
- dialogs;
- menus;
- tables;
- reduced motion;
- status indicators that rely only on color;
- accessible authentication.

## Visual QA

When browser tooling is available, Astra should render the actual application and inspect it visually.

Do not rely only on source-code assumptions.

The loop should be:

```text
Inspect source
→ Run page
→ Observe rendered result
→ Identify visual/interaction defects
→ Implement improvement
→ Re-render
→ Compare
→ Repeat until stable
```

---

# 4. SchoolOS Design Character

SchoolOS should look like a **premium operational system**, not a marketing website and not a generic AI-generated SaaS dashboard.

The intended character is:

- calm;
- confident;
- precise;
- modern;
- structured;
- trustworthy;
- understated;
- highly usable;
- institutionally appropriate.

The visual design should communicate:

> “This system manages important school operations accurately.”

It should not communicate:

> “This is a flashy startup landing page.”

---

# 5. Explicit Anti-Patterns

Astra must actively avoid the common AI-generated dashboard aesthetic.

Do not overuse:

- giant rounded cards;
- cards inside cards inside cards;
- gradients;
- glassmorphism;
- glowing borders;
- oversized hero sections;
- excessive shadows;
- decorative charts;
- huge page titles;
- excessive whitespace;
- unnecessary illustrations;
- random accent colors;
- colored icon boxes for every label;
- excessive pills;
- oversized KPI tiles;
- floating UI elements without operational purpose;
- animations that slow down routine work.

Avoid turning every data point into a card.

Prefer:

- good grouping;
- alignment;
- whitespace;
- dividers;
- typography hierarchy;
- tables;
- structured panels;
- contextual status;
- progressively disclosed detail.

---

# 6. Information Hierarchy

Every SchoolOS page should answer, in order:

1. **Where am I?**
2. **What is the current context?**
3. **What requires my attention?**
4. **What can I do here?**
5. **What information is most important?**
6. **Where do I go next?**

A page should not require visual searching to discover its primary action.

Astra should distinguish clearly between:

- page title;
- context;
- key status;
- primary action;
- secondary action;
- filters;
- content;
- metadata;
- history;
- destructive actions.

---

# 7. Web Persona Model

The web application must be designed around the work performed by each persona, not around the database modules.

Primary web personas are:

- Principal;
- Teacher;
- Admin;
- HR;
- Accountant.

The internal SchoolOS Platform is a separate control-plane experience and must remain visually and navigationally distinct from ordinary school workspaces.

Parent experience is primarily mobile-first and should not drive the SchoolOS staff web information architecture.

---

# 8. Persona Navigation Targets

Navigation should be task-oriented and role-aware.

Do not expose every enabled module to every persona merely because the module exists.

## Teacher Web

Recommended mental model:

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
Library / other enabled assigned tools
My Workspace
```

Teacher pages should be optimized around assigned classes, sections, subjects, and current work.

The web experience must not resemble an administrator dashboard with teacher permissions removed.

## Admin Web

Recommended mental model:

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
Operational Modules
Notifications
Notices
Reports
Settings
Audit
```

Admin screens need efficient bulk operations, filters, tables, data-quality indicators, configuration, and correction workflows.

## Principal Web

Recommended mental model:

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

Principal UI must prioritize **exceptions, trends, approvals, risk, and decision-making** instead of raw transactional work.

## HR Web

Recommended mental model:

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

HR screens should prioritize people records, employment state, deadlines, payroll preparation, and sensitive-data clarity.

## Accountant Web

Recommended mental model:

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

Accounting UI should use high information density, strong numerical alignment, reconciliation clarity, immutable-history visibility, and clear distinction between draft and posted records.

---

# 9. Application Shell

The SchoolOS shell is one of the highest-leverage design surfaces.

Astra should treat it as a system, not as decoration.

The shell should include a coherent strategy for:

- primary navigation;
- school identity;
- active academic year;
- active branch when applicable;
- global search where useful;
- notifications;
- user menu;
- breadcrumbs or contextual hierarchy;
- responsive collapse;
- module state;
- role context.

The sidebar should not become an endless list.

Use:

- grouping;
- progressive disclosure;
- persona-specific navigation;
- section labels when necessary;
- clear active states;
- consistent iconography;
- compact spacing.

Avoid deeply nested navigation unless the hierarchy genuinely requires it.

---

# 10. Page Header Standard

SchoolOS needs one consistent page-header model.

A typical page header may contain:

```text
Breadcrumb / Context
Page Title
Short contextual description or status
Secondary metadata
Primary action
Secondary actions
```

Not every page needs every element.

Avoid giant titles that consume valuable operational screen space.

On dense staff screens, compact headers are preferred.

---

# 11. Design System

Astra should progressively consolidate SchoolOS into reusable design primitives.

The design system should define at minimum:

## Foundation

- color tokens;
- typography tokens;
- spacing scale;
- radius scale;
- border colors;
- surface hierarchy;
- shadows;
- focus ring;
- motion durations;
- container widths;
- breakpoints;
- z-index strategy.

## Semantic colors

Do not make business meaning depend on arbitrary component colors.

Define semantic concepts such as:

- neutral;
- info;
- success;
- warning;
- danger;
- critical;
- disabled;
- pending;
- draft;
- published;
- locked.

Status colors must remain legible in both light and dark contexts if dark mode is supported.

## Core primitives

Consolidate components such as:

- Button;
- IconButton;
- Input;
- Textarea;
- Select;
- Combobox;
- DatePicker;
- Checkbox;
- RadioGroup;
- Switch;
- FormField;
- Badge;
- StatusBadge;
- Alert;
- Tooltip;
- Popover;
- DropdownMenu;
- Dialog;
- ConfirmDialog;
- Sheet;
- Tabs;
- Breadcrumb;
- Pagination;
- DataTable;
- EmptyState;
- ErrorState;
- LoadingState;
- Skeleton;
- PageHeader;
- FilterBar;
- Metric;
- SectionHeader;
- DetailList;
- Timeline;
- AuditTrail.

Do not create near-duplicate versions of the same primitive for every module.

---

# 12. Typography

Typography should optimize reading and scanning rather than visual novelty.

Use a disciplined hierarchy.

Recommended conceptual levels:

```text
Display / rare
Page title
Section title
Card/panel title
Body
Secondary body
Label
Metadata
Caption
```

Avoid using bold text everywhere.

Use weight strategically to create hierarchy.

Long tables and dense workflows require compact, highly legible text.

Numeric columns should align consistently.

Monetary values should be easy to compare vertically.

---

# 13. Spacing and Density

SchoolOS must support frequent professional use.

Therefore the design should be **comfortably dense**, not spacious like a consumer marketing product.

Astra should create predictable spacing rules instead of arbitrary page-specific spacing.

Use density according to context:

- dashboards: moderate;
- forms: moderate;
- data tables: compact;
- accounting: compact;
- profile/detail pages: moderate;
- settings: moderate;
- authentication: spacious but focused.

Allow dense screens to breathe through hierarchy and grouping rather than simply increasing padding everywhere.

---

# 14. Cards and Panels

Cards should represent meaningful grouping, not act as the default wrapper for all content.

Use a card when the content is conceptually independent or when the boundary improves comprehension.

Do not wrap:

```text
Page
→ Card
   → Section
      → Card
         → Table
```

unless the grouping genuinely requires it.

For major operational screens, a flat page with section dividers and well-structured panels is often superior.

---

# 15. Tables

Tables are critical to SchoolOS and must be treated as first-class product surfaces.

Astra should improve tables systematically.

Required qualities:

- clear column hierarchy;
- appropriate density;
- stable alignment;
- sticky headers where useful;
- horizontal overflow strategy;
- sorting;
- filtering;
- search;
- pagination;
- selection;
- bulk actions;
- row actions;
- empty state;
- loading state;
- error state;
- accessible headers;
- keyboard accessibility where practical;
- predictable action placement.

Avoid placing every row action as a visible button.

Use direct actions only for very common operations and overflow menus for secondary actions.

Important identifiers should remain visible during horizontal scroll where practical.

For large tables, preserve scan speed.

---

# 16. Forms

Forms should minimize cognitive load and errors.

Astra should:

- group related fields;
- avoid excessively long single-column forms when a better layout exists;
- use clear labels;
- use helper text only when necessary;
- display validation near the relevant field;
- preserve entered data when recoverable errors occur;
- distinguish required fields clearly;
- use sensible defaults;
- prevent destructive accidental submission;
- use searchable selectors for large datasets;
- avoid forcing users to memorize IDs;
- use step-based forms only when the process genuinely benefits from stages.

For major workflows such as admissions or school configuration, use progress and completion status rather than overwhelming users with one giant form.

---

# 17. Search and Filtering

Filtering should be consistent across modules.

Astra should design one common model for:

- quick search;
- common filters;
- advanced filters;
- active-filter visibility;
- filter count;
- reset;
- saved filters only if genuinely valuable;
- date ranges;
- class/section filters;
- academic-year context;
- status filters.

Do not hide frequently used filters inside a modal merely to make the screen visually minimal.

Operational efficiency takes priority over decorative minimalism.

---

# 18. Status Design

SchoolOS contains many lifecycle states.

Examples:

- draft;
- submitted;
- pending;
- approved;
- rejected;
- finalized;
- locked;
- published;
- failed;
- overdue;
- reversed;
- reconciled;
- synced;
- conflicted.

Status must be communicated by more than color.

Use:

- text;
- icon where appropriate;
- semantic color;
- tooltip or explanation for ambiguous states.

Avoid a rainbow of unrelated badge colors.

Use a coherent semantic status system across all modules.

---

# 19. Dashboards

A dashboard is not a gallery of KPI cards.

Every persona dashboard should prioritize:

1. attention;
2. pending work;
3. operational status;
4. exceptions;
5. recent changes;
6. useful trends.

Astra should challenge every dashboard widget:

> “What decision or action does this help the user make?”

If the answer is unclear, remove or redesign it.

Use charts only when visual comparison is faster than reading numbers.

Avoid decorative graphs.

---

# 20. Principal Experience

Principal web design should emphasize executive comprehension.

Prioritize:

- school health;
- high-risk attention items;
- approvals;
- missing attendance;
- academic readiness;
- financial exceptions;
- staff absence;
- communication failures;
- compliance reminders;
- drill-down.

The Principal should not need to navigate through operational module screens just to understand what needs attention today.

---

# 21. Teacher Experience

Teacher web design should optimize repeated daily work.

Prioritize:

- today's timetable;
- assigned classes;
- attendance due;
- homework;
- marks deadlines;
- recent submissions;
- class-level context;
- student lookup within assigned scope;
- quick transitions between related teaching tasks.

Teacher workflows should minimize clicks.

Do not make teachers repeatedly reselect academic year, class, section, and subject when the current context already establishes them.

Context should persist safely where appropriate.

---

# 22. Admin Experience

Admin web design should optimize operational control.

Admin interfaces frequently need:

- dense tables;
- bulk operations;
- configuration;
- search;
- corrections;
- queues;
- status tracking;
- data-quality review;
- exports;
- audit history.

Do not simplify the UI by hiding essential operational information.

Instead create hierarchy, sensible defaults, and progressive disclosure.

---

# 23. HR Experience

HR interfaces contain sensitive and complex information.

Prioritize:

- staff identity;
- employment status;
- leave;
- attendance;
- contracts;
- payroll readiness;
- document expiry;
- sensitive-field clarity;
- chronological history.

Salary information should never be visually mixed casually with general staff profile information.

Sensitive sections should be visibly distinct and access-aware.

---

# 24. Accountant Experience

Accounting surfaces require exceptional clarity.

Prioritize:

- numbers;
- dates;
- document references;
- debit/credit distinction;
- status;
- source module;
- posting state;
- reconciliation;
- immutable history;
- drill-down.

Financial tables should support rapid comparison.

Use consistent numeric alignment and number formatting.

Draft, posted, reversed, and reconciled states must never look interchangeable.

Important accounting actions should include appropriate confirmation and context.

---

# 25. Platform Control Plane

The SchoolOS Platform is not an extra menu inside the school dashboard.

Even if currently implemented in the same frontend application, it should have a clearly distinct experience.

Visually distinguish:

- platform identity;
- platform navigation;
- school tenant context;
- support access;
- cross-tenant operations;
- high-risk actions.

A Platform operator should always understand when they are operating at platform scope versus tenant scope.

Avoid making the Platform look like a School Admin dashboard with more menu entries.

---

# 26. Responsive Strategy

SchoolOS web is desktop-first for complex operational work but must remain responsive.

Astra should design each page intentionally across widths.

Do not mechanically stack everything vertically at narrower sizes.

Possible transformations include:

- sidebar → compact sidebar/drawer;
- multi-column detail view → prioritized single column;
- table → horizontally scrollable table with pinned key field;
- secondary metadata → collapsible detail section;
- toolbar → wrapped toolbar;
- side inspector → sheet;
- multiple controls → overflow action menu.

Critical actions must remain discoverable.

---

# 27. Loading States

Avoid generic full-page spinners wherever possible.

Prefer:

- skeletons for stable layouts;
- local loading indicators for local operations;
- button loading states for submissions;
- preserved previous data where safe;
- progressive loading for secondary information.

Users should understand whether:

- the entire page is loading;
- a section is loading;
- an action is being submitted;
- data is refreshing in the background.

---

# 28. Empty States

Empty states must explain the situation.

Differentiate:

- truly no data exists;
- no results match filters;
- user lacks access;
- module is disabled;
- setup is incomplete;
- an error occurred;
- data is unavailable.

Do not use the same generic “No data found” message for all cases.

Where appropriate, provide the next valid action.

---

# 29. Error States

Errors should be specific and actionable.

Avoid exposing raw backend errors to users.

Distinguish:

- validation error;
- permission error;
- expired session;
- network failure;
- server failure;
- module disabled;
- tenant unavailable;
- stale data/conflict;
- operation already completed.

Do not visually present a failed operation as success simply because optimistic UI already changed the screen.

---

# 30. Confirmation and Destructive Actions

Confirmation dialogs should be reserved for meaningful risk.

Do not ask users to confirm harmless actions repeatedly.

Use stronger confirmation for actions such as:

- publishing results;
- reopening locked records;
- reversing financial documents;
- deleting removable records;
- withdrawing notices;
- changing major configuration;
- high-impact bulk operations.

Confirmation UI should clearly state:

- what will happen;
- scope;
- affected records;
- reversibility;
- next state.

---

# 31. Motion

Motion should clarify transitions, not decorate the application.

Appropriate uses:

- drawer opening;
- dialog transition;
- subtle state transition;
- expandable sections;
- layout continuity;
- feedback after an action.

Avoid motion on routine data surfaces that delays work.

Respect reduced-motion preferences.

---

# 32. Icons

Use Lucide consistently unless there is a compelling reason otherwise.

Icons should support recognition but should not replace clear text for unfamiliar actions.

Avoid:

- multiple icons representing the same concept;
- icons selected only for decoration;
- icons inside colored rounded squares everywhere;
- icon-only destructive actions without labels/tooltips.

---

# 33. Dark Mode

If dark mode is maintained, it must be a deliberate system rather than a color inversion.

Verify:

- contrast;
- tables;
- borders;
- shadows;
- statuses;
- charts;
- focus rings;
- disabled states;
- dialogs;
- dropdowns;
- form fields;
- financial numbers.

Do not allow dark mode quality to block critical SchoolOS web usability work if it is not yet a production requirement, but avoid architectural decisions that make it impossible later.

---

# 34. Accessibility Target

Design toward WCAG 2.2 AA principles for priority workflows.

At minimum:

- keyboard navigation;
- visible focus;
- semantic landmarks;
- logical tab order;
- accessible labels;
- accessible validation;
- error summaries where appropriate;
- sufficient contrast;
- meaningful button names;
- screen-reader-friendly dialogs;
- table semantics;
- text scaling;
- non-color state communication;
- reduced motion;
- accessible authentication.

Accessibility must be included during implementation, not added as a final cosmetic pass.

---

# 35. Performance and Perceived Speed

A beautiful interface that feels slow is not acceptable.

Astra should consider:

- route-level payload size;
- unnecessary client components;
- avoidable rerenders;
- image optimization;
- lazy loading;
- code splitting;
- query deduplication;
- pagination;
- virtualization where warranted;
- skeletons;
- prefetching where useful;
- excessive animation;
- expensive charts;
- oversized component trees.

Do not solve visual problems by making the application heavier than necessary.

---

# 36. Design-System Refactoring Rules

When Astra finds visual inconsistency:

1. determine whether a shared primitive already exists;
2. improve the primitive when appropriate;
3. migrate affected screens incrementally;
4. avoid creating a second competing design system;
5. preserve existing business behavior;
6. add regression coverage where practical.

A redesign should reduce duplication over time.

It should not create another temporary UI layer on top of the old one.

---

# 37. Browser-Based Astra Workflow

When interactive browser capability is available, Astra should use it aggressively for frontend work.

For every significant redesigned surface:

```text
1. Inspect existing source
2. Understand workflow and persona
3. Run application
4. Capture baseline visual state
5. Identify hierarchy/usability problems
6. Implement changes
7. Reload and inspect
8. Test realistic data states
9. Test interaction states
10. Test responsive widths
11. Test keyboard navigation
12. Check console/runtime errors
13. Check visual regressions
14. Iterate until coherent
```

Do not declare a major visual redesign complete merely because TypeScript compiles.

---

# 38. Required UI State Matrix

For major screens Astra should consider, where applicable:

```text
Default
Loading
Refreshing
Empty
Filtered empty
Partial data
Error
Offline/network failure
Forbidden
Module disabled
Suspended tenant
Read-only
Draft
Pending
Submitted
Approved
Rejected
Locked
Completed
```

Not every page needs every state.

But each relevant state must be deliberately designed.

---

# 39. Visual Regression Mindset

When changing shared components, inspect downstream pages.

Examples:

- changing Button affects forms, dialogs, tables, authentication, and settings;
- changing Badge affects lifecycle states everywhere;
- changing page padding affects every module;
- changing table primitives affects dense accounting and admissions screens;
- changing sidebar width affects page layout across the entire app.

Astra should treat shared visual primitives as high-impact infrastructure.

---

# 40. Design Review Questions

Before finalizing a page, Astra should ask:

## Hierarchy

- Is the most important information visually obvious?
- Is the primary action obvious?
- Is secondary information visually quieter?

## Efficiency

- How many clicks does the common workflow require?
- Does the user repeatedly enter context that the system already knows?
- Are bulk actions available when appropriate?

## Clarity

- Are status and scope obvious?
- Are labels understandable without technical knowledge?
- Are error states actionable?

## Consistency

- Does this page use the same patterns as equivalent SchoolOS pages?
- Did this change introduce a new one-off component unnecessarily?

## Accessibility

- Can the primary workflow be completed with a keyboard?
- Are labels and focus visible?
- Is state communicated without relying only on color?

## Responsive behavior

- What happens at 1280px?
- What happens at 1024px?
- What information remains visible at narrower widths?

## Trust

- Does the screen make high-risk actions clearly different from routine actions?
- Can the user understand whether an action succeeded, failed, or remains pending?

---

# 41. Recommended Redesign Order

Do not redesign SchoolOS randomly page by page.

Use this order unless repository evidence shows a better dependency sequence.

## Phase 1 — Foundation

- audit visual system;
- audit information architecture;
- normalize design tokens;
- typography;
- spacing;
- surfaces;
- colors;
- buttons;
- inputs;
- badges;
- dialogs;
- tables;
- page headers;
- loading/error/empty patterns.

## Phase 2 — Application Shell

- sidebar;
- top bar;
- breadcrumbs/context;
- search;
- notifications;
- profile menu;
- responsive behavior.

## Phase 3 — Persona Dashboards

- Principal;
- Teacher;
- Admin;
- HR;
- Accountant.

## Phase 4 — High-Frequency Workflows

- attendance;
- students;
- admissions;
- homework;
- marks;
- timetable;
- fees;
- notices;
- approvals.

## Phase 5 — Dense Operational Workspaces

- HR;
- payroll;
- accounting;
- reconciliation;
- reports;
- audit;
- settings.

## Phase 6 — Platform Control Plane

Refine the Platform as a visually distinct internal operational system.

## Phase 7 — Cross-App QA

- consistency audit;
- responsive audit;
- accessibility audit;
- visual regression;
- keyboard audit;
- dark-mode audit if applicable;
- production build;
- Playwright regression.

---

# 42. Preservation Rules

Astra must not sacrifice functional correctness for visual improvement.

During redesign:

- preserve server-side authorization;
- preserve role/permission behavior;
- preserve form validation;
- preserve loading/error handling;
- preserve data contracts;
- preserve protected workflows;
- preserve module entitlement behavior;
- preserve auditability;
- preserve business-state transitions.

If a UI appears awkward because the underlying workflow is genuinely complex, improve the interaction model without bypassing the workflow.

---

# 43. Do Not Fake Product Completeness

Never add fake production data to make screenshots look better.

Never hide an unimplemented state behind decorative UI.

Never turn an unavailable operation into a working-looking button.

Never display success when the API has not confirmed success.

Never invent metrics or charts that are unsupported by actual data.

The visual design must accurately represent product state.

---

# 44. Coding Expectations for Design Work

Frontend implementation should remain:

- typed;
- modular;
- reusable;
- accessible;
- testable;
- maintainable;
- consistent with existing architecture.

Avoid:

- giant page components;
- repeated Tailwind strings when a semantic primitive is warranted;
- duplicated status mappings;
- inline magic values throughout modules;
- one-off components that duplicate shared behavior;
- unnecessary global CSS;
- deeply coupled presentational/business logic.

Prefer composition.

---

# 45. Testing Expectations

Testing should be proportional to the change.

## Component/design-system change

Verify:

- affected component behavior;
- relevant TypeScript/lint checks;
- affected screens;
- accessibility behavior;
- visual impact.

## Page redesign

Verify:

- route loads;
- data states;
- interactions;
- form behavior;
- responsive behavior;
- keyboard behavior;
- console/runtime errors.

## Shared shell/navigation redesign

Verify multiple personas and routes.

## Major system redesign

Run:

- frontend lint;
- frontend typecheck;
- production build;
- relevant unit tests;
- relevant Playwright tests;
- targeted browser QA.

Do not repeatedly run every repository test after every tiny visual edit.

---

# 46. Definition of Done for a Web Design Slice

A redesign slice is complete only when:

- the actual existing workflow was inspected first;
- the intended persona is clear;
- information hierarchy is improved;
- visual design is consistent with SchoolOS;
- shared primitives are used where appropriate;
- responsive behavior is deliberate;
- loading state is handled;
- empty state is handled;
- relevant error states are handled;
- accessibility was considered;
- no authorization/business behavior was weakened;
- the rendered page was visually inspected when tooling permits;
- interactions were verified;
- relevant checks pass;
- no obvious visual regression was introduced.

---

# 47. Astra Autonomy Rules

For web-design tasks Astra should operate autonomously within the requested scope.

Astra should:

- inspect before changing;
- infer reasonable design details from existing product context;
- use existing patterns when they are good;
- replace inconsistent patterns when there is a clear better system;
- continue through related frontend issues discovered within the requested slice;
- verify its own work;
- iterate visually instead of stopping after the first implementation.

Astra should not stop solely because a page is large or the redesign touches multiple related components.

It should stop or report a blocker only when an actual dependency or missing requirement prevents safe progress.

---

# 48. Final Product Standard

The target SchoolOS web experience should feel comparable to a mature professional operating platform used every day by real institutions.

It should be:

- less decorative than a consumer app;
- more refined than a generic admin template;
- more coherent than a collection of ERP modules;
- easier to scan than a traditional school MIS;
- safer and clearer than a spreadsheet-driven workflow;
- efficient enough for experienced staff;
- understandable enough for new staff;
- visually consistent enough that new modules naturally fit the system.

The final standard is not:

> “Does this screen look better than before?”

The final standard is:

> **“Does SchoolOS now behave and feel like one carefully designed, production-grade web operating system?”**

That is the benchmark Astra should use for every SchoolOS web-design decision.
