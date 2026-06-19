# M12 Notifications, Notices, Communication, Chat — Web Reference Analysis

**Status:** Approved supporting visual-reference appendix for M12 web frontend design.  
**Module:** M12 Notifications, Notices, Communication, Chat  
**Updated:** 2026-06-19  
**Scope:** Desktop web references for notices, targeting, approvals, delivery logs, provider health, notification center, inbox, parent-teacher chat, escalation, reports, and moderation workflows.

This file replaces the obsolete `M10_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md` numbering. Notifications, Notices, Communication, and Chat is now **M12**, not M10.

---

## 1. Product Intent

M12 is not only a notice board. It is the school communication and notification operating system.

It must support the complete lifecycle:

```text
Create notice
-> choose delivery channels
-> target audience
-> preview recipients
-> preview message by channel
-> schedule, send, or request approval
-> approve high-impact notices
-> dispatch through providers
-> track delivery and callbacks
-> retry failures safely
-> follow up unread recipients
-> manage notification center
-> manage parent/staff conversations
-> report, escalate, moderate, and audit issues
```

The reference set correctly treats communication as a high-risk school workflow because one mistaken notice can reach many parents, staff, transport users, or students.

---

## 2. Reference Screen Inventory

| Reference | Primary job | Required implementation reading |
|---|---|---|
| Communication Dashboard Overview | Monitor module health, notice activity, unread recipients, chat load, escalations, and provider status. | Use as the M12 landing workspace. |
| Notice Composer, Targeting and Recipient Preview | Compose a notice, select channels, target recipients, preview content, preview first recipients, and send/schedule/request approval. | Use as the canonical multi-step notice-send form. |
| High-Impact Notice Approval and Audit | Review high-risk notices, inspect content, attachments, audience, policy, risk, approval history, and audit trail. | Use as the governance workflow for sensitive notices. |
| Delivery Logs, Status Tracking and Retry Center | Track provider dispatches, callbacks, delayed/failed deliveries, retries, duplicates, and out-of-order events. | Use as the operational reliability workspace. |
| Notification Center | Unified user-facing inbox for notices, chats, system alerts, high-priority items, quick actions, and related-recipient context. | Use as the school communication inbox, not as a browser notification clone. |
| Notice Templates and Scheduling | Manage reusable templates, language variants, categories, scheduling controls, channel availability, and upcoming notices. | Use as the repeat-notice productivity workflow. |
| Providers, Channels and Callback Monitor | Monitor SMS/email/push/in-app providers, webhook signature verification, queue backlog, event feed, and provider actions. | Use as the provider reliability and technical-admin surface. |
| Communication Inbox | Manage conversations, folders, filters, linked student summaries, attachments, conversation actions, and quiet hours. | Use as the general conversation management workspace. |
| Parent-Teacher Chat Workspace | Conduct assignment-scoped parent-teacher chat with student context, protected attachments, quiet hours, moderation tools, and safety warnings. | Use as the detailed chat workspace. |
| Escalations, Reports and Moderation Cases | Review reported messages, unsafe attachments, policy violations, severity, SLA, reviewer assignment, and action history. | Use as the school communication safety workspace. |

---

## 3. Information Architecture

Recommended M12 grouping:

```text
Communication
├── Dashboard
├── Notices
│   ├── All Notices
│   ├── Compose Notice
│   ├── Scheduled Notices
│   ├── Approvals
│   └── Templates
├── Notifications
│   ├── Notification Center
│   └── Unread Follow-up
├── Messages
│   ├── Inbox
│   ├── Parent-Teacher Chat
│   ├── Staff Chat
│   └── Archived Conversations
├── Delivery Logs
│   ├── Delivery Events
│   ├── Retry Center
│   └── Provider Callbacks
├── Moderation
│   ├── Escalation Cases
│   ├── Reported Messages
│   └── Blocked Participants
└── Provider Settings
    ├── Channels
    ├── Provider Health
    ├── Webhooks
    └── Secret Rotation
```

Route names may differ if backend or existing web routing already defines them. Preserve workflow separation.

---

## 4. M12 Dashboard Requirements

The dashboard should answer:

```text
What has been sent?
What is scheduled?
What failed?
Who has not read important communication?
Are providers healthy?
Are chats or escalations waiting?
```

Required sections:

| Section | Required behavior |
|---|---|
| KPI strip | Total notices sent, scheduled notices, delivery success rate, unread recipients, active chats, open escalations, provider status. |
| Action row | Create notice, schedule notice, open notification center, view delivery logs, start chat, export logs. |
| Today's notice activity | Recent notices with audience, channels, priority, status, delivery percentage, and scheduled/sent time. |
| Delivery status by channel | In-app, push, email, and SMS success rates with counts. |
| Unread follow-up queue | Recipients who have not read high-priority notices, with message/call/follow-up action. |
| Recent chat activity | Conversation volume, unread/new messages, teachers active, average response time, top conversations. |
| Provider health and mode | SMS/email/push/in-app health, configured/mock/dev status, callback status, and provider-management link. |
| High-impact approvals | Pending approval requests requiring administrator/principal action. |
| Recent communication events | Timeline of duplicate ignored, retry processed, callback verified, delayed retry, notice delivered, and similar events. |

Do not collapse all communication states into `sent`. A notice that has only entered the queue is not delivered.

---

## 5. Required Delivery States

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
```

Provider-disabled, mock, failed, queued, partially-delivered, callback-pending, and retry states must be explicit in UI copy.

---

## 6. High-Risk Rules

- Recipient targeting and preview are backend-owned.
- Browser UI must not calculate official recipient lists.
- Emergency/high-impact notices require approval and audit where policy requires it.
- Provider callbacks must be signed/verified before delivery state changes.
- Retry actions must re-check tenant, provider, recipient, guardian link, and source-record state.
- Chat attachments use File Registry-backed protected access.
- Chat report/block/escalation/moderation actions must be audited.
- Deep links must reauthorize at open time.

---

## 7. Definition of Done

M12 web work is done only when:

- Source modules emit events instead of directly calling providers.
- Notification center and unread counts are user-scoped.
- Notices support recipient targeting, preview, scheduling, delivery tracking, read receipts, and follow-up where enabled.
- Provider-disabled/mock/dev-log states are honest.
- Delivery retries are reasoned and audit-visible for high-impact messages.
- Parent-teacher chat remains assignment/permission scoped.
- Escalation/report/block workflows preserve evidence without exposing it to unauthorized users.
- Cross-tenant, parent-child, role, provider-failure, and retry edge cases have regression coverage before production-readiness claims.
