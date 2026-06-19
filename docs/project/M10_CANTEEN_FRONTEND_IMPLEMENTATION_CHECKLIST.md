# M10 Canteen — Frontend Implementation Checklist

**Status:** Focused implementation companion for the M10 canteen web reference analysis.  
**Updated:** 2026-06-19  
**Master implementation source:** `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` remains the active implementation plan.

This file replaces the obsolete `M8C_CANTEEN_FRONTEND_IMPLEMENTATION_CHECKLIST.md` numbering. Canteen is now **M10**, not M8C.

---

## 1. Current Module Position

M10 has backend history for menu management, meal plans, student enrollments, meal serving, allergy/medical warning lookup, student wallets, wallet transactions, POS sale lifecycle, spending controls, low-balance alerts, duplicate-serving prevention, immutable wallet transactions, wallet/POS consistency, report exports, and canteen hardening. Frontend work must verify the current OpenAPI/shared contracts before exposing each workspace.

This checklist covers remaining **web workspace completion and verification work**. It does not introduce a canteen microservice, AI runtime, browser-owned money truth, or direct accounting writes from the canteen UI.

---

## 2. Non-Negotiable Implementation Rules

```text
Real backend APIs only.
No fake canteen metrics, sales charts, wallet totals, stock totals, or vendor bill totals.
Every tenant-owned read/write/export/file action is tenant-scoped.
Backend authorization remains the source of truth.
Wallet balances and debits are backend-owned Decimal/numeric truth.
POS sale submission and meal serving must use backend idempotency/duplicate prevention where available.
Parent reads are linked-child scoped only.
All protected receipts, invoices, PDFs, exports, and stock reports use File Registry-backed authenticated helpers.
Growing lists use server-side pagination and filtering.
High-risk actions use confirmation, pending/success/error state, and audit reason where required.
No direct ledger writes from M10 frontend; M11 Accounting boundaries remain authoritative.
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
- [ ] Add section-level loading/error states so one failed panel does not blank the whole dashboard.
- [ ] Link each KPI/panel to a filtered workspace or safe detail route.
- [ ] Render protected receipt/export links with authenticated helpers.

### 3.2 POS Sales Workspace

- [ ] Inspect current POS sale OpenAPI/shared contracts before building the POS order shape.
- [ ] Build fast menu item search, category tabs, and stock/allergen indicators from real menu APIs.
- [ ] Add scan/search student lookup and selected student summary.
- [ ] Render wallet balance, low-balance state, daily spending limit, and restricted/frozen wallet state from backend data.
- [ ] Add allergy/medical warnings before sale completion.
- [ ] Implement payment methods only where supported: Wallet, Cash, Mixed.
- [ ] Use idempotent submit state for `Charge & Complete Sale`; block double-submit in the UI but rely on backend duplicate prevention.
- [ ] Show transaction success/failure banner with receipt number, print action, protected PDF view, and new sale action.
- [ ] Preserve order state after recoverable network/validation failure.

### 3.3 QR Serve and Allergy Verification

- [ ] Build `/dashboard/canteen/qr-serve` or existing equivalent route only after scan/lookup contracts are confirmed.
- [ ] Add QR scanner shell and fallback search; do not implement camera/scanner behavior beyond available frontend primitives/contracts.
- [ ] Show verified student identity, class, roll, student ID, wallet balance, meal eligibility, active meal plan, and today's meal status.
- [ ] Render allergy and medical alerts with text labels, severity, and required acknowledgement.
- [ ] Keep Confirm Serve disabled until student verification, eligibility, duplicate-serve check, and required acknowledgement pass.
- [ ] Implement override with reason only if backend policy/route exists.
- [ ] Add states for invalid QR, expired QR, unknown QR, already served, not eligible, sync pending, and failed submit where backend supports them.

### 3.4 Student Wallets, Top-up and Spending Controls

- [ ] Build wallet list with server-side pagination and filters: search, low balance, restricted, class, payment source.
- [ ] Render wallet KPIs from backend summaries: total wallet balance, low-balance accounts, top-ups today, restricted wallets, pending adjustments.
- [ ] Implement top-up action with payment source/reference fields required by policy.
- [ ] Implement manual adjustment only with explicit permission, reason, and approval state where required.
- [ ] Implement set spending limit, freeze/restrict wallet, and send parent alert only through confirmed backend routes.
- [ ] Ensure parent alert action respects M12 provider/quiet-hour status where exposed.
- [ ] Never compute final wallet balance as browser truth after a mutation; refetch/invalidate after submit.

### 3.5 Menu and Weekly Meal Planning

- [ ] Build weekly planner with date range, campus, meal type, and plan status filters.
- [ ] Render meal grid by day and meal type from real APIs.
- [ ] Show Draft, Published, Not Planned, Edited After Publish, and Failed Publish states where supported.
- [ ] Implement Add Menu Item, Duplicate Week, Save Draft, Publish Menu, and Print Kitchen Sheet only where routes/contracts exist.
- [ ] Publish confirmation must show visibility impact and allergy/nutrition warnings.

### 3.6 Stock Close

- [ ] Build stock list with server-side search/category/status filters and pagination.
- [ ] Render KPIs from backend summaries: total stock items, low-stock items, stock close pending, wastage today, purchase value MTD.
- [ ] Implement Add Stock, Record Consumption, Record Wastage, Stock Close, Reopen with Reason, and Export Stock only through confirmed routes.
- [ ] Add Stock Close Summary with counted quantity, system quantity, discrepancies, discrepancy value, and top discrepancies.
- [ ] Enforce closed-day read-only behavior in UI while relying on backend enforcement.
- [ ] Reopen requires reason and audit-visible state.

---

## 4. P1 — Finance, Procurement, Parent Visibility and Reports

### 4.1 Meal Plans and Fee Invoice Handoff

- [ ] Build meal plan list with monthly, term, and class-specific tabs if supported by the contract.
- [ ] Render active meal plans, subscribed students, invoice handoff pending, and linked fee amount from backend summaries.
- [ ] Implement create meal plan, assign students, sync to fees, retry failed sync, and archive plan through confirmed routes.
- [ ] Display sync states: Synced, Pending, Partially Synced, Failed.
- [ ] Retry failed sync only through idempotent backend route; show retry-safe copy only after confirmation.
- [ ] Do not implement direct ledger posting from canteen frontend.

### 4.2 Vendors, Purchases and Vendor Bills

- [ ] Build vendor/purchase/bill/payment tabs from real APIs.
- [ ] Render vendor/bill KPIs: active vendors, open purchase orders, unpaid bills, overdue bills, monthly purchasing total.
- [ ] Implement Add Vendor, Create Purchase, Record Bill, Mark Paid, Lock Bill, View Audit History only through confirmed routes.
- [ ] Enforce locked bill behavior in UI; ordinary edits unavailable when locked/approved/paid/posted.
- [ ] Use reversal/correction flow for posted/paid corrections when supported.
- [ ] Use protected helpers for linked invoice and stock receipt documents.

### 4.3 Parent Canteen View

- [ ] Build linked-child-only parent canteen overview route.
- [ ] Render child selector only for children linked to the guardian session.
- [ ] Show wallet balance, daily spending limit, today's spending, allergy-safe status, today's menu, active meal plan, weekly menu, recent transactions, and receipts.
- [ ] Ensure direct route access to another child fails closed.
- [ ] Receipt downloads use protected child-scoped helpers.
- [ ] Do not show vendor, stock, schoolwide sales, internal audit, or other student data in parent routes.

### 4.4 Reports, Receipts and Exports

- [ ] Implement daily meal count, item-wise sales, wallet, stock, vendor bill, and parent receipt reports only from confirmed backend report APIs.
- [ ] Use queued job/status UI for large report exports when backend requires it.
- [ ] Use protected file helpers for PDFs, CSVs, receipts, invoices, stock close reports, and export snapshots.
- [ ] Never use browser-side aggregation as official sales, wallet, stock, vendor, or finance truth.

---

## 5. Browser E2E and Smoke Matrix

### Admin / Manager

- [ ] Canteen manager can open only tenant-scoped menu, stock, vendor, wallet, and meal-plan data.
- [ ] Canteen dashboard shows real summaries or honest unavailable states; no fake zero-value production metrics.
- [ ] Menu publish shows draft/published/edited-after-publish state and does not leak unpublished changes to parent view.
- [ ] Stock close locks closed stock day and reopen requires reason.
- [ ] Vendor bill lock prevents ordinary editing after locked/approved/paid/posted state.

### POS / Cashier

- [ ] Cashier can search/select student, add items, choose supported payment method, complete sale, and view protected receipt.
- [ ] Duplicate POS submit is blocked or safely handled by backend idempotency.
- [ ] Wallet, stock, allergy, and spending-control failures render school-friendly errors and preserve order context.

### Parent

- [ ] Parent can view only linked child canteen wallet, menu, meal plan, transactions, and receipts.
- [ ] Parent direct route to another child fails closed.
- [ ] Parent receipt download uses protected child-scoped helper.
- [ ] Parent route does not expose vendor, stock, internal audit, schoolwide sales, or other student data.

---

## 6. Verification Commands

Run relevant checks after implementation. Do not claim that they passed unless actually run.

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

M10-focused browser verification must include dashboard, POS, QR serve, wallet top-up/adjustment, menu planner, stock close/reopen, vendor bill lock, meal plan finance sync, parent canteen view, protected receipt access, permission-denied, and module-locked paths.

---

## 7. Definition of Done

```text
[ ] Uses real API/database persistence.
[ ] Tenant isolation and backend authorization confirmed.
[ ] Canteen manager/cashier/serving-staff/parent scopes fail closed.
[ ] Lists are server-paginated and server-filtered.
[ ] Wallet balances, POS totals, stock quantities, vendor bill totals, and sync states are backend-owned truth.
[ ] Loading, empty, error, success, permission, module-locked, queued, and partial-failure states exist.
[ ] Protected receipts/invoices/exports use shared authenticated helpers.
[ ] POS, serving, wallet adjustment, stock close, vendor bill lock, and finance sync actions show confirmation/audit-aware state where required.
[ ] Retry-safe labels appear only for confirmed idempotent backend operations.
[ ] No fake metrics, browser-only money/stock truth, direct ledger writes, or unconfirmed offline scanner claims.
[ ] Focused regression or browser E2E coverage updated.
[ ] Relevant verification commands were actually run and recorded.
```
