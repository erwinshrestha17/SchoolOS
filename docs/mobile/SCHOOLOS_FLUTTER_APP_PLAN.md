# SchoolOS Flutter App Plan

**Status:** Active source of truth for Flutter mobile planning
**Updated:** 2026-06-15
**Scope:** Planning only. Do not implement Flutter screens from this document until the planning pass is accepted.

SchoolOS mobile is a companion app for daily role-specific actions. It is not a smaller version of the web dashboard. Admin setup, accounting, payroll management, reporting, platform operations, and dense school configuration stay web-first.

## 1. Product Decisions

1. Parent mobile is own-child only.
2. Teacher mobile is for daily classroom actions only.
3. Driver mobile is mobile-first and assigned-trip only.
4. Staff self-service mobile is own-staff only.
5. Students do not get a broad MVP mobile app.
6. Student learning access is limited to computer-lab or controlled school-device session flows.
7. Principal/owner mobile is optional alerts and approvals only, not full admin.
8. No admin-shaped data repository should power parent, driver, staff, or student-lab flows.

## 2. Current Repo Structure

The app already uses a feature-first Flutter structure:

```text
apps/schoolos_mobile/lib/core/auth
apps/schoolos_mobile/lib/core/network
apps/schoolos_mobile/lib/core/storage
apps/schoolos_mobile/lib/core/permissions
apps/schoolos_mobile/lib/features/attendance
apps/schoolos_mobile/lib/features/auth
apps/schoolos_mobile/lib/features/dashboard
apps/schoolos_mobile/lib/features/learning
apps/schoolos_mobile/lib/features/notices
apps/schoolos_mobile/lib/features/parent
apps/schoolos_mobile/lib/features/profile
apps/schoolos_mobile/lib/features/staff
apps/schoolos_mobile/lib/features/transport
apps/schoolos_mobile/lib/shared/widgets
```

Keep this structure. Add new features only when the API contract is purpose-limited and documented.

## 3. Shared Mobile Architecture

| Area | Plan |
|---|---|
| API client | Keep one Dio-backed `ApiClient` with base URL from `EnvConfig`. |
| Auth | Use tenant slug login, bearer access token, refresh token, session-expired callback. |
| Storage | Use secure storage for tokens and lightweight preferences for selected child/context. |
| Errors | Map backend errors to school-friendly messages through app exceptions. |
| Permissions | Use mobile role and permission service for navigation visibility, but backend remains enforcement. |
| Offline | Cache last safe read results for parent, teacher, driver, and staff. Queue only explicitly idempotent actions. |
| Files | Use authenticated download/share helpers. Do not expose permanent public URLs. |
| State | Every screen has loading, empty, error, permission denied, offline, success/pending where relevant. |
| Accessibility | Minimum 44px touch target, clear contrast, large tap areas for driver/POS/teacher actions. |

## 4. Persona Plans

### Parent / Guardian

Home goal: understand one child today and act on the most important item.

Allowed modules:

```text
Child profile
Attendance summary
Homework and timetable
Fees and receipts
Published report cards
Notices and notification center
Transport status
Canteen summary
Library summary
Activity feed
Parent-teacher chat where enabled
Parent learning summary
```

API contracts:

```text
GET /mobile/dashboard/parent
GET /mobile/parent/attendance-summary
GET /parent/learning/summary
GET /transport/parent/students/:studentId/active-trip
GET /transport/parent/students/:studentId/status
GET /canteen/parent/students/:studentId/status
Parent-scoped notices, fees, homework, timetable, report-card, library, activity, and chat APIs as listed in the API map.
```

Forbidden data:

```text
Other children
Teacher/staff private data
Unpublished marks or report cards
Internal audit and school reports
Admin settings
```

Offline/cache:

```text
Cache child selector, last home summary, notices, attendance month, homework list, fee due summary, transport last-known status.
Payments, chat sends, file downloads, and receipt/report-card downloads require network unless backend provides a safe offline contract.
```

### Teacher

Home goal: complete today's class tasks quickly.

Allowed modules:

```text
Today timetable
Assigned class attendance
Homework list/create-lite
Notices and class messages
Substitution alerts
Own profile / leave
```

API contracts:

```text
GET /mobile/teacher/attendance/classes
GET /mobile/teacher/attendance/classes/:classId/roster
POST /mobile/teacher/attendance/classes/:classId/submit
GET /timetable
GET /homework
POST /homework
GET /notification-center
```

Forbidden data:

```text
Other classes unless assigned
School-wide finance
Payroll and accounting
Unrelated student documents
Admin settings
```

Offline/cache:

```text
Cache timetable, assigned rosters, homework list.
Attendance submit can be queued only with backend idempotency key and visible pending/synced/failed state.
```

### Driver / Conductor

Home goal: operate the active assigned trip safely.

Allowed modules:

```text
Assigned route
Active trip
Manifest
Boarded/dropped/absent marking
GPS ping
Delay and emergency contact
Trip history
```

API contracts:

```text
GET /transport/driver/dashboard
GET /transport/driver/gps-ping-contract
GET /transport/driver/assignments
GET /transport/driver/trips/active
GET /transport/driver/trips/history
POST /transport/driver/trips
GET /transport/driver/trips/:id/manifest
PATCH /transport/driver/trips/:id/complete
PATCH /transport/driver/trips/:id/students/boarded
PATCH /transport/driver/trips/:id/students/dropped
PATCH /transport/driver/trips/:id/students/absent
POST /transport/driver/trips/:id/location
POST /transport/driver/trips/:id/gps-ping
POST /transport/driver/trips/:id/emergency-contact
```

Forbidden data:

```text
Full student profiles
Fees, academics, payroll, accounting
Other routes/trips
Parent private data beyond emergency-safe contact contract
```

Offline/cache:

```text
Cache active manifest and trip instructions after trip start.
GPS and status changes show queued/pending/failed when network drops.
Emergency screen must still show cached phone/contact instructions.
```

### Staff Self-Service

Home goal: manage own attendance, leave, payslips, notices.

Allowed modules:

```text
Own profile
Own attendance/check-in/out
Own leave requests and balances
Own payslips
Notices
Settings
```

API contracts:

```text
GET /staff/me
GET /staff/me/timeline
GET /hr/me/attendance
GET /hr/me/leave-requests
GET /hr/me/leave-balances
POST /hr/me/leave-requests
GET /hr/me/time-clock
POST /hr/me/time-clock/check-in
POST /hr/me/time-clock/check-out
GET /payroll/me/payslips
```

Forbidden data:

```text
Other staff profiles
Salary structures
Payroll runs
Student records
Finance/accounting
```

Offline/cache:

```text
Cache own profile, leave balances, payslip list metadata, last attendance status.
Check-in/out requires network unless backend approves idempotent offline punches.
```

### Student Lab / Controlled Device

Home goal: join a teacher-controlled learning session and complete the assigned activity.

Allowed modules:

```text
Session join
Learning activity
Autosave answer
Submit attempt
Session result/progress summary
```

API contracts:

```text
GET /learning/sessions/:id/join
POST /learning/sessions/:id/attempts
PATCH /learning/attempts/:id/autosave
POST /learning/attempts/:id/submit
GET /learning/progress
```

Forbidden data:

```text
Broad mobile home
Fees
Parent/staff data
Other students
Unpublished marks
Public leaderboard
Open chat
```

Offline/cache:

```text
Lab sessions should prefer online network. Autosave retries must be idempotent and visible.
If network fails, show teacher-friendly recovery instructions and keep local unsent answers only for the current session.
```

## 5. Screen States

Every mobile screen needs:

| State | Required behavior |
|---|---|
| Loading | Skeleton/card placeholders, not spinner-only full screens after initial load. |
| Empty | Friendly next action, such as "No homework due today." |
| Error | School-friendly message, retry, and no raw stack details. |
| Permission denied | Clear message and safe navigation back home. |
| Offline | Offline banner plus last updated label when cached data is shown. |
| Pending sync | Visible queued state with retry/cancel if safe. |
| Success | Small confirmation and refreshed list/detail state. |

## 6. Implementation Readiness

Before building any mobile screen:

```text
Persona -> Permission -> Scope -> Route -> Purpose-limited API -> DTO -> Repository -> Provider -> Screen -> State -> Test
```

Do not start a screen if the only available endpoint is admin-shaped and exposes more data than the persona needs.
