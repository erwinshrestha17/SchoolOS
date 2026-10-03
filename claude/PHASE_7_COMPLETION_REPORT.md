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

| Check | Result |
| --- | --- |
| Core tests | 32 passed (new `payroll-period.test.mjs`) |
| API unit | 311 suites, **3,620 passed** |
| API integration (fresh DB, all four DB variables set) | 32 suites, **532 passed** (new `payroll-periods-holds-bank-advice.int-spec.ts`: 27) |
| API e2e | 45 suites, **321 passed** |
| Web tests | 745 passed (new `payroll-phase79-contract.test.mjs`) |
| API / Web typecheck, API lint on changed files (errors), Web lint (`--max-warnings=0`), `pnpm format:check` | clean |
| `pnpm db:validate`, `pnpm verify:openapi`, `pnpm verify:tracked-artifacts` | pass (1,212 paths, 1,399 operations, 505 schemas) |
| `prisma migrate deploy` on a fresh DB, then `prisma migrate diff --exit-code` | applied; no difference |
| `pnpm --filter @schoolos/web build` | pass |

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
