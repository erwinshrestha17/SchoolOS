# SchoolOS Mobile Master Guide

**Status:** App-local pointer and guardrail
**Updated:** 2026-07-01
**Authoritative product requirements:** `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
**Authoritative software and mobile requirements:** `docs/requirements/SCHOOLOS_SRS.md`
**Authoritative release policy:** `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`

This file stays in the Flutter app so mobile contributors can find app-local guardrails and the release target quickly. Product behavior belongs in the PRD, software and mobile requirements in the SRS, architecture/security boundaries in the SDD, and module ownership in the MDD. Mobile work is evaluated against the Production / General Availability (GA) release policy, not MVP completion language.

## Required Read Order

1. `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`
2. `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
3. `docs/requirements/SCHOOLOS_SRS.md`
4. `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
5. `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`
6. `apps/schoolos_mobile/AGENTS.md`

## Mobile Product Rules

1. Keep Flutter feature-first under `lib/features/<feature>`.
2. Keep shared auth, network, storage, permissions, and errors under `lib/core`.
3. Use one Dio-backed API client.
4. Parent flows are own-child only.
5. Teacher flows are daily classroom actions only.
6. Principal flows are attention/approval/snapshot first, not full admin.
7. Driver flows are assigned-trip only.
8. Staff flows are own-staff self-service only.
9. Grade 1-10 and Grade 11-12 / +2 students do not get a broad Student App.
10. Student learning access for Grade 1 through +2 is lab-only or controlled school-device only.
11. A broad Student App is not active scope.
12. Do not use admin-shaped endpoints for parent, teacher, principal, driver, staff, or lab/student-session screens.
13. Every screen needs loading, empty, error, permission-denied, module-locked, offline, and success/pending states where applicable.
14. Protected files use authenticated download/share helpers only.
15. Passing Flutter unit tests or a debug APK build is not mobile GA proof; supported personas require seeded backend, emulator/device, deep-link, permission-denial, logout-cache-clearing, and protected-file evidence.
16. First-release packaging follows the GA policy's mobile size gates, ships Android as an `.aab`, and never bundles student photos, PDFs, report cards, videos, or large illustrations.

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

Use the GA policy and attach current local, emulator/device, staging, and controlled-pilot evidence to CI runs, smoke outputs, staging records, or release artifacts.

## Production Build Configuration

Release packaging requires registered app identities and a deployed HTTPS API.
Configure Android using `android/key.properties.example` as the template for the
ignored `android/key.properties`; `storeFile` resolves from `android/`. Use the
registered application ID and upload keystore. Gradle checks the signing key and
rejects missing configuration and Android debug certificates for release tasks,
including aggregate builds. For iOS, copy
`ios/Flutter/ReleaseIdentity.xcconfig.example` to the ignored
`ReleaseIdentity.xcconfig`, then configure the registered bundle ID, Apple team,
and signing style. Apple certificates/provisioning remain required for a signed
archive. Template IDs are only for local QA.

Create a separate JSON Dart define file for each platform in the ignored
`.release/` directory (or secure CI file storage):

```json
{
  "SCHOOL_OS_ENV": "production",
  "SCHOOL_OS_API_BASE_URL": "https://<deployed-api-host>/api/v1",
  "SCHOOL_OS_FIREBASE_API_KEY": "<platform-client-api-key>",
  "SCHOOL_OS_FIREBASE_APP_ID": "<platform-firebase-app-id>",
  "SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID": "<project-number>",
  "SCHOOL_OS_FIREBASE_PROJECT_ID": "<project-id>"
}
```

These values are compiled into the client. Never include server credentials,
service-account keys, signing passwords, or private school records. The optional
`SCHOOL_OS_FIREBASE_STORAGE_BUCKET` is also supported. Android and iOS Firebase
app IDs must match their platform and messaging project number.

From the repository root, validate a platform and optionally build its store
artifact using the same checked file:

```bash
pnpm verify:mobile-release android /absolute/path/to/android-defines.json
pnpm verify:mobile-release android /absolute/path/to/android-defines.json --build
pnpm verify:mobile-release ios /absolute/path/to/ios-defines.json --build
```

Android builds an AAB; iOS builds a signed IPA. Additional Dart define overrides
are rejected. `ga:verify:wave0` and `ga:verify:wave1` require the respective files
through `SCHOOLOS_MOBILE_ANDROID_DEFINES_FILE` and
`SCHOOLOS_MOBILE_IOS_DEFINES_FILE`. Missing setup fails those configuration checks.
This preflight checks local configuration and Android key access; it does not
verify store registration, Apple provisioning, Firebase delivery, store-download
size, device QA, or pilot acceptance. Those remain the GA policy's evidence gates.

## Shared-Device Session Safety

Auth and API clients share a process-local session generation for each secure
credential store. Login, logout, restore, and biometric lock invalidate pending
work before awaiting network/storage. Private requests bind that generation at
creation and recheck it before attaching credentials, retrying, and returning
responses; old responses must not populate a later account's screens or cache.

Refresh is single-flight within one session only. A late 401 after rotation
reuses the current token once; a second 401 or rejected refresh fails closed.
Login/refresh/logout and public password-recovery endpoints never borrow a stored
bearer token or recursively trigger refresh. Network errors, timeouts, rate
limits, and server failures do not by themselves prove revoked credentials or
authorize clearing a session.
Refresh calls have bounded timeouts. Refresh and account replacement/logout
storage operations are serialized, with access tokens written last.

Delayed login/profile/biometric results cannot replace, unlock, re-enable
biometrics, or sign out a newer session. These are local deterministic regression
guarantees, not proof of server/provider revocation during offline logout or
process termination. Shared-device staging and physical-device tests remain
required, including token rotation, interrupted secure-storage writes, revoked
server sessions, weak connectivity, and app restart.

## Password Recovery

The sign-in recovery link uses the existing public backend endpoints
`POST /auth/password-recovery/request` and `POST /auth/password-recovery/confirm`.
School code and account email are required; the user enters the emailed numeric
code, a new password, and confirmation. The app does not infer account existence
or email delivery from the request acknowledgement. Password-change success is
shown only after the backend confirms it, followed by explicit sign-in; there is
no automatic login. A locally biometric-locked session is cleared after success
only if it has not been replaced by another session.

Recovery is online-only and is never queued or automatically retried. Failed
requests preserve entered fields and offer manual recovery. A confirmation
timeout has an unknown outcome: try the new password at sign-in or request a new
code. A resend replaces the previous code, and changing the target account clears
code/password fields. Passwords preserve whitespace through reset and login;
client validation is guidance, not authority over backend policy.
Password-manager saving is offered only after authoritative confirmation;
leaving an unconfirmed reset cancels its autofill context.

Before pilot acceptance, validate actual email delivery with approved synthetic
accounts for Parent, Teacher, and Principal; expired/incorrect/superseded codes;
backend password rejection; network interruption before/after confirmation;
biometric-lock recovery; and old-session revocation on real devices. Local mocked
API/widget tests do not prove provider delivery, server concurrency, or physical
device behavior. Production app identities and API hostname remain owner-gated.

## Push Notification Configuration

Push and the personal inbox are M12 Notifications and Delivery. Authored school
notices are M15 Notices and Announcements and delegate delivery to M12. Chat or
conversation routes are not active mobile capability; historical message-type
notifications open the personal inbox instead of a chat surface.

The app registers FCM tokens only for authenticated parent, teacher, principal/admin, driver, and staff personas. Controlled student sessions do not register broad mobile push. Configure Firebase per build without committing provider secrets:

```text
--dart-define=SCHOOL_OS_FIREBASE_API_KEY=...
--dart-define=SCHOOL_OS_FIREBASE_APP_ID=...
--dart-define=SCHOOL_OS_FIREBASE_MESSAGING_SENDER_ID=...
--dart-define=SCHOOL_OS_FIREBASE_PROJECT_ID=...
--dart-define=SCHOOL_OS_FIREBASE_STORAGE_BUCKET=...   # optional
```

The backend also requires a verified configured push adapter (`PUSH_PROVIDER_MODE=configured-provider`, `PUSH_PROVIDER_ENABLED=true`, and `PUSH_PROVIDER_READY=true`). Missing app or backend provider configuration must remain visible as unavailable/not-ready; registration or local builds are not delivery proof.

Push lifecycle follows the full auth state, including restored sessions and the
`authenticated → loading → unauthenticated` logout sequence. Loading, biometric
lock, password-change gates, unsupported personas, and incomplete tenant identity
retire device listeners and cancel pending registration. Async setup, token
refresh, and navigation are session-fenced; a delayed guardian-scope lookup cannot
navigate a later account. Native token creation/deletion is ordered so old cleanup
cannot delete the next account's token. Returning to the foreground rechecks
permission/provider readiness; a failed setup is retryable without signing out.
Concurrent registration and logout share one secure-storage installation-ID
operation, including on a fresh install. Failed storage writes never return an
unpersisted identity and can be retried.

Device token deletion is best-effort; server logout revocation remains
authoritative, and cancelling a request is not proof that the server rolled it
back. Local delayed-response regression tests are not FCM delivery evidence.
Before pilot acceptance, verify shared-device logout/account switching, token
rotation, terminated-app taps, permission changes, offline logout/reconnect, and
revoked guardian/teacher scope against the configured provider on real devices.

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

### Local Parent offline regression evidence — 2026-09-08

Linked-child refresh now retains exact child-scoped attendance month keys,
homework page-size keys, and current dashboard snapshot keys. It continues to
purge unlinked-child, malformed, and obsolete snapshot keys; matching a child ID
suffix is not sufficient authorization. Attendance without a usable saved copy
distinguishes offline, timeout, permission, module, and session failures.

Verification: `flutter analyze` passed; all 760 Flutter tests passed; Android debug
APK and unsigned iOS builds passed. On the dedicated Android emulator against an
isolated synthetic backend, Parent A opened attendance online and then disabled
Wi-Fi and cellular data. The calendar remained visible with “Offline copy” and
“Last saved”; corrections required reconnection. Connectivity was restored after
the check. This fixture had no marked attendance days, so this does not prove
nonempty history, correction submission, physical-device behavior, other persona
flows, provider delivery, staging, or pilot acceptance.

Production application IDs, Apple team ID, and API hostname are not registered
(owner confirmation). Signing and deployment identity remain release blockers;
local template identifiers and unsigned builds are not distribution readiness.

### Teacher and Principal summary truth — 2026-09-08

Teacher Profile shows an unknown unread count while loading or after failure;
only a valid nonnegative integer from the notification endpoint renders a count.
Malformed responses fail explicitly instead of becoming zero. Principal Today
attention counts and Student Lookup recent-admissions counts likewise show
unavailable when absent or invalid, preserving genuine authoritative zeroes.

The combined mobile changes passed analysis, all 783 Flutter tests, and Android
debug compilation. Regression coverage includes delayed/error Teacher responses,
valid zero and positive counts, malformed payloads, and missing/invalid Principal
counts. These are local repository/widget checks, not live Teacher/Principal
workflow or pilot acceptance evidence.

### Local Teacher offline attendance rehearsal — 2026-09-08

Using the Android emulator QA skill, the updated debug app restored the synthetic
Parent session, signed out through the confirmation sheet, and signed in as the
Class 1A Teacher against the isolated synthetic backend. Only the assigned
two-student homeroom roster appeared. With Wi-Fi and cellular disabled, an absent
mark remained “Draft not submitted”; explicit queueing changed it to “Queued —
not submitted”. Reconnection submitted the queued operation and made attendance
read-only, retaining one absent and one present student. A read-only database
check confirmed a submitted session with a source operation ID, those two records,
and one `ACCEPTED` sync submission with one attempt. This is local emulator
workflow evidence, not physical-device, multi-device conflict, or pilot evidence.

### Local Principal entitlement and attention rehearsal — 2026-09-08

On the same isolated Android/backend fixture, Teacher sign-out followed by
Principal sign-in initially returned the correct entitlement denial: the standard
rehearsal tenant did not include `feature.mobile.full_role`. A QA-only tenant
override enabled that feature without changing production plans or deferred
modules. Principal Today and Attention then loaded, showing the remaining unmarked
Class 1B while the submitted Class 1A no longer appeared as unmarked. HR and Fees
cards remained locked. Approvals rendered its empty pending queue. This verifies
the entitlement boundary and synthetic read flows only; approval decisions require
a pending workflow fixture and remain unverified by this emulator rehearsal.

### Parent correction to Principal review gap — 2026-09-08

A synthetic Parent attendance correction was created through the existing mobile
API for the submitted absent record. Principal Approvals displayed it, but Review
opened a read-only sheet: source attendance corrections are not generic approval
workflow records. Mobile must use the existing attendance detail/review contract
with current scope, exact student/date/status comparison, required reason, online
authority, and an authoritative result. Do not route its ID to generic approval
decisions or claim that this workflow is complete.

Before enabling that UI, the attendance review service was changed to conditionally
claim a pending request inside the same transaction as attendance changes and the
audit. Competing claims fail with conflict. API build/typecheck and 142 focused
attendance tests passed, including lost-claim and audit-failure regressions for
approval and rejection. These test doubles verify control flow and transaction
usage, not PostgreSQL concurrency or rollback; direct database proof and the
mobile decision UI remain required.

The full API unit suite also passed (2,964 tests / 271 suites). Whole-file
attendance lint remains failing: current files report 20 errors / 93 warnings;
the same HEAD files report 21 errors / 93 warnings. This is not a clean lint or
production gate, and the rehearsal server has not yet been restarted onto this
backend patch.
