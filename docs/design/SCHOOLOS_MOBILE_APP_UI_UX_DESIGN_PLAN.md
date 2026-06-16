# SchoolOS Mobile App UI/UX Design Plan

**Status:** Active source of truth for SchoolOS Flutter mobile app UI/UX, persona flows, mobile wireframes, API rules, offline rules, and mobile smoke expectations.  
**Updated:** 2026-06-16  
**Scope:** `apps/schoolos_mobile`, Flutter companion app, role-scoped mobile workflows for parents, teachers, principals, drivers, staff self-service, and controlled student lab/session access.

This document replaces and consolidates the mobile content formerly spread across the combined web/mobile design plan and mobile implementation plan. It is planning only; it does not implement mobile screens, APIs, backend code, database, migrations, or tests.

---

## 1. Merged Design Sources

This file contains the mobile/app content formerly spread across:

```text
docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md
docs/design/SCHOOLOS_MOBILE_APP_IMPLEMENTATION_MASTER_PLAN.md
```

Web dashboard, platform, settings, reports, and dense admin UI design now live in:

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
```

---

## 2. Mobile Product Direction

SchoolOS mobile is a companion app, not a smaller version of the web dashboard.

Mobile should be:

- Task-first.
- Role-scoped.
- Low-bandwidth aware.
- Safe for weak internet.
- Purpose-limited by persona.
- Easy for non-technical school staff and guardians.
- Backed by real APIs only.

Core rule:

```text
Mobile shows what this person needs to do now, not every module SchoolOS has.
```

Mobile responsibilities:

| Persona | Mobile purpose |
|---|---|
| Parent / Guardian | Own-child summaries, dues, receipts, notices, homework, attendance, activity, transport, canteen/library/learning where enabled. |
| Teacher | Daily classroom operations: today, attendance, homework, timetable, notices/messages, learning/session control where supported. |
| Principal | Attention-first dashboard, approvals, alerts, attendance risks, staff absence, fee snapshot, emergency notices. |
| Driver / Conductor | Assigned trip only: route, stop list, pickup/drop, GPS status, emergency contacts. |
| Staff Self-Service | Own profile, attendance/check-in, leave, payslips, notices. |
| Student Lab / Controlled Device | Join active teacher-controlled learning session, autosave, submit, view own result only. |

Web-first areas stay web-first:

```text
Admin setup
Finance setup
Accounting
Payroll administration
Platform operations
Reports and exports
Dense tables
Provider settings
System configuration
```

---

## 3. Mobile Non-Negotiables

- No mini-dashboard copy of web.
- No broad student mobile app in MVP.
- Student learning access is lab-only or controlled school-device only for MVP.
- No financial write queueing unless backend idempotency and reconciliation are confirmed.
- No tokens, OTPs, passwords, student data, salary data, or private payloads in logs.
- Store mobile tokens only in secure storage.
- Respect `tenantId`, backend permissions, module entitlements, own-child, own-staff, assigned-class, assigned-subject, and assigned-trip scope.
- Purpose-limited APIs only.
- Do not use admin-shaped APIs for parent, driver, staff self-service, principal attention, teacher mobile, or student session flows.
- Offline support only where safe and visible.
- Every screen handles loading, empty, error, offline, permission denied, module locked, pending sync, and success states where applicable.
- Files use authenticated download/share helpers only.
- No raw storage URLs or object keys.
- No AI runtime, public leaderboard, open student chat, or harmful labels.
- Backend authorization remains source of truth; hidden mobile actions are not security.

---

## 4. Flutter Architecture Plan

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

Architecture:

```text
presentation -> application/use-cases -> domain -> data
```

Use:

- Riverpod unless an existing Bloc pattern already exists in the touched area.
- `go_router` for route protection and persona-aware navigation.
- Dio with interceptors.
- `freezed` / `json_serializable` where existing project patterns support it.
- `flutter_secure_storage` for tokens.
- FCM only after backend/provider readiness exists.

Shared services:

- One API client with base URL from environment/config.
- Auth refresh/session-expired handler.
- Secure token storage and logout cache clearing.
- Backend-to-school-friendly mobile error mapper.
- Permission/module service for navigation visibility.
- Offline read cache for safe summaries.
- Pending-sync queue only for explicitly idempotent actions.
- Protected file download/share helper.

---

## 5. Mobile UI System

Mobile is task-first.

UI rules:

- Minimum 44px touch targets.
- Simple cards, lists, timelines, calendars, and action rows.
- No dense tables.
- Bottom navigation only if useful per role.
- Clear offline banners.
- Last-updated labels when cached data is shown.
- Skeletons where possible; avoid blocking spinners as the only state.
- Nepali school-friendly language.
- Keep screens readable and uncluttered.
- Do not cram web dashboard density into mobile.
- Confirm high-risk actions.
- Keep the primary action obvious.
- Put secondary actions behind a simple menu.
- Use supportive labels: `Needs practice`, `Improving`, `Ready`, `Strong`; never harsh labels.

Shared widgets:

```text
RoleHomeScaffold
TodayCard
AttentionCard
ApprovalCard
TaskCard
ClassPeriodCard
StudentMiniProfileCard
AttendanceRegister
HomeworkCard
HomeworkComposer
TimetableCard
MessageThreadCard
MessageTemplatePicker
LearningSessionControlPanel
SyncStatusBanner
OfflineBanner
OfflineQueueCard
PermissionState
ModuleLockedState
ProtectedFileButton
ObservationNoteCard
```

---

## 6. Mobile Navigation by Persona

| Persona | Recommended navigation |
|---|---|
| Parent | Home, Children, Attendance, Homework, Notices, More |
| Teacher | Today, Attendance, Homework, Messages, Profile |
| Principal | Today, Attendance, Approvals, Notices, More |
| Driver | Trip, Manifest, GPS, History, Emergency |
| Staff | Home, Attendance, Leave, Payslips, Notices, Profile |
| Student Session | Join Session, Activity, Progress, Exit; no broad bottom nav |

Navigation rules:

- Navigation is role-scoped and tenant-scoped.
- Hidden modules are not a security layer; backend still blocks direct access.
- Module-locked routes show safe locked state.
- Logout clears cached persona data.
- Back navigation after logout must not expose previous user's private data.

---

## 7. Mobile Screen States

Every mobile screen must handle:

| State | Required behavior |
|---|---|
| Loading | Skeleton or light placeholder matching the final layout. |
| Empty | Friendly message and one safe next action if allowed. |
| Error | School-friendly error and retry. |
| Permission denied | Clear reason and safe navigation. |
| Module locked | Explain the module is not enabled for this school. |
| Offline | Banner plus last-updated timestamp for cached reads. |
| Pending sync | Visible queued/pending/failed state only for idempotent writes. |
| Success | Clear confirmation without losing context. |
| Session expired | Return to login safely and clear private cache. |
| Protected file unavailable | Explain unavailable/expired/permissioned file safely. |

---

## 8. Parent App UI/UX

Parent mobile is own-child only. It must never use admin-shaped APIs.

### 8.1 Parent Home Wireframe

```text
┌──────────────────────────────────────────┐
│ Good Morning                             │
│ Child: Aarav Sharma  ▼                   │
│ Class 5 - Section A                      │
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

### 8.2 Parent Screens

- Login/session restore.
- Child switcher.
- Child summary.
- Attendance calendar/summary.
- Homework list/detail.
- Notices and attachments.
- Fees dashboard.
- Invoice list/detail.
- Receipt PDF download/share.
- Published report cards only.
- Activity feed with consent-aware media.
- Transport status.
- Canteen wallet/menu/serving history where enabled.
- Library borrowed books/fines where enabled.
- Parent-teacher chat where M10 rules allow.
- Learning summary with supportive non-comparative labels.

### 8.3 Parent Rules

- Parent can view only linked children.
- Guardian removal immediately revokes access.
- Parent cannot view unpublished marks/results.
- Parent cannot view internal reports, audit logs, staff private data, accounting internals, or other children.
- Payment initiation/top-up is network-only and provider-readiness gated.
- Bank proof upload creates pending verification only; it does not mark an invoice paid.
- Receipts/downloads appear only after confirmed payment.
- Receipt/report-card/payment-proof files use File Registry/authenticated helpers.
- Offline financial writes are not allowed.

---

## 9. Teacher App UI/UX

Teacher mobile is for daily classroom work only.

### 9.1 Teacher Today Wireframe

```text
┌──────────────────────────────────────────┐
│ Today                                    │
│ Current period: Grade 5 - Math           │
│ Next: Grade 4 - Science                  │
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

### 9.2 Teacher Screens

- Today board.
- Assigned classes only.
- Assigned class roster.
- Attendance register.
- Offline attendance draft queue where supported.
- Homework create/review light flow.
- Timetable.
- Substitutions.
- Notices.
- Parent messages scoped to assigned students and policy hours.
- Activity post capture where implemented.
- Marks quick entry where enabled and assigned.
- Learning session launch/monitor where supported.
- Lesson diary / teaching notes later.
- Own profile, leave, notices, self-service.

### 9.3 Teacher Rules

- Teacher sees only assigned classes/subjects/students unless explicit permission allows more.
- Teacher cannot mark attendance for unassigned class.
- Teacher cannot enter marks for unassigned subject.
- Teacher cannot access fees, accounting, payroll admin, platform, or unrelated private student documents.
- Chat respects M10 quiet hours and assigned parent/student scope.
- Activity media respects consent.
- Attendance drafts show pending/synced/failed state and must be idempotent.

---

## 10. Principal App UI/UX

Principal mobile is attention-first, approval-first, and snapshot-first. It is not full admin.

### 10.1 Principal Today Wireframe

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

### 10.2 Principal Can

- View school-wide safe summaries and attention alerts.
- View attendance risks, staff absences, staff coverage, and substitution needs.
- View fee collection snapshot and cashier close status.
- View result publish readiness and report-card generation status.
- View notice delivery status.
- Approve/send emergency or high-impact notices where configured.
- View transport delay, stale GPS, canteen, library, and HR operational alerts.
- View parent concerns/escalated chat issues.
- View read-only finance/report snapshots.
- Search students by allowed scope.
- Download protected PDFs where permission allows.
- Approve/reject leave, fee reversal/refund, or result publishing only with permission.

### 10.3 Principal Cannot

- Run payroll, edit salary structures, or view salary/bank details without payroll permission.
- Create fee plans, edit invoice setup, or collect fees as cashier.
- Create/post accounting journals, reconcile bank statements, or close/reopen fiscal periods.
- Manage platform billing.
- Read all private chats without escalation/permission.
- Bypass audit reason requirements.
- Use admin-shaped APIs.

---

## 11. Driver App UI/UX

Driver mobile is assigned-trip only.

### 11.1 Driver Trip Wireframe

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

### 11.2 Driver Rules

- Driver sees assigned trip only.
- No academic, fee, staff, payroll, or broad student data.
- Manifest exposes only trip-safe fields.
- GPS/status changes show pending/failed state where offline/idempotent.
- Parent live tracking/map depth depends on backend/privacy/load decisions.
- Emergency action is protected against accidental taps.

---

## 12. Staff Self-Service UI/UX

Staff mobile is own-staff only.

### 12.1 Staff Home Wireframe

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

### 12.2 Staff Rules

- Own profile only.
- Own attendance/check-in/out where enabled.
- Own leave request and leave balance.
- Own payslip list/detail/download.
- Salary/bank fields masked unless permission allows.
- No other staff, payroll runs, salary structures, HR admin, student records, finance, or accounting.
- Payslip downloads use protected helpers.

---

## 13. Student Lab / Controlled Session UI/UX

Student app access is controlled session access only. There is no broad MVP student mobile app.

### 13.1 Join Session Wireframe

```text
┌──────────────────────────────────────────┐
│ Join Learning Session                    │
│ Enter code or scan QR                    │
│                                          │
│ [  SESSION CODE  ]                       │
│ [Join Session]                           │
└──────────────────────────────────────────┘
```

### 13.2 Active Session Wireframe

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

### 13.3 Student Session Rules

- Join only valid live sessions for own class/section.
- Session code/QR must expire and fail closed.
- Student sees only own active attempt/result.
- Autosave and submit must be idempotent.
- No broad home, fees, parent/staff data, other students, unpublished marks, public leaderboard, open chat, or AI tutor/runtime.
- Use supportive labels only.

---

## 14. Mobile Protected File Rules

- Use authenticated download/share helpers only.
- Never expose raw object keys or permanent public URLs.
- Receipts, report cards, activity media, notices, payslips, student documents, and learning resources remain permission-scoped.
- Logout clears cached protected file metadata and temporary file handles where practical.
- Offline file access is only allowed for previously downloaded safe files where retention and security rules permit.

---

## 15. Mobile API Contract Rules

Do not invent fake endpoint contracts. Every mobile surface must be verified against backend code and OpenAPI before implementation.

Suggested mobile API groups:

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

Unknowns are marked:

- needs backend verification
- needs OpenAPI contract confirmation
- needs mobile contract DTO
- needs idempotency confirmation
- needs offline sync confirmation

---

## 16. Mobile Persona Smoke Plan

Every mobile persona smoke should prove:

1. Can log in successfully.
2. Lands on correct role home.
3. Bottom nav/role navigation matches persona permissions.
4. Hidden modules are not visible.
5. Direct route access fails safely without permission.
6. Allowed records are visible.
7. Unallowed records are not visible.
8. Allowed actions work with loading/success/error states.
9. Forbidden actions are backend-blocked.
10. Offline banner appears where supported.
11. Pending sync appears after offline writes where supported.
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

## 17. Mobile Implementation Order

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

## 18. Mobile Verification

For docs-only changes, no Flutter commands are required. For mobile implementation changes, run and do not claim passing unless actually run:

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

## 19. Mobile Risks

- Parent/teacher/driver/staff screens accidentally using admin-shaped APIs.
- Cached data from previous user visible after logout.
- Offline writes silently overwriting newer server data.
- Financial write attempted offline without idempotency and reconciliation contract.
- Driver GPS/status writes duplicated or lost without visible sync state.
- Teacher assigned-class scope bypass.
- Principal app turning into full admin/accounting/payroll on mobile.
- Broad student mobile scope creeping into MVP.
- Raw file URLs or object keys stored/displayed.
- Push notifications deep-linking into unscoped data.
- Harsh learning labels, public ranking, or AI runtime accidentally exposed.
