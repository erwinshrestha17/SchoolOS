# SchoolOS UI/UX Guide

**Status:** Single source of truth for SchoolOS UI/UX, web dashboard overhaul, platform UI, component strategy, colors, typography, accessibility, and performance rules.  
**Last updated:** 2026-06-04

This is the active UI/UX source of truth for:

```text
School web admin dashboard
Platform control plane
Settings workspace
All web module workspaces in apps/web
Mobile companion app direction
Future public website direction
```

This file replaces and merges:

```text
docs/design/SCHOOLOS_WEB_DASHBOARD_UI_UX_OVERHAUL_PLAN.md
docs/design/SCHOOLOS_WEB_DESIGN_SYSTEM_DECISIONS.md
docs/design/SCHOOLOS_FINAL_UI_UX_DIRECTION.md
docs/design/SCHOOLOS_PLATFORM_UI_UX_OPTIMIZATION_PLAN.md
docs/design/SCHOOLOS_PLATFORM_UI_REDO_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_CURRENT_UI_PROGRESS.md
```

Do not recreate those separate docs unless the project grows enough to justify splitting design documentation again.

---

## 1. Core Direction

```text
SchoolOS is a School Management System, not a quick-action prototype.
```

Core principle:

```text
One screen = one main job.
```

Every screen must answer:

```text
What is the user trying to finish here?
```

Rules:

1. Every module gets its own dedicated workspace and detail screens.
2. Do not compress complex school-office workflows into shortcut concepts.
3. Remove shortcut/tap-count wording from docs and user-facing copy.
4. Start the web overhaul with the school Dashboard.
5. Keep Platform Control separate from School Operations.
6. Keep Settings as a dedicated school configuration workspace.
7. All screens must consume real backend APIs.
8. No fake production data, placeholder metrics, or local-only state for production flows.
9. All tenant-owned data must remain backend tenant-scoped.
10. All destructive, financial, publishing, posting, lock, retry, and support actions need confirmation, reason where needed, and auditability.

SchoolOS must feel like a modern, trustworthy, Nepal-ready School Management System. It should not feel like a complicated ERP, a generic CRUD dashboard, or a shortcut-action prototype.

---

## 2. Current Web Stack and Research Direction

Current `apps/web` stack:

```text
Next.js 15
React 19
Tailwind CSS 4
TanStack Query 5
Zod
React Hook Form
Lucide icons
Inter font
Custom shadcn-style UI primitives in apps/web/components/ui
```

Research-backed direction:

- Use Tailwind utility classes through a constrained SchoolOS design-token system.
- Use SchoolOS-owned components built from shadcn-style primitives where accessible interaction behavior is needed.
- Avoid a heavy external component-provider system as the primary UI layer.
- Use Next.js App Router patterns carefully: keep layouts/pages server-rendered where possible, and isolate client components only for state, event handlers, browser APIs, charts, filters, forms, and interactive tables.
- Optimize against Core Web Vitals: LCP, INP, and CLS.
- Use TanStack Query for authenticated client-side server state, caching, background refetch, pagination, mutations, and invalidation where interactivity is required.

Reference links:

```text
Tailwind utility-first docs: https://tailwindcss.com/docs/styling-with-utility-classes
shadcn docs: https://ui.shadcn.com/docs
Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
Next.js fonts: https://nextjs.org/docs/app/getting-started/fonts
Core Web Vitals: https://web.dev/articles/vitals
TanStack Query overview: https://tanstack.com/query/latest/docs/framework/react/overview
```

---

## 3. Product Experience Goals

SchoolOS UI/UX must be:

- **Simple:** common tasks should be easy to find, clearly labeled, and supported by dedicated screens.
- **Role-aware:** admins, teachers, accountants, admission staff, principals, parents, students, drivers, and platform operators should only see what they need.
- **Trustworthy:** finance, attendance, student records, medical data, documents, communication, and accounting actions must feel secure and auditable.
- **School-friendly:** labels, navigation, icons, and workflows must match real school operations.
- **Desktop-first for school operations:** admin, finance, attendance, reports, HR, and accounting workflows need tables, filters, exports, and approval flows.
- **Mobile-first for parents, teachers, students, and drivers:** mobile screens should be card-based, quick-action focused, and not table-heavy.
- **Nepal-ready:** support NPR, class/section conventions, guardian structures, Nepali phone patterns, receipt printing, local payment labels, and future Bikram Sambat support.
- **Safe for children:** student and parent experiences must be scoped, controlled, age-aware, and privacy-preserving.
- **Fast:** dashboard and module pages should use server/client boundaries, skeletons, pagination, caching, and code-splitting where appropriate.

---

## 4. Experience Families

### Public Website

Target: future public pages in `apps/web`.

Purpose:

- Explain SchoolOS modules.
- Show trust, security, and Nepal readiness.
- Support demo requests and onboarding inquiries.
- Provide SEO-friendly public pages.

Rules:

- Keep marketing/public UI separate from internal dashboard UI.
- Do not expose tenant operations.
- Use product storytelling, screenshots, school outcomes, and simple CTAs.

### School Web Dashboard

Current app: `apps/web` Next.js dashboard.

Purpose:

- Run daily school operations.
- Manage students, attendance, fees, communication, academics, HR, accounting, library, transport, and canteen.
- Support reports, exports, approvals, and audit-friendly operations.

Rules:

- Consume real APIs.
- Do not use fake production data.
- Preserve cookie-first auth behavior.
- Keep tenant-owned workflows tenant-scoped by backend APIs.
- Keep school operations under `/dashboard/*`.
- Every module must have dedicated workspace/screens for its main workflow.
- Start web overhaul work with the Dashboard before moving module-by-module.

### Platform Control Plane

Route target: `/platform/*`.

Purpose:

- Manage schools/tenants.
- Manage plans, limits, SaaS billing, support access, provider readiness, queue health, and platform audit logs.

Rules:

- Must be visually and functionally separate from tenant school operations.
- Platform users are not school staff.
- Platform access must be explicit, permission-guarded, and audited.
- Never mix M0 SaaS invoices/payments with M3 student fees or M9 school ledger screens.

### Mobile Companion App

Current target: `apps/schoolos_mobile` Flutter app.

Purpose:

- Provide quick answers and focused role-specific actions.
- Avoid dense dashboards and complex tables.
- Give role-specific parent, student, teacher, staff, driver, and admin flows.

Rules:

- Mobile should not be a mini web-admin dashboard.
- Use cards, timelines, bottom navigation, simple lists, and action buttons.
- Parents see only their own child/children.
- Drivers see only assigned transport data.
- Students get age-appropriate access only.

---

## 5. Component Strategy Decision

Final decision:

```text
Use SchoolOS-owned custom components built from shadcn-style primitives.
```

Do not adopt a heavy third-party dashboard/component provider as the primary UI layer.

SchoolOS should maintain its own component system in:

```text
apps/web/components/ui
apps/web/components/layout
apps/web/components/dashboard
apps/web/components/<module>
```

shadcn/ui may be used as:

```text
- a source/reference for accessible component patterns
- a CLI/source for vendoring component code into the repo
- a Radix-powered primitive pattern for Dialog, AlertDialog, Select, Dropdown, Popover, Tabs, Sheet, Command, Tooltip, and similar complex interactions
```

But final components must be SchoolOS-owned, styled with SchoolOS tokens, and reviewed for tenant-safe and module-safe behavior.

### Why not a heavy packaged component provider?

Avoid using a full provider such as Material UI, Ant Design, Mantine, Chakra, Bootstrap admin kits, or a paid dashboard kit as the dominant UI system because:

- SchoolOS has a specialized Nepal school-operations domain, not a generic SaaS dashboard domain.
- Financial, attendance, student-profile, report-card, payroll, transport, canteen, and platform-support flows need custom audit and permission behavior.
- A provider-heavy system can create inconsistent APIs, overrides, bundle weight, and visual mismatch.
- SchoolOS already uses Tailwind CSS 4 and custom primitives, so a controlled internal system is safer.

### Why shadcn-style is good for SchoolOS

shadcn/ui is useful because it is open component code and a way to build your own component library. That matches SchoolOS because we need full control over styling, behavior, accessibility, and audit-focused workflows.

Use shadcn-style components for:

```text
Button
Card
Badge
Alert
AlertDialog
Dialog
DropdownMenu
Select
Tabs
Sheet / Drawer
Command / Global Search
Popover
Tooltip
Skeleton
Table
Pagination
Textarea
Input
Checkbox
Switch
RadioGroup
Calendar / DatePicker
Toast / Sonner-style feedback
Sidebar pattern
```

Use custom SchoolOS domain components for:

```text
StudentProfileHeader
StudentLifecycleTimeline
AttendanceRegister
FeeCollectionPanel
ReceiptSuccessPanel
ExamMarksGrid
ReportCardPreview
ActivityComposer
HomeworkStatusBoard
TimetableGrid
PayrollStepper
LibraryIssueReturnPanel
TransportTripStatusPanel
CanteenPOSPanel
AccountingJournalTable
NoticeAudiencePreview
AuditReasonDialog
ProviderModeBadge
TenantStatusBadge
```

Implementation rules:

```text
1. Start from existing custom components where they are good.
2. Replace weak one-off UI with shared primitives gradually.
3. Vendor/adapt shadcn components only when needed.
4. Do not introduce unused component dependencies.
5. Keep component APIs simple and predictable.
6. Do not put business rules only in UI components.
7. Every dangerous action component must support confirmation, reason, loading, error, permission, and audit hint states.
8. Every form component must support field error, helper text, disabled state, and loading state.
9. Every data component must support loading, empty, error, pagination, filters, and permission-denied states.
```

---

## 6. Technical Component Stack

Required:

```text
Next.js App Router
React
Tailwind CSS 4
SchoolOS design tokens in globals.css / Tailwind theme
SchoolOS-owned components in apps/web/components/ui
Lucide icons
TanStack Query for interactive authenticated server state
React Hook Form + Zod for forms
```

Allowed when needed:

```text
Radix primitives through shadcn-style components
class-variance-authority for variants
clsx / tailwind-merge for class composition
TanStack Table for complex tables if custom tables become hard to maintain
```

Not recommended as primary UI system:

```text
Material UI
Ant Design
Mantine
Chakra UI
Bootstrap admin kits
Paid dashboard templates as source of truth
```

Performance rule:

```text
Keep layout, shell, and static dashboard sections server-rendered where possible. Move only truly interactive pieces into Client Components.
```

---

## 7. Global Brand Palette

### Base tokens

| Token | Hex | Usage |
|---|---:|---|
| `brand.primary` | `#155EEF` | Primary SchoolOS action, links, active state |
| `brand.primaryDark` | `#0B3A88` | Sidebar active, strong headers |
| `brand.primarySoft` | `#EAF1FF` | Soft selected backgrounds |
| `brand.secondary` | `#7C3AED` | Secondary accent / premium platform detail |
| `surface.app` | `#F3F7FB` | App background |
| `surface.card` | `#FFFFFF` | Cards, panels, tables |
| `surface.subtle` | `#F8FAFC` | Subtle cards, table header |
| `border.default` | `#E2E8F0` | Borders |
| `border.strong` | `#CBD5E1` | Focused/active borders |
| `text.primary` | `#0F172A` | Main text |
| `text.secondary` | `#475569` | Secondary text |
| `text.muted` | `#64748B` | Metadata / muted text |
| `text.disabled` | `#94A3B8` | Disabled labels |
| `success` | `#16A34A` | Success states |
| `warning` | `#D97706` | Warning states |
| `danger` | `#DC2626` | Dangerous/error states |
| `info` | `#0284C7` | Informational states |

### State colors

| State | Text/Icon | Soft background | Border |
|---|---:|---:|---:|
| Success | `#15803D` | `#DCFCE7` | `#86EFAC` |
| Warning | `#B45309` | `#FEF3C7` | `#FCD34D` |
| Danger | `#B91C1C` | `#FEE2E2` | `#FCA5A5` |
| Info | `#0369A1` | `#E0F2FE` | `#7DD3FC` |
| Neutral | `#475569` | `#F1F5F9` | `#CBD5E1` |

---

## 8. Module Color Palette

Module colors are accents only. They should not replace semantic success/warning/danger colors. Use module colors for icons, tabs, left borders, soft cards, route badges, and module identity.

| Area | Accent | Accent soft | Accent border | Accent text | Notes |
|---|---:|---:|---:|---:|---|
| Dashboard | `#155EEF` | `#EAF1FF` | `#A9C9FF` | `#0B3A88` | Core command center |
| Platform Control | `#4F46E5` | `#EEF2FF` | `#C7D2FE` | `#3730A3` | Separate from school ops |
| M1 Admissions / Students | `#2563EB` | `#EFF6FF` | `#BFDBFE` | `#1D4ED8` | Trust, identity, student records |
| M2 Attendance | `#059669` | `#ECFDF5` | `#A7F3D0` | `#047857` | Presence, reliability |
| M3 Fees / Receipts | `#D97706` | `#FFFBEB` | `#FCD34D` | `#92400E` | Money action + caution |
| M4 Academics | `#7C3AED` | `#F5F3FF` | `#DDD6FE` | `#6D28D9` | Exams, marks, report cards |
| M5 Activity Feed | `#DB2777` | `#FDF2F8` | `#FBCFE8` | `#BE185D` | Classroom updates/media |
| M6 Homework / Timetable | `#0284C7` | `#E0F2FE` | `#7DD3FC` | `#0369A1` | Scheduling and assignments |
| M7 HR / Payroll | `#9333EA` | `#FAF5FF` | `#E9D5FF` | `#7E22CE` | Staff, HR, payroll |
| M8A Library | `#0D9488` | `#F0FDFA` | `#99F6E4` | `#0F766E` | Books, catalog, borrowing |
| M8B Transport | `#EA580C` | `#FFF7ED` | `#FDBA74` | `#C2410C` | Routes, vehicles, movement |
| M8C Canteen | `#65A30D` | `#F7FEE7` | `#BEF264` | `#4D7C0F` | Food, wallet, POS |
| M9 Accounting | `#0F766E` | `#F0FDFA` | `#99F6E4` | `#115E59` | Ledger, reconciliation, fiscal control |
| M10 Notices / Chat | `#E11D48` | `#FFF1F2` | `#FDA4AF` | `#BE123C` | Communication, urgency |
| Reports | `#0891B2` | `#ECFEFF` | `#67E8F9` | `#0E7490` | Exports and analytics reports |
| Settings | `#475569` | `#F8FAFC` | `#CBD5E1` | `#334155` | Configuration, neutral admin |
| Public Demo / Marketing | `#155EEF` | `#EAF1FF` | `#A9C9FF` | `#0B3A88` | Public SchoolOS brand |

Rules:

```text
1. Use module accent for identity only.
2. Use semantic colors for status and risk.
3. Do not make whole pages strongly colored.
4. Keep backgrounds calm and light.
5. Keep finance/accounting numbers high-contrast and tabular.
6. Emergency notices use danger red regardless of M10 accent.
7. Platform risk states use danger/warning, not only platform indigo.
```

---

## 9. Typography Decision

Primary font:

```text
Inter Variable via next/font/google
```

Reason:

- Current repo already uses Inter.
- Inter is clean, readable, and good for dense dashboards, tables, numbers, and admin workflows.
- Move from CSS `@import` to `next/font/google` during implementation to reduce external font requests and improve performance/layout stability.

Fallback stack:

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Use tabular numbers for:

```text
NPR amounts
attendance counts
percentages
receipt numbers
invoice numbers
ledger values
payroll values
student counts
route counts
inventory counts
```

Tailwind utility:

```text
tabular-nums
```

---

## 10. Font Size Scale

Use this scale across the dashboard. Do not invent one-off sizes unless a specific component requires it.

| Token | Size / line-height | Weight | Usage |
|---|---|---:|---|
| `display-lg` | `40px / 48px` | 800 | Marketing/public hero only, not dense admin pages |
| `display-md` | `36px / 44px` | 800 | Dashboard welcome hero, platform command center |
| `page-title` | `30px / 38px` | 800 | Module page title |
| `page-subtitle` | `15px / 24px` | 400-500 | Page description under title |
| `section-title` | `20px / 28px` | 700 | Section/card group title |
| `card-title` | `15px / 22px` | 700 | Card header/title |
| `kpi-xl` | `36px / 44px` | 800 | Hero KPI number |
| `kpi-lg` | `30px / 38px` | 800 | Regular dashboard stat number |
| `kpi-md` | `24px / 32px` | 800 | Small card stat number |
| `body-lg` | `16px / 26px` | 400-500 | Comfortable body/readable explanations |
| `body` | `14px / 22px` | 400-500 | Default dashboard text |
| `body-sm` | `13px / 20px` | 400-500 | Dense table cell / compact metadata |
| `caption` | `12px / 18px` | 500 | Helper text, form help, card metadata |
| `label` | `12px / 16px` | 700 | Uppercase labels, table headers |
| `button` | `14px / 20px` | 700 | Buttons and action labels |
| `input` | `14px / 22px` | 400-500 | Inputs/selects/textareas |
| `badge` | `12px / 16px` | 700 | Badges and status pills |
| `table-header` | `12px / 16px` | 700 | Table headers |
| `table-cell` | `13px / 20px` | 400-500 | Default table cells |

Recommended Tailwind mapping:

```text
Display large: text-[40px] leading-[48px] font-extrabold
Display medium: text-[36px] leading-[44px] font-extrabold
Page title: text-[30px] leading-[38px] font-extrabold
Section title: text-xl leading-7 font-bold
Card title: text-[15px] leading-[22px] font-bold
KPI XL: text-[36px] leading-[44px] font-extrabold tabular-nums
KPI LG: text-[30px] leading-[38px] font-extrabold tabular-nums
KPI MD: text-2xl leading-8 font-extrabold tabular-nums
Body LG: text-base leading-[26px]
Body: text-sm leading-[22px]
Body SM: text-[13px] leading-5
Caption: text-xs leading-[18px]
Label: text-xs leading-4 font-bold uppercase tracking-wide
Button: text-sm leading-5 font-bold
Table cell: text-[13px] leading-5
```

---

## 11. Component Size Rules

### Radius

| Token | Value | Usage |
|---|---:|---|
| `radius-sm` | `8px` | Badges, compact pills |
| `radius-md` | `10px` | Inputs, selects, compact controls |
| `radius-lg` | `12px` | Buttons, table filter controls |
| `radius-xl` | `16px` | Cards, dialogs, module panels |
| `radius-2xl` | `20px` | Dashboard cards, large panels |
| `radius-3xl` | `24px` | Hero cards only |

### Spacing

| Token | Value | Usage |
|---|---:|---|
| `page-x` | `24px desktop / 16px tablet` | Page horizontal padding |
| `page-y` | `24px` | Page vertical padding |
| `section-gap` | `24px` | Between major sections |
| `card-padding` | `20px-24px` | Dashboard cards |
| `dense-card-padding` | `16px` | Table/filter cards |
| `control-gap` | `8px-12px` | Button/input groups |
| `table-row-height` | `48px-56px` | Data table rows |

### Control heights

| Component | Height |
|---|---:|
| Button default | `40px` |
| Button large | `44px-48px` |
| Input/select default | `40px-44px` |
| Search input | `44px` |
| Table filter control | `40px` |
| Badge | `24px-28px` |
| Topbar | `64px` |
| Sidebar width expanded | `264px-280px` |
| Sidebar width collapsed | `72px-80px` |

---

## 12. Global Layout Rules

Every web admin page should follow this structure:

```text
App Shell
  Topbar
  Left Sidebar
  Page Header
  Context Bar / Filters
  Summary / KPI Strip
  Main Workspace
  Optional Right Insight Panel or Drawer
  Sticky Action Footer only when needed
```

### Topbar

The topbar should include:

- School selector.
- Global search.
- Notification bell.
- User profile menu.
- Academic year/date context where relevant.

Global search should support student name, admission number, guardian phone, invoice number, receipt number, staff name, book/barcode, vehicle number, and notice title.

### Sidebar

Do not show technical phase labels like Phase 1, Phase 2, or Phase 3 in user-facing navigation.

Recommended school operations sidebar:

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
Reports
Settings
```

Rules:

- Active route highlighting.
- Collapsible/toggleable sidebar.
- Clear icons.
- No phase labels.
- Permission-hidden items should not appear for users without access.
- Platform pages must remain outside normal school operations navigation.
- Each sidebar item opens a dedicated module screen or workspace.

### Page Header

Every module page should start with:

```text
Title
Short description
Primary action
Optional secondary action menu
```

Avoid placing 4-6 equal-weight buttons in the header. Secondary actions go inside `More Actions`.

---

## 13. Platform UI Rules

The M0 Platform Control Plane is for SchoolOS operators, not school staff.

Route map:

| Route | Screen job | Primary action |
|---|---|---|
| `/platform/dashboard` | Show what needs platform attention today | View schools or attention items |
| `/platform/schools` | Find and manage school tenants | Onboard new school |
| `/platform/schools/[tenantId]` | Understand and safely manage one school | Open support access or view billing |
| `/platform/billing/subscriptions` | Manage school subscriptions | Select school subscription |
| `/platform/billing/invoices` | Track SchoolOS SaaS invoices | View unpaid invoices |
| `/platform/billing/payments` | Review SchoolOS SaaS payment records | View recent payments |
| `/platform/settings/plans` | Configure SaaS plans and limits | Review plans |
| `/platform/settings/providers` | Configure and verify providers | Run readiness check |
| `/platform/operations/health` | Check infrastructure readiness | Open health details |
| `/platform/operations/queues` | Diagnose and retry failed jobs safely | Inspect failed jobs |
| `/platform/operations/audit` | Answer who did what, when, and why | Filter audit logs |
| `/platform/operations/reports` | Review generated platform reports | View report history |

Dangerous platform actions include suspending/reactivating tenants, opening support override, retrying failed jobs, discarding failed jobs, changing active plan rules, cancelling SaaS invoices, and rotating/disabling provider secrets.

Every dangerous platform action must include:

- Confirmation.
- Reason field.
- Clear warning.
- Permission check.
- Audit log expectation.

---

## 14. UX Rules for Non-Technical Users

Use school language.

Bad:

```text
Entity
Mutation failed
Workflow state
403 Forbidden
Posting exception
```

Good:

```text
Student
Save failed
Waiting for approval
You do not have permission
Payment could not be posted
```

Guide the next action:

```text
Next: Verify Documents
Next: Collect Payment
Next: Submit Attendance
Next: Approve Payroll
Next: Publish Notice
```

Important actions must show confirmation dialogs:

- Submit attendance.
- Collect payment.
- Reverse payment.
- Close cashier day.
- Lock marks.
- Publish result.
- Approve payroll.
- Post journal.
- Transfer student.
- Mark student inactive.
- Delete/soft-delete posts.
- Retry failed jobs.
- Open support override.

Confirmation dialogs must include what will happen, who/what is affected, whether it can be changed later, and a reason field for destructive/financial/audit-critical actions.

---

## 15. Shared Component System

Core web components:

```text
AppShell
PlatformShell
Sidebar
Topbar
PageHeader
ModuleHeader
ContextBar
SectionCard
StatCard
InsightCard
StatusBadge
Badge
DataTable
FilterBar
SearchInput
CommandSearch
ActionMenu
DropdownMenu
ConfirmDialog
AlertDialog
Sheet / Drawer
Toast
EmptyState
LoadingState / Skeleton
ErrorState
PermissionState
AuditInfo
AuditTimeline
StudentAvatar
MoneyDisplay
DateDisplay
ProgressStepper
WorkflowTimeline
NotificationBadge
Tabs
```

Mobile/PWA components:

```text
MobileShell
MobileHeader
MobileBottomNav
MobileStatCard
MobileActionGrid
MobileNoticeCard
MobileHomeworkCard
MobileFeeCard
MobileAttendanceCalendar
MobileTimelineItem
ChildSwitcher
TripStatusCard
```

Component rules:

- Components must be reusable across modules.
- Avoid one-off styling inside pages.
- Keep variants explicit: `success`, `warning`, `danger`, `info`, `neutral`.
- Use semantic states instead of raw colors.
- All loading, empty, error, and permission-denied states must be reusable.
- Prefer shadcn-style primitives adapted under `apps/web/components/ui` with SchoolOS tokens.

### Use shadcn-style primitives for accessible behavior

Use or adapt shadcn/Radix-like primitives when the component needs keyboard/accessibility behavior that is easy to get wrong:

```text
Dialog
AlertDialog
Popover
DropdownMenu
Select
Tabs
Tooltip
Sheet
Command
Calendar
Checkbox
RadioGroup
Switch
Toast
```

### Use custom SchoolOS components for domain workflows

Custom components should wrap primitives and enforce SchoolOS-specific rules.

Examples:

```text
AuditReasonDialog wraps AlertDialog + form reason validation.
FeeCollectionPanel wraps Card + DataTable + mutation states.
AttendanceRegister wraps table/list + attendance state controls.
ProviderModeBadge wraps Badge with disabled/mock/sandbox/ready rules.
```

Anti-patterns:

```text
- Mix multiple UI libraries for the same primitive.
- Use raw Tailwind one-off styles for repeated patterns.
- Put permissions only in frontend components.
- Use module colors as status colors.
- Use decorative gradients on dense admin screens.
- Use tiny text below 12px for operational data.
- Use light grey text for money, attendance, payroll, or alerts.
```

---

## 16. Performance Rules

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

## 17. Dashboard First: Target Screen

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

## 18. Dedicated School Module Screens

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

## 19. Platform Control Plane Screens

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

## 20. API Integration Rules

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

## 21. Implementation Sequence

Start with design system, then Dashboard, then shell/components, then modules.

```text
0. Remove old shortcut/tap-based language from docs and user-facing copy.
1. Apply design-system decisions: component strategy, palette, typography, font loading, size scale.
2. Convert font loading from CSS @import to next/font/google Inter.
3. Add/standardize cn/class utility if missing.
4. Standardize Button, Card, Badge, Input, Select, Tabs, Dialog, AlertDialog, Sheet, DropdownMenu, Table, Skeleton, EmptyState, ErrorState, PermissionState.
5. Add module color token map.
6. Audit current dashboard and platform shell.
7. Overhaul `/dashboard` first.
8. Overhaul school operations shell/sidebar/topbar.
9. Overhaul Platform Control Plane shell/screens.
10. Module pass 1: M1 Students/Admissions, M2 Attendance, M3 Fees.
11. Module pass 2: M4 Academics, M6 Homework/Timetable, M10 Notices/Chat.
12. Module pass 3: M7 HR/Payroll, M9 Accounting.
13. Module pass 4: M8A Library, M8B Transport, M8C Canteen.
14. Settings polish and audit/security visibility.
15. Performance, accessibility, route smoke, and visual regression pass.
```

Do not overhaul all pages in one uncontrolled diff. Work module-by-module with tests and screenshots where possible.

---

## 22. Current UI Progress Snapshot

Current status:

```text
Admin web global polish is implemented for the current modular-monolith scope.
Dashboard shell polish, accounting audit context, transport location freshness, scanner-first Library/Canteen QR flows, report-card correction review, and app-controlled toasts/confirmation dialogs are present.
A full web dashboard UI/UX overhaul direction, component strategy, color palette, typography, font scale, and module-screen plan are now merged into this guide.
Next UI work should start with design-system primitives and `/dashboard`, then shared shell/components, then platform and module workspaces.
```

Implemented highlights:

- Dashboard shell includes skip link, sharper card radius, readable section/stat typography, and clearer fee-alert routing.
- Accounting audit workspace surfaces summary cards, richer log detail, and loading/empty states.
- Transport latest-location workflow shows Fresh, Delayed, Stale, and No ping context.
- Library issue and Canteen serving/POS workflows use scanner-first copy/student QR context and warnings.
- Academics, Homework, Admissions, Staff, Students, and Platform operations use app-controlled feedback instead of browser-native `alert()`/`confirm()`.
- Web contract rejects future `alert()`/`confirm()` usage in `apps/web/app` and `apps/web/components`.
- Flutter parent, teacher, notification, staff, driver, and canteen surfaces now use purpose-limited APIs where available.

Verification snapshot:

```text
- Web contract tests passed for app-controlled feedback coverage in prior targeted polish runs.
- Web typecheck has passed in prior targeted polish runs.
- Browser/staging smoke still needs execution in an environment that can bind local ports and has Postgres, Redis, API, and web running.
```

---

## 23. Accessibility and Smoke Coverage

Required:

- Keyboard navigation and visible focus rings.
- `aria-label` for icon-only buttons.
- Dialog focus trap.
- Escape-to-close behavior where appropriate.
- Skeleton/loading frames instead of confusing blank areas.
- Empty, error, and permission-denied states for all important routes.
- No layout shift on dashboard cards/tables/fonts.
- No console errors.
- No fake data.
- API calls are permission-safe and tenant-safe.
- Core Web Vitals should be checked before claiming UI overhaul completion.

---

## 24. Verification Checklist

For every UI overhaul slice:

```bash
pnpm --filter @schoolos/web lint
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/web test
pnpm --filter @schoolos/web build
```

When services are available:

```bash
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

## 25. Definition of Done for the Web UI/UX Overhaul

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
