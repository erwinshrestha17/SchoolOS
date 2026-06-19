# M2 Smart Attendance — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M2 Smart Attendance  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines the module-wise frontend design and backend-alignment expectations for M2. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M2 is the daily attendance workspace for teachers, admins, parents, and leadership. It must make attendance marking fast, safe, auditable, and scope-correct.

Core flow:

```text
Select date / class / section
-> load assigned roster
-> mark attendance
-> review not-marked / absent / late states
-> submit or save draft
-> lock / correction workflow
-> notify guardians through M12
-> generate registers and reports
```

---

## 2. Theme and Layout Alignment

Use the SchoolOS workbench pattern:

```text
ModuleHeader
Today summary strip
Class/date selector
Attendance grid/list
Right rail with alerts and history
Sticky submit footer
```

Design rules:

- The teacher screen must be fast and low-friction.
- Admin review screens can be denser with filters and tables.
- Status must be text-labelled, not color-only.
- Absence/late actions must clearly show whether guardian notification is queued, sent, skipped, or failed.
- Locked dates must show read-only state with correction request action where allowed.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Class teacher | Mark daily class attendance. | Assigned class/section only. |
| Subject teacher | Mark period/subject attendance where enabled. | Assigned subject/class only. |
| Admin | Review attendance, corrections, reports. | Tenant-scoped, permission-gated. |
| Principal | Monitor gaps and trends. | Summary/read-only unless permitted. |
| Parent | View linked child attendance. | Linked-child only. |
| Student | View own attendance where enabled. | Self only. |

---

## 4. Recommended Route Map

```text
/dashboard/attendance
/dashboard/attendance/mark
/dashboard/attendance/review
/dashboard/attendance/corrections
/dashboard/attendance/registers
/dashboard/attendance/reports
/dashboard/attendance/settings
/parent/attendance
/student/attendance
/mobile/teacher/attendance
```

Exact paths must follow existing app conventions. Missing APIs must be marked `needs OpenAPI confirmation`.

---

## 5. Required Screens

### 5.1 Attendance Dashboard

- KPI cards: present today, absent today, late today, not marked classes, pending corrections, notification failures.
- Attention queue: not-marked classes, repeated absences, correction requests, lock-window warnings.
- Quick actions: Mark Attendance, Review Corrections, Export Register, Send Follow-up.
- Charts only when backend provides meaningful time-series data.

### 5.2 Mark Attendance

Layout:

```text
Header: class/section/date/period
Roster grid or table
Bulk action row
Student status controls
Right rail: class summary, previous day warning, absent streaks
Sticky footer: Save Draft / Submit Attendance
```

Student row fields:

```text
Photo/initial
Name
Roll no.
Status
Reason / note where required
Previous attendance indicator
Guardian alert state
```

Statuses:

```text
Present
Absent
Late
Half-day
Excused
Not marked
```

### 5.3 Correction Workflow

- Teacher or admin request with date, student, previous status, requested status, reason, supporting note/file where allowed.
- Approver queue with approve/reject action and audit trail.
- Locked records must not be silently edited.

### 5.4 Registers and Reports

- Monthly register view with class/section/date filters.
- Export as queued/protected file where backend supports it.
- Attendance trend summaries must come from backend.

### 5.5 Parent / Student View

- Calendar or monthly list with child/self-scoped records.
- Summary cards: present, absent, late, excused.
- Show school-friendly explanations for corrections/locked days.
- Do not expose other student roster data.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Assigned roster API
Attendance session API
Draft or partial-save API where supported
Submit attendance idempotency
Lock-window enforcement
Correction request/approval workflow
Attendance summary APIs
Register/export job APIs
M12 notification events for absence/late/follow-up
Parent/student purpose-limited read APIs
Audit log for corrections and overrides
```

Backend ownership rules:

- Teacher assignment scope is backend-owned.
- Date lock and correction policy are backend-owned.
- Attendance totals are backend-owned.
- Guardian notifications go through M12.
- Parent/student views are child/self-scoped by backend.

---

## 7. Required States

```text
Loading roster
No assigned class
No students in class
Attendance already submitted
Draft saved
Draft unavailable
Locked date
Correction pending
Correction approved
Correction rejected
Notification queued
Notification failed
Permission denied
Module locked
Offline read-only
Export queued
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses assigned roster API.
[ ] Attendance submit is idempotent.
[ ] Lock-window state is backend-enforced and visible.
[ ] Correction workflow requires reason and audit.
[ ] Parent/student views are purpose-limited.
[ ] Attendance totals come from backend.
[ ] Absence/late notifications use M12.
[ ] Registers/exports use protected job flow.
[ ] No fake attendance metrics remain.
```
