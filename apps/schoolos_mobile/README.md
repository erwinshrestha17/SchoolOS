# SchoolOS Mobile App

SchoolOS Mobile is a premium, modern, fintech-style educational companion mobile application for the SchoolOS platform, designed for school communities in Nepal and similar markets.

Built with **Flutter**, the app provides context-aware, role-based dashboards tailored for Parents, Students, Teachers, Drivers, Staff, and Administrators in one unified code base.

---

## 🚀 Key Sprints & Implementation Status

### Sprint 1: Authentication & Role Routing (Completed)
- **Role-Based Routing Guards**: Prevents unauthenticated users from seeing dashboard screens, blocks authenticated users from public pages, and protects screens from unauthorized role access.
- **Dio Token Refresh Interceptor**: Captures `401 Unauthorized` errors, locks subsequent queries, fetches new token pairs using refresh tokens, and retries the failed requests once.
- **Offline Resilient Session Recovery**: Startup checks verify current profiles via `/auth/me` and fallback automatically to locally cached profile metadata if offline or server is unreachable.
- **Secure Token Storage**: Persists JWT access and refresh credentials securely inside Keychains (iOS) and Keystores (Android).

### Sprint 0: App Foundation & Reusable UI (Completed)
- **Harmonious Theme & Design System**: Material 3 theme incorporating primary indigo, slate scales, role colors, spacing rules, custom border radius (20-28px cards), and soft shadows.
- **Reusable Component Library**: AppButton, AppCard, AppGradientCard, AppTextField, AppScaffold, OfflineBanner, UserAvatar, RoleBadge, and StatusChip.
- **Network Client & Exception Mapping**: Centralized `ApiClient` built on Dio mapping HTTP status errors (400, 401, 403, 422, 500) to unified exceptions with offlineBanner listeners.

---

## 🛠️ Architecture & Folder Structure

We follow a clean, scalable **Feature-First** architecture:

```txt
lib/
  app/           # Router, GoRouter rules, custom themes, design system, localizations
  core/          # Global APIs, ApiClient, network controllers, secure storage, custom exceptions
  features/      # Domain-specific screens (auth, dashboard, notifications, profile, settings, splash)
  shared/        # Reusable UI widgets and cross-cutting model definitions
```

---

## 🧪 Testing & Code Quality

### Static Code Analysis
Ensure all files adhere to the strict Lint guidelines with zero warnings:
```bash
flutter analyze
```

### Automated Tests
Run all unit and widget tests (covers AuthRepository, TokenRefreshInterceptor, Splash Navigation, and Reusable Widgets):
```bash
flutter test
```

### Running Locally
To launch the developer build and run on iOS/Android devices:
```bash
flutter run
```

The app reads its backend URL from `SCHOOL_OS_API_BASE_URL`.
If no value is provided, local development defaults are:

```txt
iOS Simulator:     http://localhost:4000/api/v1
Android Emulator: http://10.0.2.2:4000/api/v1
```

For a real phone on the same Wi-Fi network, pass your Mac's local IP:

```bash
ipconfig getifaddr en0
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://<mac-local-ip>:4000/api/v1
```
