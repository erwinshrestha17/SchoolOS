# SchoolOS UI/UX Guide

**Status:** Single source of truth for SchoolOS UI/UX, web dashboard overhaul, platform UI, component strategy, colors, typography, accessibility, and performance rules.  
**Last updated:** 2026-06-15

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
- Use TanStack Query for cache, mutation invalidation, pagination, and background refetch.
- Do not fetch every module's data on the main dashboard.
- Avoid large icon packs, chart bundles, and animation libraries unless needed.
- Keep mobile network performance in mind for Nepal users.

---

## 17. Dashboard First: Target Screen

The school dashboard should be the first overhaul target.

Target purpose:

```text
Show what the school needs to know and act on today.
```

Recommended dashboard sections:

1. Welcome / school context / academic year.
2. Today summary cards:
   - Students present / absent.
   - Fees collected today.
   - Pending dues.
   - Staff present / absent.
   - Pending approvals.
3. Priority tasks:
   - Attendance not submitted.
   - Payment reversals waiting approval.
   - Report cards pending generation.
   - Notices scheduled today.
   - Payroll or accounting posting pending.
4. Module health grid:
   - Students.
   - Attendance.
   - Fees.
   - Academics.
   - Communication.
   - HR.
5. Recent activity / audit-safe activity stream.
6. Optional right insight panel:
   - Upcoming events.
   - Quick reports.
   - System/module warnings.

Rules:

- Dashboard should not become a shortcut wall.
- Every card should link to a real module screen.
- Metrics must come from backend APIs.
- If a metric is unavailable, show unavailable state, not fake value.
- Use role-aware dashboard variants later.

---

## 18. Dedicated School Module Screens

Each module needs its own workspace.

### Students

Route:

```text
/dashboard/students
/dashboard/students/[id]
```

Main job:

```text
Find, review, and manage student records safely.
```

Screen requirements:

- Student directory table.
- Search by name/admission number/guardian phone.
- Filters: class, section, status, admission year.
- Student profile detail screen.
- Tabs for profile, guardians, attendance, fees, documents, academics, activity, audit.
- Clear status badges.
- No fake documents or fake attendance summaries.

### Admissions

Route:

```text
/dashboard/admissions
```

Main job:

```text
Move applicants from inquiry/application to enrolled student.
```

Screen requirements:

- Admission pipeline table or board.
- Application status filters.
- Duplicate warning panel.
- Document checklist.
- Enrollment action with confirmation.

### Attendance

Route:

```text
/dashboard/attendance
```

Main job:

```text
Mark, review, correct, and report attendance.
```

Screen requirements:

- Class/section/date filters.
- Attendance marking screen.
- Monthly register.
- Corrections queue.
- Lock/permission states.
- Export attendance reports.

### Fees

Route:

```text
/dashboard/fees
```

Main job:

```text
Bill, collect, receipt, refund/reverse, and report student fees.
```

Screen requirements:

- Fee dashboard summary.
- Invoice list.
- Payment collection panel.
- Receipt viewer/reprint.
- Defaulter list.
- Refund/reversal approval queue.
- Clear money display with NPR and tabular numbers.

### Academics

Route:

```text
/dashboard/academics
```

Main job:

```text
Manage exams, marks, CAS, report cards, results, and promotions.
```

Screen requirements:

- Exam term setup.
- Marks entry grid.
- CAS records.
- Report card generation.
- Result publishing readiness.
- Promotions workflow.

### Activity Feed

Route:

```text
/dashboard/activity-feed
```

Main job:

```text
Share classroom updates and milestones safely with families.
```

Screen requirements:

- Post composer.
- Audience preview.
- Media gallery.
- Moderation queue.
- Parent-visible preview.
- Consent-aware media states.

### Homework & Timetable

Route:

```text
/dashboard/homework
/dashboard/timetable
```

Main job:

```text
Assign learning work and manage school schedules.
```

Screen requirements:

- Homework list/detail/submissions.
- Missing/late reports.
- Reminder workflow.
- Timetable builder.
- Teacher/room/period conflict indicators.
- Substitution workflow.

### HR & Payroll

Route:

```text
/dashboard/hr
/dashboard/payroll
```

Main job:

```text
Manage staff records, leave, payroll runs, payslips, and payroll reports.
```

Screen requirements:

- Staff directory.
- Staff profile/timeline.
- Leave request queue.
- Payroll run stepper.
- Payslip PDF actions.
- Statutory deduction reports.

### Library

Route:

```text
/dashboard/library
```

Main job:

```text
Manage books, copies, issue/return, reservations, overdue, and fines.
```

Screen requirements:

- Book catalog.
- Copy management.
- Issue/return panel.
- Overdue list.
- Fines and reports.

### Transport

Route:

```text
/dashboard/transport
```

Main job:

```text
Manage routes, vehicles, student assignments, trips, and safety updates.
```

Screen requirements:

- Route and stop management.
- Vehicle list.
- Driver assignment.
- Active trip tracking.
- Delay broadcast.
- Transport reports.

### Canteen

Route:

```text
/dashboard/canteen
```

Main job:

```text
Manage menu, meal plans, servings, wallet, POS, suppliers, and inventory.
```

Screen requirements:

- Menu and meal plan setup.
- Serving scanner/workspace.
- Wallet summary and top-up history.
- POS sales.
- Inventory and supplier records.

### Accounting

Route:

```text
/dashboard/accounting
```

Main job:

```text
Control chart of accounts, journals, periods, reports, and reconciliation.
```

Screen requirements:

- Accounting dashboard.
- Chart of accounts.
- Journal workflow.
- Period/fiscal year controls.
- Financial reports.
- Bank reconciliation.

### Notices & Chat

Route:

```text
/dashboard/communications
```

Main job:

```text
Send notices and manage school-safe communication.
```

Screen requirements:

- Notice composer.
- Recipient preview.
- Scheduled notices.
- Parent-teacher chat inbox.
- Escalation/abuse review.
- School-hour and policy states.

### Reports

Route:

```text
/dashboard/reports
```

Main job:

```text
Find, generate, export, and review reports safely.
```

Screen requirements:

- Report catalog.
- Filter form.
- Export history.
- Retry failed exports.
- CSV/PDF download with authenticated helper.

### Settings

Route:

```text
/dashboard/settings
```

Main job:

```text
Configure the school, academic setup, users, roles, branding, and integrations.
```

Screen requirements:

- School profile.
- Academic years/classes/sections where applicable.
- Users and roles.
- Branding/logo.
- Integrations/provider status where tenant-owned.
- Audit logs.

---

## 19. Platform Control Plane Screens

Platform screens must live outside `/dashboard`.

Route group:

```text
/platform/*
```

Required workspaces:

```text
/platform/dashboard
/platform/schools
/platform/schools/[tenantId]
/platform/billing
/platform/plans
/platform/providers
/platform/queues
/platform/audit
/platform/report-exports
```

Rules:

- Platform uses enterprise/indigo accent.
- Platform dashboard shows SaaS/operator concerns, not tenant school operations.
- Support override mode must be highly visible.
- Tenant status actions need confirmation and reason.
- Queue retry/discard must be audited.
- SaaS billing must not mix with school fee collection.

---

## 20. API Integration Rules

All dashboard and module screens must use real backend APIs.

Rules:

```text
1. No fake production data.
2. No placeholder metrics in live module screens.
3. No local-only production workflow state.
4. Use existing API clients under apps/web/lib/api or create module API clients there.
5. Preserve cookie-first auth.
6. Do not store raw tokens in browser storage.
7. Use TanStack Query for interactive server state.
8. Use loading, empty, error, success, permission, and locked states.
9. Use backend pagination for large records.
10. Use authenticated blob/download helpers for PDFs and CSVs.
11. Parent/student/mobile APIs must remain purpose-limited.
12. Do not use admin endpoints to power parent/student views when scoped routes exist.
```

Every module implementation should document:

```text
Backend route -> school workflow -> UI screen -> component -> API client -> state handling -> verification
```

---

## 21. Implementation Sequence

Recommended order:

1. Stabilize design tokens, typography, AppShell, Topbar, Sidebar, PageHeader, SectionCard, DataTable, state components.
2. Rebuild Dashboard first.
3. Rebuild Settings and RBAC surfaces.
4. Rebuild Students/Admissions.
5. Rebuild Attendance.
6. Rebuild Fees.
7. Rebuild Academics.
8. Rebuild Homework/Timetable.
9. Rebuild HR/Payroll.
10. Rebuild Library/Transport/Canteen.
11. Rebuild Accounting.
12. Rebuild Notices/Chat.
13. Rebuild Platform control plane.
14. Add role-aware mobile/web polish.
15. Add browser E2E coverage for critical workflows.

Do not start with decorative redesign. Start with shell, state system, real APIs, and dashboard.

---

## 22. Current UI Progress Snapshot

Known direction:

- Backend modules are broad and mature.
- Web already has module pages and workspaces in many areas.
- Current frontend needs consistent UX, stronger role-aware navigation, real state handling, and final SchoolOS design polish.
- Platform UI needs clear separation from school operations.
- Dashboard should be rebuilt as the command center.

Current risk:

```text
The system may have many working pages but inconsistent user experience.
```

Main frontend goal:

```text
Turn working module screens into a coherent, professional SchoolOS product experience.
```

---

## 23. Accessibility and Smoke Coverage

Minimum accessibility rules:

- Keyboard reachable dialogs, menus, selects, tabs, and sheets.
- Visible focus states.
- Proper labels for inputs.
- Do not rely only on color for status.
- Sufficient text contrast.
- Error messages associated with fields.
- Tables should have clear headers.
- Buttons must have meaningful labels.

Smoke coverage should include:

- Dashboard loads.
- Navigation opens module pages.
- Login/session restore works.
- Main API-backed list page loads per module.
- Loading/empty/error states render.
- Permission hidden nav works.
- Module locked state works.
- Critical PDF/CSV actions use authenticated helpers.

---

## 24. Verification Checklist

Before marking UI/UX overhaul work complete, run:

```bash
pnpm --filter @schoolos/web typecheck
pnpm typecheck
pnpm build
pnpm smoke:pilot
pnpm smoke:learning
pnpm smoke:full
```

Also manually verify:

```text
1. Dashboard has no fake production data.
2. Sidebar has no phase labels.
3. Platform and school operations are separate.
4. Every module page has loading/empty/error states.
5. Role-hidden navigation behaves correctly.
6. Money values use tabular numbers and NPR labels.
7. Dangerous actions require confirmation/reason.
8. PDFs/CSVs use authenticated download helpers.
9. Mobile layouts do not become dense desktop tables.
10. Public website does not expose tenant operations.
```

---

## 25. Definition of Done for the Web UI/UX Overhaul

The overhaul is done when:

```text
1. SchoolOS feels like one coherent product.
2. Dashboard gives useful real school information.
3. Every major module has a dedicated workspace.
4. Platform control plane is separate and safe.
5. Shared components are reused instead of one-off page styling.
6. Real backend APIs power production data.
7. Loading, empty, error, permission, and module-locked states are consistent.
8. Role-aware navigation is clear.
9. Critical workflows are covered by smoke/browser tests.
10. Non-technical school staff can understand what to do next on every page.
```

---

## 26. Component Governance: Custom vs Dependency Rules

This section strengthens Sections 5, 6, 12, 15, and 20. If there is doubt, follow this rule:

```text
SchoolOS owns the design system. Dependencies may power behavior, but they must not define the product experience.
```

### 26.1 Final component decision

SchoolOS should use a **hybrid professional component strategy**:

```text
Custom SchoolOS components for product experience + approved dependencies for complex accessible behavior.
```

Do **not** use a full component provider or admin dashboard kit as the primary UI layer. SchoolOS must not look like a generic SaaS template. It must feel like a trustworthy, Nepal-ready School Management System.

### 26.2 What must be SchoolOS-owned

These components must be SchoolOS-owned and live under `apps/web/components/ui`, `apps/web/components/layout`, `apps/web/components/dashboard`, or `apps/web/components/<module>`:

| Component area | Decision | Reason |
|---|---|---|
| App shell, topbar, sidebar, platform shell | Custom SchoolOS components | Navigation, tenant context, role visibility, and platform separation are product-specific. |
| Page headers, module headers, context bars | Custom SchoolOS components | Every module needs school-friendly title, description, primary action, filters, and next-step guidance. |
| Cards, stat cards, insight cards | Custom SchoolOS components | Must use SchoolOS tokens, module accents, tabular numbers, and Nepal school language. |
| Data table wrapper | Custom SchoolOS `DataTable` wrapper | Tables need consistent loading, empty, error, permission, pagination, exports, bulk actions, and audit behavior. |
| Filter bar, search input, saved filter patterns | Custom SchoolOS components | Filters must match school workflows: academic year, class, section, month, student, staff, route, account period. |
| Pagination | Custom SchoolOS pagination wrapper | Pagination copy, disabled states, mobile behavior, and backend query handling must stay consistent. |
| Breadcrumbs | Custom SchoolOS breadcrumbs | Breadcrumbs need module-aware labels and should never expose technical route names. |
| Empty, loading, error, permission, module-locked states | Custom SchoolOS state components | Every workflow must explain the next action using school language. |
| Confirm dialog and audit reason dialog | Custom SchoolOS wrappers | Dangerous actions need confirmation, reason, audit hint, permission check, and pending/error states. |
| Money, date, student, staff, module, and status displays | Custom SchoolOS domain components | NPR, academic years, class/section labels, statuses, and identity display need consistent handling. |
| Module workspaces | Custom SchoolOS domain components | Student, fees, attendance, academics, transport, canteen, payroll, accounting, and communication workflows are domain-specific. |

### 26.3 What may use approved dependencies under the hood

Approved dependencies may be used only when they improve accessibility, reliability, performance, or developer velocity without taking over the design system.

| Need | Approved direction | Rule |
|---|---|---|
| Dialogs, alert dialogs, dropdowns, popovers, tooltips, tabs, sheets, command menu | shadcn-style/Radix-based primitives adapted into SchoolOS components | Vendor/adapt code into SchoolOS components and style with SchoolOS tokens. |
| Complex tables with sorting, column visibility, row selection, grouping, pinning | TanStack Table under a SchoolOS `DataTable` wrapper | Do not expose TanStack APIs directly across module pages. |
| Server state, caching, pagination, mutation invalidation | TanStack Query | Required for interactive authenticated server state. |
| Forms and validation | React Hook Form + Zod | Required for forms with inline errors, disabled states, and safe submit behavior. |
| Icons | Lucide icons | Use consistent icon stroke/size rules. Do not mix many icon packs. |
| Charts | A small approved chart dependency only behind `SchoolOSChart` wrappers | Use backend official totals. Do not build official finance/attendance totals in the browser. |
| Date picking/calendar behavior | shadcn-style/Radix-compatible date picker pattern | Must support Nepali school calendar needs later without rewriting all screens. |

### 26.4 Dependency approval checklist

Before adding any UI dependency, it must pass all checks:

```text
1. It solves a real repeated product problem.
2. It is accessible or helps us build accessible behavior.
3. It is compatible with Next.js App Router, React, Tailwind CSS, and SSR/client boundaries.
4. It is themeable with SchoolOS tokens.
5. It does not force a separate visual language.
6. It is tree-shakeable or small enough for dashboard performance.
7. It has acceptable maintenance, license, and security posture.
8. It does not duplicate an existing SchoolOS component.
9. It can be wrapped behind a SchoolOS-owned component API.
10. It does not move business rules out of backend/API contracts.
```

### 26.5 Component implementation rules by common pattern

| Pattern | Professional SchoolOS rule |
|---|---|
| Tables | Use `DataTable` for all dense admin lists. Support loading, empty, error, permission denied, module locked, pagination, row actions, bulk actions where allowed, and CSV/PDF export actions where backed by API. |
| Filters | Use `FilterBar` with explicit filters. Common filters: academic year, class, section, date/month, status, student, staff, route, account period, payment mode. Preserve filters on refetch/navigation where useful. |
| Search | Use `SearchInput` for local screen search and `CommandSearch` for global search. Global search should support student name, admission number, guardian phone, invoice number, receipt number, staff, book barcode, vehicle number, and notice title. |
| Pagination | Prefer backend pagination for large lists. Never load thousands of records just to paginate in the browser. |
| Breadcrumbs | Use human labels: `Students > Aarav Shrestha > Fee Ledger`, not technical route segments. |
| Cards | Use cards for summaries, insights, and mobile views. Do not replace dense finance/accounting/attendance tables with card-only layouts on desktop. |
| Dropdowns and action menus | Use for secondary actions. Primary screen action stays visible in the page header. Dangerous actions must open `AuditReasonDialog`. |
| Drawers/sheets | Use for quick detail, preview, or edit where the user should not lose table context. Use full pages for complex workflows. |
| Forms | Use React Hook Form + Zod. Show field errors, helper text, disabled states, unsaved changes handling where needed, and clear success/error feedback. |
| Toasts | Use for lightweight confirmation only. Do not use toast as the only place for important errors. |
| File/PDF/CSV actions | Use authenticated blob/download helpers. Do not use raw unauthenticated URLs for private school data. |

---

## 27. Professional Module Design and Color Strategy

### 27.1 Final color decision

For Nepal schools and SchoolOS, the best professional design is:

```text
One shared SchoolOS base palette + small module accent colors.
```

Do **not** give every module a completely different full color palette. That makes the product feel fragmented, childish, and harder for school staff to learn. A school management system should feel calm, official, safe, and trustworthy.

### 27.2 Why this is best for Nepal school operations

Nepal school users include owners, principals, office admins, accountants, teachers, parents, drivers, and canteen/library staff. Many users are non-technical and will use the system under daily operational pressure. Therefore:

```text
Consistency is more important than decoration.
```

Use the same base layout, spacing, typography, card style, table style, form style, and state components across modules. Use module accent colors only to help users quickly identify where they are.

### 27.3 Module accent usage rules

| Use module accent for | Do not use module accent for |
|---|---|
| Sidebar active marker | Error states |
| Module icon background | Success states |
| Section left border | Warning or danger states |
| Soft badge background | Financial risk states |
| Tab active state | Approval/rejection states |
| Small decorative module identity | Emergency notices |
| Empty-state illustration/accent | Accounting debit/credit meaning |

Semantic status colors always win:

```text
Success = success green
Warning = warning amber
Danger/error = danger red
Info = info blue
Neutral = slate/gray
```

Examples:

```text
M3 Fees uses amber as module identity, but failed payment uses danger red.
M10 Notices uses rose as module identity, but emergency notice uses danger red.
M8B Transport uses orange as module identity, but delayed trip uses warning amber.
M9 Accounting uses teal as module identity, but unbalanced journal uses danger red.
```

### 27.4 Visual maturity rules

SchoolOS module screens should look professional and trustworthy:

```text
1. Calm app background.
2. White cards and tables.
3. Strong readable text.
4. Consistent module accents.
5. Few gradients.
6. No colorful dashboard-kit look.
7. No cartoon-heavy admin screens.
8. No tiny low-contrast operational data.
9. Clear hierarchy: title, filters, summary, workspace, actions.
10. Tables for dense school-office data; cards for summaries and mobile views.
```

### 27.5 Platform color separation

Platform Control must look related to SchoolOS but clearly separate from school operations.

```text
School operations: SchoolOS blue base + module accents.
Platform control: indigo/enterprise accent + operational risk states.
```

Never mix:

```text
M0 SaaS billing with M3 student fees.
M0 support override with school staff settings.
M0 platform audit with tenant accounting audit.
```

---

## 28. Role-Based Screen, Device, and Data Access Rules

### 28.1 Final access design principle

SchoolOS access must be:

```text
Role-aware, permission-backed, tenant-scoped, child-safe, and minimum-necessary.
```

The frontend must hide navigation and actions that a role cannot use, but backend permissions remain the source of truth. A hidden button is not security.

### 28.2 Device access strategy

| Actor family | Web access | Mobile access | Best experience |
|---|---|---|---|
| Platform operator | Yes | Usually no | Web-only platform control plane. |
| School owner/director | Yes | Optional executive mobile | Web for deep review, mobile for high-level alerts/approvals. |
| Principal/head teacher | Yes | Yes | Web for operations, mobile for alerts/approvals. |
| Vice principal/academic coordinator | Yes | Optional | Web-first for academics/timetable/exams. |
| School admin/office admin | Yes | Optional | Web-first for student/admin workflows. |
| Admission officer | Yes | Optional | Web-first for application and document workflows. |
| Accountant | Yes | Optional approval/summary only | Web-first for finance/accounting. |
| Cashier/fee collector | Yes | Optional receipt lookup only | Web-first counter workflow. |
| HR/payroll officer | Yes | Optional approval/summary only | Web-first staff/payroll workflow. |
| Teacher/class teacher | Yes | Yes | Web for detailed work, mobile for attendance/homework/activity updates. |
| Subject teacher | Yes | Yes | Web for marks/homework, mobile for quick tasks. |
| Librarian | Yes | Optional scanner mobile later | Web-first issue/return/catalog. |
| Transport manager | Yes | Yes | Web for routes/vehicles/reports, mobile for live operations. |
| Driver/conductor | No admin web | Yes | Mobile-only assigned trips, manifest, boarding/dropping, emergency contact. |
| Canteen manager/POS staff | Yes | Optional tablet/mobile POS | Web/tablet POS and inventory. |
| Parent/guardian | Optional parent web portal | Yes | Mobile-first child updates, fees, homework, notices, chat. |
| Student | Optional student web portal | Yes | Mobile/card-first age-appropriate self-service. |

### 28.3 Role dashboard rule

After login, users should not all see the same dashboard. They should land on the most useful view for their role.

```text
Owner/director -> Executive Overview
Principal -> School Operations Overview
Teacher -> My Classes Today
Accountant -> Finance Today
Cashier -> Fee Collection Counter
HR/payroll -> Staff and Payroll Today
Librarian -> Library Desk
Transport manager -> Transport Operations Today
Driver -> My Assigned Trip
Canteen staff -> Canteen POS Today
Parent -> My Child Overview
Student -> My Learning Today
Platform operator -> Platform Attention Dashboard
```

If one user has multiple roles, show a role-aware combined dashboard with a clear role/context switcher where needed. Do not create duplicate accounts for the same person.

### 28.4 Owner and principal overlap rule

In many Nepal schools, the school owner and principal may be the same person. SchoolOS should support this without confusion.

Rules:

```text
1. One person can have both Owner/Director and Principal roles.
2. Permissions are the union of assigned roles, limited by tenant and module entitlement.
3. The dashboard may show both Executive Overview and School Operations Overview sections.
4. High-risk actions still require confirmation, reason, and audit trail.
5. Audit logs must show the actual user and the role/context used for the action where available.
6. If owner and principal are separate people, financial ownership views and academic operation views should remain distinct.
```

Owner/director focus:

```text
Business health, revenue, dues, enrollment, expenses, staff cost, risks, approvals, school growth, platform subscription, high-level audit.
```

Principal focus:

```text
Daily school operations, attendance, academics, teacher workload, exams, discipline, communication, parent issues, timetable, result readiness.
```

---

## 29. Role-to-Information Access Matrix

This matrix defines what each role should see by default. Exact permissions still come from backend RBAC and module entitlements.

| Role | Default landing view | Should see | Can manage | Should not see by default |
|---|---|---|---|---|
| Platform operator | Platform Attention Dashboard | Tenants, plans, SaaS billing, provider readiness, queues, platform audit, support overrides | School onboarding, subscriptions, provider tests, failed jobs, platform reports | Tenant-private student/finance details unless using audited support access. |
| School owner/director | Executive Overview | Enrollment, revenue, dues, expenses, cash/bank summary, staff cost, attendance risk, academic outcomes, module health, audit highlights | High-level approvals, plan/subscription review, school settings if granted | Private chats, child-sensitive notes, teacher private details unless policy grants. |
| Principal/head teacher | School Operations Overview | Today attendance, absent teachers, substitutions, academic calendar, exam readiness, discipline/communication issues, pending approvals | Academic workflows, notices, attendance review, result publish, teacher coordination | Detailed accounting ledgers/payroll salaries unless explicitly granted. |
| Vice principal/academic coordinator | Academic Operations | Classes, sections, teacher workload, timetable, exams, marks, report cards, syllabus, substitutions | Exam terms, assessment setup, timetable publish, marks review, report card readiness | Full finance, payroll, platform billing. |
| School admin/office admin | Office Dashboard | Student records, admissions, guardians, documents, settings tasks, notices, reports | Student profile updates, guardian invitations, document generation, basic settings | Salary details, ledger postings, private communications unless assigned. |
| Admission officer | Admissions Pipeline | Applications, document status, duplicate candidates, enrollment readiness, guardian details needed for admission | Application status, bulk import, duplicate review, enrollment handoff | Existing student finance ledger beyond admission fee context, payroll/accounting. |
| Class teacher | My Class Today | Own class roster, attendance, homework, activity posts, parent communication, student academic/attendance summary | Mark attendance, create homework/activity posts, communicate with parents during allowed hours | Other classes, school-wide finance, payroll, accounting, unrelated student records. |
| Subject teacher | My Teaching Today | Assigned subjects/classes, syllabus, homework, marks entry, own timetable, relevant student academic info | Enter marks, manage subject homework, syllabus progress, class activity where allowed | Fees, payroll, accounting, unrelated guardian/private data. |
| Accountant | Finance Today | Fee setup, invoices, dues, payments, receipts, cashier close, reports, accounting journals, reconciliation | Fee plans, billing runs, payment review, refunds/reversals if permitted, journals, reports | Academic marks, private student notes, parent chat content, staff HR details beyond payroll needs. |
| Cashier/fee collector | Collection Counter | Student billing identity, dues, invoices, payment modes, receipt history, cashier close preview | Collect payment, issue receipt, reprint with reason, close cashier day | Fee setup, accounting configuration, payroll, academic records. |
| HR/payroll officer | Staff and Payroll Today | Staff directory, contracts/status, leave, attendance, salary structures, payroll runs, payslips, payroll reports | Staff lifecycle, leave review, payroll preparation, salary structures, payslip generation | Student fees, academic marks, parent chat, tenant platform billing. |
| Librarian | Library Desk | Books, copies, issue/return, borrower identity, overdue, reservations, fines, library reports | Catalog, issue/return, reservations, fine posting if permitted | Student full profile, finance ledger, payroll, private guardian information. |
| Transport manager | Transport Operations Today | Routes, stops, vehicles, drivers, assignments, trips, GPS status, delays, transport reports | Route/vehicle/trip setup, student assignments, delay broadcasts, maintenance records | Academic marks, payroll salary details, accounting ledgers. |
| Driver/conductor | My Assigned Trip | Assigned vehicle/route, student manifest, pickup/drop status, emergency contact, trip instructions | Start/complete trip, mark boarded/dropped/absent, send location/delay/emergency updates | Fees, academics, full student profiles, other routes, parent private details. |
| Canteen manager/POS staff | Canteen POS Today | Menu, meal plans, enrolled students, serving eligibility, wallet balance/status, POS sales, stock | Serve meal, POS sale, stock movement, menu/inventory if manager | Academic marks, payroll, full guardian records, accounting beyond canteen reports. |
| Parent/guardian | My Child Overview | Own child attendance, homework, fees/receipts, notices, activity feed, report cards after publish, transport, canteen, library, teacher chat | Pay/track fees where enabled, message allowed teachers, view/download own child docs/receipts | Other children, teacher/staff private data, internal school reports, unpublished results. |
| Student | My Learning Today | Own timetable, homework, submitted work, published results, library borrowing, notices, activity where age-appropriate | Submit homework, view own progress, update limited profile fields if allowed | Fees management, parent/staff data, other students, unpublished marks/results. |
| Canteen POS-only staff | POS Counter | Active menu, scan/resolve student, wallet eligibility, serving/payment result | Serve item, complete POS sale, print/view POS receipt | Inventory purchase cost, finance reports, student full profile. |
| Support user under override | Support Session Banner | Only support-relevant diagnostics granted by platform override | Troubleshoot within time-limited audited session | Unrelated tenant data, hidden child/private data unless specifically required and audited. |

### 29.1 Data minimization rules

```text
1. Show each role the minimum data needed to finish their job.
2. Prefer scoped endpoints for parents, students, staff self-service, drivers, and mobile users.
3. Do not use admin endpoints to power parent/student/driver screens when purpose-limited APIs exist.
4. Hide irrelevant navigation before the user reaches a page.
5. Hide unavailable actions on the page.
6. Still show permission-denied and module-locked states when a user reaches a blocked route directly.
7. Do not expose raw tokens, private file URLs, internal IDs, or unnecessary audit internals.
8. Sensitive child data should be visible only to roles with a real school reason.
9. Finance and payroll visibility must be stricter than general admin visibility.
10. Owner-level visibility does not automatically mean every private conversation or child-sensitive note is visible.
```

### 29.2 Role-based navigation rules

```text
1. Navigation should be generated from assigned role permissions and module entitlements.
2. A user with multiple roles should see a clean merged navigation, not duplicate modules.
3. Platform navigation must never appear inside the normal school sidebar.
4. Parent/student/driver mobile navigation must be purpose-built and minimal.
5. Reports should show only report categories the user can legally access.
6. Settings should be split by responsibility: school profile, academic setup, finance setup, users/roles, integrations, and audit.
```

### 29.3 Role-based screen design rules

| Role type | Screen design priority |
|---|---|
| Owner/director | Executive summaries, trends, risks, approvals, cash/dues, growth, audit highlights. Avoid operational clutter. |
| Principal | Today’s school operation, academic readiness, teacher/class issues, pending approvals, communication risks. |
| Office/admin | Search, forms, document readiness, student lifecycle, guardian management, clean task queues. |
| Teacher | My classes, fast attendance, homework, marks, student context, parent communication. Avoid finance/admin clutter. |
| Accountant/cashier | High-contrast money data, receipts, dues, approvals, audit trail, cashier close. No decorative UI. |
| HR/payroll | Staff lifecycle, leave/payroll status, approval steps, PDF/CSV exports, confidential salary handling. |
| Transport/driver | Trip status, route clarity, student safety, delay/emergency actions, mobile-friendly scanning/status updates. |
| Canteen/POS | Fast scan/serve/sell flow, wallet eligibility, clear success/failure states, stock visibility for managers only. |
| Parent/student | Card-based, simple language, own-child/own-data only, no dense tables, clear next action. |
| Platform operator | Operational control, tenant status, provider/queue health, auditability, support override safety. |

---

## 30. Role-Based First-Login Information Requirements

Each role dashboard should answer: `What should I know right now, and what should I do next?`

| Role | First-login information required |
|---|---|
| School owner/director | Total students, new admissions, active/inactive students, monthly fee collection, outstanding dues, expenses/payroll summary, cash/bank health if enabled, attendance risk, academic result trend, staff count, pending approvals, audit/security alerts, module subscription/lock status. |
| Principal/head teacher | Today’s student attendance, absent teachers, class coverage/substitutions, timetable issues, pending attendance corrections, homework completion risk, exam/result readiness, notices needing approval, parent escalations, discipline/communication alerts. |
| Vice principal/academic coordinator | Current exam term, mark entry completion, CAS/report card readiness, timetable validation issues, teacher workload, syllabus progress, substitution needs, promotions/result publish readiness. |
| School admin/office admin | Admission applications, incomplete student profiles, document expiry/readiness, duplicate candidates, guardian verification queue, pending notices, settings/onboarding tasks. |
| Admission officer | New applications, status pipeline, documents missing, duplicate warnings, accepted applications ready to enroll, bulk import batches needing review. |
| Class teacher | Own class attendance today, students absent repeatedly, homework due/missing, upcoming timetable, activity/milestone tasks, parent messages during allowed hours, student birthdays/events if enabled. |
| Subject teacher | Today’s teaching periods, assigned homework, mark entry tasks, syllabus topics, students needing attention, upcoming exams for assigned subjects. |
| Accountant | Today’s collection, pending invoices, overdue dues, failed/online payments, refund/reversal requests, cashier close status, accounting posting exceptions, report export shortcuts. |
| Cashier | Search student by name/admission/phone, collect payment, recent receipts, pending reprints, cashier close preview, payment mode readiness. |
| HR/payroll officer | Staff attendance today, leave requests, contract/lifecycle alerts, payroll run status, salary structure gaps, payslip/report tasks. |
| Librarian | Books due today, overdue list, issue/return scanner/search, reservations, damaged/lost copies, fine queue. |
| Transport manager | Active trips, route delays, missing GPS/stale vehicles, driver assignments, absent/not boarded students, vehicle maintenance/document alerts. |
| Driver/conductor | Assigned trip, route/stops, student manifest, pickup/drop buttons, emergency contact, delay/report issue action. |
| Canteen manager/POS staff | Today’s menu, meal plan serving count, scan/serve action, wallet low-balance/blocked status, POS sales, stock alerts. |
| Parent/guardian | Child attendance today, homework due, notices, fee dues/receipts, transport status, canteen balance/meal status, activity updates, published report cards. |
| Student | Today’s timetable, homework due, submitted homework status, published marks/report cards, library due items, notices. |
| Platform operator | Schools needing attention, provider readiness, failed jobs, overdue SaaS invoices, support overrides active, onboarding blockers, platform audit/security alerts. |

### 30.1 Approval and confidential data rules

```text
1. Approval cards should show who requested, what changes, amount/risk if applicable, and deadline/status.
2. Confidential salary/payroll data must not appear on owner/principal dashboards unless the role has payroll permission.
3. Parent/student dashboards must never show unpublished marks, other students, or internal comments.
4. Finance numbers must always use tabular numbers and clear NPR formatting.
5. Medical, child-safety, support override, and private communication data must be deliberately scoped and auditable.
```
