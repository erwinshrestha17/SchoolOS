# M8A Library Frontend Reference

**Status:** Active design reference for SchoolOS Module 8A Library.  
**Updated:** 2026-06-19  
**Scope:** SchoolOS web library dashboards and workspaces, parent child-scoped library view, and mobile scanner companion UX.  
**Primary consumers:** Web frontend implementers, mobile companion implementers, Codex agents, QA reviewers, and product/design reviewers.

This document translates the Module 8A Library visual references into implementation-ready frontend guidance. It is planning and design guidance only. It must not be used to invent backend data, bypass permissions, or add browser-only production truth.

---

## 1. Product Intent

M8A Library is not only a book list. It is a complete school library operations module covering:

```text
Catalogue -> Copy lifecycle -> Issue/return -> Borrower policy -> Reservations -> Overdues/fines -> Lost/damaged cases -> Reports -> Parent visibility -> Mobile scanner
```

The frontend must feel like a **fast library counter and inventory control desk** for real schools in Nepal.

It must help librarians and admins answer:

```text
1. Which books/copies exist?
2. Which copies are available, issued, reserved, lost, damaged, or archived?
3. Who is allowed to borrow right now?
4. Which overdues/fines/cases need action?
5. Which reservations are waiting, ready, expiring, or fulfilled?
6. Which reports/exports are ready for review?
7. What can parents safely see for their own children only?
```

---

## 2. Non-Negotiable Frontend Rules

- Separate title-level metadata from physical copy-level inventory.
- Treat issue/return/renew as scanner-first, session-based workflows.
- Show borrower eligibility before confirming an issue or renewal.
- Use backend summary, list, and policy APIs as truth.
- Do not calculate official fines, borrower eligibility, accounting charges, or inventory totals only in the browser.
- Use server-side pagination and filtering for catalogue, copies, borrowers, reservations, overdues, and reports.
- Parent routes must be child-scoped and purpose-limited.
- Override, waive, close, archive, lost/damaged, replacement, and accounting-link actions require permission-aware confirmation, reason where required, mutation state, and audit visibility.
- Protected files, exports, slips, barcode sheets, QR labels, and reports must use authenticated/protected file helpers.
- Scanner/mobile offline state must be explicit: pending sync, synced, failed, conflict, or review required.

---

## 3. Core Visual System

The references use the standard SchoolOS operating-desk layout:

```text
Topbar
Left sidebar
Page header with title and purpose
KPI cards
Quick actions / tabs / filters
Dense but readable work table or workflow panel
Optional right-side selected-record rail
Footer timestamp in Nepal Time
```

### Colour semantics

| Colour family | Meaning |
|---|---|
| Blue | Primary action, active navigation, selected state, scanner focus. |
| Green | Available, eligible, issued/returned successfully, completed. |
| Orange | Warning, due soon, restricted, processing, replacement pending. |
| Red | Overdue, blocked, fine due, lost, destructive action. |
| Purple | Reservations, holds, waitlist, special workflow. |
| Grey | Archived, inactive, disabled, secondary state. |

Use colour as a semantic reinforcement, never as the only meaning. Every coloured state must also have a text label or icon.

---

## 4. Recommended Information Architecture

```text
Library
├── Dashboard
├── Catalogue
│   ├── Book Titles
│   ├── Metadata
│   ├── Categories
│   └── Publishers
├── Copies
│   ├── Copy List
│   ├── Shelf Map
│   ├── Barcode / QR Labels
│   └── Lifecycle History
├── Circulation
│   ├── Issue
│   ├── Return
│   ├── Renew
│   └── Scanner Workspace
├── Borrowers
│   ├── Student Borrowers
│   ├── Staff Borrowers
│   ├── Eligibility
│   └── Policy Groups
├── Reservations
│   ├── Active Holds
│   ├── Waitlist
│   ├── Ready for Pickup
│   └── Expired Holds
├── Overdues & Fines
│   ├── Overdue Items
│   ├── Fine Calculation
│   ├── Waivers
│   └── Fee Links
├── Lost / Damaged
│   ├── Lost Cases
│   ├── Damaged Cases
│   ├── Replacement
│   └── Case Closure
├── Reports
│   ├── Circulation
│   ├── Overdues
│   ├── Fines
│   ├── Popular Books
│   └── Export Jobs
└── Settings
    ├── Library Policy
    ├── Fine Rules
    ├── Holiday Calendar
    ├── Barcode / QR Settings
    └── Notification Rules
```

---

## 5. Recommended Route Map

### Admin / librarian web routes

```text
/dashboard/library
/dashboard/library/catalogue
/dashboard/library/catalogue/:bookId
/dashboard/library/catalogue/:bookId/copies
/dashboard/library/copies
/dashboard/library/circulation
/dashboard/library/circulation/scanner
/dashboard/library/borrowers
/dashboard/library/borrowers/:borrowerId
/dashboard/library/reservations
/dashboard/library/overdues
/dashboard/library/fines
/dashboard/library/lost-damaged
/dashboard/library/reports
/dashboard/library/settings
```

### Parent portal routes

```text
/parent/library
/parent/library/borrowed
/parent/library/reservations
/parent/library/fines
/parent/library/policy
```

### Mobile scanner route / surface

```text
/mobile/library-scanner
```

Use the final route shape from existing app conventions where they differ. Mark unknown route/API shape as `needs OpenAPI confirmation` instead of guessing.

---

## 6. Screen Reference Requirements

### 6.1 Library Dashboard Overview

Purpose: executive and librarian command center.

Required sections:

- KPI cards:
  - Total Titles
  - Total Copies
  - Issued Today
  - Overdue Books
  - Reservations Pending
  - Fine Due
  - Lost/Damaged Cases
- Quick actions:
  - Add Book
  - Issue Book
  - Return Book
  - Scan Barcode/QR
  - Manage Reservations
  - Export Report
- Operational widgets:
  - Circulation Snapshot
  - Popular Categories
  - Popular Books
  - Recent Issue/Return Activity
  - Overdue Alerts
  - Reservations Queue
  - Fine Collection Summary
  - Lost/Damaged Workflow Status
  - Upcoming Due Dates

Dashboard cards should click into filtered workspaces where backend supports deep links. If a summary endpoint is missing, show a friendly unavailable state rather than fake counts.

Role-specific emphasis:

| Role | Dashboard focus |
|---|---|
| Librarian | Issue/return, overdue alerts, reservations, scanner actions. |
| Admin | Reports, fines, lost/damaged cases, policy controls. |
| Principal | Summary KPIs, high-risk backlog, usage and collection trends. |
| Teacher | Staff borrowing and due reminders only where allowed. |
| Parent | No admin dashboard; use child-scoped parent library view only. |

---

### 6.2 Book Catalogue & Metadata Management

Purpose: title-level catalogue and metadata management.

This screen manages book-title metadata. Do not treat each row as a physical copy.

Required title fields:

- Title and subtitle
- ISBN
- Author
- Publisher
- Category / subjects
- Language
- Edition
- Format
- Pages
- Cover image
- Description
- Total copies summary
- Available / issued / reserved copy summary
- Title status

Required controls:

- Search by title, ISBN, author.
- Filters for category, publisher, language, shelf, status, branch.
- Advanced filters.
- Add title.
- Import books.
- Export catalogue.
- Print labels.
- Table pagination.
- Selected title right rail.

Right rail must show:

- Cover and metadata.
- Description.
- Subjects/categories.
- Shelf location summary.
- Copy summary.
- Barcode/QR preview where backend supports it.
- Actions: View Copies, Edit Metadata, Add Copy, Archive Title.

---

### 6.3 Book Copy Management & Lifecycle

Purpose: physical copy inventory and lifecycle state.

Each copy is an individual school asset. Required copy fields:

- Copy ID
- Accession number
- Barcode
- QR code
- Shelf
- Rack
- Condition
- Status
- Current borrower if issued
- Last activity
- Acquisition date
- Price/supplier where allowed

Required actions:

- Add Copy
- Print Barcode
- Print QR
- Move Shelf
- Mark Lost
- Mark Damaged
- Archive Copy

Recommended copy statuses:

```text
AVAILABLE
ISSUED
RESERVED
LOST
DAMAGED
ARCHIVED
UNDER_REPAIR
REPLACEMENT_PENDING
```

Recommended copy conditions:

```text
NEW
GOOD
FAIR
POOR
DAMAGED
LOST
```

The selected-copy rail should show status, accession number, barcode, QR code, shelf/rack, condition, acquisition details, copy history, and archive workflow notes.

Lifecycle timeline events should include:

```text
Added
Issued
Returned
Renewed
Moved shelf
Marked damaged
Marked lost
Fine created
Replacement received
Archived
```

---

### 6.4 Issue / Return Scanner Workspace

Purpose: fast counter workflow for issue, return, and renewal.

Required modes:

```text
Issue
Return
Renew
```

Required layout:

- Large scanner drop zone / camera scan area.
- Borrower lookup with Student/Staff toggle.
- Borrower card with eligibility.
- Borrower alerts.
- Scanned items session table.
- Latest scan activity panel.
- Circulation policy summary.
- Sticky session actions.

Recommended session state:

```ts
LibraryScanSession {
  mode: 'issue' | 'return' | 'renew';
  borrower?: BorrowerSummary;
  scannedCopies: ScannedCopy[];
  warnings: LibraryWarning[];
  blockingErrors: LibraryBlocker[];
  overrideReason?: string;
  sessionStatus: 'idle' | 'ready' | 'blocked' | 'confirming' | 'pending' | 'success' | 'error';
}
```

Blocking states to display clearly:

| Condition | UX behavior |
|---|---|
| Borrower has fine above policy threshold | Red alert; block unless override permission exists. |
| Borrower has overdue item | Warning or blocker depending on policy. |
| Borrowing limit reached | Block issue. |
| Copy already issued | Block issue. |
| Copy reserved by another borrower | Block or require override. |
| Copy lost/damaged/archived | Block. |
| Staff override allowed | Require reason and audit trail. |

Keyboard-first behavior:

- `/` focuses search where available.
- Scanner input auto-focuses after each successful scan.
- `Enter` confirms a valid scan row where safe.
- `Esc` exits transient modal or clears local scan input.
- `Cmd/Ctrl + Enter` may confirm issue/return only after explicit review state.

---

### 6.5 Borrower Directory & Policy Controls

Purpose: borrower eligibility, limits, active loans, fines, restrictions, and policy groups.

Borrower types:

```text
Student
Staff
```

Required borrower list columns:

- Name and ID
- Role
- Class/section or department
- Borrowed books
- Overdues
- Fine due
- Eligibility
- Policy group
- Last activity
- Actions

Right rail should show:

- Borrower profile.
- Blocked/restricted/eligible state.
- Current loans.
- Overdues.
- Fine due.
- Reservations.
- Fine history.
- Quick actions.

Recommended policy fields:

```text
maxBooks
loanPeriodDays
renewalLimit
fineRatePerDay
gracePeriodDays
fineCap
lostBookFee
allowReservations
blockIfFineAbove
blockIfAnyOverdue
requiresIdVerification
```

Policy changes should be version-aware. Loans already issued should continue using the effective policy snapshot from issue time unless backend explicitly supports recalculation.

---

### 6.6 Overdues, Fines & Lost/Damaged Workflow

Purpose: manage overdue calculations, lost/damaged cases, replacement status, and fee/accounting linkage.

Required tabs:

```text
All
Overdue
Lost
Damaged
Replacement
```

Required case columns:

- Borrower
- Book
- Copy ID
- Due date
- Days overdue
- Fine rate
- Calculated fine
- Case type
- Workflow status
- Linked charge
- Actions

Right rail should show:

- Case ID.
- Borrower and book summary.
- Due date and days overdue.
- Calculated fine.
- Linked charge status.
- Case details.
- Holiday-aware fine breakdown.
- Replacement/damage details.
- Audit notes.
- Audit trail.
- Case actions.

Fine calculation display should include:

```text
Due Date
Return Date
Total Calendar Days
Grace Days
Excluded Holidays
Billable Days
Fine Rate
Calculated Fine
Fine Cap Applied
Final Fine
```

Accounting linkage should be explicit:

```text
Fine calculated -> Librarian review -> Create fee charge -> Accounting linked -> Payment received -> Case closed
```

Do not silently post fines to accounting.

Recommended accounting/fine states:

| State | Meaning |
|---|---|
| No Charge | Fine exists but is not posted. |
| Pending Posting | Charge generation requested. |
| Linked to Fee Module | Student fee charge exists. |
| Posted to Accounting | Ledger entry exists. |
| Paid | Payment received. |
| Waived | Fine removed with reason. |
| Closed | Case resolved and archived from active work queue. |

---

### 6.7 Reservations & Holds Queue

Purpose: hold requests, waitlists, pickup windows, availability, and notifications.

Required KPIs:

- Active Reservations
- Ready for Pickup
- Expiring Holds
- Average Wait Time
- High-Demand Titles

Required list fields:

- Borrower
- Title
- Copy/edition
- Requested on
- Queue position
- Availability
- Pickup deadline
- Notification status
- Status
- Actions

Right rail should show:

- Borrower details.
- Reservation details.
- Waitlist timeline.
- Related title availability.
- Next available copy.
- Borrower contact.
- Actions.

Recommended reservation statuses:

```text
WAITING
READY_FOR_PICKUP
NOTIFIED
PICKED_UP
EXPIRED
CANCELLED
IN_TRANSIT
FULFILLED
```

Required actions:

- Fulfill Hold / Checkout.
- Assign Copy to Another.
- Notify Borrower.
- Extend Pickup Window.
- Cancel Reservation.

Manual queue changes must be audited with old position, new position, actor, timestamp, and reason.

---

### 6.8 Library Reports & Exports

Purpose: report analysis and export-ready library data.

Required report areas:

- Issued books.
- Overdue books.
- Lost/damaged cases.
- Popular books.
- Fines.
- Exports.

Filters:

- Date range.
- Class/section.
- Borrower type.
- Category.
- Report type.

Export behavior:

```text
Requested -> Processing -> Completed -> Download available -> Expired
```

Large reports must use asynchronous export jobs, not direct browser-generated downloads.

Recommended report types:

```text
Issued Books Report
Returned Books Report
Overdue Books Report
Fine Collection Report
Lost/Damaged Report
Reservation Report
Popular Titles Report
Borrower Activity Report
Copy Lifecycle Report
Stock Availability Report
Archived Copies Report
```

---

### 6.9 Parent Portal Library View

Purpose: parent-friendly, child-scoped visibility into borrowed books, due dates, reservations, and fines.

Parent can see:

- Borrowed books for selected child.
- Due dates.
- Overdue books.
- Fine due.
- Reservation status.
- Due soon reminders.
- Fine summary.
- Library notices.
- Library policy.

Parent should not see:

- Other students' reservations.
- Full borrower directory.
- Staff borrowing.
- Internal policy controls.
- Audit trail.
- Accounting posting details.
- Librarian override notes.

Allowed parent actions where backend supports them:

```text
Request Renewal
Pay Fine
View Fine Breakdown
View Library Policy
Contact Librarian
View Reservation Status
```

Never expose exact queue details of other students.

---

### 6.10 Mobile Library Scanner

Purpose: fast, offline-aware librarian companion scanner.

Primary mobile uses:

- Quick issue/return/renew.
- Classroom book collection.
- Library stock check.
- Shelf audit.
- Book fairs/events.
- Temporary low-connectivity operation.

Required mobile scanner states:

```text
LOCAL_RECORDED
SYNC_PENDING
SYNCED
SYNC_FAILED
CONFLICT
RETRY_REQUIRED
```

Conflict examples:

| Conflict | UX handling |
|---|---|
| Copy already issued by another device | Show conflict and route to review/cancel. |
| Borrower became blocked before sync | Require librarian review. |
| Fine changed before sync | Recalculate on backend or flag for review. |
| Reservation exists for scanned copy | Require override/review. |
| Duplicate scan | Ignore, merge, or show duplicate warning. |

Mobile must show online/offline state, session log, retry-safe status, last synced time, and clear next action.

---

## 7. Shared Components Required

Core components:

```text
KpiCard
QuickActionCard
DataTable
FilterBar
SearchInput
StatusBadge
MetricBadge
RightDetailPanel
DonutChart
BarProgressList
Timeline
AuditTrail
ActionButtonGroup
EmptyState
LoadingSkeleton
ConfirmDialog
OverrideReasonModal
ExportJobStatus
```

Library-specific components:

```text
BookCoverThumb
BookMetadataCard
CopyStatusBadge
BorrowerEligibilityBadge
FineBreakdownCard
ReservationTimeline
ScannerWorkspace
PolicySummaryCard
ShelfMap
BarcodePreview
QRCodePreview
BorrowerCard
DueDateCard
```

Do not duplicate primitives that already exist under shared web components.

---

## 8. Required Data Shapes for Frontend Planning

These are frontend planning shapes, not final API contracts.

```ts
type BookTitleStatus = 'ACTIVE' | 'LOW_STOCK' | 'ARCHIVED';

type BookTitle = {
  id: string;
  title: string;
  subtitle?: string;
  isbn?: string;
  author: string;
  publisher?: string;
  category: string;
  language?: string;
  edition?: string;
  format?: string;
  pages?: number;
  description?: string;
  coverUrl?: string;
  status: BookTitleStatus;
};
```

```ts
type BookCopy = {
  id: string;
  bookTitleId: string;
  accessionNo: string;
  barcode: string;
  qrCode: string;
  shelf: string;
  rack: string;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | 'LOST';
  status: 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'LOST' | 'DAMAGED' | 'ARCHIVED';
  borrowerId?: string;
  acquiredOn?: string;
  price?: number;
  supplier?: string;
};
```

```ts
type Borrower = {
  id: string;
  type: 'STUDENT' | 'STAFF';
  name: string;
  className?: string;
  section?: string;
  department?: string;
  photoUrl?: string;
  activeLoans: number;
  overdueItems: number;
  fineDue: number;
  eligibility: 'ELIGIBLE' | 'RESTRICTED' | 'BLOCKED';
  policyGroupId: string;
};
```

```ts
type Loan = {
  id: string;
  copyId: string;
  borrowerId: string;
  issuedAt: string;
  dueAt: string;
  returnedAt?: string;
  renewalCount: number;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'LOST' | 'DAMAGED';
  fineAmount?: number;
};
```

```ts
type Reservation = {
  id: string;
  bookTitleId: string;
  borrowerId: string;
  queuePosition: number;
  status: 'WAITING' | 'READY_FOR_PICKUP' | 'NOTIFIED' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
  requestedAt: string;
  pickupDeadline?: string;
  assignedCopyId?: string;
};
```

```ts
type LibraryFineCase = {
  id: string;
  loanId: string;
  borrowerId: string;
  caseType: 'OVERDUE' | 'LOST' | 'DAMAGED' | 'REPLACEMENT';
  calculatedFine: number;
  finalFine: number;
  status: 'FINE_DUE' | 'WAIVED' | 'PAID' | 'POSTED_TO_ACCOUNTING' | 'CLOSED';
  linkedChargeId?: string;
};
```

---

## 9. Required UX States

Every Library screen must handle:

```text
Loading
Empty
No search results
Permission denied
Module locked
Scanner unavailable
Camera permission blocked
Offline mode
Sync pending
Sync conflict
Fine calculation unavailable
Export queued
Export processing
Export failed
Reservation expired
Copy unavailable
Borrower blocked
Policy missing
Accounting link failed
Partial success
```

Example empty state:

```text
No overdue books found.
All active borrowers are within the allowed return period.
```

Example blocked state:

```text
Issue blocked.
This borrower has NPR 120 overdue fine and 1 overdue item.
Override requires librarian permission and reason.
```

---

## 10. Permission Matrix

| Action | Librarian | Admin | Principal | Teacher | Parent |
|---|---:|---:|---:|---:|---:|
| View library dashboard | Yes | Yes | Summary | No | No |
| Add title | Yes | Yes | No | No | No |
| Add copy | Yes | Yes | No | No | No |
| Issue / return / renew | Yes | Yes | No | No | No |
| Override restriction | Limited | Yes | No | No | No |
| Waive fine | Limited | Yes | No | No | No |
| Post to accounting | Limited/No | Yes | Read-only | No | No |
| View reports | Yes | Yes | Yes | Limited | No |
| View child loans | No | No | No | No | Yes |
| Request child renewal | No | No | No | No | Yes |
| Pay child fine | No | No | No | No | Yes |

The UI may hide actions for clarity, but backend RBAC remains the authority.

---

## 11. Implementation Priority

1. Library shell, sidebar active state, topbar consistency, KPI cards, quick actions, status badges, and shared table/drawer patterns.
2. Catalogue and copy management with strict title/copy separation.
3. Scanner-first issue/return/renew workspace with borrower eligibility and session state.
4. Borrower directory and policy controls.
5. Overdue/fine/lost/damaged workflows with audit-safe actions.
6. Reservations queue and hold fulfillment workflow.
7. Reports and async export jobs.
8. Parent child-scoped library portal.
9. Mobile scanner companion with offline sync and conflict states.

---

## 12. QA Checklist

- Catalogue totals come from backend summary/list metadata.
- Copy statuses are not inferred from title counts alone.
- Issue is blocked when policy says borrower is not eligible.
- Return updates scanned item state only after backend confirmation.
- Renewal respects policy and reservation constraints.
- Override requires permission and reason.
- Fine breakdown is displayed from backend calculation response.
- Waive/mark paid/create charge/post accounting actions have confirmation and mutation states.
- Reservation queue changes are audited.
- Parent view is child-scoped.
- Exports show job status and protected download behavior.
- Mobile scanner shows sync pending/synced/failed/conflict states.
- No fake production metrics or placeholder library data remain in implemented routes.
