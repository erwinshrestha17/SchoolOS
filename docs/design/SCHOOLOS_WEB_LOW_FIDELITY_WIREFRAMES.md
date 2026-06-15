# SchoolOS Web Low-Fidelity Wireframes

**Status:** Companion low-fidelity wireframe guide for SchoolOS web dashboard and module workspaces.  
**Scope:** Design planning only. This document does not implement backend, frontend, mobile, API, database, migrations, or tests.  
**Related docs:**

- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`
- `docs/design/SCHOOLOS_WEB_MODULE_WORKSPACE_LAYOUT.md`
- `docs/design/SCHOOLOS_WEB_MAIN_DASHBOARD_LAYOUT.md`
- `docs/product/SCHOOLOS_MODULE_FEATURE_BREAKDOWN.md`

Use this as the low-fidelity structure reference for implementing SchoolOS web screens module by module.

Guardrails:

- Use real APIs only.
- Keep `tenantId` as the tenant boundary everywhere.
- The global aside is navigation-only.
- The main section is the active module workspace.
- Every screen must handle loading, empty, error, success, permission denied, and module locked states.
- File/PDF/media actions must use protected File Registry helpers.
- Financial, payroll, accounting, lifecycle, publish, archive, support override, and reversal actions require confirmation and audit reason where required.
- Parent, student lab/session, driver, and staff self-service surfaces must use purpose-limited APIs.
- No Angular migration, microservices, AI runtime, public student leaderboard, or broad student mobile app from this wireframe work.

---

## 1. Global App Shell

This layout stays the same across all school operation modules.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                                      │
│ SchoolOS | School Switcher | Academic Year | Search | Notifications | User   │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ Global Aside  │ Main Section                                                 │
│               │                                                              │
│ Dashboard     │  Module content changes here                                 │
│ Admissions    │                                                              │
│ Attendance    │                                                              │
│ Fees          │                                                              │
│ Academics     │                                                              │
│ Activity      │                                                              │
│ Homework      │                                                              │
│ HR            │                                                              │
│ Library       │                                                              │
│ Transport     │                                                              │
│ Canteen       │                                                              │
│ Accounting    │                                                              │
│ Communication │                                                              │
│ Learning      │                                                              │
│ Settings      │                                                              │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

Platform operator screens should use the platform shell and platform navigation, not the school operations sidebar.

---

## 2. Main Dashboard Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Good Morning, Principal                                                      │
│ Holyland Kids' Academy | Academic Year 2082/83 | School Open Today           │
│                                                                              │
│ [New Admission] [Create Notice] [Collect Fee] [Mark Attendance]              │
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
│--------------------------------------│ │-------------------------------------│
│ Attendance     86% marked     [View] │ │ 5 attendance corrections     [Open] │
│ Fees           Rs.85,000      [View] │ │ 3 leave requests             [Open] │
│ Transport      5 trips live   [Track]│ │ 2 activity posts pending     [Open] │
│ Canteen        145 orders     [View] │ │ 4 fee discount requests      [Open] │
│ Classes        32 periods     [View] │ │ 1 payroll run pending        [Open] │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Summary                                                               │
│                                                                              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│ │Admissions  │ │Attendance  │ │Fees        │ │Academics   │ │HR          │  │
│ │12 new      │ │86% marked  │ │18 overdue  │ │Marks due   │ │3 on leave  │  │
│ │[Open]      │ │[Open]      │ │[Open]      │ │[Open]      │ │[Open]      │  │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│ │Library     │ │Transport   │ │Canteen     │ │Accounting  │ │Communication│ │
│ │7 overdue   │ │5 live trips│ │Low stock 3 │ │Journals 4  │ │Unread 22   │  │
│ │[Open]      │ │[Open]      │ │[Open]      │ │[Open]      │ │[Open]      │  │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Recent Activity                       │ │ Quick Actions                       │
│--------------------------------------│ │-------------------------------------│
│ 09:45 Payment received                │ │ [New Admission]                     │
│ 09:30 Attendance submitted            │ │ [Collect Fee]                       │
│ 09:15 Notice sent                     │ │ [Create Notice]                     │
│ 09:00 Leave request submitted         │ │ [Assign Homework]                   │
│ 08:45 Book issued                     │ │ [Run Payroll]                       │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

Dashboard rules:

- Show 6-8 top KPIs maximum.
- Show today's operations before deep analytics.
- Show pending approvals and alerts before low-priority summaries.
- Quick actions must be role-based and permission-safe.
- Do not show fake module values.

---

## 3. M1 — Admissions and Student Profiles

### Main Admissions Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Admissions & Student Profiles                                                │
│ Manage admissions, student records, guardians, documents, QR and iEMIS.       │
│                                                        [New Admission]        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Students││ New Admissions││ Missing Docs │ │ Duplicates   │
│ 1,250         ││ 28 this month ││ 14           │ │ 5            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Students] [Admissions] [Documents] [Duplicates] [iEMIS Export] [QR]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search student... | Class ▼ | Section ▼ | Status ▼ | Doc Status ▼ | [Export] │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Student Table                                                                │
│------------------------------------------------------------------------------│
│ Photo | Name | Class | Section | Guardian | Phone | Status | Docs | Actions  │
│------------------------------------------------------------------------------│
│      | Aarav Sharma | 5 | A | Ram Sharma | 98xxxx | Active | Missing | View   │
│      | Sita Thapa   | 3 | B | Hari Thapa | 98xxxx | Active | OK      | View   │
│      | ...                                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Student Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ Student Detail                               │
│ Aarav Sharma                                 │
│ Class 5 - Section A                          │
├──────────────────────────────────────────────┤
│ Tabs: Profile | Guardian | Docs | QR | History│
├──────────────────────────────────────────────┤
│ Student Info                                 │
│ DOB, Gender, Address, Phone                  │
│                                              │
│ Guardian Info                                │
│ Father, Mother, Local Guardian               │
│                                              │
│ Documents                                    │
│ Birth Certificate     Missing                │
│ Transfer Certificate  Uploaded               │
│                                              │
│ [Edit Profile] [Upload Doc] [Generate ID]    │
└──────────────────────────────────────────────┘
```

---

## 4. M2 — Smart Attendance

### Attendance Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Smart Attendance                                                             │
│ Mark daily attendance, manage corrections, and view monthly registers.        │
│                                                   [Mark Attendance]           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Present Today│ │ Absent Today │ │ Late Students│ │ Corrections  │
│ 1,086        │ │ 84           │ │ 18           │ │ 5 Pending    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Daily Attendance] [Monthly Register] [Corrections] [Offline Drafts]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Date: 2082-03-01 | Class ▼ | Section ▼ | Status ▼ | [Load Students]          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Attendance Grid                                                              │
│------------------------------------------------------------------------------│
│ Roll | Student Name | Present | Absent | Late | Leave | Remarks              │
│------------------------------------------------------------------------------│
│ 01   | Aarav Sharma |   ●     |        |      |       | [          ]         │
│ 02   | Sita Thapa   |         |   ●    |      |       | Fever               │
│ 03   | Nima Lama    |         |        |  ●   |       | Late by 10 min      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ [Save Draft] [Submit Attendance] [Export Register]                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Correction Panel

```text
┌──────────────────────────────────────────────┐
│ Attendance Correction Request                │
├──────────────────────────────────────────────┤
│ Student: Sita Thapa                          │
│ Date: 2082-03-01                             │
│ Current Status: Absent                       │
│ Requested Status: Present                    │
│ Reason: Student arrived after marking        │
│                                              │
│ [Approve] [Reject] [View History]            │
└──────────────────────────────────────────────┘
```

---

## 5. M3 — Fees and Receipts

### Fees Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fees & Receipts                                                              │
│ Manage invoices, payments, receipts, refunds, discounts and cashier close.    │
│                                                     [Collect Payment]         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Collected Today││ Total Due   │ │ Overdue      │ │ Refunds      │
│ Rs. 85,000     ││ Rs. 8,40,000│ │ 18 Students  │ │ Rs. 5,000    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Invoices] [Payments] [Receipts] [Discounts] [Refunds] [Cashier Close] │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search student/invoice... | Class ▼ | Status ▼ | Month ▼ | [Generate Invoice]│
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Invoice Table                                                                │
│------------------------------------------------------------------------------│
│ Invoice No | Student | Class | Amount | Paid | Due | Status | Actions        │
│------------------------------------------------------------------------------│
│ INV-001    | Aarav   | 5A    | 5,000  | 3,000|2,000| Partial| Pay | Receipt  │
│ INV-002    | Sita    | 3B    | 4,000  | 0    |4,000| Overdue| Pay | Remind   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Payment Drawer

```text
┌──────────────────────────────────────────────┐
│ Collect Payment                              │
├──────────────────────────────────────────────┤
│ Student: Aarav Sharma                        │
│ Invoice: INV-001                             │
│ Total Due: Rs. 2,000                         │
│                                              │
│ Payment Amount: [ Rs. 2,000 ]                │
│ Method: Cash ▼                               │
│ Reference No: [            ]                 │
│ Remarks: [                  ]                │
│                                              │
│ [Cancel] [Save & Print Receipt]              │
└──────────────────────────────────────────────┘
```

---

## 6. M4 — Academics, Exams, CAS and Report Cards

### Academics Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Academics, Exams, CAS & Report Cards                                         │
│ Manage subjects, exams, marks entry, CAS and report card publishing.          │
│                                                        [Create Exam]          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Active Terms │ │ Exams        │ │ Marks Pending│ │ Reports Pub. │
│ 3            │ │ 8            │ │ 6 Subjects   │ │ 420          │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Subjects] [Exam Terms] [Marks Entry] [CAS] [Report Cards] [Reports]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Class ▼ | Section ▼ | Exam Term ▼ | Subject ▼ | [Load Marks Grid]            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Marks Entry Grid                                                             │
│------------------------------------------------------------------------------│
│ Roll | Student Name | Theory | Practical | Internal | Total | Grade | Status │
│------------------------------------------------------------------------------│
│ 01   | Aarav Sharma | 78     | 18        | 19       | 115   | A     | Pass   │
│ 02   | Sita Thapa   | 65     | 17        | 18       | 100   | B+    | Pass   │
│ 03   | Nima Lama    | [  ]   | [  ]      | [  ]     | --    | --    | Draft  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ [Save Draft] [Submit Marks] [Generate Report Cards] [Publish Result]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Report Card Preview Drawer

```text
┌──────────────────────────────────────────────┐
│ Report Card Preview                          │
├──────────────────────────────────────────────┤
│ Student: Aarav Sharma                        │
│ Class: 5A                                    │
│ Exam: Final Term                             │
│                                              │
│ Subjects                                     │
│ English       A                              │
│ Nepali        A                              │
│ Mathematics   B+                             │
│ Science       A                              │
│                                              │
│ Total: 430 / 500                             │
│ Grade: A                                     │
│ Result: Pass                                 │
│                                              │
│ [Download PDF] [Publish]                     │
└──────────────────────────────────────────────┘
```

---

## 7. M5 — Activity Feed and Milestones

### Activity Feed Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Activity Feed & Milestones                                                   │
│ Share classroom activities, photos, milestones and parent-visible updates.    │
│                                                       [Create Post]           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Posts Today  │ │ Pending Appr.│ │ Media Files  │ │ Consent Block│
│ 12           │ │ 4            │ │ 86           │ │ 3            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Feed] [Pending Approval] [Media Gallery] [Milestones] [Parent View]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Class ▼ | Section ▼ | Post Status ▼ | Date ▼ | [Upload Media]                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────┐ ┌─────────────────────────────────┐
│ Activity Feed                            │ │ Approval / Detail Panel          │
│------------------------------------------│ │---------------------------------│
│ ┌──────────────────────────────────────┐ │ │ Selected Post                    │
│ │ Grade 2A Drawing Activity             │ │ │ Title                           │
│ │ 6 photos                              │ │ │ Description                     │
│ │ Status: Pending Approval              │ │ │ Attached Media                  │
│ │ [Preview] [Edit]                      │ │ │ Consent Warning                 │
│ └──────────────────────────────────────┘ │ │                                 │
│ ┌──────────────────────────────────────┐ │ │ [Approve] [Reject]              │
│ │ Preschool Color Day                   │ │ │ [Request Changes]               │
│ │ Status: Published                     │ │ │                                 │
│ └──────────────────────────────────────┘ │ │                                 │
└──────────────────────────────────────────┘ └─────────────────────────────────┘
```

---

## 8. M6 — Homework and Timetable

### Homework Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Homework & Timetable                                                         │
│ Assign homework, review submissions, build timetable and manage substitutions.│
│                                                   [Assign Homework]           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Homework Due │ │ Pending Sub. │ │ Today Periods│ │ Conflicts    │
│ 18           │ │ 95           │ │ 32           │ │ 3            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Homework] [Submissions] [Timetable Builder] [Substitution] [Reports]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Class ▼ | Section ▼ | Subject ▼ | Status ▼ | Due Date ▼ | [Create Homework]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Homework Table                                                               │
│------------------------------------------------------------------------------│
│ Title | Class | Subject | Due Date | Submitted | Pending | Status | Actions  │
│------------------------------------------------------------------------------│
│ Essay Writing | 5A | English | Ashad 3 | 28 | 5 | Active | View             │
│ Fractions     | 4B | Math    | Ashad 4 | 20 | 9 | Active | View             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Timetable Builder Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Timetable Builder                                                            │
│ Class: 5A | Week: Current | [Draft] [Publish] [Validate Conflicts]           │
└──────────────────────────────────────────────────────────────────────────────┘

┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
│ Period     │ Monday     │ Tuesday    │ Wednesday  │ Thursday   │ Friday     │
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│ 1          │ English    │ Math       │ Science    │ Nepali     │ Math       │
│ 2          │ Math       │ English    │ Nepali     │ Science    │ English    │
│ Break      │            │            │            │            │            │
│ 3          │ Science    │ Social     │ Math       │ English    │ Nepali     │
│ 4          │ Computer   │ Science    │ Social     │ Math       │ Computer   │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Conflict Panel                                                               │
│ [High] Teacher conflict: Mr. Sharma assigned to 5A and 6B in Period 2 Monday │
│ [Medium] Math weekly required periods not met                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. M7 — HR and Payroll

### HR Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HR & Payroll                                                                 │
│ Manage staff, contracts, leave, attendance, payroll and payslips.             │
│                                                          [Add Staff]          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Staff  │ │ On Leave     │ │ Payroll Due  │ │ Contracts Exp│
│ 80           │ │ 3            │ │ June Payroll │ │ 5            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Staff] [Contracts] [Leave] [Attendance] [Payroll] [Payslips] [Reports]│
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search staff... | Department ▼ | Role ▼ | Status ▼ | [Run Payroll]           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Staff Table                                                                  │
│------------------------------------------------------------------------------│
│ Photo | Name | Role | Department | Phone | Contract | Leave | Status | View  │
│------------------------------------------------------------------------------│
│      | Ram Sharma | Teacher | Primary | 98xxxx | Active | 8 days | Active    │
│      | Sita KC    | Admin   | Office  | 98xxxx | Expiring | 5 days | Active  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Payroll Run Wizard

```text
┌──────────────────────────────────────────────┐
│ Payroll Run Wizard                           │
├──────────────────────────────────────────────┤
│ Step 1: Select Month                         │
│ Step 2: Load Staff Salary                    │
│ Step 3: Review Allowances/Deductions         │
│ Step 4: Approve Payroll                      │
│ Step 5: Generate Payslips                    │
│                                              │
│ Current Step: Review                         │
│ Total Staff: 80                              │
│ Gross Salary: Rs. 24,00,000                  │
│ Deductions: Rs. 1,80,000                     │
│ Net Payable: Rs. 22,20,000                   │
│                                              │
│ [Back] [Approve & Lock Payroll]              │
└──────────────────────────────────────────────┘
```

---

## 10. M8A — Library

### Library Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Library                                                                      │
│ Manage books, copies, issues, returns, overdues and fines.                   │
│                                                         [Add Book]            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Books  │ │ Available    │ │ Issued       │ │ Overdue      │
│ 4,500        │ │ 3,860        │ │ 640          │ │ 37           │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Books] [Copies] [Issue] [Return] [Overdue] [Reports]                  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search book/title/ISBN... | Category ▼ | Status ▼ | [Issue Book] [Return]    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Book Table                                                                   │
│------------------------------------------------------------------------------│
│ Title | Author | ISBN | Category | Copies | Available | Status | Actions     │
│------------------------------------------------------------------------------│
│ Science 5 | ABC Pub. | 978xxx | Science | 20 | 14 | Active | View           │
│ Nepali 4  | XYZ Pub. | 978xxx | Nepali  | 15 | 10 | Active | View           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Issue / Return Drawer

```text
┌──────────────────────────────────────────────┐
│ Issue Book                                   │
├──────────────────────────────────────────────┤
│ Search Student: [ Aarav Sharma       ]       │
│ Search Book:    [ Science 5          ]       │
│ Copy No:        SCI-5-014                    │
│ Due Date:       [ 2082-03-15 ]               │
│ Remarks:        [             ]              │
│                                              │
│ [Cancel] [Issue Book]                        │
└──────────────────────────────────────────────┘
```

---

## 11. M8B — Transport

### Transport Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Transport                                                                    │
│ Manage routes, stops, vehicles, trips, students and location status.          │
│                                                        [Add Route]            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Active Routes│ │ Vehicles     │ │ Students     │ │ Live Trips   │
│ 12           │ │ 8            │ │ 420          │ │ 5            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Routes] [Stops] [Vehicles] [Students] [Trips] [Location Status]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Route ▼ | Vehicle ▼ | Trip Status ▼ | [Start Trip] [Assign Student]          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Route / Vehicle Table                 │ │ Location / Trip Status              │
│--------------------------------------│ │-------------------------------------│
│ Route 1 | Bus 01 | Running | [Track] │ │                                     │
│ Route 2 | Bus 02 | Running | [Track] │ │ Latest GPS / status area            │
│ Route 3 | Bus 03 | Scheduled|[Start] │ │                                     │
│ Route 4 | Bus 04 | Completed|[View]  │ │ Vehicle marker, stops, route line   │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

### Trip Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ Trip Detail                                  │
├──────────────────────────────────────────────┤
│ Route: Route 1                               │
│ Vehicle: Bus 01                              │
│ Driver: Hari Gurung                          │
│ Status: Running                              │
│ Last GPS Update: 2 minutes ago               │
│                                              │
│ Stops                                        │
│ 1. Butwal Chowk       Completed              │
│ 2. Yogikuti           Current                │
│ 3. Shankarnagar       Pending                │
│                                              │
│ [View Status] [End Trip]                     │
└──────────────────────────────────────────────┘
```

Transport note: live map is useful, but full live tracking should stay behind policy, privacy, load, and SSE/WebSocket approval. Until then, use latest location, stale GPS labels, and trip-history views.

---

## 12. M8C — Canteen

### Canteen Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Canteen                                                                      │
│ Manage menu, student wallets, QR serving, sales and stock.                   │
│                                                      [Serve via QR]           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Sales Today  │ │ Orders Today │ │ Wallet Total │ │ Low Stock    │
│ Rs. 18,500   │ │ 145          │ │ Rs. 3,20,000 │ │ 6 Items      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Menu] [Orders] [Wallets] [QR Serving] [Stock] [Reports]               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search item/student... | Category ▼ | Status ▼ | [Add Menu Item] [Top Up]    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Menu / Sales List                     │ │ QR Serve Panel                      │
│--------------------------------------│ │-------------------------------------│
│ Momo        Rs.80   Available         │ │ Scan Student QR                     │
│ Chowmein    Rs.100  Available         │ │                                     │
│ Juice       Rs.50   Low Stock         │ │ Student: Aarav Sharma               │
│ Samosa      Rs.30   Available         │ │ Wallet: Rs. 450                     │
│                                      │ │ Select Items:                       │
│                                      │ │ Momo x1 = Rs.80                     │
│                                      │ │ Juice x1 = Rs.50                    │
│                                      │ │ Total = Rs.130                      │
│                                      │ │                                     │
│                                      │ │ [Confirm Serve]                     │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

Canteen note: the POS/serving UI should be touch-friendly and fast. Allergy or medical warnings must appear before confirmation and require acknowledgement where policy requires it.

---

## 13. M9 — Accounting and Finance

### Accounting Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Accounting & Finance                                                         │
│ Manage chart of accounts, journals, ledgers, trial balance and reports.       │
│                                                   [Add Journal Entry]         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Cash Balance │ │ Receivables  │ │ Payables     │ │ Pending JEs  │
│ Rs. 12,50,000│ │ Rs. 8,40,000 │ │ Rs. 2,10,000 │ │ 4            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Dashboard] [Chart of Accounts] [Journal] [Ledger] [Trial Balance]     │
│       [Reports] [Period Close]                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Date Range ▼ | Account ▼ | Source Module ▼ | Status ▼ | [Export Report]      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Journal Table                                                                │
│------------------------------------------------------------------------------│
│ Date | Ref No | Account | Debit | Credit | Source | Status | Actions         │
│------------------------------------------------------------------------------│
│ 2082-03-01 | JE-001 | Cash        | 85,000 |      | Fees    | Posted | View  │
│ 2082-03-01 | JE-001 | Fee Income  |        |85,000| Fees    | Posted | View  │
│ 2082-03-02 | JE-002 | Salary Exp. | 50,000 |      | Payroll | Draft  | Edit  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Financial Report Preview

```text
┌──────────────────────────────────────────────┐
│ Trial Balance Preview                        │
├──────────────────────────────────────────────┤
│ Date Range: Ashad 1 - Ashad 30               │
│                                              │
│ Account              Debit       Credit      │
│ Cash                 12,50,000   -           │
│ Fee Income           -           8,40,000    │
│ Salary Expense       3,20,000    -           │
│                                              │
│ Total                15,70,000   15,70,000   │
│                                              │
│ Status: Balanced                             │
│                                              │
│ [Download PDF] [Export Excel]                │
└──────────────────────────────────────────────┘
```

Accounting note: report/export files must use authenticated helpers and File Registry where retained. Posted records must use reversal/correction workflows, not silent edits.

---

## 14. M10 — Notices and Communication

### Communication Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Notices & Communication                                                      │
│ Send notices, manage delivery logs, templates and school-controlled chat.     │
│                                                       [Create Notice]         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Notices Sent │ │ Unread       │ │ Active Chats │ │ Failed Deliv.│
│ 24           │ │ 120          │ │ 18           │ │ 7            │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Notices] [Compose] [Chat] [Templates] [Recipients] [Delivery Logs]    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search notice/chat... | Audience ▼ | Status ▼ | Date ▼ | [Schedule Notice]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Notice / Chat List                    │ │ Preview / Composer                  │
│--------------------------------------│ │-------------------------------------│
│ Holiday Notice     Sent     95% read │ │ Title: Holiday Notice                │
│ Fee Reminder       Sent     72% read │ │ Audience: Grade 1-5 Parents          │
│ Exam Notice        Draft             │ │ Body:                                │
│ Parent Meeting     Scheduled         │ │ Classes will remain closed...        │
│                                      │ │ Attachment: holiday.pdf              │
│                                      │ │                                     │
│                                      │ │ [Save Draft] [Send Now] [Schedule]  │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

### Chat Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Parent-Teacher Chat                                                          │
│ School Hours: 8:00 AM - 5:00 PM | Personal data sharing prohibited           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐ ┌─────────────────────────────────────────────┐
│ Chat Threads                  │ │ Conversation                                │
│------------------------------│ │---------------------------------------------│
│ Aarav Parent     Grade 5A     │ │ Aarav Parent                                │
│ Sita Parent      Grade 3B     │ │                                             │
│ Nima Parent      Grade 4A     │ │ Parent: Will Aarav need sports dress?       │
│                              │ │ Teacher: Yes, for tomorrow's activity.      │
│                              │ │                                             │
│                              │ │ [Type message...] [Send]                    │
│                              │ │                                             │
│                              │ │ Audit: Visible to school admin if required  │
└──────────────────────────────┘ └─────────────────────────────────────────────┘
```

Communication note: chat is school-controlled, not personal messaging. Enforce role scope, quiet hours, reporting/escalation, and attachment rules.

---

## 15. M12 — Learning Layer

### Learning Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Learning Layer                                                               │
│ Create teacher-led activities, run board/lab sessions, and review progress.   │
│                                                    [Create Activity]          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Activities   │ │ Live Sessions│ │ Participants │ │ Submitted    │
│ 42           │ │ 3            │ │ 86 active    │ │ 215 attempts │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Activities] [Sessions] [Resources] [Progress]                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Class ▼ | Section ▼ | Subject ▼ | Mode ▼ | Status ▼ | [Launch Session]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Activity / Session List               │ │ Session Monitor / Preview           │
│--------------------------------------│ │-------------------------------------│
│ Fractions Practice  Grade 4 Math      │ │ Session: Fractions Practice          │
│ Nepali Reading      Grade 2 Nepali    │ │ Mode: Computer Lab                   │
│ Shapes & Colors     ECD Board         │ │ Code: 428913                         │
│                                      │ │ Participants: 32                     │
│                                      │ │ Status: Live                         │
│                                      │ │ [Pause] [End Session]                │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

Learning note: keep this teacher-controlled and school-only by default. Do not add broad student mobile, AI tutor, open chat, harsh labels, or public leaderboards.

---

## 16. M0 — Platform Core / Developer Admin

M0 is not shown to normal school users. It is for SaaS owner, developer, support operator, and platform admin workflows.

### Platform Admin Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform Core                                                                │
│ Manage tenants, modules, RBAC, storage, queues, health and system settings.   │
│                                                       [Create Tenant]         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Tenants      │ │ Active Users │ │ Queue Health │ │ Storage      │
│ 100          │ │ 8,450        │ │ Healthy      │ │ 72% Used     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tabs: [Tenants] [Modules] [RBAC] [File Registry] [Audit Logs] [Health]       │
│       [Queues] [Settings]                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search tenant... | Status ▼ | Plan ▼ | Region ▼ | [Export]                  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenant Table                                                                 │
│------------------------------------------------------------------------------│
│ School | Domain | Plan | Status | Users | Storage | Modules | Actions        │
│------------------------------------------------------------------------------│
│ Holyland Kids' Academy | holyland.schoolos.app | Pro | Active | 45 | 2GB | View│
│ ABC School            | abc.schoolos.app      | Basic| Active | 20 | 1GB | View│
└──────────────────────────────────────────────────────────────────────────────┘
```

### System Health View

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ System Health                                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ API Server       Healthy                                                     │
│ Database         Healthy                                                     │
│ Redis            Healthy                                                     │
│ Object Storage   Healthy                                                     │
│ Queue Worker     Healthy                                                     │
│ PDF Generator    Healthy                                                     │
│ Notification Job Warning                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Common Create / Edit Form Pattern

Use this pattern across modules.

```text
┌──────────────────────────────────────────────┐
│ Create / Edit Form                           │
├──────────────────────────────────────────────┤
│ Section 1: Basic Information                 │
│ [Input Field]                                │
│ [Dropdown]                                   │
│ [Date Picker]                                │
│                                              │
│ Section 2: Details                           │
│ [Textarea]                                   │
│ [File Upload]                                │
│                                              │
│ Section 3: Settings                          │
│ [Checkbox] [Toggle]                          │
│                                              │
│ [Cancel] [Save Draft] [Submit]               │
└──────────────────────────────────────────────┘
```

Rules:

- Use React Hook Form + Zod for critical forms.
- Show validation errors inline.
- Preserve entered data after safe recoverable errors.
- Use protected file upload helpers for documents/media.
- Use audit reason dialogs for sensitive changes.

---

## 18. Common Detail Drawer Pattern

Use this for quick viewing without leaving the page.

```text
┌──────────────────────────────────────────────┐
│ Record Detail                                │
│ Name / Title / ID                            │
├──────────────────────────────────────────────┤
│ Tabs: Overview | History | Files | Audit     │
├──────────────────────────────────────────────┤
│ Main Details                                 │
│ Status Badge                                 │
│ Linked Records                               │
│ Recent Activity                              │
│                                              │
│ [Edit] [Print] [Export] [Close]              │
└──────────────────────────────────────────────┘
```

Rules:

- Use drawer for quick context.
- Use full page for complex workflows.
- Do not show sensitive files or audit history without permission.
- Protected file actions must fail closed.

---

## 19. Common Table Pattern

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Filter Bar                                                                   │
│ Search... | Class ▼ | Status ▼ | Date ▼ | [Export] [Bulk Action]             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Data Table                                                                   │
│------------------------------------------------------------------------------│
│ Checkbox | Name | Type | Status | Updated At | Actions                       │
│------------------------------------------------------------------------------│
│ □        | Item 1 | Type A | Active  | Today      | View Edit More            │
│ □        | Item 2 | Type B | Pending | Yesterday  | View Edit Approve         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Showing 1-20 of 200                                      Previous | Next      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Growing lists must be server-paginated.
- Filters should use URL `searchParams` where practical.
- One primary row action plus `More` for secondary actions.
- Destructive actions require confirmation and audit reason where needed.
- Do not expose internal IDs, raw object keys, or raw Prisma errors.

---

## 20. Best Final Structure for Every Module Screen

Every module should follow this design system:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Header: Title + Description + Primary Action                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI Cards                                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Tabs                                                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filters / Search / Date / Class / Status                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Main Content: Table / Grid / Feed / Calendar / Map                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Drawer / Modal / Wizard for details and actions                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 21. Recommended Implementation Naming

Use reusable components like:

```text
DashboardHeader
ModuleHeader
KpiCard
FilterBar
ModuleTabs
DataTable
DetailDrawer
CreateEditModal
ConfirmDialog
AuditReasonDialog
StatusBadge
AuditTimeline
ProtectedFileButton
ProtectedFileLink
ExportButton
PrintButton
EmptyState
ErrorState
PermissionState
ModuleLockedState
```

This wireframe system keeps SchoolOS design consistent, scalable, and easier to implement module by module.
