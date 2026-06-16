# Mobile Agent Instructions

Scoped rules for `apps/schoolos_mobile`. Root `AGENTS.md` applies first.

## Read

Before mobile work, read relevant root rules, `MOBILE_MASTER_GUIDE.md`, mobile design plan, web plan if the flow depends on web-owned admin setup, project status/plan, architecture/security, FRS, and existing Flutter/API code for the touched feature.

## Never break

- Flutter mobile is a companion app, not a mini web dashboard.
- Persona-first, task-first, low-bandwidth friendly, real APIs only.
- Web-first areas stay web-first: admin setup, finance/accounting/payroll admin, platform operations, provider settings, large reports/exports, dense tables, system config.
- No admin-shaped APIs for parent, teacher, principal, driver, staff self-service, or student session screens.
- Parent = own child. Teacher = today/assigned work. Principal = attention/snapshot. Driver = assigned trip. Staff = own data. Student = controlled lab/session only.
- No broad student mobile app.
- Backend authorization is truth; hidden mobile actions are UX only.
- Offline support only where safe and visible; high-risk writes stay online-only per root rules.
- Private files use authenticated download/share helpers.

## Backend gap rule

If a mobile screen needs data/action and no persona-safe endpoint exists, do not reuse admin-shaped APIs or fake state. Inspect backend/OpenAPI/contracts first. If it meets production criteria, add/request a module-owned, tenant-scoped, RBAC/entitlement-gated, purpose-limited mobile API. If not, keep a friendly unavailable/locked/offline/permission state and mark the gap as `needs backend verification`, `needs mobile DTO`, or `needs offline sync confirmation`.

## Structure

Use existing feature-first structure:

```text
lib/core/auth
lib/core/network
lib/core/storage
lib/core/permissions
lib/features/<feature>
lib/shared/widgets
```

Preferred flow: `presentation -> application/use-cases -> domain -> data`.

Widgets do not hold backend business rules. Data clients do not decide UI behavior. Use shared routing, API, permissions, state, and file helpers where available.

## Screen completion checklist

Before marking a mobile screen complete:

- One persona, one primary job.
- Route allowed for role, module, and ownership/assignment.
- Real purpose-limited API; DTO contains only needed fields.
- Loading, empty, error, offline, permission denied, module locked, login expired, success states handled where relevant.
- Cached reads show last-updated time.
- Low-bandwidth friendly; avoids unnecessary large media loading.
- Deep links re-check login, tenant, role, permission, module, and ownership/assignment.
- Logout/expired login clears private app cache.
- Private files use authenticated helper with pending/unavailable/denied/expired/retry states.
- Copy is school-friendly and clear for non-technical users.

## API/offline checklist

When adding/changing a mobile API call:

- Confirm endpoint is intended for the persona.
- Confirm shape from backend/OpenAPI/contracts; mark unknowns clearly.
- Map backend errors to safe mobile messages.
- Handle expired login, permission denial, unavailable data, conflict, offline, timeout, validation.
- Avoid storing unnecessary response data locally.
- Do not queue writes unless backend idempotency/reconciliation is confirmed.

For offline/cached flows:

- Cache safe read summaries only.
- Show offline banner and retry.
- Use visible queued/syncing/synced/failed states only for approved offline writes.
- Re-check server state before finalizing queued writes.
- Never hide conflicts or overwrite server data silently.

## Learning/student session

Student session access is lab/session-only or controlled school-device MVP. Join only valid live own class/section sessions. Student sees own attempt/result only. Autosave/submit must be idempotent. No leaderboard, open chat, AI tutor, broad student home, or harsh labels.

## Implementation order

Core shell/login -> Parent MVP -> Teacher MVP -> Staff/Driver MVP -> Principal attention -> Parent operations depth -> Controlled student session polish -> device QA/offline/read-cache/push/accessibility/low-bandwidth.

Do not start a mobile screen if only admin-shaped API exists.

## Verification matrix

- UI-only: `dart format .`, `flutter analyze`, focused widget/unit test where available.
- API/data: analyze, affected tests, persona smoke.
- Login/local data: analyze, tests, logout/expired-login smoke.
- Offline/cache: analyze, tests, offline/reconnect smoke.
- Private file: analyze, open/download/share smoke.
- Learning/session: analyze, tests, join/autosave/submit scope smoke.

## Commands

Run after mobile implementation changes and claim only what ran:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

Docs-only changes need no runtime checks.
