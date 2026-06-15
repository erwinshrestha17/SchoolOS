# SchoolOS Web and Mobile Master Design Plan

**Status:** Active source of truth for frontend and mobile planning
**Updated:** 2026-06-15
**Scope:** Planning only. Do not implement web or mobile screens from this document until the planning pass is accepted.

This document consolidates the previous screen-contract, role/device, component-roadmap, and design-reference planning files. It is grounded in the current repo: NestJS modular monolith, Next.js web dashboard, Flutter companion app, tenant-scoped APIs, File Registry, RBAC, and the existing route/controller surface.

## 1. Final Read Order

Read in this order before frontend or mobile implementation:

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
5. `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
6. `docs/project/SCHOOLOS_PROJECT_STATUS.md`
7. `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`
8. `docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md`
9. `docs/project/SCHOOLOS_LEARNING_LAYER_PLAN.md`
10. `docs/project/SCHOOLOS_COST_PERFORMANCE_IMPLEMENTATION_PLAN.md`
11. `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
12. `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md`
13. `docs/design/SCHOOLOS_UI_UX_GUIDE.md`
14. `docs/design/SCHOOLOS_WEB_MOBILE_MASTER_DESIGN_PLAN.md`
15. `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_API_CONTRACT_MAP.md`
16. `docs/mobile/SCHOOLOS_FLUTTER_APP_PLAN.md`
17. `docs/testing/SCHOOLOS_WEB_MOBILE_PERSONA_SMOKE_PLAN.md`
18. `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md`
19. `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md`
20. `apps/web/e2e/README.md`

## 2. Documentation Inventory Decisions

| File | Decision | Replacement / reason |
|---|---|---|
| `README.md` | Keep active | Repo-level source-of-truth index and current stage. |
| `AGENTS.md` | Keep active | Agent operating and engineering rules. |
| `docs/README.md` | Keep active, updated | Documentation index and cleanup rules. |
| `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Keep active | Product source of truth. |
| `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Keep active | Functional source of truth. |
| `docs/project/SCHOOLOS_PROJECT_STATUS.md` | Keep active | Current implementation status. |
| `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Keep active | Backend/frontend implementation sequencing after planning. |
| `docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md` | Keep active | Advanced operations depth, not MVP navigation labels. |
| `docs/project/SCHOOLOS_LEARNING_LAYER_PLAN.md` | Keep active | M12 learning source of truth. |
| `docs/project/SCHOOLOS_COST_PERFORMANCE_IMPLEMENTATION_PLAN.md` | Keep active | Cost and performance guardrails. |
| `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Keep active | Tenant, File Registry, storage, queue, security, cost rules. |
| `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Keep active | Platform plane and support override rules. |
| `docs/design/SCHOOLOS_UI_UX_GUIDE.md` | Keep active, updated | Visual system and role-aware UI rules. |
| `docs/design/SCHOOLOS_WEB_MOBILE_MASTER_DESIGN_PLAN.md` | Keep active, new | Consolidated role/device, screen, navigation, blueprint, and readiness plan. |
| `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_API_CONTRACT_MAP.md` | Keep active, renamed/updated | Replaces frontend API consumption and contract sync docs. |
| `docs/mobile/SCHOOLOS_FLUTTER_APP_PLAN.md` | Keep active, new | Replaces broad mobile guide sections and locks student access to lab-only for MVP. |
| `docs/testing/SCHOOLOS_WEB_MOBILE_PERSONA_SMOKE_PLAN.md` | Keep active, renamed/updated | Replaces persona smoke plan. |
| `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Keep active | Deployment and verification source of truth. |
| `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` | Keep as app-local pointer | Detailed content merged into `docs/mobile/SCHOOLOS_FLUTTER_APP_PLAN.md`. |
| `apps/web/e2e/README.md` | Keep active | Local Playwright smoke instructions; links to consolidated smoke plan. |
| `docs/archive/README.md` | Keep reference | Archive policy only. |
| `apps/schoolos_mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` | Keep generated asset note | iOS launch asset README, not product planning. |
| `docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md` | Delete after merge | Component layers and build-order rules merged here and into UI guide/API map. |
| `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md` | Delete after merge | Contract rules merged into API contract map and readiness checklist. |
| `docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md` | Delete after merge | Backend `packages/core/src/permissions.ts` and controller `@Permissions` are authoritative; role guidance merged here. |
| `docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md` | Delete after merge | Matrix rules merged into the readiness checklist and screen blueprint sections. |
| `docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md` | Delete as duplicate | Token decisions live in `docs/design/SCHOOLOS_UI_UX_GUIDE.md`. |
| `docs/design/references/SCHOOLOS_ROLE_SCREEN_DESIGN_REFERENCE.md` | Delete after merge | Role/device/screen design rules merged here. |
| `docs/design/references/README.md` | Delete | Reference folder no longer has active content. |
| `docs/frontend/references/README.md` | Delete | Reference folder no longer has active content. |

## 3. Role Access and Device Matrix

| Role | Device choice | Reason | Main workflows | Forbidden workflows |
|---|---|---|---|---|
| Platform Operator | Web only | Needs dense tenant, provider, queue, billing, audit controls. | Tenant onboarding/status, SaaS billing, providers, queues, audit, support override. | Silent tenant access, school fee collection, student/private data without override. |
| School Owner / Director | Web first, optional mobile alerts | Needs executive review and approvals, not daily data entry. | Enrollment, dues, revenue, expenses, module health, approvals, audit summary. | Unpublished marks, private chats, payroll salary details unless granted. |
| Principal / Head Teacher | Both | Web for school operations; mobile for alerts/approvals. | Attendance risk, substitutions, academic readiness, notices, approvals. | Platform billing, deep accounting/payroll unless granted. |
| Academic Coordinator | Web first, optional mobile alerts | Timetable/exams/marks are dense workflows. | Exam setup, marks readiness, timetable conflicts, report cards, result publishing. | Finance, payroll, tenant platform controls. |
| School Admin / Office Admin | Web first | Student/admin workflows need forms, files, tables. | Students, admissions, guardians, documents, settings tasks, reports. | Salary, ledger postings, private chats unless granted. |
| Admission Officer | Web first | Pipeline, document review, duplicate checks need tables and files. | Applications, bulk import, duplicate review, enrollment handoff. | Existing student finance ledger, payroll, unrelated academics. |
| Class Teacher | Both | Web for class management; mobile for daily attendance/homework/activity. | Own class roster, attendance, homework, activity posts, parent messages. | Other classes, finance, payroll, accounting. |
| Subject Teacher | Both | Web for marks/homework; mobile for today tasks. | Assigned classes/subjects, marks entry, homework, timetable, syllabus. | Fees, payroll, unrelated student records. |
| Accountant | Web first | Money workflows need audit, tables, exports, approvals. | Fee setup, invoices, payments, receipts, journals, reports, reconciliation. | Academic marks, private chats, payroll HR details beyond accounting need. |
| Cashier | Web/tablet first | Counter workflow needs fast receipt and close controls. | Collect payment, issue/reprint receipt with reason, cashier close. | Fee setup, accounting configuration, payroll. |
| HR / Payroll Officer | Web first, optional staff mobile | Staff/payroll requires confidential tables and PDFs. | Staff lifecycle, leave, salary structures, payroll runs, payslips. | Student finance, academic marks, parent chat. |
| Librarian | Web first, optional scanner device later | Desk workflow needs catalog and issue/return. | Books, copies, issue/return, reservations, fines, reports. | Full student profile, salary, ledger. |
| Transport Manager | Web first, mobile monitoring optional | Route/vehicle setup is web; live operations may be mobile. | Routes, vehicles, assignments, trips, GPS status, reports. | Academics, payroll, accounting ledgers. |
| Driver / Conductor | Mobile only | Safety-first trip operation, small assigned scope. | Assigned trip, manifest, boarded/dropped/absent, GPS ping, emergency contact. | Admin web, fees, academics, full student profiles, other routes. |
| Canteen Manager | Web/tablet first | Menu, inventory, wallet, POS and reports need role-specific surfaces. | Menu, meal plans, enrollments, wallet, inventory, POS, reports. | Academic marks, payroll, full guardian data. |
| Canteen POS Staff | Tablet/mobile POS only | Needs fast scan/sell/serve, not full inventory/reporting. | Scan student, serve meal, POS sale, receipt. | Inventory cost, finance reports, student full profile. |
| Parent / Guardian | Mobile first, optional parent web | Needs own-child summary and clear notices. | Own child attendance, dues, receipts, notices, homework, report cards, transport, canteen, library, activity, chat. | Other children, internal reports, staff/private data, unpublished results. |
| Student | Computer-lab/session only for MVP | Product decision: no broad student mobile/home app in MVP. Learning happens on controlled school devices. | Join learning session, complete assigned learning activity, view session result on lab device. | Broad mobile app, fees, parent/staff data, other students, public leaderboard. |
| Staff Self-Service User | Mobile first, web optional | Repeated personal actions are simple and mobile-friendly. | Profile, attendance/check-in, leave, payslips, notices. | HR admin, payroll runs, staff salary tables. |
| Support Operator | Platform web plus audited support override | Must be explicit, time-limited, reasoned, audited. | Troubleshoot tenant setup and support issues under override. | Silent tenant access, broad data browsing, mutation without reason. |

## 4. Role-Based Navigation Plan

| Surface | Navigation |
|---|---|
| Platform web | Attention, Schools, Plans & Billing, Providers, Queues, Reports, Audit, Support Override. |
| School admin web | Today, Students, Admissions, Attendance, Fees, Academics, Homework, Timetable, Notices, Reports, Settings. |
| Teacher web | Today, My Classes, Attendance, Homework, Marks, Timetable, Activity, Messages, My Profile. |
| Finance/accounting web | Today, Fee Collection, Invoices, Receipts, Dues, Cashier Close, Accounting, Reconciliation, Reports. |
| Parent mobile | Home, Children, Attendance, Homework, Fees, Notices, More. More contains report cards, transport, canteen, library, activity, chat where enabled. |
| Teacher mobile | Today, Attendance, Homework, Notices, Messages, Profile. |
| Driver mobile | Trip, Manifest, GPS, History, Emergency. |
| Staff self-service mobile | Home, Attendance, Leave, Payslips, Notices, Profile. |
| Student lab-only route | Join Session, Activity, Progress, Exit. No broad sidebar/bottom nav. |

## 5. Module-Wise Screen Design Plan

Each module screen must handle loading, empty, error, success, permission denied, module locked, and destructive confirmation states. Mutations are tenant-scoped and audit-sensitive when they create/update/delete/archive/approve/post/reverse/publish.

| Module | Purpose | Roles | Web routes/screens | Mobile/lab routes | Primary job and actions | Data, filters, files, offline notes |
|---|---|---|---|---|---|---|
| M0 Platform Core | SaaS operations and tenant lifecycle. | Platform operator, support operator. | `/platform`, `/platform/schools`, `/platform/billing`, `/platform/settings`, `/platform/operations/*`, `/platform/audit`. | None. | Monitor platform health, manage tenants/plans/providers/queues/support override. | Paginated tenants/audit/jobs; reason required for status/retry/discard/override; SaaS billing separate from fees. |
| Auth/RBAC/Settings | Secure access and tenant configuration. | Admin, owner, platform where applicable. | `/login`, `/dashboard/settings/*`, `/platform/settings/*`. | Mobile login/profile/settings. | Login, restore session, manage users/roles/settings/logo/modules. | Cookie-first web auth; secure mobile token storage; File Registry for logo; permission denied visible on direct routes. |
| M1 Admissions & Students | Student lifecycle from application to alumni/archive. | Admin, admission officer, class teacher scoped, principal, parent read via child summary. | `/dashboard/students`, `/dashboard/students/[studentId]`, `/dashboard/admissions/*`. | Parent child summary; teacher class list; no student mobile. | Search students, manage profile/guardians/docs, review admissions, import, enroll, resolve duplicates. | Server pagination/filtering; private photos/docs; iEMIS exports through protected downloads; lifecycle actions require reasons. |
| M2 Attendance | Student/staff attendance and correction workflows. | Teacher, principal, admin, parent, staff self-service. | `/dashboard/attendance`, `/dashboard/attendance/register`, `/dashboard/attendance/corrections`, `/dashboard/hr/attendance`. | Teacher attendance, parent attendance, staff attendance/check-in. | Mark attendance, review conflicts/corrections, view register/history. | Offline teacher drafts allowed; duplicate/locked session states; CSV export authenticated. |
| M3 Fees & Receipts | School fee setup, dues, payments, receipts. | Accountant, cashier, owner/principal summary, parent. | `/dashboard/fees`, `/dashboard/finance/*`. | Parent fees/receipts summary only. | Create bills, collect payments, issue/reprint receipts, manage dues/refunds/cashier close. | Decimal money; server totals; receipt PDF/blob; reversal/refund/cashier close audited. |
| M4 Academics / Exams / Report Cards | Exams, marks, CAS, results, report cards, promotions. | Academic coordinator, teachers, principal, parent read. | `/dashboard/academics/*`, `/dashboard/exams`, `/dashboard/marks-entry`. | Parent published report cards only. | Setup exams, enter marks/CAS, generate/publish report cards, manage promotions. | Marks locks; publish/unpublish confirmations; protected PDF report cards; no unpublished parent access. |
| M5 Activity Feed | Child activity, media, mood logs, milestones. | Teacher, parent, moderator/admin. | `/dashboard/activity/*`. | Parent activity summary; teacher quick post later. | Create/moderate posts, preview audience, view gallery/milestones. | File Registry/private media; consent-aware preview; queue media variants; low-bandwidth thumbnails. |
| M6 Homework / Timetable | Homework assignments and timetable operations. | Teachers, academic coordinator, parent. | `/dashboard/homework/*`, `/dashboard/timetable/*`. | Teacher daily homework/timetable; parent homework/timetable. | Assign/review homework, send reminders, build/publish timetable, manage substitutions. | Attachments through File Registry; reminders preview before send; offline mobile read cache for teacher/parent lists. |
| M7 HR / Payroll | Staff records, attendance, leave, payroll. | HR/payroll, accountant, principal, staff self-service. | `/dashboard/hr/*`, `/dashboard/payroll/*`, `/dashboard/my-profile`. | Staff attendance, leave, payslips, profile. | Manage staff lifecycle, leave, payroll runs, payslips. | Confidential salary gating; payslip PDFs protected; payroll posting/reversal audited. |
| M8A Library | Catalog, issue/return, reservations, fines. | Librarian, admin, parent/student summary when allowed. | `/dashboard/library/*`. | Parent child library summary optional; no broad student mobile. | Catalog books/copies, scan issue/return, manage overdue/fines/reports. | Scanner states; CSV/export through File Registry; fines-to-fees audited. |
| M8B Transport | Routes, vehicles, assignments, trips, GPS. | Transport manager, driver, parent. | `/dashboard/transport/*`. | Driver trip app; parent transport status. | Setup routes/vehicles, assign students/drivers, operate trips, view GPS/reports. | Driver purpose-limited APIs; stale GPS state; offline pending pings; no live map expansion without policy. |
| M8C Canteen | Menu, meal plans, serving, wallets, POS, inventory. | Canteen manager, POS staff, parent. | `/dashboard/canteen/*`. | Parent canteen summary; POS tablet/mobile where assigned. | Serve meals, POS sale, manage wallet/menu/inventory/reports. | Allergy acknowledgement; wallet limits; receipt PDF/File Registry; stock corrections audited. |
| M9 Accounting | Chart, fiscal periods, journals, reports, reconciliation. | Accountant, owner/principal summary if granted. | `/dashboard/accounting/*`. | No full mobile accounting; executive read-only summary later. | Manage accounts, journals, vouchers, reports, fiscal close, bank reconciliation. | Ledger writes through accounting boundary; exports queued/protected; close/reopen/reverse audited. |
| M10 Notices / Communication / Chat | Notices, events, notifications, parent-teacher chat. | Admin, principal, teacher, parent. | `/dashboard/notices/*`, `/dashboard/messages/*`. | Parent notices/chat; teacher notices/chat. | Compose notices, preview audience, track delivery/read state, chat during policy hours. | Recipient preview; delivery retry states; attachments through File Registry; moderation/quiet hours. |
| M11 Intelligence / AI | Roadmap only. | None in MVP. | No implementation screen. | None. | Future reviewed/explainable insights only after approval. | No AI runtime, leaderboard, or automatic inference in MVP. |
| M12 Learning Layer | Controlled school learning sessions. | Teacher, student lab participant, parent summary. | `/dashboard/learning/*`, `/classroom/board/session/[sessionId]`, `/parent/learning/*`, `/student/learning/*`. | Parent learning summary only; student lab/session route on controlled devices. | Create activities/resources/sessions, join lab session, autosave/submit attempts, view progress. | No broad student mobile; session codes scoped; resources through File Registry; autosave idempotent. |
| Advanced Operations | Approvals, automation, analytics, templates, exports. | Admin, owner/principal, module owners. | Future `/dashboard/operations/*` or module-local panels. | Approval cards later only. | Approval inbox, automation rules, analytics, document templates, export center. | Long work queued; audit reasons; File Registry for templates/exports. |
| File Registry / Reports / Exports | Protected files, PDFs, CSVs, report snapshots. | Any permitted actor. | `/dashboard/reports`, module report pages, platform report exports. | Purpose-limited downloads only. | Upload, preview, download, export, retry report job. | No public URLs; signed/protected access; large exports queued; list paginated. |

## 6. UI Screen Blueprint

Every major screen must define:

| Field | Required planning answer |
|---|---|
| Screen name and route | User-facing name and exact route. |
| Role and surface | Web, mobile, tablet/POS, lab, or platform web. |
| Goal | The one job this screen helps the role finish. |
| Layout | Header, filters, main work area, side panel if needed, sticky action bar if needed. |
| Summary cards | Only operationally useful cards. No decorative statistics. |
| Main work area | Table, roster, form, feed, scanner, builder, timeline, or report. |
| Primary CTA | One dominant action that fits the role. |
| Secondary actions | In row actions, menus, or small buttons. |
| States | Loading, empty, error, success, permission denied, module locked, read-only, offline where relevant. |
| Components | Existing shared components first; create module components only when needed. |
| API dependencies | Exact endpoint/client family, DTOs, pagination, filters, blob/file behavior. |
| Acceptance criteria | Role, permission, tenant scope, route, API, DTO, state, and smoke test all mapped. |

## 7. Major Screen Blueprints

| Screen | Route | Role/surface | Goal | Primary CTA | API dependency | Acceptance criteria |
|---|---|---|---|---|---|---|
| Platform Attention Dashboard | `/platform` | Platform operator web | See SaaS health and urgent tenant/provider/queue issues. | Open highest-risk item | `/platform/dashboard`, `/platform/health`, `/platform/queues`, `/platform/providers/readiness` | Platform-only, paginated lists, support override visible if active. |
| School Operations Overview | `/dashboard` | Principal/admin web | Understand today and choose the next school action. | Resolve top alert | Module summaries from real APIs | No fake cards; permission/entitlement controls navigation. |
| Student Directory | `/dashboard/students` | Admin/teacher scoped web | Find the right student and open safe profile context. | Add student / start admission | `/students`, `/students/search`, `/admissions` | Server filters/pagination; teachers see assigned scope only. |
| Admission Pipeline | `/dashboard/admissions` | Admission officer web | Move applications through review to enrollment. | Create application | `/admissions/applications`, `/admissions/applications/:id/enroll` | Duplicate blockers and enrollment status visible. |
| Attendance Marking | `/dashboard/attendance/register` and teacher mobile attendance | Teacher web/mobile | Mark assigned class attendance quickly. | Submit attendance | `/attendance/rosters`, `/attendance/sessions`, `/attendance/drafts`, mobile teacher endpoints | Offline draft state; locked/duplicate states handled. |
| Fee Collection Counter | `/dashboard/finance/collections` | Cashier web/tablet | Collect payment and issue receipt. | Record payment | `/fees`, `/payments`, `/receipts` | Decimal money, double-submit protection, receipt PDF via blob helper. |
| Marks Entry | `/dashboard/academics/marks` | Subject teacher web | Enter marks for assigned class/subject. | Save marks | `/academics/marks`, `/academics/marks/bulk-upsert` | Lock state, row errors, assigned scope. |
| Report Cards | `/dashboard/academics/report-cards` | Coordinator/principal web | Generate, review, publish/download report cards. | Generate batch | `/academics/report-cards`, `/academics/report-cards/:id.pdf` | Protected PDFs, correction workflow audited. |
| Homework Workspace | `/dashboard/homework` | Teacher web | Assign and review homework. | Create homework | `/homework`, `/homework/:id/submissions` | Attachments protected; reminders previewed. |
| Timetable Builder | `/dashboard/timetable/builder` | Coordinator web | Build and publish conflict-free timetable versions. | Validate version | `/timetable/versions`, `/timetable/versions/:id/validate` | Conflict details visible; publish/lock audited. |
| Staff and Payroll Today | `/dashboard/hr`, `/dashboard/payroll` | HR/payroll/accounting web | Manage staff, leave, payroll lifecycle. | Start payroll preview | `/staff`, `/hr`, `/payroll` | Salary visibility permission-gated; payslip PDFs protected. |
| Library Desk | `/dashboard/library/issue-return` | Librarian web/tablet | Issue or return a copy by scan. | Scan copy/student | `/library/qr-lookup`, `/library/issues/scanner`, `/library/returns/scanner` | Scanner success/failure states clear. |
| Transport Operations | `/dashboard/transport` | Transport manager web | Keep routes, vehicles, trips, and GPS healthy. | Start/monitor trip | `/transport/*` | Stale GPS, delay, cancellation states visible. |
| Driver Trip | Flutter driver trip | Driver mobile | Operate assigned trip safely. | Start trip / mark boarded | `/transport/driver/*` | Assigned-trip scope only, offline pending GPS, emergency CTA. |
| Canteen POS / Serving | `/dashboard/canteen/pos`, `/dashboard/canteen/serving` | POS staff web/tablet | Serve or sell safely. | Scan student / complete sale | `/canteen/qr-resolve`, `/canteen/servings`, `/canteen/pos-sales` | Allergy acknowledgement, wallet/eligibility failure states. |
| Accounting Reports | `/dashboard/accounting/reports` | Accountant web | Produce ledger-backed reports. | Export report | `/accounting/reports/*` | No frontend totals; CSV/PDF via authenticated helper/queued exports. |
| Notices | `/dashboard/notices` and mobile notices | Admin/teacher/parent | Send/read school communication. | Send notice | `/notices`, `/notification-center`, `/messaging` | Audience preview, delivery/read status, attachments protected. |
| Learning Session | `/student/learning/join`, `/student/learning/session/[sessionId]` | Student lab route | Join controlled class session and submit activity. | Join / submit | `/learning/sessions/:id/join`, `/learning/sessions/:id/attempts`, `/learning/attempts/:id/*` | Controlled device only, no broad student app, autosave/submit idempotent. |
| Parent Home | Flutter parent home | Parent mobile | Understand own child today. | View top child alert | Parent/mobile scoped endpoints | Own-child scope only; cached read states; friendly errors. |
| Staff Self-Service | Flutter staff home | Staff mobile | Handle personal attendance, leave, payslips. | Request leave / check in | `/hr/me/*`, `/staff/me`, `/payroll/me/payslips` | Own-data only, secure storage, offline read cache. |

## 8. Component and File Structure Plan

Web:

```text
apps/web/lib/api/client.ts remains the shared HTTP/blob/error base.
Domain API files stay under apps/web/lib/api/<domain>.ts.
Large workspaces become thin shells plus tabs/components/hooks/utilities.
Reusable states come from apps/web/components/ui and apps/web/components/dashboard.
Module-owned components stay under apps/web/components/<module>.
```

Flutter:

```text
apps/schoolos_mobile/lib/core owns auth, network, storage, permissions, errors.
apps/schoolos_mobile/lib/features/<feature> owns data/application/domain/presentation.
No admin-shaped repository powers parent, driver, staff, or lab/student flows.
Broad student mobile screens are deferred.
```

## 9. Implementation Readiness Checklist

Before any screen is implemented, the row must be complete:

```text
Role -> Permission -> Scope -> Route -> API -> DTO -> Component -> State -> Test
```

Minimum acceptance:

1. Role and device choice match the matrix above.
2. Permission is backed by `@Permissions` or `packages/core/src/permissions.ts`.
3. Tenant, own-child, own-staff, assigned-class, assigned-trip, or platform scope is explicit.
4. Route exists or is named as planned.
5. API endpoint/client is listed in `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_API_CONTRACT_MAP.md`.
6. Request DTO/query parameters and response purpose are known.
7. Loading, empty, error, success, permission-denied, and module-locked states are designed.
8. Mutations have confirmation, audit reason, and idempotency where needed.
9. Files/PDFs/CSVs use File Registry or authenticated blob/download helpers.
10. Lists that can grow are paginated and filtered server-side.
11. Mobile flows are purpose-limited and low-bandwidth aware.
12. Smoke/persona test is listed in `docs/testing/SCHOOLOS_WEB_MOBILE_PERSONA_SMOKE_PLAN.md`.

## 10. Non-Negotiable Planning Decisions

1. Students do not get a broad MVP mobile app.
2. Student learning access is lab-only or controlled school-device only for MVP.
3. Parent mobile is own-child only.
4. Driver mobile is assigned-trip only.
5. Admin, finance, accounting, payroll, platform, and reporting stay web-first.
6. Mobile is not a smaller dashboard.
7. Backend business logic is not changed during this planning pass.
8. No fake data, Angular, microservices, tenantId rename, or AI runtime is planned.
