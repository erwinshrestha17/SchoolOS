# M11 Accounting and Finance — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-21
**Module:** M11 Accounting and Finance
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M11 is the official school accounting layer for chart of accounts, vouchers, journals, source mappings, fiscal locks, bank reconciliation, reports, snapshots, and controlled corrections.

It converts module financial events into auditable double-entry records and prevents browser-owned ledgers, silent posted edits, and untraceable period changes.

For Nepal schools, it must support Nepal-oriented chart templates, NPR, local fiscal periods, voucher numbering, bank reconciliation, and school leadership reporting while remaining policy-configurable.

---

## 2. Full Feature List

### Accounting dashboard

**Purpose:**
Shows backend-owned balances, posting queues, reconciliation gaps, period state, and exceptions.

**Users:**
Accountant, finance lead, principal read-only.

**Frontend behavior:**
KPI strip and attention queues with as-of/snapshot time.

**Backend alignment:**
Backend summary/ledger is authoritative.

### Chart of accounts

**Purpose:**
Maintains versioned tenant accounts, types, parent hierarchy, active state, and restrictions.

**Users:**
Authorized accountant.

**Frontend behavior:**
Tree/table with search, template import review, and dependency drawer.

**Backend alignment:**
Backend validates hierarchy/usage.

### Nepal chart templates

**Purpose:**
Offers reviewed starting templates without forcing one accounting policy.

**Users:**
Finance setup user.

**Frontend behavior:**
Template preview/mapping/import with differences and confirmation.

**Backend alignment:**
Backend owns template/version/import.

### Vouchers

**Purpose:**
Captures draft voucher types, date, narration, source, lines, attachments, and approval.

**Users:**
Accountant/preparer/approver.

**Frontend behavior:**
Balanced-entry form with backend validation and workflow.

**Backend alignment:**
Backend validates debit=credit, period, permissions.

### Journals

**Purpose:**
Shows official entries and source/reversal chains.

**Users:**
Accountant and auditor.

**Frontend behavior:**
Paginated journal with protected source evidence and no posted inline edit.

**Backend alignment:**
Backend ledger is truth.

### Source mapping

**Purpose:**
Maps approved M3/M7/M8/M10 and other events to accounts.

**Users:**
Finance admin.

**Frontend behavior:**
Mapping table with event/source, accounts, effective version, validation.

**Backend alignment:**
Backend integration/mapping engine owns posting.

### Fiscal locks

**Purpose:**
Closes/reopens periods through high-risk policy and reason.

**Users:**
Finance lead.

**Frontend behavior:**
Period table, blockers, impact preview, approval timeline.

**Backend alignment:**
Backend enforces locks everywhere.

### Reversal-only posted changes

**Purpose:**
Corrects posted vouchers/journals through linked reversal/correction.

**Users:**
Authorized accountant/approver.

**Frontend behavior:**
Original/reversal comparison and reasoned workflow.

**Backend alignment:**
Backend creates immutable linked entries.

### Bank reconciliation

**Purpose:**
Matches statement lines to ledger entries without auto-posting suggestions.

**Users:**
Accountant.

**Frontend behavior:**
Two-pane matching workspace, confidence as guidance, confirm/unmatch.

**Backend alignment:**
Backend imports, suggests, validates, records matches.

### Reports and snapshots

**Purpose:**
Generates trial balance, ledger, income/expense, balance sheet, cash/bank, and period snapshots.

**Users:**
Finance roles.

**Frontend behavior:**
Parameter forms, queued jobs, immutable snapshot/version history.

**Backend alignment:**
Backend computes and generates.

### Principal read-only finance snapshot

**Purpose:**
Shows permitted high-level school finance without journal/private bank detail.

**Users:**
Principal.

**Frontend behavior:**
As-of cards, trend/variance only from summary contract, drill-down permission gates.

**Backend alignment:**
Purpose-limited summary API.

### Exports/protected files

**Purpose:**
Protects reports, vouchers, statements, attachments, and snapshots.

**Users:**
Authorized roles.

**Frontend behavior:**
Authenticated download/open and unavailable/version state.

**Backend alignment:**
File Registry authorizes every action.

---

## 3. Frontend Design Direction Based on Features

Use a controlled accounting workspace under the standard shell. Follow [the master web design plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

- **Layout style:** Module header, backend summary strip when useful, shallow tabs, server filter bar, primary workspace, and optional right drawer.
- **Page density:** Operational laptop density with readable labels and preserved decision context.
- **Cards/table usage:** Cards summarize backend facts; growing records use paginated tables; specialized grids appear only when the job requires them.
- **Drawer usage:** Drawers show selection context and audit without losing filters; full routes handle long forms and complex review.
- **Tabs/subnavigation:** Separate stable subdomains; do not hide required sequence or validation inside arbitrary tabs.
- **Forms:** Sectioned and keyboard usable with inline errors; sticky footer for long workflows; save drafts only when persisted by backend.
- **Filters/quick actions:** Server filtering; one primary action; exports/imports/settings under `More Actions`.
- **Confirmations/status:** High-risk actions show impact and reason; text accompanies semantic color.
- **States:** Loading, empty, no results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file unavailable.
- **Protected files:** File Registry authenticated helpers only; no raw storage keys, provider links, or persistent signed URLs.
- **Responsive behavior:** Collapse rails to drawers, prioritize columns, expand filters on demand, and preserve the main action.

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Accountant | Tenant chart, vouchers, journals, mapping, reconciliation, reports | Platform billing and other tenants | All M11 accounting screens |
| Principal | Purpose-limited read-only snapshot/approvals | Journal lines or bank data without permission | Dashboard/snapshot |
| Cashier | Only source/close handoff where explicitly permitted | Accounting setup/posting | Linked source status |
| Auditor / authorized read-only | Permitted journals/reports/audit evidence | Mutations and masked data | Journals/reports |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes and names; any addition/difference needs route/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/accounting
/dashboard/accounting/chart-of-accounts
/dashboard/accounting/chart-of-accounts/import
/dashboard/accounting/vouchers
/dashboard/accounting/vouchers/[voucherId]
/dashboard/accounting/journals
/dashboard/accounting/journal-entries
/dashboard/accounting/journal-entries/[journalEntryId]
/dashboard/accounting/source-mappings
/dashboard/accounting/fiscal-periods
/dashboard/accounting/banking/accounts
/dashboard/accounting/reconciliation
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

### Platform/Admin Routes

```text
No school ledger routes under /platform; platform billing remains separate.
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Accounting Dashboard

**Purpose:**
See period health and finance exceptions without recalculation.

**Main users:**
Accountant, finance lead, principal projection.

**Route:**
`/dashboard/accounting` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, posting queue, period/reconciliation/report status.

**Layout:**
Module header, context/filter bar, Queues for unposted sources, draft approvals, reconciliation gaps, failed jobs, lock blockers, and a right drawer for selected exception, source chain, allowed actions, audit.

**Header actions:**
Create Voucher; More: reports, close period

**Filters:**
Fiscal period, account scope, source module, status, as-of date

**KPI cards / summary cards:**
Backend balances; drafts; unposted; unreconciled; locked state

**Main table / list / grid:**
Queues for unposted sources, draft approvals, reconciliation gaps, failed jobs, lock blockers

**Right drawer / detail panel:**
selected exception, source chain, allowed actions, audit

**Forms / modals:**
None

**Confirmations:**
Posting/period actions use dedicated confirmation flows

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Summary/as-of, queues, period state, source/handoff status.

**Protected files:**
Exports/evidence protected.

**Audit behavior:**
Exception decisions, exports, drill-down.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 2. Chart and Source Mappings

**Purpose:**
Configure account structure and module mappings safely.

**Main users:**
Finance admin/accountant.

**Route:**
`/dashboard/accounting/chart-of-accounts` (planning route; reuse current route if different).

**Main features shown on this screen:**
Chart, Nepal template, source mappings.

**Layout:**
Module header, context/filter bar, Account tree/table plus selected account dependencies and mapping tabs, and a right drawer for account history/dependencies, mapping/version/dry validation.

**Header actions:**
Add Account / Review Template

**Filters:**
Type, active, hierarchy, unmapped source, effective date, search

**KPI cards / summary cards:**
Accounts; inactive; unmapped; invalid mappings

**Main table / list / grid:**
Account tree/table plus selected account dependencies and mapping tabs

**Right drawer / detail panel:**
account history/dependencies, mapping/version/dry validation

**Forms / modals:**
Account code/name/type/parent; template/mapping effective version

**Confirmations:**
Archive/import/activate mapping requires dependency and impact confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Chart hierarchy, templates, mappings, validation, versions.

**Protected files:**
Template/mapping result export protected if generated.

**Audit behavior:**
Every structural/mapping/version change.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 3. Voucher Editor and Approval

**Purpose:**
Prepare, balance, approve, and post a voucher.

**Main users:**
Preparer, approver.

**Route:**
`/dashboard/accounting/vouchers/[voucherId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Vouchers, attachments, workflow, fiscal locks.

**Layout:**
Module header, context/filter bar, Header fields and line-entry table with account, description, debit, credit, dimensions; backend balance panel, and a right drawer for source references, attachments, approval and audit timeline.

**Header actions:**
Save Draft / Submit / Approve / Post as allowed

**Filters:**
None; account lookup inside lines

**KPI cards / summary cards:**
Debit; credit; difference; validation/period status from backend

**Main table / list / grid:**
Header fields and line-entry table with account, description, debit, credit, dimensions; backend balance panel

**Right drawer / detail panel:**
source references, attachments, approval and audit timeline

**Forms / modals:**
Voucher type/date/narration/reference; lines; attachment

**Confirmations:**
Submit/approve/post shows period, totals, sources, permissions; duplicate blocked

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Accounts, period lock, draft/version, validation, transitions, posting.

**Protected files:**
Voucher/source attachments protected.

**Audit behavior:**
Every line/version, submit/approve/post, failed/duplicate attempt.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 4. Journals and Reversals

**Purpose:**
Inspect official entries and correct posted records by linked reversal only.

**Main users:**
Accountant, auditor/read-only.

**Route:**
`/dashboard/accounting/journals` (planning route; reuse current route if different).

**Main features shown on this screen:**
Journals, reversal-only changes, source chains.

**Layout:**
Module header, context/filter bar, Paginated journal entries/lines with number, date, account, debit, credit, source, status, reversal link, and a right drawer for full entry lines, source chain, reversal/correction chain, attachments, audit.

**Header actions:**
Create Reversal when permitted

**Filters:**
Period, account, source, voucher, status, date, search

**KPI cards / summary cards:**
Backend debit/credit totals for filtered view only if summary contract exists

**Main table / list / grid:**
Paginated journal entries/lines with number, date, account, debit, credit, source, status, reversal link

**Right drawer / detail panel:**
full entry lines, source chain, reversal/correction chain, attachments, audit

**Forms / modals:**
Reversal date/reason/reference; no posted inline edit

**Confirmations:**
Reversal requires exact original/impact review and permission

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Paginated journal/lines, source links, reversal eligibility/mutation.

**Protected files:**
Source evidence and journal export protected.

**Audit behavior:**
Views where required, reversal link/reason/actor, export.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 5. Fiscal Periods and Reconciliation

**Purpose:**
Control period locks and reconcile bank lines to ledger evidence.

**Main users:**
Finance lead, accountant.

**Route:**
`/dashboard/accounting/reconciliation` (planning route; reuse current route if different).

**Main features shown on this screen:**
Fiscal locks, bank reconciliation.

**Layout:**
Module header, context/filter bar, Period lock panel plus two-pane statement-line and ledger-candidate matching workspace, and a right drawer for statement and ledger detail, suggestion basis, match history, lock impact.

**Header actions:**
Confirm Match / Close Period

**Filters:**
Bank account, statement/date, match status, amount, period

**KPI cards / summary cards:**
Unmatched; suggested; matched; variance; period blockers

**Main table / list / grid:**
Period lock panel plus two-pane statement-line and ledger-candidate matching workspace

**Right drawer / detail panel:**
statement and ledger detail, suggestion basis, match history, lock impact

**Forms / modals:**
Statement import, manual match note, close/reopen reason

**Confirmations:**
Match/unmatch/import/close/reopen require reason/impact; suggestions never auto-post

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Periods/locks/blockers, statement import, candidates, match/unmatch, balances.

**Protected files:**
Bank statements and reconciliation exports protected.

**Audit behavior:**
Imports, matches/unmatches, close/reopen, override.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 6. Reports and Snapshots

**Purpose:**
Generate reproducible finance statements and immutable snapshots.

**Main users:**
Accountant, principal projection.

**Route:**
`/dashboard/accounting/reports` (planning route; reuse current route if different).

**Main features shown on this screen:**
Reports, snapshots, protected exports.

**Layout:**
Module header, context/filter bar, Report catalogue/parameter form plus queued job and snapshot history table, and a right drawer for parameters, accounting basis/version, snapshot time, file metadata.

**Header actions:**
Generate Report / Snapshot

**Filters:**
Report type, period, account/dimension, comparative period, state

**KPI cards / summary cards:**
Queued; processing; ready; failed; snapshot as-of

**Main table / list / grid:**
Report catalogue/parameter form plus queued job and snapshot history table

**Right drawer / detail panel:**
parameters, accounting basis/version, snapshot time, file metadata

**Forms / modals:**
Report parameters and permitted notes

**Confirmations:**
Snapshot/re-generation and sensitive export require confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Backend report calculations, validation, job/status, snapshot/version.

**Protected files:**
All reports/statements/snapshots protected.

**Audit behavior:**
Requester, parameters, versions, downloads.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 7. Principal Finance Snapshot

**Purpose:**
Provide a permission-safe read-only school finance overview.

**Main users:**
Principal.

**Route:**
`/dashboard/accounting/principal-snapshot` (planning route; reuse current route if different).

**Main features shown on this screen:**
High-level snapshot only.

**Layout:**
Module header, context/filter bar, As-of summary cards, approved trends, alerts and report links, and a right drawer for safe summary definitions and report links; no journal/bank private detail.

**Header actions:**
Open Approved Report

**Filters:**
Fiscal period/as-of date

**KPI cards / summary cards:**
Backend-approved income, expense, cash/bank or budget metrics only

**Main table / list / grid:**
As-of summary cards, approved trends, alerts and report links

**Right drawer / detail panel:**
safe summary definitions and report links; no journal/bank private detail

**Forms / modals:**
None

**Confirmations:**
None

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Purpose-limited principal summary/snapshot contract.

**Protected files:**
Approved reports protected.

**Audit behavior:**
Read/download where policy requires; no mutations.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

---

## 7. Simple Wireframe Designs

### 1. Accounting Dashboard

```text
+------------------------------------------------------------------+
| Accounting Dashboard                        [Create Voucher] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Backend balances; drafts; unposted; unreconciled; loc |
+------------------------------------------------------------------+
| Filters: Fiscal period, account scope, source module, status,  |
+--------------------------------------------+---------------------+
| Queues for unposted sources, draft appro | selected exceptio |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: None                                              |
+------------------------------------------------------------------+
```

### 2. Chart and Source Mappings

```text
+------------------------------------------------------------------+
| Chart and Source Mappings                   [Add Account / Re] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Accounts; inactive; unmapped; invalid mappings        |
+------------------------------------------------------------------+
| Filters: Type, active, hierarchy, unmapped source, effective d |
+--------------------------------------------+---------------------+
| Account tree/table plus selected account | account history/d |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Account code/name/type/parent; template/mapping e |
+------------------------------------------------------------------+
```

### 3. Voucher Editor and Approval

```text
+------------------------------------------------------------------+
| Voucher Editor and Approval                 [Save Draft / Sub] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Debit; credit; difference; validation/period status f |
+------------------------------------------------------------------+
| Filters: None; account lookup inside lines                     |
+--------------------------------------------+---------------------+
| Header fields and line-entry table with  | source references |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Voucher type/date/narration/reference; lines; att |
+------------------------------------------------------------------+
```

### 4. Journals and Reversals

```text
+------------------------------------------------------------------+
| Journals and Reversals                      [Create Reversal ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Backend debit/credit totals for filtered view only if |
+------------------------------------------------------------------+
| Filters: Period, account, source, voucher, status, date, searc |
+--------------------------------------------+---------------------+
| Paginated journal entries/lines with num | full entry lines, |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Reversal date/reason/reference; no posted inline  |
+------------------------------------------------------------------+
```

### 5. Fiscal Periods and Reconciliation

```text
+------------------------------------------------------------------+
| Fiscal Periods and Reconciliation           [Confirm Match / ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Unmatched; suggested; matched; variance; period block |
+------------------------------------------------------------------+
| Filters: Bank account, statement/date, match status, amount, p |
+--------------------------------------------+---------------------+
| Period lock panel plus two-pane statemen | statement and led |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Statement import, manual match note, close/reopen |
+------------------------------------------------------------------+
```

### 6. Reports and Snapshots

```text
+------------------------------------------------------------------+
| Reports and Snapshots                       [Generate Report ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Queued; processing; ready; failed; snapshot as-of     |
+------------------------------------------------------------------+
| Filters: Report type, period, account/dimension, comparative p |
+--------------------------------------------+---------------------+
| Report catalogue/parameter form plus que | parameters, accou |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Report parameters and permitted notes             |
+------------------------------------------------------------------+
```

### 7. Principal Finance Snapshot

```text
+------------------------------------------------------------------+
| Principal Finance Snapshot                  [Open Approved Re] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Backend-approved income, expense, cash/bank or budget |
+------------------------------------------------------------------+
| Filters: Fiscal period/as-of date                              |
+--------------------------------------------+---------------------+
| As-of summary cards, approved trends, al | safe summary defi |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: None                                              |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Context, title, one primary action | Reuse | Secondary work in `More Actions`. |
| `KpiGrid` / `SummaryStrip` | Backend totals/status | Reuse | Honest unavailable state if missing. |
| `FilterBar` | Server search/filters | Reuse | Preserve URL state where practical. |
| Paginated table / purpose grid | Growing records | Reuse | Permission-safe column priority. |
| Status badge | Lifecycle/health/risk | Extend shared | Text plus semantic color. |
| Detail drawer | Detail/actions/audit | Reuse | Reauthorize mutation. |
| Validated form / sticky footer | Creation and workflow | Reuse | Safe field errors. |
| Confirmation/reason dialog | High-risk change | Reuse | Show exact impact. |
| Protected file/upload controls | Authenticated files | Reuse | File Registry only. |
| Audit timeline | Actor/reason/state history | Reuse/create shared | Backend facts only. |
| M11 widgets | chart, voucher, journal, source mapping, fiscal lock, reconciliation, report, and principal snapshot widgets | Create composition | Reuse base primitives. |

---

## 9. Backend and API Alignment

> Capability labels are planning terms, not endpoint names. Use verified current OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries, paginated lists, scoped details, and backend-owned totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated commands with RBAC/entitlement and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Chart/template/mapping version; voucher draft/submit/approve/post; reversal; period close/reopen; statement import/match/unmatch; report/snapshot jobs. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Balanced lines, account state, fiscal lock/date, dimensions, source mapping, approval separation, idempotency, reversal eligibility. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Official statements and snapshots are backend calculations delivered through queued protected jobs. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Vouchers, source evidence, statements, reconciliation files, reports and snapshots use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Approval, posting failure, period close/reopen, and report-ready events emit M12 notifications without ledger detail leakage. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

M11 owns official accounting. Source modules emit approved events; frontend never writes journals from M3/M7/M8/M10 screens. SaaS billing stays platform-side. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Every chart/mapping/voucher/journal/reversal/period/reconciliation/report action and read where policy requires. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Principal/read-only/cashier projections omit journal, bank and sensitive finance detail unless specifically permitted. **needs OpenAPI confirmation** unless verified in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Request pending | Layout skeleton; preserve context | Request state |
| Empty | No records | Explanation and one permitted action | Empty response |
| No search results | Filters match nothing | Preserve filters; clear action | List metadata |
| Validation error | Input invalid | Inline errors and summary | Safe validation envelope |
| Permission denied | Scope fails | No forbidden detail | Backend RBAC |
| Module locked | Entitlement off | Locked state; no fake values | Entitlement guard |
| Mutation pending | Command in flight | Prevent duplicate action | Mutation/job status |
| Success | Confirmed | Feedback and refetch | Response |
| Failure | Safe error | Friendly retry | Safe error envelope |
| Partial failure | Batch partly succeeds | Itemized outcome | Batch result |
| Queued job | Async work | Job status tracker | Job API |
| Protected file unavailable | Missing/unauthorized | Safe unavailable state | File Registry |
| Stale data | Timestamp too old | Stale badge and refresh | Backend timestamp |
| Fiscal period locked | Selected date belongs to locked period | Disable mutation and show approved reopen/correction path | Backend fiscal lock |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates all queries, jobs, exports, files, events, caches, and audit records.
- Backend RBAC and module entitlement are truth; frontend hiding is UX only.
- Posted entries are immutable; only linked reversal/correction changes them.
- Bank details, journals, attachments, and reports are permission/file scoped.
- Reconciliation suggestions are advisory and never auto-post.
- Sensitive fields are omitted/masked by backend permission and never placed in URLs, logs, analytics, or exports without authorization.
- Protected files use File Registry helpers; never expose object keys, provider URLs, secrets, or raw internal errors.
- Audit-sensitive actions show backend actor/time/reason/history; the UI invents no audit facts.

---

## 12. Nepal-Specific Requirements

- Use NPR exact backend values and Nepal fiscal-period/calendar labels configured by the school.
- Provide reviewed Nepal-oriented chart templates as optional starting points, not hard-coded universal accounting policy.
- Support local voucher types/numbering, narration, bank statement practice, and school approval separation.
- Reports must disclose period, as-of time, accounting basis/version, school identity, and generated status.
- Current tax/statutory/reporting requirements need policy/backend verification.

---

## 12A. Consolidated M11 Reference Notes

The retired M11 accounting analysis was merged here so this file remains the active Accounting and Finance frontend source of truth.

- M11 is the school accounting control center, not platform SaaS billing and not a fee-only report page. Other module UIs may expose source status, but official ledger posting belongs to backend-owned M11 accounting boundaries.
- Chart of accounts supports Nepal-ready templates, import preview before commit, type/code/parent/active state, dependency review, and no silent delete/archive when an account has history.
- Voucher and journal states include draft, review, approved, posted, reversed, rejected, fiscal-period locked, posting blocked, and reversal required where backend exposes them. Posted records are corrected only through linked reversal/correction workflows.
- Source mapping status should distinguish mapped, unmapped, failed, pending, duplicate, and reversed. No frontend code in M3, M7, M8, M10, or other modules writes journals directly.
- Bank reconciliation suggestions are review-only until confirmed by an authorized user. Suggestions must not auto-post; confirmation/unmatch/import/close/reopen actions require audit and reason where policy requires it.
- Principal finance views are read-only, summary-first, and hide edit/post/reverse/source-mapping/period-reopen controls plus private operational detail beyond leadership need.

---

## 13. Implementation Checklist

```text
[ ] Uses master SchoolOS layout, theme, and design system.
[ ] Every feature maps to a screen and every screen to a wireframe.
[ ] Current routes/OpenAPI/contracts/permissions/tests were inspected.
[ ] Real APIs and backend totals only; no fake production data.
[ ] Growing lists filter and paginate server-side.
[ ] Global and domain states are implemented.
[ ] Protected files use File Registry helpers.
[ ] Purpose-limited roles fail closed.
[ ] High-risk actions confirm impact, collect reason, avoid duplicates, and expose audit status.
[ ] Unknowns say needs OpenAPI confirmation or needs backend verification.
[ ] Responsive layout keeps the main job usable.
```

---

## 14. Done Definition

```text
[ ] All module features are explained with frontend behavior.
[ ] Every expected screen is specified and wireframed.
[ ] Backend/API, job, event, file, audit, and scope needs are listed.
[ ] States, security boundaries, and Nepal-specific needs are clear.
[ ] No endpoint shape or backend truth is invented.
[ ] Design is simple and implementation-ready.
[ ] Module implementation does not depend on deep detail in the master plan.
```
