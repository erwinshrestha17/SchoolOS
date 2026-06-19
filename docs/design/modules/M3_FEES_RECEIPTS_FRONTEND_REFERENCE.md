# M3 Fees and Receipts — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-19
**Module:** M3 Fees and Receipts
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M3 manages student charges, dues, payments, receipts, adjustments, cashier controls, and guardian visibility while preserving backend money truth.

It gives cashiers and accountants a safe collection workflow for cash and supported digital methods without browser-calculated balances or silent edits.

For Nepal schools, it must use NPR, Decimal-safe backend values, local receipt practices, fee heads/periods, cash-heavy counter workflows, and clear guardian phone/child context.

---

## 2. Full Feature List

### Fee dashboard

**Purpose:**
Shows backend-owned collections, dues, overdue exposure, reversals, and cashier status.

**Users:**
Accountant, cashier, principal by permission.

**Frontend behavior:**
KPI strip and attention queues with explicit as-of time.

**Backend alignment:**
Backend summary API owns every amount.

### Student ledger

**Purpose:**
Explains invoices, charges, payments, waivers, reversals, refunds, and balance chronologically.

**Users:**
Accountant, cashier; parent child-safe view.

**Frontend behavior:**
Ledger table with debit/credit labels, source, status, receipt links, and running balance only from backend.

**Backend alignment:**
Backend ledger projection and totals are authoritative.

### Payment collection

**Purpose:**
Allocates a received amount to eligible dues and confirms the method/reference.

**Users:**
Cashier and authorized accountant.

**Frontend behavior:**
Student search, due selection, tender form, review step, idempotent submit, confirmed result.

**Backend alignment:**
Backend validates allocation, atomic write, idempotency, and receipt creation.

### Invoice and due views

**Purpose:**
Lists current/overdue invoices and fee-head breakdowns.

**Users:**
Finance staff and linked parents.

**Frontend behavior:**
Server-filtered due table and child-safe invoice detail.

**Backend alignment:**
Backend computes due/aging/discount state.

### Receipts and reprint

**Purpose:**
Displays only confirmed receipts and provides protected reprint.

**Users:**
Cashier, accountant, parent.

**Frontend behavior:**
Receipt list/detail with status, payment method, allocations, version/reprint history.

**Backend alignment:**
Receipt identity and reprint idempotency are backend-owned.

### Reversal, refund, waiver

**Purpose:**
Corrects money through explicit permitted workflows rather than editing confirmed records.

**Users:**
Authorized finance roles.

**Frontend behavior:**
Reasoned request/approval dialogs with original transaction context and audit timeline.

**Backend alignment:**
Eligibility, amount limits, approval, posting, and idempotency are backend-owned.

### Cashier close

**Purpose:**
Reconciles session totals by method and records discrepancy evidence.

**Users:**
Cashier and approver.

**Frontend behavior:**
Open-session banner, backend totals, counted amounts, variance, submit/review, protected report.

**Backend alignment:**
Backend owns sessions, totals, locks, and close state.

### Parent fee and receipt view

**Purpose:**
Shows a guardian only linked-child dues, payments, and allowed receipts.

**Users:**
Parent.

**Frontend behavior:**
Child selector, due summary, ledger/receipt list, protected downloads, payment guidance.

**Backend alignment:**
Purpose-limited parent API; no internal notes or other children.

### M11 accounting handoff

**Purpose:**
Shows accounting handoff/posting status without allowing M3 UI to write journals directly.

**Users:**
Accountant.

**Frontend behavior:**
Source-event status and exception link in payment/reversal/close detail.

**Backend alignment:**
Approved backend integration posts/maps into M11.

### NPR and Decimal truth

**Purpose:**
Formats backend-provided exact values consistently and never recalculates official totals in JavaScript.

**Users:**
All users.

**Frontend behavior:**
NPR labels, exact decimal strings, backend totals, explicit rounding policy display where provided.

**Backend alignment:**
Database/backend Decimal values are authoritative.

---

## 3. Frontend Design Direction Based on Features

Use a cashier and ledger workspace under the global SchoolOS app shell. Keep one primary job per route, calm white surfaces, the module accent only for location, and semantic colors for status.

- **Layout style:** Module header, optional KPI strip, compact subnavigation, filter bar, main work area, and a right drawer for selection context.
- **Page density:** Laptop-friendly operational density; do not compress forms or hide decision context.
- **Cards and tables:** Cards summarize backend-owned values; paginated tables handle growing records; grids are reserved for visual content.
- **Drawers and tabs:** Drawers support review without losing filters. Tabs separate stable subdomains, not workflow steps.
- **Forms:** Group school-language fields, show inline validation, preserve safe drafts only when the backend supports them, and use sticky actions for long forms.
- **Filters and quick actions:** Server-side search/filtering; one primary header action; exports, imports, settings, and destructive actions under secondary menus.
- **Dialogs and badges:** Confirmation plus reason for high-risk actions. Text labels accompany every status color.
- **States:** Every route implements loading, empty, no-results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file-unavailable behavior.
- **Protected files:** Use File Registry-backed authenticated buttons/links; never render raw keys, provider URLs, or persistent signed URLs.
- **Responsive behavior:** At narrower desktop/tablet widths, collapse detail rails into drawers, prioritize columns, and move long filters into an expandable panel.

Follow [the master web design plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the web design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Accountant | Tenant fee configuration, ledgers, adjustments, close and handoff | Platform billing and other tenants | All M3 finance screens |
| Cashier | Collect payments, issue receipts, close own session | Unauthorized refund/reversal or journal access | Collection, receipts, cashier close |
| Principal | Permission-safe summary and approval queue | Private tender detail without permission | Dashboard, approval |
| Parent | Linked-child dues/payments/receipts | Other children, cashier notes, internal accounting | Parent fees |

---

## 5. Recommended Route Map

> These are design-planning routes. Reuse current routes and names where they exist; additions or differences need OpenAPI/router confirmation.

### Admin / Staff Routes

```text
/dashboard/fees
/dashboard/fees/ledgers/[studentId]
/dashboard/fees/collect
/dashboard/fees/invoices
/dashboard/fees/receipts
/dashboard/fees/adjustments
/dashboard/fees/cashier-close
```

### Parent Routes

```text
/parent/children/[studentId]/fees
/parent/children/[studentId]/receipts
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Fee Dashboard and Dues

**Purpose:**
Prioritize collection and finance exceptions using backend totals.

**Main users:**
Accountant, cashier, principal by permission.

**Route:**
`/dashboard/fees` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Dashboard; invoice/due views; M11 handoff exceptions.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Paginated dues/invoice queue with student, class, fee period/head, billed, paid, due, age, status, and a right detail drawer for selected invoice, allocations, guardian contact, reminders, accounting status.

**Header actions:**
Collect Payment; More: Export, adjustments, close

**Filters:**
Academic/fiscal period, class, section, fee head, due status, search

**KPI cards / summary cards:**
Collected today; outstanding; overdue; reversals pending; open cashier sessions

**Main table / list / grid:**
Paginated dues/invoice queue with student, class, fee period/head, billed, paid, due, age, status

**Right drawer / detail panel:**
selected invoice, allocations, guardian contact, reminders, accounting status

**Forms / modals:**
None

**Confirmations:**
Bulk reminders/exports require scope confirmation

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Backend summary, due list, invoice detail, as-of timestamp, handoff state.

**Protected files:**
Due statements/exports protected when generated.

**Audit behavior:**
Exports, reminder events, exception handling.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 2. Student Ledger

**Purpose:**
Explain one student’s complete fee position.

**Main users:**
Accountant, cashier; parent uses separate projection.

**Route:**
`/dashboard/fees/ledgers/[studentId]` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Student ledger; invoice and receipt drill-down.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Chronological ledger with date, source, reference, debit, credit, backend balance, status, and a right detail drawer for transaction allocation, receipt, reversal chain, M11 handoff, audit.

**Header actions:**
Collect Payment; Download Statement

**Filters:**
Period, fee head, transaction type, status

**KPI cards / summary cards:**
Total billed; paid; waived; refunded; due

**Main table / list / grid:**
Chronological ledger with date, source, reference, debit, credit, backend balance, status

**Right drawer / detail panel:**
transaction allocation, receipt, reversal chain, M11 handoff, audit

**Forms / modals:**
None

**Confirmations:**
None for read; actions open dedicated confirmation workflows

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Student fee summary, paginated ledger, source detail and exact decimals.

**Protected files:**
Receipts and statement through File Registry.

**Audit behavior:**
Read detail; mutations audited in dedicated flows.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 3. Payment Collection and Receipt

**Purpose:**
Collect an exact amount safely and show a receipt only after confirmation.

**Main users:**
Cashier, accountant.

**Route:**
`/dashboard/fees/collect` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Payment collection; receipt generation/reprint.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Student lookup, eligible dues, allocation table, tender form, review summary, confirmed receipt, and a right detail drawer for student and invoice context; no persistent drawer during final review.

**Header actions:**
Confirm Payment; Cancel

**Filters:**
Student/admission/guardian phone lookup; due period/head

**KPI cards / summary cards:**
Selected dues; amount due; allocation; balance after from backend preview

**Main table / list / grid:**
Student lookup, eligible dues, allocation table, tender form, review summary, confirmed receipt

**Right drawer / detail panel:**
student and invoice context; no persistent drawer during final review

**Forms / modals:**
Amount, method, reference, date within policy, allocation, note; idempotency token hidden

**Confirmations:**
Final payment confirmation shows student, amount, method, allocation; duplicate submit blocked

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Student lookup, eligible dues, allocation preview, payment mutation, confirmed receipt.

**Protected files:**
Confirmed receipt protected; no pre-success fake receipt.

**Audit behavior:**
Payment attempt/result, allocation, method/reference, receipt, duplicate handling.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 4. Adjustments: Reversal / Refund / Waiver

**Purpose:**
Request, approve, and trace permitted corrections.

**Main users:**
Authorized accountant/approver.

**Route:**
`/dashboard/fees/adjustments` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Reversal, refund, waiver workflows.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Queue with type, student, original reference, amount, requester, reason, status, and a right detail drawer for original transaction, eligibility, before/after balance from backend, approval/audit chain.

**Header actions:**
New Request; Approve/Reject when allowed

**Filters:**
Type, status, date, requester, student

**KPI cards / summary cards:**
Pending approval; approved; failed; completed

**Main table / list / grid:**
Queue with type, student, original reference, amount, requester, reason, status

**Right drawer / detail panel:**
original transaction, eligibility, before/after balance from backend, approval/audit chain

**Forms / modals:**
Type-specific amount/reason/evidence/approval form

**Confirmations:**
Every adjustment requires exact impact review, reason, permission, and idempotency

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Eligibility, preview, request, approval, execution, status and balances.

**Protected files:**
Evidence/refund proof protected if supported.

**Audit behavior:**
Original link, requester/approver, reason, before/after, M11 event.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 5. Cashier Close

**Purpose:**
Close and reconcile a cashier session without client-calculated truth.

**Main users:**
Cashier, finance approver.

**Route:**
`/dashboard/fees/cashier-close` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Cashier session; counted totals; discrepancy; close report.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Backend tender totals beside counted amounts, variance, payment list, close history, and a right detail drawer for selected payment, discrepancy notes, approval and handoff history.

**Header actions:**
Submit Close; Approve Close

**Filters:**
Session/date, cashier, state

**KPI cards / summary cards:**
Backend expected; counted; variance; transactions; reversals

**Main table / list / grid:**
Backend tender totals beside counted amounts, variance, payment list, close history

**Right drawer / detail panel:**
selected payment, discrepancy notes, approval and handoff history

**Forms / modals:**
Counted cash/method values and discrepancy reason

**Confirmations:**
Submit/approve/reopen or correction requires confirmation and reason

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Session totals, counted-input validation, close transition, discrepancy, report job.

**Protected files:**
Close report and supporting evidence protected.

**Audit behavior:**
Session open/close, counts, variance, approvals, report, handoff.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

### 6. Parent Fees and Receipts

**Purpose:**
Give guardians a clear linked-child fee view without finance internals.

**Main users:**
Parent.

**Route:**
`/parent/children/[studentId]/fees` (planning route; reuse the current route if different).

**Main features shown on this screen:**
Child dues, payments, receipts and school payment guidance.

**Layout:**
Module header, backend summary strip, filter bar where relevant, Due cards and chronological invoice/payment/receipt list with backend amounts, and a right detail drawer for invoice breakdown and allowed receipt detail.

**Header actions:**
Open Receipt; View Payment Guidance

**Filters:**
Child, academic year/period, status

**KPI cards / summary cards:**
Amount due; next due; paid this period; overdue from backend

**Main table / list / grid:**
Due cards and chronological invoice/payment/receipt list with backend amounts

**Right drawer / detail panel:**
invoice breakdown and allowed receipt detail

**Forms / modals:**
None unless a separately approved payment workflow exists

**Confirmations:**
None

**States:**
Loading, empty, no results, parsed error with retry, permission denied, module locked, validation failure, mutation pending/success/failure, partial success, queued processing, stale data, and protected-file unavailable; add the domain states named in Section 10.

**Backend data needed:**
Linked-child fee summary, invoices, payments and receipt metadata.

**Protected files:**
Receipts/statements through authenticated helper.

**Audit behavior:**
No internal cashier/accounting audit exposure.

**Responsive note:**
Preserve the primary job; convert the right rail to a drawer, prioritize essential columns, and keep the primary action reachable.

---

## 7. Simple Wireframe Designs

### 1. Fee Dashboard and Dues

```text
+------------------------------------------------------------------+
| Fee Dashboard and Dues                     [Collect Payment] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Collected today; outstanding; overdue; reversals pend |
+------------------------------------------------------------------+
| Filters: Academic/fiscal period, class, section, fee head, due |
+--------------------------------------------+---------------------+
| Paginated dues/invoice queue with studen | selected invoice, |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 2. Student Ledger

```text
+------------------------------------------------------------------+
| Student Ledger                             [Collect Payment] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Total billed; paid; waived; refunded; due             |
+------------------------------------------------------------------+
| Filters: Period, fee head, transaction type, status            |
+--------------------------------------------+---------------------+
| Chronological ledger with date, source,  | transaction alloc |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 3. Payment Collection and Receipt

```text
+------------------------------------------------------------------+
| Payment Collection and Receipt             [Confirm Payment] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Selected dues; amount due; allocation; balance after  |
+------------------------------------------------------------------+
| Filters: Student/admission/guardian phone lookup; due period/h |
+--------------------------------------------+---------------------+
| Student lookup, eligible dues, allocatio | student and invoi |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Amount, method, reference, date within policy, allocation, not |
+------------------------------------------------------------------+
```

### 4. Adjustments: Reversal / Refund / Waiver

```text
+------------------------------------------------------------------+
| Adjustments: Reversal / Refund / Waiver    [New Request] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Pending approval; approved; failed; completed         |
+------------------------------------------------------------------+
| Filters: Type, status, date, requester, student                |
+--------------------------------------------+---------------------+
| Queue with type, student, original refer | original transact |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Type-specific amount/reason/evidence/approval form             |
+------------------------------------------------------------------+
```

### 5. Cashier Close

```text
+------------------------------------------------------------------+
| Cashier Close                              [Submit Close] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Backend expected; counted; variance; transactions; re |
+------------------------------------------------------------------+
| Filters: Session/date, cashier, state                          |
+--------------------------------------------+---------------------+
| Backend tender totals beside counted amo | selected payment, |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| Counted cash/method values and discrepancy reason              |
+------------------------------------------------------------------+
```

### 6. Parent Fees and Receipts

```text
+------------------------------------------------------------------+
| Parent Fees and Receipts                   [Open Receipt] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Amount due; next due; paid this period; overdue from  |
+------------------------------------------------------------------+
| Filters: Child, academic year/period, status                   |
+--------------------------------------------+---------------------+
| Due cards and chronological invoice/paym | invoice breakdown |
| Paginated content / form / state area      | Context / actions   |
+--------------------------------------------+---------------------+
| None unless a separately approved payment workflow exists      |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Title, purpose, one primary action, secondary menu | Reuse existing | Keep scope and academic/fiscal context visible. |
| `KpiGrid` / `SummaryStrip` | Backend-owned operational summaries | Reuse existing | Show unavailable state when summary contract is missing. |
| `FilterBar` | Server-side search and filters | Reuse existing | Preserve filters in URL where practical. |
| Paginated data table | Growing operational records | Reuse existing | Column visibility remains permission-safe. |
| Module status badges | Domain lifecycle and risk | Extend shared badges | Text plus semantic color; never color-only. |
| Detail drawer | Selected record, actions, history | Reuse existing | Reauthorize actions on mutation. |
| Validated form sections | Create/edit/review workflows | Reuse primitives | Long forms use sticky action footer. |
| Reason confirmation dialog | High-risk action confirmation | Reuse existing | Reason required when backend policy requires it. |
| `ProtectedFileButton` / upload widget | Authenticated open/download/upload | Reuse existing | File Registry only; safe unavailable state. |
| Timeline / audit panel | Workflow and actor history | Reuse or create shared | Render backend audit facts only. |
| M3 scoped widgets | student ledger, collection, receipt, adjustment, and cashier-close widgets | Create module composition | Reuse base primitives; do not fork the design system. |

---

## 9. Backend and API Alignment

> Capability names below are planning labels, not invented endpoint names. Implement with current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries; paginated lists; scoped detail; backend totals/status. **needs OpenAPI confirmation** unless already present in the current contract.

### Write / Mutation APIs

Create/update commands with validation, permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless already present in the current contract.

### Workflow APIs

Payment preview/confirm; receipt reprint; reversal/refund/waiver request and approval; cashier close; accounting handoff. **needs OpenAPI confirmation** unless already present in the current contract.

### Validation APIs

Exact Decimal amounts, eligible dues, allocation, method/reference, session state, permissions, idempotency, period/lock. **needs OpenAPI confirmation** unless already present in the current contract.

### Report / Export Jobs

Statements, receipts, cashier-close reports, aging/collection exports are backend generated and protected. **needs OpenAPI confirmation** unless already present in the current contract.

### File Registry / Protected File APIs

Receipts, statements, close reports, evidence, and exports use File Registry. **needs OpenAPI confirmation** unless already present in the current contract.

### Notification Events

Due/payment/receipt/adjustment events go to M12; M3 never calls providers. **needs OpenAPI confirmation** unless already present in the current contract.

### Accounting / Finance Boundaries

M3 owns school fee collection; M11 owns official accounting. Frontend never posts journals directly or mixes SaaS billing. **needs OpenAPI confirmation** unless already present in the current contract.

### Audit Logs

Every money write, failed/duplicate attempt, receipt reprint, adjustment, close, and handoff reference. **needs OpenAPI confirmation** unless already present in the current contract.

### Role-Scoped APIs

Parent endpoints are linked-child only; cashier capabilities are narrower than accountant/approver. **needs OpenAPI confirmation** unless already present in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Initial or filtered request | Layout-matching skeleton; preserve header/filter context | Request status |
| Empty | No records exist | Explain why and show one permitted next action | Empty paginated response |
| No search results | Filters match nothing | Preserve filters; clear-filter action | Filtered list metadata |
| Validation error | Input fails rules | Inline field errors and safe summary | Bounded validation envelope |
| Permission denied | Role/scope fails | No forbidden data; safe route state | Backend RBAC |
| Module locked | Entitlement disabled | Locked state; no fake values or writes | Entitlement guard |
| Mutation pending | Command submitted | Disable duplicate submit; show progress | Mutation/job status |
| Success | Mutation confirmed | Success feedback and refetch affected data | Confirmed response |
| Failure | Safe command failure | Parsed school-friendly error and retry | Safe error envelope |
| Partial failure | Batch/job partly succeeds | Itemized success/failure; retry eligible items | Batch result |
| Queued job | Export/generation is asynchronous | Queued/processing/succeeded/failed tracker | Job status API |
| Protected file unavailable | Missing, expired, or unauthorized file | Safe unavailable message; no raw URL/key | File Registry authorization |
| Stale data | Timestamp exceeds policy | Stale badge and refresh; never imply live state | Backend timestamp |
| Payment confirmation pending | Idempotent write has not returned confirmed success | Keep receipt unavailable and prevent duplicate submit | Payment mutation/idempotency status |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- Every query, job, export, and file is isolated by authenticated `tenantId`; the browser never supplies trusted tenant scope.
- Backend RBAC and module entitlement are authoritative. Hidden controls are only UX; direct calls must fail closed.
- All amounts and balances come from backend Decimal responses; never compute official totals client-side.
- Receipts appear only after confirmed success; confirmed records are corrected by reversal/refund/waiver workflows.
- Mask payment references and finance details by permission.
- Sensitive fields are omitted or masked by permission; do not place them in table rows, URLs, logs, or analytics.
- Protected files use authenticated File Registry helpers. Never expose raw object keys, provider URLs, permanent public URLs, or storage internals.
- Audit-sensitive actions show backend actor/time/reason/history; the browser does not invent audit facts.
- Parse safe backend error envelopes. Never show raw stack traces, Prisma/provider/storage errors, secrets, or internal payloads.

---

## 12. Nepal-Specific Requirements

- Format money as NPR with a single shared formatter while retaining exact backend Decimal values.
- Support cash-heavy counters and locally used approved payment methods/references without inventing provider success.
- Use school fee heads, academic periods, class/section and guardian phone lookup conventions.
- Receipts need school identity, fiscal/receipt numbering, payer/student context, allocations, method, and authorized status from backend.
- Keep school fees separate from SchoolOS subscription/platform billing.

---

## 13. Implementation Checklist

```text
[ ] Screen uses the SchoolOS app shell, master web rules, and design system.
[ ] Full feature list is covered by the documented screens.
[ ] Every Section 6 screen has a matching Section 7 wireframe.
[ ] Current routes, OpenAPI, shared contracts, permissions, DTOs, and tests were inspected.
[ ] Real backend APIs and backend-owned totals only; no fake production metrics.
[ ] Growing lists use server-side filtering and pagination.
[ ] Loading, empty, error, permission, locked, mutation, partial, queued, stale, and file states exist.
[ ] Protected files use File Registry-backed helpers.
[ ] Purpose-limited parent/student/teacher/staff/driver scopes are enforced where relevant.
[ ] High-risk actions have confirmation, reason where required, idempotency protection, and audit state.
[ ] Missing contracts are marked needs OpenAPI confirmation or needs backend verification.
[ ] Responsive behavior preserves the primary job on laptop/tablet widths.
```

---

## 14. Done Definition

```text
[ ] All module features are explained.
[ ] Each feature has matching frontend behavior.
[ ] Every expected screen is documented.
[ ] Every expected screen has a simple wireframe.
[ ] Backend/API needs are listed without inventing endpoint names.
[ ] Required states are listed.
[ ] Security and role boundaries are clear.
[ ] Nepal-specific needs are included.
[ ] Design remains simple and implementation-friendly.
[ ] A frontend engineer can implement without searching the master plan for module-specific behavior.
```
