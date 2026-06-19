# M8C Canteen — Frontend Implementation Checklist

**Status:** Focused implementation companion for the M8C canteen web reference analysis.  
**Updated:** 2026-06-19  
**Master implementation source:** `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` remains the active implementation plan. This checklist translates the M8C reference analysis into implementation order without claiming that the listed work is complete.

---

## 1. Current Module Position

M8C already has backend history for menu management, meal plans, student enrollments, meal serving, allergy/medical warning lookup, student wallets, wallet transactions, POS sale lifecycle, spending controls, low-balance alerts, duplicate-serving prevention, immutable wallet transactions, wallet/POS consistency, report exports, and canteen hardening. Frontend work must verify the current OpenAPI/shared contracts before exposing each workspace.

This checklist covers the remaining **web workspace completion and verification work**. It does not introduce a canteen microservice, AI runtime, browser-owned money truth, or direct accounting writes from the canteen UI.

---

## 2. Non-Negotiable Implementation Rules

```text
Real backend APIs only.
No fake canteen metrics, sales charts, wallet totals, inventory totals, or vendor bill totals.
Every tenant-owned read/write/export/file action is tenant-scoped.
Backend authorization remains the source of truth.
Wallet balances and debits are backend-owned Decimal/numeric truth.
POS sale submission and meal serving must use backend idempotency/duplicate prevention where available.
Parent reads are linked-child scoped only.
All protected receipts, invoices, PDFs, exports, and stock reports use File Registry-backed authenticated helpers.
Growing lists use server-side pagination and filtering.
High-risk actions use confirmation, pending/success/error state, and audit reason where required.
No direct ledger writes from M8C frontend; finance/accounting boundaries remain authoritative.
No offline scanner UX unless an offline queue/sync contract is confirmed.
```

Unknown work must be labelled as one of:

```text
needs OpenAPI confirmation
needs backend verification
needs idempotency confirmation
needs offline sync confirmation
```

---

## 3. P0 — Core Daily Canteen Workflow

### 3.1 Canteen Dashboard

- [ ] Build `/dashboard/canteen` from real canteen summary APIs or explicit unavailable states.
- [ ] Add KPI cards only for backend-provided data: menu items, students served, sales today, low-balance wallets, low-stock items, pending vendor bills, active meal plans, allergy alerts.
- [ ] Add quick actions with permission/entitlement gating: Add Menu, Start POS Sale, Scan Student QR, Top Up Wallet, Stock Close, Export Report.
- [ ] Add dashboard panels for today's meal schedule, recent POS transactions, low-balance wallets, low-stock inventory, top-selling items, pending vendor bills, and parent visibility only where APIs exist.
- [ ] Add section-level loading/error states so one failed panel does not blank the whole dashboard.
- [ ] Link each KPI/panel to a filtered workspace or safe detail route.
- [ ] Render protected receipt/export links with authenticated helpers.

### 3.2 POS Sales Workspace

- [ ] Inspect current POS sale OpenAPI/shared contracts before building the POS order shape.
- [ ] Build fast menu item search, category tabs, and stock/allergen indicators from real menu APIs.
- [ ] Add scan/search student lookup and selected student summary.
- [ ] Render wallet balance, low-balance state, daily spending limit, and restricted/frozen wallet state from backend data.
- [ ] Add allergy/medical warnings before sale completion.
- [ ] Implement current order panel with quantity changes, item deletion, subtotal, discount, rounding/adjustment only where backend supports it.
- [ ] Implement payment methods only where supported: Wallet, Cash, Mixed.
- [ ] For mixed payment, show wallet deduction and cash remaining from backend validation, not browser-only truth.
- [ ] Use idempotent submit state for `Charge & Complete Sale`; block double-submit in the UI but rely on backend duplicate prevention.
- [ ] Show transaction success/failure banner with receipt number, print action, protected PDF view, and new sale action.
- [ ] Preserve order state after recoverable network/validation failure.

### 3.3 QR Serve & Allergy Verification

- [ ] Build `/dashboard/canteen/qr-serve` or existing equivalent route only after scan/lookup contracts are confirmed.
- [ ] Add QR scanner shell and fallback search; do not implement camera/scanner behavior beyond available frontend primitives/contracts.
- [ ] Show verified student identity, class, roll, student ID, wallet balance, meal eligibility, active meal plan, and today's meal status.
- [ ] Render allergy and medical alerts with text labels, severity, and required acknowledgement.
- [ ] Keep Confirm Serve disabled until student verification, eligibility, duplicate-serve check, and required acknowledgement pass.
- [ ] Implement override with reason only if backend policy/route exists.
- [ ] Display serve audit events and failed scans with safe diagnostics.
- [ ] Show protected receipt/data access cards using authenticated helpers.
- [ ] Add states for invalid QR, expired QR, unknown QR, already served, not eligible, sync pending, and failed submit where backend supports them.

### 3.4 Student Wallets, Top-up & Spending Controls

- [ ] Build wallet list with server-side pagination and filters: search, low balance, restricted, class, payment source.
- [ ] Render wallet KPIs from backend summaries: total wallet balance, low-balance accounts, top-ups today, restricted wallets, pending adjustments.
- [ ] Implement top-up action with payment source/reference fields required by policy.
- [ ] Implement manual adjustment only with explicit permission, reason, and approval state where required.
- [ ] Implement set spending limit, freeze/restrict wallet, and send parent alert only through confirmed backend routes.
- [ ] Add selected student wallet drawer: current balance, threshold, daily limit, quick actions, top-up history, recent debits, guardian contact, alerts/notes.
- [ ] Add wallet audit trail and adjustment states.
- [ ] Ensure parent alert action respects M10 provider/quiet-hour status where exposed.
- [ ] Never compute final wallet balance as browser truth after a mutation; refetch/invalidate after submit.

### 3.5 Menu & Weekly Meal Planning

- [ ] Build weekly planner with date range, campus, meal type, and plan status filters.
- [ ] Render meal grid by day and meal type from real APIs.
- [ ] Show Draft, Published, Not Planned, Edited After Publish, and Failed Publish states where supported.
- [ ] Add detail panel with image, meal type, serving time, portions, ingredients, allergens, nutrition tags, serving window, eligible classes, and notes.
- [ ] Add audience preview for parent/student view only from confirmed API shape.
- [ ] Implement Add Menu Item, Duplicate Week, Save Draft, Publish Menu, and Print Kitchen Sheet only where routes/contracts exist.
- [ ] Publish confirmation must show visibility impact and any allergy/nutrition warnings.
- [ ] Kitchen sheet export/print uses protected or controlled artifact handling when backend returns a file.

### 3.6 Inventory & Stock Close

- [ ] Build inventory list with server-side search/category/status filters and pagination.
- [ ] Render KPIs from backend summaries: total inventory items, low-stock items, stock close pending, wastage today, purchase value MTD.
- [ ] Implement Add Stock, Record Consumption, Record Wastage, Stock Close, Reopen with Reason, and Export Inventory only through confirmed routes.
- [ ] Add item detail drawer with current stock, minimum level, supplier, purchase cost, batch, expiry, reorder recommendation, and movement history.
- [ ] Add Stock Close Summary with counted quantity, system quantity, discrepancies, discrepancy value, and top discrepancies.
- [ ] Enforce closed-day read-only behavior in UI while relying on backend enforcement.
- [ ] Reopen requires reason and audit-visible state.
- [ ] Use backend truth after stock mutations; no browser-only stock totals.

---

## 4. P1 — Finance, Procurement, Parent Visibility & Reports

### 4.1 Meal Plans & Fee Invoice Handoff

- [ ] Build meal plan list with monthly, term, and class-specific tabs if supported by the contract.
- [ ] Render active meal plans, subscribed students, invoice handoff pending, and linked fee amount from backend summaries.
- [ ] Implement create meal plan, assign students, sync to fees, retry failed sync, and archive plan through confirmed routes.
- [ ] Display plan details: rules, duration, included meals, applicable classes/sections, discount rules, finance handoff, linked invoice preview.
- [ ] Display sync states: Synced, Pending, Partially Synced, Failed.
- [ ] Retry failed sync only through idempotent backend route; show retry-safe copy only after confirmation.
- [ ] Show failed row diagnostics safely without raw backend/provider errors.
- [ ] Do not implement direct ledger posting from canteen frontend.

### 4.2 Vendors, Purchases & Vendor Bills

- [ ] Build vendor/purchase/bill/payment tabs from real APIs.
- [ ] Render vendor/bill KPIs: active vendors, open purchase orders, unpaid bills, overdue bills, monthly purchasing total.
- [ ] Implement Add Vendor, Create Purchase, Record Bill, Mark Paid, Lock Bill, View Audit History only through confirmed routes.
- [ ] Build bill table with invoice number, vendor, purchase date, due date, amount, payment status, edit lock, and actions.
- [ ] Add bill detail drawer with supplier profile, purchase items, VAT, transport/other charges, approval notes, linked documents, lock state, download/print actions.
- [ ] Enforce locked bill behavior in UI; ordinary edits unavailable when locked/approved/paid/posted.
- [ ] Use reversal/correction flow for posted/paid corrections when supported.
- [ ] Use protected helpers for linked invoice and stock receipt documents.

### 4.3 Parent Canteen View

- [ ] Build linked-child-only parent canteen overview route.
- [ ] Render child selector only for children linked to the guardian session.
- [ ] Show wallet balance, daily spending limit, today's spending, allergy-safe status, today's menu, active meal plan, weekly menu, recent transactions, and receipts.
- [ ] Implement Top Up Wallet, Manage Limit, View Allergies, View Menu, Download Receipt, and Contact Support only where APIs/routes exist.
- [ ] Ensure direct route access to another child fails closed.
- [ ] Receipt downloads use protected child-scoped helpers.
- [ ] Do not show vendor, inventory, schoolwide sales, internal audit, or other student data in parent routes.

### 4.4 Reports, Receipts & Exports

- [ ] Implement daily meal count, item-wise sales, wallet, inventory, vendor bill, and parent receipt reports only from confirmed backend report APIs.
- [ ] Use queued job/status UI for large report exports when backend requires it.
- [ ] Use protected file helpers for PDFs, CSVs, receipts, invoices, stock close reports, and export snapshots.
- [ ] Add empty/unavailable states for reports whose summary/export endpoint is not available.
- [ ] Never use browser-side aggregation as official sales, wallet, stock, vendor, or finance truth.

---

## 5. P2 — Mobile Scanner Parity & Advanced UX

- [ ] Confirm mobile/scanner/offline route strategy before implementing `/mobile/canteen/scanner` or responsive scanner mode.
- [ ] Confirm offline queue and sync contract before showing functional offline serve behavior.
- [ ] Add online/offline/sync pending/sync failed states only after backend support exists.
- [ ] Add scan-next, view-history, retry-sync, and pending action count after contract confirmation.
- [ ] Add advanced POS speed features after core flow is real-API backed: recent items, repeat last order, keyboard shortcuts, larger touchscreen mode.
- [ ] Add nutrition/allergen management depth after data model/contracts are confirmed.
- [ ] Add sales analytics only from backend aggregates/time series.

---

## 6. Shared UI Building Blocks

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

Use existing shared primitives where possible:

```text
DashboardShell
ModuleHeader
KpiCard
ModuleTabs
FilterBar
DataTable
StatusBadge
ActionMenu
DetailDrawer
ConfirmDialog
ReasonRequiredDialog
AuditTimeline
EmptyState
ErrorState
LoadingState
PermissionState
ModuleLockedState
ProtectedFileButton
ProtectedFileLink
```

Do not create duplicate primitives if shared equivalents already exist.

---

## 7. Browser E2E & Smoke Matrix

### Admin / Manager

- [ ] Canteen manager can open only tenant-scoped menu, inventory, vendor, wallet, and meal-plan data.
- [ ] Canteen dashboard shows real summaries or honest unavailable states; no fake zero-value production metrics.
- [ ] Menu publish shows draft/published/edited-after-publish state and does not leak unpublished changes to parent view.
- [ ] Inventory stock close locks closed stock day and reopen requires reason.
- [ ] Vendor bill lock prevents ordinary editing after locked/approved/paid/posted state.

### POS / Cashier

- [ ] Cashier can search/select student, add items, choose supported payment method, complete sale, and view protected receipt.
- [ ] Duplicate POS submit is blocked or safely handled by backend idempotency.
- [ ] Wallet, stock, allergy, and spending-control failures render school-friendly errors and preserve order context.
- [ ] Mixed payment shows backend-validated wallet deduction and remaining cash amount.

### QR Serve / Serving Staff

- [ ] Serving staff cannot confirm serve until student verification, eligibility, duplicate-serve check, and required acknowledgement pass.
- [ ] Allergy/medical warnings render with text labels and require acknowledgement/override reason where policy requires it.
- [ ] Already served, invalid QR, expired QR, unknown QR, and not eligible states fail closed.
- [ ] Override is audit-visible and requires permission/reason where configured.

### Wallets / Finance-adjacent

- [ ] Top-up requires payment source/reference where policy requires it.
- [ ] Manual wallet adjustment requires permission, reason, and approval state where configured.
- [ ] Wallet balance refetches after mutation; browser never owns final wallet truth.
- [ ] Parent alert action respects provider/quiet-hour state where exposed.

### Parent

- [ ] Parent can view only linked child canteen wallet, menu, meal plan, transactions, and receipts.
- [ ] Parent direct route to another child fails closed.
- [ ] Parent receipt download uses protected child-scoped helper.
- [ ] Parent route does not expose vendor, inventory, internal audit, schoolwide sales, or other student data.

### Finance Handoff / Reports

- [ ] Meal plan fee sync shows Synced, Pending, Partially Synced, and Failed states.
- [ ] Retry failed sync is idempotent and does not duplicate invoices.
- [ ] Reports/exports use protected helpers and queued job UI where required.
- [ ] No canteen UI directly writes accounting ledger entries.

---

## 8. Verification Commands

Run the relevant checks after implementation. Do not claim that they passed unless actually run.

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

M8C-focused browser verification must include dashboard, POS, QR serve, wallet top-up/adjustment, menu planner, inventory stock close/reopen, vendor bill lock, meal plan finance sync, parent canteen view, protected receipt access, permission-denied, and module-locked paths.

---

## 9. Definition of Done

```text
[ ] Uses real API/database persistence.
[ ] Tenant isolation and backend authorization confirmed.
[ ] Canteen manager/cashier/serving-staff/parent scopes fail closed.
[ ] Lists are server-paginated and server-filtered.
[ ] Wallet balances, POS totals, inventory quantities, vendor bill totals, and sync states are backend-owned truth.
[ ] Loading, empty, error, success, permission, module-locked, queued, and partial-failure states exist.
[ ] Protected receipts/invoices/exports use shared authenticated helpers.
[ ] POS, serving, wallet adjustment, stock close, vendor bill lock, and finance sync actions show confirmation/audit-aware state where required.
[ ] Retry-safe labels appear only for confirmed idempotent backend operations.
[ ] No fake metrics, browser-only money/stock truth, direct ledger writes, or unconfirmed offline scanner claims.
[ ] Focused regression or browser E2E coverage updated.
[ ] Relevant verification commands were actually run and recorded.
```
