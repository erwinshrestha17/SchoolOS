# M9 Accounting — Web Reference Analysis

**Status:** Supporting M9 design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth. Backend/OpenAPI/shared contract types remain authoritative for fields, routes, permissions, totals, mutations, fiscal locks, posting rules, bank reconciliation semantics, report snapshots, exports, protected files, principal read-only scope, and audit behavior. This document records the focused reference-screen analysis and should be consolidated into the master web plan during the next master-doc curation pass.

---

## 1. Purpose

M9 is the accounting control center for a Nepal school. It must help authorized finance users manage chart of accounts, vouchers, journals, ledgers, fiscal years, posting controls, reports, source mappings, bank reconciliation, audit trail, and principal read-only finance summaries.

The supplied references define two distinct accounting experiences:

| Surface | Main user | Primary job |
|---|---|---|
| Admin web | Accountant, finance officer, bursar, super admin | Run controlled accounting operations with posting discipline, fiscal locks, reconciliation, exports, and auditability. |
| Principal mobile finance | Principal / school leader | Read-only financial health, snapshots, trends, and alerts without operational mutation controls. |

M9 must feel controlled, stable, and audit-ready. It should not look like a decorative dashboard, a generic billing page, or a fee-only report module.

Every M9 screen keeps the SchoolOS rule: **one screen = one main job**.

---

## 2. Product, Accounting, and Governance Boundaries

| Persona | Allowed visibility | Must not expose |
|---|---|---|
| Accountant / finance officer | Tenant-scoped accounts, vouchers, journals, ledgers, reports, bank reconciliation, source mappings, export jobs, snapshots, and accounting audit events according to permission. | Cross-tenant data, platform billing controls, raw object keys, provider secrets, or mutation actions outside permission. |
| Super admin | Full school-level accounting configuration and high-risk controls where permission allows. | Platform SaaS billing internals, unaudited support override, or bypass controls. |
| Principal / school leader | Read-only finance overview, report snapshots, KPIs, trends, and alerts. | Edit/post/reverse controls, source mapping mutation, period reopen controls, private operational detail beyond leadership need. |
| Clerk / limited finance role | Narrow voucher, receipt, or report tasks allowed by RBAC. | Salary/bank-sensitive details, period controls, chart import, posting/reversal, or report exports unless explicitly permitted. |
| Auditor | Read-only audit trail, snapshots, before/after summaries, and protected exports where policy allows. | Mutation controls or unrelated student/staff private data. |

M9 Accounting is a school accounting module, not a SchoolOS platform billing system. Other modules must not directly write official ledger records from the browser. Cross-module accounting entries should be created through backend-owned accounting boundaries and source-mapping rules.

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
/dashboard/accounting/source-mapping/[mappingRuleId]
/dashboard/accounting/fiscal-years
/dashboard/accounting/banking/accounts
/dashboard/accounting/banking/reconciliation
/dashboard/accounting/banking/cheques
/dashboard/accounting/receivables
/dashboard/accounting/payables
/dashboard/accounting/fixed-assets
/dashboard/accounting/reports
/dashboard/accounting/reports/trial-balance
/dashboard/accounting/reports/general-ledger
/dashboard/accounting/reports/balance-sheet
/dashboard/accounting/reports/income-expenditure
/dashboard/accounting/reports/cash-flow
/dashboard/accounting/audit-trail
/dashboard/accounting/settings
```

Route naming must follow the existing Next.js app-router structure if the repository already defines a different stable path. Treat unknown route/API contracts as `needs OpenAPI confirmation` rather than inventing endpoints.

---

## 4. Standard M9 Workspace Pattern

```text
Header: Accounting page title
Purpose: One-line finance/accounting job statement
Primary action: Contextual to the page, such as Create Voucher, Import Template, Run Report, or Reconcile Bank
Secondary actions: More Actions, export, print, schedule, view audit, help

KPI strip: Backend-provided money/status summaries only
Tabs/pages: Overview | Chart of Accounts | Vouchers | Journal Entries | Banking | Receivables | Payables | Fixed Assets | Reports | Audit Trail | Settings
Filters: Fiscal year | Period | Date range | Account | Source module | Status | Posted by | Branch/school unit
Main area: One task-first dashboard, table, tree, workflow, reconciliation grid, or report preview
Right rail: Selected source record, audit details, report queue, reconciliation confirmation, or snapshot registry
Sticky action bar: Only for multi-step import, posting, reconciliation, or period-close workflows
```

KPI cards, money values, period states, report totals, balances, source mapping health, reconciliation counts, and audit totals must come from backend summary/list metadata or render an honest unavailable state. The browser must not invent accounting truth.

---

## 5. Visual Design Baseline

The references establish a finance-grade SchoolOS visual language:

- Calm soft blue-grey app canvas with white cards, tables, drawers, and rails.
- Strong deep-blue primary action buttons.
- Teal/green treatment for cash, bank, mapped, matched, posted, closed, balanced, and success states.
- Orange treatment for partial, warning, queued, locked, and review states.
- Red treatment for failed, unmatched, destructive, high-risk, and blocking states.
- Purple/blue treatment for pending review, reopened, snapshots, and informational status where appropriate.
- Thin borders, readable navy headings, precise table density, and restrained shadows.
- NPR amounts right-aligned in tables and cards.
- Action groups kept disciplined; destructive controls must not be visually treated as decorative CTAs.

Status cannot rely on color alone. Use badge text, icons, labels, and semantic state names.

---

## 6. Sidebar and Navigation Requirements

Recommended M9 sidebar:

```text
M9 Accounting
  Overview
  Chart of Accounts
  Vouchers
  Journal Entries
  Banking
    Bank Accounts
    Bank Reconciliation
    Cheque Management
  Receivables
  Payables
  Fixed Assets
  Reports
  Audit Trail
  Settings
```

Vouchers and journal entries must remain separate:

| Section | Purpose |
|---|---|
| Vouchers | Operational accounting documents and draft/approval/posting workflow. |
| Journal Entries | Posted accounting records and ledger-facing details. |
| Source Mapping | Controlled conversion from source module events into accounting entries. |
| Reports | Generated financial outputs, snapshots, schedules, queues, and protected exports. |

---

## 7. Accounting Overview

**Main job:** show financial position, accounting health, and immediate operational actions.

```text
Header: Accounting Overview
Purpose: Real-time summary of the school's financial position and accounting health
KPI strip: Cash & Bank Balance | Receivables Outstanding | Payables Outstanding | Posted Journals This Month | Open Reconciliation Items
Quick actions: Create Voucher | Import Chart Template | Reconcile Bank | Run Report | View Audit Trail
Main: Income/expense trend, source mapping health, period status, report queue diagnostics, recent journal activity, period-close checklist
Footer: Currency/tax note and last-updated timestamp
```

Recommended attention order:

1. Blocking accounting risks: unmapped source events, failed mapping rules, unbalanced report, failed export, unreconciled bank difference, locked period conflict.
2. Period-close checklist and fiscal lock state.
3. Cash/bank, receivable, payable, and posted journal summaries.
4. Source mapping health and recent journal activity.
5. Report queue diagnostics and quick actions.

The overview is an aggregation page. Do not place full editing workflows on the overview.

---

## 8. Chart of Accounts and Template Import

**Main job:** manage and safely import the school chart of accounts.

```text
Header: Chart of Accounts
Primary actions: Create Account | Import Template | Download Template
Tabs: Account List | Template Preview | Import Template
Main left: Expandable COA tree table
Main right: Import wizard and validation panel when importing
Wizard: Upload File -> Map Columns -> Validate -> Review & Import
```

Required import controls:

| Control | Requirement |
|---|---|
| Template preview | Show Nepal school COA structure before import. |
| Upload validation | Supported formats, file size, schema check, and duplicate detection. |
| Validation summary | Valid rows, warnings, errors, duplicates. |
| Duplicate detection | Show uploaded row, account code/name, existing match, and proposed action. |
| Dry-run preview | Show first rows before commit. |
| Confirmation checkbox | Required before import commit. |
| Import action | Disabled until blocking validation errors are resolved. |

Recommended Nepal school account groups:

```text
Assets
  Current Assets
  Cash in Hand
  Cash at Bank
  Accounts Receivable - Students
  Advances and Prepayments
Liabilities
  Accounts Payable - Suppliers
  Salary Payable
  Other Payables
  Security Deposits
Equity / Fund Balance
Income
  Tuition Fee
  Admission Fee
  Transport Revenue
  Canteen Sales
  Library Fines
Expenses
  Teacher Salary
  Staff Salary
  Payroll Expense
  Fuel Expense
  Discounts / Scholarship Given
```

COA import must be audited and permission-gated.

---

## 9. Vouchers and Journal Entries List

**Main job:** find, inspect, post, reverse, and export accounting documents safely.

```text
Header: Journals & Vouchers
Primary action: Create Voucher
Secondary actions: Post | Reverse | Export | More
Filters: Date range | Journal | Status | Source module | Posted by
Main: Server-paginated voucher/journal table
Lower panel: Selected voucher detail
Right rail: Source record details
```

Recommended table columns:

```text
Select
Voucher No.
Date
Journal
Source Module
Narration
Amount (NPR)
Status
Posted By
Actions
```

Bulk actions must be permission-aware and state-aware. If selected records cannot be posted/reversed together, show the disabled reason instead of failing silently.

---

## 10. Journal Entry Detail

**Main job:** inspect one accounting entry and safely perform allowed state transitions.

```text
Header: Journal Entry Detail
Primary action when posted: View Source Record or Print
High-risk actions: Reverse Entry | Create Correction
Status banner: Posted/locked state with explanation
Main: Header metadata, narration, journal lines, balanced footer
Right rail: Source record details, audit notes, lock information
Bottom action bar: Save Draft / Reverse Entry / Create Correction / Post Entry depending on state
```

Required state behavior:

| Entry state | Frontend behavior |
|---|---|
| Draft | Editable where permission allows. |
| Pending Approval | Editable only where workflow allows; show approval status. |
| Approved | Ready to post if period/posting controls allow. |
| Posted | Read-only; normal edit disabled; reversal/correction only. |
| Reversed | Read-only; link original and reversing entry. |
| Correction Created | Link original, correction, and audit note. |
| Cancelled | Read-only with cancellation reason. |

Posted entries must clearly state that direct edits are not allowed. Reversal or correction requires reason, confirmation, backend permission, and audit support.

---

## 11. Source Mapping

**Main job:** map operational source events to accounting journal rules.

```text
Header: Source Mapping
Primary action: New Mapping Rule
Secondary action: Run Health Check
KPI strip: Fully Mapped | Partially Mapped | Unmapped | Inactive Accounts | Failed Mapping Rules
Attention section: Missing destination account | Inactive chart items | Conflicting journal rules
Main: Source mapping rules table
Bottom: Mapping actions, recent exceptions, source distribution chart
```

Recommended rule columns:

```text
Source
Source Event
Debit Account
Credit Account
Journal
Status
Last Verified
Actions
```

Required mapping states:

| State | Meaning |
|---|---|
| Mapped | Rule is complete and valid. |
| Partially Mapped | Rule is missing a required side, condition, or account. |
| Unmapped | Source event has no valid accounting rule. |
| Inactive Account | Rule points to an inactive COA account. |
| Failed Rule | Validation, posting, or rule evaluation failed. |

Source mapping changes are high impact. Show impact preview where backend supports it, require confirmation/reason where policy requires it, and audit before/after values.

---

## 12. Fiscal Years, Period Locks, and Posting Controls

**Main job:** protect accounting periods and control posting permissions.

```text
Header: Fiscal Years, Period Locks & Posting Controls
Top cards: Fiscal years with active/closed/upcoming status
Main: Period/month status table
Right rail: Lock Period | Close Month | Reopen Period | Configure Posting Rules
Bottom: Period-close checklist, close summary, reopening request, posting cutoff and permissions, high-risk warning
```

Required period states:

```text
Open
Locked
Closed
Reopened
Upcoming
```

High-risk actions include:

- Lock period.
- Close month.
- Reopen period.
- Change posting cutoff.
- Change posting permissions.
- Change allowed document types.
- Change approval requirements.

High-risk actions must require permission, reason where policy requires it, confirmation, pending/success/error state, and audit logging. For close/reopen flows, prefer a final typed confirmation phrase where backend/product policy supports it.

---

## 13. Trial Balance

**Main job:** generate and inspect debit/credit balance status for the selected period.

```text
Header: Trial Balance
Controls: Fiscal year | Period | Account range | Account status
Actions: Run Report | Save Snapshot | Export PDF | Export Excel | Schedule
KPI strip: Total Debits | Total Credits | Net Difference | Report Balance Status
Main: Account hierarchy table with opening balance, debit, credit, and closing balance
Footer: Row count, chart view action, currency/tax note
```

If balanced, show explicit success state. If unbalanced, show the net difference and likely backend-provided causes such as unposted source records, invalid journal line, mapping failure, inactive account reference, or report-generation issue.

Reports must not be computed as browser-only totals.

---

## 14. General Ledger and Cash Book

**Main job:** inspect account-level movements with running balances and generate protected reports.

```text
Header: General Ledger & Cash Book
Tabs: General Ledger | Cash Book
Filters: Account | Date range | Branch/school unit | Source module
Main: Ledger entries table with running balance
Right rail: Report & Snapshot generator, file registry, queue status
```

Recommended table columns:

```text
Date
Voucher No.
Source Module
Narration
Debit (NPR)
Credit (NPR)
Running Balance (NPR)
```

Immediate exports should be limited to safe backend thresholds. Large exports must use queued job/status UI and File Registry-backed protected download helpers.

---

## 15. Financial Reports and Snapshots

**Main job:** generate, save, reuse, export, and inspect audit-ready financial statements.

```text
Header: Financial Reports
Tabs: Balance Sheet | Income & Expenditure | Cash Flow Statement | Trial Balance | General Ledger | Aging Reports | Others
Actions: Report Settings | Export Data | Generate PDF | Save Snapshot | Reuse Previous Snapshot
Main: Selected financial statement
Right rail: Report snapshots and report queue diagnostics
```

A generated report should behave as a snapshot:

```text
generated_at
generated_by
source_data_cutoff
fiscal_year
period
accounting_basis
status
protected_file_id
```

Required report queue states:

```text
Queued
Running
Completed
Failed
Retrying
Expired
Reused
Snapshot Exists
```

Protected report downloads must use authenticated File Registry helpers. Do not expose raw file URLs or object keys.

---

## 16. Bank Reconciliation

**Main job:** import a bank statement, validate it, review match suggestions, manually confirm, and finalize reconciliation.

```text
Step 1: Import & Validate Bank Statement
Step 2: Reconciliation Suggestions
Step 3: Manual Confirmation
Step 4: Finalize Reconciliation
```

Required screen sections:

- Statement upload and detected bank card.
- Statement date range and validation results.
- Imported summary: total lines, credits, debits, net movement, opening balance, closing balance.
- Match status cards: matched, partially matched, unmatched, pending review.
- Suggestions table with confidence and status.
- Manual confirmation side panel.
- Finalization bar with difference and progress.

Recommended match states:

```text
Matched
Partially Matched
Unmatched
Pending Review
Rejected
Confirmed
Finalized
```

Finalize reconciliation should be disabled unless backend policy allows it. If difference is non-zero, require permission and a reason where policy supports finalization with difference.

---

## 17. Audit Trail

**Main job:** provide complete financial change visibility with before/after context.

```text
Header: Accounting Audit Trail
Filters: Date range | User | Action type | Module source | Record ID
KPI strip: Total events | Users | Modules | Critical events
Main: Audit events table
Right rail: Audit event details
```

Recommended audit table columns:

```text
Timestamp
User
Action Type
Module Source
Record ID
Before Summary
After Summary
```

Audit detail should include:

- Event information.
- Module source.
- Record ID/reference number.
- User and role.
- IP address and device/browser where available.
- Before change summary.
- After change summary.
- Linked source record or protected export where allowed.

Actions that must appear in audit trail include journal posted, journal reversed, period locked, period closed, period reopened, chart imported, source mapping changed, bank reconciliation finalized, report snapshot generated, voucher cancelled, payment recorded, receipt recorded, payable paid, and fixed asset created.

---

## 18. Principal Mobile Finance

**Main job:** provide leadership-level read-only financial insight.

Recommended mobile tabs:

```text
Overview
Reports
Alerts
More
```

Recommended overview cards:

```text
Cash & Bank Balance
Fee Collection This Month
Payroll Outflow This Month
Pending Reconciliations
Cash & Bank Trend
```

Recommended reports list:

```text
Trial Balance
Balance Sheet
Cash Book
Monthly Summary
Income & Expenditure
Cash Flow Statement
```

Principal mobile finance must be read-only. It must not expose posting, reverse, edit, delete, chart import, period lock/reopen, source mapping mutation, or reconciliation finalization actions.

---

## 19. Reusable Component Inventory

Recommended shared components for implementation:

```text
AccountingShell
AccountingPageHeader
FiscalYearSelector
PeriodSelector
MoneyMetricCard
AccountingStatusBadge
AccountingRiskStrip
JournalLineTable
DebitCreditBalanceFooter
SourceRecordLinkCard
PostingLockBanner
PeriodStatusChip
ReportSnapshotCard
ReportQueueCard
ProtectedExportButton
ImportWizard
ValidationSummary
DuplicateDetectionTable
DryRunPreviewTable
HighRiskActionDialog
ReversalCorrectionPanel
ReconciliationStepIndicator
ReconciliationMatchTable
AuditEventDrawer
PrincipalFinanceSummaryCard
```

Do not duplicate shared UI primitives if an existing component can be extended safely.

---

## 20. Required UI States

Document states:

```text
Draft
Pending Approval
Approved
Posted
Reversed
Correction Created
Cancelled
Failed
```

Period states:

```text
Open
Locked
Closed
Reopened
Upcoming
```

Report states:

```text
Not Generated
Queued
Running
Completed
Failed
Retrying
Expired
Snapshot Exists
Reused
```

Mapping states:

```text
Mapped
Partially Mapped
Unmapped
Inactive Account
Failed Rule
```

Reconciliation states:

```text
Imported
Validated
Matched
Partial
Unmatched
Pending Review
Confirmed
Finalized
Rejected
```

Every state needs a loading, empty, error, permission denied, locked, retry, and partial-failure behavior where applicable.

---

## 21. High-Risk Action UX

High-risk accounting actions require explicit friction:

```text
User clicks high-risk action
-> Impact preview
-> Permission check by backend
-> Reason field where policy requires it
-> Confirmation checkbox or typed confirmation where policy requires it
-> Pending state
-> Success/error state
-> Refetch affected records
-> Audit event visible
```

High-risk actions include:

- Post voucher/journal.
- Reverse journal.
- Create correction.
- Import chart of accounts.
- Change source mapping.
- Lock/close/reopen period.
- Change posting cutoff or posting permissions.
- Finalize bank reconciliation.
- Save/reuse official report snapshot.
- Cancel voucher.
- Delete or archive accounting configuration where supported.

Disabled buttons should show the reason, such as `Current period is locked`, `Source mapping has blocking errors`, or `You do not have permission to post entries`.

---

## 22. API and Contract Expectations

Frontend implementation should prefer existing repository API clients and OpenAPI/shared contracts. Unknown endpoints must be marked `needs OpenAPI confirmation`.

Expected backend-backed capabilities:

```text
GET    /accounting/overview
GET    /accounting/chart-of-accounts
POST   /accounting/chart-of-accounts/import/validate
POST   /accounting/chart-of-accounts/import/commit
GET    /accounting/vouchers
POST   /accounting/vouchers
POST   /accounting/vouchers/:id/post
POST   /accounting/vouchers/:id/reverse
GET    /accounting/journal-entries
GET    /accounting/journal-entries/:id
POST   /accounting/journal-entries/:id/reverse
POST   /accounting/journal-entries/:id/correction
GET    /accounting/source-mappings
POST   /accounting/source-mappings/test
POST   /accounting/source-mappings/health-check
GET    /accounting/fiscal-years
POST   /accounting/periods/:id/lock
POST   /accounting/periods/:id/close
POST   /accounting/periods/:id/reopen
POST   /accounting/reports/run
POST   /accounting/reports/snapshot
GET    /accounting/reports/queue
GET    /accounting/reports/files
POST   /accounting/bank-reconciliation/import
POST   /accounting/bank-reconciliation/auto-match
POST   /accounting/bank-reconciliation/:id/confirm
POST   /accounting/bank-reconciliation/:id/finalize
GET    /accounting/audit-trail
GET    /accounting/audit-trail/:id
GET    /principal/finance/overview
GET    /principal/finance/reports
```

These are planning expectations, not authority to invent implementation. Use actual existing backend/OpenAPI contracts when coding.

---

## 23. Acceptance Checklist

A production-ready M9 frontend pass must verify:

- Accounting overview uses real summary APIs or honest unavailable states.
- COA tree and import wizard are backend-backed, validated, duplicate-aware, and audited.
- Vouchers and journal entries use server-side filtering/pagination.
- Posted entries are immutable in UI and expose reversal/correction workflows only.
- Source mapping clearly surfaces mapped, partial, unmapped, inactive, and failed states.
- Fiscal locks, period close, and reopen actions require high-risk confirmation and reason where supported.
- Trial balance and financial reports use backend-generated totals and snapshot metadata.
- General ledger/cash book running balances are backend-owned.
- Large exports use queued job/status UI and protected File Registry downloads.
- Bank reconciliation import, match suggestion, manual confirmation, and finalization are explicit workflows.
- Audit trail records before/after context for high-impact financial actions.
- Principal mobile finance remains read-only.
- Sensitive salary, bank, payroll, and finance data are permission-gated.
- No raw object keys, permanent URLs, stack traces, Prisma errors, or provider secrets appear in UI.
- All high-risk buttons have disabled reasons, loading state, success/error state, and audit support where backend allows.

---

## 24. Final Design Principle

M9 should be built around this rule:

```text
Posted accounting data is controlled, traceable, reversible, and reportable — never casually editable.
```

This principle should govern route structure, component behavior, permissions, copy, empty states, exports, reports, reconciliation, and audit visibility.
