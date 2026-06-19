# M13 Inventory & Asset Management Implementation Plan

**Status:** Planned implementation guide for SchoolOS M13 Inventory & Asset Management.  
**Updated:** 2026-06-19  
**Scope:** Backend, web, shared contracts, seed data, tests, smoke, and later mobile/scanner readiness.

This plan is docs-only guidance until the matching code, contracts, migrations, tests, seeded flows, and verification evidence exist.

---

## 1. Implementation Principle

M13 must be implemented as a tenant-scoped SchoolOS module inside the existing modular monolith.

```text
No microservice split.
No direct frontend accounting writes.
No fake stock/asset values.
No raw private file URLs.
No browser-calculated official inventory truth.
```

---

## 2. Source Documents

Read in this order before implementation:

```text
README.md
docs/README.md
docs/product/M13_INVENTORY_ASSET_MANAGEMENT.md
docs/design/modules/M13_INVENTORY_ASSET_FRONTEND_REFERENCE.md
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md
docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
```

Backend/OpenAPI/shared contracts remain authoritative for actual route, DTO, enum, permission, and mutation shapes.

---

## 3. Recommended Module Structure

### Backend

```text
apps/api/src/inventory/
  inventory.module.ts
  inventory.service.ts
  inventory.controller.ts
  inventory.prisma.ts or repositories/
  dto/
  policies/
  inventory-audit.service.ts
  inventory-movement.service.ts
  inventory-purchase.service.ts
  inventory-asset.service.ts
  inventory-stocktake.service.ts
  inventory-maintenance.service.ts
  inventory-accounting-handoff.service.ts
  inventory-notification-events.ts
```

### Shared contracts

```text
packages/core/src/inventory/
  inventory.types.ts
  inventory.enums.ts
  inventory.schemas.ts
  inventory.api.ts
```

### Web

```text
apps/web/app/dashboard/inventory/
  page.tsx
  catalogue/page.tsx
  stock/page.tsx
  assets/page.tsx
  requests/page.tsx
  purchases/page.tsx
  vendors/page.tsx
  issue-return/page.tsx
  transfers/page.tsx
  stocktake/page.tsx
  maintenance/page.tsx
  reports/page.tsx
  settings/page.tsx

apps/web/components/inventory/
  inventory-overview.tsx
  inventory-kpi-strip.tsx
  inventory-filter-bar.tsx
  inventory-catalogue-table.tsx
  inventory-stock-table.tsx
  asset-register-table.tsx
  purchase-request-drawer.tsx
  receive-goods-wizard.tsx
  stock-movement-form.tsx
  stocktake-workspace.tsx
  maintenance-ticket-panel.tsx
  inventory-report-toolbar.tsx
```

### Web API client

```text
apps/web/lib/api/inventory.ts
```

---

## 4. Data Model Direction

Recommended core entities:

```text
InventoryCategory
InventoryItem
InventoryStore
InventoryLocation
InventoryStockLot
InventoryStockMovement
InventoryPurchaseRequest
InventoryQuotation
InventoryPurchaseOrder
InventoryGoodsReceivedNote
InventoryVendor
InventoryAsset
InventoryAssetAssignment
InventoryMaintenanceTicket
InventoryStocktakeSession
InventoryStocktakeLine
InventoryWriteOffCase
InventoryAccountingHandoff
```

Global database rules:

1. Every table includes `tenantId` unless explicitly platform-owned.
2. High-cardinality lists need tenant-scoped indexes for common filters.
3. Movement tables are append-oriented; do not silently mutate historical movement rows.
4. Official quantity is derived backend-side from movement/lot state or stored aggregate maintained transactionally by backend logic.
5. Asset tag uniqueness is tenant-scoped.
6. Vendor PAN/VAT metadata is tenant-scoped and permission-filtered.
7. Protected files reference File Registry IDs, not storage object keys.

---

## 5. Permissions

Recommended permission groups:

```text
inventory.read
inventory.manage_catalogue
inventory.manage_stores
inventory.request_purchase
inventory.review_purchase
inventory.approve_purchase
inventory.manage_vendors
inventory.receive_goods
inventory.issue_stock
inventory.transfer_stock
inventory.adjust_stock
inventory.manage_assets
inventory.assign_assets
inventory.manage_maintenance
inventory.run_stocktake
inventory.approve_stocktake
inventory.write_off_assets
inventory.view_reports
inventory.export_reports
inventory.configure_settings
```

Sensitive actions require stronger permission and audit:

```text
approve_purchase
adjust_stock
approve_stocktake
write_off_assets
dispose_asset
archive_asset
manual_valuation_change
accounting_handoff_retry
```

---

## 6. API Surface Direction

Use existing API conventions and OpenAPI generation. Suggested route families:

```text
GET    /inventory/overview
GET    /inventory/items
POST   /inventory/items
PATCH  /inventory/items/:id
GET    /inventory/stores
POST   /inventory/stores
GET    /inventory/stock
POST   /inventory/movements/issue
POST   /inventory/movements/return
POST   /inventory/movements/transfer
POST   /inventory/movements/adjust
GET    /inventory/assets
POST   /inventory/assets
PATCH  /inventory/assets/:id
POST   /inventory/assets/:id/assign
POST   /inventory/assets/:id/maintenance
POST   /inventory/assets/:id/write-off
GET    /inventory/purchase-requests
POST   /inventory/purchase-requests
POST   /inventory/purchase-requests/:id/submit
POST   /inventory/purchase-requests/:id/approve
POST   /inventory/purchase-requests/:id/reject
GET    /inventory/purchases
POST   /inventory/purchases
POST   /inventory/purchases/:id/receive
GET    /inventory/vendors
POST   /inventory/vendors
GET    /inventory/stocktake
POST   /inventory/stocktake
POST   /inventory/stocktake/:id/submit-count
POST   /inventory/stocktake/:id/approve-adjustment
GET    /inventory/reports/*
```

These are planning names only. Final names must match repository conventions and OpenAPI.

---

## 7. Backend Build Phases

### Phase 1 - Foundation

1. Add Prisma models/migrations for category, item, store, location, stock lot, movement, asset, vendor, and audit events.
2. Add shared enums/types/schemas in `packages/core`.
3. Add NestJS module/controller/service.
4. Add tenant/RBAC/entitlement guards.
5. Add File Registry linking for attachments.
6. Add basic seed data.
7. Add tests for tenant isolation, permission denial, item creation, asset creation, and stock movement idempotency.

### Phase 2 - Procurement and receiving

1. Purchase requests.
2. Approval workflow.
3. Vendor and quotation records.
4. Purchase order and GRN.
5. Partial receive/reject.
6. Protected bill/quotation attachments.
7. Low-stock event generation.
8. Tests for double-submit, stale PO, inactive vendor, partial receive, and protected file denial.

### Phase 3 - Asset lifecycle and maintenance

1. Asset assignment.
2. Asset QR/barcode label generation through protected artifact flow.
3. Maintenance tickets.
4. Warranty expiry tracking.
5. Lost/damaged/write-off/disposal lifecycle.
6. Tests for audit, permission, stale asset state, and lifecycle history preservation.

### Phase 4 - Stocktake, reports, and accounting handoff

1. Stocktake sessions and variance review.
2. Approval-based variance adjustment.
3. Report endpoints and queued export handling.
4. Accounting handoff queue to M9 boundary.
5. Notification events for approval, low-stock, maintenance, warranty, and stocktake reminders.
6. Browser smoke and seeded workflow proof.

---

## 8. Web Implementation Phases

### Phase 1 web

```text
Inventory overview
Catalogue list/detail
Stock list
Asset register
Permission/module-locked states
Protected attachment actions
```

### Phase 2 web

```text
Purchase request queue
Approval drawer
Vendor list
Quotation comparison
Purchase order / GRN receive wizard
Low-stock alerts
```

### Phase 3 web

```text
Issue/return/transfer workspace
Stocktake workspace
Maintenance workspace
Write-off/disposal confirmation
Report pages and export status
```

### Phase 4 web

```text
Barcode/QR label print flow
Accounting handoff monitor
Dashboard summaries
Authenticated Playwright smoke flows
```

---

## 9. Seed Data Requirements

Seed at least:

```text
Main store
Office store
Science lab store
Computer lab store
Sports room
Stationery items
Exam paper item
Cleaning supplies
Lab supplies
Furniture asset
Projector asset
Computer/printer asset
Transport spare part
Two vendors with PAN/VAT metadata
Pending purchase request
Approved purchase request
Partial purchase receive
Low stock item
Asset under repair
Stocktake session with variance
```

Seed data must be tenant-scoped and idempotent.

---

## 10. Test Requirements

Minimum backend tests:

1. Cross-tenant denial for item, stock, asset, vendor, purchase, movement, stocktake, and attachment.
2. Permission denial for approve, adjust, write-off, export, and accounting handoff retry.
3. Receive goods double-submit idempotency.
4. Issue/return/transfer double-submit idempotency.
5. Stock cannot go negative unless tenant policy explicitly allows it and action is authorized.
6. Stocktake adjustment requires approval.
7. Protected file access denies unauthorized users.
8. Vendor inactive blocks new PO where policy requires.
9. Asset lifecycle preserves history after archive/write-off.
10. Accounting handoff never directly writes ledger outside M9 boundary.

Minimum web tests/contracts:

1. API client request/response parsing.
2. Module locked state.
3. Permission denied state.
4. Empty/error/loading/success states.
5. Protected file action uses helper.
6. No fake production data in visible workspaces.
7. Report export queued/completed/failed states.

---

## 11. Smoke Flow Targets

```text
Create item -> receive stock -> issue stock -> return stock -> view movement ledger
Create purchase request -> approve -> create PO -> receive partial GRN -> view stock increase
Register fixed asset -> assign to computer lab -> create maintenance ticket -> complete repair
Start stocktake -> count variance -> approve adjustment -> view report
Upload bill/warranty -> download through protected file helper
Open dashboard as unauthorized role -> fail closed
```

---

## 12. Release Evidence Required

M13 cannot be marked implemented, pilot-ready, or production-ready until evidence exists for:

```text
Prisma migration and validation
OpenAPI/shared contracts
Backend unit/e2e tests
Web typecheck/lint/build
Web contract tests
Seed idempotency
Authenticated browser smoke
Tenant/RBAC denial proof
Protected-file proof
Accounting handoff boundary proof
Staging migration and provider/storage checks
Pilot workflow validation
```

Docs-only updates require no runtime checks.
