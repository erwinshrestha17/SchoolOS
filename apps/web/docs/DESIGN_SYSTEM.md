# SchoolOS Web Design System

**Status:** Active design-system guidance for `apps/web`.

**Source:** Derived from the SchoolOS Web Frontend Design Plan.

**Purpose:** Give Next.js implementers and Codex a stable web UI/UX standard for SchoolOS dashboard, settings, platform, reports, protected files, and dense school operation workspaces.

---

## 1. Web Design North Star

SchoolOS web is the daily command center for Nepal schools.

It should feel like:

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

Core design principle:

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

---

## 2. Web Surface Boundaries

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

## 3. Non-Negotiable Web Guardrails

### 3.1 Security and tenant isolation

- Keep `tenantId` as the tenant boundary everywhere.
- Backend RBAC, tenant scope, module entitlement, and route guards are the source of truth.
- Frontend hiding is only UX; it is never security.
- Every API call must rely on authenticated session context and backend authorization.
- Do not expose internal IDs unless the existing API contract already safely exposes them for UI routing.
- Never expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session web routes must use purpose-limited data, not admin-shaped payloads.

### 3.2 Data truth

- Real APIs only.
- No fake frontend data.
- No placeholder production metrics.
- No browser-only production state.
- No client-side money truth.
- No client-calculated official attendance/fees/payroll/accounting totals.
- Growing lists must be paginated and filtered server-side.
- Dashboard summaries may show unavailable states if a summary API is missing.

### 3.3 Protected files

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

### 3.4 Architecture boundaries

- Keep Next.js in `apps/web`.
- No Angular migration.
- No microservices.
- No AI runtime or M11 UI until explicitly approved.
- Keep SchoolOS as a modular monolith from the frontend user's point of view.
- Cross-module UI aggregation must call defined APIs, not invent backend shortcuts.

---

## 4. UX Language

SchoolOS is used by real school staff, not just technical users.

Use school-friendly copy:

```text
Save failed. Please check the highlighted fields.
You do not have permission to reverse payments. Please contact the school administrator.
This module is not enabled for this school.
Receipt download is unavailable right now.
Attendance is locked for this date.
This report is being prepared. You can download it when it is ready.
```

Avoid exposing technical copy:

```text
403 Forbidden
Mutation failed
Unhandled exception
PrismaClientKnownRequestError
Entity not found
Invalid payload
Object key missing
```

Prefer school terms:

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

## 5. Visual Direction

### 5.1 Look and feel

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

### 5.2 Base tokens

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

### 5.3 Module accents

Module accents identify location. They must not replace semantic status colors.

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

## 6. Global Layout System

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

### 6.1 Topbar

Topbar contains global context only:

- SchoolOS identity.
- School switcher where the user has access to multiple schools.
- Academic year switcher where academic-year context matters.
- Global search.
- Notification center.
- Support override banner if active.
- User menu.

Topbar must not contain module-specific primary actions except global search and notifications.

### 6.2 Sidebar

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

### 6.3 Page header

Every page header should have:

```text
Title
One-line purpose
One primary action
More Actions menu for secondary actions
Optional help/status badge
```

Header rules:

- One primary action per screen.
- Put import/export/history/template actions in `More Actions`.
- Do not put five equal buttons in the header.
- Destructive actions must not be primary header actions.
- High-risk actions need confirmation and reason.

---

## 7. Page Composition Patterns

### 7.1 Standard module workspace

```text
ModuleHeader
KpiGrid / SummaryStrip
Tabs
FilterBar
MainContent
DetailDrawer / Modal / Wizard
Audit / Export / Protected File Actions
```

### 7.2 Standard list workspace

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

### 7.3 Standard workflow workspace

Used for admission, payment, payroll run, timetable builder, report-card generation, reconciliation, and import review.

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

### 7.4 Standard dashboard card

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

### 7.5 Right drawer pattern

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

## 8. Required Screen States

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

Empty state template:

```text
No students found
Try changing your filters or add a new student admission.
[New Admission]
```

Permission state template:

```text
You do not have permission to reverse payments.
Please contact the school administrator if you need this access.
[Back to Fees]
```

Module locked state template:

```text
Transport is not enabled for this school.
Ask the school administrator or SchoolOS support to enable this module.
[Back to Dashboard]
```

---

## 9. API and Data Fetching Rules

### 9.1 Next.js rules

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

### 9.2 API client expectations

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

### 9.3 Query and mutation states

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

## 10. File Registry and Protected Downloads

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

## 11. Form Design Rules

Critical forms include admissions, attendance corrections, fee payments, reversals, refunds, payroll, accounting journals, report-card publishing, settings, platform actions, and learning activity builder.

Rules:

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

## 12. Search and Filter Design

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

## 13. Main Dashboard Standard

The dashboard is not a place to show every module in depth. It is the school command center.

It answers:

```text
What is happening today?
What needs attention?
Which module needs action?
What can this user do quickly?
```

Dashboard layout:

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

Dashboard API rules:

- Use dedicated summary APIs.
- Use safe module summary metadata.
- Use permission-filtered response shapes.
- Show unavailable summary state when the summary endpoint is missing.
- Do not deep-fetch every module.
- Do not show private payroll details.
- Do not show private chat contents.
- Do not show raw student-sensitive data.
- Do not show locked module fake values.
- Do not show finance totals if the user lacks permission.

---

## 14. Module Workspace Standards

Each module should define:

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

### 14.1 M1 Admissions and Student Profiles

Purpose: manage the complete student lifecycle from inquiry/admission to student profile, guardians, documents, QR/ID card, lifecycle history, duplicate review, and iEMIS readiness.

Recommended routes:

```text
/dashboard/students
/dashboard/students/[studentId]
/dashboard/admissions
/dashboard/students/documents
/dashboard/students/duplicates
/dashboard/students/iemis
/dashboard/students/qr
```

Key rules:

- Teacher limited scope must not see unrelated students.
- Duplicate warnings visible before conversion.
- Conversion action requires permission.
- Rejection requires reason.
- Student documents use protected helpers.

### 14.2 M2 Smart Attendance

Purpose: fast daily attendance, monthly registers, corrections, offline draft visibility, lock-window handling, absence/late notification awareness, and reports.

Key rules:

- Teacher can mark assigned class only.
- Direct unassigned class route denies safely.
- Correction requires reason.
- Locked date cannot be edited silently.
- Monthly register export uses protected helper.

### 14.3 M3 Fees and Receipts

Purpose: fee setup, invoices, payment collection, receipts, dues, discounts, refunds, reversals, cashier close, reminders, and reports.

Money rules:

- Backend owns official totals.
- Use Decimal/numeric values from backend.
- Do not use JS floating calculations as truth.
- Payment submit must be idempotent/backed by backend duplicate protection.
- Receipt appears only after confirmed backend success.
- Reversal/refund requires reason, permission, and audit.
- Cashier close shows expected vs actual with reason for difference.

### 14.4 M4 Academics, Exams, CAS, and Report Cards

Key rules:

- Subject teacher cannot edit unassigned subject marks.
- Locked report card cannot be regenerated unsafely.
- Report-card PDF opens through protected helper.
- Publish action requires confirmation.
- Parent published-only rule preserved.

### 14.5 M5 Activity Feed and Milestones

Key rules:

- Active-student tagging only.
- Consent warnings before publish.
- Parent sees linked-child and consent-safe media only.
- Removed guardians lose access.
- Media preview/download uses protected helper.
- Moderation actions audited.

### 14.6 M6 Homework and Timetable

Key rules:

- Conflict panel visible while editing.
- Teacher conflict, room conflict, and period conflict shown clearly.
- Publish/lock/archive require permission and audit.
- Attachments use File Registry.
- Parent/student see assigned published work only.

### 14.7 M7 HR and Payroll

Key rules:

- Salary and bank fields permission-gated.
- Staff self-service sees own masked data only.
- Payslip downloads use protected helper.
- Payroll posting/reversal audited.
- Payroll run has preview before post.
- Reversal/correction preferred over silent mutation.

### 14.8 M8A Library

Key rules:

- Optimize issue/return for scanner-first counter workflow.
- Show borrower eligibility/status before confirming.
- Confirm issue/return and show receipt/status if supported.

### 14.9 M8B Transport

Key rules:

- Use latest GPS/status tables first.
- Live map/WebSocket/SSE UI is deferred unless backend/provider/load/privacy decisions are confirmed.
- Transport data must not expose unrelated student academic or private details.

### 14.10 M8C Canteen

Key rules:

- Allergy/medical warning visible before serving.
- Staff acknowledgement required before submit where backend requires it.
- Wallet debit is backend atomic truth.
- Duplicate serve state handled.
- Receipt/proof uses protected helper.

### 14.11 M9 Accounting and Finance

Key rules:

- No client-owned accounting truth.
- Posted records use reversal/correction flow.
- Period close/reopen is high risk and requires reason.
- Large exports use File Registry and job status.
- Reconciliation suggestions must not auto-post without user confirmation and backend audit.

### 14.12 M10 Notices, Communication, and Chat

Key rules:

- Quiet hours visible and enforced by backend.
- Parent-teacher scope only where allowed.
- Personal data sharing warnings where policy requires.
- Attachments use File Registry.
- Escalation/report actions audited.
- Delivery retry requires safe provider state and reason where configured.

### 14.13 M12 Learning Layer

Key rules:

- Teacher assigned-scope.
- Resources protected.
- Student runtime is active-session only.
- Parent sees own child only.
- Student sees own attempt/result only.
- No public leaderboard.
- No AI tutor/runtime.
- Use supportive, non-comparative language.

---

## 15. School Settings

Settings controls one school's configuration, not daily operations.

Rules:

- All settings mutations audited.
- Sensitive settings require reason/confirmation.
- Module visibility does not override SaaS entitlement.
- Provider secrets masked.
- Logo/file settings use File Registry.
- Backup restore is high risk.
- Platform settings never appear here.

---

## 16. Platform Control Plane

Platform is for SchoolOS operators, not school users.

Platform route family:

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

## 17. Reports and Exports

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

## 18. Accessibility and Usability

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

## 19. Web Persona Rules

| Persona | Home focus | Allowed examples | Denied examples |
|---|---|---|---|
| Platform Operator | Platform attention | Tenants, provider readiness, queues, support tools | School fee collection as cashier |
| Principal | School attention | Approvals, attendance risk, summaries, reports | Payroll salary details without permission |
| School Admin | Daily operations | Students, attendance, notices, settings | Platform billing |
| Admission Officer | Student intake | Applications, documents, duplicates, iEMIS | Payroll/accounting journals |
| Class Teacher | Class work | Assigned attendance, homework, class students | Unassigned class data |
| Subject Teacher | Subject work | Assigned marks/homework | Other subject marks |
| Accountant | Fees/accounting | Invoices, reports, journals where permitted | Platform queue operations |
| Cashier | Counter collection | Collect payment, print receipt | Reverse/refund without permission |
| HR / Payroll | Staff/payroll | Staff, leave, payroll | Student fee reversal unless permitted |
| Librarian | Circulation | Books, issue/return, overdue | Payroll/accounting |
| Transport Manager | Routes/trips | Vehicles, routes, assignments | Student academic reports |
| Canteen Staff | POS/serving | Serve meals, wallet status | Student private documents |
| Parent Web User | Own child | Published reports, receipts, homework | Other child/internal reports |
| Student Lab User | Active session | Own activity attempt | Dashboard/admin routes |

---

## 20. Implementation Order

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

## 21. Web Acceptance Checklist

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

## 22. Final Web Standard

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
