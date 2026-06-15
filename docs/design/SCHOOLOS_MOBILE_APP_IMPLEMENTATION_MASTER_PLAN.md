# SchoolOS Mobile App Implementation Master Plan

**Status:** Mobile-only implementation planning document.
**Scope:** `apps/schoolos_mobile`, Flutter companion app, role-scoped mobile workflows.
**Source:** Based on the current `docs/design/*.md` design set. The combined `SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md` remains the current design source of truth.

This file is planning only. It does not implement mobile screens, APIs, backend code, database schema, tests, or migrations.

---

## 1. Purpose

This is the mobile-only implementation plan for SchoolOS.

Mobile is a companion app, not a smaller web dashboard. It should support role-specific daily actions, safe summaries, and low-bandwidth workflows for parents, teachers, drivers, staff, and controlled student lab/session use.

Web-first features stay web-first.

---

## 2. Mobile Product Direction

Mobile should be task-first and role-scoped.

- Parent app: child summary, attendance, fees, homework, notices, activity, transport, protected receipts/report cards where supported.
- Teacher app: today's classes, assigned-class attendance, homework, notices, limited communication, timetable/substitution, profile.
- Driver app: assigned route/trip, pickup/drop status, latest GPS ping, emergency contacts, stale GPS/offline handling.
- Staff app: own leave, payslip, notices, own profile where allowed.
- Student: controlled lab/session only, not a broad mobile app.
- Admin, finance, accounting, payroll, platform, settings, reporting, dense tables, and heavy exports stay web-first.

Mobile must use school-friendly labels, safe states, purpose-limited APIs, and secure storage.

---

## 3. Mobile Guardrails

- No mini-dashboard copy of web.
- No broad student mobile app in MVP.
- No financial write queueing unless backend idempotency is confirmed.
- No tokens, OTPs, passwords, student data, salary data, or private payloads in logs.
- Use secure token storage.
- Respect `tenantId`, backend permissions, module entitlements, own-child/own-staff/assigned-class/assigned-trip scope.
- Purpose-limited APIs only.
- Do not use admin-shaped APIs for parent, driver, staff self-service, or controlled student session flows.
- Offline support only where safe.
- Loading, empty, error, offline, permission denied, module locked, pending sync, and success states are required.
- Files use authenticated download/share helpers only.
- No raw storage URLs.
- No AI runtime, public leaderboard, open student chat, or harsh labels.

---

## 4. Mobile Architecture Plan

Recommended Flutter structure:

```text
apps/schoolos_mobile/lib/
  core/
    network/
    auth/
    storage/
    routing/
    config/
  shared/
    widgets/
    theme/
    errors/
    offline/
  features/
    auth/
    parent/
    teacher/
    driver/
    staff/
    student_session/
    notices/
    homework/
    attendance/
    fees/
    transport/
    profile/
```

Architecture:

```text
presentation -> application/use-cases -> domain -> data
```

Use:

- Riverpod unless an existing Bloc pattern is already established in the touched area.
- `go_router`.
- Dio with interceptors.
- `freezed` / `json_serializable` where already used or planned.
- `flutter_secure_storage`.
- FCM later only when backend/provider readiness exists.

Shared services:

- One API client with base URL from env/config.
- Auth refresh/session-expired handler.
- Secure token storage and logout cache clearing.
- Error mapper from backend errors to school-friendly mobile errors.
- Permission/module service for navigation visibility.
- Offline read cache for safe summaries.
- Pending-sync queue only for explicitly idempotent actions.
- Protected file download/share helper.

---

## 5. Mobile Role-Based Plans

### Parent

- **Purpose:** Let guardians understand and act for their own linked children.
- **Home screen:** Child switcher, today's child summary, attendance, homework, dues, notices, activity/transport alerts.
- **Main cards:** Attendance, fee due, homework due, notices, transport status, activity, learning summary where enabled.
- **Main actions:** Switch child, open attendance, view homework, view/download receipt/report card where protected helper exists, read notice, open transport status.
- **Detail screens:** Child summary, attendance calendar, invoice/receipt details, homework detail, notice detail, activity detail, transport status, learning summary.
- **API dependencies:** Own-child mobile endpoints; needs backend verification and OpenAPI contract confirmation for every child-scoped area.
- **Offline behavior:** Cache selected child and last safe read summaries; block financial writes offline.
- **States:** Empty child list, no notices, no dues, offline cached, receipt unavailable, permission denied, module locked.
- **Security/RBAC notes:** Parent sees linked children only; no other child, staff private data, internal reports, unpublished marks, audit logs, or accounting internals.

### Teacher

- **Purpose:** Fast daily classroom work for assigned classes/subjects.
- **Home screen:** Today board with current/next class, assigned attendance, homework, notices/messages, substitutions.
- **Main cards:** Today's timetable, attendance pending, homework due/review, messages, notices, substitutions.
- **Main actions:** Mark attendance, save draft, submit attendance, create/review homework light flow, read/send scoped messages where allowed.
- **Detail screens:** Assigned class roster, attendance register, homework detail/review, timetable, notice/chat, profile/leave.
- **API dependencies:** Assigned-class teacher mobile APIs; attendance offline sync needs idempotency confirmation.
- **Offline behavior:** Cache timetable/rosters/homework; attendance offline draft only if backend sync/idempotency supports it.
- **States:** Unassigned class denied, locked attendance, draft pending/synced/failed, quiet-hours banner, module locked.
- **Security/RBAC notes:** No finance, accounting, payroll admin, settings, platform, unrelated classes, unrelated students, or private documents unless permitted.

### Driver

- **Purpose:** Operate assigned transport trip safely.
- **Home screen:** Active assigned trip or clear no-trip state.
- **Main cards:** Route, vehicle, stop progress, manifest count, latest GPS state, emergency contacts.
- **Main actions:** Start trip, mark pickup/drop/absent, send latest GPS ping, end trip, call emergency contact where allowed.
- **Detail screens:** Stop list, student manifest with minimal safe data, trip history, GPS status, emergency.
- **API dependencies:** Purpose-limited driver transport APIs; needs mobile contract DTO and offline sync confirmation.
- **Offline behavior:** Cache active manifest/instructions; pending GPS/status changes visible only where idempotent.
- **States:** No assigned trip, stale GPS, offline pending, failed ping, trip already ended, permission denied.
- **Security/RBAC notes:** Assigned trip only; no academic, fee, health/private student data beyond emergency-safe contract.

### Staff

- **Purpose:** Self-service for own work information.
- **Home screen:** Own attendance/leave/payslip/notice summary.
- **Main cards:** Own profile, attendance/leave balance, leave request status, payslips, notices.
- **Main actions:** Request leave, view payslip, view notices, update own profile fields where allowed.
- **Detail screens:** Own profile, leave request form/history, payslip list/detail/download, notices.
- **API dependencies:** Own-staff APIs; payslip protected download helper needs backend verification.
- **Offline behavior:** Cache own profile, leave balances, payslip metadata, last attendance status; writes require network unless approved.
- **States:** No payslips, leave unavailable, protected file unavailable, session expired, permission denied.
- **Security/RBAC notes:** Own data only; no other staff salaries, payroll runs, salary structures, HR admin screens, student records, finance/accounting.

### Controlled Student Session

- **Purpose:** Let a student join and complete a teacher-controlled learning session.
- **Home screen:** Join by code/QR only, or active session if already joined.
- **Main cards:** Active activity, progress/autosave status, submit state.
- **Main actions:** Join session, answer, autosave, submit attempt, view own result/feedback only.
- **Detail screens:** Join, active activity, submitted summary.
- **API dependencies:** Learning session join/attempt/autosave/submit/progress APIs; idempotency confirmation required.
- **Offline behavior:** Prefer online school network; keep local unsent answers only for current active session if safe.
- **States:** Invalid code, expired/ended session, autosave pending/failed, submit retry, permission denied.
- **Security/RBAC notes:** Own active session only; no open chat, no public leaderboard, no AI tutor/runtime, no broad student home, no harsh labels.

---

## 6. Parent Mobile Plan

Parent mobile must be own-child scoped and purpose-limited.

Required capabilities:

- Child switcher.
- Attendance summary.
- Fee due summary.
- Receipt view/download if protected helper exists.
- Homework list.
- Notices.
- Activity feed.
- Transport status.
- Parent-teacher chat only if M10 rules allow.
- No access to other children.

Implementation notes:

- Receipts, report cards, and payment proofs use File Registry/authenticated helpers.
- Parent financial writes must be network-only unless backend idempotency and reconciliation are explicitly confirmed.
- Payment/provider features must fail closed when provider readiness is absent.
- Parent sees only published report cards and child-safe activity media.

---

## 7. Teacher Mobile Plan

Teacher mobile is for daily classroom workflows.

Required capabilities:

- Today's timetable.
- Assigned classes only.
- Attendance marking.
- Attendance offline draft only if backend sync/idempotency supports it.
- Homework assign/review light flow.
- Notices.
- Communication during school hours only.
- No finance/payroll/admin controls.

Implementation notes:

- Teacher actions use assigned-class/subject APIs.
- Chat respects M10 quiet hours and assigned parent/student scope.
- Attendance drafts show visible sync status.
- Teacher self-service uses own-staff scope only.

---

## 8. Driver Mobile Plan

Driver mobile is assigned-trip only.

Required capabilities:

- Assigned trip.
- Start/end trip.
- Stop list.
- Pickup/drop status.
- Latest GPS ping.
- Offline/stale GPS state.
- Emergency contacts.
- No access to student academic/fee/private data.

Implementation notes:

- GPS/status writes need idempotency and visible pending/failed state.
- Parent live tracking/map depth remains dependent on backend/provider/load/privacy decisions.
- Manifest DTO must expose only trip-safe fields.

---

## 9. Staff Mobile Plan

Staff mobile is own-staff self-service.

Required capabilities:

- Own profile.
- Own attendance/leave summary.
- Leave request.
- Payslip list/download if allowed.
- Notices.
- No access to other staff salary data.

Implementation notes:

- Salary/bank fields remain masked unless permission allows.
- Payslip downloads use protected helpers.
- Leave writes are audited server-side.

---

## 10. Controlled Student Session Plan

Student mobile/app access is not broad MVP student access. It is controlled learning session access only.

Required capabilities:

- Join session by code/QR.
- Active session only.
- Autosave where supported.
- Submit attempt.
- Own result/feedback only.
- No open chat.
- No public leaderboard.
- No AI tutor/runtime.
- No harsh labels.

Implementation notes:

- Session code/QR validation must fail closed.
- Attempts must be idempotent for start/autosave/submit.
- Parent/student summaries use supportive, non-comparative language.

---

## 11. Mobile UI/UX Plan

Mobile is task-first.

Rules:

- 44px minimum touch targets.
- Simple cards, lists, and action rows.
- No dense tables.
- Bottom navigation only if useful per role.
- Clear offline banners.
- Last updated labels when cached data is shown.
- Skeletons, not spinners, where possible.
- Nepali school-friendly language.
- Small readable screens; avoid cramming web dashboard density into mobile.
- Confirm high-risk actions.
- Keep primary actions obvious and secondary actions behind a simple menu.

Common widgets:

- `RoleHomeScaffold`.
- `TodayCard`.
- `AttentionCard`.
- `ClassPeriodCard`.
- `StudentMiniProfileCard`.
- `AttendanceRegister`.
- `HomeworkCard`.
- `MessageThreadCard`.
- `SyncStatusBanner`.
- `OfflineBanner`.
- `OfflineQueueCard`.
- `PermissionState`.
- `ModuleLockedState`.
- `ProtectedFileButton`.

---

## 12. Mobile API Contract Plan

Do not invent fake endpoint contracts. Every mobile surface must be verified against backend code and OpenAPI before implementation.

Parent API needs:

- Children list.
- Parent dashboard/child summary.
- Attendance summary.
- Homework list/detail.
- Fee due summary.
- Invoice/receipt list/detail.
- Protected receipt/report-card download.
- Notices.
- Activity feed.
- Transport status.
- Canteen/library/learning summary where enabled.
- Chat only if M10 rules allow.
- Mark unknowns as needs backend verification, needs OpenAPI contract confirmation, or needs mobile contract DTO.

Teacher API needs:

- Teacher today/timetable.
- Assigned classes.
- Assigned roster.
- Attendance draft/submit.
- Homework create/review light flow.
- Notices/messages.
- Profile/self-service.
- Offline attendance requires needs idempotency confirmation and needs offline sync confirmation.

Driver API needs:

- Driver dashboard.
- Assigned active trip.
- Stop list/manifest.
- Start/end trip.
- Pickup/drop/absent mutations.
- GPS ping.
- Emergency contacts.
- Trip history.
- Mark gaps as needs mobile contract DTO and needs offline sync confirmation.

Staff API needs:

- Own profile.
- Own attendance/leave summary.
- Leave balances and leave request.
- Payslip list/detail/protected download.
- Notices.
- Mark gaps as needs backend verification and needs OpenAPI contract confirmation.

Controlled student session API needs:

- Join by session code/QR.
- Start/resume attempt.
- Autosave.
- Submit.
- Own result/feedback.
- Mark idempotent attempt actions as needs idempotency confirmation.

Cross-cutting API requirements:

- Tenant-scoped.
- Role/permission/module-entitlement scoped.
- Purpose-limited DTOs.
- Secure mobile auth and refresh.
- No admin-shaped mobile responses.
- Protected files through authenticated helper endpoints.

---

## 13. Mobile Implementation Order

Use this sequence:

- **M-App W1 Mobile foundation:** auth, routing, theme, network, secure storage, error/offline states.
- **M-App W2 Parent home:** child summary, notices, homework, attendance.
- **M-App W3 Teacher daily workflow:** timetable, attendance, homework.
- **M-App W4 Driver workflow:** trips, stops, GPS/stale state.
- **M-App W5 Staff self-service:** leave, payslips, notices.
- **M-App W6 Controlled student session:** join, attempt, submit.
- **M-App W7 Polish, accessibility, API contract verification, smoke tests.**

Do not call this "Phase 1/2" in the app navigation.

---

## 14. Mobile Testing and Verification Plan

Commands for mobile implementation changes:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

Do not claim any command passed unless it was actually run.

Additional verification:

- Auth flow smoke.
- Parent child-scope checks.
- Teacher assigned-class checks.
- Driver route-scope checks.
- Staff own-data checks.
- Controlled student active-session checks.
- Secure storage checks.
- Logout clears cached private data.
- No sensitive logs.
- Offline/error state checks.
- Module locked state checks.
- Permission denied/direct route checks.
- Protected file/receipt/payslip checks where supported.
- Notification deep-link checks only after provider/backend readiness.

---

## 15. Mobile Risks

- Mobile becoming a mini web dashboard.
- Broad student app scope creep.
- Offline financial actions.
- Weak internet handling without clear stale/pending states.
- Token leakage.
- Student data leakage.
- Parent seeing another child.
- Driver seeing private student data.
- Teacher marking unassigned class.
- Staff seeing another staff member's salary/payslip.
- Notifications before provider/backend readiness.
- Admin-shaped APIs reused for mobile.
- Protected files exposed via raw URLs.
- Push/chat/payment features enabled before backend/provider readiness.
