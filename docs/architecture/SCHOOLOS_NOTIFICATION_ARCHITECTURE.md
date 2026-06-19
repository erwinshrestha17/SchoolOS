# SchoolOS Notification Architecture

**Last updated:** 2026-06-19  
**Status:** Canonical architecture companion for cross-module notification events, delivery, preferences, provider operations, and notification-center behavior.  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard, Flutter companion app.

---

## 1. Purpose

SchoolOS needs one central notification layer for all system-generated alerts. Admissions, attendance, fees, academics, homework, HR/payroll, library, transport, canteen, accounting, learning, notices, chat, platform operations, and security workflows must not each invent their own delivery rules.

Core rule:

```text
Feature modules emit notification events.
The Notification layer owns recipient resolution, templates, preferences, channel routing, delivery jobs, retries, read state, provider diagnostics, and audit.
```

This is a **core platform/M10-adjacent architecture layer**, not M11 Intelligence/AI. M11 remains reserved for future School Intelligence / AI and must stay roadmap-only until separately approved.

---

## 2. Product Boundary

The notification layer must support:

- In-app notification inbox and unread counts.
- Push notification readiness for the Flutter companion app.
- SMS/email delivery through provider adapters.
- Template-based notices and system alerts.
- Child-scoped parent alerts.
- Assignment-scoped teacher/staff alerts.
- Platform/provider/admin delivery diagnostics.
- Retry-safe delivery jobs.
- Quiet hours and user/school preferences.
- Audit for emergency, security, payment, and other high-impact notifications.

The notification layer must not:

- Become a separate microservice before scale or compliance requires it.
- Bypass tenant isolation, RBAC, module entitlement, or parent/child scope.
- Pretend a message was delivered when a provider is disabled, mocked, or failed.
- Leak provider credentials, raw callback payload secrets, object keys, or private URLs.
- Replace M10 Notices / Communication / Chat; it provides the shared delivery foundation used by M10 and other modules.
- Implement AI-driven risk scoring, recommendations, or automated decisions.

---

## 3. Core Components

### 3.1 Notification Event Intake

Accepts normalized events from modules.

Responsibilities:

1. Validate authenticated tenant and source module.
2. Validate event type and required payload fields.
3. Enforce idempotency before creating user-facing notifications.
4. Store raw event payload with bounded metadata only.
5. Queue recipient resolution and delivery work outside the source module transaction where practical.

Example event:

```json
{
  "tenantId": "tenant_123",
  "eventType": "ATTENDANCE_STUDENT_ABSENT",
  "sourceModule": "ATTENDANCE",
  "sourceEntityType": "AttendanceSession",
  "sourceEntityId": "session_456",
  "triggeredByUserId": "teacher_789",
  "priority": "HIGH",
  "payload": {
    "studentId": "student_001",
    "date": "2026-06-19",
    "className": "Grade 5",
    "sectionName": "A"
  }
}
```

### 3.2 Template Engine

Owns channel-specific and language-ready templates.

Template dimensions:

| Dimension | Examples |
|---|---|
| Event type | `ATTENDANCE_STUDENT_ABSENT`, `FEE_DUE_REMINDER`, `TRANSPORT_BUS_DELAYED` |
| Channel | `IN_APP`, `PUSH`, `SMS`, `EMAIL` |
| Language | English, Nepali-ready labels, future tenant preference |
| Tenant override | School-specific wording or fallback to system default |
| Priority | Low, normal, high, critical |

Rules:

1. SMS templates should be short and avoid private over-disclosure.
2. Email templates may include richer context but must respect scope.
3. Push titles must be short and action-oriented.
4. Emergency templates must be protected from accidental deletion or full disablement.
5. Provider errors must not expose template variables containing secrets or private file paths.

### 3.3 Recipient Resolver

Determines who should receive each notification.

| Event family | Recipient scope |
|---|---|
| Student attendance | Active guardians linked to that student; assigned staff/admin where configured |
| Fee due/payment | Active guardians for the student; finance users where configured |
| Homework/exam/result | Student, linked guardians, assigned teacher/admin where configured |
| Transport | Parent/guardian only for students assigned to the route/trip; driver/conductor/admin where configured |
| Library/canteen | Student/guardian/staff based on linked borrower or wallet ownership |
| HR/payroll | Staff self-service user, HR, approver, accountant by permission |
| Accounting | Accountants/principal read-only users by permission |
| Notice/chat | Explicit recipient targeting, audience preview, role and scope checks |
| Platform/provider/security | Platform operator, tenant admin, affected user by event type |

Recipient resolution must be deterministic and backend-owned. The browser must not calculate official recipient lists.

### 3.4 Preference and Quiet-Hours Policy

User/school preferences may control non-critical messages.

Supported channels:

```text
IN_APP
PUSH
SMS
EMAIL
```

Priority behavior:

| Priority | Expected behavior |
|---|---|
| `LOW` | In-app only unless enabled otherwise |
| `NORMAL` | In-app + preferred push/email where enabled |
| `HIGH` | In-app + push/email/SMS according to school policy and preferences |
| `CRITICAL` | Cannot be silently skipped; quiet hours and opt-out do not fully suppress delivery |

Quiet hours may delay normal messages but must not block emergency, security, transport-safety, or other approved critical alerts.

### 3.5 Channel Router and Provider Adapters

The channel router selects delivery targets and provider adapters. Providers must be replaceable without changing feature-module code.

Provider adapter examples:

```text
InAppNotificationProvider
PushNotificationProvider
SmsNotificationProvider
EmailNotificationProvider
MockNotificationProvider
DevLogNotificationProvider
```

Provider rules:

1. Disabled provider mode must fail closed or mark delivery as skipped; it must not mark real delivery as sent.
2. Mock/dev-log mode must be visible in platform/provider diagnostics.
3. Signed provider callbacks must be verified before updating delivery state.
4. Duplicate and out-of-order callbacks must not regress final delivery status.
5. Provider secrets and raw tokens must never appear in API responses, logs, or UI.

### 3.6 Delivery Queue and Retry

Delivery must be queue-backed for non-trivial channels.

Flow:

```text
Module event -> Notification event -> Recipient resolution -> User notification -> Channel delivery job -> Provider adapter -> Delivery log -> Callback/read state/audit
```

Retry rules:

1. Retries must be idempotent per notification, channel, recipient, and provider message reference.
2. Retry jobs must re-check tenant status, feature entitlement, provider status, recipient state, guardian link state, and quiet-hours policy.
3. Critical failures must surface in admin/platform diagnostics.
4. Retry attempts must have bounded count, next retry time, and safe failure reason.
5. Manual retry of high-impact messages should require a reason and audit.

### 3.7 Notification Inbox and Read State

The user-facing inbox owns:

- unread count
- category filters
- read/unread state
- archive state
- deep link to source workflow
- safe detail view
- mobile notification center support

Deep links must re-check permissions, tenant status, module entitlement, record existence, and current recipient scope when opened.

---

## 4. Canonical Event Families

Initial event families should include:

```text
ADMISSIONS
STUDENT_PROFILE
ATTENDANCE
FEES
ACCOUNTING
ACADEMICS
EXAMS
HOMEWORK
TIMETABLE
ACTIVITY_FEED
NOTICES
CHAT
HR_PAYROLL
LIBRARY
TRANSPORT
CANTEEN
LEARNING
PLATFORM
SECURITY
EMERGENCY
SYSTEM
```

Recommended first production-critical event types:

```text
ATTENDANCE_STUDENT_ABSENT
ATTENDANCE_STUDENT_LATE
FEE_INVOICE_GENERATED
FEE_PAYMENT_RECEIVED
FEE_DUE_REMINDER
TRANSPORT_BUS_DELAYED
TRANSPORT_STUDENT_BOARDED
TRANSPORT_STUDENT_DEBOARDED
HOMEWORK_ASSIGNED
EXAM_SCHEDULE_PUBLISHED
RESULT_PUBLISHED
NOTICE_PUBLISHED
EMERGENCY_NOTICE_PUBLISHED
LIBRARY_BOOK_OVERDUE
CANTEEN_LOW_BALANCE
PAYROLL_PAYSLIP_GENERATED
STAFF_LEAVE_APPROVAL_REQUIRED
ACCOUNTING_VOUCHER_APPROVAL_REQUIRED
LEARNING_SESSION_STARTED
SYSTEM_PASSWORD_CHANGED
SYSTEM_LOGIN_FROM_NEW_DEVICE
```

---

## 5. Data Model Blueprint

Suggested tenant-scoped tables/models:

| Model | Purpose |
|---|---|
| `NotificationEvent` | Raw normalized event emitted by a module |
| `Notification` | User-facing inbox item |
| `NotificationTemplate` | Channel/language/event template |
| `NotificationDelivery` | Delivery attempt per notification/channel/provider |
| `NotificationPreference` | User/category/channel preference |
| `NotificationQuietHour` | Tenant/user quiet-hours policy |
| `NotificationAuditLog` | High-impact notification audit |

Minimum fields:

```text
NotificationEvent:
  id, tenantId, eventType, sourceModule, sourceEntityType, sourceEntityId,
  triggeredByUserId, priority, idempotencyKey, payloadJson, status, createdAt

Notification:
  id, tenantId, recipientUserId, category, priority, title, body, deepLink,
  sourceModule, sourceEntityType, sourceEntityId, readAt, archivedAt, createdAt

NotificationDelivery:
  id, tenantId, notificationId, channel, providerName, recipientAddress,
  status, attemptCount, providerMessageId, lastAttemptAt, nextRetryAt,
  errorCode, safeErrorMessage, createdAt, updatedAt
```

Every table must include tenant scope where it stores tenant-owned data. Queries must filter by authenticated `tenantId` and recipient/role scope.

---

## 6. API Surface Blueprint

User APIs:

```text
GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all
PATCH  /api/v1/notifications/:id/archive
GET    /api/v1/notification-preferences
PUT    /api/v1/notification-preferences
```

Admin/platform diagnostics APIs:

```text
GET    /api/v1/admin/notifications/deliveries
POST   /api/v1/admin/notifications/:id/retry
GET    /api/v1/platform/notification-providers/health
GET    /api/v1/platform/notification-providers/callback-audit
```

Internal module-facing service boundary:

```text
NotificationEventService.emit(event)
NotificationDispatchService.dispatch(eventId)
RecipientResolverService.resolve(event)
NotificationTemplateService.render(event, channel, recipient)
NotificationPreferenceService.evaluate(recipient, event, channel)
NotificationRetryService.schedule(deliveryId)
```

Other modules should depend on an internal application service or event interface, not direct provider adapters.

---

## 7. Frontend Requirements

### Web dashboard

Required surfaces:

1. Header unread badge.
2. Notification center screen.
3. Notification detail view.
4. Notification settings screen.
5. Admin/provider delivery diagnostics where permission allows.
6. Retry panel with reason for failed high-impact deliveries.
7. Empty, loading, forbidden, module-locked, provider-disabled, and failure states.

Suggested notification center filters:

```text
All
Unread
Critical
Attendance
Fees
Transport
Academics
Notices
Chat
System
```

### Flutter mobile

Required surfaces:

1. Notification center list.
2. Unread badge.
3. Push-open deep-link guard.
4. Child-scoped parent notification details.
5. Session-expired, forbidden, stale, and offline states.
6. Local notification display must not expose private content when the device is locked unless policy allows it.

---

## 8. Security and Edge Cases

Non-negotiable checks:

1. School A must never read School B notification, delivery, provider, recipient, audit, or callback state.
2. Parent notifications must be child-scoped and must immediately respect guardian removal/replacement.
3. Teachers must not receive broader student/class alerts unless assignment or permission allows it.
4. Staff payroll notifications must not leak salary, bank, or payroll data to unauthorized users.
5. Provider callbacks must be signed/verified before delivery status changes.
6. Duplicate events must not create duplicate inbox items or duplicate SMS/email/push deliveries.
7. Manual retry must not resend messages after the tenant is suspended, feature disabled, provider disabled, user removed, guardian unlinked, or source record archived.
8. Quiet-hours delayed jobs must re-check policy at send time.
9. Emergency alerts must be visible in audit and admin diagnostics.
10. Source deep links must reauthorize at open time.

---

## 9. Implementation Sequence

### Phase 1 - Core inbox and event intake

- Add event intake service.
- Add in-app `Notification` model and unread count APIs.
- Add notification center UI and mobile list foundation.
- Add idempotency keys.

### Phase 2 - Templates and recipient resolution

- Add `NotificationTemplate`.
- Add deterministic recipient resolvers per event family.
- Add parent-child and assignment-scope checks.
- Add tenant-specific template override support.

### Phase 3 - Delivery providers

- Add channel router.
- Add mock/dev-log providers.
- Add SMS/email/push adapters behind provider configuration.
- Add provider health and callback verification diagnostics.

### Phase 4 - Preferences, quiet hours, and retries

- Add preference APIs/screens.
- Add quiet-hours policy.
- Add retry scheduling and failed-delivery dashboard.
- Add high-impact manual retry reason/audit.

### Phase 5 - Module adoption

- M2 attendance absence/late alerts.
- M3 fees due/payment alerts.
- M8B transport status alerts.
- M8C canteen low-balance alerts.
- M6 homework reminders.
- M10 notice/chat delivery integration.
- M12 learning session alerts where enabled.

---

## 10. Definition of Done

A notification feature is not done until:

1. Source module emits an event instead of directly calling a provider.
2. Event intake is tenant-scoped and idempotent.
3. Recipient resolution is backend-owned and scope-safe.
4. Templates are channel-aware and localization-ready.
5. Preferences and quiet-hours are respected for non-critical events.
6. Critical events cannot be silently dropped.
7. Delivery attempts are logged with safe diagnostics.
8. Provider-disabled/mock/dev-log states are honest in API and UI.
9. Read state and deep links work on web and mobile.
10. Cross-tenant, parent-child, role, retry, and provider-failure edge cases have regression coverage before production-readiness claims.
