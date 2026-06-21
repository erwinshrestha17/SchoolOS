# M8 Library — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-21
**Module:** M8 Library
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M8 manages catalogue records, physical copies, scanner-first circulation, borrowers, reservations, overdues/fines, losses/damage, labels, and reports.

It gives a school library reliable copy-level truth and a fast counter workflow instead of treating a title as an available physical book.

For Nepal schools, it must support practical barcode/QR labels, student/staff borrower identifiers, class/section/roll lookup, local-language titles, modest hardware, and school-defined fine policies.

---

## 2. Full Feature List

### Library dashboard

**Purpose:**
Shows circulation, availability, due/overdue, reservations, exceptions, and scanner readiness.

**Users:**
Librarian and admin.

**Frontend behavior:**
Backend KPI strip and attention queues.

**Backend alignment:**
Backend owns copy/circulation totals.

### Catalogue

**Purpose:**
Stores bibliographic title/author/category/language/ISBN/keywords data.

**Users:**
Librarian.

**Frontend behavior:**
Paginated searchable title table and edit form.

**Backend alignment:**
Backend validates uniqueness/pagination.

### Physical copies

**Purpose:**
Tracks each barcode/accession, condition, location, availability, and history.

**Users:**
Librarian.

**Frontend behavior:**
Copy tab/table and protected label generation.

**Backend alignment:**
Backend owns copy state.

### Scanner-first issue/return/renew

**Purpose:**
Processes one borrower and copy quickly with clear eligibility.

**Users:**
Librarian.

**Frontend behavior:**
Persistent scan focus, lookup fallback, eligibility panel, preview, confirm/result.

**Backend alignment:**
Backend validates atomic circulation/idempotency.

### Borrowers and eligibility

**Purpose:**
Explains current loans, limits, blocks, overdue/fine state before action.

**Users:**
Librarian; scoped borrower views.

**Frontend behavior:**
Borrower lookup/profile and eligibility badges.

**Backend alignment:**
Backend policy is authoritative.

### Reservations

**Purpose:**
Queues eligible requests and fulfillment/expiry/cancel state.

**Users:**
Librarian, student/parent where enabled.

**Frontend behavior:**
Reservation list and place/fulfill/cancel actions.

**Backend alignment:**
Backend owns queue order and eligibility.

### Overdues and fines

**Purpose:**
Lists overdue loans and backend-calculated fine status.

**Users:**
Librarian/admin; borrower-safe view.

**Frontend behavior:**
Aging table, reminder status, waive/adjust workflow by permission.

**Backend alignment:**
Backend calculates fines and transitions.

### Lost/damaged/replacement

**Purpose:**
Records condition events, replacement, payment reference link if supported, and copy status.

**Users:**
Librarian/admin.

**Frontend behavior:**
Reason/evidence form and history.

**Backend alignment:**
Backend owns transitions and any M3/M11 boundary.

### Reports

**Purpose:**
Provides circulation, overdue, inventory/copy, and loss reports.

**Users:**
Librarian/admin.

**Frontend behavior:**
Report parameters, queued jobs, protected downloads.

**Backend alignment:**
Backend snapshots/generates.

### Parent/student view

**Purpose:**
Shows own/linked-child loans, due dates, reservations, and safe fine status.

**Users:**
Parent/student.

**Frontend behavior:**
Purpose-limited account page.

**Backend alignment:**
Backend child/self scope.

### Barcode/QR labels

**Purpose:**
Generates printable copy labels from confirmed identifiers.

**Users:**
Librarian.

**Frontend behavior:**
Selection, template/preview metadata, queued protected PDF.

**Backend alignment:**
Backend generates unique labels.

---

## 3. Frontend Design Direction Based on Features

Use a catalogue and circulation workspace inside the standard SchoolOS app shell. Follow [the master web plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

- Layout: module header, optional backend KPI strip, shallow tabs, server filter bar, main workspace, and selection drawer.
- Density: compact enough for laptop operations, with decision context and field labels never sacrificed.
- Cards/tables: cards only for backend summaries; growing lists are server-paginated tables; visual media may use a grid.
- Drawers/tabs: drawers preserve list context; tabs separate stable subdomains, not arbitrary steps.
- Forms: sectioned, inline-validating, keyboard usable, and sticky-action only when long.
- Filters/actions: URL-preserved server filters; one primary action; import/export/settings under secondary actions.
- Confirmations/badges: high-risk changes require impact, reason, and confirmation; every color has text.
- States: loading, empty, no results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file unavailable.
- Files: File Registry authenticated helpers only; never raw keys, provider links, or persistent signed URLs.
- Responsive: collapse rails to drawers, prioritize table columns, and move long filters into an expandable panel.

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Librarian | Tenant catalogue, copies, circulation, borrowers, reports | Other tenants | All library staff screens |
| Admin | Policy and oversight by permission | Unapproved circulation changes | Dashboard/reports |
| Parent | Linked-child loans/reservations | Other borrowers | Parent library |
| Student | Own loans/reservations | Peers | Student library |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes/contracts where present; differences need router/OpenAPI confirmation.

### Admin / Staff Routes

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
```

### Parent Routes

```text
/parent/children/[studentId]/library
```

### Student Routes

```text
/student/library
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Library Dashboard

**Purpose:**
See circulation workload and exceptions.

**Main users:**
Librarian, admin.

**Route:**
`/dashboard/library` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, due/overdue, reservation and copy attention.

**Layout:**
Module header, filter/context bar, Queues/tables for due today, overdue, reservations ready, lost/damaged, missing labels, and a right drawer for selected loan/copy/borrower eligibility and history.

**Header actions:**
Open Circulation; Add Book

**Filters:**
Status, category, class, due range, search

**KPI cards / summary cards:**
Titles; copies; available; issued; overdue; reservations

**Main table / list / grid:**
Queues/tables for due today, overdue, reservations ready, lost/damaged, missing labels

**Right drawer / detail panel:**
selected loan/copy/borrower eligibility and history

**Forms / modals:**
None

**Confirmations:**
Reminder/export actions require confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Summary, attention lists, scoped detail, latest timestamps.

**Protected files:**
Report/label files protected.

**Audit behavior:**
Reminder, exception, report actions.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 2. Catalogue and Copies

**Purpose:**
Manage bibliographic records separately from physical copies.

**Main users:**
Librarian.

**Route:**
`/dashboard/library/catalogue` (planning route; reuse current route if different).

**Main features shown on this screen:**
Catalogue, physical copies, labels.

**Layout:**
Module header, filter/context bar, Title table; selected title drawer/tabs for metadata and copy rows with accession/barcode, location, condition, status, and a right drawer for title metadata, copy history, circulation constraints, labels.

**Header actions:**
Add Title; Add Copy / Generate Labels

**Filters:**
Title, author, category, language, copy status, location, search

**KPI cards / summary cards:**
Titles; copies; available; missing/damaged

**Main table / list / grid:**
Title table; selected title drawer/tabs for metadata and copy rows with accession/barcode, location, condition, status

**Right drawer / detail panel:**
title metadata, copy history, circulation constraints, labels

**Forms / modals:**
Title fields; copy accession/barcode/location/condition

**Confirmations:**
Delete/archive/condition change requires dependency review

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Paginated titles/copies, detail, uniqueness, allowed transitions.

**Protected files:**
Cover/label PDF protected if used.

**Audit behavior:**
Metadata, copy creation, condition/status, label generation.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 3. Scanner Circulation

**Purpose:**
Issue, return, or renew with minimum counter friction.

**Main users:**
Librarian.

**Route:**
`/dashboard/library/circulation` (planning route; reuse current route if different).

**Main features shown on this screen:**
Scanner-first issue/return/renew; eligibility.

**Layout:**
Module header, filter/context bar, Mode selector, borrower lookup, copy scan, eligibility/result panel, recent transactions, and a right drawer for borrower identity, eligibility reasons, copy state, due-date preview, recent history.

**Header actions:**
Confirm Issue / Return / Renew

**Filters:**
Borrower/card/roll fallback; copy barcode/accession

**KPI cards / summary cards:**
Current loans; limit; overdue; fine/block from backend

**Main table / list / grid:**
Mode selector, borrower lookup, copy scan, eligibility/result panel, recent transactions

**Right drawer / detail panel:**
borrower identity, eligibility reasons, copy state, due-date preview, recent history

**Forms / modals:**
Manual lookup and permitted due-date/condition note

**Confirmations:**
Final confirmation; duplicate scan/submission blocked

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Borrower/copy lookup, eligibility/preview, atomic mutation, idempotency, result.

**Protected files:**
Receipt/transaction proof only if supported and protected.

**Audit behavior:**
Every scan attempt/result, override reason, before/after copy/loan.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 4. Borrowers, Reservations and Overdues

**Purpose:**
Resolve borrower workload and queued demand.

**Main users:**
Librarian.

**Route:**
`/dashboard/library/borrowers` (planning route; reuse current route if different).

**Main features shown on this screen:**
Eligibility, reservations, overdues/fines, loss/damage.

**Layout:**
Module header, filter/context bar, Tabs/tables with borrower, class, active loans, due/overdue, fine, reservation position/status, and a right drawer for borrower history, policy reasons, queue, reminder state.

**Header actions:**
Place/Fulfill Reservation; Record Exception

**Filters:**
Borrower type, class, status, aging, reservation, search

**KPI cards / summary cards:**
Blocked; overdue; ready reservations; uncollected

**Main table / list / grid:**
Tabs/tables with borrower, class, active loans, due/overdue, fine, reservation position/status

**Right drawer / detail panel:**
borrower history, policy reasons, queue, reminder state

**Forms / modals:**
Reservation, fine waiver/adjust reason, lost/damaged/replacement evidence

**Confirmations:**
Override, waiver, loss/damage, fulfill/cancel require confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Borrower projection, policies, queues, fines, allowed transitions.

**Protected files:**
Evidence and protected reports.

**Audit behavior:**
Eligibility override, queue transitions, fine changes, loss/damage.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 5. Reports and Labels

**Purpose:**
Generate library evidence and printable labels.

**Main users:**
Librarian, admin.

**Route:**
`/dashboard/library/reports` (planning route; reuse current route if different).

**Main features shown on this screen:**
Reports and barcode/QR labels.

**Layout:**
Module header, filter/context bar, Report/label parameter cards plus job history table, and a right drawer for parameters, snapshot time, result metadata, safe error.

**Header actions:**
Generate Report / Labels

**Filters:**
Report type, date, class/category, copy status, job state

**KPI cards / summary cards:**
Queued; processing; ready; failed

**Main table / list / grid:**
Report/label parameter cards plus job history table

**Right drawer / detail panel:**
parameters, snapshot time, result metadata, safe error

**Forms / modals:**
Report parameters; label selection/template

**Confirmations:**
Generation/re-generation confirms scope/count

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Report validation, snapshot/job/status; label uniqueness/generation.

**Protected files:**
Exports and label PDFs via File Registry.

**Audit behavior:**
Requester, parameters, version, download.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 6. Parent / Student Library

**Purpose:**
Show linked-child/self loans and reservations without peer data.

**Main users:**
Parent, student.

**Route:**
`/parent/children/[studentId]/library` (planning route; reuse current route if different).

**Main features shown on this screen:**
Loans, due dates, reservations, safe fine status.

**Layout:**
Module header, filter/context bar, Current-loan cards and history/reservation list, and a right drawer for selected loan/title, due date, renewal/reservation eligibility.

**Header actions:**
Reserve if policy allows; Open guidance

**Filters:**
Child for parent, current/history, status

**KPI cards / summary cards:**
Borrowed; due soon; overdue; fine from backend

**Main table / list / grid:**
Current-loan cards and history/reservation list

**Right drawer / detail panel:**
selected loan/title, due date, renewal/reservation eligibility

**Forms / modals:**
Reservation/renew only if approved contract exists

**Confirmations:**
Reserve/cancel/renew confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Purpose-limited child/self account and allowed mutations.

**Protected files:**
Allowed book cover/receipt only through protected helper.

**Audit behavior:**
Own requests only; no staff override notes.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

---

## 7. Simple Wireframe Designs

### 1. Library Dashboard

```text
+------------------------------------------------------------------+
| Library Dashboard                           [Open Circulation] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Titles; copies; available; issued; overdue; reservati |
+------------------------------------------------------------------+
| Filters: Status, category, class, due range, search            |
+--------------------------------------------+---------------------+
| Queues/tables for due today, overdue, re | selected loan/cop |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 2. Catalogue and Copies

```text
+------------------------------------------------------------------+
| Catalogue and Copies                        [Add Title] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Titles; copies; available; missing/damaged            |
+------------------------------------------------------------------+
| Filters: Title, author, category, language, copy status, locat |
+--------------------------------------------+---------------------+
| Title table; selected title drawer/tabs  | title metadata, c |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Title fields; copy accession/barcode/location/condition        |
+------------------------------------------------------------------+
```

### 3. Scanner Circulation

```text
+------------------------------------------------------------------+
| Scanner Circulation                         [Confirm Issue / ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Current loans; limit; overdue; fine/block from backen |
+------------------------------------------------------------------+
| Filters: Borrower/card/roll fallback; copy barcode/accession   |
+--------------------------------------------+---------------------+
| Mode selector, borrower lookup, copy sca | borrower identity |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Manual lookup and permitted due-date/condition note            |
+------------------------------------------------------------------+
```

### 4. Borrowers, Reservations and Overdues

```text
+------------------------------------------------------------------+
| Borrowers, Reservations and Overdues        [Place/Fulfill Re] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Blocked; overdue; ready reservations; uncollected     |
+------------------------------------------------------------------+
| Filters: Borrower type, class, status, aging, reservation, sea |
+--------------------------------------------+---------------------+
| Tabs/tables with borrower, class, active | borrower history, |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Reservation, fine waiver/adjust reason, lost/damaged/replaceme |
+------------------------------------------------------------------+
```

### 5. Reports and Labels

```text
+------------------------------------------------------------------+
| Reports and Labels                          [Generate Report ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Queued; processing; ready; failed                     |
+------------------------------------------------------------------+
| Filters: Report type, date, class/category, copy status, job s |
+--------------------------------------------+---------------------+
| Report/label parameter cards plus job hi | parameters, snaps |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Report parameters; label selection/template                    |
+------------------------------------------------------------------+
```

### 6. Parent / Student Library

```text
+------------------------------------------------------------------+
| Parent / Student Library                    [Reserve if polic] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Borrowed; due soon; overdue; fine from backend        |
+------------------------------------------------------------------+
| Filters: Child for parent, current/history, status             |
+--------------------------------------------+---------------------+
| Current-loan cards and history/reservati | selected loan/tit |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Reservation/renew only if approved contract exists             |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Title, purpose, primary and secondary actions | Reuse | Keep school context visible. |
| `KpiGrid` / `SummaryStrip` | Backend-owned totals | Reuse | Unavailable if summary API is absent. |
| `FilterBar` | Server filtering/search | Reuse | Preserve filters where practical. |
| Paginated table / purposeful grid | Operational records | Reuse | Permission-safe columns. |
| Status badges | Lifecycle and risk | Extend shared | Text plus semantic color. |
| Detail drawer | Detail, actions, timeline | Reuse | Reauthorize mutations. |
| Validated form / sticky footer | Create/edit workflows | Reuse | Inline bounded errors. |
| Reason dialog | High-risk confirmation | Reuse | Show impact and require reason. |
| Protected file/upload controls | Authenticated file actions | Reuse | File Registry only. |
| Audit timeline | Actor, reason, transition | Reuse/create shared | Backend facts only. |
| M8 widgets | catalogue, copy, scanner, eligibility, reservation, overdue, and label widgets | Create composition | Reuse shared primitives. |

---

## 9. Backend and API Alignment

> These are capability labels, not endpoint names. Use current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summary, paginated list, scoped detail, backend totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated create/update commands with permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Copy lifecycle; issue/return/renew; reservation place/fulfill/expire/cancel; fine waiver; lost/damaged/replacement; report/label jobs. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Borrower eligibility, copy availability, loan limits, due policy, duplicate scan/idempotency, reservation order, copy identifier uniqueness. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Circulation, overdue, inventory/loss and label exports are backend snapshots/jobs. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Labels, reports, evidence and optional covers use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Due/overdue, reservation ready, loss/damage outcomes emit M12 events. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

Library fines remain M8 operational truth; payment/accounting handoff uses approved M3/M11 integration only. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Circulation, overrides, fines, conditions, reservations, labels/reports. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Parent linked-child and student self APIs exclude other borrowers and internal notes. **needs OpenAPI confirmation** unless verified in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Request pending | Layout skeleton; retain context | Request state |
| Empty | No records | Explain and offer one permitted action | Empty response |
| No search results | Filters match nothing | Preserve/clear filters | List metadata |
| Validation error | Input invalid | Inline errors and summary | Safe validation envelope |
| Permission denied | Scope fails | Reveal no forbidden data | Backend RBAC |
| Module locked | Entitlement off | Locked screen; no fake values | Entitlement guard |
| Mutation pending | Command in flight | Prevent duplicate submit | Mutation/job state |
| Success | Backend confirms | Feedback and refetch | Confirmed response |
| Failure | Safe command error | Friendly parsed error/retry | Safe error envelope |
| Partial failure | Batch partly succeeds | Itemized result/retry | Batch result |
| Queued job | Async work | Job tracker | Job API |
| Protected file unavailable | Missing/unauthorized | Safe unavailable state | File Registry |
| Stale data | Timestamp exceeds policy | Stale label and refresh | Backend timestamp |
| Borrower ineligible | Backend policy blocks circulation | Show exact safe reasons and do not enable confirm | Eligibility decision |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates every query, job, export, file, and event; browser input is never trusted tenant scope.
- Backend RBAC and module entitlement are authoritative; hidden controls are UX only.
- Librarians operate tenant records only; parent/student views expose no peer borrowing history.
- Fine/copy/availability totals are backend-owned.
- Scanner input is untrusted and revalidated by backend.
- Sensitive fields are omitted/masked by permission and never placed in URLs, logs, or analytics.
- Protected files use File Registry helpers; never raw object keys, provider URLs, or storage errors.
- Audit-sensitive actions display backend actor/time/reason/history only.
- Raw backend, provider, Prisma, and storage errors never reach users.

---

## 12. Nepal-Specific Requirements

- Support accession numbers and affordable barcode/QR label printing; manual lookup remains available when scanners fail.
- Search Nepali/English titles, names, admission numbers, class/section/roll and guardian phone where permitted.
- Fine, renewal, holiday and borrowing policies are school-configured; UI does not assume universal values.
- Use NPR for backend fine values and keep payment posting out of the circulation screen.

---

## 12A. Consolidated M8 Implementation Notes

The retired app-local M8 implementation guide was merged here so this file remains the active Library frontend source of truth.

- Catalogue and physical copies stay visually and contractually separate. Title metadata is not copy availability; copy lifecycle actions such as add, print barcode/QR, move shelf, mark lost/damaged, replace, and archive use backend mutations.
- Official title counts, copy counts, availability, issued counts, overdue counts, fines, borrower eligibility, borrowing limits, fine calculations, holiday-aware days, accounting posting state, reservation position, and export completion state are backend truth.
- Scanner circulation supports issue, return, and renew modes with scanner unavailable, camera permission blocked, unknown barcode, duplicate scan, borrower missing, borrower blocked, copy unavailable, policy missing, and override-required states.
- Do not confirm issue, return, renew, reservation, fine adjustment, lost/damaged, replacement, or queue change until backend validation succeeds. Preserve scanned session context after recoverable row-level errors.
- Borrower views show eligibility, active loans, overdues, fine due, policy group, and last activity from backend responses only. Parent Library shows linked-child borrowed books, due soon, overdue, fine due, reservations, notices, and policy; it excludes global queues, other borrowers, staff notes, audit notes, and accounting posting details.

---

## 13. Implementation Checklist

```text
[ ] Uses SchoolOS layout and design system.
[ ] Features map to screens; every screen maps to a wireframe.
[ ] Current route/OpenAPI/contracts/permissions were inspected.
[ ] Real APIs and backend-owned totals only; no fake metrics.
[ ] Lists paginate/filter server-side.
[ ] All global and domain states exist.
[ ] Protected files use File Registry helpers.
[ ] Purpose-limited personas fail closed.
[ ] High-risk actions confirm, collect reason, prevent duplicates, and show audit state.
[ ] Unknowns say needs OpenAPI confirmation or needs backend verification.
[ ] Responsive layout preserves the main job.
```

---

## 14. Done Definition

```text
[ ] All module features are explained.
[ ] Each feature has matching frontend behavior.
[ ] Every expected screen is documented and wireframed.
[ ] Backend/API and file needs are listed without invented endpoints.
[ ] Required states and security/role boundaries are clear.
[ ] Nepal-specific needs are included.
[ ] Design is simple and implementation-friendly.
[ ] Implementation does not require module detail from the master plan.
```
