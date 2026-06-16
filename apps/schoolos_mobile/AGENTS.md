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
- Every deep link must re-check session, tenant, role, permission, module entitlement, and ownership/assignment before rendering.
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
- Session expired
- Protected file unavailable

Use shared state widgets and school-friendly messages. Show last-updated labels for cached reads.

## Local storage and logout

- Keep auth/session material only in the existing secure storage pattern.
- Clear private caches on logout/session expiry.
- Back navigation after logout must not expose previous user data.
- Role switcher is allowed only where backend/session permissions support it.

## Offline and sync

Offline support is allowed only where safe and visible.

Safe cached reads may include parent child summary, attendance summary, homework list, notices already opened, teacher timetable/roster, driver trip manifest with minimal safe fields, staff own profile/leave balance, and student current learning attempt draft where policy allows.

Offline writes require backend idempotency and visible queued/syncing/synced/failed states. Do not silently overwrite newer server data.

Never allow offline payments, wallet debits/top-ups, refunds, payroll actions, accounting actions, report-card publish, tenant/platform settings, or high-risk writes.

## Protected files

Use authenticated download/share helpers only. Do not expose storage internals or long-lived file links.

Protected mobile files include receipts, report cards, payslips, notice attachments, homework attachments, activity media, student documents where allowed, learning resources, and payment proof files.

## Learning and student session

- Student access is lab/session-only or controlled school-device only for MVP.
- Join only valid live sessions for own class/section.
- Session code/QR must expire and fail closed.
- Student sees only own active attempt/result.
- Autosave and submit must be idempotent.
- No public leaderboard, open chat, AI tutor, broad student home, or harsh labels.

## Mobile implementation order

Follow the mobile design plan order:

1. Core shell and auth hardening.
2. Parent MVP.
3. Teacher MVP.
4. Staff and driver MVP.
5. Principal attention app.
6. Parent operations depth.
7. Controlled student session polish.
8. Device QA, offline/read cache, push notifications, accessibility, and low-bandwidth polish.

Do not start a mobile screen if the only available endpoint is admin-shaped or exposes more data than the persona needs.

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
