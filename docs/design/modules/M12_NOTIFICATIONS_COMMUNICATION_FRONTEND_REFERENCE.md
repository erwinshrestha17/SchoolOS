# M12 Notifications, Notices, Communication, Chat — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-21
**Module:** M12 Notifications, Notices, Communication, Chat
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M12 owns SchoolOS notification intake, recipient resolution, templates, preferences, channel routing, provider delivery, retries, read state, notices, chat, moderation, and emergency communication audit.

It prevents every feature module from inventing delivery logic and gives schools precise evidence from authored message through recipient, provider, read, retry, and moderation outcomes.

For Nepal schools, it must support in-app-first communication, Nepali/English templates, SMS-conscious cost/quiet-hours behavior, guardian-phone realities, emergency messaging, and moderated parent-teacher contact.

---

## 2. Full Feature List

### Notification center

**Purpose:**
Gives each user a scoped inbox, unread count, read/archive actions, and reauthorized deep links.

**Users:**
All users.

**Frontend behavior:**
Filterable inbox with priority/category/status and safe preview.

**Backend alignment:**
Backend owns recipient/read state.

### Notice composer

**Purpose:**
Creates authored school notices with content, channels, audience, schedule, attachments, and approval.

**Users:**
Authorized staff.

**Frontend behavior:**
Form plus per-channel preview and impact summary.

**Backend alignment:**
Backend validates policy/workflow.

### Targeting and recipient preview

**Purpose:**
Resolves eligible recipients and exclusions before send.

**Users:**
Notice author/approver.

**Frontend behavior:**
Audience controls, backend counts, exclusions, channel eligibility, cost unavailable/estimate state.

**Backend alignment:**
Backend resolver is authoritative.

### Templates

**Purpose:**
Maintains event/channel/language/tenant variants and protected emergency defaults.

**Users:**
Communication admin.

**Frontend behavior:**
Template library/editor/preview/version history.

**Backend alignment:**
Backend renders/version-controls.

### Scheduled notices

**Purpose:**
Plans, edits/cancels eligible notices, and shows backend schedule state.

**Users:**
Authors/admin.

**Frontend behavior:**
Calendar/list and state timeline.

**Backend alignment:**
Backend scheduler owns timing.

### Approvals

**Purpose:**
Reviews high-impact audience/content/channels/attachments before dispatch.

**Users:**
Approver.

**Frontend behavior:**
Impact/detail/audit review with approve/reject/return.

**Backend alignment:**
Backend owns transitions.

### Provider health

**Purpose:**
Shows configured/disabled/mock/degraded state without secrets.

**Users:**
Tenant/platform operators by plane.

**Frontend behavior:**
Health cards and safe diagnostic timeline.

**Backend alignment:**
Backend/provider adapter supplies state.

### Delivery logs

**Purpose:**
Distinguishes queued, provider accepted, delivered, read, delayed, partial, failed, and callback state.

**Users:**
Authorized operators.

**Frontend behavior:**
Paginated delivery table/detail.

**Backend alignment:**
Backend delivery state is truth.

### Retry center

**Purpose:**
Retries eligible failures idempotently after rechecking tenant/provider/recipient/scope.

**Users:**
Authorized operator.

**Frontend behavior:**
Failure queue, eligibility reason, attempt history, reasoned retry.

**Backend alignment:**
Backend owns eligibility/idempotency.

### Read receipts and unread follow-up

**Purpose:**
Tracks notice read state and safe follow-up targeting.

**Users:**
Authors/admin.

**Frontend behavior:**
Read/unread summary and scoped recipient list if permitted.

**Backend alignment:**
Backend read state/recipient scope.

### Parent-teacher chat

**Purpose:**
Supports assignment-scoped conversations with linked student context and protected attachments.

**Users:**
Assigned teacher and linked parent.

**Frontend behavior:**
Conversation list/detail/composer with quiet-hours state.

**Backend alignment:**
Backend scopes conversations/messages.

### Moderation/escalation/report/block

**Purpose:**
Handles unsafe communication cases explicitly.

**Users:**
Users/reporters and moderators.

**Frontend behavior:**
Report/block controls and moderation case queue/timeline.

**Backend alignment:**
Backend owns case state/access.

### Emergency audit

**Purpose:**
Records high-impact recipients, channels, provider/read outcomes, acknowledgements, retries, and actors.

**Users:**
Authorized leaders/operators.

**Frontend behavior:**
Emergency detail and immutable audit timeline.

**Backend alignment:**
Backend audit/event/delivery systems authoritative.

---

## 3. Frontend Design Direction Based on Features

Use a communication reliability workspace under the standard shell. Follow [the master web design plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

- **Layout style:** Module header, backend summary strip when useful, shallow tabs, server filter bar, primary workspace, and optional right drawer.
- **Page density:** Operational laptop density with readable labels and preserved decision context.
- **Cards/table usage:** Cards summarize backend facts; growing records use paginated tables; specialized grids appear only when the job requires them.
- **Drawer usage:** Drawers show selection context and audit without losing filters; full routes handle long forms and complex review.
- **Tabs/subnavigation:** Separate stable subdomains; do not hide required sequence or validation inside arbitrary tabs.
- **Forms:** Sectioned and keyboard usable with inline errors; sticky footer for long workflows; save drafts only when persisted by backend.
- **Filters/quick actions:** Server filtering; one primary action; exports/imports/settings under `More Actions`.
- **Confirmations/status:** High-risk actions show impact and reason; text accompanies semantic color.
- **States:** Loading, empty, no results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file unavailable.
- **Protected files:** File Registry authenticated helpers only; no raw storage keys, provider links, or persistent signed URLs.
- **Responsive behavior:** Collapse rails to drawers, prioritize columns, expand filters on demand, and preserve the main action.

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Admin / communication officer | Tenant notices, targeting, delivery, retry, templates | Other tenants/provider secrets | M12 operations |
| Principal | High-impact approval and emergency evidence | Private chat bodies without permission | Approvals/emergency |
| Teacher | Assigned parent chats and allowed notices | Unassigned families | Chat/notices |
| Parent | Own inbox and linked-child conversations | Other families/internal logs | Inbox/chat |
| Student | Own permitted notifications | Peers/admin delivery data | Inbox |
| Platform operator | Provider health/callback diagnostics by platform scope | Tenant message bodies without audited override | Provider health |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes and names; any addition/difference needs route/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/communications
/dashboard/communications/notices
/dashboard/communications/notices/create
/dashboard/communications/templates
/dashboard/communications/scheduled
/dashboard/communications/approvals
/dashboard/communications/notification-center
/dashboard/communications/unread-follow-up
/dashboard/communications/delivery-logs
/dashboard/communications/retry-center
/dashboard/communications/provider-callbacks
/dashboard/communications/chat
/dashboard/communications/archived-conversations
/dashboard/communications/moderation
```

### Parent Routes

```text
/parent/notifications
/parent/messages
```

### Student Routes

```text
/student/notifications
```

### Staff Self-Service Routes

```text
/staff/notifications
/staff/messages
```

### Platform/Admin Routes

```text
/platform/notification-providers
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Communication Dashboard

**Purpose:**
See communication workload and delivery risk.

**Main users:**
Admin, principal projection.

**Route:**
`/dashboard/communications` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, schedules, unread, retry, moderation, provider health.

**Layout:**
Module header, context/filter bar, Attention queues for approval, scheduled, partial/failed, unread critical, moderation, provider state, and a right drawer for selected notice/delivery/provider/case safe summary.

**Header actions:**
Create Notice

**Filters:**
Date, category, priority, channel, state, owner

**KPI cards / summary cards:**
Notices; scheduled; delivery rate; unread; failures; open cases from backend

**Main table / list / grid:**
Attention queues for approval, scheduled, partial/failed, unread critical, moderation, provider state

**Right drawer / detail panel:**
selected notice/delivery/provider/case safe summary

**Forms / modals:**
None

**Confirmations:**
Emergency/retry/export actions use dedicated confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Summary, attention queues, safe provider state, timestamps.

**Protected files:**
Attachments/log exports protected.

**Audit behavior:**
Drill-down, exports, emergency/retry actions.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 2. Notice Composer and Recipient Preview

**Purpose:**
Author, preview, approve/schedule, and dispatch a notice safely.

**Main users:**
Authorized author/approver.

**Route:**
`/dashboard/communications/notices/create` (planning route; reuse current route if different).

**Main features shown on this screen:**
Composer, targeting, templates, scheduling, approvals.

**Layout:**
Module header, context/filter bar, Form plus channel preview rail and backend recipient/impact summary, and a right drawer for per-channel rendered preview, recipient sample/counts, exclusions, quiet-hours/provider state.

**Header actions:**
Send / Schedule / Request Approval

**Filters:**
Audience builder: roles, class/section, linked-child scopes, exclusions

**KPI cards / summary cards:**
Recipient count; eligible channels; excluded; SMS estimate only from backend

**Main table / list / grid:**
Form plus channel preview rail and backend recipient/impact summary

**Right drawer / detail panel:**
per-channel rendered preview, recipient sample/counts, exclusions, quiet-hours/provider state

**Forms / modals:**
Title/body, language/template, channels, audience, schedule, protected attachments

**Confirmations:**
Final action shows audience, channels, timing, cost/availability, approval policy

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Templates/render, recipient resolver, preview, schedule/workflow, idempotent dispatch.

**Protected files:**
Notice attachments protected.

**Audit behavior:**
Draft/version, audience preview, approvals, schedule/send, recipients/channels.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 3. Notification Center

**Purpose:**
Show the current user’s scoped inbox and honest state.

**Main users:**
All users on role-specific route.

**Route:**
`/parent/notifications` (planning route; reuse current route if different).

**Main features shown on this screen:**
Inbox, unread, read-all, archive, deep links.

**Layout:**
Module header, context/filter bar, Paginated inbox list with category, priority, title, safe excerpt, time, read/delivery context, and a right drawer for selected notification safe body/actions; reauthorized deep link.

**Header actions:**
Mark All Read

**Filters:**
All/unread, critical, module/category, date

**KPI cards / summary cards:**
Unread count; critical unread

**Main table / list / grid:**
Paginated inbox list with category, priority, title, safe excerpt, time, read/delivery context

**Right drawer / detail panel:**
selected notification safe body/actions; reauthorized deep link

**Forms / modals:**
Preference/quiet-hours form on separate panel if allowed

**Confirmations:**
Read-all/archive confirmation only when impactful

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
User-scoped notifications/unread/read/archive/preferences.

**Protected files:**
Protected linked attachment only after authorization.

**Audit behavior:**
Read/archive/preference events.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 4. Approvals, Schedules and Templates

**Purpose:**
Control authored communication before dispatch.

**Main users:**
Admin, approver.

**Route:**
`/dashboard/communications/approvals` (planning route; reuse current route if different).

**Main features shown on this screen:**
Templates, scheduled notices, approvals.

**Layout:**
Module header, context/filter bar, Tabs/tables with item, owner, audience, channels, scheduled time, state, policy, and a right drawer for content/channel previews, recipients, attachments, diff if backend provides, audit.

**Header actions:**
Approve / Return / Edit Template

**Filters:**
Type, state, owner, date, channel, priority

**KPI cards / summary cards:**
Pending approval; scheduled; template overrides; blocked

**Main table / list / grid:**
Tabs/tables with item, owner, audience, channels, scheduled time, state, policy

**Right drawer / detail panel:**
content/channel previews, recipients, attachments, diff if backend provides, audit

**Forms / modals:**
Approval comment; return reason; template fields/version

**Confirmations:**
Approve/reject/return/cancel/delete template requires reason/impact

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Approval/schedule/template details, allowed transitions, renderer/version.

**Protected files:**
Notice/template attachments protected.

**Audit behavior:**
Every version, approval, schedule edit/cancel, actor/reason.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 5. Delivery Logs, Provider Health and Retry

**Purpose:**
Diagnose delivery without exposing secrets or overstating success.

**Main users:**
Communication operator; platform provider page is separate.

**Route:**
`/dashboard/communications/delivery-logs` (planning route; reuse current route if different).

**Main features shown on this screen:**
Provider health, logs, callbacks, retry.

**Layout:**
Module header, context/filter bar, Delivery table with recipient-safe identifier, channel, provider, queued/sent/delivered/read/failed, attempts, callback, next retry, and a right drawer for attempt timeline, safe error code/message, callback verification, retry eligibility, audit.

**Header actions:**
Retry Eligible

**Filters:**
Channel, provider, state, event/notice, date, attempt, tenant only on platform plane

**KPI cards / summary cards:**
Queued; delivered; partial; failed; callback pending; provider degraded

**Main table / list / grid:**
Delivery table with recipient-safe identifier, channel, provider, queued/sent/delivered/read/failed, attempts, callback, next retry

**Right drawer / detail panel:**
attempt timeline, safe error code/message, callback verification, retry eligibility, audit

**Forms / modals:**
Manual retry reason; provider config remains platform-only

**Confirmations:**
Retry/export/provider disable actions require permission/reason; no duplicate resend

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Paginated deliveries/attempts, health, callback audit, retry eligibility/idempotency.

**Protected files:**
Delivery exports protected.

**Audit behavior:**
Every attempt/callback/retry/operator action; secrets never rendered.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 6. Chat and Moderation

**Purpose:**
Support scoped parent-teacher conversation and safety review.

**Main users:**
Assigned teacher, linked parent; moderator.

**Route:**
`/dashboard/communications/chat` (planning route; reuse current route if different).

**Main features shown on this screen:**
Chat, attachments, quiet hours, report/block/escalate/moderation.

**Layout:**
Module header, context/filter bar, Conversation list, message thread, student context, composer; moderation queue/detail for authorized staff, and a right drawer for conversation scope, attachments, report/block state; moderation evidence/audit.

**Header actions:**
Send Message / Resolve Case

**Filters:**
Conversation/unread/student/class; moderation status/severity/assignee

**KPI cards / summary cards:**
Unread; quiet-hours delayed; open reports

**Main table / list / grid:**
Conversation list, message thread, student context, composer; moderation queue/detail for authorized staff

**Right drawer / detail panel:**
conversation scope, attachments, report/block state; moderation evidence/audit

**Forms / modals:**
Message and protected attachment; report/block/escalation/resolution reason

**Confirmations:**
Send during quiet hours shows backend policy; block/escalate/resolve require confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Scoped conversations/messages, assignment/link checks, quiet hours, case lifecycle.

**Protected files:**
Chat attachments/evidence protected.

**Audit behavior:**
Messages, edits if allowed, reports, blocks, escalation, resolution/access.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 7. Emergency Communication Audit

**Purpose:**
Prove what happened for a high-impact emergency notice.

**Main users:**
Principal, authorized operator/auditor.

**Route:**
`/dashboard/communications/notices/[noticeId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Emergency recipients/channels/delivery/read/ack/retry/audit.

**Layout:**
Module header, context/filter bar, Immutable notice summary plus recipient/channel outcome table and event timeline, and a right drawer for content/version, target snapshot, provider/callback outcomes, retries, approvals, actor timeline.

**Header actions:**
Retry Eligible / Export Audit

**Filters:**
Channel, outcome, recipient group, acknowledgement, time

**KPI cards / summary cards:**
Targeted; queued; delivered; read; acknowledged; failed from backend

**Main table / list / grid:**
Immutable notice summary plus recipient/channel outcome table and event timeline

**Right drawer / detail panel:**
content/version, target snapshot, provider/callback outcomes, retries, approvals, actor timeline

**Forms / modals:**
Acknowledgement/follow-up only if policy supports

**Confirmations:**
Retry/follow-up/cancel requires scope re-resolution and reason

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Emergency snapshot, delivery/read/ack outcomes, retry eligibility, audit.

**Protected files:**
Attachments and audit export protected.

**Audit behavior:**
Complete authored/approved/targeted/dispatched/provider/read/retry chain.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

---

## 7. Simple Wireframe Designs

### 1. Communication Dashboard

```text
+------------------------------------------------------------------+
| Communication Dashboard                     [Create Notice] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Notices; scheduled; delivery rate; unread; failures;  |
+------------------------------------------------------------------+
| Filters: Date, category, priority, channel, state, owner       |
+--------------------------------------------+---------------------+
| Attention queues for approval, scheduled | selected notice/d |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: None                                              |
+------------------------------------------------------------------+
```

### 2. Notice Composer and Recipient Preview

```text
+------------------------------------------------------------------+
| Notice Composer and Recipient Preview       [Send / Schedule ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Recipient count; eligible channels; excluded; SMS est |
+------------------------------------------------------------------+
| Filters: Audience builder: roles, class/section, linked-child  |
+--------------------------------------------+---------------------+
| Form plus channel preview rail and backe | per-channel rende |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Title/body, language/template, channels, audience |
+------------------------------------------------------------------+
```

### 3. Notification Center

```text
+------------------------------------------------------------------+
| Notification Center                         [Mark All Read] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Unread count; critical unread                         |
+------------------------------------------------------------------+
| Filters: All/unread, critical, module/category, date           |
+--------------------------------------------+---------------------+
| Paginated inbox list with category, prio | selected notifica |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Preference/quiet-hours form on separate panel if  |
+------------------------------------------------------------------+
```

### 4. Approvals, Schedules and Templates

```text
+------------------------------------------------------------------+
| Approvals, Schedules and Templates          [Approve / Return] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Pending approval; scheduled; template overrides; bloc |
+------------------------------------------------------------------+
| Filters: Type, state, owner, date, channel, priority           |
+--------------------------------------------+---------------------+
| Tabs/tables with item, owner, audience,  | content/channel p |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Approval comment; return reason; template fields/ |
+------------------------------------------------------------------+
```

### 5. Delivery Logs, Provider Health and Retry

```text
+------------------------------------------------------------------+
| Delivery Logs, Provider Health and Retry    [Retry Eligible] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Queued; delivered; partial; failed; callback pending; |
+------------------------------------------------------------------+
| Filters: Channel, provider, state, event/notice, date, attempt |
+--------------------------------------------+---------------------+
| Delivery table with recipient-safe ident | attempt timeline, |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Manual retry reason; provider config remains plat |
+------------------------------------------------------------------+
```

### 6. Chat and Moderation

```text
+------------------------------------------------------------------+
| Chat and Moderation                         [Send Message / R] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Unread; quiet-hours delayed; open reports             |
+------------------------------------------------------------------+
| Filters: Conversation/unread/student/class; moderation status/ |
+--------------------------------------------+---------------------+
| Conversation list, message thread, stude | conversation scop |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Message and protected attachment; report/block/es |
+------------------------------------------------------------------+
```

### 7. Emergency Communication Audit

```text
+------------------------------------------------------------------+
| Emergency Communication Audit               [Retry Eligible /] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Targeted; queued; delivered; read; acknowledged; fail |
+------------------------------------------------------------------+
| Filters: Channel, outcome, recipient group, acknowledgement, t |
+--------------------------------------------+---------------------+
| Immutable notice summary plus recipient/ | content/version,  |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Acknowledgement/follow-up only if policy supports |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Context, title, one primary action | Reuse | Secondary work in `More Actions`. |
| `KpiGrid` / `SummaryStrip` | Backend totals/status | Reuse | Honest unavailable state if missing. |
| `FilterBar` | Server search/filters | Reuse | Preserve URL state where practical. |
| Paginated table / purpose grid | Growing records | Reuse | Permission-safe column priority. |
| Status badge | Lifecycle/health/risk | Extend shared | Text plus semantic color. |
| Detail drawer | Detail/actions/audit | Reuse | Reauthorize mutation. |
| Validated form / sticky footer | Creation and workflow | Reuse | Safe field errors. |
| Confirmation/reason dialog | High-risk change | Reuse | Show exact impact. |
| Protected file/upload controls | Authenticated files | Reuse | File Registry only. |
| Audit timeline | Actor/reason/state history | Reuse/create shared | Backend facts only. |
| M12 widgets | inbox, notice composer, recipient preview, template, schedule, provider health, delivery, retry, read receipt, chat, moderation, and emergency widgets | Create composition | Reuse base primitives. |

---

## 9. Backend and API Alignment

> Capability labels are planning terms, not endpoint names. Use verified current OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries, paginated lists, scoped details, and backend-owned totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated commands with RBAC/entitlement and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Notice draft/preview/approve/schedule/send/cancel; read/archive; template version; delivery/callback/retry; chat/report/block/escalate/moderate; emergency acknowledge. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Tenant/source event, idempotency, recipient eligibility, guardian/assignment state, preference/quiet hours, provider mode, template/channel limits, schedule. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Delivery/read/emergency/moderation exports are queued protected jobs. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Notice/chat attachments, delivery/provider failure exports, moderation evidence use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

M12 receives normalized events from M1-M13 and owns recipients/templates/channels/delivery/read/retry. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

M12 may display backend cost estimates/provider usage where permitted but never exposes credentials or posts school accounting. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

High-impact notice, recipient snapshot, approvals, provider/callback/retry, emergency, chat moderation/block/escalation. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

User inbox is self; parent chat linked-child; teacher assignment; platform provider diagnostics separated from tenant message content. **needs OpenAPI confirmation** unless verified in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Request pending | Layout skeleton; preserve context | Request state |
| Empty | No records | Explanation and one permitted action | Empty response |
| No search results | Filters match nothing | Preserve filters; clear action | List metadata |
| Validation error | Input invalid | Inline errors and summary | Safe validation envelope |
| Permission denied | Scope fails | No forbidden detail | Backend RBAC |
| Module locked | Entitlement off | Locked state; no fake values | Entitlement guard |
| Mutation pending | Command in flight | Prevent duplicate action | Mutation/job status |
| Success | Confirmed | Feedback and refetch | Response |
| Failure | Safe error | Friendly retry | Safe error envelope |
| Partial failure | Batch partly succeeds | Itemized outcome | Batch result |
| Queued job | Async work | Job status tracker | Job API |
| Protected file unavailable | Missing/unauthorized | Safe unavailable state | File Registry |
| Stale data | Timestamp too old | Stale badge and refresh | Backend timestamp |
| Provider accepted, not delivered | Provider accepted dispatch but no verified delivery/read outcome | Label Sent to provider and keep later states pending | Delivery/callback state |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates all queries, jobs, exports, files, events, caches, and audit records.
- Backend RBAC and module entitlement are truth; frontend hiding is UX only.
- Private bodies, salary/bank/payment detail, provider credentials, callback secrets, raw payloads, and unrelated student data never leak.
- Deep links reauthorize tenant, entitlement, role, recipient and record scope when opened.
- Retry rechecks tenant/provider/user/guardian/source state and remains idempotent.
- Sensitive fields are omitted/masked by backend permission and never placed in URLs, logs, analytics, or exports without authorization.
- Protected files use File Registry helpers; never expose object keys, provider URLs, secrets, or raw internal errors.
- Audit-sensitive actions show backend actor/time/reason/history; the UI invents no audit facts.

---

## 12. Nepal-Specific Requirements

- Support Nepali/English templates and previews with accurate SMS length/segment/cost only when backend provides it.
- Use in-app first and respect quiet hours/cost policy; emergency policy remains explicit.
- Guardian phone reuse and child links require backend recipient resolution, not browser deduplication.
- Show SMS/email/push/in-app outcomes separately; poor connectivity and delayed callbacks are normal states.
- Emergency communication needs school-approved audience, sender, timing, acknowledgement, and immutable evidence.

---

## 12A. Consolidated M12 Reference Notes

The retired M12 communication analysis was merged here so this file remains the active Notifications, Notices, Communication, and Chat frontend source of truth.

- M12 is the full communication operating system: create notice, choose channels, target audience, preview recipients, preview content by channel, schedule/send/request approval, approve high-impact notices, dispatch, track delivery/callbacks/read state, retry failures, follow up unread recipients, manage inboxes, chat, report, escalate, moderate, and audit.
- Keep workflow groups separate: dashboard, notices, notification center, unread follow-up, messages/chat, delivery logs, retry center, provider callbacks, moderation, and provider settings. Platform provider diagnostics stay separate from tenant message content.
- Communication dashboards answer what was sent, what is scheduled, what failed, who has not read important communication, whether providers are healthy, and what chats/escalations are waiting. A notice queued for dispatch is not the same as delivered.
- Delivery state labels include draft, approval pending, approved, scheduled, queued, dispatching, sent to provider, delivered, opened/read, partially delivered, delayed, failed, retried, cancelled, archived, provider disabled, mock/dev, callback pending, and retry eligible where exposed.
- Recipient targeting, channel eligibility, quiet hours, provider mode, costs, previews, approval policies, callback verification, retries, and read/unread follow-up are backend-owned. The browser must not calculate official recipient lists.
- Chat report/block/escalation/moderation preserves evidence through protected File Registry access and audit while hiding private bodies, attachments, and cases from unauthorized users.

---

## 13. Implementation Checklist

```text
[ ] Uses master SchoolOS layout, theme, and design system.
[ ] Every feature maps to a screen and every screen to a wireframe.
[ ] Current routes/OpenAPI/contracts/permissions/tests were inspected.
[ ] Real APIs and backend totals only; no fake production data.
[ ] Growing lists filter and paginate server-side.
[ ] Global and domain states are implemented.
[ ] Protected files use File Registry helpers.
[ ] Purpose-limited roles fail closed.
[ ] High-risk actions confirm impact, collect reason, avoid duplicates, and expose audit status.
[ ] Unknowns say needs OpenAPI confirmation or needs backend verification.
[ ] Responsive layout keeps the main job usable.
```

---

## 14. Done Definition

```text
[ ] All module features are explained with frontend behavior.
[ ] Every expected screen is specified and wireframed.
[ ] Backend/API, job, event, file, audit, and scope needs are listed.
[ ] States, security boundaries, and Nepal-specific needs are clear.
[ ] No endpoint shape or backend truth is invented.
[ ] Design is simple and implementation-ready.
[ ] Module implementation does not depend on deep detail in the master plan.
```
