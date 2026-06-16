# SchoolOS Web Frontend Design Plan

**Status:** Active source of truth for SchoolOS web frontend design, UI/UX, wireframes, component planning, API usage, and web persona smoke expectations.  
**Updated:** 2026-06-16  
**Scope:** `apps/web`, Next.js App Router, school dashboard, platform control plane, settings, reports, protected files, and dense school operation workspaces.

This document replaces and consolidates the previous web/mobile combined design plan and web companion design files. It is planning only; it does not implement backend, frontend, mobile, database, migration, or test code.

---

## 1. Merged Design Sources

This file contains the web/frontend content formerly spread across:

```text
docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md
docs/design/SCHOOLOS_WEB_FRONTEND_IMPLEMENTATION_MASTER_PLAN.md
docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md
docs/design/SCHOOLOS_WEB_MODULE_WORKSPACE_LAYOUT.md
docs/design/SCHOOLOS_WEB_MAIN_DASHBOARD_LAYOUT.md
docs/design/SCHOOLOS_WEB_LOW_FIDELITY_WIREFRAMES.md
docs/design/SCHOOLOS_WEB_COMPONENT_IMPLEMENTATION_PLAN.md
docs/design/SCHOOLOS_SETTINGS_WIREFRAMES.md
docs/design/SCHOOLOS_PLATFORM_CORE_WIREFRAMES_AND_COMPONENT_PLAN.md
docs/design/SCHOOLOS_MODULE_FEATURE_BREAKDOWN.md
```

The matching mobile and Flutter content now lives in:

```text
docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
```

---

## 2. Web Product Direction

SchoolOS web is the command center for the school. It should feel like a daily school operating desk for Nepal schools, not a generic ERP dashboard, shortcut wall, or template admin kit.

Core direction:

```text
One screen = one main job.
```

Web is responsible for:

- School operations dashboard.
- Student/admission office workflows.
- Attendance review, corrections, reports, and registers.
- Fee setup, cashier collection, receipts, reversals, refunds, cashier close, and reports.
- Academics, marks, CAS, report cards, promotion, and result publishing.
- Activity feed moderation and media management.
- Homework and timetable builder.
- HR, payroll, staff documents, leave, and payroll reports.
- Library, transport, and canteen admin/counter workflows.
- Accounting, journals, reconciliation, ledgers, and protected financial exports.
- Notices, communication, provider diagnostics, and controlled chat moderation.
- M12 Learning teacher/admin workspace, smart-board route, lab route, and parent/student web summaries where implemented.
- School settings and platform control plane.
- Reports, exports, audit-heavy workflows, File Registry, PDFs, CSVs, and protected downloads.

Web must use school-friendly language: `Save failed`, `You do not have permission`, `Receipt download unavailable`, and `This module is not enabled for this school`. Avoid raw backend jargon such as `Mutation failed`, `403 Forbidden`, raw Prisma errors, stack traces, or object keys.

---

## 3. Web Non-Negotiables

- Keep `tenantId` as the tenant boundary everywhere.
- Backend authorization, tenant scoping, module entitlement, and route guards are the source of truth.
- UI visibility is not security.
- All production screens consume real APIs only.
- No fake dashboard metrics, placeholder production values, browser-only production state, or client-owned financial truth.
- Growing lists are paginated and filtered server-side.
- Financial, payroll, accounting, lifecycle, publish, archive, support override, reversal, refund, and destructive actions require confirmation, impact preview, permission, reason where configured, and audit.
- Protected files, PDFs, CSVs, receipts, report cards, payslips, student documents, activity media, exports, and snapshots must use File Registry/authenticated helper components.
- Never expose raw storage URLs, object keys, permanent public URLs, secrets, provider credentials, raw Prisma errors, or stack traces.
- School Settings and M0 Platform Core must stay separate.
- SchoolOS SaaS billing must never mix with school fee collection.
- No Angular migration.
- No microservices.
- No M9 accounting microservice.
- No AI runtime or M11 UI until explicitly approved after reliable production data exists.
- No public student leaderboard or harmful labels.
- Parent, driver, staff self-service, and student lab/session web routes must use purpose-limited APIs, not admin-shaped payloads.

---

## 4. Web App Shell

The authenticated school web shell uses:

```text
Topbar -> Left Sidebar -> Page Header -> Context Bar / Filters -> KPI Strip -> Main Workspace -> Optional Right Panel / Drawer -> Sticky Action Footer only when needed
```

### 4.1 Global App Shell Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                                      │
│ SchoolOS | School Switcher | Academic Year | Search | Notifications | User   │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ Global Aside  │ Main Section                                                 │
│               │                                                              │
│ Dashboard     │ Selected module workspace appears here                        │
│ Students      │                                                              │
│ Admissions    │ Header                                                       │
│ Attendance    │ KPI Strip                                                    │
│ Fees          │ Tabs / Filters                                               │
│ Academics     │ Table / Grid / Calendar / POS / Report / Builder             │
│ Activity      │ Right Drawer / Modal / Wizard                                │
│ Homework      │ Audit / Export / Protected file actions                       │
│ HR & Payroll  │                                                              │
│ Library       │                                                              │
│ Transport     │                                                              │
│ Canteen       │                                                              │
│ Accounting    │                                                              │
│ Notices & Chat│                                                              │
│ Learning      │                                                              │
│ Reports       │                                                              │
│ Settings      │                                                              │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

### 4.2 Topbar

Topbar contains:

- SchoolOS identity.
- School switcher where the user has multiple permitted tenants.
- Academic year/date context where relevant.
- Role-scoped global search.
- Notification center.
- User menu.
- Visible support override banner/state if active.

Topbar must not become a module action bar. Module actions belong in the page header or workspace.

### 4.3 Left Sidebar

Sidebar is navigation only. It may include:

- Logo.
- Main modules.
- Collapsible groups.
- Role/module-aware visibility.
- Locked indicators where useful.
- Current role indicator.
- Settings and Help pinned at bottom.

Sidebar must not contain:

- Module KPIs.
- Operational tables.
- Workflow buttons.
- Finance amounts.
- Student private data.
- High-risk actions.

Recommended school navigation:

```text
Dashboard
Students
Admissions
Attendance
Fees
Academics
Activity Feed
Homework & Timetable
HR & Payroll
Library
Transport
Canteen
Accounting
Notices & Chat
Learning
Reports
Settings
```

Do not use `Phase 1`, `Phase 2`, or implementation-phase labels in navigation.

---

## 5. Platform Control Plane Design

Platform Core is different from school Settings:

```text
Settings = one school's own configuration
Platform = SchoolOS company/operator/developer administration
```

Platform should be visible only to platform/super/support/billing operators with explicit permission. Support access to tenant data requires audited override and least-privilege scope.

### 5.1 Platform Shell Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform Top Bar                                                             │
│ SchoolOS Platform | Environment | Search | Alerts | Platform User            │
├───────────────────┬──────────────────────────────────────────────────────────┤
│ Platform Aside    │ Platform Main Workspace                                  │
│                   │                                                          │
│ Attention         │ Selected platform page appears here                       │
│ Schools           │                                                          │
│ Plans & Billing   │                                                          │
│ Providers         │                                                          │
│ Queues            │                                                          │
│ Reports           │                                                          │
│ Audit             │                                                          │
│ Support Override  │                                                          │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

Platform rules:

- Do not mix Platform navigation with school Settings navigation.
- Production environment actions need stronger confirmation than staging/dev actions.
- Support override must be visible at all times while active.
- Provider secrets are masked.
- Dangerous platform actions need reason, confirmation, permission, audit, and impact preview.
- Platform plan/module access is not M9 accounting.
- Use real platform APIs only.

### 5.2 Platform Main Screens

| Screen | Main job | Primary action | Notes |
|---|---|---|---|
| Platform Attention | See urgent SaaS/provider/queue/tenant issues | Open highest-risk issue | No fake platform metrics. |
| Schools / Tenants | Manage tenants safely | Create tenant | Status changes require reason. |
| Plans & Billing | Manage SaaS subscriptions | Update plan | Never mixes with school fees. |
| Providers | Show SMS/email/FCM/storage/gateway readiness | Run readiness check | Secrets masked. Disabled/mock modes honest. |
| Queues | Inspect failed jobs and retry/discard safely | Retry selected job | Reason and race-safe diagnostics required. |
| Audit | Review platform/support actions | Export audit where allowed | No secrets in logs. |
| Support Override | Enter/exit audited tenant support context | Enter override | Explicit reason and expiry required. |

---

## 6. Web Design System

### 6.1 Visual Style

- Calm light app background.
- White cards, tables, drawers, and panels.
- Strong readable text and clear hierarchy.
- One SchoolOS base palette with restrained module accents.
- Module accents identify location only; semantic colors represent status.
- Avoid decorative gradients, shortcut walls, generic admin-kit visuals, and tiny low-contrast operational text.

Base tokens:

| Token | Hex | Usage |
|---|---:|---|
| `brand.primary` | `#155EEF` | Primary action, active links |
| `brand.primaryDark` | `#0B3A88` | Sidebar active, strong headers |
| `brand.primarySoft` | `#EAF1FF` | Soft selected backgrounds |
| `brand.secondary` | `#7C3AED` | Secondary/premium accent |
| `surface.app` | `#F3F7FB` | App background |
| `surface.card` | `#FFFFFF` | Cards, panels, tables |
| `surface.subtle` | `#F8FAFC` | Table headers/subtle cards |
| `border.default` | `#E2E8F0` | Borders |
| `text.primary` | `#0F172A` | Main text |
| `text.secondary` | `#475569` | Secondary text |
| `success` | `#16A34A` | Success states |
| `warning` | `#D97706` | Warning states |
| `danger` | `#DC2626` | Dangerous/error states |
| `info` | `#0284C7` | Informational states |

Module accents:

| Area | Accent |
|---|---:|
| Dashboard | `#155EEF` |
| Platform Control | `#4F46E5` |
| Admissions / Students | `#2563EB` |
| Attendance | `#059669` |
| Fees / Receipts | `#D97706` |
| Academics | `#7C3AED` |
| Activity Feed | `#DB2777` |
| Homework / Timetable | `#0284C7` |
| HR / Payroll | `#9333EA` |
| Library | `#0D9488` |
| Transport | `#EA580C` |
| Canteen | `#65A30D` |
| Accounting | `#0F766E` |
| Notices / Chat | `#E11D48` |
| Learning | `#7C3AED` |
| Reports | `#0891B2` |
| Settings | `#475569` |

### 6.2 Components

Recommended structure:

```text
apps/web/components/
  layout/
  ui/
  dashboard/
  admissions/
  attendance/
  finance/
  academics/
  activity/
  homework/
  hr/
  library/
  transport/
  canteen/
  accounting/
  communication/
  learning/
  settings/
  platform/
```

Shared components:

| Component | Purpose |
|---|---|
| `DashboardShell` | Authenticated school app shell. |
| `PlatformShell` | Platform-only shell. |
| `TopBar` | School switcher, academic year, search, notifications, user menu. |
| `GlobalAside` | Role/module-aware navigation. |
| `ModuleHeader` | Title, description, one primary action. |
| `KpiCard` / `KpiGrid` | Decision cards from backend data. |
| `ModuleTabs` | Module subsections. |
| `FilterBar` | Search, filters, date, class, status. |
| `DataTable` | Standard table with server pagination. |
| `StatusBadge` | Status display without color-only meaning. |
| `ActionMenu` | Secondary actions. |
| `DetailDrawer` | Right-side detail/preview/edit surface. |
| `ConfirmDialog` | Confirmation for sensitive actions. |
| `ReasonRequiredDialog` | Reversals, corrections, archive, retry, support override. |
| `AuditTimeline` | Change history. |
| `EmptyState` | Friendly empty state with one CTA. |
| `ErrorState` | Safe parsed error and retry. |
| `LoadingState` | Skeletons. |
| `PermissionState` | Direct forbidden route state. |
| `ModuleLockedState` | Entitlement-backed locked state. |
| `ProtectedFileButton` | Authenticated preview/download. |
| `ProtectedFileLink` | Authenticated file link. |

Component rule:

```text
Shared components handle layout and common behavior.
Module components handle school-specific workflows.
Workspace components connect API data, filters, tabs, actions, and states.
```

---

## 7. Required Web States

Every web screen must design and implement:

| State | Required behavior |
|---|---|
| Loading | Skeleton/card placeholders with page title and selected filters preserved. |
| Empty | School-friendly explanation and one safe next action. |
| Error | Safe backend message where possible, retry, preserved context. |
| Success | Toast or inline confirmation plus refetch/invalidate. |
| Permission denied | Clear message and safe navigation without exposing hidden actions. |
| Module locked | Entitlement-backed locked state; no fake fallback data. |
| File unavailable | Explain missing/expired/permissioned file safely. |
| Slow network/stale data | Preserve user context; show retry/last-updated where useful. |
| Pending job/export | Queued/processing/completed/failed state from backend. |

---

## 8. Screen Composition Standard

Every authenticated SchoolOS web screen should follow this structure unless a domain workflow clearly needs a special layout:

```text
Topbar
Left Sidebar
Page Header
Context Bar / Filters
KPI Strip
Main Workspace
Right Insight Panel or Drawer
Sticky Action Footer only when a multi-step form needs it
```

| Zone | What it contains | Rules |
|---|---|---|
| Topbar | School selector, academic year/date, global search, notifications, user menu | No module-specific action clutter. |
| Left Sidebar | Role-aware navigation | Hide unavailable modules, direct locked access still safe. |
| Page Header | Title, purpose, one primary CTA, `More Actions` | Avoid five equal header buttons. |
| Filters | Academic year, class, section, date range, status, search | Prefer URL `searchParams`. |
| KPI Strip | 3-5 decision cards | Backend data or unavailable state only. |
| Main Workspace | Table/register/kanban/calendar/POS/form/report/builder | Match one main job. |
| Right Drawer | Record details, audit, preview, action form | Preserve table/filter context. |
| Sticky Footer | Long forms/review workflows | Not for simple list screens. |

Default flow:

```text
Dashboard -> List/Table -> Detail Drawer -> Full Page only when needed
```

Use full pages for complex workflows such as student profile, staff profile, report-card batch review, payroll run, accounting reconciliation, timetable builder, large imports, learning activity builder, and controlled learning runtime routes.

---

## 9. Main Dashboard Design

The main dashboard answers:

```text
What is happening today?
What needs attention?
Which module needs action?
What can this user do quickly from here?
```

### 9.1 Dashboard Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Good Morning, Principal                                                      │
│ Holyland Kids' Academy | Academic Year 2082/83 | School Open Today           │
│                                                        [Resolve Top Alert]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Students     │ │ Present Today│ │ Fees Today   │ │ Pending Tasks│
│ 1,250        │ │ 1,086 / 1250 │ │ Rs. 85,000   │ │ 17           │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Staff Present│ │ Notices Sent │ │ Active Trips │ │ Overdue Fees │
│ 72 / 80      │ │ 4            │ │ 5            │ │ Rs. 2,40,000 │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Today's Operations                    │ │ Pending Approvals & Alerts          │
│--------------------------------------│ │-------------------------------------│
│ Attendance     86% marked     [View] │ │ 5 attendance corrections     [Open] │
│ Fees           Rs.85,000      [View] │ │ 3 leave requests             [Open] │
│ Transport      5 trips live   [View] │ │ 4 fee discount requests      [Open] │
│ Canteen        145 orders     [View] │ │ 1 payroll run pending        [Open] │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Summary                                                               │
│ Admissions | Attendance | Fees | Academics | HR | Library | Transport | ...  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Recent Activity                       │ │ Role-Based Quick Actions            │
│ Payment received                      │ │ [New Admission]                     │
│ Attendance submitted                  │ │ [Collect Fee]                       │
│ Notice sent                           │ │ [Create Notice]                     │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

Rules:

- Show 6-8 top KPIs maximum.
- Do not fetch every module deeply on first render.
- Use real summary APIs, safe module summaries, list metadata, or unavailable states.
- Module-locked cards show locked state, not fake values.
- Finance, payroll, private chat, file, and sensitive student summaries are permission-filtered.
- Recent activity uses safe actor/object labels and avoids private chat/payroll details.

---

## 10. Settings Design

Settings controls school-level configuration, not daily operations.

### 10.1 Settings Workspace Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Settings                                                                     │
│ Configure school profile, academic years, users, permissions, modules,        │
│ notifications, templates, and school rules.                     [Save]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search settings...                                                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┬──────────────────────────────────────────────────────┐
│ Settings Menu          │ Settings Content                                      │
│-----------------------│------------------------------------------------------│
│ School Profile         │ Selected settings page appears here                  │
│ Academic Years         │                                                      │
│ Classes & Sections     │                                                      │
│ Users                  │                                                      │
│ Roles & Permissions    │                                                      │
│ Modules                │                                                      │
│ Fee Settings           │                                                      │
│ Attendance Settings    │                                                      │
│ Exam Settings          │                                                      │
│ Notification Settings  │                                                      │
│ Templates              │                                                      │
│ File & Documents       │                                                      │
│ Security               │                                                      │
│ Integrations           │                                                      │
│ Backup & Export        │                                                      │
│ Audit Log              │                                                      │
└───────────────────────┴──────────────────────────────────────────────────────┘
```

Settings areas:

- School Profile.
- Academic Years.
- Classes & Sections.
- Users.
- Roles & Permissions.
- Module Access visibility.
- Fee Settings.
- Attendance Settings.
- Exam / Report Card Settings.
- Notification Settings.
- Templates.
- File & Document Settings.
- Security.
- Integrations.
- Backup & Export.
- Settings Audit Log.

Rules:

- All settings mutations are audited.
- Sensitive settings changes require confirmation and reason where configured.
- Module visibility does not override SaaS entitlement.
- Integration secrets are masked.
- Logo/file settings use File Registry rules.
- Backup restore remains high risk and should not be casually exposed to normal school users.

---

## 11. Module-Wise Web Screen Plan

Each module should use the standard workspace pattern: header, KPI strip, tabs, filters, main content, detail drawer/modals, reports/export, audit history where needed.

| Module | Primary job | Core screens/tabs | Main workspace | Primary action |
|---|---|---|---|---|
| Dashboard | Show today, alerts, next work | One role-aware dashboard | KPIs, operations, approvals, module summaries | Resolve top alert |
| M1 Admissions & Students | Manage student lifecycle | Students, Admissions, Docs, Duplicates, iEMIS, QR | Student table, pipeline, duplicate review, document checklist | Add student / create application |
| M2 Attendance | Mark/review attendance | Daily, Monthly Register, Corrections, Drafts, Anomalies | Attendance grid, register, correction queue | Submit attendance |
| M3 Fees & Receipts | Collect and control school fees | Dues, Invoices, Payments, Receipts, Reversals, Cashier Close | Cashier counter, invoice/payment tables | Record payment |
| M4 Academics | Exams, marks, report cards | Subjects, Terms, Marks, CAS, Report Cards, Results | Marks grid, report-card batch table | Save marks / generate batch |
| M5 Activity Feed | Posts, media, milestones | Feed, Pending, Gallery, Milestones, Reports | Feed/table hybrid, media gallery, approval queue | Create post |
| M6 Homework & Timetable | Assign work and manage schedules | Homework, Submissions, Timetable Builder, Substitutions | Homework table, timetable grid, conflict panel | Create homework / validate timetable |
| M7 HR & Payroll | Staff, leave, payroll | Staff, Contracts, Leave, Attendance, Payroll, Payslips | Staff table, leave queue, payroll run wizard | Add staff / start payroll preview |
| M8A Library | Catalog and circulation | Catalog, Copies, Issue/Return, Overdue, Fines, Reports | Scanner-first issue/return and book tables | Add book / scan issue-return |
| M8B Transport | Routes, trips, GPS status | Routes, Stops, Vehicles, Students, Trips, GPS Quality | Route/trip tables, latest GPS status | Create route |
| M8C Canteen | POS, serving, wallet, inventory | POS, Serving, Menu, Wallets, Inventory, Vendors | Touch-friendly POS/serving panel | Open POS / serve QR |
| M9 Accounting | Ledger and reports | Dashboard, COA, Journals, Ledger, Reports, Reconciliation | Journal table, COA tree, reconciliation split view | Create journal / run report |
| M10 Notices & Chat | Send and audit communication | Notices, Compose, Chat, Delivery, Templates, Diagnostics | Notice composer/list, delivery status, chat inbox | Send notice |
| M12 Learning | Controlled learning sessions | Activities, Sessions, Resources, Progress, Builder | Activity builder, session monitor, progress table | Create activity / launch session |
| Reports / Files | Protected reports and exports | Reports, Export History, File Registry | Report tables, job status, protected downloads | Export / download |
| Settings | School configuration | School profile, users, roles, modules, security | Settings sidebar and panels | Save setting |
| Platform | SaaS/operator controls | Attention, Schools, Plans, Providers, Queues, Audit | Platform tables, diagnostics, support override | Review highest-risk item |

### 11.1 Module Screen Acceptance Rules

For every module screen:

- Main job is visible within 10 seconds.
- One primary action only.
- Secondary actions go under `More Actions`.
- Every list uses server-side pagination/filtering when it can grow.
- Every mutation has loading, success, error, and safe retry behavior.
- Destructive or high-risk actions have confirmation and audit reason where required.
- Protected files use `ProtectedFileButton`, `ProtectedFileLink`, or shared authenticated blob/download helpers.
- Direct forbidden route access shows `PermissionState` or `ModuleLockedState`.
- Empty states include one safe CTA.

---

## 12. Major Web Wireframes

### 12.1 Admissions / Student Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Admissions & Student Profiles                                                │
│ Manage admissions, student records, guardians, documents, QR, and iEMIS.      │
│                                                        [New Admission]        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Students││ New Admissions││ Missing Docs │ │ Duplicates   │
│ 1,250         ││ 28 this month ││ 14           │ │ 5            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Tabs: [Students] [Admissions] [Documents] [Duplicates] [iEMIS Export] [QR]

Search student... | Class | Section | Status | Doc Status | [Export]

Student Table
Photo | Name | Class | Section | Guardian | Phone | Status | Docs | Actions
```

### 12.2 Attendance Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Smart Attendance                                                             │
│ Mark daily attendance, manage corrections, and view monthly registers.        │
│                                                   [Mark Attendance]           │
└──────────────────────────────────────────────────────────────────────────────┘

KPIs: Present Today | Absent | Late | Classes Not Marked | Correction Requests
Tabs: Daily | Monthly Register | Corrections | Offline Drafts | Anomalies | Reports
Filters: Date | Class | Section | Teacher | Status
Main: Attendance register/grid or correction queue
Drawer: Student/session correction detail with reason and audit timeline
```

### 12.3 Fee Collection Counter

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fee Collection Counter                                                       │
│ Search student, collect payment, and issue protected receipt.                 │
│                                                        [Record Payment]       │
└──────────────────────────────────────────────────────────────────────────────┘

Search: student name / admission no / guardian phone / invoice / receipt

┌─────────────────────────────┬────────────────────────────────────────────────┐
│ Student + Due Summary        │ Payment Form                                   │
│ Outstanding invoices         │ Amount, method, reference, date, note          │
│ Recent receipts              │ Receipt preview after confirmed payment        │
└─────────────────────────────┴────────────────────────────────────────────────┘

Rules: backend Decimal totals only, idempotency, receipt PDF through protected helper.
```

### 12.4 Marks Entry / Report Cards

```text
Header: Academics / Marks / Report Cards
KPI: Marks pending | Draft marks | Locked terms | Generated cards | Publish blockers
Filters: Class | Section | Subject | Exam Term | Status
Main: Spreadsheet-style marks grid or report-card batch table
Sticky Action Footer: Save draft | Submit marks | Generate batch
Drawer: Report-card preview / correction history / publish confirmation
```

### 12.5 Canteen POS / Serving

```text
Header: Canteen POS
KPI: Served today | Sales today | Low wallets | Stock low | Allergy warnings
Main: QR/student search + menu grid + wallet/status panel
Warning: Allergy/medical acknowledgement before submit
Receipt: protected receipt JSON/PDF after successful sale
```

### 12.6 Accounting Reconciliation

```text
Header: Accounting Reconciliation
KPI: Unreconciled items | Suggested matches | Import jobs | Fiscal lock status
Main: Bank statement import + internal ledger split view
Drawer: Match detail and confirmation
Rules: no frontend ledger truth, posted records use correction/reversal only.
```

### 12.7 Learning Workspace

```text
Header: Learning
Tabs: Activities | Sessions | Resources | Progress
Main: Activity table / builder / session monitor / resource library
Runtime routes: /classroom/board/session/[sessionId], /student/learning/session/[sessionId]
Rules: teacher assigned-scope, resources protected, parent/student summaries child/self scoped.
```

---

## 13. Web API Contract Rules

Do not invent fake endpoint contracts. Before implementation, check current OpenAPI output and `apps/web/lib/api/*`.

Recommended web API client files:

```text
apps/web/lib/api/client.ts
apps/web/lib/api/auth.ts
apps/web/lib/api/users.ts
apps/web/lib/api/platform.ts
apps/web/lib/api/students.ts
apps/web/lib/api/attendance.ts
apps/web/lib/api/finance.ts
apps/web/lib/api/academics.ts
apps/web/lib/api/activity.ts
apps/web/lib/api/homework.ts
apps/web/lib/api/payroll.ts
apps/web/lib/api/library.ts
apps/web/lib/api/transport.ts
apps/web/lib/api/canteen.ts
apps/web/lib/api/accounting.ts
apps/web/lib/api/communications.ts
apps/web/lib/api/messaging.ts
apps/web/lib/api/learning.ts
apps/web/lib/api/marketing.ts
apps/web/lib/api/index.ts
```

Rules:

- Browser auth is cookie-first.
- Do not store raw access/refresh tokens in browser storage.
- CSV/PDF/blob/private media endpoints use shared authenticated blob/download helpers.
- Do not use raw `window.open` for private files.
- Parent, staff self-service, driver, and student lab/session routes must use purpose-limited APIs where web routes exist.
- SSE is progressive enhancement only; list queries remain source of truth after reconnect/refetch.
- Unknown contracts are marked as `needs backend verification`, `needs OpenAPI contract confirmation`, or `needs real summary API`.

---

## 14. Web Persona Smoke Plan

Every web persona smoke should prove:

1. User can log in.
2. User lands on correct dashboard/surface.
3. Navigation matches role permissions.
4. Hidden modules are not visible.
5. Direct forbidden routes show safe permission/module-locked state.
6. Allowed records are visible.
7. Unallowed records are not visible.
8. Allowed actions work with loading/success/error handling.
9. Forbidden actions are hidden and backend-blocked if attempted.
10. Private files/downloads require authenticated access.
11. Logout/session expiry returns to login safely.

Priority web personas:

```text
Platform Operator
Owner / Director
Principal / Head Teacher
Academic Coordinator
School Admin / Office Admin
Admission Officer
Class Teacher
Subject Teacher
Accountant
Cashier
HR / Payroll Officer
Librarian
Transport Manager
Canteen Manager / POS Staff
Parent / Guardian where parent web exists
Student Lab-Only User for controlled learning routes
Staff Self-Service User where web self-service exists
```

Cross-persona security checks:

```text
Parent cannot access another parent's child.
Student lab user cannot access another student's attempt/progress.
Teacher cannot access another class unless assigned or explicitly permitted.
Subject teacher cannot enter marks for unassigned subject.
Cashier cannot reverse/refund without permission.
Principal cannot view salary details without payroll permission.
Owner cannot access platform internals without platform permission.
Platform operator cannot view tenant-private data without support override.
Module-locked route shows ModuleLockedState and backend blocks action.
```

---

## 15. Web Implementation Order

Use this sequence:

1. **W1 Shared UI foundation and shell standardization**: shared states, shell, topbar, aside, role/module navigation, protected file components, table/filter primitives, dialogs, audit reason patterns.
2. **W2 Main dashboard command center**: real summary/unavailable states, role quick actions, module cards, recent activity.
3. **W3 High-use daily modules**: M1, M2, M3, M4, M10.
4. **W4 Operational modules**: M6, M7, M8A, M8B, M8C.
5. **W5 Accounting, Learning, Settings, Platform Core**: M9, M12, school settings, platform control plane.
6. **W6 Polish, accessibility, contract verification, smoke tests, production checks.**

---

## 16. Web Verification

For docs-only changes, no build/test commands are required. For implementation changes, run relevant gates and do not claim passing unless actually run:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

Web-specific checks:

```bash
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
```

---

## 17. Web Risks

- Tenant isolation bypass through broad client queries.
- Fake frontend data returning to dashboard cards or module KPIs.
- Unbounded dashboard fetches across all modules.
- Missing permission/module-locked states.
- Duplicate UI primitives and inconsistent page behavior.
- Raw file URLs or object keys in browser.
- Sensitive finance/payroll exposure.
- Platform/school settings confusion.
- Support override misuse or invisible override context.
- Parent, driver, staff self-service, or student lab/session surfaces using admin-shaped APIs.
- Client-side totals replacing backend-owned totals.
- Dangerous actions without reason, confirmation, impact preview, permission, and audit.
