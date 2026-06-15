# SchoolOS Role and Screen Design Reference

**Status:** Reference  
**Last updated:** 2026-06-15  
**Purpose:** Consolidated design reference for role-based UI, web/mobile screen behavior, component reasoning, and module screen patterns.

This file replaces these older long-form reference docs in the active tree:

```text
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md
docs/design/SCHOOLOS_UI_UX_CONSOLIDATION_NOTES.md
```

Those deleted files remain available in Git history. This consolidated file is intentionally shorter so the repo stays easier to navigate during planning.

Source-of-truth docs remain:

```text
docs/SCHOOLOS_PLANNING_INDEX.md
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md
docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md
docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md
docs/testing/SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md
```

---

## 1. Core Product Decision

SchoolOS has two primary experiences:

```text
Web Dashboard = deep school operations
Mobile App = focused role-specific companion
```

Web is for:

```text
Tables
Filters
Bulk actions
Exports
Approvals
Setup
Configuration
Audit trails
Long forms
Complex workflows
```

Mobile is for:

```text
Cards
Timelines
Notifications
Quick actions
Own tasks
Own children
Assigned trips
Today view
Simple status updates
```

Final rule:

```text
Do not turn mobile into a smaller web admin dashboard.
Do not turn the web dashboard into only cards when staff need tables and reports.
```

---

## 2. Source-of-Truth Hierarchy

| Area | Source of truth |
|---|---|
| Product/UI rules | `docs/design/SCHOOLOS_UI_UX_GUIDE.md` |
| Visual tokens | `docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md` |
| Permissions/scopes | `docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md` |
| Screen implementation readiness | `docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md` |
| Frontend/backend contract sync | `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md` |
| Components | `docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md` |
| Persona smoke tests | `docs/testing/SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md` |

This file is reference only.

---

## 3. Role/Permission Design Rule

SchoolOS must not hardcode UI only by display role.

Final access model:

```text
Role -> Permission -> Scope -> Module Entitlement -> Workflow State -> UI Variant
```

Every screen must consider:

```text
Authenticated user
Tenant/school context
Assigned roles
Fine-grained permissions
Module entitlement/locked state
Relationship scope: own class, own subject, own child, assigned trip, assigned counter, assigned school
Device type: web, mobile, tablet/POS
Workflow state: draft, pending, approved, posted, locked, published, archived, cancelled
```

Frontend should ask:

```text
Who is using this page?
What are they allowed to do?
What data are they allowed to see?
What is the safest next action?
What should be hidden, disabled, or explained?
```

Backend enforces truth. Frontend reflects truth.

---

## 4. Screen Design Modes

SchoolOS screens use different design modes based on responsibility.

| Mode | Users | UI style |
|---|---|---|
| Executive mode | Owner/director, principal with owner role | KPI cards, trends, risks, approvals, drill-downs. |
| Operations mode | Principal, coordinator, admin, HR, transport, canteen, librarian | Task queues, tables, filters, boards, calendars, workflows. |
| Practitioner mode | Teacher, cashier, librarian desk, POS user, driver | Today-focused, fast actions, limited filters, scanner/search-first. |
| Self-service mode | Parent, student, staff self-service | Mobile-first cards, own data only, timelines/status, simple language. |
| Platform mode | Platform operator/support/billing | Tenant control, provider health, queues, billing, support override, audit. |

---

## 5. Device Strategy by Role

| Role / actor | Web | Mobile | Design priority |
|---|---|---|---|
| Platform operator | Yes | No by default | Web-only SaaS control plane. |
| Owner/director | Yes | Optional | Executive overview, alerts, approvals. |
| Principal/head teacher | Yes | Yes | Web for operations; mobile for alerts/approvals. |
| Academic coordinator | Yes | Optional | Web-first academic operations. |
| School admin/office admin | Yes | Optional | Web-first records and office workflows. |
| Admission officer | Yes | Optional | Web-first admission pipeline. |
| Accountant | Yes | Optional summary/approval | Web-first financial accuracy. |
| Cashier | Yes | Optional tablet/lookup | Counter workflow. |
| HR/payroll officer | Yes | Optional summary/approval | Confidential payroll and staff work. |
| Class teacher | Yes | Yes | Web detail + mobile daily class work. |
| Subject teacher | Yes | Yes | Web marks/homework + mobile quick tasks. |
| Librarian | Yes | Optional scanner/tablet | Desk workflow. |
| Transport manager | Yes | Yes | Planning and live transport monitoring. |
| Driver/conductor | No admin web | Yes | Mobile assigned trip only. |
| Canteen manager | Yes | Optional tablet/POS | POS, menu, wallet, inventory. |
| POS staff | Limited web/tablet | Optional | Scan/serve/sell only. |
| Parent/guardian | Optional portal later | Yes | Mobile-first own-child view. |
| Student | Optional portal later | Yes | Mobile-first learning view. |
| Support override user | Web only | No | Time-limited audited support. |

---

## 6. Global Web Template

Every web module should follow this structure unless there is a strong reason not to:

```text
AppShell / PlatformShell
  Topbar
  Sidebar
  PageHeader
    Title
    Description
    Primary action
    More actions
  ContextBar / FilterBar
  Summary strip / KPI cards when useful
  Main workspace
    DataTable / Grid / Builder / Timeline / Board
  Optional right insight drawer
  Action dialogs
  State components
```

Required states:

```text
Loading skeleton
Empty state with next action
Error state with retry
Permission denied state
Module locked state
Read-only state where applicable
Pending mutation state
Success confirmation
Partial success state for batch operations
```

---

## 7. Global Mobile Template

Every mobile module should follow this structure:

```text
MobileShell
  MobileHeader
  Role/child/class/trip switcher if needed
  Today summary card
  Main card list / timeline / action panel
  Primary bottom action when needed
  Bottom navigation
  State components
```

Mobile rules:

```text
No dense admin tables.
Use cards, timelines, lists, and simple action buttons.
Use own data or assigned data only.
Use bottom navigation for parent/student/driver/teacher flows.
Keep forms short.
Offline/pending states matter for attendance, trips, and field operations.
Push notifications deep-link into scoped screens.
```

---

## 8. Module Screen Pattern Summary

| Module | Web design pattern | Mobile design pattern |
|---|---|---|
| Dashboard | Role dashboards with KPIs, alerts, pending work. | Role today view and action cards. |
| M0 Platform | Tenant/provider/billing/queue control plane. | No default mobile. |
| Auth/RBAC/Settings | Users, roles, settings, access matrix. | Account/security only. |
| M1 Students | Directory, profile tabs, documents, QR, lifecycle, iEMIS. | Parent child summary, student own profile, teacher roster. |
| M1 Admissions | Pipeline, application detail, duplicate review, enrollment. | Summary/approval only later. |
| M2 Attendance | Marking roster, register, corrections, conflicts, working days. | Teacher marking, parent/student attendance, principal alerts. |
| M3 Fees | Finance dashboard, setup, invoices, ledger, collection, receipts, close. | Parent dues/receipts, optional cashier lookup. |
| M4 Academics | Setup, marks/CAS grid, report cards, publishing, promotion. | Published results/report cards, teacher tasks. |
| M5 Activity | Feed, composer, audience preview, media, moderation, milestones. | Parent feed, teacher quick post, preschool milestones. |
| M6 Homework | Assignments, submissions, reminders, reports. | Parent/student homework, teacher quick view. |
| M6 Timetable | Builder, conflicts, rooms, availability, substitutions. | My timetable, class timetable, substitution alerts. |
| M7 HR/Payroll | Staff, leave, payroll runs, payslips, salary structures. | Staff leave/payslips, approval cards. |
| M8A Library | Desk, catalog, copies, issue/return, overdue, fines. | My library, optional scanner. |
| M8B Transport | Routes, vehicles, assignments, trips, delay broadcast, reports. | Driver trip, parent transport, principal alerts. |
| M8C Canteen | POS, menu, meal plans, wallets, inventory, reports. | POS tablet, parent/student canteen status. |
| M9 Accounting | Chart, journals, periods, vouchers, reconciliation, reports. | No full mobile accounting in v1. |
| M10 Notices/Chat | Composer, audience preview, inbox, threads, escalation review. | Parent notices/chat, teacher chat, principal alerts. |
| M12 Learning | Activities, sessions, attempts, progress, resources. | Student learning, parent summary, teacher session card. |
| Reports/Exports | Catalog, filters, export jobs, file registry. | Scoped document downloads only. |
| Advanced Ops | Approval center, automation, analytics, templates, export center. | Urgent approval/insight cards only. |

---

## 9. Component Strategy Reference

SchoolOS owns its component system.

```text
Build SchoolOS components.
Use dependencies only behind SchoolOS wrappers.
Never build pages from random provider components or copied templates.
```

Accepted dependency direction:

```text
Radix/shadcn-style primitives for accessible behavior
TanStack Query for server state
TanStack Table behind SchoolOS DataTable when needed
React Hook Form + Zod behind SchoolOS form patterns
Lucide icons as one icon language
Tailwind utilities with SchoolOS tokens
Flutter Material 3 with SchoolOS theme wrappers
```

Component build order is governed by:

```text
docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md
```

---

## 10. Screen Contract Rule

Every screen idea must become a row in:

```text
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
```

Required mapping:

```text
Screen -> Role -> Permission -> Scope -> API -> Backend contract -> Component -> State -> Test
```

If a screen cannot be mapped, it is not ready for implementation.

---

## 11. Final Reference Rule

This file is for context only.

Implementation decisions must be made from:

```text
docs/SCHOOLOS_PLANNING_INDEX.md
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md
docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md
docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md
docs/testing/SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md
```
