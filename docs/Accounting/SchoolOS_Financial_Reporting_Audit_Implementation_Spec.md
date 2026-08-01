# SchoolOS Financial Reporting — Audited Architecture, Module Map, Implementation Prompt, and Prioritized Development Specification

## Document status

- **Product scope:** Nepal-scoped SchoolOS.
- **Current execution boundary:** P0 is active. P1 and P2 entries in this document are backlog definitions, not authorization to implement them now.
- **Primary modules:** M3 Fees and Receipts, M7 HR and Payroll, and M11 Accounting and Finance.
- **Accounting authority:** M11 is the authoritative general-ledger and financial-statement module. M3 and M7 retain their operational subledgers and send controlled, idempotent posting events into M11.
- **Audience:** Product owner, engineering, QA, accountant, principal, auditor, and pilot-school reviewer.

---

# 1. Audit outcome

The source catalogue is broad enough to support a mature school finance function, but it is not yet implementation-safe as written. It mixes operational registers, accounting reports, management analytics, statutory schedules, and dashboards without consistently defining ownership, accounting authority, posting state, drill-down lineage, access control, or release priority.

## What is strong

- Covers financial statements, fee receivables, cash and bank, payables, payroll, tax, assets, funds, audit controls, and leadership reporting.
- Correctly emphasizes receipt integrity, reversals, audit trails, bank reconciliation, and drill-down to source evidence.
- Recognizes Nepal fiscal-year and BS/AD presentation requirements.
- Provides a useful P0/P1/P2 starting point.

## Material issues found

1. **Module ownership is ambiguous.** Fee, payroll, and accounting versions of the same figure could diverge unless M3, M7, and M11 authority is explicit.
2. **Several reports are duplicated or are only filtered views of one report.** Examples include Income Statement versus Income and Expenditure, Fee Aging versus Accounts Receivable Aging, Supplier Ledger versus Vendor Ledger, and multiple fee/expense breakdown reports.
3. **The P0 list is too feature-oriented and not dependency-ordered.** Statements cannot be trusted before chart of accounts, fiscal periods, posting contracts, reversals, opening balances, and source-to-ledger reconciliation are complete.
4. **Report accounting basis is unspecified.** Reports need explicit posted/draft behavior, accrual/cash basis, as-of date, comparative periods, and treatment of reversals and late adjustments.
5. **Security is not defined per report.** Principal, Accountant, HR, Admin, auditor, and owner/operator must not automatically receive identical access.
6. **No canonical report contract exists.** Filters, columns, totals, currencies, date display, pagination, export, checksum, watermark, and generation history need common rules.
7. **Tax language can overstate compliance.** TDS, VAT, PF/EPF, SSF, CIT, gratuity, and other statutory schedules must remain configurable and externally verified before SchoolOS labels them compliant.
8. **The dashboard is described as a list of numbers rather than a server-side persona projection.** It needs defined metrics, thresholds, freshness, drill-down, and read-only permissions.
9. **Procurement is over-scoped for the pilot.** Purchase orders, goods receipts, and three-way matching are valuable but should not block a financially safe P0 unless the pilot school requires procurement at go-live.
10. **Audit evidence requirements are incomplete.** A report must be reproducible from an immutable snapshot or deterministic query parameters, with source lineage and generation history.

## Improvements applied

- Established M11 as the accounting authority and retained M3/M7 as operational source modules.
- Converted duplicated reports into canonical reports or saved views while preserving every source report in the mapping appendix.
- Reordered implementation around dependencies and financial integrity.
- Added report contracts, security, drill-down, auditability, exports, localization, and testing requirements.
- Split P0 into bounded engineering slices; P1/P2 remain backlog only.
- Added a copy-ready implementation prompt and explicit Definition of Done.

---

# 2. Canonical module ownership
| Layer | Owns | Must not own |
|---|---|---|
| **M3 — Fees and Receipts** | Fee plans, invoices, student fee subledger, collection events, payment intents/callbacks, receipts, cashier sessions, refunds, reversals, fee aging, operational settlement | General ledger, final financial statements, fiscal-period control, bank-ledger authority |
| **M7 — HR and Payroll** | Approved payroll-run data, earnings, allowances, deductions, paid days, staff loans/advances, payroll corrections, payslip and bank-file inputs | General ledger, final salary expense/payable balance, bank reconciliation, tax filing authority |
| **M11 — Accounting and Finance** | Chart of accounts, fiscal periods, journals/vouchers, source posting, cash/bank ledger, receivables/payables control accounts, financial statements, tax liabilities, assets, funds, audit reports, protected exports | Recalculating student invoices independently of M3 or recalculating employee payroll independently of M7 |

## Authority rules

1. **Operational detail stays in the source module.** M3 remains authoritative for an individual student invoice, payment, receipt, refund, and fee balance. M7 remains authoritative for an approved employee payroll run and its employee-level components.
2. **Accounting balances come from M11.** Any balance sheet, financial-performance, cash/bank, payable, liability, fund, or GL report must derive from posted M11 entries.
3. **Cross-module totals must reconcile.** Every M3 and M7 source batch must expose posting state, journal ID, rejected reason, retry status, and reconciliation difference.
4. **No double calculation.** M11 consumes immutable source events/snapshots; it must not recreate fee or payroll calculations from unrelated raw tables.
5. **Reversals are additive.** Posted records are corrected by reversal and replacement, not destructive update or deletion.
6. **Reports are tenant-scoped and fail closed.** Client-supplied tenant IDs, roles, or personas never determine authorization.

---

# 3. Common report contract

Every report endpoint and export must implement these minimum fields and behaviours.

## Query contract

- Authenticated `tenantId` from trusted server context.
- Fiscal year and accounting period.
- `fromDate` / `toDate` or `asOfDate`, with canonical AD storage and BS/AD presentation.
- Posting state: posted-only by default; draft/unposted only on explicit privileged control reports.
- Branch, cost centre, department, class, section, fee head, account, vendor, employee, student, payment method, and source-module filters where applicable.
- Comparative period parameters where applicable.
- Pagination and deterministic sorting for detail registers.
- Currency fixed to tenant base currency for P0; NPR presentation for Nepal tenants.

## Response contract

- Report ID, title, description, basis, tenant, fiscal year, period, and generation timestamp.
- Applied filters and data freshness timestamp.
- Opening balance, period movement, closing balance, and totals where relevant.
- Decimal-safe amounts; no binary floating-point financial arithmetic.
- Explicit debit/credit sign policy.
- Source IDs and drill-down links from summary → line → ledger → voucher/journal → source event → approval → attachment → audit event.
- Empty-state explanation and validation warnings.
- `isDraft`, `isFinal`, `isComparative`, `hasUnpostedExceptions`, and `hasReconciliationDifference` indicators where relevant.

## Export contract

- PDF for controlled presentation; XLSX/CSV for analysis where permitted.
- Generation history, requester, report parameters, row count, totals, checksum, and storage reference.
- Draft/confidential/final watermark.
- Protected file authorization and expiring download URL.
- Reproducibility from stored parameters and source/version metadata.
- Large reports run through an auditable background job without losing tenant context.

## Access policy

- **Accountant:** full operational and accounting reports according to explicit capabilities.
- **Principal:** read-only summaries, exceptions, approvals, and permitted drill-down; no routine ledger mutation.
- **HR:** M7 payroll reports and limited payroll-posting status; no general ledger unless explicitly granted.
- **Admin:** operational source exception status only when permissioned; no unrestricted statements or payroll details.
- **Auditor:** time-bounded, read-only, export-controlled access with audit logging.
- **Owner/Management Committee:** approved final statements and management summaries, not automatically transaction-entry access.

---

# 4. Complete source-to-module report map

The table below accounts for every report in the supplied catalogue. Canonical IDs merge aliases and filtered views without dropping the original requested outputs.

## Core Financial Statements
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Income Statement / Profit and Loss Account | FS-01 — Statement of Financial Performance | M11 | M3, M7 | M11 general ledger | P0 | Implement as **Statement of Financial Performance**. Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Balance Sheet | FS-02 — Balance Sheet | M11 | M3, M7 | M11 general ledger | P0 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Cash Flow Statement | FS-03 — Cash Flow Statement | M11 | M3, M7 | M11 general ledger | P1 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Trial Balance | FS-04 — Trial Balance | M11 | M3, M7 | M11 general ledger | P0 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| General Ledger | FS-05 — General Ledger | M11 | M3, M7 | M11 general ledger | P0 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Journal Register | FS-06 — Journal Register | M11 | M3, M7 | M11 general ledger | P0 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Receipts and Payments Account | FS-07 — Receipts and Payments Account | M11 | M3, M7 | M11 general ledger | P0 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Income and Expenditure Account | FS-01 — Statement of Financial Performance | M11 | M3, M7 | M11 general ledger | P0 | Implement as **Statement of Financial Performance**. Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Statement of Changes in Funds/Equity | FS-08 — Statement of Changes in Funds/Equity | M11 | M3, M7 | M11 general ledger | P1 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |
| Notes to Financial Statements | FS-09 — Notes to Financial Statements | M11 | M3, M7 | M11 general ledger | P1 | Only posted, reversal-aware entries; financial-statement variants are presentation policies. |

## Student Fee Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Student Fee Ledger | FEE-01 — Student Fee Ledger | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Class-wise Fee Collection Report | FEE-02 — Fee Collection Analysis — class/section view | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Fee Collection Analysis — class/section view**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Fee Head-wise Collection Report | FEE-03 — Fee Collection Analysis — fee-head view | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Fee Collection Analysis — fee-head view**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Daily Fee Collection Report | FEE-04 — Fee Collection Analysis — daily view | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Fee Collection Analysis — daily view**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Monthly Fee Collection Report | FEE-05 — Fee Collection Analysis — monthly view | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Fee Collection Analysis — monthly view**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Outstanding Fee Report | FEE-06 — Outstanding Fee Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Fee Aging Report | FEE-07 — Receivables Aging | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Receivables Aging**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Advance Fee Report | FEE-08 — Advance Fee Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Partial Payment Report | FEE-09 — Partial Payment Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Overpayment/Credit Balance Report | FEE-10 — Overpayment/Credit Balance Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Fee Discount Report | FEE-11 — Fee Discount Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Scholarship and Concession Report | FEE-12 — Scholarship and Concession Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Late Fee Report | FEE-13 — Late Fee Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Fee Waiver Report | FEE-14 — Fee Waiver Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Refund Report | FEE-15 — Refund Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Cancelled Receipt Report | FEE-16 — Voided/Cancelled Receipt Register | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Voided/Cancelled Receipt Register**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Receipt Register | FEE-17 — Receipt Register | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Collection Method Report | FEE-18 — Fee Collection Analysis — payment-method view | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | Implement as **Fee Collection Analysis — payment-method view**. M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Student Withdrawal Settlement Report | FEE-19 — Student Withdrawal Settlement Report | M3 | M11 | M3 student fee subledger; M11 GL control account | P0 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |
| Fee Collection Target vs Actual | FEE-20 — Fee Collection Target vs Actual | M3 | M11 | M3 student fee subledger; M11 GL control account | P1 | M3 renders student-level operations; M11 validates posted totals and drill-down lineage. |

## Billing and Receivable Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Student Invoice Register | AR-01 — Student Invoice Register | M3 | M11 | M3 student fee subledger | P0 | M11 receives idempotent postings and reconciliation status. |
| Accounts Receivable Summary | AR-02 — Accounts Receivable Summary | M11 | M3 | M11 receivables control; M3 student detail | P0 | Student drill-down must preserve M3 source IDs and M11 journal lineage. |
| Accounts Receivable Aging | FEE-07 — Receivables Aging | M11 | M3 | M11 receivables control; M3 student detail | P0 | Implement as **Receivables Aging**. Student drill-down must preserve M3 source IDs and M11 journal lineage. |
| Debtor Ledger | AR-03 — Debtor Ledger | M11 | M3 | M11 receivables control; M3 student detail | P0 | Student drill-down must preserve M3 source IDs and M11 journal lineage. |
| Credit Note Register | AR-04 — Credit Note Register | M11 | M3 | M11 receivables control; M3 student detail | P0 | Student drill-down must preserve M3 source IDs and M11 journal lineage. |
| Debit Note Register | AR-05 — Debit Note Register | M11 | M3 | M11 receivables control; M3 student detail | P0 | Student drill-down must preserve M3 source IDs and M11 journal lineage. |
| Unallocated Payment Report | AR-06 — Unallocated Payment Report | M3 | M11 | M3 student fee subledger | P0 | M11 receives idempotent postings and reconciliation status. |
| Bad Debt/Write-off Report | AR-07 — Bad Debt/Write-off Report | M11 | M3 | M11 receivables control; M3 student detail | P1 | Student drill-down must preserve M3 source IDs and M11 journal lineage. |
| Recovery and Follow-up Report | AR-08 — Recovery and Follow-up Report | M3 | M11 | M3 student fee subledger | P1 | M11 receives idempotent postings and reconciliation status. |

## Expense and Payable Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Expense Register | AP-01 — Expense Register | M11 | M7 where employee-related | M11 | P0 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Expense Head-wise Report | AP-02 — Expense Analysis — account view | M11 | M7 where employee-related | M11 | P1 | Implement as **Expense Analysis — account view**. Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Department-wise Expense Report | AP-03 — Expense Analysis — department view | M11 | M7 where employee-related | M11 | P1 | Implement as **Expense Analysis — department view**. Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Project/Program-wise Expense Report | AP-04 — Expense Analysis — project/program view | M11 | M7 where employee-related | M11 | P1 | Implement as **Expense Analysis — project/program view**. Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Vendor-wise Purchase Report | AP-05 — Vendor-wise Purchase Report | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Accounts Payable Summary | AP-06 — Accounts Payable Summary | M11 | M7 where employee-related | M11 | P0 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Accounts Payable Aging | AP-07 — Accounts Payable Aging | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Supplier Ledger | AP-08 — Vendor Ledger | M11 | M7 where employee-related | M11 | P0 | Implement as **Vendor Ledger**. Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Purchase Register | AP-09 — Purchase Register | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Purchase Order Report | AP-10 — Purchase Order Report | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Goods Receipt Report | AP-11 — Goods Receipt Report | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Invoice Matching Report | AP-12 — Invoice Matching Report | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Payment Due Report | AP-13 — Payment Due Report | M11 | M7 where employee-related | M11 | P0 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Advance to Supplier Report | AP-14 — Advance to Supplier Report | M11 | M7 where employee-related | M11 | P1 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Employee Advance Report | AP-15 — Employee Advance Report | M7 | M11 | M7 employee workflow; M11 accounting balance | P1 | M7 owns employee request/settlement context; M11 owns posting and payable/advance balances. |
| Expense Reimbursement Report | AP-16 — Expense Reimbursement Report | M7 | M11 | M7 employee workflow; M11 accounting balance | P1 | M7 owns employee request/settlement context; M11 owns posting and payable/advance balances. |
| Petty Cash Expense Report | AP-17 — Petty Cash Expense Report | M11 | M7 where employee-related | M11 | P0 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |
| Recurring Expense Report | AP-18 — Recurring Expense Report | M11 | M7 where employee-related | M11 | P0 | Procurement is not a separate current module; keep basic expense/AP in M11 and defer full procurement workflow to P1. |

## Cash and Bank Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Cash Book | CB-01 — Cash Book | M11 | M3 | M11 cash/bank ledger | P0 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Bank Book | CB-02 — Bank Book | M11 | M3 | M11 cash/bank ledger | P0 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Cash Position Report | CB-03 — Cash Position Report | M11 | M3 | M11 cash/bank ledger | P0 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Bank Balance Report | CB-04 — Bank Balance Report | M11 | M3 | M11 cash/bank ledger | P0 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Bank Reconciliation Statement | CB-05 — Bank Reconciliation Statement | M11 | M3 | M11 cash/bank ledger | P0 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Unreconciled Transaction Report | CB-06 — Unreconciled Transaction Report | M11 | M3 | M11 cash/bank ledger | P0 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Cheque Register | CB-07 — Cheque Register | M11 | M3 | M11 cash/bank ledger | P1 | Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |
| Cash Deposit Report | CB-08 — Cash Deposit Report | M3 | M11 | M3 collection/cashier source; M11 cash/bank ledger | P0 | Operational close and settlement occur in M3; final cash/bank position and reconciliation remain M11-authoritative. |
| Undeposited Collection Report | CB-09 — Undeposited Collection Report | M3 | M11 | M3 collection/cashier source; M11 cash/bank ledger | P0 | Operational close and settlement occur in M3; final cash/bank position and reconciliation remain M11-authoritative. |
| Payment Gateway Settlement Report | CB-10 — Payment Gateway Settlement Report | M3 | M11 | M3 collection/cashier source; M11 cash/bank ledger | P0 | Operational close and settlement occur in M3; final cash/bank position and reconciliation remain M11-authoritative. |
| Wallet/QR Reconciliation Report | CB-11 — Wallet/QR Reconciliation Report | M3 | M11 | M3 collection/cashier source; M11 cash/bank ledger | P0 | Operational close and settlement occur in M3; final cash/bank position and reconciliation remain M11-authoritative. |
| Cashier Closing Report | CB-12 — Cashier Closing Report | M3 | M11 | M3 collection/cashier source; M11 cash/bank ledger | P0 | Operational close and settlement occur in M3; final cash/bank position and reconciliation remain M11-authoritative. |
| Cash Variance Report | CB-13 — Cash Variance Report | M3 | M11 | M3 collection/cashier source; M11 cash/bank ledger | P0 | Operational close and settlement occur in M3; final cash/bank position and reconciliation remain M11-authoritative. |
| Fund Transfer Report | CB-14 — Fund Transfer Register | M11 | M3 | M11 cash/bank ledger | P1 | Implement as **Fund Transfer Register**. Cash and bank reports must reconcile to posted vouchers and bank-statement matches. |

## Budget and Management Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Annual Budget Report | MGMT-01 — Annual Budget Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Budget vs Actual Report | MGMT-02 — Budget vs Actual Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Budget Variance Report | MGMT-03 — Budget vs Actual — variance view | M11 | M3, M7 | M11 management reporting projection | P1 | Implement as **Budget vs Actual — variance view**. Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Department Budget Report | MGMT-04 — Department Budget Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Monthly Financial Performance Report | MGMT-05 — Periodic Financial Performance — monthly | M11 | M3, M7 | M11 management reporting projection | P0 | Implement as **Periodic Financial Performance — monthly**. Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Quarterly Financial Report | MGMT-06 — Periodic Financial Performance — quarterly | M11 | M3, M7 | M11 management reporting projection | P1 | Implement as **Periodic Financial Performance — quarterly**. Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Year-to-Date Financial Summary | MGMT-07 — Periodic Financial Performance — year-to-date | M11 | M3, M7 | M11 management reporting projection | P0 | Implement as **Periodic Financial Performance — year-to-date**. Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Revenue Trend Report | MGMT-08 — Revenue Trend Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Expense Trend Report | MGMT-09 — Expense Trend Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Cost per Student Report | MGMT-10 — Cost per Student Report | M11 | M7 | M11 management reporting projection | P2 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Revenue per Student Report | MGMT-11 — Revenue per Student Report | M11 | M3 | M11 management reporting projection | P2 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Class/Grade Profitability Report | MGMT-12 — Class/Grade Profitability Report | M11 | M3 | M11 management reporting projection | P2 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Branch-wise Financial Report | MGMT-13 — Branch-wise Financial Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Department Cost Report | MGMT-14 — Department Cost Report | M11 | M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Cash Forecast Report | MGMT-15 — Cash-Flow Forecast | M11 | M3, M7 | M11 management reporting projection | P1 | Implement as **Cash-Flow Forecast**. Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Working Capital Report | MGMT-16 — Working Capital Report | M11 | M3, M7 | M11 management reporting projection | P1 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |
| Financial KPI Dashboard | MGMT-17 — Financial KPI Dashboard | M11 | M3, M7 | M11 management reporting projection | P0 | Derived metrics require published definitions, denominator rules, period filters, and drill-down. |

## Payroll-Related Accounting Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Payroll Summary | PAY-01 — Payroll Summary | M7 | M11 | M7 approved payroll run; M11 posted balances | P0 | No access to unrelated HR data; statutory schedules require external Nepal verification. |
| Salary Expense Report | PAY-02 — Salary Expense Report | M7 | M11 | M7 approved payroll run; M11 posted balances | P0 | No access to unrelated HR data; statutory schedules require external Nepal verification. |
| Payroll Liability Report | PAY-03 — Payroll Liability Report | M11 | M7 | M11 payroll payable/GL; M7 approved payroll run | P0 | M7 supplies immutable approved payroll-run snapshots; M11 owns accounting status and payment reconciliation. |
| Tax Deduction Report | PAY-04 — Tax Deduction Report | M7 | M11 | M7 approved payroll run; M11 posted balances | P0 | No access to unrelated HR data; statutory schedules require external Nepal verification. |
| Provident Fund Report | PAY-05 — Provident Fund Report | M7 | M11 | M7 approved payroll run; M11 posted balances | P1 | No access to unrelated HR data; statutory schedules require external Nepal verification. |
| Gratuity Provision Report | PAY-06 — Gratuity Provision Report | M7 | M11 | M7 approved payroll run; M11 posted balances | P1 | No access to unrelated HR data; statutory schedules require external Nepal verification. |
| Employee Loan Report | PAY-07 — Employee Loan Report | M7 | M11 | M7 approved payroll run; M11 posted balances | P1 | No access to unrelated HR data; statutory schedules require external Nepal verification. |
| Payroll Payment Reconciliation | PAY-08 — Payroll Payment Reconciliation | M11 | M7 | M11 payroll payable/GL; M7 approved payroll run | P0 | M7 supplies immutable approved payroll-run snapshots; M11 owns accounting status and payment reconciliation. |
| Unpaid Salary Report | PAY-09 — Unpaid Salary Report | M11 | M7 | M11 payroll payable/GL; M7 approved payroll run | P0 | M7 supplies immutable approved payroll-run snapshots; M11 owns accounting status and payment reconciliation. |
| Payroll Journal Report | PAY-10 — Payroll Journal Report | M11 | M7 | M11 payroll payable/GL; M7 approved payroll run | P0 | M7 supplies immutable approved payroll-run snapshots; M11 owns accounting status and payment reconciliation. |

## Tax and Nepal Compliance Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| TDS Deduction Report | TAX-01 — TDS Deduction Report | M11 | M7 | M11 tax liability and filing register | P0 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| TDS Payable Report | TAX-02 — TDS Payable Report | M11 | M7 | M11 tax liability and filing register | P0 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| TDS Deposit and Filing Report | TAX-03 — TDS Deposit and Filing Report | M11 | M7 | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| VAT Purchase Register | TAX-04 — VAT Purchase Register | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| VAT Sales/Income Register | TAX-05 — VAT Sales/Income Register | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Input VAT Report | TAX-06 — Input VAT Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Output VAT Report | TAX-07 — Output VAT Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| VAT Reconciliation Report | TAX-08 — VAT Reconciliation Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| PAN-wise Vendor Payment Report | TAX-09 — PAN-wise Vendor Payment Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Taxable and Exempt Transaction Report | TAX-10 — Taxable and Exempt Transaction Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Fiscal Year Tax Summary | TAX-11 — Fiscal Year Tax Summary | M11 | M7 | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Tax Payment Calendar | TAX-12 — Tax Payment Calendar | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Withholding Certificate Register | TAX-13 — Withholding Certificate Register | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Rent Tax/TDS Report | TAX-14 — Rent Tax/TDS Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |
| Audit Adjustment Report | TAX-15 — Audit Adjustment Report | M11 | M7 where payroll-related | M11 tax liability and filing register | P1 | Configurable by school legal/tax status; do not label compliant until reviewed by a Nepal-qualified professional. |

## Fixed Asset Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Fixed Asset Register | FA-01 — Fixed Asset Register | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P0 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Category Report | FA-02 — Asset Category Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Depreciation Schedule | FA-03 — Depreciation Schedule | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Addition Report | FA-04 — Asset Addition Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Disposal Report | FA-05 — Asset Disposal Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Transfer Report | FA-06 — Asset Transfer Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Revaluation Report | FA-07 — Asset Revaluation Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P2 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Verification Report | FA-08 — Asset Verification Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Missing/Damaged Asset Report | FA-09 — Missing/Damaged Asset Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Capital Work-in-Progress Report | FA-10 — Capital Work-in-Progress Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Asset Maintenance Cost Report | FA-11 — Asset Maintenance Cost Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |
| Fully Depreciated Asset Report | FA-12 — Fully Depreciated Asset Report | M11 | M7 for employee custodian identity | M11 fixed-asset subledger | P1 | Asset register and depreciation must tie to acquisition/disposal journals. |

## Fund, Grant, Donation, and Restricted Money Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Fund-wise Ledger | FUND-01 — Fund-wise Ledger | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Restricted Fund Report | FUND-02 — Restricted Fund Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Unrestricted Fund Report | FUND-03 — Unrestricted Fund Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Grant Receipt and Utilization Report | FUND-04 — Grant Receipt and Utilization Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Donor-wise Contribution Report | FUND-05 — Donor-wise Contribution Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Donation Receipt Register | FUND-06 — Donation Receipt Register | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Scholarship Fund Report | FUND-07 — Scholarship Fund Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Building Fund Report | FUND-08 — Building Fund Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Activity/Event Fund Report | FUND-09 — Activity/Event Fund Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Fund Transfer Report | CB-14 — Fund Transfer Register | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Implement as **Fund Transfer Register**. Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |
| Unused Grant Balance Report | FUND-10 — Unused Grant Balance Report | M11 | M3 where student fee/fund collections originate | M11 fund accounting ledger | P1 | Use fund dimensions/restrictions; prevent use beyond approved purpose through workflow controls. |

## Audit and Control Reports
| Source report | Canonical ID / output | Primary module | Contributors | Authority | Priority | Implementation disposition |
|---|---|---|---|---|---:|---|
| Audit Trail Report | AUD-01 — Audit Trail Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Voucher Register | AUD-02 — Voucher Register | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Unposted Voucher Report | AUD-03 — Unposted Voucher Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Reversed Transaction Report | AUD-04 — Reversed Transaction Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Deleted/Voided Transaction Report | AUD-05 — Voided Transaction Register | M11 | M3, M7 | M11 audit/reporting layer | P0 | Implement as **Voided Transaction Register**. Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Backdated Entry Report | AUD-06 — Backdated Entry Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Period Reopening Report | AUD-07 — Period Reopening Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Manual Journal Report | AUD-08 — Manual Journal Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| High-Value Transaction Report | AUD-09 — High-Value Transaction Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Duplicate Payment Report | AUD-10 — Duplicate Payment Report | M3 | M11 | M3 transaction controls; M11 audit lineage | P0 | Surface both operational source event and accounting posting status. |
| Missing Receipt Sequence Report | AUD-11 — Missing Receipt Sequence Report | M3 | M11 | M3 transaction controls; M11 audit lineage | P0 | Surface both operational source event and accounting posting status. |
| Approval Exception Report | AUD-12 — Approval Exception Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| User Activity Report | AUD-13 — User Activity Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Segregation-of-Duties Conflict Report | AUD-14 — Segregation-of-Duties Conflict Report | M11 | M3, M7 | M11 audit/reporting layer | P1 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Outstanding Audit Query Report | AUD-15 — Outstanding Audit Query Report | M11 | M3, M7 | M11 audit/reporting layer | P1 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Supporting Document Missing Report | AUD-16 — Supporting Document Exception Report | M11 | M3, M7 | M11 audit/reporting layer | P0 | Implement as **Supporting Document Exception Report**. Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Related-Party Transaction Report | AUD-17 — Related-Party Transaction Report | M11 | M3, M7 | M11 audit/reporting layer | P1 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Year-End Closing Report | AUD-18 — Year-End Closing Report | M11 | M3, M7 | M11 audit/reporting layer | P1 | Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |
| Opening Balance Verification Report | AUD-19 — Opening-to-Closing Balance Reconciliation | M11 | M3, M7 | M11 audit/reporting layer | P1 | Implement as **Opening-to-Closing Balance Reconciliation**. Depends on M0 authorization/audit infrastructure even though report ownership is mapped here to M11. |

---

# 5. Principal financial dashboard specification

The Principal dashboard is a read-only, server-projected management surface, not a collection of client-calculated report totals.
| Widget | Source | Minimum definition | Drill-down | Priority |
|---|---|---|---|---:|
| Fees billed, collected, outstanding | M3 + M11 | Net billed, confirmed collections, remaining student receivable for selected period | Fee billing summary → class/student ledger | P0 |
| Collection rate | M3 | Confirmed collection ÷ net collectible amount; denominator rule published | Fee collection performance | P0 |
| Cash and bank position | M11 | Posted cash accounts + reconciled/ledger bank balances, clearly distinguished | Cash book / bank book / reconciliation | P0 |
| Current-month income and expenditure | M11 | Posted accrual-basis financial performance for current fiscal period | Statement line → GL | P0 |
| Overdue student fees | M3 | Aging buckets and top attention items; hide unnecessary family details | Aging → scoped student ledger | P0 |
| Unposted source events | M11 + M3/M7 | Count and amount of rejected, pending, or failed source postings | Source posting report | P0 |
| Cashier/reconciliation exceptions | M3 + M11 | Open cashier differences, undeposited cash, unreconciled bank items | Exception register | P0 |
| Payroll cost and payable | M7 + M11 | Approved payroll total and remaining salary/statutory liabilities | Payroll reconciliation | P0 |
| High-value pending approvals | M11 | Configured threshold and approval workflow state | Voucher/approval | P0 |
| Budget vs actual | M11 | Approved budget version compared with posted actuals | Budget line → GL | P1 |
| Supplier obligations | M11 | Due and overdue AP by aging | AP aging → vendor ledger | P1 |
| Projected cash | M11 + M3/M7 | Forecast based on configured collection/payable/payroll assumptions | Forecast assumptions and cash schedule | P1 |
| Cost/revenue per student and profitability | M11 + M3/M7 | Published allocation methodology and enrolled-student denominator | Metric definition → component reports | P2 |

Dashboard requirements: no client persona parameter, server-side persona resolution, tenant-scoped queries, data-freshness timestamp, materiality thresholds, empty/error states, and no mutation from dashboard cards.

---

# 6. Prioritized development specification

## P0 — Financially safe controlled-pilot reporting

P0 is the only active implementation scope. Execute the slices sequentially; do not build P1/P2 features merely because their report names appear in the catalogue.

### FIN-P0-01 — Reporting and accounting foundations

**Objective:** Establish the primitives that make every later report trustworthy.

**Scope**
- Confirm chart of accounts, account types, normal balances, fiscal years/periods, opening balances, branch/cost-centre dimensions, journal/voucher states, and period locks.
- Define source posting contracts for M3 and M7 with immutable source IDs, idempotency keys, journal lineage, rejection reasons, and retry state.
- Create shared money/date/filter/report metadata types and permission capabilities.
- Implement report-run and export-generation audit records; avoid a generic end-user report builder in P0.

**Reports unlocked:** Chart of accounts, account balance summary, source-module posting, failed/unposted, opening-balance verification.

**Gate:** A clean database can post one fee event and one approved payroll event exactly once, reverse each, and trace both from source to M11 journal.

### FIN-P0-02 — M3 fee subledger and receivable reports

**Scope**
- Student fee ledger, invoice register, fee billing summary, collection analysis views, outstanding, aging, partial payments, advances/credits, discounts/scholarships/waivers, late fees, adjustments, withdrawal settlement, unallocated payments.
- Enforce confirmed-payment-only collection totals and tenant/student scoping.
- Reconcile M3 receivable subledger to the M11 student-fee control account by batch and period.

**Gate:** For a deterministic seed scenario, invoice − discounts − payments ± adjustments/refunds/reversals equals closing student balance and M11 control balance.

### FIN-P0-03 — Receipt, cashier, and digital-payment controls

**Scope**
- Daily collection register, receipt register, receipt sequence exceptions, cashier session/close, payment-method summary, failed/pending payments, refunds, reversals, cash deposit, undeposited collection, payment-gateway settlement, wallet/QR reconciliation, cash variance.
- Preserve immutable receipt numbers; record reprint, void, reversal, refund, and approval history.
- Ensure payment callbacks and posting are idempotent.

**Gate:** Duplicate callback and repeated close attempts cannot create duplicate payment, receipt, deposit, or journal records; expected-versus-actual cashier difference is explicit.

### FIN-P0-04 — M11 core accounting registers

**Scope**
- Journal register; receipt/payment/journal/contra/adjustment/reversal voucher registers; general ledger; trial balance; suspense/unclassified transactions; manual journal and backdated-entry reports.
- Apply posted-only defaults and expose draft/unposted only in privileged control reports.
- Make debit/credit and running-balance policies deterministic.

**Gate:** Every posted journal balances, trial balance debit equals credit, and GL totals tie to journal/voucher registers for the same filters.

### FIN-P0-05 — Cash, bank, and reconciliation

**Scope**
- Cash book, bank book, cash position, bank balance, bank reconciliation statement, unreconciled transactions, bank deposit pending, and current-period cash/bank attention items.
- Preserve imported bank statement lines and match/unmatch history.

**Gate:** Reconciliation equation is explicit and zero-difference when all test items are resolved; reopening or rematching is permissioned and audited.

### FIN-P0-06 — Expense, vendor, and basic payable controls

**Scope**
- Expense register, vendor ledger, AP summary, payment-due report, petty cash, recurring expenses, and source documents.
- Defer purchase-order, goods-receipt, and three-way matching workflow to P1 unless required by the pilot school contract.

**Gate:** Expense and payable entries post once, vendor balance reconciles to AP control account, and payment/reversal history remains traceable.

### FIN-P0-07 — M7 payroll reporting and accounting handoff

**Scope**
- Payroll summary/register, salary expense, deductions, payroll liabilities, unpaid salary, payroll journal, payroll payment reconciliation, adjustment/reversal, and TDS source schedule.
- Consume only approved payroll-run snapshots; do not expose unrelated HR fields to M11 users.
- Mark statutory outputs as configurable/unverified until professionally reviewed.

**Gate:** Approved payroll components tie to net pay + liabilities + employer costs and to the M11 payroll journal with zero unexplained difference.

### FIN-P0-08 — Core financial statements

**Scope**
- Statement of Financial Performance with Income/Expenditure and P&L presentation variants; Balance Sheet; Receipts and Payments Account; periodic monthly and YTD summaries.
- Define account-to-statement mapping, retained surplus/deficit behavior, comparative periods, and final/draft status.

**Gate:** Statement lines drill to GL; balance sheet balances; current-period surplus/deficit reconciles to financial-performance accounts and equity/fund treatment.

### FIN-P0-09 — Audit, access, dashboard, and exports

**Scope**
- Financial audit trail, reversed/voided/unposted reports, period reopening, high-value transactions, duplicate payments, missing receipt sequence, approval exceptions, user financial activity/access, supporting-document exceptions, and source posting failures.
- Principal dashboard P0 widgets and accountant report centre.
- PDF/XLSX/CSV generation with generation history, checksum, watermark, protected download, and audit event.

**Gate:** A reviewer can select any financial-statement amount and reach the source transaction, approval, attachment, and audit history without cross-tenant leakage.

## P1 — Operational maturity backlog

- Cash-flow statement and statement of changes in funds/equity.
- Notes/supporting schedules and year-end financial package.
- Full AP aging, purchase register, purchase orders, goods receipts, invoice matching, vendor/staff advances, reimbursements, and duplicate-invoice controls.
- Annual budgets, department budgets, budget-vs-actual, variance explanations, cash-flow forecast, working-capital report, trend reports, and richer KPI dashboard.
- Full statutory schedules, filing/deposit register, VAT registers/reconciliation where applicable, PAN-wise vendor reporting, certificates, and compliance calendar after professional validation.
- Fixed-asset depreciation, additions, transfers, disposal, verification, damage/missing, maintenance, CWIP, and fully depreciated assets.
- Fund/grant/donation/restricted-money accounting and auditor workspace/export pack.
- SoD conflict detection, audit-query management, related-party, audit-adjustment, prior-year, and year-end closing reports.

## P2 — Nepal-wide scale and advanced controls backlog

- Multi-branch statements, school-group consolidation, inter-branch elimination/reconciliation, and high-volume report generation.
- Cost per student, revenue per student, grade/program profitability, advanced allocation models, and multi-year trend analysis.
- Scenario budgeting, predictive fee-collection forecasting, and anomaly detection for payments/refunds/journals.
- Configurable municipality/institutional reporting packages and large audit evidence bundles.

---

# 7. API and service design requirements

## Recommended boundaries

```text
M3 operational report services
  → fee subledger / collection / receipt / cashier / settlement
  → emit immutable accounting source events

M7 operational report services
  → approved payroll-run / deduction / employee advance
  → emit immutable accounting source events

M11 accounting report services
  → posting ingestion and reconciliation
  → ledger and control reports
  → financial statements and management projections
  → audit/export jobs
```

## Endpoint principles

- Use explicit routes by report family; do not expose unrestricted SQL-like report builders.
- Resolve tenant, persona, and capabilities from authenticated server context.
- Do not accept a client-supplied persona or trusted tenant identifier.
- Use request DTOs with strict date/period/filter validation and reasonable maximum ranges.
- Return stable report schemas with report metadata and drill-down references.
- Use job endpoints for large exports; preserve authorization and filters at job creation and download.
- Cache only tenant-scoped, capability-compatible projections and invalidate on postings/reversals/period changes.

## Suggested capabilities

```text
FINANCE_REPORT_VIEW
FINANCE_REPORT_EXPORT
FINANCE_STATEMENT_VIEW
FINANCE_STATEMENT_FINALIZE
FEE_REPORT_VIEW
PAYROLL_ACCOUNTING_REPORT_VIEW
BANK_RECONCILIATION_VIEW
AUDIT_REPORT_VIEW
AUDITOR_EXPORT_GENERATE
PRINCIPAL_FINANCE_OVERSIGHT
```

Capabilities should be further restricted by branch, cost centre, payroll sensitivity, and approval policy where required.

---

# 8. Validation and test specification

## Financial invariants

- Every posted journal: total debit = total credit.
- Trial balance: closing debit total = closing credit total.
- Student fee closing balance = opening + invoices/debits − credits/discounts − payments + refunds/reversals according to signed policy.
- M3 fee subledger total = M11 fee receivable control account, subject only to explicit reconciliation exceptions.
- Payroll gross + employer costs = net payments + employee deductions/liabilities + other approved offsets under the configured journal mapping.
- M7 approved payroll posting = M11 payroll journal and payable balances.
- Cashier expected close = opening cash + cash receipts − cash refunds − approved cash outflows/transfers.
- Bank reconciliation difference = ledger balance adjusted for reconciling items − statement balance.
- Balance sheet: assets = liabilities + funds/equity under configured presentation policy.
- No posted transaction is destructively deleted.

## Required automated tests

- Unit tests for money arithmetic, sign policy, aging buckets, statement mapping, and reconciliation formulas.
- Integration tests for M3→M11 and M7→M11 idempotent posting, failure, retry, and reversal.
- Cross-tenant tests for every report family and export download.
- Capability/persona tests for Accountant, Principal, HR, Admin, auditor, and unauthorized users.
- Fiscal-period lock/reopen tests.
- Date boundary tests for Nepal timezone, fiscal-year boundaries, BS/AD display, leap dates, and inclusive/exclusive period rules.
- Pagination and deterministic ordering tests for registers.
- Export total/checksum/row-count tests.
- Performance tests using pilot-scale and projected P2-scale datasets.
- End-to-end drill-down test from dashboard/statement to source attachment and audit event.

---

# 9. Master implementation prompt

Copy the prompt below into Cursor/Codex. Execute only one bounded FIN-P0 slice per run unless the repository evidence proves that combining slices is safer and remains reviewable.

```text
You are implementing SchoolOS financial reporting for a Nepal-scoped, multi-tenant school operating system.

OBJECTIVE
Build the next bounded P0 financial-reporting slice from the SchoolOS Financial Reporting specification. M11 is the authoritative accounting/general-ledger module. M3 owns fees, invoices, payments, receipts, cashier operations, refunds, and the student fee subledger. M7 owns approved payroll-run details, earnings, deductions, staff loans/advances, corrections, and payroll source schedules. M3 and M7 must post immutable, idempotent source events into M11. Do not duplicate fee or payroll calculations in M11.

ACTIVE SCOPE
Implement: <FIN-P0-XX slice name and exact reports>
Do not implement P1/P2 features, procurement expansion, multi-branch consolidation, predictive analytics, or unverified tax automation.

NON-NEGOTIABLE RULES
1. Resolve tenantId, persona, roles, permissions, and capabilities from authenticated server context. Never trust client-supplied tenant or persona values.
2. Fail closed for disabled/missing entitlements and missing permissions.
3. Use decimal-safe financial arithmetic. Never use binary floating-point for money.
4. Posted financial records are immutable. Correct through reversal and replacement records with reasons and approvals.
5. Every M3/M7 source event has a stable source ID, event/version ID, idempotency key, source amount, source status, accounting status, journal ID, rejection reason, and retry history.
6. Report defaults use posted entries only. Draft/unposted entries appear only in explicit control reports with elevated permission.
7. Every summary amount must drill down to report line, account/ledger, journal/voucher, source transaction, approval, attachment, and audit event where applicable.
8. Support Nepal timezone, NPR presentation, Nepali Unicode, configurable Nepal fiscal years, and BS/AD display while storing canonical unambiguous dates.
9. Tax and statutory outputs must be configurable and marked unverified until reviewed by a Nepal-qualified accountant/tax professional. Do not make compliance claims.
10. Financial writes and finalization remain online-only. Do not add offline journal, payment, payroll-finalization, or statement-finalization behavior.

WORKFLOW
A. Inspect the existing M3, M7, M11, auth, audit, export, file, and dashboard contracts before changing code.
B. State the current implementation, gaps, assumptions, and exact bounded slice.
C. Reuse existing domain conventions and avoid parallel entities/services when an authoritative implementation already exists.
D. Implement database/domain changes, service queries, authorization, API DTOs/endpoints, web UI, exports, drill-down, audit events, and error/loading/empty states required by the slice.
E. Add deterministic fixtures covering invoices, partial payment, overpayment, refund, reversal, cashier close, payroll, opening balances, journal posting, and reconciliation as relevant to the slice.
F. Add unit, integration, E2E, cross-tenant, permission, period-lock, reversal, idempotency, and export tests.
G. Run targeted validation first, then the relevant API/web build and regression suites. Do not claim success for commands not executed.
H. Update the controlled-pilot evidence record with changed files, migrations, endpoints, permissions, tests, results, limitations, and status.

REPORT CONTRACT
- Trusted tenant context
- Fiscal year/period and from/to or as-of date
- Applied filters and deterministic sort
- Posting basis and data freshness
- Opening/movement/closing totals where relevant
- Stable decimal amounts and debit/credit policy
- Drill-down/source references
- Reconciliation and exception flags
- Protected PDF/XLSX/CSV export when in scope
- Generation history, checksum, requester, row count, totals, watermark, and audit event

ACCEPTANCE CRITERIA
- All accounting invariants for the slice pass.
- No cross-tenant or unauthorized report access.
- Repeated source posting/export requests are idempotent where required.
- Reversal scenarios preserve original records and produce correct report totals.
- Report totals reconcile to authoritative source modules and M11 control accounts.
- Principal access is read-only and projected server-side; Accountant access is capability-controlled; HR sees only permitted payroll/accounting data.
- Exports match on-screen filters and totals and are protected/audited.
- Clean typecheck/build/test results are recorded exactly.

FINAL RESPONSE FORMAT
1. Slice implemented
2. Prior behavior and root cause/gap
3. Architecture and authorization decisions
4. Changed files and migrations
5. Reports/endpoints/UI delivered
6. Tests and exact results
7. Reconciliation evidence
8. Known limitations and deferred P1/P2 work
9. Pilot-readiness evidence status: PASS / PARTIAL / BLOCKED
```

---

# 10. Universal Definition of Done

A financial report is not complete until all applicable items pass:

- Canonical definition and business purpose approved.
- Primary module and accounting authority documented.
- Metric/formula, accounting basis, sign convention, and date boundaries documented.
- Database and source-posting dependencies implemented.
- Tenant, entitlement, capability, branch, and sensitive-field authorization tested.
- API query and response contracts implemented.
- Web report with filters, totals, drill-down, loading, empty, validation, and error states.
- PDF/XLSX/CSV export where required, with checksum and generation history.
- Audit events for generation, export, finalization, reopen, reversal, and sensitive access.
- Source module and GL reconciliation passes.
- Unit, integration, E2E, cross-tenant, permission, idempotency, reversal, period, and export tests pass.
- Pilot-scale performance meets an explicitly recorded threshold.
- Nepal timezone, fiscal-year, NPR, Unicode, and BS/AD presentation verified.
- Known limitations and professional-verification status are visible.
- Controlled-pilot evidence entry is complete and reviewed.

## Final product decision

For the controlled pilot, SchoolOS should prioritize financial integrity and reconciliation over report count. A smaller set of reports that deterministically ties M3 and M7 to M11, preserves reversals, blocks unauthorized access, and drills to evidence is materially more valuable than implementing the entire catalogue as disconnected exports.