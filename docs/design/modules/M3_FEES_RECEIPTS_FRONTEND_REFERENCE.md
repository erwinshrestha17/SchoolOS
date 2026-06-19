# M3 Fees and Receipts — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M3 Fees and Receipts  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M3. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M3 is the cashier and fee-collection workspace. It must support accurate dues, invoices, payments, receipts, reversals, waivers, refunds, cashier close, and parent visibility with backend-owned money truth.

Core flow:

```text
Fee setup
-> invoice / due generation
-> student ledger review
-> payment collection
-> receipt generation
-> reversal / refund / waiver where permitted
-> cashier close
-> M11 accounting handoff
-> parent receipt and dues visibility
```

---

## 2. Theme and Layout Alignment

Use a finance-grade variant of the SchoolOS web workbench:

```text
ModuleHeader
Money KPI strip
Student / invoice search
Main ledger or payment workspace
Right payment summary rail
Sticky confirmation footer
Protected receipt actions
Audit timeline
```

Design rules:

- NPR amounts are right-aligned and formatted consistently.
- Use backend Decimal/numeric values only.
- Highlight pending, partially paid, overdue, waived, refunded, reversed, and posted states with text badges.
- Payment actions require confirmation and idempotent pending state.
- Reversal/refund/waiver actions require permission, reason, confirmation, and audit visibility.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Cashier | Collect payments and print receipts. | Payment workflow only. |
| Accountant / finance staff | Review ledgers, reports, reversals, close, handoff. | Finance permission-gated. |
| Admin | Configure fee heads/plans where allowed. | Tenant-scoped settings. |
| Principal | Read-only collection health and overdue risk. | Summary unless finance permission allows depth. |
| Parent | View linked child dues, payments, receipts. | Linked-child only. |

---

## 4. Recommended Route Map

```text
/dashboard/fees
/dashboard/fees/students
/dashboard/fees/students/[studentId]
/dashboard/fees/invoices
/dashboard/fees/invoices/[invoiceId]
/dashboard/fees/collect
/dashboard/fees/payments
/dashboard/fees/receipts
/dashboard/fees/reversals
/dashboard/fees/waivers
/dashboard/fees/cashier-close
/dashboard/fees/reports
/dashboard/fees/settings
/parent/fees
/parent/receipts
```

---

## 5. Required Screens

### 5.1 Fees Dashboard

- KPI cards: collected today, pending dues, overdue amount, invoices generated, receipts issued, reversal/refund requests, cashier close status.
- Attention queue: overdue students, failed receipt generation, pending cashier close, unmapped accounting source, provider/payment failures.
- Quick actions: Collect Payment, Generate Invoices, Print Receipt, Cashier Close, Export Report.

### 5.2 Student Fee Ledger

- Student identity header with class/section/roll and linked guardian contacts where permitted.
- Ledger table: period, fee head, invoice, due, discount, paid, balance, status.
- Right rail: payment history, receipts, concessions, overdue notes, audit timeline.
- Parent/teacher views must not expose internal finance notes.

### 5.3 Collect Payment Workspace

Payment flow:

```text
Select student
-> select invoices/dues
-> choose payment method
-> enter reference/details
-> backend validation preview
-> confirm payment
-> receipt success/failure
```

Supported payment method UI should appear only if backend/provider config supports it:

```text
Cash
Bank transfer
Cheque
Wallet/eSewa/Khalti-ready
Manual adjustment where permitted
```

### 5.4 Receipt View and Reprint

- Receipt card with receipt number, student, amount, method, date, cashier, status.
- Protected PDF download/print.
- Reprint must use backend/File Registry behavior, not browser-generated official proof.

### 5.5 Reversal / Refund / Waiver

- Show original record, impact preview, reason, approval requirement, audit warning.
- Posted/confirmed records must not be silently edited.
- Use reversal/correction flow where backend requires it.

### 5.6 Cashier Close

- Expected vs actual collection by method.
- Difference reason required if mismatch.
- Close status: Draft, Submitted, Approved, Reopened, Locked.
- Protected close report generation.

### 5.7 Parent Fees View

- Linked child dues, upcoming due dates, payment history, receipts.
- Child-scoped protected receipt download.
- No internal finance notes, other students, cashier close, or accounting mappings.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Fee head/plan APIs
Invoice and due generation APIs
Student ledger API
Payment collection idempotency
Receipt generation and protected file access
Discount/waiver/refund/reversal workflow
Cashier close workflow
Payment method/provider readiness
M11 accounting source handoff
M12 fee due/payment notification events
Parent child-scoped fee APIs
Audit trail for all money mutations
```

Backend ownership rules:

- Money totals are backend-owned.
- Receipts are backend-generated or File Registry-backed.
- Payment/reversal/refund submissions are idempotent.
- Accounting handoff goes through M11 boundaries.
- Parent reads are linked-child scoped.

---

## 7. Required States

```text
Loading ledger
No dues
Payment pending
Payment duplicate ignored
Receipt generating
Receipt ready
Receipt failed
Provider disabled
Payment failed
Cashier close pending
Cashier close locked
Reversal required
Refund pending
Waiver approved
Export queued
Permission denied
Module locked
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses backend Decimal/numeric money values only.
[ ] Payment submit is idempotent.
[ ] Receipt actions use protected file helpers.
[ ] Reversal/refund/waiver require reason and audit.
[ ] Cashier close shows expected vs actual from backend.
[ ] Parent view is linked-child scoped.
[ ] M11 accounting handoff state is visible but not browser-posted.
[ ] M12 fee notifications are represented accurately.
[ ] No fake collection metrics remain.
```
