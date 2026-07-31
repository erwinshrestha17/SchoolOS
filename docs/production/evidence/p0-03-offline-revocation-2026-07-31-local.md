# P0-03 Assignment Revocation, Offline Enforcement, and Secure Cache Purge (2026-07-31, local)

Status: **PARTIAL (local development complete for this hardening slice; not staging / controlled-pilot / multi-device validated)**

## Implementation completed

- `TeacherScopeService.getScopeVersion` aggregates assignment/delegation `updatedAt` across all statuses so revocation bumps the mobile scope version.
- Attendance sync receipts with `REJECTED` + `UNASSIGNED_TEACHER` map to `PermissionException(TEACHER_SCOPE_DENIED)` on Flutter.
- Teacher attendance controller purges access-scoped private caches when authorization changes.
- Short-lived protected file URLs remain TTL-bounded; immediate revoke for already-issued provider URLs still requires proxy/token registry (not claimed).

## Commands

Focused API scope-version test and Flutter attendance/parent suites as recorded in the Wave 2 verification batch.

## Honest posture

Do not claim offline-during-revocation device proof or push-topic update evidence (P0-15).
