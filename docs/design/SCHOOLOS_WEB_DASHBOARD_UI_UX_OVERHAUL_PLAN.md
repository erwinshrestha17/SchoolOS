# SchoolOS Web Dashboard UI/UX Overhaul Plan

**Status:** Active research-backed web dashboard overhaul direction  
**Last updated:** 2026-06-04  
**Scope:** School admin dashboard, platform control plane, settings, and all web module workspaces in `apps/web`.

This document is the working plan for polishing and overhauling the SchoolOS web UI/UX. It does not replace backend verification, tenant isolation, RBAC, File Registry, audit logging, or provider-disabled/mock-mode rules.

---

## 1. Research Summary

Current SchoolOS web stack already supports a modern overhaul direction:

```text
Next.js 15
React 19
Tailwind CSS 4
TanStack Query 5
Zod
React Hook Form
Lucide icons
Custom shadcn-style UI primitives in apps/web/components/ui
```

Research-backed direction:

- Use Tailwind utility classes through a constrained SchoolOS design-token system. Tailwind's official model is utility-first styling from single-purpose classes, which fits a reusable admin dashboard system when tokens and variants are controlled.
- Use shadcn-style primitives for buttons, cards, dialogs, tabs, forms, sheets, sidebars, tables, skeletons, dropdowns, command/search, badges, toasts, and alert dialogs.
- Use Next.js App Router patterns carefully: keep layouts/pages server-rendered where possible, and isolate client components only for state, event handlers, browser APIs, charts, filters, forms, and interactive tables.
- Optimize against Core Web Vitals: LCP, INP, and CLS. Heavy module pages must avoid unnecessary client JavaScript, layout shifts, and large first-load bundles.
- Use TanStack Query for authenticated client-side server state, caching, background refetch, pagination, mutations, and invalidation where interactivity is required.

Reference links:

```text
Tailwind utility-first docs: https://tailwindcss.com/docs/styling-with-utility-classes
shadcn/sidebar docs: https://ui.shadcn.com/docs/components/sidebar
Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
Core Web Vitals: https://web.dev/articles/vitals
TanStack Query overview: https://tanstack.com/query/latest/docs/framework/react/overview
```

---

## 2. Non-Negotiable Direction

```text
SchoolOS is a School Management System, not a quick-action prototype.
```

Rules:

1. Every module gets its own dedicated workspace and detail screens.
2. Do not compress complex school-office workflows into shortcut concepts.
3. Remove old shortcut/tap-based wording from docs and future UI copy.
4. Start the web overhaul with the school Dashboard.
5. Keep Platform Control separate from School Operations.
6. Keep Settings as a dedicated school configuration workspace, not a miscellaneous page.
7. All screens must consume real backend APIs.
8. No fake production data, placeholder metrics, or local-only state for production flows.
9. All tenant-owned data must remain backend tenant-scoped.
10. All destructive, financial, publishing, posting, lock, retry, and support actions need confirmation, reason where needed, and auditability.

---

## 3. Global Web Layout Standard

All school admin screens should follow this common structure:

```text
App Shell
  Left Sidebar
  Topbar
  Page Header
  Context Bar / Filters
  Summary / KPI Strip
  Main Workspace
  Secondary Panel or Details Drawer when useful
  Sticky Action Footer only for long forms or review/submit workflows
```

Platform screens should use the same component system but with a visibly distinct control-plane tone:

```text
Platform Shell
  Platform Sidebar
  Platform Topbar
  Platform Header
  Health / Risk / Queue / Tenant Status Cards
  Admin Work Area
  Audit / Reason / Confirmation surfaces
```

The dashboard shell must support:

- Collapsible sidebar.
- Active route state.
- Permission-hidden navigation.
- Global search.
- Notification center.
- Academic year / fiscal year context where relevant.
- School identity and user profile.
- Fast route transitions.
- Skeleton loading and error boundaries.

---

## 4. Visual Design System

### Typography

Use a consistent dashboard type scale:

```text
Display / dashboard hero: 32-40px, bold
Page title: 28-32px, bold
Section title: 18-22px, semibold
Card title: 14-16px, semibold
KPI number: 28-36px, bold, tabular numbers
Body: 14-16px
Helper / metadata: 12-13px
Button: 14-15px, semibold
Table header: 12-13px, uppercase or semibold
Table cell: 13-14px
```

Rules:

- Use high contrast text.
- Use tabular numbers for money, attendance counts, percentages, and ledger values.
- Do not use very light grey for important operational data.
- Use short but descriptive module labels.

### Color and tone

School dashboard:

```text
Primary: deep blue / indigo
Background: soft slate / blue-grey
Surface: white
Borders: subtle slate
Success: green
Warning: amber
Danger: rose/red
Info: cyan/sky
```

Platform control plane:

```text
Primary: slate / indigo
Risk / danger states more prominent
Provider/queue/tenant status badges clearly visible
```

### Components

Use shared components before page-specific styling:

```text
AppShell
PlatformShell
Sidebar
Topbar
PageHeader
ModuleHeader
ContextBar
StatCard
InsightCard
SectionCard
DataTable
FilterBar
SearchInput
CommandSearch
Tabs
Badge
StatusBadge
ActionMenu
DropdownMenu
Dialog
AlertDialog
Sheet / Drawer
FormField
DatePicker
Select
Textarea
Toast
Skeleton
EmptyState
ErrorState
PermissionState
AuditTimeline
WorkflowStepper
```

If adding shadcn components, prefer copying/adapting primitives into `apps/web/components/ui` and styling them with SchoolOS tokens instead of introducing inconsistent one-off component libraries.

---

## 5. Performance Rules

Target user experience:

```text
Fast initial dashboard load
No layout jumping
Fast module navigation
Responsive tables and filters
Clear optimistic/pending state for mutations
```

Technical rules:

- Keep default layouts/pages as Server Components where possible.
- Use Client Components only for interactivity: forms, filters, mutation buttons, charts, tables, drawers, and browser APIs.
- Split heavy module widgets using dynamic imports where they are not needed above the fold.
- Use route-level `loading.tsx` and component skeletons.
- Use paginated APIs and paginated tables for large lists.
- Avoid client-side calculation of official totals; official totals must come from backend APIs.
- Use TanStack Query for cache, mutation invalidation, prefetching, and background refetch on interactive client screens.
- Avoid N+1 frontend request waterfalls; combine dashboard summary endpoints where appropriate.
- Use `next/image` for images where applicable and fixed dimensions to avoid layout shift.
- Virtualize or paginate large tables instead of rendering hundreds of rows.
- Track Core Web Vitals before/after the overhaul.

Performance acceptance targets:

```text
LCP: <= 2.5s on normal broadband staging
INP: <= 200ms for common interactions
CLS: <= 0.1
Dashboard route transition: feels instant after shell load
Module table filter/search: responsive without blocking typing
```

---

## 6. Dashboard First: Target Screen

The first overhaul target is `/dashboard`.

Main job:

```text
Give school leadership and admins a calm, accurate overview of what needs attention today.
```

Recommended sections:

```text
1. School day header
2. Today summary cards
3. Attention required panel
4. Attendance snapshot
5. Fee collection snapshot
6. Admissions / student movement snapshot
7. Notices and communication health
8. Recent activity and audit-safe timeline
9. Quick links to dedicated module screens
```

Dashboard must not become a full report page. Each card links to its dedicated module screen.

Dashboard API/data rules:

- Use backend summary APIs only.
- No fake KPI numbers.
- No frontend-only official totals.
- Show loading skeletons, stale-data indicators, and error recovery.
- Respect role permissions; users see only modules they can access.

---

## 7. Dedicated School Module Screens

Every module must own a dedicated route/workspace and sub-screens. Avoid hiding core operations inside generic dashboard cards.

### M1 Admissions / Students / Student Profiles

Target screens:

```text
/dashboard/students
/dashboard/students/[id]
/dashboard/admissions
/dashboard/admissions/new
/dashboard/admissions/review
```

UX direction:

- Student directory with search, class/section/status filters, sortable columns, and action menu.
- Student profile tabs: Overview, Guardians, Attendance, Fees, Academics, Documents, Activity, History.
- Admissions pipeline with drafts, duplicate warnings, document checklist, and review step.
- Clear lifecycle actions: transfer, withdraw, graduate, archive, rejoin.

### M2 Attendance

Target screens:

```text
/dashboard/attendance
/dashboard/attendance/register
/dashboard/attendance/corrections
/dashboard/attendance/reports
```

UX direction:

- Class/section/date context bar.
- Attendance register with clear present/absent/late/leave states.
- Bulk present and exception marking may exist, but do not frame the workflow as a tap-count concept.
- Draft, submit, lock, correction, conflict, and audit states visible.
- Reports are separate from register entry.

### M3 Fees / Receipts

Target screens:

```text
/dashboard/finance
/dashboard/finance/collections
/dashboard/finance/invoices
/dashboard/finance/receipts
/dashboard/finance/cashier-close
/dashboard/finance/reversals-refunds
/dashboard/finance/reports
```

UX direction:

- Separate cashier collection from accountant/ledger controls.
- Student search and dues panel optimized for front-desk use.
- Receipt success screen with print/download/share actions.
- Reversal/refund/cashier close require confirmation and audit reason.
- Gateway/payment mode must clearly show mock/disabled/sandbox/ready state.

### M4 Academics

Target screens:

```text
/dashboard/academics
/dashboard/academics/exams
/dashboard/academics/marks
/dashboard/academics/cas
/dashboard/academics/report-cards
/dashboard/academics/promotion
```

UX direction:

- Exams workflow: Setup → Enter Marks → Validate → Lock → Publish → Generate Reports.
- Keyboard-friendly marks/CAS grids.
- Report-card history and regeneration context.
- Result publish/withhold states explicit.

### M5 Activity Feed

Target screens:

```text
/dashboard/activity
/dashboard/activity/new
/dashboard/activity/moderation
/dashboard/activity/gallery
/dashboard/activity/milestones
```

UX direction:

- Activity Feed is for classroom updates and milestones.
- Audience and media consent must be visible before publishing.
- Moderated/archived states must be obvious.
- Media upload must show compression/progress/retry states.

### M6 Homework / Timetable

Target screens:

```text
/dashboard/homework
/dashboard/homework/new
/dashboard/homework/review
/dashboard/timetable
/dashboard/timetable/builder
/dashboard/timetable/substitutions
/dashboard/timetable/conflicts
```

UX direction:

- Homework grouped by Due Today, Upcoming, Overdue, Checked, Closed.
- Timetable builder separated from published timetable view.
- Conflicts, rooms, teacher workload, and substitutions have dedicated screens/panels.
- Substitution workflow shows available slots and absence context clearly.

### M7 HR / Payroll

Target screens:

```text
/dashboard/hr
/dashboard/hr/staff
/dashboard/hr/attendance
/dashboard/hr/leave
/dashboard/payroll
/dashboard/payroll/runs
/dashboard/payroll/payslips
/dashboard/payroll/reports
```

UX direction:

- Staff lifecycle timeline.
- Sensitive salary/bank fields masked by default unless permission allows.
- Payroll workflow: Draft → Approved → Posted → Paid.
- Statutory deductions and salary structures shown clearly.

### M8A Library

Target screens:

```text
/dashboard/library
/dashboard/library/catalog
/dashboard/library/issue-return
/dashboard/library/borrowers
/dashboard/library/fines
/dashboard/library/reports
```

UX direction:

- Scanner-first issue/return screen.
- Book/copy status visible.
- Borrower profile shows current loans, overdue items, fines, history.
- Fine posting/payment status must be clear.

### M8B Transport

Target screens:

```text
/dashboard/transport
/dashboard/transport/routes
/dashboard/transport/vehicles
/dashboard/transport/trips
/dashboard/transport/live-status
/dashboard/transport/students
/dashboard/transport/reports
```

UX direction:

- Show route/trip status before raw coordinates.
- Latest GPS freshness visible: fresh, delayed, stale, no ping.
- Parent tracking and live map remain gated until runtime/device/load checks pass.
- Driver/vehicle overlap warnings visible.

### M8C Canteen

Target screens:

```text
/dashboard/canteen
/dashboard/canteen/pos
/dashboard/canteen/menu
/dashboard/canteen/wallets
/dashboard/canteen/meal-plans
/dashboard/canteen/inventory
/dashboard/canteen/vendors
/dashboard/canteen/reports
```

UX direction:

- Fast POS with student QR/search, wallet balance, allergy warning, and receipt.
- Menu and inventory separated.
- Low-stock, wallet guard, spending limit, allergy, and disabled-item warnings prominent.

### M9 Accounting

Target screens:

```text
/dashboard/accounting
/dashboard/accounting/chart-of-accounts
/dashboard/accounting/journals
/dashboard/accounting/fiscal-periods
/dashboard/accounting/reconciliation
/dashboard/accounting/reports
/dashboard/accounting/audit
```

UX direction:

- Accountant dashboard shows fiscal period, pending postings, unreconciled items, and export history.
- Posted entries immutable; corrections use reversal/correction workflows.
- Bank import/reconciliation has review, validation errors, matching suggestions, and confirmation.

### M10 Notices / Chat

Target screens:

```text
/dashboard/notices
/dashboard/notices/new
/dashboard/notices/deliveries
/dashboard/messages
/dashboard/messages/threads
/dashboard/messages/moderation
```

UX direction:

- Notices are official announcements; chat is conversation.
- Notice audience preview before high-impact sending.
- Delivery failures, unread recipients, provider mode, and retry state visible.
- Chat moderation/report/block/escalation states explicit.

### Settings

Target screens:

```text
/dashboard/settings
/dashboard/settings/school-profile
/dashboard/settings/academic-structure
/dashboard/settings/classes-sections
/dashboard/settings/roles-permissions
/dashboard/settings/modules
/dashboard/settings/fees
/dashboard/settings/notifications
/dashboard/settings/security-audit
```

UX direction:

- Settings grouped by school operational domains.
- No developer/platform-only settings shown to normal school admins.
- Audit-log visibility included for permitted users.
- Dangerous changes require confirmation and reason.

---

## 8. Platform Control Plane Screens

Target screens:

```text
/platform/dashboard
/platform/schools
/platform/schools/[tenantId]
/platform/schools/[tenantId]/billing
/platform/settings
/platform/settings/plans
/platform/settings/providers
/platform/operations/health
/platform/operations/queues
/platform/operations/audit
/platform/operations/reports
```

UX direction:

- Platform is for SchoolOS operators, not school staff.
- Use operational language: tenant health, provider readiness, queue failures, billing state, support access.
- Dangerous platform actions require confirmation, reason, permission, and audit trail.
- Provider screens must clearly show disabled/mock/sandbox/ready states.

---

## 9. API Integration Rules

Every screen must have an explicit backend API integration plan:

```text
Read APIs
Mutation APIs
Permission requirements
Tenant ownership rules
Loading state
Empty state
Error state
Success state
Audit behavior
Cache invalidation behavior
Pagination/filter behavior
```

Rules:

- Frontend must not invent missing official totals.
- Frontend must not persist production workflow state only in memory.
- Frontend must parse backend error messages into school-friendly copy.
- Mutations must invalidate or update relevant TanStack Query keys.
- Growing lists must use server pagination/filtering.
- Backend permission denial must show `PermissionState`, not a broken screen.

---

## 10. Implementation Sequence

Start with Dashboard, then shell/components, then modules.

```text
0. Remove old shortcut/tap-based language from docs.
1. Audit current dashboard and platform shell.
2. Build/standardize UI primitives and design tokens.
3. Overhaul `/dashboard` first.
4. Overhaul school operations shell/sidebar/topbar.
5. Overhaul Platform Control Plane shell/screens.
6. Module pass 1: M1 Students/Admissions, M2 Attendance, M3 Fees.
7. Module pass 2: M4 Academics, M6 Homework/Timetable, M10 Notices/Chat.
8. Module pass 3: M7 HR/Payroll, M9 Accounting.
9. Module pass 4: M8A Library, M8B Transport, M8C Canteen.
10. Settings polish and audit/security visibility.
11. Performance, accessibility, route smoke, and visual regression pass.
```

Do not overhaul all pages in one uncontrolled diff. Work module-by-module with tests and screenshots where possible.

---

## 11. Verification Checklist

For every UI overhaul slice:

```text
pnpm --filter @schoolos/web lint
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/web test
pnpm --filter @schoolos/web build
```

When services are available:

```text
pnpm --filter @schoolos/web test:e2e
pnpm smoke:phase1
```

Manual checks:

- Keyboard navigation.
- Focus rings.
- Screen-reader labels for icon buttons.
- Loading skeletons.
- Empty states.
- Error states.
- Permission denied states.
- Slow network behavior.
- No layout shift on dashboard cards/tables.
- No console errors.
- No fake data.
- API calls are permission-safe and tenant-safe.

---

## 12. Definition of Done for the Overhaul

```text
1. Dashboard is redesigned and backend-backed.
2. School and platform shells are consistent, fast, responsive, and permission-aware.
3. Each module has dedicated screens for its real workflow.
4. Every module uses shared UI primitives and design tokens.
5. No old shortcut/tap-based UX language remains in docs or user-facing copy.
6. All module pages connect to real backend APIs.
7. Large lists use server pagination/filtering.
8. Mutations show pending/success/error states and invalidate correct queries.
9. Financial, posting, publishing, lock, retry, and destructive actions use confirmation/audit reason where needed.
10. Core Web Vitals and route smoke are checked before claiming UI completion.
```
