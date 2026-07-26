# SchoolOS Role Pain Points and Priority Roadmap

## Purpose

This document defines the most important pain points SchoolOS must solve for **Principals, Teachers, and Parents** in Nepalese schools serving **Grades 1–12**. It ranks those pain points by urgency and dependency, then organizes implementation into four delivery stages.

The roadmap is designed to prevent SchoolOS from becoming a collection of disconnected features. Each stage must solve a clear operational or educational problem and must be completed and validated before lower-priority capabilities are expanded.

## Active Mobile Roles

- Principal
- Teacher
- Parent

## Deferred Modules

The following modules remain deferred unless a minimal change is strictly required to remove a verified blocker in a higher-priority workflow:

- Canteen Management
- Transport Management
- Library Management
- Learning Layer

Deferred modules must not be expanded merely because related code exists.

## Priority Decision Rules

Pain points are prioritized using five criteria:

1. **Daily operational impact** — how frequently the problem affects school work.
2. **Student safety and learning impact** — the potential harm caused by delay or failure.
3. **Number of users affected** — whether the issue affects one role or the entire school community.
4. **Dependency order** — whether later features require this capability to be reliable first.
5. **Adoption risk** — whether failure would cause users to return to paper, spreadsheets, calls, or informal messaging.

> **Safeguarding exception:** Any actual concern involving abuse, bullying, harassment, self-harm, or immediate child safety must be escalated immediately. The later roadmap position of a full safeguarding module does not reduce the urgency of a real incident.

## Executive Priority Decision

| Role | First pain point to resolve | Primary Stage 1 response |
|---|---|---|
| **Principal** | Lack of accurate, real-time operational visibility | Principal dashboard, attendance oversight, missing-submission visibility, approvals, examination progress, and critical alerts |
| **Teacher** | Excessive and unreliable daily administrative work | Fast role-specific dashboard, offline attendance, homework, marks drafts, timetable, and structured communication |
| **Parent** | Receiving important child information too late | Child dashboard, attendance alerts, homework, examinations, results, fees, notices, and secure multiple-child support |

## Stage Summary

| Stage | Objective | Main pain points resolved |
|---|---|---|
| **Stage 1 — Immediate Value** | Establish a reliable daily operating core | Unsafe access, slow administration, missing attendance visibility, delayed parent information, fragmented homework/results/fees communication |
| **Stage 2 — Operational Control** | Improve accountability, exception handling, and follow-through | Missing submissions, approval delays, unresolved corrections, scattered communication, payment exceptions, untracked complaints |
| **Stage 3 — Learning Improvement** | Detect learning problems and manage interventions | Late identification of struggling students, marks without skill insight, weak remedial follow-up, inadequate Grades 1–3 tracking |
| **Stage 4 — Institutional Improvement** | Support long-term quality, compliance, and carefully governed intelligence | Weak teacher development, reactive planning, examination-readiness gaps, data-export needs, confidential case management, limited decision support |

## Stage Exit Rule

A stage is complete only when its in-scope workflows are implemented end-to-end, permissions are enforced server-side, offline behavior is defined where required, loading/error/empty states exist, critical tests pass, and no unresolved critical or high-severity defect remains.

---


# Overall SchoolOS Priority

## Priority 0 — Foundation and Release Blockers

These must be resolved before improving role-specific workflows:

1. Authentication and session reliability
2. Role-based permissions
3. Tenant and school data isolation
4. Parent-child access control
5. Teacher-class and subject access control
6. Offline synchronization and duplicate prevention
7. Data-loss and corruption risks
8. Audit history
9. Crash and critical error handling
10. Nepali localization foundation

Without these, every other module remains unsafe or unreliable.

---

## Priority 1 — Daily School Operations

Resolve first across all three roles:

1. Attendance
2. Dashboards and daily visibility
3. Homework
4. Marks and results
5. Leave and approvals
6. Notifications and communication
7. Parent child switching
8. Fees and receipts
9. Loading, error, empty and offline states

These workflows create immediate value and replace paper, spreadsheets, phone calls and informal messaging.

---

## Priority 2 — Learning Improvement

After core operations are stable:

1. Student early-warning system
2. Intervention management
3. Learning-outcome tracking
4. Curriculum-progress tracking
5. Grades 1–3 foundational learning
6. Remedial groups
7. Parent weekly progress summaries

This phase moves SchoolOS from an administrative system to an educational improvement platform.

---

## Priority 3 — Accountability and Institutional Improvement

1. Parent complaints and grievance management
2. Structured communication
3. Teacher mentoring and development
4. School improvement planning
5. Payment disputes and reconciliation
6. Parent meeting scheduling
7. Communication acknowledgement and escalation

---

## Priority 4 — Compliance and Advanced Features

1. Grade 8 examination readiness
2. SEE readiness
3. Grade 11–12 and NEB readiness
4. IEMIS-compatible exports
5. Safeguarding case-management platform
6. AI summaries and translation
7. Predictive analytics

---

# Principal’s Point of View

## 1. Real-Time School Visibility — Highest Priority

### Pain point

The principal cannot immediately determine:

* Which students are absent
* Which teachers have not submitted attendance
* Which marks are missing
* Which approvals are pending
* Which classes have operational issues
* Which urgent parent or teacher requests require action

### Resolve first

Implement a reliable Principal dashboard containing:

* Student attendance
* Teacher attendance
* Missing submissions
* Pending approvals
* Marks-entry progress
* Result status
* Critical alerts
* Fee collection exceptions
* Immediate action items

### Why first

A principal cannot manage the school effectively without accurate operational visibility.

**Priority: P1 — Immediate**

---

## 2. Attendance Monitoring and Submission Completeness

### Pain point

Attendance problems and missing submissions may be discovered too late.

### Resolve

* Daily attendance overview
* Class and section drill-down
* Missing teacher submissions
* Consecutive absence alerts
* Chronic absence indicators
* Attendance correction approval
* Parent notification status
* Offline synchronization visibility

### Why second

Attendance affects student safety, dropout risk, academic outcomes and school accountability.

**Priority: P1 — Immediate**

---

## 3. Approvals and Operational Bottlenecks

### Pain point

Leave, attendance corrections, marks corrections, result publication and announcements can remain pending or be handled informally.

### Resolve

* Unified approval inbox
* Approve and reject actions
* Supporting documents
* Decision reason
* Delegation
* Escalation
* Approval deadline
* Complete audit trail

### Why third

Delayed approvals block teachers, parents and academic processes.

**Priority: P1 — Immediate**

---

## 4. Examination, Marks and Result Visibility

### Pain point

Principals may not know which teachers have completed marks entry or whether results are ready for publication.

### Resolve

* Marks-entry completion dashboard
* Missing marks
* Invalid marks
* Practical and internal marks status
* Result approval
* Publication readiness
* Grade 8, SEE and Grade 12 readiness indicators

### Why fourth

Result-related errors affect every student and can create serious parent complaints.

**Priority: P1**

---

## 5. Parent and Teacher Communication

### Pain point

Messages and complaints are scattered across calls, office visits and personal messaging applications.

### Resolve

* Principal communication inbox
* Targeted announcements
* Emergency notifications
* Parent and teacher threads
* Required acknowledgement
* Delivery status
* Escalation for unread critical notices

### Why fifth

Communication problems increase confusion, complaints and administrative workload.

**Priority: P1–P2**

---

## 6. Student Early-Warning and Intervention

### Pain point

The principal discovers chronic absence, academic decline or disengagement only after the problem becomes severe.

### Resolve

* Explainable student-risk alerts
* Intervention cases
* Assigned case owner
* Parent-contact history
* Follow-up dates
* Escalation
* Resolution tracking

### Why sixth

This is extremely valuable, but it depends on accurate attendance, marks and homework data.

**Priority: P2**

---

## 7. Parent Grievances and Service Requests

### Pain point

Complaints are not consistently assigned, tracked or closed.

### Resolve

* Complaint categories
* Priority
* Ownership
* Response deadline
* Parent-visible status
* Internal notes
* Escalation
* Reopening
* Resolution confirmation

**Priority: P2–P3**

---

## 8. Curriculum and Teaching Quality Monitoring

### Pain point

The principal knows whether classes occurred but not whether the curriculum is on schedule or students are learning.

### Resolve

* Planned versus completed lessons
* Curriculum coverage
* Learning-outcome progress
* Missed-class recovery
* Classroom observations
* Teacher mentoring plans

**Priority: P2–P3**

---

## 9. Teacher Development

### Resolve

* Classroom observations
* Development goals
* Mentor assignments
* Training history
* Feedback
* Follow-up

**Priority: P3**

---

## 10. School Improvement Planning

### Resolve

* KPIs
* Baselines
* Targets
* Owners
* Actions
* Deadlines
* Evidence
* Monthly reviews

**Priority: P3**

---

# Principal Priority List

1. Real-time Principal dashboard
2. Attendance and missing-submission monitoring
3. Approvals
4. Examination, marks and result readiness
5. Parent and teacher communication
6. Student early-warning and intervention
7. Grievance management
8. Curriculum-progress monitoring
9. Teacher development
10. School improvement planning

---

# Teacher’s Point of View

## 1. Reduce Daily Administrative Work — Highest Priority

### Pain point

Teachers spend too much time repeatedly recording attendance, homework, marks and messages.

### Resolve

* Fast daily dashboard
* Assigned classes only
* Mark-all-present
* Exception-based attendance
* Auto-save
* Draft recovery
* Reusable homework templates
* Bulk marks and remarks
* Recent-class quick actions
* Clear submission status

### Why first

If basic workflows are slow, teachers will avoid the application and return to paper or messaging apps.

**Priority: P1 — Immediate**

---

## 2. Reliable Attendance with Offline Support

### Pain point

Attendance can be lost or duplicated when internet connectivity is poor.

### Resolve

* Offline attendance
* Local auto-save
* Queued synchronization
* Duplicate prevention
* Conflict handling
* Locked-attendance visibility
* Correction requests
* Clear synchronization status

### Why second

Attendance is the most frequent teacher workflow and must work every school day.

**Priority: P1 — Immediate**

---

## 3. Homework and Assignment Management

### Pain point

Creating and communicating homework is repetitive and uncoordinated.

### Resolve

* Create and edit homework
* Drafts
* Attachments
* Templates
* Due dates
* Notifications
* Duplicate detection
* Class workload view
* Expected completion time
* Holiday and examination conflict warnings

**Priority: P1**

---

## 4. Marks Entry and Result Submission

### Pain point

Marks entry is error-prone and time-consuming.

### Resolve

* Student-wise entry
* Bulk entry
* Draft saving
* Maximum-mark validation
* Absent and exempt states
* Missing-marks indicators
* Final submission
* Locked marks
* Correction requests
* Offline-safe drafts

**Priority: P1**

---

## 5. Teacher Dashboard and Timetable

### Pain point

Teachers need to know their immediate classes, pending work and deadlines.

### Resolve

* Today’s classes
* Attendance tasks
* Homework deadlines
* Marks deadlines
* Upcoming examinations
* Messages
* Leave status
* Quick actions

**Priority: P1**

---

## 6. Structured Parent Communication

### Pain point

Teachers repeatedly answer the same questions and may receive messages at inappropriate times.

### Resolve

* Child-specific threads
* Message categories
* Templates
* Office hours
* Urgent versus normal messages
* Read status
* Parent acknowledgement
* Broadcast to assigned classes
* Escalation rules

**Priority: P1–P2**

---

## 7. Student Learning-Gap Identification

### Pain point

Teachers can see marks but cannot easily identify specific skill gaps.

### Resolve

* Learning outcomes
* Formative assessments
* Skill mastery
* Student progress timeline
* Weak-skill indicators
* Reassessment
* Remedial groups

### Why after marks

This feature depends on accurate assessment and student data.

**Priority: P2**

---

## 8. Student Intervention Management

### Resolve

* Teacher concern flags
* Intervention plan
* Parent-contact notes
* Remedial actions
* Follow-up dates
* Progress updates
* Escalation to principal

**Priority: P2**

---

## 9. Grades 1–3 Foundational Learning

For teachers assigned to Grades 1–3, this should move higher in priority.

### Resolve

* Reading-level tracking
* Numeracy tracking
* Observation checklists
* Developmentally appropriate assessments
* Progress timelines
* Parent-friendly summaries

**Priority: P2 overall; P1 for schools prioritizing Grades 1–3**

---

## 10. Curriculum Progress

### Resolve

* Planned lessons
* Completed lessons
* Missed lessons
* Re-teaching requirements
* Pacing alerts
* Resource links

**Priority: P2**

---

## 11. Teacher Mentoring and Professional Development

### Resolve

* Personal development goals
* Observation feedback
* Reflection notes
* Training
* Microlearning
* Evidence and certificates

**Priority: P3**

---

# Teacher Priority List

1. Reduce daily administrative workload
2. Reliable offline attendance
3. Homework management
4. Marks entry and result submission
5. Teacher dashboard and timetable
6. Structured parent communication
7. Learning-gap identification
8. Student intervention management
9. Grades 1–3 foundational learning
10. Curriculum progress
11. Teacher mentoring and development

---

# Parent’s Point of View

## 1. Timely Child Status and Alerts — Highest Priority

### Pain point

Parents discover absence, missed homework or academic decline too late.

### Resolve

Create a parent dashboard showing:

* Today’s attendance
* Important alerts
* Missing homework
* Upcoming examinations
* Results
* Payment deadlines
* Teacher messages
* Required actions

### Why first

The parent app’s primary value is keeping parents informed without requiring school visits or phone calls.

**Priority: P1 — Immediate**

---

## 2. Attendance and Safety Notifications

### Pain point

Parents may not know whether their child reached school or was marked absent.

### Resolve

* Daily attendance
* Immediate absence alerts
* Late-arrival alerts
* Attendance calendar
* Attendance percentage
* Incorrect-attendance reporting
* Correction status
* Critical-notification acknowledgement

**Priority: P1 — Immediate**

---

## 3. Homework, Examinations and Results

### Pain point

Parents lack a consolidated view of academic responsibilities.

### Resolve

* Homework calendar
* Due dates
* Attachments
* Examination schedule
* Marks
* Results
* Report cards
* Teacher feedback
* Missing and unpublished-result states

**Priority: P1**

---

## 4. Reliable School Communication

### Pain point

Notices are sent through inconsistent channels and may be missed.

### Resolve

* School notices
* Teacher messages
* Principal messages
* Read status
* Required acknowledgement
* Child-specific context
* Push notifications
* SMS fallback for critical notices
* Nepali language support

**Priority: P1**

---

## 5. Multiple Children Support

### Pain point

Parents with several children need separate but easily accessible records.

### Resolve

* Secure child switching
* Clear selected-child indicator
* Separate attendance, academic and fee data
* Combined family calendar
* Combined deadline view
* Cross-child data-leak prevention

**Priority: P1**

---

## 6. Fees, Payments and Receipts

### Pain point

Parents may not understand outstanding amounts, payment status or fee breakdowns.

### Resolve

* Fee breakdown
* Outstanding amount
* Installments
* Payment history
* Receipts
* Discounts and scholarships
* Pending verification
* Incorrect-balance reporting
* Payment disputes

**Priority: P1–P2**

---

## 7. Leave and Attendance Corrections

### Resolve

* Leave submission
* Attachments
* Approval status
* Cancellation
* Attendance correction
* Rejection reason
* Resubmission
* Escalation

**Priority: P2**

---

## 8. Weekly Progress Digest

### Pain point

Parents receive raw information but not a clear explanation of what changed.

### Resolve

* Attendance summary
* Homework completion
* Academic improvement or decline
* Upcoming deadlines
* Teacher comments
* Required parent actions

**Priority: P2**

---

## 9. Parent-Friendly Learning Guidance

### Pain point

Marks do not tell parents what the child needs help with.

### Resolve

* Skill-level explanations
* Learning-outcome progress
* Teacher-approved home activities
* Remedial-plan visibility
* Progress against previous performance

**Priority: P2**

---

## 10. Complaints and Service Requests

### Resolve

* Submit complaint
* Category and priority
* Evidence
* Assigned responder
* Status tracking
* Response deadline
* Resolution confirmation
* Reopening

**Priority: P2–P3**

---

## 11. Child Safety and Wellbeing

### Resolve carefully

* Bullying reports
* Harassment concerns
* Safeguarding reports
* Emergency escalation
* Confidential handling
* Minimal notification details
* Restricted access

### Priority treatment

* **Implementation priority:** P3 because it requires policy, security and specialist design.
* **Incident priority:** Immediate emergency handling whenever a real concern is reported.

---

# Parent Priority List

1. Timely child dashboard and action alerts
2. Attendance and safety notifications
3. Homework, examinations and results
4. Reliable school communication
5. Multiple-children support
6. Fees, payments and receipts
7. Leave and attendance corrections
8. Weekly progress digest
9. Parent-friendly learning guidance
10. Complaint and service-request tracking
11. Child safety and confidential reporting

---

# Recommended Combined Implementation Sequence

## Stage 1 — Immediate Value

Implement together because they serve all three roles:

1. Authentication, permissions and tenant isolation
2. Role-specific dashboards
3. Attendance
4. Offline synchronization
5. Homework
6. Marks, examinations and results
7. Leave and basic approvals
8. Notifications and messaging
9. Multiple-child support
10. Fee visibility and receipts

---

## Stage 2 — Operational Control

1. Missing-submission monitoring
2. Unified Principal approvals
3. Structured communication
4. Attendance correction
5. Payment reconciliation
6. Parent action centre
7. Weekly progress digest
8. Complaint management

---

## Stage 3 — Learning Improvement

1. Student early-warning
2. Intervention cases
3. Learning outcomes
4. Formative assessments
5. Remedial groups
6. Curriculum progress
7. Grades 1–3 foundational learning
8. Parent learning guidance

---

## Stage 4 — Institutional Improvement

1. Teacher development
2. School improvement planning
3. Grade 8 readiness
4. SEE readiness
5. Grade 12 readiness
6. IEMIS-compatible exports
7. Safeguarding case management
8. Assistive AI features

---

# Final Recommendation

The **first pain point to resolve for each role** is:

| Role          | First problem to solve                             |
| ------------- | -------------------------------------------------- |
| **Principal** | Lack of accurate, real-time school visibility      |
| **Teacher**   | Excessive and unreliable daily administrative work |
| **Parent**    | Receiving important child information too late     |

The first major SchoolOS release should therefore concentrate on:

> **Reliable attendance, role-specific dashboards, homework, marks and results, approvals, parent notifications, messaging, fees, and offline synchronization.**

Only after these workflows are stable and widely adopted should SchoolOS prioritize predictive risk scoring, curriculum intelligence, teacher development and AI.

---

# Delivery Ownership by Platform

## Mobile App

Use the mobile app for frequent, time-sensitive, role-specific actions:

- Daily dashboards
- Attendance capture and monitoring
- Homework creation and viewing
- Marks drafts and quick submission workflows
- Parent child switching
- Alerts and notifications
- Leave requests and quick approvals
- Messaging
- Receipt and fee visibility
- Offline work and synchronization status

## Web Application

Use the web application for detailed configuration, bulk operations, corrections, reporting, and governance:

- Academic-year, class, section, subject, and grading setup
- Bulk imports and exports
- Attendance and marks correction tools
- Examination configuration
- Fee configuration and reconciliation
- Detailed reports
- Communication templates and targeting
- Data-quality management
- Audit logs
- Role and permission administration
- School improvement and compliance workflows

## Backend

The backend is authoritative for:

- Authentication and session control
- Role and tenant isolation
- Parent-child authorization
- Teacher assignment authorization
- Workflow state transitions
- Validation and idempotency
- Audit events
- Notifications
- Offline synchronization contracts
- Conflict handling
- Sensitive-data protection

---

# Recommended First Release Boundary

The first production-oriented release should include only the reliable daily operating core:

1. Authentication, role permissions, and tenant isolation
2. Principal, Teacher, and Parent dashboards
3. Attendance with offline synchronization
4. Homework
5. Examinations, marks, and approved results
6. Leave and basic approvals
7. Notifications, announcements, and messaging
8. Secure multiple-child support
9. Fee visibility, payment history, and receipts
10. Loading, empty, error, retry, permission, and stale-data states

Do not allow advanced analytics, AI, or broad institutional modules to delay this release unless they are necessary to fix a verified safety, integrity, or operational blocker.

---

# Roadmap Completion Tracker

This tracker records the repository and local-runtime audit started on 2026-07-26. `Complete (Internal QA)` means the workflow and its focused local evidence passed; it does not mean staging, controlled-pilot, release-candidate, or GA evidence exists.

## Stage 1 Tracker — Immediate Value

| Pain point | Role | Platform | Initial status | Evidence found | Work completed | Tests run | Validation result | Remaining risk | Final status |
|---|---|---|---|---|---|---|---|---|---|
| Authentication, permissions, and tenant isolation | Shared | Backend, web, mobile | Partial | Auth guards, scoped mobile services, platform/school planes, pilot role smoke, and browser route-denial coverage existed; API typecheck exposed a missing guardian relation in the internal auth-session type. | Added the selected guardian name relation to `UserWithRoles`; preserved safe guardian metadata only. | Auth service 17-test suite; root lint/typecheck/unit/API E2E/build; pilot and platform smoke; authenticated school/platform route-isolation browser tests; Android session restore, offline failure, and logout checks. | Passed after the type-contract fix; API E2E passed 43 suites / 277 tests outside the listener-restricted sandbox. | Staging tenant-isolation evidence, session-expiry browser evidence, and provider/device-matrix proof remain release gates. | Complete (Internal QA) |
| Role-specific dashboards | Principal, Teacher, Parent | Backend, mobile, web | Complete | Purpose-limited principal, teacher, and parent mobile contracts and dashboard tests existed; the school web dashboard used backend-owned summaries. | No product change required. Manually validated all three active mobile personas against the live local API. | Flutter 462 tests; pilot smoke; authenticated dashboard route audit; Android Principal, Teacher, and Parent walkthroughs. | Passed, including safe unavailable/offline states and persona-appropriate navigation. | iOS device QA is blocked by the incomplete local Xcode installation; staging and pilot usability evidence remain. | Complete (Internal QA) |
| Attendance | Principal, Teacher, Parent | Backend, web, mobile | Complete | Tenant-scoped attendance services, teacher assignment guards, principal oversight, parent summaries, mobile drafts, and web registers existed. | No product change required. Submitted one dedicated local Android attendance record and exercised an independent web draft on the untouched Class 10B assignment. | API unit/E2E; pilot role smoke; authenticated attendance browser smoke; Android mark, relaunch, reconnect, and submit walkthrough. | Passed; assigned/unassigned teacher boundaries failed closed and parent/principal views remained scoped. | Local QA changed seeded attendance data for the tested dates; staging concurrency and real-device network-loss evidence remain. | Complete (Internal QA) |
| Offline synchronization and duplicate prevention | Teacher, Parent | Web, mobile, backend | Complete | IndexedDB web replay, mobile attendance draft storage, idempotency keys, saved-read metadata, and network-only sensitive operations existed. | No product change required. Verified recovered drafts and explicit stale/saved-copy wording at runtime. | Browser offline attendance auto-replay; Flutter offline/idempotency suites; Android airplane-mode relaunch, queued draft recovery, retry, sync, and offline logout. | Passed; no false server-sync claim appeared while offline. | Multi-device conflict behavior and long-duration poor-network testing still need controlled-pilot evidence. | Complete (Internal QA) |
| Homework | Teacher, Parent | Backend, web, mobile | Complete | Assignment-scoped homework APIs, class-teacher compatibility, parent-safe reads, reminders, attachments, and focused tests existed. | Created homework through the real web workflow as a homeroom teacher with no subject-teacher assignment. | Homework API unit suites; web M5/M6 workspace smoke; state-changing class-teacher homework browser test; Flutter teacher/parent homework tests. | Passed, including homeroom scope and parent/mobile contract coverage. | Staging notification-provider delivery and device UX evidence remain. | Complete (Internal QA) |
| Marks, examinations, and results | Principal, Teacher, Parent | Backend, web, mobile | Complete | Backend marks bounds, locks, report generation, publishing, protected files, parent linked-child scope, and web workspaces existed. | Used the teacher currently assigned to the fixed Class 1 mathematics fixture after proving the representative math account was now scoped to Classes 9–10. | Academics unit suites; 17 authenticated admin workspace checks; assigned-teacher invalid/valid mark persistence; protected PDF; published-only linked-parent access; unrelated-parent denial. | Passed. The first browser failure was stale fixture-account selection, not a product authorization defect. | Staging file storage, bulk load, and controlled-pilot result-publication evidence remain. | Complete (Internal QA) |
| Leave and basic approvals | Teacher, Principal/HR | Backend, web, mobile | Complete | Self-service leave, review permissions, principal mobile approval contracts, idempotency, and audit-oriented tests existed. | Exercised a new local teacher leave request and a real HR decision. | Four authenticated browser tests: request, review, direct self-approval denial, and backend-owned coverage drill-through; Flutter principal approval/idempotency tests. | Passed; the teacher direct-review call returned a safe 403. | Principal mobile decision still needs real-device state-changing QA and staging audit review. | Complete (Internal QA) |
| Notifications, notices, and structured delivery | Shared | Backend, web, mobile | Complete | M12 delivery, M15 authoring, notification center, preferences, read state, retries, safe attachment access, and Chat removal/compatibility protections existed. | No product change required. Validated the active notices/delivery path; did not reactivate Chat. | Notification unit/E2E suites; six authenticated M12/M15 lifecycle browser tests; Flutter notification, attachment, dedupe, acknowledgement, and deep-link tests. | Passed locally, including publish/archive/restore, scheduling cancellation, urgent approval, and no duplicate active notice. | Real SMS/email/push provider callbacks, credentials, and staging retry behavior remain external release gates. | Complete (Internal QA) |
| Secure multiple-child support | Parent | Backend, mobile | Complete | Linked-child authorization, child-scoped parent APIs, selected-child persistence, and cross-child denial coverage existed. | Used a real two-child guardian on Android, switched children, relaunched offline, and logged out offline. | Pilot parent linked-child and cross-child-denial smoke; Flutter child-switch/concurrency/staleness/deep-link tests; Android two-child runtime walkthrough. | Passed; child-specific dashboard values changed, the selection persisted, and offline logout cleared the private session. | iOS and controlled-pilot guardian usability evidence remain. | Complete (Internal QA) |
| Fee visibility, payment history, and receipts | Parent, Accountant | Backend, web, mobile | Partial | Backend-owned fee totals, ledgers, reports, protected receipts, parent-safe fee reads, and idempotent collection existed; the documented root M3 fixture command was missing. | Added root forwards for the existing M1 assessment, M3 collection, and M4 report-card fixture seeds; reset only the dedicated M3 fixture and completed partial plus final payment. | Accountant pilot smoke; seven authenticated fee workspace checks; dedicated state-changing M3 collection test; Flutter fee wording/breakdown/payment-idempotency tests; Android parent live and saved-copy fee states. | Passed; balances came from the API after each payment and the dedicated invoice reached paid state with receipt issuance. | Staging payment-provider/reconciliation checks, protected-storage proof, and finance sign-off remain. | Complete (Internal QA) |

**Stage 1 gate:** passed for local Internal QA. No unresolved critical or high-severity Stage 1 product defect was found. This does not advance the overall release stage beyond Internal QA / controlled-pilot preparation because the release-policy staging, provider, iOS-device, backup/restore, monitoring, rollback, and controlled-pilot evidence is still incomplete.

---

## Stage 2 Tracker — Operational Control

| Pain point | Role | Platform | Initial status | Evidence found | Work completed | Tests run | Validation result | Remaining risk | Final status |
|---|---|---|---|---|---|---|---|---|---|
| Missing-submission monitoring | Principal, Teacher | Backend, web, mobile | Partial | Principal attention APIs and web academics workspaces exposed attendance and marks gaps, but the mobile academic readiness percentage divided marks by assessment components and ignored the active-student denominator. | Replaced the invalid ratio with tenant-scoped expected entries (`active students × assessment components`) and submitted non-draft entries, including per-class missing-entry detail. | Focused `MobilePrincipalService` unit suite (24 tests); API typecheck. | Passed focused verification; runtime endpoint and full regression remain pending. | The calculation still depends on accurate active enrollment/class assignment data; staging volume evidence is outstanding. | Partial — implementation complete, integrated validation pending |
| Unified Principal approvals | Principal, Teacher | Backend, mobile, web | Partial | A unified mobile inbox aggregates generic approvals plus legacy leave, attendance-correction, report-card-correction, and urgent-notice rows. Only generic approval rows have a durable mobile decision contract; legacy rows are intentionally read-only. | Closed a critical false-success path: approval now fails before mutation when no final-action executor is registered and can no longer be labelled `APPLIED` without execution. | Focused advanced-operations unit suite (12 tests). | Safety fix passed; full end-to-end actionability, delegation, deadlines, and legacy idempotency remain unverified. | Legacy module rows have no shared durable mobile idempotency/delegation contract; treating them as actionable would risk duplicate or misleading decisions. | Partial |
| Structured communication | Shared | Backend, web, mobile | Complete | M15 targeted notices and acknowledgements plus M12 recipient resolution, delivery jobs, retries, unread reporting, and provider-safe diagnostics exist; active Chat writes/navigation are removed by architecture policy. | No new Chat or parallel thread workflow was created. The active structured path remains notices, acknowledgements, and delivery escalation. | Stage 1 M12/M15 unit/E2E/browser/Flutter evidence; focused unread-escalation review pending. | Locally complete for supported structured notices; provider delivery remains an external gate. | Real provider callbacks and staging escalation timing remain unproved; conversational Chat-style threads are deliberately outside active product scope. | Complete (Internal QA) |
| Attendance correction | Teacher, Parent, Principal | Backend, web, mobile | Partial | M2 has an audited teacher/admin correction lifecycle and principal read-only attention row. The parent mobile contract cannot create, list, cancel, or resubmit a linked-child correction. | Audit complete; implementation pending in the existing M2 request model rather than a duplicate service-request record. | Existing M2 unit/E2E and web correction coverage reviewed. | Teacher/web path exists; parent end-to-end acceptance is not met. | Parent writes must be linked-child scoped, online-only, duplicate-safe, and must not bypass attendance locks or reviewer authority. | Partial |
| Payment reconciliation | Accountant, Principal, Parent | Backend, web, mobile | Partial | M3 payment/receipt reconciliation and M11 bank-statement reconciliation workspaces, APIs, audit, and focused browser coverage exist. Parent fee visibility is complete, but parent incorrect-balance/payment-dispute tracking is absent. | Audit complete; focused state-changing reconciliation validation and parent dispute boundary remain pending. | Existing M3/M11 unit and E2E coverage reviewed. | Operational reconciliation is implemented; parent exception follow-through is incomplete. | Financial truth must remain backend-owned; a dispute may open a case but must never mutate or mark an invoice paid. | Partial |
| Parent action centre | Parent | Backend, mobile | Missing | The parent dashboard exposes notices, homework, attendance, and fees separately, but there is no purpose-limited combined action contract or task-first action-centre screen. | Contract and screen design pending. | Parent dashboard/offline/child-scope tests reviewed. | Acceptance not met. | Must aggregate only backend-owned, linked-child actions and distinguish live, cached, module-locked, and unavailable states without fake zeroes. | Missing |
| Weekly progress digest | Parent | Backend, mobile | Missing | Parent APIs expose individual attendance, homework, fee, exam, result, and notice data, but no bounded seven-day digest with required actions and honest trend availability. | Contract design pending. | Existing parent read-contract tests reviewed. | Acceptance not met. | Academic change must be derived only from comparable published evidence; the app must not invent improvement/decline or cache unsafe data. | Missing |
| Complaint management | Parent, Principal | Backend, mobile, web | Missing | Historical Chat escalation storage exists only for compatibility and cannot be reused or expanded. No active complaint/service-request lifecycle provides ownership, deadlines, parent-visible status, internal notes, resolution confirmation, or reopening. | Domain ownership audit in progress; implementation must remain separate from M12 delivery and M15 notice authoring. | Repository/schema/permission search completed. | Acceptance not met. | Safeguarding and emergencies require a separate policy-led confidential route; a general complaint form must not imply emergency handling. | Missing |

**Stage 2 gate:** not passed. Roadmap-order implementation and integrated validation are in progress.

---

# Roadmap Governance

For each roadmap item, maintain the following fields:

| Field | Required detail |
|---|---|
| Pain point | The exact user problem being solved |
| Role | Principal, Teacher, Parent, or shared |
| Priority | P0, P1, P2, P3, or P4 |
| Stage | Stage 1, 2, 3, or 4 |
| Platform | Backend, web, mobile, or shared |
| Current status | Complete, partial, broken, missing, blocked, or deferred |
| Evidence | Repository files, APIs, tests, screens, or runtime behavior |
| Acceptance criteria | Observable behavior required for completion |
| Validation | Tests and manual checks performed |
| Remaining risk | Known limitation or unresolved dependency |

A roadmap item must not be marked complete because a screen exists or code compiles. Completion requires working business rules, authorization, reliable data handling, user feedback states, tests, and documented validation.
