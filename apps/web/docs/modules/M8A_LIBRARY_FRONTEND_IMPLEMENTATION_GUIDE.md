# M8A Library Web Frontend Implementation Guide

**Status:** Active implementation guide for `apps/web`.  
**Updated:** 2026-06-19  
**Module:** M8A Library  
**Design reference:** `docs/design/modules/M8A_LIBRARY_FRONTEND_REFERENCE.md`

Use this guide when implementing or reviewing the SchoolOS Library frontend. It converts the visual references into practical web route, component, state, and QA requirements.

---

## 1. Implementation Goal

Build M8A Library as a real operations workspace, not a static dashboard.

The module must support:

```text
Dashboard overview
Book catalogue and title metadata
Physical copy lifecycle
Scanner-first issue/return/renew
Borrower directory and policy controls
Reservations and holds queue
Overdues, fines, lost/damaged, replacement workflow
Reports and async exports
Parent child-scoped borrowed-books view
Mobile scanner companion alignment
```

Do not add fake data or browser-only official calculations to make the screens look complete. If an API is missing, show a safe unavailable state and mark the gap.

---

## 2. Required Reading Before Coding

Read these before touching M8A frontend code:

```text
apps/web/AGENTS.md
apps/web/docs/DESIGN_SYSTEM.md
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/design/modules/M8A_LIBRARY_FRONTEND_REFERENCE.md
```

Also inspect existing code for:

```text
apps/web/app/dashboard/library/**
apps/web/components/**
apps/web/lib/api/library.ts
packages/core/** library contracts if present
OpenAPI/backend library routes if present
```

If contracts are unclear, mark the implementation note as:

```text
needs OpenAPI confirmation
```

or:

```text
needs backend verification
```

---

## 3. Route Implementation Map

Prefer the final app routing conventions already used in `apps/web`. The target module shape is:

```text
/dashboard/library                         Library dashboard
/dashboard/library/catalogue               Book title catalogue
/dashboard/library/catalogue/[bookId]      Book title detail where full page is needed
/dashboard/library/catalogue/[bookId]/copies Copy list scoped to a title
/dashboard/library/copies                  Copy inventory
/dashboard/library/circulation             Issue/return/renew workspace
/dashboard/library/circulation/scanner     Scanner-first counter route if split from circulation
/dashboard/library/borrowers               Borrower directory and policy summary
/dashboard/library/borrowers/[borrowerId]  Borrower detail where needed
/dashboard/library/reservations            Reservations and holds queue
/dashboard/library/overdues                Overdues work queue
/dashboard/library/fines                   Fines and fee-link workflow
/dashboard/library/lost-damaged            Lost/damaged/replacement cases
/dashboard/library/reports                 Reports and export jobs
/dashboard/library/settings                Library policies, fines, barcode/QR, notifications
```

Parent route target:

```text
/parent/library
```

If parent routes are not yet available in web, keep this as a documented target and do not expose admin-shaped data to parents.

---

## 4. Shared Page Shell

Every admin Library route should use the same shell rhythm:

```text
PageHeader
KpiGrid / SummaryStrip
QuickActions or Tabs
FilterBar
Main table/workspace
RightDetailPanel where selected row context matters
Footer timestamp / last updated where API provides it
```

Header rules:

- One primary action per route.
- Put secondary actions such as import, export, print labels, and settings under `More Actions` where possible.
- Destructive actions are never primary header CTAs.
- High-risk actions require confirmation and reason where policy requires it.

---

## 5. Component Plan

### 5.1 Shared components to reuse or create once

```text
LibraryKpiCard
LibraryQuickActionCard
LibraryStatusBadge
LibraryFilterBar
LibraryDataTable
LibraryRightPanel
LibraryAuditTimeline
LibraryConfirmDialog
LibraryOverrideReasonDialog
LibraryExportJobStatus
```

Prefer existing primitives from `/components/ui` and existing SchoolOS table/drawer components before adding new library-specific wrappers.

### 5.2 Library-specific components

```text
BookCoverThumb
BookMetadataSummary
BookCopySummaryCards
CopyStatusBadge
CopyConditionBadge
BorrowerEligibilityBadge
BorrowerLibraryCard
ScannerModeTabs
ScannerDropZone
ScannedItemsTable
BorrowerAlerts
LibraryPolicySummary
FineBreakdownCard
ReservationTimeline
ShelfMap
BarcodePreview
QrCodePreview
ParentLibrarySummary
```

---

## 6. API Integration Rules

Use a module-owned API client where possible:

```text
apps/web/lib/api/library.ts
```

Expected API groups:

```text
getLibraryDashboardSummary
listBookTitles
getBookTitle
createBookTitle
updateBookTitle
archiveBookTitle
listBookCopies
getBookCopy
createBookCopy
updateBookCopyLocation
markCopyLost
markCopyDamaged
archiveBookCopy
lookupBorrower
listBorrowers
getBorrowerLibraryProfile
getLibraryPolicies
startScanSession / validateScan / confirmIssue / confirmReturn / confirmRenew
listReservations
fulfillReservation
notifyReservationBorrower
extendReservationPickupWindow
cancelReservation
listOverdueCases
getFineCase
waiveFine
markFinePaid
createFeeCharge
postFineToAccounting
listLibraryReports
requestLibraryExport
getLibraryExportJob
getParentChildLibrarySummary
requestParentRenewal
```

These names are planning names only. Use actual backend/OpenAPI names when available.

---

## 7. Data Truth Rules

Never compute these as official browser truth:

```text
Total titles
Total copies
Available copies
Issued count
Overdue count
Fine due
Borrower eligibility
Borrowing limits
Fine calculations
Holiday-aware billable days
Accounting posting state
Reservation queue position
Export completion state
```

The browser may format backend-provided values and perform local optimistic UI only where backend behavior is idempotent and already confirmed.

---

## 8. Screen Implementation Requirements

### 8.1 Library Dashboard

Implement as a dashboard with backend-backed summary cards and actionable widgets.

Required cards:

```text
Total Titles
Total Copies
Issued Today
Overdue Books
Reservations Pending
Fine Due
Lost/Damaged Cases
```

Required widgets:

```text
Circulation Snapshot
Popular Categories
Popular Books
Recent Issue & Return Activity
Overdue Alerts
Reservations Queue
Fine Collection Summary
Lost/Damaged Workflow Status
Upcoming Due Dates
```

Rules:

- Widget click-through should preserve status/date filters where supported.
- Use unavailable cards if a summary API is missing.
- Use role-safe data shaping.

---

### 8.2 Catalogue

Implement title-level metadata management.

Required table columns:

```text
Cover
Title
ISBN
Author
Publisher
Category
Shelf summary
Total copies
Available
Issued
Reserved
Status
Actions
```

Required filters:

```text
Search
Category
Publisher
Language
Shelf
Status
Branch
Advanced filters
```

Selected-title rail:

```text
Cover
Title/subtitle
ISBN
Author
Publisher
Language
Edition
Format
Pages
Status
Description
Subjects/categories
Shelf location summary
Copy summary
Barcode/QR preview
Quick actions
```

Actions:

```text
View Copies
Edit Metadata
Add Copy
Archive Title
```

---

### 8.3 Copies

Implement physical copy lifecycle management.

Required table columns:

```text
Copy ID
Accession No.
Barcode
QR Code
Shelf
Rack
Condition
Status
Borrower
Last Activity
Acquisition Date
Actions
```

Required actions:

```text
Add Copy
Print Barcode
Print QR
Move Shelf
Mark Lost
Mark Damaged
Archive Copy
```

Selected-copy rail:

```text
Status
Accession number
Barcode
QR code
Shelf/rack
Condition
Acquisition details
Copy history
Archive workflow notes
```

Implement shelf map and condition summary only from backend-provided copy inventory data.

---

### 8.4 Circulation / Scanner Workspace

Implement as a session workflow.

Session model:

```text
mode: issue | return | renew
borrower
scannedCopies[]
warnings[]
blockingErrors[]
overrideReason
sessionStatus
```

Required screen areas:

```text
Scanner mode tabs
Barcode/QR scan area
Borrower lookup
Borrower eligibility card
Borrower alerts
Scanned items table
Latest scan activity
Policy summary
Session action bar
```

Required actions:

```text
Confirm Issue
Confirm Return
Override With Reason
Print Slip
Clear Session
```

Blocking states:

```text
Borrower blocked
Fine above threshold
Overdue item exists
Borrowing limit reached
Copy already issued
Copy reserved by another borrower
Copy lost/damaged/archived
Unknown barcode/QR
Scanner unavailable
```

Keyboard/scanner behavior:

- Keep scanner input focused after successful scan.
- Permit manual keyboard entry for barcode/copy ID.
- Do not confirm issue/return until backend validation passes.
- Preserve scanned session when a row-level error occurs.
- Show partial success if backend confirms some rows and rejects others.

---

### 8.5 Borrowers and Policy Controls

Required borrower table columns:

```text
Name
Role
Class/Department
Borrowed Books
Overdues
Fine Due
Eligibility
Policy Group
Last Activity
Actions
```

Required selected borrower panel:

```text
Profile
Eligibility / blocked reason
Current loans
Overdues
Fine due
Reservations
Fine history
Quick actions
```

Policy summary sections:

```text
Students - Standard
Staff - Standard
Restriction Rules
```

Rules:

- Student/staff policies may differ.
- Do not expose unrelated student profile data.
- Fine and restriction actions require permission-aware controls.

---

### 8.6 Overdues, Fines, Lost/Damaged

Required tabs:

```text
All
Overdue
Lost
Damaged
Replacement
```

Required case table columns:

```text
Borrower
Book
Copy ID
Due Date
Days Overdue
Fine Rate
Calculated Fine
Case Type
Workflow Status
Linked Charge
Actions
```

Selected case panel:

```text
Case ID
Borrower summary
Book/copy summary
Due date
Days overdue
Calculated fine
Linked charge state
Case details
Holiday-aware fine breakdown
Replacement/damage details
Audit notes
Audit trail
Actions
```

High-risk actions:

```text
Waive Fine
Mark Paid
Create Fee Charge
Post to Accounting
Mark Replaced
Close Case
```

Each high-risk action needs:

```text
confirmation
reason where required
pending state
success/error state
audit visibility
refetch/invalidate
```

---

### 8.7 Reservations and Holds

Required table columns:

```text
Borrower
Title
Copy/Edition
Requested On
Queue Position
Availability
Pickup Deadline
Notification Status
Status
Actions
```

Selected reservation panel:

```text
Borrower details
Reservation details
Waitlist timeline
Related title availability
Next available copy
Borrower contact
Actions
```

Actions:

```text
Fulfill Hold / Checkout
Assign Copy to Another
Notify Borrower
Extend Pickup Window
Cancel Reservation
```

Manual queue changes must require reason and audit trail. Do not expose queue details to parent users beyond their own child status.

---

### 8.8 Reports and Exports

Required filters:

```text
Date Range
Class / Section
Borrower Type
Category
Report Type
```

Required report tabs:

```text
Issued Books
Overdue Books
Lost/Damaged
Popular Books
Fines
Exports
```

Export behavior:

```text
request -> queued/processing -> completed/failed -> protected download
```

Do not generate official reports purely in browser for large or official exports.

---

### 8.9 Parent Library View

Parent route must be child-scoped.

Required sections:

```text
Child selector
Borrowed Books
Due Soon
Overdue
Fine Due
Reservations
Due soon reminder
Borrowed books table
Upcoming due dates
Reservation status
Fine summary
Library notices
Library policy CTA
```

Allowed actions where backend supports them:

```text
Request Renewal
Pay Fine
View Details
View Policy
```

Do not show:

```text
Other borrowers
Global reservation queue
Staff borrowing
Admin audit notes
Accounting posting details
Override notes
```

---

## 9. State Handling Checklist

Every Library route must implement:

```text
loading skeleton
empty state
no search results
error with retry
permission denied
module locked
mutation pending
mutation success
mutation error
partial success
queued export
file unavailable
```

Scanner-specific states:

```text
scanner unavailable
camera permission blocked
unknown barcode
duplicate scan
borrower missing
borrower blocked
copy unavailable
policy missing
override required
```

Mobile/offline-aligned states:

```text
sync pending
synced
sync failed
conflict
retry required
review required
```

---

## 10. Permission and Audit Rules

Permission-sensitive actions must render as one of:

```text
enabled
hidden because irrelevant
disabled with safe explanation
visible read-only because role lacks permission
```

Actions that must be audited:

```text
Override restriction
Waive fine
Mark paid
Create fee charge
Post to accounting
Mark lost
Mark damaged
Mark replaced
Archive title
Archive copy
Change reservation queue position
Cancel reservation
Extend pickup window
Change library policy
```

Never rely on frontend hiding as security.

---

## 11. Responsive Rules

Desktop reference screens are dense operating workspaces. Preserve the primary job first.

| Viewport | Behavior |
|---|---|
| >= 1440px | Sidebar, main workspace, and right rail can be visible together. |
| 1180-1439px | Keep main table/workflow visible; right rail can become drawer. |
| < 1180px | Stack KPIs, collapse filters, use drawer/detail pages for selected record. |
| High zoom / narrow | Use horizontal table containment and column priority; do not crush columns. |

Tables should support column priority and horizontal containment where needed.

---

## 12. QA / Smoke Test Targets

### Admin / librarian smoke

```text
Open library dashboard
Open catalogue and search title
Select title and view details rail
Open copies for selected title
Select copy and view lifecycle rail
Open circulation scanner
Lookup borrower
Scan copy
See eligibility and policy summary
Confirm issue or see blocked state
Open overdues/fines
Select case and view fine breakdown
Open reservations
Select reservation and view timeline
Request report export and see queued/completed state
```

### Parent smoke

```text
Open parent library page
Switch child where multiple children exist
View borrowed books
View overdue/due soon card
Request renewal where eligible
View fine summary
Open policy
Confirm no other child/student/global library data appears
```

### Negative cases

```text
Borrower blocked
Borrowing limit reached
Copy unavailable
Reservation conflict
Fine API unavailable
Export fails
Protected file unavailable
Permission denied for waive/post/accounting actions
```

---

## 13. Implementation Done Definition

M8A frontend is done only when:

- Title catalogue and copy inventory are clearly separated.
- Scanner workflow validates borrower and copy before confirmation.
- Borrower eligibility and policy state are visible.
- Overdues, fines, lost/damaged, and replacements have safe lifecycle states.
- Reservation queue is actionable and audited where changed.
- Parent library view is child-scoped.
- Reports use backend job/protected download patterns.
- Loading, empty, error, permission, locked, and partial-success states exist.
- No fake library production metrics are present.
- QA smoke covers librarian/admin and parent flows.
