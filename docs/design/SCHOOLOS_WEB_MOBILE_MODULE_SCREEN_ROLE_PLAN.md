# SchoolOS Web and Mobile Module Screen Role Plan

**Status:** Product/design/frontend planning document  
**Last updated:** 2026-06-15  
**Owner mindset:** CTO, CEO, Product Designer, Senior Frontend Developer, Senior UI/UX Designer  
**Related docs:**

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/frontend/SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md
```

This document defines how every SchoolOS module should appear on **web** and **mobile**, and how **roles, permissions, module entitlements, and device context** decide screen design.

This is a planning document. It does not implement UI.

---

## 1. Product Positioning

SchoolOS has two major product experiences:

```text
Web Dashboard = deep school operations
Mobile App = focused role-specific companion
```

The web dashboard is for dense work:

```text
Tables
Filters
Bulk actions
Exports
Approvals
Setup
Configuration
Audit trails
Long forms
Complex workflows
```

The mobile app is for fast daily action:

```text
Cards
Timelines
Notifications
Quick actions
Own tasks
Own children
Assigned trips
Today view
Simple status updates
```

Final rule:

```text
Do not turn the mobile app into a smaller web admin dashboard.
Do not turn the web dashboard into only cards when staff need tables and reports.
```

---

## 2. How Roles and Permissions Decide Screen Design

### 2.1 Screen decision inputs

Every screen must be decided by these inputs:

```text
1. Authenticated user
2. Tenant/school context
3. Assigned roles
4. Fine-grained permissions
5. Module entitlement / subscription lock
6. Relationship scope: own class, own subject, own child, assigned trip, assigned counter, assigned school
7. Device type: web, mobile, tablet/POS
8. Workflow state: draft, pending, approved, posted, locked, published, archived, cancelled
```

### 2.2 UI generation rule

The frontend should never ask only:

```text
What page is this?
```

It must ask:

```text
Who is using this page?
What are they allowed to do?
What data are they allowed to see?
What is the safest next action?
What should be hidden, disabled, or explained?
```

### 2.3 Role-based screen layers

Every module screen should be composed in layers:

| Layer | Controlled by | Example |
|---|---|---|
| Route access | Role + permission + module entitlement | Can user open `/dashboard/fees`? |
| Navigation visibility | Role + permission + entitlement | Show/hide Fees in sidebar. |
| Data scope | Backend permission + relationship scope | Teacher sees own class; parent sees own child. |
| Actions | Permission + workflow state | Cashier can collect payment but cannot reverse without approval. |
| Components | Role + device + task complexity | Accountant sees table; parent sees card. |
| Copywriting | Role + context | “Collect Payment” for cashier, “Pay Fees” for parent. |
| State UI | API state + permission + entitlement | Loading, empty, error, permission denied, module locked. |

### 2.4 Permission-driven screen states

Every module workspace must support:

```text
Full access
Read-only access
Scoped access
Action-only access
Approval-only access
Self-service access
Parent/child-scoped access
Mobile-only access
No access
Module locked
```

Examples:

| Case | Screen behavior |
|---|---|
| User can view but not manage | Show records and hide create/edit/delete actions. |
| User can approve but not create | Show approval queue, not creation forms. |
| Teacher has own-class scope | Filter data to own class; do not show school-wide filters. |
| Parent has own-child scope | Show child switcher only for linked children. |
| Driver has assigned-trip scope | Show only today/assigned trip, not route admin. |
| Module locked | Show locked module card and contact/admin upgrade direction if appropriate. |
| Direct blocked URL | Show permission state, not blank or 404 unless route truly does not exist. |

---

## 3. Device Strategy by Role

| Role / actor | Web | Mobile | Design priority |
|---|---|---|---|
| Platform operator | Yes | No by default | Web-only SaaS control plane. |
| School owner/director | Yes | Optional | Executive overview, alerts, approvals. |
| Principal/head teacher | Yes | Yes | Web for operations; mobile for alerts/approvals. |
| Vice principal/academic coordinator | Yes | Optional | Web-first academic operations. |
| School admin/office admin | Yes | Optional | Web-first records and office workflows. |
| Admission officer | Yes | Optional | Web-first admission pipeline. |
| Accountant | Yes | Optional summary/approval | Web-first financial accuracy. |
| Cashier | Yes | Optional receipt lookup/tablet | Web/tablet counter workflow. |
| HR/payroll officer | Yes | Optional summary/approval | Web-first confidential payroll. |
| Class teacher | Yes | Yes | Web for detail, mobile for daily class work. |
| Subject teacher | Yes | Yes | Web for marks/homework, mobile for quick tasks. |
| Librarian | Yes | Optional scanner/tablet | Web/tablet desk workflow. |
| Transport manager | Yes | Yes | Web for planning, mobile for live operations. |
| Driver/conductor | No admin web | Yes | Mobile-only assigned trip flow. |
| Canteen manager | Yes | Optional tablet/POS | Web/tablet POS and stock. |
| POS-only canteen staff | Limited web/tablet | Optional | Fast scan/sell/serve only. |
| Parent/guardian | Optional portal later | Yes | Mobile-first own-child view. |
| Student | Optional portal later | Yes | Mobile-first age-appropriate learning. |
| Support user under override | Web only | No | Time-limited audited support session. |

---

## 4. Screen Design Modes

SchoolOS should not design every screen the same way. The same backend module may produce different screen designs by role.

### 4.1 Executive mode

For:

```text
Owner/director
Principal with owner role
Board/management role if added later
```

Design style:

```text
KPI cards
Trend summaries
Risk highlights
Approval queue
Module health
Drill-down links
Minimal forms
```

Use for:

```text
School business overview
Enrollment trend
Fee collection and dues
Attendance risk
Academic outcomes
Staff cost summary if permitted
Audit/security alerts
```

### 4.2 Operations mode

For:

```text
Principal
Vice principal
School admin
Transport manager
HR manager
Canteen manager
Librarian
```

Design style:

```text
Task queues
Data tables
Filters
Status boards
Calendar views
Workflow steps
Approvals
```

### 4.3 Practitioner mode

For:

```text
Teacher
Class teacher
Subject teacher
Cashier
Librarian desk user
Canteen POS user
Driver
```

Design style:

```text
Today-focused
Fast action buttons
Limited filters
Scanner/search-first
Clear success/failure feedback
Few advanced settings
```

### 4.4 Self-service mode

For:

```text
Parent
Student
Staff self-service
```

Design style:

```text
Mobile-first cards
Own data only
Simple language
No dense tables
Timeline/status views
Download/view actions only where scoped
```

### 4.5 Platform mode

For:

```text
SchoolOS platform operator
Support operator
Billing operator
```

Design style:

```text
Enterprise control plane
Tenant list
Provider health
Queue operations
SaaS billing
Support override banner
Audit-first actions
```

---

## 5. Global Web Screen Template

Every web module should follow this structure unless there is a strong reason not to:

```text
AppShell / PlatformShell
  Topbar
  Sidebar
  PageHeader
    Title
    Description
    Primary action
    More actions
  ContextBar / FilterBar
  Summary strip / KPI cards when useful
  Main workspace
    DataTable / Grid / Builder / Timeline / Board
  Optional right insight drawer
  Action dialogs
  State components
```

### Required web states

```text
Loading skeleton
Empty state with next action
Error state with retry
Permission denied state
Module locked state
Read-only state where applicable
Pending mutation state
Success confirmation
Partial success state for batch operations
```

---

## 6. Global Mobile Screen Template

Every mobile module screen should follow this structure:

```text
MobileShell
  MobileHeader
  Role/child/class/trip switcher if needed
  Today summary card
  Main card list / timeline / action panel
  Primary bottom action when needed
  Bottom navigation
  State components
```

### Mobile rules

```text
1. No dense admin tables.
2. Use cards, timelines, lists, and simple action buttons.
3. Use own data or assigned data only.
4. Use bottom navigation for parent/student/driver/teacher flows.
5. Keep forms short; use stepper only when necessary.
6. Offline/pending states matter for attendance, trips, and field operations.
7. Push notifications should deep-link into the correct scoped screen.
```

---

## 7. Module-by-Module Web and Mobile Screen Plan

## 7.1 Dashboard / Home

### Web screens

| Screen | Primary roles | Main job | Design |
|---|---|---|---|
| Executive Overview | Owner/director | Understand business health and risks. | KPI cards, trends, approvals, audit highlights. |
| School Operations Overview | Principal | Know today’s operational/academic issues. | Attendance, teachers, timetable, notices, result readiness. |
| Office Dashboard | Admin/admission officer | Clear student/admission/document tasks. | Task queues, profile gaps, duplicate warnings. |
| Finance Today | Accountant/cashier | Track collection, dues, receipts, close status. | Money cards, queue, table, cashier close alert. |
| My Classes Today | Teachers | Handle class/subject tasks. | Today periods, attendance, homework, marks, messages. |
| Platform Attention Dashboard | Platform operator | Manage SaaS/operator issues. | Tenant/provider/queue/billing/audit cards. |

### Mobile screens

| Screen | Primary roles | Main job | Design |
|---|---|---|---|
| My Child Overview | Parent | See child status and next actions. | Child switcher, cards, notices, homework, fees, transport. |
| My Learning Today | Student | See learning tasks. | Timetable, homework, results, notices. |
| My Classes Today | Teacher | Quick daily teaching tasks. | Class cards, attendance, homework, timetable. |
| My Assigned Trip | Driver | Operate today’s trip. | Route card, manifest, pickup/drop buttons. |
| Executive Alerts | Owner/principal | See high-risk alerts. | Summary cards and approval links only. |

### Role/permission design rules

```text
Owner sees business and risk first.
Principal sees operations and academics first.
Teacher sees assigned classes only.
Parent sees own children only.
Student sees own tasks only.
Platform operator never enters tenant dashboard unless using audited support override.
```

---

## 7.2 M0 Platform Control Plane

### Web screens

| Screen | Roles | Main job | Key components |
|---|---|---|---|
| Platform Dashboard | Platform operator | See platform attention items. | Platform KPI cards, provider/queue/billing alerts. |
| Schools/Tenants | Platform operator | Find and manage schools. | DataTable, tenant status badges, filters. |
| School Detail | Platform operator/support | Review one school safely. | Tenant profile, subscription, usage, support override banner. |
| Plans and Entitlements | Platform billing/admin | Manage SaaS plans and feature limits. | Plan cards, feature matrix, module lock preview. |
| SaaS Billing | Platform billing | Issue/pay/cancel SchoolOS invoices. | Invoice table, payment history, reason dialogs. |
| Providers | Platform operator | Check SMS/email/payment/storage readiness. | Provider health cards, test actions. |
| Queues | Platform operator | Inspect/retry/discard failed jobs. | Failed job table, group view, retry/discard dialog. |
| Audit and Support Override | Platform auditor/support | Track sensitive access. | Audit filters, support session banner. |

### Mobile screens

```text
No default mobile platform app for v1.
Only optional owner/operator alert summary later.
```

### Role/permission design rules

```text
Platform roles are separate from school roles.
SaaS invoices never appear inside M3 Fees.
Support override must show visible banner, reason, duration, and audit trail.
Tenant private data stays hidden unless override grants temporary scoped access.
```

---

## 7.3 Auth / Users / Roles / Settings

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Login / OTP / MFA | All users | Secure login. | Simple form, cooldown, MFA steps. |
| My Profile / Security | Staff/admin/teacher | Manage own security. | Account card, MFA setup, password recovery. |
| Users Workspace | School admin/owner | Manage staff/user accounts. | User table, status, reset, force logout. |
| Roles and Permissions | School admin/owner | Configure access. | Role list, permission matrix, assignment panel. |
| School Settings | Admin/owner | Configure school profile and branding. | Sections: profile, logo, academic setup, users, audit. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Mobile Login | Parent/student/teacher/driver | Sign in securely. | Phone/email login, OTP/MFA as needed. |
| Account Settings | All mobile users | Basic profile/security. | Simple cards, password/MFA if enabled. |

### Role/permission design rules

```text
Only authorized admins manage users/roles.
Users cannot grant themselves higher permissions.
Parent/student/driver account settings are limited and scoped.
Settings should be split by responsibility, not shown as one giant page.
```

---

## 7.4 M1 Students

### Web screens

| Screen | Primary roles | Main job | Design |
|---|---|---|---|
| Student Directory | Admin, owner, principal, class teacher scoped | Find students. | Search-first DataTable, class/section/status filters. |
| Student Profile | Admin, principal, class teacher scoped | Review one student safely. | Profile header, tabs, status badges. |
| Guardian Management | Admin/admission officer | Manage guardian links and verification. | Guardian cards, invite/review actions. |
| Student Documents | Admin/office | Generate/view/revoke documents. | Protected document list, PDF actions. |
| Student Photo | Admin/class teacher with permission | Upload/preview/remove photo. | Protected image preview and upload. |
| Student QR/Identity | Admin/authorized scanner roles | Generate/rotate/revoke QR. | QR lifecycle panel, scan audit. |
| Lifecycle Timeline | Admin/principal | Track transfer/archive/alumni changes. | Timeline with reasons/audit. |
| IEMIS Readiness | Admin/owner | Prepare government export. | Readiness table, blockers, CSV export. |

### Mobile screens

| Screen | Primary roles | Main job | Design |
|---|---|---|---|
| Student Summary | Parent | View own child profile summary. | Child card, class, section, basic info. |
| My Profile | Student | View own basic info. | Simple card, age-appropriate. |
| My Class Students | Class teacher | Quick access to own class. | Class roster cards/search. |

### Role/permission design rules

```text
Admin sees full student management.
Class teacher sees own class/student scope only.
Parent sees own child only.
Student sees own data only.
Librarian/canteen/driver see only identity needed for their workflow, not full profile.
Sensitive student documents/photos must use protected preview/download helpers.
```

---

## 7.5 M1 Admissions

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Admissions Pipeline | Admission officer/admin | Move applications by status. | Board/table hybrid, status filters. |
| Application Detail | Admission officer/admin | Review applicant and documents. | Sections, checklist, status actions. |
| Duplicate Review | Admission officer/admin | Prevent duplicate student records. | Candidate cards, preview before merge. |
| Bulk Import Review | Admission officer/admin | Import applicants/students safely. | Batch table, row errors, confirmation. |
| Enrollment Confirmation | Admission officer/admin | Convert accepted application to student. | Summary, duplicate warnings, final confirm. |

### Mobile screens

```text
No full admissions mobile workflow in v1.
Optional owner/principal mobile cards can show new applications and admission trend.
```

### Role/permission design rules

```text
Admission officer can manage pipeline but should not see unrelated payroll/accounting.
Owner/principal may view summary and approve if policy requires.
Enrollment actions require permission and clear confirmation.
```

---

## 7.6 M2 Attendance

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Mark Attendance | Teacher/class teacher | Submit class attendance. | Class/date roster, fast present/absent controls. |
| Monthly Register | Admin/principal/teacher scoped | Review attendance records. | Calendar/table register, export. |
| Corrections Queue | Teacher/admin/principal | Request/review corrections. | Queue table, request form, review actions. |
| Conflict Review | Admin/principal | Resolve attendance conflicts. | Conflict cards/table, decision dialog. |
| Working Day Calendar | Admin | Configure school days/holidays. | Calendar grid and policy state. |
| Staff Attendance Link | HR/admin | Review staff attendance. | Staff attendance summary and leave links. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Teacher Attendance | Class teacher | Mark attendance quickly. | Class card, student list, offline/pending state. |
| Parent Attendance | Parent | See own child attendance. | Calendar/card summary. |
| Student Attendance | Student | See own attendance. | Simple monthly summary. |
| Principal Attendance Alerts | Principal | See not-submitted/risk classes. | Alert cards only. |

### Role/permission design rules

```text
Teacher marks only assigned class/section/session.
Principal reviews school-wide attendance but not necessarily edits all records.
Admin can manage corrections if permitted.
Parent/student use scoped summaries only.
Locked attendance sessions show reason and correction path.
```

---

## 7.7 M3 Fees / Receipts / Payments

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Finance Today | Accountant/owner | Review collections, dues, risks. | Money KPI cards, alerts, queue links. |
| Fee Setup | Accountant/admin | Configure heads/plans/discounts/waivers. | Forms, setup tables, validation. |
| Invoice List | Accountant/cashier | Find invoices. | DataTable with amount/status filters. |
| Student Ledger | Accountant/cashier/admin scoped | See student fee history. | Ledger table, invoice/payment/receipt timeline. |
| Payment Collection | Cashier/accountant | Collect payment safely. | Search-first counter UI, payment form, receipt success. |
| Receipts | Cashier/accountant | Verify/reprint/download receipts. | Receipt table, protected PDF, reprint reason. |
| Refund/Reversal Requests | Accountant/principal/owner | Review risky money changes. | Approval queue, amount/risk summary. |
| Cashier Close | Cashier/accountant | Close daily collection. | Preview, discrepancy state, confirm close. |
| Defaulters and Reminders | Accountant/admin | Track dues and send reminders. | Defaulter table, preview recipients. |
| Fee Reports | Accountant/owner | Export/review collections and dues. | Report filters, CSV/PDF actions. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Parent Fees | Parent | View/pay own child dues. | Due cards, receipt list, payment action if enabled. |
| Receipt Viewer | Parent | View/download own receipts. | Receipt cards, protected download. |
| Owner Finance Alerts | Owner | See collection/dues summary. | Executive cards only. |
| Cashier Lookup | Cashier optional | Quick receipt/student lookup. | Search + receipt status. |

### Role/permission design rules

```text
Cashier can collect and issue receipts, but not configure fee plans unless granted.
Accountant can manage setup/reports and review reversals.
Owner can see financial summary and approvals but payroll/accounting depth still depends on permissions.
Parent sees only own child dues and receipts.
All money actions require strong pending states and audit/reason where needed.
```

---

## 7.8 M4 Academics / Exams / CAS / Report Cards

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Academic Setup | Academic coordinator/admin | Configure exam terms/components. | Setup forms and term status. |
| Exam Timetable | Coordinator | Schedule exams. | Timetable table/calendar, publish readiness. |
| Marks Entry | Subject teacher/coordinator | Enter and validate marks. | Marks grid, row errors, lock state. |
| CAS Entry | Teacher/coordinator | Record continuous assessment. | Student/component grid. |
| Report Cards | Coordinator/principal | Generate/review PDFs. | Batch table, readiness, protected PDF. |
| Result Publishing | Principal/coordinator | Publish/unpublish results. | Readiness blockers, confirmation. |
| Promotion Workflow | Principal/coordinator | Promote students. | Review table, batch action, blockers. |
| Syllabus Progress | Subject teacher/coordinator | Track syllabus completion. | Topic list, progress cards. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Teacher Marks Tasks | Subject teacher | See pending mark entry. | Task cards, deep-link to web for complex entry if needed. |
| Parent Report Cards | Parent | View published report cards. | Published result card, PDF download. |
| Student Results | Student | View published results. | Simple result cards. |
| Principal Academic Alerts | Principal | See readiness blockers. | Alert cards. |

### Role/permission design rules

```text
Subject teacher enters marks only for assigned subject/classes.
Coordinator reviews academic readiness across classes.
Principal publishes results if permitted.
Parent/student see only published results/report cards.
Unpublished marks/results must never appear in mobile scoped views.
```

---

## 7.9 M5 Activity Feed / Milestones

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Activity Feed Workspace | Teacher/admin | Create and manage posts. | Feed list, composer, filters. |
| Post Detail | Teacher/admin/moderator | Review one post. | Post preview, audience, actions. |
| Audience Preview | Teacher/admin | Confirm recipients before publish. | Recipient summary and exclusions. |
| Media Gallery | Teacher/admin | Review uploaded media. | Gallery grid, consent states. |
| Moderation Queue | Moderator/principal | Approve/reject content. | Queue cards/table, decision dialog. |
| Mood Logs / Milestones | Preschool teacher | Record child updates. | Template cards and timeline. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Parent Activity Feed | Parent | See own child/class updates. | Feed cards, media consent-aware. |
| Teacher Quick Post | Teacher | Post classroom update. | Simple composer, photo upload, audience preview. |
| Milestone Update | Preschool teacher | Record quick milestone/mood. | Child card + template action. |

### Role/permission design rules

```text
Teacher posts only to assigned class/allowed audience.
Parent sees only relevant child/class posts.
Media visibility must respect consent and scoped endpoints.
Moderators/principals see moderation queue if permission exists.
```

---

## 7.10 M6 Homework

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Homework Workspace | Teacher/coordinator | Create and manage homework. | List/table with status filters. |
| Homework Detail | Teacher | Review assignment. | Summary, attachments, lifecycle actions. |
| Submissions Review | Teacher | Review submitted homework. | Submission table/cards, correction actions. |
| Reminder Preview | Teacher | Send reminders safely. | Recipient preview before send. |
| Homework Reports | Teacher/principal | Track completion/missing work. | Reports, filters, export. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Parent Homework | Parent | Track own child homework. | Due/missing/completed cards. |
| Student Homework | Student | See and submit homework. | Task cards, submit action. |
| Teacher Homework Quick View | Teacher | See due/missing work. | Class summary cards. |

### Role/permission design rules

```text
Teacher manages own assignments/classes.
Parent/student see only assigned homework and their own submission state.
Reminder send must show preview and respect communication policy.
Attachments use protected preview/download.
```

---

## 7.11 M6 Timetable / Substitutions

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Timetable Builder | Coordinator/admin | Build and publish timetable. | Grid builder, validation panel. |
| Periods and Rooms | Admin/coordinator | Configure schedule resources. | Setup tables/forms. |
| Teacher Availability | Coordinator | Manage teacher availability. | Availability grid. |
| Workload Rules | Coordinator/principal | Control workload limits. | Rule table and warnings. |
| Substitutions | Coordinator/principal | Assign substitute teachers. | Daily summary, conflict-aware assignment. |
| Teacher/Class Timetable | Teacher/student/parent scoped | View timetable. | Calendar/grid view. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| My Timetable | Teacher/student | See today/week schedule. | Cards by period. |
| Class Timetable | Parent/student | See class schedule. | Simple weekly view. |
| Substitution Alert | Teacher/principal | Know substitution assignment. | Push/card alert. |

### Role/permission design rules

```text
Coordinator can build and publish if permitted.
Teacher sees own timetable and substitution assignments.
Parent/student see class/own timetable only.
Timetable conflicts must be visible before publish.
```

---

## 7.12 M7 HR / Payroll

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Staff Directory | HR/admin/principal scoped | Find staff. | DataTable, status filters. |
| Staff Profile | HR/admin | Manage staff lifecycle. | Profile header, tabs, timeline. |
| Leave Queue | HR/principal | Review leave. | Queue table/cards, decision dialog. |
| My Staff Self-Service | Staff | View own profile/leave/attendance. | Self-service cards. |
| Payroll Preview | Payroll officer | Preview payroll. | Preview table, warnings. |
| Payroll Runs | Payroll officer/principal/owner scoped | Manage payroll lifecycle. | Run table, status badges. |
| Payroll Run Detail | Payroll officer | Review/approve/post/mark paid. | Stepper/state machine. |
| Payslips | Payroll/staff scoped | View/download payslips. | Protected PDF actions. |
| Salary Structures | HR/payroll | Manage salary setup. | Confidential forms/tables. |
| Payroll Reports | HR/payroll/owner if permitted | Export payroll reports. | Report filters and CSV/PDF. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| My Leave | Staff/teacher | Request/view leave. | Card form and status list. |
| My Payslips | Staff | View own payslips. | Payslip cards, protected PDF. |
| Leave Approval | Principal/HR | Approve/reject leave. | Approval cards. |
| Payroll Alerts | Owner/principal if permitted | See payroll approval alerts. | Summary only unless payroll permission. |

### Role/permission design rules

```text
Payroll salary data is confidential.
Principal/owner do not automatically see salary details without payroll permission.
Staff sees own payslips only.
Payroll posting to accounting requires explicit permission and audit.
```

---

## 7.13 M8A Library

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Library Desk | Librarian | Issue/return quickly. | Search/scanner-first panel. |
| Book Catalog | Librarian/admin | Manage books. | DataTable with category/status filters. |
| Copy Management | Librarian | Manage physical copies. | Copy status table. |
| Reservations | Librarian | Manage holds. | Reservation queue. |
| Overdue | Librarian/admin | Track overdue items. | Overdue table/reminder action. |
| Fines | Librarian/accountant scoped | Manage library fines. | Fine table, post-to-fees state. |
| Library Reports | Librarian/principal | Review borrowing reports. | Report filters/export. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| My Library | Student/parent | See borrowed/due books. | Due cards and reminders. |
| Library Scanner | Librarian optional | Scan issue/return. | Scanner + result card. |

### Role/permission design rules

```text
Librarian sees borrower identity needed for library work, not full student profile.
Parent/student see own borrowed/due items only.
Fine posting to fees requires finance permission or backend workflow.
```

---

## 7.14 M8B Transport

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Transport Dashboard | Transport manager/principal | See live transport status. | Active trips, delays, stale GPS. |
| Routes and Stops | Transport manager | Configure routes. | Route map/list and stop table. |
| Vehicles | Transport manager | Manage vehicles/documents. | Vehicle table, document alerts. |
| Driver Assignments | Transport manager | Assign drivers/conductors. | Assignment table. |
| Student Assignments | Transport manager/admin | Assign students to routes. | Student-route table and filters. |
| Active Trips | Transport manager/principal | Monitor current trips. | Status board and map/list. |
| Trip Detail | Transport manager | Review manifest/status. | Manifest table, timeline. |
| Delay Broadcast | Transport manager | Notify route delays. | Recipient preview and confirmation. |
| Transport Reports | Transport manager/owner | Review trips/boarding/reports. | Reports and CSV export. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Driver Trip | Driver/conductor | Run assigned trip. | Start, manifest, pickup/drop, delay, emergency. |
| Parent Transport | Parent | Track own child transport. | Current trip status, bus/route, last update. |
| Principal Transport Alerts | Principal | See delay/emergency/stale GPS. | Alert cards. |

### Role/permission design rules

```text
Driver sees assigned trip only.
Parent sees own child transport status only.
Transport manager sees all routes/trips if permitted.
Emergency/delay actions require careful confirmation or protected action design.
```

---

## 7.15 M8C Canteen

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Canteen POS / Serving | POS staff/canteen manager | Serve/sell quickly. | Scan-first, large status feedback. |
| Menu | Canteen manager | Manage menu items. | Menu table/cards. |
| Meal Plans | Canteen manager | Configure plans. | Plan list and enrollment state. |
| Enrollments | Canteen manager/admin | Manage student meal plans. | Student enrollment table. |
| Wallets | Canteen/accountant scoped | Manage balances/top-ups. | Wallet table, transaction timeline. |
| Inventory | Canteen manager | Track stock. | Stock table and alerts. |
| Suppliers | Canteen manager | Manage suppliers. | Supplier records. |
| Canteen Reports | Canteen manager/owner | Review sales/meal/stock reports. | Report filters/export. |

### Mobile/tablet screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| POS Tablet | POS staff | Scan and serve/sell. | Large buttons, scan result card. |
| Parent Canteen | Parent | See child meal/wallet status. | Balance, meal status, alerts. |
| Student Canteen | Student | See meal/wallet status if allowed. | Simple balance/status card. |

### Role/permission design rules

```text
POS-only staff sees scan/serve/sell only.
Inventory cost/details visible only to manager/account roles.
Parent/student see only own child/own wallet/meal status.
Wallet corrections require permission and audit.
```

---

## 7.16 M9 Accounting

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Accounting Dashboard | Accountant/owner if permitted | See financial control status. | Period, journals, reports, reconciliation cards. |
| Chart of Accounts | Accountant | Manage accounts. | Tree/table hybrid. |
| Journals | Accountant | Create/review/post entries. | Journal table, status workflow. |
| Journal Detail | Accountant/approver | Review one journal. | Debit/credit table, audit timeline. |
| Fiscal Periods | Accountant/owner if permitted | Lock/close/reopen periods. | Period table, dangerous dialogs. |
| Vouchers | Accountant | Create payment/receipt/contra/expense vouchers. | Voucher forms and list. |
| Bank Reconciliation | Accountant | Match bank transactions. | Matching workspace. |
| Financial Reports | Accountant/owner if permitted | Review/export reports. | Report filters, protected export. |
| Source Ledger | Accountant/auditor | Trace source postings. | Audit-style ledger table. |

### Mobile screens

```text
No full mobile accounting in v1.
Optional owner mobile summary may show approved high-level accounting cards if permission exists.
```

### Role/permission design rules

```text
Accounting is web-first and permission-strict.
Owner sees reports only if accounting permission exists.
Principal does not automatically see deep accounting.
Posting/reversing/correcting requires reason and audit.
Period lock explains blocked actions.
```

---

## 7.17 M10 Notices / Messaging / Parent-Teacher Chat

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Notice Composer | Admin/principal/teacher if allowed | Create notice. | Audience selector, recipient preview. |
| Notice List | Admin/teacher/principal | Review sent/scheduled notices. | Table/list with status. |
| Scheduled Notices | Admin/principal | Manage scheduled delivery. | Queue/list. |
| Messaging Inbox | Staff/teacher/admin | Handle conversations. | Inbox + thread layout. |
| Parent-Teacher Threads | Teacher/parent scoped/admin review | Safe communication. | Thread list, school-hours state. |
| Availability | Teacher/admin | Set chat availability. | Availability controls. |
| Escalation/Abuse Review | Principal/admin | Review communication issues. | Review queue and decision actions. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Parent Notices | Parent | Read notices. | Notice cards, priority badges. |
| Parent Chat | Parent | Message allowed teachers. | Simple thread, school-hours banner. |
| Teacher Chat | Teacher | Reply to parents during policy hours. | Thread list, quick reply. |
| Principal Communication Alerts | Principal | Review escalations. | Alert cards. |

### Role/permission design rules

```text
Recipient preview before sending notice is mandatory.
Teacher-parent chat respects school hours and data-sharing policy.
Parent sees only own conversations.
Emergency notices use danger semantic state.
Escalations require review permission.
```

---

## 7.18 M12 Learning

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Learning Activities | Teacher/coordinator | Create/manage learning activities. | Activity table/cards. |
| Activity Detail | Teacher | Review content and resources. | Detail page, attached resources. |
| Sessions | Teacher | Launch/manage sessions. | Session list and live state. |
| Attempts Review | Teacher | Review attempts. | Attempt table/detail. |
| Class Progress | Teacher/coordinator | Track learning progress. | Progress cards/table. |
| Resources | Teacher/coordinator | Manage learning resources. | Resource list/upload. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Student Learning | Student | Join activities/resources. | Activity cards, session join. |
| Parent Learning Summary | Parent | See child learning progress. | Summary cards. |
| Teacher Session Control | Teacher optional | Quick session status. | Live session card. |

### Role/permission design rules

```text
Teacher sees assigned learning activities/classes.
Student sees own activities/resources.
Parent sees own child summary only.
Learning progress must be age-appropriate and scoped.
```

---

## 7.19 Reports / File Registry / Exports

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Report Catalog | All authorized roles | Find available reports. | Cards grouped by accessible module. |
| Report Filter Screen | Authorized roles | Generate/export reports. | Filter form and preview where supported. |
| Export History | Authorized roles | Track queued/success/failed exports. | Table with retry/download. |
| File Registry Access | Admin/module roles | Upload/preview/download files. | Protected file actions, signed upload states. |

### Mobile screens

```text
Mobile should not be report-heavy.
Only allow viewing/downloading scoped documents such as receipts, report cards, payslips, notices, and own files.
```

### Role/permission design rules

```text
Reports are permission-filtered.
Users see only report categories they can access.
Private files must use authenticated/signed helpers.
Parent/student/staff mobile downloads are scoped to own records only.
```

---

## 7.20 Advanced Operations

Advanced operations include approvals, automation, analytics, document templates, and export center.

### Web screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Approval Center | Principal/owner/admin by permission | Review cross-module approvals. | Approval queue, risk badges, reason/actions. |
| Automation Rules | Admin/platform/advanced operator | Manage automation rules. | Rule table, catalog, execution history. |
| Analytics Summary | Owner/principal/admin | Review descriptive analytics. | Insight cards and trends. |
| Document Templates | Admin/office | Manage generated document templates. | Template list, generate/print history. |
| Export Center | Admin/platform/accountant | Track data export jobs. | Job table, retry/download. |

### Mobile screens

| Screen | Roles | Main job | Design |
|---|---|---|---|
| Approval Cards | Owner/principal | Approve/reject urgent items. | Minimal card, amount/risk/context, reason. |
| Insight Summary | Owner/principal | See high-level trends. | Small cards only. |

### Role/permission design rules

```text
Approvals show only items user can approve.
Automation is web-only and admin/platform restricted.
Analytics must not expose data outside role scope.
Document templates are office/admin focused.
Exports require strong permission and audit awareness.
```

---

## 8. Cross-Module Role Design Matrix

| Role | Web screen style | Mobile screen style | Data scope | Action style |
|---|---|---|---|---|
| Owner/director | Executive + drill-down | Alerts/approvals | School-wide summary; detailed only by permission | Approve/review, not daily entry. |
| Principal | Operations + academic control | Alerts/approvals | School-wide operational/academic | Review/publish/approve. |
| Admin/office | Records + forms + queues | Optional task alerts | Student/admission/settings by permission | Create/update/review. |
| Admission officer | Pipeline + documents | Optional alerts | Applicants/admission data | Status/enroll/import. |
| Teacher/class teacher | Own class workspaces | Daily class cards | Own class/subjects | Mark/assign/post/reply. |
| Accountant | Finance/accounting tables | Optional approvals | Finance/accounting by permission | Collect/review/post/export. |
| Cashier | Counter workflow | Optional lookup | Payment/receipt scope | Collect/receipt/close. |
| HR/payroll | Staff/payroll confidential | Own staff self-service/approvals | Staff/payroll by permission | Review/run/generate. |
| Librarian | Desk/table workflow | Optional scanner | Library borrower/copy scope | Issue/return/fines. |
| Transport manager | Route/trip operations | Live alerts | Transport-wide | Assign/monitor/broadcast. |
| Driver | No admin web | Assigned trip | Assigned trip only | Start/drop/pickup/report. |
| Canteen/POS | POS + inventory | Tablet/POS | Serving/wallet/inventory by role | Serve/sell/top-up. |
| Parent | Optional portal | Own child cards | Own child only | View/pay/message/download. |
| Student | Optional portal | Own learning cards | Own data only | Submit/view/join. |
| Platform operator | SaaS control plane | No default mobile | Platform data; tenant only under support override | Operate/audit/support. |

---

## 9. Permission-to-UI Rules for Developers

### 9.1 Route guard rules

```text
1. If user has no route permission, block the route.
2. If module is locked, show ModuleLockedState.
3. If user has scoped access, render scoped version of the screen.
4. If user has read-only access, hide mutation actions.
5. If user has approval-only access, show approval queue as primary surface.
```

### 9.2 Component visibility rules

```text
Can view module -> show module nav item.
Can create -> show primary create action.
Can update -> show edit action.
Can delete/archive/cancel/reverse/post -> show dangerous action under More with confirmation.
Can approve -> show approval queue/action.
Can export -> show export button.
Can upload -> show upload control.
Can download private file -> use protected helper.
Can manage settings -> show setup/config tabs.
```

### 9.3 Screen variant examples

| Same module | Role | Screen variant |
|---|---|---|
| Fees | Owner | Summary, dues, collection trend, approvals. |
| Fees | Accountant | Setup, invoices, reports, reversals. |
| Fees | Cashier | Student search, collect payment, receipt. |
| Fees | Parent | Own child dues and receipts. |
| Attendance | Principal | Not submitted, risk, corrections. |
| Attendance | Teacher | Own class marking. |
| Attendance | Parent | Own child attendance calendar. |
| Transport | Manager | Routes, vehicles, trips. |
| Transport | Driver | Assigned trip only. |
| Transport | Parent | Own child bus status. |
| Academics | Coordinator | Setup, report card readiness. |
| Academics | Teacher | Assigned marks/CAS. |
| Academics | Parent/student | Published results only. |

---

## 10. Acceptance Criteria for Screen Planning

A module screen plan is accepted only if it answers:

```text
1. What is the web workspace?
2. What is the mobile equivalent, if any?
3. Which roles use it?
4. Which roles should not see it?
5. What data does each role need?
6. What actions can each role perform?
7. What changes when user has read-only/scoped/approval-only access?
8. What happens when module is locked?
9. What happens when permission is denied?
10. Which components are used: DataTable, FilterBar, Cards, Timeline, Builder, Scanner, Dialog?
11. Which API client powers it?
12. Which loading/empty/error/success states are required?
13. What is the mobile simplification?
14. What must be audited?
15. What must never be shown to that role?
```

---

## 11. Implementation Order

Recommended frontend planning and build order:

```text
1. Role/permission/entitlement UI foundation
2. AppShell, PlatformShell, MobileShell planning
3. Shared components: DataTable, FilterBar, Search, Pagination, State components, AuditReasonDialog
4. Role landing dashboards
5. Students and Admissions
6. Attendance
7. Fees and Receipts
8. Academics and Report Cards
9. Homework and Timetable
10. HR and Payroll
11. Library, Transport, Canteen
12. Accounting
13. Notices and Chat
14. Learning
15. Reports/File Registry/Advanced Operations
16. Platform control plane polish
17. Mobile companion role flows
```

---

## 12. Final Product Rule

Every module design must follow this product rule:

```text
Same backend module, different screen experience by role.
Same SchoolOS design language, different workflow depth by device.
Same permission truth, different visible UI by responsibility.
```

SchoolOS should feel like one coherent product, but each role should feel like the system was made for their real school job.
