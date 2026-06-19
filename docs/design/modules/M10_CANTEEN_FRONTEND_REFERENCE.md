# M10 Canteen — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-19
**Module:** M10 Canteen
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M10 manages menus, meal plans, POS sales, QR serving, student wallets, allergy warnings, stock close, vendors/bills, receipts, and finance handoff.

It gives canteen staff a fast serving and sale workflow while keeping wallet debits atomic, health warnings visible, stock accountable, and parent spending child-scoped.

For Nepal schools, it must support NPR cash/POS realities, school meal plans, guardian top-ups, local foods/vendors, intermittent scanners, and practical daily stock close.

---

## 2. Full Feature List

### Canteen dashboard

**Purpose:**
Shows sales, meals served, low wallets, stock alerts, close status, and exceptions.

**Users:**
Canteen manager, staff, principal by permission.

**Frontend behavior:**
Backend KPI strip and attention queues.

**Backend alignment:**
Backend owns all totals.

### Menu planner

**Purpose:**
Schedules available items, prices, meal periods, dietary tags, and availability.

**Users:**
Canteen manager.

**Frontend behavior:**
Calendar/list editor with publish status and item detail.

**Backend alignment:**
Backend validates effective menu/price.

### Meal plans

**Purpose:**
Assigns approved meal packages/eligibility for classes or students.

**Users:**
Manager/admin.

**Frontend behavior:**
Plan list and scoped assignment workflow.

**Backend alignment:**
Backend owns eligibility/effective dates.

### POS sale

**Purpose:**
Creates an atomic sale using wallet/cash/approved method and confirmed receipt.

**Users:**
Canteen staff.

**Frontend behavior:**
Scanner/search basket, backend price/total preview, tender and idempotent confirm.

**Backend alignment:**
Backend owns prices, stock, wallet debit, totals, receipt.

### QR serve

**Purpose:**
Validates student/meal entitlement and prevents duplicate serving.

**Users:**
Canteen staff.

**Frontend behavior:**
Persistent scan focus, student context, warnings, entitlement/result panel.

**Backend alignment:**
Backend validates QR/session/duplicate.

### Allergy/medical warnings

**Purpose:**
Shows minimum necessary safety warning before confirm.

**Users:**
Canteen staff.

**Frontend behavior:**
Prominent text/icon warning requiring acknowledgement where policy says.

**Backend alignment:**
Backend supplies scoped warning and audit policy.

### Student wallets

**Purpose:**
Shows backend balance, ledger, limits, hold/low balance, and top-up/adjustment state.

**Users:**
Authorized finance/canteen; parent child-safe view.

**Frontend behavior:**
Exact balance and chronological entries; no browser math.

**Backend alignment:**
Backend atomic ledger is truth.

### Top-up, adjustment, spending limits

**Purpose:**
Controls funds through approved idempotent and audited workflows.

**Users:**
Authorized staff; parent only if approved payment contract exists.

**Frontend behavior:**
Reasoned form, preview, confirmation, result.

**Backend alignment:**
Backend validates source, limits, idempotency, audit.

### Stock close

**Purpose:**
Reconciles opening, purchases, consumption, waste, and counted stock.

**Users:**
Canteen manager.

**Frontend behavior:**
Close worksheet with backend expected, counted, variance, reason.

**Backend alignment:**
Backend owns inventory calculations/locks.

### Vendors and bills

**Purpose:**
Tracks approved suppliers, purchases, bills, due/payment handoff references.

**Users:**
Manager/accountant by permission.

**Frontend behavior:**
Vendor/purchase table and protected bill attachment.

**Backend alignment:**
Backend scopes vendors and finance handoff.

### Receipts

**Purpose:**
Shows only confirmed POS/top-up receipts and idempotent reprint.

**Users:**
Staff and linked parent where allowed.

**Frontend behavior:**
Receipt history/detail with protected open/download.

**Backend alignment:**
Backend generates receipt and version/reprint state.

### Parent canteen view

**Purpose:**
Shows linked-child wallet, limits, spend history, meals, and allowed receipts.

**Users:**
Parent.

**Frontend behavior:**
Child selector and purpose-limited summary/ledger.

**Backend alignment:**
Backend linked-child scope.

### M11 handoff

**Purpose:**
Shows approved sales/purchase/close accounting status without direct journal writes.

**Users:**
Authorized accountant/manager.

**Frontend behavior:**
Handoff badge and exception detail.

**Backend alignment:**
Backend integration owns postings.

---

## 3. Frontend Design Direction Based on Features

Use a counter and meal operations workspace under the standard shell. Follow [the master web design plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

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
| Canteen staff | POS, serve, permitted wallet lookup | Other tenants, broad medical/profile data | POS, QR serve |
| Canteen manager | Menus, plans, stock, vendors, close | Unauthorized accounting journals | Dashboard, setup, close |
| Accountant | Approved top-up/handoff/vendor finance view | Meal health detail unless required | Wallet/handoff |
| Parent | Linked-child wallet/spend/meal/receipts | Other children and stock/vendor internals | Parent canteen |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes and names; any addition/difference needs route/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/canteen
/dashboard/canteen/menu
/dashboard/canteen/meal-plans
/dashboard/canteen/pos
/dashboard/canteen/serve
/dashboard/canteen/wallets
/dashboard/canteen/stock-close
/dashboard/canteen/vendors
```

### Parent Routes

```text
/parent/children/[studentId]/canteen
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Canteen Dashboard

**Purpose:**
Monitor service readiness and daily exceptions.

**Main users:**
Manager, principal by permission.

**Route:**
`/dashboard/canteen` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, low balances, stock/close/handoff alerts.

**Layout:**
Module header, context/filter bar, Attention lists for menu availability, low wallets, failed/duplicate serves, stock variance, open close, vendor bills, and a right drawer for selected exception, student-safe context, handoff and audit.

**Header actions:**
Open POS; Plan Menu

**Filters:**
Date/meal period, status, class, alert type

**KPI cards / summary cards:**
Sales; meals served; wallet debits; low balances; stock alerts from backend

**Main table / list / grid:**
Attention lists for menu availability, low wallets, failed/duplicate serves, stock variance, open close, vendor bills

**Right drawer / detail panel:**
selected exception, student-safe context, handoff and audit

**Forms / modals:**
None

**Confirmations:**
Reminder/export/close actions require confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Summary, attention queues, timestamps, handoff status.

**Protected files:**
Reports/receipts protected.

**Audit behavior:**
Exception handling, reminder, export.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 2. Menu and Meal Plans

**Purpose:**
Publish available items and assign approved meal plans.

**Main users:**
Manager/admin.

**Route:**
`/dashboard/canteen/menu` (planning route; reuse current route if different).

**Main features shown on this screen:**
Menu planner, meal plans, dietary tags.

**Layout:**
Module header, context/filter bar, Calendar/list of meal periods/items plus plan/assignment tabs, and a right drawer for item price/history, ingredients/tags, plan eligibility, audit.

**Header actions:**
Add Menu Item / Publish Menu

**Filters:**
Date, meal, availability, dietary tag, class/plan

**KPI cards / summary cards:**
Available items; unpublished changes; plan assignments

**Main table / list / grid:**
Calendar/list of meal periods/items plus plan/assignment tabs

**Right drawer / detail panel:**
item price/history, ingredients/tags, plan eligibility, audit

**Forms / modals:**
Item name, bilingual label, price, period, availability, tags; plan/effective assignments

**Confirmations:**
Publish/price change/remove assignment requires impact confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Menu/items/prices, plans, assignments, validation, versions.

**Protected files:**
Menu image only through protected file if used.

**Audit behavior:**
Price/menu publish, plan assignment, before/after.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 3. POS Sale

**Purpose:**
Complete a fast exact sale and receipt.

**Main users:**
Canteen staff.

**Route:**
`/dashboard/canteen/pos` (planning route; reuse current route if different).

**Main features shown on this screen:**
POS, wallet debit, receipt, warning.

**Layout:**
Module header, context/filter bar, Student/QR lookup, item grid/search, basket, backend totals, tender/confirm/result, and a right drawer for student minimum context, allergy warning, eligibility, recent duplicates.

**Header actions:**
Confirm Sale

**Filters:**
Student/admission/QR; item/category/availability

**KPI cards / summary cards:**
Wallet balance; basket total; spending remaining from backend

**Main table / list / grid:**
Student/QR lookup, item grid/search, basket, backend totals, tender/confirm/result

**Right drawer / detail panel:**
student minimum context, allergy warning, eligibility, recent duplicates

**Forms / modals:**
Quantity, approved tender/reference; no editable official totals

**Confirmations:**
Confirm shows student/items/amount/method; duplicate submit blocked

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Student/wallet/limits/warnings, menu/prices/stock, preview, atomic mutation, receipt.

**Protected files:**
Confirmed receipt protected.

**Audit behavior:**
Sale attempt/result, warning acknowledgement, stock/wallet entries, reprint.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 4. QR Meal Serve

**Purpose:**
Validate and record one entitled meal without duplicate service.

**Main users:**
Canteen staff.

**Route:**
`/dashboard/canteen/serve` (planning route; reuse current route if different).

**Main features shown on this screen:**
QR serve, meal plans, allergy warning.

**Layout:**
Module header, context/filter bar, Persistent scanner, student identity, entitlement/warning panel, serve result, recent serves, and a right drawer for plan/meal eligibility, minimum health warning, last serve.

**Header actions:**
Confirm Serve

**Filters:**
Meal period, date; QR/student fallback

**KPI cards / summary cards:**
Eligible; served; duplicate; blocked; warning

**Main table / list / grid:**
Persistent scanner, student identity, entitlement/warning panel, serve result, recent serves

**Right drawer / detail panel:**
plan/meal eligibility, minimum health warning, last serve

**Forms / modals:**
Fallback lookup and exception reason

**Confirmations:**
Warning acknowledgement and serve confirmation; duplicate stays blocked

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
QR/student lookup, entitlement, warning, idempotent serve mutation.

**Protected files:**
None unless evidence is approved.

**Audit behavior:**
Scan/lookup, warning acknowledgement, serve/duplicate/override.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 5. Wallets, Top-ups and Limits

**Purpose:**
Operate exact wallet balances and controlled adjustments.

**Main users:**
Authorized manager/accountant.

**Route:**
`/dashboard/canteen/wallets` (planning route; reuse current route if different).

**Main features shown on this screen:**
Wallet ledger, top-up/adjustment, limits.

**Layout:**
Module header, context/filter bar, Student wallet search/table and selected chronological ledger, and a right drawer for ledger entries, limits, holds, receipt and audit.

**Header actions:**
Top Up / Adjust / Set Limit

**Filters:**
Student, class, balance status, entry type, date

**KPI cards / summary cards:**
Backend balance; low balance; held; spend this period

**Main table / list / grid:**
Student wallet search/table and selected chronological ledger

**Right drawer / detail panel:**
ledger entries, limits, holds, receipt and audit

**Forms / modals:**
Amount/source/reference/reason; limit/effective date

**Confirmations:**
Every money change shows before/after, reason, permission, idempotency

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Exact wallet summary/ledger, preview, mutation, receipt/status.

**Protected files:**
Top-up/adjustment receipts protected.

**Audit behavior:**
Every wallet write, duplicate, limit/hold change.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 6. Stock Close, Vendors and Bills

**Purpose:**
Reconcile daily stock and track supplier evidence.

**Main users:**
Manager; accountant by permission.

**Route:**
`/dashboard/canteen/stock-close` (planning route; reuse current route if different).

**Main features shown on this screen:**
Stock close, vendors/bills, M11 handoff.

**Layout:**
Module header, context/filter bar, Close worksheet plus item variance table and vendor/purchase/bill tabs, and a right drawer for item movement, reason, purchase/bill, protected attachment, handoff.

**Header actions:**
Submit Close / Add Purchase

**Filters:**
Date/session, category, vendor, variance, bill/handoff status

**KPI cards / summary cards:**
Expected; counted; variance; waste; purchases from backend

**Main table / list / grid:**
Close worksheet plus item variance table and vendor/purchase/bill tabs

**Right drawer / detail panel:**
item movement, reason, purchase/bill, protected attachment, handoff

**Forms / modals:**
Counted stock, waste/reason, purchase/vendor/bill fields

**Confirmations:**
Close/reopen/correct and purchase approval require confirmation/reason

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Stock movements/expected counts, close state, vendors/purchases, handoff.

**Protected files:**
Bills, close reports, receipts protected.

**Audit behavior:**
Counts/variance, close transitions, purchases, files, handoff.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 7. Parent Canteen

**Purpose:**
Show linked-child spending safely.

**Main users:**
Parent.

**Route:**
`/parent/children/[studentId]/canteen` (planning route; reuse current route if different).

**Main features shown on this screen:**
Wallet, limits, spend/meal history, receipts.

**Layout:**
Module header, context/filter bar, Backend summary cards plus chronological spend/meals/receipt list, and a right drawer for selected transaction/meal and allowed receipt.

**Header actions:**
Open Receipt; Top Up only if approved

**Filters:**
Child, period, entry type

**KPI cards / summary cards:**
Balance; limit; spend; low balance from backend

**Main table / list / grid:**
Backend summary cards plus chronological spend/meals/receipt list

**Right drawer / detail panel:**
selected transaction/meal and allowed receipt

**Forms / modals:**
Top-up/limit request only if safe contract exists

**Confirmations:**
Money action requires confirmed external/payment workflow

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Linked-child wallet/ledger/meals/receipts/limits projection.

**Protected files:**
Allowed receipts protected.

**Audit behavior:**
Parent requests/downloads only; no internal stock/medical detail.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

---

## 7. Simple Wireframe Designs

### 1. Canteen Dashboard

```text
+------------------------------------------------------------------+
| Canteen Dashboard                           [Open POS] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Sales; meals served; wallet debits; low balances; sto |
+------------------------------------------------------------------+
| Filters: Date/meal period, status, class, alert type           |
+--------------------------------------------+---------------------+
| Attention lists for menu availability, l | selected exceptio |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: None                                              |
+------------------------------------------------------------------+
```

### 2. Menu and Meal Plans

```text
+------------------------------------------------------------------+
| Menu and Meal Plans                         [Add Menu Item / ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Available items; unpublished changes; plan assignment |
+------------------------------------------------------------------+
| Filters: Date, meal, availability, dietary tag, class/plan     |
+--------------------------------------------+---------------------+
| Calendar/list of meal periods/items plus | item price/histor |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Item name, bilingual label, price, period, availa |
+------------------------------------------------------------------+
```

### 3. POS Sale

```text
+------------------------------------------------------------------+
| POS Sale                                    [Confirm Sale] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Wallet balance; basket total; spending remaining from |
+------------------------------------------------------------------+
| Filters: Student/admission/QR; item/category/availability      |
+--------------------------------------------+---------------------+
| Student/QR lookup, item grid/search, bas | student minimum c |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Quantity, approved tender/reference; no editable  |
+------------------------------------------------------------------+
```

### 4. QR Meal Serve

```text
+------------------------------------------------------------------+
| QR Meal Serve                               [Confirm Serve] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Eligible; served; duplicate; blocked; warning         |
+------------------------------------------------------------------+
| Filters: Meal period, date; QR/student fallback                |
+--------------------------------------------+---------------------+
| Persistent scanner, student identity, en | plan/meal eligibi |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Fallback lookup and exception reason              |
+------------------------------------------------------------------+
```

### 5. Wallets, Top-ups and Limits

```text
+------------------------------------------------------------------+
| Wallets, Top-ups and Limits                 [Top Up / Adjust ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Backend balance; low balance; held; spend this period |
+------------------------------------------------------------------+
| Filters: Student, class, balance status, entry type, date      |
+--------------------------------------------+---------------------+
| Student wallet search/table and selected | ledger entries, l |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Amount/source/reference/reason; limit/effective d |
+------------------------------------------------------------------+
```

### 6. Stock Close, Vendors and Bills

```text
+------------------------------------------------------------------+
| Stock Close, Vendors and Bills              [Submit Close / A] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Expected; counted; variance; waste; purchases from ba |
+------------------------------------------------------------------+
| Filters: Date/session, category, vendor, variance, bill/handof |
+--------------------------------------------+---------------------+
| Close worksheet plus item variance table | item movement, re |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Counted stock, waste/reason, purchase/vendor/bill |
+------------------------------------------------------------------+
```

### 7. Parent Canteen

```text
+------------------------------------------------------------------+
| Parent Canteen                              [Open Receipt] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Balance; limit; spend; low balance from backend       |
+------------------------------------------------------------------+
| Filters: Child, period, entry type                             |
+--------------------------------------------+---------------------+
| Backend summary cards plus chronological | selected transact |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Top-up/limit request only if safe contract exists |
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
| M10 widgets | menu, POS, QR serve, warning, wallet, stock-close, vendor, receipt, and parent widgets | Create composition | Reuse base primitives. |

---

## 9. Backend and API Alignment

> Capability labels are planning terms, not endpoint names. Use verified current OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries, paginated lists, scoped details, and backend-owned totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated commands with RBAC/entitlement and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Menu publish; meal-plan assignment; POS preview/confirm; serve; wallet top-up/adjust/limit/hold; stock close/correction; purchase/handoff. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Effective menu/price, item stock, wallet/limit, meal eligibility, duplicate serve/sale, health warning, Decimal amount, idempotency. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Receipts, sales/meal/wallet/stock-close/vendor exports use backend snapshots/jobs. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Receipts, purchase bills, close reports and exports use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Low balance, serve/sale, menu/plan and close exceptions emit M12 events. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

M10 owns operational sales/wallet/stock truth; M11 owns accounting. No direct journal writes; parent top-up needs approved payment reconciliation. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Prices/menu, assignments, warning acknowledgement, sales/serves, wallet writes, close, vendors/bills, handoff. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Parent linked-child and canteen staff minimum-safe student projections; no admin payload reuse. **needs OpenAPI confirmation** unless verified in the current contract.

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
| Duplicate serve | Backend says meal already served for entitlement/window | Show prior timestamp and block another serve unless audited override exists | Idempotency/serve record |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates all queries, jobs, exports, files, events, caches, and audit records.
- Backend RBAC and module entitlement are truth; frontend hiding is UX only.
- All money, wallet, stock, and sale totals are backend Decimal truth.
- Canteen staff receive only minimum necessary allergy/medical warning, not broad health records.
- Receipts appear only after confirmed backend success.
- Sensitive fields are omitted/masked by backend permission and never placed in URLs, logs, analytics, or exports without authorization.
- Protected files use File Registry helpers; never expose object keys, provider URLs, secrets, or raw internal errors.
- Audit-sensitive actions show backend actor/time/reason/history; the UI invents no audit facts.

---

## 12. Nepal-Specific Requirements

- Format NPR from exact backend values and support cash plus only verified approved payment methods.
- Use local meal names in Nepali/English, meal periods, school calendars and class/section lookup.
- Support practical QR plus admission/roll/manual fallback without weakening backend validation.
- Vendor bills and daily close should fit local school recordkeeping and fiscal context.
- Health warnings must remain prominent even during fast queues.

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
