# SchoolOS Web Design System

**Status:** Active design-system guidance for `apps/web`.

**Source:** Derived from the SchoolOS Web Frontend Design Plan.

**Purpose:** Give Next.js implementers and Codex a stable web UI/UX standard for SchoolOS dashboard, settings, platform, reports, protected files, and dense school operation workspaces.

---

## 1. Web Design North Star

SchoolOS web is the daily command center for Nepal schools.

It should feel like:

```text
A school operating desk.
```

It must not feel like:

```text
A generic ERP.
A decorative dashboard template.
A shortcut wall.
A fake demo UI.
A technical admin console for non-technical school users.
```

Core design principle:

```text
One screen = one main job.
```

Every web screen must answer these three questions within 10 seconds:

```text
1. Where am I?
2. What needs my attention?
3. What can I safely do here?
```

A good SchoolOS screen has:

- A clear page title.
- A short school-friendly purpose line.
- One primary action.
- Secondary actions under `More Actions`.
- Real backend data or an honest unavailable/empty state.
- Permission-safe visibility.
- Clear next action.
- No fake numbers.
- No hidden financial or student-data risk.

---

## 2. Web Surface Boundaries

SchoolOS web has three major planes.

| Plane | Route family | User | Purpose |
|---|---|---|---|
| School Operations | `/dashboard/*` | School staff | Daily school workflows. |
| Tenant Configuration | `/dashboard/settings/*` | School admin / authorized roles | One school's configuration. |
| Platform Control Plane | `/platform/*` | SchoolOS operator / platform admin | SaaS tenant, provider, queue, support, and platform operations. |

Rules:

- School Operations must never expose platform-only controls.
- School Settings must not become SaaS billing/platform configuration.
- Platform must not expose tenant-private data unless explicit audited support override is active.
- School fee collection is not SchoolOS SaaS billing.
- M11 Accounting is a school accounting module, not a platform billing microservice.

---

## 3. Non-Negotiable Web Guardrails

### 3.1 Security and tenant isolation

- Keep `tenantId` as the tenant boundary everywhere.
- Backend RBAC, tenant scope, module entitlement, and route guards are the source of truth.
- Frontend hiding is only UX; it is never security.
- Every API call must rely on authenticated session context and backend authorization.
- Do not expose internal IDs unless the existing API contract already safely exposes them for UI routing.
- Never expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session web routes must use purpose-limited data, not admin-shaped payloads.

### 3.2 Data truth

- Real APIs only.
- No fake frontend data.
- No placeholder production metrics.
- No browser-only production state.
- No client-side money truth.
- No client-calculated official attendance/fees/payroll/accounting totals.
- Growing lists must be paginated and filtered server-side.
- Dashboard summaries may show unavailable states if a summary API is missing.

### 3.3 Protected files

Protected files include:

```text
Receipts
Cashier close PDFs
Report cards
Payscale/payroll slips
Student documents
Student photos
School logo where private
Activity media
Notice attachments
Homework attachments
Learning resources
Accounting reports
Exports and snapshots
Generated documents
```

Rules:

- Use File Registry-backed authenticated helpers.
- Use `ProtectedFileButton`, `ProtectedFileLink`, or shared blob/download helpers.
- Do not use raw `window.open` for private file URLs.
- Do not persist raw signed URLs in client state beyond the immediate action.
- File unavailable, permission denied, expired, or missing states must be friendly and safe.

### 3.4 Architecture boundaries

- Keep Next.js in `apps/web`.
- No Angular migration.
- No microservices.
- No AI runtime or M11 UI until explicitly approved.
- Keep SchoolOS as a modular monolith from the frontend user's point of view.
- Cross-module UI aggregation must call defined APIs, not invent backend shortcuts.

---

## 4. UX Language

SchoolOS is used by real school staff, not just technical users.

Use school-friendly copy:

```text
Save failed. Please check the highlighted fields.
You do not have permission to reverse payments. Please contact the school administrator.
This module is not enabled for this school.
Receipt download is unavailable right now.
Attendance is locked for this date.
This report is being prepared. You can download it when it is ready.
```

Avoid exposing technical copy:

```text
403 Forbidden
Mutation failed
Unhandled exception
PrismaClientKnownRequestError
Entity not found
Invalid payload
Object key missing
```

Prefer school terms:

| Prefer | Avoid |
|---|---|
| Student | Entity |
| Guardian | Relation object |
| Receipt | Payment artifact |
| Class / Section | Group / Subgroup |
| Staff | Employee entity |
| School Settings | Tenant config |
| Platform | Super admin module |
| Not enabled | Unauthorized module |

---

## 5. Visual Direction

### 5.1 Look and feel

- Calm light app background.
- White cards, tables, panels, and drawers.
- Soft blue-grey page background.
- Himalayan blue identity: brand blue for actions, deep navy for authority.
- Rounded cards and panels, generally 16-24px radius.
- Subtle borders and shadows only where hierarchy requires it.
- Clear typographic hierarchy.
- Charts only when they help decisions.
- No decorative gradients as the main UI language.
- No crowded dashboard cards.

### 5.2 Base tokens

One unified SchoolOS visual system with restrained module accents. The shell,
buttons, tables, forms, typography, and semantic states stay consistent
everywhere; module colours say **where you are**, never what a status means.

| Token | Value | Usage |
|---|---:|---|
| `brand.navy` | `#17324D` | Logo, important headings, authority accents. |
| `brand.primary` | `#2563EB` | Primary actions, links, active controls. |
| `brand.primaryDark` | `#1D4ED8` | Hover and pressed states, active nav label. |
| `brand.primarySoft` | `#EAF2FF` | Brand tint: selected navigation and filters. |
| `brand.teal` | `#168C8C` | Dashboard Home accent, chart series 3. |
| `brand.marigold` | `#E2A126` | Restrained attention indicator, chart series 5. |
| `surface.app` | `#F4F7FB` | Main page background. |
| `surface.card` | `#FFFFFF` | Cards, forms, tables, drawers. |
| `surface.sidebar` | `#F8FAFC` | Light navigation shell. |
| `surface.hover` | `#F7F9FC` | Neutral row hover. |
| `border.default` | `#DDE4EC` | Cards, fields, separators. |
| `text.primary` | `#172033` | Headings and important data. |
| `text.secondary` | `#667085` | Descriptions and metadata. |
| `text.muted` | `#98A2B3` | Timestamps and placeholders. |

Semantic colours indicate system meaning and never change by module
(each has main / pale background / dark text):

| Meaning | Main | Pale | Dark text |
|---|---:|---:|---:|
| Success | `#27875A` | `#EAF7F0` | `#17633E` |
| Warning | `#D99016` | `#FFF6DF` | `#82580B` |
| Danger | `#D14343` | `#FDECEC` | `#9D2929` |
| Information | `#2878C8` | `#EAF3FC` | `#1F5E9B` |
| Neutral | `#667085` | `#F2F4F7` | `#475467` |

A module accent must never replace semantic meaning: green does not mean
Canteen, orange does not mean Transport delay, gold does not mean payment
succeeded. High-risk workflows (reversals, corrections, approvals) use
semantic colours and visually override module identity.

### 5.3 Module accents

Module accents identify location. Each has an accent, a pale tint
(`--color-mod-*-soft`), a tinted border, and dark accent text; the accent
should occupy no more than roughly 5-8% of a page. Primary actions remain
brand blue everywhere. The selected row, active tab, and active filter share
the same module tint.

| Area | Accent | Pale tint | Dark text |
|---|---:|---:|---:|
| Dashboard Home (core identity) | `#2563EB` | `#EAF2FF` | `#1D4ED8` |
| M0 Platform Core | `#465577` | `#EEF1F7` | `#2D3852` |
| M1 Admissions / Students | `#2F80ED` | `#EBF4FF` | `#1E5FAE` |
| M2 Attendance | `#0F8B8D` | `#E8F7F6` | `#0B6567` |
| M3 Fees / Receipts | `#C88716` | `#FFF6DF` | `#805509` |
| M4 Academics | `#5B5BD6` | `#EFEEFF` | `#3F3FA5` |
| M5 Activity Feed | `#D56B5D` | `#FFF0ED` | `#9E4C42` |
| M6 Homework / Timetable | `#7357C8` | `#F3EFFF` | `#513D91` |
| M7 HR / Payroll | `#4B6B88` | `#EEF3F7` | `#365067` |
| M8 Library | `#3F7C68` | `#EDF6F2` | `#2B5A4B` |
| M9 Transport | `#D46A1F` | `#FFF1E7` | `#994915` |
| M10 Canteen | `#6E8B3D` | `#F3F7E9` | `#4E642A` |
| M11 Accounting | `#234B70` | `#EAF1F7` | `#183752` |
| M12/M15 Notices / Communication | `#B24C7A` | `#FBEFF5` | `#803656` |
| M13 Learning | `#2C91B7` | `#E9F7FC` | `#1F6986` |
| M14 Intelligence (roadmap labels only) | `#6B5AB5` | `#F2EFFE` | `#493D80` |
| Reports | `#168C8C` | `#E7F4F4` | `#0F6666` |
| Settings | `#667085` | `#F2F4F7` | `#475467` |

Charts use a controlled sequence — module accent, brand blue, teal, slate,
marigold (`--chart-1` … `--chart-5`) — and switch to semantic warning/danger
for negative or alert data. No rainbow charts; prefer about three series.

**How module accents reach pages:** the authenticated shells stamp
`data-module="<slug>"` on the workspace container (route mapping in
`lib/module-theme.ts`); `globals.css` maps that attribute onto the generic
`--mod-accent` / `--mod-soft` / `--mod-border` / `--mod-text` slots, which
fall back to the brand tint when unscoped. Shared primitives consume the
slots — active `WorkspaceTabs` tab and its count badge, selected table rows,
the `ModuleHeader` eyebrow, and the opt-in `tone="module"` icon chip on
`SummaryCard`. New module-coloured treatments should consume `--mod-*`
rather than hardcoding a specific module's tokens.

### 5.4 Typography

- **Inter** for English, numbers, tables, and general interface text;
  **Noto Sans Devanagari** for Nepali text; system sans-serif as the final
  fallback. Both load via `next/font` in the root layout only.
- Web scale (named utilities exist in `globals.css`): page title 28/36 700
  (`text-page-title`), section heading 20/28 600 (`text-section`), card
  heading 16/24 600 (`text-card-title`), body 14/22 400 (`text-body`), form
  label 13/18 600 (`text-form-label`), helper 12/18 400 (`text-helper`),
  large KPI value 28-32/36 700 (`text-kpi`).
- Do not reduce important operational text below 12px; dense tables may use
  13px but names, amounts, statuses, and row actions stay readable.
- Money, marks, counts, and receipt numbers use tabular numerals (applied to
  tables globally); money and numeric totals right-align in tables.
- Sentence case for labels and headings; official abbreviations (NPR, PAN,
  CAS, QR, SMS, PDF, iEMIS, GPA) stay uppercase.

---

## 6. Global Layout System

The standard authenticated school web layout is:

```text
Topbar
Left Sidebar
Page Header
Context Bar / Filters
Summary / KPI Strip
Main Work Area
Optional Right Panel / Drawer
Sticky Action Bar only for multi-step or review flows
```

### 6.1 Topbar

Topbar contains global context only:

- SchoolOS identity.
- School switcher where the user has access to multiple schools.
- Academic year switcher where academic-year context matters.
- Global search.
- Notification center.
- Support override banner if active.
- User menu.

Topbar must not contain module-specific primary actions except global search and notifications.

### 6.2 Sidebar

Recommended navigation groups:

```text
Home

Students
  Admissions
  Guardians

Daily Operations
  Attendance
  Fees
  Communications
  Activity Feed

Academics
  Exams & Report Cards
  Homework & Timetable
  Learning

School Operations
  Library
  Transport
  Canteen

Staff & Finance
  HR & Payroll
  Accounting

Reports

System
  Settings
```

Rules:

- Sidebar is navigation only.
- No KPIs in the sidebar.
- No action buttons in the sidebar except safe navigation.
- No finance amounts in the sidebar.
- No student private data in the sidebar.
- Locked modules may show a subtle lock indicator.
- Direct locked route access still shows a full `ModuleLockedState`.
- Do not show implementation-phase names in navigation.

---

## 7. M12 Notifications and M15 Notices Design Rules

The PRD owns notification and notice outcomes, the SRS owns web requirements, and the Module Design Catalog owns the M12 and M15 boundaries. The canonical frontend guardrails in this design system still apply. Chat and conversations are removed from the active product and do not receive a workspace pattern.

### 7.1 Notification and notice workspace patterns

M12 uses four primary layout patterns:

| Pattern | Used for |
|---|---|
| Compact inbox | Personal notifications, unread state, safe deep links, and archive actions. |
| Form plus preview rail | Notice composer, targeting, channel preview, recipient summary. |
| Table plus right detail panel | Notice approvals, delivery logs, and callback diagnostics. |
| Library plus preview rail | Templates and scheduling. |

Do not force a single generic table layout across all M12 screens. The selected pattern must match the primary job.

### 7.2 M12 lifecycle states

M12 UI copy must distinguish these states where backend contracts support them:

```text
Draft
Approval pending
Approved
Scheduled
Queued
Dispatching
Sent to provider
Delivered
Opened / Read
Partially delivered
Delayed
Failed
Retried
Cancelled
Archived
```

Never label a queued or provider-accepted message as delivered.

### 7.3 Required M12 status chips

| Status family | Chip guidance |
|---|---|
| Delivered / approved / provider healthy | Green success chip. |
| Pending / delayed / awaiting approval / backlog warning | Orange warning chip. |
| Failed / blocked / high-risk / signature failed | Red danger chip. |
| Sent / in-app / selected / informational | Blue info chip. |
| Duplicate / archived / ignored / unavailable | Neutral gray chip. |
| Mock/dev provider | Blue or purple chip with explicit `Mock / Dev` text. |

Color is not sufficient by itself. Every chip must contain readable text.

### 7.4 Notice composer standards

The notice composer must include:

- Notice details.
- Delivery channel cards.
- Target audience controls.
- Schedule/template controls.
- Per-channel live preview.
- Recipient preview.
- Recipient summary.
- Protected attachment rows.
- Send/schedule/request-approval confirmation.

Before final send or schedule, show the recipient and channel impact summary. Recipient counts, channel eligibility, and estimated SMS cost must come from backend data or be clearly unavailable.

### 7.5 Approval and audit standards

High-impact notice approval screens must show:

- Why approval is required.
- Requested by / requested on / scheduled for.
- Requested recipients.
- Notice content.
- Delivery channels.
- Protected attachments.
- Approval policy.
- Risk assessment.
- Approval history.
- Audit trail.
- Comment and approve/reject/return actions.

If the notice changes after return-for-changes, show backend-provided diff details where available. Do not invent diff facts in the browser.

### 7.6 Delivery and provider standards

Delivery log and provider-monitor screens must be precise and safe:

- Provider-disabled channels must be visibly blocked.
- Retry actions must be permission-gated and audited.
- Raw provider events must be permission-gated.
- Provider secrets, signing keys, tokens, and raw credentials must never be rendered.
- Duplicate and out-of-order callbacks should be visible as audit events, not treated as normal delivery proof.
- Export actions must use protected file/download helpers where they produce files.

### 7.7 Chat and moderation standards

Parent-teacher chat and moderation screens must preserve school-safety context:

- Teacher chat scope is assignment-limited unless permission grants broader scope.
- Student context must be visible for parent conversations where permitted.
- Quiet-hours state must be visible and backend-enforced.
- Messages and attachments must use protected access patterns.
- Report, escalate, block, resolve, reopen, and audit-note actions must be explicit, permission-gated, and audited.
- Safety copy should warn users not to share passwords, OTPs, payment details, or other sensitive personal data in chat.

### 7.8 M12 responsive behavior

Desktop references are dense operating-desk layouts. For narrower viewports:

- Collapse right detail rails into drawers.
- Keep the primary workflow visible first.
- Move long filter rows into expandable filters.
- Use table column priority instead of unreadably compressed tables.
- Keep chat composer reachable without hiding student safety context entirely.
- Preserve clear selected-row, selected-conversation, and selected-case states.

---

## 8. Canonical SchoolOS Workspace System

SchoolOS standardizes the frame, primitives, and interaction rules while each
module keeps a purpose-built operational workspace. A directory, cashier
counter, marks grid, timetable builder, and notice composer must not be forced
into the same content layout.

Daily-operation landing pages compose in this order when each part is useful:

```text
DashboardPageShell
├── ModuleHeader
│   ├── Breadcrumb
│   ├── Title and concise purpose
│   ├── One primary action
│   └── More Actions
├── SummaryGrid (decision summaries only)
├── WorkspaceTabs (stable sibling views only)
├── FilterBar (directly above filtered work)
└── WorkSurface
    ├── Header, result metadata, contextual action
    ├── Table, queue, form, builder, transaction, grid, or monitor
    ├── Shared loading, empty, error, permission, or locked state
    └── Pagination when the backend list grows
```

Summary cards and tabs are optional. A form or builder page starts with the
work itself when a summary or sibling navigation would not help the user decide
what to do next.

### 8.1 Approved workspace patterns

| Pattern | Primary uses | Main surface |
|---|---|---|
| Directory | Students, staff, books, vehicles, accounts | Filters, server-paginated table, detail sheet or route |
| Queue and approval | Admissions, corrections, leave, reversals, moderation | Queue explanation, filters, cases, review sheet or route |
| Transaction | Fee collection, canteen POS, issue/return | Current context, search/scan, form, validation, confirmation/receipt |
| Builder | Timetable, homework, exam template, notice, learning activity | Context selectors, editor, validation/preview rail, safe actions |
| Spreadsheet/grid | Marks, CAS, attendance, payroll, reconciliation | Fixed context, validation toolbar, dense grid, review rail |
| Monitoring | Principal, attendance overview, transport trips, provider health | Limited summaries, attention list, operational status, drill-through |

`WorkSurface` owns these controlled variants. Modules must not create a new
surface theme to express a domain workflow.

### 8.2 Shared component contract

- `ModuleHeader`: one title scale, description width, action placement, and
  ellipsis-menu treatment.
- `SummaryGrid` / `SummaryCard`: neutral surface, subtle border, equal height,
  compact padding, no more than four primary cards per desktop row.
- `WorkspaceTabs`: neutral list with the global primary-blue selected state;
  URL-backed or controlled state; no visible scrollbar.
- `FilterBar`: one compact row on wide screens; search receives priority width;
  secondary controls wrap or collapse on narrower screens.
- `WorkSurface`: full Card header/content/footer composition with controlled
  table, queue, form, builder, transaction, grid, and monitoring variants.
- `ActionMenu`: one shared keyboard-accessible overflow action treatment.
- Shared feedback: `LoadingState`, `EmptyState`, `ErrorState`,
  `PermissionDenied`, `ModuleLockedState`, `QueuedJobState`, partial failure,
  and protected-file unavailable states.

`KpiCard`, `KpiGrid`, and `ModuleTabs` are compatibility names only while later
modules migrate. New work uses the canonical names above.

### 8.3 Colour policy

```text
Primary blue = routine main action, active navigation, link, focus, selected state
Green        = success, completed, healthy
Amber        = warning, attention
Red          = error, blocked, overdue, destructive
Blue         = information as well as the global primary/selected state
```

Module accents are location cues only. They may appear in a small icon
container, section marker, illustration, or navigation icon. They must not
change primary buttons, active tabs, card borders, typography, or focus rules.

### 8.4 Spacing and density

```text
Page horizontal padding: 24px desktop, 16px compact
Header to summary:       24px
Summary to tabs:         20px
Tabs to workspace:       16px
Card content padding:    20px
Shared control height:   36-40px according to approved component size
Card radius:             global --radius token
```

Use the shared shell and component gaps. Do not introduce arbitrary large
top margins, decorative minimum heights, or module-specific card heights.

### 8.5 Motion

`SchoolOSMotionProvider` owns the global tokens:

```text
fast:       140ms
standard:   180ms
deliberate: 220ms
ease-out:   cubic-bezier(0.2, 0.8, 0.2, 1)
```

Approved motion is limited to tab indicators, content crossfades, filter-chip
layout, contextual panels, and success/warning feedback. Respect reduced-motion
preferences. Do not animate KPI values, every row, full-page entrances,
financial totals, marks cells, or continuous operational status.

### 8.6 Priority-route baseline (2026-07-15)

| Route | Previous drift | Canonical baseline |
|---|---|---|
| `/dashboard/students` | M1-only summaries and local Radix tab markup | Shared summary, workspace tabs, compact directory work surface |
| `/dashboard/admissions` | M1-only summaries and local queue tabs | Shared summary, workspace tabs, queue work surface |
| `/dashboard/attendance` | Six summaries and green active navigation | Four decision summaries, primary-blue tabs, monitoring work surface |
| `/dashboard/fees` | Orange actions/underline navigation and five-card row | Primary-blue actions/tabs, four decision summaries, transaction work surface |
| `/dashboard/homework` | Module-blue action, five summaries, large filter area | Primary action, four summaries, shared tabs/filter/work surface |
| `/dashboard/academics` | Purple actions/tabs and module-themed overview links | Primary action, shared summaries/tabs, canonical work surface |
| `/dashboard/activity` | Activity-specific header, cards, and filter surface | Monitoring/creation workspace, backend summary, protected-media workflow |
| `/dashboard/hr` and `/dashboard/payroll` | Separate HR/payroll card and navigation treatments | Shared directory/approval frame, privacy-safe backend summaries, protected staff documents and payslips |
| `/dashboard/library` | Circulation controls mixed with local dashboard cards | Circulation-first workspace, four decision summaries, catalogue/copy separation |
| `/dashboard/transport` | Transport-themed summaries and local panels | Monitoring workspace, backend totals only, explicit stale-location and document states |
| `/dashboard/canteen` | Five browser-derived dashboard statistics | Transaction-first POS/serving workspace with no summary until a safe summary contract exists |
| `/dashboard/accounting` | Duplicate local header/navigation and themed sections | Shared accounting shell, four backend summaries, task-specific journal/reconciliation surfaces |
| `/dashboard/notices` | Communications-specific navigation and summary styling | Shared notice/queue frame, four delivery summaries, recipient-preview and delivery ownership preserved |
| `/dashboard/learning` | Emerald primary actions, local KPI cards, local table/filter surfaces | Teacher-led monitoring/builder frame, backend operational summary, protected resources and session controls |

This baseline does not change backend contracts, authorization, entitlement,
official totals, server filtering, pagination, or protected-file behavior.

M12 owns notification delivery and M15 owns notice authoring. Chat remains a
hidden, read-disabled compatibility surface until its retention and workflow
policy is explicitly approved; the shared workspace migration does not
reactivate chat writes or navigation.

### 8.7 Module-to-pattern mapping

| Module | Approved landing pattern | Purpose-specific workspace retained |
|---|---|---|
| M1 Admissions and Student Profiles | Directory + queue/approval | Student directory, admission case review |
| M2 Smart Attendance | Monitoring + spreadsheet/grid | Session status, roster marking, corrections |
| M3 Fees and Receipts | Transaction | Cashier collection, invoices, receipts, close |
| M4 Academics | Spreadsheet/grid + builder | Marks, CAS, results, report-card workflows |
| M5 Activity Feed and Milestones | Monitoring + queue/approval | Consent-aware feed creation, moderation, protected media |
| M6 Homework and Timetable | Directory + builder | Assignment review/composer and weekly timetable builder |
| M7 HR and Payroll | Directory + queue/approval + spreadsheet/grid | Staff privacy, leave approval, payroll posting/correction |
| M8 Library | Transaction + directory | Circulation counter, catalogue/copies, overdue attention |
| M9 Transport | Monitoring | Routes, assignments, trip status, stale GPS and documents |
| M10 Canteen | Transaction | Scanner-first POS/serving, wallet and safety checks |
| M11 Accounting and Finance | Spreadsheet/grid + transaction | Vouchers, journals, fiscal locks, reconciliation and reports |
| M12 Notifications and Delivery | Monitoring + queue/approval | Delivery state, retries, provider diagnostics and receipts |
| M15 Notices and Announcements | Builder + queue/approval | Recipient preview, approval, publish/schedule and attachments |
| M13 Learning Layer | Preserved compatibility only | Deferred/frozen; no new or redesigned workspace work while disabled for pilots |

Summary cards remain optional. M10 deliberately has no landing summary until a
backend-owned contract can provide actionable values; loaded POS or wallet rows
must never become browser-owned official totals.

The existing M13 Learning screens and patterns remain preserved, but this design
system does not authorize new Learning UI, populated fixtures, screenshots,
analytics, or mobile expansion while the module is deferred and frozen.

### 8.8 Controlled state evidence

The authenticated test-only route
`/dashboard/visual-fixtures/workspace-states` renders deterministic loading,
empty, no-results, error, permission-denied, module-locked, partial-failure,
queued, and protected-file-unavailable states only when
`SCHOOLOS_VISUAL_FIXTURES=1`. It does not change tenant entitlements, weaken
authorization, or provide production data.

### 8.9 Consistency gate

`test/workspace-consistency-contract.test.mjs` guards the priority routes and
shared primitives. It verifies the common shell/header/tab/work-surface
composition, optional backend-owned summaries, task-specific workspace markers,
protected-file helpers, required shared states, global primary navigation,
four-card summary limit, hidden tab scrollbars, shared motion boundary, and
preservation of server filtering and pagination. Visual review remains required
at 1440px, 1280px, 1024px, and 390px for populated and failure states before
broad UI changes merge.
