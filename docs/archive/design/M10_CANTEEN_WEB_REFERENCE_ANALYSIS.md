> Archived 2026-06-21. Unique implementation guidance was merged into `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md`. Retained as historical M10 reference analysis only.

# M10 Canteen — Web Reference Analysis

**Status:** Supporting M10 design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth.

This file replaces the obsolete `M8C_CANTEEN_WEB_REFERENCE_ANALYSIS.md` numbering. Canteen is now **M10**, not M8C.

---

## 1. Purpose

M10 is the school canteen operating desk. It must support menu planning, meal plans, POS sales, student wallets, QR serving, allergy/medical verification, canteen stock, vendors, finance handoff, receipts, reports, and parent visibility without leaking unrelated students, internal stock/vendor data, or protected receipts.

The core flow is:

```text
Menu planning
-> meal plan setup
-> student wallet/top-up controls
-> POS sale or QR meal serve
-> allergy/medical verification
-> protected receipt generation
-> stock consumption / stock close
-> vendor bill lifecycle
-> finance handoff
-> parent visibility
```

Every M10 screen keeps the SchoolOS rule: **one screen = one main job**.

---

## 2. Persona Scope

| Persona | Main M10 job | Required boundary |
|---|---|---|
| Principal / super admin | Review canteen health, sales, low stock, low wallet, vendor bills, and finance handoff. | Summary/decision data only unless deeper permission exists. |
| Canteen manager | Plan menus, manage meal plans, stock close, vendors, reports, and approvals. | Tenant-scoped canteen data only. |
| Cashier | Run POS sale, accept wallet/cash/mixed payment, top up wallets, print/view receipts. | Counter workflow only; wallet/adjustment permissions must be explicit. |
| Serving staff | Scan meal QR, verify eligibility/allergy/medical status, confirm serve, handle safe override. | Serve scope only; no unrelated wallet/vendor/stock administration. |
| Finance user | Review/sync canteen fee handoff, vendor bill status, protected receipts, and accounting mapping. | No direct ledger writes from canteen UI. |
| Parent / guardian | View linked child's wallet, spending, menu, meal plan, receipts, and allergy-safe status. | Linked child only; no other student, vendor, stock, or internal audit data. |

---

## 3. Recommended Route Map

Admin/canteen routes:

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
```

Parent routes:

```text
/parent/canteen
/parent/canteen/wallet
/parent/canteen/menu
/parent/canteen/transactions
/parent/canteen/receipts
```

Mobile/scanner parity target:

```text
/mobile/canteen/scanner
```

Exact route names must be confirmed against the current Next.js route tree before implementation. If a route/API shape is missing, mark it as `needs OpenAPI confirmation`.

---

## 4. Delivery Priority

| Priority | Screens | Outcome |
|---|---|---|
| P0 | Canteen Dashboard; POS Workspace; Student QR Serve & Allergy Verification; Wallet Top-up & Spending Controls; Menu Planner; Stock Close | Daily canteen operations are safe, fast, role-scoped, and real-API backed. |
| P1 | Meal Plans & Fee Invoice Handoff; Vendor Bills & Purchases; Parent Wallet/Menu/Receipts; Reports and protected receipt views | Finance handoff, parent transparency, procurement, and reporting become operational. |
| P2 | Mobile scanner parity; offline/retry queue visibility; advanced sales analytics; detailed nutrition/allergen management | Field/serving robustness and deeper analytics after API support is confirmed. |

---

## 5. Required Workspaces

### 5.1 Canteen Dashboard

- KPI strip: today's menu items, students served today, POS sales today, low-balance wallets, low-stock items, pending vendor bills, active meal plans, allergy alerts.
- Quick actions: add menu, start POS sale, scan student QR, top up wallet, stock close, export report.
- Failed dashboard subsections must not blank the full dashboard.
- Every card opens a filtered workspace or safe detail panel.

### 5.2 POS Sales and Fast Serving

- Student selection/scan is required before child-scoped wallet debit.
- Stock validation, wallet validation, daily spending limits, allergy warnings, and payment state are backend-authoritative.
- Payment methods: wallet, cash, mixed where API support exists.
- POS submission must be idempotent; duplicate submit must be blocked or safely retried.
- Receipt view/download uses protected file helpers.

### 5.3 Student Wallets and Spending Controls

- Wallet balance is backend truth; never calculate final balance in browser.
- Top-up requires payment source/reference where policy requires it.
- Manual adjustment requires reason and approval state where configured.
- Freeze/restrict wallet requires confirmation.
- Parent alert uses M12 notification/provider boundary and must show provider/quiet-hour/send state if exposed.

### 5.4 Student Meal QR and Allergy Verification

Confirm Serve stays disabled until:

```text
student is verified
meal is eligible or override is allowed
selected meal is safe or allergy/medical warning is acknowledged
duplicate-serve check passes
backend validation succeeds
```

Allergy/medical warnings are safety-critical and must use text plus icon, not color alone.

### 5.5 Canteen Stock Close and Vendor Bills

- Stock close states: open day, close pending, closed, reopened, discrepancy pending review.
- Reopen requires reason and audit visibility.
- Vendor bills become locked after approval/payment/finance posting where policy requires it.
- Locked bills cannot be edited through ordinary edit forms.
- Finance posting must respect M11 Accounting boundaries.

### 5.6 Parent Canteen View

Parent routes are linked-child only.

Allowed parent visibility:

```text
Wallet balance
Daily spending limit
Today's spending
Allergy-safe status where backend confirms it
Today's menu
Active meal plan
Weekly menu
Recent transactions
Receipts
```

Do not expose vendor, stock, internal audit, schoolwide sales, or other student data.

---

## 6. Required States

Every M10 route must handle:

```text
Loading
Empty
Error
Permission denied
Module locked
Validation failure
Queued / processing
Partial failure
Protected receipt unavailable
No student selected
Student not eligible
Wallet low / wallet restricted / wallet frozen
Payment pending / payment failed / duplicate blocked
Allergy warning / medical alert / override required / override used
Stock low / stock critical / stock closed / stock reopened
Sync pending / synced / partially synced / failed
Bill draft / submitted / approved / locked / paid / overdue / posted
Offline / sync pending / sync failed only after contract confirmation
```

---

## 7. Security, File, Audit and Contract Boundaries

- Backend tenant scope, RBAC, module entitlement, canteen role permissions, guardian-child linkage, and student self-scope remain authoritative.
- POS payment, wallet debit, top-up, adjustment, stock mutation, meal serve, vendor bill, and finance handoff actions must be backend mutations with post-action refetch/invalidation.
- Wallet debits are atomic backend truth.
- Parent reads are child-scoped.
- Receipts, invoice files, stock close reports, protected PDFs, and exports use File Registry/authenticated helpers.
- Retry-safe labels are used only where backend idempotency exists.
- High-impact actions require confirmation and reason where policy requires it: wallet adjustment, freeze wallet, override serve, stock close/reopen, bill lock/unlock, mark paid, sync/retry finance handoff.
- Mark unknown or missing contracts as `needs OpenAPI confirmation`, `needs backend verification`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
