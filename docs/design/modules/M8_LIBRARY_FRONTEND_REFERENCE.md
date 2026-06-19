# M8 Library Frontend Reference

**Status:** Active module-level frontend design reference for SchoolOS M8 Library.  
**Updated:** 2026-06-19  
**Scope:** SchoolOS web library dashboards and workspaces, parent child-scoped library view, and mobile scanner companion UX.  
**Primary consumers:** Web frontend implementers, mobile companion implementers, Codex agents, QA reviewers, and product/design reviewers.

This document replaces the obsolete `M8A_LIBRARY_FRONTEND_REFERENCE.md` numbering. Library is now **M8**, not M8A.

---

## 1. Product Intent

M8 Library is not only a book list. It is a complete school library operations module covering:

```text
Catalogue -> Copy lifecycle -> Issue/return -> Borrower policy -> Reservations -> Overdues/fines -> Lost/damaged cases -> Reports -> Parent visibility -> Mobile scanner
```

The frontend must feel like a fast library counter and inventory-control desk for real schools in Nepal while keeping official copy/fine/accounting truth backend-owned.

---

## 2. Non-Negotiable Frontend Rules

- Separate title-level metadata from physical copy-level records.
- Treat issue/return/renew as scanner-first workflows.
- Show borrower eligibility before confirming issue or renewal.
- Use backend summary, list, policy, and fine APIs as truth.
- Do not calculate official fines, borrower eligibility, accounting charges, or copy totals only in the browser.
- Use server-side pagination and filtering for catalogue, copies, borrowers, reservations, overdues, and reports.
- Parent routes must be child-scoped and purpose-limited.
- Override, waive, close, archive, lost/damaged, replacement, and accounting-link actions require permission-aware confirmation, reason where required, mutation state, and audit visibility.
- Protected files, exports, slips, barcode sheets, QR labels, and reports must use authenticated/protected file helpers.
- Scanner/mobile offline state must be explicit: pending sync, synced, failed, conflict, or review required.

---

## 3. Recommended Information Architecture

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

## 4. Recommended Route Map

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

### Mobile scanner surface

```text
/mobile/library-scanner
```

Use the final route shape from existing app conventions where they differ. Mark unknown route/API shape as `needs OpenAPI confirmation` instead of guessing.

---

## 5. Required Screens

### 5.1 Library Dashboard

Required sections:

- KPI cards: total titles, total copies, issued today, overdue books, reservations pending, fine due, lost/damaged cases.
- Quick actions: add book, issue book, return book, scan barcode/QR, manage reservations, export report.
- Operational widgets: circulation snapshot, popular categories, recent issue/return activity, overdue alerts, reservations queue, fine collection summary, lost/damaged workflow status.

### 5.2 Catalogue and Copy Management

Catalogue manages title metadata. Copies manage physical school-owned book copies.

Required title fields:

- title, subtitle, ISBN, author, publisher, category/subjects, language, edition, format, cover image, description, total/available/issued/reserved copy summary.

Required copy fields:

- copy ID, accession number, barcode, QR code, shelf, rack, condition, status, borrower if issued, acquisition date, price/supplier where allowed.

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

### 5.3 Scanner Workspace

Required modes:

```text
Issue
Return
Renew
```

Required layout:

- scanner/camera input area
- borrower lookup with Student/Staff toggle
- borrower eligibility card
- warnings/blockers
- scanned items session table
- latest scan activity
- policy summary
- sticky session actions

Blocking states must be explicit for fine threshold, overdue items, borrowing limit, already-issued copy, reserved copy, lost/damaged/archived copy, and override-required cases.

### 5.4 Borrowers, Reservations, Fines, Lost/Damaged

Required workflows:

- borrower eligibility and policy groups
- active loans and overdue lists
- reservation queue and pickup deadline
- holiday-aware fine breakdown
- waiver/replacement/case-closure workflow
- explicit fee/accounting linkage state without silent posting

### 5.5 Parent Library View

Parent can see only linked-child information:

- borrowed books
- due dates
- overdue status
- fine due
- reservation status
- due-soon reminders
- library notices
- library policy

Parent must not see other borrowers, staff borrowing, internal policy controls, audit trail, accounting posting details, or librarian override notes.

---

## 6. Required UX States

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

---

## 7. Permission Matrix

| Action | Librarian | Admin | Principal | Teacher | Parent |
|---|---:|---:|---:|---:|---:|
| View library dashboard | Yes | Yes | Summary | No | No |
| Add title | Yes | Yes | No | No | No |
| Add copy | Yes | Yes | No | No | No |
| Issue / return / renew | Yes | Yes | No | No | No |
| Override restriction | Limited | Yes | No | No | No |
| Waive fine | Limited | Yes | No | No | No |
| Post/link fee charge | Limited/No | Yes | Read-only | No | No |
| View reports | Yes | Yes | Yes | Limited | No |
| View child loans | No | No | No | No | Yes |
| Request child renewal | No | No | No | No | Yes |
| Pay child fine | No | No | No | No | Yes |

The UI may hide actions for clarity, but backend RBAC remains the authority.

---

## 8. Implementation Priority

1. Library shell, sidebar active state, KPI cards, quick actions, status badges, and shared table/drawer patterns.
2. Catalogue and copy management with strict title/copy separation.
3. Scanner-first issue/return/renew workspace with borrower eligibility and session state.
4. Borrower directory and policy controls.
5. Overdue/fine/lost/damaged workflows with audit-safe actions.
6. Reservations queue and hold fulfillment workflow.
7. Reports and async export jobs.
8. Parent child-scoped library portal.
9. Mobile scanner companion with offline sync and conflict states.

---

## 9. QA Checklist

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
