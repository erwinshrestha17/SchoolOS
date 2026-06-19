# M8C Canteen — Web Reference Analysis

**Status:** Supporting M8C design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth. This companion records the focused canteen reference analysis and should be consolidated into the master plan during the next curation pass.

---

## 1. Purpose

M8C is the school canteen operating desk. It must support menu planning, meal plans, POS sales, student wallets, QR serving, allergy/medical verification, inventory, vendors, finance handoff, receipts, reports, and parent visibility without leaking unrelated students, internal stock/vendor data, or protected receipts.

The supplied references define a production-grade canteen flow:

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

Every M8C screen keeps the SchoolOS rule: **one screen = one main job**.

---

## 2. Reference Direction

The references establish these core UI patterns:

- Stable SchoolOS shell with left navigation, topbar, page header, KPI strip, filters, main workspace, and optional right detail panel.
- Canteen-specific operational dashboards, not generic analytics pages.
- Fast counter/serving workspaces with large touch targets and clear student context.
- Repeated safety affordances: allergy alerts, medical alerts, retry-safe actions, protected receipts, locked bills, audit trails, and permission-gated sensitive actions.
- Tables plus right-side detail panels for wallets, inventory, meal plans, and vendor bills.
- Parent portal surfaces that are child-scoped and deliberately simpler than admin/canteen-manager surfaces.
- Mobile scanner parity for QR serving and offline/retry-safe operation.

The design quality is strongest where it ties each UI element to a real canteen operation: serve, sell, top up, close stock, sync fees, print receipt, or warn about allergies.

---

## 3. Persona Scope

| Persona | Main M8C job | Required boundary |
|---|---|---|
| Principal / super admin | Review canteen health, sales, low stock, low wallet, vendor bills, and finance handoff. | Summary/decision data only unless deeper permission exists. |
| Canteen manager | Plan menus, manage meal plans, inventory, stock close, vendors, reports, and approvals. | Tenant-scoped canteen data only. |
| Cashier | Run POS sale, accept wallet/cash/mixed payment, top up wallets, print/view receipts. | Counter workflow only; wallet/adjustment permissions must be explicit. |
| Serving staff | Scan meal QR, verify eligibility/allergy/medical status, confirm serve, handle safe override. | Serve scope only; no unrelated wallet/vendor/inventory administration. |
| Finance user | Review/sync canteen fee handoff, vendor bill status, protected receipts and accounting mapping. | No direct ledger writes from canteen UI. Accounting boundaries remain authoritative. |
| Parent / guardian | View linked child's wallet, spending, menu, meal plan, receipts, and allergy-safe status. | Linked child only; no other student, vendor, stock, or internal audit data. |
| Student | Future limited read/QR usage only where approved. | Self-only and purpose-limited. |

---

## 4. Recommended Route Map

Admin/canteen routes:

```text
/dashboard/canteen
/dashboard/canteen/menu-planner
/dashboard/canteen/meal-plans
/dashboard/canteen/pos
/dashboard/canteen/wallets
/dashboard/canteen/qr-serve
/dashboard/canteen/inventory
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

Mobile/scanner parity route target:

```text
/mobile/canteen/scanner
```

Exact route names must be confirmed against the current Next.js route tree before implementation. If a route/API shape is missing, mark it as `needs OpenAPI confirmation` rather than inventing it.

---

## 5. Workspace Pattern

```text
Header: M8C Canteen
Purpose: Manage meal service, POS, wallets, stock, vendors, and parent visibility.
Primary action: Contextual — Start POS Sale, Scan Student QR, Add Menu Item, Top Up Wallet, Stock Close, or Sync to Fees.
Secondary actions: More Actions.

KPI strip: Backend-provided canteen summaries only.
Tabs: Dashboard | Menu Planner | Meal Plans | POS | Wallets | QR Serve | Inventory | Vendors | Reports | Receipts
Filters: Student | Class | Meal type | Date range | Wallet status | Stock status | Vendor | Sync state
Main: One task-first dashboard, planner, table, POS grid, scanner, stock close, or vendor bill workspace.
Right rail: Selected record, allergy/serve context, wallet detail, meal plan sync preview, item detail, or vendor bill detail.
```

KPI cards, sales totals, wallet totals, low-stock counts, transaction counts, vendor-bill totals, and parent visibility counts must come from backend summaries/list metadata or show honest unavailable states.

---

## 6. Delivery Priority

| Priority | Screens | Outcome |
|---|---|---|
| **P0** | Canteen Dashboard; POS Workspace; Student QR Serve & Allergy Verification; Wallet Top-up & Spending Controls; Menu Planner; Inventory & Stock Close | Daily canteen operations are safe, fast, role-scoped, and real-API backed. |
| **P1** | Meal Plans & Fee Invoice Handoff; Vendor Bills & Purchases; Parent Wallet/Menu/Receipts; Reports and protected receipt views | Finance handoff, parent transparency, procurement, and reporting become operational. |
| **P2** | Mobile scanner parity; offline/retry queue visibility; advanced sales analytics; detailed nutrition/allergen management | Field/serving robustness and deeper analytics after API support is confirmed. |

---

## 7. Canteen Dashboard Overview

**Main job:** show canteen health and route staff to the next operational action.

```text
Header: Canteen Dashboard Overview
KPI strip: Today's Menu Items | Students Served Today | POS Sales Today | Low-Balance Wallets | Low-Stock Items | Pending Vendor Bills | Active Meal Plans | Allergy Alerts
Quick actions: Add Menu | Start POS Sale | Scan Student QR | Top Up Wallet | Stock Close | Export Report
Main: Meal schedule, recent POS transactions, low-balance wallets, low-stock inventory, top-selling items, pending vendor bills
Bottom: Parent visibility summary, protected receipts status, last updated
```

Rules:

- Keep dashboard action-oriented. It is a control desk, not a chart gallery.
- Failed dashboard subsections must not blank the full dashboard.
- Every card opens a filtered workspace or safe detail panel.
- Low-stock, low-wallet, allergy, pending sync, and bill-overdue states must be visually distinct and text-labelled.
- Export/report actions use queued job/status UI if backend uses background export.

---

## 8. Menu & Weekly Meal Planning

**Main job:** plan, review, preview, and publish weekly menus.

```text
Header: Menu & Weekly Meal Planning
Filters: Date range | Campus | Meal type | Plan status
KPI strip: Weekly Meals Planned | Active Menus | Items with Allergens | Meals Pending Publish
Quick actions: Add Menu Item | Duplicate Week | Save Draft | Publish Menu | Print Kitchen Sheet
Main: Weekly planner grid by meal type and date
Right rail: Selected meal details with photo, meal type, serving time, portions, ingredients, allergens, nutrition tags, serving window, eligible classes, and notes
Bottom: Audience preview for parents/students
```

Rules:

- Draft, Published, Not Planned, and Edited After Publish states must be explicit.
- Published menus show `Visible to parents/students` where applicable.
- Unpublished changes must not silently appear in parent view.
- Allergen tags must be visible in both manager detail and serving/POS contexts.
- Kitchen sheet print/export must use protected or controlled artifact handling where the backend returns an artifact.

---

## 9. Meal Plans & Fee Invoice Handoff

**Main job:** manage recurring meal plans and safely hand plan fees to finance.

```text
Header: Meal Plans & Fee Invoice Handoff
KPI strip: Active Meal Plans | Students Subscribed | Invoice Handoff Pending | Linked Fee Amount
Actions: Create Meal Plan | Assign Students | Sync to Fees | Retry Failed Sync | Archive Plan
Tabs: Monthly Plans | Term Plans | Class-specific Plans
Main: Plan table with duration, meals included, students, price, status, invoice sync state
Right rail: Plan overview, students, history, activity log, plan rules, discount rules, finance handoff preview, linked invoice preview, retry-safe notice
```

Rules:

- Sync states: Synced, Pending, Partially Synced, Failed.
- Retry must be idempotent and clearly labelled as retry-safe.
- Finance handoff must not create direct ledger writes from M8C. Use approved accounting/fees boundaries only.
- Failed row details should show safe diagnostics without leaking secrets or raw errors.
- Archive rather than silently delete plans with invoices/history.

---

## 10. POS Sales & Fast Serving Workspace

**Main job:** complete a sale quickly and safely at the counter.

```text
Header: POS Sales & Fast Serving Workspace
Left: Menu/search/categories/item cards with stock/allergen/low-stock indicators
Right: Student lookup, selected student summary, allergy/health alerts, current order, payment method, payment split, total, complete-sale action
Bottom: Transaction success/failure banner with print receipt, view protected PDF, new sale
```

Rules:

- Student selection/scan is required before child-scoped wallet debit.
- Stock validation, wallet validation, daily spending limits, allergy warnings, and payment state are backend-authoritative.
- Payment methods: Wallet, Cash, Mixed where API support exists.
- Mixed payment must show wallet deduction and cash remaining clearly.
- POS submission must be idempotent; duplicate submit must be blocked or safely retried.
- Receipt view/download uses protected file helpers; do not expose raw file URLs.
- Touch/counter UX needs large targets, fast search, recent items, and preserved order state after recoverable failure.

---

## 11. Student Wallets, Top-up & Spending Controls

**Main job:** manage student canteen wallet balance, limits, restrictions, and sensitive adjustments.

```text
Header: Student Wallets, Top-up & Spending Controls
KPI strip: Total Wallet Balance | Low-Balance Accounts | Top-ups Today | Restricted Wallets | Pending Adjustments
Filters: Search student | Low balance | Restricted | Class | Payment source
Actions: Top Up | Adjust Balance | Set Spending Limit | Freeze Wallet | Send Parent Alert | Export
Main: Wallet table with student, class, current balance, daily limit, status, recent activity, actions
Right rail: Selected student wallet overview, quick actions, top-up history, recent debits, guardian contact, alerts and notes
Bottom: Audit trail and adjustments
```

Rules:

- Wallet balance is backend truth; never calculate final balance in browser.
- Top-up requires a payment source/reference where policy requires it.
- Manual adjustment requires reason and approval state where configured.
- Freeze/restrict wallet requires confirmation.
- Spending limit changes are audit-sensitive.
- Parent alert uses M10 provider boundary and must show provider/quiet-hour/send state if exposed.
- Salary/bank-style privacy rules do not apply directly, but wallet financial detail is still permission-sensitive.

---

## 12. Student Meal QR & Allergy Verification

**Main job:** verify a student and safely confirm meal serve.

```text
Header: Student Meal QR & Allergy Verification
Left: QR scanner and fallback student search
Main: Student verified card, wallet balance, meal eligibility, active meal plan, today's meal status, allergy warning, medical alert, acknowledgement checkbox, purchased/covered items
Right: Scan activity, failed scans, serve audit events, protected receipt/data access
Actions: Confirm Serve | Override with Reason | View Meal QR | Print Mini Receipt
```

Confirm Serve stays disabled until:

```text
student is verified
meal is eligible or override is allowed
selected meal is safe or allergy/medical warning is acknowledged
duplicate-serve check passes
backend validation succeeds
```

Serve states:

```text
Not Served
Served
Included in Plan
Wallet Debit Required
Allergy Warning
Medical Alert
Override Required
Override Used
Already Served
Invalid QR
Expired QR
Sync Pending
```

Rules:

- Allergy/medical warnings are safety-critical and must use icon plus text, not color alone.
- Override requires a reason and is audit-visible.
- Duplicate serve must fail closed.
- Protected mini receipt/serve proof uses authenticated helpers.
- QR scan failure must distinguish unknown, expired, unauthorized, already served, and network failure where backend supports it.

---

## 13. Inventory, Stock Close & Low-Stock Alerts

**Main job:** control ingredients, consumption, wastage, stock close, discrepancies, and reorder signals.

```text
Header: Inventory, Stock Close & Low-Stock Alerts
KPI strip: Total Inventory Items | Low-Stock Items | Stock Close Pending | Wastage Today | Purchase Value MTD
Actions: Add Stock | Record Consumption | Record Wastage | Stock Close | Reopen with Reason | Export Inventory
Main: Inventory table with item, category, unit, current stock, minimum level, reorder status, last updated, actions
Right rail: Item details, supplier, last purchase cost, batch, expiry, reorder recommendation, stock movement history
Bottom: Stock close summary with counted/system quantities, discrepancies, value impact, and top discrepancies
```

Rules:

- Stock close states: Open Day, Close Pending, Closed, Reopened, Discrepancy Pending Review.
- Reopen requires reason and audit visibility.
- Consumption/wastage updates must use backend mutations and refetch; no local-only stock truth.
- Low stock and critical stock states must be text-labelled.
- Expiry warnings need explicit date and risk label where data exists.
- Inventory exports use job/status UI when large.

---

## 14. Vendors, Purchases & Vendor Bills

**Main job:** manage suppliers, purchases, vendor bills, edit locks, payments, and linked documents.

```text
Header: Vendors, Purchases & Vendor Bills
KPI strip: Active Vendors | Open Purchase Orders | Unpaid Bills | Overdue Bills | Monthly Purchasing Total
Actions: Add Vendor | Create Purchase | Record Bill | Mark Paid | Lock Bill | View Audit History
Tabs: Vendors | Purchases | Bills | Payment History
Main: Vendor/bill table with invoice, vendor, purchase date, due date, amount, payment status, edit lock, actions
Right rail: Bill details, supplier identity, lock state, purchase items, VAT, transport/other charges, approval notes, linked documents, download/print actions
```

Recommended bill lifecycle:

```text
Draft
Submitted
Approved
Locked
Unpaid
Paid
Overdue
Posted to Finance
Reversed
```

Rules:

- Bills become locked after approval/payment/finance posting where policy requires it.
- Locked bills cannot be edited through ordinary edit forms.
- Correction uses reversal/correction flow, not silent mutation.
- Linked invoice/stock receipt files use protected helpers.
- VAT/PAN fields and supplier contact detail are role-sensitive.
- Finance posting must respect accounting boundaries.

---

## 15. Parent Canteen Wallet, Menu & Meal Plan View

**Main job:** give guardians transparent, child-scoped visibility into wallet, menu, plan, transactions, and receipts.

```text
Parent header: Selected child, wallet balance, top-up action, alert status
Cards: Wallet Balance | Daily Spending Limit | Today's Spending | Allergy-safe
Sections: Today's Menu | Active Meal Plan | Weekly Menu | Recent Transactions | Receipts
Actions: Top Up Wallet | Manage Limit | View Allergies | View Menu | Download Receipt | Contact Support
```

Rules:

- Parent routes are linked-child only.
- No internal canteen inventory/vendor/bill/schoolwide sales data.
- Receipt files are protected and child-scoped.
- Allergy-safe claim must derive from backend child allergy/meal matching or show unavailable.
- Daily limit change may require school approval depending on policy.

---

## 16. Mobile Scanner Parity

The mobile scanner reference is valuable for real canteen serving. It should guide responsive/mobile-specific M8C work after API/offline support is confirmed.

```text
Header: Online/offline/sync state
Scanner: QR scan area with scan/search toggle
Student card: photo, ID, class, roll, wallet balance, meal plan
Warnings: allergies/medical alerts
Eligibility: today's meal window and selected item coverage
Serve status: acknowledgement and confirm serve
Actions: Confirm Serve | Scan Next | View History | Retry Sync
Footer: retry-safe action notice
```

Mobile states:

```text
Online
Offline
Sync Pending
Sync Failed
Duplicate Serve
Allergy Block
QR Expired
Unknown QR
```

Rules:

- Offline serving must not be implemented unless backend/offline queue contract is confirmed.
- Retry-safe messaging is allowed only when the backend operation is actually idempotent.
- Sync pending count and failed sync diagnostics must be safe and not expose unrelated student data.

---

## 17. Shared Components

```text
CanteenKpiCard
CanteenQuickActionBar
CanteenStatusBadge
MealPlannerGrid
MealCard
MealDetailPanel
AudiencePreviewCard
MealPlanTable
MealPlanDetailDrawer
InvoiceSyncStatusBadge
PosMenuGrid
PosItemCard
StudentLookupPanel
CurrentOrderPanel
PaymentMethodSelector
TransactionSuccessBanner
WalletSummaryCard
WalletTable
StudentWalletDrawer
WalletAdjustmentDialog
QrScannerPanel
ServeVerificationCard
AllergyAlertBox
MedicalAlertBox
ServeAuditTimeline
InventoryTable
InventoryItemDrawer
StockMovementTimeline
StockCloseSummary
VendorBillTable
VendorBillDrawer
ProtectedReceiptCard
RetrySafeNotice
AuditTrailTable
ParentWalletOverview
ParentMenuPreview
MobileServeCard
```

Reuse shared dashboard primitives for shell, header, KPI cards, tabs, filter bar, data table, detail drawer, protected file buttons, confirmation dialogs, reason dialogs, empty/loading/error states, and permission/module-locked states.

---

## 18. Required States

Every M8C route must handle:

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

## 19. Security, File, Audit & Contract Boundaries

- Backend tenant scope, RBAC, module entitlement, canteen role permissions, guardian-child linkage, and student self-scope remain authoritative.
- POS payment, wallet debit, top-up, adjustment, stock mutation, meal serve, vendor bill, and finance handoff actions must be backend mutations with post-action refetch/invalidation.
- Wallet debits are atomic backend truth.
- Negative balances require explicit school policy and visible state.
- Parent reads are child-scoped.
- Receipts, invoice files, stock close reports, protected PDFs, and exports use File Registry/authenticated helpers.
- Do not expose raw object keys, provider URLs, permanent signed URLs, secrets, raw errors, or stack traces.
- Retry-safe labels are used only where backend idempotency exists.
- High-impact actions require confirmation and reason where policy requires it: wallet adjustment, freeze wallet, override serve, stock close/reopen, bill lock/unlock, mark paid, sync/retry finance handoff.
- Mark unknown or missing contracts as `needs OpenAPI confirmation`, `needs backend verification`, `needs idempotency confirmation`, or `needs offline sync confirmation`.

---

## 20. M8C Web Persona Smoke Expectations

```text
Canteen manager can open only tenant-scoped menu, inventory, vendor, and meal plan data.
Cashier can complete a POS sale through real API and cannot silently bypass allergy, wallet, stock, or spending controls.
Serving staff cannot confirm serve until student eligibility, duplicate serve, and allergy/medical acknowledgement rules pass.
Parent cannot open another child's wallet, receipt, transactions, or menu-plan state through direct route.
Protected receipt download/preview fails safely after permission or guardian-child scope changes.
Wallet adjustment requires permission, reason where configured, and audit-visible state.
Stock close and reopen preserve discrepancy/audit state and do not allow browser-only inventory truth.
Vendor bill lock prevents ordinary editing after locked/approved/posted state.
Meal plan fee sync shows synced/pending/partial/failed and retries without duplicate invoice rows.
Module-locked and suspended-tenant states fail closed without fake fallback data.
```

---

## 21. Open Items for Implementation

- Confirm current M8C OpenAPI/shared-contract coverage for dashboard summaries, POS, QR serve, meal planner, meal plans, wallets, inventory, vendor bills, reports, receipts, and parent views.
- Confirm whether finance handoff is via fee invoices, accounting source mapping, or both.
- Confirm whether mobile/offline scanner queue exists before showing offline serve UX as functional.
- Confirm protected receipt artifact types and download/preview helpers.
- Confirm daily spending policy, negative balance policy, top-up payment source handling, and adjustment approval rules.
- Confirm allergen/medical warning payload shape and override policy.
- Confirm stock close/reopen and vendor bill lock lifecycle contracts.
