# SchoolOS Admin Web Wireframes

**Fidelity:** Low-fidelity structural wireframes  
**Purpose:** Define hierarchy, density, responsive behavior, and page anatomy before visual implementation  
**Applies to:** The page catalogue in `ADMIN_WEB_DESIGN.md`

---

## 1. Wireframe Conventions

```text
[Button]          actionable control
{Filter}          selector/input
<KPI>             backend-owned summary
| Table |         server-paginated table
[Drawer]          contextual detail panel
! Warning         warning or high-risk state
* Protected       protected file/export action
```

### Standard desktop shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School / Branch ▼   Academic Year ▼   Search                     Bell  User │
├───────────────┬──────────────────────────────────────────────────────────────┤
│ SIDEBAR       │ Breadcrumb / Module                                         │
│               │ Page title + purpose                        [Primary] [More] │
│ Command       │ Context / metadata                                           │
│ Students      ├──────────────────────────────────────────────────────────────┤
│ Operations    │ Page-specific content                                        │
│ Academics     │                                                              │
│ People        │                                                              │
│ Finance       │                                                              │
│ Services      │                                                              │
│ Evidence      │                                                              │
│ Settings      │                                                              │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

### Standard narrow layout

```text
┌───────────────────────────────────┐
│ ☰  School / Branch ▼       Bell  │
│ Page title                        │
│ Purpose                           │
│ [Primary action]   [More]         │
├───────────────────────────────────┤
│ Context chips / horizontal tabs   │
│                                   │
│ Stacked content                   │
│                                   │
└───────────────────────────────────┘
```

---

# 2. Command Centre Wireframes

## WF-01 — Admin Dashboard

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School Dashboard                         Branch: All | AY 2083/84 | Updated │
│ Today's readiness, exceptions and approvals.              [Review top issue]│
├──────────────────────────────────────────────────────────────────────────────┤
│ <Attendance> <Admissions> <Fees control> <Academics> <People> <Approvals>  │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ NEEDS ACTION                                │ TODAY'S OPERATIONS            │
│ ! Missing attendance .............. [Open] │ Attendance ........ Attention │
│ ! Failed payment posting .......... [Open] │ Admissions ........ Ready     │
│ ! Result publish blockers ......... [Open] │ Fees .............. Partial   │
│ ! Payroll review due .............. [Open] │ Communication ..... Ready     │
│ [View all actions]                          │ [Open readiness]              │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ ENABLED MODULE HEALTH                                                       │
│ Module | Status | Critical check | Owner | Last update | Action             │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ CONFIGURATION & SECURITY                    │ RECENT SCHOOL ACTIVITY        │
│ Owner coverage / risky roles / setup gaps   │ Audited changes and events    │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-02 — Action Centre

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Action Centre                                        [Create internal action]│
│ Structured school requests, disputes and exception follow-up.               │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Open> <Overdue> <Unassigned> <Escalated>                                   │
│ {Module} {Category} {Priority} {Assignee} {Due date} {Search} [Reset]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Action | Student/Staff | Source | Priority | Status | Assignee | Due | Open │
│ ...                                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pagination                                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

Selected row:
┌───────────────────────────────────────────────┬──────────────────────────────┐
│ Queue remains visible                        │ DETAIL DRAWER                │
│                                               │ Narrative / evidence         │
│                                               │ Parent-visible notes         │
│                                               │ Internal notes               │
│                                               │ Owner / SLA / history        │
│                                               │ [Assign] [Escalate] [Resolve]│
└───────────────────────────────────────────────┴──────────────────────────────┘
```

## WF-03 — Approval Centre

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Approval Centre                                      <Urgent 3> <Due today 8>│
│ Review cross-module decisions with evidence and impact.                     │
├───────────────┬──────────────────────────────────────┬───────────────────────┤
│ QUEUE         │ EVIDENCE                             │ DECISION              │
│ Finance  4    │ Request title / source               │ Policy / threshold    │
│ Attendance 2  │ Original value                       │ Requester / approver  │
│ Academics 5   │ Requested value                      │ Separation warning    │
│ HR 3          │ Impacted records                     │ {Reason}              │
│ Security 1    │ Attachments / history                │ [Return] [Reject]     │
│               │ Audit preview                        │ [Approve]             │
└───────────────┴──────────────────────────────────────┴───────────────────────┘
```

## WF-04 — School Readiness

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School Readiness                                              [Review blockers]│
│ Exact readiness checks for the current school context.                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ {Branch} {Academic year} {Fiscal period} {Day/Term/Cycle}                   │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ DOMAIN CHECKS                               │ BLOCKERS                      │
│ Admissions ........ Ready                  │ Critical 2                    │
│ Attendance ....... Attention [3 checks]    │ High 5                        │
│ Fees ............. Blocked [Open]          │ Medium 8                      │
│ Academics ........ Attention               │                               │
│ HR/Payroll ....... Ready                   │ Owner / due / action list     │
│ Accounting ....... Attention               │                               │
│ Communication .... Ready                   │                               │
│ Security ......... Attention               │                               │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ RECENTLY RESOLVED                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Students and Admissions Wireframes

## WF-05 — Admissions Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Admissions                                                   [New admission]│
│ Review cases, missing information, warnings and ready applicants.           │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Needs info> <Waiting review> <Ready> <Duplicates> <Capacity exceptions>   │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ ADMISSION CASE QUEUE                         │ CAPACITY / UPCOMING          │
│ Applicant | Class | Stage | Owner | Age |   │ Class capacity bars         │
│ Warning | Updated | [Open]                   │ Interviews this week         │
│ ...                                          │ Missing documents            │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ [Applications] [Assessments] [Documents] [iEMIS] [QR/ID] [Policy]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-06 — Admission Case Detail

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Applicant Name | Case ADM-2083-0042 | Waiting review          [Next action]│
│ Grade 6 | AY 2083/84 | Branch | Capacity warning                           │
├──────────────────────────────────────────────────────┬───────────────────────┤
│ <Overview> <Guardians> <Documents> <Assessment>     │ REQUIREMENTS          │
│ <Decisions> <Timeline>                              │ ✓ Form                │
│                                                     │ ! Birth certificate  │
│ Main selected tab                                   │ ! Duplicate candidate│
│                                                     │ Owner / due date     │
│                                                     │ [Return] [Accept]    │
└──────────────────────────────────────────────────────┴───────────────────────┘
```

## WF-07 — Students Directory

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Students                                                    [New admission]│
│ Authoritative enrolled-student directory.                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ {AY} {Branch} {Class} {Section} {Status} {Data issue} {Search} [Reset]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Student | ID / Roll | Class | Guardians | Enrollment | Quality | [Open]    │
│ ...                                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1-25 of 1,218                                          [Prev] 1 2 3 [Next]│
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-08 — Student Profile

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Photo] Student Name | ID | Grade 6-A | ACTIVE                 [Primary]    │
│ Branch | AY | Safety indicator | Data completeness                         │
├──────────────────────────────────────────────────────┬───────────────────────┤
│ <Overview> <Enrollment> <Guardians> <Attendance>    │ QUICK CONTEXT         │
│ <Academics> <Fees> <Documents> <Activity>           │ Critical contacts     │
│ <Requests> <History>                                │ Medical/safety *Reveal│
│                                                     │ Open actions          │
│ Selected domain                                    │ Recent documents      │
│                                                     │ Audit timeline        │
├──────────────────────────────────────────────────────┴───────────────────────┤
│ DANGER ZONE: [Transfer] [Withdraw] [Graduate] [Merge duplicate]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-09 — Guardians and Access

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Guardians & Access                                      [Add guardian link]│
│ Verify relationships, capabilities and account recovery.                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Unverified> <Recovery> <Suspended> <Restricted> <Duplicates>              │
│ {Student} {Relationship} {Status} {Search}                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Guardian | Linked students | Relationship | Capabilities | Status | [Open] │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Table                                        │ DETAIL / CAPABILITY MATRIX  │
│                                              │ View attendance   ✓         │
│                                              │ View fees         ✓         │
│                                              │ Make payment      —         │
│                                              │ [Verify] [Suspend] [Recover]│
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-10 — Enrollment and Lifecycle

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Enrollment & Lifecycle                                  [Start bulk action]│
│ Placement, re-enrollment, transfer, withdrawal and graduation.             │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Placement> <Re-enrollment> <Transfers> <Withdrawals> <Graduation>         │
│ {AY} {Branch} {Class} {Status} {Search}                                    │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Lifecycle queue                              │ CAPACITY / EXCEPTIONS        │
│ Student | Current | Proposed | Status | Open │ Grade capacity              │
│                                              │ Missing next-year class     │
│                                              │ Fee/library blockers        │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-11 — Data Quality and iEMIS

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Student Data Quality                                      [Start import]    │
│ Fix documents, duplicates and export blockers.                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Missing docs> <Verification> <Duplicates> <iEMIS> <Imports> <Exports>    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Issue | Student | Severity | Source | Owner | Status | [Resolve]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Import job: Upload -> Validate -> Preview -> Commit -> Download result      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 4. Attendance Wireframes

## WF-12 — Attendance Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Smart Attendance                               [Review missing submissions]│
│ School-wide completion, anomalies and correction control.                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Submitted> <Not submitted> <Absent/Late> <Corrections> <Conflicts>       │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ CLASS SUBMISSION STATUS                      │ AT-RISK / FOLLOW-UP          │
│ Class | Teacher | State | Time | [Open]      │ Repeated absence list       │
│ ...                                          │ Late/early exceptions       │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ CORRECTION QUEUE PREVIEW                     │ TEACHER COMPLIANCE TREND    │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-13 — Attendance Marking

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Daily Attendance                                             [Offline drafts]│
│ {Date} {Class} {Section} {Session}    State: Draft / Locked / Submitted    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Mark all present] {Search student} {Exception filter}                     │
├────────────────────────────────────────────────────────┬─────────────────────┤
│ Student | Present | Absent | Late | Excused | Reason   │ EXCEPTION SUMMARY  │
│ ...                                                    │ Absent 4           │
│                                                        │ Late 2             │
│                                                        │ Missing reason 1   │
├────────────────────────────────────────────────────────┴─────────────────────┤
│ Draft saved 10:42                         [Save draft] [Submit / Override]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-14 — Corrections and Conflicts

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Attendance Exceptions                                      <Corrections 8> │
│ Review original and requested states without deleting history.              │
├───────────────┬──────────────────────────────────────┬───────────────────────┤
│ QUEUE         │ EVIDENCE                             │ DECISION              │
│ Student/date  │ Original: ABSENT                     │ Policy / lock state   │
│ Conflict type │ Requested: PRESENT                   │ {Reason}              │
│ Severity      │ Device/session/timestamps            │ [Return] [Reject]     │
│               │ Attachments / guardian note          │ [Approve correction] │
└───────────────┴──────────────────────────────────────┴───────────────────────┘
```

## WF-15 — Attendance Reports

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Attendance Reports                                           [Run report]  │
├───────────────────┬──────────────────────────────────────┬───────────────────┤
│ REPORTS           │ FILTERS / PREVIEW                    │ EXPORT            │
│ Daily completion  │ {AY} {Class} {Date range}           │ CSV / PDF         │
│ Monthly register  │ Preview table/chart                  │ Queue background  │
│ Student history   │                                      │ * Protected files │
│ Repeated absence  │                                      │ Recent snapshots  │
└───────────────────┴──────────────────────────────────────┴───────────────────┘
```

---

# 5. Fees and Receipts Wireframes

## WF-16 — Fees Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fees & Receipts                                         [Collect payment]  │
│ Billing, collections, dues, adjustments and cashier control.               │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Billed> <Collected today> <Outstanding> <Adjustments> <Close state>      │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ COLLECTION / AGING TREND                    │ CASHIER & PAYMENT STATUS      │
│ Chart + drill                               │ Cashiers / methods / close   │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ DEFAULTER / OVERDUE QUEUE                   │ FAILED / UNPOSTED EVENTS     │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-17 — Billing Runs and Invoices

```text
Billing run:
┌──────────────────────────────────────────────────────────────────────────────┐
│ New Billing Run                                                           │
│ {Period} {Fee plan} {Classes} {Due date}                                  │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ TARGET PREVIEW                               │ VALIDATION                   │
│ Students / exclusions / amount              │ Missing plan / duplicates   │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ [Save draft] [Validate] [Queue invoice generation]                         │
└──────────────────────────────────────────────────────────────────────────────┘

Invoice register:
┌──────────────────────────────────────────────────────────────────────────────┐
│ {Status} {Class} {Due range} {Search}                                      │
│ Invoice | Student | Gross | Discount | Paid | Balance | Due | Status | Open│
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-18 — Collection Counter

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Collect payment                                                            │
├───────────────────────┬────────────────────────────────┬─────────────────────┤
│ STUDENT DISCOVERY     │ INVOICES / ALLOCATION          │ PAYMENT SUMMARY     │
│ {Search}              │ [ ] Tuition ........ 20,000   │ Student confirmed   │
│ Results               │ [ ] Exam ............ 2,000   │ Method              │
│ Selected student      │ Allocation amount fields      │ Reference           │
│ Guardian/payer        │ Credits / overpayment warning │ Total NPR           │
│                       │                                │ [Confirm payment]   │
└───────────────────────┴────────────────────────────────┴─────────────────────┘
```

## WF-19 — Student Ledger and Receipts

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Student Ledger / Receipt Centre                                             │
│ {Student} {Academic year} {Type} {Date range}                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Date | Ref | Description | Debit | Credit | Running balance | Source | Open│
├──────────────────────────────────────────────┬───────────────────────────────┤
│ LEDGER TOTALS                                │ SELECTED RECEIPT             │
│ Opening / billed / paid / waived / closing  │ Number / status / method    │
│                                              │ * Download PDF              │
│                                              │ [Audited reprint]           │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-20 — Adjustments

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Financial Adjustments                                     <Pending 6>      │
│ <Refunds> <Reversals> <Waivers> <Discounts> <History>                     │
├───────────────┬──────────────────────────────────────┬───────────────────────┤
│ QUEUE         │ ORIGINAL / REQUESTED                 │ DECISION              │
│ Student       │ Payment/receipt/ledger lineage       │ Threshold / policy    │
│ Amount        │ Accounting impact                    │ {Reason}              │
│ Type/status   │ Payer notification impact            │ [Return] [Reject]     │
│               │ Attachments                          │ [Approve]             │
└───────────────┴──────────────────────────────────────┴───────────────────────┘
```

## WF-21 — Cashier Close

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Cashier Close                         {School day} {Cashier} {Session}      │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ EXPECTED TOTALS                              │ ACTUAL / EVIDENCE            │
│ Cash / bank / wallet / refunds              │ {Actual cash}               │
│ Expected close                              │ {Deposit reference}         │
│                                              │ * Deposit evidence          │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ Variance: NPR ...   {Required explanation}                                  │
│ [Save] [Review] [Confirm immutable close]                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-22 — Fees Reports and Setup

```text
Reports:
┌──────────────────┬──────────────────────────────────────┬────────────────────┐
│ Report catalogue │ Filters / preview                    │ Export / snapshots │
└──────────────────┴──────────────────────────────────────┴────────────────────┘

Setup:
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Fee heads & plans> <Discount rules> <Receipt policy> <Methods>            │
│ Editable table/form                                         [Save changes]  │
│ Impact preview / affected students / effective date                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. Academics Wireframes

## WF-23 — Academics Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Academics                                             [Open current term]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Exam terms> <Incomplete marks> <Lock requests> <Result ready> <Failures> │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ READINESS BY CLASS / TERM                    │ EXCEPTIONS                   │
│ Class | Marks | Results | Cards | Promotion │ Missing marks              │
│                                              │ Publish blockers           │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ [Exam setup] [Marks & CAS] [Results] [Report cards] [Promotion]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-24 — Structure and Assignments

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Academic Structure & Assignments                           [Add / Import]   │
│ {Academic year} {Branch}                                                   │
├──────────────────┬────────────────────────────────────────┬──────────────────┤
│ ENTITIES         │ TABLE / ASSIGNMENT MATRIX              │ VALIDATION       │
│ Classes          │ Class | Section | Subject | Teacher    │ Missing teacher │
│ Sections         │ ...                                    │ Capacity         │
│ Subjects         │                                        │ Conflicts        │
│ Rooms/Streams    │                                        │ [Validate]       │
└──────────────────┴────────────────────────────────────────┴──────────────────┘
```

## WF-25 — Exam Setup

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Exam Term Setup                                      Step 4 of 8            │
│ [Details]—[Scope]—[Components]—[Grading]—[Schedule]—[Access]—[Validate]   │
├──────────────────────────────────────────────────────┬───────────────────────┤
│ MAIN FORM / MATRIX                                   │ SETUP CHECKS          │
│                                                      │ Missing subjects      │
│                                                      │ Invalid max marks     │
│                                                      │ Teachers unassigned   │
├──────────────────────────────────────────────────────┴───────────────────────┤
│ [Save draft] [Previous] [Next] [Open marks entry]                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-26 — Marks and CAS

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Marks & CAS     {Term} {Class} {Section} {Subject} {Component}            │
│ State: Draft / Submitted / Locked                     [Validate]            │
├────────────────────────────────────────────────────────┬─────────────────────┤
│ Student | Roll | Theory | Practical | Internal | Total │ VALIDATION SUMMARY  │
│ ...                                                    │ Missing 4           │
│                                                        │ Out of range 1      │
│                                                        │ Override mode OFF   │
├────────────────────────────────────────────────────────┴─────────────────────┤
│ Autosaved ...                                    [Save] [Submit / Override] │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-27 — Results and Publication

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Results & Publication                                  [Publish selected]   │
│ {Term} {Class} {Status}                                                    │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ READINESS TABLE                              │ SELECTED CLASS              │
│ Class | Ready | Blockers | Published | Open │ Result preview             │
│                                              │ Audience                   │
│                                              │ Schedule                   │
│                                              │ Notifications              │
│                                              │ [Publish] [Withdraw]       │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-28 — Report Cards and Promotion

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Report cards> <Promotion> <Retakes> <Locks>                               │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ JOB / DECISION QUEUE                         │ DETAIL                       │
│ Class | Status | Failures | Updated | Open   │ Template/version            │
│                                              │ Readiness checks             │
│                                              │ * Protected PDF             │
│                                              │ Next-year placement         │
│                                              │ [Regenerate / Decide]       │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

---

# 7. Activity, Homework, Timetable, and Learning Wireframes

## WF-29 — Activity Feed

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Activity Feed                                             [Create activity]│
│ <Pending moderation> <Consent issues> <Media failures> <Published today>  │
│ {Class} {Section} {Category} {Status} {Author} {Month} {Search}           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Title | Class | Category | Author | Status | Audience | Published | [Open] │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-30 — Activity Composer

```text
┌──────────────────────────────────────────────────────┬───────────────────────┐
│ Create Activity                                      │ AUDIENCE / CONSENT    │
│ {Title} {Category}                                   │ Recipients 326        │
│ {Narrative}                                          │ Consent blocked 2     │
│ {Class/Section/Student tags}                         │ Media processing      │
│ [Upload protected media]                             │ Channel preview       │
│ {Schedule} {Audience}                                │                       │
├──────────────────────────────────────────────────────┴───────────────────────┤
│ [Save draft] [Submit for review] [Publish]                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-31 — Moderation / Consent / Milestones

```text
┌───────────────┬──────────────────────────────────────┬───────────────────────┐
│ QUEUE         │ CONTENT / STUDENT EVIDENCE           │ DECISION / DETAILS    │
│ Moderation    │ Media preview                        │ Consent checks        │
│ Consent       │ Tagged students                      │ {Reason}              │
│ Reports       │ Audience                             │ [Return] [Remove]     │
│ Milestones    │ Version history                      │ [Approve]             │
└───────────────┴──────────────────────────────────────┴───────────────────────┘
```

## WF-32 — Homework Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Homework                                                 [Create homework] │
│ <Due today> <Overdue> <Drafts> <Completion issues> <Workload conflicts>  │
│ <Today> <All> <Completion> <Templates>                                   │
│ {Class} {Section} {Subject} {Teacher} {Status} {Date} {Search}           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Title | Class | Subject | Teacher | Due | Status | Completion | [Open]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-33 — Homework Editor and Review

```text
Editor:
┌──────────────────────────────────────────────────────┬───────────────────────┐
│ Assignment / instructions / due / attachment / rubric│ AUDIENCE / CONFLICTS  │
│                                                      │ Students              │
│                                                      │ Deadline clash        │
└──────────────────────────────────────────────────────┴───────────────────────┘
│ [Draft] [Schedule] [Publish]                                                │

Review:
┌──────────────────────┬────────────────────────────────┬──────────────────────┐
│ Student submissions  │ Selected response/files        │ Feedback / status    │
└──────────────────────┴────────────────────────────────┴──────────────────────┘
```

## WF-34 — Timetable Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Timetable                                          [New timetable version] │
│ <Published version> <Drafts> <Conflicts> <Uncovered> <Substitutions>      │
│ {AY} {Class} {Teacher} {Room}                                             │
│ <Weekly grid> <Versions> <Requirements> <Conflicts> <Substitutions>       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Weekly timetable grid / selected tab                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-35 — Timetable Builder and Exceptions

```text
┌──────────────────┬────────────────────────────────────────┬──────────────────┐
│ PALETTE          │ TIMETABLE CANVAS                       │ CONSTRAINTS      │
│ Subjects         │ Mon Tue Wed Thu Fri                    │ Conflicts 4      │
│ Teachers         │ Period rows / class columns            │ Workload 2       │
│ Rooms            │                                        │ Missing room 1   │
│ Requirements     │                                        │ [Validate]       │
├──────────────────┴────────────────────────────────────────┴──────────────────┤
│ Draft saved | [Compare] [Resolve conflicts] [Publish version]              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-55 — Learning Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Learning                                               [New activity]      │
│ <Active activities> <Sessions> <Review pending> <Low participation>       │
│ <Overview> <Activities> <Sessions> <Attempts> <Progress> <Resources>      │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ ACTIVITY / SESSION LIST                      │ PARTICIPATION / FAILURES     │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-56 — Learning Session and Progress

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Session: Fractions Practice | LIVE | Access code ****          [Close]     │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ PARTICIPANTS / ATTEMPTS                      │ SESSION CONTROL              │
│ Student | State | Progress | Review          │ Pause / resume              │
│                                              │ Resources                   │
│                                              │ No ranking                  │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ Selected attempt / feedback / protected files                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 8. People and Payroll Wireframes

## WF-36 — HR Dashboard

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ HR & Staff                                                  [Add staff]    │
│ <Active staff> <On leave> <Pending leave> <Anomalies> <Expiring contracts>│
├──────────────────────────────────────────────┬───────────────────────────────┤
│ LEAVE QUEUE                                  │ CONTRACT REMINDERS          │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ STAFF COVERAGE                               │ ONBOARDING / OFFBOARDING    │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-37 — Staff Directory and Profile

```text
Directory:
┌──────────────────────────────────────────────────────────────────────────────┐
│ {Branch} {Department} {Designation} {Status} {Contract} {Search}           │
│ Staff | Employee ID | Department | Position | Contract | Status | [Open]   │
└──────────────────────────────────────────────────────────────────────────────┘

Profile:
┌──────────────────────────────────────────────────────┬───────────────────────┐
│ [Photo] Name / employee ID / status                 │ QUICK CONTEXT         │
│ <Employment> <Contract> <Qualifications> <Attendance│ Salary *Reveal       │
│ <Leave> <Payroll> <Documents> <Assignments> <History│ Open actions         │
├──────────────────────────────────────────────────────┴───────────────────────┤
│ DANGER ZONE [Suspend] [Terminate] [Archive]                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-38 — Contracts, Leave, Staff Attendance

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Contracts> <Leave> <Staff attendance>                                     │
│ {Status} {Department} {Date range} {Search}                                │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Queue/table                                   │ SELECTED DETAIL             │
│ Staff | Type | Period | Status | Due | Open  │ Evidence / impact          │
│                                               │ [Return] [Reject] [Approve]│
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-39 — Payroll Runs

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Payroll Runs                                           [Create payroll run]│
│ {Fiscal/Payroll period} {Status}                                             │
├───────────────────┬──────────────────────────────────────┬───────────────────┤
│ RUN LIST          │ SELECTED RUN                         │ CONTROL STATUS    │
│ Month / status    │ Gross / deductions / net            │ Exceptions        │
│ Updated / owner   │ Employee exception table            │ Statutory checks  │
│                   │ Timeline                             │ Accounting handoff│
│                   │                                      │ [Review/Post]     │
└───────────────────┴──────────────────────────────────────┴───────────────────┘
```

## WF-40 — Payslips and Payroll Reports

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Payslips> <Payroll reports>                                                │
│ {Period} {Department} {Employee} {Generation status}                       │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Payslip/report table                         │ SELECTED / EXPORT            │
│ Employee | Status | Delivered | [Open]       │ * Preview/download          │
│                                               │ Reason / watermark / expiry │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

---

# 9. School Services Wireframes

## WF-41 — School Operations Hub

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School Services                                                            │
│ Enabled service modules, exceptions and setup readiness.                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Module    | Status    | Critical exception | Setup | Finance handoff | Open│
│ Library   | Attention | 18 overdue          | Ready | Ready           | ->  │
│ Transport | Blocked   | 2 expired docs      | Issue | Ready           | ->  │
│ Canteen   | Ready     | None                | Ready | 1 pending       | ->  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Recent incidents / cross-service actions                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-42 — Library Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Library                                             [Issue / Return]        │
│ <Issued today> <Returns> <Overdue> <Reservations> <Lost/Damaged>          │
│ <Catalog> <Copies> <Issue/Return> <Reservations> <Borrowers> <Reports>    │
│ {Search / Barcode} {Category} {Availability}                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Book/copy/borrower table or counter workflow                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-43 — Transport Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Transport                                          [Create / Start trip]    │
│ <Trips> <Delayed/Stale> <Unassigned> <Documents> <Incidents>              │
│ <Routes> <Vehicles> <Staff> <Students> <Trips> <Live> <Reports>           │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Operational table/map with freshness labels │ EXCEPTIONS / INCIDENTS      │
│                                              │ Last verified GPS time      │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-44 — Canteen Workspace

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Canteen                                                  [Open POS]        │
│ <Sales> <Meals served> <Low wallets> <Allergy alerts> <Low stock>         │
│ <Menu> <Plans> <Wallets> <POS> <Serving> <Inventory> <Vendors> <Reports> │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Operational table/counter                    │ SAFETY / SETTLEMENT         │
│                                              │ Allergy alerts first        │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

---

# 10. Accounting and Finance Wireframes

## WF-45 — Finance Dashboard

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Accounting & Finance                                   [Create voucher]     │
│ <Fiscal status> <Pending approvals> <Unreconciled> <Receivables> <Posting>│
├──────────────────────────────────────────────┬───────────────────────────────┤
│ FINANCIAL CONTROL EXCEPTIONS                 │ FISCAL STATUS               │
│ Pending journals / mapping / payables        │ FY / period / lock         │
├──────────────────────────────────────────────┼───────────────────────────────┤
│ RECENT JOURNALS                              │ CASH / BANK POSITION        │
├──────────────────────────────────────────────┴───────────────────────────────┤
│ [Trial balance] [Ledger] [Income & expense] [Balance sheet] [Cash flow]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-46 — Chart of Accounts and Fiscal Management

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Chart of accounts> <Fiscal years & periods> <Opening balances>            │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Account hierarchy/table                     │ SELECTED ACCOUNT / PERIOD    │
│ Code | Name | Type | Parent | Active | Open │ Properties / mappings      │
│                                              │ Change history              │
│                                              │ [Edit / Lock / Reopen]     │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-47 — Journals and Vouchers

```text
List:
┌──────────────────────────────────────────────────────────────────────────────┐
│ {Period} {Type} {Status} {Source} {Search}                  [New voucher]  │
│ Number | Date | Type | Narration | Debit | Credit | Status | [Open]        │
└──────────────────────────────────────────────────────────────────────────────┘

Editor/review:
┌──────────────────────────────────────────────────────┬───────────────────────┐
│ Voucher fields / balanced lines / attachments       │ VALIDATION / AUDIT    │
│ Account | Debit | Credit | Cost center | Note        │ Balance check         │
│                                                      │ Source lineage        │
├──────────────────────────────────────────────────────┴───────────────────────┤
│ [Save draft] [Submit] [Approve] [Post] [Reverse]                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-48 — Cash, Bank, and Reconciliation

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Cash & Bank> <Reconciliation> <Deposits> <Cheques>                        │
│ {Account} {Period} {Status}                                                 │
├───────────────────────────────┬──────────────────────────────┬───────────────┤
│ BANK STATEMENT                │ MATCHING / LEDGER            │ DIFFERENCE    │
│ Imported rows                 │ Suggested / manual matches  │ Book balance  │
│                               │                              │ Bank balance  │
│                               │                              │ Unmatched     │
│                               │                              │ [Finalize]    │
└───────────────────────────────┴──────────────────────────────┴───────────────┘
```

## WF-49 — Receivables, Payables, and Source Postings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ <Receivables> <Payables> <Expenses> <Advances> <Source postings>          │
│ {Status} {Aging} {Module} {Vendor/Student} {Date range}                   │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Primary table                                │ SELECTED DETAIL             │
│ Ref | Party | Amount | Due | Status | Open   │ Lineage / documents        │
│                                              │ Mapping / retry history    │
│                                              │ [Pay / Post / Retry]       │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-50 — Financial Reports and Audit

```text
┌───────────────────┬──────────────────────────────────────┬───────────────────┐
│ REPORT / AUDIT    │ FILTERS / PREVIEW                    │ EXPORT / LINEAGE  │
│ Trial balance     │ Period / branch / account            │ PDF / CSV         │
│ General ledger    │ Statement or audit table             │ Snapshot history  │
│ Balance sheet     │                                      │ Drill to source   │
│ Audit exceptions  │                                      │ * Protected       │
└───────────────────┴──────────────────────────────────────┴───────────────────┘
```

---

# 11. Communication Wireframes

## WF-51 — Notices Centre

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Notices & Announcements                                    [Create notice] │
│ <Drafts> <Approval pending> <Scheduled> <Failures> <Ack overdue>          │
│ <All> <Scheduled> <Approvals> <Delivery logs>                             │
│ {Category} {Priority} {Audience} {Status} {Date} {Search}                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Notice | Audience | Lifecycle | Schedule | Delivery | Ack | [Open]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-52 — Notice Composer and Detail

```text
Composer:
┌──────────────────────────────────────────────────────┬───────────────────────┐
│ Title / content / category / priority               │ RECIPIENT PREVIEW     │
│ Audience builder                                    │ Exact count           │
│ Attachments / schedule / acknowledgement            │ Exclusions            │
│                                                      │ Channel preview       │
├──────────────────────────────────────────────────────┴───────────────────────┤
│ [Save draft] [Submit approval] [Schedule / Publish]                        │
└──────────────────────────────────────────────────────────────────────────────┘

Detail:
Lifecycle timeline | Versions | Recipients | Delivery | Acknowledgements | Audit
```

## WF-53 — Delivery and Failure Centre

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Delivery & Failure Centre                                  [Retry selected]│
│ <Failed> <Delayed> <Retrying> <Provider unavailable> <Critical unacked>   │
│ {Notice/Event} {Channel} {State} {Attempt} {Date} {Search}                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Event | Recipient | Channel | Safe error | Attempts | Last try | [Open]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ Provider credentials are not available here. [Escalate to SchoolOS]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-54 — Notifications Inbox

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Notifications                                                               │
│ <Unread> <All> <Archived>   {Severity} {Module}                            │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Inbox list                                   │ MESSAGE DETAIL              │
│ Title / module / time / unread               │ Full message               │
│                                              │ Safe deep link             │
│                                              │ [Mark read] [Archive]      │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

---

# 12. Reports, Audit, and Settings Wireframes

## WF-57 — Reports and Exports

```text
┌───────────────────┬──────────────────────────────────────┬───────────────────┐
│ REPORT CATALOGUE  │ CONFIGURATION / PREVIEW              │ OUTPUT            │
│ Students          │ Report title / description           │ CSV / PDF / JSON  │
│ Attendance        │ Dynamic filters                      │ Background queue  │
│ Finance           │ Preview / row count                  │ {Reason}          │
│ Academics         │                                      │ [Generate]        │
│ HR / Services     │                                      │                   │
├───────────────────┴──────────────────────────────────────┴───────────────────┤
│ RECENT EXPORTS: report | owner | status | classification | expiry | action │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-58 — School Audit

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School Audit                                                [Export audit] │
│ {Date} {Actor} {Role} {Branch} {Module} {Action} {Risk} {Search}          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Time | Actor | Action | Entity | Module | Result | Risk | [Open]            │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ Audit table                                  │ DETAIL DRAWER               │
│                                              │ Before / after             │
│                                              │ Reason / approval          │
│                                              │ Correlation / evidence     │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-59 — Settings Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School Settings                                                             │
│ Configure this school. Platform plans and secrets are managed by SchoolOS. │
├──────────────────────────────────────────────────────────────────────────────┤
│ <Ready domains> <Attention> <Pending approval> <Recent changes>            │
├──────────────────────────────────────────────┬───────────────────────────────┤
│ SCHOOL SETUP                                 │ READINESS / RECENT CHANGES  │
│ Identity / Branding / Calendar / Structure  │ Blocked settings           │
│                                              │ Owner coverage             │
│ ACADEMIC & STUDENT POLICY                   │ Safe integration status    │
│ ...                                          │                             │
│ FINANCE & ADMINISTRATION                    │                             │
│ ...                                          │                             │
└──────────────────────────────────────────────┴───────────────────────────────┘
```

## WF-60 — Identity, Branding, Calendar, Structure

```text
┌──────────────────┬────────────────────────────────────────┬──────────────────┐
│ SETTINGS NAV     │ FORM / TABLE                           │ PREVIEW / AUDIT  │
│ Identity         │ Selected settings domain               │ Document preview │
│ Branding         │                                        │ Last changed by  │
│ Calendar         │                                        │ Effective date   │
│ Structure        │                                        │ [View history]   │
├──────────────────┴────────────────────────────────────────┴──────────────────┤
│ [Save draft] [Validate] [Apply changes]                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-61 — Policies, Modules, Integrations, Documents

```text
Policy:
┌──────────────────────────────────────────────────────┬───────────────────────┐
│ Policy sections / values / effective date           │ IMPACT / HISTORY      │
│                                                      │ Affected workflows    │
│                                                      │ Last version          │
└──────────────────────────────────────────────────────┴───────────────────────┘
│ [Save draft] [Apply / Submit approval]                                      │

Modules / integrations:
┌──────────────────────────────────────────────────────────────────────────────┐
│ Module / integration | Entitled | Configured | Safe status | Last success  │
│ [Open setup] or [Contact SchoolOS] — never provider-secret controls         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-62 — Users, Roles, Permissions, Security

```text
Users:
┌──────────────────────────────────────────────────────────────────────────────┐
│ {Role} {Status} {Branch} {Security state} {Search}          [Create user] │
│ User | Staff link | Roles | Status | Last sign-in | Sessions | [Open]       │
└──────────────────────────────────────────────────────────────────────────────┘

Role editor:
┌──────────────────────┬────────────────────────────────┬──────────────────────┐
│ ROLE LIST            │ PERMISSION DOMAINS             │ IMPACT / RISK        │
│ System / custom      │ School permissions only        │ Users affected       │
│                      │ No platform permissions         │ Risk warnings        │
│                      │                                │ [Save role]          │
└──────────────────────┴────────────────────────────────┴──────────────────────┘
```

## WF-63 — Personal Account

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ My Account                                                                  │
│ <Profile> <Notifications> <Security> <Sessions> <Appearance & Language>    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Selected personal settings form                                             │
│                                                                             │
│                                                         [Save changes]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 13. Platform-Denied Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                         [Shield icon]                                        │
│                   Platform access is restricted                             │
│                                                                              │
│ This account administers one school. SchoolOS Platform controls are         │
│ available only to authorized SchoolOS operators.                            │
│                                                                              │
│                    [Return to School Dashboard]                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

No Platform sidebar, tenant list, plan, provider, queue, health, or billing information should render behind this state.

---

# 14. Shared State Wireframes

## Loading

```text
Page title and filters remain visible.
[████████] [████████] summary skeletons
| █████████████████████████████████████████████████████ |
```

## Empty

```text
[Contextual icon]
No records match this view
Explanation of why it is empty.
[One safe next action] [Reset filters]
```

## Permission denied

```text
This workspace is restricted
The current role does not include the required school capability.
[Return to Dashboard]
```

Admin should rarely see this inside tenant modules after the target permission change, but operation-level restrictions and support-override contexts may still require it.

## Module not enabled

```text
Module not enabled for this school
View entitlement status in School Settings. Platform controls remain with SchoolOS.
[Open Module Settings] [Contact SchoolOS]
```

## Partial data

```text
Some information is temporarily unavailable.
✓ Attendance loaded
! Finance summary unavailable
✓ Academic readiness loaded
[Retry unavailable sections]
```

## High-risk confirmation

```text
┌──────────────────────────────────────────────────────────────┐
│ Confirm high-risk action                                     │
│ Impact summary                                               │
│ Original -> proposed                                         │
│ Affected records / people / finance / notifications          │
│ {Required reason}                                            │
│ [ ] I reviewed the impact                                    │
│ [Cancel]                         [Confirm / Step up]          │
└──────────────────────────────────────────────────────────────┘
```

## Queued job

```text
Export / generation queued
Status: QUEUED -> PROCESSING -> SUCCEEDED / FAILED
Owner / created / progress / latest message
[Refresh] [Cancel if supported] [Download when ready]
```

---

# 15. Responsive Rules

### Below 1280 px

- Collapse right rails beneath primary content where they are not decision-critical.
- Keep approval decisions in a drawer.
- Preserve financial table columns through horizontal scroll.

### Below 1024 px

- Sidebar becomes drawer.
- Summary strip becomes two columns.
- Three-pane approval becomes queue + full-screen detail.
- Builder palettes become collapsible panels.

### Below 768 px

- Admin use is emergency/limited, not the primary workflow.
- One column.
- Tables show priority columns and `Open` action; full data in detail.
- Sticky primary action remains at bottom.
- Destructive actions require a second full-screen confirmation.

---

# 16. Wireframe Acceptance Checklist

Each implemented page must preserve:

- one main job;
- visible tenant/branch/year/period context;
- one primary action;
- backend-owned summary values;
- server filters and pagination for growing lists;
- honest empty/error/partial states;
- protected-file behavior;
- high-risk action separation;
- audit and evidence access;
- no Platform controls;
- accessible keyboard and responsive behavior.