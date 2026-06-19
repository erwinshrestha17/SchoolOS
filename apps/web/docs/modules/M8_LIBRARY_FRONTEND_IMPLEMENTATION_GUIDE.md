# M8 Library Web Frontend Implementation Guide

**Status:** Active implementation guide for `apps/web`.  
**Updated:** 2026-06-19  
**Module:** M8 Library  
**Design reference:** `docs/design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md`

This guide replaces the obsolete `M8A_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md` numbering. Library is now **M8**, not M8A.

---

## 1. Implementation Goal

Build M8 Library as a real operations workspace, not a static dashboard.

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

Read these before touching M8 frontend code:

```text
apps/web/AGENTS.md
apps/web/docs/DESIGN_SYSTEM.md
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md
```

Also inspect:

```text
apps/web/app/dashboard/library/**
apps/web/components/**
apps/web/lib/api/library.ts
packages/core/** library contracts if present
OpenAPI/backend library routes if present
```

Unknown contracts must be marked as `needs OpenAPI confirmation` or `needs backend verification`.

---

## 3. Route Implementation Map

```text
/dashboard/library
/dashboard/library/catalogue
/dashboard/library/catalogue/[bookId]
/dashboard/library/catalogue/[bookId]/copies
/dashboard/library/copies
/dashboard/library/circulation
/dashboard/library/circulation/scanner
/dashboard/library/borrowers
/dashboard/library/borrowers/[borrowerId]
/dashboard/library/reservations
/dashboard/library/overdues
/dashboard/library/fines
/dashboard/library/lost-damaged
/dashboard/library/reports
/dashboard/library/settings
/parent/library
```

If parent routes are not yet available in web, keep them as documented targets and do not expose admin-shaped data to parents.

---

## 4. Data Truth Rules

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

The browser may format backend-provided values and perform local optimistic UI only where backend behavior is idempotent and confirmed.

---

## 5. Screen Implementation Requirements

### 5.1 Library Dashboard

- Backend-backed KPI cards: total titles, total copies, issued today, overdue books, reservations pending, fine due, lost/damaged cases.
- Quick actions: add book, issue book, return book, scan barcode/QR, manage reservations, export report.
- Widgets: circulation snapshot, popular categories/books, recent issue/return activity, overdue alerts, reservations queue, fine collection, lost/damaged workflow status, upcoming due dates.
- Use unavailable cards if a summary API is missing.

### 5.2 Catalogue and Copies

- Catalogue is title-level metadata.
- Copies are physical copy lifecycle records.
- Keep title and copy routes visually and contractually separate.
- Copy actions such as add, print barcode/QR, move shelf, mark lost/damaged, and archive must use backend mutations.

### 5.3 Circulation / Scanner Workspace

- Modes: issue, return, renew.
- Required areas: scanner mode tabs, barcode/QR scan area, borrower lookup, borrower eligibility card, warnings/blockers, scanned items table, latest scan activity, policy summary, session action bar.
- Do not confirm issue/return until backend validation passes.
- Preserve scanned session after recoverable row-level errors.

### 5.4 Borrowers, Fines, Reservations, Reports

- Borrower directory must show eligibility, policy group, active loans, overdues, fine due, and last activity from backend responses.
- Fines/lost/damaged workflows require confirmation, reason where required, pending/success/error state, and audit visibility.
- Reservation queue changes must require reason and audit trail.
- Reports use queued/protected job flow where backend requires it.

### 5.5 Parent Library View

Parent route must be child-scoped.

Allowed parent information:

```text
Borrowed books
Due soon
Overdue status
Fine due
Reservations
Library notices
Library policy
```

Do not show other borrowers, global reservation queue, staff borrowing, admin audit notes, accounting posting details, or override notes.

---

## 6. State Handling Checklist

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

---

## 7. Definition of Done

M8 frontend is done only when:

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
