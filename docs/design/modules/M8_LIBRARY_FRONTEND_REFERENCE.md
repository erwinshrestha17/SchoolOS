# M8 Library — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M8 Library  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M8. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M8 Library is not only a book list. It is a complete school library operations module covering catalogue, physical copy lifecycle, issue/return, borrower rules, reservations, overdues, fines, lost/damaged cases, labels, reports, parent visibility, and scanner workflows.

Core flow:

```text
Catalogue
-> copy lifecycle
-> issue / return / renew
-> borrower policy validation
-> reservation / hold queue
-> overdue / fine calculation
-> lost / damaged / replacement workflow
-> reports / exports
-> parent child-scoped visibility
```

---

## 2. Theme and Layout Alignment

Use a counter-friendly operations workbench:

```text
ModuleHeader
Library KPI strip
Quick actions
Tabs
FilterBar
Catalogue/copy/circulation workspace
Right detail drawer
Scanner panel
Protected export/label actions
Audit timeline
```

Design rules:

- Keep title-level metadata separate from physical copy records.
- Scanner-first issue/return/renew should feel fast and resilient.
- Borrower eligibility must be visible before confirmation.
- Parent route must be child-scoped and simple.
- Fine and copy totals are backend-owned.
- Protected files, barcode sheets, QR labels, slips, and reports use authenticated helpers.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Librarian | Manage catalogue, copies, circulation, reservations, fines. | Tenant-scoped library permission. |
| Admin | Configure policy and high-risk actions. | Permission-gated. |
| Principal | View library health and overdue/fine summaries. | Summary/read-only unless permitted. |
| Teacher/staff borrower | Borrow/return where supported. | Own borrowing records where exposed. |
| Parent | View linked child borrowed books/fines. | Linked-child only. |
| Student | View own borrowed books where enabled. | Self only. |

---

## 4. Recommended Route Map

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
/student/library
/mobile/library-scanner
```

---

## 5. Required Screens

### 5.1 Library Dashboard

- KPI cards: total titles, total copies, issued today, overdue books, reservations pending, fine due, lost/damaged cases.
- Quick actions: Add Book, Issue Book, Return Book, Scan Barcode/QR, Manage Reservations, Export Report.
- Widgets: circulation snapshot, popular categories, recent activity, overdue alerts, reservations queue, fine collection summary.

### 5.2 Catalogue and Copies

- Catalogue table: cover, title, ISBN, author, publisher, category, shelf summary, total copies, available, issued, reserved, status.
- Copy table: copy ID, accession no., barcode, QR, shelf, rack, condition, status, borrower, last activity, acquisition date.
- Detail drawer for title/copy history, labels, shelf movement, archive/lost/damaged workflow.

### 5.3 Circulation / Scanner Workspace

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

Required areas:

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

### 5.4 Borrowers, Reservations, Fines, Lost/Damaged

- Borrower profile with eligibility, loans, overdues, fine due, reservations, history.
- Reservation queue with hold, pickup deadline, queue position, notification state.
- Fine/lost/damaged workflow with reason, confirmation, protected proof, audit trail.
- Manual queue/fine changes require reason and audit.

### 5.5 Parent / Student View

- Borrowed books.
- Due soon and overdue status.
- Fine due.
- Reservation status.
- Library policy.
- Protected notice/file access only where scoped.

Do not expose other borrowers, global reservation queue, staff borrowing, admin notes, accounting posting detail, or override notes.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Book title CRUD APIs
Book copy lifecycle APIs
Barcode/QR label generation APIs
Borrower lookup and eligibility APIs
Issue/return/renew idempotent workflows
Reservation and hold queue APIs
Overdue and fine calculation APIs
Lost/damaged/replacement workflows
Library report/export job APIs
Parent/student purpose-limited read APIs
File Registry for labels/slips/reports
M12 library notification events
Audit logs for override, waive, lost/damaged, archive, queue changes
```

Backend ownership rules:

- Borrower eligibility is backend-owned.
- Copy/fine totals are backend-owned.
- Fine calculations are backend-owned.
- Parent/student visibility is child/self-scoped by backend.
- Reports and labels use protected file/job flow.

---

## 7. Required States

```text
Loading
Empty catalogue
No search results
Scanner unavailable
Camera permission blocked
Unknown barcode
Duplicate scan
Borrower blocked
Copy unavailable
Policy missing
Override required
Issue pending
Return pending
Partial success
Reservation expired
Fine calculation unavailable
Export queued
File unavailable
Permission denied
Module locked
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Catalogue and copy records are clearly separated.
[ ] Scanner workflow validates borrower and copy before confirmation.
[ ] Borrower eligibility and policy state come from backend.
[ ] Fine and overdue calculations come from backend.
[ ] Parent/student views are child/self-scoped.
[ ] Reports/labels/slips use protected job/file helpers.
[ ] Override/waive/lost/damaged actions require reason and audit.
[ ] M12 library notifications are represented accurately.
[ ] No fake library metrics remain.
```
