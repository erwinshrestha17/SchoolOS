# M13 Inventory & Asset Management Frontend Reference

**Status:** Active module-level frontend design reference for planned M13 Inventory & Asset Management.  
**Updated:** 2026-06-19  
**Scope:** SchoolOS web inventory desk, asset register, purchasing workbench, stocktake flow, reports, and future scanner/mobile companion.  
**Primary consumers:** Web implementers, mobile/scanner implementers, Codex agents, QA reviewers, and product/design reviewers.

This document is planning and design guidance only. It must not invent backend data, route contracts, permissions, accounting behavior, or protected-file access. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Design Intent

M13 should feel like a **school store room, procurement desk, and asset register** joined into one operational workspace.

The frontend must help users quickly answer:

```text
What is available?
What is low, damaged, expired, lost, under repair, or pending approval?
Where is each item or asset?
Who requested, approved, received, issued, returned, transferred, repaired, or wrote it off?
Which documents, bills, warranties, and audit notes support the record?
```

One screen must still follow the SchoolOS rule:

```text
One screen = one main job.
```

---

## 2. Standard Workspace Pattern

```text
Topbar
Left sidebar
Page header with one primary action
KPI strip
Tabs or section navigation
Filter bar
Main operational table/workflow
Optional right rail for selected record or approval context
Sticky action bar only for multi-step receive/issue/stocktake/write-off workflows
```

Use the main web design plan for shared tokens, accessibility, loading/empty/error/permission/module-locked states, protected file actions, pagination, and high-risk confirmation behavior.

---

## 3. Navigation Placement

Recommended sidebar placement:

```text
School Operations
  Library
  Transport
  Canteen
  Inventory & Assets

Staff & Finance
  HR & Payroll
  Accounting
```

Inventory is a school operations module with finance/accounting handoff, not a replacement for M9 Accounting.

Recommended M13 sub-navigation:

```text
Inventory & Assets
  Overview
  Catalogue
  Stock
  Asset Register
  Requests
  Purchases
  Vendors
  Issue / Return
  Transfers
  Stocktake
  Maintenance
  Reports
  Settings
```

---

## 4. Route Map

```text
/dashboard/inventory
/dashboard/inventory/catalogue
/dashboard/inventory/stock
/dashboard/inventory/assets
/dashboard/inventory/requests
/dashboard/inventory/purchases
/dashboard/inventory/purchases/[purchaseId]
/dashboard/inventory/vendors
/dashboard/inventory/issue-return
/dashboard/inventory/transfers
/dashboard/inventory/stocktake
/dashboard/inventory/stocktake/[sessionId]
/dashboard/inventory/maintenance
/dashboard/inventory/reports
/dashboard/inventory/settings
```

Route names must follow existing app-router conventions if they differ. Unknown route/API shapes must be marked `needs OpenAPI confirmation`.

---

## 5. Overview Screen

**Main job:** show inventory health and the highest-priority actions.

Required composition:

```text
Header: Inventory & Asset Management
Purpose: Track school stock, purchases, assets, maintenance, and audit readiness.
Primary action: New Request or Receive Goods, depending on role.
KPI strip: Stock Value | Low Stock Items | Pending Requests | Assets Under Repair | Stocktake Variance
Attention strip: low stock, expired/lost/damaged, pending approvals, warranty expiry, failed handoff
Main: stock health, purchase queue, asset location summary, maintenance queue, recent movements
Right rail: selected alert / pending approval / accounting handoff status
```

KPI values, stock values, pending counts, variance, and accounting handoff states must come from backend summaries or show unavailable states.

---

## 6. Catalogue Screen

**Main job:** maintain item masters and category setup.

Required layout:

```text
Header: Catalogue
Primary action: Add Item
Secondary actions: Import Items | Export Catalogue | Print Labels
Tabs: Items | Categories | Units | Policies
Filters: Search | Category | Type | Status | Store | Controlled item
Main: server-paginated item table
Right rail: selected item metadata, stock summary, attachments, recent movement
```

Recommended columns:

```text
Item Code
Item Name
Category
Type
Unit
Reorder Level
Current Stock
Controlled
Status
Actions
```

Item type badges:

```text
Consumable
Distributable
Lab Supply
Sports Item
Equipment
Furniture
Transport Part
Infrastructure Asset
Donated Asset
```

---

## 7. Stock Workspace

**Main job:** inspect current stock by store, item, lot, and location.

Required controls:

```text
Filters: Store | Category | Item type | Low stock | Expired | Damaged | Location
Primary action: Adjust Stock only for authorized roles
Secondary: Transfer | Print Stock Sheet | Export
```

Stock rows must show:

```text
Item
Store/location
Available quantity
Reserved quantity
Low-stock threshold
Lot/batch where supported
Expiry where applicable
Last movement
Status
```

Status labels:

```text
In Stock
Low Stock
Out of Stock
Reserved
Expired
Damaged
Lost
Adjustment Pending
```

Do not calculate official stock totals in browser.

---

## 8. Asset Register

**Main job:** manage fixed assets and their lifecycle.

Required layout:

```text
Header: Asset Register
Primary action: Register Asset
Secondary actions: Print QR/Barcode | Export Register | Import Opening Assets
Filters: Asset type | Location | Custodian | Condition | Warranty | Status
Main: asset table
Right rail: asset card, documents, maintenance history, assignment, audit timeline
```

Recommended columns:

```text
Asset Tag
Asset Name
Category
Serial/Model
Location
Custodian
Condition
Warranty
Status
Actions
```

Lifecycle states:

```text
Active
Assigned
In Store
Under Repair
Damaged
Lost
Written Off
Disposed
Archived
```

High-risk actions such as mark lost, write off, dispose, or archive require confirmation, reason, permission, and audit.

---

## 9. Purchase Request and Approval Workbench

**Main job:** request, review, and approve purchases before procurement.

Required sections:

```text
Request queue
Approval queue
Quotation comparison
Budget/fiscal context where backend supports it
Audit timeline
```

Recommended request states:

```text
Draft
Submitted
Under Review
Approved
Rejected
Changes Requested
Cancelled
```

The approval drawer must show:

```text
Requester
Department/class/lab
Item and quantity
Need date
Estimated cost
Reason/use case
Attachments
Approval history
Approve / Reject / Request Changes actions
```

Principal/owner/SMC approval screens must avoid exposing raw accounting internals unless permission allows.

---

## 10. Purchase / GRN Workspace

**Main job:** receive purchased items safely and update stock through backend movements.

Required flow:

```text
Purchase Order
-> Receive Goods
-> Review bill/attachments
-> Accepted/rejected quantity
-> Confirm receive
-> Stock movement posted
-> Accounting handoff queued where configured
```

GRN screen must include:

```text
Vendor
Bill number
Bill date
PAN/VAT metadata
Received by
Items ordered / received / accepted / rejected
Condition notes
Attachment upload through File Registry
Posting confirmation
```

Partial receipt and rejected quantity must remain explicit; do not silently close the purchase order.

---

## 11. Issue / Return and Transfer

**Main job:** issue school items to the correct department/person/location and preserve movement history.

Recommended modes:

```text
Issue
Return
Transfer
Adjustment
```

Issue form requirements:

```text
Requester / recipient
Department / class / lab / store
Item search
Quantity
Purpose
Expected return date for reusable items
Approval state where required
Protected attachment where needed
Confirmation summary
```

Movement confirmation must show backend-authoritative quantities before submit.

---

## 12. Stocktake Workspace

**Main job:** count real stock/assets and reconcile variance safely.

Required stocktake flow:

```text
Plan stocktake
Select store/category/location
Generate count sheet or scanner session
Enter counted quantities
Review variance
Submit for approval
Approve adjustment
Close session
```

Stocktake states:

```text
Planned
Counting
Review
Approved
Adjusted
Closed
Cancelled
```

Variance table columns:

```text
Item/Asset
System quantity
Counted quantity
Variance
Reason
Reviewer note
Action
```

Stocktake must not auto-adjust official stock without approval.

---

## 13. Maintenance Workspace

**Main job:** track asset repair, warranty, and maintenance lifecycle.

Required screen sections:

```text
Open repair tickets
Warranty expiring
Assets under repair
Maintenance history
Vendor/technician notes
Approval queue for high-cost repair
```

Maintenance states:

```text
Reported
Approved
In Progress
Completed
Rejected
Cancelled
```

The asset right rail should show current availability impact: available, unavailable, under repair, replacement needed, or disposed.

---

## 14. Reports

Reports must use backend filters and queued export state where large.

Required report pages:

```text
Stock on Hand
Low Stock
Stock Movement Ledger
Purchase Request Status
Vendor Purchase Summary
Goods Received Report
Issue / Return Report
Asset Register
Asset by Location
Asset by Custodian
Warranty Expiry
Maintenance History
Lost / Damaged / Write-Off
Stocktake Variance
Donation / Grant Assets
Accounting Handoff Queue
```

Report toolbar must include:

```text
Date/fiscal year filter
Academic year filter where useful
Store/location/category filter
Export action
Queued/export status
Protected download
```

---

## 15. Visual Semantics

| State | Treatment |
|---|---|
| Available / received / completed | Green badge with explicit text. |
| Low stock / due soon / partial / pending approval | Orange badge with clear action. |
| Lost / damaged / rejected / blocked / failed | Red badge with safe explanation. |
| Under repair / review / queued handoff | Purple or blue badge with status text. |
| Archived / inactive | Grey badge and muted row treatment. |

Colour must never be the only meaning.

---

## 16. Required Screen States

Every M13 screen must handle:

```text
Loading
Empty
Error
Permission denied
Module locked
Validation
Partial failure
Queued job
File unavailable
Success
Conflict/stale data
```

Examples:

```text
No stock items found
Try changing filters or add a catalogue item.

You do not have permission to approve this purchase.
Please contact the school administrator if you need this access.

This stocktake changed after you opened it.
Refresh before approving adjustments.
```

---

## 17. Protected File UX

Protected documents include:

```text
Bills
Quotations
Purchase orders
GRNs
Warranty cards
Asset photos
Repair invoices
Stocktake sheets
Write-off approvals
Exported reports
Barcode/QR label PDFs
```

Use authenticated protected-file helpers only. Never expose object keys, permanent URLs, provider bucket paths, or raw signed URLs in UI state.

---

## 18. Mobile / Scanner Companion Direction

Mobile/scanner companion is later-stage unless explicitly approved.

Allowed future surfaces:

```text
Asset QR scan
Stocktake scan session
Issue/return scan helper
Receive goods scan helper
Maintenance photo upload
```

Mobile must remain role-limited and must not expose admin-wide inventory unless permission and module entitlement allow it.

---

## 19. Frontend Acceptance Checklist

1. No fake stock, asset, purchase, or valuation data.
2. All lists use server pagination/filtering for growing records.
3. Movement, receive, issue, transfer, adjustment, write-off, and stocktake approval show mutation pending/success/error states.
4. High-risk actions require confirmation and reason where policy requires it.
5. Protected files use File Registry-backed helpers.
6. Parent/student/driver routes do not expose inventory admin data.
7. Accounting handoff is shown as handoff state, not direct ledger mutation.
8. Module locked and permission-denied states fail closed.
9. Reports and exports use backend job state where large.
10. UI labels use school-friendly terms: stock, store, asset tag, issue, return, receive, stocktake, write-off.
