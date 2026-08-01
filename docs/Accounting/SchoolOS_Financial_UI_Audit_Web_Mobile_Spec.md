# SchoolOS Financial UI Audit and Target Design Specification

## Document status

- **Product:** SchoolOS
- **Scope:** Financial reporting and accounting UX for M3 Fees and Receipts, M7 HR and Payroll, and M11 Accounting and Finance
- **Deployment stage:** P0 controlled-pilot preparation
- **Surfaces:** Web and mobile
- **Primary personas:** Accountant, Principal, Parent/Guardian
- **Secondary restricted personas:** Admin, HR, Auditor, Management Committee/Owner
- **Explicit P0 exclusion:** Native Accountant mobile workspace and mobile accounting mutations

---

# 1. Executive UI verdict

The SchoolOS finance experience should not look like a generic analytics dashboard or a collection of unrelated report pages.

It should look and behave like a controlled financial operating workspace with four layers:

1. **Overview:** What requires attention now?
2. **Operational workspace:** What must be collected, reconciled, posted, approved, or corrected?
3. **Accounting evidence:** What journal, voucher, ledger, source transaction, approval, and attachment created this figure?
4. **Controlled output:** What can be finalized, exported, shared, or audited?

The target interface must make financial state obvious:

- Posted versus draft.
- Reconciled versus unreconciled.
- Final versus provisional.
- Paid versus pending.
- Current versus overdue.
- Source-module amount versus M11 posted amount.
- Normal operation versus exception.
- Read-only oversight versus mutation authority.

The current reporting catalogue is broad enough, but a successful UI requires strong hierarchy, consistent report contracts, explicit module ownership, and drill-down. The interface must not display several visually similar totals without showing which module is authoritative.

---

# 2. Governing design principles

## 2.1 Finance is evidence-first

Every important amount must expose:

```text
Dashboard metric
→ Report
→ Report line
→ Account or subledger
→ Journal or voucher
→ M3/M7 source record
→ Approval
→ Attachment
→ Audit event
```

A figure without lineage is not a completed finance UI.

## 2.2 Exceptions before decoration

The top of every finance surface should prioritize:

- Reconciliation differences.
- Failed or unposted source events.
- Open cashier sessions.
- Undeposited cash.
- Overdue receivables.
- Unpaid payroll liabilities.
- Missing supporting documents.
- High-value pending approvals.
- Period-lock or report-generation failures.

Avoid filling the first viewport with generic trend charts while operational exceptions remain hidden.

## 2.3 Role-specific composition

The system must not render one universal dashboard and merely hide buttons.

- **Accountant:** dense operational workbench with reports, reconciliation, vouchers, posting, and exports.
- **Principal:** server-projected read-only summaries, attention items, and designated approvals.
- **Parent:** child-specific fees, invoices, payments, receipts, and correction requests.
- **HR:** payroll source schedules and posting status only.
- **Admin:** limited fee operations and source-exception routing only when explicitly permissioned.
- **Auditor:** time-bounded, read-only, export-controlled evidence view.

## 2.4 Progressive disclosure

The default view should be readable, but detailed evidence must remain one interaction away.

Use:

- Expandable report groups.
- Row drill-down.
- Side panels for transaction details.
- Full-page workspaces for complex reconciliation.
- Visible “View source” and “View journal” actions.
- Separate advanced filters rather than an overloaded default toolbar.

## 2.5 Dense, not cramped

Accounting users need more rows and columns than ordinary SchoolOS users. Use a deliberate high-density desktop mode while preserving:

- 44 px minimum interactive row targets where actions are embedded.
- Sticky headers.
- Frozen identifying columns.
- Clear number alignment.
- Expandable columns.
- Horizontal scrolling only inside the table region.
- Comfortable default zoom and optional compact density.

## 2.6 No mobile imitation of desktop accounting

Mobile should not reproduce the general ledger, bank reconciliation grid, or voucher editor.

Mobile is appropriate for:

- Principal overview.
- Principal attention items and tightly controlled approvals.
- Parent invoice and payment self-service.
- Parent receipt access.
- Read-only financial notifications.

High-risk accounting work remains web-only.

---

# 3. Persona and surface allocation

| Persona | Web experience | Mobile experience | P0 financial authority |
|---|---|---|---|
| Accountant | Full M3/M11 workspace; permitted M7 accounting reports | No native accounting workspace | Operational and accounting actions by capability |
| Principal | Executive finance overview, drill-down, approvals, final reports | Compact overview, attention, approval decisions | Read-only except explicit approvals |
| Parent/Guardian | No general finance web portal in current allocation | Child fees, invoices, payment status, receipts, requests | Own linked-child M3 records only |
| HR | Payroll detail, approved run, deduction schedules, posting status | Staff self-service only; no finance administration | M7 scope only |
| Admin | Fee configuration/operations where permissioned; exception routing | None | No unrestricted accounting |
| Auditor | Read-only audit workspace and controlled exports | None | Time-bounded evidence access |
| Owner/Committee | Approved statements and management summaries | Optional future read-only summary | No transaction-entry authority |
| Teacher | Hidden | Hidden | None |

## Critical boundary

The Parent mobile finance area belongs to **M3 Fees and Receipts**, not the M11 accounting workspace. Parents must never see journal entries, internal discounts approval notes, payer risk classifications, cashier details, or other families’ balances.

---

# 4. Web information architecture

## 4.1 Accountant navigation

Recommended primary navigation:

```text
Finance Dashboard
Fees & Receipts
Cashier Close
Reconciliation
Accounting
Payroll Posting
Reports
Audit
```

Recommended secondary destinations:

### Finance Dashboard

- Today.
- Current fiscal period.
- Attention items.
- Collection summary.
- Cash and bank position.
- Posting status.
- Payroll position.
- Recent report runs.

### Fees & Receipts

- Student fee ledger.
- Invoice register.
- Collections.
- Outstanding and aging.
- Discounts, scholarships, and waivers.
- Refunds and reversals.
- Payment exceptions.
- Receipt register.

### Cashier Close

- Open sessions.
- Current cashier session.
- Expected versus actual cash.
- Deposit preparation.
- Close history.
- Variance exceptions.

### Reconciliation

- Bank reconciliation.
- Digital wallet/QR settlement.
- Payment gateway settlement.
- Undeposited collections.
- Source-module posting reconciliation.
- Payroll payment reconciliation.

### Accounting

- Journal entries.
- Voucher registers.
- General ledger.
- Trial balance.
- Chart of accounts.
- Fiscal periods and locks.
- Opening balances.
- Suspense and unclassified entries.

### Payroll Posting

- Approved payroll runs.
- Payroll journal preview.
- Posting status.
- Liabilities.
- Unpaid salary.
- Adjustments and reversals.
- M7-to-M11 reconciliation.

### Reports

- Core statements.
- Fees and receivables.
- Cash and bank.
- Expenses and payables.
- Payroll accounting.
- Management reports.
- Tax and compliance schedules.
- Fixed assets.
- Funds and grants.
- Audit reports.
- Saved views.
- Report generation history.

### Audit

- Financial audit trail.
- Reversed and voided transactions.
- Backdated entries.
- Period reopening.
- Approval exceptions.
- User financial activity.
- Supporting-document exceptions.
- High-value transactions.
- Failed or unposted source events.

## 4.2 Principal web navigation

The Principal should not receive the Accountant navigation.

Recommended structure:

```text
Executive Dashboard
Attention Items
Approvals
Finance Overview
Reports
Audit Highlights
```

The Finance Overview contains:

- Fees billed, collected, and outstanding.
- Collection rate.
- Cash and bank position.
- Current-month income and expenditure.
- Payroll cost and payable.
- Overdue fees.
- Posting and reconciliation exceptions.
- High-value approvals.
- Finalized report access.

No journal editor, voucher creation, bank matching, or cashier operations should appear.

## 4.3 HR web finance boundary

Inside HR:

```text
Payroll
├── Payroll Runs
├── Earnings & Deductions
├── Employee Loans/Advances
├── Payslips
└── Accounting Handoff
```

`Accounting Handoff` should show:

- Run ID.
- Approval state.
- Source total.
- Posting state.
- M11 journal reference.
- Reconciliation difference.
- Failure reason.
- Retry status.

HR must not receive general ledger navigation through this page.

---

# 5. Global web shell

## 5.1 Header

The finance header should contain:

- School and branch context.
- Fiscal year and current period.
- Period status: Open, Soft Closed, Locked, or Reopened.
- Global search for permitted financial records.
- Notifications.
- User menu.
- Help or report-definition access.

The current fiscal context must remain visible because many accounting errors originate from users operating in the wrong period.

## 5.2 Left navigation

Use a persistent desktop sidebar with:

- Clear section labels.
- Current-location highlight.
- Collapsible groups.
- Numeric exception badges only when actionable.
- No badge for ordinary totals.
- Permission-aware route removal and API denial.

The sidebar should collapse to icons on medium desktop widths, but report titles must remain visible through tooltips and accessible names.

## 5.3 Page header

Every page should show:

- Page title.
- One-sentence purpose.
- Authoritative module.
- Current period/date basis.
- Data freshness.
- Primary action.
- Secondary actions such as export or save view.

Example:

```text
Trial Balance
M11 authoritative · Posted entries only
As of 31 Ashadh 2083 · Generated 11:22 NPT
[Export] [Save view]
```

## 5.4 Breadcrumbs

Use breadcrumbs only for genuine hierarchy:

```text
Reports / Core Statements / Balance Sheet / Cash and Bank / Bank Account 001
```

Do not add breadcrumbs to every dashboard page.

---

# 6. Accountant finance dashboard

## 6.1 Desktop composition

Recommended first viewport:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Finance Dashboard            FY 2082/83 · Period Open · Fresh 2 min │
├─────────────────────────────────────────────────────────────────────┤
│ Attention: 3 failed postings · NPR 18,500 cash variance · 7 bank    │
│ items unreconciled                                      [Review all] │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Collected    │ Outstanding  │ Cash         │ Bank ledger/reconciled │
│ NPR …        │ NPR …        │ NPR …        │ NPR … / NPR …          │
│ vs target    │ aging signal │ today change │ difference             │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│ Collection trend / Current-period income and expenditure            │
├────────────────────────────────┬────────────────────────────────────┤
│ Posting & reconciliation queue │ Upcoming obligations               │
│ Failed M3 posts                │ Payroll payable                    │
│ Failed M7 posts                │ Supplier payments                  │
│ Open cashier sessions          │ Tax/TDS payable                    │
├────────────────────────────────┴────────────────────────────────────┤
│ Recent report runs and exports                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 6.2 KPI cards

Each KPI card must include:

- Label.
- Amount.
- Date or period.
- Comparison context.
- Status.
- Freshness.
- Drill-down action.
- Definition tooltip.

Do not use cards that contain only a large number and an unexplained percentage.

Recommended P0 cards:

- Confirmed fees collected.
- Outstanding fees.
- Collection rate.
- Cash on hand.
- Bank ledger balance.
- Reconciliation difference.
- Current-period income.
- Current-period expenditure.
- Unposted source amount.
- Payroll payable.

## 6.3 Attention strip

A persistent attention strip should appear when material exceptions exist.

Severity order:

1. Security or cross-tenant control failure.
2. Out-of-balance or accounting invariant failure.
3. Failed posting or period-lock conflict.
4. Cash variance or unreconciled bank difference.
5. High-value approval.
6. Overdue operational work.

The strip must not become a permanent red banner for low-priority information.

## 6.4 Charts

Recommended charts:

- Monthly fee billed versus collected.
- Receivable aging distribution.
- Income versus expenditure by month.
- Cash and bank trend.
- Payment-method composition.
- Posting failure trend.

Rules:

- Tables remain the source of truth.
- Charts must show exact values on focus/hover.
- Do not use 3D charts.
- Avoid multiple pie charts.
- Use stacked bars only when categories remain distinguishable.
- Show zero and missing data differently.
- Explain whether figures are posted, confirmed, or provisional.

---

# 7. Principal financial dashboard

## 7.1 Design goal

The Principal dashboard should answer:

- Is the school financially stable today?
- What requires my decision?
- What is worsening?
- What can I safely drill into?
- Is the data complete and current?

It should not expose routine accounting controls.

## 7.2 Recommended layout

Top:

- Current cash and bank position.
- Current-month surplus or deficit.
- Collection rate.
- Outstanding fees.
- Payroll cost.
- Data freshness and unresolved posting warning.

Middle:

- Attention items ranked by financial materiality.
- Fees billed versus collected trend.
- Receivable aging.
- Income versus expenditure.
- Pending high-value approvals.

Bottom:

- Recent finalized reports.
- Reconciliation health.
- Department or branch view when enabled.
- Key definitions and professional-verification notices.

## 7.3 Privacy reduction

For overdue fee attention, default to:

- Class/grade.
- Count of affected students.
- Total overdue amount.
- Aging severity.
- Assigned follow-up owner.

Student and guardian names appear only after permitted drill-down. Avoid exposing family financial details on the executive landing page.

---

# 8. Report centre

## 8.1 Report library

Use grouped report families with search:

```text
Core Financial Statements
Accounting Registers
Fees & Receivables
Collections & Receipts
Cash & Bank
Expenses & Payables
Payroll Accounting
Management
Tax & Nepal Compliance
Fixed Assets
Funds & Grants
Audit & Controls
```

Each report card/list row should include:

- Report name.
- One-line purpose.
- Owning module.
- Priority or availability.
- Last generated time.
- Final/draft capability.
- Favourite/save-view action.
- Permission state.

Avoid placing 95 reports in one undifferentiated grid.

## 8.2 Report viewer layout

Recommended desktop structure:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Report title · module · basis · freshness                          │
│ [Date/Period] [Branch] [More filters]      [Run] [Export] [Save]  │
├────────────────────────────────────────────────────────────────────┤
│ Validation / reconciliation / draft warning                        │
├────────────────────────────────────────────────────────────────────┤
│ Summary totals                                                     │
├────────────────────────────────────────────────────────────────────┤
│ Report table with sticky header and frozen identifier columns      │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ Totals · row count · generation time · source status               │
└────────────────────────────────────────────────────────────────────┘
```

## 8.3 Filters

Place high-frequency filters directly in the toolbar:

- Fiscal year.
- Period or as-of date.
- Branch.
- Posting state where permitted.

Move lower-frequency filters into a side panel:

- Account.
- Cost centre.
- Class/section.
- Fee head.
- Student.
- Vendor.
- Employee.
- Payment method.
- Source module.
- Approval state.

Applied filters must render as removable chips above the result.

## 8.4 Saved views

A saved view stores:

- Report ID.
- Filters.
- Sort.
- Visible columns.
- Density.
- Grouping.
- Comparison settings.

A saved view must not bypass current permissions.

## 8.5 Export flow

The export dialog should show:

- Format: PDF, XLSX, or CSV.
- Current filters.
- Visible versus all permitted columns.
- Draft/final watermark.
- Confidentiality classification.
- Expected row count.
- Large-report background generation notice.
- Expiring-download policy.

After generation, show:

- Report run ID.
- Checksum.
- Requested by.
- Generated time.
- Row count.
- Total amount where applicable.
- Download expiry.
- Audit-log link.

---

# 9. Financial table specification

## 9.1 Number formatting

- Right-align all numeric amounts.
- Use tabular numerals.
- Keep currency in the header or amount label rather than repeating `NPR` in every dense cell.
- Use parentheses or a clearly documented sign convention for negative values.
- Never use color alone to indicate debit/credit or positive/negative.
- Display two decimal places where required by configuration; avoid meaningless decimals where the school operates in whole rupees.
- Preserve exact values in exports.

## 9.2 Column behavior

- Freeze key identifiers such as account code, student, receipt number, or voucher number.
- Allow users to resize and hide optional columns.
- Keep totals visible through a sticky footer for long registers.
- Provide column definitions and calculation tooltips.
- Use explicit empty values such as `Not assigned`, `No attachment`, or `Not posted`, not a blank cell.

## 9.3 Row actions

Use a single row action menu for secondary actions.

Primary row action should usually be clicking the identifier:

- Voucher number.
- Receipt number.
- Student.
- Account.
- Bank statement reference.
- Payroll run.

Do not fill every row with several icon-only buttons.

## 9.4 Grouping

Allow grouping by meaningful dimensions:

- Account group.
- Fee head.
- Class/section.
- Aging bucket.
- Payment method.
- Vendor.
- Department.
- Posting status.

Grouping must preserve visible subtotals and grand totals.

---

# 10. Drill-down and detail patterns

## 10.1 Side panel

Use a right-side detail panel for quick inspection:

- Status.
- Amount.
- Source module.
- Created/approved/posted timestamps.
- References.
- Attachments.
- Audit summary.
- “Open full record” action.

The panel should preserve the user’s report position.

## 10.2 Full record page

Use a full page for:

- Voucher editing or approval.
- Journal review.
- Student fee ledger.
- Cashier close.
- Bank reconciliation.
- Payroll reconciliation.
- Refund and reversal workflows.
- Period reopening.

## 10.3 Audit timeline

Display an immutable vertical timeline:

```text
Created
Submitted
Approved
Posted
Exported
Reversed
Replacement posted
```

Each event should include:

- Actor.
- Role/capability.
- Timestamp.
- Reason.
- Before/after reference when applicable.
- Source and device/session metadata where permitted.

---

# 11. P0 web screen audits and target layouts

## 11.1 Student Fee Ledger — M3

### What the page must answer

- What was billed?
- What discounts or waivers were applied?
- What was paid?
- What was refunded or reversed?
- What is the current balance?
- What was posted to M11?

### Layout

Header:

- Student identity.
- Class/section.
- Billing guardian.
- Account status.
- Current balance.
- Oldest overdue date.
- M11 reconciliation status.

Tabs:

- Ledger.
- Invoices.
- Payments and receipts.
- Discounts/waivers.
- Refunds/reversals.
- Requests.
- Audit.

Ledger table:

- Date.
- Reference.
- Type.
- Fee head.
- Debit.
- Credit.
- Running balance.
- Status.
- M11 journal.
- Attachment.

### Risks to avoid

- Editing transactions directly inside the ledger.
- Mixing pending payment attempts with confirmed payments.
- Hiding reversed transactions.
- Showing guardian-private internal notes.

## 11.2 Invoice Register — M3

Use a filterable register with:

- Invoice number.
- Student.
- Class.
- Billing period.
- Gross.
- Discount.
- Net.
- Paid.
- Balance.
- Due date.
- Status.
- Posting status.

Bulk actions must be restricted and explicit. Do not allow casual bulk deletion.

## 11.3 Outstanding and Aging — M3

Top summary:

- Total outstanding.
- Current.
- 1–30 days.
- 31–60 days.
- 61–90 days.
- Over 90 days.

Main view:

- Aging chart.
- Student/class table.
- Follow-up state.
- Installment arrangement.
- Last reminder.
- Assigned owner.

Principal default view should aggregate; Accountant may drill into student records.

## 11.4 Daily Collection and Receipt Register — M3

Default layout:

- Date and cashier filters.
- Total confirmed collection.
- Payment-method breakdown.
- Receipt sequence health.
- Pending/failed payment warning.
- Register table.
- Export and cashier-close link.

Clearly distinguish:

- Payment received.
- Receipt issued.
- Posted to M11.
- Deposited.
- Reconciled.

These are different states and must not be compressed into one “Complete” badge.

## 11.5 Cashier Close — M3

Use a task-oriented workspace rather than a report table.

Sections:

1. Session identity and opening amount.
2. Cash, bank, QR/wallet, and other method totals.
3. Refunds and reversals.
4. Expected cash.
5. Physical count entry.
6. Variance explanation.
7. Deposit details.
8. Supporting attachments.
9. Submit and approve.
10. M11 posting status.

Use a step/status rail:

```text
Open → Counted → Submitted → Approved → Deposited → Posted
```

A closed session must become read-only except through an authorized reopen/reversal workflow.

## 11.6 Bank Reconciliation — M11

Use a three-region desktop layout:

```text
Ledger transactions | Matching workspace | Bank statement transactions
```

Essential controls:

- Suggested matches.
- Exact matches.
- Partial/combined match where permitted.
- Create bank charge/interest adjustment through controlled voucher flow.
- Mark timing difference.
- Unmatch with reason.
- Reconciliation summary.
- Difference indicator.
- Save draft.
- Finalize.

Do not use a narrow side drawer for reconciliation; it requires a full workspace.

## 11.7 Journal and Voucher Registers — M11

Register view:

- Voucher/journal number.
- Date.
- Type.
- Narration.
- Debit total.
- Credit total.
- Source.
- Status.
- Creator.
- Approver.
- Posting date.
- Reversal reference.

Detail view:

- Header and state.
- Debit/credit lines.
- Dimensions.
- Source lineage.
- Attachments.
- Approval timeline.
- Reversal actions.
- Audit trail.

An out-of-balance draft should show a prominent difference calculation and block submission.

## 11.8 General Ledger — M11

Header summary:

- Account.
- Account type.
- Normal balance.
- Opening balance.
- Period debit.
- Period credit.
- Closing balance.

Table:

- Date.
- Voucher.
- Source.
- Narration.
- Debit.
- Credit.
- Running balance.
- Branch/cost centre.
- Posting state.

The account picker should support code, name, and recent accounts.

## 11.9 Trial Balance — M11

Top:

- Period.
- Posted-only indicator.
- Total debit.
- Total credit.
- Difference.
- Validation status.

Rows:

- Account code.
- Account.
- Opening debit.
- Opening credit.
- Period debit.
- Period credit.
- Closing debit.
- Closing credit.

Controls:

- Expand account groups.
- Compare period.
- Show zero-balance accounts.
- Export.
- Drill to GL.

If debit and credit totals differ, block “final” export and display the exact difference.

## 11.10 Statement of Financial Performance — M11

Use a hierarchical financial-statement layout, not a spreadsheet-only table.

```text
Operating income
  Tuition fees
  Admission fees
  Other income
Total operating income

Operating expenditure
  Payroll
  Teaching materials
  Administration
  ...
Total operating expenditure

Surplus / (Deficit)
```

Features:

- Collapse/expand sections.
- Current period, YTD, and comparison.
- Amount and variance.
- Percentage of income where relevant.
- Statement-line definition.
- Drill-down to mapped accounts and GL.

## 11.11 Balance Sheet — M11

Use a clear accounting equation:

```text
Assets
Liabilities
Funds / Equity
Validation: Assets = Liabilities + Funds/Equity
```

Show:

- Current period.
- Comparative period.
- Movement.
- Validation status.
- Drill-down.

Do not hide a balancing difference in an “Other” line.

## 11.12 Payroll Reconciliation — M7 + M11

Header:

- Payroll run.
- Pay period.
- Approval state.
- Employee count.
- Gross payroll.
- Net pay.
- Deductions/liabilities.
- Employer costs.
- M11 journal.
- Reconciliation difference.

Tabs:

- Summary.
- Employee totals.
- Deduction schedules.
- Journal mapping.
- Payment status.
- Exceptions.
- Audit.

Restrict employee bank and salary detail by explicit permission.

## 11.13 Financial Audit Trail — M11/M0

Filters:

- Date.
- User.
- Action.
- Module.
- Record type.
- Amount range.
- High-risk action.
- Branch.
- Source.

Rows must explain the action in plain language:

```text
Receipt RC-2083-00125 reversed by A. Sharma after approval by P. Karki.
```

Avoid exposing opaque event names as the primary UI text.

---

# 12. Mobile information architecture

## 12.1 Principal app

Recommended placement:

```text
Overview
Attention
Approvals
School
Notifications
```

Finance appears contextually inside `Overview`, `Attention`, and `Approvals`. Do not add a full desktop-style Finance tab unless later usage evidence supports it.

### Principal finance overview

First screen:

- Cash and bank.
- Fees collected today/current month.
- Outstanding fees.
- Collection rate.
- Current-month surplus/deficit.
- Payroll cost.
- Reconciliation health.
- Data freshness.

Below:

- Attention cards.
- Short trends.
- Recent finalized reports.
- “Open in web” for complex analysis.

### Principal finance attention

Cards:

- Failed source posting.
- Cash variance.
- Unreconciled bank difference.
- High-value expense approval.
- Refund/reversal approval.
- Payroll approval.
- Severe overdue-fee movement.
- Missing supporting documents.

Each card must show:

- Why it matters.
- Amount.
- Age.
- Owner.
- Next action.
- Deadline.
- Safe drill-down.

### Principal mobile approvals

Mobile approvals are appropriate only when:

- The approval policy permits mobile decisions.
- The complete context can be shown.
- The user re-authenticates for sensitive/high-value decisions.
- Supporting evidence is accessible.
- Reject/return requires a reason.
- No financial figures are editable.

Recommended approval detail:

- Request type.
- Amount.
- Payee/student/source.
- Reason.
- Budget/account impact where applicable.
- Attachments.
- Prior approvals.
- Conflict/exception warning.
- Approve.
- Return.
- Reject.

## 12.2 Parent app: Fees and Receipts

Recommended child-specific route:

```text
Home
→ Child
→ Fees & Receipts
```

Main screen:

- Total due.
- Overdue amount.
- Next due date.
- Payment status.
- Recent receipt.
- Available payment method.
- School support/correction request.

Sections:

- Due now.
- Upcoming installments.
- Invoice history.
- Payment history.
- Receipts.
- Scholarships/discounts visible to the family.
- Requests and disputes.

### Invoice detail

Show:

- Student.
- Invoice number.
- Billing period.
- Fee-head breakdown.
- Gross amount.
- Discount/scholarship.
- Net amount.
- Paid amount.
- Balance.
- Due date.
- Payment status.
- Receipt link.
- Correction request.

Before payment, confirm:

- Correct child.
- School.
- Invoice.
- Amount.
- Payment method.
- Terms or reference.

### Payment states

Use explicit states:

```text
Ready to pay
Processing
Pending confirmation
Paid
Failed
Expired
Refund requested
Partially refunded
Reversed
```

Never show `Paid` before the authoritative confirmation is accepted.

### Receipt detail

Show:

- Receipt number.
- Student.
- Payment date/time.
- Amount.
- Payment method.
- Reference.
- Invoice allocation.
- Confirmation status.
- Download/share approved receipt.
- Reprint/version indicator where relevant.
- Report a problem.

Do not expose cashier identity beyond what school policy permits.

## 12.3 Accountant mobile decision

For P0, do not create a native Accountant finance application.

Reasons:

- Dense tables and cross-document verification are desktop tasks.
- Bank reconciliation is not safe in a compressed mobile layout.
- Journal and voucher entry require strong context.
- Period close, report finalization, and bulk export are high-risk.
- A second UI surface increases authorization and testing burden.

Permitted fallback:

- Responsive web view for read-only emergency status.
- Notification deep link that opens the desktop-required action.
- No journal entry, reconciliation, cashier close, payroll finalization, or statement finalization on mobile.

---

# 13. Mobile layout and interaction standards

## 13.1 Cards

Use cards for one bounded decision or summary.

Good card:

```text
Bank reconciliation
NPR 82,450 unmatched
7 items · oldest 9 days
Owner: Finance Office
[Review on web]
```

Bad card:

```text
Bank
82,450
```

## 13.2 Bottom sheets

Use bottom sheets for:

- Filter selection.
- Payment-method choice.
- Simple action confirmation.
- Reason entry.
- Receipt sharing.
- Supporting-document preview actions.

Do not use bottom sheets for:

- Full voucher review.
- Reconciliation.
- Multi-line journal entry.
- Large financial tables.

## 13.3 Mobile tables

Replace dense tables with:

- Grouped lists.
- Expandable rows.
- Key-value detail screens.
- Summary plus “view all”.
- Search and simple filters.

Preserve access to exact transaction references and amounts.

## 13.4 Sensitive action confirmation

For approval, refund, reversal, or high-value decisions:

- Re-display amount and subject.
- Show consequence.
- Require reason when rejecting or returning.
- Use biometric/device authentication only as device confirmation, with credential fallback.
- Record device/session audit evidence.
- Never store raw biometric information.

---

# 14. Component inventory

## P0 shared components

- Financial KPI card.
- Attention banner.
- Status chip.
- Fiscal-period selector.
- Report filter toolbar.
- Applied-filter chip.
- Financial data table.
- Sticky totals footer.
- Money display.
- Debit/credit display.
- Reconciliation status.
- Source-posting status.
- Drill-down link.
- Transaction detail panel.
- Audit timeline.
- Attachment viewer.
- Report definition tooltip.
- Export dialog.
- Report generation status.
- Confidential watermark.
- Empty state.
- Error state.
- Permission-denied state.
- Stale-data warning.
- Finalization confirmation.
- Approval decision panel.
- Mobile attention card.
- Mobile invoice card.
- Mobile receipt card.

## Status vocabulary

Use a controlled vocabulary. Do not invent slightly different labels across modules.

### Posting

- Not ready.
- Ready to post.
- Posting.
- Posted.
- Failed.
- Reversed.
- Replaced.

### Reconciliation

- Not started.
- In progress.
- Partially reconciled.
- Reconciled.
- Difference exists.
- Reopened.

### Report

- Live.
- Draft.
- Final.
- Superseded.
- Generation failed.
- Expired download.

### Payment

- Initiated.
- Pending.
- Confirmed.
- Failed.
- Expired.
- Partially refunded.
- Refunded.
- Reversed.

---

# 15. Visual design direction

## 15.1 Style

The finance UI should feel:

- Institutional.
- Calm.
- Precise.
- Modern.
- Trustworthy.
- More operational than promotional.

Avoid:

- Oversized gradients.
- Decorative glass effects behind financial tables.
- Excessive animation.
- Cartoon illustrations in accounting workspaces.
- Gamified collection indicators.
- Confetti after payment or approval.
- Bright color covering large surfaces.

## 15.2 Colour semantics

Use the SchoolOS brand colour for navigation and primary actions, but reserve semantic colours for state:

- Neutral: ordinary information.
- Positive: confirmed, reconciled, posted, balanced.
- Warning: due, pending, incomplete, aging.
- Critical: failed, variance, out of balance, unauthorized, overdue beyond threshold.
- Informational: draft, processing, scheduled.

Never rely only on colour. Pair every state with text and an icon.

## 15.3 Typography

- Use a highly legible sans-serif for UI.
- Use tabular numerals for amounts.
- Keep report titles strong but not oversized.
- Use a monospaced or tabular style for voucher, receipt, journal, and reference numbers where helpful.
- Avoid all-caps financial labels except very short table headers.

## 15.4 Spacing

Desktop:

- Compact but consistent 8-point spacing system.
- Report table row density selectable.
- Clear separation between filters, warnings, totals, and table.

Mobile:

- Larger vertical spacing.
- 44–48 px touch targets.
- One primary action per viewport region.
- Avoid two-column financial cards on narrow screens when labels wrap.

---

# 16. Accessibility audit requirements

The visual specification alone cannot prove accessibility. P0/P1 validation must include actual keyboard, screen-reader, zoom, contrast, and mobile accessibility testing.

Required UI behavior:

- Full keyboard access to filters, tables, menus, dialogs, and drill-down.
- Visible focus.
- Meaningful table headers and row relationships.
- Accessible names for icon buttons.
- Error summaries linked to invalid fields.
- Text equivalents for charts.
- Status conveyed by text, not colour alone.
- Screen-reader announcement when a report refreshes.
- Reduced-motion support.
- Logical focus return after closing a detail panel.
- Large touch targets.
- Accessible authentication alternatives.
- Nepali and English label testing.
- PDF exports must be assessed separately for document accessibility.

Financial amounts should be read with correct currency and sign context, not as an unexplained sequence of digits.

---

# 17. Nepal localization requirements

Every financial surface must support:

- NPR formatting.
- Nepal timezone.
- Nepali Unicode.
- English and Nepali labels where configured.
- Nepal fiscal year.
- BS and AD date presentation.
- Clear indication of the active calendar.
- Province, district, local level, and ward where relevant to reports.
- Print/PDF fonts that correctly embed Nepali text.
- Long Nepali labels without clipping.
- Search that works with Nepali and English names.

Do not mix BS and AD dates in one list without labels.

Recommended date display:

```text
31 Ashadh 2083 BS
15 July 2026 AD
```

One calendar may be primary; the equivalent appears as supporting text.

---

# 18. Loading, empty, stale, and error states

## Loading

- Preserve page structure with skeletons.
- Do not show temporary zero totals while loading.
- Large reports should show generation progress and allow safe navigation away.

## Empty

Differentiate:

- No transactions exist.
- No records match current filters.
- Report is unavailable because a source module is not configured.
- User lacks permission.
- Period has no posted data.
- Data is pending posting.

## Stale

Show:

- Last successful refresh.
- Source module freshness.
- Whether the figure includes pending/unposted events.
- Manual retry where appropriate.

## Error

Errors must identify the safe next action:

- Retry.
- Adjust filters.
- Resolve source posting.
- Open period.
- Request permission.
- Contact finance administrator.
- View failure details.

Never show a raw stack trace or database error to school users.

---

# 19. Security and privacy UX

- Do not use hidden navigation as the security control.
- Server must project permitted fields and actions.
- Sensitive payroll and family fee details require field-level authorization.
- Export actions must state classification and expiry.
- Auditor access should visibly show access end date and read-only state.
- Principal pages must show read-only status.
- Reopened periods should display a persistent warning.
- Impersonation/support sessions must display a prominent audited banner.
- Screenshots and print views should omit unnecessary personal information.
- Lock-screen notifications should use generic wording for sensitive financial events.

---

# 20. UI anti-patterns to prohibit

1. One dashboard for Accountant, Principal, Admin, and Owner.
2. Client-calculated totals from several APIs.
3. A report page with only a PDF download button.
4. Cards with unexplained totals.
5. Green status for a payment that is only pending.
6. Hiding reversals or voided receipts.
7. Editing posted ledger rows inline.
8. Allowing final exports while the trial balance is out of balance.
9. Showing all 95 reports in a flat menu.
10. Using horizontal page scrolling instead of table-region scrolling.
11. Allowing unrestricted mobile accounting actions.
12. Showing principal-level overdue-fee summaries with unnecessary family details.
13. Combining “received”, “receipted”, “posted”, “deposited”, and “reconciled” into one status.
14. Relying on red/green without text.
15. Exporting data with filters different from the visible report.
16. Losing the user’s scroll position after inspecting a transaction.
17. Using destructive delete for financial records.
18. Showing unverified statutory outputs as officially compliant.
19. Showing BS dates without the active fiscal context.
20. Allowing saved views to preserve permissions the user no longer has.

---

# 21. Prioritized UI development specification

P0 is the active scope. P1 and P2 are design backlogs only.

## UI-P0-01 — Finance shell and shared components

Deliver:

- Accountant navigation.
- Fiscal context header.
- Permission-aware routing.
- Common report header.
- Filter toolbar.
- Financial table.
- Status system.
- Drill-down panel.
- Loading/empty/error states.
- Report/export metadata.
- Responsive read-only fallback.

Acceptance:

- Cross-persona routes are absent and API access fails closed.
- Fiscal year and period are always visible.
- All financial amounts use one formatting/sign policy.
- Shared components meet keyboard and screen-reader basics.

## UI-P0-02 — M3 fees and receivables

Deliver:

- Fee dashboard.
- Student fee ledger.
- Invoice register.
- Collection report.
- Outstanding and aging.
- Discounts/waivers.
- Unallocated payments.
- Parent Fees & Receipts mobile screens.

Acceptance:

- M3 states are distinct from M11 posting states.
- Parent sees only linked-child data.
- Every M3 transaction can show M11 posting status without exposing internal ledger detail to parents.

## UI-P0-03 — Receipts and cashier close

Deliver:

- Daily collection register.
- Receipt register.
- Sequence-exception view.
- Cashier session.
- Cash count and variance flow.
- Deposit preparation.
- Settlement status.
- Parent receipt screen.

Acceptance:

- Closed sessions are read-only.
- Duplicate callback/receipt warnings are visible.
- Payment received, receipt issued, posted, deposited, and reconciled remain distinct.

## UI-P0-04 — Core M11 accounting

Deliver:

- Journal register.
- Voucher register.
- Journal/voucher detail.
- General ledger.
- Trial balance.
- Suspense/unclassified report.
- Manual and backdated entry reports.

Acceptance:

- Out-of-balance journals cannot submit.
- Trial-balance difference is explicit.
- Statement-to-GL and GL-to-voucher drill-down works without losing filter context.

## UI-P0-05 — Cash, bank, and reconciliation

Deliver:

- Cash book.
- Bank book.
- Cash/bank position.
- Bank reconciliation workspace.
- Unreconciled items.
- Undeposited collections.
- Reconciliation attention cards.

Acceptance:

- Matching is reversible only with reason and permission.
- Final reconciliation clearly shows zero or non-zero difference.
- Principal receives summary only, not matching controls.

## UI-P0-06 — Expenses and payables

Deliver:

- Expense register.
- Vendor ledger.
- AP summary.
- Payment-due report.
- Petty-cash register.
- Supporting-document state.

Acceptance:

- Vendor balance reconciles to M11 AP control.
- Missing attachment and approval exceptions are visible.
- Full procurement UI remains deferred unless explicitly required.

## UI-P0-07 — Payroll accounting handoff

Deliver:

- Approved payroll run summary.
- Deduction schedule.
- Payroll liabilities.
- Payroll journal preview.
- Posting and payment reconciliation.
- HR accounting-handoff view.
- Principal payroll summary.

Acceptance:

- Sensitive employee details are permission-reduced.
- Source total, M11 posted total, and difference are visible.
- Statutory schedules show verification status.

## UI-P0-08 — Statements and Principal overview

Deliver:

- Statement of Financial Performance.
- Balance Sheet.
- Receipts and Payments Account.
- Monthly/YTD summary.
- Principal web dashboard.
- Principal mobile finance overview.

Acceptance:

- Statement lines drill to M11 accounts.
- Balance sheet equation is visible and validated.
- Principal pages are server-projected and read-only.

## UI-P0-09 — Audit and exports

Deliver:

- Financial audit trail.
- Reversal/void reports.
- Period reopening.
- Approval exceptions.
- User financial activity/access.
- Supporting-document exceptions.
- Report centre.
- Export dialog.
- Generation history.
- Protected download.
- Audit links.

Acceptance:

- Every exported report reproduces visible filters and totals.
- Export metadata includes requester, parameters, row count, checksum, watermark, and expiry.
- A reviewer can traverse from a statement amount to source evidence.

---

# 22. P1 and P2 UI backlog

## P1

- Cash-flow statement.
- Budget versus actual and variance explanations.
- Cash forecast.
- Full accounts payable aging.
- Procurement and three-way matching.
- Fixed-asset workspaces.
- Funds/grants.
- Statutory filing calendar.
- Auditor workspace.
- Advanced management dashboard.
- Accessibility conformance audit.
- Custom report favourites and scheduled delivery.

## P2

- Multi-branch consolidation dashboard.
- Inter-branch reconciliation.
- Cost and revenue per student.
- Grade/program profitability.
- Multi-year trends.
- Scenario budgeting.
- Anomaly investigation.
- Municipality/institutional report packages.
- High-volume audit evidence bundles.

---

# 23. Universal UI Definition of Done

A finance screen is not complete until:

- Persona and capability rules are documented and tested.
- Authoritative module is visible or inferable.
- Fiscal/date basis is explicit.
- Data freshness is visible.
- Posted/draft/reconciled/final status is explicit.
- Loading, empty, stale, error, and permission states exist.
- Tables have deterministic sorting, totals, keyboard access, and export parity.
- Financial amounts use decimal-safe server data and one sign policy.
- Summary values drill to evidence.
- Sensitive fields are server-redacted.
- Mobile scope respects high-risk-action exclusions.
- Nepal localization is verified.
- Responsive behavior is tested.
- Screen-reader and keyboard basics are verified.
- Exports are protected and audited.
- Cross-tenant and cross-persona tests pass.
- P0 evidence records exact commands, results, screenshots, and known limitations.

---

# 24. Final design decision

The correct SchoolOS financial UI is:

> A desktop-first, evidence-led financial operating workspace for the Accountant; a reduced, server-projected oversight and approval experience for the Principal; and a child-scoped fee and receipt self-service experience for Parents on mobile.

It must optimize for financial correctness, exception resolution, auditability, Nepal localization, and role boundaries before visual novelty.
