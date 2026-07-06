# SchoolOS Mobile Agent Instructions

Scoped rules for `apps/schoolos_mobile`. Root `AGENTS.md` applies first.

This file is written for Codex and any repo-aware coding agent working on the SchoolOS Flutter mobile app.

---

## 1. Required Reading Before Mobile Work

Before changing mobile UI, Flutter architecture, routes, API contracts, or feature behavior, read the relevant files first.

Required baseline:

```text
apps/schoolos_mobile/AGENTS.md
apps/schoolos_mobile/docs/DESIGN_SYSTEM.md
```

Also read where relevant:

```text
MOBILE_MASTER_GUIDE.md
SchoolOS mobile design plan docs
Web frontend design plan if the flow depends on web-owned admin setup
Project status/plan docs
Architecture/security docs
SRS and MDD docs
FRS / feature requirements docs
Existing Flutter code for the touched feature
Existing API clients/repositories/providers for the touched feature
OpenAPI/backend routes for the touched feature
```

Canonical paths:

```text
docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/requirements/SCHOOLOS_SRS.md
docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md
```

Do not guess contracts. If an endpoint, DTO, permission rule, offline rule, or idempotency behavior is not confirmed, mark it explicitly as needing backend verification.

---

## 2. Mobile Product Rule

SchoolOS mobile is a companion app for daily school communication and field workflows.

It is not a smaller copy of the web dashboard.

Core rule:

```text
Mobile shows what this person needs to do now, not every module SchoolOS has.
```

Every mobile screen should answer:

```text
What do I need to know now?
What can I safely do from my phone?
What needs attention today?
```

### Summary card rule (no web KPI grids)

Do not copy web KPI grids into Flutter. Per persona, show task signals instead:

- Parent: no KPI cards; urgent child cards only ("Fee due", "Absent today", "New notice", "Report card published").
- Teacher: 1-3 task signals — next class, attendance pending, homework awaiting review.
- Principal: a small attention summary is fine — approvals pending, attendance gap, urgent transport/notice issue.
- Driver: no KPI dashboard; assigned trip, next stop, boarding/deboarding progress, GPS freshness.
- Staff: no KPI wall; leave balance, attendance state, payslip availability where permitted.

Same backing rule as web (see `apps/web/AGENTS.md` KPI design rule): backend-owned, tenant/permission-filtered, time-bound, honest about unavailable/loading/locked state. The mobile difference is presentation only — dense KPI grids, not the underlying safety rules.

---

## 3. Non-Negotiables

Never break these rules:

- Flutter mobile is companion-first, not mini-web-dashboard.
- Persona-first, task-first, low-bandwidth friendly, real APIs only.
- Web-first areas stay web-first: admin setup, finance/accounting/payroll admin, platform operations, provider settings, large reports/exports, dense tables, and system configuration.
- No admin-shaped APIs for parent, teacher, principal, driver, staff self-service, or student session screens.
- Parent = own child only.
- Teacher = today/assigned class/assigned subject work.
- Principal = attention/snapshot/approval workflows only.
- Driver = assigned trip only.
- Staff = own data only.
- Student = controlled lab/session only.
- No broad student mobile app.
- Backend authorization is truth; hidden mobile actions are UX only.
- Offline support only where safe and visible.
- High-risk writes stay online-only unless idempotency and reconciliation are confirmed.
- Private files use authenticated download/share helpers only.
- No raw storage URLs or object keys in UI, logs, or local cache.
- No session credentials, verification codes, passwords, student private data, salary data, or private payloads in logs.
- Store session credentials only in secure storage.
- Logout/session expiry must clear private cached data where practical.
- No AI runtime, public leaderboard, open student chat, or harmful labels.

---

## 4. Flutter Architecture Rules

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

Layer responsibilities:

| Layer | Responsibility | Must not do |
|---|---|---|
| Presentation | Widgets, screens, user interaction, state display | Direct API calls, business rules, sensitive logging |
| Application / use-cases | Orchestrate actions, validation flow, sync decisions | Render UI, know provider-specific network details |
| Domain | Entities, value objects, policy helpers | Depend on Flutter widgets or API DTO shape directly |
| Data | API clients, repositories, local cache mappers | Decide UI behavior or bypass permissions |

Shared services to preserve or introduce where needed:

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

Package direction:

- Use existing project direction unless code already establishes a different pattern.
- Prefer Riverpod unless the touched area already uses Bloc or another established pattern.
- Prefer `go_router` for protected and role-aware navigation where already adopted.
- Prefer Dio with interceptors where already adopted.
- Use generated models only where existing code patterns support it.
- Use `flutter_secure_storage` for session credentials.
- Do not add push/FCM implementation unless backend/provider readiness exists.

---

## 5. Design-System Rules

Before any UI work, read:

```text
apps/schoolos_mobile/docs/DESIGN_SYSTEM.md
```

Follow these UI rules:

- Clean card-based layout.
- Simple white/soft cards on calm background.
- Deep blue/indigo primary identity unless the existing theme defines otherwise.
- Clear role-specific home header.
- Large tap targets.
- Minimal charts.
- No dense tables.
- No desktop dashboard density.
- Friendly school language.
- Use shared state components for loading, empty, error, offline, permission denied, module locked, session expired, and protected-file unavailable states.
- Use existing app theme tokens first.
- Do not hardcode random colors, typography, radius, or spacing repeatedly.
- Add missing tokens centrally if needed.
- Extract repeated cards, banners, buttons, headers, and list items into reusable widgets.
- No horizontal overflow on small phones.
- Minimum 44px touch targets.

Visual improvement must preserve product safety. Do not make a screen visually richer by exposing more data than the persona should see.

---

## 6. Persona Scope Rules

### 6.1 Parent / Guardian

Parent mobile is own-child only.

Rules:

- Parent can view only currently linked children.
- Guardian removal immediately revokes access after refresh/session check.
- Parent cannot view unpublished marks/results.
- Parent cannot view internal reports, audit logs, staff private data, accounting internals, or other children.
- Payment initiation/top-up is network-only and provider-readiness gated.
- Bank proof upload creates pending verification only; it does not mark an invoice paid.
- Receipts/downloads appear only after confirmed payment.
- Receipt/report-card/payment-proof files use protected helpers.
- Offline financial writes are not allowed.

Smoke expectations:

```text
Parent sees linked child only.
Parent cannot open another child by deep link.
Removed guardian loses access after refresh/session check.
Published report card opens; unpublished report card is hidden/blocked.
Receipt download uses protected helper.
Offline mode shows cached child summary with last-updated label.
```

### 6.2 Teacher

Teacher mobile is for daily classroom work only.

Rules:

- Teacher sees only assigned classes/subjects/students unless explicit permission allows more.
- Teacher cannot mark attendance for unassigned class.
- Locked attendance date is read-only.
- Offline draft shows pending/synced/failed status.
- Duplicate submit is prevented.
- Teacher cannot access finance/accounting/payroll admin.

Attendance flow:

```text
Open assigned class
-> Load roster
-> Mark present/absent/late/leave
-> Save draft where supported
-> Submit
-> Show submitted status
```

Smoke expectations:

```text
Teacher sees only assigned class list.
Teacher cannot open unassigned class by deep link.
Attendance draft state is visible.
Quiet-hours message block is clear.
Teacher cannot access finance/accounting/payroll admin.
```

### 6.3 Principal / Head Teacher

Principal mobile is attention-first, approval-first, and snapshot-first. It is not full admin.

Rules:

- Principal can view safe summaries and attention alerts.
- Principal cannot become full accountant/payroll/admin on mobile unless permission and purpose-limited endpoints exist.
- Payroll salary/bank details are blocked without payroll permission.
- Accounting journal posting is blocked.
- Fiscal period close/reopen is blocked.
- Platform billing is blocked.
- Unscoped private chats are blocked.
- Admin-shaped APIs are blocked.

### 6.4 Driver / Conductor

Driver mobile is assigned-trip only.

Rules:

- Driver sees assigned trip only.
- Manifest exposes only trip-safe fields.
- No academic, fee, health/private detail beyond emergency-safe fields.
- GPS/status changes show pending/failed state where backend supports idempotency.
- Emergency action is protected against accidental taps.
- Parent live map depth depends on backend, privacy, and load decisions.

Smoke expectations:

```text
Driver sees only assigned trip.
Unassigned trip deep link is denied.
Offline GPS/status state is visible.
Manifest does not expose academic/fee/private data.
Trip already ended shows safe state.
```

### 6.5 Staff Self-Service

Staff mobile is own-staff only.

Rules:

- Own profile only.
- Own leave only.
- Own payslips only.
- Salary/bank fields masked unless permission allows.
- No other staff profiles, payroll runs, salary structures, HR admin, student records, finance, or accounting.
- Payslip downloads use protected helpers.

### 6.6 Student Lab / Controlled Session

Student app access is controlled session access only. There is no broad MVP student mobile app.

Rules:

- Join only valid live sessions for own class/section.
- Session code/QR must expire and fail closed.
- Student sees only own active attempt/result.
- Autosave and submit must be idempotent.
- No broad home.
- No fees.
- No parent/staff data.
- No other students.
- No unpublished marks.
- No public leaderboard.
- No open chat.
- No AI tutor/runtime.
- Use supportive labels only.

---

## 7. Mobile Navigation Rules

Recommended navigation:

| Persona | Navigation |
|---|---|
| Parent | Home, Children, Attendance, Homework, Notices, More |
| Teacher | Today, Attendance, Homework, Messages, Profile |
| Principal | Today, Attention, Approvals, Notices, More |
| Driver | Trip, Manifest, GPS, History, Emergency |
| Staff | Home, Attendance, Leave, Payslips, Notices, Profile |
| Student Session | Join Session, Activity, Progress, Exit; no broad bottom nav |

Rules:

- Navigation is role-scoped and tenant-scoped.
- Hidden modules are not security; backend still blocks direct access.
- Module-locked routes show safe locked state.
- Back navigation after logout must not expose private data.
- Logout clears persona data, cached private summaries, and temporary protected file handles where practical.
- Deep links must re-check session, tenant, role, permission, module, and ownership before showing data.
- Forbidden deep links must not reveal titles/previews of forbidden content.

---

## 8. Mobile Screen State Rules

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

Use shared state components instead of inventing one-off states.

Allowed copy examples:

```text
You are offline. Showing last updated attendance from 9:15 AM.
This action needs internet. Please reconnect and try again.
Your attendance draft is saved on this device and will sync when internet returns.
This payment action cannot be completed offline.
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

## 10. Protected File Rules

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

## 11. API Contract Rules

Do not invent fake endpoint contracts. Every mobile surface must be verified against backend code and OpenAPI before implementation.

Suggested mobile API groups in design/planning docs are examples and must be confirmed before code relies on them.

Mark unknowns as:

- needs backend verification
- needs OpenAPI contract confirmation
- needs mobile contract DTO
- needs idempotency confirmation
- needs offline sync confirmation

Do not start a mobile screen if the only available endpoint is admin-shaped or exposes more data than the persona needs.

---

## 12. Codex Workflow for UI Work

Use this sequence for Flutter UI/design tasks:

```text
1. Read AGENTS.md and DESIGN_SYSTEM.md.
2. Inspect the existing theme, shared widgets, routes, providers/state, and API clients for the touched feature.
3. Audit the current screen before editing.
4. Identify missing states: loading, empty, error, offline, permission denied, module locked, success, pending sync.
5. Implement the smallest useful scoped change.
6. Reuse existing design system and shared widgets.
7. Extract repeated UI into reusable widgets.
8. Preserve existing routes, auth, providers, models, API calls, and permissions unless the task explicitly asks otherwise.
9. Run verification commands when code changes are made.
10. Report changed files, verification results, assumptions, and unresolved issues.
```

For visual polish tasks, prefer small scoped passes:

```text
Audit -> Implement one screen -> Review UI -> Polish -> Verify
```

Do not redesign the whole app in one task unless explicitly requested.

---

## 13. Implementation Order

Use this sequence unless the user explicitly changes priority:

1. **MOB1 Core shell and auth hardening**: secure storage, session restore, role routing, error mapper, permission/module service, logout cache clearing.
2. **MOB2 Parent MVP**: child switcher, home, attendance, homework, notices, profile.
3. **MOB3 Teacher MVP**: today board, assigned classes, attendance, homework, timetable, notices/messages.
4. **MOB4 Staff and Driver MVP**: staff self-service, driver assigned trip, manifest, GPS status, emergency.
5. **MOB5 Principal attention app**: attention dashboard, approvals, attendance risk, emergency notices, safe snapshots.
6. **MOB6 Parent operations depth**: fees/receipts, report cards, transport, canteen, library, activity, chat, learning summary.
7. **MOB7 Controlled student session polish**: session join/autosave/submit/result, school-only hardening.
8. **MOB8 Device QA, offline/read cache, push notifications, accessibility, and low-bandwidth polish.**

---

## 14. Mobile Acceptance Checklist

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
[ ] No horizontal overflow on small phones.
[ ] Repeated UI patterns are extracted into reusable widgets.
[ ] Existing auth, routing, providers, models, permissions, and API clients are not broken.
```

---

## 15. Verification Commands

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

If a command cannot run, report exactly why.

---

## 16. Git Safety Rules

- Do not delete branches unless explicitly requested.
- Do not merge PRs unless explicitly requested.
- Do not remove unrelated files.
- Keep documentation-only changes separate from code changes where practical.
- Keep mobile work scoped to `apps/schoolos_mobile` unless root-level docs/config changes are explicitly necessary.
- Report commit SHA/PR link after repository changes.

---

## 17. Final Rule

Every mobile screen should feel simple, scoped, and safe.

A parent should understand their child's school day quickly.
A teacher should handle today's class work without opening the full dashboard.
A driver should run their assigned trip safely.
A staff member should manage their own work requests privately.
A student in a controlled session should complete the classroom activity without distraction.

That is the standard for the SchoolOS Flutter mobile app.
