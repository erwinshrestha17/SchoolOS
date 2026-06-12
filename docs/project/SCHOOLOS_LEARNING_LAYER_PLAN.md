# SchoolOS Learning Layer Plan

**Status:** M12 backend MVP foundation implemented; frontend/runtime depth remains planned
**Scope:** Kindergarten / Montessori to Grade 12 classroom learning support  
**Implementation state:** Backend implemented and verified on 2026-06-12 under `apps/api/src/learning`. Do not treat Learning frontend screens, mobile runtime, adaptive learning, or AI tutor as implemented until matching code, tests, and verification exist.
**Relationship to SchoolOS Core:** Separate learning domain that reuses SchoolOS management data, tenant isolation, RBAC, File Registry, audit logs, and communication services.

---

## 1. Purpose

SchoolOS Core Management runs the school. The Learning Layer improves how teaching and learning happen inside the school.

```text
SchoolOS Core Management = operations, records, fees, academics, attendance, staff, communication
SchoolOS Learning Layer = teacher-led interactive learning, smart-board sessions, lab practice, progress tracking
SchoolOS Intelligence = later safe analytics and AI support after reliable data exists
```

The Learning Layer must be teacher-controlled and school-first. It must not become an unrestricted entertainment or home screen product for students.

Core goals:

```text
1. Help teachers teach subjects interactively from Kindergarten to Grade 12.
2. Support smart-board/projector classroom teaching.
3. Support computer-lab individual practice when available.
4. Let teachers create pre-planned and on-the-spot activities.
5. Restrict activity creation to assigned class/section/subject.
6. Support Easy / Medium / Hard activity levels.
7. Keep interactive activities school-only by default.
8. Record meaningful progress without harmful ranking.
9. Support English, Nepali, and mixed classroom language.
10. Work with low-bandwidth Nepal school conditions.
11. Keep AI teacher-reviewed and future-phase only.
```

---

## 2. Product Positioning

SchoolOS should be positioned as a KG-12 school operating platform with three connected layers:

```text
1. School Management Layer
2. Learning Layer
3. Intelligence & Insight Layer later
```

The Learning Layer is implemented backend-first as **M12 Learning Layer**.

Current implementation summary:

```text
Implemented:
- M12 backend MVP foundation under apps/api/src/learning
- Teacher activity builder APIs
- Easy / Medium / Hard difficulty
- School-only smart-board/lab session backend
- Session code and QR-token-hash join flow
- Basic practice/quiz attempt engine
- Autosave and idempotent submission
- Progress recording
- Parent child-scoped learning summary
- Tenant isolation, RBAC, entitlement checks, audit logging, and E2E coverage

Not yet implemented:
- Web teacher activity-builder screens
- Web smart-board runtime
- Web student lab/session attempt UI
- Web parent learning summary UI
- Mobile learning summary surfaces
- Resource-library management endpoints
- Matching/order question support
- Adaptive learning, subject labs, heavy simulations, and AI tutor
```

Submodules:

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

Correct code ownership:

```text
apps/api/src/learning/
apps/web/app/dashboard/learning/
apps/web/app/classroom/board/
apps/web/app/student/learning/
apps/web/app/parent/learning/
packages/core/src/learning/
```

Do not scatter learning logic into `students`, `academics`, `timetable`, or `communications`. Those modules provide data and rules; `learning` owns activity/session/attempt/progress logic.

---

## 3. KG-12 Learning Stages

### Stage A — Kindergarten / ECD / Montessori

Primary mode:

```text
Smart-board teacher-led only
```

Features:

```text
picture matching
letter and Nepali अक्षर sounds
number counting
colors and shapes
rhymes
story sequencing
movement-based classroom activities
milestone observation
parent daily summary
```

Avoid independent long screen sessions, ranking, open-ended AI, and heavy quizzes.

### Stage B — Grade 1-3

Primary mode:

```text
Teacher-led smart board + very short guided practice
```

Features:

```text
phonics
Nepali reading
basic math
picture vocabulary
story comprehension
simple science sorting
short teacher-led quizzes
supportive progress labels
```

### Stage C — Grade 4-5

Primary mode:

```text
Smart-board explanation + group/lab practice
```

Features:

```text
fractions and number concepts
science diagrams
Nepal map basics
grammar practice
short revision quizzes
library-linked reading suggestions
parent weekly learning summary
```

### Stage D — Grade 6-8

Primary mode:

```text
Smart-board concepts + computer-lab individual practice
```

Features:

```text
algebra steps
geometry visualizer
science simulations
map and timeline activities
paragraph writing
coding basics
digital safety lessons
project activities
```

### Stage E — Grade 9-10

Primary mode:

```text
Concept mastery + SEE-style preparation + school lab practice
```

Features:

```text
topic mastery
mock tests
mistake notebook
math step-solving
science diagram labeling
essay writing
social studies map/timeline revision
teacher weak-topic dashboard
```

### Stage F — Grade 11-12

Primary mode:

```text
Stream-based advanced learning, practicals, projects, and board exam preparation
```

Supported streams/programs later:

```text
Science
Management
Humanities
Education
Computer Science
Other school-enabled streams
```

Features:

```text
Physics graph simulation
Chemistry reaction balancing
Biology process diagrams
Accountancy journal-to-ledger simulator
Economics demand/supply graph
Computer Science coding lab
project and practical tracking
career/counselling notes
```

---

## 4. Nepal-First Design Rules

The platform must support:

```text
smart-board friendly classrooms
projector-based teaching
shared computer labs
low-bandwidth environments
mixed manual/digital workflows
English, Nepali, and mixed explanations
local examples and curriculum alignment
teacher-controlled session flow
parent-safe summaries
```

Local content examples should use familiar contexts:

```text
momo, roti, rice, rupees, local markets, monsoon, Terai, Hills, Himalayas, Bagmati, Lumbini, school bus, crops, festivals, community life
```

Usage modes:

```text
SMART_BOARD  = one screen, whole class
GROUP        = students participate in groups
COMPUTER_LAB = individual attempts in school lab
WORKSHEET    = printable fallback
HYBRID       = smart-board explanation + lab practice
```

---

## 5. Integration With Existing SchoolOS Modules

| Core Module | Learning Layer Integration |
|---|---|
| M0 Platform Core | feature entitlement, plan limits, module enable/disable, school-only policy |
| M1 Students | student roster, class, section, guardian links, lifecycle status |
| M2 Attendance | present/absent context for learning participation interpretation |
| M3 Fees | keep separate; do not mix fee status with learning access by default |
| M4 Academics | subjects, chapters, topics, outcomes, exams, report-card insights |
| M5 Activity Feed | teacher-approved class learning milestones |
| M6 Homework / Timetable | quick activity auto-select from current period; homework-linked practice |
| M7 HR / Payroll | active staff and teacher assignment validation |
| M8A Library | topic-linked book/resource recommendations |
| M8B Transport | mostly separate; school-day context only if useful |
| M8C Canteen | mostly separate; health/nutrition activities later |
| M9 Accounting | separate; only SaaS/platform learning add-on billing belongs here |
| M10 Communication | parent summaries, teacher reminders, learning notices |
| M11 Intelligence / AI | later teacher-reviewed AI/adaptive support |

Key rule:

```text
Learning references core data. It does not duplicate student, class, subject, teacher, parent, file, notification, or audit systems.
```

---

## 6. Permission and Access Rules

Teacher can create or launch an activity only when:

```text
teacher is active staff
AND teacher belongs to the same tenant
AND teacher is assigned to the class/section
AND teacher is assigned to the subject
AND subject belongs to that class curriculum
AND Learning module is enabled
AND permission allows learning activity management
```

Student can join a lab session only when:

```text
student belongs to the same tenant
AND student belongs to the session class/section
AND session is LIVE
AND session is not expired
AND valid session code or QR is supplied
AND school-only policy passes
```

Parent can see only:

```text
their linked child's summary
no other students
no class leaderboard
no raw private attempt data unless explicitly allowed
```

Supportive labels:

```text
Needs practice
Improving
Ready
Strong
```

---

## 7. Backend Architecture

The dedicated backend domain is implemented:

```text
apps/api/src/learning/
├── learning.module.ts
├── learning.permissions.ts
├── learning.constants.ts
├── activities/
├── sessions/
├── attempts/
├── progress/
├── resources/
└── parent-summary/
```

Implemented MVP services:

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

Implemented MVP models:

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

Every learning table/query must be tenant-scoped. The backend enforces `module.learning`, learning permissions, actor tenant scope, teacher assignment validation, student session access validation, parent child scope, and audit logging for state changes.

---

## 8. Frontend Architecture

Teacher/admin routes:

```text
/dashboard/learning
/dashboard/learning/activities
/dashboard/learning/activities/new
/dashboard/learning/activities/[activityId]
/dashboard/learning/sessions
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

Mobile MVP should show only parent/student learning summaries and teacher notifications. Do not build the full lab or smart-board runtime in Flutter first.

---

## 9. Database and API

Important `LearningActivity` fields:

```text
id, tenantId, title, description, classId, sectionId, subjectId, chapterId, topicId, teacherId, activityType, difficulty, mode, accessType, languageMode, estimatedMinutes, status, createdBy, approvedBy, createdAt, updatedAt
```

Important `LearningSession` fields:

```text
id, tenantId, activityId, classId, sectionId, subjectId, teacherId, mode, sessionCode, qrTokenHash, status, schoolOnly, startedAt, endedAt, expiresAt, teacherHeartbeatAt
```

Important `LearningAttempt` fields:

```text
id, tenantId, sessionId, activityId, studentId, startedAt, submittedAt, score, accuracy, timeSpentSeconds, hintsUsed, attemptNumber, status
```

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

Implemented Prisma migration:

```text
apps/api/prisma/migrations/20260612120000_m12_learning_layer_foundation/migration.sql
```

Implemented permission and entitlement surface:

```text
module.learning
feature.learning.basic
feature.learning.full
learning:read
learning:manage
learning:create
learning:update
learning:delete
learning:launch
learning:attempt
learning:progress
```

---

## 10. Implementation Phases

```text
M12-0 Design and schema readiness - complete for backend
M12-1 Backend activity foundation - complete
M12-2 Smart Board MVP - backend complete, web runtime pending
M12-3 Computer Lab MVP - backend complete, web student/lab UI pending
M12-4 Progress and parent summary - backend complete, web/mobile UI pending
M12-5 Low-bandwidth hardening
M12-6 Subject activity labs
M12-7 Safe AI later
```

MVP includes:

```text
Teacher Activity Builder
Easy / Medium / Hard difficulty
Smart Board Mode
School-only Learning Sessions
Computer Lab Individual Mode
Basic Practice & Quiz Engine
Progress Recording
Parent Summary foundation
```

Not included in current backend MVP:

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

## 11. Testing Requirements

Implemented backend E2E tests:

```text
learning-activity-permissions.e2e-spec.ts
learning-session-school-only.e2e-spec.ts
learning-attempt-progress.e2e-spec.ts
learning-parent-summary-scope.e2e-spec.ts
learning-cross-tenant-denial.e2e-spec.ts
```

Web E2E tests:

```text
learning-activity-builder.spec.ts
learning-smart-board.spec.ts
learning-lab-session.spec.ts
learning-parent-summary.spec.ts
```

Required cases:

```text
teacher cannot create activity for unassigned class
teacher cannot create activity for unassigned subject
student cannot join inactive/expired session
student cannot join another class session
parent cannot view another child summary
cross-tenant activity access is denied
autosave is idempotent
submit is idempotent
progress updates only after valid submission
school-only session code expires correctly
```

Verification completed on 2026-06-12:

```text
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/api test
pnpm --filter @schoolos/api test:e2e
focused Learning E2E specs
pnpm build
pnpm test:web:e2e outside sandbox after sandbox-only ::1:3101 listen EPERM
```

---

## 12. Non-Negotiable Rules

```text
1. Learning is a separate M12 domain, not scattered inside existing modules.
2. Learning reuses SchoolOS Core data and platform services.
3. Every learning read/write is tenant-scoped.
4. Teacher assignment validation is mandatory.
5. School-only access is default.
6. Parent summaries are child-scoped and non-comparative.
7. Difficulty labels must not harm student confidence.
8. Board/lab routes expose no admin-sensitive data.
9. Offline/low-bandwidth behavior must fail safely.
10. AI is later-phase, teacher-reviewed, and not open-ended for students.
```
