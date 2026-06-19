# M10 Canteen — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M10 Canteen  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`  
**Supporting reference:** `docs/design/M10_CANTEEN_WEB_REFERENCE_ANALYSIS.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M10. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M10 is the school canteen operating desk. It must support menu planning, meal plans, POS sales, student wallets, QR serving, allergy/medical verification, canteen stock, vendor bills, receipts, reports, finance handoff, and parent visibility.

Core flow:

```text
Menu planning
-> meal plan setup
-> wallet/top-up controls
-> POS sale or QR serve
-> allergy/medical verification
-> protected receipt
-> stock close
-> vendor bill lifecycle
-> finance handoff
-> parent visibility
```

---

## 2. Theme and Layout Alignment

Use a fast counter/serving workbench:

```text
ModuleHeader
Canteen KPI strip
Quick actions
Tabs
POS / QR / menu / wallet workspace
Right student/order/detail rail
Safety warning panel
Protected receipt actions
Audit trail
```

Design rules:

- POS and QR serve screens need large touch-friendly controls.
- Allergy/medical warnings must be text-labelled and visible before submit.
- Wallet, POS, stock, and vendor bill values are backend-owned.
- Parent routes are child-scoped and do not expose vendor/stock/schoolwide sales data.
- M11 Accounting boundaries own official postings; M10 UI never writes ledgers directly.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Canteen manager | Manage menu, stock, vendors, reports. | Tenant-scoped canteen permission. |
| Cashier | Run POS and top-ups. | Counter workflow and wallet permissions. |
| Serving staff | Scan QR, verify student, serve meals. | Serve scope only. |
| Finance user | Review handoff and vendor bills. | Finance/canteen permission. |
| Principal | View canteen health. | Summary/read-only unless permitted. |
| Parent | View linked child wallet/menu/receipts. | Linked-child only. |

---

## 4. Recommended Route Map

```text
/dashboard/canteen
/dashboard/canteen/menu-planner
/dashboard/canteen/meal-plans
/dashboard/canteen/pos
/dashboard/canteen/wallets
/dashboard/canteen/qr-serve
/dashboard/canteen/stock
/dashboard/canteen/vendors
/dashboard/canteen/reports
/dashboard/canteen/receipts
/dashboard/canteen/settings
/parent/canteen
/parent/canteen/wallet
/parent/canteen/menu
/parent/canteen/transactions
/parent/canteen/receipts
/mobile/canteen/scanner
```

---

## 5. Required Screens

### 5.1 Canteen Dashboard

- KPI cards: menu items, students served, POS sales today, low-balance wallets, low-stock items, pending vendor bills, active meal plans, allergy alerts.
- Quick actions: Add Menu, Start POS Sale, Scan Student QR, Top Up Wallet, Stock Close, Export Report.
- Attention queue: allergy alerts, low stock, low balance, failed receipt, pending vendor bill, sync failure.

### 5.2 POS Sales Workspace

- Fast item search and category tabs.
- Student search/scan and selected student summary.
- Wallet balance, daily spending limit, low-balance/restricted/frozen state.
- Allergy/medical alert before sale completion.
- Order panel with subtotal, payment method, backend validation, receipt result.
- Idempotent submit and duplicate prevention state.

### 5.3 QR Serve and Allergy Verification

- QR scanner shell and fallback search.
- Verified student card: photo/initial, ID, class, roll, wallet, meal plan, eligibility.
- Allergy/medical alert with acknowledgement where required.
- Confirm Serve disabled until backend verification passes.
- Invalid/expired/unknown/already-served states fail closed.

### 5.4 Wallets and Spending Controls

- Wallet list with low-balance/restricted/class/payment-source filters.
- Top-up, adjustment, spending limit, freeze/restrict actions where permitted.
- Adjustment requires reason/approval state where backend requires it.
- Balance refetches after mutation.

### 5.5 Menu Planner and Meal Plans

- Weekly planner grid by day and meal type.
- Draft, Published, Not Planned, Edited After Publish states.
- Audience preview for parent/student view only if backend supports it.
- Meal plan fee sync states: Synced, Pending, Partially Synced, Failed.

### 5.6 Stock Close and Vendor Bills

- Stock list with low/critical labels.
- Stock close summary: counted quantity, system quantity, discrepancies, value impact.
- Reopen requires reason and audit.
- Vendor bill lifecycle: Draft, Submitted, Approved, Locked, Paid, Overdue, Posted, Reversed.
- Protected invoice/stock receipt files.

### 5.7 Parent Canteen View

- Child selector, wallet balance, daily limit, today's spending, today's menu, active meal plan, transactions, receipts.
- Receipt download uses protected child-scoped helper.
- No vendor, stock, audit, schoolwide sales, or other-student data.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Menu and meal planner APIs
Meal plan APIs and fee sync state
Student wallet APIs
Wallet top-up/adjustment/freeze/spending-limit APIs
POS sale lifecycle APIs with idempotency
QR serve and duplicate serve APIs
Allergy/medical warning lookup APIs
Stock movement and stock close APIs
Vendor and bill APIs
Receipt/protected file APIs
Parent child-scoped canteen APIs
M11 accounting/fees handoff state
M12 canteen notification events
Audit logs for wallet, serve override, stock close, vendor bill, sync retry
```

Backend ownership rules:

- Wallet balances and POS totals are backend-owned.
- Wallet debit is atomic.
- Allergy/eligibility validation is backend-owned.
- Negative balance requires explicit tenant policy.
- Parent reads are linked-child scoped.
- Stock/vendor values are backend-owned.

---

## 7. Required States

```text
Loading
No student selected
Student not eligible
Wallet low
Wallet restricted
Wallet frozen
Payment pending
Payment failed
Duplicate blocked
Allergy warning
Medical alert
Override required
Already served
Invalid QR
Stock low
Stock critical
Stock closed
Sync pending
Partially synced
Receipt ready
Receipt unavailable
Vendor bill locked
Permission denied
Module locked
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] POS and wallet values come from backend.
[ ] POS submit and QR serve are idempotency-aware.
[ ] Allergy/medical warnings block or require acknowledgement.
[ ] Parent canteen route is child-scoped.
[ ] Receipts use protected file helpers.
[ ] Stock/vendor bill values come from backend.
[ ] M11 accounting handoff is visible but backend-owned.
[ ] M12 canteen notifications are represented accurately.
[ ] No fake canteen metrics remain.
```
