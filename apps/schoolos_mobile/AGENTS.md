# Mobile Agent Instructions

Scoped instructions for `apps/schoolos_mobile`. Root `AGENTS.md` still applies.

## Read before mobile work

- `../../AGENTS.md`
- `MOBILE_MASTER_GUIDE.md`
- `../../docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`
- `../../docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` when mobile depends on a web-owned admin workflow
- `../../docs/project/SCHOOLOS_PROJECT_STATUS.md`
- `../../docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`
- `../../docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
- `../../docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`

## Product direction

- Flutter mobile is a companion app, not a mini web dashboard.
- Mobile shows what each persona needs to know or safely do now.
- Mobile must be persona-first, task-first, low-bandwidth friendly, and backed by real SchoolOS APIs only.
- Web-first areas stay web-first: admin setup, finance setup, accounting admin, payroll admin, platform operations, provider settings, large reports/exports, dense tables, and system configuration.

## Persona scope

- Parent: own child summary and urgent items only.
- Teacher: today's classes, assigned attendance, homework, timetable, notices/messages, and supported learning sessions.
- Principal: attention items, approvals, risks, and safe snapshots.
- Driver/conductor: assigned trip only.
- Staff self-service: own profile, attendance, leave, payslips, and notices.
- Student: controlled lab/session access only; no broad MVP student app.

## Flutter architecture

Use existing feature-first structure:

```text
lib/core/auth
lib/core/network
lib/core/storage
lib/core/permissions
lib/features/<feature>
lib/shared/widgets
```

Preferred flow:

```text
presentation -> application/use-cases -> domain -> data
```

- Widgets should not contain backend business rules.
- Data clients should not decide UI behavior.
- Use one configured API client pattern.
- Use role-aware routing and permission/module checks.
- Keep private user/school details out of app logs and debug UI.

## API and access rules

- Use real backend APIs only.
- Do not use admin-shaped endpoints for parent, teacher, principal, driver, staff self-service, or student session screens.
- Do not invent endpoint contracts. Mark unknowns as `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
- Every deep link must re-check login state, tenant, role, permission, module entitlement, and ownership/assignment before rendering.
- Backend authorization remains the source of truth.

## State rules

Every screen should handle, where relevant:

- Loading
- Empty
- Error
- Offline
- Permission denied
- Module locked
- Pending sync
- Success
- Login expired
- Private file unavailable

Use shared state widgets and school-friendly messages. Show last-updated labels for cached reads.

## Local app data and logout

- Use the existing app storage pattern for login state.
- Clear private app cache on logout or expired login.
- Back navigation after logout must not show previous user data.
- Role switcher is allowed only where backend permissions support it.

## Offline and sync

Offline support is allowed only where safe and visible.

Safe cached reads may include summaries and today-focused lists for the active persona.

Offline writes require backend idempotency and visible queued/syncing/synced/failed states. Do not silently overwrite newer server data.

High-risk writes stay online-only. Follow the root `AGENTS.md` finance/accounting/mobile restrictions.

## Private files

Use authenticated download/share helpers only. Do not expose storage internals or long-lived file links.

## Learning and student session

- Student access is lab/session-only or controlled school-device only for MVP.
- Join only valid live sessions for own class/section.
- Student sees only own active attempt/result.
- Autosave and submit must be idempotent.
- No public leaderboard, open chat, AI tutor, broad student home, or harsh labels.

## Mobile screen completion checklist

Before marking a mobile screen complete, confirm:

- The screen serves one persona and one primary job.
- The route is allowed for that role and module entitlement.
- Data comes from a real purpose-limited API.
- No admin-shaped payload is used for mobile persona screens.
- Loading, empty, error, offline, permission denied, module locked, login expired, and success states are handled where relevant.
- The UI is low-bandwidth friendly and avoids unnecessary large media loading.
- Cached data clearly shows last-updated time.
- Logout or expired login clears private app cache.
- Deep links re-check scope before rendering private content.
- Private files use authenticated download/share helpers.
- Mobile copy is school-friendly and clear for non-technical users.

## Mobile API integration checklist

When adding or changing a mobile API call:

- Confirm the endpoint is intended for the mobile persona.
- Confirm response DTO contains only fields the persona should see.
- Map backend errors into safe mobile messages.
- Handle expired login, permission denial, unavailable data, conflict, offline, timeout, and validation states.
- Avoid storing unnecessary response data locally.
- Do not queue writes unless backend idempotency and reconciliation are confirmed.

## Offline and deep-link checklist

For offline or cached flows:

- Cache only safe read summaries.
- Show last-updated time and offline banner/state.
- Make retry obvious.
- Use visible queued/syncing/synced/failed states for approved offline writes.
- Re-check server state before finalizing a queued write.
- Never hide sync conflicts or silently overwrite server data.

For deep links:

- Re-check login state.
- Re-check tenant, role, permission, module, and ownership/assignment.
- Show safe blocked state when the target is unavailable or not allowed.

## Private file checklist

For each mobile file action:

- Use the shared authenticated helper.
- Show pending/download/share state.
- Show unavailable, denied, expired, offline, and retry states.
- Do not store temporary file links as durable app state.
- Clear file-related private cache on logout where applicable.

## Mobile implementation order

Follow the mobile design plan order:

1. Core shell and login hardening.
2. Parent MVP.
3. Teacher MVP.
4. Staff and driver MVP.
5. Principal attention app.
6. Parent operations depth.
7. Controlled student session polish.
8. Device QA, offline/read cache, push notifications, accessibility, and low-bandwidth polish.

Do not start a mobile screen if the only available endpoint is admin-shaped or exposes more data than the persona needs.

## Verification matrix

- UI-only screen change: `dart format .`, `flutter analyze`, focused widget/unit test where available.
- API/data change: analyze, affected tests, and manual smoke with expected persona state.
- Login/local-data change: analyze, tests, logout/expired-login smoke.
- Offline/cache change: analyze, tests, offline/reconnect smoke.
- Private file change: analyze, file open/download/share smoke.
- Learning/student session change: analyze, tests, join/autosave/submit scope smoke.

## Verification

Run after mobile implementation changes and do not claim passing unless run:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

For docs-only instruction edits, runtime checks are not required.
