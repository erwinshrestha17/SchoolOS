# SchoolOS Web, Mobile, UI/UX, API Contract, and Persona Smoke Plan

**Status:** Active source of truth for SchoolOS web/mobile product design, UI/UX, API contract mapping, Flutter planning, and persona smoke expectations.
**Updated:** 2026-06-15
**Scope:** Planning and implementation guide only. This document does not implement backend, frontend, or mobile code.

This document consolidates the previous UI/UX guide, web/mobile master design plan, frontend-backend API contract map, Flutter app plan, and web/mobile persona smoke plan. Do not recreate those separate planning docs unless the project grows enough to justify a deliberate split.

---

## 1. Status and Scope

- This is a planning and implementation guide only.
- No backend, frontend, or mobile implementation is included in this docs task.
- Applies to `apps/web` and `apps/schoolos_mobile`.
- Backend APIs must remain real, tenant-scoped, permission-gated, and purpose-limited for parent, driver, staff self-service, and student lab/session flows.
- SchoolOS remains a NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js web dashboard, and Flutter companion app.
- Web/mobile work must preserve cookie-first browser auth, secure mobile token storage, File Registry boundaries, RBAC, audit logging, and module entitlements.

Read order before web/mobile implementation:

```text
README.md
AGENTS.md
docs/README.md
docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/project/SCHOOLOS_PROJECT_STATUS.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md
docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md
docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

---

## 2. Product Experience Direction

SchoolOS is a daily school operating desk, not a generic ERP, shortcut prototype, or decorative dashboard kit.

Core direction:

```text
One screen = one main job.
```

- Web is the command center for school operations, platform operations, finance/accounting/payroll, reports, setup, and dense tables.
- Mobile is a companion app for quick role-specific actions and summaries.
- Student MVP is lab-only or controlled school-device only. There is no broad student mobile app in MVP.
- Mobile must not become a mini web dashboard.
- Admin, finance, accounting, payroll, platform, and reporting stay web-first.
- All production UI must consume real backend APIs. No fake dashboard cards, placeholder metrics, or browser-only production state.
- School language wins over technical language: use "Save failed" instead of "Mutation failed", "Student" instead of "Entity", and "You do not have permission" instead of "403 Forbidden".

Experience families:

| Surface | Purpose | Core rule |
|---|---|---|
| Public website | Future marketing/demo pages | Separate from tenant operations; no private school data. |
| School web dashboard | Daily school workflows | Dedicated module workspaces, real APIs, role-aware navigation. |
| Platform control plane | SchoolOS operator workflows | Separate `/platform/*` surface; SaaS billing never mixes with student fees. |
| Flutter companion app | Parent, teacher, driver, staff, and controlled student lab/session workflows | Purpose-limited screens and APIs only. |

---

## 3. UI/UX Design System

### Visual Style

- Calm light app background, white cards/tables, strong readable text, clear hierarchy.
- One shared SchoolOS base palette plus small module accent colors.
- Module accents identify location only; semantic colors always represent status.
- Do not make whole pages strongly colored.
- Avoid generic admin-kit visuals, decorative gradients on dense admin screens, shortcut walls, and tiny low-contrast operational text.

Base tokens:

| Token | Hex | Usage |
|---|---:|---|
| `brand.primary` | `#155EEF` | Primary SchoolOS action, links, active state |
| `brand.primaryDark` | `#0B3A88` | Sidebar active, strong headers |
| `brand.primarySoft` | `#EAF1FF` | Soft selected backgrounds |
| `brand.secondary` | `#7C3AED` | Secondary accent / premium platform detail |
| `surface.app` | `#F3F7FB` | App background |
| `surface.card` | `#FFFFFF` | Cards, panels, tables |
| `surface.subtle` | `#F8FAFC` | Subtle cards, table header |
| `border.default` | `#E2E8F0` | Borders |
| `text.primary` | `#0F172A` | Main text |
| `text.secondary` | `#475569` | Secondary text |
| `success` | `#16A34A` | Success states |
| `warning` | `#D97706` | Warning states |
| `danger` | `#DC2626` | Dangerous/error states |
| `info` | `#0284C7` | Informational states |

Module accents:

| Area | Accent | Notes |
|---|---:|---|
| Dashboard | `#155EEF` | Core command center |
| Platform Control | `#4F46E5` | Enterprise/operator separation |
| M1 Admissions / Students | `#2563EB` | Identity and student records |
| M2 Attendance | `#059669` | Presence and reliability |
| M3 Fees / Receipts | `#D97706` | Money action and caution |
| M4 Academics | `#7C3AED` | Exams and report cards |
| M5 Activity Feed | `#DB2777` | Classroom updates and media |
| M6 Homework / Timetable | `#0284C7` | Scheduling and assignments |
| M7 HR / Payroll | `#9333EA` | Staff and payroll |
| M8A Library | `#0D9488` | Books and borrowing |
| M8B Transport | `#EA580C` | Routes and vehicles |
| M8C Canteen | `#65A30D` | Food, wallet, POS |
| M9 Accounting | `#0F766E` | Ledger and reconciliation |
| M10 Notices / Chat | `#E11D48` | Communication and urgency |
| M12 Learning | `#7C3AED` | Controlled learning sessions |
| Reports | `#0891B2` | Exports and analytics |
| Settings | `#475569` | Configuration |

### Layout Rules

Every web admin page should follow:

```text
App Shell
  Topbar
  Left Sidebar
  Page Header
  Context Bar / Filters
  Summary / KPI Strip
  Main Workspace
  Optional Right Insight Panel or Drawer
  Sticky Action Footer only when needed
```

- Topbar: school selector, global search, notifications, user profile, academic year/date context where relevant.
- Sidebar: no phase labels; permission-hidden items do not appear; platform pages stay outside school operations navigation.
- Page header: title, short description, one primary action, optional secondary action menu.
- Avoid five equal header buttons. Secondary actions belong in `More Actions`.
- Every card should link to a real module screen and real backend data. If data is unavailable, show an unavailable state, not a fake value.

### Navigation Rules

Recommended school operations sidebar:

```text
Dashboard
Students
Admissions
Attendance
Fees
Academics
Activity Feed
Homework & Timetable
HR & Payroll
Library
Transport
Canteen
Accounting
Notices & Chat
Reports
Settings
```

Platform web navigation:

```text
Attention
Schools
Plans & Billing
Providers
Queues
Reports
Audit
Support Override
```

### Component Strategy

SchoolOS owns the design system. Dependencies may power behavior, but they must not define the product experience.

Required stack:

```text
Next.js App Router
React
Tailwind CSS 4
SchoolOS design tokens
SchoolOS-owned components in apps/web/components/ui
Lucide icons
TanStack Query for interactive authenticated server state
React Hook Form + Zod for forms
```

Use shadcn/Radix-style primitives where accessible behavior matters:

```text
Dialog, AlertDialog, Popover, DropdownMenu, Select, Tabs, Tooltip,
Sheet, Command, Calendar, Checkbox, RadioGroup, Switch, Toast
```

SchoolOS-owned components should include:

```text
AppShell, PlatformShell, Sidebar, Topbar, PageHeader, ModuleHeader,
ContextBar, SectionCard, StatCard, DataTable, FilterBar, SearchInput,
ConfirmDialog, AuditReasonDialog, EmptyState, LoadingState, ErrorState,
PermissionState, ModuleLockedState, MoneyDisplay, DateDisplay,
StatusBadge, AuditTimeline, StudentAvatar, ProtectedFileLink
```

Domain components should wrap primitives and enforce SchoolOS workflow rules, for example `FeeCollectionPanel`, `AttendanceRegister`, `LearningSessionRoom`, `CanteenPOSPanel`, `ProviderModeBadge`, and `NoticeAudiencePreview`.

### Accessibility

- Keyboard reachable dialogs, menus, selects, tabs, and sheets.
- Visible focus states.
- Inputs have labels and associated errors.
- Do not rely only on color for status.
- Tables have clear headers.
- Buttons have meaningful labels.
- Mobile touch targets are at least 44px.

### Required States

Every screen must design:

| State | Required behavior |
|---|---|
| Loading | Skeleton/card placeholder with page title and selected filters preserved. |
| Empty | School-friendly next action, not a dead blank screen. |
| Error | Safe backend message where possible, retry, and preserved form/filter state. |
| Success | Small confirmation plus refetch/invalidate; do not hide audit/action history. |
| Permission denied | Clear message and safe navigation without exposing hidden actions. |
| Module locked | Entitlement-backed locked state; no fake fallback data. |
| Offline | Mobile banner and last-updated label where cached data is shown. |
| Pending sync | Visible queued/retry/failed state only for idempotent writes. |

### Performance

- Keep layout and static sections server-rendered where possible.
- Use Client Components only for interactivity.
- Use route-level loading and component skeletons.
- Use paginated APIs for growing lists.
- Do not calculate official totals in the browser.
- Do not fetch every module on the main dashboard.
- Lazy-load charts, history tables, report histories, and detail panels.

---

## 4. Role and Device Access Matrix

| Role | Device | Main workflows | Forbidden workflows | Data scope |
|---|---|---|---|---|
| Platform Operator | Web only | Tenants, plans, SaaS billing, providers, queues, platform audit, support override | Silent tenant access, school fee collection, tenant-private data without override | Platform data; tenant data only through explicit audited override |
| Support Operator | Platform web plus audited override | Troubleshoot tenant setup/support issues with reason and expiry | Silent tenant access, broad data browsing, mutation without reason | Support-relevant diagnostics only |
| School Owner / Director | Web first, optional mobile alerts | Executive health, enrollment, dues, revenue, expenses, approvals, audit, module status | Unpublished marks, private chats, salary details unless granted, platform internals | Tenant executive summaries and permitted approval data |
| Principal / Head Teacher | Both | Attendance risk, substitutions, academics, notices, approvals, parent escalations | Platform billing, deep accounting/payroll unless granted | Tenant school operations, restricted by permissions |
| Academic Coordinator | Web first, optional mobile alerts | Exam setup, marks readiness, timetable, report cards, result publishing | Finance, payroll, platform controls | Academic scope and assigned school structures |
| School Admin / Office Admin | Web first | Students, admissions, guardians, documents, settings, reports | Salary, ledger postings, private chats unless granted | Tenant office/admin data |
| Admission Officer | Web first | Applications, document review, duplicate review, enrollment handoff | Payroll, unrelated academics, existing student fee ledger beyond admission need | Admission pipeline and applicant data |
| Class Teacher | Both | Own roster, attendance, homework, activity posts, parent messages | Other classes, finance, payroll, accounting | Assigned class/section/student scope |
| Subject Teacher | Both | Assigned subjects/classes, marks, homework, syllabus, timetable | Fees, payroll, unrelated student records | Assigned subject/class scope |
| Accountant | Web first | Fee setup, invoices, payments, receipts, journals, reconciliation, reports | Academic marks, private chats, HR details beyond payroll/accounting need | Tenant finance/accounting scope by permission |
| Cashier | Web/tablet first | Student search, collect payment, issue/reprint receipt, cashier close | Fee setup, accounting configuration, payroll, full private profile | Counter payment and receipt scope |
| HR / Payroll Officer | Web first, optional staff mobile | Staff lifecycle, leave, salary structures, payroll runs, payslips | Student finance, academic marks, parent chat | Staff/payroll scope by permission |
| Librarian | Web first, optional scanner device later | Books, copies, issue/return, reservations, fines, reports | Full student profile, salary, ledger | Library borrower/catalog scope |
| Transport Manager | Web first, mobile monitoring optional | Routes, vehicles, assignments, trips, GPS status, delay reports | Academics, payroll, accounting ledgers | Tenant transport operations |
| Driver / Conductor | Mobile only | Assigned trip, manifest, boarded/dropped/absent, GPS, emergency | Admin web, fees, academics, full profiles, other routes | Assigned trip only |
| Canteen Manager | Web/tablet first | Menu, meal plans, wallets, inventory, POS, reports | Academic marks, payroll, full guardian data | Canteen operations |
| Canteen POS Staff | Tablet/mobile POS only | Scan student, serve meal, POS sale, receipt | Inventory cost, finance reports, full profile | POS/serving scope only |
| Parent / Guardian | Mobile first, optional parent web | Own child attendance, dues, receipts, notices, homework, reports, transport, canteen, library, activity, chat, learning summary | Other children, internal reports, staff private data, unpublished results | Own linked children only |
| Student Lab-Only User | Controlled lab/session route only | Join teacher-controlled learning session, autosave, submit, view own session result | Broad mobile app, fees, parent/staff data, other students, public leaderboard, open chat | Own active session and attempt only |
| Staff Self-Service User | Mobile first, web optional | Own profile, attendance/check-in, leave, payslips, notices | HR admin, payroll runs, other staff salaries | Own staff data only |

---

## 5. Role-Based Navigation Plan

| Surface | Navigation |
|---|---|
| Platform web | Attention, Schools, Plans & Billing, Providers, Queues, Reports, Audit, Support Override |
| School admin web | Today, Students, Admissions, Attendance, Fees, Academics, Homework, Timetable, Notices, Reports, Settings |
| Teacher web | Today, My Classes, Attendance, Homework, Marks, Timetable, Activity, Messages, My Profile |
| Finance/accounting web | Today, Fee Collection, Invoices, Receipts, Dues, Cashier Close, Accounting, Reconciliation, Reports |
| Parent mobile | Home, Children, Attendance, Homework, Fees, Notices, More. More contains report cards, transport, canteen, library, activity, chat, learning where enabled |
| Teacher mobile | Today, Attendance, Homework, Notices, Messages, Profile |
| Driver mobile | Trip, Manifest, GPS, History, Emergency |
| Staff self-service mobile | Home, Attendance, Leave, Payslips, Notices, Profile |
| Student lab-only session route | Join Session, Activity, Progress, Exit. No broad sidebar or bottom nav |

After login, users should land on the most useful role view:

```text
Owner/director -> Executive Overview
Principal -> School Operations Overview
Teacher -> My Classes Today
Accountant -> Finance Today
Cashier -> Fee Collection Counter
HR/payroll -> Staff and Payroll Today
Librarian -> Library Desk
Transport manager -> Transport Operations Today
Driver -> My Assigned Trip
Canteen staff -> Canteen POS Today
Parent -> My Child Overview
Student -> Controlled Learning Session
Platform operator -> Platform Attention Dashboard
```

---

## 6. Module-Wise Screen Design Plan

Each module screen must handle loading, empty, error, success, permission denied, module locked, and destructive confirmation states. Mutations are tenant-scoped and audit-sensitive when they create, update, delete, archive, approve, post, reverse, or publish.

| Module | Purpose | Roles | Web routes/screens | Mobile/lab routes | Primary job and actions | Data, filters, files, offline notes |
|---|---|---|---|---|---|---|
| M0 Platform Core | SaaS operations and tenant lifecycle | Platform/support operators | `/platform`, `/platform/schools`, `/platform/billing`, `/platform/settings`, `/platform/operations/*`, `/platform/audit` | None | Manage tenants/plans/providers/queues/support override | Paginated tenants/audit/jobs; reason required for status/retry/discard/override; SaaS billing separate from fees |
| Auth/RBAC/Settings | Secure access and tenant configuration | Admin, owner, platform where applicable | `/login`, `/dashboard/settings/*`, `/platform/settings/*` | Mobile login/profile/settings | Login, restore session, manage users/roles/settings/logo/modules | Cookie-first web auth; secure mobile token storage; private logo access |
| M1 Admissions & Students | Student lifecycle from application to alumni/archive | Admin, admission officer, teachers scoped, principal, parent read | `/dashboard/students`, `/dashboard/students/[studentId]`, `/dashboard/admissions/*` | Parent child summary; teacher class list; no broad student mobile | Search, profile, guardians, docs, admissions, import, enroll, duplicates | Server pagination/filtering; private photos/docs; iEMIS exports; reasons for lifecycle actions |
| M2 Attendance | Student/staff attendance and corrections | Teacher, principal, admin, parent, staff self-service | `/dashboard/attendance`, `/dashboard/attendance/register`, `/dashboard/attendance/corrections`, `/dashboard/hr/attendance` | Teacher attendance, parent attendance, staff check-in | Mark, review, correct, export attendance | Offline teacher drafts; locked/duplicate states; authenticated CSV exports |
| M3 Fees & Receipts | Fee setup, dues, payments, receipts | Accountant, cashier, owner/principal summary, parent | `/dashboard/fees`, `/dashboard/finance/*` | Parent fees/receipts summary only | Create bills, collect payments, issue receipts, manage reversals/cashier close | Decimal money; server totals; blob receipt PDF; audited reversal/refund/close |
| M4 Academics / Exams / Report Cards | Exams, marks, CAS, results, promotions | Academic coordinator, teachers, principal, parent read | `/dashboard/academics/*`, `/dashboard/exams`, `/dashboard/marks-entry` | Parent published report cards only | Setup exams, enter marks, generate/publish reports | Marks locks; protected PDFs; no unpublished parent access |
| M5 Activity Feed | Child activity, media, mood logs, milestones | Teacher, parent, moderator/admin | `/dashboard/activity/*` | Parent activity summary; teacher quick post later | Create/moderate posts, preview audience, gallery/milestones | File Registry/private media; consent-aware; queued media variants |
| M6 Homework / Timetable | Homework and schedules | Teachers, academic coordinator, parent | `/dashboard/homework/*`, `/dashboard/timetable/*` | Teacher daily homework/timetable; parent homework/timetable | Assign/review homework, reminders, timetable, substitutions | Attachments through File Registry; preview reminders; offline mobile read cache |
| M7 HR / Payroll | Staff, leave, payroll | HR/payroll, accountant, principal, staff self-service | `/dashboard/hr/*`, `/dashboard/payroll/*`, `/dashboard/my-profile` | Staff attendance, leave, payslips, profile | Manage staff lifecycle, leave, payroll, payslips | Salary gating; protected payslip PDFs; audited posting/reversal |
| M8A Library | Catalog, issue/return, reservations, fines | Librarian, admin, parent/student summary when allowed | `/dashboard/library/*` | Parent child library summary optional; no broad student mobile | Catalog, scan issue/return, overdue/fines/reports | Scanner states; exports through File Registry; fines-to-fees audited |
| M8B Transport | Routes, vehicles, assignments, trips, GPS | Transport manager, driver, parent | `/dashboard/transport/*` | Driver trip app; parent transport status | Setup, assign, operate trips, GPS/reports | Driver purpose-limited APIs; stale GPS; offline pending pings; live map deferred |
| M8C Canteen | Menu, meal plans, serving, wallets, POS, inventory | Canteen manager, POS staff, parent | `/dashboard/canteen/*` | Parent canteen summary; POS tablet/mobile where assigned | Serve meals, POS sale, wallet/menu/inventory/reports | Allergy acknowledgement; wallet limits; receipts through File Registry |
| M9 Accounting | Chart, fiscal periods, journals, reports, reconciliation | Accountant, owner/principal summary if granted | `/dashboard/accounting/*` | No full mobile accounting; read-only summary later | Accounts, journals, vouchers, reports, close, reconciliation | Ledger boundary only; queued/protected exports; close/reopen/reverse audited |
| M10 Notices / Communication / Chat | Notices, events, notifications, chat | Admin, principal, teacher, parent | `/dashboard/notices/*`, `/dashboard/messages/*`, `/dashboard/communications/*` | Parent notices/chat; teacher notices/chat | Compose, preview audience, delivery/read status, chat | Recipient preview; delivery retry; private attachments; moderation/quiet hours |
| M11 Intelligence / AI roadmap only | Future reviewed insights | None in MVP | No implementation screen | None | Roadmap only | No AI runtime, leaderboard, or automatic inference in MVP |
| M12 Learning Layer | Controlled school learning sessions | Teacher, student lab participant, parent summary | `/dashboard/learning/*`, `/classroom/board/session/[sessionId]`, `/parent/learning/*`, `/student/learning/*` | Parent learning summary only; student lab/session route on controlled devices | Activities/resources/sessions, join, autosave/submit, progress | No broad student mobile; session codes scoped; resources through File Registry; idempotent attempts |
| Advanced Operations | Approvals, automation, analytics, templates, exports | Admin, owner/principal, module owners | `/dashboard/operations/*` or module-local panels | Approval cards later only | Approval inbox, automation rules, analytics, document templates, export center | Queued long work; audit reasons; File Registry for templates/exports |
| File Registry / Reports / Exports | Protected files, PDFs, CSVs, snapshots | Any permitted actor | `/dashboard/reports`, module report pages, platform exports | Purpose-limited downloads only | Upload, preview, download, export, retry jobs | No public URLs; protected access; queued large exports; paginated lists |

---

## 7. Major Screen Blueprints

Every major screen must define screen name and route, role/surface, goal, layout, summary cards, main work area, primary CTA, secondary actions, states, components, API dependencies, and acceptance criteria.

| Screen | Route | Role/surface | Goal | Primary CTA | API dependency | Acceptance criteria |
|---|---|---|---|---|---|---|
| Platform Attention Dashboard | `/platform` | Platform operator web | See SaaS health and urgent tenant/provider/queue issues | Open highest-risk item | `/platform/dashboard`, `/platform/health`, `/platform/queues`, `/platform/providers/readiness` | Platform-only, paginated lists, override visible if active |
| School Operations Overview | `/dashboard` | Principal/admin web | Understand today and choose next school action | Resolve top alert | Module summaries from real APIs | No fake cards; permission/entitlement controls navigation |
| Student Directory | `/dashboard/students` | Admin/teacher scoped web | Find student and open safe profile context | Add student / start admission | `/students`, `/students/search`, `/admissions` | Server filters/pagination; teachers see assigned scope only |
| Admission Pipeline | `/dashboard/admissions` | Admission officer web | Move applications through review to enrollment | Create application | `/admissions/applications`, `/admissions/applications/:id/enroll` | Duplicate blockers and enrollment status visible |
| Attendance Marking | `/dashboard/attendance/register` and teacher mobile attendance | Teacher web/mobile | Mark assigned class attendance quickly | Submit attendance | `/attendance/rosters`, `/attendance/sessions`, `/attendance/drafts`, mobile teacher endpoints | Offline draft, locked, duplicate states handled |
| Fee Collection Counter | `/dashboard/finance/collections` | Cashier web/tablet | Collect payment and issue receipt | Record payment | `/fees`, `/payments`, `/receipts` | Decimal money, double-submit protection, receipt PDF via blob helper |
| Marks Entry | `/dashboard/academics/marks` | Subject teacher web | Enter marks for assigned class/subject | Save marks | `/academics/marks`, `/academics/marks/bulk-upsert` | Lock state, row errors, assigned scope |
| Report Cards | `/dashboard/academics/report-cards` | Coordinator/principal web | Generate, review, publish/download report cards | Generate batch | `/academics/report-cards`, `/academics/report-cards/:id.pdf` | Protected PDFs, correction workflow audited |
| Homework Workspace | `/dashboard/homework` | Teacher web | Assign and review homework | Create homework | `/homework`, `/homework/:id/submissions` | Attachments protected; reminders previewed |
| Timetable Builder | `/dashboard/timetable/builder` | Coordinator web | Build and publish timetable versions | Validate version | `/timetable/versions`, `/timetable/versions/:id/validate` | Conflict details visible; publish/lock audited |
| Staff and Payroll Today | `/dashboard/hr`, `/dashboard/payroll` | HR/payroll/accounting web | Manage staff, leave, payroll lifecycle | Start payroll preview | `/staff`, `/hr`, `/payroll` | Salary visibility permission-gated; payslips protected |
| Library Desk | `/dashboard/library/issue-return` | Librarian web/tablet | Issue or return a copy by scan | Scan copy/student | `/library/qr-lookup`, `/library/issues/scanner`, `/library/returns/scanner` | Scanner success/failure states clear |
| Transport Operations | `/dashboard/transport` | Transport manager web | Keep routes, vehicles, trips, GPS healthy | Start/monitor trip | `/transport/*` | Stale GPS, delay, cancellation states visible |
| Driver Trip | Flutter driver trip | Driver mobile | Operate assigned trip safely | Start trip / mark boarded | `/transport/driver/*` | Assigned-trip scope only, offline pending GPS, emergency CTA |
| Canteen POS / Serving | `/dashboard/canteen/pos`, `/dashboard/canteen/serving` | POS staff web/tablet | Serve or sell safely | Scan student / complete sale | `/canteen/qr-resolve`, `/canteen/servings`, `/canteen/pos-sales` | Allergy acknowledgement, wallet/eligibility failure states |
| Accounting Reports | `/dashboard/accounting/reports` | Accountant web | Produce ledger-backed reports | Export report | `/accounting/reports/*` | No frontend totals; exports via authenticated helper/queued jobs |
| Notices | `/dashboard/notices` and mobile notices | Admin/teacher/parent | Send/read school communication | Send notice | `/notices`, `/notification-center`, `/messaging` | Audience preview, delivery/read status, protected attachments |
| Learning Session | `/student/learning/join`, `/student/learning/session/[sessionId]` | Student lab route | Join controlled session and submit activity | Join / submit | `/learning/sessions/:id/join`, `/learning/sessions/:id/attempts`, `/learning/attempts/:id/*` | Controlled device only, no broad student app, idempotent autosave/submit |
| Parent Home | Flutter parent home | Parent mobile | Understand own child today | View top child alert | Parent/mobile scoped endpoints | Own-child scope only, cached read states, friendly errors |
| Staff Self-Service | Flutter staff home | Staff mobile | Handle personal attendance, leave, payslips | Request leave / check in | `/hr/me/*`, `/staff/me`, `/payroll/me/payslips` | Own-data only, secure storage, offline read cache |

---

## 8. Frontend and Backend API Contract Map

Runtime API rules:

- Global API prefix: `/api/v1`.
- Swagger/OpenAPI UI: `/api/v1/docs`.
- Frontend uses cookie-first auth. Never store raw access/refresh tokens in browser storage.
- All web module API calls use `apps/web/lib/api/client.ts` or domain files built on that shared helper.
- CSV/PDF/blob/private media endpoints use the shared authenticated blob/download helper. Do not use raw `window.open` for private URLs.
- Parent, staff self-service, driver, lab/session student, and mobile APIs are purpose-limited. Do not use admin-shaped APIs for those actors when scoped endpoints exist.
- No frontend route may ship without a real API backing it.
- SSE streams are progressive enhancement only; list queries remain the source of truth after reconnect/refetch.

Recommended `apps/web/lib/api` files:

```text
client.ts                  # shared cookie-first fetch, error normalization, query, blob/download helpers
auth.ts                    # auth, me, MFA, password/OTP recovery
users.ts                   # users, roles, permissions
platform.ts                # tenants, plans, providers, queues, SaaS billing
students.ts                # student profile, documents, QR, lifecycle, iEMIS
attendance.ts              # attendance, drafts, corrections, calendar
finance.ts                 # fees, invoices, payments, receipts, cashier close
academics.ts               # exams, marks, CAS, report cards, results, promotions
activity.ts                # activity feed, gallery, media, milestones
payroll.ts                 # payroll preview/runs/payslips/salary/reports
library.ts                 # books/copies/issues/reservations/fines/reports
transport.ts               # routes/stops/vehicles/trips/driver/parent/reports
canteen.ts                 # menu/plans/enrollments/serving/wallet/POS/inventory/reports
accounting.ts              # chart, periods, journals, reports, vouchers, reconciliation
communications.ts          # notices, notification center, parent-teacher chat
messaging.ts               # thread/message helpers
learning.ts                # activities, sessions, attempts, progress, resources
marketing.ts               # public demo/request flows
index.ts                   # re-export only; no second client implementation
```

Module route map:

| Area | Backend routes to preserve | Frontend/mobile consumption |
|---|---|---|
| M0 Platform | `GET /api/v1/platform/dashboard`, `/platform/health`, `/platform/usage`, `/platform/tenants`, `/platform/tenants/page`, `/platform/tenants/:tenantId`, `PATCH /platform/tenants/:tenantId/status`, `POST /platform/schools/:tenantId/suspend-for-billing`, `POST /platform/schools/:tenantId/reactivate-after-payment`, `/platform/plans`, `/platform/feature-keys`, `/platform/usage-keys`, `/platform/tenants/:tenantId/subscriptions`, `/platform/tenants/:tenantId/feature-overrides`, `/platform/tenants/:tenantId/entitlements/:featureKey`, `/platform/providers`, `/platform/providers/readiness`, `/platform/queues`, `/platform/queues/failed-jobs`, `/platform/queues/retry`, `/platform/audit-logs`, `/platform/report-exports`, `/platform/support/override/enter`, `/platform/support/override/exit` | `/platform`, `/platform/schools`, `/platform/billing`, `/platform/providers`, `/platform/queues`, `/platform/audit`, support override banner |
| Auth / Users / Roles | `POST /api/v1/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, OTP/password recovery/MFA routes, `GET/POST /users`, `PATCH /users/:id/status`, `POST /users/:id/reset-password`, `POST /users/:id/force-logout`, `GET/POST /roles`, `GET /roles/permissions`, `POST /roles/assign`, `POST /roles/:id/permissions` | `/login`, auth shell, `/dashboard/settings/users`, `/dashboard/settings/roles` |
| M1 Students / Admissions | `GET/POST /api/v1/students`, `GET/PATCH /students/:id`, `/students/:id/archive`, `/students/:id/transfer`, `/students/:id/fee-clearance`, `/students/:id/attendance-history`, `/students/:id/lifecycle-timeline`, `/students/:id/identity`, `/students/duplicates/*`, `/students/iemis/*`, `/students/:id/photo/*`, `/students/:studentId/qr*`, `GET/POST /admissions`, `/admissions/applications`, `/admissions/applications/:id/status`, `/admissions/applications/:id/enroll`, `/admissions/bulk-import`, `/admissions/duplicates`, `/admissions/iemis-export` | `/dashboard/students`, student profile tabs, admissions pipeline/import/duplicates, parent-safe child profile |
| M2 Attendance | `GET /api/v1/attendance`, `/attendance/rosters`, `POST /attendance/sessions`, `/attendance/sync`, `/attendance/drafts`, `/attendance/drafts/:id/submit`, `/attendance/summary`, `/attendance/register`, `/attendance/register/export`, `/attendance/students/:id/history`, `/attendance/analytics`, `/attendance/anomalies`, `/attendance/follow-ups`, `/attendance/conflicts`, `/attendance/calendar`, correction routes, mobile teacher attendance routes | Web attendance register/review, teacher mobile attendance, parent attendance summary |
| M3 Fees / Finance | Fee structure, invoices, payments, receipts, receipt PDF/QR/reprint, reversals/refunds, cashier close, payment gateway/webhook, reconciliation, due/defaulter/reminder, parent fee/receipt routes under `/api/v1/fees`, `/api/v1/payments`, `/api/v1/receipts`, `/api/v1/finance`, and `/api/v1/mobile/students/:id/fees-summary` | `/dashboard/fees`, `/dashboard/finance/*`, cashier counter, parent fees/receipts |
| M4 Academics | `/api/v1/academics/exams`, `/academics/marks`, `/academics/marks/bulk-upsert`, `/academics/cas`, `/academics/report-cards`, `/academics/report-cards/batch`, `/academics/report-cards/:id.pdf`, `/academics/results/preview`, `/academics/results/publishing`, `/academics/grading-scale`, `/academics/grading-policy`, `/academics/promotions`, syllabus/remedial routes | Exams, marks, report cards, results, promotions, parent published results only |
| M5 Activity Feed | `SSE /api/v1/activity-feed/stream`, `GET/POST/PATCH/DELETE /activity-feed/posts`, `/activity-feed/parent`, `/activity-feed/posts/:id/reactions`, `/activity-feed/audience-preview`, `/activity-feed/gallery`, media preview/download routes, attachments preview/download, mood logs, milestones, milestone templates | Activity feed workspace, media gallery, audience preview, parent child-scoped feed |
| M6 Homework / Timetable | `GET/POST/PATCH/DELETE /api/v1/homework`, `/homework/templates`, `/homework/:id/submissions`, `/homework/submissions/:submissionId/review`, `/homework/:id/reminders/preview`, `/homework/:id/reminders/send`, homework reports/attachments, `/timetable`, `/timetable/periods`, `/timetable/rooms`, `/timetable/versions`, `/timetable/versions/:id/validate`, `/publish`, `/lock`, slot routes, teacher availability, workload, substitutions | Homework workspace, submissions, reminders, timetable builder, substitutions, mobile teacher/parent summaries |
| M7 HR / Payroll | `GET/POST/PATCH /api/v1/staff`, `/staff/:id`, `/staff/me`, `/staff/me/timeline`, `/staff/me/leave-requests`, `/staff/me/attendance`, `/payroll/preview`, `/payroll/runs`, `/payroll/runs/:id/approve`, `/review`, `/post`, `/reverse`, `/payroll/payslips`, `/payroll/me/payslips`, payslip PDF routes, salary-structure and payroll report routes | HR staff workspace, payroll runs, self-service mobile, payslips |
| M8A Library | `/api/v1/library/books`, `/library/books/:id/history`, `/library/copies`, `/library/copies/scan/:code`, `/library/issues`, `/library/my/issues`, `/library/issues/scanner`, `/library/returns/scanner`, `/library/reservations`, `/library/qr-lookup`, `/library/overdue`, `/library/reports/*`, `/library/fines`, `/library/fines/:id/post-to-fees`, `/library/settings` | Library catalog, circulation, reports, fines, parent/student summary where allowed |
| M8B Transport | `/api/v1/transport/routes`, `/transport/stops`, `/transport/vehicles`, `/transport/assignments/drivers`, `/transport/assignments/students`, `/transport/trips`, `/transport/trips/active`, `/transport/trips/history`, `/transport/trips/:id/students/boarded`, `/dropped`, `/absent`, `/location`, `/transport/parent/students/:studentId/active-trip`, `/status`, `/transport/driver/*`, reports/export routes | Transport setup/trips/reports, driver mobile, parent child-scoped status |
| M8C Canteen | `/api/v1/canteen/qr-resolve/:token`, `/canteen/menu-items`, `/canteen/meal-plans`, `/canteen/enrollments`, `/canteen/parent/students/:studentId/status`, `/canteen/servings`, `/canteen/wallets/student/:studentId/*`, `/canteen/pos-sales`, `/canteen/pos-sales/:id/receipt.pdf`, `/canteen/suppliers`, `/canteen/inventory-items`, `/canteen/purchase-bills`, `/canteen/wastage`, `/canteen/stock-adjustment`, reports/export routes | Canteen menu, serving, POS, wallet, inventory, parent status |
| M9 Accounting | `/api/v1/accounting/accounts`, `/accounts/tree`, `/accounts/seed-defaults`, `/fiscal-years`, `/periods`, `/journals`, `/journals/:id/submit`, `/approve`, `/post`, `/reverse`, `/correct`, voucher routes, `/accounting/reports/*`, `/accounts/:accountId/ledger`, `/exports/:report.csv`, bank reconciliation import/unreconciled/auto-match/reconcile/summary routes | Chart, fiscal periods, journals, vouchers, reports, reconciliation |
| M10 Communications | `/api/v1/notices`, `/notices/recipient-preview`, `/notices/scheduled/process`, `SSE /messaging/stream`, `/messaging/unread-count`, `/messaging/conversations`, `/messaging/messages`, `/messaging/read-receipts`, `/messaging/parent-teacher/threads`, `/messages`, `/availability`, `/abuse-reports`, `/escalations` | Notices, notification center, parent-teacher chat, moderation |
| M12 Learning | `GET/POST/PATCH/DELETE /api/v1/learning/activities`, `/learning/activities/:id`, `/learning/activities/:id/resources`, `/learning/activities/:id/sessions`, `/learning/sessions`, `/learning/sessions/:id`, `/pause`, `/resume`, `/end`, `/heartbeat`, `/participants`, `/learning/sessions/join`, `/learning/sessions/:id/attempts`, `/learning/attempts/:id/autosave`, `/learning/attempts/:id/submit`, `/learning/progress/class/:classId`, `/learning/progress/student/:studentId`, `/parent/learning/summary`, `/learning/resources` | Learning workspace, board/lab routes, parent summary, student controlled session |
| Advanced Operations | `/api/v1/advanced/approvals/catalog`, `/advanced/approvals/policies`, `/advanced/approvals`, `/advanced/approvals/:id/decisions`, `/apply`, `/comments`, `/attachments`, `/advanced/automation/catalog`, `/advanced/automation/rules`, `/advanced/automation/execute`, `/advanced/automation/execution-logs`, `/advanced/analytics/summaries`, `/advanced/analytics/refresh`, `/advanced/document-templates`, `/generate`, `/print-history`, `/advanced/exports`, `/advanced/exports/:id/retry` | Operations approvals, automation, analytics, documents, export center |
| Reports / Files / Settings / Mobile | `/api/v1/reports`, `/reports/:reportKey/export`, `/reports/export-history`, `/reports/export-history/:id/download`, `/files/upload`, `/files/signed-upload`, `/files/:id/complete-upload`, `/files/:id/view`, signed preview/download routes, `/settings`, `/settings/public`, `/settings/onboarding`, `/settings/audit-logs`, `/settings/:key`, `/settings/branding/logo/*`, mobile parent routes under `/mobile/me/*` and `/mobile/students/:id/*` | Reports center, protected files, settings, branding, Flutter parent mobile |

Frontend sprint order:

```text
0. API foundation and route guard readiness
1. Auth, Settings, RBAC, Platform basics
2. M1 Students and Admissions
3. M2 Attendance and M6 Timetable foundation
4. M3 Fees and M9 Accounting
5. M4 Academics and M6 Homework
6. M7 HR/Payroll
7. M8A/M8B/M8C Operations
8. M10 Communications and M5 Activity Feed
9. M12 Learning and Advanced Operations
```

---

## 9. Flutter Mobile Plan

SchoolOS mobile is a companion app for daily role-specific actions. It is not a smaller version of the web dashboard.

Feature-first structure:

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

Shared mobile architecture:

| Area | Plan |
|---|---|
| API client | Keep one Dio-backed `ApiClient` with base URL from `EnvConfig`. |
| Auth | Tenant slug login, bearer access token, refresh token, session-expired callback. |
| Storage | Secure storage for tokens; lightweight preferences for selected child/context. |
| Errors | Map backend errors to school-friendly app exceptions. |
| Permissions | Role/permission service controls navigation visibility; backend remains enforcement. |
| Offline | Cache last safe read results. Queue only explicitly idempotent actions. |
| Files | Authenticated download/share helpers only. No permanent public URLs. |
| State | Loading, empty, error, permission denied, offline, success/pending where relevant. |

Personas:

| Persona | Allowed modules | Required API shape | Forbidden data | Offline/cache policy |
|---|---|---|---|---|
| Parent / Guardian | Child profile, attendance, homework/timetable, fees/receipts, published report cards, notices, transport, canteen, library, activity, chat, learning summary | `GET /mobile/dashboard/parent`, `/mobile/parent/attendance-summary`, `/parent/learning/summary`, parent-scoped module APIs | Other children, staff private data, unpublished marks, audit/internal reports | Cache child selector and last safe summaries; payments/chat/downloads need network unless safe contract exists |
| Teacher | Today timetable, assigned attendance, homework create-lite, notices/messages, substitutions, own profile/leave | `/mobile/teacher/attendance/classes`, `/roster`, `/submit`, `/timetable`, `/homework`, `/notification-center` | Other classes, finance, payroll, unrelated documents, settings | Cache timetable, rosters, homework; attendance queue only with idempotency key and visible sync |
| Driver / Conductor | Assigned route/trip, manifest, boarded/dropped/absent, GPS, delay/emergency, trip history | `/transport/driver/dashboard`, `/gps-ping-contract`, `/assignments`, `/trips/active`, `/trips/:id/manifest`, trip mutation/location/emergency routes | Full profiles, fees, academics, payroll, other trips/routes, parent private data beyond emergency-safe contract | Cache active manifest and instructions; GPS/status changes show queued/pending/failed |
| Staff Self-Service | Own profile, attendance/check-in/out, leave, payslips, notices, settings | `/staff/me`, `/staff/me/timeline`, `/hr/me/attendance`, `/hr/me/leave-requests`, `/hr/me/leave-balances`, `/hr/me/time-clock`, `/payroll/me/payslips` | Other staff, salary structures, payroll runs, student records, finance/accounting | Cache own profile, leave balances, payslip metadata, last attendance status; check-in/out requires network unless explicitly approved |
| Student Lab / Controlled Device | Session join, learning activity, autosave, submit, session result/progress summary | `/learning/sessions/:id/join`, `/learning/sessions/:id/attempts`, `/learning/attempts/:id/autosave`, `/learning/attempts/:id/submit`, `/learning/progress` | Broad mobile home, fees, parent/staff data, other students, unpublished marks, leaderboard, open chat | Prefer online school network; idempotent autosave retries visible; keep local unsent answers only for current session |

Implementation readiness chain:

```text
Persona -> Permission -> Scope -> Route -> Purpose-limited API -> DTO -> Repository -> Provider -> Screen -> State -> Test
```

Do not start a mobile screen if the only available endpoint is admin-shaped and exposes more data than the persona needs.

---

## 10. Persona Smoke Plan

Testing philosophy:

```text
Does this user see the correct dashboard?
Does this user see only the correct navigation?
Does this user see only permitted data?
Does this user see only permitted actions?
Does direct URL access fail safely?
Does mobile show scoped, simple, role-specific screens?
Does backend block the action even if frontend hides it?
```

Global smoke checks for every persona:

1. Can log in successfully.
2. Lands on the correct dashboard/home screen.
3. Sidebar/bottom navigation matches role permissions.
4. Hidden modules are not visible.
5. Locked modules show `ModuleLockedState` when directly opened, if applicable.
6. Forbidden direct routes show `PermissionState` or equivalent safe error.
7. Allowed records are visible.
8. Unallowed records are not visible.
9. Allowed actions are visible and work.
10. Forbidden actions are hidden and blocked by backend if attempted.
11. Loading, empty, and error states are not broken.
12. Private files/downloads require authenticated access.
13. Logout/session expiry returns to login safely.

Priority persona tests:

| Persona | Priority smoke |
|---|---|
| Platform Operator | Cannot access tenant student profile without override; override banner appears; queue retry/discard audited; SaaS invoice does not appear in school fee module |
| Owner / Director | Sees finance summary but not salary details without payroll permission; approval action requires reason where configured |
| Principal / Head Teacher | Can view attendance summary; cannot see salary details without permission; result publishing requires permission |
| Academic Coordinator | Sees report-card readiness; cannot access fee ledger by default; marks scoped to configured classes/subjects |
| School Admin / Office Admin | Can open student profile; documents require permission; payroll salary page blocked by default |
| Admission Officer | Can move application status; cannot view unrelated fee ledger; duplicate blockers appear before enrollment |
| Class Teacher | Sees own class only; cannot mark another class; messages only allowed parent threads during policy hours |
| Subject Teacher | Sees marks only for assigned subjects/classes; fee collection blocked |
| Accountant | Can view invoices/reports; reversals require permission and reason; private chat content blocked |
| Cashier | Can collect payment and receive receipt success; cannot configure fee plans; reversal blocked without permission; reprint reason required where configured |
| HR / Payroll Officer | Can review leave; salary data visible only to payroll roles; staff sees own payslip only |
| Librarian | Scanner lookup returns borrower identity only; full student profile blocked without permission; borrower sees own issued books only |
| Transport Manager | Sees active trips; delay broadcast requires preview/confirmation; accounting journals blocked |
| Driver / Conductor | Sees assigned trip only; another route/trip blocked; emergency action protected against accidental taps; offline/pending states where implemented |
| Canteen Manager / POS Staff | POS staff can scan/serve eligible student; blocked/low-balance states visible; full profile blocked; wallet correction needs permission/reason |
| Parent / Guardian | Sees only linked child; direct URL for another child denied; only published reports; own receipts only; chat respects policy |
| Student Lab-Only User | Joins only valid assigned active session; cannot view another attempt/progress; broad mobile home, fees, staff data, unpublished results, leaderboard, and chat blocked; autosave/submit retry idempotent |
| Staff Self-Service User | Can request leave; sees own payslips only; other staff profile/payroll blocked |

Cross-persona security checks:

```text
Parent cannot access another parent's child.
Student lab user cannot access another student's session attempt/progress.
Teacher cannot access another class unless assigned or explicitly permitted.
Subject teacher cannot enter marks for unassigned subject.
Driver cannot access unassigned trip.
Cashier cannot reverse/refund payment without permission.
Principal cannot view salary details without payroll permission.
Owner cannot access platform internals without platform permission.
Platform operator cannot view tenant-private data without support override.
Hidden frontend action is still blocked by backend.
Module locked route shows ModuleLockedState and backend blocks action.
```

Mobile scoped access checks:

```text
Mobile login works for parent, teacher, driver, and staff self-service.
Student MVP access is tested through lab/session routes, not broad mobile bottom nav.
Mobile bottom nav matches persona where mobile nav exists.
Mobile screens use own/scoped data only.
Offline banner appears where supported.
Pending sync appears after offline writes where supported.
Push notification opens correct scoped screen where implemented.
Private downloads require authenticated access.
Back navigation does not expose previous user's private data after logout.
```

MVP smoke priority:

```text
P0: Owner/Director, Principal, School Admin, Class Teacher, Subject Teacher,
Accountant, Cashier, Parent, Student Lab-Only User, Platform Operator.

P1: Admission Officer, Academic Coordinator, HR/Payroll Officer, Librarian,
Transport Manager, Driver, Canteen Manager, POS Staff, Staff Self-Service User.
```

Open test planning questions:

```text
Which personas need seeded demo users first?
Will smoke tests run in Playwright for web and Flutter integration_test for mobile?
Should each school type have its own persona bundle: preschool, K-10, 11-12, K-12, K-12+Bachelors?
Which smoke tests are required before pilot demo?
Which smoke tests are required before production launch?
```

---

## 11. Implementation Readiness Checklist

Before any screen is implemented, complete this chain:

```text
Role -> Permission -> Scope -> Route -> API -> DTO -> Component -> State -> Test
```

Minimum acceptance:

1. Role and device choice match the matrix.
2. Permission is backed by `@Permissions` or `packages/core/src/permissions.ts`.
3. Tenant, own-child, own-staff, assigned-class, assigned-trip, or platform scope is explicit.
4. Route exists or is named as planned.
5. API endpoint/client is listed here.
6. Request DTO/query parameters and response purpose are known.
7. Loading, empty, error, success, permission-denied, and module-locked states are designed.
8. Mutations have confirmation, audit reason, and idempotency where needed.
9. Files/PDFs/CSVs use File Registry or authenticated blob/download helpers.
10. Growing lists are paginated and filtered server-side.
11. Mobile flows are purpose-limited and low-bandwidth aware.
12. Smoke/persona test is listed here before production readiness is claimed.

Verification before a web/mobile sprint is marked complete:

```bash
pnpm --filter @schoolos/web typecheck
pnpm typecheck
pnpm build
pnpm verify:openapi
re-run relevant smoke suite when touching existing flows
```

Mobile implementation verification:

```bash
cd apps/schoolos_mobile
dart format .
flutter analyze
flutter test
```

---

## 12. Non-Negotiable Decisions

1. Students do not get a broad MVP mobile app.
2. Student learning access is lab-only or controlled school-device only.
3. Parent mobile is own-child only.
4. Driver mobile is assigned-trip only.
5. Staff mobile is own-staff only.
6. Admin, finance, accounting, payroll, platform, and reporting stay web-first.
7. Mobile is not a smaller dashboard.
8. No fake data, placeholder metrics, or local-only production workflow state.
9. No Angular migration.
10. No microservices.
11. No `tenantId` rename.
12. No AI runtime.
13. No public student leaderboard.
14. No harmful labels such as weak, failed, poor, or low-rank.
15. No admin-shaped API for parent, driver, staff self-service, or student lab/session flows.
16. Backend authorization remains the source of truth; frontend hidden actions are not security.
