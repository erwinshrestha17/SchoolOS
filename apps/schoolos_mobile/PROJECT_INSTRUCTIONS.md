# SchoolOS Mobile Project Instructions

These are the stable project rules for the **SchoolOS Flutter Mobile App**. Future Codex prompts should start with:

> Read `PROJECT_INSTRUCTIONS.md` and follow it. Task: [specific sprint/task]. Do not rewrite unrelated files. Run validation and return changed files plus summary only.

## 1. Professional Role

You are working on the SchoolOS Flutter Mobile App as a **Senior Flutter App Developer, Mobile App Architect, UI/UX Designer, Product Designer, Design Systems Engineer, and Production Engineer**.

Think like a professional app team building a real production school management mobile app for Nepal and similar markets.

The app must feel:

```txt
Modern
Futuristic
Stylish
Smooth
Fast
Premium
Trustworthy
Clean
Professional
Easy for non-technical parents
Powerful for teachers and school staff
```

Core design vision:

```txt
SchoolOS Mobile should feel like a premium fintech + education app:
clean cards, beautiful spacing, smooth transitions, elegant role dashboards,
polished icons, soft shadows, subtle gradients, calm colors,
and fast mobile-first workflows.
```

## 2. Product Direction

SchoolOS Mobile is a **Flutter companion app** for the main SchoolOS platform.

The main SchoolOS platform uses:

```txt
NestJS backend
PostgreSQL
Prisma
Redis/BullMQ
Next.js web dashboard
```

The mobile app must not replace the full web/admin dashboard.

Core product rule:

```txt
Mobile App = Daily Operations + Parent Engagement + Staff Self-Service
Web Dashboard = Setup + Admin Configuration + Deep Reports + Accounting
```

Do not overbuild mobile admin features. Heavy setup should remain mainly in the web dashboard, including:

```txt
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

The mobile app should focus on:

```txt
Daily school operations
Parent engagement
Student self-service
Teacher classroom actions
Driver transport workflow
Staff self-service
Principal/admin approvals and alerts
```

The product should be beautiful enough to impress schools during demos while remaining practical for daily use.

## 3. Target Roles

Use one Flutter app with multiple role-based experiences.

Supported roles:

```txt
PARENT
STUDENT
TEACHER
DRIVER
STAFF
ADMIN
PRINCIPAL
```

### Parent / Guardian

The parent/guardian is the most important mobile user.

Features:

```txt
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

### Student

Features:

```txt
Homework
Timetable
Attendance
Notices
Exam schedule
Report cards
Library
Canteen balance
Activity feed
```

### Teacher

Features:

```txt
Today’s classes
Mark attendance
Create homework
View timetable
Handle substitutions
Send notices
View student profiles
Parent messages during allowed hours
Leave request
```

### Driver

Features:

```txt
Assigned route
Start trip
Stop list
Mark student boarded/dropped
Share live GPS
Complete trip
Emergency contact
Trip history
```

### Staff / HR User

Features:

```txt
Staff profile
Attendance/check-in
Leave request
Leave history
Payslip list/detail
Notices
Approval requests
```

### Principal / Admin

Mobile should be approval and monitoring focused.

Features:

```txt
Daily overview
Pending approvals
Attendance alerts
Fee collection snapshot
Transport alerts
Staff leave approvals
Budget/equipment approvals
Emergency notices
```

## 4. Architecture Rules

Use a clean, scalable Flutter architecture. Prefer a feature-first structure.

Use this folder structure:

```txt
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

Rules:

```txt
Keep feature code inside lib/features/<feature_name>.
Keep cross-cutting app infrastructure inside lib/core.
Keep reusable UI components inside lib/shared/widgets.
Keep app shell, router, route constants, theme, and design system inside lib/app.
Do not dump everything into generic screens/widgets folders.
Do not create large single files for full modules.
Do not move unrelated files during a sprint.
Do not implement multiple future modules when the sprint only asks for one.
```

Each feature should clearly separate:

```txt
data
domain
presentation
providers/controllers
widgets
models
repositories
```

## 5. Preferred Flutter Stack

Use these choices consistently unless the existing project already uses a better established alternative.

```txt
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
```

Avoid adding new major packages unless the sprint explicitly needs them and the reason is documented.

## 6. Modern Design System Requirements

Create and maintain a strong SchoolOS mobile design system from the beginning.

Design system must include:

```txt
Color tokens
Typography scale
Spacing scale
Border radius scale
Shadow/elevation tokens
Motion/animation duration tokens
Status colors
Semantic colors
Reusable cards
Reusable buttons
Reusable text fields
Reusable chips
Reusable dashboard tiles
Reusable list rows
Reusable empty/error/loading states
```

Use Material 3, but make it feel custom and premium.

Visual direction:

```txt
Premium light theme first
Dark theme support
Soft gradients for hero cards
Subtle glassmorphism only where it adds value
Rounded 20–28px cards for important surfaces
Clean white/near-white backgrounds in light mode
Deep navy/charcoal surfaces in dark mode
Modern accent colors: blue, indigo, cyan, emerald, violet, or teal
Smooth shadows, not harsh shadows
Consistent icon style
Elegant status chips
Friendly microcopy for parents and students
```

Status chips should be clear for:

```txt
Present
Absent
Late
Paid
Due
On Route
Pending
Approved
Rejected
Draft
Published
Completed
```

Avoid:

```txt
Too many colors
Dense admin tables on mobile
Old-looking form-heavy screens
Overloaded dashboards
Tiny text
Hidden important actions
Complicated navigation
Business logic inside widgets
Harsh borders everywhere
Boring plain list-only screens
```

## 7. Motion and Smoothness Requirements

The app should feel smooth, modern, and premium without being heavy.

Use:

```txt
Subtle page transitions
Animated cards where useful
Animated loading skeletons
Smooth bottom navigation transitions
Tactile button feedback
Animated status changes for attendance, trips, approvals, and payments
Pull-to-refresh on list screens
Bottom sheets for quick actions
```

Avoid slow, heavy, distracting animations. Animations should be fast, useful, and low-end Android friendly.

Performance rules:

```txt
Screens should open quickly.
Avoid unnecessary rebuilds.
Use Riverpod providers carefully.
Cache common data.
Paginate large lists.
Lazy load images.
Avoid giant widget trees.
Avoid expensive animations on low-end devices.
Avoid business logic inside widgets.
```

## 8. API Integration Rules

The app consumes the existing SchoolOS backend.

Default local API:

```txt
http://localhost:4000/api/v1
```

Use `SCHOOL_OS_API_BASE_URL` through Dart defines for environment-specific base URLs.

Expected auth endpoints:

```txt
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/me
```

API layer must include:

```txt
Dio client
Base URL config
Request/response interceptors
Auth token interceptor
Refresh token handling
Error mapper
Timeout handling
Offline/network error detection
```

Rules:

```txt
Use ApiClient for network calls.
Do not instantiate raw Dio inside feature screens.
Keep API calls in repositories/services, not widgets.
Map API errors into app-friendly exceptions or state.
Do not log access tokens, refresh tokens, passwords, or sensitive student/staff data.
Do not hard-code production credentials or tenant IDs.
Every repository should be testable and isolated from UI.
```

Never log:

```txt
Access tokens
Refresh tokens
Passwords
Student health data
Guardian phone numbers
Payslip data
Transport live location
Chat messages
Student documents
```

## 9. Authentication and Authorization Rules

Auth state must support:

```txt
Unauthenticated
Loading
Authenticated
TokenExpired
NeedsRefresh
LoggedOut
Error
```

Use secure storage for:

```txt
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

## 10. Routing Rules

Use `go_router`.

Public routes:

```txt
/splash
/onboarding
/login
/forgot-password
```

Common authenticated routes:

```txt
/home
/profile
/notifications
/settings
```

Role roots:

```txt
/parent/home
/student/home
/teacher/home
/driver/home
/staff/home
/admin/home
```

Router rules:

```txt
Protect authenticated routes.
Redirect unauthenticated users to login.
Redirect logged-in users to the correct role dashboard.
Handle unknown routes.
Prepare for deep links later.
Sprint 0 can use placeholders.
Sprint 1 must replace placeholder routing with authenticated role-based redirects.
Future modules should register routes cleanly in app/router.dart or feature route helpers if routing grows.
```

## 11. Role-Based Navigation Rules

Use clean role-based bottom navigation.

```txt
Parent: Home | Child | Fees | Notices | More
Teacher: Home | Classes | Attendance | Homework | More
Student: Home | Homework | Timetable | Notices | More
Driver: Trip | Route | Students | History | More
Staff: Home | Leave | Payslip | Notices | More
Admin/Principal: Home | Approvals | Alerts | Notices | More
```

Each screen must have one clear purpose. Do not put every module into bottom navigation. Put secondary modules inside `More`.

Dashboard design rules:

```txt
Parent dashboard: warm, simple, child-focused.
Teacher dashboard: fast, operational, action-focused.
Driver dashboard: clear, safe, route-focused.
Staff dashboard: self-service focused.
Admin dashboard: executive, approval-focused, alert-focused.
```

Parent home should include modern cards for:

```txt
Selected child
Attendance today
Homework pending
Fees due
Bus status
Latest notice
Canteen balance
Chat availability
```

Teacher home should include modern cards for:

```txt
Today’s timetable
Attendance pending
Homework actions
Substitution duties
Parent messages
Class notices
```

Driver home should include modern cards for:

```txt
Assigned route
Trip status
Student count
Start trip button
Emergency contact
GPS status
```

Admin home should include modern cards for:

```txt
Daily attendance
Fee collection
Pending approvals
Transport alerts
Emergency notices
Staff leave requests
```

## 12. Reusable Components

Create reusable components instead of duplicating UI.

Core components:

```txt
AppButton
AppIconButton
AppTextField
AppSearchField
AppCard
AppGradientCard
AppGlassCard
AppScaffold
AppLoading
AppSkeleton
AppErrorView
AppEmptyState
OfflineBanner
StatusChip
SectionHeader
DashboardCard
QuickActionCard
UserAvatar
RoleBadge
AmountText
DateStatusLabel
AppBottomSheet
AppListTile
AppTimelineTile
```

Components should support where relevant:

```txt
Loading state
Disabled state
Error state
Accessibility-friendly labels
Consistent padding
Consistent radius
Consistent motion
```

## 13. Screen State and Error Handling

Every API screen must handle:

```txt
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

Use human-friendly messages:

```txt
Could not load attendance. Please try again.
You do not have permission to view this page.
You are offline. Showing last saved data.
Session expired. Please log in again.
No homework assigned today.
No fees due right now.
Your child is safely on the bus.
```

Do not show raw backend stack traces.

Never show a blank screen just because the network failed.

## 14. Security and Privacy Rules

SchoolOS handles student, parent, staff, finance, payroll, transport, and chat data. Treat all of it carefully.

Required:

```txt
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

```txt
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

## 15. Offline and Poor Network Rules

The app must be practical for Nepal-like network conditions.

Support:

```txt
Cached profile data
Cached homework
Cached notices
Cached timetable
Retry failed requests
Offline banner
Last updated timestamp
Teacher attendance draft save
Driver GPS retry queue
Graceful timeout handling
```

High-priority offline areas:

```txt
Teacher attendance
Driver trip updates
Parent child profile
Homework viewing
Notice viewing
Timetable viewing
```

Do not silently fail network actions.

## 16. Build Priority

Build the app in this order:

```txt
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

The first useful demo should include:

```txt
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

## 17. Sprint Implementation Rules

For every sprint/task:

1. Read this file first.
2. Inspect the current repo before editing.
3. Implement only the requested sprint scope.
4. Preserve the existing architecture.
5. Do not rewrite unrelated files.
6. Prefer small, focused files over large files.
7. Use existing shared widgets and theme.
8. Add models.
9. Add repository/API client.
10. Add provider/controller.
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
flutter analyze
flutter test
```

Return:

```txt
Summary
Files changed
Commands run
Validation result
Remaining TODOs
UI/UX improvements made
Risks or notes
```

Do not claim tests passed unless they were actually run.

## 18. Design Quality Checklist

Before finishing any screen, check:

```txt
Is the purpose of the screen clear?
Does it look modern and premium?
Does it feel smooth?
Can a parent understand it without training?
Can a teacher complete the action quickly?
Are important statuses visible?
Are loading, error, empty, and offline states handled?
Is sensitive data protected?
Does the screen look consistent with the rest of the app?
Would this impress a school during a product demo?
```

## 19. Code Quality Checklist

Before returning work, check:

```txt
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

## 20. Testing Rules

Minimum expectation:

```txt
Keep widget smoke tests passing.
Add widget tests for new important screens when practical.
Add unit tests for repositories/controllers once real API/auth logic is added.
Do not remove failing tests without fixing or explaining the root cause.
```

Prioritize tests for:

```txt
Auth state
Repository/API error handling
Router redirects
Providers/controllers
Important widgets
```

## 21. Sprint 0 Goal

Implement production-ready Flutter foundation:

```txt
Clean folder structure
App theme
Modern design system
Color tokens
Typography tokens
Spacing tokens
Motion tokens
Environment config
Dio API client
Secure storage
Error mapper
GoRouter setup
Public routes
Protected route placeholder
Reusable UI components
Splash screen
Login shell
Placeholder role dashboards
Settings/profile placeholder
Offline banner placeholder
```

Do not implement full business modules yet.

## 22. Sprint 1 Goal

Implement auth and role-based routing:

```txt
Login request/response models
AuthUser model
Tenant context model
Token pair model
AuthRepository
AuthController/AuthProvider
Secure token persistence
Dio bearer token interceptor
Refresh token flow
Modern login screen
Smooth splash-to-login transition
Logout action
Role-based redirect
Placeholder dashboards for parent/student/teacher/driver/staff/admin
```

Do not implement all module details yet.

## 23. Sprint 2 Goal

Implement parent app foundation:

```txt
Modern parent dashboard
Child switcher
Selected child persistence
Child profile screen
Attendance summary card
Homework summary card
Fee due card
Notice card
Transport placeholder card
Canteen placeholder card
Parent repository placeholders
Loading/error/empty/offline states
Smooth dashboard card layout
```

The parent experience should feel polished because parents are the most important mobile users.

## 24. Branch and PR Rules

Use sprint-based branches:

```txt
feat/sprint-0-app-foundation
feat/sprint-1-auth-role-routing
feat/sprint-2-parent-foundation
feat/sprint-3-attendance
```

PR descriptions should include:

```txt
Summary
What changed
Validation commands
Known limitations/TODOs
UI/UX improvements
```

## 25. Non-Goals for Mobile

Do not prioritize these in mobile unless explicitly requested:

```txt
Full accounting ledger management
Full tenant/platform setup
Full timetable generation engine
Full payroll configuration
Full fee structure setup
Deep analytics dashboards
Large admin tables better suited to web
```

Mobile should expose summaries, approvals, quick actions, and role-specific daily workflows.

## 26. Future Codex Prompt Template

Use this pattern:

```txt
Read PROJECT_INSTRUCTIONS.md and follow it.

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
- Run flutter pub get, flutter analyze, and flutter test.

Return:
- Summary
- Files changed
- Commands run
- Validation result
- UI/UX improvements made
- Remaining TODOs
```

Build the product like a real premium mobile app, not a prototype. Prioritize parent trust, teacher speed, driver reliability, secure school data handling, smooth animations, modern visual design, and clean professional mobile UI.
