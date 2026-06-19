# M11 Accounting and Finance — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M11 Accounting and Finance  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`  
**Supporting reference:** `docs/design/M11_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M11. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M11 is the accounting control center for a Nepal school. It must support chart of accounts, vouchers, journals, fiscal periods, posting controls, source mapping, bank reconciliation, report snapshots, protected exports, and principal read-only finance snapshots.

Core flow:

```text
Chart setup
-> source mapping
-> voucher / journal draft
-> review / approve
-> post
-> lock period
-> reconcile bank
-> generate report snapshot
-> export protected file
```

---

## 2. Theme and Layout Alignment

Use a finance-grade controlled workspace:

```text
ModuleHeader
Fiscal year / period context
Accounting KPI strip
Tabs
FilterBar
Main accounting workflow
Right source/audit/reconciliation rail
Protected export actions
High-risk confirmation footer
```

Design rules:

- Accounting values are backend-owned only.
- NPR amounts are right-aligned.
- Posted records are immutable in UI.
- Reversal/correction replaces silent edits.
- Period close/reopen is high-risk and reason-gated.
- Principal views are read-only and simpler than accountant views.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Accountant / finance officer | Manage accounts, vouchers, journals, reports, reconciliation. | Accounting permission-gated. |
| Principal | Review finance snapshots. | Read-only summary unless permitted. |
| Auditor | Review snapshots and audit trail. | Read-only. |
| Clerk | Narrow voucher/report tasks. | Limited permission. |
| Platform operator | Provider/support diagnostics only. | No tenant-private access without override. |

---

## 4. Recommended Route Map

```text
/dashboard/accounting
/dashboard/accounting/chart-of-accounts
/dashboard/accounting/chart-of-accounts/import
/dashboard/accounting/vouchers
/dashboard/accounting/vouchers/[voucherId]
/dashboard/accounting/journal-entries
/dashboard/accounting/source-mapping
/dashboard/accounting/fiscal-years
/dashboard/accounting/banking/accounts
/dashboard/accounting/banking/reconciliation
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

---

## 5. Required Screens

### 5.1 Accounting Dashboard

- KPI cards: cash/bank summary, receivables, payables, vouchers pending approval, unreconciled bank items, period status, report snapshots.
- Attention queue: unmapped sources, failed postings, fiscal lock conflicts, reconciliation differences, export failures.
- Quick actions: Create Voucher, Import Chart, Reconcile Bank, Run Report, View Audit.

### 5.2 Chart of Accounts

- Account tree/table with code, name, type, parent, active state, usage count.
- Nepal-ready templates.
- Import preview before commit.
- No unsafe deletion if account has history.

### 5.3 Vouchers and Journals

State machine:

```text
Draft
Review
Approved
Posted
Reversed
Rejected
```

- Line item table with debit/credit validation.
- Posting confirmation with impact preview.
- Reversal/correction workflow after posting.

### 5.4 Source Mapping

- Source module, source type, account mapping, status, last sync.
- Source drilldown across fees, payroll, canteen, library, and approved modules.
- Missing/failed/duplicate mapping warnings.

### 5.5 Fiscal Periods and Locks

- Period status: Open, Closing, Closed, Reopened, Locked.
- Close/reopen requires confirmation, reason, and audit.
- Backdated unsafe operations must show backend-blocked state.

### 5.6 Bank Reconciliation

- Statement import where supported.
- Matched, suggested, unmatched, confirmed states.
- Suggestions are review-only until confirmed.
- No auto-posting from browser.

### 5.7 Reports and Snapshots

- Trial balance, general ledger, balance sheet, income/expenditure, cash flow, receivables/payables.
- Large reports use queued export and protected file flow.
- Report snapshots should be immutable/versioned.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Chart of accounts APIs
Nepal chart template APIs
Voucher draft/review/approve/post/reverse APIs
Journal entry APIs
Fiscal period lock/reopen APIs
Source mapping APIs
Bank reconciliation APIs
Report snapshot/export job APIs
Principal read-only snapshot APIs
Protected accounting file APIs
M12 accounting approval/status notification events
Audit logs for post, reverse, close, reopen, mapping changes
```

Backend ownership rules:

- No direct ledger writes from other module frontends.
- Official accounting totals are backend-owned.
- Fiscal locks are backend-enforced.
- Posted records use reversal/correction.
- Reports use File Registry/job flow.

---

## 7. Required States

```text
Loading
No fiscal year
Period open
Period locked
Posting pending
Posted
Reversal required
Voucher rejected
Source mapping missing
Source mapping duplicate
Reconciliation unmatched
Report queued
Report processing
Report failed
Snapshot unavailable
Permission denied
Module locked
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses backend-owned accounting totals only.
[ ] Posted records are immutable in UI.
[ ] Reversal/correction workflow exists for posted corrections.
[ ] Period close/reopen requires reason and audit.
[ ] Bank reconciliation suggestions do not auto-post.
[ ] Reports use protected export jobs.
[ ] Principal view is read-only.
[ ] M12 accounting notifications are represented accurately.
[ ] No fake accounting metrics remain.
```
