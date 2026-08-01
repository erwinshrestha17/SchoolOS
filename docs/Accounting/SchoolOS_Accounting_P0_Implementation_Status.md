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
| AR-01 | M3 | 02 | PARTIAL | Invoice data and reports exist; P0 metadata, posting lineage, and export parity remain incomplete. |
| AR-02 | M11 | 02 | PARTIAL | Receivable totals exist in M3; M11 control reconciliation is incomplete. |
| AR-03 | M11 | 02 | PARTIAL | Student ledger exists; M11 debtor-control lineage is incomplete. |
| AR-04 | M11 | 02 | PARTIAL | Adjustment/reversal workflows exist in part; a canonical credit-note register is incomplete. |
| AR-05 | M11 | 02 | PARTIAL | Adjustment workflows exist in part; a canonical debit-note register is incomplete. |
| AR-06 | M3 | 03 | BLOCKED | Payments are currently invoice-bound; authoritative unallocated allocation is missing. |
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
| CB-08 | M3/M11 | 03 | BLOCKED | Deposit preparation and deposit lifecycle are missing. |
| CB-09 | M3/M11 | 03 | BLOCKED | Undeposited collections lack an authoritative deposit model. |
| CB-10 | M3/M11 | 03 | PARTIAL | Provider intents/callbacks exist; settlement-to-M11 reconciliation is incomplete. |
| CB-11 | M3/M11 | 03 | PARTIAL | Provider reconciliation exists in part; canonical wallet/QR report is incomplete. |
| CB-12 | M3/M11 | 03 | PARTIAL | Cashier close exists; full session lifecycle is incomplete. |
| CB-13 | M3/M11 | 03 | PARTIAL | Variance fields exist; lifecycle, approval, and deposit lineage are incomplete. |
| FEE-01 | M3 | 02 | PARTIAL | Student ledger exists; allocation, correction, posting, and export evidence need closure. |
| FEE-02 | M3 | 02 | PARTIAL | Collection reporting exists; canonical class/section contract needs closure. |
| FEE-03 | M3 | 02 | PARTIAL | Collection reporting exists; canonical fee-head contract needs closure. |
| FEE-04 | M3 | 02 | PARTIAL | Daily collection reporting exists; lifecycle and export parity need closure. |
| FEE-05 | M3 | 02 | PARTIAL | Monthly collection reporting exists; P0 metadata and drill-down need closure. |
| FEE-06 | M3 | 02 | PARTIAL | Outstanding reporting exists; complete authoritative ledger projection needs closure. |
| FEE-07 | M3/M11 | 02 | PARTIAL | Aging exists; M11 control reconciliation and report metadata need closure. |
| FEE-08 | M3 | 02 | PARTIAL | Advance flag exists; allocation and credit-balance truth are incomplete. |
| FEE-09 | M3 | 02 | PARTIAL | Partial payment exists; canonical allocation history is incomplete. |
| FEE-10 | M3 | 02 | PARTIAL | Overpayment states exist in part; canonical credit-balance report is incomplete. |
| FEE-11 | M3 | 02 | PARTIAL | Discounts exist; complete report metadata and history need closure. |
| FEE-12 | M3 | 02 | PARTIAL | Scholarship/concession data exists in part; canonical report needs closure. |
| FEE-13 | M3 | 02 | PARTIAL | Late-fee data exists in part; canonical report needs closure. |
| FEE-14 | M3 | 02 | PARTIAL | Waivers exist; complete report and correction lineage need closure. |
| FEE-15 | M3 | 03 | PARTIAL | Refunds exist; canonical report and M11 posting state need closure. |
| FEE-16 | M3 | 03 | PARTIAL | Reversal/receipt history exists; canonical void register needs closure. |
| FEE-17 | M3 | 03 | PARTIAL | Receipt register exists; full sequence and export evidence need closure. |
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
| X-P0-05 | Decimal-string money contract from backend through web/mobile | 01–08 | PARTIAL | Modern accounting reports use strings; legacy/shared/mobile finance shapes still permit numbers. |
| X-P0-06 | Idempotent money, posting, callback, and export commands | 01–09 | PARTIAL | Several commands are idempotent; source batches and complete retry coverage remain. |
| X-P0-07 | Posted/confirmed records corrected only by reversal/replacement | 01–09 | PARTIAL | Journal/payment reversal exists; all AP/cashier/export evidence remains. |
| X-P0-08 | Fiscal lock, approved reopen, warning, and explicit relock | 01 | PASS | FiscalPeriod is canonical; reopen requires generic approval and a reason, self-approval is denied, the warning persists, and explicit relock clears it with audit evidence. |
| X-P0-09 | Source posting batch status, retry, failure, and reconciliation | 01/07/09 | PARTIAL | M3/M7 batches and items now expose source/posted totals, difference, journal lineage, failure state, and concurrency-safe audited retry; automatic persistence of every rolled-back source failure remains. |
| X-P0-10 | Server-owned fiscal context on every finance surface | 01–09 | PARTIAL | The eight-destination Accountant shell now shows the backend fiscal year, open period, accrual/posted basis, lock failure, and reopened warning; M3/M7 and mobile surface consistency remains. |
| X-P0-11 | Server pagination, bounded aggregates, and tenant-scoped indexes | 01–09 | PARTIAL | Some lists are paginated; complete report/list and query-plan proof remains. |
| X-P0-12 | Context-preserving report-to-source drill-down | 01–09 | PARTIAL | Some journal links exist; full statement-to-source chain remains. |
| X-P0-13 | UI/API/export filter and total parity with protected files | 01/09 | PARTIAL | CSV/PDF/XLSX exports now retain normalized parameters, checksum, classification, expiry, requester, File Registry ID, and request/download permission revalidation; displayed-total parity remains incomplete. |
| X-P0-14 | BS-only shared school-facing date formatting and Nepal timezone | 01–09 | PARTIAL | Shared helpers exist; finance surfaces and exports need a complete audit. |
| X-P0-15 | Keyboard, screen reader, zoom, responsive, reduced-motion, and Nepali-text accessibility | 01–09 | PARTIAL | Shared primitives exist; finance-wide manual and automated evidence remains. |
| X-P0-16 | Parent linked-child fees, payments, receipts, corrections, and protected files | 02/03 | PARTIAL | Purpose-limited routes exist; decimal/lifecycle/history/correction closure remains. |
| X-P0-17 | Principal server-projected read-only web/mobile finance and designated approvals | 08 | BLOCKED | Generic snapshots exist; the purpose-limited finance projection is missing. |
| X-P0-18 | No native Accountant mobile operations | 01–09 | PASS | Repository route/feature inventory confirms no Accountant Flutter workspace. |
| X-P0-19 | Sensitive financial actions and access are audited with safe payloads | 01–09 | PARTIAL | Audit service exists; new actions and export access coverage remain. |
| X-P0-20 | Financial evidence uses File Registry and protected download helpers | 01–09 | PARTIAL | Receipt/payroll/report file paths exist; complete export/supporting-document coverage remains. |
| X-P0-21 | Honest loading, empty, stale, failure, denied, locked, queued, and partial states | 01–09 | PARTIAL | Current workspaces cover some states; shared finance states are incomplete. |
| X-P0-22 | Versioned report metadata, freshness, validation, classification, and expiry | 01/09 | PARTIAL | The typed 75-report catalog and shared response/export metadata contract now carry version, basis, normalized filters, freshness, validation, classification, checksum, and expiry; every renderer must still adopt it. |

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

## Implementation evidence log

| Date | Slice | Evidence |
| --- | --- | --- |
| 2026-08-01 | FIN/UI-P0-01 | Typed 75-report catalog, decimal metadata contract, additive P0 schema/migrations, finance permission reconciliation, time-bounded auditor, approved fiscal reopen/relock, exactly-eight-destination Accountant shell, typed accessible report table, protected XLSX export metadata, and M3/M7 posting-batch lineage/retry implemented. Focused accounting posting/retry tests pass 7/7; API and web typechecks pass. |

## Change log

| Date | Change |
| --- | --- |
| 2026-08-01 | Froze the initial inventory at 75 canonical reports plus 22 cross-cutting requirements. Excluded FA-01 by owner decision. |
