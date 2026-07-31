# W4–W6 Component Polish Outline (post-W3)

Planning artifact for the remaining full-app polish program. **Not implemented in the W3 slice.**

## W4 — Operational modules (~80–100 files)

**Modules:** M6 Homework/Timetable, M7 HR/Payroll, M8 Library, M9 Transport, M10 Canteen

| Priority | Surfaces | Polish checklist |
|---|---|---|
| P1 | `transport-workspace.tsx`, `canteen-workspace.tsx` | Raw `<button>` → `Button`; module-accent primary buttons → brand primary |
| P1 | `library-workspace.tsx`, homework detail/list | `StatusBadge` on queue rows; shared list states |
| P2 | Timetable builder/substitutions routes | `PageHeader` → `ModuleHeader` where still legacy |
| P2 | HR staff detail, payroll runs | PermissionDenied on gated writes |

**Exit gate:** extend `component-polish-w4-contract.test.mjs`; `workspace-consistency-contract` covers all W4 overview routes.

## W5 — Accounting, Settings, Platform (~60–80 files)

**Modules:** M11 Accounting, School Settings, Platform Control Plane

| Priority | Surfaces | Notes |
|---|---|---|
| P1 | Accounting reports, fiscal views | Keep nested module layout; polish `Button` + export feedback |
| P1 | Settings workspaces | Align with `SchoolSettingsPageHeader` frame — do not force `ModuleHeader` |
| P2 | Platform operator pages | Shared states on tenant/billing queues |

**Exit gate:** settings contract tests green; platform operator states contract unchanged or extended.

## W6 — Verification and accessibility (all routes)

| Workstream | Actions |
|---|---|
| Accessibility | Icon-only controls get `aria-label`; keyboard nav via `ux-polish-keyboard.spec.ts` |
| Contract regression | Resolve persistent 13-suite web test ceiling or document accepted failures |
| E2E | Re-run module smokes after each wave; capture staging evidence per GA release policy |
| Visual | `/dashboard/visual-fixtures/workspace-states` screenshot matrix when `SCHOOLOS_VISUAL_FIXTURES=1` |

## Recommended PR sequence

1. W4 transport + canteen (highest raw-button density)
2. W4 library + homework
3. W4 HR/payroll + timetable
4. W5 accounting operational views
5. W5 settings (header frame only, no business logic)
6. W5 platform shell
7. W6 verification-only PR (tests + a11y + evidence)

## Dependencies

- W3 evidence: [`w3-component-polish-2026-07-31-local.md`](./w3-component-polish-2026-07-31-local.md)
- Design system: [`apps/web/docs/DESIGN_SYSTEM.md`](../../apps/web/docs/DESIGN_SYSTEM.md) §8
- Implementation order: [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) §11
