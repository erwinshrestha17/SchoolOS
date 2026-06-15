# SchoolOS Mobile Master Guide

**Status:** App-local pointer and guardrail
**Updated:** 2026-06-15
**Authoritative mobile plan:** `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`

This file stays in the Flutter app so mobile contributors can find the active plan quickly. Detailed persona, API, offline, state, and feature structure decisions now live in the consolidated web/mobile product design and implementation plan.

## Required Read Order

1. `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
2. `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
3. `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`

## Mobile Product Rules

1. Keep Flutter feature-first under `lib/features/<feature>`.
2. Keep shared auth, network, storage, permissions, and errors under `lib/core`.
3. Use one Dio-backed API client.
4. Store mobile tokens only in secure storage.
5. Parent flows are own-child only.
6. Teacher flows are daily classroom actions only.
7. Driver flows are assigned-trip only.
8. Staff flows are own-staff self-service only.
9. Students do not get a broad MVP mobile app.
10. Student learning access is lab-only or controlled school-device only for MVP.
11. Do not power parent, driver, staff, or lab/student screens from admin-shaped endpoints.
12. Every screen needs loading, empty, error, permission-denied, offline, and success/pending states where applicable.

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
dart format .
flutter analyze
flutter test
```
