# SchoolOS Mobile Master Guide

**Product:** SchoolOS Flutter Mobile App  
**Status:** Active mobile source of truth  
**Last updated:** 2026-06-03  
**Replaces:**

```text
apps/schoolos_mobile/PROJECT_INSTRUCTIONS.md
apps/schoolos_mobile/docs/APP_UI_UX_DIRECTION.md
apps/schoolos_mobile/docs/APP_DEVELOPMENT_PLAN.md
```

---

## 1. Purpose

This guide defines the product direction, architecture rules, UI/UX standards, role scope, sprint plan, security rules, and implementation expectations for the SchoolOS Flutter companion app.

Future Codex/mobile prompts should start with:

```text
Read apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md and follow it.
Task: [specific sprint/task].
Do not rewrite unrelated files.
Run validation and return changed files plus summary only.
```

---

## 2. Professional Role

Work on the SchoolOS Flutter Mobile App as a:

```text
Senior Flutter App Developer
Mobile App Architect
UI/UX Designer
Product Designer
Design Systems Engineer
Production Engineer
```

Think like a professional team building a real production school management mobile app for Nepal and similar markets.

The app must feel:

```text
Modern
Premium
Calm
Trustworthy
Fast
Smooth
Professional
Offline-aware
Easy for non-technical parents
Powerful for teachers and school staff
Reliable for drivers and staff self-service
```

Core design vision:

```text
SchoolOS Mobile should feel like a trusted premium fintech + education app:
clean cards, strong spacing, smooth transitions, elegant role dashboards,
polished icons, soft shadows, subtle gradients, calm colors,
and fast mobile-first workflows.
```

---

## 3. Product Direction

SchoolOS Mobile is a Flutter companion app for the main SchoolOS platform.

Main platform stack:

```text
NestJS backend
PostgreSQL
Prisma
Redis/BullMQ
Next.js web dashboard
```

The mobile app must not replace the full web/admin dashboard.

Core product rule:

```text
Mobile App = Daily Operations + Parent Engagement + Staff Self-Service
Web Dashboard = Setup + Admin Configuration + Deep Reports + Accounting
```

Heavy setup should stay in the web dashboard:

```text
Tenant setup
Fee structure setup
Accounting setup
Payroll setup
Timetable generation setup
Exam configuration
Platform billing
Deep reporting
Advanced administration
```

Mobile should focus on:

```text
Daily school operations
Parent engagement
Student self-service
Teacher classroom actions
Driver transport workflow
Staff self-service
Principal/admin approvals and alerts
```

---

## 4. Target Roles and Mobile Scope

Use one Flutter app with multiple role-based experiences.

Supported roles:

```text
PARENT
STUDENT
TEACHER
DRIVER
STAFF
ADMIN
PRINCIPAL
```

### 4.1 Parent / Guardian

The parent/guardian is the most important mobile user. The experience should feel child-first, calm, clear, and trustworthy.

Core features:

```text
Child switcher
Child profile
Attendance summary
Homework
Timetable
Fees and receipts
Report cards
Notices
Transport tracking
Canteen wallet
Activity feed and milestones
Parent-class teacher chat
```

### 4.2 Student

Learning-focused experience.

Core features:

```text
Homework
Timetable
Attendance
Notices
Exam schedule
Report cards
Library borrowings
Canteen balance
Activity feed
```

### 4.3 Teacher

Action-first experience for repeated daily classroom tasks.

Core features:

```text
Today’s classes
Mark attendance
Create homework
View timetable
Handle substitutions
Send notices
View student profiles
Parent messages during configured chat hours
Leave request
```

### 4.4 Driver

Trip-first and safety-first experience.

Core features:

```text
Assigned route
Start trip
Stop list
Mark student boarded/dropped
Share live GPS
Complete trip
Emergency contact
Trip history
```

### 4.5 Staff / HR User

Secure self-service experience.

Core features:

```text
Staff profile
Attendance/check-in
Leave request
Leave history
Payslip list/detail
Notices
Approval requests
```

### 4.6 Principal / Admin

Monitoring and approvals, not full admin setup.

Core features:

```text
Daily overview
Pending approvals
Attendance alerts
Fee collection snapshot
Transport alerts
Staff leave approvals
Budget/equipment approvals
Emergency notices
```

---

## 5. Architecture Rules

Use clean, scalable, feature-first Flutter architecture.

Preferred folder structure:

```text
lib/
  app/
    app.dart
    router.dart
    theme/
    localization/
    constants/
    design_system/

  core/
    config/
    network/
    storage/
    auth/
    errors/
    permissions/
    widgets/
    utils/

  features/
    auth/
    dashboard/
    profile/
    parent/
    students/
    attendance/
    homework/
    timetable/
    fees/
    receipts/
    exams/
    report_cards/
    notices/
    activity_feed/
    chat/
    transport/
    canteen/
    library/
    hr/
    payroll/
    approvals/
    settings/
    splash/

  shared/
    models/
    widgets/
    services/
```

When a feature becomes large enough, separate it internally:

```text
features/[feature]/
  data/
    data_sources/
    repositories/
    dto/
  domain/
    entities/
    repositories/
    use_cases/
  application/
    controllers/
    providers/
    state/
  presentation/
    screens/
    widgets/
```

Rules:

```text
Keep feature code inside lib/features/<feature_name>.
Keep cross-cutting app infrastructure inside lib/core.
Keep reusable UI components inside lib/shared/widgets.
Keep app shell, router, route constants, theme, and design system inside lib/app.
Do not dump everything into generic screens/widgets folders.
Do not create large single files for full modules.
Do not move unrelated files during a sprint.
Do not implement multiple future modules when the sprint only asks for one.
```

---

## 6. Preferred Flutter Stack

Use these choices consistently unless the existing project already uses a better established alternative.

```text
State management: flutter_riverpod
Routing: go_router
HTTP client: dio
Secure credentials: flutter_secure_storage
Simple local preferences: shared_preferences
Data models: freezed + json_serializable/json_annotation when model complexity grows
Date/formatting: intl
Images: cached_network_image
Files/uploads: file_picker, image_picker
Permissions: permission_handler
Notifications: firebase_messaging + flutter_local_notifications
GPS/transport: geolocator
Realtime: web_socket_channel
QR scan/display: mobile_scanner + qr_flutter
Connectivity: connectivity_plus
Local paths/cache: path_provider
Testing/mocking: flutter_test + mocktail where useful
```

Avoid adding new major packages unless the sprint explicitly needs them and the reason is documented.

---

## 7. API Integration Rules

The app consumes the existing SchoolOS backend.

Local development base URLs:

```text
iOS Simulator:     http://localhost:4000/api/v1
Android Emulator: http://10.0.2.2:4000/api/v1
Real phone:        http://<mac-local-ip>:4000/api/v1
```

Use `SCHOOL_OS_API_BASE_URL` through Dart defines for environment-specific base URLs.

Expected auth endpoints:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

API layer must include:

```text
Dio client
Base URL config
Request/response interceptors
Bearer token interceptor
Tenant context header when required
Refresh token handling
Error mapper
Timeout handling
Offline/network error detection
Safe logging with sensitive values removed
```

Rules:

```text
Use ApiClient for network calls.
Do not instantiate raw Dio inside feature screens.
Keep API calls in repositories/services, not widgets.
Map API errors into app-friendly exceptions or state.
Do not hard-code production credentials or tenant IDs.
Every repository should be testable and isolated from UI.
```

Never log:

```text
Access tokens
Refresh tokens
Passwords
Student health data
Guardian phone numbers
Payslip data
Transport live location
Chat messages
Student documents
Staff salary or bank details
```

---

## 8. Authentication and Authorization Rules

Auth state must support:

```text
Unauthenticated
Loading
Authenticated
TokenExpired
NeedsRefresh
LoggedOut
Error
```

Use secure storage for:

```text
Access token if required
Refresh token
Tenant context
User role
Permissions
```

Use shared preferences only for non-sensitive app preferences and non-sensitive tenant metadata.

The app must redirect users based on role after login.

Prefer permission-aware UI over hard-coded role-only UI when permission data is available.

Do not show screens/actions unless backend permissions allow them.

Backend authorization is always the source of truth. UI visibility is not security.

---

## 9. Routing and Navigation

Use `go_router`.

Public routes:

```text
/splash
/onboarding
/login
/forgot-password
```

Common authenticated routes:

```text
/home
/profile
/notifications
/settings
```

Role roots:

```text
/parent/home
/student/home
/teacher/home
/driver/home
/staff/home
/admin/home
```

Router rules:

```text
Protect authenticated routes.
Redirect unauthenticated users to login.
Redirect logged-in users to the correct role dashboard.
Handle unknown routes.
Prepare for deep links later.
Future modules should register routes cleanly in app/router.dart or feature route helpers if routing grows.
```

Use clean role-based bottom navigation:

```text
Parent: Home | Child | Fees | Notices | More
Teacher: Home | Classes | Attendance | Homework | More
Student: Home | Homework | Timetable | Notices | More
Driver: Trip | Route | Students | History | More
Staff: Home | Leave | Payslip | Notices | More
Admin/Principal: Home | Approvals | Alerts | Notices | More
```

Each screen must have one clear purpose. Do not put every module into bottom navigation. Put secondary modules inside `More`.

---

## 10. UI/UX Direction

SchoolOS Mobile should not look like a generic school template or a crowded admin dashboard. It should feel like a modern mobile product designed around daily school life.

Design keywords:

```text
Professional
Clean
Warm
Trustworthy
Child-first
Action-first
Offline-aware
Low-friction
Nepal-friendly
```

Avoid:

```text
Too many colors
Dense admin tables
Generic flat card grids
Tiny labels
Decorative screens with no purpose
Overloaded dashboards
Desktop UI copied into mobile
Heavy gradients everywhere
Unclear icon-only actions
Business logic inside widgets
```

Design principles:

1. **One screen, one job.**
2. **Progressive disclosure.** Show summary first, detail second.
3. **Mobile-first, not dashboard-first.** Use cards, grouped lists, timelines, chips, summary rows, calendars, bottom sheets, and detail pages.
4. **Trust through clarity.** Attendance, fee due, bus status, homework pending, payslip available, and approval pending must be immediately visible.

---

## 11. Brand, Color, Typography, Spacing

Use a calm school-professional palette.

Recommended direction:

```text
Primary: deep school blue or indigo
Background: soft off-white / cool grey
Surface: white or very light slate
Text: dark slate/navy
Success: green
Warning: amber
Error: red
Info: blue
```

Color rules:

```text
Use primary color for main navigation and primary actions.
Use semantic colors only for status meaning.
Do not assign random colors to every module.
Do not rely on color alone; always use labels/icons too.
Keep backgrounds calm and readable.
```

Typography rules:

```text
Use clear hierarchy: title, section title, body, caption, status.
Do not use tiny text for important school information.
Use medium/semi-bold weight for titles and card labels.
Use regular weight for descriptions.
Use tabular/consistent number styling for money, times, and counts where possible.
Use parent-friendly text: Fees due, Bus arriving, Attendance not submitted.
```

Spacing and touch target rhythm:

```text
Screen horizontal padding: 16-20px
Section spacing: 20-28px
Card internal padding: 16-20px
Grid gap: 12-16px
Touch target minimum: 44px
Cards radius: 20-28px
Small chips radius: 999px
```

---

## 12. Reusable Components

Create reusable components instead of duplicating UI.

Core components:

```text
AppScaffold
AppTopBar
AppBottomNav
AppButton
AppIconButton
AppTextField
AppSearchField
AppCard
AppMetricCard
AppActionCard
AppGradientCard
AppGlassCard
AppListTile
AppStatusChip
AppAvatar
AppEmptyState
AppErrorView
AppLoadingSkeleton
AppLoading
OfflineBanner
LastUpdatedLabel
SectionHeader
DashboardCard
QuickActionCard
UserAvatar
RoleBadge
AmountText
DateStatusLabel
PermissionBlockedView
AppBottomSheet
AppTimelineTile
```

Components should support where relevant:

```text
Loading state
Disabled state
Error state
Accessibility-friendly labels
Consistent padding
Consistent radius
Consistent motion
```

---

## 13. Role-Based Home Screen Direction

### Parent Home

Primary job: understand child today quickly.

Recommended sections/cards:

```text
Greeting + selected child
Attendance today
Homework pending
Fees due
Bus status
Latest notice/activity
Canteen balance
Chat availability
More services
```

### Teacher Home

Primary job: complete today’s school actions quickly.

Recommended cards:

```text
Today’s timetable
Attendance pending
Homework actions
Substitution duties
Parent messages
Class notices
Class list shortcut
```

### Student Home

Primary job: know what to study/do today.

Recommended cards:

```text
Today’s timetable
Homework due
Notices
Results/report-card alerts
Activity feed
```

### Driver Home

Primary job: operate the active trip safely.

Recommended cards:

```text
Assigned route
Trip status
Student count
Start trip button
Emergency contact
GPS status
Next stop
```

### Staff Home

Primary job: self-service and notices.

Recommended cards:

```text
Profile summary
Leave status
Payslip card
Notices
Pending requests
```

### Principal/Admin Home

Primary job: monitor and approve.

Recommended cards:

```text
School day health summary
Pending approvals
Attendance alerts
Finance snapshot
Transport alerts
Emergency notice action
Staff leave requests
```

---

## 14. Module-Wise Mobile Scope

### M0 — App Foundation

```text
Splash screen
Login shell
App theme
Environment config
Dio API client
Secure storage
Auth session manager
Role-based router
Global error handling
Offline banner
Push notification foundation
Profile/settings placeholder
Reusable UI components
```

### M1 — Students / Child Profile

```text
Parent child switcher
Child profile
Student QR identity
Guardian contact summary when permission allows
Teacher class student list
Student quick profile
Health/allergy warning only when permission allows
```

Do not build advanced duplicate merge or iEMIS export in mobile. Keep those in web.

### M2 — Smart Attendance

```text
Parent/student attendance summary
Monthly attendance calendar
Teacher assigned class attendance marking
Bulk present
Offline attendance draft
Attendance correction request/status later
Admin daily attendance alert summary
```

### M3 — Fees and Receipts

```text
Parent fee dues
Invoice list/detail
Receipt list/detail
Download/share receipt
Due alerts
Principal/admin finance snapshot
```

Do not make the first mobile version a full cashier/accounting app.

### M4 — Exams / CAS / Report Cards

```text
Exam schedule
Published marks
Report-card list/detail
Download/share report-card PDF
Teacher performance overview later
```

Full exam setup remains web/dashboard.

### M5 — Activity Feed and Milestones

```text
Parent activity feed
Milestones
Teacher create post
Image upload with compression
Signed preview/download
Child-specific visibility
Moderation state if configured
```

### M6 — Homework and Timetable

```text
Homework list/detail
Teacher homework creation
Attachment upload
Submission status
Weekly timetable
Today timetable card
Substitution alerts
```

Timetable generation remains web/backend.

### M7 — HR and Payroll

```text
Staff profile
Leave request/history
Leave approval
Payslip list/detail
Sensitive field masking
Staff self-service dashboard
```

### M8A — Library

```text
Borrowed books
Due dates
Fine warning
Book search
Book detail
Scanner workflows later for librarian
```

### M8B — Transport

```text
Parent live bus/latest GPS tracking
Driver assigned route
Start/complete trip
Stop list
Mark student boarded/dropped
Driver GPS location sharing
Boarded/dropped notifications
Trip history
```

### M8C — Canteen

```text
Parent wallet balance
Meal plan
Today’s menu
Student meal QR
Canteen scanner
Serve meal
Allergy warning
Low-balance alerts
```

### M9 — Accounting and Finance

```text
Principal finance snapshot
Budget/equipment requests
Approval inbox
Cashier close status read-only
Ledger preview read-only later
```

Do not expose full chart of accounts, journal entry, fiscal close, or ledger editing in mobile.

### M10 — Notices and Communication

```text
Notice list/detail
Attachments
Read/unread tracking
Push notifications
Emergency alerts
Teacher create class notice
Parent-class teacher chat later with quiet hours and moderation
```

### M11 — Intelligence / Analytics

```text
Do not implement AI/ML runtime in mobile until reliable production data exists and M11 is approved.
Mobile may later show reviewed, explainable, permission-gated insights only.
```

---

## 15. Loading, Empty, Error, and Offline States

Every API screen must handle:

```text
Loading
Success
Empty
Error
Offline
Unauthorized
Forbidden
Server error
Timeout
```

Use skeleton loaders for content areas. Avoid center spinners except for full-screen startup.

Human-friendly messages:

```text
Could not load attendance. Please try again.
You do not have permission to view this page.
You are offline. Showing last saved data.
Session expired. Please log in again.
No homework due today.
No notices yet.
No fees due right now.
Your child is safely on the bus.
```

Do not show raw backend stack traces or internal exception names.

Never show a blank screen just because the network failed.

Offline is part of the product, not an edge case.

Show:

```text
Offline banner
Last updated timestamp
Cached data state
Sync status: Pending, Synced, Failed, Retry
```

High-priority offline areas:

```text
Teacher attendance drafts
Driver trip update queue
Parent child profile cache
Homework viewing
Notice viewing
Timetable viewing
```

Do not queue financial/payment actions unless backend idempotency is explicitly ready.

---

## 16. Security and Privacy Rules

SchoolOS handles student, parent, staff, finance, payroll, transport, and chat data. Treat all of it carefully.

Required:

```text
Secure token storage
Refresh token handling
Auto logout on invalid refresh
Permission-based screens
Tenant isolation
No sensitive logs
Masked sensitive fields
Safe error messages
Session timeout support later
Optional biometric unlock later
```

Sensitive fields:

```text
Student medical info
Guardian phone
Staff salary
Payslip
Financial reports
Transport live location
Chat messages
Student documents
Auth tokens
```

Do not expose sensitive fields unless permission allows it.

Do not create mock sensitive data that looks real.

---

## 17. Accessibility and Usability

Rules:

```text
Touch target minimum 44px.
Icon buttons must have semantic labels.
Text contrast must be readable in sunlight.
Support dynamic text scaling where practical.
Avoid putting important text inside images.
Use readable date/time formats.
Do not rely only on color for status.
```

---

## 18. Sprint Plan and Build Priority

Build the app in this order:

```text
1. App foundation
2. Auth + role routing
3. Parent dashboard
4. Student profile
5. Attendance
6. Notices
7. Homework
8. Fees
9. Report cards
10. Transport
11. Canteen
12. HR/payroll
13. Approvals
14. Parent-teacher chat
15. Polish/release
```

### Sprint 0 — Flutter Foundation

```text
Clean folder structure
Theme setup
Environment config
Dio API client
Error mapper
Secure storage service
GoRouter setup
Splash screen
Login shell
Role dashboard placeholders
Reusable UI components
```

### Sprint 1 — Auth + Role-Based Routing

```text
Auth models
AuthRepository
AuthController/AuthProvider
Token persistence
Refresh token flow
Bearer token interceptor
Role-based redirect
Logout
Profile screen
```

### Sprint 2 — Parent App Foundation

```text
Parent dashboard
Child switcher
Selected child persistence
Child profile
Attendance summary card
Homework card
Fee due card
Notice card
Transport/canteen placeholder cards
```

### Sprint 3 — Attendance

```text
Parent attendance summary
Attendance calendar
Teacher class list
Teacher mark attendance screen
Bulk present
Offline attendance draft
Submit attendance
```

### Sprint 4 — Notices + Notification Center

```text
Notice list
Notice detail
Attachment preview
Read/unread tracking
Notification center
Push notification setup
Teacher create class notice
```

### Sprint 5 — Homework + Timetable

```text
Homework list/detail
Teacher create homework
Attachment upload
Weekly timetable
Today timetable card
Substitution alert
```

### Sprint 6 — Fees + Receipts

```text
Fee dashboard
Invoice list/detail
Receipt list/detail
Receipt PDF download/share
Due alert
Admin finance summary card
```

### Sprint 7 — Exams + Report Cards

```text
Exam schedule
Report card list/detail
Subject marks
Grade summary
PDF download/share
```

### Sprint 8 — Activity Feed + Milestones

```text
Activity feed/detail
Milestone list
Teacher create post
Image upload/compression
Audience selection
Parent read view
```

### Sprint 9 — Transport

```text
Driver trip home
Start trip
Stop list
Mark boarded/dropped
GPS permission
Location sharing service
Parent live/latest bus tracking
Trip history
```

### Sprint 10 — Canteen

```text
Parent canteen wallet
Meal plan view
Today’s menu
Student meal QR
Canteen scanner
Serve meal
Allergy warning
```

### Sprint 11 — HR, Payroll + Approvals

```text
Staff profile
Leave request/history
Leave approval
Payslip list/detail
Sensitive field masking
Budget/equipment requests
Principal approval inbox
```

### Sprint 12 — Parent-Teacher Chat

```text
Conversation list
Chat detail
Message send
Attachment controls
Quiet hours banner
Read receipts
Report/block placeholder
```

### Sprint 13 — Polish + Release Preparation

```text
Empty states
Error states
Offline states
Loading skeletons
App icon
Splash branding
Android build flavor
iOS config
Crash logging
Analytics events
Accessibility pass
Performance pass
QA checklist
```

First useful demo scope:

```text
Splash
Login
Role redirect
Parent dashboard
Child profile
Attendance summary
Notice list
Homework list
Fees overview
Teacher attendance marking
Profile
Settings
Logout
```

---

## 19. Sprint Implementation Rules

For every sprint/task:

1. Read this file first.
2. Inspect the current repo before editing.
3. Implement only the requested sprint scope.
4. Preserve the existing architecture.
5. Do not rewrite unrelated files.
6. Prefer small, focused files over large files.
7. Use existing shared widgets and theme.
8. Add models where needed.
9. Add repository/API client where needed.
10. Add provider/controller where needed.
11. Add screens.
12. Add reusable widgets.
13. Add loading/error/empty/offline states.
14. Add modern, polished, consistent UI.
15. Add smooth but lightweight animations where useful.
16. Add or update tests where practical.
17. Run validation locally.

Validation commands:

```bash
flutter pub get
dart format .
flutter analyze
flutter test
```

For release/build verification:

```bash
flutter build apk --debug
flutter build ios --no-codesign
```

Do not claim tests or builds passed unless they were actually run.

---

## 20. Design Quality Checklist

Before finishing any screen, check:

```text
[ ] One clear primary purpose
[ ] One clear primary action
[ ] Proper loading state
[ ] Helpful empty state
[ ] Human-friendly error state
[ ] Offline state where relevant
[ ] Last updated timestamp where data can be stale
[ ] Permission-blocked state if role lacks access
[ ] No sensitive data leaked
[ ] No raw backend errors
[ ] Uses shared components
[ ] Uses theme tokens
[ ] No hardcoded random colors
[ ] No giant widget file
[ ] No business logic inside widgets
[ ] Works on small Android screen
[ ] Works with large text reasonably
[ ] Would impress a school during a product demo
```

---

## 21. Code Quality Checklist

Before returning work, check:

```text
No unrelated rewrites
No hard-coded credentials
No token logs
No giant widgets
No duplicate UI code
No business logic inside UI widgets
No role-specific hacks
No broken imports
No unused files
flutter analyze passes
App still builds
UI remains consistent with the modern SchoolOS design system
```

---

## 22. Testing Rules

Minimum expectation:

```text
Keep widget smoke tests passing.
Add widget tests for important new screens when practical.
Add unit tests for repositories/controllers once real API/auth logic is added.
Do not remove failing tests without fixing or explaining the root cause.
```

Prioritize tests for:

```text
Auth state
Repository/API error handling
Router redirects
Providers/controllers
Important widgets
Permission and ownership state
Offline/error states
```

---

## 23. Non-Goals for Mobile

Do not prioritize these in mobile unless explicitly requested:

```text
Full accounting ledger management
Full tenant/platform setup
Full timetable generation engine
Full payroll configuration
Full fee structure setup
Deep analytics dashboards
Large admin tables better suited to web
Direct admin-shaped API reuse for parent/student/driver
AI/ML runtime
```

Mobile should expose summaries, approvals, quick actions, and role-specific daily workflows.

---

## 24. Future Codex Prompt Template

```text
Read apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md and follow it.

Task:
Implement Sprint [number]: [name].

Scope:
- [specific requirement]
- [specific requirement]

Constraints:
- Do not rewrite unrelated files.
- Use existing app architecture, theme, router, API client, and shared widgets.
- Add loading, empty, error, and offline states.
- Make UI modern, stylish, smooth, and consistent with the SchoolOS design system.
- Add/update tests where practical.
- Run flutter pub get, dart format ., flutter analyze, and flutter test.

Return:
- Summary
- Files changed
- Commands run
- Validation result
- UI/UX improvements made
- Remaining TODOs
```

Build the product like a real premium mobile app, not a prototype. Prioritize parent trust, teacher speed, driver reliability, secure school data handling, smooth animations, modern visual design, and clean professional mobile UI.
