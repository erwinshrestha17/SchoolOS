# SchoolOS Mobile App UI/UX Design Plan

**Status:** Active source of truth for SchoolOS Flutter mobile app UI/UX, persona flows, mobile wireframes, API rules, offline rules, protected files, and mobile smoke expectations.  
**Updated:** 2026-06-20
**Scope:** `apps/schoolos_mobile`, Flutter companion app, role-scoped mobile workflows for parents, teachers, principals, drivers, staff self-service, and controlled student lab/session access.

This document is planning and design guidance only. It does not implement mobile screens, APIs, backend code, database, migrations, package changes, or tests.

---

## 1. Purpose

SchoolOS mobile is the companion app for daily school communication and field workflows. It is not a smaller copy of the web dashboard.

Mobile should help each person answer:

```text
What do I need to know now?
What can I safely do from my phone?
What needs attention today?
```

The mobile app must be:

- Persona-first.
- Task-first.
- Low-bandwidth friendly.
- Safe on weak internet.
- Clear for non-technical guardians, teachers, drivers, and staff.
- Backed by real SchoolOS APIs only.
- Strictly scoped by tenant, role, permission, module entitlement, and ownership.

The web frontend design source of truth is separate:

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
```

The canonical module-by-module surface allocation is also separate:

```text
docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md
```

If this mobile plan appears to expose broader capability than that allocation, the allocation's purpose-limited persona boundary wins until the project owner explicitly approves and documents a change.

---

## 2. Mobile Product Direction

Core rule:

```text
Mobile shows what this person needs to do now, not every module SchoolOS has.
```

Mobile is for quick, role-scoped work:

| Persona | Mobile job |
|---|---|
| Parent / Guardian | Understand own child: attendance, dues, homework, notices, activity, transport, receipts, report cards, learning summary where enabled. |
| Teacher | Run today's classroom work: assigned classes, attendance, homework, timetable, notices/messages, learning sessions where supported. |
| Principal / Head Teacher | Review attention items: attendance risks, staff absence, approvals, fees snapshot, transport alerts, high-impact notices. |
| Driver / Conductor | Operate assigned trip safely: route, stop list, pickup/drop, latest GPS, emergency contacts. |
| Staff Self-Service | Manage own work info: profile, attendance/check-in, leave, payslips, notices. |
| Student Lab / Controlled Device | Join teacher-controlled learning session, autosave, submit, view own result only. |

Web-first areas stay web-first:

```text
Admin setup
Finance setup
Accounting administration
Payroll administration
Platform operations
Provider settings
Large reports and exports
Dense tables
System configuration
```

Mobile must not become:

- Full admin dashboard.
- Public student app for every feature.
- Accounting/payroll workstation.
- Platform control plane.
- Offline financial terminal.
- Social chat app.
- AI runtime.

---

## 3. Non-Negotiables

- No mini-dashboard copy of web.
- No broad student mobile app in MVP.
- Student access is lab/session-only or controlled school-device only.
- No financial write queueing unless backend idempotency and reconciliation are confirmed.
- No session credentials, verification codes, passwords, student data, salary data, or private payloads in logs.
- Store session credentials only in secure storage.
- Respect `tenantId`, backend permissions, module entitlements, own-child, own-staff, assigned-class, assigned-subject, and assigned-trip scope.
- Purpose-limited mobile APIs only.
- Do not use admin-shaped APIs for parent, teacher, principal, driver, staff self-service, or student session flows.
- Offline support only where safe and visible.
- Every screen handles loading, empty, error, offline, permission denied, module locked, pending sync, and success states where applicable.
- Files use authenticated download/share helpers only.
- No raw storage URLs or object keys.
- No AI runtime, public leaderboard, open student chat, or harmful labels.
- Backend authorization remains source of truth; hidden mobile actions are not security.

---

## 4. Mobile Experience Principles

### 4.1 One role, one home

After login, the user lands on a role-specific home. A parent should not see teacher shortcuts. A driver should not see school reports. A staff self-service user should not see other staff data.

If a user has multiple roles, the app should show a simple role switcher only where backend/session permissions support it.

### 4.2 One screen, one action

Mobile screens should avoid crowded dashboards. Each screen should have one primary action or one primary purpose.

Examples:

| Screen | Main job | Primary action |
|---|---|---|
| Parent Home | Understand own child today | Open most urgent item |
| Teacher Today | See current class and pending work | Mark attendance |
| Driver Trip | Run assigned trip | Start / continue trip |
| Staff Leave | Request own leave | Submit request |
| Student Session | Complete activity | Submit answer |

### 4.3 Always explain blocked states

Blocked actions should be understandable:

```text
This module is not enabled for your school.
You can only view your own child.
This class is not assigned to you today.
This trip is not assigned to you.
This receipt is not available yet.
You are offline. This action needs internet.
```

### 4.4 Low-bandwidth first

Mobile must work well on weak Nepal school/guardian internet:

- Prefer compact summaries.
- Avoid large media auto-load.
- Lazy-load images and attachments.
- Show last updated time.
- Cache safe read-only summaries.
- Make retry behavior obvious.
- Never silently overwrite server data after reconnect.

---

## 5. Flutter Architecture Plan

Recommended structure:

```text
apps/schoolos_mobile/lib/
  core/
    auth/
    network/
    storage/
    permissions/
    routing/
    config/
    errors/
  shared/
    widgets/
    theme/
    offline/
    files/
  features/
    auth/
    dashboard/
    parent/
    principal/
    teacher/
    attendance/
    homework/
    notices/
    messages/
    transport/
    staff/
    profile/
    learning/
    student_session/
```

Architecture rule:

```text
presentation -> application/use-cases -> domain -> data
```

### 5.1 Layer responsibilities

| Layer | Responsibility | Must not do |
|---|---|---|
| Presentation | Widgets, screens, user interaction, state display | Direct API calls, business rules, sensitive logging |
| Application / use-cases | Orchestrate actions, validation flow, sync decisions | Render UI, know provider-specific network details |
| Domain | Entities, value objects, policy helpers | Depend on Flutter widgets or API DTO shape directly |
| Data | API clients, repositories, local cache mappers | Decide UI behavior or bypass permissions |

### 5.2 Shared services

Required shared services:

- API client with base URL from environment/config.
- Session restore and session-expired handler.
- Secure session storage and logout cache clearing.
- Backend error mapper to school-friendly mobile messages.
- Role/permission/module service for navigation visibility.
- Offline read cache for safe summaries.
- Pending-sync queue only for explicitly idempotent actions.
- Protected file download/share helper.
- Network state service.
- Last-updated metadata helper.

### 5.3 Recommended packages

Use existing project direction unless already changed in code:

- Riverpod unless an existing Bloc pattern is already established in the touched area.
- `go_router` for protected and role-aware navigation.
- Dio with interceptors.
- `freezed` / `json_serializable` where existing patterns support it.
- `flutter_secure_storage` for session credentials.
- FCM only after backend/provider readiness exists.

---

## 6. Mobile UI System

### 6.1 Visual style

- Clean card-based layout.
- Simple white/soft cards on calm background.
- Deep blue/indigo primary identity.
- Clear role-specific home header.
- Large tap targets.
- Minimal charts.
- No dense tables.
- No desktop dashboard density.
- Friendly school language.

### 6.2 Touch and layout rules

- Minimum 44px touch targets.
- Primary action near thumb zone where practical.
- Avoid placing destructive and safe actions side-by-side.
- Avoid tiny row actions.
- Use action sheets for secondary actions.
- Use bottom sheets for quick forms/detail panels.
- Use full screens for long forms.
- Use cards/lists instead of tables.

### 6.3 Shared widgets

```text
RoleHomeScaffold
PersonaHeader
ChildSwitcher
TodayCard
AttentionCard
ApprovalCard
TaskCard
ClassPeriodCard
StudentMiniProfileCard
AttendanceStatusCard
AttendanceRegister
HomeworkCard
HomeworkComposer
NoticeCard
MessageThreadCard
MessageTemplatePicker
TimetableCard
TransportTripCard
StopProgressCard
WalletSummaryCard
PayslipCard
LearningSessionCard
LearningQuestionCard
SyncStatusBanner
OfflineBanner
OfflineQueueCard
PermissionState
ModuleLockedState
ProtectedFileButton
ProtectedFileShareButton
ObservationNoteCard
LastUpdatedLabel
```

### 6.4 State components

Every feature should use shared states instead of one-off designs:

```text
LoadingState
EmptyState
ErrorState
PermissionState
ModuleLockedState
OfflineBanner
PendingSyncBanner
SessionExpiredState
ProtectedFileUnavailableState
```

---

## 7. Mobile Navigation Model

| Persona | Recommended navigation |
|---|---|
| Parent | Home, Children, Attendance, Homework, Notices, More |
| Teacher | Today, Attendance, Homework, Messages, Profile |
| Principal | Today, Attention, Approvals, Notices, More |
| Driver | Trip, Manifest, GPS, History, Emergency |
| Staff | Home, Attendance, Leave, Payslips, Notices, Profile |
| Student Session | Join Session, Activity, Progress, Exit; no broad bottom nav |

Navigation rules:

- Navigation is role-scoped and tenant-scoped.
- Hidden modules are not security; backend still blocks direct access.
- Module-locked routes show safe locked state.
- Back navigation after logout must not expose private data.
- Logout clears persona data, cached private summaries, and temporary protected file handles where practical.
- Deep links must re-check session, tenant, role, permission, module, and ownership before showing data.

---

## 8. Mobile Screen States

Every mobile screen must handle:

| State | Required behavior |
|---|---|
| Loading | Skeleton or light placeholder matching final layout. |
| Empty | Friendly message and one safe next action if allowed. |
| Error | School-friendly error and retry. |
| Permission denied | Clear reason and safe navigation. |
| Module locked | Explain module is not enabled. |
| Offline | Banner plus last-updated timestamp for cached reads. |
| Pending sync | Visible queued/pending/failed state only for idempotent writes. |
| Success | Clear confirmation without losing context. |
| Session expired | Return to login safely and clear private cache. |
| Protected file unavailable | Explain unavailable, expired, or permissioned file safely. |

### 8.1 Offline copy examples

```text
You are offline. Showing last updated attendance from 9:15 AM.
This action needs internet. Please reconnect and try again.
Your attendance draft is saved on this device and will sync when internet returns.
This payment action cannot be completed offline.
```

### 8.2 Permission copy examples

```text
You can only view children linked to your guardian account.
This class is not assigned to you.
This trip is not assigned to you today.
You do not have permission to view payslips.
```

---

## 9. Offline, Cache, and Sync Rules

### 9.1 Safe offline reads

Safe to cache for offline read where backend policy allows:

- Parent child list and last child summary.
- Parent attendance summary.
- Parent homework list.
- Notices metadata and already-opened notice details.
- Teacher timetable and assigned roster.
- Teacher homework list.
- Driver active trip manifest with minimal safe fields.
- Staff own profile and leave balance.
- Student current learning attempt draft where session policy allows.

### 9.2 Offline writes

Offline writes are allowed only when backend idempotency and conflict rules are confirmed.

Potentially safe with explicit backend support:

- Teacher attendance draft.
- Driver GPS/status ping.
- Student learning autosave.
- Teacher homework draft.

Not allowed offline:

- Payments.
- Wallet debit/top-up.
- Refund/reversal.
- Payroll action.
- Accounting action.
- Report-card publish.
- Tenant/platform action.
- Sensitive settings changes.

### 9.3 Pending sync UI

Every pending item must show:

```text
Queued
Syncing
Synced
Failed
Retry
Discard draft where safe
```

Never silently sync destructive or financial actions.

---

## 10. Parent App UI/UX

Parent mobile is own-child only. It must never use admin-shaped APIs.

### 10.1 Parent home wireframe

```text
┌──────────────────────────────────────────┐
│ Good Morning                             │
│ Child: Aarav Sharma  ▼                   │
│ Class 5 - Section A                      │
│ Last updated: 9:15 AM                    │
└──────────────────────────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Attendance     │ │ Fees Due             │
│ Present today  │ │ NPR 12,500           │
│ [View]         │ │ [View invoices]      │
└────────────────┘ └──────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Homework       │ │ Notices              │
│ 2 due soon     │ │ 1 important          │
│ [Open]         │ │ [Read]               │
└────────────────┘ └──────────────────────┘

┌──────────────────────────────────────────┐
│ Today / Alerts                            │
│ Transport: Bus en route                   │
│ Canteen: Wallet low                       │
│ Learning: Improving in Fractions          │
└──────────────────────────────────────────┘
```

### 10.2 Parent primary screens

| Screen | Main job | Primary action | States |
|---|---|---|---|
| Parent Home | Understand child today | Open urgent item | no linked child, offline cached, module locked |
| Child Switcher | Switch between linked children | Select child | no child, access revoked |
| Attendance | View child's attendance | Open month/day detail | no records, offline cached |
| Homework | View due homework | Open homework detail | no homework, overdue, attachment unavailable |
| Notices | Read school notices | Open notice | no notices, attachment unavailable |
| Fees | View dues/invoices | Open invoice | no dues, payment unavailable, provider disabled |
| Receipts | Download/share receipt | Download receipt | receipt unavailable, permission denied |
| Report Cards | View published result | Download report card | unpublished, file unavailable |
| Activity | View child-safe feed | Open post | media blocked, consent restricted |
| Transport | View latest route/trip status | Refresh status | no route, stale GPS, offline cached |
| Learning Summary | See supportive progress | Open activity summary | no data, module locked |

### 10.3 Parent rules

- Parent can view only currently linked children.
- Guardian removal immediately revokes access.
- Parent cannot view unpublished marks/results.
- Parent cannot view internal reports, audit logs, staff private data, accounting internals, or other children.
- Payment initiation/top-up is network-only and provider-readiness gated.
- Bank proof upload creates pending verification only; it does not mark an invoice paid.
- Receipts/downloads appear only after confirmed payment.
- Receipt/report-card/payment-proof files use File Registry/authenticated helpers.
- Offline financial writes are not allowed.

### 10.4 Parent smoke checks

```text
Parent sees linked child only.
Parent cannot open another child by deep link.
Removed guardian loses access after refresh/session check.
Published report card opens; unpublished report card is hidden/blocked.
Receipt download uses protected helper.
Offline mode shows cached child summary with last-updated label.
```

---

## 11. Teacher App UI/UX

Teacher mobile is for daily classroom work only.

### 11.1 Teacher today wireframe

```text
┌──────────────────────────────────────────┐
│ Today                                    │
│ Current period: Grade 5 - Math           │
│ Next: Grade 4 - Science                  │
│ Attendance pending: Grade 5 A            │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Attendance                               │
│ Grade 5 A not submitted                  │
│ [Mark Attendance]                        │
└──────────────────────────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Homework       │ │ Messages             │
│ 3 to review    │ │ 2 parent threads     │
│ [Open]         │ │ [Open]               │
└────────────────┘ └──────────────────────┘

┌──────────────────────────────────────────┐
│ Substitution / Notice / Learning Session │
└──────────────────────────────────────────┘
```

### 11.2 Teacher screens

| Screen | Main job | Primary action | States |
|---|---|---|---|
| Today | See current class and tasks | Mark attendance | no class today, offline cached |
| Assigned Classes | Open assigned class | Select class | no assignment, permission denied |
| Attendance Register | Mark assigned attendance | Submit attendance | locked date, draft pending, conflict |
| Homework | Assign/review homework | Create homework | no homework, attachment unavailable |
| Timetable | View schedule | Open period | substitution, class cancelled |
| Messages | Reply to scoped parent threads | Send message | quiet hours, thread locked |
| Learning Session | Launch/monitor activity | Launch session | no activity, session ended |
| Profile/Self-service | Own staff actions | Request leave | no leave balance, permission denied |

### 11.3 Attendance mobile behavior

Attendance mobile must be fast and safe:

```text
Open assigned class
-> Load roster
-> Mark present/absent/late/leave
-> Save draft where supported
-> Submit
-> Show submitted status
```

Rules:

- Teacher sees only assigned classes/subjects/students unless explicit permission allows more.
- Teacher cannot mark attendance for unassigned class.
- Locked attendance date is read-only.
- Offline draft shows pending/synced/failed status.
- Duplicate submit is prevented.

### 11.4 Teacher smoke checks

```text
Teacher sees only assigned class list.
Teacher cannot open unassigned class by deep link.
Attendance draft state is visible.
Quiet-hours message block is clear.
Teacher cannot access finance/accounting/payroll admin.
```

---

## 12. Principal App UI/UX

Principal mobile is attention-first, approval-first, and snapshot-first. It is not full admin.

### 12.1 Principal today wireframe

```text
┌──────────────────────────────────────────┐
│ Principal Today                          │
│ Holyland Kids' Academy                   │
│ 7 items need attention                   │
└──────────────────────────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Attendance Risk│ │ Staff Absence        │
│ 3 classes      │ │ 2 teachers absent    │
│ [Review]       │ │ [View coverage]      │
└────────────────┘ └──────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Approvals      │ │ Fees Snapshot        │
│ 5 pending      │ │ NPR 85,000 today     │
│ [Open]         │ │ [View]               │
└────────────────┘ └──────────────────────┘

┌──────────────────────────────────────────┐
│ Alerts                                   │
│ Bus delay, high-impact notice draft,     │
│ report-card publish readiness            │
└──────────────────────────────────────────┘
```

### 12.2 Principal screens

| Screen | Main job | Primary action |
|---|---|---|
| Today | See attention items | Open highest priority item |
| Attendance Risk | Review classes not marked / repeated absence | Open class risk |
| Staff Absence | Check coverage | View substitution status |
| Approvals | Review pending approvals | Approve/reject where allowed |
| Fees Snapshot | Read collection summary | Open detail snapshot |
| Notices | Send/approve high-impact notice | Send/approve notice |
| Transport Alerts | See delay/stale GPS | Open route/trip |
| Escalations | Review parent concerns | Open escalation |

### 12.3 Principal rules

Principal can view safe summaries and attention alerts. Principal cannot become full accountant/payroll/admin on mobile unless permission and purpose-limited endpoints exist.

Blocked by default:

- Payroll salary/bank details without payroll permission.
- Accounting journal posting.
- Fiscal period close/reopen.
- Platform billing.
- Unscoped private chats.
- Admin-shaped APIs.

---

## 13. Driver App UI/UX

Driver mobile is assigned-trip only.

### 13.1 Driver trip wireframe

```text
┌──────────────────────────────────────────┐
│ My Trip                                  │
│ Route: Butwal East                       │
│ Vehicle: Lu 1 Kha 1234                   │
│ Status: Not started                      │
│ [Start Trip]                             │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Stops                                    │
│ 1. Jankinagar       8 students [Open]    │
│ 2. Yogikuti         6 students [Open]    │
│ 3. School Gate      Final stop           │
└──────────────────────────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ GPS            │ │ Emergency            │
│ Last sync now  │ │ Call school office   │
└────────────────┘ └──────────────────────┘
```

### 13.2 Driver flow

```text
Open app
-> See assigned active trip or no-trip state
-> Start trip
-> Open stop
-> Mark pickup/drop/absent
-> Send latest GPS/status
-> End trip
```

Rules:

- Driver sees assigned trip only.
- Manifest exposes only trip-safe fields.
- No academic, fee, health/private detail beyond emergency-safe fields.
- GPS/status changes show pending/failed state where backend supports idempotency.
- Emergency action is protected against accidental taps.
- Parent live map depth depends on backend, privacy, and load decisions.

### 13.3 Driver smoke checks

```text
Driver sees only assigned trip.
Unassigned trip deep link is denied.
Offline GPS/status state is visible.
Manifest does not expose academic/fee/private data.
Trip already ended shows safe state.
```

---

## 14. Staff Self-Service UI/UX

Staff mobile is own-staff only.

### 14.1 Staff home wireframe

```text
┌──────────────────────────────────────────┐
│ My Profile                               │
│ Sita Sharma                              │
│ Teacher                                  │
└──────────────────────────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Attendance     │ │ Leave Balance        │
│ Checked in     │ │ 8 days remaining     │
└────────────────┘ └──────────────────────┘

┌────────────────┐ ┌──────────────────────┐
│ Payslips       │ │ Notices              │
│ May available  │ │ 2 unread             │
└────────────────┘ └──────────────────────┘

[Request Leave]
```

### 14.2 Staff screens

| Screen | Main job | Primary action |
|---|---|---|
| Home | See own staff summary | Request leave |
| Profile | View own profile | Update allowed fields |
| Attendance | View/check own attendance | Check in/out where enabled |
| Leave | Request and track leave | Submit request |
| Payslips | View/download own payslips | Download payslip |
| Notices | Read staff notices | Open notice |

Rules:

- Own profile only.
- Own leave only.
- Own payslips only.
- Salary/bank fields masked unless permission allows.
- No other staff profiles, payroll runs, salary structures, HR admin, student records, finance, or accounting.
- Payslip downloads use protected helpers.

---

## 15. Student Lab / Controlled Session UI/UX

Student app access is controlled session access only. There is no broad MVP student mobile app.

### 15.1 Join session wireframe

```text
┌──────────────────────────────────────────┐
│ Join Learning Session                    │
│ Enter code or scan QR                    │
│                                          │
│ [  SESSION CODE  ]                       │
│ [Join Session]                           │
└──────────────────────────────────────────┘
```

### 15.2 Active session wireframe

```text
┌──────────────────────────────────────────┐
│ Fractions Practice                       │
│ Question 3 of 10                         │
│ Autosaved just now                       │
└──────────────────────────────────────────┘

Question / prompt / options

[Previous] [Next]
[Submit]
```

Rules:

- Join only valid live sessions for own class/section.
- Session code/QR must expire and fail closed.
- Student sees only own active attempt/result.
- Autosave and submit must be idempotent.
- No broad home, fees, parent/staff data, other students, unpublished marks, public leaderboard, open chat, or AI tutor/runtime.
- Use supportive labels only.

---

## 16. Mobile Protected File Rules

Protected mobile files include:

```text
Receipts
Report cards
Payslips
Notice attachments
Homework attachments
Activity media
Student documents where allowed
Learning resources
Payment proof files
```

Rules:

- Use authenticated download/share helpers only.
- Never expose raw object keys or permanent public URLs.
- Files remain permission-scoped and tenant-scoped.
- Logout clears cached protected file metadata and temporary file handles where practical.
- Offline file access is only allowed for previously downloaded safe files where retention and security rules permit.
- Failed downloads show a friendly retry state.

---

## 17. Mobile API Contract Rules

Do not invent fake endpoint contracts. Every mobile surface must be verified against backend code and OpenAPI before implementation.

Suggested mobile API groups are examples and must be confirmed:

```text
/mobile/me/children
/mobile/dashboard/parent
/mobile/students/:studentId/attendance-summary
/mobile/students/:studentId/homework
/mobile/students/:studentId/fees-summary
/mobile/students/:studentId/invoices
/mobile/students/:studentId/receipts
/mobile/students/:studentId/report-cards
/mobile/students/:studentId/notices
/mobile/students/:studentId/activity-feed
/mobile/students/:studentId/transport
/mobile/students/:studentId/canteen
/mobile/students/:studentId/library
/mobile/students/:studentId/learning-summary

/mobile/teacher/dashboard
/mobile/teacher/today
/mobile/teacher/classes
/mobile/teacher/classes/:classId/roster
/mobile/teacher/attendance/classes
/mobile/teacher/attendance/roster
/mobile/teacher/attendance/drafts
/mobile/teacher/attendance/submit
/mobile/teacher/homework
/mobile/teacher/timetable
/mobile/teacher/substitutions
/mobile/teacher/notices
/mobile/teacher/messages
/mobile/teacher/profile

/mobile/principal/dashboard
/mobile/principal/attention
/mobile/principal/attendance-summary
/mobile/principal/approvals
/mobile/principal/fees-summary
/mobile/principal/academics-readiness
/mobile/principal/transport-alerts
/mobile/principal/staff-absence
/mobile/principal/escalations
/mobile/principal/reports-snapshot
/mobile/principal/student-search

/transport/driver/dashboard
/transport/driver/trips/active
/transport/driver/trips/:tripId/manifest
/transport/driver/trips/:tripId/start
/transport/driver/trips/:tripId/students/:studentId/boarded
/transport/driver/trips/:tripId/students/:studentId/dropped
/transport/driver/trips/:tripId/students/:studentId/absent
/transport/driver/trips/:tripId/location
/transport/driver/trips/:tripId/end

/staff/me
/staff/me/timeline
/staff/me/leave-requests
/staff/me/attendance
/payroll/me/payslips

/learning/sessions/join
/learning/sessions/:sessionId/attempts
/learning/attempts/:attemptId/autosave
/learning/attempts/:attemptId/submit
/learning/progress/student/:studentId
```

Mark unknowns as:

- needs backend verification
- needs OpenAPI contract confirmation
- needs mobile contract DTO
- needs idempotency confirmation
- needs offline sync confirmation

---

## 18. Notifications and Deep Links

Push notifications should open only safe, scoped destinations.

Notification examples:

| Notification | Opens | Must re-check |
|---|---|---|
| Child absent | Child attendance detail | guardian-child link |
| Fee due | Child invoice list | guardian-child link and finance module |
| Homework due | Homework detail | child assignment visibility |
| Notice | Notice detail | recipient scope |
| Bus delay | Transport status | child route assignment |
| Teacher message | Thread | assigned parent/student scope and quiet-hours rules |
| Driver trip assigned | Active trip | driver-trip assignment |
| Staff payslip ready | Payslip list | own-staff scope |

Deep link rules:

- Re-check session.
- Re-check tenant.
- Re-check role/permission/module.
- Re-check ownership/assignment.
- Show safe denied/expired state when invalid.
- Do not reveal title/preview of forbidden content.

---

## 19. Mobile Persona Smoke Plan

Every mobile persona smoke should prove:

1. Can log in successfully.
2. Lands on correct role home.
3. Role navigation matches permissions.
4. Hidden modules are not visible.
5. Direct route access fails safely without permission.
6. Allowed records are visible.
7. Unallowed records are not visible.
8. Allowed actions work with loading/success/error states.
9. Forbidden actions are backend-blocked.
10. Offline banner appears where supported.
11. Pending sync appears after supported offline writes.
12. Private downloads require authenticated access.
13. Logout clears previous user's cached private data.

Priority mobile personas:

```text
Parent / Guardian
Teacher
Principal / Head Teacher
Driver / Conductor
Staff Self-Service User
Student Lab-Only User
```

Cross-persona checks:

```text
Parent cannot access another parent's child.
Teacher cannot access another class unless assigned.
Driver cannot access an unassigned trip.
Staff user cannot access another staff profile or payslip.
Principal cannot view salary details without payroll permission.
Student lab user cannot access another session attempt/progress.
Module-locked routes show ModuleLockedState and backend blocks action.
```

---

## 20. Mobile Implementation Order

Use this sequence:

1. **MOB1 Core shell and auth hardening**: secure storage, session restore, role routing, error mapper, permission/module service, logout cache clearing.
2. **MOB2 Parent MVP**: child switcher, home, attendance, homework, notices, profile.
3. **MOB3 Teacher MVP**: today board, assigned classes, attendance, homework, timetable, notices/messages.
4. **MOB4 Staff and Driver MVP**: staff self-service, driver assigned trip, manifest, GPS status, emergency.
5. **MOB5 Principal attention app**: attention dashboard, approvals, attendance risk, emergency notices, safe snapshots.
6. **MOB6 Parent operations depth**: fees/receipts, report cards, transport, canteen, library, activity, chat, learning summary.
7. **MOB7 Controlled student session polish**: session join/autosave/submit/result, school-only hardening.
8. **MOB8 Device QA, offline/read cache, push notifications, accessibility, and low-bandwidth polish.**

Do not start a mobile screen if the only available endpoint is admin-shaped or exposes more data than the persona needs.

---

## 21. Mobile Acceptance Checklist

Before marking any mobile screen complete:

```text
[ ] Screen is persona-scoped.
[ ] Uses real API only.
[ ] Does not use admin-shaped response for parent/teacher/principal/driver/staff/student session.
[ ] Handles loading, empty, error, permission, module locked, offline, and success states.
[ ] Shows last-updated label for cached reads.
[ ] Blocks unsafe offline writes.
[ ] Shows pending/synced/failed for supported offline writes.
[ ] Clears private cache on logout.
[ ] Protected files use authenticated helper.
[ ] Deep links re-check scope before rendering.
[ ] Minimum 44px tap targets.
[ ] No private data appears in logs or error messages.
[ ] Persona smoke case exists or is updated.
```

---

## 22. Mobile Verification

For docs-only changes, no Flutter commands are required.

For mobile implementation changes, run and do not claim passing unless actually run:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

---

## 23. Mobile Risks

| Risk | Prevention |
|---|---|
| Parent/teacher/driver/staff screens using admin-shaped APIs | Purpose-limited mobile DTOs and smoke tests. |
| Cached data from previous user visible after logout | Clear secure session and private caches on logout/session expiry. |
| Offline writes overwriting newer server data | Idempotency, conflict checks, visible sync state. |
| Financial writes attempted offline | Block financial writes offline. |
| Driver GPS/status duplicated or lost | Idempotent status writes and visible pending/failed state. |
| Teacher assigned-class bypass | Backend scope checks and direct-route denial states. |
| Principal app becoming full admin app | Attention-only design and purpose-limited APIs. |
| Broad student mobile scope creep | Keep student access session-only. |
| Raw file URL/object key exposure | Protected file helpers only. |
| Push notification opens forbidden data | Deep link re-checks session/scope before rendering. |
| Harsh learning labels or public ranking | Supportive labels only, no public leaderboard. |

---

## 24. Final Mobile Mindset

Every mobile screen should feel simple, scoped, and safe.

A parent should feel:

```text
I can understand my child's school day quickly.
```

A teacher should feel:

```text
I can handle today's class work without opening the full dashboard.
```

A driver should feel:

```text
I can run my assigned trip safely.
```

A staff member should feel:

```text
I can manage my own work requests privately.
```

A student in a controlled session should feel:

```text
I can complete this classroom activity without distraction.
```

That is the standard for SchoolOS mobile app UI/UX.
