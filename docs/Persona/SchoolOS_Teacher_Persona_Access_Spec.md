# SchoolOS Teacher Persona — Complete Access, Module, Web, Mobile, and Workflow Specification

**Document type:** Product Requirements + Functional Access Specification  
**Persona:** Teacher  
**Applies to:** SchoolOS Web, SchoolOS Mobile, Backend APIs, Offline Sync, Reports, Notifications, and RBAC  
**Status:** Recommended canonical design  
**Audience:** Product, Backend, Web, Mobile, QA, Security, UX, School Operations  
**Version:** 1.0  
**Date:** 2026-07-19

---

# 1. Purpose

This document defines the complete SchoolOS experience for the **Teacher persona**.

It specifies:

- What a Teacher is allowed to access
- How Class Teacher and Subject Teacher responsibilities coexist
- Which SchoolOS modules are available to Teachers
- Which features are available on web
- Which features are available on mobile
- Which features are available on both
- Which features must remain hidden
- How assignments, grading, attendance, homework, reports, communication, and student data must be scoped
- Required backend authorization rules
- Required offline and mobile security behavior
- Recommended navigation, workflows, permissions, and implementation priorities

The goal is to provide Teachers with a fast, modern, task-focused workspace without exposing unrelated school, financial, administrative, or student data.

---

# 2. Core Product Decision

SchoolOS should use one base system role:

```text
TEACHER
```

A Teacher receives operational authority through one or more active academic assignments:

```text
CLASS_TEACHER
SUBJECT_TEACHER
ASSISTANT_TEACHER
SUBSTITUTE_TEACHER
EXAM_INVIGILATOR
COORDINATOR
```

Class Teacher and Subject Teacher are **not mutually exclusive user roles**.

A single Teacher may be:

```text
Class Teacher — Class 5A

Subject Teacher:
- Mathematics — Class 5A
- Mathematics — Class 6A
- Mathematics — Class 6B
```

The Teacher's effective authority is:

```text
Base Teacher Access
+ Active Class Teacher Assignments
+ Active Subject Teacher Assignments
+ Approved Temporary Delegations
```

---

# 3. Non-Negotiable Security Rule

A Teacher must never receive school-wide access simply because they have the `TEACHER` role.

Every Teacher operation must be scoped by:

```text
Tenant
+ Academic Year
+ Active Staff Identity
+ Active Assignment
+ Class
+ Section
+ Subject, where required
+ Assessment or workflow
+ Action
+ Record ownership or delegation
```

## 3.1 Primary invariant

> No active assignment means no data access.

This rule applies to:

- Navigation
- Class and subject selectors
- Search
- Student lists
- Attendance
- Homework
- Assignments
- Marks
- Examinations
- Reports
- Guardian contacts
- Activity feeds
- Notifications
- Exports
- Attachments
- Offline cache
- Push-notification payloads
- Direct API requests
- Bulk imports
- Scheduled jobs

## 3.2 Unauthorized access behavior

When a Teacher requests data outside their assigned scope, SchoolOS must:

- Return `403 Forbidden`
- Avoid revealing whether the unrelated record exists
- Record an auditable authorization failure where appropriate
- Avoid returning partial unrelated data
- Avoid relying on frontend hiding alone

---

# 4. Teacher Assignment Model

## 4.1 Base Teacher identity

The base Teacher identity grants only self-service and general school participation capabilities.

```text
User
└── Staff
    └── Teacher
```

Base Teacher access includes:

- Authentication
- Own profile
- Own timetable
- Own attendance
- Own leave
- Own payslips
- Relevant notices
- Relevant notifications
- Public school information
- Personal security and preferences

Base Teacher access does **not** grant academic access to all classes.

---

## 4.2 Class Teacher assignment

A Class Teacher assignment provides homeroom coordination and student oversight for one specific class and section.

Example:

```text
Teacher: Mina Gautam
Academic Year: 2083
Assignment Type: CLASS_TEACHER
Class: Grade 5
Section: A
Effective From: 2026-04-15
Effective Until: 2027-03-31
Status: ACTIVE
```

Class Teacher authority applies only to that class-section.

---

## 4.3 Subject Teacher assignment

A Subject Teacher assignment provides teaching, homework, assessment, and grading authority for one exact class-section-subject combination.

Example:

```text
Teacher: Mina Gautam
Academic Year: 2083
Assignment Type: SUBJECT_TEACHER
Class: Grade 6
Section: B
Subject: Mathematics
Status: ACTIVE
```

Subject Teacher authority does not grant access to other subjects in the same class.

---

## 4.4 Recommended assignment entity

```ts
TeacherAssignment {
  id
  tenantId
  academicYearId
  staffId

  assignmentType
  // CLASS_TEACHER
  // SUBJECT_TEACHER
  // ASSISTANT_TEACHER
  // SUBSTITUTE_TEACHER
  // EXAM_INVIGILATOR
  // COORDINATOR

  classId
  sectionId
  subjectId?

  componentScope?
  // THEORY
  // PRACTICAL
  // INTERNAL
  // PROJECT
  // ALL_COMPONENTS

  isPrimary
  effectiveFrom
  effectiveUntil
  status

  createdBy
  createdAt
  updatedAt
}
```

## 4.5 Validation rules

For `CLASS_TEACHER`:

```text
classId required
sectionId required
subjectId must be null
```

For `SUBJECT_TEACHER`:

```text
classId required
sectionId required
subjectId required
```

---

# 5. Combined Class Teacher and Subject Teacher Behavior

Consider this Teacher:

```text
Class Teacher:
- Class 5A

Subject Teacher:
- Mathematics — Class 5A
- Mathematics — Class 6A
- Mathematics — Class 6B
```

## 5.1 Class 5A access

Because the Teacher is Class Teacher of Class 5A, they may:

- View the full Class 5A roster
- Mark homeroom attendance
- View overall attendance
- View class-level academic summaries
- View homework completion across subjects
- View class-level communication status
- Add Class Teacher remarks
- Add general observations
- Coordinate result readiness
- Contact assigned guardians through approved channels

Because they also teach Mathematics in Class 5A, they may:

- Create Mathematics homework
- Review Mathematics submissions
- Enter Mathematics marks
- Grade Mathematics tests and examinations
- View Mathematics performance

They may not grade English, Science, Nepali, Social Studies, or another subject unless separately assigned.

## 5.2 Class 6A and 6B access

Because the Teacher is only the Mathematics Subject Teacher, they may:

- View students required for Mathematics teaching
- Create Mathematics homework
- Review Mathematics submissions
- Enter Mathematics marks
- View Mathematics-specific performance
- Send Mathematics-related communication
- Mark period attendance only if enabled

They may not:

- View unrelated subject marks
- View full pastoral records
- Add Class Teacher report-card remarks
- Manage general class attendance
- View unrelated parent communications
- View sensitive homeroom-only information

## 5.3 Unassigned classes

For any unassigned class:

```text
No navigation
No selector option
No search result
No API access
No report access
No export access
No cached data
No notification content
```

---

# 6. Homework and Assignment Rules

## 6.1 Subject homework

A Teacher may create homework only for subjects they actively teach.

Required match:

```text
Academic Year
+ Teacher
+ Class
+ Section
+ Subject
```

Example:

```text
Allowed:
- Mathematics homework — Class 5A
- Mathematics homework — Class 6A
- Mathematics homework — Class 6B

Not allowed:
- English homework — Class 5A
- Science homework — Class 5A
- Mathematics homework — Class 5B
- Any homework for an unassigned class
```

Being the Class Teacher does not grant authority to create subject homework for all subjects.

## 6.2 Class tasks

A Class Teacher may create non-subject homeroom tasks.

Recommended categories:

```ts
enum AssignmentCategory {
  SUBJECT_HOMEWORK
  CLASS_TASK
}
```

Examples of `CLASS_TASK`:

- Bring passport-size photographs
- Submit consent forms
- Prepare for parent-teacher meeting
- Bring sports uniform
- Bring project materials
- Submit administrative documents

Rules:

```text
SUBJECT_HOMEWORK
→ active subject assignment required
→ subjectId required

CLASS_TASK
→ active class-teacher assignment required
→ subjectId must be null
```

## 6.3 Homework ownership

| Action | Required authority |
|---|---|
| Create homework | Matching active subject assignment |
| Save draft | Matching assignment |
| Edit draft | Matching assignment + owner |
| Publish | Matching assignment + owner |
| Review submissions | Matching subject assignment |
| Send reminders | Matching subject assignment |
| Delete draft | Owner |
| Cancel published homework | Owner or authorized academic admin |
| Edit another Teacher's homework | Explicit delegation only |

---

# 7. Grading and Examination Rules

## 7.1 Core grading invariant

> A Teacher may grade only the subjects they are actively assigned to teach.

This applies to every type of assessment:

- Class tests
- Unit tests
- Weekly tests
- Monthly tests
- Terminal examinations
- Mid-term examinations
- Final examinations
- Pre-board examinations
- Practical examinations
- Projects
- Assignments
- Continuous Assessment System records
- Oral assessments
- Internal assessments
- External assessment entries

## 7.2 Required grading scope

```text
Tenant
+ Academic Year
+ Teacher
+ Class
+ Section
+ Subject
+ Assessment
+ Assessment Component
```

## 7.3 Class Teacher restriction

A Class Teacher may:

- View mark-entry completion across subjects
- Identify missing-subject submissions
- View overall class summaries
- Add Class Teacher remarks
- Add conduct and general-development remarks
- Request correction from the responsible Subject Teacher
- Submit class result readiness for review

A Class Teacher may not:

- Enter another Teacher's subject marks
- Modify another Teacher's marks
- Approve marks on behalf of a Subject Teacher
- Unlock marks
- Override practical or theory marks
- Publish final results

## 7.4 Subject Teacher grading rights

A Subject Teacher may:

- View configured assessments for their subject
- Enter theory marks when assigned
- Enter practical marks when assigned
- Enter project marks when assigned
- Enter internal assessment or CAS marks
- Save drafts
- Validate missing marks
- Submit marks
- Correct marks while the entry window is open
- Request correction after submission
- Add subject remarks
- View subject performance

They may not:

- Grade another subject
- Grade another section without assignment
- Change grade scales
- Change maximum marks
- Change pass marks
- Create exam terms unless separately authorized
- Unlock approved marks
- Publish results
- Approve their own final correction

## 7.5 Component-level authority

A subject may have different evaluators.

Example:

```text
Science — Class 8A

Theory Teacher:
- THEORY component

Practical Teacher:
- PRACTICAL component
```

A Teacher assigned only to `PRACTICAL` must not edit `THEORY`.

## 7.6 Recommended grade workflow

```text
CONFIGURED
→ ENTRY_OPEN
→ DRAFT
→ SUBMITTED
→ REVIEWED
→ APPROVED
→ PUBLISHED
→ LOCKED
```

| State | Subject Teacher | Class Teacher | Academic Admin |
|---|---|---|---|
| Entry Open | Enter assigned marks | View completion | Manage window |
| Draft | Edit own marks | View status | View |
| Submitted | Read-only unless returned | View completion | Review or return |
| Approved | Read-only | Read-only summary | Approve |
| Published | Read-only | View result | Publish |
| Locked | Correction request only | No editing | Controlled correction |

---

# 8. Teacher Access by SchoolOS Module

## Access categories

| Access level | Meaning |
|---|---|
| Scoped operational access | Teaching actions within assigned scope |
| Limited read-only access | Minimal information required for teaching or safety |
| Self-service only | Teacher's own employee or account data |
| Hidden | No Teacher workspace or data access |
| Deferred | Not active in current Teacher product |

---

## M0 — Platform Core

### Access level

```text
SELF-SERVICE ONLY
```

### Teacher features

- Login
- Logout
- Forgot password
- Change password
- Own active sessions
- Revoke own sessions
- Language
- Appearance
- Notification preferences
- Public school information
- Enabled Teacher-facing modules
- Own protected-file access through permitted workflows

### No Teacher access

- Tenant management
- Subscription and plans
- Module entitlement management
- User creation
- User suspension
- Password reset for others
- Role management
- Permission management
- School configuration
- Providers
- Queues
- API keys
- Platform health
- Audit administration
- Support override
- Backup administration
- File Registry administration

---

## M1 — Admissions and Student Profiles

### Access level

```text
ASSIGNED-STUDENT PROJECTION ONLY
```

Teachers do not receive the Admissions workspace.

### Every Teacher may see for assigned teaching groups

- Student name
- Student photograph
- Roll number
- Class and section
- Basic contact data
- Approved guardian contact
- Emergency contact
- Approved accommodation
- Approved safety or care alert
- Relevant attendance summary
- Teacher-owned academic records

### Additional Class Teacher access

- Full assigned homeroom roster
- Overall attendance summary
- General academic summary
- Homework completion across subjects
- Guardian communication history
- Approved intervention notes
- Student lifecycle status

### No Teacher access

- Admission applications
- Admission approval or rejection
- Duplicate merge
- Enrollment creation
- Student deletion
- Transfer approval
- Full medical documents
- Guardian identity documents
- Financial documents
- Document verification
- iEMIS administration
- Student ID generation
- Unassigned students

---

## M2 — Smart Attendance

### Access level

```text
FULL ASSIGNMENT-SCOPED ACCESS
```

### Class Teacher features

- Homeroom attendance
- Present, absent, late, leave, activity status
- Attendance remarks
- Draft save
- Offline attendance
- Sync
- Attendance history
- Consecutive-absence alerts
- Correction requests
- Guardian follow-up
- Assigned-class attendance reports

### Subject Teacher features

- Read attendance for assigned period
- Period attendance where enabled
- Correct records they created through workflow

### No Teacher access

- Unassigned classes
- School-wide attendance
- Staff attendance administration
- Lock override
- Approval of own correction
- Policy configuration
- Deleting official sessions
- Editing locked attendance directly

### Supported modes

```text
HOMEROOM_DAILY
PERIOD_BASED
HYBRID
```

---

## M3 — Fees and Receipts

### Access level

```text
HIDDEN
```

### No Teacher access

- Fee plans
- Invoices
- Balances
- Discounts
- Waivers
- Payments
- Receipts
- Refunds
- Reversals
- Cashier close
- Family payment history
- Financial exports

Optional non-financial indicator:

```text
Office follow-up required
```

This should expose no amount or payment detail.

---

## M4 — Academics, Exams, CAS, and Report Cards

### Access level

```text
FULL ASSIGNMENT-SCOPED ACCESS
```

### Subject Teacher features

- Assigned subjects
- Assigned assessments
- Theory marks
- Practical marks
- Project marks
- Internal assessment
- CAS entry
- Draft save
- Missing-mark validation
- Submit marks
- Correction request
- Subject remarks
- Subject analytics
- Own completion status

### Class Teacher features

- Overall completion status
- Missing-subject status
- Class performance summary
- Result readiness
- Class Teacher remarks
- Conduct remarks
- Student support flags
- Submit class readiness

### No Teacher access

- Academic-year creation
- Subject-master configuration
- Exam-term creation
- Assessment-policy configuration
- Grade-scale configuration
- Mark unlock
- Another Teacher's grading
- Result approval
- Result publication
- Promotion decisions
- Report-card template configuration

---

## M5 — Activity Feed and Milestones

### Access level

```text
ASSIGNED-CLASS + OWNERSHIP-SCOPED ACCESS
```

### Teacher features

- Create assigned-class activities
- Add subject activities
- Upload approved media
- Tag assigned students
- Record learning observations
- Record milestones
- Save drafts
- Edit own permitted posts
- View consent state
- Select approved audiences
- Submit sensitive posts for moderation

### Class Teacher additions

- Homeroom updates
- Class celebrations
- General observations
- Parent-facing class updates

### No Teacher access

- School-wide moderation
- Bypass consent
- Edit another Teacher's post
- View all school media
- Change retention
- Post about unassigned students

---

## M6 — Homework and Timetable

### Access level

```text
FULL ASSIGNMENT-SCOPED ACCESS
```

### Homework features

- Assigned-subject homework
- Class tasks for assigned homeroom
- Draft
- Publish
- Schedule
- Attachments
- Due dates
- Review submissions
- Add feedback
- Grade homework for own subject
- Request resubmission
- Reminders
- Completion analytics
- Own templates

### Timetable features

- Personal timetable
- Assigned-class timetable
- Room
- Substitutions
- Exam-duty schedule
- Schedule changes

### No Teacher access

- Timetable generation
- Workload allocation
- Room configuration
- Version publication
- Conflict override
- Another Teacher's homework
- Unassigned subjects
- Unassigned classes

---

## M7 — HR and Payroll

### Access level

```text
SELF-SERVICE ONLY
```

### Teacher features

- Own profile
- Own attendance
- Own attendance correction request
- Leave request
- Leave balance
- Leave history
- Leave status
- Own payslips
- Own contract summary where permitted
- Own workload summary

### No Teacher access

- Other staff
- Other staff attendance
- Staff creation
- Staff termination
- Contract administration
- Leave approval
- Salary structures
- Payroll runs
- Payroll approval
- Payroll posting
- Other staff payslips
- Bank data
- PAN reports
- HR reports

---

## M8 — Library

### Access level

```text
LIMITED TEACHER-BORROWER ACCESS
```

### Teacher features

- Search catalogue
- View availability
- Reserve books
- View own borrowed items
- View own due dates
- View own fines
- Request teaching resources
- Recommend reading
- Create assigned-class reading lists
- Receive due reminders

### No Teacher access

- Catalogue administration
- Copy administration
- Stock adjustment
- Fine waiver
- Library settings
- Label administration
- School-wide reports
- Other users' full borrowing history
- Book disposal

---

## M9 — Transport

### Access level

```text
CONTEXTUAL SAFETY ALERTS ONLY
```

### Teacher may receive

- Relevant delay affecting assigned students
- Emergency route alert
- Dismissal or boarding concern
- Approved dismissal arrangement
- Contact-office action

### No Teacher workspace

- Routes
- Stops
- Vehicles
- Drivers
- GPS tracking
- All transport enrollments
- Trip operation
- Transport reports

---

## M10 — Canteen

### Access level

```text
CONTEXTUAL SAFETY INFORMATION ONLY
```

### Teacher may receive

- Allergy warning
- Dietary restriction
- Canteen closure
- Meal-service issue
- Meal-supervision instruction

### No Teacher access

- Wallets
- POS
- Balances
- Transactions
- Menu administration
- Stock
- Vendors
- Procurement
- Serving administration
- Financial reports

---

## M11 — Accounting and Finance

### Access level

```text
HIDDEN
```

### No Teacher access

- Chart of accounts
- Journals
- Vouchers
- Fiscal periods
- Fiscal locks
- Bank reconciliation
- Trial balance
- General ledger
- Cash book
- Income statement
- Balance sheet
- Tax summaries
- Accounting exports

---

## M12 — Notifications and Delivery

### Access level

```text
PERSONAL INBOX + SCOPED COMMUNICATION STATUS
```

### Teacher features

- Own notification inbox
- Mark read
- Unread count
- Personal preferences
- Push registration
- Relevant attendance alerts
- Relevant homework alerts
- Relevant timetable alerts
- Relevant notice alerts
- Delivery status for own authorized communications

### No Teacher access

- Provider configuration
- SMS/email credentials
- Delivery queues
- Tenant-wide retries
- Callback diagnostics
- Template administration
- Quiet-hours policy administration
- Other users' preferences
- Tenant-wide delivery diagnostics
- Recipient-rule management

---

## M13 — Learning Layer

### Access level

```text
CURRENTLY DISABLED
FUTURE ASSIGNMENT-SCOPED ACCESS
```

When formally enabled:

- Create activities for assigned subjects
- Upload resources
- Launch sessions
- View attempts
- Review responses
- View assigned progress
- Edit own content
- Reuse own resources

No access to:

- Unassigned subjects
- Another Teacher's content
- School-wide progress
- Entitlement configuration
- Parent summaries outside scope
- Platform learning analytics

---

## M14 — Intelligence / AI

### Access level

```text
DEFERRED
```

Possible future Teacher assistance:

- Draft lesson resources
- Suggest homework questions
- Summarize assigned-class performance
- Identify missing work
- Suggest interventions
- Draft parent communication

AI must not:

- Automatically change official marks
- Automatically publish results
- Make disciplinary decisions
- Diagnose students
- Access unrelated student data
- Operate without Teacher review
- Generate high-stakes actions without approval

---

## M15 — Notices and Announcements

### Access level

```text
READ + ASSIGNMENT-SCOPED DRAFTING
```

### Every Teacher

- Read relevant notices
- View protected attachments
- Acknowledge mandatory notices
- View relevant events
- Search relevant history

### Class Teacher

- Draft homeroom notices
- Parent meeting reminders
- Class-event reminders
- Request class announcement publication
- View class acknowledgement status

### Subject Teacher

- Draft subject notices
- Assessment reminders
- Subject-resource notices
- Assigned-group reminders

### No Teacher access

- Arbitrary recipient selection
- School-wide publication
- Emergency broadcast without delegation
- Bypass approval
- Cancel another author's notice
- Tenant-wide diagnostics
- Notice policy management
- Template administration
- Administrative archive restore

Recommended lifecycle:

```text
DRAFT
→ APPROVAL_PENDING
→ APPROVED
→ SCHEDULED
→ PUBLISHED
→ EXPIRED
→ ARCHIVED
```

---

# 9. Web, Mobile, and Shared Feature Strategy

## 9.1 Product principle

```text
Web:
Detailed work, bulk operations, review, reports, printing, and complex workflows

Mobile:
Immediate classroom actions, offline work, camera/QR, push, and quick communication

Both:
Core teaching workflows that may start on one device and continue on another
```

---

# 10. Features Available on Both Web and Mobile

## 10.1 Home / Today

- Current class
- Next class
- Personal timetable
- Pending attendance
- Homework awaiting review
- Marks deadlines
- Substitutions
- Unread notices
- Assigned classes
- Assigned subjects
- Student follow-up alerts
- Sync or last-updated status

Web provides broader summaries.

Mobile prioritizes current and next actions.

---

## 10.2 Assigned Classes and Students

- Assigned homerooms
- Assigned subject groups
- Assigned roster
- Search assigned students
- Student photo
- Roll number
- Approved guardian contact
- Safety alerts
- Attendance summary
- Teacher-owned academic information
- Assignment-relevant homework summary

Web provides detailed history, filtering, printing, and comparison.

Mobile provides quick lookup, current-class roster, quick contact, and observation actions.

---

## 10.3 Attendance

Both platforms support:

- Assigned attendance contexts
- Mark attendance
- Save drafts
- Submit attendance
- Attendance history
- Remarks
- Correction request
- Correction status

Web specializes in:

- Registers
- Date filters
- Reports
- Historical audit
- Printing

Mobile specializes in:

- Current-period attendance
- Mark all present
- Quick exceptions
- Offline drafts
- Sync
- Quick guardian follow-up

---

## 10.4 Homework

Both platforms support:

- Create assigned-subject homework
- Class tasks for assigned homeroom
- Save draft
- Publish
- Due date
- Attachments
- Review submissions
- Feedback
- Resubmission
- Reminder
- Completion status

Web specializes in:

- Templates
- Recurrence
- Bulk review
- Rubrics
- Large attachments
- Detailed analytics
- Archive management

Mobile specializes in:

- Quick homework
- Camera capture
- Board photo
- Voice-to-text
- Quick feedback
- Offline drafts

---

## 10.5 Timetable

Both platforms support:

- Personal timetable
- Assigned-class timetable
- Current period
- Next period
- Room
- Substitution
- Exam duty
- Changes

Web:

- Weekly/monthly views
- Print
- Detailed workload

Mobile:

- Today view
- Push alert
- Offline cached timetable
- Current-period shortcut

---

## 10.6 Activities and Observations

Both:

- Create scoped activity
- Add observation
- Tag assigned students
- Save draft
- Select audience
- Edit own content
- View consent

Web:

- Detailed writing
- Multi-student tagging
- Historical review
- Moderation queue
- Attachment organization

Mobile:

- Camera
- Video/photo
- Quick observation
- Offline draft
- Immediate milestone capture

---

## 10.7 Notices and Notifications

Both:

- Read relevant notices
- Open protected attachments
- Acknowledge
- Notification inbox
- Mark read
- Preferences
- Relevant alerts

Web:

- Detailed notice drafting
- Recipient preview
- Scheduling
- Approval submission
- Acknowledgement report
- Delivery summary

Mobile:

- Push
- One-tap acknowledgement
- Quick reminder draft
- Deep links
- Device notification preferences

---

## 10.8 Staff Self-Service

Both:

- Own profile
- Own attendance
- Leave request
- Leave history
- Leave balance
- Own payslip
- Password
- Sessions

Web:

- Detailed history
- Print payslip
- Contract summary
- Document review

Mobile:

- Quick leave request
- Status push
- Recent payslip
- Biometric unlock

---

# 11. Web-Only or Web-Primary Teacher Features

These features should remain web-only or strongly web-first because they involve dense tables, bulk data, review, printing, or complex context.

## 11.1 Official marks and assessment workspace

- Spreadsheet-style marks grid
- Bulk marks entry
- Theory/practical/internal/project components
- Large-class validation
- CAS entry
- Detailed grading rubric
- Assessment submission
- Missing marks dashboard
- Import from approved template
- Export
- Print result sheet
- Report-card preview
- Class Teacher remarks
- Correction management
- Result readiness

Mobile may support small draft entries or correction requests, but web is the authoritative detailed grading surface.

## 11.2 Reports

- Class attendance report
- Subject performance
- Homework completion
- Marks-entry completion
- Intervention list
- Guardian communication report
- Activity history
- Date-range filtering
- PDF generation
- Approved CSV export
- Printing

Mobile should show compact summaries only.

## 11.3 Detailed student review

- Full assigned-student profile
- Historical attendance
- Longitudinal subject performance
- Homeroom multi-subject summary
- Intervention history
- Communication history
- Printable class directory

## 11.4 Class coordination

For Class Teachers:

- Subject mark-completion monitoring
- Homework workload across subjects
- Deadline clash detection
- Parent-teacher meeting preparation
- Class Teacher remarks
- Intervention preparation
- Result-readiness submission
- Acknowledgement review

## 11.5 Homework administration

- Template management
- Recurrence
- Bulk duplication
- Rubric builder
- Large attachment management
- Detailed analytics
- Archive management

## 11.6 Library planning

- Advanced catalogue search
- Reading-list preparation
- Teaching-resource requests
- Printable reading lists

---

# 12. Mobile-Only or Mobile-Native Teacher Features

## 12.1 Device-native capture

- Camera capture for classroom activities
- Camera scan for homework
- QR scanning where authorized
- Quick photo evidence
- Compressed media upload
- Voice-to-text quick drafts

## 12.2 Offline operations

- Offline attendance draft
- Offline homework draft
- Offline observation draft
- Cached timetable
- Cached assigned roster
- Safe synchronization
- Conflict handling
- Explicit stale/offline state
- Assignment-removal cache purge
- Logout cache purge

## 12.3 Push and immediate actions

- Push notifications
- Current-period attendance shortcut
- One-tap acknowledgement
- Substitution alert
- Timetable change alert
- Homework reminder
- Marks deadline alert
- Sync failure alert
- Quick guardian contact

## 12.4 Mobile security

- Biometric unlock
- Device registration
- Device/session visibility
- Secure cache cleanup
- Session-expiry data purge

---

# 13. Module-by-Platform Matrix

| Module | Web | Mobile | Final decision |
|---|---:|---:|---|
| M0 Personal account/security | Yes | Yes | Both |
| M1 Assigned student projection | Yes | Yes | Both |
| M2 Attendance | Yes | Yes | Both, mobile-first |
| M3 Fees and receipts | No | No | Hidden |
| M4 Academics and grading | Yes | Limited | Both, web-first |
| M5 Activities and observations | Yes | Yes | Both, mobile-first |
| M6 Homework and timetable | Yes | Yes | Both |
| M7 Staff self-service | Yes | Yes | Both |
| M8 Library | Yes | Limited | Both, web-first |
| M9 Transport | No workspace | Alerts only | Mobile contextual |
| M10 Canteen | No workspace | Alerts only | Mobile contextual |
| M11 Accounting and finance | No | No | Hidden |
| M12 Notifications | Yes | Yes | Both, mobile-first |
| M13 Learning | Future | Future | Both when enabled |
| M14 AI | No | No | Deferred |
| M15 Notices | Yes | Yes | Both, web authoring-first |

---

# 14. Recommended Teacher Web Navigation

```text
Home

My Teaching
├── My Homeroom
├── My Subjects
├── My Students
└── Timetable

Attendance
Homework
Assessments & Marks
Activities
Communication
Class Reports

My Workspace
├── Library
├── My Attendance
├── Leave
├── Payslips
├── Profile
├── Preferences
└── Security
```

## 14.1 Navigation behavior

- Do not show administrative module names when the Teacher only receives a restricted projection.
- Replace `Admissions` with `My Students`.
- Replace `HR & Payroll` with `My Workspace`.
- Replace `Platform Settings` with `Preferences & Security`.
- Replace `Notifications and Delivery` with `Notifications`.
- Hide empty groups.
- Show only assigned contexts.
- Never show unrestricted class or subject selectors.

---

# 15. Recommended Teacher Mobile Navigation

```text
Today | Attendance | Classes | Homework | More
```

## 15.1 Today

- Current period
- Next period
- Pending attendance
- Homework awaiting review
- Marks deadline
- Substitution
- Notices
- Offline/sync status

## 15.2 Attendance

- Assigned context
- Mark all present
- Quick exceptions
- Remarks
- Offline save
- Submit
- Correction request

## 15.3 Classes

Two tabs:

```text
Homeroom
Subjects
```

Homeroom:

- Assigned class
- Full assigned roster
- Attendance summary
- General alerts
- Guardian contact
- Class overview

Subjects:

- Assigned class-section-subject combinations
- Homework
- Marks
- Subject performance
- Period attendance where enabled

## 15.4 Homework

- Create homework
- Add attachment
- Set due date
- Publish or draft
- Review submissions
- Quick feedback
- Reminder

## 15.5 More

```text
Marks
Timetable
Activities
Notices
Notifications
Library
Leave
Payslips
Profile
Security
Sync Status
```

---

# 16. Recommended Permission Model

## 16.1 Base Teacher permissions

```text
profile:self_read
profile:self_update
security:self_manage

timetable:self_read
notices:read
events:read

leave:self_read
leave:self_request
payslip:self_read

settings:read_public
notifications:self_read
notifications:self_manage_preferences
```

## 16.2 Assignment-scoped capabilities

```text
classes:assigned_read
sections:assigned_read
students:assigned_read

attendance:assigned_read
attendance:assigned_mark
attendance:correction_request

homework:assigned_read
homework:assigned_create
homework:own_update
homework:assigned_review
homework:assigned_notify

marks:assigned_read
marks:assigned_enter
marks:own_draft_update
marks:own_submit
marks:correction_request

cas:assigned_enter
results:assigned_read
results:class_teacher_remark

timetable:assigned_class_read

activity_feed:assigned_read
activity_feed:own_create
activity_feed:own_update

messaging:assigned_read
messaging:assigned_send

reports:assigned_class_read
reports:assigned_subject_read
```

## 16.3 Permissions that should not be granted by default

```text
roles:read
staff:read
settings:read
reports:read
hr:staff:read
learning:delete
users:create
users:update_status
users:reset_password
roles:assign
roles:manage_permissions
attendance:override_lock
results:publish
marks:unlock
```

---

# 17. Backend Authorization Contract

Every Teacher-facing operation should evaluate:

```text
1. Is the user authenticated?
2. Is the user an active staff member?
3. Does the user have the TEACHER role?
4. Is the academic year valid?
5. Is there an active assignment?
6. Does the assignment match the requested class?
7. Does it match the requested section?
8. Does it match the subject where required?
9. Does it match the assessment component where required?
10. Is the action allowed for the assignment type?
11. Is the record editable?
12. Does the Teacher own the record or have delegation?
13. Is the module enabled for the tenant?
14. Is the request safe for offline replay?
```

Example service call:

```ts
await teacherScopeService.requireAccess({
  tenantId: actor.tenantId,
  staffId: actor.staffId,
  academicYearId,
  classId,
  sectionId,
  subjectId,
  assessmentId,
  component,
  capability,
});
```

## 17.1 Query-level scoping

Bad:

```ts
await prisma.student.findMany({
  where: { tenantId },
});
```

Correct:

```ts
await prisma.student.findMany({
  where: {
    tenantId,
    enrollments: {
      some: {
        academicYearId,
        classId,
        sectionId,
      },
    },
  },
});
```

The assignment verification must occur before or as part of the query.

Do not fetch school-wide data and filter it in memory.

---

# 18. Temporary Delegation

Schools need substitute and temporary assignment support.

Example:

```text
Original Teacher: Mina Gautam
Substitute Teacher: Rajesh Aryal
Class: Grade 6
Section: A
Subject: Mathematics
Assessment: Unit Test 2
Valid From: 2026-07-20
Valid Until: 2026-07-25

Allowed:
- View roster
- Mark period attendance
- Create homework
- Enter draft marks

Not allowed:
- Approve marks
- Change historical grades
- Publish results
- View confidential homeroom notes
```

Delegation must include:

- Tenant
- Academic year
- Grantor
- Recipient
- Scope
- Allowed capabilities
- Reason
- Start
- Expiry
- Audit trail
- Automatic revocation

---

# 19. Offline and Sync Requirements

## 19.1 Offline-supported Teacher actions

- Attendance drafts
- Homework drafts
- Activity/observation drafts
- Cached timetable
- Cached assigned roster
- Pending correction request draft

## 19.2 Offline restrictions

Offline mode must not permit:

- Result publication
- Mark approval
- Attendance lock override
- Role changes
- Student lifecycle changes
- School-wide exports
- Sensitive file downloads without prior authorization
- Unbounded caching

## 19.3 Required sync behavior

- Idempotent submissions
- Client-generated operation ID
- Server replay protection
- Conflict detection
- Explicit sync status
- Last-successful-sync timestamp
- Retry-safe failure
- User-visible conflict resolution
- Purge on logout
- Purge on assignment removal
- Purge on session expiry
- Encryption at rest on device where supported

---

# 20. Data Privacy and Safety

Teachers should receive the minimum information required to perform teaching duties.

## 20.1 Allowed student information

- Identity
- Roll number
- Assigned class and section
- Approved guardian contact
- Approved emergency contact
- Relevant attendance
- Relevant academic information
- Approved accommodation
- Approved safety alert
- Teacher-owned observations

## 20.2 Restricted information

Teachers should not automatically receive:

- Family financial records
- Full medical documents
- Guardian identity documents
- Admission verification documents
- Private counselling records
- Unrelated disciplinary investigations
- Other subjects' detailed marks where not Class Teacher
- Unrelated parent communications
- Bank or tax information

## 20.3 Access audit

Sensitive Teacher access should be auditable for:

- Guardian contact access
- Care-alert access
- Protected-file access
- Mark changes
- Attendance corrections
- Exports
- Delegations
- Offline sync conflicts

---

# 21. Teacher Dashboard Requirements

## 21.1 Web dashboard

The Teacher web dashboard should show:

- Current/next period
- Assigned homeroom
- Assigned subjects
- Attendance pending
- Homework awaiting review
- Marks deadlines
- Result readiness
- Student attention list
- Unread notices
- Substitution
- Recent activities
- Quick links
- Last-updated timestamps

It must not show:

- School-wide revenue
- Admission funnel
- Accounting
- Payroll totals
- School-wide attendance KPIs
- Unassigned classes
- Tenant configuration

## 21.2 Mobile Today screen

- Current period
- Next period
- One-tap attendance
- Pending attendance
- Homework review count
- Marks deadline
- Substitution alert
- Notice count
- Offline status
- Sync status
- Assigned-class shortcut

---

# 22. Required Modern Teacher Productivity Features

To help Teachers operate faster, SchoolOS should provide the following.

## 22.1 Fast classroom operation

- One-tap attendance
- Mark-all-present
- Current-period auto-selection
- Assigned-context auto-selection
- Quick homework creation
- Reusable personal templates
- Quick feedback phrases
- Voice-to-text
- Camera scan
- Offline drafts
- Keyboard shortcuts on web

## 22.2 Reduced duplicate work

- Reuse homework
- Duplicate homework across valid assigned sections
- Copy grading remarks
- Save common feedback
- Pre-fill assigned context
- Automatic student roster loading
- Automatic timetable context
- Automatic assessment component filtering
- Draft auto-save
- Recent-item shortcuts

## 22.3 Better class coordination

For Class Teachers:

- Missing attendance alert
- Missing subject marks alert
- Homework overload warning
- Parent follow-up list
- Student intervention list
- Result-readiness status
- Attendance-risk summary
- Upcoming parent meeting preparation

## 22.4 Better communication

- Approved templates
- Subject reminders
- Attendance follow-up
- Parent-meeting reminders
- Delivery status
- Acknowledgement status
- Translation-ready templates
- Quiet-hours compliance
- Communication history

## 22.5 Better grading

- Spreadsheet-style entry
- Keyboard navigation
- Auto-save
- Validation before submission
- Missing marks highlighting
- Out-of-range prevention
- Component-aware grading
- Lock-state clarity
- Correction workflow
- Subject analytics
- No access to unrelated subjects

## 22.6 Better visibility

- Personal timetable
- Substitution alerts
- Due-date calendar
- Marks deadline calendar
- Pending action list
- Last-updated time
- Offline state
- Sync state
- Assignment-expiry notice

---

# 23. Acceptance Criteria

## 23.1 Assignment scoping

- A Teacher cannot view an unassigned class.
- A Teacher cannot discover an unassigned class through search.
- A Teacher cannot access an unassigned class by changing a URL.
- A Teacher cannot access an unassigned class through direct API calls.
- A Teacher cannot receive push notifications for unassigned students.
- Offline cache excludes unassigned data.
- Removing an assignment revokes access immediately.

## 23.2 Homework

- Subject dropdown shows only assigned subjects.
- Class/section dropdown shows only valid assignment combinations.
- Class Teacher cannot create subject homework without subject assignment.
- Class Teacher can create a subjectless class task.
- Teacher cannot edit another Teacher's homework without delegation.
- API rejects manipulated subject IDs.

## 23.3 Grading

- Teacher can grade only assigned subjects.
- Class Teacher cannot grade another subject.
- Practical-only Teacher cannot edit theory.
- Locked marks cannot be changed directly.
- Bulk import validates every row.
- Unauthorized rows are rejected.
- Direct API manipulation returns `403`.
- Result publication remains administrative.

## 23.4 Attendance

- Class Teacher can mark assigned homeroom.
- Subject Teacher can mark only assigned period where enabled.
- Teacher cannot override lock.
- Teacher cannot approve own correction.
- Offline replay is idempotent.
- Unassigned class access returns `403`.

## 23.5 Reports

- Reports contain only assigned students and subjects.
- Class Teacher reports are homeroom-scoped.
- Subject Teacher reports are subject-scoped.
- Exports are permission checked.
- Generated files use protected access.
- Exports are auditable.

## 23.6 Mobile

- Mobile route guards enforce Teacher persona.
- Backend scope is authoritative.
- Cached data purges on logout.
- Cached data purges on assignment removal.
- Push payloads contain no unrelated sensitive data.
- Sync conflicts are visible.
- Offline drafts are idempotent.

---

# 24. Implementation Priorities

## Phase 1 — Security foundation

1. Keep base role `TEACHER`.
2. Implement canonical Teacher assignment resolver.
3. Scope all Teacher APIs.
4. Remove broad school-wide Teacher permissions.
5. Add assignment-aware authorization tests.
6. Add cache and push scoping.
7. Add immediate assignment revocation.
8. Add audit evidence.

## Phase 2 — Core shared Teacher experience

1. Teacher home/Today
2. My Homeroom
3. My Subjects
4. Assigned students
5. Attendance
6. Homework
7. Timetable
8. Notifications
9. Profile and self-service

## Phase 3 — Web-first depth

1. Marks grid
2. CAS
3. Assessment components
4. Result readiness
5. Class Teacher remarks
6. Reports
7. Homework templates
8. Detailed student review
9. Notice authoring

## Phase 4 — Mobile-first depth

1. Offline attendance
2. Camera activity capture
3. Offline homework drafts
4. Push notifications
5. Quick observations
6. Quick marks drafts
7. Biometric unlock
8. Conflict-safe sync

## Phase 5 — Supporting features

1. Teacher library experience
2. Transport safety alerts
3. Canteen allergy alerts
4. Temporary delegation
5. M13 Learning only after formal activation
6. Future AI only after privacy, quality, cost, and human-review design

---

# 25. Final Teacher Product Definition

A modern SchoolOS Teacher experience should provide:

```text
One Teacher identity

+ Class Teacher assignments
+ Subject Teacher assignments
+ Temporary delegations

+ Assigned students only
+ Assigned classes only
+ Assigned sections only
+ Assigned subjects only

+ Fast attendance
+ Fast homework
+ Safe grading
+ Clear timetable
+ Class coordination
+ Parent communication
+ Personal HR self-service
+ Offline mobile support
+ Detailed web tools

- No admissions administration
- No financial access
- No accounting access
- No payroll administration
- No role management
- No unrelated student data
- No other-subject grading
- No school-wide exports
```

## Final invariant

> A Teacher receives exactly the information and actions required for their active teaching assignments—and nothing beyond them.

## Final platform principle

> Web handles detailed, bulk, analytical, printable, and coordination-heavy work. Mobile handles immediate, offline, camera-enabled, push-driven, and classroom-first work. Core teaching workflows remain available on both through the same backend authorization rules.
