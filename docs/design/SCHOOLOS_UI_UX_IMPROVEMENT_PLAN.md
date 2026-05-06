# SchoolOS UI/UX Improvement Plan

## Purpose


This document is the complete UI/UX direction for SchoolOS across web, platform, developer, parent, teacher, student, and driver experiences. It includes every UI/UX item discussed and finalized so far.

SchoolOS should become a modern, production-ready, Nepal-friendly school management SaaS. It should not feel like a basic CRUD dashboard. It should feel like a trustworthy education operating system that is simple for schools, safe for children, useful for parents, efficient for teachers, and powerful for administrators.

---

# 1. Global UI/UX Direction for Web and App

## 1.1 Product Experience Principles

SchoolOS must be:

- **Simple:** common tasks should be reachable in 1-3 clicks/taps.
- **Role-aware:** admins, teachers, parents, students, drivers, accountants, and platform operators should only see what they need.
- **Trustworthy:** finance, attendance, student records, medical data, and communication must feel secure and auditable.
- **School-friendly:** language, layout, icons, and flows should match real school operations.
- **Mobile-first for parents/students:** parents and students should not see dense tables.
- **Desktop-first for operations:** admins/accountants need tables, filters, exports, reports, and approval flows.
- **Nepal-ready:** use NPR, Nepali phone patterns, guardian structures, class/section conventions, printable receipts, and future Nepali date/Bikram Sambat support.
- **Safe for children:** student access must be age-aware, parent-controlled, and school-policy controlled.

## 1.2 Product Experience Split

SchoolOS needs separate UI experiences:

1. **Public/Landing Experience**
   - For school owners, principals, and decision-makers.
   - Explains the product, modules, trust, and demo/onboarding paths.

2. **School Web Dashboard**
   - For admins, principals, accountants, admission staff, teachers, HR, and operations users.
   - Desktop-first, table/report/filter-friendly.

3. **Platform Control Plane / Developer Experience**
   - For SchoolOS operators, support, billing, platform admins, and future API users.
   - Must stay visually and functionally separate from tenant-scoped school operations.

4. **Mobile Portal / App Experience**
   - For parents, teachers, students, and drivers.
   - Mobile-first, card-based, timeline-based, and role-specific.

## 1.3 Global Visual Language

Use a clean SaaS design system:

- Primary color: deep blue/indigo.
- Secondary accents: soft purple, amber, green, cyan.
- Background: soft blue-grey or light slate.
- Cards: white, rounded, lightly bordered.
- Radius: 16px to 24px for cards; 10px to 14px for controls.
- Shadows: soft, minimal, not heavy.
- Icons: rounded education-style icons.
- Spacing: generous, especially on dashboards and mobile.
- Typography: clear and high contrast.

Recommended theme direction:

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

## 1.4 Typography

Recommended hierarchy:

- Page title: 28px-32px / bold.
- Section title: 18px-22px / semibold.
- Card number: 26px-34px / bold.
- Body text: 14px-16px.
- Helper text: 12px-13px.
- Button text: 14px-15px / semibold.

Rules:

- Use strong contrast.
- Avoid very light grey text for important information.
- Use short labels for mobile.
- Use descriptive headings for web admin screens.

## 1.5 Shared Components

Shared components:

- `PageHeader`
- `SectionCard`
- `StatCard`
- `StatusBadge`
- `SearchInput`
- `FilterBar`
- `EmptyState`
- `LoadingState`
- `ActionMenu`
- `ConfirmDialog`
- `Toast`
- `Avatar`
- `NotificationBadge`
- `Tabs`
- `PermissionState`
- `AuditInfo`

Web-specific components:

- `DashboardShell`
- `SidebarGroup`
- `Topbar`
- `DataTable`
- `TablePagination`
- `ReportToolbar`
- `ExportButton`
- `ChartCard`
- `ApprovalPanel`

App/mobile-specific components:

- `MobileShell`
- `MobileHeader`
- `MobileBottomNav`
- `MobileModuleGrid`
- `MobileStatCard`
- `MobileSectionCard`
- `MobileTimelineItem`
- `MobileCalendarCard`
- `MobileHomeworkCard`
- `MobileFeeMonthCard`
- `MobileBusStatusCard`
- `MobileProfileSummary`
- `MobileNoticeCard`

## 1.6 Status and Badge Standards

Use consistent statuses across modules:

| Status | Color | Usage |
|---|---|---|
| Active | Green | Student/staff/tenant active |
| Inactive | Grey | Temporarily disabled records |
| Pending | Amber | Waiting for action |
| Approved | Green | Approved workflows |
| Rejected | Red | Rejected workflows |
| Draft | Slate | Unpublished records |
| Published | Blue | Visible to users |
| Locked | Grey | Final/closed records |
| Paid | Green | Paid fees/invoices |
| Partial | Amber | Partially paid fees |
| Unpaid | Red | Unpaid fees |
| Overdue | Red | Past due payments/tasks |
| Waived | Blue | Waived fee/payment item |
| Refunded | Slate | Refunded payment |
| Onboard | Blue | Student is on bus |
| Dropped | Green | Student dropped safely |
| Delayed | Amber | Bus or workflow delay |
| Conflict | Red | Timetable/assignment conflict |
| Substitution Required | Amber | Absent teacher replacement needed |

## 1.7 Accessibility and Safety Rules

- Minimum mobile touch target: 44px.
- Do not rely only on color; include text labels/icons.
- Use readable text contrast.
- Show loading, empty, error, and permission-denied states.
- Confirm destructive actions.
- Mask sensitive student, medical, guardian, and financial data based on role.
- Keep child data access strictly guardian/student-scoped.
- Keep audit visibility for finance, accounting, student lifecycle, communication, and sensitive edits.
- Use keyboard-navigable web UI.
- Show validation errors close to the field.
- Save progress for long forms.

---

# 2. Web-Focused UI/UX

The web experience is for school operations and platform/developer administration. It should prioritize productivity, reports, tables, filtering, approvals, exports, and role-based control.

---

## 2.1 Landing Page UX

### Audience

- School owners
- Principals
- Administrators
- Accountants
- Decision-makers
- Potential SaaS customers

### Landing Page Goals

- Explain what SchoolOS does in less than 10 seconds.
- Build trust with schools in Nepal.
- Show core modules clearly.
- Convert visitors to demo/request/onboarding.

### Recommended Sections

1. **Hero Section**
   - Headline: `Run your entire school from one modern platform.`
   - Subheadline: `Admissions, attendance, fees, exams, notices, transport, payroll, and accounting for Nepal-based schools.`
   - CTA buttons: `Request Demo`, `Login`.
   - Visual: dashboard/mobile mockup.

2. **Problem/Solution Section**
   - Manual fee tracking.
   - Paper attendance.
   - Scattered notices.
   - Weak parent communication.
   - No real-time transport visibility.
   - Hard reporting.

3. **Module Overview**
   - Admissions.
   - Student Profiles.
   - Attendance.
   - Fees & Receipts.
   - Exams & Report Cards.
   - Homework & Timetable.
   - Notices & Communication.
   - Transport.
   - Accounting.
   - HR/Payroll.

4. **Nepal-Friendly Section**
   - NPR support.
   - Cash/bank/QR payment workflows.
   - Receipt printing.
   - Guardian records.
   - Local class/section structure.
   - Future Nepali date support.

5. **Trust and Security Section**
   - Role-based access.
   - Audit logs.
   - Secure student data.
   - Tenant isolation.
   - Encrypted sensitive fields.

6. **CTA Section**
   - `Start pilot school setup`.
   - `Book a demo`.

### Landing Page UX Rules

- Avoid technical jargon.
- Use school workflow language.
- Use screenshots/cards instead of long text.
- Make CTAs visible at top and bottom.
- Mobile landing page must load fast and be scroll-friendly.

---

## 2.2 School Dashboard UX

### Audience

- School admin
- Principal
- Accountant
- Admission staff
- Class teacher
- Subject teacher
- HR staff

### Dashboard Goal

The school dashboard should act as the daily command center.

### Web Dashboard Layout

- Left sidebar with grouped navigation.
- Topbar with search, academic year, notifications, profile, and school/tenant context.
- Welcome/school summary section.
- KPI cards.
- Operational cards for attendance, fees, notices, and pending actions.

### Recommended Sidebar Groups

```text
Overview
- Dashboard

People
- Students
- Guardians
- Teachers
- Staff

Academics
- Classes
- Subjects
- Attendance
- Homework
- Timetable
- Exams
- Report Cards

Finance
- Fees
- Receipts
- Accounting
- Cashier Close

Operations
- Notices
- Activity Feed
- Transport
- Library
- Canteen

HR
- Payroll
- Leave

System
- Settings
- Tenant Setup
- Audit Logs
```

Use module badges:

- `Live`
- `Phase 2`
- `Later`
- `Locked`

### Dashboard Cards

- Total Students
- Total Teachers
- Total Parents
- Present Today
- Absent Today
- Fees Collected
- Pending Fees
- Upcoming Exams
- Pending Admissions
- Unread Notices
- Cashier Close Status

### Dashboard UX Rules

- Do not overload the dashboard.
- Use summaries, not full tables.
- Every card should click into a module.
- Use charts only where they help decisions.
- Show urgent items clearly.
- Separate academic, finance, and operational insights.

---

# 3. Dedicated Module UX Sections

## 3.1 Dedicated Admissions UX

### Purpose

Admissions UX should help schools manage inquiries, applications, document checks, approvals, and final enrollment without losing applicants or duplicating records.

### Main Screens

- Admission dashboard.
- Inquiry list.
- Application list.
- Admission pipeline/kanban.
- Multi-step enrollment form.
- Document checklist.
- Application review.
- Admission confirmation.
- Fee setup link.

### Admission Pipeline

Recommended stages:

```text
Inquiry
Application Started
Documents Pending
Review
Approved
Admitted
Rejected
Withdrawn
```

### Admission Form Steps

```text
Step 1: Student details
Step 2: Guardian details
Step 3: Address/contact
Step 4: Academic details
Step 5: Health/medical details
Step 6: Documents
Step 7: Review and submit
```

### UX Requirements

- Save progress for long admissions.
- Show validation clearly.
- Use Nepal-friendly student/guardian fields.
- Mask sensitive health data.
- Allow document preview.
- Warn before creating duplicate students.
- Show admission decision history.
- Convert admitted applicant into active student cleanly.

---

## 3.2 Dedicated Attendance UX

### Purpose

Attendance UX should make daily marking fast for teachers and reporting reliable for admins and parents.

### Web Attendance Screens

- Today’s attendance.
- Class attendance.
- Student attendance history.
- Monthly register.
- Attendance reports.
- Attendance calendar.

### Teacher Marking Flow

```text
Select class
Select section
Select date
Mark all present
Change exceptions
Save
Confirm
```

### Attendance Statuses

```text
Present
Absent
Late
Excused
Holiday
Not Marked
```

### Calendar Colors

```text
Green = Present
Red = Absent
Amber = Late
Blue = Holiday
Grey = Not marked
```

### Mobile Attendance

Parent/student mobile should show:

- Child selector.
- Monthly calendar.
- Attendance summary.
- Legend.
- Absent/late notes if available.

### UX Requirements

- Avoid dense tables on mobile.
- Allow quick exception marking.
- Show not-marked warning.
- Export monthly register.
- Show attendance percentage by student and class.

---

## 3.3 Dedicated Fees and Receipts UX

### Purpose

Fees UX should help accountants collect fees, issue receipts, track dues, and close the day safely.

### Main Screens

- Fee dashboard.
- Fee collection counter.
- Student fee ledger.
- Invoice detail.
- Receipt print/download.
- Defaulter aging report.
- Payment reversal/refund.
- Cashier close/day-end.

### Fee Dashboard Cards

```text
Today’s Collection
Monthly Collection
Pending Fees
Overdue Fees
Refunds/Reversals
Cashier Close Status
```

### Student Fee Ledger Columns

```text
Invoice number
Fee type
Due date
Amount
Discount
Fine
Paid
Balance
Status
Receipt
Actions
```

### Actions

```text
Collect Payment
Print Receipt
Download Receipt
Reverse Payment
View Ledger
Export
```

### Fee Statuses

```text
Paid      green
Partial   amber
Unpaid    red
Overdue   red
Waived    blue
Refunded  slate
```

### Mobile Parent Fees

Parent view should show:

- Total fee.
- Paid amount.
- Due amount.
- Monthly fee cards.
- Receipt download.
- Payment history.
- Payment method labels.

Use NPR formatting:

```text
NPR 25,000
NPR 2,500 due
```

---

## 3.4 Dedicated Accounting UX

### Purpose

Accounting UX must feel more professional than normal school modules. It should support safe double-entry workflows, fiscal controls, posting status, and auditability.

### Accounting Dashboard Cards

```text
Total Revenue
Total Expense
Net Balance
Cash Balance
Bank Balance
Pending Postings
Journal Entries
Fiscal Period Status
```

### Accounting Sections

```text
Revenue Information
Payment History
Ledger Summary
Recent Journal Entries
Trial Balance Preview
Cashier Close Summary
Posting Errors
```

### Journal Entry Fields

```text
Date
Voucher number
Reference
Description
Ledger account
Debit
Credit
Source module
Status
Approval status
```

### Journal Actions

```text
Create Draft
Submit
Approve
Post
Reverse
Export
Print
```

### Accounting UX Rules

- Show clear posting status.
- Link source documents.
- Show debit/credit balance check.
- Show fiscal period warning.
- Show locked/closed period warning.
- Use reversal/correction workflow instead of editing posted entries.
- Show audit history.
- Reports must come from backend ledger, not frontend calculations.

---

## 3.5 Dedicated Exams and Report Cards UX

### Purpose

Exam UX should help schools set up exams, enter marks, validate missing data, publish results, and generate report cards.

### Main Screens

```text
Exam setup
Subject marks
Grade rules
Exam schedule
Mark entry
Result publishing
Report card generation
```

### Mark Entry Features

```text
Class filter
Subject filter
Exam filter
Autosave draft
Validation
Bulk upload
Lock marks
Publish result
```

### Report Card Page

Should include:

```text
Student summary
Subject marks
Total
Percentage/GPA
Rank/position
Teacher remarks
Attendance summary
PDF download
Publish status
```

### Mobile Result View

Should show:

```text
Subject
Marks
Grade
Total
Percentage
Result status
Download report card
```

### UX Rules

- Use step-by-step workflows.
- Prevent publishing incomplete results.
- Show missing marks clearly.
- Allow review before final publish.
- Lock published/approved results.

---

## 3.6 Dedicated Homework UX

### Purpose

Homework UX should help teachers create assignments and parents/students track due work easily.

### Teacher Web Screens

```text
Homework list
Create homework
Class/section assignment
Attachment upload
Submission review
Teacher comments
```

### Create Homework Fields

```text
Subject
Class
Section
Title
Description
Due date
Attachments
Submission required yes/no
Publish/save draft
```

### Parent/Student Mobile Homework

Use date-grouped homework cards:

```text
Subject
Title
Short description
Due date
Attachment count
Status
Action button
```

### Homework Statuses

```text
Pending
Submitted
Late
Checked
Returned
```

### UX Rules

- Group by due date or assigned date.
- Show subject icon/color.
- Show attachment count.
- Keep mobile homework card-based.
- Teachers should see review queue.

---

## 3.7 Dedicated Timetable UX

### Purpose

Timetable UX should support daily class visibility for parents/students/teachers and powerful scheduling for admins.

### Web Timetable Admin

For academic staff:

```text
Class timetable
Teacher timetable
Room timetable
Conflict detection
Substitution workflow
Versioning
Publish/lock/archive
```

### Timetable Builder

Builder should show:

```text
Weekly grid
Periods
Subjects
Teachers
Rooms
Conflict warnings
Teacher workload indicator
Publish button
```

### Conflict Warnings

```text
Teacher already assigned
Room already booked
Teacher unavailable
Subject weekly period requirement incomplete
Workload exceeded
Substitution required
```

### Important Visual States

```text
Conflict
Draft
Published
Locked
Archived
Substitution required
```

### Mobile Timetable

Student/parent view should show:

```text
Today timeline
Week date selector
Current period indicator
Teacher name
Room
Subject icon
```

Example:

```text
08:00 - 08:45
Maths
Jenny Wilson
Room 204
Now
```

---

## 3.8 Dedicated Notices and Communication UX

### Purpose

Communication UX should make school-parent communication clear, trackable, safe, and moderated.

### Notice List

Notice list should show:

```text
Title
Audience
Priority
Publish date
Read count
Delivery status
Action menu
```

### Notice Types

```text
General
Exam
Fee
Emergency
Holiday
Event
Transport
```

### Priority Levels

```text
Normal
Important
Urgent
Emergency
```

### Notice Composer Fields

```text
Title
Message
Audience
Class/section
Attachments
Publish now/schedule
SMS/push/email options later
```

### Parent-Class Teacher Chat

Chat should be controlled and auditable.

UX requirements:

```text
One thread per student per academic year
Guardian-to-primary-class-teacher conversation
Teacher availability indicator
Quiet hours message
Read receipts
Attachment controls
Report/block controls
Admin moderation
```

Recommended availability:

```text
Sunday–Thursday: 4:00 PM – 7:00 PM
Friday: 2:00 PM – 5:00 PM
Saturday/Public holidays: Closed
Emergency: Allowed with warning
```

Outside-hours message:

```text
Message queued.
Teacher will respond during school chat hours.
Usually replies within 1 school day.
```

---

## 3.9 Dedicated Transport UX

### Purpose

Transport UX can become one of SchoolOS’s most unique features. It should support admin route control, parent child-specific tracking, and driver trip workflows.

### Admin Transport Dashboard

Cards:

```text
Active Trips
Delayed Routes
Students Onboard
Students Not Boarded
Vehicles Active
Drivers Online
```

### Admin Screens

```text
Route setup
Vehicle setup
Driver assignment
Student stop assignment
Trip monitor
Trip history
Parent tracking controls
```

### Parent Bus Tracking

Mobile screen should show:

```text
Live map
Student status
ETA
Driver name
Driver phone
Vehicle number
Route timeline
Last updated time
Emergency contact
```

### Transport Statuses

```text
Ready
Bus arriving
Onboard
Dropped
Delayed
Route completed
```

### Driver App UX

Driver screen should be very simple:

```text
Start Trip
View Stops
Mark Boarded
Mark Dropped
Call School
End Trip
```

### Safety Rules

- Parent only sees their own child’s bus status.
- Driver only sees assigned route/student stop list.
- Admin sees all routes.
- Never expose full bus passenger list to parents.

---

## 3.10 Dedicated Library UX

### Purpose

Library can remain a later/locked module initially, but future UX should support book inventory, issue/return, overdue tracking, and borrowing history.

### Main Screens

```text
Books
Issue/Return
Students with borrowed books
Overdue books
Fine records
Library reports
```

### Book List Columns

```text
Book title
Author
ISBN
Category
Copies
Available
Status
Action
```

### UX Rules

- Quick issue/return.
- Barcode/QR support later.
- Overdue badge.
- Student borrowing history.
- Fine records if enabled.

---

## 3.11 Dedicated Canteen UX

### Purpose

Canteen UX should support meal plans, student meal tracking, canteen wallet, daily meal reports, and parent spending controls.

### Parent/Student UX

```text
Meal plan
Wallet balance
Daily meals
Spending limit
Allergy warning
Top-up history
```

### Admin UX

```text
Menu management
Meal served tracking
QR/student ID scan
Canteen wallet
Item sales
Daily meal count
Low balance alerts
Inventory later
```

### Statuses

```text
Meal Served
Not Served
Wallet Low
Blocked by Parent Limit
Allergy Warning
```

### UX Rules

- Show allergy warnings clearly.
- Respect parent spending controls.
- Keep serving workflow fast.
- Integrate finance/accounting posting later through proper service boundary.

---

## 3.12 Dedicated HR and Payroll UX

### Purpose

HR and Payroll UX should help schools manage staff records, leave, payroll preview, approval, payslips, and audit history.

### HR Dashboard Cards

```text
Total Staff
Present Today
On Leave
Payroll Drafts
Pending Approvals
Upcoming Contracts
```

### Staff Profile Tabs

```text
Overview
Attendance
Leave
Payroll
Documents
Performance
Activity Log
```

### Payroll Screens

```text
Payroll preview
Draft payroll run
Approval
Payslip generation
Payroll posting
Payroll history
```

### Payroll Statuses

```text
Draft
Pending Approval
Approved
Posted
Paid
Cancelled
```

### UX Rules

- Preview before posting.
- Approval required.
- No silent edits after posting.
- Audit all payroll actions.
- Show payroll posting state clearly.

---

## 3.13 Dedicated Settings UX

### Purpose

Settings UX should help schools complete setup, configure academic structures, control access, and manage operational preferences.

### School Settings Sections

```text
School profile
Academic year
Class/section setup
Fee setup
Attendance settings
Notice settings
Role permissions
Branding
Security
Integrations
```

### Setup Progress

Show setup checklist:

```text
School profile completed
Academic year configured
Classes created
Fee structure added
Users invited
Attendance rules configured
```

Progress card example:

```text
Setup 70% complete
Finish setup
```

### UX Rules

- Use grouped settings sections.
- Show setup warnings clearly.
- Do not mix school settings with platform settings.
- Show permission warnings before changing roles.
- Use audit logs for sensitive settings changes.

---

## 3.14 Dedicated Platform Control Plane UX

### Purpose

The Platform Control Plane is for SchoolOS owner/operator roles and must remain separate from school admin screens.

### Platform Dashboard Cards

```text
Total Schools
Active Schools
Suspended Schools
Monthly Revenue
Storage Usage
API Health
Failed Jobs
New Tenants
```

### Platform Screens

```text
Tenants/Schools
Subscriptions
Usage
Billing
Health
Audit Logs
Support Access
Onboarding
```

### Developer Portal UX

Future developer-focused area should include:

```text
API documentation links
API key management
Webhook endpoints
Request logs
Error logs
Rate limit visibility
Integration guides
Sandbox/test tenant setup
```

### Platform UX Rules

- Use operator-console visual style, different from school admin.
- Show cross-tenant warnings clearly.
- Never mix tenant-scoped settings with platform settings.
- Support actions must be audited.
- Developer keys and secrets must be masked.
- Platform actions should require platform roles only.

---

# 4. Full Mobile Portal UX

The app experience should be mobile-first and role-specific. It can initially be a responsive PWA inside the Next.js app, with native mobile/Expo considered later only if needed.

## 4.1 Mobile Portal Routes

Recommended initial PWA-style routes:

```text
/mobile
/mobile/home
/mobile/attendance
/mobile/timetable
/mobile/homework
/mobile/fees
/mobile/profile
/mobile/transport
/mobile/messages
/mobile/notices
/mobile/results
```

## 4.2 Parent App UX

### Parent Goals

Parents need quick answers:

- Is my child present today?
- Is there homework?
- Is there a fee due?
- Is the bus safe/on time?
- Are there new notices?
- Can I message the class teacher?

### Parent Home Screen

Sections:

```text
Greeting
Child switcher
Today summary card
School update banner
Quick access grid
Homework due
Fee due
Bus status
Latest notices
```

Quick actions:

```text
Attendance
Homework
Timetable
Fees
Report Card
Transport
Notices
Chat Teacher
Events
```

### Parent Safety Rules

- Parents only see their own linked children.
- Parents cannot see other students.
- Parent chat must be moderated and auditable.
- Fees and medical data require strict role checks.

## 4.3 Teacher App UX

### Teacher Goals

Teachers need fast daily actions:

```text
See today’s classes
Mark attendance
Assign homework
Review homework
Upload marks
Reply to parent messages
See substitution duties
```

### Teacher Home Cards

```text
Today’s Classes
Attendance to Mark
Homework to Review
Parent Messages
Substitution Duty
Notices
```

### Teacher UX Rules

- Minimize typing on mobile.
- Use quick actions.
- Do not overload teacher app with admin-only workflows.
- Respect chat quiet hours.

## 4.4 Student App UX with Age-Aware Control

Student access must be age-aware and parent-controlled.

### Student Goals

```text
See today’s timetable
Check homework
View results/report cards
Read notices
Access learning resources
Track attendance if allowed
```

### Age Verification and Phone Usage Policy

| Age Group | Access Model | Phone Usage UX |
|---|---|---|
| Under 10 | Parent-controlled only | No independent student login by default |
| 10-12 | Limited student view | Parent approval required |
| 13-15 | Student login allowed with controls | Parent/school controlled features |
| 16+ | Expanded student portal | Still school-policy controlled |

### Parent-Controlled Student Access

Parents/school should control:

```text
Whether student login is enabled
Which modules student can access
Whether chat is available
Whether result details are visible
Notification preferences
Device/session access
```

### Student Restrictions

- No direct unrestricted teacher chat for younger students.
- No visibility into other students.
- No financial payment controls except read-only fee visibility if allowed.
- Sensitive guardian/medical information should be hidden or minimized.
- Parent can disable student app access.

## 4.5 Driver App UX

Driver UX should be simple, safe, and route-focused.

Screens/actions:

```text
Assigned route
Start trip
View stops
Mark boarded
Mark dropped
Emergency call
End trip
Trip history
```

Driver should not see unnecessary school, finance, or academic data.

## 4.6 Mobile Navigation

Parent/student:

```text
Home
Academics
Transport
Messages
Profile
```

Teacher:

```text
Home
Classes
Homework
Messages
Profile
```

Driver:

```text
Trip
Route
Messages
Profile
```

---

# 5. Nepal-Friendly UX Requirements

SchoolOS should support Nepal school workflows from the beginning.

## 5.1 Local Requirements

```text
NPR currency
Nepali phone number format
Guardian contact structure
Grade/Class/Section naming
Cash, bank, QR payment labels
Receipt printing
Nepali date / Bikram Sambat later
SMS/Viber/WhatsApp-ready communication later
Local exam/report card structure
Transport stop names
Local vehicle number formats
```

## 5.2 Examples

```text
Class 10 - Section A
NPR 25,000
Ba 2 Kha 1234
Guardian: Father / Mother / Local Guardian
Usually replies within 1 school day
```

## 5.3 Nepal-Friendly Finance UX

- Use `NPR` consistently.
- Support manual cash/bank/QR collection first.
- Add eSewa/Khalti only after manual reconciliation is stable.
- Print receipts clearly.
- Show cashier close/day-end status.

## 5.4 Nepal-Friendly Communication UX

- Parent notifications should support SMS/push later.
- Chat hours should match Nepal school routines.
- Default recommended chat hours:
  - Sunday-Thursday: 4:00 PM-7:00 PM.
  - Friday: 2:00 PM-5:00 PM.
  - Saturday/public holidays: closed except emergency.

---

# 6. Implementation Plan

## Phase UI-0: UI Audit and Foundation

Goal: understand current UI and prepare the design foundation.

Tasks:

- Audit current `apps/web` routes and components.
- Identify duplicate UI patterns.
- Document current dashboard, student, finance, attendance, and settings screens.
- Finalize design tokens.
- Finalize navigation groups.

Deliverables:

- UI audit notes.
- Design token plan.
- Component inventory.

---

## Phase UI-1: Global Design System

Goal: create consistent UI building blocks.

Tasks:

- Add/standardize theme tokens.
- Build shared components: PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, LoadingState, ActionMenu.
- Standardize buttons, inputs, filters, cards, badges, and spacing.

Deliverables:

- Shared design components.
- Consistent visual system.

---

## Phase UI-2: Web Shell and Navigation

Goal: improve the main school admin layout.

Tasks:

- Redesign dashboard shell.
- Add grouped sidebar.
- Add active route state.
- Add module badges: Live, Phase 2, Later, Locked.
- Improve topbar with search, notification, profile, academic year/school context.

Deliverables:

- Improved web admin shell.
- Cleaner navigation.

---

## Phase UI-3: School Dashboard Redesign

Goal: make dashboard a daily command center.

Tasks:

- Add welcome/school summary section.
- Add KPI cards.
- Add attendance overview.
- Add fee collection overview.
- Add notices/events panel.
- Add pending actions/recent activity.

Deliverables:

- Modern school dashboard.

---

## Phase UI-4: Student and Admissions UX

Goal: make student and admission operations faster and clearer.

Tasks:

- Redesign student list.
- Add filters and action menu.
- Improve student profile with cards and tabs.
- Improve guardian, document, attendance, fee, and activity views.
- Add admission pipeline and step-based admission form polish.

Deliverables:

- Modern student directory.
- Improved student profile.
- Admission workflow UI foundation.

---

## Phase UI-5: Core Academic Workflow UX

Goal: improve daily academic workflows.

Tasks:

- Attendance calendar and summary views.
- Homework cards and review flow.
- Timetable timeline/grid views.
- Timetable conflict UI.
- Exam/result/report card UX polish.
- Notice center polish.

Deliverables:

- Better academics and communication workflows.

---

## Phase UI-6: Finance and Accounting UX

Goal: make finance safe, clear, and professional.

Tasks:

- Improve fee collection screens.
- Improve student fee ledger.
- Improve receipt/cashier close UI.
- Build accounting dashboard polish.
- Add posting/fiscal-period/reversal warnings.

Deliverables:

- Production-grade finance/accounting UI.

---

## Phase UI-7: Operations UX

Goal: improve school operations modules.

Tasks:

- Transport admin route dashboard and parent tracking foundation.
- Library future UI foundation.
- Canteen future UI foundation.
- Activity feed grouping and audit visibility.
- HR/payroll UX polish.

Deliverables:

- Clear operations module UX.
- Future-ready Library/Canteen UX foundations.

---

## Phase UI-8: Platform and Developer UX

Goal: separate platform/operator/developer experience from school admin.

Tasks:

- Improve platform dashboard.
- Improve tenant/school management UI.
- Add health/usage cards.
- Add developer portal placeholders for API docs, keys, webhooks, logs.

Deliverables:

- Cleaner platform control plane.
- Developer portal foundation.

---

## Phase UI-9: Mobile/PWA Portal Foundation

Goal: create parent/student/teacher mobile experience as PWA-style routes.

Tasks:

- Create `MobileShell`.
- Add role-based mobile bottom nav.
- Build parent/student home.
- Build attendance, timetable, homework, fees, profile screens.
- Add transport placeholder.

Deliverables:

- Mobile portal foundation.

---

## Phase UI-10: Role-Specific App UX

Goal: deepen mobile flows for parents, teachers, students, and drivers.

Tasks:

- Parent child switcher and teacher chat.
- Teacher class/attendance/homework flow.
- Student age-aware access controls.
- Driver trip screen.
- Transport tracking UI.

Deliverables:

- Role-specific app UX.

---

## Phase UI-11: Polish and Production Readiness

Goal: make the UI ready for pilot schools.

Tasks:

- Responsive testing.
- Accessibility testing.
- Loading/empty/error states.
- Permission-denied states.
- Audit-sensitive UI review.
- Performance cleanup.
- Visual consistency pass.

Deliverables:

- Production-ready UI/UX baseline.

---

# 7. Module-by-Module Priority Matrix

| Module | Web Admin Priority | Mobile Priority | Notes |
|---|---:|---:|---|
| Landing Page | High | High | Converts schools to demos/onboarding |
| Dashboard | High | Medium | First impression of system |
| Students | High | Medium | Core school record |
| Admissions | High | Low | Admin-heavy but important for onboarding |
| Attendance | High | High | Daily workflow |
| Fees | High | High | Business-critical |
| Receipts | High | Medium | Trust and audit critical |
| Accounting | High | Low | Admin/accountant only |
| Homework | Medium | High | Parent/student important |
| Timetable | Medium | High | Parent/student/teacher important |
| Exams | Medium | Medium | Seasonal but high-impact |
| Report Cards | Medium | High | Parent/student important |
| Notices | High | High | Communication-critical |
| Parent-Class Teacher Chat | Medium | High | Phase 2/3 after notification center is stable |
| Activity Feed | Medium | Low | Admin/staff mostly |
| Transport | Medium | High | Unique feature and parent trust driver |
| Library | Low | Low | Later module |
| Canteen | Low | Medium | Later module, parent wallet controls important |
| HR/Payroll | Medium | Low | Admin/staff only |
| Settings | High | Low | Setup-critical |
| Platform Control | Medium | None | Operator only |
| Developer Portal | Low | None | Future integrations/API ecosystem |
| Driver App | Low | High | Needed when transport live tracking matures |

---

# 8. Final Recommended Execution Order

Do not start with mobile first. The best order is:

1. Global design system.
2. Web admin shell/navigation.
3. School dashboard.
4. Student list/profile.
5. Admissions workflow polish.
6. Attendance, timetable, homework.
7. Exams and report cards.
8. Fees and receipts.
9. Accounting dashboard and ledger-safe UI.
10. Notices and communication.
11. Settings/setup UX.
12. HR/payroll UX.
13. Transport admin foundation.
14. Library and canteen future UI placeholders.
15. Platform control plane.
16. Developer portal foundation.
17. Mobile parent/student/teacher portal.
18. Transport live tracking and driver app.
19. Final polish, accessibility, and production readiness.

This order avoids visual inconsistency and prevents building mobile screens before the core design system is stable.
