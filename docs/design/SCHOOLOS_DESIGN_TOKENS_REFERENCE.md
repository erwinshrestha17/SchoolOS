# SchoolOS Design Tokens Reference

**Status:** Source of Truth  
**Last updated:** 2026-06-15  
**Phase:** Planning only — implementation token files will be created during frontend/mobile development phase  
**Purpose:** Capture the consolidated visual token direction for SchoolOS web and mobile based on the uploaded UI/UX plan and existing SchoolOS UI/UX docs.

Related docs:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/references/SCHOOLOS_ROLE_SCREEN_DESIGN_REFERENCE.md
docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md
```

---

## 1. Token Strategy

SchoolOS should use one shared visual language across web and mobile.

Final direction:

```text
One SchoolOS base palette
Subtle module accents
Semantic colors for meaning
Shared spacing/radius/elevation logic
Web and Flutter themes generated from aligned token values where possible
```

Implementation later may use:

```text
packages/design-tokens/schoolos.tokens.json
apps/web/styles/tokens.css
apps/web Tailwind theme mapping
apps/schoolos_mobile/lib/core/theme/schoolos_theme.dart
```

---

## 2. Brand Color Tokens

### Primary — Trust / Education Blue

| Token | Hex | Use |
|---|---|---|
| `color-primary-50` | `#EFF6FF` | Light backgrounds, hover states, selected rows. |
| `color-primary-100` | `#DBEAFE` | Chips, subtle active states. |
| `color-primary-200` | `#BFDBFE` | Light progress fills. |
| `color-primary-400` | `#60A5FA` | Icons on dark backgrounds. |
| `color-primary-500` | `#3B82F6` | Links, icon accents. |
| `color-primary-600` | `#2563EB` | Primary buttons, active nav item. |
| `color-primary-700` | `#1D4ED8` | Primary hover. |
| `color-primary-800` | `#1E40AF` | Primary pressed. |
| `color-primary-900` | `#1E3A8A` | Strong headings/badge text. |

### Secondary — Teal Accent

| Token | Hex | Use |
|---|---|---|
| `color-secondary-50` | `#F0FDFA` | Teal backgrounds. |
| `color-secondary-500` | `#14B8A6` | Secondary accents. |
| `color-secondary-600` | `#0D9488` | Secondary CTA/highlight. |
| `color-secondary-700` | `#0F766E` | Secondary hover/text. |

---

## 3. Semantic Tokens

Semantic colors define meaning and always override module accent colors.

| Token | Hex | Meaning |
|---|---|---|
| `color-success-50` | `#ECFDF5` | Success background. |
| `color-success-500` | `#10B981` | Present, paid, completed. |
| `color-success-700` | `#047857` | Success text. |
| `color-warning-50` | `#FFFBEB` | Warning background. |
| `color-warning-400` | `#FBBF24` | Warning icon. |
| `color-warning-500` | `#F59E0B` | Late, pending, caution. |
| `color-warning-700` | `#B45309` | Warning text. |
| `color-error-50` | `#FEF2F2` | Error background. |
| `color-error-500` | `#EF4444` | Absent, overdue, error, danger. |
| `color-error-700` | `#B91C1C` | Error text. |
| `color-info-50` | `#EFF6FF` | Info background. |
| `color-info-500` | `#3B82F6` | Info icon. |
| `color-info-700` | `#1D4ED8` | Info text. |

Rules:

```text
Dangerous action = error semantic color.
Pending/review/warning = warning semantic color.
Success/paid/present/completed = success semantic color.
Informational/leave/info-only = info semantic color.
Never communicate status by color only; include label/icon/text.
```

---

## 4. Neutral Tokens

| Token | Hex | Use |
|---|---|---|
| `color-neutral-0` | `#FFFFFF` | Card/input surfaces. |
| `color-neutral-50` | `#F8FAFC` | Page background. |
| `color-neutral-100` | `#F1F5F9` | Subtle dividers/row alternates. |
| `color-neutral-200` | `#E2E8F0` | Borders/separators. |
| `color-neutral-300` | `#CBD5E1` | Disabled borders/placeholders. |
| `color-neutral-400` | `#94A3B8` | Muted icons/disabled text. |
| `color-neutral-500` | `#64748B` | Secondary text. |
| `color-neutral-600` | `#475569` | Body secondary. |
| `color-neutral-700` | `#334155` | Body primary. |
| `color-neutral-800` | `#1E293B` | Headings. |
| `color-neutral-900` | `#0F172A` | Strong headings/page title. |

---

## 5. Dark Mode Tokens

Dark mode is accepted as a design direction, but initial MVP implementation can defer it unless easy.

| Token | Hex | Use |
|---|---|---|
| `color-dark-bg` | `#0F172A` | Dark page background. |
| `color-dark-surface` | `#1E293B` | Dark card surface. |
| `color-dark-elevated` | `#334155` | Elevated panels/dropdowns. |
| `color-dark-border` | `#334155` | Dark borders. |
| `color-dark-text-primary` | `#F1F5F9` | Primary dark text. |
| `color-dark-text-secondary` | `#94A3B8` | Secondary dark text. |

---

## 6. Typography Tokens

Accepted font direction:

```text
Headings: Plus Jakarta Sans or equivalent
Body: Inter or system-compatible fallback
Monospace: JetBrains Mono for IDs, codes, receipts, timestamps
```

### Web text scale

| Token | px | Use |
|---|---:|---|
| `text-xs` | 11 | Helper text, chips, footnotes. |
| `text-sm` | 12 | Table sub-labels, helper text. |
| `text-base` | 13 | Dense table rows/form labels. |
| `text-md` | 14 | Default body/nav/button text. |
| `text-lg` | 16 | Card headers. |
| `text-xl` | 18 | Section headers. |
| `text-2xl` | 20 | Page sub-headers. |
| `text-3xl` | 24 | Page titles. |
| `text-4xl` | 30 | Dashboard stats/headlines. |
| `text-5xl` | 36 | Large stats/auth headings. |
| `text-6xl` | 48 | Marketing display only. |

### Font weights

| Token | Weight | Use |
|---|---:|---|
| `font-regular` | 400 | Body/table text. |
| `font-medium` | 500 | Labels/nav items. |
| `font-semibold` | 600 | Card headers/buttons/forms. |
| `font-bold` | 700 | Page titles/stats. |
| `font-extrabold` | 800 | Display stats only. |

---

## 7. Spacing Tokens

Use a 4px base grid.

| Token | px | Use |
|---|---:|---|
| `space-0.5` | 2 | Micro gaps. |
| `space-1` | 4 | Icon/text micro gap. |
| `space-1.5` | 6 | Compact padding. |
| `space-2` | 8 | Small padding. |
| `space-3` | 12 | Badge/list padding. |
| `space-4` | 16 | Default component padding. |
| `space-5` | 20 | Card section spacing. |
| `space-6` | 24 | Default content/card desktop padding. |
| `space-8` | 32 | Section vertical spacing. |
| `space-10` | 40 | Large section gap. |
| `space-12` | 48 | Page-level spacing. |
| `space-16` | 64 | Hero/auth layout. |
| `space-20` | 80 | Marketing/major section. |

Rules:

```text
Desktop content default padding: 24px.
Mobile content default padding: 16px.
Dense table cells may use compact spacing but must remain readable.
```

---

## 8. Radius Tokens

| Token | px | Use |
|---|---:|---|
| `radius-none` | 0 | Table cells/full bleed. |
| `radius-sm` | 4 | Badges/chips. |
| `radius-base` | 6 | Compact inputs/buttons. |
| `radius-md` | 8 | Default buttons/dropdowns/toasts. |
| `radius-lg` | 12 | Cards/dialogs/sheets. |
| `radius-xl` | 16 | Large modals/mobile sheets. |
| `radius-2xl` | 20 | Dashboard stat cards. |
| `radius-3xl` | 24 | Large avatar/decorative surfaces. |
| `radius-full` | 9999 | Pills/avatar circles. |

---

## 9. Elevation Tokens

| Token | CSS value | Use |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(15,23,42,0.05)` | Inputs/subtle focus. |
| `shadow-sm` | `0 1px 3px rgba(15,23,42,0.10)` | Default cards. |
| `shadow-base` | `0 4px 6px rgba(15,23,42,0.07)` | Dropdown/popover. |
| `shadow-md` | `0 8px 16px rgba(15,23,42,0.08)` | Modals/floating panels. |
| `shadow-lg` | `0 16px 32px rgba(15,23,42,0.10)` | Side sheets/drawers. |
| `shadow-xl` | `0 24px 48px rgba(15,23,42,0.12)` | Full overlays. |

Rule:

```text
Use borders more than heavy shadows for dense admin screens.
Use elevation sparingly for overlays, dropdowns, dialogs, and mobile sheets.
```

---

## 10. Icon Tokens

Accepted icon direction:

```text
Web: Lucide icons
Mobile: lucide_flutter or equivalent consistent icon set
Do not mix multiple icon libraries without approval.
```

| Token | Size | Use |
|---|---:|---|
| `icon-sm` | 14 | Inline small text. |
| `icon-md` | 16 | Default labels/buttons. |
| `icon-lg` | 20 | Nav/card headers. |
| `icon-xl` | 24 | Section headers/empty states. |
| `icon-2xl` | 32 | Onboarding/feature icons. |
| `icon-3xl` | 48 | Illustration accent only. |

---

## 11. Role Accent Tokens

Role accents can be used for dashboard header, role badge, avatar ring, and context indicator. They should not override semantic status colors.

| Role | Token | Hex |
|---|---|---|
| Platform Operator | `role-platform` | `#7C3AED` |
| Owner / Director | `role-owner` | `#475569` |
| Principal | `role-principal` | `#2563EB` |
| Academic Coordinator | `role-academic` | `#4338CA` |
| School Admin | `role-admin` | `#0284C7` |
| Class Teacher | `role-class-teacher` | `#7C3AED` |
| Subject Teacher | `role-subject-teacher` | `#9333EA` |
| Accountant | `role-accountant` | `#059669` |
| Cashier | `role-cashier` | `#16A34A` |
| HR / Payroll | `role-hr` | `#4338CA` |
| Librarian | `role-librarian` | `#D97706` |
| Transport Manager | `role-transport` | `#0891B2` |
| Canteen Manager | `role-canteen` | `#DB2777` |
| Parent / Guardian | `role-parent` | `#0D9488` |
| Student | `role-student` | `#3B82F6` |
| School IT/Admin Technical | `role-it-admin` | `#4B5563` |

---

## 12. Module Accent Direction

Module accents should help orientation, not create separate themes.

| Module | Suggested accent | Notes |
|---|---|---|
| Dashboard | Primary blue | Calm command center. |
| Students / Admissions | Sky/blue | Trust and identity. |
| Attendance | Success green | Fast status recognition. |
| Fees | Emerald/green | Money confidence. |
| Academics | Indigo/violet | Structured progress. |
| Activity Feed | Teal | Warm but controlled. |
| Homework / Timetable | Purple/blue | Learning and schedule. |
| HR / Payroll | Indigo/slate | Confidential staff ops. |
| Library | Amber | Desk workflow. |
| Transport | Cyan/orange | Live safety/status. |
| Canteen | Pink/teal | POS/serving identity. |
| Accounting | Teal/slate | Precision and control. |
| Notices / Chat | Blue/teal | Communication safety. |
| Platform | Violet/slate | Operator control plane. |

Rule:

```text
Module accent is decorative/orientational.
Semantic color is meaning/status.
```

---

## 13. Attendance Status Tokens

| Status | Token | Color direction |
|---|---|---|
| Present | `attendance-present` | Success green. |
| Absent | `attendance-absent` | Error red. |
| Late | `attendance-late` | Warning amber. |
| Leave | `attendance-leave` | Info blue. |
| Holiday | `attendance-holiday` | Neutral/slate. |
| Not submitted | `attendance-not-submitted` | Warning/neutral. |
| Locked | `attendance-locked` | Neutral with lock icon. |

---

## 14. Implementation Notes For Later

When implementation starts:

```text
Do not use raw hex values inside module pages.
Map these tokens to CSS variables/Tailwind first.
Map these tokens to Flutter ThemeData second.
Keep web and mobile tokens aligned.
Use Next.js font optimization, not raw @import, unless intentionally accepted.
Token changes should be reviewed as design-system changes.
```

---

## 15. Open Planning Questions

```text
Should dark mode ship in v1 or remain later?
Should Nepali font support be included in the first typography implementation?
Should Bikram Sambat date display require dedicated token/copy rules?
Should every school be allowed to set brand color, or only logo for v1?
Should role accent colors be configurable or fixed?
Should mobile Flutter theme be generated from JSON or manually kept in sync?
```
