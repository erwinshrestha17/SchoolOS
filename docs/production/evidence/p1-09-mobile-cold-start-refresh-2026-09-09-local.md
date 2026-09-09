# P1-09 Mobile Cold-Start Refresh Evidence (Local)

- Date: 2026-09-09
- Environment: local Flutter toolchain and mocked network/session boundaries
- Result: **PASS for implementation and local automated verification**

## Implemented boundary

- An expired stored access JWT no longer causes immediate startup logout.
- `AuthNotifier` uses the stored refresh credential before `/auth/me`, validates the complete rotated pair, and saves refresh first/access last under the session credential coordinator.
- Account/logout epochs prevent a late refresh from overwriting a newer identity.
- A 401/403 or malformed refresh response clears credentials and private cache.
- Connectivity, timeout, rate-limit, and server failures are not treated as revocation; a valid tenant-scoped cached identity remains available for allowed offline reads.

## Verification

| Gate | Result |
| --- | --- |
| Flutter analyze | PASS — no issues |
| Focused auth/session concurrency tests | PASS — 59 tests |
| Full Flutter test suite | PASS — 796 tests |
| Android debug build | PASS — `app-debug.apk` |
| iOS device build without code signing | PASS — `Runner.app`, 24.8 MB |

The Android build emitted a forward-looking Flutter warning that `image_picker_android` and `shared_preferences_android` still apply the Kotlin Gradle Plugin; it did not fail this build and remains dependency-upgrade debt.

## Evidence boundary

This proves Dart behavior and local buildability. It does not prove Keychain/Keystore behavior, OS process death, biometric interaction, TLS pinning/certificate negotiation, or reconnect behavior on physical Android/iOS devices. Repeat expired-token cold start, offline launch, reconnect, rejected refresh, and account-switch cases on controlled-pilot devices against TLS staging before release approval.
