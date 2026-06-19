# M5 Activity Feed and Milestones — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M5 Activity Feed and Milestones  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M5. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M5 is the school activity and milestone communication feed. It must support class updates, student milestones, media, consent-aware visibility, parent feed, moderation, reporting, and protected file handling.

Core flow:

```text
Create activity / milestone
-> attach protected media
-> tag class/students
-> run consent and scope checks
-> publish to parent feed
-> notify through M12
-> moderate/report/archive if needed
```

---

## 2. Theme and Layout Alignment

Use a visual but controlled SchoolOS feed style:

```text
ModuleHeader
Activity summary strip
Composer / quick action row
Feed or table workspace
Media/detail drawer
Consent and visibility panel
Moderation/audit timeline
```

Design rules:

- Activity screens can be more visual than finance/admin screens, but must stay operational.
- Media cards must show protected loading/error/unavailable states.
- Consent warnings must be obvious before publish.
- Parent feed must be child-scoped and simplified.
- Moderation actions require confirmation and audit visibility.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Teacher | Post class updates and milestones. | Assigned classes/students only. |
| School admin | Review, publish, moderate, archive. | Permission-gated tenant scope. |
| Principal | View school activity summary and flagged posts. | Summary/moderation where permitted. |
| Parent | View linked child activity/milestones. | Linked-child and consent-safe only. |
| Student | View own/class allowed activity where enabled. | Self/class scoped only. |

---

## 4. Recommended Route Map

```text
/dashboard/activity
/dashboard/activity/feed
/dashboard/activity/create
/dashboard/activity/[postId]
/dashboard/activity/milestones
/dashboard/activity/media
/dashboard/activity/moderation
/dashboard/activity/reports
/dashboard/activity/settings
/parent/activity
/student/activity
```

---

## 5. Required Screens

### 5.1 Activity Dashboard

- KPI cards: posts this week, pending review, media items, consent warnings, parent views, reported posts.
- Quick actions: Create Post, Add Milestone, Upload Media, Review Reports.
- Recent timeline with filters by class, section, teacher, activity type, and visibility.

### 5.2 Activity Composer

Sections:

```text
Post title/message
Class/section/student targeting
Media attachments
Milestone tags
Visibility settings
Consent warnings
Preview
```

Design requirements:

- Preview parent-facing view before publish.
- Show consent warnings before tagging students/media.
- Use protected upload widgets.
- Publish action requires validation and clear visibility summary.

### 5.3 Feed / Timeline Workspace

- Cards with title, author, audience, media preview, tags, publish state, engagement/read state where supported.
- Table mode for admin moderation and batch review.
- Right drawer: selected post detail, tagged students, consent state, file list, audit trail.

### 5.4 Milestones

- Student milestone list with type, date, teacher, visibility, linked media.
- Add milestone with guardian visibility preview.
- Parent milestone view must be linked-child only.

### 5.5 Moderation and Reports

- Reported post queue with severity, reporter type, reason, media presence, status.
- Actions: hide, restore, archive, escalate, resolve with note.
- Moderation evidence must not leak to unauthorized users.

### 5.6 Parent Activity View

- Linked child selector.
- Feed cards with child-safe content only.
- Protected media preview/download.
- No internal moderation notes, other students, or consent-hidden media.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Activity post CRUD APIs
Media/File Registry upload and preview APIs
Student/class targeting APIs
Consent visibility checks
Milestone APIs
Parent child-scoped feed APIs
Moderation/report workflow APIs
Read/view metrics where supported
M12 activity notification events
Audit logs for publish, archive, moderation, and media access
```

Backend ownership rules:

- Consent and guardian visibility are backend-owned.
- Parent feed is linked-child scoped by backend.
- Media access uses File Registry.
- Moderation state is backend-owned.

---

## 7. Required States

```text
Loading feed
Empty feed
Media uploading
Media processing
Media unavailable
Consent warning
Publish pending
Published
Pending review
Reported
Hidden
Archived
Permission denied
Module locked
Partial upload failure
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses real activity/media APIs only.
[ ] Media uses protected file helpers.
[ ] Consent warnings come from backend response.
[ ] Parent view is linked-child scoped.
[ ] Moderation actions are audited.
[ ] Publish preview is clear and school-friendly.
[ ] M12 activity notifications are represented accurately.
[ ] No fake activity metrics remain.
```
