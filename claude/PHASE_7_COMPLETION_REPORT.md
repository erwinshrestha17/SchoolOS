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
- Web direct-edit wording is replaced with a correction request. The request captures status, check-in/out, leave type, note and reason. The review queue shows the original/requested values and times, reason, provisional impact, independent review controls, errors and queued-adjustment state. The attendance route/navigation accepts explicit correction approval grants. Queue caches are school/user scoped; denied reads hide previously loaded protected details. Dates/times use Nepal/BS presentation.

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

| Check                               | Result                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Repository typecheck                | Passed for core, API and Web                                                               |
| API lint                            | Passed with existing repository warnings; no errors                                        |
| Web lint                            | Passed, zero warnings                                                                      |
| API unit suite                      | 304 suites, 3,520 tests passed                                                             |
| API integration suite               | 30 suites, 484 tests passed; all four database environment variables explicitly configured |
| API e2e suite                       | 45 suites, 321 tests passed                                                                |
| Web tests                           | 729 passed                                                                                 |
| Core tests                          | 27 passed                                                                                  |
| Focused 7.7 PostgreSQL suite        | 13 passed, included above and rechecked after final projection changes                     |
| Focused payroll/day-rule regression | 3 suites, 40 tests passed after sharing the exact leave-overlap rule                       |
| Chromium correction workflow        | 4 passed with controlled API fixtures                                                      |
| OpenAPI contract                    | Passed: 1,205 paths, 1,390 operations, 500 schemas                                         |
| Database drift                      | No difference on all four isolated test databases                                          |
| Tracked-artifact gate               | Passed                                                                                     |
| Formatting and diff whitespace      | Passed                                                                                     |

Focused PostgreSQL cases cover open approval, fixed-period queueing, rejection/cancellation, self-approval, permission denial, cross-tenant IDs, ended sessions, revoked persisted grants, concurrent/double decisions, duplicate requests, stale snapshots, direct SQL update/delete, protected inserts/upserts, staff service, time-clock check-in/out, day projection, next-period boundary and a SQL writer racing payroll finalization. The leave regression suite verifies paid and unpaid leave attendance writes are blocked in fixed periods.

Chromium exercised the actual Web rendering at desktop and 768px widths, original/requested details, day impact, keyboard approval, queued state, self-review denial, reason-required rejection and removal of cached protected details after a denied refresh. Those API fixtures are synthetic UI evidence; PostgreSQL tests separately establish persistence and session/authorization behavior. The Impeccable mechanical scan reported no findings, and rendered screenshots were inspected.

The full integration run exposed three older finance teardown paths that attempted to delete immutable financial records introduced by prior Phase 7 migrations. Their teardown now uses the existing isolated, transaction-local ledger fixture helper. Production guards and test assertions were preserved.

### Boundaries retained

Queued adjustments are durable inputs for **7.9**. Their consumption, money calculation and idempotent posting belong to that later slice. No finalized payroll run is recalculated here. This slice does not close remaining P0 gates, establish statutory compliance, or prove staging/production readiness.

---

## 7.8 — Compensation & statutory configuration

**Completed locally on 3 October 2026, on `main`.**

**Baseline:** start `cb2dae4e`; end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

Payroll no longer contains hard-coded contribution or tax rates. Statutory deductions come from an approved, effective-dated policy version; staff are enrolled in SSF or PF through an effective-dated membership; the policy version used is recorded on every payroll run; one active salary structure per staff member is enforced by the database; Staff is the single source of bank details.

**No real Nepal rates were loaded or invented.** Everything in tests is labelled FIXTURE. Real rates need the owner-supplied statutory documents (decision D1).

### Existing implementation retained

- `NepalHrPolicyVersion` (kind `STATUTORY_SCHEME_TAX`) and its existing review lifecycle: draft, in review, reviewed, approved; separate reviewer and approver from the Platform authority domain; immutable history; no deletes. Reused instead of adding a parallel rate table.
- `PayrollLine.pfEmployee` / `pfEmployer` / `tds` columns and the run totals. SSF and PF amounts use the PF columns, remuneration tax uses `tds`.
- `SalaryStructure.pfEnabled` as the "this person contributes to a retirement scheme" switch, and `tdsEnabled` for tax withholding.
- StaffEmployment remains authoritative for who is employed in a period; the school authorization transaction, audit service and SoD rules are unchanged.

### Changes

- **Database** (`20261003140000_phase7_statutory_configuration`):
  - preflights that fail, and never edit data, on overlapping ACTIVE salary structures or an approved statutory policy that breaks the new rules;
  - `StatutoryScheme` enum and `StaffStatutoryMembership` table: one scheme at a time per staff (EXCLUDE), date/identifier/end-evidence CHECKs, no deletes, only scheme-neutral ending of an open membership, tenant-consistency trigger, and an approved-run lock on insert and end;
  - EXCLUDE on `SalaryStructure` preventing overlapping ACTIVE windows;
  - CHECK that an approved statutory version is NATIONAL, carries a source checksum, payload schema 1 and at least one scheme;
  - `PayrollRun.statutoryPolicyVersionId` with a trigger: the version must be an approved statutory version covering the period end, and is frozen once the run is APPROVED or later;
  - `PayrollLine.statutoryBreakdown` (per-scheme base and amount, no identifiers);
  - backfill of empty Staff bank fields from the latest ACTIVE structure (never overwrites).
- **Policy engine** (`statutory-policy.ts`, `statutory-policy-resolver.ts`): typed payload v1 with decimal-string rates, FLAT_RATE and MARGINAL_SLABS (tax only), bases BASIC / BASIC_PLUS_ALLOWANCES / GROSS, optional base cap and `requiresIdentifier`. CIT is rejected because no ledger payable mapping exists. The resolver uses the policy in force on the period end and refuses two approved lineages covering the same date (`STATUTORY_POLICY_AMBIGUOUS`) or an unusable payload (`STATUTORY_POLICY_INVALID`).
- **Payroll calculation** (`payroll.service.ts`): `calculatePayrollLine` takes the policy and the staff enrolment; the 10% / 1% constants and the earlier run-totals bug are gone. A missing policy, membership or identifier refuses generation with 409 `MISSING_STATUTORY_CONFIGURATION`, but only when someone actually owes a scheme. Regeneration uses the same path. The approval fingerprint for runs with a policy covers the policy id, per-line breakdowns and memberships; runs without one keep the original v1 fingerprint, so existing approvals are not invalidated.
- **Readiness**: new BLOCKING exception `MISSING_STATUTORY_CONFIGURATION` (no policy, unusable or ambiguous policy, scheme absent from the policy, missing membership, missing required identifier). Bank checks read Staff only.
- **Membership API** (`hr:tax:read` / `hr:tax:write`): list, create, and end a membership; the audit record carries `hasIdentifier`, never the identifier. `GET /payroll/statutory-policy?asOf=` shows the policy in force.
- **Bank details**: salary-structure create/update write bank fields to Staff; the structure column stays null.
- **Web**: a Statutory membership panel on the staff payroll tab (permission-gated, member number masked until revealed, one-scheme-at-a-time errors explained, no rates shown), API client methods, and clearer PF/TDS switch wording. Core types added. The demo seed leaves PF/TDS off, because no policy is loaded.

### Invariants established

- No rate exists outside an approved, source-checksummed, two-person-reviewed national policy version.
- A run records the exact policy version used; that link is frozen after approval, and a later policy change never touches earlier runs.
- A staff member belongs to at most one scheme at any date; membership history cannot be deleted or rewritten, and cannot change underneath an approved run.
- A staff member has at most one ACTIVE salary structure at any date.
- Identifiers are protected under `hr:tax:*` and never copied into audit logs or breakdowns.
- Money uses decimals throughout, rounded to 2 places.

### Edge cases resolved

Overlapping, adjacent and open-ended windows; blank and padded identifiers; cross-tenant staff and actors; ending a membership twice; back-dating under an approved run; two approved lineages for one date; a policy that starts after the period end; a policy that omits an owed scheme; policy changes mid-year (May uses v1, August uses v2, both stored on their runs); nobody owing a scheme (no policy needed).

### Defect found and fixed during the slice

National policy versions have no `tenantId`, and the tenant-scope layer adds `tenantId = <school>` to every query, so a real school request would have seen "no policy" even with one approved. Reads of national statutory versions now go through the explicit, documented `runWithoutTenantScope` bypass. The real-database test caught it; unit mocks could not have.

### Tests executed

| Check | Result |
| --- | --- |
| API typecheck / Web typecheck | Passed |
| API lint (full) / Web lint | Passed, no errors |
| API unit | 305 suites, 3,551 tests passed |
| API integration | 31 suites, 505 tests passed (includes 21 new in `statutory-configuration.int-spec.ts`) |
| API e2e | 45 suites, 321 tests passed (mock of the payroll+accounting e2e gained `payrollRun.findFirst`) |
| Web tests | 734 passed (5 new statutory-membership contract tests) |
| Core tests | 27 passed |
| OpenAPI contract | Passed: 1,208 paths, 1,394 operations, 502 schemas |
| Database drift | No difference |
| Formatting, tracked-artifact gate | Passed |

The new integration suite covers the database guards, membership service authorization and audit, salary-structure overlap, run creation with and without a policy, policy change mid-year, ambiguity, freeze and lock behavior, and readiness. It is re-runnable and removes its own fixtures.

### Failures

Resolved during the slice: a 22-test first run (fixture rules: reviewer evidence and same-tenant employment verifier); the tenant-scope defect above; three finance teardown failures that came only from my test environment (see Known limitations); lint; and one web typography contract (`font-mono`).

### Migrations

`20261003140000_phase7_statutory_configuration`, applied by migrate deploy on the five local test databases and the development database; drift check clean. The preflights fail rather than repair. Manual rollback notes are in the migration header. Not applied to any staging or production database.

### Known limitations

- **No real rates and no in-app approval flow.** A version can only be approved through the existing Platform reviewer/approver controls at database level. An operator loader (validate, then load and approve with two distinct Platform users) is the natural next step once the owner supplies the statutory documents. An approved version also requires a source URI or evidence file.
- CIT is unsupported; annualised tax, exemptions and rebates are not modelled; the policy is read as of period end, so a mid-period change takes effect the next period.
- Periods are still Gregorian months (BS calendar is 7.9). Negative-net handling stays with 7.9.
- `pfEnabled` is kept as the enrolment switch and still gates PF/SSF; a member without it is simply not charged.
- The demo seed turns PF/TDS off so demo payroll still generates.
- **Local test-environment note:** the finance suites (`student-fee-ledger-projection`, `fee-15-17-export-projection`, `ar-01-06-export-projection`) need `DATABASE_URL` and `SCHOOLOS_AUTH_TEST_DATABASE_URL` to point at the same database, otherwise teardown fails on the immutable-ledger guard.
- **Leftover local fixtures.** Failed intermediate runs left approved/reviewed fixture statutory policy rows (years 2031-2033) in the shared local test database `schoolos_auth_recovery_test` and in `schoolos_auth_recovery_test_stat78`. Deleting them was blocked by the session's safety check, so they remain. On those two databases the new suite reports `STATUTORY_POLICY_AMBIGUOUS`; a fresh, migrated database (CI) is unaffected. `schoolos_auth_recovery_test_stat78b` is clean and was used for the verification above; `schoolos_stat78_test` is an empty migrated scratch database.

### Blockers

None for 7.8 itself. Loading real statutory rates depends on the owner's documents (D1).

### Next slice

**7.9 — Payroll period, readiness and run:** BS calendar periods (D2), proration by employment ∩ period, negative-net blocking, consumption of the queued attendance adjustments from 7.7, holds (D8), bank advice export (D6).
