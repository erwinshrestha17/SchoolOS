# Web Agent Instructions

Scoped rules for `apps/web`. Root `AGENTS.md` applies first.

## Read

Before web work, read relevant root rules, web design plan, project status/plan, architecture/security, platform operations, `e2e/README.md`, existing routes/components/API clients/contracts/tests for the touched module.

## Never break

- Next.js App Router stays in `apps/web`; no Angular migration.
- Web is the daily school operating desk: one screen = one main job.
- Use real backend APIs only; no fake production data, placeholder metrics, or browser-only truth.
- Backend tenant/RBAC/entitlement checks are truth; frontend hiding is UX only.
- Route planes stay separate: `/dashboard/*`, `/dashboard/settings/*`, `/platform/*`.
- School fee collection is not SaaS billing.
- Growing lists use server-side pagination/filtering.
- Official finance/attendance/payroll/accounting totals come from backend.
- Private files use protected helpers, not raw private URLs.
- High-risk actions need confirmation, pending/success/error state, and reason where required.

## Backend gap rule

If a screen needs data and no safe endpoint exists, do not fake it or compute official values in the browser. Inspect existing API clients, backend controllers, OpenAPI/contracts, and permissions. If it meets production criteria, add/request a module-owned, tenant-scoped, RBAC/entitlement-gated backend API and connect it. If not, keep a friendly unavailable/locked/permission state and mark the gap as `needs backend verification` or `needs OpenAPI confirmation`.

## Screen completion checklist

Before marking a screen complete:

- One clear title, purpose line, main job, and primary action.
- Real API through existing client/helper; endpoint shape confirmed from code/OpenAPI/contracts.
- Loading, empty, error, success, permission denied, module locked states present.
- Validation, slow-network/retry, queued job, file unavailable, partial failure handled where relevant.
- School-friendly messages; no raw technical errors.
- Server-side pagination/filter/search for growing data.
- Direct URL access works for allowed, forbidden, and locked cases.
- Protected files use `ProtectedFileButton`, `ProtectedFileLink`, or shared authenticated blob/download helper.
- Mutations disable duplicate submit, show result, preserve recoverable form input.
- Destructive/high-risk mutations confirm and request reason where backend/audit requires it.
- Query invalidation/refetch is correct after mutation.
- Focused browser smoke/regression added or updated where appropriate.

## API/query checklist

- Normalize response shape once in API helper, not many components.
- Keep filters/page/sort/search in URL state where useful.
- Avoid unbounded data loading into browser.
- Use backend summaries or honest unavailable states; never fake dashboard data.
- Handle session expiry, permission denial, unavailable data, conflict, and validation safely.
- Show export/report job status instead of blocking page.
- Mark unknown endpoints as `needs OpenAPI confirmation`.

## File/action checklist

Private file action:

- Use shared protected helper.
- Show pending, unavailable, denied, expired, retry states.
- Do not expose storage internals in UI, logs, routes, or query params.

Mutation:

- Pending guard against repeat submit.
- Confirmation/reason for high-risk action.
- Success/error state.
- Correct refetch/invalidate.
- No silent mutation of confirmed finance/accounting/payroll records outside approved workflows.

## Implementation order

Follow the web design plan: shared UI/shell -> dashboard -> high-use modules M1/M2/M3/M4/M10 -> operations M6/M7/M8 -> M9/M12/settings/platform -> accessibility/browser E2E/staging smoke.

## Persona smoke

Smoke should prove login, correct dashboard, role navigation, direct forbidden route safe state, allowed tenant records visible, unallowed records hidden, permitted action states, protected file access, logout/session expiry.

## Verification matrix

- UI-only: web typecheck plus focused check where available.
- API screen: web typecheck and affected browser smoke/e2e where practical.
- Protected file: helper usage plus open/download flow.
- Finance/payroll/accounting: backend totals confirmed plus focused regression where available.
- Route/permission: browser smoke for direct, forbidden, locked states.

## Commands

Run relevant checks only and claim only what ran:

```bash
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

Docs-only changes need no runtime checks.
