# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

It is designed as a modular school operating system covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, and future intelligence/analytics.

---

## Source of Truth

The consolidated project memory is:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Active companion files:

```text
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
docs/project/SCHOOLOS_STORAGE_AND_FILE_REGISTRY.md
docs/project/SCHOOLOS_TRANSPORT_REALTIME_READINESS.md
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/product/SCHOOLOS_PRD.md
```

Historical/duplicate docs should not be recreated unless the project grows enough to justify splitting them again.

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
M4 Academics backend/admin UI: Completed / Pilot-Ready
M6 Homework/Timetable: Completed / Pilot-Ready
M7 HR/Payroll: Completed / Pilot-Ready
M8A Library, M8B Transport, M8C Canteen: Admin/backend foundations implemented with hardening depth
M9 Accounting: Completed / Pilot-Ready
M10 Notices/Communication/Chat: Foundation plus provider/attachment/retry depth implemented
M11 Intelligence/AI: Roadmap only
```

Current product readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Recommended next direction:

```text
Strict Phase Gate 0 from docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
→ stabilize verification, migrations, seed data, smoke tests, and stale docs
→ harden controlled pilot reliability across M0 and Phase 1 core
→ polish Academics and Accounting
→ deepen Homework/Timetable, HR/Payroll, Library, Transport, and Canteen one vertical at a time
```

Do not start broad new product fronts until the full verification gate is clean.

Explicitly deferred unless requested:

```text
Angular migration
AI/ML implementation
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket UI
Microservices
```

---

## Stack

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Mobile app: Flutter companion app in apps/schoolos_mobile
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep the modular monolith first.
- Do not migrate to Angular yet.
- Do not introduce microservices unless scale, team ownership, deployment isolation, or compliance isolation clearly justify the cost.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Use code-file modularization for large source files, not microservices.

---

## Workspace Layout

```text
apps/
  api/              NestJS backend
  web/              Current Next.js dashboard and later public website
  schoolos_mobile/  Flutter parent/teacher/student/admin mobile app
  admin/            Future Angular internal dashboard, not now
packages/
  core/             Shared validation, types, contracts, permissions
docs/
  project/          Master memory, plans, and roadmaps
```

For now, keep the Flutter mobile app as a standalone app under `apps/`.
Do not add it to `pnpm` workspaces; run it with Flutter commands.

## Running Locally

Run backend and web from the SchoolOS root:

```bash
pnpm dev
```

Run the mobile app from its Flutter app directory:

```bash
cd apps/schoolos_mobile
flutter pub get
flutter run
```

The local backend API is usually available at:

```text
http://localhost:4000/api/v1
```

For iOS Simulator, the default mobile API base URL can use localhost:

```bash
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://localhost:4000/api/v1
```

For Android Emulator, point the app to the host machine through `10.0.2.2`:

```bash
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://10.0.2.2:4000/api/v1
```

For a real phone on the same Wi-Fi network, get the Mac's local IP and use it:

```bash
ipconfig getifaddr en0
flutter run --dart-define=SCHOOL_OS_API_BASE_URL=http://<mac-local-ip>:4000/api/v1
```
