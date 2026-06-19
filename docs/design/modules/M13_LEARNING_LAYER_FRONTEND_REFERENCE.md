# M13 Learning Layer — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M13 Learning Layer  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M13. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M13 is the SchoolOS classroom learning layer. It must support teacher-created activities, smart-board classroom mode, school-only lab sessions, student practice/quiz attempts, progress summaries, resource library, and parent child-scoped learning summaries.

Core flow:

```text
Teacher creates activity
-> attaches protected learning resources
-> assigns class/section/subject
-> launches board or lab session
-> students join active session
-> attempts autosave/submit
-> teacher reviews progress
-> parent sees child-safe summary
```

M13 must reuse SchoolOS core data: students, staff, classes, sections, subjects, timetable, files, RBAC, audit, and M12 notifications. It must not duplicate those systems.

---

## 2. Theme and Layout Alignment

Use a classroom-friendly but controlled SchoolOS workspace:

```text
ModuleHeader
Learning summary strip
Activity/session tabs
Teacher activity builder
Smart-board runtime
Student lab/session runtime
Progress review workspace
Parent summary cards
Protected resource actions
```

Design rules:

- Teacher tools can be richer, but must remain operational and scope-safe.
- Student runtime must be simple, focused, and active-session scoped.
- Parent summaries must be non-comparative and child-scoped.
- No public leaderboard.
- No AI tutor/runtime unless explicitly approved.
- Learning resources use protected File Registry helpers.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Teacher | Create/launch activities and review progress. | Assigned class/subject only unless broader permission exists. |
| Student | Join active school session and submit attempts. | Active-session/self only. |
| Parent | View linked child learning summary. | Linked-child only. |
| Admin / academic coordinator | Manage activity/resource library where permitted. | Permission-gated. |
| Principal | View adoption and progress summaries. | Summary/read-only unless permitted. |

---

## 4. Recommended Route Map

```text
/dashboard/learning
/dashboard/learning/activities
/dashboard/learning/activities/new
/dashboard/learning/activities/[activityId]
/dashboard/learning/sessions
/dashboard/learning/sessions/[sessionId]
/dashboard/learning/progress
/dashboard/learning/resources
/dashboard/learning/reports
/dashboard/learning/settings
/classroom/board/[sessionCode]
/student/learning
/student/learning/session/[sessionCode]
/parent/learning
```

---

## 5. Required Screens

### 5.1 Learning Dashboard

- KPI cards: active activities, sessions today, students participated, submissions pending review, resources uploaded, parent summaries available.
- Quick actions: Create Activity, Launch Board Session, Start Lab Session, Upload Resource, Review Progress.
- Attention queue: unsynced attempts, incomplete activities, missing resources, session expiry, permission gaps.

### 5.2 Activity Builder

Sections:

```text
Title and objective
Class/section/subject/topic
Activity type
Instructions
Questions/prompts/tasks
Resources and attachments
Time/session settings
Preview
Publish/launch actions
```

Rules:

- Teacher activity creation is assigned-scope unless admin permission allows broader curriculum management.
- Draft/save behavior appears only if backend supports it.
- Resource uploads use protected File Registry flow.

### 5.3 Smart Board Mode

- Full-screen classroom layout.
- Large readable title, instructions, question/task area, timer where supported, teacher controls.
- Minimal navigation and no admin clutter.
- Session code/QR only if backend supports secure expiring session access.

### 5.4 Student Lab / Session Runtime

- Student enters via active session code/QR or assigned route.
- Shows only current activity/session and own attempt.
- Autosave/sync state visible where supported.
- Submit confirmation and result/feedback state only after backend confirmation.

### 5.5 Teacher Progress Review

- Class/session progress table: student, status, score/progress where supported, attempt time, review status.
- Detail drawer for attempt review, feedback, resource access, audit trail.
- Avoid harsh labels; use supportive copy.

### 5.6 Parent Learning Summary

- Linked child selector.
- Recent activities, participation, teacher feedback, strengths/next steps where enabled.
- No class ranking, comparison, leaderboard, or raw internal scoring beyond allowed summary.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Learning activity CRUD APIs
Teacher assignment scope validation
Learning resource File Registry APIs
Board/lab session launch APIs
Expiring session code/QR APIs
Student active-session join APIs
Attempt autosave/submit APIs
Progress/mastery summary APIs
Teacher review/feedback APIs
Parent child-scoped learning summary APIs
M12 learning notification events
Audit logs for launch, submit, feedback, publish, resource access
```

Backend ownership rules:

- Teacher scope is backend-owned.
- Student runtime is active-session/self-scoped by backend.
- Parent summaries are linked-child scoped by backend.
- Session codes must expire and reauthorize.
- Learning resources use File Registry.
- No AI/LLM/adaptive runtime is active unless explicitly approved.

---

## 7. Required States

```text
Loading
No activities
Draft saved
Publish pending
Published
Session starting
Session active
Session expired
Student joined
Autosave pending
Autosave failed
Attempt submitted
Review pending
Feedback published
Resource unavailable
Permission denied
Module locked
Offline read-only
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses real learning APIs only.
[ ] Teacher activity builder is assignment-scoped.
[ ] Resources use protected file helpers.
[ ] Session codes/QR are backend-issued and expiring.
[ ] Student runtime is active-session/self-scoped.
[ ] Parent summaries are child-scoped and non-comparative.
[ ] No leaderboard or AI tutor/runtime is added.
[ ] M12 learning notifications are represented accurately.
[ ] No fake learning metrics remain.
```
