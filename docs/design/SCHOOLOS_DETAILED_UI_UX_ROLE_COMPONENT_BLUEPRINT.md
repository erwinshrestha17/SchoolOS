# SchoolOS Detailed UI/UX Role and Component Blueprint

**Status:** Detailed companion blueprint to `docs/design/SCHOOLOS_UI_UX_GUIDE.md`  
**Last updated:** 2026-06-15  
**Purpose:** Expand the SchoolOS UI/UX guide with CTO, CEO, product design, senior frontend, and senior UI/UX decisions for components, professional module design, role-based screens, web/mobile access, and data visibility.

This document does **not** replace the main UI/UX guide. The main guide remains the source of truth. This document gives deeper implementation guidance for frontend squads and Codex agents.

---

## 1. Executive Product Decision

SchoolOS must be designed as a serious school operating system for Nepal schools, not as a generic SaaS dashboard.

The product must feel:

```text
Trustworthy
School-friendly
Calm
Fast
Role-aware
Audit-safe
Nepal-ready
Professional enough for owners and principals
Simple enough for teachers, parents, drivers, and canteen/library staff
```

The UI must avoid two extremes:

| Bad extreme | Why it is bad for SchoolOS |
|---|---|
| Generic admin dashboard kit | Looks like any SaaS app, does not understand school workflows, creates inconsistent audit/permission behavior. |
| Over-custom decorative UI | Hard to maintain, inconsistent, slow, confusing for non-technical school users. |

Final direction:

```text
Custom SchoolOS design system + approved headless/behavior dependencies + real backend APIs + role-based screen design.
```

---

## 2. Component Architecture Strategy

### 2.1 Final rule

```text
Build SchoolOS-owned components. Use dependencies only behind SchoolOS wrappers.
```

SchoolOS should not directly build pages using provider components such as `AntTable`, `MuiCard`, `MantineSelect`, or random dashboard-kit widgets. If a dependency is used, it should power behavior under a SchoolOS component API.

### 2.2 Component layers

| Layer | Location | Ownership | Examples | Rule |
|---|---|---|---|---|
| Primitive UI components | `apps/web/components/ui` | SchoolOS-owned, shadcn/Radix-inspired | Button, Dialog, Select, Tabs, Tooltip, Popover, Skeleton | Used across the app. Styled with SchoolOS tokens. |
| Layout components | `apps/web/components/layout` | SchoolOS-owned | AppShell, PlatformShell, Sidebar, Topbar, PageHeader, Breadcrumbs | Must understand tenant, role, platform/school separation. |
| Data components | `apps/web/components/data` or `ui` | SchoolOS-owned wrappers | DataTable, Pagination, FilterBar, SearchInput, ExportButton | May use TanStack Table/Query internally. |
| State components | `apps/web/components/states` or `ui` | SchoolOS-owned | LoadingState, EmptyState, ErrorState, PermissionState, ModuleLockedState | Must use school-friendly wording. |
| Domain components | `apps/web/components/<module>` | SchoolOS-owned | FeeCollectionPanel, AttendanceRegister, TimetableGrid | Must encode workflow UI, not backend business rules. |
| Page workspaces | `apps/web/components/<module>` | SchoolOS-owned | StudentsWorkspace, PayrollRunDetail, TransportOpsWorkspace | One main job per screen. |

### 2.3 Build vs dependency decision table

| Component/pattern | Build custom? | Dependency allowed? | Final SchoolOS decision |
|---|---:|---:|---|
| App shell/sidebar/topbar | Yes | No provider shell | Build custom. This is product identity and access control surface. |
| Cards/stat cards | Yes | No provider card system | Build custom with SchoolOS tokens and module accents. |
| Tables | Yes wrapper | Yes, TanStack Table inside | Build `DataTable`; use TanStack Table only for complex table mechanics. |
| Filters | Yes | No generic provider filter kit | Build `FilterBar`, `FilterField`, `SavedFilterBar` later. |
| Search | Yes | Optional command primitive | Build `SearchInput` and `CommandSearch`; global search stays SchoolOS-owned. |
| Pagination | Yes | No direct provider pagination | Build `PaginationControls` backed by API metadata. |
| Breadcrumbs | Yes | No | Build custom human-readable breadcrumbs. |
| Dropdown/action menus | Yes wrapper | Yes, Radix/shadcn under hood | Build `ActionMenu`, `MoreActionsMenu`; dangerous actions route to `AuditReasonDialog`. |
| Dialogs/sheets/popovers/tooltips | Yes wrapper | Yes, Radix/shadcn under hood | Use accessible primitives, styled and named as SchoolOS components. |
| Forms | Yes form layouts | Yes, React Hook Form + Zod | Build SchoolOS form components and use RHF/Zod internally. |
| Charts | Yes wrapper | Yes, one approved chart library | Build `SchoolOSChart`; never compute official totals only in browser. |
| Calendar/date picker | Yes wrapper | Yes, accessible primitive | Build date components that can later support Bikram Sambat. |
| Toasts | Yes wrapper | Yes, Sonner-like library if already aligned | Toasts are feedback only, not primary error handling. |
| Icons | No custom icon pack | Yes, Lucide | Use Lucide consistently; do not mix many icon sets. |

### 2.4 Dependency approval governance

A UI dependency can be added only if it passes this checklist:

```text
1. It solves a repeated product problem.
2. It improves accessibility, performance, reliability, or developer velocity.
3. It can be hidden behind a SchoolOS wrapper.
4. It works with Next.js App Router and React 19.
5. It can be styled fully with SchoolOS tokens.
6. It does not force its own design language.
7. It does not duplicate an existing SchoolOS component.
8. It has acceptable bundle size and tree-shaking.
9. It has acceptable license and maintenance status.
10. It does not move security, permissions, tenancy, or business rules into UI-only code.
```

Forbidden as primary UI system:

```text
Material UI
Ant Design
Mantine
Chakra UI
Bootstrap dashboard kits
Paid dashboard templates
Random Tailwind component packs copied into modules
```

Allowed under wrappers:

```text
Radix/shadcn-style primitives
TanStack Query
TanStack Table
React Hook Form
Zod
Lucide icons
clsx / tailwind-merge
class-variance-authority
A single approved chart library later if needed
```

---

## 3. Professional Component Rules by Pattern

### 3.1 DataTable

`DataTable` is mandatory for dense desktop school-office lists.

Required features:

```text
Loading skeleton
Empty state
Error state with retry
Permission state
Module locked state
Backend pagination
Column labels in school language
Row action menu
Optional bulk action bar
Optional export action when backend supports it
Sticky header only where useful
Responsive mobile fallback
```

Rules:

| Rule | Explanation |
|---|---|
| Backend pagination first | Do not fetch thousands of students, receipts, journals, or attendance rows just to paginate in the browser. |
| School labels | Use `Student`, `Guardian Phone`, `Class`, `Section`, `Due Amount`; never technical field names. |
| Row actions | Keep primary row action visible; put secondary actions in `More`. |
| Dangerous actions | Transfer, archive, reverse, cancel, post, approve, reject, retry, delete must open confirmation/reason dialog where required. |
| Money columns | Use `MoneyDisplay`, right alignment, tabular numbers, NPR label. |
| Status columns | Use semantic `StatusBadge`; do not rely only on color. |
| Export | Use authenticated blob/download helper only. |

Module table behavior:

| Module | Table style |
|---|---|
| Students | Search-heavy, profile-first, filters by class/section/status. |
| Admissions | Pipeline/status-focused, duplicate/document warnings. |
| Attendance | Date/class matrix and monthly register layouts. |
| Fees | Money-first, due/payment/receipt clarity. |
| Academics | Grid-heavy for marks/CAS; strong validation. |
| HR/Payroll | Confidential columns, approval step visibility. |
| Library | Barcode/copy state focused. |
| Transport | Route/trip status and safety signals. |
| Canteen | Fast scan/POS status, inventory table for managers. |
| Accounting | Ledger accuracy, fiscal period, debit/credit clarity. |

### 3.2 FilterBar

Filters should match how schools think, not how database fields are named.

Common filters:

```text
Academic year
Class
Section
Student
Guardian phone
Admission status
Date
Month
Exam term
Subject
Staff
Route
Vehicle
Payment mode
Receipt number
Fiscal year
Accounting period
Status
```

Rules:

```text
1. Put filters below the page header, not hidden deep inside tables.
2. Preserve filters when returning from detail screens where useful.
3. Use dependent filters: class -> section -> student.
4. Use sensible defaults: today for attendance, current month for fees, current academic year for students.
5. Do not show filters the current role cannot use.
6. Show active filter count and clear filters action.
7. Avoid more than 5 visible filters on first row; move advanced filters behind expandable panel.
```

### 3.3 Search

Search levels:

| Search type | Component | Use case |
|---|---|---|
| Local page search | `SearchInput` | Searching current table/list. |
| Global command search | `CommandSearch` | Finding student, staff, invoice, receipt, book, vehicle, notice. |
| Scanner search | `ScannerSearchInput` later | QR/barcode workflows for library, canteen, transport, student QR. |

Global search must support:

```text
Student name
Admission number
Guardian phone
Invoice number
Receipt number
Staff name
Book title/barcode
Vehicle number
Notice title
```

Search result rules:

```text
1. Group results by type.
2. Show only results the user has permission to access.
3. Never leak hidden student/guardian/staff data in search snippets.
4. Show helpful empty state: “No matching student, receipt, or staff found.”
5. Keep keyboard navigation accessible.
```

### 3.4 Breadcrumbs

Breadcrumbs must use school-friendly labels.

Good:

```text
Students > Aarav Shrestha > Fee Ledger
Academics > Report Cards > Grade 5 - Term 1
Transport > Routes > Bus Route A
```

Bad:

```text
dashboard > students > 01HRJ... > fees
academics/report-cards/[id]
entity detail
```

Rules:

```text
1. Breadcrumbs should help users understand where they are.
2. Do not expose internal IDs.
3. Use student/staff/class/route names where safe.
4. Parent/student views should use simpler headers instead of deep admin breadcrumbs.
```

### 3.5 Cards

Cards are for summaries, insight, mobile, and dashboards. Tables are still necessary for dense desktop operations.

Rules:

```text
1. Do not convert finance/accounting/payroll/attendance registers into only cards on desktop.
2. Use cards for KPIs, next action, alerts, and mobile views.
3. Every KPI must have source, timeframe, and unavailable state.
4. No fake values.
5. Use tabular numbers for counts and money.
6. Use module accents lightly.
```

### 3.6 Dropdowns, actions, and dangerous flows

Every page has:

```text
One primary action
Optional secondary actions
Dangerous actions hidden under More or in controlled workflow steps
```

Dangerous action dialog must include:

```text
Action title
Affected person/class/record/amount
What will happen
Whether it can be reversed
Reason field where audit-critical
Permission/locked state
Confirm button with pending state
Error display
```

Actions requiring stronger confirmation:

```text
Transfer/archive/delete student
Merge duplicates
Collect payment
Reverse/refund payment
Reprint receipt
Close/reopen cashier day
Post/reverse journal
Lock/unlock marks
Publish/unpublish results
Approve/reject payroll
Post payroll to accounting
Suspend/reactivate tenant
Open support override
Retry/discard failed jobs
Cancel trip
Emergency/delay broadcast
Delete/restore activity post
```

---

## 4. Visual Design System Decision

### 4.1 Final palette decision

For SchoolOS and Nepal schools, the best professional design is:

```text
One shared base palette + module accent colors + semantic state colors.
```

Do not create fully different themes per module.

Why:

```text
1. School staff learn faster when every module behaves the same.
2. Owners and principals need trust, not decorative variety.
3. Finance, accounting, student records, and child data require calm visual treatment.
4. Nepal schools may have non-technical users; consistency reduces support burden.
5. Module accents are enough to create identity without fragmenting the product.
```

### 4.2 Color hierarchy

| Color layer | Purpose | Example |
|---|---|---|
| Base brand palette | Product identity | SchoolOS blue, calm app background, white cards. |
| Module accent | Location and module identity | Attendance green accent, Fees amber accent, Academics violet accent. |
| Semantic color | Meaning and status | Success green, danger red, warning amber. |
| Data color | Charts and comparison only | Use carefully; do not conflict with status meanings. |

Semantic color always wins over module accent.

Examples:

```text
Fees module may use amber accent, but failed payment is danger red.
Attendance module may use green accent, but absent risk can be warning/danger.
Transport module may use orange accent, but emergency is danger red.
Accounting module may use teal accent, but unbalanced journal is danger red.
```

### 4.3 Professional module visual personality

Each module should feel distinct by workflow, not by full redesign.

| Module | Visual personality | UX priority |
|---|---|---|
| Dashboard | Calm command center | What needs attention today. |
| Students | Trust and identity | Find student quickly and protect records. |
| Admissions | Pipeline clarity | Move applicant safely to enrollment. |
| Attendance | Speed and reliability | Mark/review attendance with minimal mistakes. |
| Fees | Financial confidence | Collect, receipt, reverse, and report safely. |
| Academics | Structured progress | Exams, marks, CAS, report card readiness. |
| Activity Feed | Warm but controlled | Share safely with families, respect consent. |
| Homework | Teacher productivity | Assign, collect, review, remind. |
| Timetable | Conflict clarity | Build schedules without teacher/room/class clashes. |
| HR | Confidential staff ops | Staff lifecycle, leave, records. |
| Payroll | Approval and accuracy | Preview, approve, post, payslip. |
| Library | Desk workflow | Search, issue, return, overdue. |
| Transport | Safety and live status | Routes, trips, delays, student movement. |
| Canteen | Speed and eligibility | Scan, serve, sell, wallet/status. |
| Accounting | Precision and control | Journals, periods, reports, reconciliation. |
| Notices & Chat | Communication safety | Audience, delivery, school-hours, escalation. |
| Platform | Operator control | Tenants, SaaS billing, queues, providers, audit. |

---

## 5. Role, Device, and Access Strategy

### 5.1 Core principle

```text
The role decides the experience. The permission decides the access. The backend enforces the truth.
```

Frontend responsibilities:

```text
Hide irrelevant navigation.
Hide unavailable actions.
Use scoped API clients for scoped users.
Show permission/module-locked states for direct blocked routes.
Never expose sensitive data in UI snippets, search results, or client state.
```

Backend responsibilities:

```text
Enforce tenant isolation.
Enforce permissions.
Enforce module entitlements.
Return scoped data for parents/students/drivers/staff self-service.
Audit high-risk actions.
```

### 5.2 Web vs mobile decision

| Experience | Best for | Reason |
|---|---|---|
| Web dashboard | Owners, principals, admins, accountants, academic coordinators, HR, library, transport managers, canteen managers, platform operators | Dense data, tables, filters, exports, approvals, setup, audits. |
| Mobile app | Parents, students, teachers, drivers, principals for alerts, owners for executive alerts | Fast cards, notifications, simple actions, field usage. |
| Both | Principal, owner, teacher, transport manager, selected admin roles | Need deep work on web and quick action/visibility on mobile. |

Rule:

```text
Mobile is not a mini web dashboard. Mobile is a role-specific companion.
```

### 5.3 Multi-role user rule

Many Nepal schools have people with multiple responsibilities.

Examples:

```text
Owner is also principal.
Principal also teaches one subject.
Accountant also works as cashier.
Admin also handles admissions.
Teacher is also class teacher.
Transport manager also manages driver assignment.
```

Rules:

```text
1. One person should use one account.
2. Assign multiple roles/permissions to that account.
3. Navigation should merge permissions cleanly.
4. Dashboard should prioritize the highest responsibility but show role-specific sections.
5. User can switch context if necessary: Executive, Principal, Teacher, Cashier, etc.
6. Audit logs should record the real user and, where possible, the role/context used.
7. Sensitive permissions should not be granted just because a user has a broad title.
```

---

## 6. Role-Based Dashboards and First-Login Design

Every dashboard must answer:

```text
What should I know now?
What needs my action?
What risk needs attention?
Where do I go next?
```

### 6.1 School owner/director

Primary job:

```text
Understand school business health, risk, growth, and high-level approvals.
```

Default landing:

```text
Executive Overview
```

Should see:

```text
Total students
New admissions trend
Active/inactive students
Fee collection this month
Outstanding dues
Collection by class/grade
Expenses summary if accounting enabled
Payroll/staff cost summary if payroll permission exists
Cash/bank health if accounting enabled
Attendance risk overview
Academic result trend
Staff count and open positions if HR enabled
Pending high-risk approvals
Audit/security alerts
Module subscription/locked status
```

Should manage:

```text
High-level approvals
School profile/settings if granted
Subscription/plan review
Financial policy review
Audit/security review
```

Should not automatically see:

```text
Private teacher-parent chat content
Sensitive child notes without policy reason
Detailed payroll salary unless payroll permission exists
Unpublished marks unless academic permission exists
Raw platform internals unless platform role exists
```

UI design:

```text
Executive KPI strip
Trend cards
Risk cards
Approval queue
Module health summary
Financial overview
Enrollment overview
Audit highlights
```

### 6.2 Principal/head teacher

Primary job:

```text
Run today’s school operations and academic quality.
```

Default landing:

```text
School Operations Overview
```

Should see:

```text
Today student attendance
Class attendance not submitted
Absent teachers
Substitution needs
Timetable conflicts
Upcoming exams
Mark/report card readiness
Homework completion risk
Parent escalations
Notices needing approval
Discipline/communication alerts if module exists
Academic calendar
Teacher workload signals
```

Should manage:

```text
Attendance review
Academic setup/review
Timetable publish/review
Notice approval
Result publish
Teacher coordination
Parent escalations
```

Should not automatically see:

```text
Detailed accounting ledgers
Individual staff salary details
Platform SaaS billing internals
Private financial configuration unless granted
```

Owner + principal same person:

```text
Show combined dashboard with Executive Overview at top and School Operations below.
Keep financial and academic actions separated by section.
Do not duplicate user account.
Require reason/confirmation for high-risk actions.
```

### 6.3 Vice principal / academic coordinator

Primary job:

```text
Manage academic operations and timetable/exam readiness.
```

Should see:

```text
Exam term status
Assessment component setup
Mark entry completion by class/subject
CAS completion
Report card readiness
Result publishing blockers
Teacher workload
Syllabus progress
Timetable validation issues
Substitution needs
```

Should manage:

```text
Exam terms
Assessment templates
Marks/CAS review
Timetable validation/publish if granted
Report card batch generation
Promotion readiness
```

Should not see by default:

```text
Fee collection details
Payroll salary details
Accounting journals
Platform billing
```

### 6.4 School admin / office admin

Primary job:

```text
Keep student records, guardians, documents, and office workflows accurate.
```

Should see:

```text
Student directory
Incomplete profiles
Admission applications
Duplicate candidates
Guardian verification queue
Document expiry/readiness
Generated documents
Basic reports
Settings tasks
```

Should manage:

```text
Student profiles
Guardian links/invitations
Document generation
Admissions handoff if allowed
Notices if assigned
Basic school configuration if allowed
```

Should not see by default:

```text
Salary data
Accounting journals
Full finance reports
Private chat content
Platform controls
```

### 6.5 Admission officer

Primary job:

```text
Move applications to enrolled students safely.
```

Should see:

```text
Application pipeline
Inquiry/application status
Missing documents
Duplicate warnings
Guardian details needed for enrollment
Bulk import batches
Accepted applications ready to enroll
```

Should manage:

```text
Application status
Document checklist
Duplicate review preview
Enrollment handoff
Bulk import review
Guardian invite during admission
```

Should not see by default:

```text
Full existing student fee ledger
Payroll/accounting
Private academic marks
Unrelated student records beyond duplicate/enrollment need
```

### 6.6 Class teacher

Primary job:

```text
Manage own class day-to-day.
```

Should see:

```text
Own class roster
Today attendance
Repeated absences
Homework due/missing
Own class timetable
Student basic profile summary
Parent messages during allowed hours
Activity/milestone tasks
Published academic summaries if allowed
```

Should manage:

```text
Attendance marking
Homework for own class
Activity posts/milestones
Parent communication within policy
Student notes only if school policy enables
```

Should not see by default:

```text
Other classes
School-wide finance
Payroll
Accounting
Private guardian verification docs
Unrelated student data
```

### 6.7 Subject teacher

Primary job:

```text
Teach assigned subjects and record learning progress.
```

Should see:

```text
Assigned classes
Assigned subjects
Today periods
Syllabus topics
Homework for subject
Marks entry tasks
Exam schedules
Students needing academic attention
```

Should manage:

```text
Subject homework
Marks entry for assigned subject
Syllabus progress
Learning activity resources if allowed
```

Should not see by default:

```text
Student fees
Payroll
Accounting
Unrelated class data
Private guardian data
```

### 6.8 Accountant

Primary job:

```text
Protect money flow, dues, receipts, postings, and reports.
```

Should see:

```text
Fee setup
Invoices
Dues
Payments
Receipts
Refund/reversal requests
Cashier close status
Gateway readiness
Accounting journal status
Bank reconciliation
Financial reports
Export history
```

Should manage:

```text
Fee plans
Billing runs
Discounts/waivers if permitted
Payments review
Refund/reversal approvals if permitted
Journal entries
Period close if permitted
Reports/exports
```

Should not see by default:

```text
Private academic notes
Parent chat content
Student medical/sensitive records
Teacher private communications
Platform internals
```

UI design:

```text
High-contrast money data
No decorative clutter
Clear pending/reversed/posted states
Reason dialogs for every correction
Strong audit trail visibility
```

### 6.9 Cashier / fee collector

Primary job:

```text
Collect payment quickly and issue correct receipt.
```

Should see:

```text
Student billing identity
Outstanding dues
Invoice details
Payment modes
Recent receipts
Receipt verification/reprint history
Cashier close preview
```

Should manage:

```text
Collect payment
Generate receipt
Reprint receipt with reason
Close cashier day if allowed
```

Should not see by default:

```text
Fee setup
Full accounting configuration
Payroll
Academic records
Full student private profile
```

UI design:

```text
Counter workflow
Large search input
Clear dues amount
Fast payment entry
Receipt success panel
Print/download action
```

### 6.10 HR / payroll officer

Primary job:

```text
Manage staff lifecycle, leave, payroll, and payslips confidentially.
```

Should see:

```text
Staff directory
Staff lifecycle status
Contracts/status if supported
Leave requests
Staff attendance
Salary structures
Payroll previews
Payroll run status
Payslips
Payroll reports
Statutory deductions
```

Should manage:

```text
Staff create/update/archive/terminate
Leave review
Salary structure assignment
Payroll preview/run/review
Payslip generation
Payroll reports
```

Should not see by default:

```text
Student fees
Academic marks
Parent chat
Tenant platform billing
Accounting ledgers unless payroll posting permission exists
```

### 6.11 Librarian

Primary job:

```text
Run library desk operations accurately.
```

Should see:

```text
Book catalog
Copy status
Issue/return search
Borrower identity
Reservations
Overdue list
Lost/damaged copies
Library fines
Borrower history
Library reports
```

Should manage:

```text
Books/copies
Issue/return
Reservations
Overdue reminders
Fines if permitted
Library reports
```

Should not see by default:

```text
Full student profile
Fees ledger except library fine posting state
Payroll
Guardian private details
Academic marks
```

### 6.12 Transport manager

Primary job:

```text
Keep routes, vehicles, drivers, trips, and students safe.
```

Should see:

```text
Routes/stops
Vehicles
Driver assignments
Student transport assignments
Active trips
Trip history
GPS freshness
Delays
Emergency reports
Vehicle documents/maintenance
Transport reports
```

Should manage:

```text
Routes
Stops
Vehicles
Assignments
Trips
Delay broadcasts
Maintenance records
Transport fee mapping if permitted
```

Should not see by default:

```text
Academic marks
Payroll salary details
Accounting ledgers
Parent private data beyond emergency transport contact
```

### 6.13 Driver / conductor

Primary job:

```text
Operate assigned trip safely.
```

Should use:

```text
Mobile only by default
```

Should see:

```text
Assigned route
Assigned vehicle
Today trip
Stop list
Student manifest
Pickup/drop status
Emergency contact
Delay/report issue action
```

Should manage:

```text
Start trip
Mark boarded/dropped/absent
Send GPS ping
Report delay/emergency
Complete trip
```

Should not see:

```text
Fees
Academics
Full student profile
Other routes
Parent private details unrelated to transport
Payroll
```

### 6.14 Canteen manager / POS staff

Primary job:

```text
Serve meals, sell items, protect wallet eligibility, and manage stock.
```

Should see:

```text
Today menu
Meal plans
Serving eligibility
Wallet balance/status
Student scan result
POS sales
Low balance alerts
Inventory/stock if manager
Supplier records if manager
Canteen reports if manager
```

Should manage:

```text
Serve meal
Complete POS sale
Top-up/correction if permitted
Menu/meal plan if manager
Stock movement if manager
Reports if manager
```

Should not see:

```text
Academic marks
Payroll
Full guardian details
Accounting beyond canteen summaries
Full student profile
```

### 6.15 Parent / guardian

Primary job:

```text
Know what is happening with own child and act when needed.
```

Should use:

```text
Mobile-first. Optional parent web portal later.
```

Should see only own child/children:

```text
Attendance today/month
Homework due/submitted/reviewed
Notices
Fee dues
Receipts
Activity feed/media allowed by consent
Published report cards
Transport trip status
Canteen balance/meal status
Library borrowed/overdue items
Parent-teacher chat within school policy
```

Should manage:

```text
View/pay fees where enabled
Download own receipts/report cards where allowed
Message allowed teachers during school-hours policy
Update limited contact info if school allows
```

Should not see:

```text
Other children
Unpublished marks/results
Internal school comments
Teacher/staff private data
Admin reports
Audit logs
Other parent messages
```

### 6.16 Student

Primary job:

```text
Understand own learning and tasks.
```

Should use:

```text
Mobile-first, age-appropriate. Optional student web portal later.
```

Should see:

```text
Own timetable
Homework due
Submission status
Published results/report cards
Library due items
Notices intended for student
Learning activities/resources if enabled
```

Should manage:

```text
Submit homework
View own progress
Access learning resources
Update very limited profile fields if allowed
```

Should not see:

```text
Fees management
Parent/staff data
Other students
Unpublished marks/results
Internal comments
```

### 6.17 Platform operator

Primary job:

```text
Operate SchoolOS SaaS safely.
```

Should use:

```text
Web-only platform control plane.
```

Should see:

```text
Tenant list
School status
Plans/subscriptions
SaaS invoices/payments
Provider readiness
Queue health
Failed jobs
Platform reports
Support override sessions
Platform audit/security logs
Onboarding blockers
```

Should manage:

```text
Tenant onboarding/status
Plan/subscription changes
Provider tests/status
Queue retry/discard
Support override enter/exit
SaaS billing lifecycle
Platform reports
```

Should not see by default:

```text
Tenant-private student records
Tenant-private finance details
Private child data
Parent/teacher chat content
```

Exception:

```text
Audited support override may allow limited temporary tenant access. It must show visible banner, reason, duration, user, and audit trail.
```

---

## 7. Role-Based Navigation Model

### 7.1 Navigation source

Navigation should be generated from:

```text
User roles
Permission map
Tenant module entitlements
Platform vs tenant context
Device type
```

Never hardcode full sidebar visibility only by display name.

### 7.2 Sidebar rules

```text
1. Hide modules the user cannot access.
2. Hide modules locked by plan, or show locked teaser only where product wants upsell/awareness.
3. Do not show Platform inside school dashboard sidebar.
4. Do not show phase labels or developer module names.
5. Parent/student/driver mobile navigation must be much smaller than admin web navigation.
6. A user with multiple roles gets merged navigation, not duplicate menus.
7. High-risk screens require both route guard and action guard.
```

### 7.3 Recommended navigation by role group

| Role group | Navigation style |
|---|---|
| Owner/director | Dashboard, Reports, Fees summary, Admissions summary, Accounting summary if allowed, HR summary if allowed, Settings, Audit. |
| Principal | Dashboard, Attendance, Academics, Homework & Timetable, Notices & Chat, Students, Reports. |
| Office/admin | Students, Admissions, Documents, Notices, Settings tasks, Reports. |
| Teacher | My Classes, Attendance, Homework, Marks/CAS, Activity Feed, Notices/Chat. |
| Accountant/cashier | Fees, Payments, Receipts, Cashier Close, Accounting if allowed, Reports. |
| HR/payroll | Staff, Leave, Payroll, Payslips, Payroll Reports. |
| Librarian | Library Desk, Books, Issues/Returns, Overdue, Reports. |
| Transport | Routes, Vehicles, Assignments, Trips, Reports. |
| Driver | My Trip, Manifest, Delay/Emergency, History. |
| Canteen | POS/Serving, Menu, Wallets, Inventory, Reports depending permission. |
| Parent | Child Overview, Attendance, Homework, Fees, Notices, Activity, Transport, Canteen, Library, Chat. |
| Student | Today, Homework, Timetable, Results, Library, Notices, Learning. |
| Platform operator | Platform dashboard, Schools, Billing, Plans, Providers, Queues, Audit, Reports. |

---

## 8. Data Sensitivity and Visibility Rules

### 8.1 Data categories

| Category | Examples | Visibility rule |
|---|---|---|
| Public product data | Marketing pages, module descriptions | Public only outside tenant data. |
| General school operational data | Class list, timetable, notices | Role-scoped. |
| Student identity data | Profile, guardians, admission number, documents | Strictly role-scoped and tenant-scoped. |
| Child-sensitive data | Medical notes, behavior notes, private media, identity verification | Minimum necessary only. Audit access where appropriate. |
| Financial student data | Fees, invoices, payments, receipts, dues | Accountant/cashier/admin/parent own child only. |
| Payroll data | Salary structures, payslips, payroll runs | HR/payroll and specifically granted leadership only. |
| Accounting data | Journals, ledgers, periods, reports | Accountant/authorized leadership only. |
| Communication data | Notices, chats, escalations | Scoped by sender/recipient/role/moderation policy. |
| Platform SaaS data | Tenant subscription, SaaS invoices, provider readiness | Platform operators only. |
| Audit/security data | Who did what, support override, sensitive operations | Admin/owner/platform according to scope. |

### 8.2 Confidentiality rules

```text
1. Owner access is broad but not unlimited.
2. Principal access is operational but not automatically payroll/accounting deep access.
3. Teachers see students they teach or are responsible for.
4. Parents see only their own children.
5. Students see only their own data and only published/age-appropriate content.
6. Drivers see only assigned trips and necessary safety data.
7. Canteen POS sees serving/payment eligibility, not full student profile.
8. Librarian sees borrower identity needed for issue/return, not full student profile.
9. Support override is temporary, visible, reasoned, and audited.
10. Backend remains the final enforcement layer.
```

---

## 9. Module Screen Design Depth

Each module should have three levels of screens:

```text
Workspace list/overview
Detail or builder screen
Action/review/approval flow
```

### 9.1 Students module

Primary users:

```text
Owner, principal, admin, admission officer, class teacher with scoped access
```

Required screens:

```text
Student Directory
Student Profile
Guardian Management
Student Documents
Student QR/Identity
Lifecycle Timeline
Fee Clearance Summary
Attendance History
Duplicate Review
IEMIS Readiness
```

Professional design rules:

```text
1. Directory search must be fast and forgiving.
2. Profile header must show student identity clearly: photo, name, admission no, class, status.
3. Tabs should group information by school workflow.
4. Sensitive document/photo actions use protected preview/download.
5. Transfer/archive/delete actions require reason and blockers display.
```

### 9.2 Admissions module

Required screens:

```text
Admissions Pipeline
Application Detail
Document Checklist
Duplicate Candidate Review
Bulk Import Review
Enrollment Confirmation
```

Rules:

```text
1. Treat admission as a pipeline, not just a CRUD table.
2. Always show next step: verify docs, review duplicate, approve, enroll.
3. Enrollment must show what student record will be created.
4. Duplicate merge must preview before action.
```

### 9.3 Attendance module

Required screens:

```text
Mark Attendance
Monthly Register
Attendance Corrections
Conflict Review
Working Day Calendar
Staff Attendance / Leave link
Student Attendance History
```

Rules:

```text
1. Teacher marking screen must be fast and low-friction.
2. Register screen must be printable/exportable and accurate.
3. Corrections need request/review states.
4. Locked sessions must explain why editing is unavailable.
```

### 9.4 Fees module

Required screens:

```text
Finance Today
Fee Setup
Invoice List
Student Ledger
Payment Collection
Receipt Viewer
Refund/Reversal Requests
Cashier Close
Defaulters
Fee Reports
```

Rules:

```text
1. Money must be high-contrast and tabular.
2. Payment collection must prevent double-submit.
3. Receipt success must be clear with print/download actions.
4. Reversal/refund always requires reason/approval where backend requires.
5. Cashier close must preview before finalizing.
```

### 9.5 Academics module

Required screens:

```text
Exam Setup
Assessment Components
Exam Timetable
Marks Entry
CAS Entry
Report Cards
Result Publishing
Promotion Workflow
Syllabus Progress
```

Rules:

```text
1. Marks grids need row-level validation.
2. Report card batch generation must show partial success/failure.
3. Result publish must show readiness blockers.
4. Unpublished results must never leak to parent/student views.
```

### 9.6 Homework and timetable

Required screens:

```text
Homework Workspace
Homework Detail
Submissions Review
Reminder Preview
Homework Reports
Timetable Builder
Rules and Availability
Substitutions
Teacher/Class Timetable Reports
```

Rules:

```text
1. Homework lifecycle states must be clear: draft, published, closed, cancelled.
2. Reminders require recipient preview.
3. Timetable conflicts must be visual and specific.
4. Substitution assignment must show availability/conflict state.
```

### 9.7 HR/payroll

Required screens:

```text
Staff Directory
Staff Profile
Leave Queue
My Staff Self-Service
Payroll Preview
Payroll Runs
Payroll Run Detail
Payslips
Salary Structures
Payroll Reports
```

Rules:

```text
1. Salary data is confidential.
2. Payroll run is a stepper/state machine, not just buttons.
3. Payslips use protected PDF download.
4. Posting to accounting must be explicit and auditable.
```

### 9.8 Library

Required screens:

```text
Library Desk
Book Catalog
Copy Detail
Issue/Return
Reservations
Overdue
Fines
Library Reports
```

Rules:

```text
1. Desk workflow must support barcode/QR search.
2. Issue/return should be fast with clear borrower and copy state.
3. Overdue/fine handling must be visible but not expose unrelated student data.
```

### 9.9 Transport

Required screens:

```text
Transport Dashboard
Routes and Stops
Vehicles
Driver Assignments
Student Assignments
Active Trips
Trip Detail
Delay Broadcast
Vehicle Maintenance/Documents
Transport Reports
```

Rules:

```text
1. Safety status must be visible.
2. GPS stale/missing must be warning state.
3. Driver mobile view must be simpler than manager web view.
4. Emergency action must be easy to find but protected against accidental taps.
```

### 9.10 Canteen

Required screens:

```text
Canteen POS / Serving
Menu
Meal Plans
Enrollments
Wallets
Transactions
Inventory
Suppliers
Canteen Reports
```

Rules:

```text
1. POS/serving must be fast and mistake-resistant.
2. Wallet eligibility should be clear: allowed, low balance, blocked, no plan.
3. Inventory cost details visible only to manager/account roles.
```

### 9.11 Accounting

Required screens:

```text
Accounting Dashboard
Chart of Accounts
Journal List
Journal Detail
Manual Journal
Fiscal Periods
Vouchers
Bank Reconciliation
Financial Reports
Source Ledger
```

Rules:

```text
1. Accuracy beats decoration.
2. Debit/credit values must align and use tabular numbers.
3. Unbalanced states use danger red.
4. Period locked states must clearly explain blocked actions.
5. Posting/reversing/correcting requires reason and audit.
```

### 9.12 Notices and chat

Required screens:

```text
Notice Composer
Recipient Preview
Notice List
Scheduled Notices
Messaging Inbox
Parent-Teacher Threads
Availability / School Hours
Escalation and Abuse Review
```

Rules:

```text
1. Recipient preview before sending is mandatory.
2. Chats must respect school hours and data-sharing policy.
3. Escalation/abuse reports need review workflow.
4. Parent communication should never expose other children.
```

---

## 10. Frontend Implementation Standards

### 10.1 Page structure standard

Every web module screen should follow:

```text
PageHeader
ContextBar / FilterBar
Summary strip when useful
Main workspace
Optional right insight drawer/panel
State components
Action dialogs
```

### 10.2 State standard

Every API-backed workspace must support:

```text
Loading
Empty
Error
Success
Permission denied
Module locked
Offline/retry where relevant
Partial success where backend supports batch actions
```

### 10.3 API client standard

Every module screen must document:

```text
Backend route -> school workflow -> UI screen -> component -> API client -> state handling -> verification
```

Rules:

```text
1. Use module API client under apps/web/lib/api.
2. Preserve cookie-first auth.
3. Do not store raw tokens.
4. Use authenticated blob helpers.
5. Use scoped endpoints for parents/students/drivers/staff self-service.
6. Do not invent frontend-only workflows not backed by backend routes.
```

### 10.4 Design review checklist

Before a module screen is accepted:

```text
1. Does the screen have one main job?
2. Is the role clear?
3. Are irrelevant actions hidden?
4. Are loading/empty/error/permission/locked states present?
5. Are dangerous actions confirmed and audited?
6. Does the screen use SchoolOS components, not one-off styling?
7. Does the module accent stay subtle?
8. Are semantic status colors correct?
9. Are tables paginated from backend?
10. Are mobile views card-based and not dense tables?
11. Are money/date/status displays consistent?
12. Is private data minimized?
13. Is the copy school-friendly and non-technical?
14. Is the screen fast enough for Nepal network conditions?
15. Does verification include typecheck/build/smoke/browser checks as appropriate?
```

---

## 11. Deep Implementation Roadmap

### Phase A: Foundation

```text
Design tokens
Typography and next/font setup
AppShell and PlatformShell
Sidebar and Topbar
PageHeader and Breadcrumbs
SectionCard and StatCard
State components
DataTable wrapper
FilterBar
SearchInput and CommandSearch
PaginationControls
AuditReasonDialog
MoneyDisplay and DateDisplay
API error normalization
```

Acceptance criteria:

```text
One module can be built using only shared components and module-specific domain components.
No page needs raw table/filter/pagination styling.
```

### Phase B: Role-aware navigation and dashboards

```text
Permission-driven sidebar
Module entitlement locked states
Role landing route resolver
Owner dashboard
Principal dashboard
Teacher dashboard
Finance dashboard
Parent/mobile dashboard direction
Platform dashboard separation
```

Acceptance criteria:

```text
Different roles see different navigation and landing views.
Direct blocked routes show permission/locked state.
```

### Phase C: High-value school workflows

Priority order:

```text
Students / Admissions
Attendance
Fees / Receipts / Cashier Close
Academics / Report Cards
Homework / Timetable
HR / Payroll
Library / Transport / Canteen
Accounting
Notices / Chat
Platform operations
```

Acceptance criteria:

```text
Each workflow uses real APIs, shared state components, and role-aware actions.
```

### Phase D: Mobile companion alignment

```text
Parent overview
Teacher quick actions
Driver trip flow
Student learning view
Principal/owner alert summary
Canteen/tablet POS option
```

Acceptance criteria:

```text
Mobile does not duplicate dense web admin screens.
Mobile uses scoped APIs and minimum data.
```

---

## 12. Final Product Rules

These rules should guide every frontend decision:

```text
1. SchoolOS is a school operating system, not a generic dashboard.
2. One screen has one main job.
3. Build SchoolOS-owned components.
4. Use dependencies only behind wrappers.
5. Use one base palette with module accents.
6. Semantic colors always define meaning.
7. Web is for deep operations; mobile is for quick role-specific action.
8. Every role sees only what they need.
9. Owners and principals can be the same person, but sensitive access remains permission-based.
10. Backend permissions, tenant isolation, and module entitlements are the source of truth.
11. No fake production data.
12. No raw token storage.
13. No private file URLs without authenticated helpers.
14. Every dangerous action is confirmed, reasoned where needed, and auditable.
15. Every workflow has loading, empty, error, success, permission, and module-locked states.
16. Every module must feel like part of one coherent SchoolOS product.
```
