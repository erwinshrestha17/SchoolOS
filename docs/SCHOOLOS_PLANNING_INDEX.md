# SchoolOS Planning Index

**Status:** Planning index  
**Last updated:** 2026-06-15  
**Phase:** Planning only — frontend/mobile development starts only after planning docs are accepted.

This file lists the current SchoolOS planning documents and explains how they should be used.

---

## 1. Planning Phase Decision

SchoolOS remains in planning phase until the product, design, permissions, screen contracts, backend contracts, and testing strategy are accepted.

Current rule:

```text
Keep planning until satisfied.
Do not start frontend/mobile implementation yet.
When planning is accepted, implement module-by-module using the screen contract matrix and frontend/backend sync plan.
```

---

## 2. Core UI/UX Planning Docs

| Document | Purpose |
|---|---|
| `docs/design/SCHOOLOS_UI_UX_GUIDE.md` | Main SchoolOS UI/UX guide and source of broad design/product rules. |
| `docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md` | Deep component, role, device, data access, and module-design blueprint. |
| `docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md` | Web/mobile screen plan by module and role. |
| `docs/design/SCHOOLOS_UI_UX_CONSOLIDATION_NOTES.md` | Consolidates uploaded UI/UX plans with existing SchoolOS docs. |
| `docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md` | Consolidated color, typography, spacing, radius, elevation, icon, role, and module token planning. |

---

## 3. Frontend Planning Docs

| Document | Purpose |
|---|---|
| `docs/frontend/SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md` | Maps frontend modules to real backend API usage direction. |
| `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md` | Requires backend contract verification/implementation alongside each frontend screen. |
| `docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md` | Implementation matrix for every planned screen: role, permission, API, backend gap, component, state, test. |
| `docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md` | Permission naming catalog and planning baseline for role bundles/scopes. |
| `docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md` | Build order for shared components, domain components, mobile widgets, and previews. |

---

## 4. Testing Planning Docs

| Document | Purpose |
|---|---|
| `docs/testing/SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md` | Persona-based smoke testing for owner, principal, teacher, parent, student, cashier, driver, etc. |

---

## 5. Uploaded Reference Docs

Uploaded reference files used in consolidation:

```text
schoolos-uiux-design-plan.md
school-management-system-plan.md
```

Use them as references for:

```text
Visual token detail
Typography and layout inspiration
Flutter theme direction
Screen inventory ideas
Role navigation examples
Common UI patterns
Accessibility and animation notes
```

Do not use them blindly for:

```text
Branding
Module scope
Role model
Backend architecture
Permission/security truth
Implementation order
```

---

## 6. Planning Acceptance Checklist

Planning can move toward implementation only when these are reviewed and accepted:

```text
1. Final SchoolOS module map is accepted.
2. Final role model and default role bundles are accepted.
3. Permission catalog is accepted enough for implementation.
4. Screen contract matrix has P0 rows finalized.
5. Design token direction is accepted.
6. Component implementation roadmap is accepted.
7. Frontend/backend contract sync plan is accepted.
8. Persona smoke test plan is accepted.
9. MVP implementation order is accepted.
10. Open planning questions are either answered or explicitly deferred.
```

---

## 7. Suggested Next Planning Steps

Recommended next steps:

```text
1. Review the permission catalog and adjust role bundles for Nepal school types.
2. Expand the screen contract matrix until every planned screen has a row.
3. Mark P0 backend contract gaps after auditing existing controllers/routes.
4. Decide final MVP screen order.
5. Decide final web/mobile release order.
6. Decide if dark mode, Nepali labels, and Bikram Sambat support are v1 or later.
7. Create Codex implementation prompts only after planning is accepted.
```

---

## 8. Current Recommended MVP Planning Order

```text
P0 Foundation:
- Auth/session/access metadata
- AppShell/PlatformShell/MobileShell planning
- Permission/entitlement gates
- State components
- DataTable/FilterBar/Search/Pagination

P0 Web workflows:
- Owner/principal/teacher/finance dashboards
- Students
- Attendance
- Fees and receipts
- Report cards/published results
- Notices basics

P1 Web workflows:
- Admissions pipeline
- Homework/timetable
- HR/payroll
- Library
- Transport
- Canteen
- Accounting

P1/P2 Mobile workflows:
- Parent overview
- Parent fees/notices/attendance/report cards
- Teacher attendance/homework/chat
- Student homework/timetable/results
- Driver trip
```

---

## 9. Final Planning Rule

```text
Every planned screen must map to:
Role -> Permission -> Scope -> API -> Backend contract -> Component -> State -> Test.
```

If a screen cannot be mapped, it is not ready for implementation.
