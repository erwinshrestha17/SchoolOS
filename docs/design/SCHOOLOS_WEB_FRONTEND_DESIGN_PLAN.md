# SchoolOS Web Frontend Design Plan

**Status:** Active source of truth for SchoolOS web frontend design, UI/UX, wireframes, component planning, route behavior, API usage, and web persona smoke expectations.  
**Updated:** 2026-06-16  
**Scope:** `apps/web`, Next.js App Router, school dashboard, platform control plane, settings, reports, protected files, and dense school operation workspaces.

This document is planning and design guidance only. It does not implement backend, frontend, mobile, database, migration, package, or test code.

---

## 1. Purpose

SchoolOS web is the daily command center for Nepal schools. It should help school staff run real school work quickly, safely, and confidently.

It must feel like:

```text
A school operating desk.
```

It must not feel like:

```text
A generic ERP.
A decorative dashboard template.
A shortcut wall.
A fake demo UI.
A technical admin console for non-technical school users.
```

This plan defines how the Next.js web app should be designed and implemented across:

- School dashboard.
- Module workspaces.
- Platform control plane.
- School settings.
- Reports and exports.
- Protected files and PDFs.
- Role-aware navigation.
- Loading, empty, error, success, permission, and module-locked states.
- Web smoke expectations.

The mobile app UI/UX source of truth is separate:

```text
docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
```

---

## 2. Product Principle

The core design principle is:

```text
One screen = one main job.
```

Every web screen must answer these three questions within 10 seconds:

```text
1. Where am I?
2. What needs my attention?
3. What can I safely do here?
```

A good SchoolOS screen has:

- A clear page title.
- A short school-friendly purpose line.
- One primary action.
- Secondary actions under `More Actions`.
- Real backend data or an honest unavailable/empty state.
- Permission-safe visibility.
- Clear next action.
- No fake numbers.
- No hidden financial or student-data risk.

A bad SchoolOS screen has:

- Many equal buttons in the header.
- Fake metrics.
- Dense tables without context.
- Raw API errors.
- Browser-only totals used as truth.
- Private files opened through raw URLs.
- Forms without loading/success/error behavior.
- A module that looks available when it is locked.
- Actions that appear allowed but fail unclearly.

---

## 3. Web Surface Boundaries

SchoolOS web has three major planes.

| Plane | Route family | User | Purpose |
|---|---|---|---|
| School Operations | `/dashboard/*` | School staff | Daily school workflows. |
| Tenant Configuration | `/dashboard/settings/*` | School admin / authorized roles | One school's configuration. |
| Platform Control Plane | `/platform/*` | SchoolOS operator / platform admin | SaaS tenant, provider, queue, support, and platform operations. |

Rules:

- School Operations must never expose platform-only controls.
- School Settings must not become SaaS billing/platform configuration.
- Platform must not expose tenant-private data unless explicit audited support override is active.
- School fee collection is not SchoolOS SaaS billing.
- M9 Accounting is a school accounting module, not a platform billing microservice.

---

## 4. Non-Negotiable Web Guardrails

### 4.1 Security and tenant isolation

- Keep `tenantId` as the tenant boundary everywhere.
- Backend RBAC, tenant scope, module entitlement, and route guards are the source of truth.
- Frontend hiding is only UX; it is never security.
- Every API call must rely on authenticated session context and backend authorization.
- Do not expose internal IDs unless the existing API contract already safely exposes them for UI routing.
- Never expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session web routes must use purpose-limited data, not admin-shaped payloads.

### 4.2 Data truth

- Real APIs only.
- No fake frontend data.
- No placeholder production metrics.
- No browser-only production state.
- No client-side money truth.
- No client-calculated official attendance/fees/payroll/accounting totals.
- Growing lists must be paginated and filtered server-side.
- Dashboard summaries may show unavailable states if a summary API is missing.

### 4.3 Protected files

Protected files include:

```text
Receipts
Cashier close PDFs
Report cards
Payscale/payroll slips
Student documents
Student photos
School logo where private
Activity media
Notice attachments
Homework attachments
Learning resources
Accounting reports
Exports and snapshots
Generated documents
```

Rules:

- Use File Registry-backed authenticated helpers.
- Use `ProtectedFileButton`, `ProtectedFileLink`, or shared blob/download helpers.
- Do not use raw `window.open` for private file URLs.
- Do not persist raw signed URLs in client state beyond the immediate action.
- File unavailable, permission denied, expired, or missing states must be friendly and safe.

### 4.4 Architecture boundaries

- Keep Next.js in `apps/web`.
- No Angular migration.
- No microservices.
- No AI runtime or M11 UI until explicitly approved.
- Keep SchoolOS as a modular monolith from the frontend user's point of view.
- Cross-module UI aggregation must call defined APIs, not invent backend shortcuts.

---

## 5. Web UX Language

SchoolOS is used by real school staff, not just technical users.

Use:

```text
Save failed. Please check the highlighted fields.
You do not have permission to reverse payments. Please contact the school administrator.
This module is not enabled for this school.
Receipt download is unavailable right now.
Attendance is locked for this date.
This report is being prepared. You can download it when it is ready.
```

Avoid:

```text
403 Forbidden
Mutation failed
Unhandled exception
PrismaClientKnownRequestError
Entity not found
Invalid payload
Object key missing
```

Labels should be school terms:

| Prefer | Avoid |
|---|---|
| Student | Entity |
| Guardian | Relation object |
| Receipt | Payment artifact |
| Class / Section | Group / Subgroup |
| Staff | Employee entity |
| School Settings | Tenant config |
| Platform | Super admin module |
| Not enabled | Unauthorized module |

---

## 6. Visual Direction

### 6.1 Look and feel

- Calm light app background.
- White cards, tables, panels, and drawers.
- Soft blue-grey page background.
- Deep blue/indigo primary identity.
- Rounded cards and panels, generally 16-24px radius.
- Subtle borders and shadows only where hierarchy requires it.
- Clear typographic hierarchy.
- Charts only when they help decisions.
- No decorative gradients as the main UI language.
- No crowded dashboard cards.

### 6.2 Base tokens

| Token | Value | Usage |
|---|---:|---|
| `brand.primary` | `#155EEF` | Primary actions, active links. |
| `brand.primaryDark` | `#0B3A88` | Sidebar active state, strong headers. |
| `brand.primarySoft` | `#EAF1FF` | Soft active/selected backgrounds. |
| `brand.secondary` | `#7C3AED` | Secondary accent. |
| `surface.app` | `#F3F7FB` | Main background. |
| `surface.card` | `#FFFFFF` | Cards, panels, tables. |
| `surface.subtle` | `#F8FAFC` | Subtle table headers / grouped blocks. |
| `border.default` | `#E2E8F0` | Card/table borders. |
| `text.primary` | `#0F172A` | Primary text. |
| `text.secondary` | `#475569` | Secondary text. |
| `text.muted` | `#64748B` | Helper labels. |
| `success` | `#16A34A` | Success state. |
| `warning` | `#D97706` | Warning state. |
| `danger` | `#DC2626` | Error/destructive state. |
| `info` | `#0284C7` | Informational state. |

### 6.3 Module accents

Module accents should identify location, not replace semantic colors.

| Area | Accent |
|---|---:|
| Dashboard | `#155EEF` |
| Platform Control | `#4F46E5` |
| Admissions / Students | `#2563EB` |
| Attendance | `#059669` |
| Fees / Receipts | `#D97706` |
| Academics | `#7C3AED` |
| Activity Feed | `#DB2777` |
| Homework / Timetable | `#0284C7` |
| HR / Payroll | `#9333EA` |
| Library | `#0D9488` |
| Transport | `#EA580C` |
| Canteen | `#65A30D` |
| Accounting | `#0F766E` |
| Notices / Chat | `#E11D48` |
| Learning | `#7C3AED` |
| Reports | `#0891B2` |
| Settings | `#475569` |

---

## 7. Global Layout System

The standard authenticated school web layout is:

```text
Topbar
Left Sidebar
Page Header
Context Bar / Filters
Summary / KPI Strip
Main Work Area
Optional Right Panel / Drawer
Sticky Action Bar only for multi-step or review flows
```

### 7.1 Global shell wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Topbar                                                                       │
│ SchoolOS | School | Academic Year | Global Search | Notifications | User     │
├──────────────────────┬───────────────────────────────────────────────────────┤
│ Left Sidebar          │ Main Page                                             │
│                      │                                                       │
│ Home                 │ Page Header                                           │
│ Students             │ Context / Filters                                     │
│ Daily Operations     │ Summary Cards                                         │
│ Academics            │                                                       │
│ School Operations    │ Main Workspace                                        │
│ Staff & Finance      │                                                       │
│ Reports              │ Optional Right Drawer / Side Panel                    │
│ System               │                                                       │
│                      │                                                       │
│ Settings             │ Sticky Action Bar only when needed                    │
│ Help                 │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
```

### 7.2 Topbar

Topbar contains global context only:

- SchoolOS identity.
- School switcher where the user has access to multiple schools.
- Academic year switcher where academic-year context matters.
- Global search.
- Notification center.
- Support override banner if active.
- User menu.

Topbar does not contain module-specific primary actions except global search and notifications.

### 7.3 Sidebar

Recommended navigation groups:

```text
Home

Students
  Admissions
  Guardians

Daily Operations
  Attendance
  Fees
  Communications
  Activity Feed

Academics
  Exams & Report Cards
  Homework & Timetable
  Learning

School Operations
  Library
  Transport
  Canteen

Staff & Finance
  HR & Payroll
  Accounting

Reports

System
  Settings
```

Rules:

- Sidebar is navigation only.
- No KPIs in the sidebar.
- No action buttons in the sidebar except safe navigation.
- No finance amounts in the sidebar.
- No student private data in the sidebar.
- Locked modules may show a subtle lock indicator.
- Direct locked route access still shows a full `ModuleLockedState`.
- Do not show implementation-phase names in navigation.

### 7.4 Page header

Every page header should have:

```text
Title
One-line purpose
One primary action
More Actions menu for secondary actions
Optional help/status badge
```

Example:

```text
Admissions & Student Profiles
Manage admissions, student records, guardians, documents, QR, and iEMIS readiness.
[New Admission] [More Actions]
```

Header rules:

- One primary action per screen.
- Put import/export/history/template actions in `More Actions`.
- Do not put five equal buttons in the header.
- Destructive actions must not be primary header actions.
- High-risk actions need confirmation and reason.

---

## 8. Page Composition Patterns

### 8.1 Standard module workspace

```text
ModuleHeader
KpiGrid / SummaryStrip
Tabs
FilterBar
MainContent
DetailDrawer / Modal / Wizard
Audit / Export / Protected File Actions
```

### 8.2 Standard list workspace

Used for students, invoices, staff, books, vehicles, notices, journals, users.

```text
Header
KPI Strip
Tabs if needed
Filter Bar
Table with server pagination
Selected row detail drawer
Bulk actions only where safe
Export/report footer where allowed
```

Table requirements:

- Server-side pagination.
- Server-side filtering for growing data.
- Visible total count from backend/list metadata.
- Active filter chips.
- One primary row action.
- Secondary row actions in `More`.
- Destructive row actions separated with confirmation.
- Sensitive columns hidden unless permission allows.

### 8.3 Standard workflow workspace

Used for admission, payment, payroll run, timetable builder, report card generation, reconciliation, import review.

```text
Header
Step/status banner
Left: primary form or builder
Right: live summary / validation / audit / preview
Sticky action footer: Back / Save Draft / Continue / Submit
```

Rules:

- Long forms preserve user input where practical.
- Save draft only if backend supports draft persistence.
- Multi-step writes must not be faked in client state.
- Final submit shows impact preview.
- Financial or lifecycle workflows require reason where policy requires it.

### 8.4 Standard dashboard card

```text
[Icon] Label
Main value
Short context line
Optional status badge
Click behavior: opens filtered workspace or detail
```

Rules:

- 3-5 KPIs per module screen.
- 6-8 KPIs maximum on main dashboard.
- Every KPI comes from backend summary/list metadata or shows unavailable.
- Never calculate official totals in browser.
- KPI click-through should preserve filters.

### 8.5 Right drawer pattern

Use drawers for quick inspect/edit/review without losing list context.

Drawer content order:

```text
Title / record identity
Status and important metadata
Main details
Actions
Audit timeline / history
Related protected files
```

Use full routes instead of drawers only for:

- Student profile.
- Staff profile.
- Report card batch review.
- Payroll run.
- Accounting reconciliation.
- Timetable builder.
- Large imports.
- Learning activity builder.
- Controlled learning runtime routes.

---

## 9. Required Screen States

Every screen must explicitly handle these states.

| State | Web behavior |
|---|---|
| Loading | Skeleton matching layout; preserve title and filters. |
| Empty | Explain why no data exists; show one safe CTA if allowed. |
| Error | Show parsed school-friendly backend error, retry, and preserved filters. |
| Permission denied | Explain user lacks permission; avoid revealing forbidden data. |
| Module locked | Show plan/module locked state; no fake fallback values. |
| Success | Toast or inline success; refetch/invalidate relevant data. |
| Validation | Inline field errors plus optional summary for long forms. |
| File unavailable | Explain file is missing, expired, or restricted. |
| Slow network | Preserve current data; show retry or last updated. |
| Queued job | Show queued/processing/succeeded/failed from backend. |
| Partial failure | Show exactly which items failed and which succeeded. |

### 9.1 Empty state template

```text
No students found
Try changing your filters or add a new student admission.
[New Admission]
```

### 9.2 Permission state template

```text
You do not have permission to reverse payments.
Please contact the school administrator if you need this access.
[Back to Fees]
```

### 9.3 Module locked state template

```text
Transport is not enabled for this school.
Ask the school administrator or SchoolOS support to enable this module.
[Back to Dashboard]
```

---

## 10. API and Data Fetching Rules

### 10.1 Next.js rules

- Server Components by default.
- Client Components only for interactivity and marked with `use client`.
- URL `searchParams` for filters and pagination.
- React Hook Form + Zod for critical forms.
- Error boundaries on major sections.
- Route protection via middleware and backend session checks, not only client guards.
- No raw tokens in browser storage.
- Minimal global state.
- No duplicate UI primitives.
- Shared primitives in `/components/ui`.
- Feature components under feature/module folders.

### 10.2 API client expectations

Recommended API structure:

```text
apps/web/lib/api/client.ts
apps/web/lib/api/auth.ts
apps/web/lib/api/platform.ts
apps/web/lib/api/students.ts
apps/web/lib/api/admissions.ts
apps/web/lib/api/attendance.ts
apps/web/lib/api/finance.ts
apps/web/lib/api/academics.ts
apps/web/lib/api/activity.ts
apps/web/lib/api/homework.ts
apps/web/lib/api/hr.ts
apps/web/lib/api/payroll.ts
apps/web/lib/api/library.ts
apps/web/lib/api/transport.ts
apps/web/lib/api/canteen.ts
apps/web/lib/api/accounting.ts
apps/web/lib/api/communications.ts
apps/web/lib/api/messaging.ts
apps/web/lib/api/learning.ts
apps/web/lib/api/reports.ts
apps/web/lib/api/settings.ts
```

Rules:

- Use existing client helpers.
- Do not duplicate contract types if they exist in `packages/core`.
- Keep OpenAPI and shared contracts in sync.
- Parse backend error envelopes consistently.
- File/blob downloads use authenticated helpers.
- Large exports use queued job/status UI when backend uses background jobs.
- Unknown route shapes are marked as `needs OpenAPI confirmation`.

### 10.3 Query state rules

For every query:

```text
loading -> success(empty/non-empty) -> error -> retry
```

For every mutation:

```text
idle -> confirming if high risk -> pending -> success/error -> refetch/invalidate
```

Financial/idempotent mutations also need:

```text
idempotency key / duplicate-safe backend behavior / pending state / receipt status
```

---

## 11. File Registry and Protected Downloads

File UI must follow this flow:

```text
User action
-> permission check by backend
-> File Registry lookup
-> short-lived preview/download response or blob helper
-> audit where required
-> safe browser action
```

Never:

```text
Expose objectKey
Expose provider bucket URL
Expose permanent signed URL
Open private file with raw window.open
Download protected file without authenticated helper
```

Protected file component states:

| State | Behavior |
|---|---|
| Ready | Preview/download button enabled. |
| Loading | Button disabled with progress label. |
| Permission denied | Button hidden or disabled with friendly message. |
| Missing | Show `File unavailable`. |
| Expired | Prompt refresh/refetch if supported. |
| Failed | Show retry and safe error. |

---

## 12. Form Design Rules

Critical forms include admissions, attendance corrections, fee payments, reversals, refunds, payroll, accounting journals, report-card publishing, settings, platform actions, and learning activity builder.

Form rules:

- Use clear sections.
- Use school labels.
- Required fields are visible before submit.
- Inline validation beside fields.
- Summary validation for long forms.
- Save buttons show pending state.
- Submit buttons disabled only while request is pending or form is invalid.
- Do not lose user input after recoverable errors.
- Destructive/high-risk forms require confirmation.
- Reason field required where audit policy requires it.
- Currency fields use backend Decimal/numeric truth.
- Dates show clear local school date context.

Long-form layout:

```text
Page Header
Progress / status banner
Form sections
Right summary panel
Sticky action bar: Cancel | Save Draft | Submit
```

---

## 13. Search and Filter Design

Global search should support:

```text
Student name
Admission number
Guardian phone
Invoice number
Receipt number
Staff name
Book barcode
Vehicle number
Notice title
```

Global search rules:

- Tenant-scoped.
- Role-scoped.
- Permission-filtered.
- Shows type labels.
- Does not expose forbidden record names.
- Opens safe detail route/drawer.

Filter rules:

- Use URL `searchParams` for lists where practical.
- Include reset/clear filters.
- Show active filter chips.
- Server-side filtering for growing data.
- Preserve filters across detail drawer open/close.

---

## 14. Main Dashboard Deep Design

The dashboard is not a place to show every module in depth. It is the school command center.

It answers:

```text
What is happening today?
What needs attention?
Which module needs action?
What can this user do quickly?
```

### 14.1 Dashboard layout

```text
Welcome / School Status Header
School-wide KPI Strip
Today's Operations
Pending Approvals and Alerts
Module Summary Grid
Recent Activity Timeline
Role-Based Quick Actions
Optional decision charts
```

### 14.2 Dashboard wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Good Morning, Principal                                                      │
│ Holyland Kids' Academy | Academic Year 2082/83 | School Open Today           │
│                                                        [Resolve Top Alert]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Students     │ │ Present Today│ │ Fees Today   │ │ Pending Tasks│
│ 1,250        │ │ 1,086 / 1250 │ │ Rs. 85,000   │ │ 17           │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Staff Present│ │ Notices Sent │ │ Active Trips │ │ Overdue Fees │
│ 72 / 80      │ │ 4            │ │ 5            │ │ Rs. 2,40,000 │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Today's Operations                    │ │ Pending Approvals & Alerts          │
│ Attendance     86% marked     [Open] │ │ Attendance corrections       5       │
│ Fees           Rs.85,000      [Open] │ │ Leave requests               3       │
│ Transport      5 active trips [Open] │ │ Fee discount requests        4       │
│ Canteen        145 served     [Open] │ │ Payroll run pending          1       │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Summary                                                               │
│ Admissions | Attendance | Fees | Academics | HR | Library | Transport | ...  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Recent Activity                       │ │ Quick Actions                       │
│ Payment received                      │ │ New Admission                        │
│ Attendance submitted                  │ │ Collect Fee                          │
│ Notice sent                           │ │ Create Notice                        │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

### 14.3 Dashboard API expectations

Dashboard must not deep-fetch every module. It should use:

- Dedicated summary APIs.
- Safe module summary metadata.
- Permission-filtered response shapes.
- Unavailable summary state when the summary endpoint is missing.

Dashboard must not show:

- Private payroll details.
- Private chat contents.
- Raw student-sensitive data.
- Locked module fake values.
- Finance totals if the user lacks permission.

---

## 15. Module Workspace Standards

The following sections define deeper web design expectations for each module. Existing backend contracts and OpenAPI output remain source of truth for exact fields.

Each module section includes:

```text
Purpose
Primary users
Recommended routes
Tabs
KPI cards
Main content
Drawers/modals
Primary action
Secondary actions
Protected file needs
States
Smoke checks
```

---

## 16. M1 Admissions and Student Profiles

### 16.1 Purpose

Manage the complete student lifecycle from inquiry/admission to student profile, guardians, documents, QR/ID card, lifecycle history, duplicate review, and iEMIS readiness.

### 16.2 Primary users

- Principal.
- School admin.
- Admission officer.
- Class teacher with limited assigned-scope access.

### 16.3 Recommended routes

```text
/dashboard/students
/dashboard/students/[studentId]
/dashboard/admissions
/dashboard/students/documents
/dashboard/students/duplicates
/dashboard/students/iemis
/dashboard/students/qr
```

### 16.4 Workspace structure

```text
Header: Admissions & Student Profiles
KPI: Active Students | New Admissions | Pending Applications | Missing Documents | Duplicate Candidates | iEMIS Issues
Tabs: Students | Admissions | Documents | Duplicates | iEMIS Export | QR / ID Cards
Filters: Search | Class | Section | Status | Document Status | Admission Status
Main: Student table or selected tab workspace
Drawer: Student quick view / document upload / duplicate review / QR preview
```

### 16.5 Student table columns

```text
Photo
Name
Admission No.
Class / Section
Guardian
Guardian phone
Status
Document status
QR status
Actions
```

Sensitive columns depend on permissions. Teachers with limited scope must not see unrelated students.

### 16.6 Admission workflow

```text
Create application
-> Save draft
-> Collect required documents
-> Review duplicate candidates
-> Accept / reject application
-> Convert accepted application to student
-> Assign class/section/academic year
-> Audit lifecycle event
```

UI requirements:

- Show admission status clearly.
- Duplicate warnings visible before conversion.
- Conversion action requires permission.
- Rejection requires reason.
- Draft recovery is visible if supported.

### 16.7 Student detail page

Student profile full page may include:

```text
Overview
Guardian & family
Academic enrollment
Documents
QR / ID card
Fees summary if permitted
Attendance summary if permitted
Activity/media summary if permitted
Lifecycle timeline
Audit history where permitted
```

### 16.8 Protected files

- Student photo.
- Birth certificate.
- Transfer certificate.
- Guardian ID.
- Previous marksheet.
- Medical document.
- ID card PDF.
- iEMIS export artifact.

### 16.9 States

- No students found.
- Missing documents.
- Duplicate candidates found.
- iEMIS fields incomplete.
- QR rotated/inactive/revoked.
- File unavailable.
- Permission denied.
- Module locked.

### 16.10 Smoke checks

- Admission officer can create application.
- Duplicate review does not cross tenants.
- Teacher cannot open unrelated student.
- Student document opens only through protected helper.
- iEMIS export uses File Registry artifact.

---

## 17. M2 Smart Attendance

### 17.1 Purpose

Enable fast daily attendance, monthly registers, corrections, offline draft visibility, lock-window handling, parent absence/late notification awareness, and attendance reports.

### 17.2 Primary users

- Class teacher.
- Subject teacher where allowed.
- Attendance officer.
- Principal / admin reviewer.

### 17.3 Recommended routes

```text
/dashboard/attendance
/dashboard/attendance/daily
/dashboard/attendance/register
/dashboard/attendance/corrections
/dashboard/attendance/offline-drafts
/dashboard/attendance/anomalies
/dashboard/attendance/reports
```

### 17.4 Workspace structure

```text
Header: Smart Attendance
KPI: Present Today | Absent | Late | Classes Not Marked | Correction Requests
Tabs: Daily Attendance | Monthly Register | Corrections | Offline Drafts | Anomalies | Reports
Filters: Date | Class | Section | Teacher | Status
Main: Attendance grid / monthly register / correction queue
Drawer: Student attendance detail / correction review / audit timeline
```

### 17.5 Daily attendance grid

Grid requirements:

- Class/section selector.
- Date selector.
- Student roster loaded from backend.
- Present/Absent/Late/Half-day/Leave status where supported.
- Remarks where allowed.
- Bulk present with confirmation if class already partially marked.
- Save draft only if backend supports it.
- Submit attendance with lock/status checks.

### 17.6 Correction flow

```text
Correction request
-> Compare old and new value
-> Reason required
-> Reviewer approve/reject
-> Audit event
-> Parent notification if applicable
```

### 17.7 States

- Attendance locked.
- Attendance already submitted.
- Empty roster.
- Unassigned class denied.
- Offline draft pending/synced/failed.
- Correction window expired.
- Export unavailable.

### 17.8 Smoke checks

- Teacher can mark assigned class only.
- Direct unassigned class route denies safely.
- Correction requires reason.
- Monthly register export uses protected helper.
- Locked date cannot be edited silently.

---

## 18. M3 Fees and Receipts

### 18.1 Purpose

Handle fee setup, invoices, payment collection, receipts, dues, discounts, refunds, reversals, cashier close, reminders, and reports.

### 18.2 Primary users

- Accountant.
- Cashier.
- Principal/owner with read/approval permissions.
- School admin.

### 18.3 Recommended routes

```text
/dashboard/fees
/dashboard/fees/dues
/dashboard/fees/invoices
/dashboard/fees/payments
/dashboard/fees/receipts
/dashboard/fees/discounts
/dashboard/fees/reversals
/dashboard/fees/cashier-close
/dashboard/fees/reports
```

### 18.4 Workspace structure

```text
Header: Fees & Receipts
KPI: Collected Today | Total Due | Overdue Students | Pending Reversals | Cashier Close Status
Tabs: Dues | Invoices | Payments | Receipts | Discounts | Refunds/Reversals | Cashier Close | Reports
Filters: Student | Class | Section | Due date | Status | Payment method
Main: Invoice/payment/receipt table or cashier counter
Drawer: Payment form / receipt preview / reversal reason / discount approval
```

### 18.5 Fee collection counter wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fee Collection Counter                                                       │
│ Search student, collect payment, and issue protected receipt.                 │
│                                                        [Record Payment]       │
└──────────────────────────────────────────────────────────────────────────────┘

Search: student name / admission no / guardian phone / invoice / receipt

┌─────────────────────────────┬────────────────────────────────────────────────┐
│ Student + Due Summary        │ Payment Form                                   │
│ Outstanding invoices         │ Amount, method, reference, date, note          │
│ Recent receipts              │ Receipt preview after confirmed payment        │
└─────────────────────────────┴────────────────────────────────────────────────┘
```

### 18.6 Money rules

- Backend owns official totals.
- Use Decimal/numeric values from backend.
- Do not use JS floating calculations as truth.
- Payment submit must be idempotent/backed by backend duplicate protection.
- Receipt appears only after confirmed backend success.
- Reversal/refund requires reason, permission, and audit.
- Cashier close shows expected vs actual with reason for difference.

### 18.7 Protected files

- Receipt PDF.
- Cashier close PDF.
- Day-end snapshot.
- Collection report export.

### 18.8 Smoke checks

- Cashier can collect payment but cannot reverse without permission.
- Receipt download uses protected helper.
- Double-click does not duplicate payment.
- Closed cashier window blocks unsafe edits.
- Accountant-only reports are permission-filtered.

---

## 19. M4 Academics, Exams, CAS, and Report Cards

### 19.1 Purpose

Manage academic setup, exam terms/components, marks entry, CAS, report-card generation, publishing, and parent published result visibility.

### 19.2 Primary users

- Academic coordinator.
- Principal.
- Subject teacher.
- Class teacher.

### 19.3 Recommended routes

```text
/dashboard/academics
/dashboard/academics/subjects
/dashboard/academics/exam-terms
/dashboard/academics/marks
/dashboard/academics/cas
/dashboard/academics/report-cards
/dashboard/academics/results
```

### 19.4 Workspace structure

```text
Header: Academics
KPI: Active Terms | Marks Pending | Draft Marks | Generated Report Cards | Publish Blockers
Tabs: Subjects | Exam Terms | Marks Entry | CAS | Report Cards | Results
Filters: Class | Section | Subject | Exam Term | Status
Main: Exam tables / marks grid / report-card batch table
Drawer: Exam component builder / report-card preview / publish confirmation / correction history
```

### 19.5 Marks grid rules

- Spreadsheet-style grid only where it improves speed.
- Save draft where supported.
- Submit for review if workflow exists.
- Row-level validation.
- Absent/withheld/retest states visible.
- Locked terms read-only.
- Teacher assigned-subject scope enforced.

### 19.6 Report-card rules

- Generate batch with progress/failure state.
- Preview protected PDF through helper.
- Publish/unpublish requires permission and confirmation.
- Parent sees published results only.
- Correction history visible where allowed.

### 19.7 Smoke checks

- Subject teacher cannot edit unassigned subject marks.
- Locked report card cannot be regenerated unsafely.
- Report-card PDF opens through protected helper.
- Publish action requires confirmation.
- Parent published-only rule preserved.

---

## 20. M5 Activity Feed and Milestones

### 20.1 Purpose

Manage classroom posts, activity media, approvals, consent-aware visibility, milestones, parent feed, and delivery/audience checks.

### 20.2 Recommended routes

```text
/dashboard/activity
/dashboard/activity/feed
/dashboard/activity/pending
/dashboard/activity/gallery
/dashboard/activity/milestones
/dashboard/activity/reports
```

### 20.3 Workspace structure

```text
Header: Activity Feed & Milestones
KPI: Posts Today | Pending Moderation | Consent-Blocked Media | Failed Deliveries | Milestones
Tabs: Feed | Pending Approval | Media Gallery | Milestones | Reports
Filters: Class | Section | Author | Status | Date | Consent state
Main: Feed/table hybrid, approval queue, media gallery, milestone cards
Drawer: Composer / approval review / audience preview / media preview
```

### 20.4 Consent and media rules

- Active-student tagging only.
- Consent warnings before publish.
- Parent sees linked-child and consent-safe media only.
- Removed guardians lose access.
- Media preview/download uses protected helper.
- Moderation actions audited.

### 20.5 Smoke checks

- Teacher post can enter pending approval.
- Consent-blocked media does not show to parent.
- Removed guardian denied media access.
- Approval/rejection requires reason where configured.
- Media object key never appears in UI.

---

## 21. M6 Homework and Timetable

### 21.1 Purpose

Handle homework assignment, submissions, review, reminders, attachments, timetable building, conflicts, substitutions, teacher availability, and workload.

### 21.2 Recommended routes

```text
/dashboard/homework
/dashboard/homework/submissions
/dashboard/timetable
/dashboard/timetable/builder
/dashboard/timetable/substitutions
/dashboard/timetable/workload
```

### 21.3 Workspace structure

```text
Header: Homework & Timetable
KPI: Homework Assigned | Due Soon | Pending Submissions | Timetable Conflicts | Substitutions
Tabs: Homework | Submissions | Timetable Builder | Substitution | Teacher Workload | Reports
Filters: Class | Section | Subject | Teacher | Due date | Status
Main: Homework table / submissions table / weekly timetable grid / conflict panel
Drawer: Homework detail / homework form / submission review / period editor / substitution dialog
```

### 21.4 Timetable builder rules

- Conflict panel visible while editing.
- Teacher conflict, room conflict, period conflict shown clearly.
- Publish/lock/archive require permission and audit.
- Substitution must respect teacher availability where backend supports it.
- Absent-teacher substitution task states visible.

### 21.5 Homework rules

- Attachments through File Registry.
- Due date and class/section visible.
- Parent/student see assigned published work only.
- Return-for-correction state visible where supported.
- Reminder status visible where backend exposes it.

---

## 22. M7 HR and Payroll

### 22.1 Purpose

Manage staff lifecycle, documents, contracts, attendance, leave, payroll runs, payslips, payroll reports, and staff self-service visibility.

### 22.2 Recommended routes

```text
/dashboard/hr
/dashboard/hr/staff
/dashboard/hr/contracts
/dashboard/hr/leave
/dashboard/hr/attendance
/dashboard/payroll
/dashboard/payroll/runs
/dashboard/payroll/payslips
/dashboard/payroll/reports
```

### 22.3 Workspace structure

```text
Header: HR & Payroll
KPI: Active Staff | On Leave Today | Pending Leave | Contract Expiring | Payroll Exceptions
Tabs: Staff | Contracts | Leave | Attendance | Payroll | Payslips | Reports
Filters: Staff | Department | Role | Status | Date | Payroll period
Main: Staff table / leave queue / payroll run wizard / payslip list
Drawer: Staff detail / leave approval / payslip preview / audit timeline
```

### 22.4 Salary privacy rules

- Salary and bank fields permission-gated.
- Staff self-service sees own masked data only.
- Payslip downloads use protected helper.
- Payroll posting/reversal audited.
- Payroll run has preview before post.
- Reversal/correction preferred over silent mutation.

---

## 23. M8A Library

### 23.1 Purpose

Manage books, copies, issue/return, overdues, fines, staff borrowers, QR/barcode scanner workflows, and reports.

### 23.2 Recommended routes

```text
/dashboard/library
/dashboard/library/catalog
/dashboard/library/copies
/dashboard/library/issue-return
/dashboard/library/overdue
/dashboard/library/fines
/dashboard/library/reports
```

### 23.3 Workspace structure

```text
Header: Library
KPI: Books | Available Copies | Issued | Overdue | Fines Pending
Tabs: Catalog | Copies | Issue/Return | Overdue | Fines | Reports
Filters: Search | Category | Availability | Borrower type | Due status
Main: Search-first book table / scanner issue-return panel / overdue report
Drawer: Book detail / copy detail / issue / return / archive reason
```

### 23.4 Scanner-first rule

Issue/return screen should optimize for counter workflow:

```text
Scan book copy
-> Scan/select borrower
-> Show eligibility/status
-> Confirm issue/return
-> Show receipt/status if supported
```

---

## 24. M8B Transport

### 24.1 Purpose

Manage routes, stops, vehicles, drivers, assignments, active trips, latest GPS status, alerts, and trip reports.

### 24.2 Recommended routes

```text
/dashboard/transport
/dashboard/transport/routes
/dashboard/transport/stops
/dashboard/transport/vehicles
/dashboard/transport/students
/dashboard/transport/trips
/dashboard/transport/gps-quality
/dashboard/transport/reports
```

### 24.3 Workspace structure

```text
Header: Transport
KPI: Active Trips | Assigned Students | Stale GPS | Delays | Vehicle Document Expiry
Tabs: Routes | Stops | Vehicles | Students | Trips | Location Status | Reports
Filters: Route | Vehicle | Driver | Trip status | GPS state
Main: Route/trip table, latest GPS status, assignments
Drawer: Route detail / trip detail / assign student / assign driver / trip history
```

### 24.4 Transport map rule

Live map/WebSocket/SSE UI is deferred unless backend/provider/load/privacy decisions are confirmed. Use latest GPS/status tables first.

---

## 25. M8C Canteen

### 25.1 Purpose

Manage POS, serving, menu, wallets, meal plans, inventory, vendors, receipts, allergy warnings, and reports.

### 25.2 Recommended routes

```text
/dashboard/canteen
/dashboard/canteen/pos
/dashboard/canteen/serving
/dashboard/canteen/menu
/dashboard/canteen/wallets
/dashboard/canteen/inventory
/dashboard/canteen/vendors
/dashboard/canteen/reports
```

### 25.3 Workspace structure

```text
Header: Canteen
KPI: Meals Served | Sales Today | Low Wallets | Stock Low | Allergy Warnings
Tabs: POS | Serving | Menu | Wallets | Inventory | Vendors | Reports
Filters: Student | Class | Menu item | Wallet status | Date
Main: Touch-friendly POS/serving panel, menu grid, wallet table, stock panels
Drawer: QR serve panel / wallet top-up / sale refund / stock adjustment / receipt preview
```

### 25.4 Serving rules

- Allergy/medical warning visible before serving.
- Staff acknowledgement required before submit where backend requires it.
- Wallet debit is backend atomic truth.
- Duplicate serve state handled.
- Receipt/proof uses protected helper.

---

## 26. M9 Accounting and Finance

### 26.1 Purpose

Manage chart of accounts, journals, ledgers, fiscal periods, reports, exports, reconciliation, source mapping, and accounting audit trail.

### 26.2 Recommended routes

```text
/dashboard/accounting
/dashboard/accounting/chart-of-accounts
/dashboard/accounting/journals
/dashboard/accounting/ledger
/dashboard/accounting/trial-balance
/dashboard/accounting/reports
/dashboard/accounting/reconciliation
/dashboard/accounting/period-close
```

### 26.3 Workspace structure

```text
Header: Accounting
KPI: Fiscal Year Status | Pending Journals | Unreconciled Items | Export Jobs | Mapping Issues
Tabs: Dashboard | Chart of Accounts | Journals | Ledger | Trial Balance | Reports | Reconciliation | Period Close
Filters: Fiscal year | Period | Account | Source | Status
Main: Journal table / COA tree / ledger panel / reconciliation split view / report preview
Drawer: Journal detail / post-reverse dialog / account detail / reconciliation match detail
```

### 26.4 Accounting rules

- No client-owned accounting truth.
- Posted records use reversal/correction flow.
- Period close/reopen high risk with reason.
- Large exports use File Registry and job status.
- Reconciliation suggestions must not auto-post without user confirmation and backend audit.

---

## 27. M10 Notices, Communication, and Chat

### 27.1 Purpose

Manage notices, recipient preview, templates, scheduled delivery, provider diagnostics, delivery logs, notification center, and controlled parent-teacher chat.

### 27.2 Recommended routes

```text
/dashboard/notices
/dashboard/notices/compose
/dashboard/notices/delivery
/dashboard/notices/templates
/dashboard/messages
/dashboard/messages/escalations
/dashboard/communications/providers
```

### 27.3 Workspace structure

```text
Header: Notices & Communication
KPI: Sent Today | Scheduled | Failed Deliveries | Unread High-Impact | Escalated Chats
Tabs: Notices | Compose | Chat | Recipients | Delivery Logs | Templates | Provider Diagnostics
Filters: Audience | Channel | Status | Date | Priority
Main: Notice list/composer, audience preview, delivery status, chat inbox
Drawer: Recipient selector / send confirmation / delivery log / escalation review
```

### 27.4 Chat rules

- Quiet hours visible and enforced by backend.
- Parent-teacher scope only where allowed.
- Personal data sharing warnings where policy requires.
- Attachments use File Registry.
- Escalation/report actions audited.
- Delivery retry requires safe provider state and reason where configured.

---

## 28. M12 Learning Layer

### 28.1 Purpose

Support teacher-controlled learning activities, board/lab sessions, resources, attempts, progress, and parent/student child/self-scoped summaries.

### 28.2 Recommended routes

```text
/dashboard/learning
/dashboard/learning/activities
/dashboard/learning/activities/[activityId]
/dashboard/learning/sessions
/dashboard/learning/resources
/dashboard/learning/progress
/classroom/board/session/[sessionId]
/student/learning/session/[sessionId]
```

### 28.3 Workspace structure

```text
Header: Learning
KPI: Live Sessions | Published Activities | Active Participants | Submitted Attempts | Needs-Practice Summary
Tabs: Activities | Sessions | Resources | Progress
Filters: Class | Section | Subject | Activity type | Status
Main: Activity table / activity builder / resource library / session monitor / progress table
Drawer: Activity preview / resource picker / launch session / participant monitor / attempt review
```

### 28.4 Learning rules

- Teacher assigned-scope.
- Resources protected.
- Student runtime is active-session only.
- Parent sees own child only.
- Student sees own attempt/result only.
- No public leaderboard.
- No AI tutor/runtime.
- Use supportive, non-comparative language.

---

## 29. School Settings

Settings controls one school's configuration, not daily operations.

### 29.1 Settings wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Settings                                                                     │
│ Configure school profile, academic years, users, permissions, modules,        │
│ notifications, templates, and school rules.                     [Save]       │
└──────────────────────────────────────────────────────────────────────────────┘

Search settings...

┌──────────────────────────┬───────────────────────────────────────────────────┐
│ Settings Menu             │ Settings Content                                  │
│ School Profile            │ Selected settings page                            │
│ Academic Years            │                                                   │
│ Classes & Sections        │                                                   │
│ Users                     │                                                   │
│ Roles & Permissions       │                                                   │
│ Modules                   │                                                   │
│ Fee Settings              │                                                   │
│ Attendance Settings       │                                                   │
│ Exam Settings             │                                                   │
│ Notification Settings     │                                                   │
│ Templates                 │                                                   │
│ File & Documents          │                                                   │
│ Security                  │                                                   │
│ Integrations              │                                                   │
│ Backup & Export           │                                                   │
│ Audit Log                 │                                                   │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

### 29.2 Settings rules

- All settings mutations audited.
- Sensitive settings require reason/confirmation.
- Module visibility does not override SaaS entitlement.
- Provider secrets masked.
- Logo/file settings use File Registry.
- Backup restore is high risk.
- Platform settings never appear here.

---

## 30. Platform Control Plane

Platform is for SchoolOS operators, not school users.

### 30.1 Platform routes

```text
/platform
/platform/tenants
/platform/tenants/new
/platform/tenants/[tenantId]
/platform/plans
/platform/billing
/platform/module-access
/platform/feature-flags
/platform/admins
/platform/rbac-templates
/platform/file-registry
/platform/audit-logs
/platform/system-health
/platform/queues
/platform/storage
/platform/backups
/platform/support
/platform/settings
/platform/demo-requests
```

### 30.2 Platform shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform Top Bar                                                             │
│ SchoolOS Platform | Environment | Search | Alerts | Platform User            │
├───────────────────┬──────────────────────────────────────────────────────────┤
│ Platform Aside    │ Platform Main Workspace                                  │
│ Attention         │ Selected platform workspace                              │
│ Schools           │                                                          │
│ Plans & Billing   │                                                          │
│ Providers         │                                                          │
│ Queues            │                                                          │
│ Audit             │                                                          │
│ Support Override  │                                                          │
│ Demo Requests     │                                                          │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

### 30.3 Platform high-risk actions

High-risk platform actions require:

1. Permission.
2. Reason.
3. Confirmation.
4. Impact preview.
5. Audit log.
6. Visible support override state where relevant.

Examples:

- Suspend tenant.
- Disable module.
- Retry/discard failed jobs.
- Restore backup.
- Enter support override.
- Force logout.
- Delete platform admin.
- Enable maintenance mode.

---

## 31. Reports and Exports

Reports and exports must be designed as real workflows, not raw file links.

Report lifecycle:

```text
Request report
-> Validate filters and permissions
-> Generate immediately or queue job
-> Show status
-> Download through protected helper
-> Show audit/export history where relevant
```

Report screen requirements:

- Clear filters.
- Clear date/fiscal period context.
- Show report status.
- Export button disabled while generating.
- Show queued job state for long reports.
- Show failed state with safe diagnostics.
- Use File Registry artifacts for retained exports.

---

## 32. Accessibility and Usability

Minimum requirements:

- Keyboard-reachable dialogs, menus, selects, tabs, and sheets.
- Visible focus states.
- Labeled form inputs.
- Inline validation messages.
- Tables with clear headers.
- Status not communicated by color only.
- Icon-only buttons require `aria-label`.
- Destructive actions not placed next to safe actions without separation.
- Touch/click targets large enough for school office use.
- Long tables remain readable on laptops.
- Print/download actions labelled clearly.

---

## 33. Web Persona Matrix

| Persona | Home focus | Allowed examples | Denied examples |
|---|---|---|---|
| Platform Operator | Platform attention | Tenants, provider readiness, queues, support tools | School fee collection as cashier |
| Principal | School attention | Approvals, attendance risk, summaries, reports | Payroll salary details without permission |
| School Admin | Daily operations | Students, attendance, notices, settings | Platform billing |
| Admission Officer | Student intake | Applications, documents, duplicates, iEMIS | Payroll/accounting journals |
| Class Teacher | Class work | Assigned attendance, homework, class students | Unassigned class data |
| Subject Teacher | Subject work | Assigned marks/homework | Other subject marks |
| Accountant | Fees/accounting | invoices, reports, journals where permitted | Platform queue operations |
| Cashier | Counter collection | Collect payment, print receipt | Reverse/refund without permission |
| HR / Payroll | Staff/payroll | Staff, leave, payroll | Student fee reversal unless permitted |
| Librarian | Circulation | Books, issue/return, overdue | Payroll/accounting |
| Transport Manager | Routes/trips | Vehicles, routes, assignments | Student academic reports |
| Canteen Staff | POS/serving | Serve meals, wallet status | Student private documents |
| Parent Web User | Own child | Published reports, receipts, homework | Other child/internal reports |
| Student Lab User | Active session | Own activity attempt | Dashboard/admin routes |

---

## 34. Web Persona Smoke Expectations

Every persona smoke should prove:

1. User can log in.
2. User lands on the correct dashboard/surface.
3. Navigation matches role permissions.
4. Hidden modules are not visible.
5. Direct forbidden routes show safe state.
6. Allowed tenant records are visible.
7. Unallowed records are not visible.
8. Allowed actions work with loading/success/error handling.
9. Forbidden actions are hidden and backend-blocked if attempted.
10. Protected files require authenticated access.
11. Logout/session expiry returns safely to login.

Cross-persona security checks:

```text
Parent cannot access another parent's child.
Student lab user cannot access another student's attempt/progress.
Teacher cannot access another class unless assigned or explicitly permitted.
Subject teacher cannot enter marks for unassigned subject.
Cashier cannot reverse/refund without permission.
Principal cannot view salary details without payroll permission.
Platform operator cannot view tenant-private data without support override.
Module-locked route shows ModuleLockedState and backend blocks action.
```

---

## 35. Implementation Order

Use this order for web frontend work:

1. **W1 Shared UI foundation and shell standardization**
   - Shared states.
   - Topbar/sidebar shell.
   - Role/module navigation.
   - Protected file components.
   - Table/filter primitives.
   - Dialog/reason patterns.

2. **W2 Main dashboard command center**
   - Real summaries or unavailable states.
   - Role quick actions.
   - Pending approvals.
   - Recent activity.

3. **W3 High-use daily modules**
   - M1 Students/Admissions.
   - M2 Attendance.
   - M3 Fees.
   - M4 Academics/Report Cards.
   - M10 Notices/Communication.

4. **W4 Operational modules**
   - M6 Homework/Timetable.
   - M7 HR/Payroll.
   - M8A Library.
   - M8B Transport.
   - M8C Canteen.

5. **W5 Accounting, Learning, Settings, Platform**
   - M9 Accounting.
   - M12 Learning.
   - School Settings.
   - Platform Control Plane.

6. **W6 Polish and verification**
   - Accessibility.
   - Browser E2E.
   - Contract verification.
   - Permission/module locked states.
   - Staging smoke.

---

## 36. Web Acceptance Checklist

Before marking any web module complete:

```text
[ ] Uses real backend APIs only.
[ ] No fake/mock/placeholder production data.
[ ] Tenant-scoped API calls and backend checks confirmed.
[ ] RBAC and module entitlement states handled.
[ ] Direct forbidden route shows safe state.
[ ] Loading, empty, error, success, permission, and locked states exist.
[ ] Lists are paginated and filtered server-side where needed.
[ ] Protected files use authenticated helpers.
[ ] Mutations show pending/success/error state.
[ ] High-risk mutations require confirmation and reason where required.
[ ] Financial totals come from backend.
[ ] Audit-sensitive action has UI reason and backend audit support.
[ ] No raw Prisma/storage/provider errors exposed.
[ ] No raw object keys or signed URLs displayed.
[ ] Accessibility basics checked.
[ ] Browser smoke route added or updated where useful.
```

---

## 37. Verification Commands

For docs-only changes, no runtime commands are required.

For frontend implementation changes, run relevant gates and do not claim passing unless actually run:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

Web-specific checks:

```bash
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
```

---

## 38. Web Risks

| Risk | Prevention |
|---|---|
| Tenant leakage | Backend tenant scope, purpose-limited DTOs, persona smoke. |
| Fake dashboard data | Real summary APIs or unavailable state. |
| Client-owned money truth | Backend Decimal/numeric totals only. |
| Raw file URL exposure | Protected helper components only. |
| Permission confusion | Safe forbidden and locked states. |
| Platform/school settings mixing | Separate `/platform/*` and `/dashboard/settings/*`. |
| Support override misuse | Visible override banner, reason, expiry, audit. |
| Long dashboard load | Do not deep-fetch every module. |
| Duplicate UI primitives | Shared components in `/components/ui`. |
| Admin-shaped parent/student data | Purpose-limited APIs and smoke tests. |
| AI scope creep | Keep M11 roadmap only. |
| Destructive action mistakes | Confirm, reason, impact preview, audit. |

---

## 39. Final Web Mindset

Every web screen either earns or erodes school trust.

School staff should feel:

```text
I know where I am.
I know what needs attention.
I know what action is safe.
I understand why something is blocked.
I can trust the numbers and files shown here.
```

That is the standard for SchoolOS web frontend design.
