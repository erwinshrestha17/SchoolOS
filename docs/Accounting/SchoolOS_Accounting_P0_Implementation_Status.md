# SchoolOS Accounting P0 Implementation Status

**Release stage:** GA program Wave 0 — local implementation and Internal QA evidence only  
**Scope:** `FIN/UI-P0-01` through `FIN/UI-P0-09`  
**Inventory frozen:** 2026-08-01  
**Applicable completion:** **4 / 97 PASS (4.1%)**

This tracker is the execution record for the applicable P0 requirements in:

- `docs/accounting/SchoolOS_Financial_Reporting_Audit_Implementation_Spec.md`
- `docs/accounting/SchoolOS_Financial_UI_Audit_Web_Mobile_Spec.md`

Only `PASS` contributes to the numerator. The denominator is `PASS + PARTIAL + BLOCKED`. Canonical report aliases are counted once. P1/P2 items, explicit exclusions, and `FA-01` are not applicable and are excluded from the denominator.

## Status definitions

| Status | Meaning |
| --- | --- |
| PASS | Implemented and verified with current reproducible evidence. |
| PARTIAL | Some implementation exists, but required behavior or evidence is incomplete. |
| BLOCKED | No safe complete implementation exists yet, or an external dependency prevents verification. |

## Canonical P0 report inventory

| ID | Owner | Slice | Status | Current evidence or blocker |
| --- | --- | --- | --- | --- |
| AP-01 | M11 | 06 | BLOCKED | Basic expense register lacks the complete vendor/payable/supporting-document contract. |
| AP-06 | M11 | 06 | BLOCKED | Accounts-payable control model and reconciliation are missing. |
| AP-08 | M11 | 06 | BLOCKED | Vendor ledger model and control-account reconciliation are missing. |
| AP-13 | M11 | 06 | BLOCKED | Payment-due lifecycle is not represented end to end. |
| AP-17 | M11 | 06 | BLOCKED | Petty-cash reporting lacks a complete source/control contract. |
| AP-18 | M11 | 06 | BLOCKED | Recurring-expense reporting lacks a complete source contract. |
| AR-01 | M3 | 02 | PARTIAL | The typed invoice register now uses allocation-authoritative balances, server pagination, decimal strings, and M11 journal lineage; the canonical metadata envelope and complete export parity remain. |
| AR-02 | M11 | 02 | PARTIAL | Receivable totals exist in M3; M11 control reconciliation is incomplete. |
| AR-03 | M11 | 02 | PARTIAL | Student ledger exists; M11 debtor-control lineage is incomplete. |
| AR-04 | M11 | 02 | PARTIAL | Adjustment/reversal workflows exist in part; a canonical credit-note register is incomplete. |
| AR-05 | M11 | 02 | PARTIAL | Adjustment workflows exist in part; a canonical debit-note register is incomplete. |
| AR-06 | M3 | 03 | PARTIAL | Multi-invoice, advance, unallocated, and audited reallocation records are authoritative; the paginated Accountant report exposes backend totals and M11 posting lineage. Canonical metadata and protected export parity remain. |
| AUD-01 | M11/M0 | 09 | PARTIAL | Audit log workspace exists; finance-wide evidence coverage and export metadata are incomplete. |
| AUD-02 | M11 | 04 | PARTIAL | Voucher reporting exists; complete typed metadata and drill-down evidence are incomplete. |
| AUD-03 | M11 | 04 | PARTIAL | Typed M3/M7 source batches, exact reconciliation differences, failure detail, and audited retry now exist; the canonical AUD-03 report envelope/export remains. |
| AUD-04 | M11 | 09 | PARTIAL | Journal reversals exist; canonical report coverage remains incomplete. |
| AUD-05 | M11/M3 | 09 | PARTIAL | Cancel/reversal history exists in part; canonical voided register is incomplete. |
| AUD-06 | M11 | 04 | PARTIAL | Backdated data can be queried; explicit report and policy metadata remain incomplete. |
| AUD-07 | M11 | 09 | PARTIAL | Reopen fields and audit exist; approval and relock evidence are incomplete. |
| AUD-08 | M11 | 04 | PARTIAL | Manual journals exist; canonical report metadata and export parity remain incomplete. |
| AUD-09 | M11 | 09 | BLOCKED | Tenant-configured high-value threshold/report contract is missing. |
| AUD-10 | M3/M11 | 03 | PARTIAL | Idempotency controls exist; canonical duplicate-payment evidence report is incomplete. |
| AUD-11 | M3/M11 | 03 | PARTIAL | Receipt sequencing exists; complete exception reporting is incomplete. |
| AUD-12 | M11 | 09 | PARTIAL | Approval workflows exist; finance-wide exception projection is incomplete. |
| AUD-13 | M11/M0 | 09 | PARTIAL | Audit records exist; user financial access/activity projection is incomplete. |
| AUD-16 | M11/M0 | 09 | BLOCKED | Supporting-document exception projection is missing. |
| CB-01 | M11 | 05 | PARTIAL | Cash book exists; P0 metadata, pagination, and export parity need closure. |
| CB-02 | M11 | 05 | PARTIAL | Bank book exists; P0 reconciliation context and export parity need closure. |
| CB-03 | M11 | 05 | PARTIAL | Dashboard balances exist in part; canonical position report is incomplete. |
| CB-04 | M11 | 05 | PARTIAL | Bank balances exist in part; ledger-versus-statement basis is incomplete. |
| CB-05 | M11 | 05 | PARTIAL | Reconciliation exists; authoritative session/match/finalization history is incomplete. |
| CB-06 | M11 | 05 | PARTIAL | Unreconciled listing exists; complete session and timing-difference context is incomplete. |
| CB-08 | M3/M11 | 03 | PARTIAL | Tenant-scoped idempotent deposit preparation, submission, completion, cashier-close lineage, and balanced cash-to-bank posting now exist with an Accountant workflow; canonical report/export and supporting-document evidence remain. |
| CB-09 | M3/M11 | 03 | PARTIAL | Closed sessions remain explicitly undeposited until a completed CashDeposit links them and posts M11; the grouped undeposited report/export is still incomplete. |
| CB-10 | M3/M11 | 03 | PARTIAL | Provider intents/callbacks exist; settlement-to-M11 reconciliation is incomplete. |
| CB-11 | M3/M11 | 03 | PARTIAL | Provider reconciliation exists in part; canonical wallet/QR report is incomplete. |
| CB-12 | M3/M11 | 03 | PARTIAL | OPEN, COUNTED, SUBMITTED, APPROVED, CLOSED, and DEPOSITED transitions, independent approval, immutable close PDF, and deposit lineage are implemented; canonical metadata/export evidence remains. |
| CB-13 | M3/M11 | 03 | PARTIAL | Backend expected/actual totals, mandatory variance reasons, independent approval, controlled reopen, and deposit lineage are implemented; the dedicated variance report/export remains. |
| FEE-01 | M3 | 02 | PARTIAL | The student ledger is a bounded server-side projection with deterministic backend running balances, an opening balance for windowed views, and displayed-page totals separated from window-wide totals. It is the first renderer to carry the complete versioned metadata envelope: catalog-owned report ID/version/title/family/owner, classification, fiscal context with accrual and posted-with-pending-disclosed basis, deterministically normalized filters, generation time, M3 source freshness, validation warnings, report-wide totals, pagination, and per-row `SOURCE_RECORD` drill-down. The export executor drains that same enveloped projection through `getStudentFeeLedgerExport` — bounded server-side paging with an explicit 10,000-row ceiling that refuses rather than silently truncating a financial record — so the artifact and the screen cannot disagree on rows, running balances, or totals. The export record persists `financialReportId = FEE-01`, matching version and classification, and real `displayedTotals`. Proven against real PostgreSQL (21/21), including exported rows identical to the rendered rows in order and a 620-invoice fixture exercising the multi-page drain with continuous running balances across the internal page boundary. The PDF and XLSX artifacts now carry their own classification watermark and backend-owned control totals inside the document — the PDF in a `CONTROL TOTALS` block plus a footer marking, the XLSX on a dedicated `Report Metadata` sheet that leaves the data grid machine-readable from row 1 — asserted by parsing the real bytes (ExcelJS read-back and PDF string extraction), with both assertions mutation-checked to confirm they fail without the change. Remaining for PASS: the authenticated browser E2E covering request → protected download. |
| FEE-02 | M3 | 02 | PARTIAL | Collection reporting exists; canonical class/section contract needs closure. |
| FEE-03 | M3 | 02 | PARTIAL | Collection reporting exists; canonical fee-head contract needs closure. |
| FEE-04 | M3 | 02 | PARTIAL | Daily collection reporting exists; lifecycle and export parity need closure. |
| FEE-05 | M3 | 02 | PARTIAL | Monthly collection reporting exists; P0 metadata and drill-down need closure. |
| FEE-06 | M3 | 02 | PARTIAL | Outstanding reporting exists; complete authoritative ledger projection needs closure. |
| FEE-07 | M3/M11 | 02 | PARTIAL | Aging exists; M11 control reconciliation and report metadata need closure. |
| FEE-08 | M3 | 02 | PARTIAL | Advance balances are now immutable allocation totals with audited application to invoices and a paginated Accountant view; canonical report metadata/export remain. |
| FEE-09 | M3 | 02 | PARTIAL | Partial and multi-invoice payments now expose immutable allocation history with decimal strings; the canonical family-wide metadata/export contract remains. |
| FEE-10 | M3 | 02 | PARTIAL | Overpayment/credit balances are represented as unallocated or advance allocations and can be safely reapplied; canonical metadata/export remain. |
| FEE-11 | M3 | 02 | PARTIAL | Discounts exist; complete report metadata and history need closure. |
| FEE-12 | M3 | 02 | PARTIAL | Scholarship/concession data exists in part; canonical report needs closure. |
| FEE-13 | M3 | 02 | PARTIAL | Late-fee data exists in part; canonical report needs closure. |
| FEE-14 | M3 | 02 | PARTIAL | Waivers exist; complete report and correction lineage need closure. |
| FEE-15 | M3 | 03 | PARTIAL | Refunds create immutable negative allocation history, restore each affected invoice, and expose M11 journal lineage in a paginated register; canonical metadata/export remain. |
| FEE-16 | M3 | 03 | PARTIAL | Reversal/receipt history exists; canonical void register needs closure. |
| FEE-17 | M3 | 03 | PARTIAL | Receipt and sequence-exception registers now use typed decimal-string contracts and server pagination; the canonical metadata envelope and protected export parity remain. |
| FEE-18 | M3 | 02 | PARTIAL | Payment-method reporting exists; settlement context needs closure. |
| FEE-19 | M3 | 02 | BLOCKED | Withdrawal settlement report and source lifecycle are incomplete. |
| FS-01 | M11 | 08 | PARTIAL | Income statement exists; statement definitions, finalization, and drill-down need closure. |
| FS-02 | M11 | 08 | PARTIAL | Balance sheet exists; equation evidence and statement lineage need closure. |
| FS-04 | M11 | 04 | PARTIAL | Trial balance exists; full metadata/export contract needs closure. |
| FS-05 | M11 | 04 | PARTIAL | General ledger exists; complete pagination/filter context and export parity need closure. |
| FS-06 | M11 | 04 | PARTIAL | Journal register exists; canonical voucher/source drill-down needs closure. |
| FS-07 | M11 | 08 | PARTIAL | Receipts/payments data exists in the ledger; canonical statement is incomplete. |
| MGMT-05 | M11 | 08 | PARTIAL | Monthly summary exists in part; published metric definitions and drill-down are incomplete. |
| MGMT-07 | M11 | 08 | PARTIAL | YTD summary exists in part; published metric definitions and drill-down are incomplete. |
| MGMT-17 | M11 | 08 | PARTIAL | Finance dashboard exists; full M3/M7/M11 server projection and freshness are incomplete. |
| PAY-01 | M7 | 07 | PARTIAL | Payroll summaries exist; immutable approved accounting snapshot needs closure. |
| PAY-02 | M7/M11 | 07 | PARTIAL | Salary expense reporting exists in part; source-to-GL reconciliation needs closure. |
| PAY-03 | M7/M11 | 07 | PARTIAL | Payroll liabilities exist in part; authoritative handoff/difference view needs closure. |
| PAY-04 | M7 | 07 | PARTIAL | Tax deductions exist; professional verification state needs closure. |
| PAY-08 | M7/M11 | 07 | PARTIAL | Posting exists; payment reconciliation and difference history are incomplete. |
| PAY-09 | M7/M11 | 07 | PARTIAL | Payable data exists; canonical unpaid-salary report needs closure. |
| PAY-10 | M7/M11 | 07 | PARTIAL | Payroll journal posting exists; canonical report and correction lineage need closure. |
| TAX-01 | M7/M11 | 07 | PARTIAL | TDS data exists; Nepal-qualified professional verification is external. |
| TAX-02 | M7/M11 | 07 | PARTIAL | TDS payable data exists; Nepal-qualified professional verification is external. |

## Cross-cutting P0 inventory

| ID | Requirement | Slice | Status | Current evidence or blocker |
| --- | --- | --- | --- | --- |
| X-P0-01 | Tenant isolation on records, jobs, files, reports, and caches | 01–09 | PARTIAL | Existing guards and tenant fields exist; new finance records and complete persona proof remain. |
| X-P0-02 | Accounting/fees/payroll entitlements fail closed | 01–09 | PARTIAL | Guards exist; new routes and disabled-module tests remain. |
| X-P0-03 | Accountant, HR, Principal, Admin, Parent, and Teacher least-privilege boundaries | 01 | PASS | Finance presets are fail-closed, Admin gains no implicit finance authority, and explicit reconciliation reports tenants without a designated Accountant as blocked; focused role tests pass. |
| X-P0-04 | Time-bounded, revocable, audited financial-auditor access | 01/09 | PASS | Production `financial_auditor` preset, mandatory future expiry, revocation metadata, cache/JWT filtering, permission-revalidated export access, and audit records are implemented and focused tests pass. |
| X-P0-05 | Decimal-string money contract from backend through web/mobile | 01–08 | PARTIAL | Parent/mobile allocation history, fee setup writes, invoice/receipt/refund reports, cashier/deposit contracts, and active finance web formatters now use decimal strings without `any`; legacy backend report helpers still need full conversion. |
| X-P0-06 | Idempotent money, posting, callback, and export commands | 01–09 | PARTIAL | Several commands are idempotent; source batches and complete retry coverage remain. |
| X-P0-07 | Posted/confirmed records corrected only by reversal/replacement | 01–09 | PARTIAL | Journal/payment reversal exists; all AP/cashier/export evidence remains. |
| X-P0-08 | Fiscal lock, approved reopen, warning, and explicit relock | 01 | PASS | FiscalPeriod is canonical; reopen requires generic approval and a reason, self-approval is denied, the warning persists, and explicit relock clears it with audit evidence. |
| X-P0-09 | Source posting batch status, retry, failure, and reconciliation | 01/07/09 | PARTIAL | M3/M7 batches and items now expose source/posted totals, difference, journal lineage, failure state, and concurrency-safe audited retry; automatic persistence of every rolled-back source failure remains. |
| X-P0-10 | Server-owned fiscal context on every finance surface | 01–09 | PARTIAL | The eight-destination Accountant shell now shows the backend fiscal year, open period, accrual/posted basis, lock failure, and reopened warning; M3/M7 and mobile surface consistency remains. |
| X-P0-11 | Server pagination, bounded aggregates, and tenant-scoped indexes | 01–09 | PARTIAL | Invoice, receipt, refund/reversal, unallocated-payment, cashier-close, deposit, and allocation histories are paginated or explicitly bounded. Student-ledger event pagination is now a bounded server-side projection: `getStudentFeeLedgerPage` builds a tenant-scoped `UNION ALL` event stream, derives the running balance from a `SUM(...) OVER (...)` window function over the whole ordered stream, and applies the date window, transaction-type filter, and `LIMIT`/`OFFSET` in SQL, so only one page crosses the process boundary. The unbounded `findMany` is gone. Proven against real PostgreSQL with row-for-row parity against the previous in-process projection (10/10, `test/student-fee-ledger-projection.int-spec.ts`). Complete query-plan/index proof across the remaining finance surfaces still remains. |
| X-P0-12 | Context-preserving report-to-source drill-down | 01–09 | PARTIAL | Some journal links exist. FEE-01 rows now carry typed `SOURCE_RECORD` drill-down references resolving to the originating payment or invoice. The full statement → account → GL → voucher → source → protected evidence chain, and filter/scroll preservation on traversal, remain. |
| X-P0-13 | UI/API/export filter and total parity with protected files | 01/09 | PARTIAL | CSV/PDF/XLSX exports retain normalized parameters, checksum, classification, expiry, requester, File Registry ID, and request/download permission revalidation. Export metadata now resolves through the shared catalog via a new `ReportDefinition.financialReportId` link and the same `normalizeFinancialReportFilters` the rendered envelope uses, so filter and identity parity holds for FEE-01. **Defect found and fixed:** `buildExportMetadata` previously looked the catalog up by registry key, but no registry key equals a catalog ID (0 of 167), so the lookup never matched and every export — including the statutory PAY-04/TAX-01/TAX-02 family — was classified `CONFIDENTIAL` instead of `STATUTORY_DRAFT`. The mechanism is fixed and regression-tested; the statutory reports still need their own `financialReportId` links. **Displayed-total parity now has its first proven case:** `ReportExport.displayedTotals` was written as `{}` at every call site and was dead. A new optional `ReportExecutor.executeTotals` hook now records backend-owned totals, wired for FEE-01 and persisted at the synchronous, JSON, and queued-completion write sites, with the stored `rowCount` asserted equal to the recorded totals' row count. The remaining 74 reports still write no displayed totals. **Second defect found and fixed:** the watermark and classification were computed and stored as export/file-registry metadata but never rendered into the artifact, so a downloaded or forwarded FEE-01 PDF/XLSX carried no marking and no official totals. Both formats now embed them. |
| X-P0-14 | BS-only shared school-facing date formatting and Nepal timezone | 01–09 | PARTIAL | Shared helpers exist; finance surfaces and exports need a complete audit. |
| X-P0-15 | Keyboard, screen reader, zoom, responsive, reduced-motion, and Nepali-text accessibility | 01–09 | PARTIAL | Shared primitives exist; finance-wide manual and automated evidence remains. |
| X-P0-16 | Parent linked-child fees, payments, receipts, corrections, and protected files | 02/03 | PARTIAL | Linked-child DTOs now expose decimal-string invoice, receipt, allocation, waiver, refund, and history truth with read-only stale cache behavior; correction-request device and session-expiry evidence remains. |
| X-P0-17 | Principal server-projected read-only web/mobile finance and designated approvals | 08 | BLOCKED | Generic snapshots exist; the purpose-limited finance projection is missing. |
| X-P0-18 | No native Accountant mobile operations | 01–09 | PASS | Repository route/feature inventory confirms no Accountant Flutter workspace. |
| X-P0-19 | Sensitive financial actions and access are audited with safe payloads | 01–09 | PARTIAL | Audit service exists; new actions and export access coverage remain. |
| X-P0-20 | Financial evidence uses File Registry and protected download helpers | 01–09 | PARTIAL | Receipt/payroll/report file paths exist; complete export/supporting-document coverage remains. |
| X-P0-21 | Honest loading, empty, stale, failure, denied, locked, queued, and partial states | 01–09 | PARTIAL | Current workspaces cover some states; shared finance states are incomplete. |
| X-P0-22 | Versioned report metadata, freshness, validation, classification, and expiry | 01/09 | PARTIAL | The typed 75-report catalog and shared response/export metadata contract carry version, basis, normalized filters, freshness, validation, classification, checksum, and expiry. The reusable `FinancialReportEnvelope` is now extracted in `packages/core` with shared catalog lookup, classification, professional-verification, and filter-normalization helpers, and `FinancialReportResponse` composes from it, so a report with its own typed rows adopts the identical envelope. FEE-01 is the first adopting renderer (proven against real PostgreSQL). The remaining 74 renderers must still adopt it. |

## Explicitly excluded from the denominator

| ID/domain | Decision |
| --- | --- |
| FA-01 Fixed Asset Register | Owner-confirmed exclusion on 2026-08-01; Inventory and Asset Management remains removed from active scope. |
| P1/P2 reports and UI | Preserve existing cash-flow and budget behavior for regression only; do not expand or count it as P0. |
| Native Accountant mobile | Explicitly prohibited for P0. |
| M8/M9/M10/M13 expansion, M14, procurement suite, chat, AI, scenario planning | Out of scope. Existing compatibility data is preserved. |

## Baseline verification — 2026-08-01

| Command | Result |
| --- | --- |
| `pnpm db:validate` | PASS — Prisma schema valid. |
| `pnpm verify:openapi` | PASS. |
| `pnpm --filter @schoolos/web typecheck` | PASS. |
| Throwaway PostgreSQL migration replay (`prisma migrate deploy` + `prisma migrate status`) | PASS — all 96 migrations applied cleanly; schema up to date; throwaway database removed. |
| Focused API accounting/finance/payroll/principal Jest selection | PARTIAL — 148/149 passed; stale export method-count assertion failed. |
| Focused finance/payroll web contracts | PASS — 34/34. |
| Targeted Parent/Principal Flutter tests | PASS — 33/33. |
| Full web contract suite | PARTIAL — 480/491; 11 pre-existing failures recorded separately from P0 changes. |

## Checkout reconciliation — 2026-08-01 (post central cash-control report registration)

Run sequentially; concurrent API/web typechecks race on `packages/core/dist`.

| Command | Result |
| --- | --- |
| `pnpm compile:artifacts` | PASS. |
| `pnpm --filter @schoolos/api typecheck` | PASS. |
| `pnpm --filter @schoolos/web typecheck` | PASS — the interrupted run now completes. |
| Focused API `src/finance src/mobile src/accounting src/reports src/payroll` Jest | PASS — 516/516 across 48 suites. |
| Focused web `accounting-p0-foundation-contract` + `m3-fees-workspace-contract` | PASS — 17/17. |
| `pnpm db:validate` | PASS — Prisma schema valid. |
| `git diff --check` | PASS — clean. |
| `pnpm --filter @schoolos/api test:integration -- student-fee-ledger-projection` | PASS — 21/21 against real PostgreSQL (bounded projection parity, the FEE-01 metadata envelope, and export/render artifact parity including a 620-invoice multi-page drain). Required applying three pending local migrations (`p1_cash_flow_budget`, `finance_p0_role_assignment_expiry`, `finance_p0_foundations`); the local database was behind the repository. |
| `pnpm verify:openapi` | PASS — after the ledger response shape change. |
| Focused API `src/finance src/mobile src/accounting src/reports src/payroll` Jest (final) | PASS — 520/520 across 48 suites. |
| Throwaway PostgreSQL migration replay (`prisma migrate deploy` + `prisma migrate status`) | PASS — all **97** migrations applied cleanly to an empty database, schema up to date, throwaway database removed. The count moved 96 → 97 with the additive `ReportExport.financialReportId` migration. |

### Regressions found and corrected

| Area | Finding | Correction |
| --- | --- | --- |
| Decimal-string fee-setup DTOs | Replacing `@IsNumber() @Min(0)` / `@Min(0.01)` with `@IsDecimal` silently dropped sign and precision enforcement, because `@IsDecimal` accepts a leading `-`. Fee head, fee plan item, and discount `amountOff` accepted negative money; a negative waiver would have *increased* an invoice total through `subtotal.sub(amount)`. | Added explicit service-layer sign/precision guards mirroring the existing `collectPayment` convention (non-negative for fee head/plan/discount, positive for waiver). Five focused rejection tests added, each also asserting nothing was persisted. |
| Discount rule creation | Pre-existing defect on the same path: the web sends `percentOff`/`amountOff` as `null` for single-sided rules, and the service only checked `=== undefined`, so `new Prisma.Decimal(null)` threw. Percentage-only discount creation failed. | Null-safe mapping for both fields plus a focused test covering a percentage-only rule with `amountOff: null`. |
| Prisma Jest mock `CashDepositStatus` | Verified present and consistent with the schema enum. | No change required. |
| `CashierCloseStatus` filtering | Verified `ListCashierClosesDto.status` is enum-validated and applied to the tenant-scoped `where` with server pagination. | No change required. |
| Central cash-control report registry authorization | All five new reports require `['reports:export', 'accounting:reports:read']`; both the Accountant and `financial_auditor` presets carry both. No focused test pinned this. | Added a focused RBAC test asserting Accountant and `financial_auditor` see all five, and that missing either permission fails closed. |
| Stale focused tests (pre-existing at HEAD, not from this diff) | `finance-list-pagination` invoice fixture omitted the `paymentAllocations` relation; `finance.service.dues` still asserted numbers after the decimal-string conversion. | Fixtures corrected to match the real Prisma include and the decimal-string contract. Web/shared types already expected strings. |

## Implementation evidence log

| Date | Slice | Evidence |
| --- | --- | --- |
| 2026-08-01 | FIN/UI-P0-01 | Typed 75-report catalog, decimal metadata contract, additive P0 schema/migrations, finance permission reconciliation, time-bounded auditor, approved fiscal reopen/relock, exactly-eight-destination Accountant shell, typed accessible report table, protected XLSX export metadata, and M3/M7 posting-batch lineage/retry implemented. Focused accounting posting/retry tests pass 7/7; API and web typechecks pass. |
| 2026-08-01 | FIN/UI-P0-02–03 (partial) | Multi-invoice/advance allocation truth, audited reallocation/refund/reversal history, paginated invoice/receipt/sequence/refund/unallocated reports, explicit cashier lifecycle, protected close PDF, and idempotent cash-deposit-to-M11 posting are implemented. Focused API finance/mobile tests pass 170/170; focused web contracts pass 17/17; API/web typechecks pass. Canonical report envelopes/exports and remaining FEE/AR/CB reports keep the slice PARTIAL. |
| 2026-08-01 | FIN/UI-P0-02 (partial) | Replaced the in-memory student fee-ledger pagination with a bounded server-side SQL projection: `UNION ALL` event stream, window-function running balance over the full ordered stream, SQL-side window/type filtering and `LIMIT`/`OFFSET`, plus opening-balance and window-total aggregates. Displayed-page totals (`pageTotals`) are now explicitly separated from window-wide backend totals (`windowTotals`) in the shared contract. Fixed a latent 500 where a year-filtered ledger queried a non-existent `FeeWaiver.academicYearId`. New real-PostgreSQL integration suite proves row-for-row parity with the previous projection, cross-page balance continuity, windowed opening balance, tenant isolation, and permission denial (10/10). FEE-01 and AR-03 stay PARTIAL: the canonical versioned metadata envelope, drill-down references, and protected export parity are still outstanding. |
| 2026-08-01 | FIN/UI-P0-02 (partial) | Adopted the versioned report metadata envelope on FEE-01, the first renderer to carry it. Extracted a reusable `FinancialReportEnvelope` plus `findFinancialReportDefinition`, `resolveFinancialReportClassification`, `resolveProfessionalVerificationStatus`, and `normalizeFinancialReportFilters` into `packages/core`, and recomposed `FinancialReportResponse` from it so the generic-table and typed-row reports share one definition. Added a reusable server-owned fiscal-context resolver: a tenant with no open fiscal year yields nulls plus an explicit warning rather than an invented context. Added per-row `SOURCE_RECORD` drill-down. Verified with 16/16 real-PostgreSQL tests covering catalog identity, populated and absent fiscal context, tenant-scoped fiscal resolution, deterministic filter normalization, the year-filter waiver caveat warning, envelope-vs-page total separation, and drill-down targets; `pnpm verify:openapi` passes. |
| 2026-08-01 | FIN/UI-P0-02 (partial) | Wired the FEE-01 export path through the shared report catalog. Added `ReportDefinition.financialReportId`, linked `student-fee-ledger` to `FEE-01`, and rebuilt `buildExportMetadata` on the same core helpers the rendered envelope uses. Added an additive nullable `ReportExport.financialReportId` column plus a tenant-scoped index (migration `20260801160000_report_export_financial_report_id`), persisted at both the queued and synchronous write sites, so an export durably records which canonical report it is. This exposed and fixed a real classification defect: catalog lookup keyed off the registry slug never matched any of the 167 registered keys, so statutory reports were classified `CONFIDENTIAL`. Focused reports tests 24/24; clean replay of all 97 migrations on a throwaway database, then removed. |
| 2026-08-01 | FIN/UI-P0-02 (partial) | Pointed the FEE-01 export executor at the enveloped projection. Added `FinanceService.getStudentFeeLedgerExport`, which drains the same SQL projection the screen renders using bounded 500-row server-side paging under a 10,000-row ceiling; an oversized ledger is refused with guidance to narrow the range rather than truncated. Added an optional `ReportExecutor.executeTotals` hook and wired it for FEE-01, which revived the dead `ReportExport.displayedTotals` field (previously written as `{}` everywhere). Row and totals executors share one filter mapper so they cannot drift onto different filters. Totals are read from a single minimal page because window totals are report-wide aggregates, avoiding a second full drain. Verified 21/21 real-PostgreSQL, 518/518 focused API. |
| 2026-08-01 | FIN/UI-P0-02 (partial) | Embedded the classification watermark and backend-owned control totals inside the FEE-01 PDF and XLSX artifacts. Previously both existed only as export-record and File Registry metadata, so a downloaded file carried neither its marking nor its official figures once separated from the record describing it. `buildTableReportPdf` gained a `watermark` input and now renders the totals through its existing `CONTROL TOTALS` summary block; the XLSX gained a `Report Metadata` sheet so the data grid stays machine-readable from row 1. Totals are computed once per export and shared by the artifact builder and the export record, so the embedded and recorded figures cannot diverge. Asserted by parsing real artifact bytes; both assertions were mutation-checked by reverting each change and confirming the test fails. Focused reports 26/26, focused API 520/520, integration 21/21. |
| 2026-08-01 | Checkout reconciliation | Completed the interrupted verification sequence after the central cash-control report registrations; all seven gates pass (516/516 focused API, 17/17 focused web). Corrected a real money-validation regression in the fee-setup decimal-string DTOs, a pre-existing null-payload crash in discount creation, and two stale test fixtures. Seven focused tests added. No tracker row advances to PASS from this work — it restores and pins existing behavior rather than completing new requirements. |

## Change log

| Date | Change |
| --- | --- |
| 2026-08-01 | Froze the initial inventory at 75 canonical reports plus 22 cross-cutting requirements. Excluded FA-01 by owner decision. |
