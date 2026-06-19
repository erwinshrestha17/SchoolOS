# M13 Inventory & Asset Management

**Status:** Active product and functional reference for the planned SchoolOS M13 Inventory & Asset Management module.  
**Updated:** 2026-06-19  
**Market:** Nepal-focused school operating SaaS  
**Scope:** School-owned consumables, fixed assets, purchase requests, stock movement, maintenance, asset audit, and accounting handoff.

This document is a module-specific requirements reference. It complements the master PRD/FRS and does not override backend/OpenAPI contracts, tenant isolation, RBAC, File Registry, audit, accounting boundaries, or release-readiness evidence.

---

## 1. Product Intent

M13 Inventory & Asset Management helps a Nepali school answer:

```text
1. What stock and assets does the school own?
2. Where are they located?
3. Who requested, approved, issued, returned, repaired, wrote off, or transferred them?
4. Which items are low-stock, expired, damaged, lost, under repair, or due for audit?
5. Which purchases need approval, quotations, bills, receiving, or accounting handoff?
6. Which asset records are ready for principal, accountant, auditor, or School Management Committee review?
```

The module must feel like a **school store room + asset register + procurement control desk**, not a generic warehouse ERP.

---

## 2. Nepal-Focused Context

Nepali schools commonly manage physical resources through notebooks, Excel sheets, manual purchase bills, informal vendor relationships, and partial accounting records. The module must support real local workflows:

| Nepal school reality | Product implication |
|---|---|
| Schools buy stationery, uniforms, exam materials, sports goods, lab supplies, cleaning items, furniture, electronics, and repair parts from local vendors. | Support item categories, vendor records, quotations, purchase requests, purchase orders, goods received notes, and bill attachments. |
| Some purchases are cash/manual and later entered by an accountant. | Allow controlled manual purchase capture, but accounting posting remains M9-owned. |
| VAT/PAN bills, non-VAT bills, and local handwritten bills may all appear. | Store bill metadata, vendor PAN/VAT number where available, and protected bill images/PDFs. |
| Nepali fiscal year and school academic year differ. | Inventory reports must filter by both academic year and fiscal year where relevant. |
| School Management Committee or principal may need purchase approval. | Add approval workflow, threshold-based approval depth, and audit trail. |
| Donated/grant items are common in some schools. | Support donation/grant source, donor name, received date, conditions, and asset tagging. |
| Lab chemicals, sports gear, electronics, and library/canteen items have different handling. | Support category-specific fields and clear module boundaries with Library, Canteen, Transport, HR/Payroll, and Accounting. |
| Connectivity and device availability can be inconsistent. | Use simple, low-bandwidth web screens with printable labels, reports, and offline-friendly stocktake exports/imports where later approved. |

---

## 3. Module Boundaries

### 3.1 In scope

```text
Inventory catalogue
Consumable stock
Fixed asset register
Stores/locations
Purchase requests
Quotation comparison
Purchase orders
Goods received notes
Stock issue and return
Inter-store transfer
Department/class/lab issue
Asset assignment
Maintenance and repair
Stocktake/audit
Lost/damaged/write-off lifecycle
Barcode/QR labels
Protected bill/document storage
Inventory reports
M9 Accounting handoff events
```

### 3.2 Out of scope unless explicitly approved

```text
Direct ledger writes from frontend
Direct depreciation journal posting from browser
Canteen edible stock replacement
Library book-copy replacement
Transport live GPS/fuel replacement
Payroll/staff salary assets
Open marketplace/vendor ordering
Public parent/student inventory views
```

### 3.3 Cross-module ownership

| Cross-module area | Rule |
|---|---|
| M9 Accounting | Inventory may emit approved accounting handoff events. Official ledger posting, reversal, fiscal locks, and report snapshots remain M9-owned. |
| M8C Canteen | Canteen stock for meals/POS remains M8C-owned. M13 can manage general store items or central purchase if contracts explicitly support handoff. |
| M8A Library | Book title/copy lifecycle remains M8A-owned. M13 can manage furniture, shelves, scanners, and non-book library equipment. |
| M8B Transport | Vehicle operations remain M8B-owned. M13 can manage spare parts, tools, tyres, batteries, and non-live asset register data if integrated safely. |
| M7 HR/Payroll | Staff can request or hold assets, but staff HR records remain M7-owned. |
| File Registry | Bills, warranties, asset photos, quotations, stocktake sheets, and write-off documents use protected File Registry flows. |
| Notifications/M10 | Approval reminders, low-stock alerts, maintenance due notices, and stocktake tasks route through the notification architecture where implemented. |

---

## 4. Primary Actors

| Actor | Main jobs |
|---|---|
| Storekeeper / Inventory Officer | Maintain stock, receive goods, issue items, run stocktake, print labels, flag low stock. |
| School Admin | Configure categories, stores, locations, approval rules, vendors, item masters, and policies. |
| Principal / Owner | Approve high-value purchases/write-offs and review inventory risk dashboards. |
| Accountant / Finance Staff | Review bills, purchase value, accounting handoff, asset capitalization, and report alignment. |
| Department Head / Lab In-charge | Request supplies, confirm receipt, report damage/loss, manage department stock. |
| Teacher / Staff Requester | Request classroom or department supplies and acknowledge issued assets where allowed. |
| Auditor / SMC Reviewer | Read-only review of purchase, asset, stocktake, write-off, and audit evidence. |
| Platform Operator | Manage entitlement/support diagnostics only; no silent browsing of school inventory. |

---

## 5. Core Data Concepts

```text
ItemCategory
ItemMaster
StockItem
FixedAsset
StoreLocation
StockLot
StockMovement
PurchaseRequest
Quotation
PurchaseOrder
GoodsReceivedNote
Vendor
AssetAssignment
MaintenanceTicket
StocktakeSession
WriteOffCase
InventoryAuditEvent
InventoryAccountingHandoff
```

Recommended item classification:

```text
CONSUMABLE        stationery, exam paper, chalk/markers, cleaning supplies
DISTRIBUTABLE    uniforms, ID-card material, books sold/distributed by school
LAB_SUPPLY       chemicals, lab tools, practical supplies
SPORTS_ITEM      balls, rackets, kits, sports uniforms
EQUIPMENT        projectors, computers, printers, CCTV, routers, smart boards
FURNITURE        desks, benches, chairs, cupboards, shelves
TRANSPORT_PART   tyres, batteries, tools, spare parts, first-aid kits
INFRA_ASSET      generators, water pumps, solar/inverter, sound system
DONATED_ASSET    grant/donation-funded assets
```

---

## 6. Functional Requirements

### 6.1 Catalogue and category setup

1. Create item categories and subcategories.
2. Create item masters with unit, type, reorder level, storage rules, and accounting mapping placeholder.
3. Mark items as consumable, fixed asset, controlled item, lab-sensitive item, or distributable item.
4. Configure unit of measure: pcs, packet, box, set, kg, litre, meter, roll, bottle, bundle, etc.
5. Attach item images, specification sheets, manuals, warranty cards, and purchase documents through File Registry.
6. Archive items without deleting movement history.

### 6.2 Stores and locations

1. Configure stores: main store, office store, science lab, computer lab, sports room, exam room, maintenance room, transport store, hostel store where enabled.
2. Configure physical location hierarchy: building, floor, room, rack, shelf, cupboard, bin.
3. Transfer stock between stores with source, destination, quantity, reason, requester, approver, and audit.
4. Track location for fixed assets and assigned staff/department/classroom.

### 6.3 Purchase request and approval

1. Staff/department users can raise purchase requests where permission allows.
2. Request includes item, quantity, expected use, needed date, estimated cost, department/class/lab, and attachment where needed.
3. Approval depth may depend on amount, category, fiscal year, funding source, and school policy.
4. Principal/owner/SMC reviewer can approve, reject, request changes, or put on hold with reason.
5. High-value purchase approvals require audit-visible reason and before/after state.

### 6.4 Quotation and vendor management

1. Maintain vendor records with name, contact, address, PAN/VAT number, bill type, category, and notes.
2. Attach quotations and compare vendor offers by price, warranty, delivery time, and terms.
3. Mark selected quotation with approval reason.
4. Keep vendor blacklisted/inactive status where configured.
5. Do not expose vendor private details to unauthorized roles.

### 6.5 Purchase order and goods received note

1. Create purchase order from approved request or directly where permission allows.
2. Record goods received note with received quantity, accepted quantity, rejected quantity, condition, bill number, bill date, VAT/PAN metadata, and attachments.
3. Support partial receipt and backorder state.
4. Update stock only through approved receive flow.
5. Generate protected GRN/Purchase report artifact where backend supports it.

### 6.6 Stock issue, return, adjustment, and transfer

1. Issue consumables to staff, department, class, lab, office, hostel, or event.
2. Return reusable items with condition check.
3. Adjust stock only through permission-gated reasoned adjustment.
4. Require approval for high-value, controlled, expired, damaged, lost, or unusual adjustments.
5. Keep movement timeline for every stock lot/item.
6. Double-submit/retry must not duplicate issue, receive, transfer, adjustment, or return movements.

### 6.7 Fixed asset register

1. Register fixed asset from purchase, donation, transfer, or opening balance.
2. Store asset tag, serial number, model, brand, purchase date, vendor, cost, funding source, warranty, location, custodian, condition, and status.
3. Print barcode/QR asset label.
4. Assign asset to staff, department, room, lab, bus, hostel, or admin unit.
5. Track lifecycle: active, assigned, under repair, damaged, lost, written off, disposed, archived.
6. Record asset photo and documents through protected file helpers.

### 6.8 Maintenance and repair

1. Create maintenance ticket for fixed asset.
2. Record fault, reported by, priority, location, warranty status, repair vendor, estimated cost, approval state, completion state, and attachments.
3. Mark asset unavailable/under repair during active maintenance where needed.
4. Link repeated repairs to asset history.
5. High-cost repairs require approval and accounting handoff where configured.

### 6.9 Stocktake and audit

1. Start stocktake session by store/category/location.
2. Export printable or scanner-friendly stocktake list.
3. Count actual quantity and compare with system quantity.
4. Record variance, reason, reviewer, and approval.
5. Generate discrepancy report.
6. Approve adjustment only after review.
7. Preserve historical stocktake evidence.

### 6.10 Reports

Required reports:

```text
Stock on hand
Low stock
Stock movement ledger
Purchase request status
Vendor purchase summary
Goods received report
Issue/return report
Stock adjustment report
Asset register
Asset by location
Asset by custodian
Warranty expiry
Maintenance due/repair history
Lost/damaged/write-off report
Stocktake variance report
Donation/grant asset report
Accounting handoff queue
```

All growing reports require server-side filters and export/job state where large.

---

## 7. Key States

```text
Item: draft, active, inactive, archived
Purchase Request: draft, submitted, under_review, approved, rejected, changes_requested, cancelled
Quotation: pending, received, selected, rejected, expired
Purchase Order: draft, issued, partially_received, received, cancelled, closed
GRN: draft, posted, partially_accepted, rejected, cancelled
Stock Lot: available, reserved, issued, depleted, expired, damaged, lost, adjusted
Stock Movement: pending, posted, reversed, failed
Asset: active, assigned, in_store, under_repair, damaged, lost, written_off, disposed, archived
Maintenance: reported, approved, in_progress, completed, rejected, cancelled
Stocktake: planned, counting, review, approved, adjusted, closed, cancelled
Accounting Handoff: pending, queued, posted, failed, reversed, ignored
```

---

## 8. Validation and Safety Rules

1. Every record is tenant-scoped.
2. Disabled module routes and APIs fail closed.
3. Stock quantity changes only through movement records.
4. Stock movement totals are backend/database truth.
5. Browser must not calculate official stock, valuation, depreciation, or accounting totals.
6. Receive, issue, transfer, adjustment, return, stocktake adjustment, write-off, and repair completion are idempotent.
7. High-risk adjustments/write-offs require permission, reason, confirmation, and audit.
8. File attachments use File Registry and never expose raw object keys/permanent URLs.
9. Vendor PAN/VAT and bill metadata are permission-filtered.
10. Accounting handoff is not direct ledger posting; M9 remains official accounting authority.
11. Asset write-off/disposal must preserve full history.
12. Category-specific sensitive items such as chemicals or exam materials require restricted visibility and controlled issue.
13. Same item code or asset tag in another tenant must never affect local lookup.
14. A failed report/export/label job must show safe diagnostics without secrets.
15. Stocktake variance must not auto-adjust without reviewer approval.

---

## 9. Edge Cases

1. Same purchase request is submitted twice due to slow network.
2. GRN is saved after purchase order is cancelled or already fully received.
3. Stock issue is attempted while available quantity changed in another tab.
4. Asset tag/serial number duplicates within tenant.
5. Asset is assigned to a staff member who has been archived or left school.
6. Bill attachment upload succeeds but File Registry association fails.
7. Vendor becomes inactive while purchase order is still open.
8. Stocktake count conflicts with movement posted after count started.
9. Low-stock alert fires while purchase order is already approved but not received.
10. Asset is under repair when transfer/disposal is attempted.
11. Category policy changes after item was created.
12. Fiscal year closes before accounting handoff is posted.
13. User loses permission while adjustment/write-off drawer is open.
14. Parent/student route tries to access inventory document deep link.
15. Cross-tenant asset tag collision.

---

## 10. Acceptance Criteria

1. Inventory catalogue, stock, asset, purchase, vendor, movement, maintenance, and stocktake queries are tenant-scoped.
2. Storekeeper can receive goods through a GRN and stock increases exactly once.
3. Staff can request items only where permission allows.
4. Principal can approve/reject high-value request with reason and audit.
5. Storekeeper can issue/return/transfer stock with idempotent movement records.
6. Fixed assets show lifecycle, location, custodian, condition, warranty, maintenance, and protected documents.
7. Stocktake variance requires approval before adjustment.
8. Accounting handoff queues safely for M9 and never writes ledger directly from browser.
9. Unauthorized parent/student/driver/staff routes cannot access inventory admin data.
10. Protected bills, warranties, labels, reports, and write-off documents use File Registry helpers.
11. Reports use backend filters, pagination, and queued export state where needed.
12. Module disabled and permission-denied states are clear and fail closed.

---

## 11. Recommended Implementation Phases

| Phase | Outcome |
|---|---|
| Phase 1 | Item catalogue, stores, basic stock movements, asset register, protected attachments, RBAC, audit. |
| Phase 2 | Purchase requests, approvals, vendors, quotations, purchase orders, GRN, low-stock alerts. |
| Phase 3 | Stocktake, barcode/QR labels, maintenance, warranty, write-off/disposal, advanced reports. |
| Phase 4 | M9 accounting handoff, depreciation configuration, queued exports, dashboard summaries, mobile/scanner companion. |

Do not claim implementation readiness until matching backend, OpenAPI/shared contracts, web screens, tests, seed data, and smoke evidence exist.
