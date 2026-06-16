# Web Agent Instructions

Scoped instructions for `apps/web`. Root `AGENTS.md` still applies.

## Read before web work

- `../../AGENTS.md`
- `../../docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
- `../../docs/project/SCHOOLOS_PROJECT_STATUS.md`
- `../../docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`
- `../../docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
- `../../docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md`
- `e2e/README.md` for browser smoke expectations
- Existing API clients, shared UI components, route files, and contracts for the touched module

## Product direction

- SchoolOS web is the daily school operating desk.
- One screen = one main job.
- It must not feel like a generic ERP, decorative dashboard, shortcut wall, fake demo UI, or technical admin console.
- Frontend standardization and real API-backed workspaces are the current priority.

## Route boundaries

- `/dashboard/*` = daily school operations.
- `/dashboard/settings/*` = one school's configuration.
- `/platform/*` = SchoolOS SaaS/operator control plane.
- Do not mix platform billing with school fees/accounting.
- Do not expose platform-only controls inside school operations navigation.
- Direct locked or forbidden routes must show safe denied/locked states.

## Data and API rules

- Use real backend APIs only.
- No fake dashboard data, placeholder metrics, mock production data, or browser-only production state.
- Backend RBAC, tenant scope, module entitlement, and route guards are source of truth.
- Frontend hiding is UX only.
- Use existing API helpers and `packages/core` contracts where available.
- Do not invent endpoint shapes. Mark unknowns as `needs OpenAPI confirmation`.
- Growing lists must use server-side pagination/filtering.
- Financial totals, attendance totals, payroll totals, and accounting totals must come from backend/database.

## Required UI states

Every relevant screen must handle:

- Loading
- Empty
- Error
- Success
- Permission denied
- Module locked
- Validation errors
- File unavailable
- Slow network or retry
- Queued job
- Partial failure

Use shared primitives such as `ErrorState`, `ModuleLockedState`, protected file components, table/filter primitives, dialog/reason patterns, and existing design tokens instead of one-off states.

## Protected files

Protected files must use File Registry-backed authenticated helpers/components.

- Use `ProtectedFileButton`, `ProtectedFileLink`, or shared blob/download helpers where available.
- Do not use raw `window.open` for private files.
- Do not persist temporary access URLs in client state beyond the immediate action.
- Show friendly unavailable, expired, permission, or retry states.

Protected files include receipts, cashier close PDFs, report cards, payslips, student documents/photos, activity media, notice/chat attachments, homework attachments, learning resources, accounting reports, exports, snapshots, and generated documents.

## Forms and mutations

- Critical forms should use existing form/validation patterns.
- Mutations need pending, success, and error states.
- High-risk actions need confirmation and reason where required.
- Preserve user input after recoverable errors where practical.
- Do not calculate official financial values in the browser.
- Idempotent backend behavior is required for retryable money or document-generation actions.

## Web screen completion checklist

Before marking a web screen complete, confirm:

- The screen has one clear main job, title, purpose line, and primary action.
- It uses real backend APIs through existing API/client helpers.
- It has loading, empty, error, success, permission denied, and module locked states.
- It handles validation and slow-network/retry states where relevant.
- It uses school-friendly copy, not raw API or technical errors.
- Growing data uses server-side pagination/filtering/search.
- Permission and entitlement checks are represented in UX but enforced by backend.
- High-risk actions use confirmation and reason where required.
- Official totals come from backend data.
- Protected files use shared protected file helpers.
- The screen works for direct URL access and forbidden/locked access.
- Relevant browser smoke or focused regression is added/updated where appropriate.

## API/query usage checklist

When connecting a workspace to APIs:

- Confirm endpoint shape from OpenAPI/shared contracts or existing client code.
- Normalize response shape once in the API helper, not separately in many components.
- Keep list filters, page, page size, sort, and search in URL/query state where useful.
- Avoid loading large unbounded data sets into the browser.
- Keep optimistic updates limited to low-risk UI improvements; backend remains truth.
- Show queued/export/report job status instead of blocking the page.
- Handle 401/session expiry, 403/permission, 404/unavailable, 409/conflict, and validation errors with safe messages.

## Protected file checklist

For every private file action:

- Use `ProtectedFileButton`, `ProtectedFileLink`, or shared authenticated blob/download helper.
- Show pending state while opening/downloading.
- Show unavailable, denied, expired, and retry states.
- Do not expose storage internals in UI state, logs, routes, or query params.
- Do not use raw browser open for private file URLs.

## Mutation checklist

For create/update/delete/status actions:

- Disable repeated submit while pending.
- Show success and failure state.
- Preserve form values after recoverable errors.
- Ask for confirmation before destructive or high-risk actions.
- Ask for reason where backend/audit policy requires it.
- Refresh or invalidate the correct query after success.
- Do not silently mutate confirmed finance/accounting/payroll records outside approved workflows.

## Web implementation order

Follow the active web design plan order:

1. Shared UI foundation and shell standardization.
2. Main dashboard command center.
3. High-use daily modules: M1, M2, M3, M4, M10.
4. Operational modules: M6, M7, M8A, M8B, M8C.
5. M9 Accounting, M12 Learning, Settings, Platform.
6. Accessibility, browser E2E, contract verification, permission/module states, staging smoke.

## Browser smoke expectations

Persona smoke should prove login, correct dashboard, role navigation, forbidden direct route handling, tenant-scoped allowed records, denied unallowed records, permitted actions with states, protected file access, and safe logout/session expiry.

Priority personas include platform operator, principal, school admin, admission officer, teachers, accountant/cashier, HR/payroll, librarian, transport, driver, canteen, parent, student lab-only user, and staff self-service.

## Verification matrix

- Component-only UI change: web typecheck and focused browser/component check where available.
- API-connected screen: web typecheck, affected browser smoke/e2e where practical.
- Protected file change: helper usage check plus affected file-open/download flow.
- Finance/accounting/payroll screen: verify backend totals are used and run focused regression where available.
- Route/navigation/permission change: browser smoke for direct route, forbidden route, and module-locked state.

## Verification

Run relevant checks after web changes and do not claim passing unless run:

```bash
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

For docs-only instruction edits, runtime checks are not required.
