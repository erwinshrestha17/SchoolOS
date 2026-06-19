# M10 Communication Web Reference Analysis

**Status:** Approved supporting visual-reference appendix for Module 10 web frontend design  
**Module:** M10 Notices / Communication / Chat  
**Updated:** 2026-06-19  
**Scope:** Desktop web references for notices, targeting, approvals, delivery logs, provider health, notification center, inbox, parent-teacher chat, escalation, reports, and moderation workflows.

This document records the supplied Module 10 visual references and turns them into frontend implementation guidance for `apps/web`.

It is a supporting appendix only. The canonical web rules remain in:

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
```

Backend/OpenAPI/shared contracts remain authoritative for routes, fields, status enums, permissions, delivery-state transitions, provider ownership, audit events, protected file access, and tenant boundaries.

---

## 1. Module 10 Product Intent

Module 10 is not only a notice board. It is the school communication operating system.

It must support the complete communication lifecycle:

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
  -> manage parent/staff conversations
  -> report, escalate, moderate, and audit issues
```

The reference set correctly treats communication as a high-risk school workflow because one mistaken notice can reach thousands of parents, staff, transport users, or students.

---

## 2. Reference Screen Inventory

| Reference | Primary job | Required implementation reading |
|---|---|---|
| Communication Dashboard Overview | Monitor module health, notice activity, unread recipients, chat load, escalations, and provider status. | Use as the M10 landing workspace. |
| Notice Composer, Targeting & Recipient Preview | Compose a notice, select channels, target recipients, preview content, preview first recipients, and send/schedule/request approval. | Use as the canonical multi-step notice-send form. |
| High-Impact Notice Approval & Audit | Review high-risk notices, inspect content, attachments, audience, policy, risk, approval history, and audit trail. | Use as the governance workflow for sensitive notices. |
| Delivery Logs, Status Tracking & Retry Center | Track provider dispatches, callbacks, delayed/failed deliveries, retries, duplicates, and out-of-order events. | Use as the operational reliability workspace. |
| Notification Center | Unified user-facing operational inbox for notices, chats, system alerts, high-priority items, quick actions, and related-recipient context. | Use as the school communication inbox, not as a browser notification clone. |
| Notice Templates & Scheduling | Manage reusable templates, language variants, categories, scheduling controls, channel availability, and upcoming notices. | Use as the repeat-notice productivity workflow. |
| Providers, Channels & Callback Monitor | Monitor SMS/email/push/in-app providers, webhook signature verification, queue backlog, event feed, and provider actions. | Use as the provider reliability and technical-admin surface. |
| Communication Inbox | Manage conversations, folders, filters, linked student summaries, attachments, conversation actions, and quiet hours. | Use as the general conversation management workspace. |
| Parent-Teacher Chat Workspace | Conduct assignment-scoped parent-teacher chat with student context, protected attachments, quiet hours, moderation tools, and safety warnings. | Use as the detailed chat workspace. |
| Escalations, Reports & Moderation Cases | Review reported messages, unsafe attachments, policy violations, severity, SLA, reviewer assignment, and action history. | Use as the school communication safety workspace. |

---

## 3. Information Architecture

Recommended M10 sidebar grouping under `Communication`:

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

Route names may differ if backend or existing web routing already defines them. The user-facing structure should still preserve the same workflow separation.

---

## 4. Communication Dashboard Overview

### 4.1 Screen purpose

The dashboard is the M10 command center. It should answer:

```text
What has been sent?
What is scheduled?
What failed?
Who has not read important communication?
Are providers healthy?
Are chats or escalations waiting?
```

### 4.2 Required dashboard sections

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
| Recent communication events | Timeline of duplicate ignored, retry processed, callback verified, delayed retry, notice delivered, and similar operational events. |

### 4.3 Metric state rules

Do not collapse all communication states into `sent`.

Required states for the UI:

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

Dashboard copy must be precise. A notice that has only entered the queue is not delivered.

---

## 5. Notice Composer, Targeting, and Recipient Preview

### 5.1 Screen purpose

The composer is the highest-risk daily workflow in M10. It must prevent accidental mass communication and wrong audience targeting.

### 5.2 Required layout

Use the reference ordering:

```text
1. Notice Details
2. Delivery Channels
3. Target Audience
4. Schedule & Template
5. Live Preview
6. Recipient Preview
7. Recipient Summary
```

### 5.3 Notice details

Required fields:

| Field | UI rule |
|---|---|
| Notice title | Required, character counter visible. |
| Category | Required; examples: holiday, emergency, exam, fees, transport, library, canteen, HR, general. |
| Priority | Required; low, medium, high, critical. |
| Reference | Optional but useful for memo number or external reference. |
| Description | Rich-text editor with safe formatting only. |
| Attachments | Protected-file rows with upload progress, file type, size, remove action, and protected status. |

### 5.4 Delivery channels

Supported channel cards:

```text
In-app
Push Notification
Email SMTP
SMS
```

Each channel card must show:

- Selected/unselected state.
- Provider availability.
- Mock/dev/configured state where relevant.
- Unavailable/disabled state.
- Per-channel preview tab if selected.

If a provider is down or disabled, dispatch through that channel must be blocked unless backend policy explicitly supports an audited override.

### 5.5 Target audience

Audience selectors should support:

- Classes.
- Sections.
- Parents/guardians.
- Students where allowed.
- Staff.
- Teachers.
- Transport users.
- Custom recipients.
- Include inactive parents toggle only where permission and backend policy allow it.

Recipient counts must be backend-derived or explicitly labeled as approximate.

### 5.6 Recipient warning before send

Before final send or schedule, show a confirmation summary:

```text
This notice will be sent to 4,278 recipients across 4 channels.
SMS recipients: 3,904.
Email recipients: 4,102.
Push recipients: 2,950.
Estimated SMS cost: unavailable / NPR amount from backend if provided.
High-impact approval required: Yes / No.
```

The frontend must not invent SMS cost. Show cost only if backend returns it.

### 5.7 Recipient preview modal

The `View all recipients` action should open a full modal or page with:

| Column | Purpose |
|---|---|
| Name | Human-readable recipient. |
| Type | Parent, student, teacher, staff, transport, custom. |
| Class / role | Context. |
| Guardian/student relation | Required for parent recipients. |
| Channel availability | Phone/email/app/push eligibility. |
| Excluded reason | No phone, no email, app not installed, guardian inactive, transferred student, route inactive, permission blocked. |

---

## 6. High-Impact Notice Approval and Audit

### 6.1 Screen purpose

High-impact communication must be reviewed before sending. The approval screen must make risk, policy, and audit history visible.

### 6.2 Approval triggers

Recommended frontend trigger display:

| Trigger | Example |
|---|---|
| Finance | Fee hike, fee due, penalty, scholarship or refund notice. |
| Emergency | Closure, disaster, lockdown, urgent safety notice. |
| Exam | Board exam routine, result, admit-card, schedule change. |
| Discipline | Suspension, misconduct, policy warning. |
| School policy | Uniform, attendance, transport, transfer, promotion rules. |
| Large audience | All parents, all students, all staff, full-school broadcast. |
| Sensitive attachment | Confidential PDF, board letter, student-sensitive document. |

### 6.3 Required approval detail panel

When a row is selected, show:

- Notice title.
- Priority and approval state.
- Requester.
- Request time.
- Scheduled-for time.
- Requested recipient count.
- Notice content preview and full-content link.
- Delivery channels with channel recipient counts.
- Attachments with protected-file state.
- Approval policy.
- Risk assessment.
- Audit trail.
- Approval history.
- Comment field.
- Approve, reject, return-for-changes, add-comment actions.
- Lock-after-approval toggle only where permission and backend policy allow it.

### 6.4 Approval diff requirement

Returned or edited approval requests should expose a diff summary:

```text
Changed since last approval request:
- Audience changed from Grade 10 students to All Parents.
- Attachment replaced.
- Scheduled time changed.
- Priority changed from Medium to High.
```

This should come from backend/audit data. If backend does not expose diff metadata, show an honest unavailable state.

---

## 7. Delivery Logs, Status Tracking, and Retry Center

### 7.1 Screen purpose

This workspace is for operational reliability. It proves whether communication reached recipients and why failures happened.

### 7.2 Required filters

```text
Notice / Notification
Channel
Status
Date range
Provider
Recipient / message ID search
Saved filters
```

### 7.3 Delivery log columns

| Column | Required behavior |
|---|---|
| Recipient | Name, relation/context, avatar/initials where available. |
| Channel | SMS, push, email, in-app. |
| Provider / message ID | Provider name and masked/truncated provider message ID with copy action if allowed. |
| Sent time | School timezone display. |
| Status | Delivered, failed, delayed, duplicate, out-of-order, pending. |
| Failure reason | Bounded human-readable reason; no raw stack/provider secret. |
| Retry | Retry count and action state. |
| Callback | Delivered, failed, pending, ignored. |

### 7.4 Detail side panel

The selected event panel should show:

- Delivery result.
- Channel.
- Recipient identity and contact context.
- Notice name.
- Provider.
- Provider message ID.
- Sent time.
- Delivered/failed time.
- Callback status.
- Retry count.
- Retry reason.
- Last retry time.
- Retry delivery action.
- View recipient action.
- Export log action.
- Normalized provider event where permission allows it.
- Event timeline.

### 7.5 Raw provider event safety

Raw provider event payloads must be permission-gated. Never expose:

```text
API keys
signing secrets
access tokens
full webhook secret headers
provider credentials
private object-storage keys
unmasked sensitive contact data beyond existing permission scope
```

### 7.6 Bulk retry actions

Add bulk operational actions where backend supports them:

- Retry selected failed SMS.
- Retry selected failed email.
- Retry selected delayed events.
- Export invalid phone numbers.
- Export bounced emails.
- Suppress repeated invalid number.
- Mark duplicate/out-of-order event as reviewed.

---

## 8. Notification Center

### 8.1 Screen purpose

The notification center is the staff/admin communication inbox. It should combine notices, chats, system alerts, high-priority communication, read/unread status, and quick actions.

### 8.2 Required sections

| Section | Behavior |
|---|---|
| Tabs | All, unread, notices, chats, system, high priority. |
| Bulk toolbar | Select all, mark as read, archive, more actions. |
| Filter/sort | Filters, newest first, view density. |
| List | Icon, title, source/audience, snippet, timestamp, unread marker. |
| Detail | Notice/chat/system content, metadata, attachments, quick actions. |
| Right rail | Related recipients, recent activity, priority/status. |

### 8.3 Quick actions

Required quick actions when permitted:

```text
Mark as read
Follow up
Open chat
Download attachment
View delivery details
Archive
```

Download and delivery-detail actions must respect protected-file and permission rules.

---

## 9. Notice Templates and Scheduling

### 9.1 Screen purpose

Templates reduce repetitive notice work and improve consistency across recurring school communication.

### 9.2 Template library behavior

Support:

- Template library.
- My templates.
- Archived templates.
- Search by template name/keyword.
- Category filter.
- Language filter.
- Preview panel.
- Usage count.
- Duplicate.
- Archive.
- Save as new.
- Use template.

### 9.3 Recommended categories

```text
Holiday
Emergency
Exam
Fees
Transport
Library
Canteen
HR
General Announcement
Event
```

### 9.4 Language variants

Nepal school communication needs multilingual support:

```text
English
Nepali
English + Nepali mixed
SMS-short version
Email-long version
In-app formatted version
```

The UI should not assume one template body fits every channel.

### 9.5 Scheduling controls

Scheduling controls must show:

- Schedule date.
- Time.
- Recurrence.
- Time zone, normally `Asia/Kathmandu`.
- Channel availability.
- Target audience.
- Upcoming scheduled notices.

Emergency notices may bypass quiet hours only if backend policy allows it and audit reason is collected.

---

## 10. Providers, Channels, and Callback Monitor

### 10.1 Screen purpose

This screen is for provider reliability, callback verification, queue health, and technical operations.

### 10.2 Provider cards

Each provider card should include:

| Field | Examples |
|---|---|
| Channel | SMS, email, push, in-app. |
| Primary provider | Twilio, SendGrid, FCM, SchoolOS internal. |
| Configuration state | Configured, mock/dev, disabled. |
| Provider health | Healthy, degraded, down. |
| Last callback | Relative time and exact tooltip. |
| Queue backlog | Count and warning threshold. |
| Signature verification | Verified, failed, not supported, no signature. |
| Actions | Test provider, rotate secret, view logs, more actions. |

### 10.3 Health key

Use explicit chips and dots:

| State | UI meaning |
|---|---|
| Healthy | Green, provider functioning. |
| Degraded | Warning, partial failure or backlog. |
| Down | Red, dispatch should be blocked or fail-closed. |
| Disabled | Gray, unavailable. |
| Mock/dev | Blue or purple chip; never imply production provider proof. |

### 10.4 Callback event table

Columns:

```text
Event type
Provider
Signed / verified
Event time
Parsed outcome
Duplicate / order handling
```

Security rule: events that fail signature verification should still be logged and visibly flagged, but should not be trusted as successful delivery proof unless backend marks them accepted under a safe policy.

### 10.5 Provider action safety

High-risk actions must require permission and confirmation:

- Rotate secret.
- Disable all channels.
- Disable one provider.
- Retry large queue.
- Mark provider healthy manually.
- Edit webhook endpoint.

---

## 11. Communication Inbox

### 11.1 Screen purpose

The inbox is the administrative conversation manager for school communication.

### 11.2 Required left rail

Folders:

```text
Inbox
Starred
Sent
Drafts
Resolved
Archived
Spam
Blocked
```

Filters:

```text
All conversations
Unread
Mentions
With attachments
Parent-teacher
Staff
Quiet hours
```

Labels:

```text
Academic
Behavior
Fees
Events
```

### 11.3 Conversation summary panel

When a conversation is selected, show:

- Participant name and role.
- Linked student where applicable.
- Relationship.
- Class and section.
- Contact information where permitted.
- Conversation summary.
- Shared attachments.
- Resolve action.
- Escalate action.
- Block contact action.
- More actions.
- Quiet-hours notice.

### 11.4 Conversation ownership

Add ownership to avoid conflicting replies:

```text
Assigned to: Class Teacher / Admin / Counselor / Transport Incharge
```

If unassigned, show an explicit assignment action where permission allows.

---

## 12. Parent-Teacher Chat Workspace

### 12.1 Screen purpose

The chat workspace supports controlled parent-teacher communication with student context and safety moderation.

### 12.2 Required layout

Use the three-column pattern:

```text
Left: Conversation list and search
Center: Active chat thread and composer
Right: Student context, conversation details, moderation/safety, quiet hours
```

### 12.3 Required chat features

- Parent identity and linked student.
- Active/offline state if backend supports it.
- Search conversation.
- Audio/video icons only if real backend capability exists; otherwise omit.
- Personal-data safety banner.
- Message bubbles with timestamps.
- Delivery/read state if backend provides it.
- Typing indicator if backend supports it.
- Protected attachment card.
- Secure/school-moderated footer.
- Quiet-hours indicator.

### 12.4 Teacher scope rule

Teacher chat scope must remain assignment-limited unless the user has explicit broader permission.

Examples:

```text
Teacher can message parents of assigned class/subject students.
Transport in-charge can message parents for assigned route students.
Finance role can message fee-related recipients only where policy allows.
Principal/admin can view or escalate broader communication according to permission.
```

### 12.5 Message-level actions

When supported by backend and permission:

```text
Reply
Copy
Report message
Forward/escalate to admin
Download protected attachment
View audit
Translate to Nepali / English
Delete for me
```

Do not add message deletion for everyone unless backend policy and audit support it.

---

## 13. Escalations, Reports, and Moderation Cases

### 13.1 Screen purpose

This workspace manages safety, policy violations, reports, blocked users, and escalated communication cases.

### 13.2 Required tabs

```text
Open
Under Review
Resolved
Reopened
Blocked
```

### 13.3 Filters

```text
Issue type
Severity
Channel
Staff
Date range
Search cases
```

### 13.4 Moderation case table

Columns:

| Column | Purpose |
|---|---|
| Case ID | Human-readable case reference. |
| Conversation | Channel and conversation context. |
| Reporter | Reporter name and role, anonymous where policy requires. |
| Student context | Student/class/roll where applicable and permitted. |
| Issue type | Inappropriate language, harassment, policy violation, abuse/threat, misleading content, spam, academic misconduct, unsafe attachment. |
| Severity | Low, medium, high, critical. |
| Assigned staff | Reviewer/counselor/admin. |
| SLA | Time left and due time. |

### 13.5 Detail panel

Required fields:

- Case ID.
- Conversation type.
- Status.
- SLA and due time.
- Summary.
- Reported attachment with protected preview/download.
- Conversation excerpt.
- Action history.
- Assign reviewer.
- Resolve case.
- Reopen case.
- Block participant.
- Add audit note.

### 13.6 Severity matrix

Recommended SLA display:

| Severity | SLA guidance | Default action |
|---|---:|---|
| Low | 24 hours | Review and note. |
| Medium | 8 hours | Assign reviewer. |
| High | 2 hours | Escalate to administrator/principal. |
| Critical | Immediate | Notify responsible authority per school policy. |

The actual SLA values must come from backend/school settings if configurable.

---

## 14. Reusable Frontend Components

Recommended component inventory:

```text
CommunicationMetricCard
NoticeStatusChip
PriorityBadge
ChannelSelectorCard
RecipientSelector
RecipientSummaryCard
RecipientPreviewModal
NoticeLivePreview
NoticeApprovalDetailPanel
ApprovalAuditTimeline
AttachmentProtectedFileRow
DeliveryStatusTable
DeliveryEventDetailPanel
ProviderHealthCard
WebhookEventTimeline
NotificationListItem
ConversationListItem
ConversationSummaryPanel
ChatMessageBubble
ChatComposer
StudentContextPanel
QuietHoursBanner
ModerationCaseTable
EscalationDetailDrawer
TemplatePreviewCard
ScheduleNoticePanel
```

Shared filters:

```text
DateRangeFilter
ChannelFilter
ProviderFilter
PriorityFilter
AudienceFilter
StatusFilter
AssignedStaffFilter
SeverityFilter
SearchWithShortcut
```

---

## 15. Visual System Notes

### 15.1 Layout patterns

The M10 references use four reusable workspace patterns:

| Pattern | Screens |
|---|---|
| Dashboard grid | Communication dashboard. |
| Form + preview rail | Notice composer. |
| Table + right detail panel | Approvals, delivery logs, moderation. |
| Three-column conversation workspace | Inbox and parent-teacher chat. |
| Library + preview rail | Templates and scheduling. |

### 15.2 Status color usage

| Purpose | Visual direction |
|---|---|
| Primary action | Deep SchoolOS blue. |
| Delivered / healthy / approved | Green. |
| Pending / delayed / warning | Orange. |
| Failed / high risk / blocked | Red. |
| In-app / info / selected | Blue. |
| Duplicate / archived / neutral | Gray. |
| Mock/dev | Blue or purple chip. |

Color must never be the only meaning. Always include readable text labels.

### 15.3 Density rule

M10 is allowed to be dense because communication operations need queues, logs, recipient counts, and audit trails. Density is acceptable only if:

- The page has one clear job.
- Current selection is obvious.
- Status chips are readable.
- Tables have clear column priorities.
- Detail rails can collapse on smaller screens.
- Empty/unavailable states are honest.

---

## 16. Permission and Role Expectations

Suggested frontend visibility matrix. Backend remains authoritative.

| Feature | Super Admin | Principal | Admin | Teacher | Accountant | Transport | Parent |
|---|---:|---:|---:|---:|---:|---:|---:|
| Create notice | Yes | Yes | Yes | Limited | Limited | Limited | No |
| Send all-school notice | Yes | Yes | Limited | No | No | No | No |
| Send class notice | Yes | Yes | Yes | Assigned only | No | No | No |
| Fee notice | Yes | View | Yes | No | Yes | No | No |
| Transport notice | Yes | View | Yes | No | No | Yes | No |
| Approve high-impact notice | Yes | Yes | Configurable | No | No | No | No |
| View delivery logs | Yes | Yes | Yes | Limited | Limited | Limited | Own child only |
| Parent chat | View/escalate | View/escalate | View/escalate | Assigned students only | No | Route students only | Own child only |
| Moderation cases | Yes | Yes | Yes | Assigned only | No | Assigned only | No |
| Provider settings | Yes | View | Limited | No | No | No | No |

---

## 17. Frontend Validation Rules

Before sending or scheduling a notice, the UI must validate:

```text
Title exists.
Content exists.
At least one channel is selected.
At least one eligible recipient exists.
Attachments are uploaded and protected.
Schedule time is valid.
Provider is available for every selected channel, or channel is blocked.
High-impact approval is completed if required.
Confirmation summary has been shown.
```

High-impact notice block:

```text
requiresApproval === true
approvalStatus !== "approved"
=> send action disabled with clear reason
```

Provider unavailable block:

```text
Selected SMS channel cannot be used because SMS provider is disabled.
This notice can still be sent through In-app, Push, or Email if those channels are available.
```

---

## 18. Protected Files and Attachments

M10 attachment surfaces include:

```text
Notice attachments
Template attachments
Chat attachments
Reported moderation evidence
Delivery exports
Provider logs where exported
```

All attachment actions must use File Registry-backed authenticated helpers. Do not open raw private URLs.

Attachment rows should show:

- File name.
- File type.
- File size.
- Protected state.
- Download action.
- Remove action where editing is allowed.
- Permission denied/unavailable state.
- Audit/logging behavior where applicable.

---

## 19. Nepal-Specific Communication Requirements

Module 10 should respect Nepal school operations:

- Display `Asia/Kathmandu` where time zone matters.
- Support B.S. dates where the broader SchoolOS date system supports them.
- Support English and Nepali notice templates.
- Support short SMS copy separate from richer in-app/email copy.
- Keep safety warnings around OTP, passwords, and payment details visible in chat.
- Support transport, fee, exam, holiday, and emergency notice categories as first-class school workflows.

---

## 20. Missing Screens to Add

The references are strong. Add these supporting screens when backend contracts exist:

| Missing screen | Purpose |
|---|---|
| Full Recipient Modal | Inspect all recipients, eligibility, channels, excluded reasons. |
| Notice Detail Page | Post-send content, audience, channels, analytics, attachments, replies, audit. |
| Failed Delivery Bulk Retry Page | Group failures by reason, retry safely, export invalid contacts. |
| Emergency Notice Composer | Simplified emergency flow with quiet-hours override and mandatory audit reason. |
| Provider Settings Detail | Per-provider quotas, webhook URL, secret rotation, retry policy, test message, disable provider. |
| Approval Diff View | Show content/audience/attachment/schedule changes after a returned approval request. |

---

## 21. Implementation Priority

### Phase 1: Core notice value

```text
Communication dashboard
Notice list
Notice composer
Recipient preview
Notice templates
Scheduled notices
Delivery logs
```

### Phase 2: Governance and reliability

```text
High-impact approval queue
Audit trail
Provider health
Callback monitor
Retry center
Export logs
```

### Phase 3: Chat and safety

```text
Communication inbox
Parent-teacher chat
Staff chat
Escalations
Moderation cases
Blocking/reporting workflows
```

---

## 22. Acceptance Criteria

A production-quality M10 frontend slice is acceptable only when:

- No screen uses fake metrics or browser-only production truth.
- Notice send/schedule/approval actions use real backend APIs.
- Recipient counts and eligibility come from backend contracts.
- High-impact notices cannot be sent before approval.
- Provider-disabled channels are visibly blocked.
- Delivery logs show precise lifecycle states, not only generic success/failure.
- Retry actions are permission-gated and audited.
- Raw provider payloads are permission-gated and secrets are never displayed.
- Attachments use protected-file helpers.
- Teacher chat is assignment-scoped.
- Quiet-hours behavior is visible and backend-enforced.
- Escalation/report/block actions are audited.
- Empty, loading, error, locked, and permission-denied states are implemented.
- Responsive behavior preserves the main job instead of squeezing dense desktop tables into unreadable layouts.

---

## 23. Final Design Assessment

The supplied Module 10 references are strong, coherent, and production-oriented.

The highest-value patterns to preserve are:

- Recipient preview before send.
- Per-channel notice preview.
- Protected attachment indicators.
- High-impact approval and audit workflow.
- Delivery logs with retries, duplicate handling, and out-of-order callback visibility.
- Provider health and callback monitor.
- Unread follow-up queue.
- Quiet-hours communication controls.
- Student context inside parent-teacher chat.
- Moderation cases with SLA, evidence, and audit history.

The main frontend improvement target is state accuracy: users must always know whether a notice is drafted, approved, queued, sent to provider, delivered, opened, delayed, partially delivered, failed, or retried.

That precision will make Module 10 a SchoolOS differentiator: most school systems can send notices, but SchoolOS should prove delivery, manage risk, protect communication, and audit every high-impact action.
