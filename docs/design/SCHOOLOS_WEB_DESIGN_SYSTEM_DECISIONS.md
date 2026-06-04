# SchoolOS Web Design System Decisions

**Status:** Active design-system decision record  
**Last updated:** 2026-06-04  
**Scope:** `apps/web` school dashboard, platform control plane, settings, and all module workspaces.

This file determines the component strategy, module color palette, typography, and font-size scale for the SchoolOS web UI/UX overhaul.

---

## 1. Component Strategy Decision

### Final decision

```text
Use SchoolOS-owned custom components built from shadcn-style primitives.
```

Do not adopt a heavy third-party dashboard/component provider as the primary UI layer.

### What this means

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

### Why not a packaged component provider?

Avoid using a full provider such as Material UI, Ant Design, Mantine, Chakra, or a paid dashboard kit as the dominant UI system because:

- SchoolOS has a specialized Nepal school-operations domain, not a generic SaaS dashboard domain.
- Financial, attendance, student-profile, report-card, payroll, transport, canteen, and platform-support flows need custom audit and permission behavior.
- A provider-heavy system can create inconsistent APIs, overrides, bundle weight, and visual mismatch.
- SchoolOS already uses Tailwind CSS 4 and custom primitives, so a controlled internal system is safer.

### Why shadcn-style is good for SchoolOS

shadcn/ui is useful because it is not used like a traditional npm component package. Its docs describe it as open code and a way to build your own component library. That matches SchoolOS because we need full control over styling, behavior, accessibility, and audit-focused workflows.

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

### Implementation rules

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

## 2. Technical Component Stack

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

## 3. Global Brand Palette

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

## 4. Module Color Palette

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

## 5. Typography Decision

### Primary font

```text
Inter Variable via next/font/google
```

Reason:

- Current repo already uses Inter.
- Inter is clean, readable, and good for dense dashboards, tables, numbers, and admin workflows.
- Move from CSS `@import` to `next/font/google` during implementation to reduce external font requests and improve performance/layout stability.

### Fallback stack

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

### Numeric data

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

## 6. Font Size Scale

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

## 7. Component Size Rules

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

## 8. Component Ownership Rules

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

### Anti-patterns

Do not:

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

## 9. Implementation Order

```text
1. Convert font loading from CSS @import to next/font/google Inter.
2. Add/standardize cn/class utility if missing.
3. Standardize Button, Card, Badge, Input, Select, Tabs, Dialog, AlertDialog, Sheet, DropdownMenu, Table, Skeleton, EmptyState, ErrorState, PermissionState.
4. Add module color token map.
5. Overhaul Dashboard using tokens and shared components.
6. Overhaul Platform shell and platform screens.
7. Overhaul modules in the order defined in the web dashboard overhaul plan.
```

---

## 10. Verification

For design-system implementation work:

```bash
pnpm --filter @schoolos/web lint
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/web test
pnpm --filter @schoolos/web build
```

When local/staging services are available:

```bash
pnpm --filter @schoolos/web test:e2e
pnpm smoke:phase1
```

Manual checks:

```text
- Keyboard navigation.
- Focus rings.
- Dialog focus trap.
- Escape-to-close behavior where appropriate.
- Screen-reader labels for icon buttons.
- Loading, empty, error, and permission states.
- No fake data.
- No layout shift from cards/tables/fonts.
- Core Web Vitals checked before claiming UI overhaul completion.
```
