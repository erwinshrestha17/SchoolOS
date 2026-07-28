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

This tracker records the repository and local-runtime audit started on 2026-07-26. `Complete (Internal QA)` means the workflow and its focused local evidence passed; it does not mean staging, controlled-pilot, release-candidate, or GA evidence exists. `Development complete; live Internal QA blocked` means the implementation and focused static/unit evidence passed, but the required local seeded runtime and UI walkthrough could not be executed and the gate remains open.

## Stage 1 Tracker — Immediate Value

| Pain point | Role | Platform | Initial status | Evidence found | Work completed | Tests run | Validation result | Remaining risk | Final status |
|---|---|---|---|---|---|---|---|---|---|
| Authentication, permissions, and tenant isolation | Shared | Backend, web, mobile | Partial | Auth guards, scoped mobile services, platform/school planes, pilot role smoke, and browser route-denial coverage existed; API typecheck exposed a missing guardian relation in the internal auth-session type. | Added the selected guardian name relation to `UserWithRoles`; preserved safe guardian metadata only. | Auth service 17-test suite; root lint/typecheck/unit/API E2E/build; pilot and platform smoke; authenticated school/platform route-isolation browser tests; Android session restore, offline failure, and logout checks. | Passed after the type-contract fix; API E2E passed 43 suites / 277 tests outside the listener-restricted sandbox. | Staging tenant-isolation evidence, session-expiry browser evidence, and provider/device-matrix proof remain release gates. | Complete (Internal QA) |
| Role-specific dashboards | Principal, Teacher, Parent | Backend, mobile, web | Complete | Purpose-limited principal, teacher, and parent mobile contracts and dashboard tests existed; the school web dashboard used backend-owned summaries. | No product change required. Manually validated all three active mobile personas against the live local API. | Flutter 462 tests; pilot smoke; authenticated dashboard route audit; Android Principal, Teacher, and Parent walkthroughs. | Passed, including safe unavailable/offline states and persona-appropriate navigation. | iOS device QA is blocked by the incomplete local Xcode installation; staging and pilot usability evidence remain. | Complete (Internal QA) |
| Attendance | Principal, Teacher, Parent | Backend, web, mobile | Complete | Tenant-scoped attendance services, teacher assignment guards, principal oversight, parent summaries, mobile drafts, and web registers existed. A later Stage 2 runtime audit found that the parent summary fabricated 100% when no days were marked. | Submitted one dedicated local Android attendance record and exercised an independent web draft on the untouched Class 10B assignment. Replaced the empty-month 100% fallback with `null` while preserving backend-derived percentages for recorded days. | API unit/E2E; pilot role smoke; authenticated attendance browser smoke; Android mark, relaunch, reconnect, and submit walkthrough; focused attendance service suite (85 tests). | Passed; assigned/unassigned teacher boundaries fail closed, parent/principal views remain scoped, an empty month is unavailable rather than perfect, and one present plus one absent day returns 50%. | Local QA changed seeded attendance data for the tested dates; staging concurrency and real-device network-loss evidence remain. | Complete (Internal QA) |
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
| Missing-submission monitoring | Principal, Teacher | Backend, web, mobile | Partial | Principal attention APIs and web academics workspaces exposed attendance and marks gaps, but the mobile academic readiness percentage divided marks by assessment components and ignored the active-student denominator. | Replaced the invalid ratio with tenant-scoped expected entries (`active students × assessment components`) and submitted non-draft entries, including per-class missing-entry detail. | Focused `MobilePrincipalService` unit suite (24 tests); API typecheck; full API unit regression (217 suites / 1,979 tests); Stage 2 state-changing smoke (16/16). | Live principal reads reconcile every class to aggregate expected, submitted, and missing totals, remain stable across unchanged reads, and reject a teacher with 403. | The calculation still depends on accurate active enrollment/class assignment data; staging volume evidence is outstanding. | Complete (Internal QA) |
| Unified Principal approvals | Principal, Teacher | Backend, mobile, web | Partial | A unified mobile inbox aggregates generic approvals plus legacy leave, attendance-correction, report-card-correction, and urgent-notice rows. Generic approvals had a durable decision contract but no deadline/delegation lifecycle, and final action could previously be labelled applied without an executor. | Made final action fail before mutation when no executor exists; added persisted response deadlines, overdue state, delegated assignee, reasoned delegation, tenant/RBAC checks, mobile purpose-limited delegation, Flutter deadline/overdue/delegation UI, and a compatibility-safe migration. Legacy module rows remain visible but intentionally read-only. | Focused advanced-operations/mobile API suites (44 tests); focused Flutter approval tests (8); API and Flutter analysis/type checks; full API unit regression (217 suites / 1,979 tests); full Flutter regression (491 tests); Stage 2 state-changing smoke (16/16). | Live generic request creation, inbox visibility, deadline state, unavailable-executor 409 without mutation, delegation, delegated-actor denial, reasoned rejection, and idempotent replay pass. A live attendance-correction row is visible without a false generic action. | **Blocked contract:** leave, attendance-correction, and report-card-correction rows are still created and decided by separate source-module lifecycles. The repository has no approved module-owned compatibility contract for shared decision idempotency, deadlines, delegation, evidence, or reconciliation when web and mobile race. Reusing the generic endpoint would create duplicate workflow truth. | Blocked — generic lifecycle complete; legacy decision contract needs owner approval |
| Structured communication | Shared | Backend, web, mobile | Complete | M15 targeted notices and acknowledgements plus M12 recipient resolution, delivery jobs, retries, unread reporting, and provider-safe diagnostics exist; active Chat writes/navigation are removed by architecture policy. Required acknowledgement was not persisted on the notice contract, so parent surfaces could not distinguish mandatory confirmation. | Added the persisted required-acknowledgement flag through Prisma, DTOs, notice create/draft/edit, web composer, notice detail, parent notification feed/detail, safe offline metadata, and the Parent Action Centre. Optional notices now fail closed at the acknowledgement command. No Chat or parallel thread workflow was created. | Communications/mobile API suites (108 tests); focused Flutter notice/action-centre suites; M12/M15 web contracts (104 tests); migration, Prisma, OpenAPI, typecheck, and builds; state-changing parent action/digest smoke (13/13). | Required notice publication, delivery, pending state, idempotent acknowledgement, durable confirmation, removal from current parent actions, and immediate digest refresh pass live local validation. | Real SMS/email/push callbacks, provider credentials, staging retry/escalation timing, and controlled-pilot recipient behavior remain external release gates. | Complete (Internal QA) |
| Attendance correction | Teacher, Parent, Principal | Backend, web, mobile | Partial | M2 already had an audited teacher/admin lifecycle and principal attention row, but the parent mobile contract could not create, list, cancel, or resubmit a linked-child correction. | Extended the existing M2 request model with parent purpose-limited create/list/cancel/resubmit contracts, linked-child and recorded-day checks, duplicate-safe lifecycle rules, online-only Flutter writes, BS dates, and complete mobile states. Reviewer authority and attendance locks remain backend-owned. | Focused attendance/mobile API suites (120 tests); focused Flutter parent suites (40); Flutter analysis; full Flutter regression (491 tests); full API unit regression (217 suites / 1,979 tests); Stage 2 state-changing smoke (16/16). | Live linked-child creation, unrelated-parent denial, Principal inbox visibility, reasoned rejection, parent-visible rejection reason, resubmission, cancellation, and unchanged official attendance truth pass. | Staging concurrency, poor-network retry, and controlled-pilot reviewer evidence remain release gates. | Complete (Internal QA) |
| Payment reconciliation | Accountant, Principal, Parent | Backend, web, mobile | Partial | M3 payment/receipt reconciliation and M11 bank-statement reconciliation workspaces, APIs, audit, and focused browser coverage exist. Parent fee visibility was complete, but incorrect-balance/payment-dispute follow-through was absent. | Added an invoice-linked, tenant-scoped payment-dispute lifecycle through the shared service-request domain. It is idempotent, audited, parent-child scoped, principal/accountant manageable, evidence-capable, and cannot mutate invoice/payment truth. Corrected stale M11 browser assertions without changing the workflow. | Service-request/mobile API suites (46 parent-path and 42 principal-path tests); Flutter parent/principal repository and route suites (129 combined); live dispute lifecycle smoke (15/15); state-changing M11 bank-reconciliation Playwright flow (1/1). | Parent dispute lifecycle and unchanged invoice truth pass live API validation. The browser flow also passed journal create/submit/approve/post, statement import, import idempotency and duplicate rejection, exact auto-match review/confirmation, unmatched retention, backend summary, and protected PDF. | Staging bank-file/provider behavior, finance sign-off, concurrency/volume, and controlled-pilot correction handling remain release gates. | Complete (Internal QA) |
| Parent action centre | Parent | Backend, mobile | Missing | Parent data was exposed through separate source APIs, but no purpose-limited combined action contract or task-first screen existed. Required notice acknowledgement also lacked a durable mandatory flag. | Added a parent-only, linked-child action contract that composes backend-owned required notices, submission-required homework, outstanding invoices, rejected correction follow-up, resolved service-request confirmation, and upcoming exams. It returns bounded tasks, backend counts, live/partial/locked/unavailable source states, and safe app-local routes. Added a live-only Flutter screen with all-child/child filters, BS dates, complete states, strict route validation, active-child handoff, and a More-menu entry; private tasks are not cached. | Mobile API/communications suites (108 tests); focused Flutter model/repository/screen/notice/router/dashboard suites; API and Flutter analysis/typecheck; migration, Prisma, OpenAPI, web/API builds; state-changing parent action/digest smoke (13/13). | Live publication-to-confirmation passed: required notice delivery became an action, all-child and linked-child scopes remained bounded, non-parent access returned 403, acknowledgement replay was idempotent, detail returned confirmed state, and the action disappeared from both current actions and the weekly digest afterward. | Android/iOS screen walkthrough, staging load/performance, provider-delivery timing, and controlled-pilot parent usability evidence remain release gates. | Complete (Internal QA) |
| Weekly progress digest | Parent | Backend, mobile | Missing | Parent APIs exposed individual attendance, homework, result, feedback, deadline, and action sources, but no bounded seven-day explanation contract or task-focused screen. | Added a parent-only linked-child weekly contract with rolling seven-day attendance and submission-required homework summaries, up to five parent-visible teacher comments, five upcoming deadlines, ten required actions, and per-source available/empty/partial/locked/unavailable states. Academic change is emitted only when the two newest published report cards share an academic year, distinct terms, and identical subject/max-mark structure; otherwise all trend fields remain unavailable. Added a live-only Flutter screen with linked-child selection, BS dates, complete states, strict action-route validation, response-child mismatch protection, and no device cache. | Mobile service suite (44 tests); focused Flutter digest/action/repository/router suites (88 tests); Flutter analysis; API typecheck/build; OpenAPI gate; full Flutter regression (491 tests); state-changing parent action/digest smoke (13/13). | Focused tests pass available, non-comparable, module-locked, and shared-source failure paths. Live seeded auth confirms linked-child scope, bounded lists and rates, safe actions, non-parent 403, pending required notice inclusion, and immediate removal after idempotent acknowledgement. Android renders the live selected-child digest with BS dates, honest locked/partial sources, attendance/homework explanations, teacher feedback, deadlines, and required actions. | iOS walkthrough, staging volume/query timing, school review of digest wording, and controlled-pilot parent usability evidence remain release gates. | Complete (Internal QA) |
| Complaint management | Parent, Principal | Backend, mobile | Missing | Historical Chat escalation storage exists only for compatibility and could not be reused. No active lifecycle provided ownership, deadlines, parent-visible status, internal notes, evidence, resolution confirmation, or reopening. | Added a separate tenant-scoped service-request domain with categories/priorities, persisted ownership/deadlines/escalation, visible versus internal notes, protected File Registry evidence, idempotency, cancel/resolve/confirm/reopen rules, existing-tenant permission backfill, parent and principal purpose-limited APIs, and task-focused Flutter screens. Kept M12 delivery, M15 authoring, historical Chat, and safeguarding/emergency handling separate. Android QA exposed and fixed a compact Principal action-button blank screen plus a shared decorated-card/ListTile assertion. | Service-request/mobile API suites (46 parent-path and 42 principal-path tests); Flutter parent/principal repository and route suites (129 combined); compact/shared-card blank-screen regression (27 tests); full Flutter regression (491 tests); API/OpenAPI/Prisma/build checks; live local lifecycle smoke (15/15); Android accessibility-tree walkthrough and empty crash buffer. | The complete parent/principal API lifecycle passes live local validation, including cross-parent denial, note privacy, authenticated evidence, deadlines, close confirmation, and manager pagination. Android renders Principal queue/detail plus parent creation choices, recent status, linked invoice, BS deadline, assigned contact, and parent-visible resolution without framework exceptions. | iOS walkthrough and staging volume/concurrency evidence remain; safeguarding remains a separate Stage 4 policy/security design. | Complete (Internal QA) |

**Stage 2 gate:** not passed because the required legacy approval decision workflow is blocked on an approved module-owned compatibility contract. Seven other Stage 2 workflows pass local Internal QA. The exact dependency is a project-owner/backend-module decision covering one durable idempotency key, decision ownership, deadline policy, delegation authority, evidence mapping, and web/mobile race reconciliation for leave, attendance-correction, and report-card-correction records. The smallest unblock is approval of that shared contract; implementation can then adapt the source services without creating parallel approval truth. Per the roadmap execution rule for genuine blockers, unrelated Stage 3 work may continue while this contract decision is outstanding.

---

## Stage 3 Tracker — Learning Improvement

| Pain point | Role | Platform | Initial status | Evidence found | Work completed | Tests run | Validation result | Remaining risk | Final status |
|---|---|---|---|---|---|---|---|---|---|
| Student early-warning | Principal, Teacher | Backend, web, mobile | Partial | M2 exposes attendance-only risk rows and M4 exposes marks/results, but no bounded, explainable cross-source student support signal or linked follow-up lifecycle existed. | Added a tenant-scoped, server-paginated rules engine over recent attendance, outcome-linked formative evidence, and overdue required homework, with explicit source states, fixed thresholds, active follow-up links, teacher-assignment scope, current-academic-year defaults, and `nonPredictive: true`. Added the M4 web attention view and purpose-limited Principal mobile view without using M13 or M14. | Learning-improvement/controller/mobile API suites (23 tests); M4 web contract (4); focused Flutter learning-support and route suites (70); Prisma validation, generated artifacts, API/web typecheck, OpenAPI, and migration deploy. | Focused evidence passes, including current-year isolation, missing-current-year failure, module-locked sources, teacher scope, and non-predictive wording. The guarded Stage 3 seed and live smoke source typecheck/syntax-check, but could not execute. | Live seeded API smoke, authenticated browser walkthrough, Android walkthrough, staging thresholds/volume, and school review of rule wording remain. | Development complete; live Internal QA blocked |
| Intervention cases | Teacher, Principal | Backend, web, mobile | Missing | No durable case, owner, parent-contact history, follow-up, escalation, progress, or resolution model was found. Historical Chat escalation is compatibility-only and cannot be reused. | Added a separate tenant-scoped M4 student-support case and append-only entry lifecycle with priority, owner, source signal, next follow-up, escalation/resolution state, versioned reasoned transitions, idempotent create/entry writes, audit, internal versus parent-visible summaries, teacher assignment scope, Principal oversight, web management, and teacher/Principal mobile actions. It does not reuse complaints, safeguarding, or Chat. | Same Stage 3 API/web/Flutter suites and compile gates; deterministic fixture and live lifecycle smoke source validation. | Focused tests pass replay protection, changed-payload rejection, safe permissions, versioned transitions, and mobile purpose-limited routes. Live lifecycle execution remains blocked. | Live race/concurrency, parent-summary review, browser/mobile state-changing walkthroughs, and staging audit evidence remain. | Development complete; live Internal QA blocked |
| Learning outcomes | Teacher, Principal, Parent | Backend, web, mobile | Missing | Subjects, marks, CAS, and report cards existed, but no active M4 outcome definition or student mastery contract was found. Frozen M13 topic/activity records are not an acceptable substitute. | Added an additive M4 outcome model and shared contract with tenant, academic-year, class, subject, domain, code, and active state; enforced teacher scope and bounded lists; exposed definitions/progress through the web workspace and teacher/parent purpose-limited summaries while preserving marks and frozen M13 records. | Same Stage 3 API/web/Flutter suites; Prisma schema/migration validation; generated contract, API, web, and Flutter analysis gates. | Focused evidence passes lifecycle-chain typing, tenant/assignment scope, honest empty states, and active M4 routing. | Live seeded outcome creation/state change, authenticated UI walkthroughs, and curriculum-owner review of codes remain. | Development complete; live Internal QA blocked |
| Formative assessments | Teacher, Parent | Backend, web, mobile | Partial | M4 had assessment components, marks, CAS, and retakes, but no outcome-linked formative evidence, mastery timeline, or safe reassessment chain. | Added outcome-linked observation/check/quiz evidence with mastery state, bounded paired scores, assessment date, checklist, optional parent summary, reassessment link, teacher/client idempotency, audit, assignment checks, server-derived progress, web entry, and teacher mobile recording. Existing marks/report-card truth is unchanged. | Same Stage 3 API/web/Flutter suites; focused score-bound and replay tests; compile/OpenAPI gates. | Focused tests reject incomplete or out-of-range scores, preserve idempotency, scope teacher writes, and expose only teacher-approved parent wording. | Live write/replay, reassessment-chain, browser/mobile form, and staging concurrency evidence remain. | Development complete; live Internal QA blocked |
| Remedial groups | Teacher, Principal, Parent | Backend, web, mobile | Missing | No tenant-scoped remedial group, membership, outcome focus, ownership, schedule, or parent-visible participation contract was found. | Added M4 remedial groups with academic/class/section/subject/outcome scope, responsible teacher, bounded membership changes, active/completed/cancelled lifecycle, schedule, optional parent-safe summary, audit, web management, and teacher/parent mobile visibility. No ranking or comparative labels are exposed. | Same Stage 3 API/web/Flutter suites; Prisma, contract, typecheck, and migration gates. | Focused contract and screen evidence passes assignment-scoped operations, supportive wording, and linked-child visibility boundaries. | Live group/membership mutation, concurrent membership, authenticated UI, and school wording review remain. | Development complete; live Internal QA blocked |
| Curriculum progress | Teacher, Principal | Backend, web, mobile | Partial | `SyllabusTopic` stores a subject topic and one completion boolean, but not academic-year/section planning, missed lessons, re-teaching, pacing, or active M4 resource links. Its M13 relations remain frozen. | Preserved `SyllabusTopic` and added a separate active M4 curriculum-progress record with academic/class/section/subject/outcome scope, planned/completed dates, missed lessons, reteach/resource notes, explicit status, audit, server pagination, web operations, and purpose-limited teacher/Principal visibility. No predictive pacing score was added. | Same Stage 3 API/web/Flutter suites; URL/DTO contract, Prisma, generated-artifact, typecheck, and OpenAPI gates. | Focused evidence passes active-M4 separation, status-chain typing, BS date rendering, and non-predictive wording. | Live lifecycle, resource-link usability/security review, authenticated UI, and staging query-volume evidence remain. | Development complete; live Internal QA blocked |
| Grades 1–3 foundational learning | Teacher, Parent | Backend, web, mobile | Partial | M5 developmental milestones support scoped, idempotent observations and parent visibility, including reading and number-skill templates, but no Grade 1–3 reading/numeracy outcome level, checklist, assessment, or dedicated progress summary existed. | Reused the new M4 outcome/evidence path with foundational-reading and foundational-numeracy domains; backend enforcement restricts those domains to Grades 1–3. Added checklist evidence, supportive mastery progress, teacher recording, and linked-parent summary without changing M5 milestones or frozen M13. | Same Stage 3 suites, including focused grade-boundary rejection and parent/teacher screen tests; API/web/Flutter analysis gates. | Focused tests reject foundational domains outside Grades 1–3 and keep output child-specific, non-comparative, and current-year scoped. | Live Grades 1–3 fixture walkthrough, educator review of evidence/checklists, and controlled-pilot usability remain. | Development complete; live Internal QA blocked |
| Parent learning guidance | Parent, Teacher | Backend, mobile | Missing | Weekly progress and milestones provided recent facts, but no teacher-approved skill explanation, home activity, remedial visibility, or non-comparative outcome summary contract existed. | Added draft/published/archived guidance with academic-year, linked child, subject/outcome, home activity, optional visibility window, teacher approval/audit, and web authoring. Added a live-only parent mobile summary of current-year outcome progress, published guidance, parent-safe remedial participation, and parent-visible intervention updates; internal notes and comparisons are excluded. | Same Stage 3 API/web/Flutter suites, including linked-child denial, current-year filtering, parent screen, repository, and route tests; compile/OpenAPI gates. | Focused evidence passes parent-only and linked-child scope, published/time-window filtering, current-year isolation, supportive language, and honest empty/source states. | Live parent publication/expiry walkthrough, Android/iOS device QA, school wording review, and controlled-pilot evidence remain. | Development complete; live Internal QA blocked |

**Stage 3 gate:** not passed. All eight implementations are development-complete with focused API, web, Flutter, Prisma, OpenAPI, migration, and typecheck evidence. The sandbox denied the TypeScript seed runner's IPC socket and the local API could not bind/connect to required services; the required escalated launches were then rejected because the approval service reported the user's execution-approval limit was exhausted. The deterministic seed, `smoke:stage3`, authenticated browser walkthrough, and Android live walkthrough therefore remain unexecuted. No alternate command was used to bypass that restriction. The smallest unblock is restored execution approval for the guarded Stage 3 fixture and local API, followed by the live smoke and UI checks.

---

## Stage 4 Tracker — Institutional Improvement

| Pain point | Role | Platform | Initial status | Evidence found | Work completed | Tests run | Validation result | Remaining risk | Final status |
|---|---|---|---|---|---|---|---|---|---|
| Teacher development | Principal, HR, Teacher | Backend, web, mobile | Missing | Staff, timetable, HR, and training-adjacent records existed, but the active Principal mobile walkthrough was a read-only timetable snapshot and no durable observation, development-goal, mentor, follow-up, or training-history lifecycle existed. | Added tenant-scoped classroom observations, reasoned/versioned follow-up, teacher acknowledgement, development goals, mentors, follow-up, training history, protected certificates, audit, current-year summaries, server pagination, web HR workspace, and purpose-limited Principal mobile create/follow-up flows with BS dates and online-only writes. Added concurrent-create replay protection to every idempotent Stage 4 create path. | Institutional-improvement API suite (7 tests after hardening); mobile Principal controller suite; Stage 4 web contract (3); Flutter Principal repository/route suites (76) plus mobile Stage 4 contract (3); root lint/typecheck/test/build; full Flutter regression (509) and analysis; Prisma migration deploy; API E2E rerun. | Focused evidence passes tenant denial, current-year failure, idempotent replay, optimistic concurrency, protected-file permission mapping, reason-required UI, safe mobile routes, and honest loading/empty/error/permission states. Root gates, the production web build, and all Flutter tests pass. API E2E passes 40 of 43 suites / 255 of 277 tests; all 22 remaining tests are in three HTTP-only suites that the sandbox prevents from binding with `listen EPERM`. | Guarded fixture execution, live API lifecycle smoke, authenticated browser walkthrough, Android/iOS walkthrough, staging concurrency, and school review of observation wording remain. | Development complete; live Internal QA blocked |
| School improvement planning | Principal, School leadership | Backend, web, mobile | Missing | No durable plan baseline/target, measurable indicators, owned actions, protected evidence, monthly review, or versioned lifecycle was found. | Added tenant/current-year plans with active-user ownership, measurable indicators, owned dated actions, protected evidence, monthly KPI snapshots in one transaction, reasoned/versioned plan and action transitions, audit, pagination, web plan creation/detail/review, and purpose-limited Principal mobile action updates. Terminal actions cannot be reopened. | Same Stage 4 API/web/Flutter suites; action-transition regression; Prisma validation/generation and local migration deploy. | Focused evidence passes owner validation, action-before-plan completion, terminal-state protection, reasoned updates, protected evidence access, server pagination, and BS date rendering. | Live seeded plan/action/review smoke and UI walkthroughs are blocked; plan-amendment governance, staging volume, and controlled-pilot leadership review remain. | Development complete; live Internal QA blocked |
| Grade 8 readiness | Principal, Teacher | Backend, web, mobile | Partial | Generic academics readiness exposed some marks/report-card state, but no Grade 8 cohort contract reconciled active learners, latest-term marks, current report cards, and iEMIS readiness. | Added a current-year Grade 8 rules-only readiness contract with backend-owned expected/submitted counts, explicit source states, drill-through routes, bounded iEMIS batches, and web/Principal mobile views. The response is `nonPredictive: true` and contains no rank, pass-probability, or predicted-result field. | Readiness service tests; Stage 4 web contract; Flutter repository/mobile contract; API/web typecheck and Flutter analysis. | Focused checks pass backend-owned ratio calculation, unavailable/empty handling, non-predictive copy, purpose-limited mobile access, and bounded 250-record iEMIS processing. | Live seeded Grade 8 data reconciliation, browser/mobile walkthroughs, board-process owner review, and staging volume evidence remain. | Development complete; live Internal QA blocked |
| SEE readiness | Principal, Teacher | Backend, web, mobile | Partial | Generic academics workspaces existed, but there was no SEE-specific current-year readiness contract or safe combined view. | Added the same explainable Grade 10/SEE operational contract and web/mobile surfaces, using active learners, latest exam term, expected non-draft marks, current ready/published report cards, and backend-owned iEMIS validation. | Readiness service regression proves 3 of 4 expected marks produces `NEEDS_ATTENTION` while 2 of 2 iEMIS-ready learners produces `READY`; shared Stage 4 web/Flutter/typecheck gates pass. | Focused evidence reconciles the cohort and source counts without deriving a predictive score. | Live SEE fixture reconciliation, school/board-process review, authenticated UI, and staging performance remain. | Development complete; live Internal QA blocked |
| Grade 12 readiness | Principal, Teacher | Backend, web, mobile | Partial | Grade 12 academic records could be managed through generic M4 screens, but no Grade 12 board-readiness composition or safe source-state contract existed. | Added the same current-year Grade 12 operational readiness path, web track, and Principal companion view while preserving higher-education scope boundaries. | Shared Stage 4 readiness, web, Flutter, typecheck, Prisma, and migration gates. | Focused evidence confirms Grade 12 maps only to school-supported level 12 and does not activate Bachelor/Master or predictive behavior. | Live Grade 12 fixture reconciliation, board-process owner review, authenticated UI, and staging performance remain. | Development complete; live Internal QA blocked |
| IEMIS-compatible exports | Principal, School administration | Backend, web | Partial | The existing readiness workspace and File Registry export path were substantial, but the export response redundantly returned raw headers, rows, and CSV beside the protected file, and the new board composition initially depended on an unbounded per-class validation read. | Removed raw export contents from API/shared contracts, retained only protected file metadata and bounded issues, preserved Storage → File Registry flow, updated service/integration tests, and changed board readiness to exact tenant-scoped 250-record validation batches. | Student iEMIS and institutional-improvement suites (17 focused tests); student-service export regression; lifecycle integration contract; API/web typecheck; existing iEMIS web contract; Prisma migration deploy. | Focused evidence confirms stored CSV content remains correct while JSON contains no `csv`, `rows`, or `headers`; board counts remain exact without an unbounded in-memory read. | Live protected download and role-denial walkthrough, production storage/provider proof, staging volume, and government-format owner sign-off remain. | Development complete; live Internal QA blocked |
| Safeguarding case management | Student, Parent, Teacher, Principal, designated safeguarding staff | Backend, web, mobile | Missing | Complaints/service requests, emergency notices, audit, and protected files exist, but none is an approved substitute for confidential safeguarding. The repository has no owner-approved concern taxonomy, restricted safeguarding role, immediate-danger routing, disclosure boundary, retention/deletion rule, statutory escalation rule, or survivor-safe notification policy. | No unsafe parallel case workflow was created. Existing complaints, Chat compatibility data, M12 delivery, and emergency notices remain separate. Real safeguarding concerns remain subject to immediate human escalation under the roadmap exception. | Repository/schema/controller/permissions/navigation audit; no runtime test can validate an unapproved policy contract. | Correctly fails closed: there is no generic complaint-to-safeguarding conversion, broad Principal queue, parent-visible internal note, or active Chat reuse. | **Blocked policy/security contract:** requires a named safeguarding owner and specialist-reviewed decision covering restricted roles, concern categories, immediate danger and mandatory-reporting routes, consent/disclosure, evidence access, notifications, retention/deletion, audit/support override, closure/reopening, and school/country escalation contacts. The smallest unblock is owner approval of that contract before schema/API/UI work. | Blocked — specialist policy and security design required |
| Assistive AI features | Shared | Shared | Deferred | No approved M14 runtime contract, model/provider boundary, consent basis, evaluation set, human-review rule, audit/redaction policy, or release acceptance evidence exists. Repository policy keeps M14 roadmap-only and says advanced AI must not delay the reliable daily operating core. | No AI feature, provider integration, learner ranking, predictive readiness, automated safeguarding decision, or synthetic production result was added. Stage 3/4 signals remain fixed-rule, explainable, and explicitly non-predictive. | Repository policy, active-module, route, dependency, and Stage 3/4 output audit; web/mobile contracts reject predictive wording. | The supported product remains free of unapproved M14 behavior. | **Deferred approval dependency:** project-owner approval is required to scope one assistive, human-reviewed, non-authoritative use case after core release evidence is stronger, followed by privacy/security design, evaluation thresholds, provider configuration, cost/latency limits, red-team evidence, opt-out, monitoring, and rollback. | Deferred — M14 not approved for active implementation |

**Stage 4 gate:** not passed. Six implementation items are development-complete. Root lint, typecheck, unit/contract tests, and production build pass; the full Flutter suite passes 509 tests with clean analysis; focused Stage 4 API/web/mobile evidence and the local Prisma migration pass. The API E2E rerun passes 40 of 43 suites / 255 of 277 tests, with all 22 remaining tests confined to three HTTP-only suites that fail because the sandbox denies listener binding with `listen EPERM`. Live seeded API/browser/device validation is blocked by the same exhausted execution-approval path described in the Stage 3 gate. Safeguarding is separately blocked on specialist-reviewed policy/security ownership, and assistive AI remains explicitly deferred under the active M14 boundary. The guarded Stage 4 fixture and `smoke:stage4` are present, but the sandbox denied the fixture runner's IPC socket; no alternate command was used to bypass that restriction. The smallest technical unblock is restored execution approval for the guarded seed and local API. The safeguarding and M14 dependencies require separate owner decisions and do not justify inventing contracts.

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
