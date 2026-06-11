# SchoolOS Learning Layer Plan

**Status:** New product vertical plan
**Scope:** Teacher-led classroom learning, smart-board activities, school-only computer-lab practice, progress tracking, and safe future AI support
**Relationship to SchoolOS Core:** Separate learning domain that reuses existing SchoolOS management data and platform foundations

---

## 1. Purpose

SchoolOS currently provides the school-management backbone: platform setup, admissions, students, attendance, fees, academics, homework, timetable, HR/payroll, library, transport, canteen, accounting, communication, and future intelligence.

The Learning Layer adds a second product capability:

```text
SchoolOS Core Management = runs the school
SchoolOS Learning Layer = improves how teaching and learning happen inside the school
```

The Learning Layer must not become a screen-addictive student entertainment app. It should be a teacher-controlled classroom learning system designed for Nepal schools, where smart boards, projectors, and shared computer labs may be more realistic than one-device-per-student access.

Core goals:

```text
1. Help teachers teach subjects interactively.
2. Let teachers create pre-planned or on-the-spot activities.
3. Use smart boards for whole-class interaction.
4. Use computer labs for individual practice and progress recording.
5. Keep activities school-only by default.
6. Support Easy / Medium / Hard differentiation.
7. Record meaningful progress without harmful ranking.
8. Support English, Nepali, and mixed classroom language.
9. Work in low-bandwidth Nepal school environments.
10. Keep AI teacher-reviewed and future-phase only.
```

---

## 2. Product Positioning

Use the following naming:

```text
SchoolOS Core = M0 to M11 management modules
SchoolOS Learning = M12 Learning Layer
SchoolOS Intelligence = M11/M12-safe intelligence roadmap after production data exists
```

The Learning Layer should be implemented as its own domain/module, not scattered inside existing modules.

Correct architecture:

```text
apps/api/src/learning/
apps/web/app/dashboard/learning/
apps/web/app/classroom/board/
apps/web/app/student/learning/
apps/web/app/parent/learning/
packages/core/src/learning/
```

Incorrect architecture:

```text
apps/api/src/students/learning-progress/
apps/api/src/academics/activity-builder/
apps/api/src/timetable/lab-session/
apps/api/src/communications/parent-learning-summary/
```

Existing modules should provide data and permissions. The Learning Layer should own activity, session, attempt, progress, and mastery logic.

---

## 3. Nepal-First Learning Principles

### 3.1 Teacher-led first

Teachers must remain in control. Technology supports the lesson; it does not replace teacher explanation, classroom discussion, notebooks, books, experiments, handwriting, or physical activities.

### 3.2 School-only by default

Interactive activities should normally run only during school-controlled sessions:

```text
- teacher-started smart-board session
- teacher-started computer-lab session
- valid session code or QR
- active school timetable period where possible
- student belongs to the assigned class/section
```

Parents may see summaries and teacher-approved home suggestions, but not unrestricted interactive activity access in the first version.

### 3.3 Works without one-device-per-student

Support multiple modes:

```text
SMART_BOARD     = one board/projector, whole class
GROUP           = students participate in teams
COMPUTER_LAB    = individual attempts in school lab
WORKSHEET       = printable low-tech fallback
HYBRID          = board explanation + lab practice
```

### 3.4 Bilingual and local examples

Support:

```text
English
Nepali
Mixed English-Nepali
```

Use familiar Nepal examples: momo, roti, rice, rupees, monsoon, Terai, Hills, Himalayas, Lumbini, Bagmati, local markets, school bus, crops, festivals, and local community life.

### 3.5 Safe screen-time philosophy

The platform must avoid:

```text
- infinite scrolling
- autoplay loops
- public leaderboards for children
- open student chat
- open AI chatbot
- addictive random rewards
- harsh labels like weak / failed / poor
```

Use supportive progress labels:

```text
Needs practice
Improving
Ready
Strong
```

---

## 4. Learning Layer Submodules

```text
M12-L0 Learning Foundation
M12-L1 Curriculum & Topic Map
M12-L2 Teacher Activity Builder
M12-L3 Smart Board Classroom Mode
M12-L4 School-Only Learning Sessions
M12-L5 Computer Lab Individual Mode
M12-L6 Practice & Quiz Engine
M12-L7 Subject Activity Labs
M12-L8 Progress & Mastery Tracking
M12-L9 Parent Learning Summary
M12-L10 Learning Resource Library
M12-L11 Adaptive Recommendations
M12-L12 Safe AI Assistant Later
```

### M12-L0 Learning Foundation

Base permissions, tenant isolation, feature entitlement, class/subject mapping, session policies, and shared learning enums.

Responsibilities:

```text
- tenant-scoped learning data
- Learning module entitlement check
- teacher assignment validation
- class/section/subject ownership validation
- school-only access policies
- shared activity modes and difficulty levels
```

### M12-L1 Curriculum & Topic Map

Maps learning activities to class, subject, chapter, topic, and learning outcome.

MVP can reuse existing M4 Academics subject/class structures. Full chapter/topic/outcome models can be added gradually.

### M12-L2 Teacher Activity Builder

Allows teachers to create activities before class or instantly during class.

Teacher activity types:

```text
Pre-planned activity
On-the-spot quick activity
Reusable template activity
Worksheet activity
Lab practice activity
Smart-board group activity
```

MVP templates:

```text
MCQ
True / False
Fill in the blanks
Match the following
Quick poll
Short answer
```

Later templates:

```text
Drag and drop
Diagram labeling
Map pointing
Sequencing
Sorting
Graph interaction
Coding challenge
Simulation task
```

### M12-L3 Smart Board Classroom Mode

Whole-class teacher-led activity runtime.

Smart board requirements:

```text
- full-screen route
- large text and visuals
- touch-friendly layout
- teacher next/back/pause/end controls
- no admin sidebar
- no sensitive admin data
- board-safe renderer for approved activity schemas
- optional group/team participation
```

Route:

```text
/classroom/board/session/[sessionId]
```

### M12-L4 School-Only Learning Sessions

Controls live classroom/lab sessions.

MVP access rules:

```text
- session must be LIVE
- session must not be expired
- session must be started by assigned teacher
- student must belong to the assigned class/section
- valid session code or QR is required
- tenantId must match
```

Later optional rules:

```text
- school Wi-Fi/IP range check
- lab device whitelist
- smart board device registry
- teacher heartbeat
- timetable period enforcement
```

### M12-L5 Computer Lab Individual Mode

Students join a teacher-started session from school computer labs and complete activities individually.

Student lab route:

```text
/student/learning/join
/student/learning/session/[sessionId]
```

Computer lab features:

```text
- session code / QR join
- student attempt screen
- locked activity flow
- autosave
- submit confirmation
- sync-pending state
- teacher live progress dashboard
```

### M12-L6 Practice & Quiz Engine

Responsible for question rendering, answer collection, scoring, and idempotent submission.

MVP question types:

```text
MCQ
TRUE_FALSE
FILL_BLANK
MATCHING
QUICK_POLL
SHORT_ANSWER
```

Submission rules:

```text
- no duplicate attempt creation on refresh/double-click
- autosave is idempotent
- scoring is backend-owned
- answer changes after submit are blocked unless teacher allows retry
- offline/sync-pending attempts must resolve deterministically
```

### M12-L7 Subject Activity Labs

Subject-specific interactive tools added after the MVP.

Examples:

```text
Math Manipulative Lab
Science Simulation Lab
Nepali / English Reading Studio
Social Studies Nepal Map Explorer
Computer Coding Lab
Accountancy Ledger Simulator
Economics Graph Lab
Creative Studio
Life Skills Scenario Lab
```

These are not Phase 1. They should come only after the activity/session/attempt/progress foundation is stable.

### M12-L8 Progress & Mastery Tracking

Tracks learning without harmful ranking.

Record:

```text
- activity attempted
- topic attempted
- difficulty level
- accuracy
- time spent
- hints used
- retry count
- repeated mistakes
- improvement over time
```

Teacher view:

```text
- class completion
- average accuracy
- common wrong answers
- students needing support
- topics needing revision
- activity effectiveness
```

Parent view:

```text
- completed school activities
- improving topics
- needs-practice topics
- teacher note
- offline home suggestion
```

### M12-L9 Parent Learning Summary

Parent-safe summary only. No public rankings, no comparison with other students, no harsh labels.

Example summary:

```text
This week:
Math: Improving in fractions
Science: Strong in plant parts
English: Needs more reading practice
Suggested home activity: Read one short story together for 10 minutes.
```

### M12-L10 Learning Resource Library

Teacher-approved images, diagrams, audio, worksheets, stories, and low-bandwidth assets.

Must use File Registry and Storage boundaries.

### M12-L11 Adaptive Recommendations

Rule-based first. No AI required.

Examples:

```text
If class average is low on a topic -> suggest revision activity to teacher.
If student repeatedly struggles on hard level -> recommend medium/easy practice.
If many students miss the same question -> mark concept for reteaching.
```

### M12-L12 Safe AI Assistant Later

Future only after Learning Layer has reliable content, activity, and progress data.

Allowed later:

```text
- teacher activity suggestions
- teacher-reviewed question generation
- hint suggestions
- bilingual explanation drafts
- reading support
```

Not allowed:

```text
- open student chatbot
- full homework answer generator
- unreviewed AI-published content
- private student-AI emotional companion
- automated punishment or ranking
```

---

## 5. Grade-Level Learning Strategy

### Kindergarten / ECD / LKG / UKG

Mode:

```text
Smart-board teacher-led only
```

Activity examples:

```text
picture matching
letter/अक्षर sounds
number counting
colors and shapes
rhymes
story sequencing
oral response
movement-based activities
```

Session style:

```text
3-8 minute bursts
teacher-guided
no independent home access
```

### Class 1-3

Mode:

```text
Smart-board + very short guided practice
```

Activity examples:

```text
phonics
Nepali letters and words
number line
basic addition/subtraction
picture vocabulary
simple science sorting
story comprehension
```

### Class 4-6

Mode:

```text
Smart-board explanation + group/lab practice
```

Activity examples:

```text
fractions with roti/pizza/chocolate
multiplication arrays
science diagrams
plant/animal classification
Nepal map basics
grammar practice
short quizzes
```

### Class 7-8

Mode:

```text
Smart-board concepts + computer-lab individual practice
```

Activity examples:

```text
algebra steps
geometry visualizer
science simulations
map/timeline activities
paragraph writing
coding basics
digital safety
```

### Class 9-10

Mode:

```text
concept mastery + SEE-style exam preparation + lab practice
```

Activity examples:

```text
math step solving
science diagram labeling
mock tests
mistake notebook
essay practice
social studies timeline/map practice
```

### Class 11-12

Mode:

```text
advanced subject practice, simulations, projects, exam analytics
```

Activity examples:

```text
Physics graph simulation
Chemistry reaction balancing
Biology process diagrams
Accountancy journal-to-ledger simulation
Economics demand/supply graph
Computer Science coding lab
Business case studies
```

---

## 6. Integration With Existing SchoolOS Modules

The Learning Layer should reference existing modules rather than duplicate their logic.

| Existing Module | Learning Integration |
|---|---|
| M0 Platform Core | module entitlement, plan limits, feature flags, tenant policies |
| M1 Students | student roster, class, section, guardian links, enrollment status |
| M2 Attendance | present/absent context for session participation interpretation |
| M3 Fees | normally separate; do not block learning because fees are unpaid unless explicitly configured and legally/pedagogically reviewed |
| M4 Academics | subjects, chapters, topics, learning outcomes, exam/report insights |
| M5 Activity Feed | optional teacher-approved class learning milestones |
| M6 Homework / Timetable | quick activity auto-select from current period, homework-linked practice |
| M7 HR / Payroll | active staff and teacher assignment validation |
| M8A Library | topic-linked book/resource recommendations |
| M8B Transport | mostly separate; can support school-day context only |
| M8C Canteen | mostly separate; can support health/nutrition activities later |
| M9 Accounting | separate; only SaaS/platform learning add-on billing belongs here |
| M10 Communication | parent summaries, teacher reminders, learning notices |
| M11 Intelligence / AI | future teacher-reviewed AI/adaptive support only |

---

## 7. Permission and Access Rules

### Teacher can create/launch activity only when

```text
teacher is active staff
AND teacher belongs to same tenant
AND teacher is assigned to the class/section
AND teacher is assigned to the subject
AND subject belongs to the class curriculum
AND Learning module is enabled
AND permission allows learning activity management
```

### Student can join lab session only when

```text
student belongs to same tenant
AND student belongs to session class/section
AND session is LIVE
AND session is not expired
AND valid session code/QR is supplied
AND school-only policy passes
```

### Parent can see only

```text
their linked child summary
no other students
no class leaderboard
no raw private attempt data unless school allows
```

### Admin can configure

```text
learning module enable/disable
school-only policy
allowed modes
screen-time/session limits
teacher permissions
AI disabled/enabled later
```

---

## 8. Backend Architecture

Add:

```text
apps/api/src/learning/
├── learning.module.ts
├── learning.permissions.ts
├── learning.constants.ts
├── learning.types.ts
├── activities/
├── sessions/
├── attempts/
├── progress/
├── resources/
└── parent-summary/
```

MVP services:

```text
LearningActivitiesService
LearningActivityPermissionsService
LearningSessionsService
LearningSessionAccessService
LearningAttemptsService
LearningAnswerEvaluatorService
LearningProgressService
ParentLearningSummaryService
```

MVP controllers:

```text
LearningActivitiesController
LearningSessionsController
LearningAttemptsController
LearningProgressController
ParentLearningSummaryController
```

---

## 9. Frontend Architecture

Teacher/admin dashboard routes:

```text
/dashboard/learning
/dashboard/learning/activities
/dashboard/learning/activities/new
/dashboard/learning/activities/[activityId]
/dashboard/learning/sessions
/dashboard/learning/sessions/[sessionId]
/dashboard/learning/smart-board/launch
/dashboard/learning/lab
/dashboard/learning/progress
```

Smart board route:

```text
/classroom/board/session/[sessionId]
```

Student lab route:

```text
/student/learning/join
/student/learning/session/[sessionId]
```

Parent route:

```text
/parent/learning
/parent/learning/progress
```

Component groups:

```text
components/learning/activity-builder/
components/learning/smart-board/
components/learning/lab/
components/learning/question-renderers/
components/learning/progress/
```

---

## 10. Shared Core Contracts

Add:

```text
packages/core/src/learning/
├── learning.enums.ts
├── learning.types.ts
├── learning.permissions.ts
├── learning-api.types.ts
└── index.ts
```

Shared enums:

```text
LearningActivityType
LearningDifficulty
LearningMode
LearningAccessType
LearningLanguageMode
LearningActivityStatus
LearningSessionMode
LearningSessionStatus
LearningJoinMethod
LearningAttemptStatus
LearningMasteryLevel
```

---

## 11. Database Model Preview

Core MVP models:

```text
LearningActivity
LearningQuestion
LearningSession
LearningParticipant
LearningAttempt
LearningAnswer
LearningProgress
LearningResource
```

Future models:

```text
LearningCurriculum
LearningChapter
LearningTopic
LearningOutcome
LearningDevice
ComputerLabDevice
ParentLearningSummary
```

Required rule:

```text
Every Learning table must include tenantId or be reachable only through a tenant-owned parent.
Every Learning query must be tenant-scoped.
```

Important fields for `LearningActivity`:

```text
id
tenantId
title
description
classId
sectionId
subjectId
chapterId
topicId
teacherId
activityType
difficulty: EASY / MEDIUM / HARD
mode: SMART_BOARD / COMPUTER_LAB / HYBRID / WORKSHEET
accessType: SCHOOL_ONLY
languageMode: EN / NE / MIXED
estimatedMinutes
status: DRAFT / SCHEDULED / PUBLISHED / ARCHIVED
createdBy
approvedBy
createdAt
updatedAt
```

Important fields for `LearningSession`:

```text
id
tenantId
activityId
classId
sectionId
subjectId
teacherId
mode
sessionCode
qrTokenHash
status: PLANNED / LIVE / PAUSED / ENDED / EXPIRED
schoolOnly: true
startedAt
endedAt
expiresAt
teacherHeartbeatAt
```

Important fields for `LearningAttempt`:

```text
id
tenantId
sessionId
activityId
studentId
startedAt
submittedAt
score
accuracy
timeSpentSeconds
hintsUsed
attemptNumber
status: IN_PROGRESS / SUBMITTED / AUTO_SUBMITTED / SYNC_PENDING
```

---

## 12. Offline and Low-Bandwidth Support

MVP:

```text
- activity pre-load before class
- lightweight assets
- no heavy autoplay video
- retry states
- sync-pending indicators
```

Later:

```text
- PWA cache for board/lab routes
- IndexedDB event queue
- batch sync endpoint
- deterministic conflict handling
```

Candidate endpoint:

```text
POST /learning/sessions/:id/events/batch
```

---

## 13. API Endpoint Draft

MVP endpoints:

```text
GET    /learning/activities
POST   /learning/activities
GET    /learning/activities/:id
PATCH  /learning/activities/:id
DELETE /learning/activities/:id

POST   /learning/activities/:id/sessions
GET    /learning/sessions/:id
POST   /learning/sessions/:id/pause
POST   /learning/sessions/:id/resume
POST   /learning/sessions/:id/end

POST   /learning/sessions/join
POST   /learning/sessions/:id/attempts
PATCH  /learning/attempts/:id/autosave
POST   /learning/attempts/:id/submit

GET    /learning/progress/class/:classId
GET    /learning/progress/student/:studentId
GET    /parent/learning/summary
```

---

## 14. Testing Requirements

Backend E2E tests:

```text
apps/api/test/learning-activity-permissions.e2e-spec.ts
apps/api/test/learning-session-school-only.e2e-spec.ts
apps/api/test/learning-attempt-progress.e2e-spec.ts
apps/api/test/learning-parent-summary-scope.e2e-spec.ts
apps/api/test/learning-cross-tenant-denial.e2e-spec.ts
```

Web E2E tests:

```text
apps/web/e2e/learning-activity-builder.spec.ts
apps/web/e2e/learning-smart-board.spec.ts
apps/web/e2e/learning-lab-session.spec.ts
apps/web/e2e/learning-parent-summary.spec.ts
```

Required test cases:

```text
teacher cannot create activity for unassigned class
teacher cannot create activity for unassigned subject
teacher cannot launch another tenant's activity
student cannot join inactive/expired session
student cannot join another class session
parent cannot view another child summary
cross-tenant activity access is denied
autosave is idempotent
submit is idempotent
progress updates only after valid submission
school-only session code expires correctly
```

---

## 15. Implementation Phases

### Phase M12-0 — Design and Schema Readiness

Scope:

```text
- update product/functional requirements
- add shared enums/types
- add Prisma model draft
- verify no overlap with M1/M4/M6/M7/M10 ownership
```

Exit criteria:

```text
Learning is documented as a separate domain.
No duplicate student/class/subject/teacher/parent models are introduced.
```

### Phase M12-1 — Backend Foundation

Scope:

```text
- packages/core/src/learning shared contracts
- LearningActivity CRUD
- teacher assignment permission checks
- tenant isolation checks
- basic question schema
```

Exit criteria:

```text
Teacher can create draft activity only for assigned class/subject.
Cross-tenant and unassigned-class tests pass.
```

### Phase M12-2 — Smart Board MVP

Scope:

```text
- LearningSession start/pause/resume/end
- Smart-board full-screen route
- MCQ / true-false / fill-blank / quick-poll renderers
- teacher control panel
- session summary
```

Exit criteria:

```text
Teacher can launch and complete one smart-board activity for an assigned class.
```

### Phase M12-3 — Computer Lab MVP

Scope:

```text
- session code/QR join
- student lab session screen
- answer autosave
- submit attempt
- backend scoring
- teacher live progress summary
```

Exit criteria:

```text
Students can complete school-only lab activity and progress is recorded.
```

### Phase M12-4 — Progress and Parent Summary

Scope:

```text
- LearningProgress update
- mastery labels
- class progress dashboard
- parent weekly learning summary
- M10 notification integration
```

Exit criteria:

```text
Teacher sees class/topic progress and parent sees safe child-only summary.
```

### Phase M12-5 — Low-Bandwidth and Offline Hardening

Scope:

```text
- retry/sync-pending UI
- activity pre-load
- batch event sync
- conflict-safe autosave handling
```

Exit criteria:

```text
Short internet failure does not lose board/lab session work.
```

### Phase M12-6 — Subject Activity Labs

Scope:

```text
- Math manipulatives
- Science diagrams/simulations
- Nepali/English reading studio
- Social Studies Nepal map explorer
- Computer coding basics
- Class 11-12 subject labs later
```

Exit criteria:

```text
Subject labs are added only after core activity/session/progress system is stable.
```

### Phase M12-7 — Safe AI Later

Scope:

```text
- teacher-only activity suggestions
- teacher-reviewed question generation
- hint suggestions
- bilingual explanation drafts
```

Exit criteria:

```text
No unreviewed AI content reaches students.
No open student chatbot exists.
```

---

## 16. MVP Scope

First release must include only:

```text
1. Teacher Activity Builder
2. Easy / Medium / Hard difficulty
3. Smart Board Mode
4. School-only Learning Sessions
5. Computer Lab Individual Mode
6. Basic Practice & Quiz Engine
7. Progress Recording
8. Parent Summary foundation
```

Do not include in MVP:

```text
AI tutor
advanced simulations
full home learning app
public leaderboards
open chat
heavy video platform
complex adaptive engine
subject labs for every grade
```

---

## 17. Codex Implementation Prompt

Use this when starting M12 Learning work:

```text
Read README.md, AGENTS.md, docs/project/SCHOOLOS_PROJECT_STATUS.md, docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md, docs/project/SCHOOLOS_LEARNING_LAYER_PLAN.md, docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md, docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md, docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md, and docs/design/SCHOOLOS_UI_UX_GUIDE.md.

Goal:
Implement SchoolOS M12 Learning Layer gradually as a separate learning domain that reuses existing SchoolOS Core data and permissions.

Start only after current Phase Gate and pilot reliability checks are stable.

MVP order:
1. Add shared learning enums/types/permissions in packages/core/src/learning.
2. Add Prisma models for LearningActivity, LearningQuestion, LearningSession, LearningParticipant, LearningAttempt, LearningAnswer, LearningProgress, and LearningResource.
3. Implement backend activity CRUD with tenant isolation and teacher assigned-class/subject checks.
4. Implement school-only session start/join/end logic.
5. Implement attempt autosave/submit and backend scoring.
6. Implement basic teacher dashboard UI for activity creation.
7. Implement smart-board runtime route.
8. Implement student computer-lab join/session route.
9. Implement progress and parent summary foundation.

Rules:
- Do not duplicate student, class, section, subject, teacher, parent, notification, or file-storage systems.
- Learning must reference existing M1/M4/M6/M7/M10 entities.
- Every learning query must be tenant-scoped.
- Teachers can create/launch activities only for assigned class/section/subject.
- Students can join only active sessions for their class/section.
- Parents can view only their linked child summary.
- Use school-only session logic by default.
- Do not implement AI in the MVP.
- Do not create open student chat, public leaderboards, or unrestricted home activity access.
- Add E2E tests for cross-tenant denial, teacher assignment denial, student session scope, parent summary scope, autosave idempotency, and submit idempotency.
- Do not commit, push, merge, or delete branches.
```

---

## 18. Non-Negotiable Rules

```text
1. Learning is a separate domain, not scattered inside existing modules.
2. Learning reuses existing SchoolOS students, teachers, subjects, timetable, parents, communication, File Registry, audit, and RBAC.
3. Every learning table/query must preserve tenant isolation.
4. School-only activity access is the default.
5. Teacher assignment validation is mandatory.
6. Parent summaries must be child-scoped and non-comparative.
7. Difficulty levels must not harm student confidence.
8. Smart-board and lab routes must expose no admin-sensitive data.
9. Offline/low-bandwidth behavior must fail safely.
10. AI is later-phase, teacher-reviewed, and never open-ended for students.
```
