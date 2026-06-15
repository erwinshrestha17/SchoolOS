# SchoolOS Web Main Dashboard Layout Guide

**Status:** Companion guide for the SchoolOS web main dashboard.  
**Related docs:**

- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`
- `docs/design/SCHOOLOS_WEB_MODULE_WORKSPACE_LAYOUT.md`

**Scope:** Web dashboard design guidance only. This document does not implement backend, frontend, mobile, API, database, or test code.

The main dashboard should act as the school's command center. Its goal is not to show every module in detail. It should give a quick overview of today, urgent alerts, pending work, recent system activity, and safe role-based shortcuts.

The dashboard should help school staff quickly answer:

```text
What is happening today?
What needs attention?
Which module needs action?
What work can I do quickly from here?
```

---

## 1. Main Dashboard Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: School | Academic Year | Search | Notifications    │
├───────────────┬─────────────────────────────────────────────┤
│ Global Aside  │ Main Dashboard                              │
│               │                                             │
│               │  1. Welcome / School Status Header           │
│               │  2. School-wide KPI Cards                    │
│               │  3. Today's Operations                       │
│               │  4. Pending Approvals & Alerts               │
│               │  5. Module Summary Cards                     │
│               │  6. Recent Activity                          │
│               │  7. Quick Actions                            │
└───────────────┴─────────────────────────────────────────────┘
```

Recommended structure:

```text
1. Dashboard Header
2. School-Wide KPI Cards
3. Today's Operations
4. Pending Approvals & Alerts
5. Module Summary Cards
6. Recent Activity Timeline
7. Quick Actions
8. Optional Reports / Charts
```

Rules:

- Do not show every module in full.
- Do not fetch every module deeply on first dashboard load.
- Do not show fake metrics or placeholder production data.
- Use real summary APIs, safe module summaries, or unavailable states.
- Role and permission must control visible KPIs, shortcuts, and module summaries.
- Module locked cards must not show fake values.

---

## 2. Dashboard Header

At the top of the main dashboard, show a friendly role-aware header.

Example:

```text
Good Morning, Principal
Holyland Kids' Academy
Academic Year: 2082 / 2083
Today: Monday, Ashad 1, 2083
```

Right side quick actions, role permitting:

```text
[Take Attendance] [Create Notice] [Collect Fee] [New Admission]
```

The header should show:

- School name.
- Current academic year.
- Current date.
- User role.
- Important quick actions.
- School operational status.

Example operational status:

```text
School is open today
Attendance marking closes at 10:30 AM
3 urgent approvals pending
```

### Header rules

- Keep the greeting short and human.
- Do not put more than four visible quick-action buttons in the header.
- If more actions are needed, move them into `More Actions` or the Quick Actions section.
- Quick actions must be role-scoped and backend-permission safe.

---

## 3. School-Wide KPI Cards

The first main section should show high-level school KPIs.

Example:

```text
Total Students      Present Today       Fees Collected       Pending Tasks
1,250               1,086 / 1,250       Rs. 85,000           17
```

Recommended KPI cards:

| KPI Card | Purpose |
|---|---|
| Total Students | Overall school size. |
| Present Today | Today's attendance status. |
| Absent Today | Student absence overview. |
| Fees Collected Today | Daily fee collection. |
| Pending Admissions | New admission workload. |
| Staff Present | HR/teacher availability. |
| Notices Sent | Communication activity. |
| Overdue Fees | Financial alert. |
| Library Overdues | Student/library issue. |
| Transport Trips | Bus operation status. |

Use **6 to 8 cards maximum** on the main dashboard.

### KPI rules

- KPIs must come from real backend summary data.
- Each KPI must support loading, unavailable, permission-hidden, and module-locked states.
- Clicking a KPI should open the relevant module or apply a relevant filter.
- Avoid showing sensitive finance, payroll, or student counts to roles without permission.

---

## 4. Today's Operations Section

This is one of the most important dashboard sections.

Example:

```text
Today's Operations
------------------------------------------------
Attendance        86% marked       [View]
Fees              Rs. 85,000       [Open]
Classes           32 periods today [View Timetable]
Transport         4 active trips   [Track]
Canteen           145 orders       [View Sales]
```

This section should answer:

- Has attendance been marked?
- Are fees being collected?
- Are classes running?
- Are buses active?
- Are staff present?
- Are there urgent school activities today?

Best layout:

```text
Today's Operations
[Attendance] [Fees] [Classes] [Transport] [Canteen] [Notices]
```

Each card should include:

- Module name.
- Current status.
- Small metric.
- Action button.

Recommended cards:

| Card | Metric examples | Action |
|---|---|---|
| Attendance | Percent marked, absent count, classes not marked | View attendance |
| Fees | Collection today, overdue count | Open fees |
| Classes | Periods today, substitutions | View timetable |
| Transport | Active trips, stale GPS, delayed trips | Open transport |
| Canteen | Sales/orders today, low stock warnings | Open canteen |
| Notices | Notices sent, unread high-impact notices | Open notices |

---

## 5. Pending Approvals and Alerts

This section is critical for principal, admin, and module-owner dashboards.

Example:

```text
Pending Approvals
------------------------------------------------
5 attendance correction requests
3 leave requests
2 activity posts awaiting approval
4 fee discount requests
1 payroll run pending review
```

Alerts can include:

| Alert Type | Example |
|---|---|
| Attendance Alert | Class 5A attendance not marked. |
| Finance Alert | 18 students have overdue fees. |
| HR Alert | 2 teachers on leave today. |
| Academic Alert | Marks entry pending for Grade 8. |
| Transport Alert | Bus Route 2 delayed. |
| Library Alert | 12 books overdue. |
| Canteen Alert | 5 low-stock items. |
| Communication Alert | 20 parents have not read notice. |

Best design:

```text
Urgent Alerts
[High] Attendance not submitted by Class 4B
[Medium] 18 overdue invoices
[Low] 6 books overdue
```

Use status badges:

```text
High | Medium | Low
Pending | Approved | Rejected
```

### Rules

- Show highest-impact alerts first.
- Do not overload this section with routine information.
- Each alert should have a clear action or destination.
- Approval actions require permission and audit reason where required.
- Direct route/backend access must still enforce authorization.

---

## 6. Module Summary Cards

Below the top KPIs, show one summary card for each major module that the user can access.

Example:

```text
Admissions
12 new applications
3 documents missing
[Open Admissions]

Attendance
86% marked today
5 corrections pending
[Open Attendance]

Fees
Rs. 85,000 collected today
18 overdue invoices
[Open Fees]
```

Recommended dashboard module summaries:

| Module | Dashboard Summary |
|---|---|
| Admissions | New applications, missing documents, duplicates. |
| Attendance | Present, absent, late, correction requests. |
| Fees | Collected today, due amount, overdue students. |
| Academics | Active exams, pending marks, report cards. |
| Activity Feed | Posts today, pending approvals, media issues. |
| Homework | Homework assigned, pending submissions. |
| HR | Staff present, leave requests, payroll status. |
| Library | Issued books, overdue books. |
| Transport | Active routes, running trips, delays. |
| Canteen | Today's sales, wallet top-ups, low stock. |
| Accounting | Income, expense, pending journal entries. |
| Communication | Notices sent, unread notices, active chats. |
| Learning | Live sessions, activities, submitted attempts, needs-practice summary. |

### Rules

- Cards should be compact.
- Each card should link to the module workspace.
- Do not expose finance/accounting/payroll details without permission.
- Module-locked cards should show locked state, not fake summary values.
- The main dashboard is an overview; detailed work belongs in module workspaces.

---

## 7. Recent Activity Timeline

The dashboard should show recent system activity to build operational trust.

Example:

```text
Recent Activity
------------------------------------------------
09:45 AM  Payment received from Aarav Sharma
09:30 AM  Class 3A attendance submitted
09:15 AM  New admission form created
09:00 AM  Notice sent to Grade 5 parents
08:45 AM  Teacher leave request submitted
```

Recent activity can include:

- Fee payments.
- Attendance submissions.
- New admissions.
- Notices sent.
- Staff leave requests.
- Report cards generated.
- Library books issued/returned.
- Canteen purchases.
- Transport trip updates.
- Activity posts published or approved.
- Learning sessions launched or completed.

### Rules

- Timeline entries must be permission-filtered.
- Do not show private chat content.
- Do not show sensitive payroll details.
- Use safe actor and object labels.
- Link entries to relevant module records only if the user has permission.

---

## 8. Quick Actions Section

The dashboard should include common actions, but only role-safe actions.

Generic examples:

```text
Quick Actions
[New Admission]
[Mark Attendance]
[Collect Fee]
[Create Notice]
[Assign Homework]
[Add Staff]
[Issue Book]
[Run Payroll]
```

Role examples:

### Principal

```text
Approve Leave
View Reports
Send Notice
Review Dashboard
```

### Accountant

```text
Collect Fee
Print Receipt
Close Cashier Day
View Due Report
```

### Teacher

```text
Mark Attendance
Assign Homework
Enter Marks
Create Activity Post
```

### Librarian

```text
Issue Book
Return Book
View Overdue
Add Copy
```

### Canteen Staff

```text
Serve QR
Top Up Wallet
View Menu
View Sales
```

### Rules

- Quick actions must be generated from role, permission, module entitlement, and safe workflow state.
- Do not show high-risk destructive actions as quick actions.
- Financial quick actions still require backend idempotency and confirmation where needed.
- Quick actions should open the correct module workspace, drawer, wizard, or form.

---

## 9. Recommended Dashboard Wireframe

```text
Main Dashboard

┌─────────────────────────────────────────────────────────────┐
│ Good Morning, Principal                                     │
│ Holyland Kids' Academy | Academic Year 2082/83              │
│ [New Admission] [Create Notice] [Collect Fee]               │
└─────────────────────────────────────────────────────────────┘

┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Students   │ │ Present    │ │ Collected  │ │ Pending    │
│ 1,250      │ │ 1,086      │ │ Rs.85,000  │ │ 17 Tasks   │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌───────────────────────────────┐ ┌───────────────────────────┐
│ Today's Operations             │ │ Pending Approvals          │
│ Attendance: 86% marked         │ │ 5 attendance corrections   │
│ Fees: Rs.85,000 collected      │ │ 3 leave requests           │
│ Transport: 4 active trips      │ │ 2 activity posts           │
│ Canteen: 145 orders            │ │ 4 discount approvals       │
└───────────────────────────────┘ └───────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Module Summary                                               │
│ Admissions | Attendance | Fees | Academics | HR | Transport  │
└─────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐ ┌───────────────────────────┐
│ Recent Activity                │ │ Quick Actions              │
│ 09:45 Payment received         │ │ New Admission              │
│ 09:30 Attendance submitted     │ │ Mark Attendance            │
│ 09:15 Notice sent              │ │ Create Notice              │
└───────────────────────────────┘ └───────────────────────────┘
```

---

## 10. Role-Based Dashboard Design

The dashboard should change based on user role.

### Principal / Admin Dashboard

Main focus:

- School-wide KPIs.
- Pending approvals.
- Attendance overview.
- Finance overview where permitted.
- Staff overview.
- Alerts.
- Reports.

Best sections:

```text
School KPIs
Today's Operations
Pending Approvals
Financial Summary
Attendance Summary
Recent Activity
```

### Teacher Dashboard

Main focus:

- Today's classes.
- Attendance to mark.
- Homework.
- Marks entry.
- Notices.
- Parent communication.

Best sections:

```text
Today's Timetable
Attendance Pending
Homework Assigned
Marks Entry Pending
Class Notices
Student Alerts
```

### Accountant Dashboard

Main focus:

- Fee collection.
- Due invoices.
- Receipts.
- Cashier close.
- Accounting posting.

Best sections:

```text
Today's Collection
Overdue Fees
Recent Payments
Pending Reversals
Cashier Close
Accounting Sync Status
```

### Parent Dashboard

Main focus:

- Child attendance.
- Fees.
- Homework.
- Notices.
- Activity posts.
- Transport.

Best sections:

```text
Child Summary
Attendance
Fees Due
Homework
Notices
Activity Feed
Transport Status
```

### Student Dashboard

Main focus:

- Homework.
- Timetable.
- Attendance.
- Exams.
- Notices.

Best sections:

```text
Today's Classes
Homework
Exam Schedule
Attendance Summary
Notices
Library Books
```

MVP note: broad student dashboard/mobile is not part of MVP unless separately approved. Controlled student lab/session routes remain the priority.

---

## 11. Best Dashboard Components for SchoolOS

Reusable components:

```text
DashboardHeader
SchoolStatusCard
KpiCard
TodayOperationsCard
PendingApprovalList
AlertPanel
ModuleSummaryCard
RecentActivityTimeline
QuickActionGrid
MiniChartCard
RoleBasedDashboard
```

These should be built on the shared SchoolOS UI primitives and real API clients. They should support loading, empty, error, permission denied, module locked, and unavailable states.

---

## 12. Final Dashboard Rules

1. The dashboard is an operational command center, not a full ERP summary of everything.
2. Show 6 to 8 top KPIs maximum.
3. Show today's operational status before deep analytics.
4. Show urgent approvals and alerts before low-priority summaries.
5. Keep module detail inside module workspaces.
6. Make quick actions role-based and permission-safe.
7. Use real APIs only.
8. Do not expose sensitive student, finance, payroll, file, or chat details without permission.
9. Do not use fake dashboard metrics.
10. Use safe unavailable states when a backend summary is missing.
11. Keep charts optional and only where they aid decisions.
12. Backend authorization remains the source of truth.
