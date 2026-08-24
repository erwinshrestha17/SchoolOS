# SchoolOS Principal Web — Page-by-Page Wireframes

**Fidelity:** Structural / low-fidelity  
**Purpose:** Define information hierarchy, layout, and interaction before visual implementation  
**Applies with:** `PRINCIPAL_WEB_DESIGN.md`

---

## 1. Wireframe conventions

```text
[Primary]       Primary page action
[Action]        Secondary safe action
[Filter ▾]      Select / filter control
[KPI]           Backend-owned summary card
(!)             Warning / attention
(✓)             Ready / complete
(—)             Unavailable / restricted
→               Drill-through
```

All desktop frames assume the authenticated SchoolOS shell:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: School | Academic Year | Search | Notifications | Principal Profile │
├──────────────────┬───────────────────────────────────────────────────────────┤
│ PRINCIPAL NAV    │ PAGE CONTENT                                              │
│                  │                                                           │
│ Leadership       │                                                           │
│ Students         │                                                           │
│ School Readiness │                                                           │
│ Communication    │                                                           │
│ Evidence         │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

---

# 2. Principal Home

**Route:** `/dashboard`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Executive oversight                                                         │
│ Principal Home                                           [Review 6 items →] │
│ Critical decisions, school readiness, and leadership exceptions.            │
│ School day: 18 Shrawan 2083 | Partial | Updated 10:12 [Refresh]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Attendance     ] [Academic       ] [Finance        ] [Staff coverage ]      │
│ [42 / 45 marked ] [3 blockers     ] [2 exceptions   ] [46 present      ]      │
│ [3 outstanding →] [Review →       ] [Review →       ] [2 gaps →        ]      │
├────────────────────────────────────────────────┬─────────────────────────────┤
│ NEEDS YOUR ATTENTION                           │ APPROVALS WAITING           │
│ (!) Grade 8 result publication blocked   2h → │ Attendance correction  1h →│
│ (!) 3 classes have not marked attendance 45m→ │ Notice approval         3h →│
│ (!) Bank reconciliation difference      1d → │ Result publication      5h →│
│ (!) Staff coverage gap — Primary          2h → │ [Open Approval Centre]     │
│ [Open Attention Centre]                       │                             │
├────────────────────────────────────────────────┼─────────────────────────────┤
│ SCHOOL READINESS                               │ TODAY'S STATUS              │
│ Academic     At risk   3 blockers        →    │ Attendance    At risk      │
│ Finance      Partial   2 exceptions      →    │ Communication Healthy      │
│ People       At risk   2 coverage gaps   →    │ Academics     At risk      │
│                                                │ Finance       Partial      │
├────────────────────────────────────────────────┼─────────────────────────────┤
│ 30-DAY PRIORITY TREND                          │ RECENT SCHOOL ACTIVITY      │
│ [Context-sensitive chart / comparison]         │ Notice published       9:42│
│                                                │ Results recalculated   9:18│
│                                                │ Attendance corrected   8:51│
└────────────────────────────────────────────────┴─────────────────────────────┘
```

### Responsive notes

- Below 1280px, KPI strip becomes 2 × 2.
- Attention appears before Approvals.
- Trend moves below Today’s Status.
- Never move a decorative chart above an open decision queue.

---

# 3. Attention Centre

**Route:** `/dashboard/attention`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Leadership                                                                  │
│ Attention Centre                                  [Open highest-risk item →]│
│ School-wide risks, overdue work, and unresolved exceptions.                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Critical 2] [Approval-related 4] [Overdue 3] [Due today 5] [Unassigned 1] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Severity ▾] [Module ▾] [Age ▾] [Owner ▾] [Status ▾] [Search________]      │
├───────────────────────────────────────┬──────────────────────────────────────┤
│ ATTENTION QUEUE                       │ SELECTED ISSUE                       │
│                                       │                                      │
│ RED  Result publication blocked      │ Result publication blocked           │
│      Academics | Grade 8 | 2 hours    │ Risk: High                           │
│      Owner: Exam coordinator       → │ Grade 8 cannot be published because │
│                                       │ Science and Mathematics remain       │
│ AMB  Attendance not submitted         │ incomplete.                          │
│      Attendance | 3 classes | 45m  → │                                      │
│                                       │ Affected: 72 students                │
│ AMB  Reconciliation difference        │ Owner: Examination Coordinator       │
│      Finance | NPR … | 1 day       → │ Due: Today 12:00                    │
│                                       │                                      │
│ BLU  Contract expiry unassigned        │ Evidence                             │
│      Staff | 2 records | 3 days    → │ • Marks completeness                 │
│                                       │ • Submission history                 │
│ [Pagination]                           │ • Related approval                   │
│                                       │                                      │
│                                       │ [Open source workspace] [Escalate]  │
└───────────────────────────────────────┴──────────────────────────────────────┘
```

### Selected issue behavior

- Selection persists in URL query state.
- On tablet, selected issue opens in a full-screen sheet.
- Acknowledgement must not falsely resolve the underlying issue.

---

# 4. Approval Centre

**Route:** `/dashboard/approvals`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Leadership decisions                                                        │
│ Approval Centre                               [Review oldest urgent approval]│
│ Evidence-backed decisions requiring Principal authority.                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Urgent 2] [Due today 5] [Awaiting evidence 1] [Older than SLA 3]          │
├──────────────────────────────────────────────────────────────────────────────┤
│ [All] [Attendance] [Academics] [Admissions] [Staff] [Notices] [Finance*]    │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ APPROVAL QUEUE                       │ DECISION REVIEW                       │
│                                      │                                       │
│ Result publication                   │ Grade 8 Result Publication            │
│ Grade 8 | Submitted 2h ago        → │ Status: Awaiting Principal            │
│                                      │                                       │
│ Attendance correction               │ Request                               │
│ Student A | Submitted 3h ago      → │ Publish final Grade 8 results         │
│                                      │                                       │
│ Critical notice                      │ Impact                                │
│ All guardians | Scheduled 14:00   → │ 72 students / 144 guardians          │
│                                      │                                       │
│ Staff leave escalation               │ Readiness                             │
│ Science dept | Tomorrow           → │ ✓ All required subjects complete     │
│                                      │ ✓ Report cards generated             │
│                                      │ ! One moderation comment unresolved  │
│                                      │                                       │
│                                      │ Evidence [Open] [Download protected] │
│                                      │ Decision reason ____________________  │
│                                      │                                       │
│                                      │ [Return] [Reject] [Approve]           │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

### Confirmation state

```text
┌──────────────────────────────────────────────┐
│ Confirm result publication                   │
│ This makes Grade 8 results visible to        │
│ authorized guardians.                       │
│                                              │
│ Decision reason                              │
│ [__________________________________________] │
│                                              │
│ [Cancel]                     [Confirm publish]│
└──────────────────────────────────────────────┘
```

---

# 5. Enrollment Overview

**Route:** `/dashboard/students/overview`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Students                                                                     │
│ Enrollment Overview                              [Review student exceptions]│
│ Enrollment, capacity, lifecycle, and student-data quality.                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Active 1,248] [Capacity 83%] [Missing data 17] [Lifecycle decisions 4]    │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ ENROLLMENT BY GRADE / SECTION                │ CAPACITY PRESSURE             │
│ [Horizontal bars / compact table]            │ Grade 1   96%  (!)           │
│ Grade 1   144 / 150                          │ Grade 6   91%  (!)           │
│ Grade 2   132 / 150                          │ Grade 9   72%  (✓)           │
│ ...                                          │ [Open capacity report]        │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ STUDENT EXCEPTIONS                                                           │
│ [Type ▾] [Grade ▾] [Status ▾] [Search____________________]                  │
│                                                                              │
│ Student        Class       Issue                  Owner        Age      Open  │
│ A. Sharma      Grade 6 A   Guardian unverified    Admin        2d       →    │
│ B. Thapa       Grade 9 B   Missing identifier     Registrar    3d       →    │
│ C. Rai         Grade 2 A   Transfer decision      Principal    5h       →    │
├──────────────────────────────────────────────────────────────────────────────┤
│ RECENT ENROLLMENT CHANGES                                                    │
│ Read-only timeline with actor, date, lifecycle event, and audit link.        │
└──────────────────────────────────────────────────────────────────────────────┘
```

No `New admission`, edit, QR generation, or unrestricted export appears.

---

# 6. Admissions Overview

**Route:** `/dashboard/admissions/overview`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Students                                                                     │
│ Admissions Overview                           [Review admission decisions →]│
│ Funnel, capacity, waitlist, and leadership exceptions.                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [In progress 64] [Waiting review 18] [Ready decision 7] [Waitlisted 12]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ADMISSION FUNNEL                                                             │
│ Inquiry 108 ── Application 82 ── Review 41 ── Decision 20 ── Enrolled 14   │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ CAPACITY BY INTAKE GRADE                     │ WAITLIST                      │
│ Grade 1  8 seats left                        │ Grade 1   7 applicants        │
│ Grade 6  2 seats left (!)                    │ Grade 6   4 applicants        │
│ Grade 9  18 seats left                       │ Oldest    12 days             │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ LEADERSHIP DECISION QUEUE                                                    │
│ Applicant     Grade     Reason / exception       Evidence      Age     Open │
│ Applicant A   Grade 6   Capacity exception       Complete      3h       →   │
│ Applicant B   Grade 1   Duplicate warning        Partial       1d       →   │
│ Applicant C   Grade 9   Scholarship exception    Complete      2d       →   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. Attendance Oversight

**Route:** `/dashboard/attendance/overview`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School readiness                                                             │
│ Attendance Oversight                           [Review 5 corrections →]      │
│ Completion, repeated absence, anomalies, and correction decisions.          │
├──────────────────────────────────────────────────────────────────────────────┤
│ [42/45 submitted] [3 not submitted] [61 absent] [9 risk alerts] [5 reviews]│
├──────────────────────────────────────────────────────────────────────────────┤
│ [Today] [BS month ▾] [Grade ▾] [Status ▾] [Teacher ▾]                      │
├────────────────────────────────────────────────┬─────────────────────────────┤
│ SUBMISSION STATUS                              │ AT-RISK STUDENTS            │
│ Class       Teacher        Due       Status     │ Student      Pattern       │
│ Grade 4 A   T. Sharma      09:15     Submitted  │ Student A    5 abs / 10d →│
│ Grade 5 B   R. Thapa       09:15     Missing !  │ Student B    7 late / 15d→│
│ Grade 8 A   M. Rai         10:00     Late !     │ [Open follow-up queue]     │
│ [View all classes]                             │                             │
├────────────────────────────────────────────────┼─────────────────────────────┤
│ CORRECTION QUEUE                               │ 30-DAY TREND                │
│ Student | Original | Requested | Reason | Age │ [Completion / absence /    │
│ ...                                            │ lateness chart]             │
│ [Review corrections]                          │                             │
└────────────────────────────────────────────────┴─────────────────────────────┘
```

No attendance-marking CTA or offline-draft link appears.

---

# 8. Academic Readiness

**Route:** `/dashboard/academics/readiness`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School readiness                                                             │
│ Academic Readiness                          [Review publication decisions →] │
│ Marks completion, results, report cards, and promotion readiness.           │
│ [Academic Year ▾] [Exam Term ▾]                         Updated 10:06        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Sheets complete 38/42] [Missing 4] [Corrections 3] [Ready publish 6]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ READINESS BY CLASS                                                           │
│ Class     Complete     Missing subjects     Result status       Owner  Open │
│ Grade 6A  8 / 8        —                    Ready               Exam   →    │
│ Grade 7A  7 / 8        Mathematics          Blocked             Math   →    │
│ Grade 8A  6 / 8        Science, Nepali      At risk             Exam   →    │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ CORRECTION / UNLOCK QUEUE                    │ REPORT-CARD JOBS              │
│ Request       Class   Age   Status        → │ Grade 6  Completed            │
│ Mark unlock   7A      2h    Awaiting         │ Grade 7  Blocked (!)          │
│ Result fix    8A      4h    Evidence ready   │ Grade 8  Processing           │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ PERFORMANCE AND OUTLIERS                                                     │
│ [Grade/subject comparison with an explicit methodology and drill-through]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. Staff Overview

**Route:** `/dashboard/hr/overview`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School readiness                                                             │
│ Staff Overview                                   [Review staff approvals →] │
│ Workforce coverage, leave impact, contracts, and staffing risk.             │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Active 52] [Present 46] [On leave 4] [Coverage gaps 2] [Expiring 3]       │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ TODAY'S COVERAGE                             │ PENDING LEAVE DECISIONS       │
│ Department      Required  Available  Status  │ Teacher A   2 days      →    │
│ Primary         18        17         Gap !   │ Teacher B   1 day       →    │
│ Secondary       22        22         Ready   │ Support C   3 days      →    │
│ Administration   8         7         Gap !   │ [Open Approval Centre]       │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ CONTRACT / PROBATION REMINDERS               │ ATTENDANCE ANOMALIES          │
│ Staff         Event       Date       Risk    │ Staff A     Repeated late →  │
│ ...                                          │ Staff B     Missing record → │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ PAYROLL READINESS — permission gated                                          │
│ Status: Read-only / Restricted / Unavailable                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

No salary, bank account, Add Staff, payroll run, or payslip operations appear.

---

# 10. Finance Overview

**Route:** `/dashboard/finance-overview`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School readiness                                                             │
│ Finance Overview                              [Review financial approvals*] │
│ Financial position, collection performance, and material exceptions.        │
│ [Fiscal Year ▾] [Period ▾]                              Updated 10:02        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Collection 82%] [Outstanding NPR …] [Cash & bank NPR …] [Exceptions 2]    │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ COLLECTION AND RECEIVABLES                   │ AGING                         │
│ [Billed vs collected trend]                  │ Current     ███████           │
│                                              │ 1–30 days   ███               │
│                                              │ 31–60       ██                │
│                                              │ 90+         █ (!)             │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ INCOME VS EXPENDITURE                        │ CASH AND BANK                 │
│ [Monthly comparison]                         │ Cash        NPR …             │
│                                              │ Bank        NPR …             │
│                                              │ Unreconciled 2 items (!)      │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ MATERIAL EXCEPTIONS                                                          │
│ Type                 Amount / impact        Owner       Age       Open       │
│ Reconciliation       NPR …                  Accountant  1d        →          │
│ Reversal approval    NPR …                  Finance     4h        →          │
├──────────────────────────────────────────────────────────────────────────────┤
│ FINANCIAL STATEMENTS                                                         │
│ [Income & Expenditure] [Balance Sheet] [Cash Flow] [Receivables Aging]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

No operational vouchers, journals, mappings, or reconciliation editing.

---

# 11. Notices and Critical Communication

**Route:** `/dashboard/notices`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Communication                                                                │
│ Notices                                        [Review 3 approvals →]        │
│ Official notices, critical reach, acknowledgement, and corrections.         │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Awaiting 3] [Scheduled critical 2] [Failed delivery 18] [Overdue ack 44]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [All] [Approvals] [Critical] [Scheduled] [Delivery] [History]              │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ NOTICE GOVERNANCE QUEUE                      │ CRITICAL REACH                │
│ Title       Audience    Status      Age   →  │ Emergency Closure Notice     │
│ ...                                          │ Delivered 1,184 / 1,202      │
│                                              │ Read 976 | Acknowledged 814  │
│                                              │ Failed 18 [Investigate]       │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ CORRECTIONS / WITHDRAWALS                                                     │
│ Original notice → corrected version → delivery / acknowledgement status     │
└──────────────────────────────────────────────────────────────────────────────┘
```

When no approval is waiting and create permission exists, `Create leadership notice` may appear as a secondary action.

---

# 12. Activity Oversight

**Route:** `/dashboard/activity/oversight`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Communication                                                                │
│ Activity Oversight                            [Review moderation queue →]    │
│ Consent, sensitive content, moderation, and participation.                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Moderation 5] [Consent blocked 3] [Reported 1] [Media failed 2]           │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ SENSITIVE / REPORTED CONTENT                 │ CONSENT EXCEPTIONS            │
│ Post       Class       Reason      Age    → │ Post       Student scope  →   │
│ ...                                          │ ...                           │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ PARTICIPATION                                │ RECENT PUBLISHED ACTIVITY     │
│ [Grade / class comparison]                   │ Read-only feed preview        │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ PUBLICATION / DELIVERY TREND                                                 │
│ [Approved, returned, failed processing, parent-delivery issues]             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 13. Notifications

**Route:** `/dashboard/notifications`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Communication                                                                │
│ Notifications                                      [Mark visible as read]   │
│ Your alerts, approvals, failures, and reminders.                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Unread] [Critical] [Approvals] [System] [Archived] [Search________]       │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ TODAY                                │ SELECTED NOTIFICATION                 │
│ ● Results ready for approval     →  │ Results ready for approval           │
│ ● Attendance missing — Grade 5   →  │ Grade 8 results passed readiness...  │
│   Notice delivery complete       →  │ Event time: 09:46                    │
│                                      │ Delivered: 09:46                     │
│ EARLIER                              │                                      │
│   Contract reminder             →   │ [Open approval] [Mark read]          │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

# 14. Reports

**Route:** `/dashboard/reports`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Evidence                                                                     │
│ Reports                                                                      │
│ Authorized academic, attendance, staff, finance, and compliance reports.    │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ REPORT CATALOGUE                     │ SELECTED REPORT                       │
│ [Search reports____________]         │ Attendance Submission Compliance     │
│                                      │ Description and data classification  │
│ Executive                            │                                      │
│  • Daily Executive Summary        → │ Filters                              │
│ Students                             │ [Academic Year ▾] [Date range]       │
│  • Enrollment by Grade            → │ [Grade ▾]                            │
│ Attendance                           │                                      │
│  • Submission Compliance          → │ Formats [CSV] [PDF]                  │
│ Academics                            │ [Queue background export □]          │
│  • Result Readiness               → │                                      │
│ Finance                              │ [Generate report]                    │
│  • Income & Expenditure           → │                                      │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ RECENT PROTECTED EXPORTS                                                   │
│ Report | Requested by | Created | Status | Classification | Download       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 15. Leadership Audit

**Route:** `/dashboard/audit`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Evidence                                                                     │
│ Leadership Audit                              [Review critical events →]     │
│ High-risk changes across access, students, academics, finance, and notices. │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Critical 2] [Access changes 4] [Academic corrections 3] [Exports 5]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Date ▾] [Risk ▾] [Module ▾] [Event ▾] [Actor ▾] [Search________]         │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ EVENT LIST                           │ EVENT DETAIL                          │
│ Time  Event          Actor   Risk → │ Marks unlocked                       │
│ 9:42  Marks unlock   User A  High   │ Actor: Examination Coordinator       │
│ 9:18  Guardian revoke Admin  High   │ Grade 8 / Science                    │
│ 8:51  Attendance fix User B  Medium │ Reason: Correction request #...      │
│                                      │                                      │
│                                      │ Before: Locked                       │
│                                      │ After: Reopened                      │
│                                      │ Approval: Principal at 09:40         │
│                                      │ Evidence [Open protected]            │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

Sensitive before/after fields are redacted unless explicitly authorized.

---

# 16. Personal Profile and Security

**Entry:** top-right user menu

```text
┌──────────────────────────────────────┐
│ Principal Name                       │
│ principal@school.edu.np              │
├──────────────────────────────────────┤
│ My Profile                           │
│ Notification Preferences             │
│ Security and Sessions                │
├──────────────────────────────────────┤
│ Sign Out                             │
└──────────────────────────────────────┘
```

Security page:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Personal settings                                                            │
│ Security and Sessions                                                       │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ PASSWORD                             │ ACTIVE SESSIONS                       │
│ Last changed: 42 days ago            │ This browser      Current             │
│ [Change password]                    │ iPhone            2 hours ago [Revoke]│
│                                      │ MacBook           1 day ago  [Revoke]│
├──────────────────────────────────────┴───────────────────────────────────────┤
│ RECENT SIGN-IN ACTIVITY                                                    │
│ Time | Device | Approximate location | Result                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

No institutional settings are shown merely because the user is a Principal.

---

# 17. Shared state wireframes

## Loading

```text
Page title and context remain visible.
[████████] [████████] [████████] [████████]
┌──────────────────────────────────────────┐
│ Skeleton rows matching final density     │
└──────────────────────────────────────────┘
```

## Partial data

```text
┌────────────────────────────────────────────────────────────┐
│ Some information is temporarily unavailable.               │
│ Attendance and Academics are current. Finance could not be │
│ refreshed. Last successful update: 09:40.      [Retry]     │
└────────────────────────────────────────────────────────────┘
```

## Permission restricted

```text
┌────────────────────────────────────────────────────────────┐
│ This information is restricted                             │
│ Your Principal access does not include staff salary data.  │
│ Contact the School Configuration Owner when access is      │
│ required for an approved responsibility.                   │
└────────────────────────────────────────────────────────────┘
```

## Empty queue

```text
┌────────────────────────────────────────────────────────────┐
│ ✓ No open items                                            │
│ Nothing currently needs your decision for these filters.   │
│ [Reset filters]                                            │
└────────────────────────────────────────────────────────────┘
```

## High-risk error

```text
┌────────────────────────────────────────────────────────────┐
│ Decision was not recorded                                  │
│ The approval service did not confirm the change. Nothing   │
│ was approved or rejected. Your reason has been preserved.  │
│ [Retry] [Return to queue]                                  │
└────────────────────────────────────────────────────────────┘
```
