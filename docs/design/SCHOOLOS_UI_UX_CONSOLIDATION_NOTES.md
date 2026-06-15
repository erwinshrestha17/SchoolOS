# SchoolOS UI/UX Consolidation Notes

**Status:** Planning consolidation document  
**Last updated:** 2026-06-15  
**Phase:** Planning only — no frontend/mobile implementation yet  
**Purpose:** Consolidate the uploaded comprehensive UI/UX design plans with the existing SchoolOS planning documents so the team has one aligned direction before web and mobile development begins.

Related source documents:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md
docs/frontend/SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md
docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md
Uploaded: schoolos-uiux-design-plan.md
Uploaded: school-management-system-plan.md
```

---

## 1. Consolidation Decision

The uploaded UI/UX design plan is accepted as a strong **visual design and screen-inventory reference**, but it does not replace the existing SchoolOS source-of-truth planning documents.

Final decision:

```text
Use the uploaded UI/UX plan for visual tokens, typography, layout patterns, Flutter theme direction, common UI patterns, role navigation inspiration, and screen inventory.

Use the SchoolOS repo planning docs for product scope, modules, role/permission rules, backend contract sync, security boundaries, and implementation order.
```

---

## 2. Source-of-Truth Hierarchy

| Area | Source of truth | Notes |
|---|---|---|
| Product principles | `SCHOOLOS_UI_UX_GUIDE.md` | Defines product-level UI/UX rules. |
| Component governance | `SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md` | SchoolOS-owned components, dependency wrapper rules. |
| Web/mobile screen strategy | `SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md` | Role/device/module screen planning. |
| Frontend/backend sync | `SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md` | Every UI screen must verify/implement required backend contract. |
| API consumption | `SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md` | Real API usage and frontend API client direction. |
| Visual tokens/layouts | Uploaded UI/UX plan, then extracted into repo docs | Must be SchoolOS-branded and tokenized before implementation. |
| Generic business/system ideas | Uploaded school management system master plan | Reference only; do not introduce extra modules without approval. |

---

## 3. What We Keep From the Uploaded UI/UX Plan

Keep and adapt these parts:

```text
Color token detail with hex values
Typography scale for web and Flutter
4px spacing grid
Border radius and elevation tokens
Icon size rules
Sidebar/topbar layout specs
Web content templates: dashboard, list, detail/profile, form wizard, split master-detail
Flutter mobile app bar variants
Role-based bottom navigation patterns
Mobile templates: dashboard, list, form, detail
Common UI patterns: data tables, status badges, KPI cards, empty/loading states, dialogs
Accessibility rules
Animation and micro-interaction guidance
Screen inventory concept
Design token JSON concept
Flutter ThemeData direction
```

---

## 4. What We Must Rename or Adjust

### 4.1 Branding

Any generic or alternate branding must be renamed to SchoolOS.

| Found / possible term | Final SchoolOS term |
|---|---|
| EduSphere | SchoolOS |
| Super Admin | Platform Operator / Platform Admin depending context |
| Admin app | School Web Dashboard or Platform Control Plane |
| Generic SMS | SchoolOS |

### 4.2 Product scope alignment

The uploaded generic master plan mentions optional/general modules that are not part of the current SchoolOS v1 scope.

| Mentioned module/idea | Decision |
|---|---|
| Hostel | Not in current SchoolOS module plan. Keep as future optional module only. |
| Calendar & Events | Can be a sub-feature under Academics/Notices/School setup later; not a standalone v1 module unless approved. |
| Full LMS/video conferencing | Not v1. Integrate or defer. |
| Generic districts/school chains | Future enterprise scope. |
| AI analytics | Future after stable data; not part of first frontend implementation. |

Current SchoolOS module map remains:

```text
M0 Platform Core
M1 Admissions & Student Profiles
M2 Smart Attendance
M3 Fees & Receipts
M4 Academics / Exams / CAS / Report Cards
M5 Activity Feed & Milestones
M6 Homework & Timetable
M7 HR & Payroll
M8A Library
M8B Transport
M8C Canteen
M9 Accounting & Finance
M10 Notices & Communication
M12 Learning
Advanced Operations: reports, approvals, automation, analytics, exports, templates
```

### 4.3 Role alignment

The uploaded role list is useful, but SchoolOS should avoid hardcoding too many role-specific screens when permission bundles can do the job.

| Uploaded role | SchoolOS interpretation |
|---|---|
| Platform Admin | Platform Operator / Platform Admin |
| School Owner / Board | Owner / Director / Board Member |
| Principal | Principal / Head Teacher |
| Vice Principal / Academic Head | Vice Principal / Academic Coordinator |
| Admin Officer | School Admin / Office Admin |
| Exam Coordinator | Academic Coordinator with exam permissions |
| School IT Admin | School Admin with technical/settings permissions |
| Cashier | Cashier / Fee Collector |
| HR Manager | HR / Payroll Officer depending permissions |
| Transport Manager | Transport Manager |
| Canteen Manager | Canteen Manager / POS Staff depending permissions |
| Parent / Guardian | Parent / Guardian |
| Student | Student |

Final rule:

```text
Roles provide default experiences. Permissions decide exact access. Backend enforces truth.
```

---

## 5. Design Token Consolidation Decision

The uploaded design tokens are accepted as a strong starting point, but implementation should happen through SchoolOS-owned token files and wrappers.

Recommended token sources to create later during implementation:

```text
apps/web/styles/tokens.css
apps/web/tailwind.config.ts or equivalent Tailwind theme mapping
apps/schoolos_mobile/lib/core/theme/schoolos_theme.dart
packages/design-tokens/schoolos.tokens.json if a shared package is adopted
```

Accepted base direction:

```text
Primary: blue / trust / education
Secondary: teal / supportive accent
Success: green
Warning: amber
Danger/error: red
Neutral: slate/gray
Dark mode: supported later, not required for initial MVP unless already easy
```

Important SchoolOS adjustment:

```text
Module accent colors should be subtle. Semantic colors always win over module colors.
```

---

## 6. Typography Consolidation Decision

The uploaded typography system is accepted with one implementation constraint.

Accepted direction:

```text
Headings: Plus Jakarta Sans or equivalent modern heading font
Body: Inter or system-compatible fallback
Monospace: JetBrains Mono for codes, receipt numbers, IDs, timestamps
```

Implementation caution:

```text
Use Next.js font optimization rather than raw CSS @import in production web implementation.
Flutter should use bundled/google-font approach only if performance and offline startup remain acceptable.
```

---

## 7. Layout Consolidation Decision

Accepted web layout patterns:

```text
Collapsible sidebar
Sticky topbar
Breadcrumbs
Global search
Notification center
Profile/role menu
Dashboard template
List/index template
Detail/profile template
Form wizard template
Split master-detail template
```

Accepted mobile layout patterns:

```text
Role-specific bottom navigation
Mobile dashboard/today view
List cards instead of dense tables
Form/action screen for quick workflows
Detail/profile screen with tabs/sections
App bar variants: standard, search, large/dashboard, tabbed
```

SchoolOS-specific rule:

```text
Web is for deep operations. Mobile is for focused role-specific companion workflows.
```

---

## 8. Navigation Consolidation Decision

The uploaded role navigation maps are useful as design references, but final navigation must be generated from:

```text
roles
permissions
module entitlements
tenant/school context
device type
relationship scope
```

Navigation must not be hardcoded only by display role name.

Final navigation behavior:

```text
Hide modules the user cannot access.
Show module locked state only where useful.
Keep Platform Control Plane separate from School Dashboard.
Parent/student/driver mobile navigation must be much smaller than admin web navigation.
A multi-role user gets merged navigation, not duplicate sidebars.
```

---

## 9. Screen Inventory Consolidation Decision

The uploaded plan has a large screen inventory. That is useful, but every screen must be converted into a SchoolOS screen-contract row before implementation.

Required conversion:

```text
Uploaded screen idea -> SchoolOS module -> web/mobile route -> role -> permission -> API contract -> backend gap -> component pattern -> test/smoke requirement
```

This conversion is handled by:

```text
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
```

---

## 10. Planning Phase Rule

Until planning is marked complete:

```text
Do not start frontend screen implementation.
Do not start Flutter mobile implementation.
Do not add new backend endpoints only because a visual document lists a screen.
Do create/iterate planning docs until module screens, permissions, contracts, and design tokens are aligned.
```

Implementation begins only after:

```text
1. Consolidation notes are accepted.
2. Permission catalog is accepted.
3. Screen contract matrix is accepted.
4. Component implementation roadmap is accepted.
5. Persona smoke-test plan is accepted.
6. Frontend/backend contract sync plan is accepted.
```

---

## 11. Final Consolidated Direction

SchoolOS will use:

```text
A SchoolOS-owned design system
Blue/teal professional education palette
Role-aware web dashboards
Mobile-first companion experiences
Permission-driven navigation/actions
Backend-enforced tenant/security/scope truth
Screen-contract matrix before implementation
Shared planning between frontend, mobile, backend, and tests
```

The uploaded UI/UX plan accelerates visual planning. The SchoolOS repo docs govern product scope, security, permissions, backend contracts, and implementation readiness.
