# M6 Homework and Timetable — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M6 Homework and Timetable  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M6. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M6 is the daily academic scheduling and homework workspace. It must support homework creation, publishing, attachments, due dates, timetable setup, substitution handling, conflict detection, parent/student visibility, and teacher-friendly daily planning.

Core flow:

```text
Create homework or timetable plan
-> select class/section/subject/teacher/date
-> attach resources where needed
-> validate conflicts or missing details
-> publish / lock / archive
-> notify through M12
-> show parent/student scoped views
```

---

## 2. Theme and Layout Alignment

Use a teacher-friendly SchoolOS planning workspace:

```text
ModuleHeader
Academic context selector
Calendar / week grid / list tabs
Filter bar
Main homework or timetable workspace
Right detail drawer
Conflict/validation rail
Protected attachment actions
```

Design rules:

- Homework screens should be simple enough for daily teacher use.
- Timetable screens can be denser but must emphasize conflicts and publish state.
- Use clear date/time labels and class/section/subject chips.
- Attachment previews use protected file helpers.
- Parent/student views are simplified, not admin-shaped.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Teacher | Create homework and view own timetable. | Assigned class/subject only. |
| Academic coordinator | Manage timetable and substitutions. | Permission-gated tenant scope. |
| Admin | Configure periods, rooms, subjects, settings. | Permission-gated. |
| Parent | View linked child homework/timetable. | Linked-child only. |
| Student | View own homework/timetable. | Self only. |

---

## 4. Recommended Route Map

```text
/dashboard/homework
/dashboard/homework/create
/dashboard/homework/[homeworkId]
/dashboard/homework/review
/dashboard/timetable
/dashboard/timetable/builder
/dashboard/timetable/substitutions
/dashboard/timetable/conflicts
/dashboard/timetable/reports
/dashboard/timetable/settings
/parent/homework
/parent/timetable
/student/homework
/student/timetable
```

---

## 5. Required Screens

### 5.1 Homework Dashboard

- KPI cards: homework assigned today, due today, overdue submissions where supported, drafts, pending review, attachment failures.
- Filters: class, section, subject, teacher, date range, status.
- Quick actions: Create Homework, View Due Today, Upload Resource, Export Homework List.

### 5.2 Homework Create/Edit

Sections:

```text
Title and instructions
Class/section/subject
Due date and time
Attachments/resources
Visibility and publish state
Student/parent preview
```

Design requirements:

- Sticky footer: Save Draft, Publish, Archive/Lock where allowed.
- Attachment uploads use File Registry.
- Publish confirmation shows target class/section and due date.
- Draft behavior only if backend supports it.

### 5.3 Homework List and Detail

- Table/card list with title, subject, class, due date, status, attachment count, publish state, teacher.
- Detail drawer: instructions, attachments, assigned students/classes, audit history, notification state.
- Statuses: Draft, Published, Due Soon, Overdue, Archived, Locked.

### 5.4 Timetable Builder

- Week grid by class/section/teacher/room.
- Period blocks with subject, teacher, room, time, conflict state.
- Drag/drop only if backend supports safe reorder/update contracts.
- Conflict rail showing teacher, room, class, period, and duplicate assignment issues.

### 5.5 Substitution Workflow

- Absent teacher or changed period selection.
- Candidate substitute list where backend supports it.
- Confirmation with impacted classes and notification state.

### 5.6 Parent / Student View

- Today and upcoming homework.
- Timetable day/week view.
- Protected attachments.
- Child/self scoped only.
- No teacher internal notes or unpublished drafts.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Homework CRUD and publish APIs
Homework attachment File Registry APIs
Teacher assignment scope APIs
Student/parent homework read APIs
Timetable period/room/teacher APIs
Conflict detection APIs
Substitution workflow APIs
Timetable export APIs
M12 homework/timetable notification events
Audit logs for publish, lock, archive, substitution
```

Backend ownership rules:

- Teacher assignment scope is backend-owned.
- Conflict detection is backend-owned.
- Publish/lock/archive state is backend-owned.
- Attachments use File Registry.
- Parent/student views are linked-child/self-scoped by backend.

---

## 7. Required States

```text
Loading
Empty homework list
No timetable configured
Draft saved
Publish pending
Published
Locked
Archived
Attachment unavailable
Conflict detected
Substitution pending
Substitution confirmed
Permission denied
Module locked
Export queued
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses real homework/timetable APIs only.
[ ] Teacher scope is assignment-limited.
[ ] Timetable conflicts come from backend.
[ ] Attachments use protected file helpers.
[ ] Publish/lock/archive actions are permission-gated.
[ ] Parent/student routes are purpose-limited.
[ ] M12 notifications are represented accurately.
[ ] No fake timetable/homework metrics remain.
```
