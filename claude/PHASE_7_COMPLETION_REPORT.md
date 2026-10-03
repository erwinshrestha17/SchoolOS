# Phase 7 Completion Report

## 7.7 — Staff attendance corrections

**Completed locally on 3 October 2026, on `main`.** This checkout did not contain an earlier completion report; this file records 7.7 only.

### Delivered behavior

- `StaffAttendanceCorrection` retains the original and requested status, check-in/out, leave type and note, together with the attendance date, original revision timestamp, reason, requester, independent approver and decision time.
- Requests move from `PENDING` to `APPROVED`, `REJECTED`, `CANCELLED` or `PENDING_PAYROLL_ADJUSTMENT`. Database checks enforce independent approval, complete decisions and a nonblank bounded reason. A partial unique index permits one pending request or queued adjustment per staff/date. Correction snapshots and decided history cannot be overwritten or deleted.
- Request, approval, rejection and cancellation use the existing school authorization transaction: active school/user, persisted session family and live tenant-scoped permission grants are checked inside the transaction. Decisions use compare-and-set and audit in the same transaction. Approval rejects changed attendance snapshots.
- As explicitly requested for this slice, open-period approval updates the attendance row and retains its original values on the appended correction record. Fixed-period approval queues an adjustment and leaves attendance and the payroll run unchanged. Rejection/cancellation do not change attendance.
- Payroll runs in `APPROVED`, `FINALIZED`, `POSTED` or `PAID`, or with historical `finalizedAt`, protect their attendance inputs. The approval boundary follows the existing leave/payroll integrity policy. The trigger protects INSERT, UPDATE and DELETE across bulk marking, staff service, time-clock and leave writers, including direct SQL. No correction exemption can modify fixed-period attendance.
- A tenant advisory lock serializes payroll transitions, attendance writes and correction decisions. The guard reads a fresh payroll snapshot after waiting, handles timestamped inclusive period ends, and binds open-period correction opt-in to its exact original snapshot.
- Bulk re-marking remains available for an existing uncorrected row on the current Nepal school day. Historical or previously corrected rows require a correction request. Time-clock and staff-service dates now use the shared Nepal school-day helper instead of host-local midnight.
- `hr:attendance-corrections:approve` is a separate default-deny permission. No role receives it automatically; `hr:manage` does not imply it. Reasons and impact are restricted to correction request/review authority. The review API requires the approval permission; payroll impact also requires both HR and payroll entitlements.
- The payroll-impact endpoint returns only provisional paid/unpaid-day deltas. It shares the existing payroll day-count calculation, including approved paid/unpaid leave and verified employment caps. It reports its working-day assumption explicitly (default 30); it does not calculate money or certify statutory payroll.
- Shared core types, validated DTOs, documented responses and six correction API operations are included. The OpenAPI gate now requires those operations.
- Web direct-edit wording is replaced with a correction request. The request captures status, check-in/out, leave type, note and reason. The review queue shows the original/requested values and times, reason, provisional impact, independent review controls, errors and queued-adjustment state. The attendance route/navigation accepts explicit correction approval grants. Dates/times use Nepal/BS presentation.

### Migrations and database verification

- `20261003110000_phase7_staff_attendance_corrections`: schema, checks, partial unique index, history/tenant guards, payroll locking and non-repairing preflights.
- `20261003113000_phase7_attendance_guard_concurrency`: fresh-snapshot payroll guard, calendar-period boundary and correction replay protection.
- Both were applied using migration deploy, and schema drift passed, on all four explicitly isolated test databases:
  - `schoolos_auth_recovery_test_p77`
  - `schoolos_admission_atomic_test`
  - `schoolos_marks_test`
  - `schoolos_timetable_test`
- Three additional disposable replay/drift/e2e databases also replayed the migrations. These checks do not represent a production database migration.

### Verification results

| Check | Result |
| --- | --- |
| Repository typecheck | Passed for core, API and Web |
| API lint | Passed with existing repository warnings; no errors |
| Web lint | Passed, zero warnings |
| API unit suite | 304 suites, 3,520 tests passed |
| API integration suite | 30 suites, 484 tests passed; all four database environment variables explicitly configured |
| API e2e suite | 45 suites, 321 tests passed |
| Web tests | 729 passed |
| Core tests | 27 passed |
| Focused 7.7 PostgreSQL suite | 13 passed, included above |
| Chromium correction workflow | 3 passed with controlled API fixtures |
| OpenAPI contract | Passed: 1,205 paths, 1,390 operations, 500 schemas |
| Database drift | No difference on all four isolated test databases |
| Tracked-artifact gate | Passed |
| Formatting and diff whitespace | Passed |

Focused PostgreSQL cases cover open approval, fixed-period queueing, rejection/cancellation, self-approval, permission denial, cross-tenant IDs, ended sessions, revoked persisted grants, concurrent/double decisions, duplicate requests, stale snapshots, direct SQL update/delete, protected inserts/upserts, staff service, time-clock check-in/out, day projection, next-period boundary and a SQL writer racing payroll finalization. The leave regression suite verifies paid and unpaid leave attendance writes are blocked in fixed periods.

Chromium exercised the actual Web rendering at desktop and 768px widths, original/requested details, day impact, keyboard approval, queued state, self-review denial and reason-required rejection. Those API fixtures are synthetic UI evidence; PostgreSQL tests separately establish persistence and session/authorization behavior. The Impeccable mechanical scan reported no findings, and rendered screenshots were inspected.

The full integration run exposed three older finance teardown paths that attempted to delete immutable financial records introduced by prior Phase 7 migrations. Their teardown now uses the existing isolated, transaction-local ledger fixture helper. Production guards and test assertions were preserved.

### Boundaries retained

Queued adjustments are durable inputs for **7.9**. Their consumption, money calculation and idempotent posting belong to that later slice. No finalized payroll run is recalculated here. This slice does not close remaining P0 gates, establish statutory compliance, or prove staging/production readiness.
