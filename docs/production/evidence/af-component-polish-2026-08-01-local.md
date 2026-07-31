# AF Component Polish — Accounting & Finance (2026-08-01, local)

Status: **development complete (AF band locally); not staging validated / not GA**

## Scope delivered

| Module | Changes |
|---|---|
| **M3 Fees (deep)** | Shared `Button` on ledger, student ledger, approval queue, discounts/waivers, finance reports, setup, dues, aging, overview, collection discovery; `StatusBadge` on discount rules and dues rows |
| **M11 Accounting (core)** | Removed nested `PageHeader` from reports view; `Button` on reports, reconciliation, journals, COA, audit, dashboard voucher shortcuts; `LoadingState`/`ErrorState` on accounting report fetch |
| **M11 Accounting (fiscal/dialogs)** | `Button` on journal/voucher/opening-balance dialogs, fiscal management/actions, fiscal-year-close dialog; budgets page content-only (no nested header); layout primary action via `Button` |

## Infrastructure

- [`apps/web/test/component-polish-af-contract.test.mjs`](../../apps/web/test/component-polish-af-contract.test.mjs) — **5/5**
- Fixed [`m3-fees-workspace-contract.test.mjs`](../../apps/web/test/m3-fees-workspace-contract.test.mjs) layout gate to assert `dashboardRouteGates` prefixes (was stale inline `href.startsWith`)
- Extended [`workspace-consistency-contract.test.mjs`](../../apps/web/test/workspace-consistency-contract.test.mjs) accounting sub-routes

## Verification run (local)

```bash
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/web build
node --test apps/web/test/component-polish-af-contract.test.mjs
node --test apps/web/test/m3-fees-workspace-contract.test.mjs
node --test apps/web/test/component-polish-w3-contract.test.mjs
node --test apps/web/test/workspace-consistency-contract.test.mjs
```

| Check | Result |
|---|---|
| Web typecheck | exit 0 |
| Web build | exit 0 |
| `component-polish-af-contract.test.mjs` | **5/5** |
| `m3-fees-workspace-contract.test.mjs` | **14/14** (layout gate fixed) |
| `component-polish-w3-contract.test.mjs` | **9/9** |
| `workspace-consistency-contract.test.mjs` | **10/10** |

## AF exit criteria

| Criterion | Status |
|---|---|
| No nested `PageHeader` in accounting module children | pass |
| M3 priority surfaces use shared `Button` | pass |
| M11 priority workspaces use shared `Button` | pass |
| Fee `PermissionDenied` gating preserved | pass |
| Money workflow confirms/idempotency unchanged | pass (contracts) |
| typecheck/build exit 0 | pass |

## Honest boundary

- **Not claimed:** staging/pilot/GA, full 265-route polish, W4–W6 operational modules, authenticated browser matrix
- Full web suite ceiling not re-run; prior baseline ~464 pass / 13 fail may still apply for unrelated suites
- School fee collection/accounting only — not SaaS `/platform` billing

Do not treat this slice as production release evidence.
