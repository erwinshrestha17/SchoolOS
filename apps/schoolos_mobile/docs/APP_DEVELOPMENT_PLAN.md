# SchoolOS Mobile App Development Plan

SchoolOS Mobile is a Flutter companion app for the main SchoolOS platform. It must not copy the whole web dashboard into mobile. The mobile product should focus on daily school operations, parent engagement, student self-service, teacher classroom actions, driver transport workflows, staff self-service, and principal/admin approvals.

## 1. Product Rule

**Mobile App = Daily Operations + Parent Engagement + Staff Self-Service**

**Web Dashboard = Setup + Admin Configuration + Deep Reports + Accounting**

Heavy configuration should remain in the web dashboard: tenant setup, fee structure setup, accounting setup, payroll setup, timetable generation setup, exam configuration, platform billing, and deep reporting.

## 2. Target Roles

### Parent / Guardian

Primary app user. The app should feel child-first, calm, and trustworthy.

Core features:
- Child switcher
- Child profile
- Attendance summary
- Homework
- Timetable
- Fees and receipts
- Report cards
- Notices
- Transport tracking
- Canteen wallet
- Activity feed and milestones
- Parent-class teacher chat

### Student

Learning-focused app experience.

Core features:
- Homework
- Timetable
- Attendance
- Notices
- Exam schedule
- Report cards
- Library borrowings
- Canteen balance
- Activity feed

### Teacher

Action-first experience for repeated daily classroom tasks.

Core features:
- Today’s classes
- Mark attendance
- Create homework
- View timetable
- Handle substitutions
- Send notices
- View student profiles
- Parent messages during configured chat hours
- Leave request

### Driver

Trip-first and safety-first experience.

Core features:
- Assigned route
- Start trip
- Stop list
- Mark student boarded/dropped
- Share live GPS
- Complete trip
- Emergency contact
- Trip history

### Staff / HR User

Secure self-service experience.

Core features:
- Staff profile
- Attendance/check-in
- Leave request
- Leave history
- Payslip list/detail
- Notices
- Approval requests

### Principal / Admin

Monitoring and approvals, not full admin setup.

Core features:
- Daily overview
- Pending approvals
- Attendance alerts
- Fee collection snapshot
- Transport alerts
- Staff leave approvals
- Budget/equipment approvals
- Emergency notices

## 3. Flutter Architecture

Use a feature-first clean architecture.

```txt
lib/
  app/
    app.dart
    router.dart
    theme/
    localization/
    constants/

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

  shared/
    models/
    widgets/
    services/
    theme/
```

Each feature should follow this internal structure when it becomes large enough:

```txt
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

## 4. Recommended Flutter Stack

Core packages:

```yaml
dependencies:
  flutter_riverpod:
  go_router:
  dio:
  flutter_secure_storage:
  shared_preferences:
  freezed_annotation:
  json_annotation:
  intl:
  cached_network_image:
  image_picker:
  file_picker:
  permission_handler:
  mobile_scanner:
  qr_flutter:
  firebase_messaging:
  flutter_local_notifications:
  geolocator:
  web_socket_channel:
  connectivity_plus:
  path_provider:
```

Dev packages:

```yaml
dev_dependencies:
  build_runner:
  freezed:
  json_serializable:
  flutter_lints:
  mocktail:
```

## 5. API Integration Plan

The app consumes the SchoolOS backend.

Local development base URL:

```txt
iOS Simulator:     http://localhost:4000/api/v1
Android Emulator: http://10.0.2.2:4000/api/v1
Real phone:        http://<mac-local-ip>:4000/api/v1
```

Expected auth endpoints:

```txt
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

The API layer must include:
- Configurable base URL
- Dio client
- Request and response interceptors
- Bearer token interceptor
- Tenant context header when required
- Refresh token handling
- Timeout handling
- Offline/network error detection
- Human-friendly error mapper
- Safe logging with sensitive values removed

Never log:
- Access token
- Refresh token
- Password
- Student health data
- Guardian phone
- Staff salary
- Payslip data
- Transport live location
- Chat messages
- Student documents

## 6. Navigation Plan

Public routes:

```txt
/splash
/onboarding
/login
/forgot-password
```

Shared authenticated routes:

```txt
/home
/profile
/notifications
/settings
```

Role root routes:

```txt
/parent/home
/student/home
/teacher/home
/driver/home
/staff/home
/admin/home
```

Router rules:
- Protect authenticated routes
- Redirect unauthenticated users to login
- Redirect logged-in users to the correct role dashboard
- Handle unknown routes
- Prepare for deep links later
- Prefer permission-aware UI over hard-coded role-only UI when permission data exists

## 7. Role-Based Bottom Navigation

Parent:

```txt
Home | Child | Fees | Notices | More
```

Teacher:

```txt
Home | Classes | Attendance | Homework | More
```

Student:

```txt
Home | Homework | Timetable | Notices | More
```

Driver:

```txt
Trip | Route | Students | History | More
```

Staff:

```txt
Home | Leave | Payslip | Notices | More
```

Admin/Principal:

```txt
Home | Approvals | Alerts | Notices | More
```

Do not put every module in bottom navigation. Secondary modules belong in More.

## 8. Module-Wise Mobile Scope

### M0 — App Foundation

Mobile scope:
- Splash screen
- Login shell
- App theme
- Environment config
- Dio API client
- Secure storage
- Auth session manager
- Role-based router
- Global error handling
- Offline banner
- Push notification foundation
- Profile/settings placeholder
- Reusable UI components

### M1 — Students / Child Profile

Mobile scope:
- Parent child switcher
- Child profile
- Student QR identity
- Guardian contact summary when permission allows
- Teacher class student list
- Student quick profile
- Health/allergy warning only when permission allows

Do not build advanced duplicate merge or iEMIS export in mobile. Keep those in web.

### M2 — Smart Attendance

Mobile scope:
- Parent/student attendance summary
- Monthly attendance calendar
- Teacher assigned class attendance marking
- Bulk present
- Offline attendance draft
- Attendance correction request/status later
- Admin daily attendance alert summary

### M3 — Fees and Receipts

Mobile scope:
- Parent fee dues
- Invoice list/detail
- Receipt list/detail
- Download/share receipt
- Due alerts
- Principal/admin finance snapshot

Do not make the first mobile version a full cashier/accounting app.

### M4 — Exams / CAS / Report Cards

Mobile scope:
- Exam schedule
- Published marks
- Report card list/detail
- Download/share report card PDF
- Teacher performance overview later

Full exam setup remains web/dashboard.

### M5 — Activity Feed and Milestones

Mobile scope:
- Parent activity feed
- Milestones
- Teacher create post
- Image upload with compression
- Signed preview/download
- Child-specific visibility
- Moderation state if configured

### M6 — Homework and Timetable

Mobile scope:
- Homework list/detail
- Teacher homework creation
- Attachment upload
- Submission status
- Weekly timetable
- Today timetable card
- Substitution alerts

Timetable generation remains web/backend.

### M7 — HR and Payroll

Mobile scope:
- Staff profile
- Leave request/history
- Leave approval
- Payslip list/detail
- Sensitive field masking
- Staff self-service dashboard

### M8A — Library

Mobile scope:
- Borrowed books
- Due dates
- Fine warning
- Book search
- Book detail
- Scanner workflows later for librarian

### M8B — Transport

Mobile scope:
- Parent live bus tracking
- Driver assigned route
- Start/complete trip
- Stop list
- Mark student boarded/dropped
- Driver GPS location sharing
- Boarded/dropped notifications
- Trip history

### M8C — Canteen

Mobile scope:
- Parent wallet balance
- Meal plan
- Today’s menu
- Student meal QR
- Canteen scanner
- Serve meal
- Allergy warning
- Low-balance alerts

### M9 — Accounting and Finance

Mobile scope:
- Principal finance snapshot
- Budget/equipment requests
- Approval inbox
- Cashier close status read-only
- Ledger preview read-only later

Do not expose full chart of accounts, journal entry, fiscal close, or ledger editing in mobile.

### M10 — Notices and Communication

Mobile scope:
- Notice list/detail
- Attachments
- Read/unread tracking
- Push notifications
- Emergency alerts
- Teacher create class notice
- Parent-class teacher chat later with quiet hours and moderation

## 9. Sprint Plan

### Sprint 0 — Flutter Foundation

Deliverables:
- Clean folder structure
- Theme setup
- Environment config
- Dio API client
- Error mapper
- Secure storage service
- GoRouter setup
- Splash screen
- Login shell
- Role dashboard placeholders
- Reusable UI components

### Sprint 1 — Auth + Role-Based Routing

Deliverables:
- Auth models
- AuthRepository
- AuthController/AuthProvider
- Token persistence
- Refresh token flow
- Bearer token interceptor
- Role-based redirect
- Logout
- Profile screen

### Sprint 2 — Parent App Foundation

Deliverables:
- Parent dashboard
- Child switcher
- Selected child persistence
- Child profile
- Attendance summary card
- Homework card
- Fee due card
- Notice card
- Transport/canteen placeholder cards

### Sprint 3 — Attendance

Deliverables:
- Parent attendance summary
- Attendance calendar
- Teacher class list
- Teacher mark attendance screen
- Bulk present
- Offline attendance draft
- Submit attendance

### Sprint 4 — Notices + Notification Center

Deliverables:
- Notice list
- Notice detail
- Attachment preview
- Read/unread tracking
- Notification center
- Push notification setup
- Teacher create class notice

### Sprint 5 — Homework + Timetable

Deliverables:
- Homework list/detail
- Teacher create homework
- Attachment upload
- Weekly timetable
- Today timetable card
- Substitution alert

### Sprint 6 — Fees + Receipts

Deliverables:
- Fee dashboard
- Invoice list/detail
- Receipt list/detail
- Receipt PDF download/share
- Due alert
- Admin finance summary card

### Sprint 7 — Exams + Report Cards

Deliverables:
- Exam schedule
- Report card list/detail
- Subject marks
- Grade summary
- PDF download/share

### Sprint 8 — Activity Feed + Milestones

Deliverables:
- Activity feed/detail
- Milestone list
- Teacher create post
- Image upload/compression
- Audience selection
- Parent read view

### Sprint 9 — Transport

Deliverables:
- Driver trip home
- Start trip
- Stop list
- Mark boarded/dropped
- GPS permission
- Location sharing service
- Parent live bus tracking
- Trip history

### Sprint 10 — Canteen

Deliverables:
- Parent canteen wallet
- Meal plan view
- Today’s menu
- Student meal QR
- Canteen scanner
- Serve meal
- Allergy warning

### Sprint 11 — HR, Payroll + Approvals

Deliverables:
- Staff profile
- Leave request/history
- Leave approval
- Payslip list/detail
- Sensitive field masking
- Budget/equipment requests
- Principal approval inbox

### Sprint 12 — Parent-Teacher Chat

Deliverables:
- Conversation list
- Chat detail
- Message send
- Attachment controls
- Quiet hours banner
- Read receipts
- Report/block placeholder

### Sprint 13 — Polish + Release Preparation

Deliverables:
- Empty states
- Error states
- Offline states
- Loading skeletons
- App icon
- Splash branding
- Android build flavor
- iOS config
- Crash logging
- Analytics events
- Accessibility pass
- Performance pass
- QA checklist

## 10. First Useful Demo Scope

Build this before trying to complete every module:

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

## 11. Verification Commands

Run in this order when code changes are made:

```bash
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

Do not claim tests or builds passed unless the commands were actually run.
