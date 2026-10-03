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

| Check                             | Result                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| API typecheck / Web typecheck     | Passed                                                                                         |
| API lint (full) / Web lint        | Passed, no errors                                                                              |
| API unit                          | 305 suites, 3,551 tests passed                                                                 |
| API integration                   | 31 suites, 505 tests passed (includes 21 new in `statutory-configuration.int-spec.ts`)         |
| API e2e                           | 45 suites, 321 tests passed (mock of the payroll+accounting e2e gained `payrollRun.findFirst`) |
| Web tests                         | 734 passed (5 new statutory-membership contract tests)                                         |
| Core tests                        | 27 passed                                                                                      |
| OpenAPI contract                  | Passed: 1,208 paths, 1,394 operations, 502 schemas                                             |
| Database drift                    | No difference                                                                                  |
| Formatting, tracked-artifact gate | Passed                                                                                         |

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

---

## 7.9 — Payroll period, readiness and run

**Completed locally on 3 October 2026, on `main`. Not pushed.**

**Baseline:** start `2cb5599c` (7.8); end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

A payroll period is now one Bikram Sambat month. Pay is prorated deterministically from verified employment, the salary structure or contract that covered each day, attendance and approved leave. The queued attendance corrections from 7.7 are priced and consumed once. A negative net can no longer be hidden. Payment can be withheld per person. Bank-paid staff can be exported to a generic payment-advice file. Readiness reports every condition that would make the run wrong.

**No Nepal rates, allowance rules or bank formats were invented.** The bank advice is a generic CSV.

### Existing implementation retained

- The run lifecycle, SoD rules, approval fingerprint, accounting posting and reversal, payslips, the 7.8 statutory policy engine and memberships, the 7.7 correction queue, `payroll-day-policy` day counting, and the school authorization transaction.
- `StaffEmployment` stays the authority for who is employed. Staff stays the single source of bank details.
- Older runs are never reinterpreted: their stored period bounds, divisor and fingerprint version stay authoritative.

### Changes

- **Period model** (`packages/core/src/payroll-period.ts`, `payroll/payroll-period.ts`)
  - `periodYear`/`periodMonth` on a run are the BS year and month (BS years from 2075 to the end of the supported calendar).
  - Bounds come from the core BS calendar (start 00:00:00.000Z, end 23:59:59.999Z of the Gregorian dates). Example: Kartik 2083 = 2026-10-18..2026-11-16 (30 days).
  - Years before 2075 are legacy Gregorian labels. They keep their stored bounds and show as `2026-05`.
  - Create, preview and regenerate take the BS year and month.
  - `workingDays` is now an optional divisor override (1 to 32). Default: the calendar days of the BS month (`CALENDAR_DAYS_OF_PERIOD`). An override is recorded as `OPERATOR_SUPPLIED`. Both are persisted on the run.
- **Proration** (`payroll-proration.ts`, `payroll-line-calculation.ts`, `payroll-period-calculation.ts`)
  - Paisa `bigint` money and centi-day `bigint` days, rounded half-up once.
  - Each employed day is assigned to the covering compensation source with the latest start. Salary structures win; a contract is used only when no structure covers the day.
  - Employed days with no compensation refuse generation (`PRORATION_INPUT_UNRESOLVED`, days listed). Nothing is silently dropped or zeroed.
  - Paid days are allocated across segments by employed days. The last segment takes the remainder, so allocations always sum exactly. Fixed deductions are prorated by employed days over period days.
  - A per-day ledger is persisted in `PayrollLine.prorationBreakdown`. The API returns only the summary (period, divisor, day counts, segments). The ledger stays server-side because it is attendance detail.
  - Preview and generation use one calculation path, so they cannot disagree.
- **Attendance adjustments** (`payroll-adjustments.ts`)
  - A `PENDING_PAYROLL_ADJUSTMENT` correction is priced against the source run line's persisted ledger, using the same day rules and that segment's monthly gross over its divisor.
  - It is consumed once through `PayrollAdjustment` (partial unique index on the correction). Arrears add to gross, recoveries to deductions.
  - It is released when the run is regenerated, voided or cancelled (database trigger), and frozen once the target run is approved or finalized (`PAYROLL_ADJUSTMENT_RUN_LOCKED`).
  - An unpriceable correction is a readiness WARNING. An applied adjustment that disagrees with its line is BLOCKING.
- **Negative net**
  - The line carries the true net. It is never clamped or floored.
  - Readiness raises BLOCKING `NEGATIVE_NET_PAY` (blocks create, submit, approve, post, mark paid).
  - The database trigger `PAYROLL_NEGATIVE_NET` refuses a run entering VALIDATED through PAID while any line is negative.
- **Holds** (`payroll-hold.service.ts`)
  - Payment-side only. The run, its totals and its accounting are untouched. One ACTIVE hold per (run, staff).
  - Allowed while the run is GENERATED through POSTED. Place needs `payroll:hold:create`. Release needs `payroll:hold:release` and a different user than the placer (service check and database CHECK).
  - Reasons are required. History is append-only (guard trigger, no delete).
  - Placing a hold takes a share lock on the run row. The database refuses a run moving to PAID with an active hold, and mark-paid re-checks after claiming the run row, so a hold and a mark-paid cannot race.
  - Holds are not part of the approval fingerprint (they are payment state, not payroll content).
- **Bank advice** (`payroll-bank-advice.service.ts`, `payroll-bank-details.ts`)
  - Generic CSV for runs in FINALIZED or POSTED. It contains only lines whose structure payment method is BANK, net > 0 and not held.
  - Bank details come from Staff only. Missing or invalid details refuse the export with masked, machine-readable issues (`INVALID_BANK_DETAILS`). Nothing is partially exported.
  - The run's current source fingerprint must equal the approved one.
  - Every export is an append-only `PayrollBankAdviceExport` row: sequence, sha256, fingerprint, counts, total. A re-export needs a reason. Exports of one run are serialized by a tenant-anchored row lock.
  - Cells are formula-injection safe. The audit record holds counts and hashes only, never account numbers.
  - The export is a CSRF-protected POST that returns the sequence and hash in response headers.
- **Readiness** (`payroll-readiness.service.ts`): new BLOCKING codes `NEGATIVE_NET_PAY`, `PRORATION_INPUT_UNRESOLVED`, `INVALID_PAYROLL_PERIOD`, and an inconsistent-adjustment blocker. WARNING `PAYROLL_ADJUSTMENT_UNRESOLVED`. Overlapping live runs are refused with `PAYROLL_PERIOD_OVERLAP`.
- **Fingerprint**: runs with a divisor use fingerprint v3, which also pins the period bounds, divisor and basis, proration lineage, adjustment columns and applied adjustments. v1 and v2 are preserved for existing runs.
- **Authorization**
  - New permissions: `payroll:hold:create` (finance_write), `payroll:hold:release` (finance_critical), `payroll:bank-advice:export` (protected_export).
  - Role templates `payroll_preparer` v3 and `payroll_approver` v3.
  - Domain checks (`requireDomainPermission`, `requireIndependentActor`, `withSchoolAuthorizationTransaction`) apply on every new route. The run projection carries `canHold`, `canReleaseHold` and `canExportBankAdvice`, which surface as the canonical `HOLD`, `RELEASE_HOLD` and `EXPORT_BANK_ADVICE` actions.
- **Other correctness fixes found while integrating**
  - `staff_attendance_payroll_locked` compared dates with an off-by-one at the period end. Fixed.
  - Leave approval's finalized-payroll guard and the correction projection now use the run's stored bounds (BS-aware), not a Gregorian month.
  - Salary slips and Staff 360 show the BS period label.
- **API surface (+5 operations):** `GET|POST /payroll/runs/:id/holds`, `POST /payroll/runs/:id/holds/:holdId/release`, `GET /payroll/runs/:id/bank-advice`, `POST /payroll/runs/:id/bank-advice/export`. The OpenAPI gate requires all five.
- **Web (minimal)**
  - BS year and month selectors with an optional divisor override (empty means auto) on Payroll Runs and Payroll Preview.
  - BS period label and Gregorian range on the run list and detail. BS labels also replace `m/yyyy` on HR overview, payslips, staff payroll history, my payslips and the payroll reports filters (the reports default year is now the BS year; a Gregorian default would have hidden every new run).
  - Per-line "How this was calculated" (period, divisor and basis, employed, paid and unpaid days, segments), consumed-adjustment amounts, a Negative net badge, and a Payment on hold badge. Preview and run detail both flag a negative net, and Save as Draft is disabled while any preview line is negative.
  - A holds and bank-advice panel: place a hold, release a hold (reason required), export, and re-export (reason required). Controls follow the server's authorization projection.
  - Readiness shows plain-language guidance for each new blocker code.

### Invariants established

- A payroll period is exactly one BS month; two live runs cannot overlap (database EXCLUDE); bounds are validated by CHECK.
- Pay for a line is a pure function of its persisted inputs (period, divisor, employment, compensation segments, attendance and leave ledger). Rounding happens once, so totals reproduce exactly.
- No employed day is paid at an invented rate or dropped: either a compensation source covers it or generation refuses.
- A correction is consumed by at most one run, and never changes an approved or finalized one.
- No run containing a negative net can enter or stay in an approvable state, however it is reached.
- A payment cannot be marked paid while a hold is active; a hold cannot be released by the user who placed it; hold history cannot be rewritten.
- A bank file is only produced from an approved, unchanged run, contains no held or non-positive line, and every export is recorded.

### Edge cases resolved

BS months of 29, 30, 31 and 32 days; a period that straddles a Gregorian month and year boundary; legacy Gregorian runs next to BS runs; employment starting or ending mid-period; a salary-structure change mid-period (two segments, remainder allocation); contract-only staff; employed days with no compensation; attendance and leave on the same date (counted once); half-day leave; operator divisor override; an adjustment for a past period priced from that run's own ledger; an adjustment consumed, then the target run regenerated, voided or cancelled; an adjustment whose target run is already approved; a negative net reached through deductions, recoveries or fixed deductions; a second hold on an already held line; releasing your own hold; a hold racing mark-paid; export with no eligible line; export with one invalid account; re-export without a reason; fingerprint drift between approval and export; formula-injection strings in names and references; cross-tenant ids on every new route.

### Tests executed

All run on a freshly created and migrated PostgreSQL 16 database. The finance integration suites need `DATABASE_URL` equal to `SCHOOLOS_AUTH_TEST_DATABASE_URL`, and a name matching `schoolos_auth_recovery_test*`.

| Check                                                                                                       | Result                                                                              |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Core tests                                                                                                  | 32 passed (new `payroll-period.test.mjs`)                                           |
| API unit                                                                                                    | 311 suites, **3,620 passed**                                                        |
| API integration (fresh DB, all four DB variables set)                                                       | 32 suites, **532 passed** (new `payroll-periods-holds-bank-advice.int-spec.ts`: 27) |
| API e2e                                                                                                     | 45 suites, **321 passed**                                                           |
| Web tests                                                                                                   | 745 passed (new `payroll-phase79-contract.test.mjs`)                                |
| API / Web typecheck, API lint on changed files (errors), Web lint (`--max-warnings=0`), `pnpm format:check` | clean                                                                               |
| `pnpm db:validate`, `pnpm verify:openapi`, `pnpm verify:tracked-artifacts`                                  | pass (1,212 paths, 1,399 operations, 505 schemas)                                   |
| `prisma migrate deploy` on a fresh DB, then `prisma migrate diff --exit-code`                               | applied; no difference                                                              |
| `pnpm --filter @schoolos/web build`                                                                         | pass                                                                                |

The new integration suite covers the database guards directly (period bounds and overlap, divisor, negative-net trigger, hold uniqueness and separation of duties, hold history, run-to-PAID refusal, adjustment consumption and release, bank export log), proration across structure changes and employment windows, adjustment consumption, readiness, hold and bank-advice authorization and audit content, and cross-tenant refusal.

### Failures

Resolved during the slice:

- A readiness spec used a Gregorian period (now a BS month); several mocks needed the new run fields.
- The statutory integration suite used far-future Gregorian months (now BS months).
- A Phase 2 template-upgrade test compared against the live template instead of the frozen v1 baseline.
- Two older integration tests inserted runs without period bounds, which are now NOT NULL by design.
- Two unit gates: the legacy-mock fingerprint path, and the raw-SQL inventory (the one tenant-anchored `FOR UPDATE` in bank advice is now listed).
- A first integration attempt used a database name the auth-isolation guard rejects.
- Prettier and ESLint findings in new code.

Pre-existing: none new.

Not verified: the full-repo API ESLint run was killed by the container's memory limit, so ESLint was run on every changed and new API file instead (no errors). `flutter analyze` and `flutter test` were not run (no Flutter SDK; the mobile app is unchanged). The new Web screens are covered by type checks, source-contract tests and a production build; they were not driven in a browser.

### Migrations

`20261003170000_phase7_payroll_periods_holds_bank_advice`, applied by `migrate deploy` on a fresh database and on the marks, timetable and admission test databases; drift clean. Not applied to any staging or production database.

- **Preflights (fail, never repair):** payroll runs with an impossible period (month or year out of range, start after end), and overlapping live (non-VOID/CANCELLED) runs of one tenant.
- **Backfill:** existing runs with no bounds get the Gregorian calendar month they were generated with. No label is rewritten. `periodStart` and `periodEnd` become NOT NULL.
- **Adds:** period bounds CHECK and overlap EXCLUDE, divisor CHECK, line-adjustment CHECK, `PayrollAdjustment`, `PayrollHold`, `PayrollBankAdviceExport` (guards, unique indexes), negative-net and active-hold triggers, and the corrected attendance payroll-lock function.
- **Rollback (manual):** drop the new tables, triggers and functions, the CHECKs and the EXCLUDE; make `periodStart`/`periodEnd` nullable; restore the previous `staff_attendance_payroll_locked`. Nothing destructive was done to existing rows. The NULL-bound backfill is not reversed.
- **Operational impact:** `workingDays` no longer defaults to 30. New runs must be BS months. Operators who relied on a fixed 30-day divisor must now supply it as an override. The negative-net trigger acts on status transitions, so an existing run already past VALIDATED is not re-checked.

### Known limitations and policy dependencies

- **Arrears and statutory bases (D1).** Attendance arrears are added to gross but PF/SSF/tax bases see only the period's regular pay. Whether arrears are contribution-bearing needs an authoritative policy ruling.
- **Real statutory rates are still not loaded**, and no in-app approval flow exists (unchanged from 7.8). CIT, annualised tax and exemptions remain out of scope.
- **Generic bank file only.** Each bank's own format needs the bank's specification. The file carries bank account details and is confidential; only the sequence, hash and counts are logged.
- **A hold withholds payment for the run only.** Rolling a held amount into a later run is not automated; there is no hold-aging or notification.
- **Supported calendar range:** BS 2075 to the end of the core calendar table (2090).
- Adjustment pricing needs the source run's persisted ledger. Corrections for runs created before 7.9 have none and are raised as a warning for manual handling.
- The per-day ledger is not exposed through the API; reviewers see the summary and segments. The consumed adjustments are shown as amounts per line, not itemised.
- Web: holds are placed from a panel (staff chosen from the run's lines), not from each line. No hold list screen across runs. No browser test of the new screens.
- Leftover local fixtures from 7.8 still sit in two older local databases (see 7.8). The 7.9 verification used new databases and is unaffected.

### Blockers

None for 7.9. Loading real rates and a ruling on arrears depend on the owner's statutory documents (D1).

### Next slice

**7.10 — Teacher eligibility workspace** (7L), per the plan: employment, required evidence, policy version, outcome, reason codes, current assignments and blocking changes, reusing the Phase 5 projection. No eligibility override in Phase 7 unless the owner decides otherwise (D4).

Carried forward from earlier slices and still open: aligning the database teacher-eligibility function with a recorded employment end date (7.1), ending `StaffEmployment` when a staff member is terminated (7.1), and the remaining Staff 360 UI (7.2). Payroll report screens now use BS labels; the report queries themselves still filter by the run's period label.

## 7.10 — Teacher eligibility workspace

**Completed locally on 3 October 2026, on `main`. Not pushed.**

**Baseline:** start `9e4b5bc2` (7.9); end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

HR can now see, for every teacher, whether they may be assigned to teach today and what is about to change. The answer comes from one decision procedure that the assignment preflight, the exceptions report, the database function and the new workspace all share. There is **no eligibility override** in Phase 7 (decision D4/O1).

### Existing implementation retained

- The policy model, the append-only employment, profile, evidence and assessment history, the assignment preflight and its snapshots, the school authorization transaction, and the 5J–5M professional-identity panel.
- A Teacher role is still not evidence. Nothing in this slice grants, revokes or overrides eligibility.

### Changes

- **One decision procedure** (`teacher-scope/teacher-eligibility-decision.ts`, pure, 46 unit tests)
  - Fixed refusal order: staff inactive, employment, profile, class, subject, catalogue limit, policy unavailable, policy conflict, evidence.
  - `evaluate()` (preflight) is now `loadFacts` plus this procedure. `evaluateMany` runs a whole population in a fixed number of queries. A test proves batch and single results are identical.
  - The exceptions report now uses `evaluateMany` (same response shape).
- **Ended employment keeps its window** (migration `20261003190000_phase7_eligibility_employment_window`)
  - Authoritative employment is `status IN (VERIFIED, ENDED)` with `verifiedAt` set, over the half-open window `[effectiveFrom, effectiveTo)`. The service, the SQL function `schoolos_teacher_eligibility_live` and the assessment guard trigger use the same predicate.
  - Before this, ending an employment made the function treat the whole window as not employed, including days already worked.
- **Termination ends employment** (7.1 carry-over, O2). `StaffService.terminateStaff` now ends every open employment in the same transaction through `endEmploymentsForTermination`. A termination date before an employment start is refused (`TERMINATION_BEFORE_EMPLOYMENT_START`). Reviewing an employment still needs an independent reviewer when something is open.
- **Workspace and summary endpoints** (read-only, `hr:read`)
  - `GET /hr/professional/eligibility-workspace` and `GET /hr/staff/:staffId/professional/eligibility-summary`.
  - States: ELIGIBLE, NEEDS_REVIEW, INELIGIBLE, plus an `atRisk` flag. The stored outcome stays ELIGIBLE or INELIGIBLE. NEEDS_REVIEW means a policy conflict, missing policy or catalogue limit, or that every unmet requirement is PENDING_REVIEW.
  - Evidence statuses: MATCHED, PENDING_REVIEW, NOT_YET_VALID, EXPIRED, REVOKED, MISSING.
  - Blocking changes inside a horizon of 1 to 180 days (default 30, O4): employment ending, profile ending, evidence expiring, policy ending, and a future policy revision of the same lineage or of equal or higher scope.
  - Filters (state, at-risk, search), pagination, totals computed before filtering.
- **Decisions run under live authorization.** Employment review, end, profile create and deactivate, and evidence review and revoke now use `withSchoolAuthorizationTransaction` with an `hr:manage` re-check (revoked session or grant is refused). Concurrent verification of the same evidence has exactly one winner (`EVIDENCE_NOT_PENDING`).
- **Evidence references are redacted** (O3) for users without `hr:documents:read`: `documentId`, `sourceUri` and licence `externalReference`, in the workspace summary and in the existing professional overview. The response says so (`referencesRedacted`).
- **Web.** New HR tab "Teacher Eligibility" (`/dashboard/hr/teacher-eligibility`, gated on `hr:read`): summary buttons, search, horizon and state filters, paginated table, and a drawer with blocking changes, per-assignment requirements, an evidence checklist and recent decisions. Dates are Bikram Sambat first. Links added from the exceptions card and the staff professional panel. The page is read-only and says so.
- **API surface (+2 operations):** the OpenAPI gate requires both.

### Operational impacts

- The database function and assessment guard changed meaning: a teacher whose employment ended is eligible for the days inside the window and not after. This is deliberate, and it is a replace-in-place migration with no data change.
- Termination now writes employment history. Existing terminated staff are not back-filled.
- Evidence references vanish from API responses for HR users who lack `hr:documents:read`. The staff panel shows "Reference hidden".
- Employment, profile and evidence decisions need a live session and a current `hr:manage` grant. Callers that held only a token are refused.

### Deviations and limits

- **Population.** The plan listed active teachers. The workspace shows active staff with a teacher profile, plus anyone, in any status, who still has a current or future active assignment, so an inactive person who is still teaching cannot hide.
- **Cap.** One evaluation covers at most 2,000 people by name (`truncated: true` beyond that; search narrows). Filters and paging run in memory over that bundle.
- **NOT_YET_VALID** was added to the plan's evidence status list, because evidence that starts in the future is neither missing nor expired.
- The Project copy of this report does not carry the 7.9 or 7.10 sections; the repository copy is authoritative.

### Out of scope (not started)

Any override or exception model, a bulk revoke of assignments, notifications about expiring evidence, Phase 8 work, and mobile.

### Invariants established

- Eligibility has one definition: the preflight, the report, the workspace and the database function cannot disagree about employment.
- A teacher with no current assignment still gets an honest state (`NO_CURRENT_ASSIGNMENTS`), never a silent pass.
- History is append-only; nothing in this slice deletes or rewrites it.
- A user without the document permission never receives an evidence reference through any eligibility route.

### Tests executed

All run on freshly created and migrated PostgreSQL 16 databases (`..._7101`, plus the dedicated marks, timetable and admission databases those suites require).

| Check                                                                                                                                                                                                             | Result                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Core tests                                                                                                                                                                                                        | 32 passed                                                                       |
| API unit                                                                                                                                                                                                          | 312 suites, **3,682 passed** (new decision spec: 46)                            |
| API integration (all four DB variables set)                                                                                                                                                                       | 33 suites, **552 passed** (new `teacher-eligibility-workspace.int-spec.ts`: 20) |
| API e2e                                                                                                                                                                                                           | 45 suites, **321 passed**                                                       |
| Web tests                                                                                                                                                                                                         | 754 passed (new `teacher-eligibility-workspace-contract.test.mjs`)              |
| Typecheck (core, API, web), web build, `verify:openapi` (1,214 paths, 1,401 operations), `db:validate`, `prisma migrate diff --exit-code` (no drift), `verify:tracked-artifacts`, `format:check` on changed files | clean                                                                           |
| ESLint on changed API files (errors) and web files (`--max-warnings=0`)                                                                                                                                           | clean                                                                           |

### Next slice

7.11 — Accounting surfaces: payables, AR aging, fiscal-close preview and report drill-down.

## 7.11a — Report correctness and drill-down

**Completed locally on 3 October 2026, on `main`. Not pushed.** First of four 7.11 sub-slices (plan `claude/PHASE_7_11_PLAN.md`, decision P1).

**Baseline:** start `99079c92` (7.10); end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

Every accounting statement now equals the ledger, and every figure drills through to the account ledger, the journal, the business record behind it and that record's approval evidence. The report-to-ledger proof the Phase 7 plan asked for exists and runs on real PostgreSQL.

### Defects fixed

- **Reversed journals counted as minus themselves.** Reversing a journal marks the original `REVERSED`; reports read only `POSTED`, so the original dropped out while its reversal stayed. All reports, both close-readiness trial-balance checks, the year-end closing builder, the M9 net position and the legacy book balance now read `POSTED` and `REVERSED` (bank reconciliation already did).
- **Closing entries were not excluded.** The income statement, budget vs actual, tax summary and the default trial balance now exclude fiscal-year closing entries; the balance sheet and ledgers include them.
- **`INCOME` accounts were dropped** from the income statement, the balance sheet and the year-end close. `INCOME` and `REVENUE` are now one class everywhere (decision R4). The year close now closes `INCOME` accounts too.
- **Opening balances.** Trial-balance opening columns were hard-coded to zero; the general ledger and cash book had an opening only with `fromDate`, restarted running balances on every page and totalled one page. Now: opening = everything before the window, across fiscal years; page opening = opening + all rows before the page; totals and closing cover the whole filter.
- **Balance sheet summed one fiscal year.** It is now cumulative to the as-of date across years (decision R1). Unclosed earlier-year results show as their own equity line. A fiscal period means "as of that period's end".
- **Same-day entries dropped.** A date-only `toDate` became midnight. Report dates now use the same accounting day as the database period guard: the whole UTC day (decision R2).
- **Duplicate routes.** `GET /accounting/reports/{income-statement,balance-sheet,cash-book}` were declared on both controllers, and the legacy one (older shape, floats) answered first. The three legacy handlers are removed (decision R3); their service methods still feed the legacy CSV export.
- **Journal detail.** The dialog read fields the API never returned (`accountName`, `postedBy`, `reference`) and built wrong source links (every fee entry went to an invoice route, payroll to a route that does not exist).

### Changes

- `accounting/ledger-scope.ts`: the single ledger definition (`ledgerEntryWhere`, stage `PRE_CLOSING`/`POST_CLOSING`, inclusive-day bounds, income/expense classes, balance presentation).
- `AccountingReportsService`: trial balance, general ledger, cash/bank book, income statement, balance sheet, cash flow, tax summary and budget vs actual rebuilt on it. A deterministic line order (date, number, entry, line, id) keeps pages from overlapping. New response fields: `stage`, `setupWarnings` (trial balance, balance sheet: an opening-balance journal in a later year may double count), `pageOpeningBalance`, `entryStatus` on ledger rows, `comparisonSupported: false` on the income statement. `stage` query parameter on trial balance (default `PRE_CLOSING`) and general ledger (default `POST_CLOSING`).
- `AccountingSourceResolverService` (new): batched, tenant-scoped resolution of fee invoice, adjustment, waiver, receipt and refund (with its request, review, approval decisions and execution), payroll accrual and disbursement (with its preparation-to-payment chain), canteen postings, reversal and correction originals, opening balance and fiscal-year close. A source in a domain the viewer cannot read (payroll, fees, canteen) is returned as `restricted` with kind and label only, and is never queried. Display names come from staff records, else sign-in email or phone, inside the tenant only.
- `GET /accounting/journals/:id` now also returns per-line account code and name, the workflow actors (`{ duty, actor, at }`, never notes), the resolved source, the posting batch, and the reversal or correction that points back.
- Web: statement rows open the account ledger with the matching stage (income statement and trial balance pre-closing, balance sheet post-closing). Ledger and cash-book rows open the journal. The ledger pages on the server and shows the brought-forward balance, totals and closing balance. The trial balance gains an opening column. The journal dialog reads the server detail, shows the workflow and source approvals, opens related journals in place, downloads source documents through the file registry, and renders "Restricted" for other domains. The ledger-account filter is now controlled so drill-down selects it.
- Core: `JournalSourceSummary`, `AccountingActorEvent`, `AccountingLedgerStage` and the corrected report types. `JournalEntryView` drops the never-returned `reference` and `postedBy`.
- The unit-test Prisma mock gained the `JournalSourceType` values the schema already had (`CLOSING_ENTRY`, vouchers, `OPENING_BALANCE`).

### Operational impacts

- **Report figures change** for any school with reversals, a closed year, `INCOME` accounts, more than one fiscal year or entries late on a report end date. This is a correction; saved PDF snapshots keep the old figures.
- **Year-end close now includes `INCOME` accounts.** A year closed earlier left those balances open; they now appear as "Earlier Years Surplus / Deficit (not yet closed)" on the balance sheet.
- **Close readiness** trial-balance checks now include reversed entries (both sides balance, so no new blocker is expected).
- **Accountants without payroll, fee or canteen read access** see those journal sources as "Restricted".
- The three removed legacy routes are served by the canonical controller, whose response the web already expected.

### Not in this sub-slice

Comparative columns (still unsupported, now flagged), AR aging (7.11b), payables (7.11c), the close preview and the year re-close question (7.11d). Revenue accounts with a debit balance still produce a negative closing line; the 7.11d closing builder handles signed amounts. No visual Chromium pass was run for this sub-slice (it needs the full stack with seeded ledger data); contract tests and the production build cover the web changes.

### Invariants established

- One definition of the ledger for every statement, check and close.
- A reversed journal and its reversal net to zero in every report.
- Statements of performance exclude closing entries; positions include them.
- Trial balance, ledger, cash book and balance sheet reconcile: ledger closing = trial-balance closing; cash book closing = trial-balance cash; assets = liabilities + equity.
- Paging a ledger never changes its totals, closing balance or running balances.
- Accounting access does not reveal another domain's records.
- Each method+path in the accounting module is declared once (pinned by `accounting-route-ownership.spec.ts`).

### Tests executed

Fresh PostgreSQL 16 database `schoolos_auth_recovery_test_711a` (migrated, no drift), plus the dedicated marks, timetable and admission databases.

| Check                                                                                                                                                                                                       | Result                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core tests                                                                                                                                                                                                  | 32 passed                                                                                                                                                                        |
| API unit                                                                                                                                                                                                    | 315 suites, **3,700 passed** (new: `ledger-scope.spec.ts`, `accounting-source-resolver.service.spec.ts`, `accounting-route-ownership.spec.ts`, report service correctness cases) |
| API integration (all four DB variables)                                                                                                                                                                     | 34 suites, **562 passed** (new `accounting-report-ledger-conformance.int-spec.ts`: 10; 7 of them fail against the 7.10 report service)                                           |
| API e2e                                                                                                                                                                                                     | 45 suites, **321 passed**                                                                                                                                                        |
| Web tests                                                                                                                                                                                                   | **761 passed** (new `accounting-drilldown-contract.test.mjs`; `web-contracts` now forbids the old client-built source links)                                                     |
| Typecheck (core, API, web), web production build, `verify:openapi` (1,214 paths, 1,401 operations), `db:validate`, `prisma migrate diff --exit-code`, `verify:tracked-artifacts`, Prettier on changed files | clean                                                                                                                                                                            |
| ESLint on changed API files (errors) and web accounting files (`--max-warnings=0`)                                                                                                                          | clean                                                                                                                                                                            |

### Next

7.11b — receivables aging conformance and AR↔GL reconciliation.

## 7.11b — Receivables aging and AR-to-ledger reconciliation

**Completed locally on 3 October 2026, on `main`. Not pushed.** Second 7.11 sub-slice (plan `claude/PHASE_7_11_PLAN.md`).

**Baseline:** start `5ee40616` (7.11a); end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

Receivables now have one aging definition used everywhere, and a read-only check shows whether the fee subledger equals the receivable account in the general ledger, with the difference explained by cause.

### Defects fixed

- **Several aging definitions.** Server time, Nepal day, `ceil` and `floor` were all in use. Now: days overdue are counted in Nepal calendar dates (the Nepal date of the due date against the Nepal school day), and an invoice due today is not overdue.
- **Defaulter list.** Bucket totals covered the current page only, filtering happened after paging (so `total` was wrong), and "sort by outstanding" sorted by invoice total. Filters now apply first, totals and segments cover the whole set, and outstanding sorts by outstanding. Segment cards ignore the bucket filter so every bucket stays visible.
- **Reminders** only considered the first 100 overdue invoices, so a selected invoice on a later page was silently skipped. Selected invoices are now matched against the whole filtered set. Without a selection, the oldest 100 are reminded, as before.
- **Defaulter aging report** used the legacy `Payment.invoiceId` link (ignoring multi-invoice receipts and applied advances) and subtracted invoice-linked waivers a second time. It now uses the shared basis, `asOfDate` defaults to today, and waivers are not subtracted again.
- **Dues table** bucket and overdue status now use the shared Nepal-day basis. A not-yet-due bucket now reads `CURRENT` instead of `0`.
- **Void and late fees changed receivables without the ledger.**
  - Voiding now reverses every posted journal that put the invoice into receivables (billing, adjustments, invoice-linked waivers) in the same transaction. A void in a closed or locked period is refused. The paid check uses allocations, and a payment allocated during the void is refused.
  - Late fees now post as an invoice adjustment in the same transaction. If posting is refused (for example, no open period), the late fee is not added. Overdue is measured on the Nepal school day with the allocation basis.
- **A second adjustment on one invoice failed outright.** Every adjustment journal used the invoice id as its source key, which is unique, so the second one hit the database constraint and rolled back. Adjustments now use their own invoice line as the source key; the journal source resolver handles both forms.
- **Fees Home links** pointed at parameters no page read. The outstanding link now opens the invoice list filtered to invoices with a balance (`ledgerOutstanding=1`), and the aging link opens the aging report (`report=aging`).
- **Aging export** sent no `asOfDate`, so the server refused it. It now sends today's Nepal date, and the button only shows for users holding `reports:export` and `ledger:read`.

### Changes

- `packages/core/src/receivables-aging.ts`: bucket keys and labels (`CURRENT`, `0-30` = 1–30 days, `31-60`, `61-90`, `90+`), `daysOverdueOn`, `nepalDateOf`, `daysBetweenGregorianDates`.
- `apps/api/src/finance/receivables-aging.ts`: `loadReceivables` (as of a Nepal school day; invoices issued by then, not draft or void; allocations active on the day; per-invoice legacy fallback; advances reported once as a school-wide credit), `summarizeAging`, `resolveAgingAsOf`. Batched, no N+1.
- `GET /accounting/reports/receivables-aging` (`accounting:reports:read` + `accounting:read`): bucket totals, class summary, unapplied advances, paged invoice rows with a link to the student ledger.
- `GET /accounting/reports/receivables-reconciliation`: subledger total, control-account balance (code 1200, plus the fee-payment mapping's credit account if different), difference, and reconciling items. The causes are:
  - invoice not posted;
  - void not reversed;
  - late fee not posted;
  - waiver without an invoice;
  - opening balance;
  - manual journal.

  Anything left over is reported as "unexplained".

- The OpenAPI gate requires both new operations.
- Web: `/dashboard/accounting/receivables` is now aging-first (ASTRA M11-G): an as-of date (BS shown), bucket strip, totals, unapplied advances, receivables-vs-ledger panel, class table, and searchable paged invoices linked to the student ledger. The fees aging summary shows whole-set totals and the as-of date.

### Verified unchanged

- The principal mobile aging counts and the operational summary already used Nepal-day bounds that match the shared buckets (more than 90 days; 31–90 days), so they were left as they are.
- Fees Home outstanding already used allocations (7.5).

### Operational impacts

- **Defaulter totals, counts and buckets change**, generally upward where earlier figures were page-limited or legacy-based. The defaulter aging report stops double-counting waivers.
- **Voiding a posted invoice now writes reversal journals**, and is refused in a closed or locked period.
- **Late fees post to the ledger.** Invoices are skipped (counted as `postingRefused`) when no open period exists.
- **Historical gaps are not back-filled.** Earlier unposted late fees and unreversed voids appear as reconciling items.
- **As-of reports use current invoice totals.** A later waiver, adjustment or late fee already shows in an earlier as-of day's figures; this is noted on the page.

### Not in this sub-slice

- Payables (7.11c) and the close preview (7.11d).
- The fee collection report's `totalOutstanding` is a period flow figure: billed minus collected in the period, and it includes draft and void invoices. It is recorded for 7.12.
- The defaulter list still evaluates the open-invoice population in memory, which is fine for a school's scale; there is no cap.

### Tests executed

Fresh PostgreSQL 16 database `schoolos_auth_recovery_test_711b` (migrated, no drift), plus the dedicated marks, timetable and admission databases.

| Check                                                                                                                                                                                                                                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core tests                                                                                                                                                                                                                                                                     | **35 passed** (new `receivables-aging.test.mjs`)                                                                                                                                                                                                                                                                                                                                                                           |
| API unit                                                                                                                                                                                                                                                                       | 315 suites, **3,700 passed** (defaulter, reminder and void unit tests rewritten for the shared loader; resolver covers line-keyed adjustments)                                                                                                                                                                                                                                                                             |
| API integration (all four DB variables)                                                                                                                                                                                                                                        | 35 suites, **575 passed** (new `receivables-aging-conformance.int-spec.ts`: 13 — multi-invoice receipt, applied advance, waiver counted once, whole-set totals and paging, reminder off the first page, past as-of day, AR = GL, two adjustments on one invoice, late fee posted and charged once, void reverses journals, void refused after payment and in a locked period, unposted invoice reported, tenant isolation) |
| API e2e                                                                                                                                                                                                                                                                        | 45 suites, **321 passed**                                                                                                                                                                                                                                                                                                                                                                                                  |
| Web tests                                                                                                                                                                                                                                                                      | **768 passed** (new `receivables-aging-contract.test.mjs`; the Fees Home contract now checks that its link target is read)                                                                                                                                                                                                                                                                                                 |
| Typecheck (core, API, web), web production build, `verify:openapi` (1,216 paths, 1,403 operations), `db:validate`, `prisma migrate diff --exit-code`, `verify:tracked-artifacts`, Prettier on changed files, ESLint on changed API (errors) and web (`--max-warnings=0`) files | clean                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Next

7.11c — Payables.

## 7.11c — Payables

**Completed locally on 3 October 2026, on `main`. Not pushed.** Third 7.11 sub-slice (plan `claude/PHASE_7_11_PLAN.md`).

**Baseline:** start `8e1008df` (7.11b); end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

Accounts payable is now a working, auditable domain. Before this slice the four P0 tables existed with no constraints, service, route or test, and the web page was locked. Now a vendor bill is prepared, approved by a different person (which posts it to Accounts Payable), and paid by a third person. Payments and bills can be reversed. Payables age on the same buckets as receivables, and the aging total is checked against the AP ledger on the same day.

### Decisions applied (owner defaults)

- **P2.** Accounts Payable is a required report mapping (`ACCOUNTS_PAYABLE`, new enum value), exactly one liability account. Approval is refused with `PAYABLES_MAPPING_MISSING`, `_AMBIGUOUS` or `_INVALID`. VAT input and TDS payable use the same rule. No account is ever created automatically (`ensureAccount` is not used). The mapping settings endpoint now refuses more than one AP account, or a non-liability one.
- **P3.** Three duties with two new `finance_critical` permissions:
  - `accounting:expenses:write` prepares;
  - `accounting:expenses:approve` approves;
  - `accounting:payables:settle` pays.

  The approver must differ from the preparer and submitter, and the payer from all three. Reversals use `accounting:journals:reverse`: a bill reversal must differ from its approver, and a payment reversal from its payer.

  Role templates: `finance_approver` v4 gains approve plus expense, vendor and payable read; `posting_authority` v3 gains settle plus the same reads. The accountant template is unchanged (it already prepares). No broad alias grants either new permission. The principal allowlist is unchanged.

- **P4.** VAT (on the bill) and withheld tax (at payment) are typed in, and nothing computes a rate. The page says so.
- **P5.** Canteen purchase bills keep their own direct posting.

### Changes

- **Migration `20261003210000_phase7_payables_domain`** (expand-only; the preflight refuses to run if the expense or settlement tables already have rows):
  - New columns:
    - bill: vendor bill number, expense account, submit/reject/reverse evidence, approved fingerprint;
    - payable: void evidence;
    - settlement: withheld tax, cash amount, payment account.
  - New FKs, each with a `tenant_ref_*` trigger.
  - CHECKs: amounts; posted evidence; independent approver; rejection reason; reversal evidence; payable status and amount consistency; settlement arithmetic and sign; PAN format.
  - Partial uniques: an active vendor name, and a vendor bill number per vendor (case- and space-insensitive, unless reversed).
  - Three guard triggers:
    - **Bills.** The state machine is DRAFT → SUBMITTED → POSTED → REVERSED, with SUBMITTED → DRAFT on rejection. Content is immutable after draft, and approval evidence after posting. A bill with payments cannot be reversed. Only a draft can be deleted.
    - **Payables.** A payable is created only for a posted bill with the same total and vendor. Its terms are immutable, it is never deleted, and it can be voided only by reversing its bill. Its balance moves only through settlements.
    - **Settlements.** Settlements are append-only. Inserting one locks the payable, keeps the paid amount within [0, original], requires an independent payer, and requires a reversal to offset exactly one settlement of the same payable. The trigger recomputes the outstanding amount and status itself.
- **`PayablesService` and `PayablesController`** (`module.accounting`; one duty permission per route):
  - Vendors: list, create, update, deactivate. A vendor code comes from a sequence. Duplicate names and PANs are refused, and a vendor with pending bills cannot be deactivated.
  - Vendor bills (`/accounting/vendor-bills`): create (idempotent), edit draft, submit, approve, reject, reverse.
    - **Approve** checks the approver's content fingerprint. In one serializable, live-authorized transaction it then posts Dr expense (+ Dr VAT input) / Cr AP on the bill date, writes an `M11` posting batch, and opens the payable.
  - Payables: list and detail with payments.
    - **Pay** (`POST /accounting/payables/:id/settlements`) is idempotent. It posts Dr AP (the account the bill actually credited) / Cr cash or bank / Cr TDS payable.
    - **Reverse a payment**: `POST /accounting/payable-settlements/:id/reverse`.
  - `GET /accounting/payables-setup`: mapping states and the account choices.
  - `GET /accounting/reports/payables-aging`: as of a Nepal school day, with the shared buckets, by vendor, and the AP ledger balance on that day.
  - Every bill, payable and payment carries a canonical `authorization` projection.
  - Database guard refusals and serialization conflicts return 409, with stable codes.
- **Journal sources** reuse `EXPENSE_VOUCHER` and `PAYMENT_VOUCHER` with `sourceModule = 'PAYABLES'`, so no enum change was needed; consumers were checked (cash flow classifies them as operating; the AR reconciliation is unaffected). The source resolver adds `VENDOR_BILL` and `VENDOR_PAYMENT`, with prepare/submit/approve/pay evidence and the bill document. Both are `restricted` without expense or payable read.
- **The posting engine** records `M11` batches (`recordPayablesPostingBatch`). A reversal marks the batch `REVERSED`.
- **The OpenAPI gate** requires all 18 new operations.
- **Web:** `/dashboard/accounting/payables` is unlocked.
  - Tabs: Payables (aging first, with a ledger-match badge and payable detail with payments, pay and reverse), Vendor bills (record, submit, approve and post, return, reverse) and Vendors.
  - BS dates throughout, and actions follow the server projection.
  - A setup panel lets an accounting administrator map Accounts Payable. It keeps every other mapping, because the endpoint replaces the whole set.
  - The M11 posting-history panel is shown below.

### Deviations from the plan (recorded)

- **No `APPROVED` state is used.** Approval and posting happen atomically (SUBMITTED → POSTED), and the database refuses `APPROVED`. The enum value stays for compatibility.
- **Routes.** Vendor bills are at `/accounting/vendor-bills` (the plan said `expenses-ap`). Payment reversal is `/accounting/payable-settlements/:id/reverse`, and setup is `/accounting/payables-setup`, so no static path collides with `payables/:id`. The old `POST /accounting/expenses` direct-expense journal is unchanged and is not part of payables.
- **Document numbers** come from tenant-wide sequences (`VEN-0001`, `BILL-000001`, `AP-000001`), not per-fiscal-year keys.
- **No permission migration.** Permission rows come from the catalog through seeding and provisioning, as in 7.9.
- **A vendor is required on every bill.**
- **`FinancePayable.voidedAt`** holds the accounting date of the bill reversal, so aging as of earlier days still shows the payable.

### Operational impacts

- **No school can approve a bill until it maps Accounts Payable.** The page shows the setup state.
- **VAT input mapping.** The default seed maps VAT input to the same account as VAT output (`2230`), so bill VAT posts there as a net VAT account. Schools that want a separate input-VAT asset should remap it.
- **Role template versions changed** (`finance_approver` v4, `posting_authority` v3).

### Known limitations (for 7.11d / 7.12)

- The report-mapping `PUT` replaces the whole set and is not in a live-authorization transaction (existing behaviour). Payables now depend on it, so it should be hardened.
- There is no supporting-document upload in the bill form. The API accepts a tenant file id, and the resolver links the document.
- Payables were not added to the 7.11a report-conformance suite. The payables test asserts the ledger balances, and aging = AP ledger, directly.
- No Chromium pass was run for this page.
- Petty cash, purchase orders, vendor bank details, TDS certificates and returns stay out of scope.

### Tests executed

Fresh PostgreSQL 16 database `schoolos_auth_recovery_test_711c2` (migrated, no drift), plus the marks, timetable and admission databases with the new migration applied.

| Check                                                                                                                                                                                                                                                               | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core tests                                                                                                                                                                                                                                                          | **35 passed** (role template baseline updated)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| API unit                                                                                                                                                                                                                                                            | 317 suites, **3,705 passed** (new `payables.service.spec.ts`: fingerprint, vendor name key, guard detection; new `payables.controller.spec.ts`: guards, entitlement and exactly one duty permission per route)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| API integration (all four DB variables)                                                                                                                                                                                                                             | 36 suites, **588 passed**. New `payables-domain-policy.int-spec.ts` (13 tests): post, pay in parts with withheld tax, replay, key reuse, overpay, pay before the bill date, a non-cash/bank payment account, and aging = AP ledger on three days; payment and bill reversals with void; a user holding every duty is still blocked as approver, payer and reverser of their own work; reject and stale fingerprint; duplicate vendor, PAN and bill number; missing AP and TDS mappings with no accounts created; locked period; two concurrent full payments where exactly one wins (409); revoked grant and ended session; tenant isolation; direct-SQL guard and CHECK tests |
| API e2e                                                                                                                                                                                                                                                             | 45 suites, **321 passed**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Web tests                                                                                                                                                                                                                                                           | **775 passed** (new `payables-workspace-contract.test.mjs`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Typecheck (core, API, web), web production build, `verify:openapi` (1,231 paths, 1,421 operations), `db:validate`, `prisma migrate diff --exit-code`, `verify:tracked-artifacts`, `format:check`, ESLint on changed API (errors) and web (`--max-warnings=0`) files | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Next

7.11d — Fiscal-close preview (its close inventory now includes submitted bills and open payables).

## 7.11d — Fiscal-close preview

**Completed locally on 3 October 2026, on `main`. Not pushed.** Fourth and last 7.11 sub-slice (plan `claude/PHASE_7_11_PLAN.md`).

**Baseline:** start `d6cf5bbe` (7.11c); end = the commit that adds this section (`git log -1 -- claude/PHASE_7_COMPLETION_REPORT.md`).

### Slice

A period or year is now closed from a preview. The preview lists everything unfinished that the close depends on (graded as blocking or warning), says in plain language what closing will mean, and, for a year, shows the exact closing lines. The close must present the fingerprint of that preview and acknowledge every warning. If anything changed in between, the close is refused and the user reviews again.

### Defect confirmed and fixed (decision F2)

**A reopened fiscal year could never be closed again.** A probe on real PostgreSQL closed a year, reopened it, posted NPR 30 of revenue and closed again. The second close failed with a raw Prisma unique-key error on the closing entry's source key.

The closing builder now reads income and expense balances _after_ any earlier closing entry of the same year. As a result:

- a re-close posts a supplementary closing entry (`FISCAL_YEAR_CLOSE:2`, `:3`, …) for the change only;
- a re-close with no change closes without posting an entry.

The preview shows that the entry is supplementary and lists the earlier closing entries.

The same builder also fixes the defect recorded in 7.11b: an income account with a debit balance produced a negative closing line, so the close failed. Each account is now closed by the opposite of its net balance.

### Changes

- **`accounting/fiscal-close-inventory.ts`** (new). One inventory, read by period readiness, year readiness, both previews and both closes. Each item carries a code, a severity, a count, an amount (when it is money), a message, a consequence and a link to where it is resolved.
  - **Blocking** (new):
    - reviewed journals;
    - posting batches that are draft, ready, posting or failed;
    - approved or finalized payroll runs whose posting date (the period end date) is in range;
    - approved or processing refund/reversal requests;
    - cashier sessions not closed or deposited;
    - vendor bills awaiting approval (count and NPR).
  - **Warnings** (new):
    - pending online payments;
    - draft invoices;
    - pending waivers;
    - unfinished cash deposits;
    - draft vendor bills;
    - payroll posted but not paid;
    - open payables due in range (count and NPR).
  - **Unchanged blocking items:** draft, submitted and approved journals; posted source journals without mapping evidence; reconciliations; unreconciled bank items; unbalanced journals; trial balance.
  - **State items in the previews:**
    - period: not locked, already closed, previous period not closed, fiscal year closed;
    - year: open periods, already closed, nothing to close, retained-earnings account missing, and the opening-balance warning.
  - **Restricted counts.** A count is shown only to someone with the permission to act on it. Anyone else sees the item and its severity as `restricted`, never a zero. A restricted item adds only its code and severity to the fingerprint, so the fingerprint cannot be used to recover the hidden count.
- **Pure closing builder** (`buildClosingLines`, `closingPostingType`), shared by the preview and the close.
- **Routes:**
  - `GET /accounting/fiscal-periods/:id/close-preview` and `GET /accounting/fiscal-years/:id/close-preview` (`accounting:reports:read`). Each returns blockers, warnings, consequences, `requiredAcknowledgements`, `previewFingerprint` and a canonical `authorization` projection. The year preview adds the closing lines, net result, retained-earnings account and entry date (BS and Gregorian).
  - The close DTOs gain `expectedPreviewFingerprint` and `acknowledgedWarningCodes`. The close recomputes the preview inside its serializable, live-authorized transaction, and refuses with 409 and one of these codes:
    - `CLOSE_PREVIEW_REQUIRED`;
    - `CLOSE_PREVIEW_STALE`;
    - `CLOSE_BLOCKED`;
    - `CLOSE_WARNINGS_NOT_ACKNOWLEDGED`.

    The audit record stores the fingerprint and the acknowledged codes.

- **Lock and unlock (D5).** Both now run in the journal transaction: the live session and grant are re-checked, the status change is a compare-and-set, and the audit is written in the same transaction. Locking an already locked period returns it unchanged. No new separation of duties was added (F4).
- **Readiness responses** keep their shape and codes. Items now carry `restricted`, `amount` and `consequence`; journal counts include `reviewed`; period readiness lists warnings. The posting-failure and warning-acknowledgement checks are now real, so they were removed from `unavailableChecks`.
- **Backend hardening gate:** the period and year unbalanced-journal checks now share one tenant-anchored query. The `accounting.service.ts` raw-SQL count goes from 5 to 4, updated deliberately.
- **OpenAPI gate** requires both preview operations.
- **Web (ASTRA M11-H).** A shared `FiscalClosePreviewPanel` serves the period-close and year-close dialogs. It shows:
  - blockers with resolve links;
  - warnings, each needing a ticked acknowledgement;
  - `Restricted` in place of hidden counts;
  - consequences;
  - the closing-lines table and net result for a year.

  The close is sent with the fingerprint. A refused close clears the ticks and re-reads the preview.

- **Playwright specs** `m11-fiscal-controls` and `m11-fiscal-year-close` are updated for the preview-bound close. Both had already drifted from the dialog copy. I did not run them (they need the full running stack).

### Operational impacts

- **Closes are stricter.** These now block a close that passed before: reviewed journals, failed or waiting posting batches, open cashier sessions, approved but unexecuted refunds, payroll runs dated in the period, and submitted vendor bills.
- **Old clients get 409 `CLOSE_PREVIEW_REQUIRED`.** A client that closes without a preview (scripts, older web builds) is refused and must preview first. This is an additive DTO change.
- **A reopened year can now be closed again.** The re-close posts a supplementary closing entry dated the year end. Balance sheets include it; income statements exclude it, like every closing entry.

### Not done (recorded)

- The "Close blockers" column in the fiscal-period grid (D6) needs a per-period inventory for every row. It is left for 7.12; blockers show when the close dialog opens.
- **F3:** fiscal periods are still Gregorian months; the previews show BS dates.
- **Pending approved refunds are tenant-wide.** Approved but unexecuted refund requests created before the end of the period block it, even though they will post on their execution date.

### Tests executed

Fresh PostgreSQL 16 database `schoolos_auth_recovery_test_711d` (migrated, no drift), plus the marks, timetable and admission databases.

| Check                                                                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API unit                                                                                                                                                                                                                                             | 318 suites, **3,713 passed**. New `fiscal-close-inventory.spec.ts` covers: income/expense close, a debit-balance income account closes without a negative line, nothing left to close, supplementary posting types, restricted counts, a fingerprint that hides restricted counts, and close acceptance codes. The period and year close unit tests were rewritten for the preview-bound close                                                                                                                                                                                 |
| API integration (all four DB variables)                                                                                                                                                                                                              | 37 suites, **592 passed**. New `fiscal-close-preview.int-spec.ts` (4 tests) covers: the inventory with restricted views; a period close refused without a fingerprint, without acknowledgement and after a change, then closed with the fingerprint audited; closing lines equal what the year close posts; re-close after reopen posts a supplementary entry for the change only; re-close with no change posts nothing; lock re-checks the live grant, and a failed audit rolls back the lock. The fiscal-reopen and report-conformance suites now close through the preview |
| API e2e                                                                                                                                                                                                                                              | 45 suites, **321 passed**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Web tests                                                                                                                                                                                                                                            | **778 passed** (new `fiscal-close-preview-contract.test.mjs`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Typecheck (core, API, web), web production build, `verify:openapi` (1,233 paths, 1,423 operations), `prisma migrate diff --exit-code`, `verify:tracked-artifacts`, `format:check`, ESLint on changed API (errors) and web (`--max-warnings=0`) files | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Next

Phase 7.11 is complete (a–d). 7.12 picks up the items recorded above: the fee collection report's period `totalOutstanding`, the report-mapping update transaction, and the close-blockers grid column.
