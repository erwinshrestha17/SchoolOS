# SchoolOS Web Module Workspace Layout Guide

**Status:** Companion guide for module-wise web workspace layout.  
**Related docs:**

- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`

**Scope:** Web dashboard layout guidance only. This document does not implement backend, frontend, mobile, API, database, or test code.

This guide captures the preferred SchoolOS web layout pattern: the global aside handles navigation only, while the main section becomes the selected module's real working desk. It should be used when implementing or reviewing module screens in `apps/web`.

---

## 1. Core Layout Decision

For SchoolOS, the best design is a **module-wise workspace design**.

```text
┌────────────────────────────────────────────────────────────┐
│ Top Bar: School, Academic Year, Search, Notifications, User │
├───────────────┬────────────────────────────────────────────┤
│ Global Aside  │ Main Section / Module Workspace             │
│               │                                            │
│ Dashboard     │ Header: Module title + actions              │
│ Admissions    │ KPI cards                                   │
│ Attendance    │ Filters / tabs                              │
│ Fees          │ Tables / lists / charts                      │
│ Academics     │ Detail drawer / forms / modals               │
│ HR            │                                            │
│ Library       │                                            │
│ Transport     │                                            │
│ Canteen       │                                            │
│ Accounting    │                                            │
│ Communication │                                            │
└───────────────┴────────────────────────────────────────────┘
```

The **global aside bar is navigation only**. It should not become a dashboard, shortcut wall, or action panel.

The aside may contain:

- SchoolOS logo.
- Main modules.
- Collapsible submodules.
- Role-based navigation visibility.
- Module locked indicators where useful.
- Current role indicator.
- Settings/help at the bottom.

The aside should not contain:

- Module KPIs.
- Operational tables.
- Workflow buttons.
- Finance amounts.
- Student private data.
- High-risk actions.

The **main section is where the real work happens**.

---

## 2. Standard Main Section Structure

Every module screen should use this structure unless a domain workflow clearly needs a special layout.

```text
Module Header
→ Page title
→ Short description
→ One primary button
→ Secondary actions inside More Actions

KPI Section
→ Important numbers/status cards

Control Section
→ Search
→ Filters
→ Date range
→ Class/section selector
→ Status selector

Content Section
→ Tables
→ Cards
→ Calendar
→ Charts
→ Lists
→ Timeline
→ Map where approved

Action Area
→ Add/edit forms
→ Bulk actions
→ Detail drawer
→ Confirmation modal
→ Export/print/protected file buttons
```

Recommended exact pattern for most modules:

```text
1. Header
   - Module name
   - Short description
   - Primary action button

2. KPI Strip
   - 3 to 5 important stats

3. Tabs
   - Subsections of the module

4. Filters
   - Search, class, section, date, status

5. Main Content
   - Table, grid, feed, calendar, or map

6. Right Drawer
   - Details, edit form, approval, preview

7. Footer / Utility
   - Export, pagination, audit log, print
```

Use this navigation rule:

```text
Dashboard → List/Table → Detail Drawer → Full Page only when needed
```

Do not open a new route for every small action. Use drawers for quick view/edit and full pages only for complex workflows such as student profile, staff profile, report-card batch, payroll run, accounting report, timetable builder, large import, or learning activity builder.

---

## 3. Global Dashboard Main Section

The dashboard should not show every module in full. It should show only what school staff need to understand today.

### Dashboard KPIs

- Total students.
- Present today.
- Fees collected today.
- Pending admissions.
- Active notices.
- Staff on leave.
- Upcoming exams.
- Transport alerts.
- Canteen sales.
- Library overdue count.

### Layout

```text
Dashboard Header
School Summary KPI Cards
Today's Operations
Pending Approvals
Recent Activity
Module Health
```

### Rules

- No fake dashboard cards.
- Do not fetch every module deeply on first render.
- Use real summary APIs or safe module summaries.
- Respect role permissions and module entitlements.
- Locked modules should not show fake values.

---

## 4. Module-Wise Main Section Design

## M1 — Admissions and Student Profiles

### Main screen contents

**KPI cards:**

- Total students.
- New admissions.
- Pending applications.
- Missing documents.
- Duplicate candidates.

**Main tabs:**

- Students.
- Admissions.
- Documents.
- iEMIS Export.
- QR / ID Cards.

**Main table columns:**

- Student name.
- Class.
- Section.
- Guardian.
- Admission status.
- Document status.
- Actions.

**Primary and secondary buttons:**

- New Admission.
- Upload Document.
- Generate QR.
- Export iEMIS.
- Review Duplicate.

### Best layout

```text
Admissions Header
KPI Cards
Tabs
Search + Filters
Student Table
Right Drawer: Student Detail
```

### Notes

- Student detail can open in a drawer for quick context.
- Full student profile should remain a full page.
- Private student photos, documents, ID cards, and certificates must use protected file helpers.
- Duplicate merge must never be automatic.

---

## M2 — Smart Attendance

### Main screen contents

**KPI cards:**

- Present today.
- Absent today.
- Late students.
- Pending corrections.
- Classes not marked.

**Main views:**

- Daily attendance.
- Monthly register.
- Teacher attendance.
- Correction requests.
- Offline drafts.

**Table/grid columns:**

- Student name.
- Roll no.
- Present/Absent/Late state.
- Remarks.
- Correction status.

**Buttons:**

- Mark Attendance.
- Submit Correction.
- Lock Attendance where permitted.
- Export Register.

### Best layout

```text
Attendance Header
Class + Date Selector
Attendance Summary Cards
Attendance Grid
Correction Panel
Monthly Register View
```

### Notes

Attendance must be **fast and low-click**, because teachers use it daily. Bulk present, keyboard-friendly marking, clear locked states, and offline draft sync indicators matter more than decorative design.

---

## M3 — Fees and Receipts

### Main screen contents

**KPI cards:**

- Total due.
- Collected today.
- Overdue invoices.
- Refunds/reversals.
- Cashier close status.

**Main tabs:**

- Invoices.
- Payments.
- Receipts.
- Discounts.
- Cashier Close.
- Reports.

**Table columns:**

- Student.
- Invoice number.
- Amount.
- Paid.
- Due.
- Status.
- Receipt.

**Buttons:**

- Create Invoice.
- Record Payment.
- Print Receipt.
- Reverse Payment.
- Close Cashier Day.

### Best layout

```text
Finance Header
KPI Cards
Student / Invoice Search
Invoice Table
Payment Drawer
Receipt Preview
Cashier Close Panel
```

### Notes

This module needs **strong audit visibility** because money is involved. Payment, receipt, reversal, refund, discount, adjustment, and close actions must be confirmation-backed, reasoned where required, idempotent, and server-owned.

---

## M4 — Academics, Exams, CAS, and Report Cards

### Main screen contents

**KPI cards:**

- Active terms.
- Exams created.
- Marks pending.
- Report cards generated.
- Report cards published.

**Main tabs:**

- Subjects.
- Terms.
- Exams.
- Marks Entry.
- CAS.
- Report Cards.

**Tables and grids:**

- Exam list.
- Subject list.
- Marks entry grid.
- Report-card status table.

**Buttons:**

- Create Exam.
- Add Subject.
- Enter Marks.
- Generate Report Card.
- Publish Result.

### Best layout

```text
Academics Header
Class / Section / Term Selector
KPI Cards
Tabs
Marks Entry Grid
Report Card Preview Drawer
```

### Notes

Marks entry should feel like a **spreadsheet**, not a complicated form. The grid must clearly show lock state, draft/autosave status, absent, withheld, retest, row validation errors, and teacher assignment scope.

---

## M5 — Activity Feed and Milestones

### Main screen contents

**KPI cards:**

- Posts today.
- Pending approvals.
- Media uploaded.
- Consent-blocked posts/media.
- Failed deliveries.

**Main tabs:**

- Feed.
- Pending Approval.
- Media Gallery.
- Milestones.
- Parent View.

**Content:**

- Activity cards.
- Image/video previews.
- Approval queue.
- Milestone cards.
- Comments/reactions only where enabled and safe.

**Buttons:**

- Create Post.
- Upload Media.
- Approve.
- Reject.
- Hide from Parents.

### Best layout

```text
Activity Header
KPI Cards
Feed Cards
Media Preview Grid
Approval Drawer
Consent Warning Banner
```

### Notes

This module should look like a **school social feed**, but with strict approval, guardian scope, consent, and moderation controls. Parent visibility must be previewed before publishing.

---

## M6 — Homework and Timetable

### Main screen contents

**KPI cards:**

- Homework assigned.
- Pending submissions.
- Today's periods.
- Teacher conflicts.
- Substitution tasks.

**Main tabs:**

- Homework.
- Submissions.
- Timetable Builder.
- Substitution.
- Teacher Workload.

**Content:**

- Homework list.
- Submission table.
- Weekly timetable grid.
- Conflict warnings.
- Substitution drawer.

**Buttons:**

- Assign Homework.
- Attach File.
- Publish Timetable.
- Add Substitution.
- Return for Correction.

### Best layout

```text
Homework / Timetable Header
Class + Week Selector
KPI Cards
Homework Table or Timetable Grid
Conflict Panel
Substitution Drawer
```

### Notes

Timetable builder should use a **calendar/grid layout**. Homework attachments must use File Registry helpers and parent/student views must only show assigned and published work.

---

## M7 — HR and Payroll

### Main screen contents

**KPI cards:**

- Total staff.
- On leave today.
- Payroll pending.
- Contracts expiring.
- Missing staff documents.

**Main tabs:**

- Staff.
- Contracts.
- Leave.
- Payroll.
- Payslips.
- Attendance.

**Table columns:**

- Staff name.
- Role.
- Department.
- Contract status.
- Leave balance.
- Payroll status.

**Buttons:**

- Add Staff.
- Create Contract.
- Approve Leave.
- Run Payroll.
- Generate Payslip.

### Best layout

```text
HR Header
KPI Cards
Staff Table
Leave Approval Queue
Payroll Run Wizard
Payslip Preview
```

### Notes

Payroll should use a **step-by-step wizard** to avoid mistakes. Salary, bank, and payslip data must be permission-gated and protected.

---

## M8A — Library

### Main screen contents

**KPI cards:**

- Total books.
- Available copies.
- Issued books.
- Overdue books.
- Pending fines.

**Main tabs:**

- Books.
- Copies.
- Issues.
- Returns.
- Overdue.
- Fines.

**Table columns:**

- Book title.
- Author.
- ISBN/barcode.
- Copy count.
- Available.
- Status.

**Buttons:**

- Add Book.
- Add Copy.
- Issue Book.
- Return Book.
- Export Overdue List.

### Best layout

```text
Library Header
KPI Cards
Book Search
Book Table
Issue / Return Drawer
Overdue Alert Panel
```

### Notes

Library should have a very strong **search-first design**. Scanner-first issue/return flows should be available for librarian workflows.

---

## M8B — Transport

### Main screen contents

**KPI cards:**

- Active routes.
- Vehicles.
- Assigned students.
- Live trips.
- Stale GPS alerts.

**Main tabs:**

- Routes.
- Stops.
- Vehicles.
- Trips.
- Students.
- GPS / Tracking.

**Content:**

- Route list.
- Stop list.
- Vehicle table.
- Map preview where approved.
- Student assignment table.

**Buttons:**

- Add Route.
- Add Stop.
- Assign Student.
- Start Trip.
- View Location Status.

### Best layout

```text
Transport Header
KPI Cards
Route / Vehicle Tabs
Map + Table Split View where approved
Trip Detail Drawer
```

### Notes

Transport can benefit from a **map + table layout**, but live map should remain deferred until policy, SSE/WebSocket, load, and privacy decisions are approved. Until then, use trip status, latest GPS, stale GPS, and history tables.

---

## M8C — Canteen

### Main screen contents

**KPI cards:**

- Today's sales.
- Wallet balance total.
- Items sold.
- Low stock items.
- Allergy warnings.

**Main tabs:**

- Menu.
- Orders / POS.
- Wallets.
- QR Serving.
- Inventory.
- Reports.

**Table columns:**

- Student.
- Wallet balance.
- Last purchase.
- Meal-plan status.
- Warning status.

**Buttons:**

- Add Menu Item.
- Top Up Wallet.
- Serve via QR.
- Refund where permitted.
- Export Sales.

### Best layout

```text
Canteen Header
KPI Cards
Menu Cards
Wallet Table
QR Serve Panel
Sales Summary
```

### Notes

Canteen UI should be **touch-friendly and very fast**, because staff may use it during rush hours. Allergy/medical warnings must be visible before serving and must require acknowledgement where backend policy requires it.

---

## M9 — Accounting and Finance

### Main screen contents

**KPI cards:**

- Cash balance.
- Receivables.
- Payables.
- Monthly income/expense.
- Unreconciled items.

**Main tabs:**

- Dashboard.
- Chart of Accounts.
- Journal Entries.
- Ledger.
- Trial Balance.
- Reports.
- Closed Periods.

**Table columns:**

- Journal date.
- Account.
- Debit.
- Credit.
- Source module.
- Status.

**Buttons:**

- Add Journal Entry.
- Post Entry.
- Close Period.
- Export Report.
- View Ledger.

### Best layout

```text
Accounting Header
KPI Cards
Reports Summary
Journal Table
Ledger Drawer
Financial Report Preview
```

### Notes

Accounting should look more formal and audit-focused than daily modules. Posted records must not be silently edited; correction/reversal workflows must be explicit.

---

## M10 — Notices and Communication

### Main screen contents

**KPI cards:**

- Notices sent.
- Unread notices.
- Active chats.
- Pending approvals.
- Failed deliveries.

**Main tabs:**

- Notices.
- Compose.
- Chat.
- Recipients.
- Delivery Logs.
- Templates.

**Content:**

- Notice list.
- Chat threads.
- Recipient selector.
- Delivery status table.
- Provider status card.

**Buttons:**

- Create Notice.
- Send Notice.
- Schedule Notice.
- Start Chat where allowed.
- Disable Chat where permitted.
- Export Delivery Log.

### Best layout

```text
Communication Header
KPI Cards
Notice Table
Chat Inbox Layout
Recipient Selector Drawer
Delivery Log Panel
```

### Notes

Chat should be **school-controlled**, not personal messaging. Include quiet-hours banner, no personal data sharing warning, report/escalation flow, and audit trail.

---

## M12 — Learning Layer

### Main screen contents

**KPI cards:**

- Live sessions.
- Published activities.
- Active participants.
- Submitted attempts.
- Needs-practice students.

**Main tabs:**

- Activities.
- Sessions.
- Resources.
- Progress.

**Content:**

- Activity list.
- Activity builder.
- Resource library.
- Session monitor.
- Progress table.

**Buttons:**

- Create Activity.
- Launch Board Session.
- Launch Lab Session.
- Attach Resource.
- Export Progress.

### Best layout

```text
Learning Header
KPI Cards
Activity / Session Tabs
Activity Table
Session Monitor Drawer
Progress Panel
```

### Notes

Learning remains teacher-controlled and school-only by default. Do not add broad student mobile, AI tutor, open chat, or leaderboards.

---

## 5. Best Screen Types to Use

| Screen type | Used for |
|---|---|
| Dashboard | Overview and KPIs. |
| Table/List View | Students, staff, invoices, books, journals. |
| Detail Drawer | Quick view/edit without losing context. |
| Full Detail Page | Student profile, staff profile, report card, payroll run. |
| Wizard | Admission, payroll, report generation, imports. |
| Calendar/Grid | Timetable, attendance, exams. |
| Kanban/Queue | Admissions, approvals, corrections, moderation. |
| Map View | Transport route/location status only where approved. |
| Feed View | Activity posts and milestones. |
| POS/Touch Panel | Canteen serving and cashier-style workflows. |

---

## 6. Reusable Web Components

SchoolOS should standardize these reusable components:

- `ModuleHeader`.
- `KpiCard`.
- `DataTable`.
- `FilterBar`.
- `StatusBadge`.
- `EmptyState`.
- `ErrorState`.
- `PermissionState`.
- `ModuleLockedState`.
- `DetailDrawer`.
- `ConfirmDialog`.
- `AuditReasonDialog`.
- `AuditTimeline`.
- `ProtectedFileButton`.
- `ProtectedFileLink`.
- `ExportButton`.
- `PrintButton`.
- `RoleGuard`.
- `PermissionGate`.

Reusable components must not hide backend authorization requirements. Backend RBAC and tenant scope remain the source of truth.

---

## 7. Final Recommended Main Layout

```text
Global Aside
    ↓
Top Bar
    ↓
Module Header
    ↓
KPI Cards
    ↓
Tabs + Filters
    ↓
Main Table / Grid / Calendar / Feed / Map
    ↓
Right Drawer / Modal / Wizard
```

This is the most optimal web design for SchoolOS because it keeps the system consistent, role-friendly, fast for daily school work, and scalable across all modules.

---

## 8. Implementation Guardrails

When implementing any screen from this guide:

1. Use real APIs only.
2. Keep one main job per screen.
3. Keep the aside navigation-only.
4. Keep high-risk actions out of the sidebar.
5. Use server-side pagination/filtering for growing lists.
6. Use `searchParams` for filters where practical.
7. Use protected file helpers for PDFs, documents, receipts, report cards, activity media, payslips, and exports.
8. Show loading, empty, error, success, permission denied, and module locked states.
9. Require audit reason for sensitive mutations.
10. Never show fake KPIs or placeholder production metrics.
11. Do not expose admin-shaped APIs to parent, driver, staff self-service, or student lab/session flows.
12. Do not add Angular, microservices, AI runtime, public student leaderboard, or a broad student mobile app from this layout work.
