# SchoolOS M11 — School Intelligence & Analytics Roadmap

**Status:** Roadmap only. No implementation yet.  
**Phase:** Phase 4 — AI, Analytics, Scale, and Enterprise SaaS.  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard.

M11 is the future intelligence and analytics layer for SchoolOS. It must not be implemented as random AI features. It starts with structured data capture, safe read models, feature snapshots, explainable rules, human-reviewed recommendations, and only later ML/LLM features after reliable production data exists.

---

## 1. Non-Negotiable Rules

```text
- Documentation and roadmap updates are allowed now.
- Do not implement M11 product features until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment from risk scores.
- No fee blocking, student suspension, payroll decision, staff discipline, or public ranking from AI/risk scores.
- Human review is required before AI output becomes an official communication, report, record, or action.
- Sensitive intelligence views are principal/admin-only unless explicitly designed otherwise.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
- Every intelligence read/write must remain tenant-scoped by tenantId unless it is an approved platform aggregate.
- Every sensitive insight access must be audited.
```

---

## 2. Module Ownership

```text
Module: M11 — School Intelligence & Analytics
Backend: apps/api/src/intelligence/*
API: /api/v1/intelligence/*
School dashboard: /dashboard/intelligence/*
Platform/network intelligence: /platform/intelligence/*
```

M11 consumes safe events and snapshots from M1-M10. It should not bypass module boundaries or directly mutate operational records owned by other modules.

M11 may recommend actions, but final action execution must go through the owning module.

Examples:

```text
M11 identifies dropout risk -> M10 sends approved notice or M1/M2 records follow-up.
M11 identifies overloaded teacher -> M6/M7 handles timetable/leave/substitution action.
M11 identifies exam difficulty issue -> M4 handles review/lock workflow.
```

---

## 3. Foundation Data Model Concepts

These are roadmap-level concepts only. Do not add Prisma models until implementation is approved.

### SchoolEvent

Structured event capture across M1-M10.

```text
SchoolEvent
- id
- tenantId
- academicYearId nullable
- actorUserId nullable
- actorRole nullable
- eventType
- entityType
- entityId
- sourceModule
- occurredAt
- payloadJson
```

Example event types:

```text
STUDENT_ADMITTED
STUDENT_TRANSFERRED
ATTENDANCE_SUBMITTED
STUDENT_MARKED_ABSENT
PAYMENT_RECEIVED
INVOICE_OVERDUE
MARKS_ENTERED
MARKS_LOCKED
HOMEWORK_ASSIGNED
HOMEWORK_SUBMITTED
NOTICE_SENT
NOTICE_READ
PARENT_LOGIN
CHAT_MESSAGE_SENT
TEACHER_LEAVE_APPROVED
SUBSTITUTE_ASSIGNED
```

### Feature Snapshots

Snapshots make dashboards and scoring efficient without repeatedly scanning raw operational tables.

```text
StudentWeeklyFeatureSnapshot
TeacherWeeklyFeatureSnapshot
GuardianWeeklyFeatureSnapshot
ClassroomWeeklyFeatureSnapshot
SchoolWeeklyFeatureSnapshot
```

### RiskScoreSnapshot

Explainable risk score record.

```text
RiskScoreSnapshot
- id
- tenantId
- subjectType: STUDENT | GUARDIAN | TEACHER | CLASSROOM | SCHOOL
- subjectId
- riskType
- score
- level: LOW | MEDIUM | HIGH | CRITICAL
- explanation
- factorsJson
- generatedAt
- expiresAt nullable
```

### InsightAction

Insights must result in tracked human action, not just alerts.

```text
InsightAction
- id
- tenantId
- insightId
- assignedToUserId
- actionType
- status: OPEN | IN_PROGRESS | COMPLETED | DISMISSED
- notes nullable
- dueDate nullable
- completedAt nullable
```

### AiInferenceRequest

Shared contract for future cloud and offline/on-device AI workflows.

```text
AiInferenceRequest
- id
- tenantId
- requesterUserId
- requestType
- inputPayloadJson
- outputPayloadJson nullable
- modelProvider nullable
- modelName nullable
- inferenceLocation: CLOUD | ON_DEVICE | RULE_BASED
- status: REQUESTED | COMPLETED | FAILED | REVIEWED | REJECTED
- latencyMs nullable
- reviewedByUserId nullable
- acceptedAt nullable
- rejectedAt nullable
- createdAt
```

---

## 4. Feature Groups

## 4.1 Teacher and Staff Intelligence

### Teacher Workload Balance Monitor

Purpose: identify overloaded teachers before burnout or operational failure.

Inputs:

```text
M6 timetable periods
M7 staff/teacher profile
M6 subject assignments
M4 marks entry backlog
M6 homework assigned/graded backlog
M10 parent message load
Class teacher assignments
Substitution history
```

MVP rule:

```text
teacher_workload_score =
  periodsPerWeek * 2
  + uniqueSubjects * 5
  + classTeacherSections * 10
  + pendingMarksEntries * 0.3
  + ungradedHomeworkCount * 0.2
  + parentOpenThreads * 0.5
  + substitutionsThisWeek * 3
```

Output:

```text
TeacherWorkloadSnapshot
riskLevel: LOW | MEDIUM | HIGH | CRITICAL
```

Priority: High. Build early as rule-based analytics after M6/M7 hardening.

### Substitute Teacher Intelligence

Purpose: recommend the best substitute teacher when a teacher is absent.

Inputs:

```text
M6 timetable
M7 leave
M7 teacher subject profile
Teacher workload snapshot
Substitution history
M10 staff notifications
```

Ranking logic:

```text
candidateScore =
  subjectMatchScore
  + freePeriodScore
  - workloadPenalty
  - substitutionFrequencyPenalty
  + classFamiliarityScore
```

Priority: Very high. This is operational intelligence and can be built before full AI.

### Teacher Performance Intelligence — Ethical Version

Purpose: help principals identify support/training needs using context-adjusted learning outcomes.

Rules:

```text
- Principal-only.
- No public teacher ranking.
- No salary automation.
- No disciplinary automation.
- Minimum data thresholds required.
- Show confidence level and explanation.
```

Priority: Late Phase 4 because it is sensitive.

---

## 4.2 Student Academic and Risk Intelligence

### Sibling Academic Correlation Report

Purpose: detect family-level support needs when multiple siblings show correlated decline.

Inputs:

```text
M1 guardian-student links
M2 attendance weekly summary
M3 fee payment history
M4 exam trends
M6 homework submission
M10 guardian engagement
```

Rule:

```text
For each guardian with 2+ active students:
  if 2+ siblings decline in attendance/marks/homework/fees in the same 2-4 week window:
    create a family-level support signal
```

Use language such as `Possible family-level support need`, not negative labels.

Priority: High for Nepal context.

### Academic Year Momentum Tracker

Purpose: show student learning velocity, not just current marks.

Inputs:

```text
M4 term results
M4 CAS/progress cards
M2 attendance percentage
M6 homework completion percentage
M5 milestone observations for Montessori/ECE
```

MVP logic:

```text
trendSlope = linear_regression_slope(last_4_term_averages)
> +5 points/term = IMPROVING
-2 to +5 = STABLE
< -2 = DECLINING
```

Priority: High. Statistics-based, no ML required.

### Predictive Dropout Engine

Purpose: detect likely dropout risk early enough for human intervention.

Inputs:

```text
M1 lifecycle/status/transfer
M2 attendance
M3 fee delays
M4 marks
M6 homework
M10 guardian engagement
M8B transport discontinuation later
M8C canteen usage drop later
```

MVP scoring:

```text
dropoutRisk =
  attendanceRiskWeight
  + feeDelayRiskWeight
  + homeworkDropWeight
  + guardianEngagementDropWeight
  + marksDeclineWeight
  + consecutiveAbsenceWeight
```

Ethical guardrails:

```text
- Principal/class-teacher support tool only.
- No automatic punishment.
- No parent-visible risk score.
- Every view is audited.
```

Priority: Very high, but start rule-based first and ML later.

---

## 4.3 Academic Quality Intelligence

### Exam Paper Difficulty Calibration

Purpose: detect possibly too-hard or too-easy papers before report cards are locked.

Inputs:

```text
M4 exams
M4 subject marks
M4 assessment components
Previous term marks
Teacher/subject/class mapping
Optional item-level question marks later
```

MVP metrics:

```text
classAverage
previousCohortAverage
sameSubjectHistoricalAverage
standardDeviation
failureRate
NGRate
topScore
bottomScore
```

Example warning:

```text
Class 9 Math Term 2 average is 38%.
Previous term average for the same cohort was 74%.
Standard deviation is low, meaning most students struggled.
Review paper difficulty before locking results.
```

Priority: Very high after M4 hardening.

### AI-Powered Curriculum Gap Detection

Purpose: identify topic-level learning gaps from exam/homework data.

Requirements:

```text
3+ years exam data
Item-level question tagging
Subject/chapter/topic mapping
Anonymized cross-school aggregates for network mode
Opt-in benchmarking
```

Priority: Later Phase 4. Do not build until M4 is mature.

---

## 4.4 Guardian, Classroom, and School Health Intelligence

### Guardian Communication Health Score

Purpose: identify guardians who are not reachable through current communication channels.

Inputs:

```text
M10 delivery records
M10 read/unread tracking
M10 consent responses
M10 parent-teacher chat
Parent login/session events
M3 fee notices
M4 result notices
M2 absence notices
```

Score inputs:

```text
notificationReadRate
deliveryFailureRate
lastAppLoginDays
consentResponseRate
teacherMessageResponseRate
unreadImportantNoticeCount
```

Priority: High after M10 read tracking/chat stability.

### Classroom-Level Heat Events

Purpose: detect whole-class anomalies that individual student dashboards miss.

Event types:

```text
ATTENDANCE_SPIKE
HOMEWORK_NON_SUBMISSION_SPIKE
MARKS_DROP
MOOD_DECLINE
COMMUNICATION_FAILURE
ILLNESS_CLUSTER
```

Priority: Medium-high after attendance/homework/exam data is stable.

### School Health Network Intelligence

Purpose: aggregate-only health/anomaly intelligence across opted-in schools.

Privacy rules:

```text
- No student-level data leaves tenant boundary.
- Only aggregate counts.
- Opt-in per school.
- No public-health sharing without explicit agreement.
- Platform audit required.
```

Priority: Very late Phase 4 / enterprise network intelligence.

---

## 4.5 AI Teacher Assistant and Natural Language Interface

### AI Teaching Assistant — For Teachers

Best first use cases:

```text
Report card remark drafting
Homework feedback suggestions
Lesson plan generation
Notice/message drafting
Marksheet OCR later
```

Do not build first:

```text
Student chatbot
Unmoderated parent chatbot
AI grading without teacher approval
```

Rule: teacher must review and approve. AI cannot directly publish/send.

### Natural Language School Management Interface — English First

Purpose: allow principals/admins to ask operational questions in English.

Example:

```text
Show students in Class 9 with attendance below 80%, fee arrears, and declining marks.
```

Security rule:

```text
Do not let an LLM generate raw SQL directly against production DB.
```

Required flow:

```text
Natural language
→ intent parser
→ approved query template
→ permission/tenant filter injection
→ backend service query
→ audited result
```

First supported query templates:

```text
STUDENT_RISK_LIST
FEE_DEFAULTER_LIST
LOW_ATTENDANCE_LIST
DECLINING_MARKS_LIST
GUARDIAN_UNREACHABLE_LIST
TEACHER_WORKLOAD_LIST
CLASSROOM_HEAT_EVENT_LIST
```

---

## 5. Phase-Wise M11 Implementation Roadmap

## Phase 4A — School Intelligence Foundation

Goal: prepare data foundations without building AI product features.

Scope:

```text
SchoolEvent roadmap
Feature snapshot roadmap
RiskScoreSnapshot roadmap
InsightAction workflow roadmap
AiInferenceRequest contract roadmap
Tenant isolation and audit rules
```

## Phase 4B — Rule-Based Operational Intelligence

Build first:

```text
Teacher Workload Balance Monitor
Substitute Teacher Intelligence
Guardian Communication Health Score
Academic Year Momentum Tracker
Classroom-Level Heat Events
```

Reason: high business value, explainable, and no long historical ML dataset required.

## Phase 4C — Student Risk and Academic Quality Intelligence

Build:

```text
Sibling Academic Correlation Report
Predictive Dropout Engine v1
Student risk dashboard
Intervention checklist
Exam Paper Difficulty Calibration
Tenant-level curriculum gap detection
```

## Phase 4D — AI Teacher Assistant and Natural Language Interface

Build:

```text
Report card remark draft
Lesson plan draft
Homework feedback draft
Notice/message draft
Teacher approval workflow
AiInferenceRequest logs
/dashboard/ask
English-only natural language query templates
```

## Phase 4E — Offline-First and Network Intelligence

Build later:

```text
Offline-first AI inference
On-device model support
School Health Network Intelligence
Cross-school curriculum benchmarking
```

Requirements:

```text
Multiple live schools
Data-sharing agreement
Anonymization pipeline
Platform consent controls
Strong audit/observability
```

## Phase 4F — Scale Optimization and Enterprise SaaS

Build:

```text
Analytics read models
Background intelligence jobs
Model/version governance
Platform-level intelligence dashboards
Enterprise observability
Plan-based AI/analytics limits
```

---

## 6. Priority Order

| Priority | Feature | Build Timing | Type |
|---:|---|---|---|
| 1 | Teacher Workload Balance Monitor | Phase 4B | Rule-based |
| 2 | Substitute Teacher Intelligence | Phase 4B | Rule-based |
| 3 | Guardian Communication Health Score | Phase 4B | Analytics |
| 4 | Academic Year Momentum Tracker | Phase 4B | Statistics |
| 5 | Exam Paper Difficulty Calibration | Phase 4C | Statistics |
| 6 | Classroom-Level Heat Events | Phase 4B/4C | Anomaly rules |
| 7 | Sibling Academic Correlation Report | Phase 4C | Rule-based |
| 8 | Predictive Dropout Engine | Phase 4C | Rule -> ML later |
| 9 | AI Teaching Assistant | Phase 4D | GenAI with human review |
| 10 | Natural Language School Management Interface | Phase 4D | LLM/query templates |
| 11 | Teacher Performance Intelligence | Late Phase 4D | Sensitive analytics |
| 12 | Curriculum Gap Detection | Phase 4E | Cross-school analytics later |
| 13 | Offline-First AI Inference | Phase 4E | Edge AI later |
| 14 | School Health Network Intelligence | Phase 4E | Enterprise/network later |

---

## 7. Verification Rule for Future M11 Work

When implementation eventually starts, every M11 task must report:

```text
- Source modules used.
- Tenant isolation strategy.
- Permission model.
- Index strategy.
- Whether processing is sync or queued.
- Audit events created.
- Whether any output is sensitive/principal-only.
- Human review requirement.
- Tests for tenant isolation and permission boundaries.
- Verification commands run.
```

Standard commands:

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```
