# SchoolOS Mobile Master Guide

**Status:** App-local pointer and guardrail
**Updated:** 2026-06-26
**Authoritative mobile plan:** `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`
**Authoritative surface allocation:** `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`
**Authoritative release policy:** `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`

This file stays in the Flutter app so mobile contributors can find the active mobile plan and release target quickly. Detailed persona, API, offline, state, and feature structure decisions live in the dedicated mobile app UI/UX design plan. Mobile work is evaluated against the Production / General Availability (GA) release policy, not MVP completion language.

## Required Read Order

1. `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`
2. `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
3. `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
4. `docs/requirements/SCHOOLOS_SRS.md`
5. `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
6. `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`
7. `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`
8. `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`
9. `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` when a mobile flow depends on a web-owned admin workflow
10. `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` for current release evidence and blockers

## Mobile Product Rules

1. Keep Flutter feature-first under `lib/features/<feature>`.
2. Keep shared auth, network, storage, permissions, and errors under `lib/core`.
3. Use one Dio-backed API client.
4. Parent flows are own-child only.
5. Teacher flows are daily classroom actions only.
6. Principal flows are attention/approval/snapshot first, not full admin.
7. Driver flows are assigned-trip only.
8. Staff flows are own-staff self-service only.
9. Preschool, Grade 1-10, and Grade 11-12 / +2 students do not get a broad Student App.
10. Student learning access for Preschool through +2 is lab-only or controlled school-device only.
11. Future Bachelor/Master Student App access is allowed only for active enrolled students and must be self-only, tenant-scoped, enrollment-scoped, module-entitlement-scoped, and backend-authorized.
12. Do not use admin-shaped endpoints for parent, teacher, principal, driver, staff, lab/student-session, or future Student App screens.
13. Every screen needs loading, empty, error, permission-denied, module-locked, offline, and success/pending states where applicable.
14. Protected files use authenticated download/share helpers only.
15. Passing Flutter unit tests or a debug APK build is not mobile GA proof; supported personas require seeded backend, emulator/device, deep-link, permission-denial, logout-cache-clearing, and protected-file evidence.

## Current Feature Roots

```text
lib/core/auth
lib/core/network
lib/core/storage
lib/core/permissions
lib/features/attendance
lib/features/auth
lib/features/dashboard
lib/features/learning
lib/features/notices
lib/features/parent
lib/features/profile
lib/features/staff
lib/features/transport
lib/shared/widgets
```

## Mobile Verification Commands

Run after mobile implementation changes, not for docs-only planning:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

Use the GA policy and production-readiness audit to record which local, emulator/device, staging, and controlled-pilot gates actually passed.

## Push Notification Configuration

The app registers FCM tokens only for authenticated parent, teacher, principal/admin, driver, and staff personas. Controlled student sessions do not register broad mobile push. Configure Firebase per build without committing provider secrets:

```text
--dart-define=SCHOOL_OS_FIREBASE_API_KEY=...
--dart-define=SCHOOL_OS_FIREBASE_APP_ID=...
--dart-define=SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID=...
--dart-define=SCHOOL_OS_FIREBASE_PROJECT_ID=...
--dart-define=SCHOOL_OS_FIREBASE_STORAGE_BUCKET=...   # optional
```

The backend also requires a verified configured push adapter (`PUSH_PROVIDER_MODE=configured-provider`, `PUSH_PROVIDER_ENABLED=true`, and `PUSH_PROVIDER_READY=true`). Missing app or backend provider configuration must remain visible as unavailable/not-ready; registration or local builds are not delivery proof.

## Parent Device QA Release Gate

Parent mobile is not release-ready until the following Android emulator or physical-device checklist is run against a live seeded backend and evidence is recorded:

```text
1. Log in as Parent A and verify only Parent A linked children appear.
2. Switch between linked children and verify every screen updates the selected child.
3. Attempt a direct/deep link to an unlinked child attendance/profile/fees/homework/transport route and confirm denial without private preview data.
4. Open Parent Home and verify the Today list ranks attendance, fees, homework, notices, transport, and latest teacher update by urgency.
5. Open attendance online, then offline, and verify the last-updated/offline state is visible.
6. Open homework online, then offline, and verify cached read-only homework appears or a friendly offline error appears.
7. Open fees and receipts; download and share a confirmed receipt PDF. When the backend reports a validated payment provider, initiate one network-only payment, verify external HTTPS checkout opens, then verify the signed callback reconciles exactly once and the confirmed receipt appears. Never initiate or queue a payment offline.
8. Open a notice with a File Registry attachment; download and share through the protected mobile endpoint.
9. Open a published report card PDF and verify unpublished report cards are hidden/blocked.
10. Open transport and verify only the linked child's route/trip-safe fields appear.
11. Verify module-locked, permission-denied, session-expired, and logout-cache-clearing states.
12. Record screenshots/log notes for pass/fail evidence before any pilot or release claim.
```

This checklist is required in addition to `flutter analyze`, `flutter test`, and debug/release build checks. Passing local Flutter tests alone is not parent mobile release evidence.
