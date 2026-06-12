# SchoolOS Functional Requirements Specification 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school operating SaaS  
**Target schools:** Kindergarten / Montessori to Grade 12 as the long-term product direction; current implementation remains staged around controlled pilot readiness for existing core modules  
**Document type:** Functional Requirements Specification  
**Status:** Active FRS aligned with KG-12 product direction and M12 Learning Layer backend MVP implementation
**Last updated:** 2026-06-12

---

## 1. Purpose

This FRS breaks SchoolOS into feature-level functional behavior. It describes what each module must allow users to do, what validations must happen, what states must be supported, and what acceptance criteria must be satisfied.

The PRD remains the product master document. This FRS is meant for developers, QA, designers, and implementation agents who need detailed feature behavior.

Important distinction:

```text
Current core = implemented/pilot-ready management modules with remaining hardening
KG-12 expansion = staged product direction
M12 Learning Layer = backend MVP implemented and verified; frontend/runtime depth remains staged
```

---

## 2. Functional Requirement Format

Each module follows this structure:

1. Purpose.
2. Primary actors.
3. Core functions.
4. Key states.
5. Validation rules.
6. Edge cases.
7. Acceptance criteria.

---

## 3. Global Functional Rules

These rules apply to every module:

1. Every tenant-owned action must be scoped to the authenticated tenant.
2. Parent users can only access linked child records.
3. Student users can only access their own allowed records.
4. Staff users can only perform actions allowed by role and permission.
5. Platform override must require reason and audit.
6. Sensitive files must be accessed only through protected File Registry flows.
7. Money-related actions must be idempotent.
8. Reversals must require permission, reason, and audit.
9. Background jobs must re-check tenant, feature, entity, and permission state before executing.
10. Disabled/mock provider modes must be explicit in the UI.
11. Learning activity/session data must be tenant-scoped and must not duplicate core student, teacher, class, subject, parent, file, notification, or audit systems.
12. Teacher-created learning content must be limited to assigned class/section/subject unless an explicit admin permission allows broader curriculum management.
13. Student learning session access must fail closed when session, class, section, tenant, feature, or school-only policy validation fails.
14. Parent learning summaries must be child-scoped, non-comparative, and free from public ranking.

---

## 4. KG-12 Scope Rules

SchoolOS must support staged configuration by school level:

```text
Kindergarten / ECD / Montessori
Grade 1-3
Grade 4-5
Grade 6-8
Grade 9-10
Grade 11-12
```

### 4.1 School-level configuration

The platform should allow a tenant to configure which levels it offers:

```text
ECD / Kindergarten enabled
Grade 1-5 enabled
Grade 6-8 enabled
Grade 9-10 enabled
Grade 11-12 enabled
Streams/programs enabled where applicable
Learning Layer enabled where applicable
```

### 4.2 Grade 11-12 extension

Grade 11-12 support should add, when implemented:

```text
streams/programs
subject combinations
practical/lab components
project components
advanced assessment policies
board exam preparation workflows
career/counselling notes
```

### 4.3 Stage-aware UI

Dashboards should not show every feature to every school level. For example:

```text
Kindergarten dashboard: attendance, pickup/drop, meal notes, milestones, parent updates, board activities
Primary dashboard: attendance, homework, subjects, basic learning, parent communication
Lower secondary dashboard: timetable, homework, subject practice, projects, lab sessions
Secondary dashboard: exams, report cards, SEE prep, topic mastery
Higher secondary dashboard: streams, subject combinations, practicals, projects, advanced labs
```

---

## 5. M0 Platform Core / SaaS Foundation

### 5.1 Purpose

Manage tenants, platform administration, feature controls, provider readiness, queues, File Registry, API keys, SaaS billing records, support override, onboarding, audit workflows, KG-12 school-level settings, and module entitlement.

### 5.2 Primary actors

- SchoolOS Platform Operator.
- Platform Admin.
- Support Operator.

### 5.3 Core functions

1. View tenant list.
2. View tenant detail.
3. Suspend tenant with reason.
4. Activate tenant with reason.
5. Manage plans and feature flags.
6. Manage tenant subscriptions and feature overrides.
7. View usage counters.
8. Create platform API key.
9. Display API key secret only once.
10. List masked API keys.
11. Revoke API key.
12. Configure provider settings with secret masking.
13. Run provider readiness checks.
14. View queue health.
15. Inspect failed jobs.
16. Retry failed jobs with audit.
17. View File Registry entries and report export history.
18. Use support tenant override with reason and expiry/time-bound behavior where possible.
19. View platform audit logs.
20. View onboarding checklist and platform health summary.
21. Configure school level coverage: ECD, primary, lower secondary, secondary, Grade 11-12.
22. Enable/disable M12 Learning Layer per tenant/plan.
23. Configure school-only learning policies and later learning usage limits.

### 5.4 Key states

- Tenant: active, suspended, archived.
- Feature: enabled, disabled, overridden.
- Provider: disabled, dev-log, mock, configured, misconfigured.
- API key: active, revoked.
- Queue job: waiting, active, completed, failed, retried.
- File registry entry: available, missing, failed, archived.
- Learning feature: disabled, enabled, pilot, suspended.

### 5.5 Validation rules

1. Tenant suspend/activate requires reason.
2. Support override requires explicit tenant and reason.
3. API key secret must never be shown after creation.
4. Provider secret values must be masked.
5. Queue retry must be blocked for archived tenant or disabled feature.
6. Disabled feature routes must fail closed.
7. Learning routes must fail closed when M12 is disabled or plan-locked.
8. School-level/stream configuration changes must be audited.

### 5.6 Acceptance criteria

1. Every platform override action is audited.
2. Suspended tenants are blocked across dashboard, API, mobile, jobs, downloads, reports, and learning sessions.
3. Disabled provider mode never pretends to send real notifications, payments, storage actions, or learning delivery actions.
4. API keys are stored hashed and only shown once during creation.
5. File and queue failure screens show safe, non-secret diagnostics.

---

## 6. M1 Admissions and Student Profiles

### 6.1 Purpose

Manage student lifecycle from inquiry/admission to active, transferred, withdrawn, graduated, archived, or alumni state where enabled.

### 6.2 Primary actors

- School Admin.
- Principal.
- Teacher with limited access.
- Parent/Guardian with child-scoped access.

### 6.3 Core functions

1. Create inquiry/application.
2. Convert application to student admission.
3. Create student profile.
4. Edit student profile.
5. Manage guardian details and relationships.
6. Assign class, section, roll number, and academic year.
7. Upload student photo and documents.
8. Generate student QR credential.
9. Rotate/revoke student QR credential.
10. Detect duplicate student candidates.
11. Search students.
12. View student lifecycle history.
13. Maintain IEMIS/export readiness fields.
14. Transfer, withdraw, graduate, archive, or reactivate according to policy.
15. Support KG-12 student classification: ECD, primary, lower secondary, secondary, Grade 11-12 where enabled.
16. Support later Grade 11-12 stream and subject-combination assignment through Academics.

### 6.4 Key states

- Student lifecycle: applicant, active, transferred, withdrawn, graduated, archived, alumni where enabled.
- QR credential: active, rotated, revoked, expired.
- Document: uploaded, linked, failed, archived.
- Guardian link: active, removed, replaced.

### 6.5 Validation rules

1. Admission number must be unique within tenant where policy requires.
2. Same admission number cannot be created concurrently.
3. Duplicate candidates must be shown before risky merge actions.
4. Parent access must be revoked immediately when guardian linkage is removed.
5. QR resolve must fail for revoked, rotated, or expired credentials.
6. Student lifecycle change must preserve historical attendance, fees, report cards, files, learning history, and accounting links.
7. Same student name in another tenant must not affect local student search or merge.

### 6.6 Acceptance criteria

1. Student creation and editing are tenant-scoped.
2. Guardian removal immediately blocks parent access.
3. Student documents/photos do not expose raw storage keys.
4. QR lifecycle works with generate, rotate, revoke, and fail-closed resolve.
5. Historical records remain available after transfer, withdrawal, graduation, archive, or alumni transition.

---

## 7. M4 Academics, Exams, Report Cards, and KG-12 Academic Structure

### 7.1 Purpose

Manage academic structure, subjects, exams, assessment components, CAS, report cards, promotion, and later KG-12 streams, practicals, projects, and subject combinations.

### 7.2 Primary actors

- Academic Admin.
- Principal.
- Exam Coordinator.
- Teacher.
- Parent/Student with published-result access.

### 7.3 Core functions

1. Manage academic years.
2. Manage classes and sections.
3. Manage subjects.
4. Assign teachers to subjects/classes.
5. Manage exam terms and assessment components.
6. Enter marks and CAS.
7. Lock/unlock marks with approval where enabled.
8. Generate report cards.
9. Manage promotion readiness.
10. Configure grade bands and school levels for KG-12.
11. Configure Grade 11-12 streams/programs where enabled.
12. Configure subject combinations where enabled.
13. Track practical/project components where enabled.
14. Expose subject/chapter/topic/outcome data to M12 Learning Layer where enabled.

### 7.4 Validation rules

1. Marks entry must be teacher/role scoped.
2. Published results must be parent/student scoped.
3. Academic records must remain linked after class transfer or graduation.
4. Stream and subject-combination rules must be tenant-scoped.
5. Learning Layer must reference academic subjects/topics and not duplicate them.

---

## 8. M12 Learning Layer

### 8.1 Purpose

Provide teacher-led, school-controlled learning workflows through smart-board activities, computer-lab practice, progress tracking, and parent learning summaries.

Implementation note: the backend MVP for this section is implemented under `apps/api/src/learning`; web/mobile screens and advanced learning depth remain staged.

### 8.2 Primary actors

- Teacher.
- Academic Admin.
- Student in school lab/session.
- Parent/Guardian.
- Principal.
- Platform Operator for feature entitlement.

### 8.3 Core functions

1. Create learning activity.
2. Edit learning activity.
3. Select class, section, subject, topic, mode, language, and difficulty.
4. Add questions and activity content.
5. Save activity as draft.
6. Publish/schedule activity.
7. Launch smart-board session.
8. Pause/resume/end smart-board session.
9. Start computer-lab session.
10. Generate session code/QR.
11. Allow student to join valid school-only session.
12. Autosave student attempt.
13. Submit student attempt.
14. Evaluate answers backend-side.
15. Update learning progress.
16. Show teacher class/topic progress.
17. Show parent child-only learning summary.
18. Attach teacher-approved resources through File Registry.
19. Support Easy / Medium / Hard difficulty internally.
20. Show supportive student-facing labels: Practice, Challenge, Mastery, or Needs practice / Improving / Ready / Strong.

### 8.4 Key states

- Activity: draft, scheduled, published, archived.
- Session: planned, live, paused, ended, expired.
- Attempt: in_progress, submitted, auto_submitted, sync_pending.
- Progress: needs_practice, improving, ready, strong.
- Access: allowed, denied, expired, feature_locked, tenant_suspended.

### 8.5 Validation rules

1. Teacher can create/launch only for assigned class/section/subject unless explicitly permitted.
2. Student can join only live sessions for their own class/section.
3. Session code/QR must expire.
4. Parent can view only linked child learning summary.
5. Cross-tenant activity/session/attempt/progress access must be denied.
6. Smart-board and lab routes must expose no admin-sensitive data.
7. Activity media must use File Registry/Storage boundaries.
8. Autosave and submit must be idempotent.
9. School-only access must be default.
10. AI functionality must remain disabled until later approved phases.

### 8.6 Acceptance criteria

1. Teacher can create a draft activity only for assigned class/subject.
2. Teacher can launch a smart-board session for an assigned class.
3. Student can join a live computer-lab session with valid code/QR.
4. Student cannot join another class session.
5. Parent cannot view another child summary.
6. Progress updates only after valid submission.
7. Tenant isolation tests pass for activity, session, attempt, and progress records.
8. Backend M12 E2E coverage passes for teacher assignment denial, inactive/expired/wrong-class session denial, cross-tenant denial, parent child-scope denial, autosave/submit idempotency, and progress-after-submit behavior.

---

## 9. M10 Communication Integration for Learning

### 9.1 Purpose

Use the existing communication system to send learning-related summaries and notices without creating a separate notification system.

### 9.2 Core functions

1. Send parent weekly learning summary.
2. Send teacher reminders for scheduled learning activity.
3. Send lab-session completion summary where enabled.
4. Send offline home practice suggestion where approved by teacher.

### 9.3 Validation rules

1. Parent messages must be child-scoped.
2. Learning messages must respect quiet hours/provider status where configured.
3. Failed delivery must not mark a learning summary as viewed.
4. Notifications must not reveal other students or class rankings.

---

## 10. Non-Negotiable Functional Boundaries

1. Do not duplicate core SchoolOS student, teacher, class, subject, parent, file, notification, or audit systems inside Learning.
2. Do not block learning access based on fee status by default.
3. Do not publish public leaderboards for children.
4. Do not show harsh labels like weak, failed, poor, or low-rank.
5. Do not implement open-ended student AI in MVP.
6. Do not expose admin-shaped APIs to student, parent, board, or lab routes.
7. Do not claim KG-12 completion until the matching code, tests, data models, and workflows exist.
