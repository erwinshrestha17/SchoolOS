# M12 Notifications, Notices, Communication, Chat — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M12 Notifications, Notices, Communication, Chat  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`  
**Architecture source:** `docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md`  
**Supporting reference:** `docs/design/M12_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M12. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M12 is the central notification and communication operating system. It owns notification center, notice composer, recipient targeting, templates, scheduled notices, delivery logs, provider callbacks, read receipts, chat, moderation, emergency audit, and retry visibility.

Core flow:

```text
Source module event or authored notice
-> recipient resolution
-> template/channel preview
-> approval where needed
-> schedule / dispatch
-> provider delivery
-> callback verification
-> read state
-> retry / follow-up
-> audit / moderation
```

---

## 2. Theme and Layout Alignment

Use a reliability-focused communication workbench:

```text
ModuleHeader
Delivery health KPI strip
Tabs
Notice/chat/filter workspace
Recipient preview drawer
Provider status rail
Retry/audit timeline
Moderation panel
```

Design rules:

- Do not collapse queued/sent/delivered/read into one vague state.
- High-impact communication requires confirmation, preview, and audit.
- Provider-disabled/mock/failed states must be obvious.
- Recipient targeting and counts are backend-owned.
- Chat and attachments use protected scope and File Registry.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Admin / communication officer | Create notices, target recipients, track delivery. | Permission-gated tenant scope. |
| Principal | Approve high-impact notices and review communication health. | Approval/read-only by permission. |
| Teacher | Parent-teacher communication for assigned classes/students. | Assignment-scoped. |
| Parent | Notification center and linked-child chat/notices. | Linked-child only. |
| Platform operator | Provider diagnostics only. | No message body/private access without override. |

---

## 4. Recommended Route Map

```text
/dashboard/communications
/dashboard/communications/notices
/dashboard/communications/notices/create
/dashboard/communications/notices/[noticeId]
/dashboard/communications/templates
/dashboard/communications/scheduled
/dashboard/communications/approvals
/dashboard/communications/notifications
/dashboard/communications/delivery-logs
/dashboard/communications/retry-center
/dashboard/communications/provider-health
/dashboard/communications/chat
/dashboard/communications/chat/[conversationId]
/dashboard/communications/moderation
/dashboard/communications/settings
/parent/notifications
/parent/messages
/staff/notifications
/student/notifications
```

---

## 5. Required Screens

### 5.1 M12 Dashboard

- KPI cards: notices sent, scheduled notices, delivery success rate, unread recipients, active chats, open escalations, provider status.
- Attention queue: failed deliveries, unread high-priority notices, provider disabled, pending approval, moderation cases.
- Quick actions: Create Notice, Schedule Notice, Open Notification Center, View Delivery Logs, Start Chat, Export Logs.

### 5.2 Notice Composer

Step order:

```text
Notice details
Delivery channels
Target audience
Schedule and template
Live preview
Recipient preview
Recipient summary
Submit / schedule / request approval
```

Design requirements:

- Preview recipient counts before send.
- Preview message per channel.
- Show quiet-hours/provider mode before submit.
- High-impact messages require approval where policy requires it.

### 5.3 Notification Center

- User-scoped inbox with filters: All, Unread, Critical, Attendance, Fees, Transport, Academics, Notices, Chat, System.
- Actions: mark read, read all, archive, open deep link.
- Deep link must reauthorize at open time.

### 5.4 Delivery Logs and Retry Center

- Delivery table: recipient, channel, provider, status, attempts, last error, next retry, callback state.
- Manual retry requires reason where high-impact.
- Provider errors must be safe and non-secret.

### 5.5 Templates and Scheduling

- Template list by category, event type, language/channel, tenant override.
- Schedule calendar/list with draft, scheduled, cancelled, sent states.
- Emergency templates protected from accidental deletion where policy requires it.

### 5.6 Chat and Moderation

- Conversation list with assignment/permission scope.
- Chat detail with linked student context, attachments, quiet hours, report/block/escalate actions.
- Moderation queue with severity, evidence, status, reviewer, audit trail.
- Attachments use File Registry.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Notification event intake APIs/services
Notification center APIs
Unread count APIs
Notification preference APIs
Notice CRUD/composer APIs
Recipient resolver and preview APIs
Template APIs
Schedule APIs
Delivery log APIs
Provider callback verification state
Retry APIs with idempotency and audit
Chat conversation/message APIs
Chat moderation/report/block/escalation APIs
Protected attachment/File Registry APIs
M12 audit logs for high-impact communication
```

Backend ownership rules:

- Source modules emit events; M12 owns delivery lifecycle.
- Recipient resolution is backend-owned.
- Provider state and retry decisions are backend-owned.
- Parent/teacher chat scope is backend-enforced.
- Private message bodies and provider secrets never leak.

---

## 7. Required States

```text
Draft
Approval pending
Approved
Scheduled
Queued
Dispatching
Sent to provider
Delivered
Opened / Read
Partially delivered
Delayed
Failed
Retried
Cancelled
Archived
Provider disabled
Provider mock
Callback pending
Callback verified
Quiet hours delayed
Moderation pending
Permission denied
Module locked
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan, design system, and notification architecture.
[ ] Notification center is user-scoped.
[ ] Recipient preview is backend-owned.
[ ] Notice composer previews channel content and recipient impact.
[ ] Provider-disabled/mock/failed states are explicit.
[ ] Retry actions are idempotency-aware and audit-visible.
[ ] Chat scope is assignment/permission-limited.
[ ] Attachments use protected File Registry helpers.
[ ] Deep links reauthorize at open time.
[ ] No fake delivery/read metrics remain.
```
