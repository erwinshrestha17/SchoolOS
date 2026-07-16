# SchoolOS Mobile Design System

**Status:** Active design-system guidance for `apps/schoolos_mobile`.

**Source:** Derived from the SchoolOS Mobile App UI/UX Design Plan.

**Purpose:** Give Flutter implementers and Codex a stable mobile-first UI/UX standard for SchoolOS.

---

## 1. Design North Star

SchoolOS mobile is a companion app for daily school communication and field workflows. It is **not** a smaller copy of the web dashboard.

Every mobile screen should help the user answer:

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

Core rule:

```text
Mobile shows what this person needs to do now, not every module SchoolOS has.
```

---

## 2. Product Boundaries

### 2.1 Mobile-first personas

| Persona | Mobile job |
|---|---|
| Parent / Guardian | Understand own child: attendance, dues, homework, notices, activity, transport, receipts, report cards, and learning summary where enabled. |
| Teacher | Run today's classroom work: assigned classes, attendance, homework, timetable, notices/messages, and learning sessions where supported. |
| Principal / Head Teacher | Review attention items: attendance risks, staff absence, approvals, fees snapshot, transport alerts, and high-impact notices. |
| Driver / Conductor | Operate assigned trip safely: route, stop list, pickup/drop, latest GPS, and emergency contacts. |
| Staff Self-Service | Manage own work info: profile, attendance/check-in, leave, payslips, and notices. |
| Student Lab / Controlled Device | Join teacher-controlled learning session, autosave, submit, and view own result only. |

### 2.2 Web-first areas

These areas stay web-first unless a purpose-limited mobile contract exists:

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

- A full admin dashboard.
- A public student app for every feature.
- An accounting/payroll workstation.
- A platform control plane.
- An offline financial terminal.
- A social chat app.
- An AI runtime.

---

## 3. Non-Negotiable UI/UX Rules

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
- Backend authorization remains the source of truth; hidden mobile actions are not security.

---

## 4. Experience Principles

### 4.1 One role, one home

After login, the user lands on a role-specific home.

A parent should not see teacher shortcuts. A driver should not see school reports. A staff self-service user should not see other staff data.

If a user has multiple roles, show a simple role switcher only where backend/session permissions support it.

### 4.2 One screen, one action

Mobile screens should avoid crowded dashboards. Each screen should have one primary action or one primary purpose.

| Screen | Main job | Primary action |
|---|---|---|
| Parent Home | Understand own child today | Open most urgent item |
| Teacher Today | See current class and pending work | Mark attendance |
| Driver Trip | Run assigned trip | Start / continue trip |
| Staff Leave | Request own leave | Submit request |
| Student Session | Complete activity | Submit answer |

### 4.3 Always explain blocked states

Blocked actions must be clear, calm, and specific.

Use copy such as:

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
- Cache safe read-only summaries where allowed.
- Make retry behavior obvious.
- Never silently overwrite server data after reconnect.

---

## 5. Visual Style

SchoolOS mobile should feel:

- Clean.
- Professional.
- Trustworthy.
- Calm.
- Friendly for school users.
- Fast and lightweight.

### 5.1 Core visual direction

- Clean card-based layout.
- Simple white/soft cards on calm background.
- Himalayan blue identity: brand blue `#2563EB` for actions, deep navy
  `#17324D` for authority. Same identity as SchoolOS web.
- Clear role-specific home header.
- Large tap targets.
- Minimal charts.
- No dense tables.
- No desktop dashboard density.
- Friendly school language.

Palette lives in `lib/app/theme/app_colors.dart` and mirrors the web tokens
(`apps/web/docs/DESIGN_SYSTEM.md` §5.2):

| Token | Value | Usage |
|---|---:|---|
| `primary` | `#2563EB` | Primary actions, links, active controls. |
| `primaryDark` | `#1D4ED8` | Pressed states. |
| `primaryLight` | `#EAF2FF` | Brand tint: selected chips and rows. |
| `brandNavy` | `#17324D` | Headings, authority accents. |
| `secondary` | `#168C8C` | Brand teal accent. |
| `backgroundLight` | `#F4F7FB` | Scaffold canvas. |
| `slate200` | `#DDE4EC` | Borders and separators. |
| `slate500` | `#667085` | Secondary text. |
| `slate400` | `#98A2B3` | Timestamps and placeholders. |
| `slate900` | `#172033` | Primary text. |

Semantic colours never change meaning by screen or persona
(main / pale / dark text): success `#27875A`/`#EAF7F0`/`#17633E`, warning
`#D99016`/`#FFF6DF`/`#82580B`, danger `#D14343`/`#FDECEC`/`#9D2929`, info
`#2878C8`/`#EAF3FC`/`#1F5E9B`.

Persona home accents are anchored to the module each persona lives in:
parent coral `#D56B5D` (Activity), student cyan `#2C91B7` (Learning),
teacher indigo `#5B5BD6` (Academics), driver orange `#D46A1F` (Transport),
staff steel `#4B6B88` (HR), admin navy `#17324D`. Accents identify the
persona's home — they never replace semantic status colours.

### 5.2 Avoid

- Random gradients.
- Random colors outside the theme.
- Dense admin tables on mobile.
- Tiny row actions.
- Desktop-style sidebars.
- Overloaded home screens.
- Heavy shadows.
- Unclear icon-only actions.
- Status labels that shame students.

---

## 6. Layout and Spacing

### 6.1 Page spacing

Use consistent spacing tokens in the app theme/shared constants where possible.

Recommended baseline:

| Element | Recommended value |
|---|---:|
| Page horizontal padding | 16 |
| Page vertical padding | 16 |
| Card padding | 16 |
| Compact card padding | 12 |
| Section spacing | 20-24 |
| Related element spacing | 8-12 |
| Card radius | 16-20 |
| Button radius | 12-16 |
| Icon container size | 40-48 |
| Minimum touch target | 44 |

### 6.2 Density rule

SchoolOS mobile must not feel like a web dashboard compressed into a phone.

Use:

- Cards instead of dense tables.
- Bottom sheets for quick forms/detail panels.
- Full screens for long forms.
- Action sheets for secondary actions.
- Clear section breaks.
- Last-updated labels for cached data.

---

## 7. Typography

Typography should create clear hierarchy without visual noise.

Font: **Inter** for English, numbers, and interface text, with **Noto Sans
Devanagari** for Nepali and the system sans-serif as final fallback — the
same type personality as SchoolOS web. The stack is declared in
`lib/app/design_system/app_typography.dart` and both families are bundled
in `assets/fonts` at weights 400/500/600/700.

Scale (from the SchoolOS Typography Standard, mobile table): screen title
24/32 700 (`headlineLarge`), section heading 18/24 600 (`titleLarge`), card
heading 16/22 600 (`titleMedium`), main body 14/21 400 (`bodyMedium`),
important value 20/28 700 (`headlineMedium`), helper 12/17 400
(`bodySmall`), button 14/20 600 (`labelLarge`), bottom navigation 11/16 500
(`labelSmall`). Do not reduce important operational text below 12.

| Role | Guidance |
|---|---|
| Screen title | Large, bold, concise. |
| Section title | Medium, semibold. |
| Card title | Semibold, clear. |
| Body text | Readable, not too small. |
| Metadata | Smaller, muted, but accessible. |
| Status labels | Short, calm, school-friendly. |

Rules:

- Prefer existing `Theme.of(context).textTheme` tokens.
- Do not hardcode arbitrary text sizes repeatedly.
- Avoid very small labels for important states.
- Use calm copy for risk/attention states.
- Keep school-facing copy simple and non-technical.

---

## 8. Touch and Interaction Rules

- Minimum 44px touch targets.
- Primary action should be near the thumb zone where practical.
- Avoid placing destructive and safe actions side-by-side.
- Avoid tiny row actions.
- Use confirmation for destructive or high-impact actions.
- Use bottom sheets for quick forms and selectors.
- Use full screens for long forms.
- Show progress for slow network actions.
- Prevent duplicate submits.
- Keep success feedback clear without losing context.

---

## 9. Shared Widget System

Prefer reusable widgets over one-off UI. Add missing shared widgets under `shared/widgets` or the established project location.

Recommended shared widgets:

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

### 9.1 Component rules

- Reuse existing shared widgets before creating new ones.
- Extract repeated cards, headers, state views, banners, and buttons.
- Keep screens composed of small widgets.
- Keep business logic out of widgets.
- Prefer `const` constructors where possible.
- Avoid large `build` methods.

---

## 10. Shared State Components

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

### 10.1 Required state behavior

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

### 10.2 Offline copy examples

```text
You are offline. Showing last updated attendance from 9:15 AM.
This action needs internet. Please reconnect and try again.
Your attendance draft is saved on this device and will sync when internet returns.
This payment action cannot be completed offline.
```

### 10.3 Permission copy examples

```text
You can only view children linked to your guardian account.
This class is not assigned to you.
This trip is not assigned to you today.
You do not have permission to view payslips.
```

---

## 11. Navigation Model

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

## 12. Persona Design Rules

### 12.1 Parent / Guardian

Parent mobile is own-child only. It must never use admin-shaped APIs.

Primary screens:

| Screen | Main job | Primary action |
|---|---|---|
| Parent Home | Understand child today | Open urgent item |
| Child Switcher | Switch between linked children | Select child |
| Attendance | View child's attendance | Open month/day detail |
| Homework | View due homework | Open homework detail |
| Notices | Read school notices | Open notice |
| Fees | View dues/invoices | Open invoice |
| Receipts | Download/share receipt | Download receipt |
| Report Cards | View published result | Download report card |
| Activity | View child-safe feed | Open post |
| Transport | View latest route/trip status | Refresh status |
| Learning Summary | See supportive progress | Open activity summary |

Rules:

- Parent can view only currently linked children.
- Guardian removal immediately revokes access.
- Parent cannot view unpublished marks/results.
- Parent cannot view internal reports, audit logs, staff private data, accounting internals, or other children.
- Payment initiation/top-up is network-only and provider-readiness gated.
- Bank proof upload creates pending verification only; it does not mark an invoice paid.
- Receipts/downloads appear only after confirmed payment.
- Receipt/report-card/payment-proof files use authenticated helpers.
- Offline financial writes are not allowed.

### 12.2 Teacher

Teacher mobile is for daily classroom work only.

Primary screens:

| Screen | Main job | Primary action |
|---|---|---|
| Today | See current class and tasks | Mark attendance |
| Assigned Classes | Open assigned class | Select class |
| Attendance Register | Mark assigned attendance | Submit attendance |
| Homework | Assign/review homework | Create homework |
| Timetable | View schedule | Open period |
| Messages | Reply to scoped parent threads | Send message |
| Learning Session | Launch/monitor activity | Launch session |
| Profile/Self-service | Own staff actions | Request leave |

Rules:

- Teacher sees only assigned classes/subjects/students unless explicit permission allows more.
- Teacher cannot mark attendance for unassigned class.
- Locked attendance date is read-only.
- Offline draft shows pending/synced/failed status.
- Duplicate submit is prevented.
- Teacher cannot access finance/accounting/payroll admin.

### 12.3 Principal / Head Teacher

Principal mobile is attention-first, approval-first, and snapshot-first. It is not full admin.

Primary screens:

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

Rules:

- Principal can view safe summaries and attention alerts.
- Principal cannot become full accountant/payroll/admin on mobile unless permission and purpose-limited endpoints exist.
- Payroll salary/bank details are blocked without payroll permission.
- Accounting journal posting, fiscal close/reopen, platform billing, and admin-shaped APIs stay blocked by default.

### 12.4 Driver / Conductor

Driver mobile is assigned-trip only.

Flow:

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

### 12.5 Staff Self-Service

Staff mobile is own-staff only.

Primary screens:

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

### 12.6 Student Lab / Controlled Session

Student app access is controlled session access only.

Rules:

- Join only valid live sessions for own class/section.
- Session code/QR must expire and fail closed.
- Student sees only own active attempt/result.
- Autosave and submit must be idempotent.
- No broad home, fees, parent/staff data, other students, unpublished marks, public leaderboard, open chat, or AI tutor/runtime.
- Use supportive labels only.

---

## 13. Offline, Cache, and Sync UX

### 13.1 Safe offline reads

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

### 13.2 Offline writes

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

### 13.3 Pending sync UI

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

## 14. Protected File UX

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

## 15. API Contract UX Rules

Do not invent fake endpoint contracts. Every mobile surface must be verified against backend code and OpenAPI before implementation.

Mark unknowns as:

- needs backend verification
- needs OpenAPI contract confirmation
- needs mobile contract DTO
- needs idempotency confirmation
- needs offline sync confirmation

Do not start a mobile screen if the only available endpoint is admin-shaped or exposes more data than the persona needs.

---

## 16. Notifications and Deep Links

Push notifications should open only safe, scoped destinations.

Deep link rules:

- Re-check session.
- Re-check tenant.
- Re-check role/permission/module.
- Re-check ownership/assignment.
- Show safe denied/expired state when invalid.
- Do not reveal title/preview of forbidden content.

---

## 17. Mobile Screen Acceptance Checklist

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
[ ] UI uses shared theme/components instead of one-off styling.
[ ] No horizontal overflow on small phones.
[ ] Repeated patterns are extracted into reusable widgets.
```

---

## 18. Final Design Standard

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

That is the design standard for the SchoolOS Flutter mobile app.
