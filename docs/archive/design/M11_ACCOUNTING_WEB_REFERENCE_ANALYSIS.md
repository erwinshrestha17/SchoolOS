> Archived 2026-06-21. Unique implementation guidance was merged into `docs/design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md`. Retained as historical M11 reference analysis only.

# M11 Accounting — Web Reference Analysis

**Status:** Supporting M11 design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth.

This file replaces the obsolete `M9_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md` numbering. Accounting and Finance is now **M11**, not M9.

---

## 1. Purpose

M11 is the accounting control center for a Nepal school. It must help authorized finance users manage chart of accounts, vouchers, journals, ledgers, fiscal years, posting controls, reports, source mappings, bank reconciliation, audit trail, and principal read-only finance summaries.

The core surfaces are:

| Surface | Main user | Primary job |
|---|---|---|
| Admin web | Accountant, finance officer, bursar, super admin | Run controlled accounting operations with posting discipline, fiscal locks, reconciliation, exports, and auditability. |
| Principal mobile/web summary | Principal / school leader | Read-only financial health, snapshots, trends, and alerts without operational mutation controls. |

M11 must feel controlled, stable, and audit-ready. It must not look like a decorative dashboard, a generic billing page, or a fee-only report module.

---

## 2. Product, Accounting and Governance Boundaries

| Persona | Allowed visibility | Must not expose |
|---|---|---|
| Accountant / finance officer | Tenant-scoped accounts, vouchers, journals, ledgers, reports, bank reconciliation, source mappings, export jobs, snapshots, and accounting audit events according to permission. | Cross-tenant data, platform billing controls, raw object keys, provider secrets, or mutation actions outside permission. |
| Super admin | Full school-level accounting configuration and high-risk controls where permission allows. | Platform SaaS billing internals, unaudited support override, or bypass controls. |
| Principal / school leader | Read-only finance overview, report snapshots, KPIs, trends, and alerts. | Edit/post/reverse controls, source mapping mutation, period reopen controls, or private operational detail beyond leadership need. |
| Clerk / limited finance role | Narrow voucher, receipt, or report tasks allowed by RBAC. | Salary/bank-sensitive details, period controls, chart import, posting/reversal, or report exports unless explicitly permitted. |
| Auditor | Read-only audit trail, snapshots, before/after summaries, and protected exports where policy allows. | Mutation controls or unrelated student/staff private data. |

M11 Accounting is a school accounting module, not SchoolOS platform billing. Other modules must not directly write official ledger records from the browser. Cross-module accounting entries must use backend-owned accounting boundaries and source-mapping rules.

---

## 3. Recommended Route Map

```text
/dashboard/accounting
/dashboard/accounting/chart-of-accounts
/dashboard/accounting/chart-of-accounts/import
/dashboard/accounting/vouchers
/dashboard/accounting/vouchers/[voucherId]
/dashboard/accounting/journal-entries
/dashboard/accounting/journal-entries/[journalEntryId]
/dashboard/accounting/source-mapping
/dashboard/accounting/fiscal-years
/dashboard/accounting/banking/accounts
/dashboard/accounting/banking/reconciliation
/dashboard/accounting/banking/cheques
/dashboard/accounting/receivables
/dashboard/accounting/payables
/dashboard/accounting/reports
/dashboard/accounting/reports/trial-balance
/dashboard/accounting/reports/general-ledger
/dashboard/accounting/reports/balance-sheet
/dashboard/accounting/reports/income-expenditure
/dashboard/accounting/reports/cash-flow
/dashboard/accounting/audit-trail
/dashboard/accounting/settings
```

Route naming must follow the existing Next.js app-router structure if the repository already defines a different stable path. Treat unknown route/API contracts as `needs OpenAPI confirmation`.

---

## 4. Standard M11 Workspace Pattern

```text
Header: Accounting page title
Purpose: One-line finance/accounting job statement
Primary action: Contextual to the page, such as Create Voucher, Import Template, Run Report, or Reconcile Bank
Secondary actions: More Actions, export, print, schedule, view audit, help

KPI strip: Backend-provided money/status summaries only
Tabs/pages: Overview | Chart of Accounts | Vouchers | Journal Entries | Banking | Receivables | Payables | Reports | Audit Trail | Settings
Filters: Fiscal year | Period | Date range | Account | Source module | Status | Posted by | Branch/school unit
Main area: One task-first dashboard, table, tree, workflow, reconciliation grid, or report preview
Right rail: Selected source record, audit details, report queue, reconciliation confirmation, or snapshot registry
Sticky action bar: Only for multi-step import, posting, reconciliation, or period-close workflows
```

KPI cards, money values, period states, report totals, balances, source mapping health, reconciliation counts, and audit totals must come from backend summary/list metadata or render an honest unavailable state. The browser must not invent accounting truth.

---

## 5. Required Screens

### 5.1 Accounting Overview

- Backend-owned finance KPIs.
- Fiscal period status.
- Pending voucher approvals.
- Bank reconciliation attention items.
- Report snapshot status.
- Source mapping health.
- Principal read-only summary where permission allows.

### 5.2 Chart of Accounts

- Nepal-ready chart template support.
- Import preview before commit.
- Account type, code, parent, active/inactive state.
- No silent delete if account has history.

### 5.3 Vouchers and Journal Entries

- Draft, review, approved, posted, reversed, rejected states.
- Posting requires confirmation.
- Reversal/correction is used after posting.
- Fiscal locks must block unsafe backdated changes.

### 5.4 Source Mapping

- Other modules may expose source records, but M11 owns official posting.
- Mapping status must show mapped, unmapped, failed, pending, duplicate, or reversed.
- No direct ledger writes from frontend code.

### 5.5 Bank Reconciliation

- Statement import where supported.
- Match suggestions are review-only until confirmed by authorized user.
- Confirmation requires audit trail.
- Suggestions must not auto-post.

### 5.6 Reports and Snapshots

- Trial balance, general ledger, balance sheet, income/expenditure, cash flow, receivables/payables, and audit reports.
- Large reports use queued export jobs and protected file downloads.
- Snapshots are immutable after creation unless an approved correction workflow exists.

---

## 6. Security and State Requirements

Every M11 screen must handle:

```text
Loading
Empty
Error
Permission denied
Module locked
Fiscal period locked
Posting blocked
Reversal required
Export queued
Export processing
Export failed
Snapshot unavailable
Bank statement import failed
Partial reconciliation
Source mapping missing
Source mapping duplicate
```

Sensitive fields, salary-linked payroll data, bank data, and audit details must be permission-filtered.

---

## 7. Definition of Done

M11 web work is done only when:

- No browser-owned accounting truth remains.
- Posted records use reversal/correction flow.
- Fiscal period close/reopen is confirmation- and reason-gated.
- Large reports use File Registry and job status.
- Bank reconciliation suggestions do not auto-post.
- Source drilldown respects module, tenant, role, and permission scope.
- Principal view is read-only and hides mutation controls.
- Permission-denied and module-locked states fail closed.
