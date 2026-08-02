# SchoolOS Teacher Web Wireframes

**Format:** Low-fidelity structural wireframes  
**Purpose:** Define hierarchy, density, interaction zones, and responsive behavior before visual implementation  
**Date:** 2026-08-02

---

## 1. Global Teacher shell

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SchoolOS │ School / AY 2083 │ Search my workspace │ Bell │ Teacher profile │
├────────────────────┬─────────────────────────────────────────────────────────┤
│ TODAY              │ Page title                           Context / actions  │
│  Today             │ Academic year / Class / Section / Subject / Role       │
│  My Schedule       ├─────────────────────────────────────────────────────────┤
│                    │                                                         │
│ MY TEACHING        │ Main work surface                                       │
│  My Homeroom*      │                                                         │
│  My Subjects       │                                                         │
│  My Students       │                                                         │
│  Attendance        │                                                         │
│  Homework          │                                                         │
│  Assessments       │                                                         │
│  Activities        │                                                         │
│  Class Reports     │                                                         │
│                    │                                                         │
│ COMMUNICATION      │                                                         │
│ RESOURCES          │                                                         │
│ MY WORKSPACE       │                                                         │
│ COORDINATION*      │                                                         │
└────────────────────┴─────────────────────────────────────────────────────────┘
* conditional
```

---

# Today and schedule

## WF-01 — Today

```text
┌ Today ───────────────────────────────────────── Updated 09:12 │ Refresh ┐
│ Current: Grade 6 B Mathematics 09:10–09:50  [Open class]              │
│ Next: Grade 5 A Homeroom 10:00–10:40                                  │
├───────────────────────────────────┬─────────────────────────────────────┤
│ PRIORITY QUEUE                    │ MY CLASSES TODAY                    │
│ 1 Mark Grade 5 A attendance      │ 09:10 6B Mathematics   In progress │
│ 2 Acknowledge urgent notice      │ 10:00 5A Homeroom      Pending     │
│ 3 Review 8 homework submissions  │ 11:20 6A Mathematics   Upcoming    │
│ 4 Marks due tomorrow             │                                     │
├───────────────────────────────────┼─────────────────────────────────────┤
│ STUDENT FOLLOW-UPS                │ NOTICES / SUBSTITUTIONS             │
│ 3 low attendance                 │ 1 urgent unread                     │
│ 2 missing homework               │ Cover Grade 7C at 13:00            │
└───────────────────────────────────┴─────────────────────────────────────┘
```

## WF-02 — My Schedule

```text
┌ My Schedule ─ Week 17–21 Shrawan ───────── [Today] [Print] ┐
│ Current period summary │ Next period │ Exam duty / substitutions       │
├───────┬────────────┬────────────┬────────────┬────────────┬─────────────┤
│ Time  │ Sunday     │ Monday     │ Tuesday    │ Wednesday  │ Thursday    │
├───────┼────────────┼────────────┼────────────┼────────────┼─────────────┤
│ 09:10 │ 6B Math    │ 5A Home    │ 6A Math    │ 6B Math    │ 5A Home     │
│       │ Room 203   │ Room 101   │ Room 204   │ Room 203   │ Room 101    │
├───────┼────────────┼────────────┼────────────┼────────────┼─────────────┤
│ ...   │            │            │            │            │             │
└───────┴────────────┴────────────┴────────────┴────────────┴─────────────┘
```

---

# Teaching context

## WF-03 — My Homeroom

```text
┌ My Homeroom — Grade 5 A ─────────────── [Open attendance] [Class notice] ┐
│ 36 Students │ 4 attendance follow-ups │ 2 subjects awaiting marks        │
├────────────────────────────────────┬──────────────────────────────────────┤
│ STUDENTS NEEDING ATTENTION         │ SUBJECT COMPLETION                   │
│ Name        Reason      Owner      │ English      Submitted              │
│ A. Thapa    Attendance  You        │ Mathematics  Draft                  │
│ S. Rai      Missing HW  Science    │ Science      Nothing reported       │
├────────────────────────────────────┼──────────────────────────────────────┤
│ HOMEWORK WORKLOAD                  │ NOTICE ACKNOWLEDGEMENT               │
│ Calendar / due-date density        │ Parent meeting: 31/36 acknowledged  │
├────────────────────────────────────┴──────────────────────────────────────┤
│ RESULT READINESS / CLASS TEACHER REMARKS                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-04 — My Subjects

```text
┌ My Subjects ───────────────────────────── [Academic year 2083] ┐
│ Subject       Class / Section  Scope       Next class   Work    Action    │
│ Mathematics   Grade 5 A       All comp.   Today 11:20  3 due   [Open]   │
│ Mathematics   Grade 6 A       Theory      Tomorrow     1 due   [Open]   │
│ Mathematics   Grade 6 B       Theory      Today 09:10  Clear   [Open]   │
│ Science       Grade 8 A       Practical   Wed 13:00    Marks   [Open]   │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-05 — My Students

```text
┌ My Students ─ [Subject Students] [My Homeroom*] ┐
│ Search… │ All my classes │ Subject │ Needs attention □ │ Sort           │
├──────┬─────────────────────┬──────────────┬───────────┬─────────┬────────┤
│ Roll │ Student             │ My context   │ Attendance│ Alerts  │ Action │
│ 01   │ Aarav Thapa         │ 6B Math      │ 92%       │ —       │ Open   │
│ 02   │ Samiksha Rai        │ 5A Homeroom  │ 76%       │ Medical │ Open   │
└──────┴─────────────────────┴──────────────┴───────────┴─────────┴────────┘
```

## WF-06 — Student detail

```text
┌ ← My Students │ Samiksha Rai │ Grade 5 A │ Class Teacher ┐
│ Photo  Roll 02  Approved safety alert  [Guardian contact]             │
│ [Overview] [Attendance] [My Subject] [Homework] [Observations] [Comms]│
├────────────────────────────────┬────────────────────────────────────────┤
│ ATTENDANCE                     │ CURRENT WORK                           │
│ 76% last 30 days               │ 2 homework items due                  │
│ 4 consecutive absences         │ Mathematics: no missing work          │
├────────────────────────────────┼────────────────────────────────────────┤
│ APPROVED CONTACTS              │ OBSERVATION / FOLLOW-UP                │
│ Guardian / emergency action    │ Recent Teacher-owned notes            │
└────────────────────────────────┴────────────────────────────────────────┘
```

---

# Attendance

## WF-07 — My Attendance overview

```text
┌ My Attendance ─────────────────────────────── [Mark next attendance] ┐
│ Pending today 2 │ Submitted 3 │ Offline drafts 1 │ Open corrections 1│
├──────────────────────────────────┬────────────────────────────────────┤
│ TODAY'S CONTEXTS                 │ CORRECTION STATUS                  │
│ 5A Homeroom      Pending [Mark]  │ 5A / R02  Pending review           │
│ 6B Mathematics   Submitted       │                                    │
│ 6A Mathematics   Opens 11:20     │                                    │
├──────────────────────────────────┼────────────────────────────────────┤
│ RECENT SUBMISSIONS               │ HOMEROOM FOLLOW-UP*                │
│ Date / class / state / totals    │ Students below threshold           │
└──────────────────────────────────┴────────────────────────────────────┘
```

## WF-08 — Homeroom attendance marking

```text
┌ Grade 5 A │ Homeroom daily │ 18 Shrawan │ Draft saved 09:48 ┐
│ [Mark all present] [Apply selected] [Save draft] [Submit]    │
├────┬────────────────────┬──────────────┬────────────┬─────────┤
│ □  │ Student            │ Status       │ Reason     │ Note    │
│ □  │ Aarav Thapa        │ P A L E      │ —          │         │
│ □  │ Samiksha Rai       │ P A L E      │ Select…    │         │
│ …  │                    │              │            │         │
└────┴────────────────────┴──────────────┴────────────┴─────────┘
│ 32 present │ 2 absent │ 1 late │ 1 unresolved reason           │
```

## WF-09 — Period attendance

```text
┌ Grade 6 B Mathematics │ Period 2 │ 09:10–09:50 │ Assigned Teacher ┐
│ Session closes 10:05 │ Substitution badge when applicable              │
├────┬──────────────────────┬────────────┬────────────────────────────────┤
│ #  │ Student              │ Status     │ Period note                    │
└────┴──────────────────────┴────────────┴────────────────────────────────┘
```

## WF-10 — Attendance history

```text
┌ Attendance History ─ Date range │ Assignment │ Mode │ State ┐
├────────────┬──────────────┬──────────┬──────────────┬─────────┬────────┤
│ Date       │ Context      │ Mode     │ Totals       │ State   │ Open   │
│ 18 Shrawan │ 5A Homeroom  │ Daily    │ 32/2/1      │ Sent    │ View   │
└────────────┴──────────────┴──────────┴──────────────┴─────────┴────────┘
```

## WF-11 — Monthly register

```text
┌ Monthly Register │ Grade 5 A │ Shrawan 2083 │ [Print] [Export] ┐
│ Student          │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ ... │ 30 │ Total   │
│ Aarav Thapa      │ P │ P │ A │ P │ P │ P │ ... │ P  │ 95%     │
│ Sticky names + horizontally scrollable daily cells                      │
└──────────────────────────────────────────────────────────────────────────┘
```

## WF-12 — My correction requests

```text
┌ Attendance Corrections ─ [My Requests] [Returned] [Resolved] [New] ┐
├──────────────┬───────────┬──────────┬───────────┬──────────┬───────────┤
│ Session      │ Student   │ Original │ Requested │ Status   │ Reviewer  │
│ 5A 18 Shr.   │ R02       │ Absent   │ Excused   │ Pending  │ Office    │
└──────────────┴───────────┴──────────┴───────────┴──────────┴───────────┘
```

## WF-13 — New attendance correction

```text
┌ New Correction Request ┐
│ 1 Select my submitted session                                           │
│ 2 Select student                                                        │
│ 3 Original record [read only]                                           │
│ 4 Requested status                                                      │
│ 5 Reason / evidence                                                     │
│ □ I understand the official record changes only after approval          │
│                                               [Cancel] [Submit request] │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-14 — Attendance reports

```text
┌ Assigned Attendance Reports ─ Report │ Context │ Dates │ [Run] ┐
├─────────────────────────────┬────────────────────────────────────────────┤
│ Report summary / chart      │ Student detail table                       │
│ Generated at / filters      │                                            │
└─────────────────────────────┴────────────────────────────────────────────┘
│ [Download PDF] [Download CSV]                                            │
```

---

# Homework

## WF-15 — Homework overview

```text
┌ Homework ─ [Today] [All] [Awaiting Review] [Completion] [Templates] ┐
│ Due today 4 │ Awaiting review 18 │ Drafts 3 │ Workload clashes 1     │
│ Search │ All my classes │ Subject │ Status │ Date                    │
├───────────────────────────┬──────────┬──────────┬──────────┬───────────┤
│ Homework                  │ Context  │ Due      │ Progress │ Action    │
└───────────────────────────┴──────────┴──────────┴──────────┴───────────┘
```

## WF-16 — Homework editor

```text
┌ Create Homework ─ [Subject homework] [Homeroom class task*] ┐
│ Assignment context                                                      │
│ Title / instructions                                                    │
│ Due date / submission method                                            │
│ Attachments                                                             │
│ Rubric / feedback rules                                                 │
│ Audience preview                                                        │
│                                      [Save draft] [Schedule] [Publish]  │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-17 — Homework detail

```text
┌ Homework title │ Grade 6 B Math │ Published │ Due 20 Shrawan ┐
│ Owner / audience / last updated                                        │
├─────────────────────────────────┬────────────────────────────────────────┤
│ Instructions & attachments      │ COMPLETION                             │
│ Version history                 │ 28 submitted / 4 missing               │
│ Reminder history                │ [Review submissions]                   │
└─────────────────────────────────┴────────────────────────────────────────┘
```

## WF-18 — Submission review

```text
┌ Grade 6 B Mathematics — Homework 14 ─ 8 remaining ┐
├────────────────────┬───────────────────────────────┬────────────────────┤
│ STUDENT QUEUE      │ SUBMISSION                    │ FEEDBACK           │
│ Aarav ✓            │ Text / files / timestamp      │ Rubric             │
│ Samiksha selected  │ Protected preview             │ Comment            │
│ ...                │                               │ [Resubmit] [Done]  │
└────────────────────┴───────────────────────────────┴────────────────────┘
```

## WF-19 — Templates

```text
┌ Homework Templates ─ Search │ Subject │ [New template] ┐
│ My templates                                                        │
│ Name             Subject    Last used    [Use] [Edit] [Archive]      │
│ School templates [read only]                                        │
└───────────────────────────────────────────────────────────────────────┘
```

## WF-20 — Completion analytics

```text
┌ Homework Completion │ Context │ Dates ┐
│ Completion 82% │ Late 9% │ Missing 9%                                  │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Trend / workload chart       │ Student completion table                 │
└──────────────────────────────┴──────────────────────────────────────────┘
```

---

# Assessments and marks

## WF-21 — My Assessments & Marks

```text
┌ My Assessments & Marks ────────────────────────────────────┐
│ Open 4 │ Draft 2 │ Missing 17 │ Returned 1 │ Due soon 2    │
│ Context │ Term │ State │ Deadline                              │
├─────────────────────┬────────────┬──────────┬────────┬─────────┤
│ Assessment          │ Context    │ Scope    │ State  │ Action  │
│ First Term          │ 6B Math    │ Theory   │ Draft  │ Enter   │
└─────────────────────┴────────────┴──────────┴────────┴─────────┘
```

## WF-22 — Assessment detail

```text
┌ First Term Mathematics │ Grade 6 B │ Theory │ Entry open ┐
│ Max 75 │ Pass 30 │ Deadline 22 Shrawan │ read-only config │
├─────────────────────────────────┬──────────────────────────────────────┤
│ Completion / missing students   │ Submission and correction timeline  │
└─────────────────────────────────┴──────────────────────────────────────┘
│ [Enter marks]                                                          │
```

## WF-23 — Marks grid

```text
┌ Grade 6 B Mathematics │ Theory │ Autosaved 10:22 │ [Validate] [Submit] ┐
├────┬──────────────────────┬────────┬────────┬─────────┬─────────────────┤
│ #  │ Student              │ Marks  │ Status │ Remark  │ Validation      │
│ 01 │ Aarav Thapa          │ 64     │ —      │         │ Valid           │
│ 02 │ Samiksha Rai         │        │ Absent │         │ Reason required │
└────┴──────────────────────┴────────┴────────┴─────────┴─────────────────┘
```

## WF-24 — CAS

```text
┌ CAS │ Grade 5 A │ Mathematics │ Assessment period ┐
├──────────────────────┬──────────────────────────┬──────────────────────┤
│ Criteria / rubric    │ Student entry table      │ Evidence / note      │
└──────────────────────┴──────────────────────────┴──────────────────────┘
```

## WF-25 — Submission status

```text
┌ Marks Submissions ─ [Draft] [Submitted] [Returned] [Accepted] [Locked] ┐
│ Assessment │ Context │ Submitted │ Reviewer │ Reason │ Next action       │
└──────────────────────────────────────────────────────────────────────────┘
```

## WF-26 — Corrections

```text
┌ Marks Corrections ─ [My requests] [Returned] [Resolved] ┐
│ Student │ Assessment │ Original │ Proposed │ Reason │ Status │ Open      │
└──────────────────────────────────────────────────────────────────────────┘
```

## WF-27 — Subject performance

```text
┌ Subject Performance │ Grade 6 B Math │ Assessment │ Component ┐
│ Distribution chart / outcome breakdown                                  │
├────────────────────────────────┬─────────────────────────────────────────┤
│ Trend over assigned group      │ Student result table                    │
└────────────────────────────────┴─────────────────────────────────────────┘
```

## WF-28 — Homeroom readiness

```text
┌ Grade 5 A Academic Readiness ─ [Submit homeroom readiness] ┐
│ Subject      Teacher        Marks state     Remarks     Action             │
│ English      R. Sharma      Submitted       Complete    View only          │
│ Science      P. Gurung      Missing         —           Request update     │
├───────────────────────────────────────────────────────────────────────────┤
│ Class Teacher remarks │ Students requiring coordination                  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

# Activities

## WF-29 — Activities

```text
┌ Activities ─ [Assigned Feed] [My Drafts] [Awaiting Review] [Gallery] [...] ┐
│ Context │ Category │ Status │ Month │ Search                                │
├──────────────────────────┬────────────┬──────────┬────────────┬──────────────┤
│ Activity                 │ Context    │ Owner    │ Status     │ Published    │
└──────────────────────────┴────────────┴──────────┴────────────┴──────────────┘
```

## WF-30 — Activity composer

```text
┌ New Activity ┐
│ Assignment context                                                      │
│ Story / title                                                            │
│ Student tags                                                             │
│ Media upload + processing                                                │
│ Consent result                                                          │
│ Observation / milestone relation                                        │
│ Audience preview                                                        │
│                              [Save draft] [Submit for review] [Publish*]│
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-31 — Activity detail

```text
┌ Activity title │ Grade 5 A │ Created by you │ Awaiting review ┐
├───────────────────────────────────┬───────────────────────────────────────┤
│ Story / protected media           │ Consent / audience / tagged students │
│                                   │ Moderation timeline                  │
└───────────────────────────────────┴───────────────────────────────────────┘
```

## WF-32 — Gallery

```text
┌ Activity Gallery │ Context │ My uploads / Assigned media │ State ┐
│ [List] [Grid]                                                             │
│ Media preview │ Activity │ Consent │ Processing │ Owner │ Open             │
└────────────────────────────────────────────────────────────────────────────┘
```

## WF-33 — Observations and milestones

```text
┌ Observations │ Assigned student │ Date │ Type │ [New observation] ┐
│ Student │ Context │ Supportive note │ Visibility │ Status │ Open      │
└───────────────────────────────────────────────────────────────────────┘
```

---

# Communication

## WF-34 — Notices

```text
┌ Notices ─ [Received] [Acknowledgement Required] [My Drafts] [Submitted] ┐
│ Urgent unread 1 │ My drafts 2 │ Awaiting approval 1                      │
│ Title │ Scope │ Priority │ Lifecycle │ Date │ Acknowledgement │ Open     │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-35 — Notice composer

```text
┌ New Notice ┐
│ Teaching context: [Grade 5 A Homeroom ▼]                                │
│ Derived audience: Guardians of active Grade 5 A students                │
│ Title / body / translation                                               │
│ Category / priority / acknowledgement                                    │
│ Attachment                                                               │
│ Recipient preview: 36 guardians, 2 unavailable                           │
│                                      [Save draft] [Submit for approval] │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-36 — Notice detail

```text
┌ Notice title │ Submitted for approval │ Grade 5 A guardians ┐
├───────────────────────────────────┬──────────────────────────────────────┤
│ Body / attachment                 │ Lifecycle timeline                  │
│                                   │ Recipient / acknowledgement status │
└───────────────────────────────────┴──────────────────────────────────────┘
```

## WF-37 — Notifications

```text
┌ Notifications ─ [Unread] [All] │ Type │ Context │ Preferences ┐
│ ● Attendance reminder      Grade 5 A      09:02     [Open]      │
│ ● Urgent notice            School         08:30     [Acknowledge]│
│   Homework reviewed        Grade 6 B      Yesterday [Open]      │
└──────────────────────────────────────────────────────────────────┘
```

---

# Reports

## WF-38 — Class Reports hub

```text
┌ Class Reports ┐
│ Attendance          Assigned classes only         [Open]              │
│ Homework completion Subject / homeroom             [Open]              │
│ Subject performance Subjects you teach             [Open]              │
│ Marks completion    Homeroom / own submissions     [Open]              │
│ Follow-up list       Homeroom                       [Open]              │
└─────────────────────────────────────────────────────────────────────────┘
```

## WF-39 to WF-43 — Report workspace pattern

```text
┌ Report name │ Assignment │ Date/term │ Filters │ [Run] ┐
│ Generated at / exact scope / data status                                │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Chart / summary              │ Detailed assignment-scoped table        │
└──────────────────────────────┴──────────────────────────────────────────┘
│ [Protected PDF] [CSV when allowed]                                      │
```

Each report changes its summary and table fields but retains the same scope and export evidence.

---

# Library and Learning

## WF-44 — Teacher Library

```text
┌ Library ─ [My Loans] [Catalogue] [Reservations] [Reading Lists] [Requests] ┐
│ Books out 3 │ Due soon 1 │ Overdue 0 │ Reservation ready 1                 │
│ Main list / search                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## WF-45 — Reading Lists

```text
┌ Reading Lists │ Context │ [New list] ┐
│ List name │ Grade/subject │ Items │ Published │ [Open] [Print]          │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-46 — Learning overview

```text
┌ Learning ─ [My Activities] [Sessions] [Attempts] [Progress] [Resources] ┐
│ Assignment │ Activity │ State │ Participation │ Next action              │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-47 — Learning activity editor

```text
┌ New Learning Activity ┐
│ Assignment / objective / instructions / resources / session rules         │
│ Accessibility check / audience preview                                    │
│                                              [Save draft] [Publish]       │
└────────────────────────────────────────────────────────────────────────────┘
```

## WF-48 — Session and attempts

```text
┌ Session title │ Live / Closed │ Access code │ [End session] ┐
├────────────────────────────┬─────────────────────────────────────────────┤
│ Participants / attempts    │ Selected response / feedback               │
└────────────────────────────┴─────────────────────────────────────────────┘
```

---

# My Workspace

## WF-49 — My Workspace overview

```text
┌ My Workspace ┐
│ Employment status │ Today attendance │ Leave balance │ Latest payslip      │
├──────────────────────────────────┬────────────────────────────────────────┤
│ EMPLOYMENT SUMMARY               │ PENDING ACTIONS                        │
│ Designation / department         │ Leave request pending                  │
│ Contract status                  │ Attendance correction returned         │
├──────────────────────────────────┼────────────────────────────────────────┤
│ RECENT EMPLOYMENT TIMELINE       │ QUICK ACTIONS                          │
│                                  │ Request leave / attendance correction  │
└──────────────────────────────────┴────────────────────────────────────────┘
```

## WF-50 — My staff attendance

```text
┌ My Attendance │ Shrawan 2083 │ [Request correction] ┐
│ Calendar with present / late / leave / missing states                   │
│ Summary │ Correction requests                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-51 — Leave

```text
┌ Leave ─ [Balance] [My Requests] [New Request] ┐
│ Leave type balances                                                  │
│ Request form / history / approval timeline                           │
└──────────────────────────────────────────────────────────────────────┘
```

## WF-52 — Payslips

```text
┌ Payslips ┐
│ Period │ Gross │ Deductions │ Net │ Status │ [View] [Download PDF]      │
└────────────────────────────────────────────────────────────────────────┘
```

## WF-53 — Contracts & documents

```text
┌ Contracts & Documents ─ [Contract] [Qualifications] [Documents] ┐
│ Current summary / history / expiry / protected downloads               │
└─────────────────────────────────────────────────────────────────────────┘
```

## WF-54 — Profile / preferences / security

```text
┌ Personal Settings ─ [Profile] [Preferences] [Security] ┐
│ Focused form for one domain                                            │
│ Active sessions / password / notification channels / accessibility    │
└────────────────────────────────────────────────────────────────────────┘
```

---

# Delegated coordination

## WF-55 — Coordination overview

```text
┌ Coordination ┐
│ Capability          Scope             Granted by     Expires      Queue │
│ Timetable Admin     School AY 2083    Principal      30 Bhadra    4     │
│ Activity Moderator  Grade 1–8         Admin          No expiry    7     │
│ [Open workspace] [View grant evidence]                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-56 — Timetable coordination

```text
┌ Acting as Timetable Coordinator │ Scope / expiry │ [Return to Teacher] ┐
│ Versions │ Builder │ Requirements │ Conflicts │ Workload │ Publish       │
│ Existing full operational timetable surface with persistent delegation  │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-57 — Substitution coordination

```text
┌ Substitutions │ Date │ Uncovered / Assigned / Completed ┐
│ Absent Teacher │ Class │ Period │ Eligible substitute │ Conflict │ Action│
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-58 — Exam coordination

```text
┌ Acting as Exam Coordinator ┐
│ Terms │ Components │ Entry windows │ Submission progress │ Returned work │
└───────────────────────────────────────────────────────────────────────────┘
```

## WF-59 — Activity moderation

```text
┌ Activity Moderation │ Pending 7 ┐
├───────────────────────────────┬──────────────────────────────────────────┤
│ Queue                         │ Media / consent / audience / author      │
│ Selected post                 │ [Approve] [Return] [Reject] + reason     │
└───────────────────────────────┴──────────────────────────────────────────┘
```

## WF-60 — Teacher-Librarian desk

```text
┌ Acting as Library Operator │ Delegation scope / expiry ┐
│ Overview │ Catalogue │ Copies │ Issue/Return │ Borrowers │ Fines │ Reports│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Narrow viewport pattern

```text
┌ Top app bar: page title / context / menu ┐
│ Context chips horizontally scroll        │
│ Primary action full width                │
├───────────────────────────────────────────┤
│ Priority list / selected work surface     │
│ Tables become semantic stacked rows       │
│ Secondary detail opens bottom drawer      │
└───────────────────────────────────────────┘
```

Marks and monthly-register grids remain horizontal data grids rather than converting into cards.

---

## 3. Shared state wireframes

### No active assignment

```text
┌ No active teaching assignment ┐
│ No class, section, or subject is currently assigned to your staff record.│
│ Contact the academic coordinator if this is unexpected.                  │
│ [Open My Workspace]                                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

### Assignment ended while open

```text
┌ Assignment ended ┐
│ This page is no longer editable because the assignment has ended.        │
│ Unsynced local work is retained as read-only evidence.                    │
│ [Return to Today]                                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

### Module unavailable

```text
┌ Module unavailable for this school ┐
│ The module is not enabled, so no data or action is available here.       │
└───────────────────────────────────────────────────────────────────────────┘
```

### Offline draft

```text
┌ Offline — draft saved on this device ┐
│ Last server sync 09:02 │ Operation ID ... │ [Retry when online]          │
└───────────────────────────────────────────────────────────────────────────┘
```

### Partial data

```text
┌ Some information is unavailable ┐
│ Attendance loaded. Homework could not be reached. Missing values are not │
│ displayed as zero. [Retry Homework]                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

### Restricted direct route

```text
┌ This workspace is managed by the school office ┐
│ Your Teacher account does not have this delegated capability.            │
│ Returning to the nearest valid Teacher page.                             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 4. High-risk Teacher submission pattern

Used for attendance submit, marks submit, notice submission, activity publication, and homeroom readiness.

```text
Review scope
→ Review counts / missing information
→ Confirm workflow impact
→ Provide reason where required
→ Submit
→ Show immutable reference and resulting state
```

Wireframe:

```text
┌ Confirm submission ┐
│ Context: Grade 6 B Mathematics — First Term Theory                      │
│ 34 complete │ 1 absent with reason │ 1 missing                          │
│ After submission, marks become read-only unless returned.               │
│ [Cancel] [Submit marks]                                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Final wireframe rule

```text
A Teacher screen must never require the user to infer whether a record is
Teacher-owned, homeroom-visible, subject-scoped, temporary, or delegated.

The context and authority must be visible in the page structure itself.
```
