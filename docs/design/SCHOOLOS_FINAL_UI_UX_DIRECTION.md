# SchoolOS Final UI/UX Direction and Implementation Plan

**Target path:** `SchoolOS/docs/design/SCHOOLOS_FINAL_UI_UX_DIRECTION.md`  
**Status:** Final design direction for the SchoolOS web admin, mobile/PWA, and future platform experiences  
**Current product stage:** Phase 2A Implementation / Targeted Frontend Polish Complete
**Frontend reality:** `apps/web` is the current Next.js dashboard. Do not migrate to Angular yet.

---

## 1. Purpose

This document replaces scattered or older UI/UX design notes with one single source of truth for the SchoolOS product interface.

SchoolOS must feel like a modern, trustworthy, Nepal-ready school operating system. It should not feel like a complicated ERP or generic CRUD dashboard. The product must be easy enough for non-technical school staff to use daily, while still supporting serious operations such as fee collection, attendance, admissions, reports, payroll, accounting, transport, library, canteen, and parent communication.

The key design principle is:

> **One screen = one main job.**

Every screen must answer:

> **What is the user trying to finish here?**

Anything that does not support that job should be moved to a secondary tab, details page, report page, or action menu.

---

## 2. Product Experience Goals

SchoolOS UI/UX must be:

- **Simple:** common tasks should be reachable in 1-3 clicks/taps.
- **Role-aware:** admins, teachers, accountants, admission staff, principals, parents, students, drivers, and platform operators should only see what they need.
- **Trustworthy:** finance, attendance, student records, medical data, documents, communication, and accounting actions must feel secure and auditable.
- **School-friendly:** labels, navigation, icons, and workflows must match real school operations.
- **Desktop-first for school operations:** admin, finance, attendance, reports, HR, and accounting workflows need tables, filters, exports, and approval flows.
- **Mobile-first for parents, teachers, students, and drivers:** mobile screens should be card-based, quick-action focused, and not table-heavy.
- **Nepal-ready:** support NPR, class/section conventions, guardian structures, Nepali phone patterns, receipt printing, local payment labels, and future Bikram Sambat support.
- **Safe for children:** student and parent experiences must be scoped, controlled, age-aware, and privacy-preserving.

---

## 3. Product Experience Split

SchoolOS has four UI experience families.

### 3.1 Public Website Experience

**Route target:** future `apps/web` public pages  
**Users:** school owners, principals, decision-makers, school admins evaluating the product

Purpose:

- Explain SchoolOS modules.
- Show trust, security, and Nepal readiness.
- Support demo requests and onboarding inquiries.
- Provide SEO-friendly public pages.

Rules:

- Keep marketing/public UI separate from internal dashboard UI.
- Do not expose tenant operations here.
- Use product storytelling, screenshots, school outcomes, and simple CTAs.

### 3.2 School Web Dashboard

**Current app:** `apps/web` Next.js dashboard  
**Users:** admins, principals, teachers, accountants, admission staff, HR, librarians, transport staff, canteen staff

Purpose:

- Run daily school operations.
- Manage students, attendance, fees, communication, academics, HR, accounting, library, transport, and canteen.
- Support reports, exports, approvals, and audit-friendly operations.

Rules:

- Consume real APIs.
- Do not use fake production data.
- Preserve cookie-first auth behavior.
- Keep every tenant-owned workflow tenant-scoped by backend APIs.
- Keep school operations under `/dashboard/*`.

### 3.3 Platform Control Plane

**Route target:** `/platform/*`  
**Users:** SchoolOS company owner, support users, platform admins, billing operators

Purpose:

- Manage schools/tenants.
- Manage plans, limits, SaaS billing, support access, health, failed jobs, and platform audit logs.

Rules:

- Must be visually and functionally separate from tenant school operations.
- Platform users are not school staff.
- Platform access must be explicit, permission-guarded, and audited.
- Do not show platform pages inside the normal school operations sidebar unless the user is explicitly in a platform route/context.

### 3.4 Mobile/PWA Portal Experience

**Future target:** parent/teacher/student/driver mobile portal or app  
**Users:** parents, teachers, students, drivers

Purpose:

- Provide quick answers and quick actions.
- Avoid dense dashboards and complex tables.
- Give role-specific flows.

Rules:

- Mobile should not be a mini web-admin dashboard.
- Use cards, timelines, bottom navigation, simple lists, and action buttons.
- Parents see only their own child/children.
- Drivers see only assigned transport data.
- Students get age-appropriate access only.

---

## 4. Global Visual Language

Use the uploaded modern SchoolOS screen concepts as the visual direction, but reduce density where needed.

### 4.1 Style Direction

- Primary color: deep blue / indigo.
- Secondary accents: purple, amber, green, cyan.
- Background: soft blue-grey / light slate.
- Cards: white, rounded, lightly bordered.
- Radius: 16px-24px for cards; 10px-14px for controls.
- Shadows: soft and minimal.
- Icons: rounded education-style line icons.
- Spacing: generous, especially on dashboards and mobile.
- Typography: clear, high contrast, and readable.

### 4.2 Recommended Design Tokens

```ts
primary: '#155EEF'
primaryDark: '#0B3A88'
primarySoft: '#EAF1FF'
secondary: '#7C3AED'
secondarySoft: '#F3E8FF'
background: '#F3F7FB'
surface: '#FFFFFF'
border: '#E2E8F0'
success: '#16A34A'
successSoft: '#DCFCE7'
warning: '#F59E0B'
warningSoft: '#FEF3C7'
danger: '#EF4444'
dangerSoft: '#FEE2E2'
info: '#0284C7'
infoSoft: '#E0F2FE'
textPrimary: '#0F172A'
textSecondary: '#475569'
textMuted: '#94A3B8'
```

### 4.3 Typography

- Page title: 28px-32px / bold.
- Section title: 18px-22px / semibold.
- Card number: 26px-34px / bold.
- Body text: 14px-16px.
- Helper text: 12px-13px.
- Button text: 14px-15px / semibold.

Rules:

- Use strong contrast.
- Avoid very light grey text for important information.
- Use short labels on mobile.
- Use descriptive headings on web admin screens.

---

## 5. Global Layout System

Every web admin page should follow this structure:

```text
Topbar
Left Sidebar
Page Header
Summary Cards
Main Work Area
Optional Right Insight Panel
Bottom or Sticky Action Bar only when needed
```

### 5.1 Topbar

The topbar should include:

- School selector.
- Global search.
- Notification bell.
- User profile menu.
- Academic year/date context where relevant.

Global search should support:

- Student name.
- Admission number.
- Guardian phone.
- Invoice number.
- Receipt number.
- Staff name.
- Book title/ISBN/barcode.
- Vehicle number.
- Notice title.

Topbar rules:

- Keep it clean.
- Do not overload it with module-specific actions.
- The search bar should give suggestions grouped by type.
- Notification bell should show actionable items, not just generic alerts.

### 5.2 Sidebar

Do not show technical phase labels like Phase 1, Phase 2, or Phase 3 in user-facing navigation.

Recommended sidebar:

```text
Dashboard
Students
Admissions
Attendance
Fees
Communications
Activity Feed
Exams, CAS & Reports
Homework & Timetable
HR & Payroll
Accounting
Library
Transport
Canteen
Reports
Settings
```

Sidebar behavior:

- Active route highlighting.
- Collapsible/toggleable sidebar.
- Clear icons.
- No phase labels.
- Disabled/locked module states only when needed.
- Permission-hidden items should not appear for users without access.
- Platform pages must remain outside normal school operations navigation.

### 5.3 Page Header

Every module page should start with:

```text
Title
Short description
Primary action
Optional secondary action menu
```

Example:

```text
Fees & Receipts
Collect payments, print receipts, and manage student dues.
[New Collection] [More Actions]
```

Rules:

- One main title.
- One short description.
- One primary action.
- Secondary actions go inside `More Actions`.
- Avoid placing 4-6 equal-weight buttons in the header.

### 5.4 Page Type Rules

```text
Dashboard = summary only
Module page = daily work
Detail page = full record
Report page = filters + exports
Settings page = configuration
Mobile page = quick answer/action
```

---

## 6. UX Rules for Non-Technical Users

### 6.1 Use School Language

Avoid technical wording.

Bad:

```text
Entity
Mutation failed
Workflow state
403 Forbidden
Posting exception
```

Good:

```text
Student
Save failed
Waiting for approval
You do not have permission
Payment could not be posted
```

### 6.2 Guide the Next Action

Use next-step buttons instead of showing too many actions.

Examples:

```text
Next: Verify Documents
Next: Collect Payment
Next: Submit Attendance
Next: Approve Payroll
Next: Publish Notice
```

### 6.3 Use Safe Confirmations

Important actions must show confirmation dialogs:

- Submit attendance.
- Collect payment.
- Reverse payment.
- Close cashier day.
- Lock marks.
- Publish result.
- Approve payroll.
- Post journal.
- Transfer student.
- Mark student inactive.
- Delete/soft-delete posts.

Confirmation dialogs must include:

- What will happen.
- Who/what is affected.
- Whether it can be changed later.
- Reason field for destructive/financial/audit-critical actions.

### 6.4 Use Clear Feedback

Success example:

```text
Attendance submitted successfully.
38 present, 8 absent, 3 late, 1 leave.
```

Error example:

```text
You do not have permission to reverse payments.
Please contact the school administrator.
```

Empty state example:

```text
No fee payments collected today.
Start your first collection.
[New Collection]
```

### 6.5 Never Hide Critical Risk

Always make these visible:

- Cashier close status.
- Fiscal period status.
- Unposted journals.
- Failed notice deliveries.
- Attendance not submitted.
- Pending admission documents.
- Overdue fees.
- Allergy warnings.
- Transport delays.
- Payroll pending approval.

---

## 7. Shared Component System

Build and reuse shared components before redesigning screens.

### 7.1 Core Web Components

```text
DashboardShell
Sidebar
Topbar
PageHeader
SectionCard
StatCard
StatusBadge
DataTable
FilterBar
SearchInput
ActionMenu
ConfirmDialog
Toast
EmptyState
LoadingState
ErrorState
PermissionState
AuditInfo
StudentAvatar
MoneyDisplay
DateDisplay
ProgressStepper
WorkflowTimeline
NotificationBadge
Tabs
```

### 7.2 Mobile/PWA Components

```text
MobileShell
MobileHeader
MobileBottomNav
MobileStatCard
MobileActionGrid
MobileNoticeCard
MobileHomeworkCard
MobileFeeCard
MobileAttendanceCalendar
MobileTimelineItem
ChildSwitcher
TripStatusCard
```

### 7.3 Component Rules

- Components must be reusable across modules.
- Avoid one-off styling inside pages.
- Keep variants explicit: `success`, `warning`, `danger`, `info`, `neutral`.
- Use semantic states instead of raw colors.
- All loading, empty, error, and permission-denied states must be reusable.

---

## 8. Module Screen Direction

## 8.1 Dashboard

Main job:

> Help the school admin understand what needs attention today.

Dashboard should answer:

```text
How many students are active?
Was attendance marked today?
How much fee was collected today?
What needs attention?
Are there urgent notices/tasks?
```

Recommended sections:

```text
Welcome header
Today KPI cards
Today tasks
Attendance snapshot
Fee collection snapshot
Recent activity
Notices
Quick actions
```

Behavior:

- Cards should be clickable.
- Avoid too many charts.
- Do not make dashboard a full reports page.
- Use safe empty states where APIs are not ready.

Clickable mapping:

```text
Total Students -> Student Directory
Attendance Rate -> Attendance Report
Fee Collected -> Fee Collection
Outstanding Dues -> Defaulter Report
Unread Notices -> Notice Center
Pending Tasks -> Task/Action list
```

---

## 8.2 Students and Student Profile

Main job:

> Find a student quickly and manage the full student record safely.

### Student Directory

Must include:

- Search by name, admission number, roll number, guardian phone.
- Class/section/status filters.
- Student status badges.
- Quick actions through action menu.
- Pagination.

### Student Detail Header

Show:

```text
Photo
Name
Status
Class / Section
Admission No.
Roll No.
Gender
DOB / Age
Blood Group
Joined Date
House
Primary Guardian
```

Primary actions:

```text
Edit
Print ID Card
More Actions
```

More Actions:

```text
Promote
Transfer
Mark Inactive
Upload Document
Generate Certificate
View Audit History
```

### Student Detail Tabs

```text
Overview
Attendance
Fees
Documents
Activity
Academics
Guardians
History
```

Overview should only show the latest summary:

- Guardian summary.
- Attendance trend.
- Fee due summary.
- Recent documents.
- Recent activity.

Deep data must live inside tabs.

---

## 8.3 Admissions

Main job:

> Move applicants from inquiry to admitted student with clear document and approval steps.

Recommended pipeline stages:

```text
Inquiry
Application Started
Documents Pending
Under Review
Approved
Admitted
Rejected
Withdrawn
```

Admission layout:

```text
Admission KPI cards
Pipeline / stage list
Selected applicant detail
Checklist / timeline
```

Applicant detail should show:

- Student summary.
- Guardian information.
- Academic placement.
- Document checklist.
- Notes.
- Timeline.
- Next workflow action.

Primary action should change by status:

```text
Documents Pending -> Request Documents
Under Review -> Approve / Reject
Approved -> Enroll Student
Admitted -> View Student Profile
```

Do not show approve, enroll, transfer, print ID, and more as equal actions.

---

## 8.4 Attendance

Main job:

> Mark today’s attendance in under 2 minutes.

Recommended flow:

```text
Select Class
Select Section
Select Date
Auto Fill Present
Mark exceptions
Save Draft
Submit Attendance
```

Attendance layout:

```text
Class/date filters
Attendance summary cards
Attendance register
Right panel: monthly snapshot + correction requests
Bottom action bar
```

Register columns:

```text
Roll No.
Student
Status
Remarks
```

Status buttons:

```text
P = Present
A = Absent
L = Late
V = Leave
```

Behavior:

- Default all students to Present.
- Teacher changes exceptions only.
- Future dates blocked unless role/config allows.
- Submitted attendance requires correction workflow.
- Use sticky action bar for Save Draft and Submit Attendance.

Primary action:

```text
Submit Attendance
```

Secondary actions:

```text
Save Draft
Export CSV
Print Register
```

Admin-only actions:

```text
Bulk Update
Correction Requests
Attendance Settings
```

---

## 8.5 Fees and Receipts

Main job:

> Find a student, collect fee, issue receipt, and close day safely.

Recommended layout:

```text
KPI cards
Student dues list
Selected student ledger
Collect payment panel
Receipt / invoice history
Top defaulters
Quick actions
```

### Cashier View

Simple workflow:

```text
Search student
Select due invoice/fee head
Enter amount
Choose payment method
Collect payment
Print receipt
```

### Accountant/Admin View

Advanced workflow:

```text
Ledger
Reversal
Cashier close
Reports
Defaulter aging
Fee-head dues
Receipt history
```

### Payment Form

Must show:

```text
Selected student
Total due
Selected fee heads
Amount paid
Discount
Fine
Payment method
Receipt number
Payment date
Remarks
```

Before submit, show confirmation:

```text
You are collecting NPR 12,450 from Aarav KC.
Payment method: Cash.
Receipt will be generated after confirmation.
```

Dangerous finance actions must require:

- Confirmation dialog.
- Reason field.
- Audit log.
- Permission check.
- Clear warning.

Dangerous actions include:

```text
Reverse Payment
Void Receipt
Refund
Change Due
Close Day
```

Finance rules:

- Do not calculate financial truth only on the frontend.
- Use backend totals, ledger APIs, receipt APIs, and reversal/correction workflows.
- Do not silently edit confirmed financial records.

---

## 8.6 Communications, Notices, and Activity Feed

Main job:

> Communicate with parents/staff and verify delivery/read status.

Split into clear areas:

```text
Activity Feed
Notices & Communication
Delivery Records
Consent
```

### Activity Feed

Post card should show:

```text
Teacher
Class
Time
Text
Photos
Reactions/comments count
Visibility status
Approval status
Seen by parents
```

Actions:

```text
Create Post
Edit
Delete
View Details
Moderate
```

Activity rules:

- Media preview/download must use private file/signed URL patterns.
- Consent-aware media visibility must be respected.
- Soft-deleted posts should disappear from normal views.
- Parent view must be scoped to own child/class visibility.

### Notices

Notice list columns:

```text
Notice
Audience
Published Date
Read %
Delivery Status
Actions
```

Status labels:

```text
Draft
Scheduled
Published
Delivered
Partial
Failed
Retrying
```

Notification center should show:

```text
Unread notices
Failed deliveries
Pending approvals
Correction requests
Fee alerts
Attendance alerts
```

---

## 8.7 Exams, CAS, and Report Cards

Main job:

> Set up exams, enter marks, validate, lock, publish, and generate report cards.

Recommended tabs:

```text
Exam Setup
Marks Entry
CAS Records
Results
Report Cards
```

Use workflow stepper:

```text
1. Enter Marks
2. Validate
3. Lock
4. Publish
5. Generate Report Cards
```

Marks entry behavior:

- Spreadsheet-style grid.
- Autosave draft.
- Highlight missing marks.
- Highlight invalid marks.
- Show absent students.
- Calculate total/percentage/grade using backend rules.
- Prevent publish until valid.

Primary workflow actions:

```text
Save Marks
Validate Marks
Lock Marks
Publish Results
Generate Report Cards
```

Do not show all actions as equal primary buttons.

---

## 8.8 Homework and Timetable

### Homework

Main job:

> Create homework and review submissions.

Recommended layout:

```text
Homework KPI cards
Homework list
Review queue
Quick actions
```

Group homework by:

```text
Due Today
Upcoming
Overdue
Checked
```

Teacher actions:

```text
Create Homework
Review Submissions
Return for Correction
Mark Checked
```

Parent/student mobile should use homework cards, not dense tables.

### Timetable

Main job:

> View schedule, publish timetable, and resolve conflicts.

Timetable grid should show:

```text
Period
Subject
Teacher
Room
Status
```

Conflict cards should show:

```text
Problem
Reason
Suggested fix
Resolve button
```

Conflict types:

```text
Teacher already assigned
Room already booked
Teacher unavailable
Workload exceeded
Subject period missing
```

---

## 8.9 HR, Payroll, and Accounting

The combined overview screen can exist, but deep work should be split into focused pages.

Recommended structure:

```text
Staff & HR
Payroll
Accounting
```

### Combined Overview

Good for principals/admins:

```text
Total Staff
Payroll Drafts
Pending Journals
Fiscal Period Status
Recent Leave Requests
Payroll Preview
Accounting Summary
Recent Journals
```

### Staff Directory

Table columns:

```text
Name
Employee ID
Department
Designation
Status
Actions
```

### Payroll

Use workflow:

```text
1. Prepare Payroll
2. Preview
3. Approve
4. Post to Accounting
5. Mark Paid
6. Generate Payslips
```

Payroll statuses:

```text
Draft
Pending Approval
Approved
Posted
Paid
Cancelled
```

Payroll rules:

- Posted payroll must not be silently edited.
- Corrections should use reversal/correction workflow.
- Payslip generation should use backend PDF/report APIs.

### Accounting

Accounting UI must be stricter than other modules.

Rules:

- Show fiscal period status clearly.
- Show debit/credit balance check.
- Show source document links.
- Never edit posted journals silently.
- Use reversal/correction flow.
- Show audit history.
- Reports must come from backend ledger data.

---

## 8.10 Library

Main job:

> Manage books, copies, issue/return, overdue books, and fines.

Recommended layout:

```text
Library KPI cards
Book catalog
Selected book details
Issue / return panel
Borrower history
Overdue books
```

Book and copy concepts must be visually separate.

Book:

```text
Title
Author
ISBN
Category
```

Copy:

```text
Barcode/QR
Copy number
Status
```

Statuses:

```text
Available
Issued
Overdue
Lost
Damaged
Under Repair
```

Issue flow:

```text
Scan/Search Student
Scan/Search Book Copy
Select Due Date
Issue Book
```

---

## 8.11 Transport

Main job:

> Track active routes, manage vehicles, and ensure students are safely onboard/dropped.

Recommended layout:

```text
Transport KPI cards
Live route map
Routes & stops
Vehicle/driver assignments
Active trip timeline
Students onboard
Alerts
Quick actions
```

Safety rules:

- Parents must only see their own child.
- Driver app must only show assigned route/trip.
- Admins can see full transport data.
- Every live map should show last updated time.

Parent transport mobile should show:

```text
My child
Bus status
ETA
Route timeline
Driver name
Vehicle number
Emergency contact
Last updated time
```

Driver view should be simple:

```text
Start Trip
Next Stop
Mark Boarded
Mark Dropped
Call School
End Trip
```

---

## 8.12 Canteen

Main job:

> Serve meals quickly, manage wallet balance, and prevent allergy/spending issues.

Recommended layout:

```text
Canteen KPI cards
Today’s menu
Meal serving counter
Student wallet summary
Allergy warnings
Recent transactions
Top selling items
Quick actions
```

Serving workflow:

```text
Scan student ID
Show student
Show wallet balance
Show allergy warning
Serve Meal
Confirm
```

Wallet statuses:

```text
Sufficient
Low Balance
Zero Balance
Blocked by Parent Limit
```

Allergy warning example:

```text
Warning: This student has peanut allergy.
Serving this item requires admin override.
```

---

## 8.13 Reports

Main job:

> Filter, preview, export, and audit reports safely.

Reports layout:

```text
Report category cards
Saved/common reports
Filter panel
Preview table/chart
Export actions
Export history
```

Rules:

- Reports must come from backend APIs.
- Heavy exports should use background jobs where needed.
- Export actions must be audited for sensitive data.
- Do not compute financial/accounting truth only in frontend.

---

## 8.14 Settings

Main job:

> Configure school behavior safely without confusing daily operators.

Recommended settings groups:

```text
School Profile & Branding
Academic Year
Fiscal Year
Attendance Rules
Fee & Receipt Settings
Communication Settings
Parent-Teacher Chat Hours
User & Role Management
Feature Toggles
Data & Exports
```

Rules:

- Settings must be grouped by school operations language.
- Dangerous settings require confirmation.
- Changes affecting finance, attendance lock, fiscal year, chat availability, and feature access must be audited.

---

## 9. Mobile/PWA Direction

Mobile must be role-specific and simpler than web.

### 9.1 Parent Mobile

Parent home should answer:

```text
Is my child present?
Any fee due?
Any homework?
Any notice?
Where is the bus?
```

Recommended parent home:

```text
Child Switcher
Today Overview
Quick Actions
Latest Notice
Homework Due
Fee Due
Bus Status
Recent Activity
```

Navigation:

```text
Home
Academics
Transport
Messages
Profile
```

### 9.2 Teacher Mobile

Teacher home should answer:

```text
What class do I have now?
Do I need to mark attendance?
Any homework to review?
Any parent messages?
Any substitution duty?
```

Recommended teacher home:

```text
Today’s Classes
Attendance to Mark
Homework Review Queue
Notices
Parent Messages
Substitution Duty
```

Navigation:

```text
Home
Classes
Homework
Messages
Profile
```

### 9.3 Student Mobile

Student app must be age-aware.

Student should see:

```text
Timetable
Homework
Results
Notices
Attendance summary
```

Rules:

- No financial controls.
- No unrestricted chat.
- Parent/school policy should control student access.

### 9.4 Driver Mobile

Driver UX should be route-focused.

Screens/actions:

```text
Assigned Route
Start Trip
View Stops
Mark Boarded
Mark Dropped
Emergency Call
End Trip
Trip History
```

Driver should not see finance, academic, or unnecessary student profile data.

---

## 10. Accessibility and Responsiveness

Every redesigned screen must support:

- Keyboard focus states.
- Visible focus rings.
- Sufficient text contrast.
- Responsive desktop/tablet layout.
- Mobile-friendly layouts where applicable.
- Loading states.
- Empty states.
- Error states.
- Permission-denied states.
- Confirmation dialogs for destructive actions.
- Clear labels for icons.

Minimum viewport checks:

```text
Desktop: 1440px
Laptop: 1280px
Tablet: 768px
Mobile/PWA: 390px
```

---

## 11. Implementation Plan

Do not implement all screens at once. Use small, safe UI slices.

### UI-A — Foundation

Implement first:

```text
SchoolOS theme tokens
DashboardShell
Sidebar
Topbar
PageHeader
SectionCard
StatCard
StatusBadge
SearchInput
FilterBar
EmptyState
LoadingState
ErrorState
PermissionState
ActionMenu
ConfirmDialog
Toast
```

Verification:

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
```

### UI-B — Shell and Dashboard

Redesign:

```text
/dashboard shell layout
Dashboard KPI cards
Attendance chart card
Fee collection chart card
Notices card
Upcoming tasks card
Recent activity card
```

Use real API summaries where available; otherwise show safe empty states.

### UI-C — Students and Admissions

Redesign:

```text
Student directory
Student detail route /dashboard/students/[studentId]
Guardian cards
Attendance tab/card
Fee ledger preview
Document list
Recent activity
Admissions pipeline
Application review panel
Admission checklist
```

Must preserve existing backend workflows for:

- Student creation.
- Guardian linking.
- Duplicate detection.
- Document management.
- Lifecycle.
- ID card.
- Certificate actions.

### UI-D — Attendance

Redesign:

```text
Attendance filters
Present/Absent/Late/Leave stat cards
Attendance register
Monthly snapshot
Attendance trend
Correction requests panel
Export and print actions
```

Attendance must remain teacher-first and fast:

```text
Select class
Mark all present
Change exceptions
Submit
```

### UI-E — Fees and Receipts

Redesign:

```text
Today collection KPI
Outstanding dues KPI
Pending invoices KPI
Cashier close status KPI
Student dues list
Selected student ledger
Collect payment panel
Invoice / receipt history
Top defaulters
Quick actions
```

Finance guardrails:

- Backend totals only.
- Backend ledger APIs only.
- Confirmation for collection/reversal/close.
- Never silently edit confirmed records.

### UI-F — Communications and Activity

Redesign:

```text
Activity feed
Milestones
Notices table
Delivery records
Consent management
Delivery retry actions
Unread/read tracking
Notification center
```

Media preview/download must use signed URL patterns where available.

### UI-G — Academics, Homework, Timetable

Implement UI foundation for:

```text
Exams, CAS & Report Cards
Mark entry table
Grading summary
Report card preview
Homework assignment list
Weekly timetable grid
Conflict warnings
Submission/review overview
```

### UI-H — HR, Payroll, Accounting

Implement UI foundation for:

```text
Staff directory
Leave & attendance summary
Payroll preview/run workflow
Payslip actions
Accounting summary
Recent journals
Trial balance snapshot
Fiscal period warning
Reversal/correction actions
```

Accounting and payroll must follow immutable posting and correction/reversal rules.

### UI-I — Library, Transport, Canteen

Implement UI foundation for:

```text
Library book catalog
Issue/return panel
Overdue list
Transport route dashboard
Vehicle/driver assignment
Trip timeline
Canteen menu
Meal serving counter
Wallet summary
Allergy warnings
```

### UI-J — Settings, Reports, Accessibility, Browser QA

Finalize:

```text
Settings groups
Report filters/export UI
Responsive layouts
Accessibility states
Playwright browser smoke tests
PDF/report visual polish
```

---

## 12. Recommended PR Sequence

Use small pull requests:

```text
PR 1: Design tokens and shared components
PR 2: Dashboard shell, sidebar, topbar
PR 3: Dashboard command center
PR 4: Students and student detail redesign
PR 5: Admissions redesign
PR 6: Attendance redesign
PR 7: Fees and receipts redesign
PR 8: Communications and activity redesign
PR 9: Exams, homework, timetable UI foundation
PR 10: HR, payroll, accounting UI foundation
PR 11: Library, transport, canteen UI foundation
PR 12: Settings, reports, accessibility, and browser smoke tests
```

---

## 13. Acceptance Criteria

A redesigned screen is accepted only when:

```text
It uses shared design components instead of one-off styling.
It consumes real APIs for implemented workflows.
It has loading, empty, error, and permission-denied states.
It preserves tenant isolation and cookie-first auth behavior.
It does not introduce fake production workflows.
It keeps destructive actions behind confirmation.
It remains responsive at desktop and tablet widths.
It uses school-friendly language.
It keeps the main job of the screen obvious.
It passes lint, typecheck, and build.
```

---

## 14. Verification Commands

After every frontend UI PR:

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web build
```

After larger cross-module UI work:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:production
```

After browser-flow changes:

```bash
pnpm test:e2e
```

When Docker/API are running:

```bash
pnpm smoke:phase1
```

---

## 15. Cleanup Instruction for Existing Design Docs

This document should become the single design source of truth in `docs/design`.

Recommended cleanup:

```bash
mkdir -p docs/design
find docs/design -type f ! -name 'SCHOOLOS_FINAL_UI_UX_DIRECTION.md' -delete
```

Then place this file at:

```text
docs/design/SCHOOLOS_FINAL_UI_UX_DIRECTION.md
```

If older docs still contain useful historical notes, move them to an archive before deleting:

```bash
mkdir -p docs/archive/design
find docs/design -type f ! -name 'SCHOOLOS_FINAL_UI_UX_DIRECTION.md' -exec mv {} docs/archive/design/ \;
```

Use delete only when the team is sure this file fully replaces the older design docs.

---

## 16. First Implementation Prompt

Use this prompt to start implementation safely:

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/design/SCHOOLOS_FINAL_UI_UX_DIRECTION.md
- docs/project/SCHOOLOS_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_PHASE_STRUCTURE.md
- docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md

Task:
Start the SchoolOS screenshot-based web admin redesign with UI foundation only.

Scope:
- Work only inside apps/web unless a shared frontend type already belongs in packages/core.
- Do not rewrite backend.
- Do not migrate to Angular.
- Do not rename tenantId.
- Do not remove existing working module logic.
- Do not introduce fake production workflows.
- Do not redesign all pages in one PR.

Required work:
1. Add or standardize SchoolOS visual tokens using the existing CSS/Tailwind setup.
2. Create shared components:
   - PageHeader
   - SectionCard
   - StatCard
   - StatusBadge
   - EmptyState
   - LoadingState
   - ErrorState
   - PermissionState
   - ActionMenu
   - ConfirmDialog
3. Keep components generic and reusable.
4. Preserve current auth and API behavior.
5. Add examples by refactoring only one low-risk dashboard section if needed.

Verification:
- pnpm --filter web lint
- pnpm --filter web typecheck
- pnpm --filter web build

Return:
- Summary
- Files changed
- Components added
- Tests run
- Verification results
- Remaining gaps
```

---

## 17. Final Design Rule

SchoolOS should look modern and premium, but it should operate like a calm daily school desk.

The UI should make the user feel:

```text
I know where I am.
I know what needs attention.
I know what action to take next.
I trust the system with school data, money, attendance, and children.
```

That is the final UI/UX direction.
